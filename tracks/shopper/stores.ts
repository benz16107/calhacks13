// The stores the Shopper compares, and the rule that picks the best total price. A store is a tool to call,
// the input for it, and a parser that turns its answer into offers in cents. Nothing here makes a network call.
//
// Why Gold Roast is the second real store (checked 2026-10-24). It sells the product Best Buy Canada sells,
// Chemex natural square filters. Most Canadian coffee shops run Shopify, and almost every one has Shopify's
// standard terms of service, which ban using the site "to spam, phish, pharm, pretext, spider, crawl, or scrape"
// (seen at eightouncecoffee.ca, transcendcoffee.ca, javablendcoffee.com and others, under /policies/terms-of-service).
// Newer Shopify robots.txt files also say agents "must identify agent-initiated requests" with Web Bot Auth, which
// a rented Apify browser cannot do. gourmetwarehouse.ca names ClaudeBot, ChatGPT-User and anthropic-ai in its
// robots.txt and blocks them. Gold Roast has none of that, see `agents` below. Amazon refuses AI agents.

export type StoreId = 'test' | 'bestbuy.ca' | 'goldroast.ca';
export type Currency = 'CAD' | 'USD';
export type Offer = {
  store: StoreId; sku: string; name: string; priceCents: number; regularCents: number; currency: Currency;
  inStock: boolean; url?: string; checkedAt: string; packCount?: number;
  /** Best Buy only: true when a Marketplace seller ships it. Best Buy's free shipping excludes those. */
  marketplace?: boolean;
};
export type Shipping = {
  flatCents?: number;      // charged when the order is under freeOverCents (or always, if there is no threshold)
  freeOverCents?: number;  // items total, before tax, at or above which shipping is free
  known: boolean;          // false when part of the rule is not confirmed; compare() then says so
  firstPartyOnly?: boolean; // the free-over rule holds only for offers marked marketplace: false
  source?: string;
};
export type Store = {
  label: string;
  currency: Currency;
  tool: string;
  input(product: string): unknown;
  parse(output: unknown, product: string): Offer[];
  shipping: Shipping;
  agents: string;
};

const oneLine = (s: unknown, max = 160) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const cents = (dollars: unknown) => Math.round(Number(dollars) * 100);
const money = (c: number) => `$${(c / 100).toFixed(2)}`;
/** "300 ct", "[100 Pack]", "(100-Pack)". Counts of 2 or more only, so "6-Cup" and "Size 4" do not match. */
const packOf = (name: string) => {
  const n = Number(name.match(/(\d{1,4})\s*[- ]?(?:ct|count|pack|pk|pcs?)\b/i)?.[1]);
  return n >= 2 ? n : undefined;
};

/** Offers from the { products: [{ sku, name, price, regularPrice, inStock }] } answer of apify.checkPrice and shopper.checkPrice. */
function fromProducts(store: StoreId, currency: Currency) {
  return (output: any, product: string): Offer[] => {
    const list: any[] = (Array.isArray(output?.products) ? output.products : []).filter((p: any) => Number.isFinite(p?.price));
    const exact = list.filter((p) => String(p.sku) === product);
    const checkedAt = typeof output?.checkedAt === 'string' ? output.checkedAt : new Date().toISOString();
    return (exact.length ? exact : list).map((p) => {
      const name = oneLine(p.name), packCount = packOf(name);
      return {
        store, sku: String(p.sku), name, priceCents: cents(p.price), regularCents: Math.max(cents(p.regularPrice ?? p.price), cents(p.price)),
        currency, inStock: p.inStock === true, ...(p.url && { url: String(p.url) }), checkedAt,
        ...(packCount && { packCount }), ...(typeof p.isMarketplace === 'boolean' && { marketplace: p.isMarketplace }),
      };
    });
  };
}

// ---------- Gold Roast: a Shopify store, read through Apify's Playwright Scraper ----------

