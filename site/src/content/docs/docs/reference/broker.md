---
title: Broker API
description: The Unix socket each task uses to log steps, call tools, ask for an OK and report cost, with keys that make retries and resumes safe.
---

Every task gets its own broker: a Unix socket that only the task's Linux user can open. It is the task's only way to reach the box. Through it the worker logs progress, calls tools that run in the core with vault access, asks for an OK and reports model cost. See [The vault and the broker](/docs/concepts/vault-and-broker/) for why it exists.

## The socket

| | |
|---|---|
| Path | `BOX_HOME/tasks/<id>/broker.sock` |
| Owner and mode | The task's user (`box-<id>`), `0600` |
| In the worker's environment | `BOX_SOCKET` (the path) and `BOX_TASK` (the task id) |
| Protocol | HTTP with JSON bodies, over the socket |
| Lifetime | Opened when the task starts or resumes, closed when it ends |

Errors come back as status 400 with `{"error": "..."}`, the same as the [HTTP API](/docs/reference/http-api/#errors).

```sh
curl -s --unix-socket "$BOX_SOCKET" http://box/task
```

## Requests

| Request | Body | Returns |
|---|---|---|
| `GET /task` | | `{task, steps}`: the task and every step it already logged, as `{text, data}` |
| `GET /tools` | | The tools this task may call: `[{name, description, input}]`, with `input` a JSON Schema |
| `POST /step` | `{text, data?}` | The `task.step` log event. Flushes the task's files to disk first. |
| `POST /call` | `{tool, input, key}` | `{ok, output}` or `{ok: false, error}`, or `{ok: false, pending: true, error}` while an OK is outstanding |
| `POST /ask` | `{question, key, costCents?, payee?, purpose?}` | `{approved: true}` or `{approved: false}`, or `{pending: true}` |
| `POST /cost` | `{cents, what}` | The `cost` log event |
| `POST /usage` | `{model, tokens, what?}` | The `cost` log event, priced from the token counts |

### `GET /task`

Workers call this first. `steps` is how a worker resumes after a restart: each step's `data` holds whatever the worker needs to carry on. The Droid worker stores its session id there; the test worker stores the number of the last line it finished.

### `POST /step`

Logs one line of progress: a plan, a step, a summary. Before writing, the box runs `sync` on the task's layer, so a step the log calls done is also on disk when the power goes. `data` is any JSON.

### `POST /call`

Runs a tool by name. The tool must be in the task's `tools`, and it runs inside the core with the secrets it declares. The task sees only the result.

- **Budget.** If the tool's `cost(input)` would take the task's spending (including other calls already in flight) above `budgetCents`, the broker asks for an OK first. Denied returns `{ok: false, error: "not approved"}` and the tool never runs.
- **Cost.** The cost is reserved before the tool runs and written on the same `tool.result` line as the output, so it counts once.
- **Same key, same result.** A `key` already answered in the log returns the logged result without running the tool again. A call cut off by a power cut runs again with the same key, and the tool receives it as `ctx.key` to pass on as an idempotency key.
- **Same call, one run.** The same tool with the same input, called again while the first call is still running or waiting, shares the first call. It is approved once and charged once.

### `POST /ask`

Pauses the task until someone answers. The approval id is `<task id>.<key>`, so asking again with the same key returns the same approval, even after a restart. The task's state becomes `waiting` and goes back to `running` once nothing of the task's is still pending.

### `POST /cost` and `POST /usage`

`/cost` records spending in US cents directly. `/usage` takes token counts and the model name and lets the box price them at the model's list rates:

```json
{ "model": "claude-sonnet-4-6", "what": "model", "tokens": { "input": 12000, "output": 900, "cacheWrite": 0, "cacheRead": 48000 } }
```

See [Cost](/docs/concepts/cost/).

## Keys

`/call` and `/ask` require a `key`. Without one the broker returns 400 `a key is required`. Choose keys that are:

- **Stable**: the same logical action gets the same key after a restart, so it is not run or asked twice.
- **Unique**: two different actions never share a key.

The MCP relay builds keys from a hash of the tool name and input plus a counter. The test worker uses its line number.

## Waiting longer than a client timeout

An over-budget `/call` and an `/ask` wait for an answer for up to `BOX_APPROVAL_WAIT_MS` (default 150 seconds). If no answer comes in that time, they return a pending result instead of an error:

```json
{ "ok": false, "pending": true, "error": "Waiting for the box owner to approve this spend. Call this tool again to check." }
```

```json
{ "pending": true }
```

The approval stays open. Call again with the same key, or the same tool and input, to keep waiting. A task can wait hours this way. When the task ends, any approval it left pending is closed as denied, answered by `task ended`.

## How Droid reaches the broker

Droid does not call the socket directly. The Droid worker starts a small MCP server inside the task (`core/workers/mcp.ts`) and hands it to Droid as the `box` MCP server. It holds no secrets and forwards every call to the broker.

| MCP tool | Becomes |
|---|---|
| `box_ask {question}` | `POST /ask` with key `mcp.ask.<hash of the question>` |
| `<app>__<verb>` (for example `wallet__pay`) | `POST /call` for the tool `<app>.<verb>`, with key `mcp.<tool>.<hash of the input>.<count>` |

MCP tool names cannot contain dots, so `.` becomes `__`. A pending result is returned to Droid as plain text, not an error, so Droid carries on and calls again. Droid's own questions to the user also become approvals, through `POST /ask`.

## Related

- [App SDK](/docs/reference/app-sdk/): how a tool declares `cost`, `approval` and `secrets`
- [Approvals and budgets](/docs/concepts/approvals-and-budgets/)
- [Log events](/docs/reference/log-events/)
