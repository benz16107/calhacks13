---
title: Apps
description: The apps that ship with GurtOS today, with the tools, routes, triggers and vault keys each one adds, and which payments are test money.
---

These apps ship in the source tree. Each one is a folder under `tracks/`. Every app is on unless the owner turns it off: `GET /api/apps?all=1` lists them all with what each can reach, and `POST /api/apps/<id>/disable` and `/enable` switch one without a reinstall (see [HTTP API](/reference/http-api/#setup-settings-apps-and-the-vault)). An app with missing vault keys still loads; the parts that need a key report that it is missing. To write your own, see the [App SDK](/reference/app-sdk/).

:::note[Test money]
Every payment an app makes today is test money. The shopper uses Stripe test mode and a Visa test card, or a simulated charge. The wallet pays USDC on Solana devnet, which has no value. The example app's `example.spend` moves no money at all.
:::

## Summary

| App | What it adds | Guide |
|---|---|---|
| `example` | One of each slot, small enough to copy | [App SDK](/reference/app-sdk/) |
| `apify` | Web work through Apify Actors, with the token in the vault | |
| `credit-desk` | A sample finance app: two agent seats for a made-up wholesaler | |
| `elastic` | The action log in Elasticsearch, with an agent that answers questions about it | [Send the log to Elastic](/guides/send-the-log-to-elastic/) |
| `fetch` | The box as a chat agent in ASI:One | [Reach GurtOS from ASI:One](/guides/asi-one/) |
| `find` | Search over photos, files and finished tasks | [Search your files](/guides/find/) |
| `jira` | Every task as a Jira issue, with approve and roll back in Jira | [Connect Jira](/guides/connect-jira/) |
| `mana` | A read-only status summary for an outside status page | |
| `shopper` | Price and restock watches, household reorders, signed test checkouts | [Set up the shopping agent](/guides/shopping-agent/) |
| `wallet` | x402 payments for APIs, in USDC on Solana devnet | [Let agents pay for APIs](/guides/agent-payments/) |

## `example`

The reference app. It uses every slot so you can copy the part you need.

| Slot | What |
|---|---|
| Tools | `example.spend {cents, on}`: records a test spend. Costs `cents`, so it pauses over budget. No money moves. |
| Triggers | `webhook` named `start`, `onFileChange` on `BOX_HOME/inbox/example`, and an hourly `schedule` |
| Routes | `GET /t/example/`, `GET /t/example/secret-check`, `POST /t/example/start` |
| Log readers | `count`: counts finished tasks |
| Model jobs | `example.echo` |
| Portal | Example |
| Vault keys | `DEMO_SECRET` |

## `apify`

Agents do web work through [Apify](https://apify.com) Actors and get JSON back. The task never holds the Apify token.

| Slot | What |
|---|---|
| Tools | `apify.run {actor, input, fields?, maxItems?, maxUsd?}`: runs any Actor; counts its spending cap, default $0.50. `apify.checkPrice`: price and stock of a product at Best Buy Canada; counts 1 cent. `apify.findPlaces`: places on Google Maps near a location; counts 0.4 cents a place. |
| Vault keys | `APIFY_TOKEN` |

Droid sees these as `apify__run`, `apify__checkPrice` and `apify__findPlaces`.

## `credit-desk`

A sample finance app for a made-up wholesaler. Two agent seats, a credit analyst and a collections clerk, each run as their own task and follow a rules file. The tools refuse a decision that cites a rule id the file does not have, and enforce which seat may record what.

| Slot | What |
|---|---|
| Tools | `credit-desk.crs`: credit, identity and fraud checks on an applicant (analyst). `credit-desk.bank`: reads the bank (both). `credit-desk.flag`: records a problem with the rules it breaks (both). `credit-desk.credit_decision`: records a credit decision (analyst only). `credit-desk.collections_action`: records a dunning step, correction, release or hold (clerk only). |
| Routes | `POST /t/credit-desk/run`: starts both seats on a case. `POST /t/credit-desk/score {run}`: scores a run against its answer key. `GET /t/credit-desk/runs`: past runs. |
| Vault keys | `CRS_USERNAME`, `CRS_PASSWORD` (credit bureau sandbox), `NESSIE_API_KEY` (bank sandbox) |

Decisions above the analyst's authority, fraud holds and anything the rules send to a human come back as a question, and the seat asks for an OK.

## `elastic`

Streams the action log into an Elasticsearch Serverless project and installs an Elastic Agent Builder agent that answers questions such as "what did my agents change this week?".

| Slot | What |
|---|---|
| Log readers | Turns each event into one flat document and appends it to `BOX_HOME/elastic/outbox.ndjson` |
| Model jobs | `elastic.bulk`: sends the outbox in `_bulk` batches. The only code that reads the Elastic key. |
| Vault keys | `ELASTIC_URL`, `ELASTIC_API_KEY`. `KIBANA_URL` is used by the agent installer, `tracks/elastic/agent.ts`. |

## `fetch`

Makes the box an agent on Agentverse, so you can give it work from an ASI:One chat, approve spending with a card, and keep or undo the result.

| Slot | What |
|---|---|
| Triggers | `asi1`: makes the `project` workspace and starts the chat agent if it is switched on |
| Routes | `GET /t/fetch/`: the agent's address and pairing code. `GET /t/fetch/agent`: its status. `POST /t/fetch/agent {on}`: switches it on or off. |
| Portal | ASI:One |
| Vault keys | `AGENTVERSE_API_KEY`, `ASI_ONE_API_KEY`. Chat tasks use Droid (`FACTORY_API_KEY`) and, for web searches, `APIFY_TOKEN`. |

The chat agent runs as the unprivileged user `nobody` and uses only the box's HTTP API. Its state is in `BOX_HOME/fetch/`.

## `find`

Indexes every photo, text file and finished task, and searches them by meaning with Moss. A vision model you choose describes each photo once. A fresh box calls none until its key is in the vault.

| Slot | What |
|---|---|
| Tools | `find.search {query, kind?, topK?}`: search, for tasks |
| Model jobs | `find.describe {file}`: describes one photo inside a workspace |
| Triggers | `index`: makes the `photos` workspace with four test photos, then rescans at boot, after every task and every minute |
| Log readers | Indexes tasks as they finish, fail or are undone |
| Routes | `GET /t/find/search?q=&kind=&k=`, `GET /t/find/file?workspace=&path=`, `GET /t/find/status` |
| Vault keys | `MOSS_PROJECT_ID`, `MOSS_PROJECT_KEY`, `VULTR_INFERENCE_KEY` (optional). `FIND_OLLAMA_URL` (optional). **Describe with Claude** uses `FACTORY_API_KEY`. |

A model runs only when its key is set in the vault. Claude, through a Droid task, runs only when the owner presses **Describe with Claude** on the Find page. Photos stay on the box unless the owner sets a hosted model's key or presses that button. Any task given `find.search` can search every workspace, not only its own. The Moss session is open only while someone searches. The cloud copy of the index is off unless the box runs with `FIND_CLOUD_SYNC=1`.

## `jira`

Writes every task to a Jira issue: the prompt, the approvals, blocked attempts, the diff, the cost and the log. A Forge app adds a panel to those issues with Approve, Deny and Roll back.

| Slot | What |
|---|---|
| Log readers | Creates and updates one issue per task, with status, labels, comments and the `box.task` issue property |
| Routes | `GET /t/jira/task`, `POST /t/jira/answer`, `POST /t/jira/undo`. Each needs the shared secret as a bearer token. The app lists them in `openRoutes`, so they need no paired device's token. |
| Vault keys | `ATLASSIAN_SITE`, `ATLASSIAN_EMAIL`, `ATLASSIAN_API_TOKEN`, `JIRA_BOX_SECRET` |

It writes nothing to Jira until `BOX_HOME/jira/config.json` exists.

## `mana`

A read-only summary of the box for an outside status page: counts of tasks in each state, total cost, the active and recent tasks with their titles, states, latest step and cost, and the questions waiting for an OK. It holds no prompts, tool calls, log lines or secrets.

| Slot | What |
|---|---|
| Routes | `GET /t/mana/status`. It allows any origin, so a page on another site can read it. The app lists it in `openRoutes`, so it needs no token. |
| Vault keys | none |

## `shopper`

Shopping as standing instructions. A watch checks a store on a schedule and asks for your OK when an item is in stock at or under your price. A reorder reads receipts and proposes what runs out. Checkout signs each order with Visa's Trusted Agent Protocol and pays the box's own test store.

| Slot | What |
|---|---|
| Tools | `shopper.buy` (only purchase tasks the box starts, after an OK), `shopper.checkPrice`, `shopper.watch`, `shopper.receipts`, `shopper.propose` |
| Triggers | `schedule`: a 20 second tick that checks due watches |
| Log readers | Turns a matching price check into a purchase task that asks for an OK |
| Model jobs | `shopper.agentKey`, `shopper.pay`, `shopper.mailLogin`, `shopper.status` |
| Routes | The app at `/t/shopper/`, its state, watches, reorders and supplies, and the test store at `/t/shopper/store` with its checkout and signing-key registry |
| Portal | Shopper (test payments), and the test store |
| Vault keys | `SHOPPER_CARD`, `SHOPPER_AGENT_KEY`, `SHOPPER_MAIL_PASSWORD`, `STRIPE_SECRET_KEY` (a test key; live keys are refused) |

Payments are Stripe test mode with a Visa test card, or simulated and labelled so. Orders above $500 are refused. Undoing a purchase task refunds its order.

## `wallet`

Lets agents pay for HTTP APIs that answer `402 Payment Required`, using x402, in USDC on Solana devnet. The wallet's key stays in the vault.

| Slot | What |
|---|---|
| Tools | `wallet.quote {url}`: what the API asks for. `wallet.pay {url, cents}`: pays exactly that, then fetches the content. Costs `cents`. |
| Model jobs | `wallet.status`: the address and devnet balance |
| Routes | `GET /t/wallet/`, `GET /t/wallet/status` |
| Portal | Agent wallet (Solana devnet, test money) |
| Vault keys | `WALLET_SOLANA_KEY`. The test API in `tracks/wallet/seller.ts` reads `CDP_API_KEY_ID` and `CDP_API_KEY_SECRET`; no box tool does. |

The wallet reaches only hosts in the task's `hosts`, pays only devnet USDC, refuses any single payment over $1, and never pays twice for one call.

## Related

- [Vault keys](/reference/vault-keys/)
- [Apps and slots](/concepts/apps-and-slots/)
