// Offline tests: node --experimental-strip-types --disable-warning=ExperimentalWarning --test tracks/shopper/stores.test.ts
// The store answers below were captured live on 2026-10-24 (Best Buy through apify.checkPrice, Gold Roast through apify.run).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SHOPIFY_PAGE_FUNCTION, STORES, compare, type Offer } from './stores.ts';

const TEST_STORE_ANSWER = {
  store: 'GurtOS Test Store', currency: 'USD', checkedAt: '2026-10-24T09:00:00.000Z',
  products: [{ sku: 'HV60-100', name: 'Hario V60 02 Paper Filters (100 ct)', price: 8.99, regularPrice: 10.99, inStock: true, url: '/t/shopper/store' }],
};
const BESTBUY_ANSWER = {
  store: 'bestbuy.ca', currency: 'CAD', checkedAt: '2026-10-24T09:27:21.133Z',
  products: [{
    sku: '20220310', name: 'Chemex Natural Coffee Filters, Square, 300 ct - Exclusive Packaging', price: 15.36, regularPrice: 20.36, inStock: true,
    online: 'OnlineOnly', onlineQuantity: 6, inStores: 'NotAvailable',
    url: 'https://www.bestbuy.ca/en-ca/product/chemex-natural-coffee-filters-square-300-ct-exclusive-packaging/20220310',
  }],
};
const GOLDROAST_PRODUCT_ANSWER = {
  actor: 'apify/playwright-scraper', count: 1,
  items: [{
    sku: 'chemex-natural-filter-squares-100-pack', title: 'CHEMEX Natural Filter Squares [100 Pack]',
    url: 'https://goldroast.ca/products/chemex-natural-filter-squares-100-pack', priceCents: 1600, regularCents: 1600, available: true,
  }],
};
const GOLDROAST_SEARCH_ANSWER = {
  actor: 'apify/playwright-scraper', count: 3,
  items: [
    { sku: 'chemex-filter-squares-100-pack', title: 'CHEMEX Filter Squares (100 Pack)', url: 'https://goldroast.ca/products/chemex-filter-squares-100-pack', priceCents: 1600, regularCents: 1600, available: true },
    { sku: 'chemex-natural-filter-squares-100-pack', title: 'CHEMEX Natural Filter Squares [100 Pack]', url: 'https://goldroast.ca/products/chemex-natural-filter-squares-100-pack', priceCents: 1600, regularCents: 1600, available: true },
    { sku: 'kalita-102-2-filters-100-pack', title: 'KALITA 102 #2 Filters (100 Pack)', url: 'https://goldroast.ca/products/kalita-102-2-filters-100-pack', priceCents: 700, regularCents: 700, available: true },
  ],
};

let n = 0;
const offer = (store: Offer['store'], priceCents: number, more: Partial<Offer> = {}): Offer => ({
  store, sku: `sku${n++}`, name: 'Chemex filters', priceCents, regularCents: priceCents, currency: store === 'test' ? 'USD' : 'CAD',
  inStock: true, checkedAt: '2026-10-24T09:00:00.000Z', ...more,
});
// A Best Buy offer that Best Buy itself sells: its $35 free-shipping rule applies. Unmarked offers have unconfirmed shipping.
const bby = (priceCents: number, more: Partial<Offer> = {}) => offer('bestbuy.ca', priceCents, { marketplace: false, ...more });
const gold = (priceCents: number, more: Partial<Offer> = {}) => offer('goldroast.ca', priceCents, more);

test('parse: the test store answer becomes one offer in cents', () => {
  const [o, ...rest] = STORES.test.parse(TEST_STORE_ANSWER, 'HV60-100');
  assert.equal(rest.length, 0);
  assert.deepEqual(o, {
    store: 'test', sku: 'HV60-100', name: 'Hario V60 02 Paper Filters (100 ct)', priceCents: 899, regularCents: 1099, currency: 'USD',
    inStock: true, url: '/t/shopper/store', checkedAt: '2026-10-24T09:00:00.000Z', packCount: 100,
  });
});

test('parse: Best Buy keeps the 300 pack, CAD cents and stock, and marks Marketplace only when the answer says so', () => {
  const [o] = STORES['bestbuy.ca'].parse(BESTBUY_ANSWER, '20220310');
  assert.equal(o.priceCents, 1536);
  assert.equal(o.regularCents, 2036);
  assert.equal(o.currency, 'CAD');
  assert.equal(o.inStock, true);
  assert.equal(o.packCount, 300);
  assert.equal(o.marketplace, undefined);
  const [m] = STORES['bestbuy.ca'].parse({ ...BESTBUY_ANSWER, products: [{ ...BESTBUY_ANSWER.products[0], isMarketplace: true }] }, '20220310');
  assert.equal(m.marketplace, true);
});

