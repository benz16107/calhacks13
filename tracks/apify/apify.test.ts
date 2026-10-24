// Run: node --test tracks/apify/apify.test.ts   (offline: fetch is stubbed, Best Buy answers are fixtures)
import assert from 'node:assert/strict';
import { after, beforeEach, test } from 'node:test';
import type { Ctx, Tool } from '../../core/contract.ts';
import track, { fit, PAGE_FUNCTION, runActor } from './track.ts';

const TOKEN = 'apify_api_test_token_never_in_results';
const ctx = { key: 'k', secret: (n: string) => (n === 'APIFY_TOKEN' ? TOKEN : assert.fail(`asked for ${n}`)) } as unknown as Ctx;
const tool = (name: string) => track.tools.find((t) => t.name === name) as Tool;

const realFetch = globalThis.fetch;
after(() => void (globalThis.fetch = realFetch));
let calls: { url: URL; init: RequestInit }[] = [];
let reply: { status: number; body: unknown } = { status: 201, body: [] };
beforeEach(() => {
  calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: new URL(String(url)), init: init! });
    return new Response(JSON.stringify(reply.body), { status: reply.status });
  };
});

test('runs an Actor with the token in a header, never in the URL', async () => {
  reply = { status: 201, body: [{ a: 1 }] };
  assert.deepEqual(await runActor(ctx, 'apify/rag-web-browser', { query: 'x' }, { limit: 3 }), [{ a: 1 }]);
  const { url, init } = calls[0];
  assert.equal(url.pathname, '/v2/acts/apify~rag-web-browser/run-sync-get-dataset-items');
  assert.equal(url.searchParams.get('timeout'), '120');
  assert.equal(url.searchParams.get('limit'), '3');
  assert.ok(!String(url).includes(TOKEN));
  assert.equal((init.headers as Record<string, string>).authorization, `Bearer ${TOKEN}`);
  assert.deepEqual(JSON.parse(String(init.body)), { query: 'x' });
});

test('refuses names that are not Actors', async () => {
  for (const bad of ['../users/me', '.x/y', 'a/b/c', 'a?b', '']) await assert.rejects(runActor(ctx, bad, {}), /not an Actor name/);
  assert.equal(calls.length, 0);
});

test("passes on Apify's error message", async () => {
  reply = { status: 403, body: { error: { type: 'full-permission-actor-not-approved', message: 'This Actor requires full access.' } } };
  await assert.rejects(runActor(ctx, 'someone/thing', {}), { message: 'Apify 403: This Actor requires full access.' });
});

test('withholds a result that contains the token', async () => {
  reply = { status: 201, body: [{ env: `APIFY_TOKEN=${TOKEN}` }] };
  await assert.rejects(runActor(ctx, 'evil/echo', {}), /withheld/);
});

test('fit keeps results small enough for the log', () => {
  const items = Array.from({ length: 50 }, (_, i) => ({ i, pad: 'x'.repeat(1000) }));
  const r = fit(items);
  assert.equal(r.count, 50);
  assert.ok(r.items.length < 50 && r.truncated && JSON.stringify(r.items).length <= 20_000);
  assert.deepEqual(fit([1, 2]), { count: 2, items: [1, 2] });
  const big = fit([{ title: 'Page', markdown: 'y'.repeat(50_000) }, { title: 'Next' }]);
  assert.equal(big.items.length, 1);
  assert.equal(big.truncated, true);
  assert.equal((big.items[0] as { markdown: string }).markdown.length, 2003);
});

test('an empty token in the vault counts as no token', async () => {
  const blank = { ...ctx, secret: () => ' ' } as Ctx;
  await assert.rejects(runActor(blank, 'a/b', {}), { message: 'the vault has no APIFY_TOKEN' });
  assert.equal(calls.length, 0);
});

test('apify.run caps spending and result count', async () => {
  reply = { status: 201, body: [{ title: 'a' }] };
  const run = tool('apify.run');
  assert.equal(run.cost!({ actor: 'a/b' }), 50);
  assert.equal(run.cost!({ actor: 'a/b', maxUsd: 0.1 }), 10);
  const out = await run.run({ actor: 'a/b', input: { q: 1 }, fields: ['title', 'url'], maxItems: 500, maxUsd: 0.1 }, ctx);
  assert.deepEqual(out, { actor: 'a/b', count: 1, items: [{ title: 'a' }] });
  const q = calls[0].url.searchParams;
  assert.deepEqual([q.get('maxItems'), q.get('limit'), q.get('maxTotalChargeUsd'), q.get('fields'), q.get('clean')], ['100', '100', '0.1', 'title,url', '1']);
  await assert.rejects(run.run({}, ctx), /actor is required/);
});

