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

Droid tasks hold placeholder keys. The proxy swaps in the vault's key on the way out, for plain calls and,
through the box's own TLS certificate, for model calls. So the real key never enters a task.

**One model key is enough: Factory's or your own Anthropic key.** With `FACTORY_API_KEY` in the vault, Droid uses
Factory. With only `ANTHROPIC_API_KEY`, the box writes a bring-your-own-key model into the task user's
`~/.factory/settings.json` (model `BOX_MODEL`, default `claude-sonnet-4-6`, with a placeholder key) and runs Droid on
`custom:<model>`; the proxy relays `api.anthropic.com` and puts the real key in the `x-api-key` header. Droid's own
calls to Factory get a 503 then, and the task carries on. With neither, a Droid task fails with "the vault has no
model key". `GET /api/setup` and `GET /api/system` report `model: {ready, via: 'factory' | 'anthropic' | null}`.
The cost numbers are list prices either way; with your own key the spend is on your Anthropic account.

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
answers with `POST /approvals/<id> {approved, by}` on the box's API or the SpacetimeDB `answer` reducer. The
first answer wins. The task carries on, and other tasks never stop.

**One approval per action.** The approval id is keyed by the task plus the tool and its arguments, so the
same call retried (Droid gives up on a tool call after about 3 minutes and calls again) reuses one approval
instead of making a second. An answer to any copy resolves the one request, and a retried call is run and
charged once.

