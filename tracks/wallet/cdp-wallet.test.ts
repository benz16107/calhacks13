// The CDP Server Wallet's pieces, with a fake Coinbase client and no money moving: which mode the wallet is in,
// the signer handing a transaction to Coinbase and keeping only its own signature, the policy rules, the owner's
// policy route, and GurtOS's own allowlist check.
//   node --experimental-strip-types --test tracks/wallet/cdp-wallet.test.ts
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';
import { CreatePolicyBodySchema } from '@coinbase/cdp-sdk';
import {
  AccountRole,
  compileTransaction,
  appendTransactionMessageInstruction,
  createTransactionMessage,
  generateKeyPairSigner,
  getBase64Decoder,
  getBase64Encoder,
  getTransactionDecoder,
  getTransactionEncoder,
  partiallySignTransactionMessageWithSigners,
  pipe,
  setTransactionMessageFeePayer,
  setTransactionMessageLifetimeUsingBlockhash,
  verifySignature,
  type Blockhash,
} from '@solana/kit';
import type { Ctx } from '../../core/contract.ts';
import { checkLocalPolicy, cdpSigner, localPolicy, policyRoutes, policyRules, useCdpClient, validPolicy, walletMode, walletSigner, type Cdp } from './cdp-wallet.ts';
import { newKey } from './keygen.ts';
import { USDC } from './lib.ts';

process.env.BOX_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'cdp-wallet-test-'));
after(() => fs.rmSync(process.env.BOX_HOME!, { recursive: true, force: true }));

const PAYEE = '39w7W3SBxE62zsS7VQY5dgZQXGWko2EkBXMfHg2sLtKV';
const vaultKey = newKey().secret;
const secrets = (vault: Record<string, string>) => ({ secret: (n: string) => { if (!(n in vault)) throw new Error(`no ${n}`); return vault[n]; } }) as Ctx;
const cdpVault = { CDP_API_KEY_ID: 'id', CDP_API_KEY_SECRET: 's', CDP_WALLET_SECRET: 'w', WALLET_SOLANA_KEY: vaultKey };

/** Stands in for Coinbase: holds a real key and signs what it is sent, recording every call. */
async function fakeCdp() {
  const key = await generateKeyPairSigner();
  const calls: { name: string; args: any }[] = [];
  const policies = new Map<string, any>();
  let attached: string[] = [];
  const cdp = {
    solana: {
      getOrCreateAccount: async (a: any) => (calls.push({ name: 'getOrCreateAccount', args: a }), { address: key.address }),
      getAccount: async () => ({ address: key.address, policies: attached }),
      updateAccount: async (a: any) => (calls.push({ name: 'updateAccount', args: a }), (attached = [a.update.accountPolicy]), {}),
      requestFaucet: async () => ({ signature: 'sig' }),
      signTransaction: async (a: any) => {
        calls.push({ name: 'signTransaction', args: a });
        const tx = getTransactionDecoder().decode(getBase64Encoder().encode(a.transaction));
        const [sig] = await key.signTransactions([tx as any]);
        const out = getTransactionEncoder().encode({ ...tx, signatures: { ...tx.signatures, ...sig } });
        return { signedTransaction: getBase64Decoder().decode(out), signature: 'x' };
      },
    },
    policies: {
      listPolicies: async () => ({ policies: [...policies.values()] }),
      createPolicy: async (a: any) => {
        calls.push({ name: 'createPolicy', args: a });
        const p = { id: `p${policies.size + 1}`, ...a.policy };
        policies.set(p.id, p);
        return p;
      },
      updatePolicy: async (a: any) => (calls.push({ name: 'updatePolicy', args: a }), policies.set(a.id, { ...policies.get(a.id), ...a.policy }), policies.get(a.id)),
      getPolicyById: async (a: any) => policies.get(a.id),
    },
  };
  return { key, calls, cdp: cdp as unknown as Cdp };
}

