---
title: Apps
description: The apps in the GurtOS source tree, with the title and description each shows in App Center, what each adds, which need an outside account, and which are test only.
---

Each app is a folder under `tracks/` with a `track.ts`. The box reads every app at boot but turns on only the ones the owner has chosen. **A new box has only the model app, Claude (`anthropic`), on.** Every other app is off until the owner turns it on in App Center or through the API: `GET /api/apps?all=1` lists them all with what each can reach, and `POST /api/apps/<id>/enable` and `/disable` switch one without a reinstall (see [HTTP API](/docs/reference/http-api/#setup-settings-apps-and-the-vault)). An app can be turned on with vault keys missing. The parts that need a key report that it is missing. An app's page runs sandboxed in its window, with a token that reaches only that app's routes. To write your own app, see the [App SDK](/docs/reference/app-sdk/).

:::note[Test money]
App Center marks an app **Test only** when its title or description says it uses test money, test payments, test data, a sandbox or a devnet. Five apps carry that mark: Example, Credit desk, ASI:One, Shopper and Wallet. The shopper uses Stripe test mode, a Cybersource sandbox or a simulated charge. The wallet pays USDC on Solana devnet, which has no value. ASI:One pays with test tokens on the Fetch.ai testnet. The Example app's `example.spend` moves no money at all.
:::

## Core apps

You need none of an outside service's accounts for these, apart from the model key. The title and description are what App Center shows.

| App | Title | Description |
|---|---|---|
| `anthropic` | Claude | The AI model every agent uses, through Factory's Droid. Needs an Anthropic or a Factory API key, which stays in the vault. |
| `factory` | Factory | Turns GitHub issues labelled droid into pull requests: Droid plans, you approve the plan, a reviewer droid checks the change. Needs a GitHub token and a repository name; a Factory key shows your plan usage. |
| `spacetime` | Live board | Shows tasks, requests and spending on every screen as they change, and lets agents share one work queue. Needs no account; an optional fleet view that sends task counts to SpacetimeDB Maincloud is off until you turn it on. |
| `armadin` | Attack tests | Runs known attacks on AI agents against this computer, like a poisoned package or a hijacked payment, and shows which ones GurtOS stopped. |
| `find` | Find | Search your files, past tasks and notes on this computer by their words, with no account. A photo is searchable once a vision model describes it (your own Ollama, or a Vultr or Factory key), and a Moss account adds search by meaning. |
| `example` | Example | A sample app for developers that shows every way an app can plug into GurtOS. It spends test money only. |

### `anthropic`

The model behind every agent task. The app has no tools, routes or window. The model choice, the prices and the second look at risky steps are in `core/`, and `tracks/anthropic/demo.ts` is the measured attack test. A task takes `haiku`, `sonnet` (the default, `claude-sonnet-5-5`), `opus` or a model id that starts with `claude-`. Setup asks for one key, an Anthropic key or a Factory key. With both, the box uses Factory's. The box's proxy puts the key on a model call on the way out, and a task never holds it. With a Factory key it relays only the Factory paths Droid calls (models, Droid's own settings and limits, its session copy and telemetry). Any other Factory path, such as running a Factory-hosted connector's tool, is refused with 403 and logged as `net.blocked`. A model call that asks the model service, Factory's or Anthropic's, to fetch a URL, an MCP server or a file for the task is refused the same way. `tracks/anthropic/install.sh` turns an Ubuntu 24.04 machine into a GurtOS box.

### `factory`

Coding jobs for Factory's Droid.

| Slot | What |
|---|---|
| Tools | `factory.openPullRequest {title, body}`: opens a pull request with the changes in the task's copy. Only a task started from a GitHub issue can use it. |
| Triggers | `github`: every 2 minutes (`FACTORY_GITHUB_EVERY_MS`) checks the repository for open issues labelled `droid` and starts a task for each new one |
| Routes | `GET /t/factory/`. `POST /t/factory/run`: a `droid exec` job on a copy of a repository or of the files you send. `GET /t/factory/github` and `POST /t/factory/github/check`. `GET /t/factory/usage`: each task's Factory credits and your plan's limits. |
| Portal | Factory |
| Vault keys | `GITHUB_TOKEN`, `FACTORY_GITHUB_REPO`, `FACTORY_API_KEY`, all optional |

### `spacetime`

Live state from the box's own SpacetimeDB, and a shared work queue for agents. It needs no account.

| Slot | What |
|---|---|
| Tools | `spacetime.post {queue, jobs}`: puts up to 200 jobs on a queue. `spacetime.claim`: takes the oldest open job in one step. `spacetime.finish {id, result, ok?}`: reports a claimed job. `spacetime.team {queue}`: who is working on a queue and what each agent is doing. |
| Triggers | `fleet`: the optional fleet view |
| Log readers | `jobs` |
| Routes | `GET /t/spacetime/` and `GET /t/spacetime/live.js`: the window. `GET /t/spacetime/team`, `GET /t/spacetime/snapshot`, `POST /t/spacetime/jobs`, `GET /t/spacetime/where`. `GET` and `PUT /t/spacetime/fleet`, and `POST /t/spacetime/fleet/viewers`: the owner turns the fleet view on and lets a viewer see it. |
| Portal | Live board |

The fleet view is off by default. When the owner turns it on, the box reports its id, name, edition, version, task counts, today's spending and whether it is online to a `gurtos-fleet` database on SpacetimeDB Maincloud that the GurtOS project runs. It sends no prompt, file, request text or key. `BOX_FLEET_DB` and `BOX_FLEET_URL` point it at a database of your own.

### `armadin`

Attacks on agents, run by `./demo`. The app has no tools, routes or window. Its step runs a poisoned package, a hijacked payment and a scoreboard of 16 OS-level attacks, of which 15 are caught and 1 is published as not covered. See [The test suite](/docs/reference/test-suite/#the-attack-tests).

### `find`

Searches files, photos, finished tasks and notes the owner chose to remember. Every key is optional: the word index runs with none.

| Slot | What |
|---|---|
| Tools | `find.search`: search, for tasks. `find.answer` and `find.answerFast`: a one or two sentence answer from the notes. `find.recall`: notes from earlier tasks. `find.remember`: saves a note. |
| Model jobs | `find.describe {file}`: describes one photo in a workspace. `find.preferences`: the owner's standing preferences as sentences. |
| Triggers | `index`: makes the `photos` workspace with test photos, then rescans every minute |
| Log readers | `tasks`: indexes tasks as they finish, fail or are undone |
| Routes | `GET /t/find/`, `GET /t/find/search?q=&kind=&k=`, `GET /t/find/file?workspace=&path=`, `GET /t/find/status`, `GET /t/find/answer`, and POST routes for `warm`, `describe`, `memory`, `trust`, `forget` and `inference` |
| Portal | Find |
| Vault keys | `MOSS_PROJECT_ID`, `MOSS_PROJECT_KEY`, `MOSS_INFERENCE_API_KEY`, `MOSS_INFERENCE_URL`, `VULTR_INFERENCE_KEY`, `FIND_OLLAMA_URL`, `FIND_OLLAMA_MODEL`, `FACTORY_API_KEY`, all optional |

Moss is not part of GurtOS. Its licence does not allow passing it on, so images and `core/install.sh` leave it out. On a box set up from source, the owner can install it by hand (`tracks/find/README.md` has the command). Without it, a box that has Moss keys logs "Moss is not installed on this computer" and keeps searching by words.

Find also gives each new task a few relevant notes from earlier tasks, through the app's `taskContext` hook. A model runs only when its key is set in the vault. Claude, through a Droid task, runs only when the owner presses **Describe with Claude** on the Find page. Photos stay on the box unless the owner sets a hosted model's key or presses that button. Any task given `find.search` can search every workspace, not only its own. The cloud copy of the index is off unless the box runs with `FIND_CLOUD_SYNC=1`. See [Search your files](/docs/guides/find/).

### `example`

The reference app. It uses every slot so you can copy the part you need. A GurtOS image does not load it; a source checkout does.

| Slot | What |
|---|---|
| Tools | `example.spend {cents, on}`: records a test spend. Costs `cents`, so it pauses over budget. No money moves. |
| Triggers | `webhook` named `start`, `onFileChange` on `BOX_HOME/inbox/example`, and an hourly `schedule` |
| Routes | `GET /t/example/`, `GET /t/example/whoami`, `GET /t/example/secret-check`, `POST /t/example/start` |
| Log readers | `count`: counts finished tasks |
| Model jobs | `example.echo` |
| Portal | Example |
| Vault keys | `DEMO_SECRET` |

## Optional apps

These work with an outside service, and most need an account with it. A first-time user needs none of them. They are all off on a new box. The **Test only** column matches the badge in App Center.

| App | Title | Test only | Description |
|---|---|---|---|
| `apify` | Apify | | Lets agents read web pages, check prices and stock, and find places through Apify, without ever holding a browser or a key. Needs an Apify account. |
| `credit-desk` | Credit desk | Yes | Agents review credit applications and supplier bills for a made-up company, on test data, and a person approves every decision. Needs a Stitch Credit sandbox login and a Nessie test-bank key. |
| `elastic` | Ask GurtOS | | Keeps a copy of the action log in Elastic that this computer can't change, and answers questions like "what did my agents do yesterday?" Needs an Elastic Cloud Serverless project. |
| `fetch` | ASI:One | Yes | Give GurtOS jobs from an ASI:One chat and let it hire other agents on Fetch.ai's network, paid with test money (the Fetch.ai testnet). Needs Agentverse and ASI:One keys. |
| `jira` | Jira | | Send Jira issues to agents, see every agent action in Jira, and roll back the ones that were wrong. Needs an Atlassian site, email and API token. |
| `mana` | Mana | | Lets apps built in Mana ask this computer for work, with your OK first, and turns on a public status page of task titles and states. Needs a Mana account. |
| `receipts` | Receipts | | Makes a signed receipt for a finished task that anyone can check in a browser, with no account. With an Elastic account it also compares the log with Elastic's copy. |
| `shopper` | Shopper (test payments) | Yes | Shops for you: compares stores, asks before every purchase and can undo an order, and never sees your card. Test payments only. |
| `vultr` | Vultr cloud | | Backs up this computer, encrypted, to Vultr Object Storage, and sets the Vultr cloud firewall when GurtOS runs on Vultr. Needs a Vultr account and an age key for the backups. |
| `wallet` | Wallet (test money) | Yes | Lets agents pay with test money (USDC on Solana devnet, which has no value), within a limit you set, and asks you above it. Needs a devnet wallet key; Coinbase keys are optional. |

An app's window can be titled differently from the app. The portal calls the `wallet` window "Agent wallet (Solana devnet, test money)".

### `apify`

Agents do web work through [Apify](https://apify.com) Actors and get JSON back. The task never holds the Apify token.

| Slot | What |
|---|---|
| Tools | `apify.run {actor, input, fields?, maxItems?, maxUsd?}`: runs any Actor and counts its spending cap (default $0.10). `apify.readPage`: a page as clean text, counts 1 cent. `apify.mcp`: Apify's own tool server through the box, counts the cap when it calls a tool. `apify.checkPrice`: price and stock of a product at Best Buy Canada, counts 1 cent. `apify.findPlaces`: places on Google Maps near a location, counts 0.4 cents a place. `apify.watch`: an Apify schedule that calls the box when a price or stock changes, counts 20 cents. `apify.crawl` and `apify.indexSite`: crawl a site (1 to 10 pages), and add its pages to Find's search. `apify.webSource`: what a business's website and Google Maps listing say, counts 3 cents. |
| Triggers | `workspace` makes the `apify` workspace. `watch` is a webhook, `POST /hook/apify/watch {rows}`, for callers on the box or a paired phone. |
| Log readers | `spend`: what each task's Apify calls were counted at, and what Apify says they cost |
| Routes | `GET /t/apify/` and `GET /t/apify/spend`. `POST /t/apify/watch` is open to Apify's call and checks the `x-gurtos-secret` header. |
| Portal | Apify |
| Vault keys | `APIFY_TOKEN`. `APIFY_WEBHOOK_URL` and `APIFY_WEBHOOK_SECRET` are optional. |

Droid sees these tools as `apify__run`, `apify__readPage` and so on.

### `credit-desk`

A sample finance app for a made-up wholesaler, on test data. Seats such as a credit analyst, a collections clerk and an accounts payable clerk each run as their own task and follow a rules file. The tools refuse a decision that cites a rule id the file does not have, and enforce which seat may record what.

| Slot | What |
|---|---|
| Tools | `credit-desk.crs`: credit, identity and fraud checks. `credit-desk.crs_lookup` and `credit-desk.crs_docs`: re-open one record, and read the credit bureau's documentation. `credit-desk.bank`: reads the bank sandbox. `credit-desk.flag`: records a problem with the rules it breaks. `credit-desk.credit_decision` (analyst) and `credit-desk.collections_action` (clerk). `credit-desk.enter_bill`, `credit-desk.pay_bill` and `credit-desk.ap_action` (accounts payable). `credit-desk.post_entry`: posts a Beancount journal entry to the company's books. `credit-desk.history`: what the desk decided before about a customer. `credit-desk.review`: records the review of an existing customer's credit. |
| Triggers | `nightly-recheck`: a 02:00 re-check of existing customers, off until someone switches it on |
| Model jobs | `credit-desk.kya` and `credit-desk.guest_application`, used by the Mana app's guest path |
| Routes | `POST /t/credit-desk/run`: starts the seats on a case. `POST /t/credit-desk/score {run}`: scores a run against its answer key. `GET /t/credit-desk/runs`, `GET /t/credit-desk/recheck`, `POST /t/credit-desk/recheck`, and the window's own routes (`state`, `rules`, `why`, `books`, `reason`, `upload`, `application`, `templates`, `impact`, `letter`) |
| Portal | Credit desk |
| Vault keys | `CRS_USERNAME`, `CRS_PASSWORD` (credit bureau sandbox), `NESSIE_API_KEY` (bank sandbox) |

Decisions above a seat's authority, fraud holds and anything the rules send to a person come back as a question, and the seat asks for an OK.

### `elastic`

Streams the action log into an Elastic Cloud Serverless project that the box's key can add to but not change, and installs an Elastic Agent Builder agent that answers questions such as "what did my agents change this week?".

| Slot | What |
|---|---|
| Log readers | `chain`: turns each event into a document with its hash and appends it to `BOX_HOME/elastic/outbox.ndjson`. `act`: does what an owner-approved request from Elastic asks, such as undoing a task. |
| Model jobs | `elastic.bulk`: sends the outbox in `_bulk` batches, and is the only code that reads the box's Elastic key |
| Triggers | `integrity`: every 10 minutes (`ELASTIC_VERIFY_MS`) compares the box's log with Elastic's copy and writes the answer into the log. `requests`: every 5 seconds reads undo requests from the Elastic agent. Both run only on an installed box, or with `DEMO_LIVE=elastic`. |
| Routes | `GET /t/elastic/`, `GET /t/elastic/verify`, `POST /t/elastic/ask` |
| Portal | Ask GurtOS |
| Vault keys | `ELASTIC_URL`, `ELASTIC_BOX_KEY`, `ELASTIC_BOX_LABEL`, `ELASTIC_ASK_KEYS`, `KIBANA_URL`. The agent installer, `tracks/elastic/agent.ts`, reads `KIBANA_URL`, `ELASTIC_URL` and `ELASTIC_API_KEY` from its own environment. |

An installed box ships its log. A development box does not, unless `DEMO_LIVE=elastic` is set. See [Send the log to Elastic](/docs/guides/send-the-log-to-elastic/).

### `fetch`

Makes the box an agent on Agentverse, so you can give it work from an ASI:One chat, approve spending with a card, and keep or undo the result. Payments use test tokens on the Fetch.ai testnet.

| Slot | What |
|---|---|
| Tools | `fetch.pay {to, amount, reference, why}`: pays another agent in test FET on Fetch.ai's Dorado testnet, at most 5 FET a payment |
| Triggers | `asi1`: makes the `project` and `guest` workspaces and starts the chat agent if it is switched on |
| Routes | `GET /t/fetch/`: the agent's address and pairing code. `GET /t/fetch/agent` and `POST /t/fetch/agent {on}`: its status, and switching it on or off. `GET /t/fetch/wallet`, `POST /t/fetch/pay/verify` and `POST /t/fetch/note`, which the agents call. |
| Portal | ASI:One |
| Vault keys | `AGENTVERSE_API_KEY`, `ASI_ONE_API_KEY`. Chat tasks use Droid (`FACTORY_API_KEY`) and, for web searches, `APIFY_TOKEN`. |

The chat agent runs as the unprivileged user `nobody` and uses only the box's HTTP API. Its state is in `BOX_HOME/fetch/`. See [Reach GurtOS from ASI:One](/docs/guides/asi-one/).

### `jira`

Writes every task to a Jira issue: the prompt, the approvals, blocked attempts, the diff, the cost and the log. A Forge app adds a panel to those issues with Approve, Deny and Roll back.

| Slot | What |
|---|---|
| Triggers | `jsm`: every 10 seconds, opens Jira Service Management requests for approvals. `confluence`: a daily Confluence page, checked every 15 minutes. |
| Log readers | `issues`: creates and updates one issue per task. `jsm`: opens a request when an approval is asked and closes it when answered. `incidents`: an incident page for a blocked attempt. |
| Routes | `GET /t/jira/task`, `POST /t/jira/answer`, `POST /t/jira/undo`, `POST /t/jira/undo-many`, `GET /t/jira/activity`, `POST /t/jira/pause`, `POST /t/jira/start`, `POST /t/jira/report`. Each needs the shared secret as a bearer token. The app lists them in `openRoutes`, so they need no paired device's token. |
| Vault keys | `ATLASSIAN_SITE`, `ATLASSIAN_EMAIL`, `ATLASSIAN_API_TOKEN`, `JIRA_BOX_SECRET` |

It writes nothing to Jira until `BOX_HOME/jira/config.json` exists. See [Connect Jira](/docs/guides/connect-jira/).

### `mana`

Lets apps built in Mana reach this box through its public address. Every public route returns no prompt, tool call, log line or secret.

| Slot | What |
|---|---|
| Routes | `GET /t/mana/status`: counts of tasks in each state, total cost, the active and recent tasks with their titles, states, latest step and cost, and the questions waiting for an OK. It allows any origin. `POST /t/mana/guest`, `GET /t/mana/guest`: a guest's request for work, which the owner approves first. `POST /t/mana/policy`, `GET /t/mana/policy`: a GurtOS Business rule drafted in Mana, applied only after an owner or an admin approves it. Each also answers `OPTIONS`. |
| Triggers | `guest-expiry`: a guest request or rule change nobody answers within 30 minutes lapses |
| Log readers | One for guest requests and one for rule changes |
| Vault keys | none |

The app lists all seven routes in `openRoutes`, so they need no paired device's token. Turning Mana on makes the status page public, which is why it is off until the owner chooses it.

### `receipts`

A signed receipt for a finished task that anyone can check in a browser, with no account. With an Elastic account (`ELASTIC_URL`, `ELASTIC_BOX_KEY`, both optional) it also compares the log with Elastic's copy.

| Slot | What |
|---|---|
| Routes | `GET /t/receipts/` and `GET /t/receipts/tasks`: the owner's window. `POST /t/receipts/share`: makes a receipt. `GET /t/receipts/r`, `GET /t/receipts/verify` and `GET /t/receipts/qrcode.js`: open routes, so a receipt can be read and checked without a token. |
| Portal | Receipts |

See [Verify a receipt](/docs/guides/verify-a-receipt/).

### `shopper`

Shopping as standing instructions. A watch checks a store on a schedule and asks for your OK when an item is in stock at or under your price. A reorder reads receipts and proposes what runs out. Checkout signs each order with Visa's Trusted Agent Protocol and pays the box's own test store. Every payment is a test payment.

| Slot | What |
|---|---|
| Tools | `shopper.buy` (only purchase tasks the box starts, after an OK), `shopper.checkPrice`, `shopper.watch`, `shopper.receipts`, `shopper.propose`, `shopper.sign`, `shopper.refund`, `shopper.priceAdjust`, `shopper.proposeCancel` and `shopper.cancel` |
| Triggers | `schedule`: a 20 second tick that checks due watches |
| Log readers | `deals`: turns a matching price check into a purchase task that asks for an OK, and refunds an undone purchase |
| Model jobs | `shopper.agentKey`, `shopper.pay`, `shopper.mailLogin`, `shopper.status` |
| Routes | The app at `/t/shopper/`, its state, watches, rules, savings checks, reorders and supplies, passkey approval routes, and the test store at `/t/shopper/store` with its checkout and signing-key registry |
| Portal | Shopper (test payments), and GurtOS Test Store |
| Vault keys | All optional: `SHOPPER_AGENT_KEY`, `SHOPPER_MAIL_PASSWORD`, `SHOPPER_CARD`, and one payment provider's keys: `STRIPE_SECRET_KEY` (a test key; a live key is refused), `CYBERSOURCE_MERCHANT_ID`, `CYBERSOURCE_KEY_ID`, `CYBERSOURCE_SECRET_KEY` and `CYBERSOURCE_TEST_CARD` for the Cybersource sandbox, or the `VISA_*` sandbox keys. With none of them the app makes simulated payments. |

Orders above $500 are refused. Undoing a purchase task refunds its order. Passkey approval does not work in Shopper's GurtOS window, because app pages are sandboxed and passkeys need a real origin. See [An app's page](/docs/reference/app-sdk/#an-apps-page). See [Set up the shopping agent](/docs/guides/shopping-agent/).

### `vultr`

Encrypted backups of the box to Vultr Object Storage, and a Vultr cloud firewall for a box that runs on Vultr.

| Slot | What |
|---|---|
| Routes | `GET /t/vultr/status`. `POST /t/vultr/backup` and `PUT /t/vultr/firewall`: owner only. |
| Triggers | `daily-backup`: once a day, when the backup key is set (`VULTR_BACKUP_EVERY_MS` changes the interval) |
| Vault keys | `VULTR_OBJ_ACCESS`, `VULTR_OBJ_SECRET`, `BACKUP_AGE_RECIPIENT` for backups. `VULTR_API_KEY` for the firewall. `VULTR_OBJ_HOST` and `VULTR_OBJ_BUCKET` have defaults. |

### `wallet`

Lets agents pay for HTTP APIs that answer `402 Payment Required`, using x402, in USDC on Solana devnet. The wallet's key stays in the vault. Every payment is test money.

| Slot | What |
|---|---|
| Tools | `wallet.quote {url}`: what the API asks for. `wallet.pay {url, cents?}`: pays exactly that, then fetches the content. Costs `cents`. `wallet.discover`: searches Coinbase's x402 Bazaar. `wallet.payMetered`: pays a metered API up to a cap. |
| Triggers | `wallet-audit`: every day at 03:00, records a fingerprint of the action log (`POST /t/wallet/audit` runs it on demand) |
| Log readers | `payments`: every settled payment into the wallet's ledger. A second reader records sales. |
| Model jobs | `wallet.status`: the address and devnet balance. `wallet.audit`. |
| Routes | `GET /t/wallet/`, `GET /t/wallet/status`, `POST /t/wallet/audit`, the policy routes, and the selling routes under `/t/wallet/sell` (`GET /sell`, `GET /sell/audit`, `GET /sell/search`, `POST /sell/task`), which are open because the payment is the credential |
| Portal | Agent wallet (Solana devnet, test money) |
| Vault keys | `WALLET_SOLANA_KEY`. `CDP_API_KEY_ID`, `CDP_API_KEY_SECRET` and `CDP_WALLET_SECRET` are optional Coinbase keys. |

The wallet reaches only hosts in the task's `hosts`, pays only devnet USDC at the price the owner approved, and never pays twice for one call. See [Let agents pay for APIs](/docs/guides/agent-payments/).

## Related

- [Vault keys](/docs/reference/vault-keys/)
- [Apps and slots](/docs/concepts/apps-and-slots/)
