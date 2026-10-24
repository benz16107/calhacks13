// The box's own services, with no money moving: a stand-in facilitator verifies and settles whatever it is shown,
// so these tests cover the prices, the upto settle for less than the cap, the daily limit, search path safety,
// input checks, the Bazaar declaration, the ledger, and the paid-request approval gate.
//   node --experimental-strip-types --test tracks/wallet/sell.test.ts
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';
import type { FacilitatorClient } from '@x402/core/server';
import type { PaymentPayload } from '@x402/core/types';
import { encodePaymentSignatureHeader, decodePaymentResponseHeader } from '@x402/core/http';
import type { LogEvent } from '../../core/contract.ts';
import { newKey } from './keygen.ts';
import { DEVNET, USDC, paymentRequired } from './lib.ts';
import { earnings, orderReader, searchPublic, sellRoutes } from './sell.ts';

const home = (process.env.BOX_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'sell-test-')));
after(() => fs.rmSync(home, { recursive: true, force: true }));
const key = newKey().secret;
const PAYER = '6PyiR71c9aw3e8bgnxmcLvJECL5zHE5jMSWqJoVjPTxU';

const settles: { amount: string }[] = [];
const facilitator: FacilitatorClient = {
  getSupported: async () => ({
    kinds: [
      { x402Version: 2, scheme: 'exact', network: DEVNET, extra: { feePayer: PAYER } },
      { x402Version: 2, scheme: 'upto', network: DEVNET, extra: { feePayer: PAYER, receiverAuthorizer: PAYER } },
    ],
    extensions: ['bazaar'],
    signers: {},
  }),
  verify: async () => ({ isValid: true, payer: PAYER }),
  settle: async (_p, req) => (settles.push({ amount: req.amount }), { success: true, transaction: `TX${settles.length}`, network: DEVNET, payer: PAYER, amount: req.amount }),
};

const tasks: any[] = [];
const notes: any[] = [];
const box = {
  secret: (n: string) => {
    if (n !== 'WALLET_SOLANA_KEY') throw new Error('no such secret');
    return key;
  },
  note: (d: unknown) => notes.push(d),
  tasks: () => tasks,
  workspace: () => {},
  createTask: async (spec: any) => (tasks.push({ ...spec, id: `T${tasks.length + 1}`, state: 'waiting' }), tasks.at(-1)),
} as any;

const audit = { head: 'abc', events: 3 };
const seller = sellRoutes({ latestAudit: async () => audit, facilitator, publicUrl: 'https://box.example' });
const call = (route: string, init?: RequestInit, search = '') => seller.routes[route](new Request(`http://box/t/wallet${route.split(' ')[1]}${search}`, init), box);

/** Ask, read the offer, then retry with a payment header, as an x402 client does. The facilitator is a stand-in. */
async function buy(route: string, init: RequestInit = {}, search = '') {
  const first = await call(route, init, search);
  assert.equal(first.status, 402);
  const pr = await paymentRequired(first);
  const payload = { x402Version: 2, resource: pr.resource, accepted: pr.accepts[0], payload: {} } as PaymentPayload;
  const headers = { ...(init.headers as object), 'payment-signature': encodePaymentSignatureHeader(payload) };
  return call(route, { ...init, headers }, search);
}

const publicDir = path.join(home, 'public');
fs.mkdirSync(path.join(publicDir, 'notes'), { recursive: true });
fs.writeFileSync(path.join(publicDir, 'a.txt'), 'first line\nSend the invoice on Friday\n');
fs.writeFileSync(path.join(publicDir, 'notes', 'b.md'), 'Another INVOICE note');

test('every sale route is open, and the routes match the keys', () => {
  assert.deepEqual(Object.keys(seller.routes).sort(), [...seller.openRoutes].sort());
  assert.ok(seller.openRoutes.includes('POST /sell/task'));
});

