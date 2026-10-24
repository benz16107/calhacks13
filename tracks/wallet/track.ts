// The agent wallet. The box holds a Solana key in its vault and pays HTTP APIs that answer 402 Payment
// Required, with x402, in USDC on Solana devnet (test money). Tasks call wallet.quote and wallet.pay through
// their broker; the key never leaves the core. The broker counts each payment toward the task's budget and
// asks for an OK above it.
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createKeyPairSignerFromBytes, getBase58Encoder } from '@solana/kit';
import type { PaymentRequired, PaymentRequirements } from '@x402/core/types';
import { decodePaymentResponseHeader, wrapFetchWithPayment, x402Client, x402HTTPClient } from '@x402/fetch';
import { ExactSvmScheme } from '@x402/svm/exact/client';
import type { Ctx, Track } from '../../core/contract.ts';

export const DEVNET = 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1';
export const USDC = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'; // Circle's devnet USDC mint
const RPC = 'https://api.devnet.solana.com';
const LABEL = 'Solana devnet USDC (test money)';
const MAX_CONTENT = 20_000;
const TIMEOUT_MS = 30_000;

/** USDC has 6 decimals, so 1 cent is 10,000 atomic units. */
export const atomic = (cents: number) => String(Math.round(cents * 10_000));
const validCents = (c: unknown): c is number => typeof c === 'number' && Number.isFinite(c) && c > 0;
const usdc = (amount: string) => (Number(amount) / 1e6).toString();
const explorer = (kind: 'tx' | 'address', id: string) => `https://explorer.solana.com/${kind}/${id}?cluster=devnet`;

/** The same host rule as the task's network (core/net.ts), so the wallet reaches only the task's own hosts. */
export function allowedUrl(hosts: string[], raw: string): URL {
  const url = new URL(raw);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error(`only http and https URLs, not ${url.protocol}`);
  const port = url.port || (url.protocol === 'https:' ? '443' : '80');
  const host = url.hostname;
  const ok = hosts.some((h) => h === host || h === `${host}:${port}` || (h.startsWith('*.') && host.endsWith(h.slice(1))));
  if (!ok) throw new Error(`${url.host} is not one of this task's hosts`);
  return url;
}

/** The one offer the wallet will pay: exact, on Solana devnet, in devnet USDC. */
export function devnetOffer(accepts: PaymentRequirements[]): PaymentRequirements | undefined {
  return accepts.find((a) => a.scheme === 'exact' && a.network === DEVNET && a.asset === USDC);
}

async function signer(ctx: Ctx) {
  return createKeyPairSignerFromBytes(getBase58Encoder().encode(ctx.secret('WALLET_SOLANA_KEY')));
}

/** Read a 402 answer's offers. x402 v2 puts them in a base64 PAYMENT-REQUIRED header. */
async function paymentRequired(res: Response): Promise<PaymentRequired> {
  const body = await res.json().catch(() => undefined);
  return new x402HTTPClient(new x402Client()).getPaymentRequiredResponse((name) => res.headers.get(name), body);
}

/**
 * Mark a payment as started, durably, before any money moves. If the box dies mid-payment, the broker runs the
 * call again on resume; the mark makes that second run refuse instead of paying twice.
 */
function claim(key: string) {
  const dir = path.join(process.env.BOX_HOME ?? '/var/lib/box', 'wallet');
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const file = path.join(dir, createHash('sha256').update(key).digest('hex').slice(0, 32));
  let fd: number;
  try {
    fd = fs.openSync(file, 'wx');
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e;
    throw new Error('this payment started before the box restarted and may have gone through; not paying twice. Check the wallet on the explorer.');
  }
  fs.fsyncSync(fd);
  fs.closeSync(fd);
  const d = fs.openSync(dir, 'r');
  fs.fsyncSync(d);
  fs.closeSync(d);
}

async function balance(owner: string): Promise<number> {
  const r = await fetch(RPC, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getTokenAccountsByOwner', params: [owner, { mint: USDC }, { encoding: 'jsonParsed' }] }),
  });
  const { result, error } = await r.json();
  if (error) throw new Error(`devnet RPC: ${error.message}`);
  return result.value.reduce((sum: number, a: any) => sum + Number(a.account.data.parsed.info.tokenAmount.uiAmountString), 0);
}

