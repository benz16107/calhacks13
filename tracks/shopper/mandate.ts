// A shopping mandate: the owner's instruction, signed, that the agent carries to the store. "Chemex filters, up
// to $16 each, at most 2, from Best Buy Canada or Eight Ounce Coffee, until Friday" becomes this object. The owner
// approves it (with Face ID when a passkey is set up), the box signs it with its agent key, and the store checks
// both the agent's Trusted Agent Protocol signature and the mandate before it takes an order. Anything outside the
// mandate is refused: another item, a higher price, another store, more items, or after it expires.
// It mirrors the "payment instruction" in Visa Intelligent Commerce, built with open tools: here the box signs it,
// where in Visa's version Visa would. See README.md.
import { signBytes, verifyBytes } from './tap.ts';

export type Mandate = {
  v: 1;
  id: string;
  /** What the owner asked for, in their words. */
  text: string;
  /** Words every item's name must contain, lowercase, e.g. ['chemex', 'filter']. */
  match: string[];
  /** Exact products allowed, when known: [{ store, sku }]. Empty means any item that matches the words. */
  skus: { store: string; sku: string }[];
  stores: string[];
  currency: 'CAD' | 'USD';
  maxItemCents: number;
  maxQty: number;
  maxTotalCents: number;
  category: string;
  createdAt: string;
  expires: string;
  /** How the owner approved it. The store records this as evidence; the box checked it before signing. */
  approvedBy: { method: 'passkey' | 'tap'; by: string; at: string };
  /** The agent key that signed it (the Trusted Agent Protocol key id). */
  issuer: string;
};
export type Signed = { mandate: Mandate; sig: string };
export type Line = { sku: string; name: string; priceCents: number; qty: number; from?: string; category?: string };
export type Refusal = {
  code: 'no mandate' | 'bad mandate' | 'bad mandate signature' | 'expired' | 'wrong store' | 'wrong item' | 'over price' | 'over quantity' | 'over total' | 'wrong currency' | 'bad order';
  reason: string;
};
/** A mandate lasts at most this long, so a typo can't make it last for years. */
export const MAX_DAYS = 30;
/** Signed bytes start with this, so a mandate signature can't pass for any other signature made with the same key. */
const DOMAIN = 'gurtos-mandate-v1\n';
const safe = (n: unknown, min: number) => Number.isSafeInteger(n) && (n as number) >= min;

/** JSON with sorted keys, so a signature does not depend on key order. */
export function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
  if (v && typeof v === 'object') return `{${Object.keys(v).sort().filter((k) => (v as any)[k] !== undefined).map((k) => `${JSON.stringify(k)}:${canonical((v as any)[k])}`).join(',')}}`;
  return JSON.stringify(v);
}

/** Why a mandate is not well formed, or undefined. The box checks this before it signs, and the store again. */
export function problem(m: Mandate, now = Date.now()): string | undefined {
  if (m?.v !== 1 || typeof m.id !== 'string') return 'not a version 1 mandate';
  if (!m.match.some((w) => typeof w === 'string' && w.trim()) && !m.skus.length) return 'it names no item: neither words nor exact products';
  if (!m.stores.length) return 'it names no store';
  if (!safe(m.maxItemCents, 1) || !safe(m.maxQty, 1) || !safe(m.maxTotalCents, 1)) return 'its limits must be whole positive numbers';
  if (m.maxTotalCents < m.maxItemCents) return 'its total limit is below its price limit';
  if (!(Date.parse(m.expires) <= now + (MAX_DAYS + 1) * 86_400_000)) return `it lasts more than ${MAX_DAYS} days`;
  return undefined;
}

export const signMandate = (m: Mandate, vaultKey: string): Signed => {
  const why = problem(m);
  if (why) throw new Error(`not signing that mandate: ${why}`);
  return { mandate: m, sig: signBytes(vaultKey, DOMAIN + canonical(m)) };
};

const money = (cents: number, cur: string) => `$${(cents / 100).toFixed(2)}${cur === 'USD' ? '' : ' ' + cur}`;

/**
 * The store's check. `pub` is the issuer's raw public key from the agent registry, `agentKeyId` the key that signed
 * this request (TAP), and `used` what earlier orders under the same mandate already took (the limits cover the
 * whole mandate, not one order). Returns why the order is refused, or undefined when it fits.
 */