test('apify.checkPrice turns a SKU, a link or words into the right Best Buy request', async () => {
  const check = tool('apify.checkPrice');
  const startUrl = async (product: string) => {
    calls = [];
    await check.run({ product, max: 2 }, ctx);
    const input = JSON.parse(String(calls[0].init.body));
    assert.equal(calls[0].url.pathname, '/v2/acts/apify~cheerio-scraper/run-sync-get-dataset-items');
    return input.startUrls[0].url;
  };
  reply = { status: 201, body: [{ sku: '1', name: 'x', price: 1, inStock: true }] };
  const product = 'https://www.bestbuy.ca/api/v2/json/product/19451577?lang=en-CA';
  assert.equal(await startUrl('19451577'), product);
  assert.equal(await startUrl('https://www.bestbuy.ca/en-ca/product/apple-airpods-pro-3/19451577'), product);
  assert.equal(await startUrl('airpods pro'), 'https://www.bestbuy.ca/api/v2/json/search?lang=en-CA&pageSize=2&query=airpods%20pro');
  await assert.rejects(check.run({ product: 'https://www.bestbuy.ca/en-ca/category/headphones/659' }, ctx), /no product SKU/);
});

test('apify.checkPrice drops hidden fields and reports a blocked store', async () => {
  const check = tool('apify.checkPrice');
  reply = { status: 201, body: [{ '#debug': { url: 's' } }, { sku: '1', name: 'Buds', price: 9, inStock: false, '#error': false, '#debug': {} }] };
  const out = (await check.run({ product: 'buds' }, ctx)) as { products: unknown[] };
  assert.deepEqual(out.products, [{ sku: '1', name: 'Buds', price: 9, inStock: false }]);
  assert.equal('notChecked' in out, false);
  reply.body = [...(reply.body as object[]), { '#error': true, '#debug': { url: 'https://www.bestbuy.ca/api/v2/json/product/2' } }];
  assert.deepEqual((await check.run({ product: 'buds' }, ctx) as { notChecked: string[] }).notChecked, ['https://www.bestbuy.ca/api/v2/json/product/2']);
  reply = { status: 201, body: [{ '#error': true, '#debug': { errorMessages: ['Request blocked - received 403 status code.'] } }] };
  await assert.rejects(check.run({ product: '19451577' }, ctx), /Best Buy did not answer Apify: Request blocked/);
});

test('the page function reads Best Buy JSON (shapes from bestbuy.ca, 2026-10-23)', async () => {
  const pageFunction = new Function(`return (${PAGE_FUNCTION})`)();
  const queued: string[] = [];
  const enqueueRequest = async (r: { url: string }) => void queued.push(r.url);
  const search = { products: [{ sku: '19451577' }, { sku: '17595430' }, { sku: '3' }] };
  assert.equal(await pageFunction({ json: search, customData: { max: 2 }, enqueueRequest }), null);
  assert.deepEqual(queued, ['19451577', '17595430'].map((s) => `https://www.bestbuy.ca/api/v2/json/product/${s}?lang=en-CA`));

  const json = {
    sku: '19451577',
    name: 'Apple AirPods Pro 3',
    regularPrice: 299.99,
    salePrice: 249.99,
    productUrl: 'https://www.bestbuy.ca/en-ca/product/apple-airpods-pro-3/19451577',
    availability: { onlineAvailability: 'InStock', onlineAvailabilityCount: 15376, inStoreAvailability: 'Available', buttonState: 'AddToCart' },
  };
  assert.deepEqual(await pageFunction({ json, customData: { max: 2 }, enqueueRequest }), {
    sku: '19451577',
    name: 'Apple AirPods Pro 3',
    price: 249.99,
    regularPrice: 299.99,
    inStock: true,
    online: 'InStock',
    onlineQuantity: 15376,
    inStores: 'Available',
    url: json.productUrl,
  });
  const stock = async (availability: object) => (await pageFunction({ json: { ...json, availability }, customData: {}, enqueueRequest })).inStock;
  assert.equal(await stock({ onlineAvailability: 'OnlineOnly', buttonState: 'AddToCart' }), true);
  assert.equal(await stock({ onlineAvailability: 'SoldOut', buttonState: 'SoldOut' }), false);
  assert.equal(await stock({ onlineAvailability: 'Preorder', buttonState: 'Preorder' }), false);
});

test('apify.findPlaces asks for a few places and returns the useful fields', async () => {
  const find = tool('apify.findPlaces');
  assert.equal(find.cost!({ query: 'q', near: 'n' }), 2);
  assert.equal(find.cost!({ query: 'q', near: 'n', max: 50 }), 4);
  reply = { status: 201, body: [{ title: 'Cafe', categoryName: 'Coffee shop', address: '1 Main St', totalScore: 4.5, reviewsCount: 10, url: 'u', temporarilyClosed: true }] };
  const out = await find.run({ query: 'coffee', near: 'Berkeley, CA', max: 2 }, ctx);
  assert.deepEqual(out, { places: [{ name: 'Cafe', category: 'Coffee shop', address: '1 Main St', rating: 4.5, reviews: 10, phone: undefined, website: undefined, url: 'u', closed: true }] });
  const input = JSON.parse(String(calls[0].init.body));
  assert.deepEqual(input, { searchStringsArray: ['coffee'], locationQuery: 'Berkeley, CA', maxCrawledPlacesPerSearch: 2, language: 'en' });
  assert.equal(calls[0].url.searchParams.get('limit'), '2');
  await assert.rejects(find.run({ query: 'coffee' }, ctx), /near is required/);
});
