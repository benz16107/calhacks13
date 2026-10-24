// The GurtOS Test Store: a small merchant the shopper agent buys from, because no real store accepts a test card.
// It is also the merchant's side of the story: it takes an order only when the request is signed with Visa
// Trusted Agent Protocol by a key in the agent registry AND carries a signed shopping mandate the order fits.
// It counts every request, so its dashboard shows verified agent orders next to the unknown bots it refused.
// Every payment here is a TEST payment: no real money moves, and nothing ships.
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { type Line, type Signed, outside } from './mandate.ts';
import type { PayInput, Payment } from './payments.ts';
import { BROWSE, KEY_ID, PAYER, type Verified, verifyRequest } from './tap.ts';

export type { Line };
export const HOME = process.env.BOX_HOME ?? '/var/lib/box';
// A ./demo run makes no live payment call unless DEMO_LIVE names this track (shopper or visa). The installed box always may.
export const OFFLINE = HOME.startsWith('/var/lib/box-demo/') && !/\b(shopper|visa)\b/.test(process.env.DEMO_LIVE ?? '');
const MAX_ORDER_CENTS = 50_000;
/** Price protection: a drop within this many days of the order gets the difference back. */
export const PROTECT_DAYS = 30;

export type Product = { sku: string; name: string; category: string; priceCents: number; regularCents: number; inStock: boolean };
export const CATALOG: Product[] = [
  { sku: 'HV60-100', name: 'Hario V60 02 paper filters, 100 count', category: 'coffee', priceCents: 899, regularCents: 899, inStock: true },
  { sku: 'HV60-DRIP', name: 'Hario V60 02 ceramic dripper, white', category: 'coffee', priceCents: 2700, regularCents: 2700, inStock: false },
  { sku: 'PT-6', name: 'Paper towels, 6 rolls', category: 'household', priceCents: 1149, regularCents: 1149, inStock: true },
  { sku: 'DS-750', name: 'Dish soap, 750 ml', category: 'household', priceCents: 399, regularCents: 399, inStock: true },
  { sku: 'CB-340', name: 'Whole bean coffee, 340 g', category: 'coffee', priceCents: 1600, regularCents: 1600, inStock: true },
  { sku: 'USBC-1M', name: 'USB-C cable, 1 m', category: 'electronics', priceCents: 999, regularCents: 999, inStock: true },
];
// shortcut: price and stock changes live in memory and reset when the box restarts; fine for a test store.
const catalog = new Map(CATALOG.map((p) => [p.sku, { ...p }]));
export const product = (sku: string) => catalog.get(sku);
export const products = () => [...catalog.values()];
export function setProduct(sku: string, change: { priceCents?: number; inStock?: boolean }) {
  const p = catalog.get(sku);
  if (!p) throw new Error(`no product ${sku}`);
  if (change.priceCents !== undefined) {
    if (!Number.isInteger(change.priceCents) || change.priceCents <= 0) throw new Error('priceCents must be a positive whole number');
    p.priceCents = change.priceCents;
  }
  if (change.inStock !== undefined) p.inStock = change.inStock === true;
  return p;
}

/** The household's subscriptions at this store (sample account). Cancelling one is a signed agent request. */
export const SUBSCRIPTIONS = [
  { id: 'SUB-STREAM', name: 'Streaming Plus', monthlyCents: 1599, since: '2025-11-02' },
  { id: 'SUB-COFFEE', name: 'Coffee of the month', monthlyCents: 1800, since: '2026-03-15' },
  { id: 'SUB-PHOTOS', name: 'Cloud photos, 200 GB', monthlyCents: 399, since: '2024-06-20' },
];

// ---------- what the store keeps: orders, and every request it saw (for the dashboard) ----------

export type Adjustment = { at: string; sku: string; paidCents: number; nowCents: number; refundCents: number; payment: Payment };
export type Order = {
  id: string; key: string; task?: string; items: Line[]; currency: string; totalCents: number; at: string;
  agent: Verified; mandate: { id: string; text: string; approvedBy: Signed['mandate']['approvedBy'] }; payment: Payment;
  refund?: Payment; adjustments?: Adjustment[];
};
/** One request the store saw. `verified` is whether it carried a valid TAP signature. */
export type StoreEvent = {
  at: string; kind: 'visit' | 'order' | 'refused' | 'refund' | 'adjust' | 'cancel'; verified: boolean;
  code?: string; reason?: string; mandate?: string; order?: string; cents?: number; currency?: string; sub?: string; passkey?: boolean;
};