export function outside(
  s: Signed | undefined, pub: string | undefined, lines: Line[], currency: string,
  opts: { now?: number; agentKeyId?: string; used?: { qty: number; cents: number } } = {},
): Refusal | undefined {
  const now = opts.now ?? Date.now();
  if (!s?.mandate || !s.sig) return { code: 'no mandate', reason: 'no shopping mandate: this store takes agent orders only with one the owner approved' };
  const m = s.mandate;
  if (!pub || !verifyBytes(pub, DOMAIN + canonical(m), s.sig)) return { code: 'bad mandate signature', reason: 'the mandate signature does not verify, so it was changed or not issued by this agent' };
  if (opts.agentKeyId !== undefined && m.issuer !== opts.agentKeyId) return { code: 'bad mandate signature', reason: `the mandate was issued by ${m.issuer}, not the agent that signed this request` };
  const bad = problem(m, Date.parse(m.createdAt) || now);
  if (bad) return { code: 'bad mandate', reason: `the mandate is not well formed: ${bad}` };
  if (!(Date.parse(m.expires) > now)) return { code: 'expired', reason: `the mandate expired at ${m.expires}` };
  if (currency !== m.currency) return { code: 'wrong currency', reason: `the mandate is in ${m.currency}, this order is in ${currency}` };
  if (!Array.isArray(lines) || !lines.length) return { code: 'bad order', reason: 'the order has no lines' };
  let qty = opts.used?.qty ?? 0;
  let total = opts.used?.cents ?? 0;
  for (const l of lines) {
    if (!safe(l.qty, 1) || !safe(l.priceCents, 0)) return { code: 'bad order', reason: 'every line needs a whole quantity of 1 or more and a whole price in cents' };
    const store = l.from ?? 'test';
    if (!m.stores.includes(store)) return { code: 'wrong store', reason: `${store} is not one of the mandate's stores (${m.stores.join(', ')})` };
    // Whole words, or the word with an s or es: "filter" matches "Filters" and "Filter Squares", "har" does not match "Hario".
    const tokens = new Set(String(l.name ?? '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean));
    const has = (w: string) => [w, `${w}s`, `${w}es`].some((t) => tokens.has(t));
    const listed = m.skus.length === 0 || m.skus.some((x) => x.store === store && x.sku === l.sku);
    if (!listed || !m.match.map((w) => w.trim().toLowerCase()).filter(Boolean).every(has)) return { code: 'wrong item', reason: `"${l.name}" is not what the mandate is for (${m.text})` };
    if (l.priceCents > m.maxItemCents) return { code: 'over price', reason: `${money(l.priceCents, currency)} each is over the mandate's ${money(m.maxItemCents, currency)}` };
    qty += l.qty;
    total += l.priceCents * l.qty;
  }
  const before = opts.used?.qty ? ` (${opts.used.qty} already bought under it)` : '';
  if (qty > m.maxQty) return { code: 'over quantity', reason: `${qty} items is more than the mandate's ${m.maxQty}${before}` };
  if (total > m.maxTotalCents) return { code: 'over total', reason: `${money(total, currency)} is over the mandate's ${money(m.maxTotalCents, currency)} total${before}` };
  return undefined;
}

/** Every limit in plain words, for the owner's approval and the store's page: what you approve is what gets signed. */
export function describe(
  m: Pick<Mandate, 'text' | 'match' | 'skus' | 'stores' | 'currency' | 'maxItemCents' | 'maxQty' | 'maxTotalCents' | 'category' | 'expires'>,
  label: (store: string) => string,
) {
  const until = new Date(m.expires).toLocaleString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });
  const what = m.skus.length ? `only ${m.skus.map((x) => `${x.sku} at ${label(x.store)}`).join(', ')}` : `an item whose name has "${m.match.join('" and "')}"`;
  return `${m.text} (${what}, ${m.category}): up to ${money(m.maxItemCents, m.currency)} each, at most ${m.maxQty} and ${money(m.maxTotalCents, m.currency)} in all, from ${m.stores.map(label).join(' or ')}, until ${until}`;
}
