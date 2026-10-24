---
title: The vault and the broker
description: Tasks never hold secrets in GurtOS. The vault keeps keys root-only, and each task asks its broker to run a tool that uses them on its behalf.
---

An agent that can read your API keys can leak them. GurtOS keeps every secret out of every task. A task asks for work to be done with a key, and the core does it. The task only ever sees the result.

## The vault

The vault is one file, `/etc/box/vault.env`, owned by root with mode `0600`. Each line is a `KEY=value` pair:

```ini
FACTORY_API_KEY=...
APIFY_TOKEN=...
```

The core reads it at startup. If the file is readable by anyone but root, the core refuses to start. The owner can also set a key while the box runs, with `PUT /api/vault/<NAME>`. The file stays root-only, the key takes effect at once, and the log records only the key's name. No route ever returns a value: `GET /api/vault` lists the names and when each was set. On an ISO install, first-boot setup creates the vault empty on the data partition, so it survives system updates. You can point the core at another file with `BOX_VAULT`.

Who may read which key is declared in code, not decided at run time:

- A **tool** lists the keys its `run` function may read in `secrets`.
- A **model job** lists its keys the same way.
- An **app** lists the keys its routes and triggers may read in its own `secrets`.

Asking for any other key throws an error. A tool that declares `STRIPE_SECRET_KEY` cannot read `WALLET_SOLANA_KEY`, even though both are in the same file.

You add keys on the box's screen: in setup, or in **Settings**, **Accounts & Keys**. The portal sends each key straight to the vault and never shows it again; it shows only which keys are set. Programs use the vault API, and root can edit the file. See [add a secret](/guides/add-a-secret/).

## The broker

Each task has a broker: a Unix socket at `BOX_HOME/tasks/<id>/broker.sock`, owned by the task's user, mode `0600`. Only that task can open it. The worker finds it through the `BOX_SOCKET` environment variable.

The broker speaks JSON over HTTP and answers five requests:

| Request | What it does |
|---|---|
| `GET /task` | Returns the task and the steps it already logged, so a resumed worker can carry on |
| `POST /step {text, data?}` | Logs progress: a plan, a step, a diff. Flushes the task's files to disk first. |
| `POST /call {tool, input, key}` | Runs a tool the task is allowed to use, and returns its result |
| `POST /ask {question, key}` | Pauses for an OK and returns `{approved}` |
| `POST /cost {cents, what}` | Counts spending the worker did itself |

There is also `GET /tools`, which lists the task's tools with their descriptions and input schemas, and `POST /usage`, which the Droid worker uses to report model tokens. See [the broker reference](/reference/broker/).

Droid does not call the socket directly. The core gives it a small MCP server, started inside the task, that offers the task's tools plus `box_ask` and passes each call to the broker. Tool names become MCP names with `.` replaced by `__`, so `apify.run` is `apify__run`.

## How a tool call works

1. The worker sends `POST /call` with the tool name, the input and a key.
2. The broker checks that the tool is in the task's `tools`. If not, the call fails.
3. If the tool declares a cost and it would take the task over its budget, the broker asks for an OK first. See [approvals and budgets](/concepts/approvals-and-budgets/).
4. The core writes a `tool.call` event to the log, then runs the tool inside its own process, with a context that can read only the tool's declared secrets.
5. The tool calls its API with the key and returns a result.
6. The core writes a `tool.result` event, with the cost on the same line, and sends the result back to the worker.

The result goes into the action log and to the model. That is why a tool must never return a secret, and why the test suite checks the log of apps that use secrets for any vault value.

## Idempotency keys

Every call carries a `key`, chosen by the worker and stable for that call. The core uses it twice:

- If the log already has a result for that key, the broker returns the logged result instead of running the tool again. A task that resumes after a power cut never pays twice for a call that finished.
- The tool gets the key as `ctx.key`, and passes it on to its API as an idempotency key. Stripe and most payment APIs accept one, so a call cut off half way and run again with the same key cannot charge twice.

The core also merges a call that is retried while the first copy is still running. Droid gives up on a tool call after about three minutes and calls again. The same tool with the same arguments shares one run, one approval and one charge.

## The one exception: the model key

Droid sends its model key itself. So a Droid task gets a fixed placeholder instead of the key. GurtOS needs one model key in the vault, either one works:

- **`FACTORY_API_KEY`.** Droid uses Factory. The task's `FACTORY_API_KEY` is a placeholder, and the proxy puts the vault's key on each request to Factory's hosts.
- **`ANTHROPIC_API_KEY` only.** The box writes a bring-your-own-key model into the task user's `~/.factory/settings.json` (model `BOX_MODEL`, default `claude-sonnet-4-6`) with a placeholder key, and Droid calls Anthropic directly. The proxy relays only `api.anthropic.com` for this and puts the real key in the `x-api-key` header. The spend is on your Anthropic account.

With neither key, a Droid task fails with "the vault has no model key". Every request from the task goes through the box's proxy. For model calls over HTTPS, the proxy answers TLS itself with a certificate from the box's own certificate authority, which only Droid tasks are told to trust. The real key never enters the task's memory, files or environment.

## Why this design

- A key the task never sees cannot be stolen by a prompt injection, logged by mistake or written into a file.
- Declaring secrets in code makes every app's access readable in one place.
- Running tools in the core puts every privileged act in the log, with its input, result and cost.

## Related

- [Network policy](/concepts/network-policy/)
- [Apps and slots](/concepts/apps-and-slots/)
- [Vault keys](/reference/vault-keys/)
- [Security model](/security/model/)