const GOLDROAST = 'https://goldroast.ca';
// Runs on Apify, once per response. A Shopify product page ends in .js and answers with JSON (prices in cents). A
// search ends in /search/suggest.json (prices in dollars). Both come back as one item per variant. Chromium shows
// JSON in a <pre>, the same trick the Best Buy tool uses.
export const SHOPIFY_PAGE_FUNCTION = `async function pageFunction({ page, request }) {
  const json = JSON.parse(await page.evaluate(() => (document.querySelector('pre') || document.body).textContent));
  const origin = new URL(request.url).origin;
  const cents = (d) => Math.round(Number(d) * 100);
  const regular = (price, compareAt) => (compareAt > price ? compareAt : price);
  if (json.resources) {
    return json.resources.results.products.map((p) => ({
      sku: p.handle, title: p.title, url: origin + '/products/' + p.handle,
      priceCents: cents(p.price_min), regularCents: regular(cents(p.price_min), cents(p.compare_at_price_min)), available: p.available === true,
    }));
  }
  return json.variants.map((v) => ({
    sku: json.variants.length === 1 ? json.handle : json.handle + ':' + v.id,
    title: v.title === 'Default Title' ? json.title : json.title + ' - ' + v.title,
    url: origin + '/products/' + json.handle,
    priceCents: v.price, regularCents: regular(v.price, v.compare_at_price || 0), available: v.available === true,
  }));
}`;

/** A Shopify product handle: lowercase words joined by hyphens. One word is treated as a search, because it may be a title. */
const HANDLE = /^[a-z0-9]+(-[a-z0-9]+)+$/;
const handleOf = (product: string) => product.match(/goldroast\.ca\/(?:[a-z]{2}\/)?products\/([a-z0-9-]+)/i)?.[1]?.toLowerCase() ?? (HANDLE.test(product) ? product : undefined);

function goldRoastInput(product: string) {
  const text = oneLine(product, 200);
  if (!text) throw new Error('product is required: a Gold Roast product handle, link or search words');
  const handle = handleOf(text);
  const url = handle ? `${GOLDROAST}/products/${handle}.js` : `${GOLDROAST}/search/suggest.json?q=${encodeURIComponent(text)}&resources%5Btype%5D=product&resources%5Blimit%5D=3`;
  return {
    actor: 'apify/playwright-scraper',
    input: {
      startUrls: [{ url }], pageFunction: SHOPIFY_PAGE_FUNCTION, linkSelector: '', proxyConfiguration: { useApifyProxy: true },
      maxRequestRetries: 2, maxPagesPerCrawl: 1, waitUntil: 'domcontentloaded', downloadMedia: false, downloadCss: false,
    },
    maxItems: 5,
    maxUsd: 0.01, // one cent, the budget of a check task; a one-page run took 6 seconds on 2026-10-24
  };
}

function goldRoastParse(output: any, product: string): Offer[] {
  const handle = handleOf(oneLine(product, 200));
  const items: any[] = (Array.isArray(output?.items) ? output.items : []).filter((x: any) => Number.isFinite(x?.priceCents));
  const exact = handle ? items.filter((x) => String(x.sku).split(':')[0] === handle) : [];
  const checkedAt = new Date().toISOString();
  return (exact.length ? exact : items).map((x) => {
    const name = oneLine(x.title), packCount = packOf(name);
    return {
      store: 'goldroast.ca' as const, sku: String(x.sku), name, priceCents: Math.round(x.priceCents),
      regularCents: Math.max(Math.round(x.regularCents ?? x.priceCents), Math.round(x.priceCents)), currency: 'CAD' as const,
      inStock: x.available === true, ...(x.url && { url: String(x.url) }), checkedAt, ...(packCount && { packCount }),
    };
  });
}

// ---------- the table ----------