test('parse: a sold out product is not in stock, and rows without a price are dropped', () => {
  const out = { products: [{ sku: '1', name: 'A', price: 9.99, regularPrice: 9.99, inStock: false }, { sku: '2', name: 'B' }, { sku: '3', name: 'C', price: 4.5, inStock: true }] };
  const offers = STORES['bestbuy.ca'].parse(out, 'search words');
  assert.deepEqual(offers.map((o) => [o.sku, o.priceCents, o.regularCents, o.inStock]), [['1', 999, 999, false], ['3', 450, 450, true]]);
});

test('parse: when the product is a SKU in the answer, only that SKU comes back', () => {
  const out = { products: [{ sku: '1', name: 'A', price: 1, inStock: true }, { sku: '2', name: 'B', price: 2, inStock: true }] };
  assert.deepEqual(STORES['bestbuy.ca'].parse(out, '2').map((o) => o.sku), ['2']);
  assert.deepEqual(STORES['bestbuy.ca'].parse(out, 'anything').map((o) => o.sku), ['1', '2']);
});

test('parse: nothing useful gives no offers', () => {
  for (const s of Object.values(STORES)) {
    assert.deepEqual(s.parse(undefined, 'x'), []);
    assert.deepEqual(s.parse({}, 'x'), []);
    assert.deepEqual(s.parse({ products: [], items: [] }, 'x'), []);
  }
});

test('parse: Gold Roast product answer', () => {
  const offers = STORES['goldroast.ca'].parse(GOLDROAST_PRODUCT_ANSWER, 'chemex-natural-filter-squares-100-pack');
  assert.equal(offers.length, 1);
  const { checkedAt, ...o } = offers[0];
  assert.match(checkedAt, /^\d{4}-\d\d-\d\dT/);
  assert.deepEqual(o, {
    store: 'goldroast.ca', sku: 'chemex-natural-filter-squares-100-pack', name: 'CHEMEX Natural Filter Squares [100 Pack]', priceCents: 1600,
    regularCents: 1600, currency: 'CAD', inStock: true, url: 'https://goldroast.ca/products/chemex-natural-filter-squares-100-pack', packCount: 100,
  });
});

test('parse: Gold Roast search answer keeps every hit; a handle picks its own', () => {
  assert.equal(STORES['goldroast.ca'].parse(GOLDROAST_SEARCH_ANSWER, 'chemex filter').length, 3);
  const one = STORES['goldroast.ca'].parse(GOLDROAST_SEARCH_ANSWER, 'kalita-102-2-filters-100-pack');
  assert.deepEqual(one.map((o) => [o.sku, o.priceCents]), [['kalita-102-2-filters-100-pack', 700]]);
});

test('parse: a sale price shows as regular price above price, never below', () => {
  const sale = { items: [{ sku: 'a-b', title: 'Thing', priceCents: 900, regularCents: 1200, available: true }, { sku: 'c-d', title: 'Odd', priceCents: 900, regularCents: 100, available: false }] };
  assert.deepEqual(STORES['goldroast.ca'].parse(sale, 'x').map((o) => [o.regularCents, o.inStock]), [[1200, true], [900, false]]);
});

test('input: test store and Best Buy ask for one product', () => {
  assert.deepEqual(STORES.test.input('HV60-100'), { product: 'HV60-100', max: 1 });
  assert.deepEqual(STORES['bestbuy.ca'].input('20220310'), { product: '20220310', max: 1 });
  assert.equal(STORES.test.tool, 'shopper.checkPrice');
  assert.equal(STORES['bestbuy.ca'].tool, 'apify.checkPrice');
  assert.equal(STORES['goldroast.ca'].tool, 'apify.run');
});

test('input: Gold Roast reads a product handle or link as the .js page, and anything else as a search', () => {
  const url = (p: string) => (STORES['goldroast.ca'].input(p) as any).input.startUrls[0].url;
  const handle = 'https://goldroast.ca/products/chemex-natural-filter-squares-100-pack.js';
  assert.equal(url('chemex-natural-filter-squares-100-pack'), handle);
  assert.equal(url('https://goldroast.ca/products/chemex-natural-filter-squares-100-pack?variant=1'), handle);
  assert.equal(url('https://goldroast.ca/en/products/chemex-natural-filter-squares-100-pack'), handle);
  assert.equal(url('chemex filter'), 'https://goldroast.ca/search/suggest.json?q=chemex%20filter&resources%5Btype%5D=product&resources%5Blimit%5D=3');
  assert.match(url('chemex'), /suggest\.json\?q=chemex&/);
  assert.throws(() => STORES['goldroast.ca'].input('  '), /product is required/);
});

