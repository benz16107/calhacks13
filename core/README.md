# The core: how the box works, and how a track plugs in

The core is one Node service that runs as root on the box. The types are in `contract.ts`. This page is the
short version. Read `tracks/example/` for working code of every slot.

## Tasks

A task is a piece of agent work: a prompt, a workspace (a folder of files), the tools it may use, the hosts
its network may reach, and a budget. States: `queued`, `running`, `waiting` (for an approval), `done`,
`failed`, `undone`.

Each task runs as its own Linux user (`box-<id>`, uid 30000 to 39999, no sudo, no shell) in its own
overlayfs copy of the workspace, as a hardened systemd unit (`box-task-<id>`): it sees only its own
processes, has a private `/tmp`, can write only its copy and its home, cannot reach D-Bus, and gets at most
2 GB of memory. Its changes stay in its own layer. When it finishes, that layer goes on top
of the workspace's view. **Undo** takes one layer out of the stack. Other tasks keep theirs, and the base
files are never written.

The worker inside a task is Droid with Claude (`worker: 'droid'`), or a scripted fake for tests
(`worker: 'fake'`, see `workers/fake.ts`).

Workspaces are folders in `BOX_HOME/workspaces`. `home` always exists and is the default. A track makes its
own with `box.workspace(name, fromDir)`, for example from a git clone or its case files.

## The action log

`BOX_HOME/log.jsonl`, one JSON event per line, append-only, fsynced per line. Every state change, step, tool
call and result, approval, cost and blocked connection is in it. At boot the core rebuilds every task from it
and resumes what was running. SpacetimeDB only mirrors live status and approvals; the log is the truth.

## The network

Task users reach nothing but the box's proxy (an nftables rule on their uids), and the proxy lets a task
reach only the hosts in its spec. `example.com` allows any port, `example.com:8080` one port, `*.example.com`
subdomains. A name that lands on the box itself (like `shop.localhost`) needs the exact `host:port`, and
never reaches the box's own ports. Every refusal is a `net.blocked` event in the log.

Droid tasks hold a placeholder Factory key. The proxy swaps in the vault's key on the way to Factory, for
plain calls and, through the box's own TLS certificate, for model calls. So the real key never enters a task.

## The broker and the vault

A task never holds a secret. The vault is `/etc/box/vault.env` (root only, `KEY=value`). A task asks its
broker, a Unix socket only its user can open, to run a tool by name. The tool runs inside the core, reads
the secrets it declared, and returns a result. That result goes into the log, so **never return a secret**.

Worker side of the socket (`BOX_SOCKET` in the worker's environment), JSON over HTTP:

| Request | Does |
|---|---|
| `GET /task` | The task, plus the steps it already logged (to resume) |
| `POST /step {text, data?}` | Log progress: a plan, a step, a diff |
| `POST /call {tool, input, key}` | Run a tool. Above the remaining budget it asks for an OK first. A key already answered returns the logged result. A call cut off mid-way runs again with the same `ctx.key`, so tools pass it on as an idempotency key and a resumed task never pays twice. |
| `POST /ask {question, key}` | Pause for an OK, returns `{approved}`. The same key returns the same approval. |
| `POST /cost {cents, what}` | Count model spending |

## Approvals

`POST /ask`, or a tool call over budget, writes `approval.asked` and sets the task to `waiting`. Anyone
answers with `POST /approvals/<id> {approved, by}` on the box's API (and soon through SpacetimeDB from the
portal and phone). The first answer wins. The task carries on, and other tasks never stop.

## Cost

Tools declare `cost(input)` in US cents. The broker counts it when the call succeeds, in the same log line as
the result. A Droid task's model cost is real: the worker reports its token counts and model, and the core
prices them at the model's list rates (`core/pricing.ts`), writing a `cost` event with `model` and a `tokens`
breakdown. `task.costCents` is tool spending plus model cost. Workers report model
spending with `POST /cost`. `task.costCents` is the total.

## Writing a track

Make `tracks/<name>/track.ts` and default-export a `Track` with any of these slots:

| Slot | What the core does with it |
|---|---|
| `triggers` | Calls `start(box)` once at boot. Call `box.createTask(...)` whenever you like, or reuse a generic trigger (below). |
| `tools` | Tasks that list the tool's name can call it through the broker. It runs in the core with its `secrets`. |
| `logReaders` | Feeds `read(event)` every log event in order, from the start, and resumes after restarts. Throw to retry. |
| `modelJobs` | Anyone with the box can run it with `box.job(name, input)`. |
| `apps` | The portal lists them. Their pages are your routes. |
| `routes` | `'POST /hook': (req, box) => Response`, served at `/t/<name>/hook` on the box's API. Webhooks go here. |

Rules:
- Import only types from `core/contract.ts`. Never import other core files or another track.
- Name tools `<track>.<verb>`. Put keys in the vault, never in the repo.
- Node runs `.ts` directly (type stripping): use `import type`, `.ts` in import paths, and no enums,
  namespaces or constructor parameter properties.
- Need npm packages? Add `tracks/<name>/package.json`; the root is an npm workspace.
- A track that throws at load is skipped and logged. It cannot stop the box.

## Triggers: start a task on a schedule, a webhook or a file

`core/triggers.ts` has three generic triggers. Put one in a track's `triggers`; each turns its event into a
`TaskSpec` (return nothing to skip) and the box starts the task. Factory scores "Droid runs on a trigger you
designed", so a real track returns a Droid task here.

```ts
import { schedule, webhook, onFileChange } from '../../core/triggers.ts';

triggers: [
  schedule({ name: 'nightly', dailyAt: '02:00', task: () => ({ title: 'Nightly report', prompt: '...' }) }),
  webhook({ name: 'jira', task: (payload) => ({ title: payload.issue, prompt: `Fix ${payload.issue}` }) }),
  onFileChange({ name: 'inbox', dir: '/var/lib/box/inbox/mytrack', task: (file) => ({ title: file, prompt: `Process ${file}` }) }),
]
```