export const STORES: Record<StoreId, Store> = {
  test: {
    label: 'GurtOS Test Store',
    currency: 'USD',
    tool: 'shopper.checkPrice',
    input: (product) => ({ product, max: 1 }),
    parse: fromProducts('test', 'USD'),
    shipping: { known: true, source: 'Our own stand-in store. It never charges for shipping.' },
    agents: 'It is our own stand-in store, part of this repo, so no outside rules apply.',
  },

  'bestbuy.ca': {
    label: 'Best Buy Canada',
    currency: 'CAD',
    tool: 'apify.checkPrice',
    input: (product) => ({ product, max: 1 }),
    parse: fromProducts('bestbuy.ca', 'CAD'),
    // Page read with a real browser on 2026-10-24. It does not say what Best Buy charges under $35, and it says a
    // Marketplace seller's shipping is shown on the product page, so those are not known from the price check.
    shipping: {
      freeOverCents: 3500, firstPartyOnly: true, known: false,
      source: 'https://www.bestbuy.ca/en-ca/help/shipping-delivery-and-pick-up/free-shipping-on-orders-over-thirty-five-dollars: ' +
        'free standard shipping on Best Buy products over $35 before tax; items sold and shipped by Marketplace sellers are excluded. ' +
        'https://www.bestbuy.ca/en-ca/help/shipping-delivery-and-pick-up/common-shipping-questions: each Marketplace seller states its own shipping on the product page.',
    },
    // robots.txt (https://www.bestbuy.ca/robots.txt, checked 2026-10-24) has no clause for agents and does not block /api/.
    // The Conditions of Use do, in section 7, "NO LINKING, FRAMING, MIRRORING, SCRAPING, DATA-MINING OR POSTINGS".
    agents:
      'Its robots.txt (https://www.bestbuy.ca/robots.txt) does not block the product data, but its Conditions of Use, section 7, say ' +
      '"The framing, mirroring, scraping or data-mining of the Website or any of its content in any form and by any means is strictly prohibited" ' +
      '(https://www.bestbuy.ca/en-ca/help/policies-and-terms-and-conditions/conditions-of-use).',
  },

  'goldroast.ca': {
    label: 'Gold Roast',
    currency: 'CAD',
    tool: 'apify.run',
    input: goldRoastInput,
    parse: goldRoastParse,
    // https://goldroast.ca/policies/shipping-policy, read 2026-10-24: "Orders from Ontario with a pre-tax total under $75.00 will incur
    // a $15.00 shipping charge. No shipping charge on orders $75.00 or above." Other provinces pay $25 under $120, and Yukon, the
    // Northwest Territories, Nunavut and Newfoundland pay $75 under $250. It adds "free shipping is not available for all products;
    // some commercial items are excluded". The store's terms-of-service page repeats an older copy with $60.00 for Ontario. We use $75.
    shipping: {
      flatCents: 1500, freeOverCents: 7500, known: true,
      source: 'https://goldroast.ca/policies/shipping-policy: Ontario orders under $75.00 before tax pay $15.00, $75.00 or more ship free. Other provinces pay more.',
    },
    // https://goldroast.ca/robots.txt (checked 2026-10-24) is Shopify's older default: it names no bot or agent, allows /products/,
    // and blocks only /cart.js, /recommendations/products, collection sort and filter pages and checkout paths, which this store never reads.
    // https://goldroast.ca/policies/terms-of-service has no terms text at all (only the shipping policy), so nothing bans scraping.
    agents:
      'Its robots.txt (https://goldroast.ca/robots.txt) names no bot or agent and allows product pages, and its terms-of-service page ' +
      '(https://goldroast.ca/policies/terms-of-service) has no terms text, so nothing there bans automated reads of public product data.',
  },
};

// ---------- the comparison ----------

type Ship = { cents: number; known: boolean };
/** What shipping the order costs, from the store's rule. An unconfirmed part of the rule counts as $0 and is reported as not known. */
function shippingOf(o: Offer, itemsCents: number): Ship {
  const s = STORES[o.store].shipping;
  const rule = !s.firstPartyOnly || o.marketplace === false;
  if (s.freeOverCents !== undefined && rule && itemsCents >= s.freeOverCents) return { cents: 0, known: true };
  if (s.flatCents !== undefined) return { cents: s.flatCents, known: true };
  return { cents: 0, known: s.known && rule };
}