**Waiting longer than the client's timeout.** `/ask` and an over-budget `/call` wait up to
`BOX_APPROVAL_WAIT_MS` (default 150s, under Droid's limit). If no answer comes, they return `{pending:true}`
with "call again to check"; the worker (and Droid, which calls the tool again) polls until the answer exists.
So a task can wait hours for an OK.

**Why a task failed.** The `task.state: failed` event's `error` ends with the worker's own last error message
(`worker exited with 1: Error: ...`), so the screen can say what went wrong.

**Closed at the end.** When a task reaches done, failed or undone, any approval still pending for it is
closed, so none lingers.

## Cost

Tools declare `cost(input)` in US cents. The broker counts it when the call succeeds, in the same log line as
the result, and reserves it before the call runs, so two payments a task fires at once cannot both pass the
budget check and overspend. A tool's optional `approval(input)` returns `{ payee, purpose }` for the approval. A Droid task's model cost is real: the worker reports its token counts and model, and the core
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
| `secrets` | Vault keys this track's routes and triggers may read with `box.secret(name)`. Tools and jobs declare their own. |
| `optionalSecrets` | Keys among the app's declared secrets it can run without (it falls back to test mode). A new box turns the app on when only these are missing; the App Center marks them `optional: true`. |
| `openRoutes` | Route keys (like `'GET /status'`) that need no paired-phone token, even for a request that arrives through a public proxy. For a route that is public on purpose, or checks its own secret (the Jira panel's routes). Every other route needs a phone. An open route must return nothing private unless its own check passes. |

Rules:
- Import only types from `core/contract.ts`. Never import other core files or another track.
- Name tools `<track>.<verb>`. Put keys in the vault, never in the repo.
- Node runs `.ts` directly (type stripping): use `import type`, `.ts` in import paths, and no enums,
  namespaces or constructor parameter properties.
- Routes and triggers run in the core (not in a task), so they may read the vault with `box.secret(name)` for
  any name in the track's `secrets`. Never return a secret in a response or hand it to a task.
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

## Setup, Settings, App Center and the vault

What the first-run wizard, Settings and the App Center are built on. **Who may call what.** Anything that
changes setup, settings, apps or the vault is for the owner only: the box's own screen (a request from this
machine, or over its socket, with no proxy header such as `X-Forwarded-For`) or a phone paired as the owner. A
request relayed by a reverse proxy or a tailnet serve looks local to the box but carries those headers, so it
does not count. Everything else gets a `403`. Reads of `/api/setup`, `/api/settings`, `/api/system` and `/api/apps`
are open like the rest of the API. To pair the owner's phone, the box's own screen calls
`POST /api/pair/start {owner: true}`; the phone redeems the code as usual and the device is then an owner device.
The `owner` flag is ignored from anyone who is not already the owner.

| Request | Does |
|---|---|
| `GET /api/system` | `{product, edition, editionName, version, build, hostname, timezone, network: {online, interfaces}, boxId, boxName, owner, startedAt, uptimeSec}`. `build` is the commit `./deploy` installed. |
| `GET /api/setup` | `{modelKey, done, finishedAt, migrated, steps: {id: {at, data?}}, suggested: [...]}`. **Until `done`, the box's screen shows the wizard.** `modelKey` is false until the vault holds `FACTORY_API_KEY`; without it no Droid task can start, so the wizard should ask for it (`PUT /api/vault/FACTORY_API_KEY`, which takes effect at once). A box that already ran tasks when this arrived is `migrated` and counts as done. |
| `POST /api/setup/step {id, data?}` | Records a step as taken (any id like `network`; `suggested` lists the usual ones). `data` is at most 4 KB and is for answers, not keys: keys go to the vault. |
| `POST /api/setup/finish`, `POST /api/setup/reopen` | Mark setup done, or show the wizard again. |
| `GET /api/settings`, `PATCH /api/settings {...}` | The settings below. A patch changes only the keys it names (`quietHours` and `appearance` merge one level). Unknown keys and bad values are a `400` that names the field. Each change is a `note` in the action log with the old and new value. |
| `GET /api/apps` | The apps that have a window and are on, in the shape the portal reads (`name, title, href, track`), plus the fields below. |
| `GET /api/apps?all=1` | Every installed app, on or off: the App Center. |
| `POST /api/apps/<id>/enable`, `.../disable` | Turn an app on or off without a reinstall. Returns the app. |
| `GET /api/vault` | Names of the keys in the vault and when each was set through the API (`setAt` is null for one that was put there by hand). Never a value. |
| `PUT /api/vault/<NAME> {value}` | Set or replace a key (`NAME` is capital letters, digits, `_`). The file stays root-only. The log records that `NAME` was set, never the value. **No route reads a value back.** |

**Settings** (defaults in parentheses; the first four are enforced by the core):

- `approvalThresholdCents` (10000): a single spend above this always asks for an OK, even inside the task's budget.
- `defaultBudgetCents` (0): the budget of a task that names none. 0 means every spend asks.
- `networkDefault` (`none`) and `defaultHosts` (`[]`): with `allowlist`, a task that names no hosts gets `defaultHosts`; a task that names its own keeps them.
- `agentFolders` (`[]`): Personal. Folders agents may use besides the owner's home. Can't include the system or the box's own state. Empty means only the owner's home.
- `quietHours` (`{enabled: false, from: "22:00", to: "07:00"}`): read by the desktop and phone for notifications.
- `paused` (false): Pause all agents. While true no task starts (new ones stay `queued`) and running ones hold before their next step, tool call or question; false resumes them all. Enforced by the core.
- `logRetentionDays` (365), `updateChannel` (`stable` | `beta`), `autoUpdate` (true), `appearance` (`{theme: light | dark | system, accent: "#rrggbb" or ""}`): stored for the screens and the updater to read.

**An app** is a track. Each entry has `id` (the track name), `title`, `description` (the track's own, else the
first paragraph of its README), `status` (`enabled`, `disabled` or `error`, with `error` text), and `access`:
`tools` (name and description), `jobs`, `hosts` the tools reach, `secrets` (the key **names** it needs, each with
`set: true or false` and `optional: true` for a key it can run without, never a value), `triggers` and `routes`. `ui` lists its windows (`name, title, href`).

Turning an app **off** takes its tools, jobs, routes, webhooks, log readers and windows out at once and stops
its triggers; a task that asks for one of its tools is refused. A trigger that returns a stop function from
`start` stops cleanly (the generic `schedule`, `webhook` and `onFileChange` all do). A trigger that returns
nothing keeps running until the box restarts, and the app reports `restartNeeded: true`. Turning it **on** loads
it again with no reinstall. The choice is saved in `apps.json`, so it survives a restart. **A new box** (no `apps.json` and an empty log) starts with only the apps whose keys are all in the vault turned on, and never the example app, so a fresh install runs nothing it has no keys for. Turning one on later shows which keys it needs.

## Who may reach the API

**From the box's own screen** (a request on this machine, over the socket or loopback, with no proxy header, and
no `Origin` other than the box's own address) the API is open, as it always was. A web page from another site in a
browser on the box (GurtOS Personal) also arrives from loopback, but its `Origin` gives it away, so it is treated
as remote and needs a paired token. **From anywhere else every request must carry a paired phone's token**, as
`Authorization: Bearer <token>` or `?access_token=<token>` (an EventSource cannot set headers, so the SSE stream
takes the query form). Without one the answer is `401` and nothing is read, started, approved or undone. The
only open routes are `GET /api/health`, `POST /api/pair` (redeeming a pairing code) and the portal's own pages
(`index.html` and its assets, which hold nothing private). Webhooks and track routes need a token too.

A paired phone can read, start tasks and answer approvals, and the log names the phone by its device name: for
anyone not on the box's own screen, `by` in the request body is ignored. Minting pairing codes, listing or
removing devices, setup, settings, the vault, apps, the owner, Keep and Undo-Keep are the **owner's** (the box's own
screen, or a phone paired as the owner).

