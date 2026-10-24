// Live check for the task memo and wallet.payMetered. Spends about 2 cents of devnet USDC (test money) and needs
// CDP keys plus the box wallet key in the environment:
//   set -a; . ~/.config/calhacks13/env; . ~/Code/scratch/x402-probe/keys.env; set +a
//   node --experimental-strip-types --disable-warning=ExperimentalWarning tracks/wallet/shop.live.ts
import type { AddressInfo } from 'node:net';
import { createCdpFacilitatorClient } from '@coinbase/cdp-sdk/x402';
import { createKeyPairSignerFromBytes, getBase58Encoder } from '@solana/kit';
import { x402ResourceServer, paymentMiddleware, setSettlementOverrides } from '@x402/express';
import { decodePaymentResponseHeader, wrapFetchWithPayment, x402Client } from '@x402/fetch';
import { ExactSvmScheme } from '@x402/svm/exact/client';
import { UptoSvmScheme as UptoServer } from '@x402/svm/upto/server';
import express from 'express';
import type { Ctx } from '../../core/contract.ts';
import { DEVNET, RPC } from './lib.ts';
import { withTaskMemo } from './memo.ts';
import { payMetered } from './metered.ts';
import { PAYEE, startSeller } from './seller.ts';

const cdp = { apiKeyId: process.env.CDP_API_KEY_ID!, apiKeySecret: process.env.CDP_API_KEY_SECRET! };
const secret = process.env.WALLET_SOLANA_KEY!;

/** The memo text on a settled transaction, read back from devnet. */
async function memoOf(sig: string) {
  for (let i = 0; i < 15; i++) {
    const r = await fetch(RPC, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getTransaction', params: [sig, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0, commitment: 'confirmed' }] }) });
    const { result } = await r.json();
    if (result) return (result.transaction.message.instructions as any[]).filter((x) => x.program === 'spl-memo').map((x) => x.parsed);
    await new Promise((r) => setTimeout(r, 2000));
  }
}

// 1. Exact payment with a task memo.
const exact = await startSeller({ cdp });
const client = new x402Client().register(DEVNET, withTaskMemo(new ExactSvmScheme(await createKeyPairSignerFromBytes(getBase58Encoder().encode(secret)), { rpcUrl: RPC }), 'task-live-1'));
const res = await wrapFetchWithPayment(fetch, client)(`http://127.0.0.1:${exact.port}/joke`);
const tx = decodePaymentResponseHeader(res.headers.get('payment-response')!).transaction;
console.log('exact: HTTP', res.status, 'memo on chain:', await memoOf(tx), `https://explorer.solana.com/tx/${tx}?cluster=devnet`);
exact.close();

// 2. Metered (upto) payment: ceiling 5 cents, the seller settles 1 cent.
const app = express();
app.use(paymentMiddleware({ 'GET /search': { accepts: [{ scheme: 'upto', price: '$0.05', network: DEVNET, payTo: PAYEE }], description: 'Metered search (devnet test money)', mimeType: 'application/json' } }, new x402ResourceServer(createCdpFacilitatorClient(cdp)).register(DEVNET, new UptoServer())));
app.get('/search', (_req, res) => {
  setSettlementOverrides(res, { amount: '10000' });
  res.json({ hits: 3 });
});
const server = app.listen(0, '127.0.0.1');
await new Promise((r) => server.once('listening', r));
const host = `127.0.0.1:${(server.address() as AddressInfo).port}`;
const ctx = { key: `live-${Date.now()}`, task: { id: 'task-live-2', hosts: [host] }, secret: () => secret, log: () => {} } as unknown as Ctx;
const out: any = await payMetered.run({ url: `http://${host}/search`, maxCents: 5 }, ctx);
console.log('metered:', JSON.stringify({ status: out.status, content: out.content, spentCents: out.spentCents, paid: out.paid }, null, 1));
// For upto, the receipt's tx is the settlement; the memo is on the channel-open transaction (find it with getSignaturesForAddress on the channel).
server.close();