const shipText = (ship: Ship) => (!ship.known ? 'plus shipping that is not confirmed' : ship.cents ? `with ${money(ship.cents)} shipping` : 'with free shipping');
const perFilter = (o: Offer) => `${(o.priceCents / o.packCount!).toFixed(1)} cents`;

export type Row = { offer: Offer; totalCents?: number; shippingCents?: number; shippingKnown?: boolean; ok: boolean; why: string };

/** The best offer for `qty` items within `maxCents` per item, and the reasons, in plain words. */
export function compare(offers: Offer[], qty: number, maxCents: number): {
  best?: Offer & { totalCents: number; shippingCents: number; shippingKnown: boolean };
  rows: Row[];
  explanation: string;
} {
  qty = Math.max(1, Math.round(qty) || 1);
  if (!offers.length) return { rows: [], explanation: 'No store returned a price.' };
  // Prices in two currencies cannot be compared, so the first in-stock offer sets the currency.
  const currency = (offers.find((o) => o.inStock) ?? offers[0]).currency;
  const label = (o: Offer) => STORES[o.store].label;

  const rows: Row[] = offers.map((offer) => {
    if (!offer.inStock) return { offer, ok: false, why: 'out of stock' };
    if (offer.currency !== currency) return { offer, ok: false, why: `priced in ${offer.currency}, not ${currency}, so it cannot be compared` };
    const ship = shippingOf(offer, offer.priceCents * qty);
    const totalCents = offer.priceCents * qty + ship.cents;
    const priced = { offer, totalCents, shippingCents: ship.cents, shippingKnown: ship.known };
    if (offer.priceCents > maxCents) return { ...priced, ok: false, why: `${money(offer.priceCents)} each is over your limit of ${money(maxCents)}` };
    return { ...priced, ok: true, why: `${money(totalCents)} for ${qty} ${shipText(ship)}` };
  });

  // Cheapest total wins. On a tie, a confirmed shipping cost beats an unconfirmed one, then the lower price each.
  const ranked = rows.filter((r) => r.ok).sort((a, b) =>
    a.totalCents! - b.totalCents! || Number(!a.shippingKnown) - Number(!b.shippingKnown) || a.offer.priceCents - b.offer.priceCents);
  const [win, next] = ranked;
  const rejected = rows.filter((r) => !r.ok).map((r) => `${label(r.offer)} (${r.why})`);

  if (!win) return { rows, explanation: `No store can fill this order. ${rejected.join('; ')}.` };

  const line = (r: Row) => `${money(r.totalCents!)} ${r.shippingKnown ? (r.shippingCents ? `with ${money(r.shippingCents)} shipping` : 'with free shipping') : 'before shipping, which is not confirmed'}`;
  let text = `${label(win.offer)}: ${money(win.totalCents!)} for ${qty} ${shipText({ cents: win.shippingCents!, known: !!win.shippingKnown })}`;
  if (next) {
    const gap = next.totalCents! - win.totalCents!;
    text += gap > 0 ? `, ${money(gap)} less than ${label(next.offer)} (${line(next)})` : `, the same total as ${label(next.offer)} (${line(next)})`;
  }
  text += '.';

  const packs = ranked.filter((r) => r.offer.packCount);
  if (new Set(packs.map((r) => r.offer.packCount)).size > 1) {
    text += ` The packs differ in size: ${[...new Set(packs.map((r) => `${label(r.offer)} has ${r.offer.packCount} per pack (${perFilter(r.offer)} each)`))].join(', ')}.`;
  }
  if (rejected.length) text += ` Not chosen: ${rejected.join('; ')}.`;
  if (currency !== 'USD') text += ` Prices are in ${currency}.`;

  const { offer, totalCents, shippingCents, shippingKnown } = win;
  return { best: { ...offer, totalCents: totalCents!, shippingCents: shippingCents!, shippingKnown: !!shippingKnown }, rows, explanation: text };
}
