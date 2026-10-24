// wallet.discover: an agent shops for paid APIs in Coinbase's x402 Bazaar. Discovery is free and moves no money.
// Bazaar entries are written by strangers: every string is capped and stripped of control characters, and no URL
// in them is ever fetched here. The agent decides what to pay, and wallet.quote / wallet.pay check the host rule.
import { searchX402Resources } from '@coinbase/cdp-sdk';
import type { Tool } from '../../core/contract.ts';
import { DEVNET, LABEL, USDC } from './lib.ts';

/** USDC mints whose price we can read in cents (6 decimals): Solana devnet and mainnet, Base, Polygon, Arbitrum. */
const USDC_MINTS = new Set([USDC, 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', '0xaf88d065e77c8cC2239327C5EDb3A432268e5831']);

type Accept = { scheme?: unknown; network?: unknown; asset?: unknown; payTo?: unknown; amount?: unknown; maxAmountRequired?: unknown };
/** The part of a Bazaar entry we read. Also the shape of the box's own offers (`extra`). */
export type Listing = { resource?: unknown; description?: unknown; accepts?: Accept[] };
export type Search = (p: { query?: string; network?: string; limit: number }) => Promise<Listing[]>;

export type Found = { url: string; description: string; cents: number | null; network: string; scheme: string; payTo: string; payable: boolean; hostNeeded: string };

/** Cap a string and drop control characters, including newlines, so it cannot smuggle instructions in layout. */
const clean = (v: unknown, max: number) => String(v ?? '').replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]+/g, ' ').trim().slice(0, max);

/** One entry becomes one result: the offer this wallet can pay if there is one, else the cheapest. */
export function toFound(l: Listing): Found | undefined {
  let url: URL;
  try {
    url = new URL(String(l.resource));
  } catch {
    return;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;
  const offers = (Array.isArray(l.accepts) ? l.accepts : []).map((a) => {
    const raw = String(a.amount ?? a.maxAmountRequired);
    const known = USDC_MINTS.has(String(a.asset)) && /^\d{1,30}$/.test(raw);
    const payable = a.network === DEVNET && a.asset === USDC && (a.scheme === 'exact' || a.scheme === 'upto') && known;
    return { a, payable, cents: known ? Number(raw) / 10_000 : null };
  });
  const best = offers.sort((x, y) => Number(y.payable) - Number(x.payable) || (x.cents ?? Infinity) - (y.cents ?? Infinity))[0];
  if (!best) return;
  // The host form the task's `hosts` list needs: host:port unless the port is the default for the scheme.
  return {
    url: url.href.slice(0, 500),
    description: clean(l.description, 200),
    cents: best.cents,
    network: clean(best.a.network, 60),
    scheme: clean(best.a.scheme, 20),
    payTo: clean(best.a.payTo, 70),
    payable: best.payable,
    hostNeeded: url.host,
  };
}

/** Drop what costs too much or is unpriced under a cap, then payable first, cheapest first. */
export function rank(found: Found[], opts: { maxCents?: number; budgetLeft?: number; limit: number }): Found[] {
  const cap = Math.min(opts.maxCents ?? Infinity, opts.budgetLeft ?? Infinity);
  const seen = new Set<string>();
  return found
    .filter((f) => (cap === Infinity ? true : f.cents !== null && f.cents <= cap))
    .filter((f) => !seen.has(f.url) && !!seen.add(f.url))
    .sort((a, b) => Number(b.payable) - Number(a.payable) || (a.cents ?? Infinity) - (b.cents ?? Infinity))
    .slice(0, opts.limit);
}

const bazaar: Search = (p) => searchX402Resources(p).then((r) => r.resources as Listing[]);

/** `extra` lets the box add its own local offers (a Listing list) beside the Bazaar's. */
export function discoverTool(search: Search = bazaar, extra: () => Listing[] = () => []): Tool {
  return {
    name: 'wallet.discover',
    description:
      `Search Coinbase's x402 Bazaar for paid APIs. Free, moves no money. Returns url, description, price in US cents, network, scheme, payTo, ` +
      `and payable: true for offers this wallet can pay (${LABEL}, exact or upto). Each result names hostNeeded, the host the task needs in its hosts to pay it. ` +
      `Most Bazaar APIs are on other networks and show payable: false. Input: { query?, maxCents?, limit? (default 5, up to 20) }.`,
    input: { type: 'object', properties: { query: { type: 'string' }, maxCents: { type: 'number' }, limit: { type: 'number' } } },
    cost: () => 0,
    async run(input: { query?: unknown; maxCents?: unknown; limit?: unknown }, ctx) {
      const query = typeof input?.query === 'string' ? input.query.slice(0, 400) : undefined;
      const maxCents = typeof input?.maxCents === 'number' && Number.isFinite(input.maxCents) && input.maxCents >= 0 ? input.maxCents : undefined;
      const limit = typeof input?.limit === 'number' && input.limit >= 1 ? Math.min(Math.floor(input.limit), 20) : 5;
      const budgetLeft = ctx.task ? ctx.task.budgetCents - ctx.task.costCents : undefined;
      // Devnet listings are rare, so ask for them by network too, or the payable ones drown in mainnet results.
      const lists = await Promise.all([search({ query, network: DEVNET, limit: 20 }), search({ query, limit: 20 })]);
      const found = [...extra(), ...lists.flat()].map(toFound).filter((f): f is Found => !!f);
      const results = rank(found, { maxCents, budgetLeft, limit });
      ctx.log(`Bazaar search${query ? ` "${clean(query, 60)}"` : ''}: ${results.length} results, ${results.filter((r) => r.payable).length} payable`);
      return { results, test: true, note: `Only payable: true offers can be paid by this wallet (${LABEL}). Add hostNeeded to the task's hosts to pay one.` };
    },
  };
}

export const discover = discoverTool();
