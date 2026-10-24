---
title: Vault keys
description: Every key name the box and its apps read from the vault, which part reads it and what it is for, plus the vault file's format and permissions.
---

The vault holds every secret on the box. Tasks never see it: tools, model jobs, app routes and triggers read it inside the core, and only the keys they declare. For how this works, read [The vault and the broker](/concepts/vault-and-broker/). To add a key, see [Add a secret](/guides/add-a-secret/).

This page lists key names only. Never put a value in a document, a prompt or a log.

## The file

| | |
|---|---|
| Path | `/etc/box/vault.env`, or `BOX_VAULT` |
| Owner and mode | root, `0600`. If group or others have any access to it, the box refuses to start. |
| Format | One `KEY=value` per line. Key names use capital letters, digits and `_`. Other lines are ignored. |
| When read | When the box service starts, and again for each key set through the API. Restart `box.service` after editing the file by hand. |

```sh title="/etc/box/vault.env"
FACTORY_API_KEY=...
APIFY_TOKEN=...
```

## Setting a key through the API

The owner can set a key without a shell: from the box itself, or from a phone paired as the owner.

| Request | Does |
|---|---|
| `PUT /api/vault/<NAME> {"value": "..."}` | Sets or replaces one key. The file is rewritten atomically and stays root-only `0600`. The value is one line, at most 8192 characters. |
| `GET /api/vault` | Lists the key names, with the time each was set through the API, or `null` for one put in the file by hand |

No route reads a value back. The action log records that a name was set, never the value. Names are capital letters, digits and `_`, 2 to 64 characters, starting with a letter.

```sh
read -rs -p 'Factory API key: ' KEY && echo
curl -s -X PUT http://127.0.0.1:7700/api/vault/FACTORY_API_KEY \
  -H 'content-type: application/json' -d "{\"value\": \"$KEY\"}"
unset KEY
```

A part of the box can read a key only if it declares it: a tool or model job in its `secrets`, an app's routes and triggers in the app's `secrets`. Asking for any other name throws an error.

## The core

| Key | Read by | For |
|---|---|---|
| `FACTORY_API_KEY` | The task proxy | Droid, the worker in every task. Required for Droid tasks. Tasks hold a placeholder; the proxy puts the real key on each request to Factory. |

## Apps

| Key | App | Read by | For |
|---|---|---|---|
| `DEMO_SECRET` | `example` | `example.spend`, the app's routes | A stand-in key that shows the pattern |
| `APIFY_TOKEN` | `apify` | `apify.run`, `apify.checkPrice`, `apify.findPlaces` | Apify's API |
| `CRS_USERNAME`, `CRS_PASSWORD` | `credit-desk` | `credit-desk.crs` | The credit bureau sandbox |
| `NESSIE_API_KEY` | `credit-desk` | `credit-desk.bank` | The bank sandbox |
| `ELASTIC_URL`, `ELASTIC_API_KEY` | `elastic` | The `elastic.bulk` model job | Sending log documents to Elasticsearch |
| `KIBANA_URL` | `elastic` | The test step, and `tracks/elastic/agent.ts` from its environment | Installing and asking the Agent Builder agent |
| `AGENTVERSE_API_KEY` | `fetch` | The app's trigger, handed to the chat agent | The agent's Agentverse mailbox |
| `ASI_ONE_API_KEY` | `fetch` | The app's trigger, handed to the chat agent | ASI:One's model, to sort chat messages |
| `MOSS_PROJECT_ID`, `MOSS_PROJECT_KEY` | `find` | `find.search`, the app's trigger | The Moss search index |
| `VULTR_INFERENCE_KEY` | `find` | The `find.describe` job | A hosted vision model. Optional. |
| `ATLASSIAN_SITE` | `jira` | The app's log reader | The Jira Cloud site address |
| `ATLASSIAN_EMAIL`, `ATLASSIAN_API_TOKEN` | `jira` | The app's log reader | Jira's REST API |
| `JIRA_BOX_SECRET` | `jira` | The app's routes | The shared secret the Forge app sends. Without it every call is refused. |
| `SHOPPER_CARD` | `shopper` | `shopper.buy` | A Stripe test PaymentMethod |
| `SHOPPER_AGENT_KEY` | `shopper` | `shopper.buy`, the `shopper.agentKey` job | The Ed25519 key that signs checkouts |
| `SHOPPER_MAIL_PASSWORD` | `shopper` | `shopper.receipts`, the `shopper.mailLogin` job | The demo mailbox |
| `STRIPE_SECRET_KEY` | `shopper` | The `shopper.pay` job | Stripe test mode. A live key is refused. |
| `WALLET_SOLANA_KEY` | `wallet` | `wallet.pay`, the `wallet.status` job | The agent wallet's private key, on Solana devnet |
| `CDP_API_KEY_ID`, `CDP_API_KEY_SECRET` | `wallet` | Only the test API, `tracks/wallet/seller.ts`. No box tool declares them. | Coinbase's x402 facilitator |

`tracks/shopper/setup.sh` adds `SHOPPER_CARD`, `SHOPPER_AGENT_KEY` and `SHOPPER_MAIL_PASSWORD` if they are missing. `tracks/wallet/keygen.ts` prints a new `WALLET_SOLANA_KEY` line.

## Rules for app authors

- Declare each key on the tool or job that needs it, not on the app, unless a route or trigger needs it.
- Never return a key, put it in a log step, or hand it to a task. Return what you learned with it.
- Read keys when you need them, not at load time, so a missing key fails one call instead of the whole app.

## Related

- [The vault and the broker](/concepts/vault-and-broker/)
- [Security model](/security/model/)
- [Apps](/reference/apps/)
