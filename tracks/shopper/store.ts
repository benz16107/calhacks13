// The GurtOS Test Store: a small merchant the shopper agent buys from, because no real store accepts a test card.
// It takes an order only when the request is signed with Visa Trusted Agent Protocol by a key in the agent
// registry, charges it in Stripe test mode (or simulates the charge until the Stripe keys are in the vault),
// and keeps its own order book. Every payment here is a TEST payment: no real money moves.
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { Box } from '../../core/contract.ts';
import { KEY_ID, PAYER, type Verified, verifyRequest } from './tap.ts';

export const HOME = process.env.BOX_HOME ?? '/var/lib/box';
// A ./demo run makes no live Stripe call unless DEMO_LIVE names this track (shopper or visa). The installed box always may.
export const OFFLINE = HOME.startsWith('/var/lib/box-demo/') && !/\b(shopper|visa)\b/.test(process.env.DEMO_LIVE ?? '');
const MAX_ORDER_CENTS = 50_000;

export type Product = { sku: string; name: string; priceCents: number; regularCents: number; inStock: boolean };
export const CATALOG: Product[] = [
  { sku: 'HV60-100', name: 'Hario V60 02 paper filters, 100 count', priceCents: 899, regularCents: 899, inStock: true },
  { sku: 'HV60-DRIP', name: 'Hario V60 02 ceramic dripper, white', priceCents: 2700, regularCents: 2700, inStock: false },
  { sku: 'PT-6', name: 'Paper towels, 6 rolls', priceCents: 1149, regularCents: 1149, inStock: true },
  { sku: 'DS-750', name: 'Dish soap, 750 ml', priceCents: 399, regularCents: 399, inStock: true },
  { sku: 'CB-340', name: 'Whole bean coffee, 340 g', priceCents: 1600, regularCents: 1600, inStock: true },
  { sku: 'USBC-1M', name: 'USB-C cable, 1 m', priceCents: 999, regularCents: 999, inStock: true },
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

// ---------- payments: the one place that talks to Stripe ----------

export type Payment = { test: true; provider: 'stripe test mode' | 'simulated'; id: string; status: string; card: string; note?: string };
export type PayInput =
  | { action: 'charge'; cents: number; currency: string; card: string; key: string; description: string }
  | { action: 'refund'; payment: Payment; key: string };

// Stripe's test PaymentMethods. A simulated charge accepts only these, so no real card is ever "charged" here.
const TEST_CARDS: Record<string, string> = {
  pm_card_visa: 'Visa test card ending 4242',
  pm_card_visa_debit: 'Visa debit test card ending 5556',
  pm_card_chargeDeclined: 'Visa test card ending 0002 (always declined)',
};

async function stripe(key: string, route: string, form: Record<string, string>, idempotencyKey: string) {
  const r = await fetch(`https://api.stripe.com/v1/${route}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/x-www-form-urlencoded', 'idempotency-key': idempotencyKey },
    body: new URLSearchParams(form),
    signal: AbortSignal.timeout(30_000),
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Stripe ${r.status}: ${body?.error?.message ?? r.statusText}`);
  return body;
}

/** Charge or refund. `stripeKey` is undefined until the box's owner puts STRIPE_SECRET_KEY in the vault. */
export async function pay(input: PayInput, stripeKey: string | undefined): Promise<Payment> {
  const live = stripeKey && !OFFLINE;
  if (live && !/^(sk|rk)_test_/.test(stripeKey)) throw new Error('this store runs in Stripe test mode only, and the vault holds a live key, so it refuses to charge');
  const sim = (prefix: string) => `${prefix}_sim_${createHash('sha256').update(input.key).digest('hex').slice(0, 16)}`;
  const why = OFFLINE ? 'offline demo run: no Stripe call' : 'simulated: no STRIPE_SECRET_KEY in the vault yet';
  if (input.action === 'refund') {
    const p = input.payment;
    if (p.provider === 'simulated' || !live) return { ...p, id: sim('re'), status: 'refunded', note: why };
    const r = await stripe(stripeKey, 'refunds', { payment_intent: p.id }, input.key);
    return { ...p, id: r.id, status: r.status === 'succeeded' ? 'refunded' : r.status };
  }
  if (!TEST_CARDS[input.card]) throw new Error('the vault card is not a Stripe test card; this store takes test cards only');
  if (!live) {
    if (input.card === 'pm_card_chargeDeclined') throw new Error('card declined (simulated)');
    return { test: true, provider: 'simulated', id: sim('pi'), status: 'succeeded', card: TEST_CARDS[input.card], note: why };
  }
  const pi = await stripe(
    stripeKey,
    'payment_intents',
    {
      amount: String(input.cents),
      currency: input.currency.toLowerCase(),
      payment_method: input.card,
      'payment_method_types[]': 'card',
      confirm: 'true',
      description: `TEST: ${input.description}`.slice(0, 300),
      'metadata[box_order]': input.key,
      'expand[]': 'latest_charge',
    },
    input.key,
  );
  if (pi.status !== 'succeeded') throw new Error(`payment ${pi.status}`);
  const c = pi.latest_charge?.payment_method_details?.card;
  return { test: true, provider: 'stripe test mode', id: pi.id, status: pi.status, card: c ? `${c.brand === 'visa' ? 'Visa' : c.brand} test card ending ${c.last4}` : TEST_CARDS[input.card] };
}

// ---------- the order book ----------

export type Line = { sku: string; name: string; priceCents: number; qty: number; from?: string };
export type Order = {
  id: string; key: string; task?: string; items: Line[]; currency: string; totalCents: number; at: string;
  agent: Verified; payment: Payment; refund?: Payment;
};
export type Refusal = { at: string; reason: string };

const orders = new Map<string, Order>();
export const refusals: Refusal[] = [];
let loaded = false;
const ordersFile = () => path.join(HOME, 'shopper', 'orders.jsonl');
function load() {
  if (loaded) return;
  loaded = true;
  if (!fs.existsSync(ordersFile())) return;
  for (const line of fs.readFileSync(ordersFile(), 'utf8').split('\n')) {
    try {
      const o: Order = JSON.parse(line);
      orders.set(o.key, o); // a later line for the same order (a refund) replaces the earlier one
    } catch {} // a torn last line after a power cut
  }
}
function save(o: Order) {
  fs.mkdirSync(path.dirname(ordersFile()), { recursive: true, mode: 0o700 });
  const fd = fs.openSync(ordersFile(), 'a', 0o600);
  fs.writeSync(fd, JSON.stringify(o) + '\n');
  fs.fsyncSync(fd);
  fs.closeSync(fd);
  orders.set(o.key, o);
}
export const allOrders = () => (load(), [...orders.values()].reverse());
export const orderForTask = (task: string) => allOrders().find((o) => o.task === task);

// Nonces seen, until their signature expires. shortcut: in memory, so a restart forgets them; the Idempotency-Key
// still stops a replayed order from being charged twice.
const nonces = new Map<string, number>();
function seen(nonce: string, expires: number) {
  const now = Date.now() / 1000;
  for (const [n, e] of nonces) if (e < now) nonces.delete(n);
  if (nonces.has(nonce)) return false;
  nonces.set(nonce, expires);
  return true;
}

const fail = (status: number, error: string) => Response.json({ error }, { status });

/** POST /store/checkout. The agent registry is `registry(keyId)`; charging goes through `charge`. */
export async function checkout(req: Request, registry: (keyId: string) => Promise<string | undefined>, charge: (p: PayInput) => Promise<Payment>) {
  load();
  const body = await req.text();
  const url = new URL(req.url);
  let agent: Verified;
  try {
    const pub = await registry(KEY_ID);
    agent = verifyRequest({ authority: req.headers.get('host') ?? url.host, path: url.pathname, headers: req.headers, body }, (id) => (id === KEY_ID ? pub : undefined), seen);
    if (agent.tag !== PAYER) throw new Error(`a checkout needs the ${PAYER} tag, not ${agent.tag}`);
  } catch (e) {
    const reason = (e as Error).message;
    refusals.unshift({ at: new Date().toISOString(), reason });
    refusals.length = Math.min(refusals.length, 20);
    return fail(401, `refused: ${reason}`);
  }
  const key = req.headers.get('idempotency-key') ?? '';
  if (!key) return fail(400, 'an Idempotency-Key header is required');
  const done = orders.get(key);
  if (done) return Response.json({ ...done, repeat: true }); // the same order again after a restart: no second charge

  let o: { items?: Line[]; currency?: string; card?: string; task?: string };
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
    if (p) {
      if (currency !== 'USD') return fail(400, `${l.sku} is sold in USD here`);
      if (!p.inStock) return fail(409, `${p.name} is out of stock`);
      if (l.priceCents !== p.priceCents) return fail(409, `${p.name} is now $${(p.priceCents / 100).toFixed(2)}, not $${(l.priceCents / 100).toFixed(2)}`);
      l.name = p.name;
    } else if (!l.from || !Number.isInteger(l.priceCents) || l.priceCents <= 0) {
      return fail(400, `no product ${l.sku}`);
    } else {
      // A line another store priced (the watcher saw it live): the test store stands in for that store's checkout.
      l.name = String(l.name ?? l.sku).slice(0, 120);
    }
  }
  const totalCents = items.reduce((s, l) => s + l.priceCents * l.qty, 0);
  if (totalCents > MAX_ORDER_CENTS) return fail(400, 'orders above $500 are refused');

  const id = `ord_${createHash('sha256').update(key).digest('hex').slice(0, 10)}`;
  let payment: Payment;
  try {
    payment = await charge({ action: 'charge', cents: totalCents, currency, card: String(o.card ?? ''), key, description: `${id} ${items.map((l) => `${l.qty} x ${l.name}`).join(', ')}` });
  } catch (e) {
    return fail(402, `payment failed: ${(e as Error).message}`);
  }
  const order: Order = { id, key, task: o.task, items, currency, totalCents, at: new Date().toISOString(), agent, payment };
  save(order);
  return Response.json(order);
}