/** Like x402: the facilitator pays the fee, our wallet only authorizes the transfer. */
const x402Like = (feePayer: string, signer: any, data = 1) =>
  pipe(
    createTransactionMessage({ version: 0 }),
    (m) => setTransactionMessageFeePayer(feePayer as any, m),
    (m) => setTransactionMessageLifetimeUsingBlockhash({ blockhash: '11111111111111111111111111111111' as Blockhash, lastValidBlockHeight: 1n }, m),
    (m) => appendTransactionMessageInstruction({ programAddress: 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr' as any, accounts: [{ address: signer.address, role: AccountRole.READONLY_SIGNER, signer }], data: new Uint8Array([data]) }, m),
  );

test('mode is cdp only with all three CDP keys; any missing key falls back to the vault key', async () => {
  assert.equal(walletMode(secrets(cdpVault)), 'cdp');
  assert.equal(walletMode(secrets({ WALLET_SOLANA_KEY: vaultKey })), 'vault-key');
  assert.equal(walletMode(secrets({ ...cdpVault, CDP_WALLET_SECRET: '' })), 'vault-key');
  const { CDP_WALLET_SECRET: _, ...noWallet } = cdpVault;
  assert.equal(walletMode(secrets(noWallet)), 'vault-key');
  const w = await walletSigner(secrets({ WALLET_SOLANA_KEY: vaultKey }));
  assert.equal(w.mode, 'vault-key');
  assert.equal(w.address, w.signer.address);
});

test('in cdp mode the signer sends Coinbase the transaction and merges back only our signature', async () => {
  const fake = await fakeCdp();
  let made: any;
  useCdpClient((k) => ((made = k), fake.cdp));
  const w = await walletSigner(secrets(cdpVault));
  assert.equal(w.mode, 'cdp');
  assert.equal(w.address, fake.key.address);
  assert.deepEqual(made, { apiKeyId: 'id', apiKeySecret: 's', walletSecret: 'w' }, 'keys come from the vault, never process.env');
  assert.deepEqual(fake.calls[0], { name: 'getOrCreateAccount', args: { name: 'gurtos-agent-wallet' } });

  const facilitator = await generateKeyPairSigner();
  const msg = x402Like(facilitator.address, w.signer);
  const signed = await partiallySignTransactionMessageWithSigners(msg as any);
  assert.equal(signed.signatures[facilitator.address], null, 'the fee payer slot stays empty for the facilitator');
  const ours = signed.signatures[w.address as any]!;
  assert.ok(await verifySignature(fake.key.keyPair.publicKey, ours, signed.messageBytes), 'our signature is valid over the message we built');
  assert.equal(fake.calls.filter((c) => c.name === 'signTransaction').length, 1);
});

test('the signer refuses an answer without our signature or for a different message', async () => {
  const fake = await fakeCdp();
  const fee = (await generateKeyPairSigner()).address;
  const tx = compileTransaction(x402Like(fee, fake.key) as any);
  const answer = (t: any) => cdpSigner({ ...fake.cdp, solana: { ...fake.cdp.solana, signTransaction: async () => ({ signedTransaction: getBase64Decoder().decode(getTransactionEncoder().encode(t)), signature: '' }) } } as Cdp, fake.key.address);
  await assert.rejects(answer(tx).signTransactions([tx as any]), /without our signature/);
  const different = compileTransaction(x402Like(fee, fake.key, 2) as any);
  const other = { ...different, signatures: { ...different.signatures, [fake.key.address]: new Uint8Array(64).fill(7) } };
  await assert.rejects(answer(other).signTransactions([tx as any]), /different transaction/);
});

test('the policy rules pass the SDK validation and say what we mean', async () => {
  const rules = await policyRules({ payees: [PAYEE], maxCentsPerPayment: 5 });
  CreatePolicyBodySchema.parse({ scope: 'account', description: 'test', rules });
  const sign = rules.filter((r) => r.operation === 'signSolTransaction') as any[];
  const accept = sign.find((r) => r.action === 'accept');
  const by = (t: string) => accept.criteria.find((c: any) => c.type === t);
  assert.ok(by('splAddress').addresses.includes(PAYEE));
  assert.equal(by('splAddress').addresses.length, 2, 'the payee and its USDC account');
  assert.deepEqual(by('mintAddress'), { type: 'mintAddress', addresses: [USDC], operator: 'in' });
  assert.deepEqual(by('splValue'), { type: 'splValue', splValue: '50000', operator: '<=' });
  assert.ok(sign.some((r) => r.action === 'reject' && r.criteria[0].type === 'solValue' && r.criteria[0].operator === '>' && r.criteria[0].solValue === '0'), 'a plain SOL transfer is rejected');
  assert.ok(rules.some((r) => r.operation === 'sendSolTransaction' && r.action === 'accept'));
  assert.ok(rules.some((r) => r.operation === 'signSolMessage' && r.action === 'reject'));
});

test('POST /policy validates, creates the policy once, attaches it, and GET reads it back from Coinbase', async () => {
  const fake = await fakeCdp();
  useCdpClient(() => fake.cdp);
  const box = secrets(cdpVault) as any;
  const post = (body: unknown) => policyRoutes['POST /policy'](new Request('http://x/policy', { method: 'POST', body: JSON.stringify(body) }), box);
  for (const bad of [{}, { payees: ['nope'], maxCentsPerPayment: 5 }, { payees: [PAYEE], maxCentsPerPayment: 0 }, { payees: [PAYEE], maxCentsPerPayment: 101 }, { payees: [PAYEE], maxCentsPerPayment: 2.5 }, { payees: [], maxCentsPerPayment: 5 }]) {
    assert.equal((await post(bad)).status, 400, JSON.stringify(bad));
  }
  assert.equal(fake.calls.filter((c) => c.name === 'createPolicy').length, 0);

  const res = await post({ payees: [PAYEE, PAYEE], maxCentsPerPayment: 5 });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { mode: 'cdp', label: "Enforced twice: by GurtOS, and by Coinbase's policy engine on the CDP Server Wallet.", account: fake.key.address, policyId: 'p1', payees: [PAYEE], maxCentsPerPayment: 5, test: true });
  await post({ payees: [PAYEE], maxCentsPerPayment: 3 });
  assert.equal(fake.calls.filter((c) => c.name === 'createPolicy').length, 1, 'the second call updates the same policy');
  assert.equal(fake.calls.filter((c) => c.name === 'updatePolicy').length, 1);
  assert.equal(fake.calls.filter((c) => c.name === 'updateAccount').length, 1, 'attached once');
  assert.equal((await (await policyRoutes['GET /policy'](new Request('http://x/policy'), box)).json()).maxCentsPerPayment, 3);
  assert.deepEqual(localPolicy(), { payees: [PAYEE], maxCentsPerPayment: 3 });
});

test('vault-key mode keeps the policy locally and labels it honestly', async () => {
  const box = secrets({ WALLET_SOLANA_KEY: vaultKey }) as any;
  const s = await (await policyRoutes['GET /policy'](new Request('http://x/policy'), box)).json();
  assert.equal(s.mode, 'vault-key');
  assert.match(s.label, /GurtOS only; Coinbase policy needs CDP Server Wallets/);
});

test('the local check refuses other payees, other tokens and amounts over the cap', () => {
  const p = validPolicy({ payees: [PAYEE], maxCentsPerPayment: 5 });
  const offer = { payTo: PAYEE, amount: '10000', asset: USDC };
  checkLocalPolicy(p, offer);
  checkLocalPolicy(p, { ...offer, amount: '50000' });
  checkLocalPolicy(undefined, { ...offer, payTo: 'anyone' });
  assert.throws(() => checkLocalPolicy(p, { ...offer, payTo: '6PyiR71c9aw3e8bgnxmcLvJECL5zHE5jMSWqJoVjPTxU' }), /not on the owner's payee list/);
  assert.throws(() => checkLocalPolicy(p, { ...offer, amount: '60000' }), /over the owner's cap of 5 cents/);
  assert.throws(() => checkLocalPolicy(p, { ...offer, asset: 'So11111111111111111111111111111111111111112' }), /devnet USDC payments only/);
});
