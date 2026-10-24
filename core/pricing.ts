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

// Anthropic list prices, Oct 2026. Thinking tokens are billed as output and already in `output`.
const PRICES: Record<string, Price> = {
  opus: { in: 15, out: 75, cacheWrite: 18.75, cacheRead: 1.5 },
  sonnet: { in: 3, out: 15, cacheWrite: 3.75, cacheRead: 0.3 },
  haiku: { in: 1, out: 5, cacheWrite: 1.25, cacheRead: 0.1 },
};

function priceFor(model: string): Price {
  for (const name of Object.keys(PRICES)) if (model.includes(name)) return PRICES[name];
  return PRICES.sonnet; // the box's default model
}

/** US cents for this usage, not rounded, so sub-cent tasks still count. */
export function usageCents(model: string, t: Tokens): number {
  const p = priceFor(model);
  const dollars = (t.input * p.in + t.output * p.out + t.cacheWrite * p.cacheWrite + t.cacheRead * p.cacheRead) / 1e6;
  return dollars * 100;
}