/** Refund the order a task placed (the task was undone). Safe to call twice. */
export async function refundTask(task: string, charge: (p: PayInput) => Promise<Payment>) {
  const o = orderForTask(task);
  if (!o || o.refund) return o;
  const refund = await charge({ action: 'refund', payment: o.payment, key: `refund-${o.id}` });
  save({ ...o, refund });
  return orders.get(o.key);
}

// ---------- the store's own page ----------

const esc = (s: unknown) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const money = (cents: number, cur = 'USD') => `$${(cents / 100).toFixed(2)}${cur === 'USD' ? '' : ' ' + cur}`;

export function storePage() {
  load();
  const rows = products().map((p) => `<tr><td class="mono">${esc(p.sku)}</td><td>${esc(p.name)}</td><td class="mono">${money(p.priceCents)}${p.priceCents < p.regularCents ? ` <s>${money(p.regularCents)}</s>` : ''}</td><td>${p.inStock ? 'In stock' : 'Sold out'}</td></tr>`).join('');
  const book = allOrders().slice(0, 20).map((o) => `<tr><td class="mono">${esc(o.id)}</td><td>${o.items.map((l) => `${l.qty} × ${esc(l.name)}${l.from ? ` <small>(${esc(l.from)} price)</small>` : ''}`).join('<br>')}</td><td class="mono">${money(o.totalCents, o.currency)}</td><td>TEST: ${esc(o.payment.card)}, ${esc(o.payment.provider)}<br><small class="mono">${esc(o.payment.id)}</small>${o.refund ? '<br><b>Refunded</b>' : ''}</td><td>Signed by <span class="mono">${esc(o.agent.keyId)}</span>, verified</td></tr>`).join('') || '<tr><td colspan="5">No orders yet.</td></tr>';
  const refused = refusals.map((r) => `<li><span class="mono">${esc(r.at.slice(11, 19))}</span> ${esc(r.reason)}</li>`).join('') || '<li>None yet.</li>';
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>GurtOS Test Store</title>
<style>body{font:16px/24px "IBM Plex Sans",system-ui,sans-serif;background:#F3F1EA;color:#1C201D;margin:0;padding:24px;max-width:1000px}h1{font-size:24px;line-height:32px}h2{font-size:17px;margin-top:32px}
table{border-collapse:collapse;width:100%;background:#FBFAF6;border:1px solid #D3D6CF;border-radius:6px}td,th{padding:8px 12px;border-top:1px solid #D3D6CF;text-align:left;vertical-align:top}th{font:500 12px/16px "IBM Plex Sans",system-ui;letter-spacing:.4px;text-transform:uppercase;color:#535A54}
.mono,small.mono{font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:14px}.test{background:#E6E7E1;border:1px solid #6B726C;border-radius:4px;padding:8px 12px}s{color:#535A54}</style>
<h1>GurtOS Test Store</h1>
<p class="test">TEST STORE. Every payment is a Stripe test-mode payment with a Visa test card. No real money moves, and nothing ships. It exists because no real store accepts a test card.</p>
<p>Checkout takes orders only from agents that sign the request with <a href="https://github.com/visa/trusted-agent-protocol">Visa Trusted Agent Protocol</a>, checked against the agent registry key <span class="mono">${KEY_ID}</span>.</p>
<h2>Products</h2><table><tr><th>SKU</th><th>Product</th><th>Price</th><th>Stock</th></tr>${rows}</table>
<h2>Orders</h2><table><tr><th>Order</th><th>Items</th><th>Total</th><th>Payment</th><th>Agent</th></tr>${book}</table>
<h2>Refused at checkout</h2><ul>${refused}</ul></html>`;
}