**SpacetimeDB listens on loopback only** (`127.0.0.1:3000`, set by `core/setup.sh`, which the image runs, so an image built from current main has it; the unit file must not be overridden to `0.0.0.0`). It has no login, so a reachable port would let anyone
read every task and forge an approval. The box's own screen subscribes to it locally; a phone follows the box's
authed API and `GET /api/log/stream` instead. To expose it deliberately (a tailnet address), put
`STDB_LISTEN=<address>` in `/etc/box/stdb.env` and restart `spacetimedb`; anyone who can reach it then can read it
and answer approvals, so only do that on a network you trust.

**Folders for agents** (`folder`, `folders`) are only for GurtOS Personal and only for the owner. A folder must be
in the owner's home or in one of Settings `agentFolders`, must not belong to root, and can never be the system or
the box's own state (`/etc`, `/root`, `/proc`, `/var/lib`, `/opt`, `/usr`, the box's data folder...). Links are
followed to where they really go. A Server box (no owner, no `agentFolders`) hands out no folders.

**Undo removes the task's files**: its layer is deleted from disk (once no running task still reads it), and
`GET /api/tasks/<id>/diff` for an undone task is empty.

## Personal edition: the owner and their real folders

On a Personal box the human is the **owner**, a Linux user with sudo, set with `BOX_OWNER`. `GET /api/owner`
returns `{user, home}` (null on a Server box). Agents always run as their own `box-<id>` users and never as the
owner; the owner's files are reached only through an overlay copy, never directly.

A task can work on one of the owner's real folders:

- `POST /api/tasks {folder: "/home/you/Documents/thesis", title, prompt}` links that folder to a workspace
  (named `owner-<name>-<hash of the full path>`, so `~/a/notes` and `~/b/notes` never share one) and
  starts the task on a writable copy of it. The real folder is untouched while the task runs.
- `POST /api/tasks {folders: ["/home/you/a", "/home/you/b"], ...}` puts **several folders in one task** (Files'
  multi-folder selection). The task sees them side by side, each as a top-level folder named after the real one
  (`notes`, and `notes-2` for a second folder with the same name). `task.folders` lists them and `task.folder` is
  the first. Send `folder` or `folders`, not both; a folder inside another one in the list is refused (the same
  file would be changed twice); at most 10. `agentFolders` applies to every one.
- `GET /api/tasks/<id>/diff` shows what the agent changed. For several folders each change path starts with its
  label and the answer carries `roots: {label: real folder}`. Keep is all or nothing across every folder: a
  conflict in any one of them applies nothing anywhere, and ownership and modes are kept per file as above.
- `POST /api/tasks/<id>/keep` applies the task's changes to the real folder, each file atomically. If the owner
  changed any of the same files since the task started, it applies nothing and returns `{conflicts: [paths]}`.
  Otherwise it returns `{kept: changes}` and saves before-images under `BOX_HOME/timemachine/<id>` so the
  desktop's Time Machine can undo the Keep later.
- `POST /api/tasks/<id>/undo` discards the task's changes; the real folder never received them.
- `POST /api/tasks/<id>/unkeep` undoes a Keep from the Time Machine before-images: kept files go back with
  their old content, owner and mode, and files Keep added are removed. If the owner edited a kept file since,
  it changes nothing and returns `{conflicts}`.

**Keep never changes ownership or widens permissions.** A kept file keeps the real file's owner, group and mode.
A new file or folder takes the owner of the folder it lands in; files are 0644 (0755 if executable), and new
folders copy their parent's mode. The task's uid and the layer's `a+rwX` never reach the owner's files.

**Where a task's changes stand.** `task.review` is `pending` (done, waiting for the owner), `kept`, `conflict`
(the owner edited the same files; nothing applied) or `undone` (discarded, or a Keep was undone). Each change
is a `keep` event in the log (`result`: `pending`, `kept`, `conflict`, `reverted`, with `changes` or
`conflicts`), so the desktop can notify from the event stream.

The portal is reachable on localhost without pairing: pairing only gates requests that carry a device token
(a phone). The desktop layer in `personal/` uses these routes and the SSE log stream for approvals and events.

## The API for the portal and the phone

Two parts. **The box's HTTP API** for lists, details and actions. **SpacetimeDB** for live updates and for
answering approvals from a phone. The types are in `contract.ts` (`Task`, `Approval`, `LogEvent`).

### HTTP

`http://<box>:7700/api/...`, JSON. It listens on `127.0.0.1` (`BOX_LISTEN` changes that). Every route also
answers without `/api`, which is what the demo and tracks use.

