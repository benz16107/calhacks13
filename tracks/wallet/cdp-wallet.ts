// The second lock on the agent's money. With CDP keys in the vault, the agent wallet is a Coinbase CDP Server
// Wallet: Coinbase holds the Solana key and signs only what the account's policy allows (listed payees, a cap per
// payment, devnet USDC only). That sits under GurtOS's own budgets and owner approvals, so a box that is fully
// taken over still cannot pay outside the policy, as long as its CDP key cannot change policies (see README).
// Without CDP keys the wallet falls back to the vault-held key, and GurtOS checks the same allowlist and cap alone.
import fs from 'node:fs';
import path from 'node:path';
import { CdpClient } from '@coinbase/cdp-sdk';
import type { CreatePolicyBody } from '@coinbase/cdp-sdk';
import {
  address as toAddress,
  getAddressEncoder,
  getBase64EncodedWireTransaction,
  getBase64Decoder,
  getBase64Encoder,
  getProgramDerivedAddress,
  getTransactionDecoder,
  isAddress,
} from '@solana/kit';
import type { TransactionPartialSigner } from '@solana/kit';
import type { PaymentRequirements } from '@x402/core/types';
import type { Ctx, Route } from '../../core/contract.ts';
import { USDC, signer as vaultSigner, walletDir } from './lib.ts';

export const CDP_SECRETS = ['CDP_API_KEY_ID', 'CDP_API_KEY_SECRET', 'CDP_WALLET_SECRET'];
export const ACCOUNT = 'gurtos-agent-wallet';
const DESCRIPTION = 'GurtOS agent wallet: payees, cap, devnet USDC';
const TOKEN_PROGRAM = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const ATA_PROGRAM = 'ATokenGPvbdGVxr1b2hvZbsMfi8y2Y6GzKvXQZjSJ8j';
export const MAX_TEST_CENTS = 100;

export type Mode = 'cdp' | 'vault-key';
export type Policy = { payees: string[]; maxCentsPerPayment: number };
type Secrets = Pick<Ctx, 'secret'>;
/** The parts of CdpClient this file uses, so tests can hand in a fake. */
export type Cdp = { solana: Pick<CdpClient['solana'], 'getOrCreateAccount' | 'getAccount' | 'signTransaction' | 'updateAccount' | 'requestFaucet'>; policies: Pick<CdpClient['policies'], 'createPolicy' | 'updatePolicy' | 'getPolicyById' | 'listPolicies' | 'simulate'> };

export const LABELS: Record<Mode, string> = {
  cdp: "Enforced twice: by GurtOS, and by Coinbase's policy engine on the CDP Server Wallet.",
  'vault-key': "Enforced by GurtOS only; Coinbase policy needs CDP Server Wallets.",
};

let makeClient = (k: { apiKeyId: string; apiKeySecret: string; walletSecret: string }): Cdp => new CdpClient(k);
/** Tests swap in a fake CDP client. */
export function useCdpClient(make: typeof makeClient) {
  makeClient = make;
  cached = undefined;
}

/** The three CDP keys, or undefined when any is missing: ctx.secret throws for an absent optional secret. */
function cdpKeys(ctx: Secrets) {
  try {
    const [apiKeyId, apiKeySecret, walletSecret] = CDP_SECRETS.map((n) => ctx.secret(n));
    return apiKeyId && apiKeySecret && walletSecret ? { apiKeyId, apiKeySecret, walletSecret } : undefined;
  } catch {
    return undefined;
  }
}

export const walletMode = (ctx: Secrets): Mode => (cdpKeys(ctx) ? 'cdp' : 'vault-key');

let cached: { apiKeyId: string; cdp: Cdp; address: string } | undefined;
/** The CDP client and the one named Solana account, made once per API key. */
export async function cdpAccount(ctx: Secrets) {
  const keys = cdpKeys(ctx);
  if (!keys) throw new Error('no CDP keys in the vault');
  if (cached?.apiKeyId !== keys.apiKeyId) {
    const cdp = makeClient(keys);
    const { address } = await cdp.solana.getOrCreateAccount({ name: ACCOUNT });
    cached = { apiKeyId: keys.apiKeyId, cdp, address };
  }
  return cached;
}

/**
 * A @solana/kit partial signer whose key lives at Coinbase. x402 builds a transaction whose fee payer is the
 * facilitator, so it reaches CDP with that signature slot empty; we keep only our own signature from the answer.
 */