test('input: Gold Roast runs the limited-permission Actor, costs one cent at most, and its page function parses', () => {
  const i = STORES['goldroast.ca'].input('chemex-natural-filter-squares-100-pack') as any;
  assert.equal(i.actor, 'apify/playwright-scraper');
  assert.equal(i.maxUsd, 0.01);
  assert.equal(i.input.pageFunction, SHOPIFY_PAGE_FUNCTION);
  assert.doesNotThrow(() => new Function(`return (${SHOPIFY_PAGE_FUNCTION})`));
});

test('the page function turns Shopify JSON into one item per variant', async () => {
  const run = async (json: unknown, url = 'https://goldroast.ca/products/x.js') => {
    const page = { evaluate: async (fn: () => string) => { (globalThis as any).document = { querySelector: () => ({ textContent: JSON.stringify(json) }), body: {} }; return fn(); } };
    return new Function(`return (${SHOPIFY_PAGE_FUNCTION})`)()({ page, request: { url } });
  };
  const product = { handle: 'filter-case', title: 'Filter Case', variants: [{ id: 1, title: 'Black', price: 1400, compare_at_price: 1800, available: true }, { id: 2, title: 'White', price: 1400, compare_at_price: null, available: false }] };
  assert.deepEqual(await run(product), [
    { sku: 'filter-case:1', title: 'Filter Case - Black', url: 'https://goldroast.ca/products/filter-case', priceCents: 1400, regularCents: 1800, available: true },
    { sku: 'filter-case:2', title: 'Filter Case - White', url: 'https://goldroast.ca/products/filter-case', priceCents: 1400, regularCents: 1400, available: false },
  ]);
  const single = { handle: 'f', title: 'F', variants: [{ id: 9, title: 'Default Title', price: 1600, compare_at_price: null, available: true }] };
  assert.deepEqual(await run(single), [{ sku: 'f', title: 'F', url: 'https://goldroast.ca/products/f', priceCents: 1600, regularCents: 1600, available: true }]);
  const search = { resources: { results: { products: [{ handle: 'a-b', title: 'A B', price_min: '16.00', compare_at_price_min: '20.00', available: true }] } } };
  assert.deepEqual(await run(search, 'https://goldroast.ca/search/suggest.json?q=a'), [{ sku: 'a-b', title: 'A B', url: 'https://goldroast.ca/products/a-b', priceCents: 1600, regularCents: 2000, available: true }]);
  delete (globalThis as any).document;
});

test('every store says what it knows about automated agents, with a link, and what shipping costs', () => {
  for (const s of Object.values(STORES)) {
    assert.ok(s.agents.length > 40);
    assert.ok(s.currency === 'CAD' || s.currency === 'USD');
  }
  assert.match(STORES['goldroast.ca'].agents, /https:\/\/goldroast\.ca\/robots\.txt/);
  assert.match(STORES['bestbuy.ca'].agents, /conditions-of-use/);
  assert.match(STORES['goldroast.ca'].shipping.source!, /goldroast\.ca\/policies\/shipping-policy/);
  assert.equal(STORES['goldroast.ca'].shipping.known, true);
  assert.equal(STORES['bestbuy.ca'].shipping.known, false);
});

test('compare: the cheapest total wins and the explanation says by how much', () => {
  // Gold Roast at $20 each ships free from $75, so 4 cost $80. Best Buy sells at $22 and ships free from $35, so 4 cost $88.
  const r = compare([bby(2200), gold(2000)], 4, 5000);
  assert.equal(r.best!.store, 'goldroast.ca');
  assert.equal(r.best!.totalCents, 8000);
  assert.equal(r.best!.shippingCents, 0);
  assert.equal(r.explanation, 'Gold Roast: $80.00 for 4 with free shipping, $8.00 less than Best Buy Canada ($88.00 with free shipping). Prices are in CAD.');
});

test('compare: shipping can change the winner', () => {
  // Gold Roast is cheaper each ($16 against $18), but 4 cost $64 plus $15 shipping. Best Buy's 4 cost $72 and ship free.
  const r = compare([gold(1600), bby(1800)], 4, 5000);
  assert.equal(r.best!.store, 'bestbuy.ca');
  assert.equal(r.best!.totalCents, 7200);
  assert.deepEqual(r.rows.map((x) => [x.offer.store, x.totalCents, x.shippingCents]), [['goldroast.ca', 7900, 1500], ['bestbuy.ca', 7200, 0]]);
  assert.match(r.explanation, /^Best Buy Canada: \$72\.00 for 4 with free shipping, \$7\.00 less than Gold Roast \(\$79\.00 with \$15\.00 shipping\)\./);
});

test('compare: Gold Roast ships free at $75 and not below', () => {
  assert.equal(compare([gold(2500)], 3, 9999).best!.shippingCents, 0); // $75.00 exactly
  assert.equal(compare([gold(2499)], 3, 9999).best!.shippingCents, 1500);
});