| Request | Returns |
|---|---|
| `GET /api/tasks` | Every task: `id, title, state, source, workspace, costCents, budgetCents, step, summary, error, createdAt, updatedAt` |
| `POST /api/tasks {title, prompt, workspace?, tools?, hosts?, budgetCents?}` | The new task. Workspace defaults to `home`, worker to Droid. A field the box doesn't know (a typo like `folders`) is refused with a 400 naming it. `folder` (Personal) is a real field: the owner's folder the task works a copy of, kept on the task. |
| `GET /api/tasks/<id>` | `{task, approvals, events}`: the task, its approvals, and its whole action log |
| `GET /api/tasks/<id>/diff` | `{changes: [{path, change}], diff}`: what it added, modified or deleted, and a unified diff |
| `POST /api/tasks/<id>/undo` | The task, now `undone`. For a real-folder task, discards its changes. |
| `POST /api/tasks/<id>/keep` | Personal: apply a done task's changes to its real folder. `{kept}` or `{conflicts}`. |
| `GET /api/owner` | Personal: `{user, name, uid, home}` (`name` is the account's full name, empty when unset), or null on a Server box |
| `PUT /api/owner {user}` | Make an existing account the owner. For the image: run it once GNOME's own setup has created the account, e.g. `curl --unix-socket /var/lib/box/api.sock -X PUT -H 'content-type: application/json' -d '{"user":"alice"}' http://box/api/owner`. The account must exist and be a person's (uid 1000 to 29999 or 40000 and up; not root, not a system or task account). Saved in `owner.json`, so it survives a restart, and the box then reports itself as GurtOS Personal. Once an owner is set, changing it takes the box's socket (root) or an owner-paired phone, not any local process. |
| `DELETE /api/owner` | Forget the saved owner and go back to `BOX_OWNER` (or none) |
| `GET /api/approvals?state=pending` | The inbox. Leave out `state` for all of them. |
| `POST /api/approvals/<id> {approved: true or false, by: "portal"}` | The approval. The first answer wins. |
| `GET /api/log?after=<seq>&task=<id>` | Log events, both filters optional (cursor polling) |
| `GET /api/log/stream?after=<seq>&task=<id>` | The log as Server-Sent Events: replays from `after`, then streams new events live. For Elastic and Jira to follow without polling files. |
| `GET /api/apps` | Apps from tracks: `{name, title, href, track}`. Open `/t/<track><href>`. |
| `GET /api/health` | `{ok, startedAt, resumed: [taskId...], tasks, tools, spacetime: {port, database}}`. `resumed` is the tasks boot restarted after a power cut, for the screen's session-restore banner. |
| `GET /api/boxes` | This box and its peers (`BOX_PEERS`), so one portal lists and drives several boxes (the Vultr second box): `[{id, name, stdb, self}, ...]` |
| `POST /api/pair/start` | Mint a one-time pairing code for the box screen's QR: `{code, url, expiresAt, box}` (localhost) |
| `POST /api/pair {code, name}` | A phone redeems the code for its own device token: `{token, box:{id,name}, device}`. One-time. |
| `GET /api/devices`, `DELETE /api/devices/<id>` | List paired phones; revoke one |
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

**Pairing a phone, and more than one box.** The box screen shows a QR of a one-time code (`POST /api/pair/new`);
a phone scans it and redeems the code for its own device token (`POST /api/pair`). Any phone at the judging
table pairs this way for the Hacker's Choice demo. A phone sends its token as `Authorization: Bearer <token>`
when it approves, so the log records which phone said yes; revoke it with `POST /api/pair/devices/<id>/revoke`
and that token stops working. Set `BOX_URL` (the image sets it from the box's address at first boot) and `POST /api/pair/start` returns an
absolute `url`, so the QR on the box's screen opens on a phone. `GET /api/boxes` lists this box plus the peers named in the `BOX_PEERS`
environment variable (JSON array of `{id, name, url, stdb}`), so one portal shows and drives several boxes.
Each entry is `{id, name, url, stdb, self?}`; this box's own `url` comes from `BOX_URL`.

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

The `approval` table carries `costCents`, `payee` (who gets paid, or the host) and `purpose`, so the phone can
fill its amount and "to" rows. A tool supplies them with an optional `approval(input)` returning `{ payee, purpose }`.

`answer({id, approved, by})` only works from a connection the box has **vouched for**: the box's own screen or a
paired phone, after it tells the box its SpacetimeDB identity with `POST /api/pair/identity {identity}` (64 hex
characters, `identity.toHexString()` after connecting; accepted from the box's own screen, or from a phone with its
token). The answer is recorded under the vouched name (`box screen`, or the phone's device name); the `by` the
caller sends is ignored, and any other connection is refused. The first answer wins, and the box writes it to the
log within milliseconds. `putTask`, `putApproval`, `registerDevice` and `removeDevice` are for the box only.
This is a second lock: SpacetimeDB also listens on loopback only (see *Who may reach the API*).

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