- `schedule` takes `everyMs` or `dailyAt: 'HH:MM'` (the box's local time). It re-arms after a restart.
- `webhook` serves `POST /hook/<track>/<name>` on the box's API; the JSON body is the payload.
- `onFileChange` watches a folder (debounced) and fires per added or changed file.

## Moment 2 with a real agent

The demo runs the booby-trapped page twice: once with a scripted agent that does everything the hidden
instructions say (and is blocked at every turn), and once with a real Droid task (Claude) whose only allowed
host is the page. Claude usually refuses the injection; if it tries, the box blocks the exfil and logs it.
Either way the demo asserts no vault secret reached the task's files, environment or log, and reports which
path the agent took.

## Your demo step

Make `tracks/<name>/demo.ts` that default-exports `async (d: DemoKit) => { ... }` and calls `d.check(...)`
for each thing your part shows. `./demo` runs it after the four moments on a fresh box with every track
loaded. Keep it under about 10 seconds. Test-mode keys go in `/etc/box/vault.env` on the test VM; the demo
copies them into each run's vault.

## The API for the portal and the phone

Two parts. **The box's HTTP API** for lists, details and actions. **SpacetimeDB** for live updates and for
answering approvals from a phone. The types are in `contract.ts` (`Task`, `Approval`, `LogEvent`).

### HTTP

`http://<box>:7700/api/...`, JSON. It listens on `127.0.0.1` (`BOX_LISTEN` changes that). Every route also
answers without `/api`, which is what the demo and tracks use.

| Request | Returns |
|---|---|
| `GET /api/tasks` | Every task: `id, title, state, source, workspace, costCents, budgetCents, step, summary, error, createdAt, updatedAt` |
| `POST /api/tasks {title, prompt, workspace?, tools?, hosts?, budgetCents?}` | The new task. Workspace defaults to `home`, worker to Droid. |
| `GET /api/tasks/<id>` | `{task, approvals, events}`: the task, its approvals, and its whole action log |
| `GET /api/tasks/<id>/diff` | `{changes: [{path, change}], diff}`: what it added, modified or deleted, and a unified diff |
| `POST /api/tasks/<id>/undo` | The task, now `undone` |
| `GET /api/approvals?state=pending` | The inbox. Leave out `state` for all of them. |
| `POST /api/approvals/<id> {approved: true or false, by: "portal"}` | The approval. The first answer wins. |
| `GET /api/log?after=<seq>&task=<id>` | Log events, both filters optional (cursor polling) |
| `GET /api/log/stream?after=<seq>&task=<id>` | The log as Server-Sent Events: replays from `after`, then streams new events live. For Elastic and Jira to follow without polling files. |
| `GET /api/apps` | Apps from tracks: `{name, title, href, track}`. Open `/t/<track><href>`. |
| `GET /api/health` | `{ok, tasks, tools, spacetime: {port, database}}` |
| `/t/<track>/...` | Track routes |

What a screen needs, and where it comes from:

- **Task list:** `GET /api/tasks` once, then the SpacetimeDB `task` table live. `step` is what it is doing now;
  `costCents` includes tool spending and the model estimate.
- **One task:** `GET /api/tasks/<id>` for its steps (`task.step` events, in order), tool calls, costs and
  blocked hosts. `GET /api/tasks/<id>/diff` for its changes. An Undo button posts to `/undo`.
- **Inbox:** the SpacetimeDB `approval` table where `state` is `pending`. Approve or Deny with the `answer`
  reducer, or `POST /api/approvals/<id>`.

**Following the action log** (Elastic, Jira). An in-process track uses the `logReaders` slot: the core feeds
`read(event)` every event in order and saves a cursor, so it never polls files. An outside reader follows
`GET /api/log/stream` (Server-Sent Events): each event is `id: <seq>` and `data: <json>`. On reconnect, pass
`?after=<seq>` or the `Last-Event-ID` header and the box replays from there, then streams live. `GET /api/log?after=`
is the same data by polling if a reader prefers a cursor.

**Hosting the portal.** Build it into `portal/dist` (or point `BOX_PORTAL` at a folder) and the box serves it on
the same address as the API: files as they are, and `index.html` for any other page load, so client-side
routes work. Then the box's own screen and a phone need one address and no CORS. During development a portal
on another origin needs `BOX_ORIGINS=http://localhost:5173` (comma separated, or `*`) in the box's environment.

### Live: SpacetimeDB

`ws://<box>:3000`, database `box` (the demo uses its own). Public tables, mirrored from the log by the box:

| Table | Columns |
|---|---|
| `task` | `id, title, state, source, workspace, worker, costCents, budgetCents, updatedAt, step, note` (`note` is the error, else the summary) |
| `approval` | `id, task, question, costCents, state` (`pending`, `approved`, `denied`)`, by` |

Reducers anyone may call: `answer({id, approved, by})`. The first answer wins, and the box writes it to the log
within milliseconds. `putTask` and `putApproval` are for the box only and refuse anyone else.

TypeScript client (`npm i spacetimedb@2.13.0`). Import the generated bindings from `core/spacetime/bindings/`,
or regenerate them for your app with `spacetime generate --lang typescript --module-path core/spacetime`:

```ts
import { DbConnection } from '../core/spacetime/bindings/index.ts';

DbConnection.builder()
  .withUri(`ws://${location.hostname}:3000`)
  .withDatabaseName('box')
  .onConnect((conn) => {
    conn.db.task.onInsert((_ctx, task) => render(task));
    conn.db.task.onUpdate((_ctx, _old, task) => render(task));
    conn.db.approval.onUpdate((_ctx, _old, a) => renderInbox(a));
    conn.subscriptionBuilder().subscribeToAllTables();
    // Approve button:
    // conn.reducers.answer({ id: approval.id, approved: true, by: 'phone' });
  })
  .build();
```

Column names are camelCase in the TypeScript client and snake_case in SQL (`cost_cents`).

Reaching the box from a phone is not set up yet: the API listens on `127.0.0.1:7700` and SpacetimeDB on port
3000 of every interface of the box. Tailscale or a port forward comes with the portal.

## Running it

```
./demo                  # the merge gate, on a test VM
npm test                # unit tests, any machine
npm run check           # type check
sudo npm run box        # the service itself, on a test VM only
```
