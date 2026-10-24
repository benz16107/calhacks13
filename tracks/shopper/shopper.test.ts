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
const { signMandate, outside, canonical, describe } = await import('./mandate.ts');
const { blocked, parseRules, hasPhrase, NO_RULES } = await import('./rules.ts');
const { pay } = await import('./payments.ts');
const { hit } = await import('./track.ts');

const key = tap.newAgentKey();
const pub = tap.publicKeyOf(key);
const URL_ = 'http://127.0.0.1:7700/t/shopper/store/checkout';
const vault: Record<string, string> = { SHOPPER_CARD: 'pm_card_visa' };
const charge = (p: any) => pay(p, (n) => vault[n], true);
const registry = async (id: string) => (id === tap.KEY_ID ? pub : undefined);

const mandate = (over: object = {}) => signMandate({
  v: 1, id: 'mtest', text: 'Hario filters', match: ['hario', 'filter'], skus: [], stores: ['test'], currency: 'USD', maxItemCents: 900, maxQty: 2,
  maxTotalCents: 1800, category: 'coffee', createdAt: new Date().toISOString(), expires: new Date(Date.now() + 3600_000).toISOString(),
  approvedBy: { method: 'passkey', by: 'Test phone', at: new Date().toISOString() }, issuer: tap.KEY_ID, ...over,
} as any, key);

function signed(body: string, opts: { key?: string; url?: string; now?: number; idem?: string } = {}) {
  const headers = { 'content-type': 'application/json', host: '127.0.0.1:7700', 'idempotency-key': opts.idem ?? 'k1', ...tap.signRequest(opts.key ?? key, opts.url ?? URL_, body, tap.PAYER, opts.now) };
  return { headers, req: () => new Request(opts.url ?? URL_, { method: 'POST', headers, body }) };
}
const order = (o: object) => JSON.stringify({ currency: 'USD', task: 't1', mandate: mandate(), ...o });

test('TAP + mandate: a signed checkout inside its mandate is charged once, as a test payment', async () => {
  const body = order({ items: [{ sku: 'HV60-100', name: 'x', priceCents: 899, qty: 2 }] });
  const r = await store.checkout(signed(body).req(), registry, charge);
  const o = await r.json();
  assert.equal(r.status, 200, o.error);
  assert.equal(o.totalCents, 1798);
  assert.equal(o.agent.keyId, 'box-shopper');
  assert.equal(o.mandate.id, 'mtest');
  assert.equal(o.mandate.approvedBy.method, 'passkey');
  assert.equal(o.payment.test, true);
  assert.equal(o.payment.card, 'Visa test card ending 4242');
  assert.ok(!JSON.stringify(o).includes('pm_card_visa'), 'the store never sees the card');
  // The same Idempotency-Key with a fresh signature (a resumed task) returns the same order.
  const again = await (await store.checkout(signed(body).req(), registry, charge)).json();
  assert.equal(again.id, o.id);
  assert.equal(again.repeat, true);
});

test('TAP: unsigned, tampered, replayed, foreign-key and expired requests are refused', async () => {
  const body = order({ items: [{ sku: 'DS-750', name: 'x', priceCents: 399, qty: 1 }], mandate: mandate({ id: 'msoap', match: [], skus: [{ store: 'test', sku: 'DS-750' }] }) });
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
  const evil = signed(body, { url: 'http://evil.example/t/shopper/store/checkout', idem: 'k5' });
  await refuse(new Request(URL_, { method: 'POST', headers: evil.headers, body }), /does not verify/);
});

