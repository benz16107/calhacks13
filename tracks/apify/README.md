# Apify track: web work through Actors, with no secrets in the task

Agents on the box do their web work through [Apify](https://apify.com) Actors instead of driving a browser
and reading screenshots. An agent asks for "the price of AirPods Pro at Best Buy" or "coffee near Berkeley"
and gets clean JSON back.

The agent never holds the Apify token. Each task runs as its own Linux user with no network beyond the hosts
it was given, usually none. It calls a tool by name through its broker socket. The tool runs inside the box's
core, reads `APIFY_TOKEN` from the vault (`/etc/box/vault.env`, root only), calls Apify's API and hands back
only the results. The call, its result and its cost go into the action log.

## The tools

| Tool | What it does | Actor it runs | Cost counted |
|---|---|---|---|
| `apify.run` | Runs any Actor from the Apify Store with an input and returns its results | Whatever the agent picks | The spending cap it sets, default $0.50 |
| `apify.checkPrice` | Live price and stock of a product at Best Buy Canada | [`apify/playwright-scraper`](https://apify.com/apify/playwright-scraper) | 1 cent |
| `apify.findPlaces` | Places on Google Maps near a location | [`compass/crawler-google-places`](https://apify.com/compass/crawler-google-places) | 0.4 cents a place |

Droid, the worker in every task, sees these as MCP tools (`apify__run`, `apify__checkPrice`,
`apify__findPlaces`) through the box's own MCP relay. A task can use a tool only if its spec lists it.

### `apify.run`: any Actor

```json
{ "actor": "apify/rag-web-browser", "input": { "query": "cal hacks 13 schedule", "maxResults": 3 },
  "fields": ["metadata", "markdown"], "maxItems": 3, "maxUsd": 0.2 }
```

Returns `{ actor, count, items, truncated? }`. It passes `maxUsd` to Apify as `maxTotalChargeUsd`, the run's spending
limit, which Apify's docs say covers every pricing model. The 120-second timeout also bounds Actors that bill
by compute. The box counts that cap against the task's budget before the run starts. Above
the budget, the task pauses and asks for an OK on the portal and the phone (moment 3). `maxItems` (default 20,
at most 100) limits how many results come back and how many a pay-per-result Actor may charge for. A call
returns at most 20,000 characters of JSON, because every result goes into the action log. If the first result
alone is bigger, it comes back with each long text cut to 2,000 characters, and `truncated` is set.

### `apify.checkPrice`: price and stock at Best Buy

```json
{ "product": "airpods pro", "max": 2 }
```

`product` is a Best Buy SKU (`19451577`), a bestbuy.ca product link, or search words. It returns:

```json
{ "store": "bestbuy.ca", "currency": "CAD", "checkedAt": "2026-10-24T02:10:00.000Z",
  "products": [{ "sku": "19451577", "name": "Apple AirPods Pro 3 ...", "price": 299.99, "regularPrice": 299.99,
                 "inStock": true, "online": "InStock", "onlineQuantity": 15376, "inStores": "Available",
                 "url": "https://www.bestbuy.ca/en-ca/product/.../19451577" }] }
```

`inStock` is true when Best Buy shows "Add to cart" online. The other states are "Sold out" and "Preorder".
`online` is Best Buy's own status, and an `OnlineOnly` item can be in stock. `inStores` is the in-store status.
If Best Buy did not answer for some products of a search, their addresses are in `notChecked`, so a watcher
can tell "not found" from "not checked". If it answered for none, the call fails.

This is the check the Visa shopping agent repeats to watch for a restock or a price drop: it compares `price`
with what you are willing to pay, and buys within budget after your tap.

**For the Visa shopper:** pass the SKU once you know it (`{ "product": "19451577" }`). That is one product page,
with no search. Watch `inStock` and `price`. Treat a product listed in `notChecked`, or a failed call, as
"try again later", not as sold out. Changes to this tool are listed here:
- 2026-10-23: the Actor behind it changed from Cheerio Scraper to Playwright Scraper. Input and output did not change.

### `apify.findPlaces`: Google Maps

```json
{ "query": "bike repair", "near": "Berkeley, CA", "max": 5 }
```

Returns `{ places: [{ name, category, address, rating, reviews, phone, website, url, closed? }] }`.

## Which Actors, and why

- **Playwright Scraper** (by Apify) for Best Buy. Best Buy Canada serves its product data as open JSON
  (`bestbuy.ca/api/v2/json/product/<sku>` has the price and stock in one answer). The Actor opens it in a
  browser on Apify's servers, through Apify Proxy, and a small page function keeps only the useful fields.
  For a search, the page function queues each hit's product page, because only that page says whether it is
  in stock. On 2026-10-23 a search plus two products took 12 seconds and cost $0.0016 in compute, well under
  the 1 cent the box counts. We first used Cheerio Scraper, which is lighter, but it needs full access to the
  Apify account, so Apify refused it with a 403 until a person approves it. Approving it would let a hijacked
  agent send it its own page code through `apify.run`. Playwright Scraper also runs page code, but with
  limited permissions.
- **Google Maps Scraper** (by Compass) for places. It is the most used Actor in the Apify Store, about
  45,000 users a month, and it charges $0.004 a place on the free plan with no start fee. The tool leaves
  every paid extra off, and asks Apify for only the ten fields it returns.
- **Any Actor** through `apify.run`, so an agent is not limited to what we wrapped. For other stores,
  [`apify/e-commerce-scraping-tool`](https://apify.com/apify/e-commerce-scraping-tool) covers bestbuy.com,
  Walmart, Target, Newegg, Costco and about 200 more. On a bestbuy.ca product it returned the price in 10
  seconds for $0.0061, but no stock, which is why the restock watcher reads Best Buy's own JSON.

We left out:
- **Amazon.** It refuses AI agents, so the box does not shop there.
- **Best Buy US.** bestbuy.com drops plain requests (no answer in 15 seconds from our test machine). The
  E-commerce Scraping Tool above reaches it through Apify's unblocking proxy.
- **Apify's hosted MCP server.** An agent connected to `mcp.apify.com` has to hold the token in its own
  session. Here the token stays in the core, and the box's MCP relay gives Droid the same kind of tools.

## Why a hijacked agent cannot misuse it

Moment 2 shows an agent reading a page with hidden instructions that try to steal keys. With these tools:

- **The token is never in the task.** It is not in the task's files, environment or network, and the tool
  refuses to return a result that contains it. The demo checks the log for it.
- **An Actor never gets the token either.** Apify starts each run with its own short-lived token. Actors
  with limited permissions, Apify's default, can reach only that run's own storage. An Actor that wants full
  access to the account fails with a 403 until a person approves it in Apify Console, and the API cannot
  approve it. So `apify.run` on a hostile Actor cannot read Ben's account. Our own tools use only Actors
  with limited permissions, so the account never needs that approval.
- **Spending is capped twice.** Apify holds a run to `maxTotalChargeUsd` and a 120-second timeout, and
  the box asks for an OK before any call above the task's budget.
- **Results are data.** A scraped page may carry instructions, but the agent's task still has no network
  and no secrets to act on them with.

## Setup

1. Sign up free at [apify.com](https://apify.com). The free plan includes $5 of usage a month.
2. Copy the token from Apify Console, Settings, API & Integrations.
3. On each test VM: `echo 'APIFY_TOKEN=apify_api_...' | sudo tee -a /etc/box/vault.env`. The file must stay
   root only (`chmod 600`).

You can also make a scoped token there ("Limit token permissions"): allow running Actors and reading their
datasets, and set Actor runs to restricted access.

## The demo step

`./demo` runs `demo.ts` after the four moments. By default it stays offline, so every thread's merge gate
stays fast and spends nothing:

- The box loaded the three tools.
- The unit tests pass against a stubbed Apify (`node --test tracks/apify/apify.test.ts` runs them anywhere).
- With no token in the vault, the tool refuses with "the vault has no APIFY_TOKEN".

`DEMO_LIVE=apify ./demo` also makes the live calls. It starts two tasks with the fake worker and no network:
one checks AirPods Pro at Best Buy, the other finds two coffee shops near Berkeley. Both Actors run on Apify
at the same time. It checks the results have a real price, a stock answer and real places, that the token
is nowhere in either task's log, and that each task's cost was counted. A live run spends about one cent
and adds about 15 seconds. Run it before merging a change to this folder.

On 2026-10-23 the live run passed on the linuxbox VM (x86) and the laptop VM (ARM64): AirPods Pro 3 at $299.99 CAD, in stock, and Cole Coffee
Café at 6255 College Ave, Oakland.

### Live calls in the merge gate: the convention for every track

A track's demo step must not make paid or slow live calls unless asked, because `./demo` is everyone's
merge gate. `DEMO_LIVE` is a comma-separated list of track names (`DEMO_LIVE=apify,visa ./demo`), and
`./demo` passes it to the test machine. In your `demo.ts`:

```ts
const live = (process.env.DEMO_LIVE ?? '').split(/[\s,]+/).includes('<your track>');
if (!live) { /* offline checks */ console.log('  skip  live calls: DEMO_LIVE=<your track> ./demo runs them'); return; }
```

## Limits

- `apify.checkPrice` covers Best Buy Canada only, with prices in CAD.
- Counted costs are estimates from the Actors' list prices on the free plan, not Apify's bill. For
  `apify.run` the box counts the full cap.
- Apify's synchronous run endpoint waits at most 300 seconds. Each tool sets its own Actor timeout below
  that: 90 seconds for prices, 120 for places and other Actors.
- Apify's run endpoint takes no idempotency key. A call cut off by a power cut starts a new run when the
  task resumes. These tools only read the web, so the only cost is one more small run.