export default {
  name: 'wallet',

  tools: [
    {
      name: 'wallet.quote',
      description:
        `Ask what an HTTP API costs before paying. GETs the URL with no payment. A paid API answers 402; this returns its price in US cents and the payee. ` +
        `A free URL returns its content. Payments are in ${LABEL}. Input: { url }.`,
      input: { type: 'object', properties: { url: { type: 'string' } }, required: ['url'] },
      async run(input: { url: string }, ctx) {
        const url = allowedUrl(ctx.task?.hosts ?? [], input.url);
        const res = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(TIMEOUT_MS) });
        if (res.status !== 402) return { url: url.href, status: res.status, cents: 0, content: (await res.text()).slice(0, MAX_CONTENT) };
        const pr = await paymentRequired(res);
        const offer = devnetOffer(pr.accepts);
        if (!offer) throw new Error(`this API takes no ${LABEL}; it offers ${pr.accepts.map((a) => `${a.scheme} on ${a.network}`).join(', ')}`);
        const cents = Number(offer.amount) / 10_000;
        ctx.log(`${url.href} costs $${usdc(offer.amount)} in ${LABEL}, paid to ${offer.payTo}`);
        return { url: url.href, status: 402, cents, usdc: usdc(offer.amount), payee: offer.payTo, network: 'solana-devnet', test: true, description: pr.resource?.description };
      },
    },
    {
      name: 'wallet.pay',
      description:
        `Pay for an HTTP API that answers 402, then return its content. Pays exactly { cents } (from wallet.quote) in ${LABEL}, or nothing. ` +
        `Above the task's budget it waits for the owner's OK. You never see the wallet's key. Input: { url, cents }.`,
      input: { type: 'object', properties: { url: { type: 'string' }, cents: { type: 'number' } }, required: ['url', 'cents'] },
      secrets: ['WALLET_SOLANA_KEY'],
      hosts: ['api.devnet.solana.com'],
      // The agent's input is untrusted: anything but a positive number costs nothing here, and run refuses it.
      cost: (input: { cents: unknown }) => (validCents(input?.cents) ? input.cents : 0),
      async run(input: { url: string; cents: number }, ctx) {
        const url = allowedUrl(ctx.task?.hosts ?? [], input.url);
        if (!validCents(input.cents)) throw new Error('cents must be a positive number');
        const want = atomic(input.cents);
        let offer: PaymentRequirements | undefined;
        // Pay only the devnet USDC offer at exactly the agreed price. The x402 client's own default also
        // refuses any single payment over $1.
        const client = new x402Client().register(DEVNET, new ExactSvmScheme(await signer(ctx), { rpcUrl: RPC })).registerPolicy((_v, accepts) => {
          offer = devnetOffer(accepts);
          if (!offer || offer.amount !== want) {
            throw new Error(`no ${LABEL} offer at exactly $${usdc(want)}${offer ? `; the price is $${usdc(offer.amount)}` : ''}. Quote it again.`);
          }
          return [offer];
        });
        claim(ctx.key);
        const res = await wrapFetchWithPayment(fetch, client)(url, { redirect: 'error', signal: AbortSignal.timeout(TIMEOUT_MS) });
        if (!offer) throw new Error(`${url.href} did not ask for payment (HTTP ${res.status}); read it with wallet.quote instead`);
        if (res.status === 402) throw new Error(`payment refused: ${(await paymentRequired(res)).error ?? 'no reason given'}`);
        const header = res.headers.get('payment-response');
        const receipt = header ? decodePaymentResponseHeader(header) : undefined;
        if (!receipt?.success) throw new Error(`HTTP ${res.status} with no settled payment`);
        const paid = { usdc: usdc(offer.amount), cents: input.cents, payee: offer.payTo, network: 'solana-devnet', test: true, tx: receipt.transaction, explorer: explorer('tx', receipt.transaction) };
        ctx.log(`Paid $${paid.usdc} in ${LABEL} to ${paid.payee} for ${url.href}`, { payment: paid });
        return { status: res.status, content: (await res.text()).slice(0, MAX_CONTENT), paid };
      },
    },
  ],

  // The wallet's public side, for the app page and the demo. Routes have no vault access; jobs do.
  modelJobs: [
    {
      name: 'wallet.status',
      secrets: ['WALLET_SOLANA_KEY'],
      async run(_input, ctx) {
        let address: string;
        try {
          address = (await signer(ctx)).address;
        } catch {
          return { wallet: null, label: LABEL, setup: 'the vault has no usable WALLET_SOLANA_KEY; see tracks/wallet/README.md' };
        }
        return { wallet: address, network: 'solana-devnet', test: true, label: LABEL, usdc: await balance(address), explorer: explorer('address', address) };
      },
    },
  ],

  routes: {
    'GET /status': async (_req, box) => Response.json(await box.job('wallet.status', {})),
    // shortcut: plain text until the portal's design lands from Figma; then the portal renders /status.
    'GET /': async (_req, box) => {
      const s: any = await box.job('wallet.status', {});
      const text = s.wallet
        ? `Agent wallet\n${s.wallet}\n${s.usdc} USDC on Solana devnet. Test money, not real funds.\n${s.explorer}\n`
        : `Agent wallet: not set up. ${s.setup}\n`;
      return new Response(text, { headers: { 'content-type': 'text/plain; charset=utf-8' } });
    },
  },

  apps: [{ name: 'wallet', title: 'Agent wallet (Solana devnet, test money)', href: '/' }],
} satisfies Track;