const orders = new Map<string, Order>();
const events: StoreEvent[] = [];
const cancelled = new Map<string, string>(); // subscription id -> when
let loaded = false;
const file = (name: string) => path.join(HOME, 'shopper', name);
function readJsonl<T>(name: string): T[] {
  if (!fs.existsSync(file(name))) return [];
  return fs.readFileSync(file(name), 'utf8').split('\n').flatMap((l) => {
    try {
      return l ? [JSON.parse(l) as T] : [];
    } catch {
      return []; // a torn last line after a power cut
    }
  });
}
function append(name: string, v: unknown) {
  fs.mkdirSync(path.dirname(file(name)), { recursive: true, mode: 0o700 });
  const fd = fs.openSync(file(name), 'a', 0o600);
  fs.writeSync(fd, JSON.stringify(v) + '\n');
  fs.fsyncSync(fd);
  fs.closeSync(fd);
}
function load() {
  if (loaded) return;
  loaded = true;
  for (const o of readJsonl<Order>('orders.jsonl')) orders.set(o.key, o); // a later line for the same order replaces it
  for (const e of readJsonl<StoreEvent>('store-events.jsonl')) {
    events.push(e);
    if (e.kind === 'cancel' && e.sub) cancelled.set(e.sub, e.at);
  }
}
function save(o: Order) {
  append('orders.jsonl', o);
  orders.set(o.key, o);
}
function record(e: Omit<StoreEvent, 'at'>) {
  const full = { at: new Date().toISOString(), ...e };
  append('store-events.jsonl', full);
  events.push(full);
  if (full.kind === 'cancel' && full.sub) cancelled.set(full.sub, full.at);
}
export const allOrders = () => (load(), [...orders.values()].reverse());
export const orderForTask = (task: string) => allOrders().find((o) => o.task === task);
export const subscriptions = () => (load(), SUBSCRIPTIONS.map((s) => ({ ...s, status: cancelled.has(s.id) ? 'cancelled' : 'active', cancelledAt: cancelled.get(s.id) })));

// Nonces seen, until their signature expires. shortcut: in memory, so a restart forgets them; the Idempotency-Key
// still stops a replayed order from being charged twice.
const nonces = new Map<string, number>();
function fresh(nonce: string, expires: number) {
  const now = Date.now() / 1000;
  for (const [n, e] of nonces) if (e < now) nonces.delete(n);
  if (nonces.has(nonce)) return false;
  nonces.set(nonce, expires);
  return true;
}

/** Sort a TAP refusal into a dashboard bucket. */
const tapCode = (reason: string) =>
  /unsigned/.test(reason) ? 'unsigned (unknown bot)'
  : /replay/.test(reason) ? 'replayed signature'
  : /changed/.test(reason) ? 'changed in transit'
  : /expired|not yet valid/.test(reason) ? 'expired signature'
  : /unknown agent key/.test(reason) ? 'unknown agent'
  : 'bad signature';

const fail = (status: number, error: string) => Response.json({ error }, { status });
type Registry = (keyId: string) => Promise<string | undefined>;
type Charge = (p: PayInput) => Promise<Payment>;

/** Check the request's TAP signature. Records and returns a 401 when it fails. */
async function agentOf(req: Request, body: string, registry: Registry, tag: string, kind: StoreEvent['kind']): Promise<Verified | Response> {
  const url = new URL(req.url);
  try {
    const pub = await registry(KEY_ID);
    const agent = verifyRequest({ authority: req.headers.get('host') ?? url.host, path: url.pathname, headers: req.headers, body }, (id) => (id === KEY_ID ? pub : undefined), fresh);
    if (agent.tag !== tag) throw new Error(`this needs the ${tag} tag, not ${agent.tag}`);
    return agent;
  } catch (e) {
    const reason = (e as Error).message;
    record({ kind: kind === 'visit' ? 'visit' : 'refused', verified: false, code: tapCode(reason), reason });
    return fail(401, `refused: ${reason}`);
  }
}

/** GET /store/products. Anyone may browse; the store counts verified agents apart from unknown bots. */
export async function browse(req: Request, registry: Registry) {
  load();
  const signed = req.headers.has('signature-input');
  const agent = signed ? await agentOf(req, '', registry, BROWSE, 'visit') : undefined;
  if (agent instanceof Response) return agent;
  const mandate = new URL(req.url).searchParams.get('mandate') ?? undefined;
  record({ kind: 'visit', verified: !!agent, ...(agent ? { mandate } : { code: 'unsigned (unknown bot)' }) });
  return Response.json(products());
}