test('compare: the same total goes to the confirmed shipping cost', () => {
  const r = compare([bby(1500, { marketplace: undefined }), gold(1500)], 5, 5000); // both $75.00, Gold Roast free, Best Buy unconfirmed
  assert.equal(r.best!.store, 'goldroast.ca');
  assert.match(r.explanation, /the same total as Best Buy Canada \(\$75\.00 before shipping, which is not confirmed\)/);
});

test('compare: unconfirmed shipping is counted as $0 and said out loud', () => {
  const r = compare([offer('bestbuy.ca', 1536, { packCount: 300 }), gold(1600, { packCount: 100 })], 1, 5000);
  assert.equal(r.best!.store, 'bestbuy.ca');
  assert.equal(r.best!.shippingKnown, false);
  assert.match(r.explanation, /^Best Buy Canada: \$15\.36 for 1 plus shipping that is not confirmed, \$15\.64 less than Gold Roast \(\$31\.00 with \$15\.00 shipping\)\./);
  assert.match(r.explanation, /The packs differ in size: Best Buy Canada has 300 per pack \(5\.1 cents each\), Gold Roast has 100 per pack \(16\.0 cents each\)\./);
});

test('compare: Best Buy under $35 is not confirmed even for its own products, over $35 it is free', () => {
  assert.equal(compare([bby(3400)], 1, 9999).best!.shippingKnown, false);
  const over = compare([bby(3500)], 1, 9999).best!;
  assert.equal(over.shippingKnown, true);
  assert.equal(over.shippingCents, 0);
});

test('compare: a Marketplace seller is never given free shipping', () => {
  const r = compare([bby(5000, { marketplace: true })], 2, 9999);
  assert.equal(r.best!.shippingKnown, false);
  assert.match(r.explanation, /plus shipping that is not confirmed/);
});

test('compare: out of stock is never chosen, and the reason is given', () => {
  const r = compare([gold(1000, { inStock: false }), bby(2000)], 1, 5000);
  assert.equal(r.best!.store, 'bestbuy.ca');
  assert.deepEqual(r.rows.map((x) => [x.ok, x.why.startsWith('out of stock') || x.ok]), [[false, true], [true, true]]);
  assert.match(r.explanation, /Not chosen: Gold Roast \(out of stock\)\./);
});

test('compare: over the limit is out, even when it is the cheapest total', () => {
  const r = compare([gold(1600), bby(1900)], 1, 1700);
  assert.equal(r.best!.store, 'goldroast.ca');
  const over = r.rows.find((x) => x.offer.store === 'bestbuy.ca')!;
  assert.equal(over.ok, false);
  assert.equal(over.why, '$19.00 each is over your limit of $17.00');
});

test('compare: nothing can be bought', () => {
  const r = compare([gold(1600, { inStock: false }), bby(1900)], 1, 1000);
  assert.equal(r.best, undefined);
  assert.equal(r.explanation, 'No store can fill this order. Gold Roast (out of stock); Best Buy Canada ($19.00 each is over your limit of $10.00).');
  assert.deepEqual(compare([], 1, 1000), { rows: [], explanation: 'No store returned a price.' });
});

test('compare: prices in different currencies are never compared', () => {
  const usd = offer('test', 500); // USD, cheapest number on the list
  const r = compare([bby(2000), usd], 1, 5000);
  assert.equal(r.best!.store, 'bestbuy.ca');
  const row = r.rows.find((x) => x.offer.store === 'test')!;
  assert.equal(row.ok, false);
  assert.equal(row.totalCents, undefined);
  assert.match(row.why, /priced in USD, not CAD/);
  // The first in-stock offer sets the currency, so with USD first the CAD offers are the odd ones out.
  const flipped = compare([usd, bby(2000)], 1, 5000);
  assert.equal(flipped.best!.store, 'test');
  assert.match(flipped.rows[1].why, /priced in CAD, not USD/);
  assert.ok(!flipped.explanation.includes('Prices are in'));
});

test('compare: the currency is set by the first in-stock offer, not an out-of-stock one', () => {
  const r = compare([offer('test', 500, { inStock: false }), gold(1600)], 1, 5000);
  assert.equal(r.best!.store, 'goldroast.ca');
});

test('compare: the test store ships free', () => {
  const r = compare([offer('test', 899)], 3, 5000);
  assert.equal(r.best!.totalCents, 2697);
  assert.equal(r.best!.shippingCents, 0);
  assert.equal(r.explanation, 'GurtOS Test Store: $26.97 for 3 with free shipping.');
});

test('compare: a bad quantity counts as 1', () => {
  assert.equal(compare([gold(1600)], 0, 5000).best!.totalCents, 3100);
  assert.equal(compare([gold(1600)], NaN, 5000).best!.totalCents, 3100);
});