export function cdpSigner(cdp: Cdp, address: string): TransactionPartialSigner {
  const addr = toAddress(address);
  return {
    address: addr,
    signTransactions: (txs) =>
      Promise.all(
        txs.map(async (tx) => {
          const { signedTransaction } = await cdp.solana.signTransaction({ address, transaction: getBase64EncodedWireTransaction(tx) });
          const signed = getTransactionDecoder().decode(getBase64Encoder().encode(signedTransaction));
          const sig = signed.signatures[addr];
          if (!sig) throw new Error('Coinbase returned the transaction without our signature');
          if (getBase64Decoder().decode(signed.messageBytes) !== getBase64Decoder().decode(tx.messageBytes)) throw new Error('Coinbase signed a different transaction than we sent');
          return Object.freeze({ [addr]: sig });
        }),
      ),
  };
}

/** The signer wallet.pay hands to ExactSvmScheme or UptoSvmScheme, and which mode it is in. */
export async function walletSigner(ctx: Secrets): Promise<{ mode: Mode; address: string; signer: TransactionPartialSigner }> {
  if (walletMode(ctx) === 'cdp') {
    const { cdp, address } = await cdpAccount(ctx);
    return { mode: 'cdp', address, signer: cdpSigner(cdp, address) };
  }
  const s = await vaultSigner(ctx as Ctx);
  return { mode: 'vault-key', address: s.address, signer: s };
}

/** The devnet USDC account of an owner. x402 pays it, so the policy lists it beside the owner. */
async function usdcAccount(owner: string) {
  const enc = getAddressEncoder();
  const [pda] = await getProgramDerivedAddress({
    programAddress: toAddress(ATA_PROGRAM),
    seeds: [enc.encode(toAddress(owner)), enc.encode(toAddress(TOKEN_PROGRAM)), enc.encode(toAddress(USDC))],
  });
  return pda as string;
}

/** Throws with a plain reason unless the owner's policy input is sound. */
export function validPolicy(p: unknown): Policy {
  const { payees, maxCentsPerPayment } = (p ?? {}) as Partial<Policy>;
  if (!Array.isArray(payees) || payees.length === 0 || payees.length > 20) throw new Error('payees must be a list of 1 to 20 Solana addresses');
  const bad = payees.find((a) => typeof a !== 'string' || !isAddress(a));
  if (bad !== undefined) throw new Error(`not a Solana address: ${String(bad).slice(0, 60)}`);
  if (!Number.isInteger(maxCentsPerPayment) || maxCentsPerPayment! < 1 || maxCentsPerPayment! > MAX_TEST_CENTS) {
    throw new Error(`maxCentsPerPayment must be a whole number of cents from 1 to ${MAX_TEST_CENTS} (test money)`);
  }
  return { payees: [...new Set(payees)], maxCentsPerPayment: maxCentsPerPayment! };
}

/**
 * The policy rules. Coinbase rejects a request that matches any reject rule, else accepts one that matches an
 * accept rule, else rejects it (a policy that targets an operation denies by default). The accept rule alone
 * would do if "in" meant every transfer; the reject rules close the gap if it means any one of them.
 */
export async function policyRules(p: Policy): Promise<CreatePolicyBody['rules']> {
  const allow = [...p.payees, ...(await Promise.all(p.payees.map(usdcAccount)))];
  const cap = String(p.maxCentsPerPayment * 10_000);
  const tx = (operation: 'signSolTransaction' | 'sendSolTransaction') =>
    [
      { action: 'reject', operation, criteria: [{ type: 'solValue', solValue: '0', operator: '>' }] },
      { action: 'reject', operation, criteria: [{ type: 'mintAddress', addresses: [USDC], operator: 'not in' }] },
      { action: 'reject', operation, criteria: [{ type: 'splAddress', addresses: allow, operator: 'not in' }] },
      { action: 'reject', operation, criteria: [{ type: 'splValue', splValue: cap, operator: '>' }] },
      {
        action: 'accept',
        operation,
        criteria: [
          { type: 'splAddress', addresses: allow, operator: 'in' },
          { type: 'mintAddress', addresses: [USDC], operator: 'in' },
          { type: 'splValue', splValue: cap, operator: '<=' },
        ],
      },
    ] as const;
  // A signed message can stand in for a payment off chain, so the agent wallet signs none.
  return [...tx('signSolTransaction'), ...tx('sendSolTransaction'), { action: 'reject', operation: 'signSolMessage', criteria: [{ type: 'solMessage', match: '.*' }] }] as CreatePolicyBody['rules'];
}

const localFile = () => path.join(walletDir(), 'policy.json');
const idFile = () => path.join(walletDir(), 'cdp-policy.json');
const readJson = (file: string) => (fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : undefined);