test('the free catalog lists prices; the 402s carry the right price, scheme and the Bazaar declaration', async () => {
  const catalog: any = await (await call('GET /sell')).json();
  assert.equal(catalog.refunds, false);
  assert.equal(catalog.services.length, 3);

  const a = await call('GET /sell/audit');
  const offer = (await paymentRequired(a)).accepts[0];
  assert.deepEqual([offer.scheme, offer.network, offer.asset, offer.amount], ['exact', DEVNET, USDC, '10000']);
  assert.equal(offer.payTo.length >= 32, true);

  const s = await call('GET /sell/search', undefined, '?q=invoice');
  const pr = await paymentRequired(s);
  assert.deepEqual([pr.accepts[0].scheme, pr.accepts[0].amount], ['upto', '20000']);
  assert.ok(pr.extensions?.bazaar, 'the 402 declares the bazaar extension');
  assert.ok((pr.extensions!.bazaar as any).info.output.example, 'with an output example');
  assert.match(JSON.stringify((pr.extensions!.bazaar as any).schema), /q/);
  assert.equal(pr.resource?.url, 'https://box.example/t/wallet/sell/search?q=invoice');

  const t = await paymentRequired(await call('POST /sell/task', { method: 'POST', body: '{}' }));
  assert.deepEqual([t.accepts[0].scheme, t.accepts[0].amount], ['exact', '250000']);
  assert.equal((t.extensions!.bazaar as any).info.input.bodyType, 'json');
});

test('input is checked before payment is taken, but an unpaid call still sees the price', async () => {
  assert.equal((await call('GET /sell/search')).status, 402); // no q, no payment: a crawler sees the price
  const bad = (route: string, init: RequestInit, search = '') => call(route, { ...init, headers: { 'payment-signature': 'x', ...(init.headers as object) } }, search);
  assert.equal((await bad('GET /sell/search', {})).status, 400);
  assert.equal((await bad('GET /sell/search', {}, `?q=${'x'.repeat(101)}`)).status, 400);
  assert.equal((await bad('POST /sell/task', { method: 'POST', body: 'not json' })).status, 400);
  assert.equal((await bad('POST /sell/task', { method: 'POST', body: JSON.stringify({ prompt: 'x'.repeat(1001) }) })).status, 400);
  assert.equal((await bad('POST /sell/task', { method: 'POST', body: JSON.stringify({ prompt: 'a'.repeat(5000) }) })).status, 400);
  assert.equal((await bad('POST /sell/task', { method: 'POST', body: JSON.stringify({ prompt: 5 }) })).status, 400);
  assert.equal(settles.length, 0);
});

test('search stays inside the public folder: no symlink out, no big or hidden files', () => {
  const secret = path.join(home, 'secret.txt');
  fs.writeFileSync(secret, 'invoice password hunter2');
  fs.symlinkSync(secret, path.join(publicDir, 'link.txt'));
  fs.symlinkSync(home, path.join(publicDir, 'linkdir'));
  fs.writeFileSync(path.join(publicDir, '.hidden'), 'invoice hidden');
  fs.writeFileSync(path.join(publicDir, 'big.txt'), 'invoice ' + 'x'.repeat(300_000));
  fs.writeFileSync(path.join(publicDir, 'bin.dat'), Buffer.from('invoice\0binary'));
  const hits = searchPublic(publicDir, '../invoice'.slice(3));
  assert.deepEqual(hits.map((h) => h.file), ['a.txt', path.join('notes', 'b.md')]);
  assert.equal(searchPublic(publicDir, '..').length, 0); // a path-looking query is only text to match
  assert.equal(searchPublic(publicDir, 'hunter2').length, 0);
  assert.equal(searchPublic(publicDir, 'invoice', 1).length, 1); // the result cap
  assert.equal(hits[0].line, 2);
});

test('audit: pays $0.01, returns the fingerprint, and the sale lands in the ledger and the log', async () => {
  const res = await buy('GET /sell/audit');
  assert.equal(res.status, 200);
  assert.deepEqual((await res.json() as any).fingerprint, audit);
  const receipt = decodePaymentResponseHeader(res.headers.get('payment-response')!);
  assert.equal(receipt.transaction, 'TX1');
  assert.equal(settles[0].amount, '10000');
  assert.deepEqual(earnings()[0], { ...earnings()[0], product: '/sell/audit', cents: 1, payer: PAYER, tx: 'TX1', network: 'solana-devnet', test: true });
  assert.equal(notes[0].sale.tx, 'TX1');
});