/** POST /store/checkout. TAP signature, a signed mandate the order fits, an Idempotency-Key; then a test charge. */
export async function checkout(req: Request, registry: Registry, charge: Charge) {
  load();
  const body = await req.text();
  const agent = await agentOf(req, body, registry, PAYER, 'order');
  if (agent instanceof Response) return agent;
  const key = req.headers.get('idempotency-key') ?? '';
  if (!key) return fail(400, 'an Idempotency-Key header is required');
  const done = orders.get(key);
  if (done) return Response.json({ ...done, repeat: true }); // the same order again after a restart: no second charge

  let o: { items?: Line[]; currency?: string; task?: string; mandate?: Signed };
  try {
    o = JSON.parse(body);
  } catch {
    return fail(400, 'the body is not JSON');
  }
  const items = Array.isArray(o.items) ? o.items : [];
  const currency = o.currency === 'CAD' ? 'CAD' : 'USD';
  if (!items.length || items.length > 10) return fail(400, 'an order has 1 to 10 lines');
  for (const l of items) {
    if (!Number.isInteger(l.qty) || l.qty < 1 || l.qty > 10) return fail(400, `${l.sku}: quantity must be 1 to 10`);
    const p = catalog.get(l.sku);
    if (p && !l.from) {
      if (currency !== 'USD') return fail(400, `${l.sku} is sold in USD here`);
      if (!p.inStock) return fail(409, `${p.name} is out of stock`);
      if (l.priceCents !== p.priceCents) return fail(409, `${p.name} is now $${(p.priceCents / 100).toFixed(2)}, not $${(l.priceCents / 100).toFixed(2)}`);
      [l.name, l.category] = [p.name, p.category];
    } else if (!l.from || !Number.isInteger(l.priceCents) || l.priceCents <= 0) {
      return fail(400, `no product ${l.sku}`);
    } else {
      // A line another store priced (the watcher saw it live): the test store stands in for that store's checkout.
      l.name = String(l.name ?? l.sku).slice(0, 120);
    }
  }
  const totalCents = items.reduce((s, l) => s + l.priceCents * l.qty, 0);
  if (totalCents > MAX_ORDER_CENTS) return fail(400, 'orders above $500 are refused');

  // The mandate's limits cover every order under it, so count what earlier orders already took.
  const mid = o.mandate?.mandate?.id;
  const before = allOrders().filter((x) => x.mandate.id === mid && !x.refund);
  const used = { qty: before.reduce((n, x) => n + x.items.reduce((q, l) => q + l.qty, 0), 0), cents: before.reduce((n, x) => n + x.totalCents, 0) };
  const refusal = outside(o.mandate, o.mandate && (await registry(o.mandate.mandate.issuer)), items, currency, { agentKeyId: agent.keyId, used });
  if (refusal) {
    record({ kind: 'refused', verified: true, code: refusal.code, reason: refusal.reason, mandate: o.mandate?.mandate?.id });
    return fail(403, `refused: ${refusal.reason}`);
  }
  const m = o.mandate!.mandate;
  const id = `ord_${createHash('sha256').update(key).digest('hex').slice(0, 10)}`;
  let payment: Payment;
  try {
    payment = await charge({ action: 'charge', cents: totalCents, currency, key, description: `${id} ${items.map((l) => `${l.qty} x ${l.name}`).join(', ')}` });
  } catch (e) {
    return fail(402, `payment failed: ${(e as Error).message}`);
  }
  const order: Order = {
    id, key, task: o.task, items, currency, totalCents, at: new Date().toISOString(), agent, payment,
    mandate: { id: m.id, text: m.text, approvedBy: m.approvedBy },
  };
  save(order);
  record({ kind: 'order', verified: true, mandate: m.id, order: id, cents: totalCents, currency, passkey: m.approvedBy.method === 'passkey' });
  return Response.json(order);
}

/** Refund the order a task placed (the task was undone). Safe to call twice. */
export async function refundTask(task: string, charge: Charge) {
  const o = orderForTask(task);
  if (!o || o.refund) return o;
  const back = o.totalCents - (o.adjustments ?? []).reduce((s, a) => s + a.refundCents, 0);
  const refund = await charge({ action: 'refund', payment: o.payment, key: `refund-${o.id}`, cents: back });
  save({ ...o, refund });
  record({ kind: 'refund', verified: true, order: o.id, cents: back, currency: o.currency });
  return orders.get(o.key);
}

/**
 * POST /store/price-adjust {order, sku}: price protection. Within PROTECT_DAYS of the order, if this store's price
 * for the item dropped, it refunds the difference (a TEST refund). The store checks its own price, not the agent's.
 */
