// wallet.payMetered: pay a metered API with an x402 `upto` offer. The payment authorizes a ceiling (the cap);
// the seller settles only what the call used. The wallet refuses any offer whose ceiling is above maxCents, so
// the cap is a hard limit, not a hope. Solana devnet USDC (test money) only.
import type { PaymentRequirements } from '@x402/core/types';
import { decodePaymentResponseHeader, wrapFetchWithPayment, x402Client } from '@x402/fetch';
import { UptoSvmScheme } from '@x402/svm/upto/client';
import type { Tool } from '../../core/contract.ts';
import { DEVNET, LABEL, MAX_CONTENT, RPC, TIMEOUT_MS, USDC, allowedUrl, atomic, claim, explorer, paymentRequired, signer, usdc, validCents } from './lib.ts';
import { CDP_SECRETS, checkLocalPolicy, localPolicy, walletSigner } from './cdp-wallet.ts';
import { withTaskMemo } from './memo.ts';

const input = (i: { url?: unknown; maxCents?: unknown }) => ({ url: typeof i?.url === 'string' ? i.url : undefined, cap: validCents(i?.maxCents) ? i.maxCents : undefined });

export const payMetered: Tool = {
  name: 'wallet.payMetered',
  description:
    `Call a metered HTTP API that charges by use (x402 "upto"), then return its content. You set a ceiling, { maxCents }; the wallet pays only what the call used, never more, ` +
    `and refuses an API whose ceiling is higher. The budget and the owner's OK see the ceiling. Payments are in ${LABEL}. Input: { url, maxCents }.`,
  input: { type: 'object', properties: { url: { type: 'string' }, maxCents: { type: 'number' } }, required: ['url', 'maxCents'] },
  secrets: ['WALLET_SOLANA_KEY', ...CDP_SECRETS],
  hosts: ['api.devnet.solana.com'],
  // The agent's input is untrusted: a bad maxCents costs nothing here, and run refuses it.
  cost: (i) => input(i).cap ?? 0,
  approval(i) {
    const { url } = input(i);
    let payee = url;
    try {
      payee = new URL(url!).host;
    } catch {}
    return { payee, purpose: `${url} metered, up to $${((input(i).cap ?? 0) / 100).toFixed(2)} in devnet USDC (test money)` };
  },
  async run(i, ctx) {
    const { url: raw, cap } = input(i);
    if (!raw || cap === undefined) throw new Error('url and a positive maxCents are required');
    const url = allowedUrl(ctx.task?.hosts ?? [], raw);
    const ceiling = atomic(cap);
    let offer: PaymentRequirements | undefined;
    const w = await walletSigner(ctx);
    const client = new x402Client().register(DEVNET, withTaskMemo(new UptoSvmScheme(w.signer, { rpcUrl: RPC }), ctx.task?.id ?? 'none')).registerPolicy((_v, accepts) => {
      offer = accepts.find((a) => a.scheme === 'upto' && a.network === DEVNET && a.asset === USDC);
      if (!offer) throw new Error(`this API has no metered (upto) offer in ${LABEL}; it offers ${accepts.map((a) => `${a.scheme} on ${a.network}`).join(', ')}`);
      if (BigInt(offer.amount) > BigInt(ceiling)) throw new Error(`its ceiling is $${usdc(offer.amount)}, above your maxCents of $${usdc(ceiling)}; not paying`);
      checkLocalPolicy(localPolicy(), offer); // the owner's payee list and cap; in cdp mode Coinbase checks them again
      return [offer];
    });
    claim(ctx.key);
    const res = await wrapFetchWithPayment(fetch, client)(url, { redirect: 'error', signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!offer) throw new Error(`${url.href} did not ask for payment (HTTP ${res.status})`);
    if (res.status === 402) throw new Error(`payment refused: ${(await paymentRequired(res)).error ?? 'no reason given'}`);
    const header = res.headers.get('payment-response');
    const receipt = header ? decodePaymentResponseHeader(header) : undefined;
    if (!receipt?.success) throw new Error(`HTTP ${res.status} with no settled payment`);
    // No amount in the receipt would mean we cannot see the charge: count the whole ceiling, the safe side.
    const settled = receipt.amount ?? offer.amount;
    const paid = { usdc: usdc(settled), cents: Number(settled) / 10_000, capCents: cap, payee: offer.payTo, network: 'solana-devnet', test: true, tx: receipt.transaction, explorer: explorer('tx', receipt.transaction), scheme: 'upto', mode: w.mode };
    ctx.log(`Paid $${paid.usdc} of a $${usdc(ceiling)} ceiling in ${LABEL} to ${paid.payee} for ${url.href}`, { payment: paid });
    return { status: res.status, content: (await res.text()).slice(0, MAX_CONTENT), paid, spentCents: paid.cents };
  },
};