test('search: authorizes $0.02 but settles only for the results returned', async () => {
  const res = await buy('GET /sell/search', {}, '?q=invoice');
  const body: any = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.results.length, 2);
  assert.equal(settles.at(-1)!.amount, '4000'); // 2 x $0.002, not the $0.02 cap
  assert.equal(earnings()[0].cents, 0.4);
  assert.equal(body.charged_usdc, '0.004');
});

test('no audit yet: a 404 and nothing settled', async () => {
  const empty = sellRoutes({ latestAudit: async () => undefined, facilitator });
  const first = await empty.routes['GET /sell/audit'](new Request('http://box/t/wallet/sell/audit'), box);
  const pr = await paymentRequired(first);
  const h = { 'payment-signature': encodePaymentSignatureHeader({ x402Version: 2, resource: pr.resource, accepted: pr.accepts[0], payload: {} } as PaymentPayload) };
  const before = settles.length;
  const res = await empty.routes['GET /sell/audit'](new Request('http://box/t/wallet/sell/audit', { headers: h }), box);
  assert.equal(res.status, 404);
  assert.equal(settles.length, before);
});

test('a paid task request makes only an approval task; the real task starts after the owner approves', async () => {
  const res = await buy('POST /sell/task', { method: 'POST', body: JSON.stringify({ prompt: 'Summarize\nthe notes' }) });
  const body: any = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.refunds, false);
  assert.match(body.status, /Nothing runs until the box owner approves/);
  assert.equal(tasks.length, 1);
  assert.equal(tasks[0].worker, 'fake');
  assert.match(tasks[0].prompt, /^ask .*\$0\.25.*Summarize the notes$/);
  assert.equal(tasks[0].source, `x402:${PAYER}`);

  const done = (task: string, state: string) => ({ type: 'task.state', task, state }) as LogEvent;
  await orderReader.read(done('T1', 'failed'), box); // owner declined
  await orderReader.read(done('other', 'done'), box);
  assert.equal(tasks.length, 1);
  await orderReader.read(done('T1', 'done'), box);
  await orderReader.read(done('T1', 'done'), box); // a replay after restart
  assert.equal(tasks.length, 2);
  assert.deepEqual([tasks[1].worker, tasks[1].tools, tasks[1].hosts, tasks[1].budgetCents, tasks[1].source], ['droid', [], [], 0, `x402:${PAYER}`]);
  assert.equal(tasks[1].prompt, 'Summarize\nthe notes');
});

test('too many waiting paid requests: refused before payment', async () => {
  for (let i = 0; i < 5; i++) tasks.push({ id: `W${i}`, source: 'x402:z', worker: 'fake', state: 'waiting' });
  const settled = settles.length;
  const res = await buy('POST /sell/task', { method: 'POST', body: JSON.stringify({ prompt: 'again' }) });
  assert.equal(res.status, 503);
  assert.equal(settles.length, settled);
});

test('the daily limit answers 503 without asking for payment', async () => {
  const capped = sellRoutes({ latestAudit: async () => audit, facilitator, dailyMaxSales: earnings().length });
  assert.equal((await capped.routes['GET /sell/audit'](new Request('http://box/t/wallet/sell/audit'), box)).status, 503);
  const cents = earnings().reduce((n, s) => n + s.cents, 0);
  const byMoney = sellRoutes({ latestAudit: async () => audit, facilitator, dailyMaxCents: cents + 0.5 });
  assert.equal((await byMoney.routes['GET /sell/audit'](new Request('http://box/t/wallet/sell/audit'), box)).status, 503); // $0.01 would pass the cap
  assert.equal((await byMoney.routes['GET /sell'](new Request('http://box/t/wallet/sell'), box)).status, 200); // the catalog is free
});
