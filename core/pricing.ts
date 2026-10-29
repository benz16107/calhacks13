// Turns Droid's token counts into a real dollar cost per task. Factory bills in its own credits; these are
// the underlying model's public list prices, which is what the portal and the Microsoft "measurable
// usefulness" numbers show. Prices are US dollars per million tokens: input, output, cache write, cache read.
export interface Tokens {
  input: number;
  output: number;
  cacheWrite: number;
  cacheRead: number;
}

interface Price {
  in: number;
  out: number;
  cacheWrite: number;
  cacheRead: number;
}

// Anthropic list prices from platform.claude.com/docs/en/about-claude/pricing, read Oct 24 2026. Thinking tokens are
// billed as output and already in `output`. Haiku 5.5 charges 5x for a prompt over 100,000 tokens; a Droid task
// reports one total for all its turns, so that surcharge is not applied here (shortcut: Haiku tasks are short).
const PRICES: Record<string, Price> = {
  'claude-opus-5-5': { in: 4, out: 20, cacheWrite: 5, cacheRead: 0.2 },
  'claude-sonnet-5-5': { in: 2, out: 10, cacheWrite: 2.5, cacheRead: 0.1 },
  'claude-haiku-5-5': { in: 0.1, out: 0.5, cacheWrite: 0.125, cacheRead: 0.01 },
  // Earlier models a box may still be set to.
  opus: { in: 15, out: 75, cacheWrite: 18.75, cacheRead: 1.5 },
  sonnet: { in: 3, out: 15, cacheWrite: 3.75, cacheRead: 0.3 },
  haiku: { in: 1, out: 5, cacheWrite: 1.25, cacheRead: 0.1 },
};

function priceFor(model: string): Price {
  const exact = Object.keys(PRICES).find((name) => model.includes(name));
  if (exact) return PRICES[exact];
  return PRICES['claude-sonnet-5-5']; // the box's default model
}

/** A token count from a task: missing is 0; a negative or non-number one would lower the task's spend, so it is refused. */
const count = (v: unknown, name: string) => {
  if (v === undefined || v === null) return 0;
  if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) throw new Error(`tokens.${name}: a count of 0 or more`);
  return v;
};

/** US cents for this usage, not rounded, so sub-cent tasks still count. */
export function usageCents(model: string, t: Tokens): number {
  const p = priceFor(model);
  const n = (k: keyof Tokens) => count((t as Partial<Record<keyof Tokens, unknown>> | undefined)?.[k], k);
  const dollars = (n('input') * p.in + n('output') * p.out + n('cacheWrite') * p.cacheWrite + n('cacheRead') * p.cacheRead) / 1e6;
  return dollars * 100;
}
