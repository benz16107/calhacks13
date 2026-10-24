// The Apify track: agents do web work through Apify Actors instead of a browser. Tools run in the core with
// APIFY_TOKEN from the vault; the task only sees the results. See README.md for the Actors and why.
import type { Ctx, Track } from '../../core/contract.ts';

const API = 'https://api.apify.com/v2';
const BESTBUY = 'https://www.bestbuy.ca/api/v2/json';
// Every result goes into the action log, so one call returns at most this many characters of items.
const MAX_OUTPUT = 20_000;

const clamp = (v: unknown, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(Number(v)) || lo));
const text = (v: unknown, what: string) => {
  const s = typeof v === 'string' ? v.trim() : '';
  if (!s) throw new Error(`${what} is required`);
  return s;
};
const capUsd = (i: { maxUsd?: unknown } | undefined) => (Number(i?.maxUsd) > 0 ? Number(i!.maxUsd) : 0.5);

/** Run an Actor and wait for its dataset items (Apify allows up to 300 s). Errors carry Apify's message, never the token. */
export async function runActor(ctx: Ctx, actor: string, input: unknown, query: Record<string, string | number> = {}) {
  // Owner/name, owner~name or an Actor ID. No leading dots, so the name cannot walk to another API path.
  if (!/^[\w-][\w.-]*([/~][\w-][\w.-]*)?$/.test(actor)) throw new Error(`not an Actor name: ${actor}`);
  const params = new URLSearchParams(Object.entries({ timeout: 120, ...query }).map(([k, v]) => [k, String(v)]));
  const token = ctx.secret('APIFY_TOKEN').trim();
  if (!token) throw new Error('the vault has no APIFY_TOKEN');
  const r = await fetch(`${API}/acts/${actor.replace('/', '~')}/run-sync-get-dataset-items?${params}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(input ?? {}),
    signal: AbortSignal.timeout(310_000),
  });
  const body = await r.json().catch(() => undefined);
  if (!r.ok) throw new Error(`Apify ${r.status}: ${body?.error?.message ?? r.statusText}`);
  if (!Array.isArray(body)) throw new Error('Apify returned no dataset items');
  if (JSON.stringify(body).includes(token)) throw new Error('the Actor returned the API token, so the result was withheld');
  return body as Record<string, any>[];
}

/** Cut every string in a value to `max` characters. */
const shorten = (v: unknown, max: number): unknown =>
  typeof v === 'string' ? (v.length > max ? v.slice(0, max) + '...' : v)
  : Array.isArray(v) ? v.map((x) => shorten(x, max))
  : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, shorten(x, max)]))
  : v;

/** Keep as many whole items as fit in MAX_OUTPUT characters. If not even the first fits, keep it with its long text cut. */
export function fit(items: unknown[]) {
  const kept: unknown[] = [];
  let size = 2;
  for (const item of items) {
    size += JSON.stringify(item).length + 1;
    if (size > MAX_OUTPUT) break;
    kept.push(item);
  }
  const cut = !kept.length && items.length > 0;
  if (cut) kept.push(shorten(items[0], 2000));
  return { count: items.length, items: kept, ...((cut || kept.length < items.length) && { truncated: true }) };
}

// Runs on Apify inside Playwright Scraper, once per Best Buy JSON response. A search queues each hit's product
// page, because only the product endpoint says whether it is in stock. Chromium shows JSON in a <pre>.
export const PAGE_FUNCTION = `async function pageFunction({ page, customData, enqueueRequest }) {
  const json = JSON.parse(await page.evaluate(() => (document.querySelector('pre') || document.body).textContent));
  if (Array.isArray(json.products)) {
    for (const p of json.products.slice(0, customData.max)) {
      await enqueueRequest({ url: '${BESTBUY}/product/' + p.sku + '?lang=en-CA' });
    }
    return null;
  }
  const a = json.availability || {};
  return {
    sku: json.sku,
    name: json.name,
    price: json.salePrice,
    regularPrice: json.regularPrice,
    inStock: a.buttonState === 'AddToCart', // the others are SoldOut and Preorder; 'OnlineOnly' items can be in stock
    online: a.onlineAvailability,
    onlineQuantity: a.onlineAvailabilityCount,
    inStores: a.inStoreAvailability,
    url: json.productUrl,
  };
}`;

export default {
  name: 'apify',

  tools: [
    {
      name: 'apify.run',
      description:
        'Run any Actor from the Apify Store (apify.com/store) with an input and get its results: web search, store pages, ' +
        'maps, listings, social posts. Input: { actor: "owner/name", input: the Actor\'s own input object, fields?: names ' +
        'of the result fields to keep, maxItems?: 1 to 100 results (default 20), maxUsd?: most the run may spend in US ' +
        'dollars (default 0.50) }.',
      input: {
        type: 'object',
        properties: {
          actor: { type: 'string', description: 'Actor name, e.g. "apify/rag-web-browser"' },
          input: { type: 'object', description: "The Actor's input, as described on its Apify Store page" },
          fields: { type: 'array', items: { type: 'string' }, description: 'Keep only these fields of each result' },
          maxItems: { type: 'number', description: 'Results to return, 1 to 100. Default 20.' },
          maxUsd: { type: 'number', description: 'Most this run may spend, in US dollars. Default 0.50.' },
        },
        required: ['actor'],
      },
      secrets: ['APIFY_TOKEN'],
      hosts: ['api.apify.com'],
      // The box cannot know an arbitrary Actor's price, so it counts the cap, which Apify enforces.
      cost: (i) => capUsd(i) * 100,
      async run(i, ctx) {
        const actor = text(i?.actor, 'actor');
        const maxItems = clamp(i.maxItems ?? 20, 1, 100);
        const fields: string | undefined = Array.isArray(i.fields) && i.fields.length ? i.fields.join(',') : undefined;
        const items = await runActor(ctx, actor, i.input ?? {}, {
          clean: 1,
          limit: maxItems,
          maxItems,
          maxTotalChargeUsd: capUsd(i),
          ...(fields && { fields }),
        });
        return { actor, ...fit(items) };
      },
    },

    {
      name: 'apify.checkPrice',
      description:
        'Live price and stock of a product at Best Buy Canada (bestbuy.ca), for watching a price drop or a restock. ' +
        'Input: { product: a Best Buy SKU, a bestbuy.ca product link, or search words; max?: 1 to 5 results for a search ' +
        '(default 3) }. Returns each product\'s name, price and regular price in CAD, and whether it is in stock online and in stores.',
      input: {
        type: 'object',
        properties: {
          product: { type: 'string', description: 'A SKU like "19451577", a bestbuy.ca product link, or search words' },
          max: { type: 'number', description: 'For a search, how many products to check, 1 to 5. Default 3.' },
        },
        required: ['product'],
      },
      secrets: ['APIFY_TOKEN'],
      hosts: ['api.apify.com'],
      // Playwright Scraper bills compute only: a search and two products took 12 s and cost $0.0016 on 2026-10-23.
      // (Cheerio Scraper would be lighter, but it needs full access to the Apify account.)
      cost: () => 1,
      async run(i, ctx) {
        const product = text(i?.product, 'product');
        const max = clamp(i.max ?? 3, 1, 5);
        const link = product.includes('bestbuy.ca');
        const sku = /^\d{6,10}$/.test(product) ? product : link ? product.match(/\/(\d{6,10})(?:[/?#]|$)/)?.[1] : undefined;
        if (link && !sku) throw new Error('that bestbuy.ca link has no product SKU in it; use a product page link');
        const url = sku ? `${BESTBUY}/product/${sku}?lang=en-CA` : `${BESTBUY}/search?lang=en-CA&pageSize=${max}&query=${encodeURIComponent(product)}`;
        const items = await runActor(
          ctx,
          'apify/playwright-scraper',
          {
            startUrls: [{ url }],
            pageFunction: PAGE_FUNCTION,
            customData: { max },
            linkSelector: '',
            proxyConfiguration: { useApifyProxy: true },
            maxRequestRetries: 2,
            maxPagesPerCrawl: max + 1,
            waitUntil: 'domcontentloaded',
            downloadMedia: false,
            downloadCss: false,
          },
          { memory: 2048, timeout: 90 }, // not clean: failed requests come back as items marked '#error'
        );
        const products = items.filter((x) => x.sku).map((x) => Object.fromEntries(Object.entries(x).filter(([k]) => !k.startsWith('#'))));
        const failed = items.filter((x) => x['#error']);
        if (!products.length && failed.length) throw new Error(`Best Buy did not answer Apify: ${failed[0]['#debug']?.errorMessages?.at(-1) ?? 'no detail'}`);
        // A watcher must tell "not found" from "Best Buy did not answer for this one".
        const notChecked = failed.map((x) => x['#debug']?.url ?? 'unknown');
        return { store: 'bestbuy.ca', currency: 'CAD', checkedAt: new Date().toISOString(), products, ...(notChecked.length && { notChecked }) };
      },
    },

    {
      name: 'apify.findPlaces',
      description:
        'Look up places on Google Maps, live: shops, restaurants, repair services and the like near a location. Input: ' +
        '{ query: what to look for, near: a city or address, max?: 1 to 10 places (default 5) }. Returns each place\'s ' +
        'name, category, address, rating, phone, website and Google Maps link.',
      input: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'What to look for, e.g. "bike repair"' },
          near: { type: 'string', description: 'A city or address, e.g. "Berkeley, CA"' },
          max: { type: 'number', description: 'How many places, 1 to 10. Default 5.' },
        },
        required: ['query', 'near'],
      },
      secrets: ['APIFY_TOKEN'],
      hosts: ['api.apify.com'],
      // Google Maps Scraper charges $0.004 per place on Apify's free plan, and nothing to start.
      cost: (i) => 0.4 * clamp(i?.max ?? 5, 1, 10),
      async run(i, ctx) {
        const max = clamp(i?.max ?? 5, 1, 10);
        const items = await runActor(
          ctx,
          'compass/crawler-google-places',
          { searchStringsArray: [text(i.query, 'query')], locationQuery: text(i.near, 'near'), maxCrawledPlacesPerSearch: max, language: 'en' },
          { clean: 1, limit: max, fields: 'title,categoryName,address,totalScore,reviewsCount,phone,website,url,permanentlyClosed,temporarilyClosed' },
        );
        return {
          places: items.map((p) => ({
            name: p.title,
            category: p.categoryName,
            address: p.address,
            rating: p.totalScore,
            reviews: p.reviewsCount,
            phone: p.phone,
            website: p.website,
            url: p.url,
            ...((p.permanentlyClosed || p.temporarilyClosed) && { closed: true }),
          })),
        };
      },
    },
  ],
} satisfies Track;