export async function priceAdjust(req: Request, registry: Registry, charge: Charge) {
  load();
  const body = await req.text();
  const agent = await agentOf(req, body, registry, PAYER, 'adjust');
  if (agent instanceof Response) return agent;
  let i: { order?: string; sku?: string };
  try {
    i = JSON.parse(body);
  } catch {
    return fail(400, 'the body is not JSON');
  }
  const o = allOrders().find((x) => x.id === i.order);
  const line = o?.items.find((l) => l.sku === i.sku && !l.from);
  const p = line && product(line.sku);
  if (!o || !line || !p) return fail(404, `no item ${i.sku} from this store in order ${i.order}`);
  if (o.refund) return fail(409, 'that order was refunded');
  if (Date.now() - Date.parse(o.at) > PROTECT_DAYS * 86_400_000) return fail(409, `price protection lasts ${PROTECT_DAYS} days`);
  const lowest = Math.min(line.priceCents, ...(o.adjustments ?? []).filter((a) => a.sku === line.sku).map((a) => a.nowCents));
  if (!(p.priceCents < lowest)) return fail(409, `the price is $${(p.priceCents / 100).toFixed(2)}, not below the $${(lowest / 100).toFixed(2)} already paid`);
  const refundCents = (lowest - p.priceCents) * line.qty;
  const payment = await charge({ action: 'refund', payment: o.payment, key: `adjust-${o.id}-${line.sku}-${p.priceCents}`, cents: refundCents });
  const adj: Adjustment = { at: new Date().toISOString(), sku: line.sku, paidCents: lowest, nowCents: p.priceCents, refundCents, payment };
  save({ ...o, adjustments: [...(o.adjustments ?? []), adj] });
  record({ kind: 'adjust', verified: true, order: o.id, cents: refundCents, currency: o.currency });
  return Response.json({ order: o.id, ...adj, test: true });
}

/** POST /store/subscriptions/cancel {id}: a signed agent request, made only after the owner's OK. */
export async function cancelSubscription(req: Request, registry: Registry) {
  load();
  const body = await req.text();
  const agent = await agentOf(req, body, registry, PAYER, 'cancel');
  if (agent instanceof Response) return agent;
  const { id } = JSON.parse(body || '{}');
  const s = subscriptions().find((x) => x.id === id);
  if (!s) return fail(404, `no subscription ${id}`);
  if (s.status !== 'cancelled') record({ kind: 'cancel', verified: true, sub: s.id, cents: s.monthlyCents });
  return Response.json({ ...subscriptions().find((x) => x.id === id), test: true });
}

// ---------- the merchant's dashboard ----------

/** What the store's owner sees: verified agent orders vs unknown bots, conversion, and why chargebacks are zero. */
export function stats() {
  load();
  const orderEvents = events.filter((e) => e.kind === 'order');
  const refused = events.filter((e) => e.kind === 'refused' || (e.kind === 'visit' && !e.verified && e.code !== 'unsigned (unknown bot)'));
  const byCode: Record<string, number> = {};
  for (const e of refused) byCode[e.code ?? 'other'] = (byCode[e.code ?? 'other'] ?? 0) + 1;
  const sum = (xs: StoreEvent[], cur: string) => xs.filter((e) => e.currency === cur).reduce((s, e) => s + (e.cents ?? 0), 0);
  const visits = events.filter((e) => e.kind === 'visit');
  // A shopping session is one mandate's visits; it converted when that mandate placed an order.
  const sessions = new Set([...visits.filter((e) => e.verified && e.mandate).map((e) => e.mandate!), ...orderEvents.map((e) => e.mandate!)]);
  const converted = new Set(orderEvents.map((e) => e.mandate!));
  const book = allOrders();
  return {
    test: true,
    orders: { count: orderEvents.length, usdCents: sum(orderEvents, 'USD'), cadCents: sum(orderEvents, 'CAD'), withPasskey: orderEvents.filter((e) => e.passkey).length },
    visits: { verified: visits.filter((e) => e.verified).length, bots: visits.filter((e) => !e.verified).length },
    refused: { count: refused.length, unsignedAtCheckout: refused.filter((e) => e.code === 'unsigned (unknown bot)').length, byCode },
    conversion: { sessions: sessions.size, ordered: converted.size },
    refunds: { count: events.filter((e) => e.kind === 'refund').length, adjustedCount: events.filter((e) => e.kind === 'adjust').length, adjustedUsdCents: sum(events.filter((e) => e.kind === 'adjust'), 'USD') },
    cancellations: events.filter((e) => e.kind === 'cancel').length,
    // Every order needed a valid TAP signature, a signed mandate it fits, and a person's approval, so there is
    // nothing for a cardholder to dispute as "I didn't authorize this". The store keeps that evidence per order.
    chargebacks: 0,
    evidence: book.slice(0, 20).map((o) => ({ order: o.id, at: o.at, totalCents: o.totalCents, currency: o.currency, agent: o.agent.keyId, mandate: o.mandate, payment: o.payment, refunded: !!o.refund, adjustments: o.adjustments ?? [] })),
    recentRefusals: refused.slice(-12).reverse().map((e) => ({ at: e.at, code: e.code, reason: e.reason })),
    products: products(),
    subscriptions: subscriptions(),
    protectDays: PROTECT_DAYS,
  };
}