/** The owner's allowlist and cap as GurtOS stores them. Checked before every payment, in both modes. */
export const localPolicy = (): Policy | undefined => readJson(localFile());

/**
 * Create or update the account's Coinbase policy and attach it. Safe to repeat: it reuses the policy id kept in
 * walletDir(), or finds the policy by its description if that file is gone.
 */
export async function ensurePolicy(ctx: Secrets, p: Policy) {
  const { cdp, address } = await cdpAccount(ctx);
  const rules = await policyRules(p);
  let id: string | undefined = readJson(idFile())?.id;
  if (!id) id = (await cdp.policies.listPolicies({ scope: 'account' })).policies.find((x) => x.description === DESCRIPTION)?.id;
  if (id) await cdp.policies.updatePolicy({ id, policy: { description: DESCRIPTION, rules } });
  else id = (await cdp.policies.createPolicy({ policy: { scope: 'account', description: DESCRIPTION, rules } })).id;
  fs.writeFileSync(idFile(), JSON.stringify({ id }) + '\n', { mode: 0o600 });
  const account = await cdp.solana.getAccount({ address });
  if (!account.policies?.includes(id)) await cdp.solana.updateAccount({ address, update: { accountPolicy: id } });
  return id;
}

/** What the wallet page shows. In cdp mode it is read back from Coinbase, so it shows what Coinbase enforces. */
export async function policySummary(ctx: Secrets) {
  const mode = walletMode(ctx);
  if (mode === 'vault-key') return { mode, label: LABELS[mode], ...(localPolicy() ?? { payees: [], maxCentsPerPayment: null }), test: true };
  const { cdp, address } = await cdpAccount(ctx);
  const policyId = (await cdp.solana.getAccount({ address })).policies?.[0];
  if (!policyId) return { mode, label: 'No Coinbase policy attached yet: Coinbase signs any payment.', account: address, policyId: null, payees: [], maxCentsPerPayment: null, test: true };
  const accept = (await cdp.policies.getPolicyById({ id: policyId })).rules.find((r) => r.action === 'accept' && r.operation === 'signSolTransaction');
  const criteria = ((accept as any)?.criteria ?? []) as any[];
  const listed: string[] = criteria.find((c) => c.type === 'splAddress')?.addresses ?? [];
  const accounts = await Promise.all(listed.map(usdcAccount));
  const cap = criteria.find((c) => c.type === 'splValue')?.splValue;
  return {
    mode, label: LABELS[mode], account: address, policyId,
    payees: listed.filter((_, i) => listed.includes(accounts[i])), // the owners, not their USDC accounts
    maxCentsPerPayment: cap ? Number(cap) / 10_000 : null,
    test: true,
  };
}

/** Save the owner's policy locally and, in cdp mode, at Coinbase. Coinbase first, so a failure saves nothing. */
export async function setPolicy(ctx: Secrets, input: unknown) {
  const p = validPolicy(input);
  if (walletMode(ctx) === 'cdp') await ensurePolicy(ctx, p);
  fs.writeFileSync(localFile(), JSON.stringify(p) + '\n', { mode: 0o600 });
  return p;
}

/** GurtOS's own lock: refuse an offer outside the owner's allowlist or cap. No policy set means no extra limit. */
export function checkLocalPolicy(policy: Policy | undefined, offer: Pick<PaymentRequirements, 'payTo' | 'amount' | 'asset'>) {
  if (!policy) return;
  if (offer.asset !== USDC) throw new Error('the owner allows devnet USDC payments only');
  if (!policy.payees.includes(offer.payTo)) throw new Error(`${offer.payTo} is not on the owner's payee list`);
  if (BigInt(offer.amount) > BigInt(policy.maxCentsPerPayment * 10_000)) throw new Error(`over the owner's cap of ${policy.maxCentsPerPayment} cents per payment`);
}

/** Devnet USDC for the CDP account, from Coinbase's faucet (1 USDC a claim, test money). */
export async function fundCdpAccount(ctx: Secrets) {
  const { cdp, address } = await cdpAccount(ctx);
  return (await cdp.solana.requestFaucet({ address, token: 'usdc' })).signature;
}

/** Owner-only routes: leave them out of openRoutes, so core asks for the paired phone or the box's own screen. */
export const policyRoutes: Record<string, Route> = {
  'GET /policy': async (_req, box) => Response.json(await policySummary(box)),
  'POST /policy': async (req, box) => {
    const body = await req.json().catch(() => undefined);
    try {
      validPolicy(body);
    } catch (e) {
      return Response.json({ error: (e as Error).message }, { status: 400 });
    }
    await setPolicy(box, body);
    return Response.json(await policySummary(box));
  },
};
