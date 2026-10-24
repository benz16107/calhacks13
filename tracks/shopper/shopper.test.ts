// Offline tests: node --experimental-strip-types --test tracks/shopper/shopper.test.ts
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

process.env.BOX_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'shopper-'));
const tap = await import('./tap.ts');
const store = await import('./store.ts');
const inbox = await import('./inbox.ts');
const { hit, seen } = await import('./track.ts');

const key = tap.newAgentKey();
const pub = tap.publicKeyOf(key);
const URL_ = 'http://127.0.0.1:7700/t/shopper/store/checkout';

function signed(body: string, opts: { key?: string; url?: string; now?: number; idem?: string } = {}) {
  const headers = { 'content-type': 'application/json', host: '127.0.0.1:7700', 'idempotency-key': opts.idem ?? 'k1', ...tap.signRequest(opts.key ?? key, opts.url ?? URL_, body, tap.PAYER, opts.now) };
  return { headers, req: () => new Request(URL_, { method: 'POST', headers, body }) };
}
const registry = async (id: string) => (id === tap.KEY_ID ? pub : undefined);
const charge = (p: any) => store.pay(p, undefined);
const order = (o: object) => JSON.stringify({ currency: 'USD', card: 'pm_card_visa', task: 't1', ...o });

test('TAP: a signed checkout is verified, charged once, and never echoes the card', async () => {
  const body = order({ items: [{ sku: 'HV60-100', name: 'x', priceCents: 899, qty: 2 }] });
  const s = signed(body);
  const r = await store.checkout(s.req(), registry, charge);
  const o = await r.json();
  assert.equal(r.status, 200, o.error);
  assert.equal(o.totalCents, 1798);
  assert.equal(o.agent.keyId, 'box-shopper');
  assert.equal(o.payment.test, true);
  assert.equal(o.payment.provider, 'simulated');
  assert.equal(o.payment.card, 'Visa test card ending 4242');
  assert.ok(!JSON.stringify(o).includes('pm_card_visa'));
  // The same Idempotency-Key with a fresh signature (a resumed task) returns the same order.
  const again = await (await store.checkout(signed(body).req(), registry, charge)).json();
  assert.equal(again.id, o.id);
  assert.equal(again.repeat, true);
});

test('TAP: unsigned, tampered, replayed, foreign-key and expired requests are refused', async () => {
  const body = order({ items: [{ sku: 'DS-750', name: 'x', priceCents: 399, qty: 1 }] });
  const refuse = async (req: Request, why: RegExp) => {
    const r = await store.checkout(req, registry, charge);
    assert.equal(r.status, 401);
    assert.match((await r.json()).error, why);
  };
  await refuse(new Request(URL_, { method: 'POST', headers: { host: '127.0.0.1:7700' }, body }), /unsigned/);
  const s = signed(body, { idem: 'k2' });
  await refuse(new Request(URL_, { method: 'POST', headers: s.headers, body: body.replace('"qty":1', '"qty":9') }), /changed/);
  assert.equal((await store.checkout(s.req(), registry, charge)).status, 200);
  await refuse(s.req(), /replay/);
  await refuse(signed(body, { key: tap.newAgentKey(), idem: 'k3' }).req(), /does not verify/);
  await refuse(signed(body, { now: Date.now() - 3600_000, idem: 'k4' }).req(), /expired/);
  await refuse(signed(body, { url: 'http://evil.example/t/shopper/store/checkout', idem: 'k5' }).req(), /does not verify/);
});

test('the store refuses a stale price, a sold-out item and a card that is not a test card', async () => {
  const send = async (o: object, idem: string) => store.checkout(signed(order(o), { idem }).req(), registry, charge);
  assert.equal((await send({ items: [{ sku: 'HV60-100', priceCents: 100, qty: 1 }] }, 'p1')).status, 409);
  assert.equal((await send({ items: [{ sku: 'HV60-DRIP', priceCents: 2700, qty: 1 }] }, 'p2')).status, 409);
  const r = await send({ items: [{ sku: 'PT-6', priceCents: 1149, qty: 1 }], card: '4111111111111111' }, 'p3');
  assert.equal(r.status, 402);
  assert.match((await r.json()).error, /test cards only/);
  await assert.rejects(store.pay({ action: 'charge', cents: 100, currency: 'USD', card: 'pm_card_visa', key: 'x', description: 'x' }, 'sk_live_abc'), /test mode only/);
});

test('undoing a purchase refunds its order once', async () => {
  const o = await store.refundTask('t1', charge);
  assert.equal(o?.refund?.status, 'refunded');
  assert.equal((await store.refundTask('t1', charge))?.refund?.id, o?.refund?.id);
});

test('the demo inbox: POP3 with the vault password, receipts only, and what runs out this week', async () => {
  const now = Date.parse('2026-10-24T12:00:00Z');
  const box = await inbox.startInbox(inbox.sampleMail(now), async (u, p) => u === inbox.MAILBOX && p === 'right');
  try {
    await assert.rejects(inbox.fetchMail(box.port, inbox.MAILBOX, 'wrong'), /wrong user or password/);
    const raws = await inbox.fetchMail(box.port, inbox.MAILBOX, 'right');
    assert.equal(raws.length, 12);
    const r = inbox.readReceipts(raws, now);
    assert.equal(r.receipts.length, 10);
    assert.equal(r.withheld, 2);
    assert.ok(!JSON.stringify(r).includes('482913'), 'the sign-in code email never reaches the agent');
    assert.deepEqual(r.estimates.filter((e) => e.runningLow).map((e) => e.sku), ['HV60-100', 'PT-6']);
    assert.ok(!r.estimates.some((e) => e.sku === 'USBC-1M'), 'a one-off purchase is not a regular');
  } finally {
    box.close();
  }
});

test('the deal rule: in stock and at or under the price', () => {
  const out = (price: number, inStock: boolean) => ({ checkedAt: 'now', products: [{ sku: '20220310', name: 'Chemex filters', price, regularPrice: 20.36, inStock }] });
  const w = { product: '20220310', maxCents: 1600 };
  assert.equal(hit(w, seen(w, out(15.36, true))!), true);
  assert.equal(hit(w, seen(w, out(16.01, true))!), false);
  assert.equal(hit(w, seen(w, out(9.99, false))!), false);
  assert.equal(seen(w, out(15.36, true))?.priceCents, 1536);
});
