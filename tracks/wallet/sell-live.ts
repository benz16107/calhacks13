// Live check on Solana devnet through Coinbase's CDP facilitator (test money, a few cents). Serves the sell routes
// from a tiny HTTP server with a fake box, then pays them: /sell/audit with the box's own wallet.pay tool, and
// /sell/search with the upto scheme. The facilitator refuses a payment from a wallet to itself (self_send_not_allowed), so the money goes to the test payee.
//   set -a; . ~/.config/calhacks13/env; . ~/Code/scratch/x402-probe/keys.env; set +a
//   node --experimental-strip-types --disable-warning=ExperimentalWarning tracks/wallet/sell-live.ts
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import { decodePaymentResponseHeader, wrapFetchWithPayment, x402Client } from '@x402/fetch';
import { UptoSvmScheme } from '@x402/svm/upto/client';
import type { Box, Ctx, Tool } from '../../core/contract.ts';
import { DEVNET, RPC, signer } from './lib.ts';
import { earnings, searchPublic, sellRoutes } from './sell.ts';
import { PAYEE } from './seller.ts';
import wallet from './track.ts';

process.env.BOX_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'sell-live-'));
fs.mkdirSync(path.join(process.env.BOX_HOME, 'public'));
fs.writeFileSync(path.join(process.env.BOX_HOME, 'public', 'notes.txt'), 'Send the invoice on Friday\nSecond invoice due Monday\nunrelated\n');

const secret = (n: string) => {
  const v = process.env[n];
  if (!v) throw new Error(`no ${n}`);
  return v;
};
const box = { secret, note: () => {}, tasks: () => [], workspace: () => {}, createTask: async () => ({ id: 'x' }) } as unknown as Box;
const seller = sellRoutes({ payTo: PAYEE, latestAudit: async () => ({ head: 'live-test', events: 1 }) });

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url!, `http://${req.headers.host}`);
  const route = seller.routes[`${req.method} ${url.pathname.replace('/t/wallet', '')}`];
  if (!route) return void res.writeHead(404).end();
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  const r = await route(new Request(url, { method: req.method, headers: req.headers as Record<string, string>, body: req.method === 'POST' ? Buffer.concat(chunks) : undefined }), box);
  res.writeHead(r.status, Object.fromEntries(r.headers)).end(Buffer.from(await r.arrayBuffer()));
});
await new Promise((r) => server.listen(0, '127.0.0.1', () => r(null)));
const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
const ctx = { key: 'live-1', task: { id: 't', hosts: [origin.slice(7)] }, box, secret, log: console.log, cost: () => {} } as unknown as Ctx;

console.log('wallet', (await signer(ctx)).address);
const pay = wallet.tools.find((t) => t.name === 'wallet.pay') as Tool;
const quote = wallet.tools.find((t) => t.name === 'wallet.quote') as Tool;
console.log('quote audit', await quote.run({ url: `${origin}/t/wallet/sell/audit` }, ctx));
const bought: any = await pay.run({ url: `${origin}/t/wallet/sell/audit`, cents: 1 }, ctx);
console.log('PAID audit via wallet.pay:', bought.status, bought.content, bought.paid.explorer);

const client = new x402Client().register(DEVNET, new UptoSvmScheme(await signer(ctx), { rpcUrl: RPC }));
const found = searchPublic(path.join(process.env.BOX_HOME, 'public'), 'invoice').length;
const res = await wrapFetchWithPayment(fetch, client)(`${origin}/t/wallet/sell/search?q=invoice`);
const receipt = decodePaymentResponseHeader(res.headers.get('payment-response') ?? '');
console.log('PAID search (upto, cap 20000 atomic):', res.status, await res.text(), 'settled', receipt.amount, 'tx', receipt.transaction, `(${found} results)`);
const none = await wrapFetchWithPayment(fetch, client)(`${origin}/t/wallet/sell/search?q=zzznomatch`);
console.log('search with no match:', none.status, await none.text(), 'ledger sales so far', earnings().length);
console.log('ledger', earnings());
server.close();
