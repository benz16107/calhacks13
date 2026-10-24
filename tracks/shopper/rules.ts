// Spending rules, like the controls a card app gives you: a monthly cap, caps per store and per category, and
// "never buy" words. You set them from the phone; the box checks them before every payment, in code, so no agent
// and no approval can go past them. Amounts are in US dollars, the box's budget currency; CAD prices count at the
// box's fixed rate.

export type Rules = {
  /** Most the shopper may spend in a calendar month, in US cents. Missing means no cap; 0 means no spending at all. */
  monthlyCents?: number;
  /** Store id to monthly cap in US cents, e.g. { 'bestbuy.ca': 5000 }. */
  perStore: Record<string, number>;
  /** Category to monthly cap in US cents, e.g. { electronics: 0 } blocks the category. */
  perCategory: Record<string, number>;
  /** Words that block an item, lowercase, e.g. ['alcohol', 'gift card']. */
  never: string[];
};
export const NO_RULES: Rules = { perStore: {}, perCategory: {}, never: [] };

/** Something the shopper already spent this month (a paid order line, minus what came back). */
export type Spent = { at: string; store: string; category: string; usdCents: number };
/** A line about to be paid. */
export type Item = { name: string; store: string; category: string; usdCents: number };

const dollars = (c: number) => `$${(c / 100).toFixed(2)}`;
const sameMonth = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();

/** Check and clean rules from the phone. Throws a plain-words reason. */
export function parseRules(i: any): Rules {
  const cap = (v: unknown, what: string) => {
    const n = Number(v);
    if (!Number.isInteger(n) || n < 0 || n > 1_000_000) throw new Error(`${what} must be a dollar amount from $0 to $10,000`);
    return n;
  };
  const caps = (o: unknown, what: string) =>
    Object.fromEntries(Object.entries(o && typeof o === 'object' ? o : {}).filter(([k]) => /^[\w.-]{1,40}$/.test(k)).map(([k, v]) => [k, cap(v, `${what} ${k}`)]));
  const never = (Array.isArray(i?.never) ? i.never : []).map((w: unknown) => String(w).toLowerCase().replace(/\s+/g, ' ').trim()).filter((w: string) => w.length >= 2 && w.length <= 40).slice(0, 20);
  const monthly = i?.monthlyCents ?? undefined;
  return { ...(monthly !== undefined && monthly !== '' ? { monthlyCents: cap(monthly, 'The monthly cap') } : {}), perStore: caps(i?.perStore, 'The cap for'), perCategory: caps(i?.perCategory, 'The cap for'), never };
}

/** Lowercase words separated by single spaces, so "Gift-Card" and "gift card" compare equal. */
const plain = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
/** Whole words only: "ale" does not match "wholesale", "gift card" matches "Visa Gift-Card". */
export const hasPhrase = (text: string, phrase: string) => !!plain(phrase) && ` ${plain(text)} `.includes(` ${plain(phrase)} `);

/** Why these items may not be bought under the rules, or undefined when they may. */
export function blocked(rules: Rules, spent: Spent[], items: Item[], now = new Date()): string | undefined {
  for (const it of items) {
    const word = rules.never.find((w) => hasPhrase(it.name, w));
    if (word) return `your rule says never buy "${word}" (${it.name})`;
  }
  const month = spent.filter((s) => sameMonth(new Date(s.at), now));
  const sum = (xs: { usdCents: number }[]) => xs.reduce((s, x) => s + x.usdCents, 0);
  const total = sum(items);
  if (rules.monthlyCents !== undefined && sum(month) + total > rules.monthlyCents) {
    if (rules.monthlyCents === 0) return 'your monthly cap is $0.00: no spending this month';
    return `it would pass your monthly cap of ${dollars(rules.monthlyCents)} (spent ${dollars(sum(month))} this month, this is ${dollars(total)})`;
  }
  for (const [store, capCents] of Object.entries(rules.perStore)) {
    const now_ = sum(items.filter((i) => i.store === store));
    if (now_ && sum(month.filter((s) => s.store === store)) + now_ > capCents) return `it would pass your ${dollars(capCents)} monthly cap for ${store}`;
  }
  for (const [cat, capCents] of Object.entries(rules.perCategory)) {
    const now_ = sum(items.filter((i) => i.category === cat));
    if (now_ && sum(month.filter((s) => s.category === cat)) + now_ > capCents) {
      return capCents === 0 ? `your rule blocks the ${cat} category` : `it would pass your ${dollars(capCents)} monthly cap for ${cat}`;
    }
  }
  return undefined;
}
