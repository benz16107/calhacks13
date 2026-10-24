# Apify: agents do their web work through Actors, and the web is untrusted

Web agents today drive your logged-in browser with your accounts, read pages that may be booby-trapped, and leave
you no way to see what they spend. On GurtOS an agent has no browser, no token and no network of its own. It asks
the box for a tool, the box calls an [Apify](https://apify.com) Actor with a key from the vault, and the answer
comes back as clean data. The box counts the cost against the task's budget, checks every page for instructions
aimed at AI agents, and logs the whole call.

Best shown in **GurtOS Personal** (agents do your web errands beside you, on your own laptop, with no access to
your logged-in browser) and **GurtOS Server** (a box that watches prices and sites around the clock).

What comes from the OS and what from this track:

| The OS gives | This track adds |
|---|---|
| A separate Linux user and no network for each task, a vault no task can read, a broker that runs tools in the core | Tools that call Apify with the vault's token, so the token never reaches an agent |
| Per-task budgets, with an OK from your phone above them, and one action log | A cost estimate per Apify call, a payee and purpose on every approval, and a spend page |
| Webhooks and schedules that start tasks, and a search (/find) over the box's files | An Apify schedule that triggers a task, and crawled sites that land in search |

## The six features, and why each is here

The Apify prizes judge "meaningful use" and overall quality, and the Best Actor prize judges an Actor you publish
(its rules are not published; whether it requires Apify's AI Chat is unconfirmed, so the Actor was built with the
Apify CLI and SDK).

1. **Our own Actor, Agent-Safe Page Reader** (`actor/`). Fetches pages and returns clean text without the
   instructions hidden in them, with a risk score and the evidence. *Why:* the problem is a page that talks to the
   agent, and no existing Actor checks for that. Every page an agent reads through `apify.readPage` goes through
   it, and a high-risk page is withheld from the agent. *Criteria:* a new, useful Actor that solves a security
   problem of the OS (best Actor), and a deeper use of Apify than calling Actors others wrote (best use).
   Store page: `https://apify.com/sacrosanct_zing/agent-safe-page-reader` (see "Publishing the Actor" below).
2. **Apify's MCP server as the web toolkit, through the broker** (`apify.mcp`). The agent gets Apify's own tools
   (web search and read, Google Maps, site crawling, our page reader) without holding the token or any network.
   Four Actors and `get-actor-run` are allowed; the storage tools that can read other runs' data are not. *Why:*
   MCP is how agents expect to use Apify, and connecting an agent to `mcp.apify.com` directly puts the token in
   its session. *Criterion:* Apify's tooling used the way Apify designs it, and safely.
3. **Schedules and webhooks** (`apify.watch`, `POST /t/apify/watch`). An Apify schedule checks a product; when
   its run finishes, Apify calls the box, and the box starts a task only if the price dropped or the product came
   back in stock. *Why:* the box is always on, so it should react to the web, not only to people. *Criterion:*
   Apify's platform features (schedules, webhooks, tasks) used as a system, with the box's own webhook trigger
   starting the task.
4. **The Website Content Crawler feeds /find** (`apify.indexSite`). Crawls chosen sites and writes the pages where
   /find looks, so a question can be answered from them within a minute. *Why:* search should know the sites you
   care about. *Criterion:* a second Apify Actor in a real flow, with its output feeding another part of the OS.
5. **A web source for the credit desk** (`apify.webSource`). An applicant's website and Google Maps listing
   (with reviews) set against what they claimed, returning every place the web contradicts the application.
   *Why:* the web is evidence that does not depend on what the applicant typed. *Criterion:* Apify used for a
   decision, with untrusted text (reviews, sites) screened before the credit agent sees it. Available as a tool;
   not used in the credit desk's scored run (see below).
6. **Apify spending in GurtOS budgets.** Every tool declares its cost, so a call above the task's budget pauses
   for your OK on the phone and portal, naming Apify as the payee and the purpose. Each call also logs the
   usage Apify reports, and the Apify spend app lists both per task. *Why:* the third thing wrong with web agents
   is that nobody sees what they spend. *Criterion:* quality and trust, with cost as a first-class part of the OS.

## The tools

| Tool | What it does | Actor | Cost counted |
|---|---|---|---|
| `apify.run` | Any Actor from the Store | the agent's choice | its spending cap, default $0.10 |
| `apify.readPage` | Pages as clean text, checked for hidden instructions | Agent-Safe Page Reader (ours) | 1 cent |
| `apify.mcp` | Apify's MCP server, limited to the allowed tools | four Actors | the call's cap, default $0.10 (a list costs nothing) |
| `apify.checkPrice` | Live price and stock at Best Buy Canada | Playwright Scraper | 1 cent |
| `apify.findPlaces` | Google Maps places near a location | Google Maps Scraper | 0.4 cents a place |
| `apify.watch` | Start or stop an Apify schedule that watches a product | Playwright Scraper, on a schedule | 20 cents to start |
| `apify.crawl` | A site as clean text | Website Content Crawler | 1 cent a page |
| `apify.indexSite` | A site, written into the search folder | Website Content Crawler | 1 cent a page |
| `apify.webSource` | The web's view of a business, and where it disagrees | Website Content Crawler and Google Maps Scraper | 3 cents |

A task can use a tool only if its spec lists it. Droid sees them as MCP tools (`apify__readPage` and so on)
through the box's own relay. Counted costs are estimates from the Actors' list prices, set above a real run:
in the live demo, pages and prices cost well under a cent and Maps about 0.4 cents a place. `apify.run` is charged
what Apify reports for the run. The default cap for
`apify.run` is $0.10, not the $0.50 it started with, so a task with a small budget is not asked twice.

### Reading pages: `apify.readPage` and the Actor

```json
{ "urls": ["https://shop.example/listing"] }
```

returns, per page, `title`, `text`, `risk` (`none`, `low`, `medium`, `high`), `score` and `findings`. For a
`high` page the text is not returned, only the findings, so a hijacked agent cannot be talked into using it. The
tool's description tells the agent so, and the box enforces it. The detector is one file with no dependencies,
`actor/src/detect.js`, shared by the Actor and the box. It looks at hidden text (`display:none`, `opacity:0`, zero
size, off screen, `hidden`, `template`, `noscript`, `aria-hidden`, screen-reader-only), comments, `alt`, `title`,
`aria-label` and `<meta>` text, invisible and Unicode-tag characters, and instruction-like phrasing in hidden text
and in plain sight. Normal accessibility markup is reported only when its text reads like an instruction.
The Actor's own README (`actor/README.md`) is its Store page.

### Watching a product: `apify.watch`

```json
{ "sku": "19451577", "everyMinutes": 60 }
```

creates an Apify task, a schedule and a webhook, and `{ "sku": "19451577", "stop": true }` removes them. A watch
keeps running, and spending, until stopped. Apify calls `POST /t/apify/watch` on the box with a shared secret
(`x-gurtos-secret`). That route is open to the outside on purpose and checks the secret itself, because a paired
phone's token, the only other way in, can also answer approvals, and Apify should not hold one. The route reads
the run's dataset, drops anything that is not a product row with a real price, and makes the same decision as the
core's webhook trigger (`POST /hook/apify/watch` with `{ "rows": [...] }`, for callers on the box). A first
sighting is only remembered. A price drop or a restock starts a task that has `apify.checkPrice` and no way to
buy. It needs two vault keys: `APIFY_WEBHOOK_URL` (the box's public address, for example its remote-access
name) and `APIFY_WEBHOOK_SECRET`. Without the secret the route refuses every call, so nobody on the internet can
start a task; the rest of the track works, and `apify.watch` says which key is missing.

### The credit desk and /find

`apify.webSource` takes `{ name, near, website, claimed: { phone, address, zip, yearStarted } }` and returns the
website excerpt, the Google Maps place, recent reviews, and `disagreements`: a phone or address that does not
match, a start year that differs from the website's "since", a business Google marks closed, or no web presence
at all. Reviews and site text are untrusted: an instruction inside a review is cut out before the credit agent
sees it. The tool is available to the credit desk but is not in its analyst's tool list, so it was not used in
the scored run: the desk's applicants are made-up businesses, and a web check on them would only report "no web
presence". It is meant for a case with real-looking businesses. `apify.indexSite` writes pages to
`workspaces/web/web/<site>/` as Markdown, mode 644. /find already rescans every minute and after every finished
task, so find needed no change.

### The other tools

`apify.run` takes `{ actor, input, fields, maxItems, maxUsd }`; the cap goes to Apify as `maxTotalChargeUsd`, with
a 120-second run timeout. A call returns at most 20,000 characters, because every result goes into the action
log; if the first result alone is bigger it comes back with long text cut to 2,000 characters and `truncated`
set. `apify.checkPrice` takes a Best Buy SKU, a bestbuy.ca link or search words, and returns `inStock` (Best Buy
shows "Add to cart"), `online`, `inStores`, `price` and `regularPrice` in CAD. A product Best Buy did not answer
for is listed in `notChecked`, so a watcher can tell "not found" from "not checked". `apify.findPlaces` takes
`{ query, near, max }`.

**For the Visa shopper:** pass a SKU once you know it (`{ "product": "19451577" }`). Watch `inStock` and `price`.
Treat a product in `notChecked`, or a failed call, as "try again later", not as sold out. Changes to this tool:
- 2026-10-23: the Actor behind it changed from Cheerio Scraper to Playwright Scraper. Input and output did not change.
- 2026-10-24: runs go through Apify's run endpoint instead of run-and-wait, so each call logs the usage Apify
  reports. Input and output did not change. `apify.run`'s default cap is $0.10, not $0.50.

## Which Actors, and why

- **Agent-Safe Page Reader** (ours) for reading pages: see above.
- **Playwright Scraper** (by Apify) for Best Buy. Best Buy Canada serves its product data as open JSON
  (`bestbuy.ca/api/v2/json/product/<sku>` has price and stock in one answer). The Actor opens it in a browser on
  Apify's servers, through Apify Proxy, and a small page function keeps the useful fields. A search plus two
  products took 12 seconds and cost $0.0016. We first used Cheerio Scraper, which is lighter, but it needs full
  access to the Apify account, so Apify refused it with a 403 until a person approves it. Approving it would let
  a hijacked agent run its own page code with account access through `apify.run`. Our tools use only Actors with
  limited permissions.
- **Google Maps Scraper** (by Compass), the most used Actor in the Store (about 45,000 users a month), at $0.004
  a place with no start fee. It refuses a run cap under $0.50, so the place count keeps a run small. Every paid
  extra stays off.
- **Website Content Crawler** (by Apify) in its plain-HTTP mode, with a depth of 1 and a page limit.
- **Any Actor** through `apify.run`. For other stores,
  [`apify/e-commerce-scraping-tool`](https://apify.com/apify/e-commerce-scraping-tool) covers bestbuy.com,
  Walmart, Target and about 200 more. On a bestbuy.ca product it returned the price in 10 seconds for $0.0061 but
  no stock, which is why the restock watcher reads Best Buy's own JSON.

We left out Amazon (it refuses AI agents) and Best Buy US (bestbuy.com drops plain requests; the E-commerce tool
reaches it through Apify's unblocking proxy).

## Why a hijacked agent cannot misuse it

Moment 2 shows an agent reading a page with hidden instructions that try to steal keys. With these tools:

- **The token is never in the task.** Not in its files, environment or network, and a tool refuses to return a
  result that contains it. The demo checks the log for it.
- **An Actor never gets the token either.** Apify starts each run with its own short-lived token. Actors with
  limited permissions, Apify's default, reach only that run's own storage. An Actor that wants full access fails
  with a 403 until a person approves it in the Console, and the API cannot approve it. `apify.mcp` allows four
  named Actors and no storage tools.
- **The page is data.** `apify.readPage` flags hidden instructions and withholds high-risk pages. Reviews and
  crawled text get the same check. The agent still has no network and no secrets to act on a page with.
- **Spending is capped twice.** Apify holds a run to `maxTotalChargeUsd` and a timeout, and the box asks for an
  OK before any call above the task's budget, naming Apify and the purpose.
- **Apify cannot approve anything.** Its webhook comes in on a route with its own secret, not a paired phone's token.

## Setup

1. Sign up at [apify.com](https://apify.com) and copy the token from Settings, API & Integrations.
2. On each test VM: `echo 'APIFY_TOKEN=apify_api_...' | sudo tee -a /etc/box/vault.env` (root only, `chmod 600`).
3. For `apify.watch`, also `APIFY_WEBHOOK_URL` and `APIFY_WEBHOOK_SECRET` (any long random string). Both are optional.

### Publishing the Actor

`cd tracks/apify/actor && apify login && apify push` builds it in the Apify account. The CLI keeps its login in
`~/.apify`, so use a throwaway `HOME` on a shared machine. Apify only lets an Actor go public when the account has
a public profile, which is a Console setting (Settings, Account, public profile) that the API cannot change.
Once it is on: `curl -X PUT https://api.apify.com/v2/acts/<actor id> -H "Authorization: Bearer $APIFY_TOKEN"
-H 'content-type: application/json' -d '{"isPublic":true}'`. Until then `apify.readPage` works with the owner's
token, which is the box's.

## The demo step

`./demo` runs `demo.ts` after the four moments. By default it stays offline, so every thread's merge gate stays
fast and spends nothing. It checks that all nine tools loaded, runs the unit tests against a stubbed Apify
(`node --test tracks/apify/*.test.ts` runs them anywhere), shows a price drop reaching the core's webhook trigger
and starting a task (and no change starting none), shows the route Apify calls refusing a call without the
secret, and, with no token in the vault, shows a tool refusing to run.

`DEMO_LIVE=apify ./demo` also makes live calls from tasks with no network: a Best Buy price, Google Maps places,
our Actor reading a normal page and a booby-trapped one (flagged high, withheld), the same Actor through Apify's
MCP server, and the crawler writing a page that /find then answers a question from. It checks the token is nowhere
in the logs and that the spend page has Apify's usage. It costs a few cents and takes a few minutes, longer when
the test VM is busy. Run it before merging a change to this folder.

### Live calls in the merge gate: the convention for every track

A track's demo step must not make paid or slow live calls unless asked, because `./demo` is everyone's merge
gate. `DEMO_LIVE` is a comma-separated list of track names (`DEMO_LIVE=apify,visa ./demo`), and `./demo` passes it
to the test machine. In your `demo.ts`:

```ts
const live = (process.env.DEMO_LIVE ?? '').split(/[\s,]+/).includes('<your track>');
if (!live) { /* offline checks */ console.log('  skip  live calls: DEMO_LIVE=<your track> ./demo runs them'); return; }
```

## Limits

- `apify.checkPrice` and `apify.watch` cover Best Buy Canada only, with prices in CAD.
- The detector reads inline styles and attributes, not stylesheets, and does not run JavaScript. A page that hides
  text with a class defined in a stylesheet can pass, and a rephrased attack can avoid the phrase list. `none`
  means nothing found, not safe. The agent should still run with no secrets and a limited network.
- Approval and the budget check use a call's estimate. `apify.run` then reports the run's real cost from Apify
  (`spentCents`, never above the cap), and that is what the task is charged. The other tools are charged their
  estimate, which is set above a real run.
- `apify.mcp` cannot cap a call's spend on Apify's side (its tools take no cap); the call's estimate and a
  45-second wait limit bound it.
- Apify's run endpoint takes no idempotency key. A call cut off by a power cut starts a new run when the task
  resumes. These tools only read the web, so the cost is one more small run.
- A watch keeps spending until stopped. Apify's account limits are the backstop.