test('the mandate: the store refuses another item, a higher price, another store, more items, an expired or altered mandate, or none', async () => {
  const lines = (o: object = {}) => [{ sku: 'HV60-100', name: 'Hario V60 02 paper filters, 100 count', priceCents: 899, qty: 1, ...o }];
  const why = (m: any, l = lines()) => outside(m, pub, l, 'USD')?.code;
  assert.equal(why(mandate()), undefined);
  assert.equal(why(mandate(), lines({ name: 'USB-C cable', sku: 'USBC-1M' })), 'wrong item');
  assert.equal(why(mandate(), lines({ priceCents: 901 })), 'over price');
  assert.equal(why(mandate(), lines({ from: 'bestbuy.ca' })), 'wrong store');
  assert.equal(why(mandate(), lines({ qty: 3 })), 'over quantity');
  assert.equal(why(mandate({ expires: new Date(Date.now() - 1000).toISOString() })), 'expired');
  const m = mandate();
  assert.equal(why({ ...m, mandate: { ...m.mandate, maxItemCents: 99_999 } }), 'bad mandate signature');
  assert.equal(why(undefined), 'no mandate');
  assert.equal(outside(mandate(), pub, lines(), 'CAD')?.code, 'wrong currency');
  assert.equal(canonical({ b: 1, a: [2, { d: 1, c: 2 }] }), '{"a":[2,{"c":2,"d":1}],"b":1}');
  // At checkout, a refusal is a 403 with the reason, and nothing is charged.
  const r = await store.checkout(signed(order({ items: lines({ priceCents: 899, qty: 3 }) }), { idem: 'm1' }).req(), registry, charge);
  assert.equal(r.status, 403);
  assert.match((await r.json()).error, /more than the mandate's 2/);
});

test('holes Mana found in a review: reuse across orders, no item named, bad numbers, another issuer, the year', () => {
  const lines = (o: object = {}) => [{ sku: 'HV60-100', name: 'Hario V60 02 paper filters, 100 count', priceCents: 899, qty: 1, ...o }];
  // The limits cover the whole mandate: one more after 2 were bought is over its 2.
  assert.equal(outside(mandate(), pub, lines(), 'USD', { used: { qty: 2, cents: 1798 } })?.code, 'over quantity');
  assert.equal(outside(mandate(), pub, lines(), 'USD', { used: { qty: 1, cents: 899 } }), undefined);
  // A mandate that names no item can't be signed at all.
  assert.throws(() => mandate({ match: [''], skus: [] }), /names no item/);
  assert.throws(() => mandate({ expires: new Date(Date.now() + 400 * 86_400_000).toISOString() }), /more than 30 days/);
  // Numbers must be whole and positive; one bad line refuses the order.
  assert.equal(outside(mandate(), pub, lines({ priceCents: NaN }), 'USD')?.code, 'bad order');
  assert.equal(outside(mandate(), pub, [...lines({ qty: 10 }), ...lines({ qty: -8 })], 'USD')?.code, 'bad order');
  assert.equal(outside(mandate(), pub, [], 'USD')?.code, 'bad order');
  // The mandate's issuer must be the agent that signed the request.
  assert.equal(outside(mandate(), pub, lines(), 'USD', { agentKeyId: 'someone-else' })?.code, 'bad mandate signature');
  // Words match whole words: "hario" is in the name, "har" alone is not an item word.
  assert.equal(outside(mandate({ match: ['har'] }), pub, lines(), 'USD')?.code, 'wrong item');
  // What the owner approves names every limit, with the year and time zone.
  const text = describe(mandate().mandate, (x) => x);
  assert.match(text, /"hario" and "filter"/);
  assert.match(text, /at most 2 and \$18\.00 in all/);
  assert.match(text, /20\d\d/);
});

test('spending rules: never-buy words, the monthly cap, per-store and per-category caps', () => {
  const r = parseRules({ monthlyCents: 5000, perStore: { 'bestbuy.ca': 1500 }, perCategory: { electronics: 0 }, never: ['Gift Card'] });
  const now = new Date('2026-10-24T12:00:00Z');
  const spent = [{ at: '2026-10-10T00:00:00Z', store: 'test', category: 'coffee', usdCents: 3000 }, { at: '2026-09-30T00:00:00Z', store: 'test', category: 'coffee', usdCents: 9000 }];
  const it = (o: object) => [{ name: 'Hario filters', store: 'test', category: 'coffee', usdCents: 1000, ...o }];
  assert.equal(blocked(r, spent, it({}), now), undefined);
  assert.match(blocked(r, spent, it({ name: 'Visa gift card' }), now)!, /never buy "gift card"/);
  assert.match(blocked(r, spent, it({ usdCents: 2500 }), now)!, /monthly cap of \$50\.00/);
  assert.match(blocked(r, spent, it({ store: 'bestbuy.ca', usdCents: 1600 }), now)!, /\$15\.00 monthly cap for bestbuy\.ca/);
  assert.match(blocked(r, spent, it({ category: 'electronics' }), now)!, /blocks the electronics category/);
  assert.equal(blocked(NO_RULES, spent, it({ usdCents: 99_999 }), now), undefined);
  assert.throws(() => parseRules({ monthlyCents: -5 }), /dollar amount/);
  // A monthly cap of 0 means no spending; a missing one means no cap.
  assert.match(blocked(parseRules({ monthlyCents: 0 }), [], it({}), now)!, /no spending/);
  assert.equal(parseRules({}).monthlyCents, undefined);
  // Whole words: "ale" does not block "wholesale", and "gift card" catches "Gift-Card".
  assert.equal(hasPhrase('Wholesale coffee beans', 'ale'), false);
  assert.equal(hasPhrase('Visa Gift-Card, $50', 'gift card'), true);
});

test('price protection: a drop inside 30 days refunds the difference once; the store checks its own price', async () => {
  const o = store.allOrders().find((x) => x.items.some((l) => l.sku === 'HV60-100'))!;
  const adjust = (idem: string) => store.priceAdjust(signed(JSON.stringify({ order: o.id, sku: 'HV60-100' }), { idem, url: URL_.replace('checkout', 'price-adjust') }).req(), registry, charge);
  assert.equal((await adjust('a0')).status, 409, 'no drop yet');
  store.setProduct('HV60-100', { priceCents: 650 });
  const r = await (await adjust('a1')).json();
  assert.equal(r.refundCents, (899 - 650) * 2);
  assert.equal(r.payment.refundedCents, 498);
  assert.equal((await adjust('a2')).status, 409, 'the same drop is refunded once');
  store.setProduct('HV60-100', { priceCents: 899 });
});

test('subscriptions: cancelling needs a signed request; undoing a purchase refunds what is left after adjustments', async () => {
  const cancel = (body: string, idem: string) => store.cancelSubscription(signed(body, { idem, url: URL_.replace('checkout', 'subscriptions/cancel') }).req(), registry);
  assert.equal((await store.cancelSubscription(new Request(URL_, { method: 'POST', body: '{"id":"SUB-STREAM"}' }), registry)).status, 401);
  assert.equal((await (await cancel('{"id":"SUB-STREAM"}', 'c1')).json()).status, 'cancelled');
  assert.equal(store.subscriptions().find((s) => s.id === 'SUB-COFFEE')?.status, 'active');
  const o = await store.refundTask('t1', charge);
  assert.equal(o?.refund?.refundedCents ?? o?.refund?.status, o?.refund?.refundedCents ?? 'refunded');
  assert.equal((await store.refundTask('t1', charge))?.refund?.id, o?.refund?.id, 'refunds once');
});

test("the merchant's dashboard counts verified orders, refusals by reason, and zero chargebacks", () => {
  const s = store.stats();
  assert.equal(s.orders.count, 2);
  assert.equal(s.orders.withPasskey, 2);
  assert.ok(s.refused.byCode['unsigned (unknown bot)'] >= 1);
  assert.ok(s.refused.byCode['replayed signature'] >= 1);
  assert.equal(s.refused.byCode['over quantity'], 1);
  assert.equal(s.refunds.adjustedCount, 1);
  assert.equal(s.cancellations, 1);
  assert.equal(s.chargebacks, 0);
  assert.ok(s.evidence.every((e) => e.mandate.id && e.agent === 'box-shopper'));
});

test('the demo inbox: POP3 with the vault password, receipts and subscriptions only, what runs out and what goes unused', async () => {
  const now = Date.parse('2026-10-24T12:00:00Z');
  const box = await inbox.startInbox(inbox.sampleMail(now), async (u, p) => u === inbox.MAILBOX && p === 'right');
  try {
    await assert.rejects(inbox.fetchMail(box.port, inbox.MAILBOX, 'wrong'), /wrong user or password/);
    const raws = await inbox.fetchMail(box.port, inbox.MAILBOX, 'right');
    const r = inbox.readReceipts(raws, now);
    assert.equal(r.receipts.length, 10);
    assert.equal(r.withheld, 2);
    assert.ok(!JSON.stringify(r).includes('482913'), 'the sign-in code email never reaches the agent');
    assert.deepEqual(r.estimates.filter((e) => e.runningLow).map((e) => e.sku), ['HV60-100', 'PT-6']);
    assert.deepEqual(r.subscriptions.filter((s) => s.unused).map((s) => s.id), ['SUB-STREAM']);
    assert.equal(r.subscriptions.find((s) => s.id === 'SUB-STREAM')?.unusedDays, 74);
  } finally {
    box.close();
  }
});

test('the deal rule: in stock and at or under the price', () => {
  assert.equal(hit({ maxCents: 1600 }, { inStock: true, priceCents: 1536 }), true);
  assert.equal(hit({ maxCents: 1600 }, { inStock: true, priceCents: 1601 }), false);
  assert.equal(hit({ maxCents: 1600 }, { inStock: false, priceCents: 999 }), false);
});
