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
budget check and overspend. A tool's optional `approval(input)` returns `{ payee, purpose }` for the approval. On GurtOS Business, a tool that records a decision declares `decides(input)` (see Shadow mode). A Droid task's model cost is real: the worker reports its token counts and model, and the core
prices them at the model's list rates (`core/pricing.ts`), writing a `cost` event with `model` and a `tokens`
breakdown. `task.costCents` is tool spending plus model cost. Workers report model
spending with `POST /cost`. `task.costCents` is the total.

## One path each: where every app plugs in

Several apps need approvals, spending rules, guest requests and a pause. Each has **one** path in the core. Build on
it; don't keep a second copy of the state in a track, or two apps (and two screens) will disagree.

**Approvals.** There is one kind of approval, made by the core and kept in the log.
- A task asks with `POST /ask` (or `box_ask` for Droid), or by calling a tool whose `cost(input)` goes over its
  budget or the owner's threshold. The core's `askFor` makes the approval, one per action (a retry reuses it),
  with `question`, `costCents`, `payee` and `purpose` (a tool fills the last two with `approval(input)`).
- Every answer goes through one function, `answer(id, approved, by)`: the API, the SpacetimeDB `answer` reducer
  (vouched connections only), a phone, a Jira or JSM button, ASI:One, a passkey. A track answers with
  `box.answer(...)`. `by` names the device or person, never what a caller typed.
- **Extend it, don't fork it.** Business adds who may answer and who was asked (`route`, checked before
  `answer`). Push notifies on `approval.asked`. A passkey (Shopper) verifies, writes a `note`, then calls
  `box.answer`. A tool that must not run without a stronger approval checks that itself before paying (for
  example, a passkey note in the log for this approval). No track keeps its own pending or approved state.

**Spending.** One budget per task, in US cents, counted by the core.
- A task's `budgetCents` (default: Settings `defaultBudgetCents`). A tool that spends declares `cost(input)`; the
  broker reserves it before the call (so parallel calls can't overspend), asks when it would go over the budget or
  over Settings `approvalThresholdCents`, and counts it in the same log line as the result. A metered tool (x402
  "upto") is checked and approved on its cap but may report `spentCents` (0 to the cap) in its output; the box
  counts that.
- **Money only moves inside a tool** that the task calls through the broker, never from a route or a log reader.
  That is what makes the budget, the approval and the log cover every payment (wallet, x402, Stripe, Visa).
- New spending rules (a per-merchant cap, a mandate, a daily limit) belong in this check in the core
  (`runTool`, next to the threshold), as Settings, so every paying app obeys them. Ask the core thread.

**Guest requests** (a stranger asks the box for something: a Mana page, an ASI:One chat). One path, shared by
every front door: the request becomes a task that first waits for the owner's OK (an approval, as above), runs
with no owner files and only the network and tools it was given, a small budget, and is undone if nobody answers.
The limits (kinds allowed, per-guest and overall rate, how many may wait) are kept in one place, so two front
doors can't double them. Until it moves into the core, Mana's `tracks/mana` route is that path, and other front
doors (Fetch) call it rather than keep their own.

**Pausing.** Settings `paused` is the only pause: no task starts, running ones hold before their next step, tool
call or question. Personal's switch and Business's kill switch both set it (Business may also freeze task units
on top, and thaws before resuming).

**Who is calling.** A track route reads `x-box-caller` (set by the box). Business adds a person. Never trust a
name, person or role the caller sends in the body.

**Looking back.** The log is append-only and every task, approval and cost is rebuilt from it, so "as of a date"
is a fold over the events up to that time (`GET /api/log`, filter by `at`). It needs no core change, and nothing
may rewrite the log.

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
| `x-box-caller` | Not a slot: a header on the Request every route gets, set by the box (a copy the caller sends is replaced): `screen` (the box's own screen), `owner` (a phone paired as the owner), `device:<id>` (another paired phone), `service` (a helper on the box) or `none` (an open route reached through a proxy with no token). On a Business box, `x-box-person` carries the calling person's id (absent otherwise); the `box` the route gets already acts as that person. |
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
only open routes are `GET /api/health`, `POST /api/pair` (redeeming a pairing code), the work-account sign-in
(`GET /api/sso`, `/api/sso/start`, `/api/sso/callback` and `POST /api/sso/redeem`, below) and the portal's own pages
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

## Business edition: people, roles and a policy

GurtOS Business is one box shared by a company. People hold roles, agents hold seats, and a policy in plain words
sends each approval to the people who may answer it. It is off unless turned on, so a Server or Personal box
behaves exactly as before. The code is `business.ts` (pure rules, tested in `business.test.ts`) and `box.ts`.

**Turning it on.** `PUT /api/business {on: true, company, policy}` from the owner (the box's own screen, or an
owner phone), or `BOX_EDITION=business` for a new box. `GET /api/system` then says `edition: "business"`. Turning it
off (`{on: false}`) keeps the people and the policy for next time.

**People.** `GET /api/people`, `POST /api/people {id?, name, role, title?, limitCents?, approvesFor?}` (add, or change
the fields named for an id that exists) and `DELETE /api/people/<id>` are for an admin or the owner. Roles:

| Role | May |
|---|---|
| `owner` | Everything an admin may, plus the owner's controls (settings, keys, apps). Approves within the policy |
| `admin` | People, the policy, pairing people's phones, the kill switch. Approves what the policy sends to them |
| `approver` | Answers what the policy sends to them, up to `limitCents` (required) |
| `requester` | Starts tasks and sees their own requests. Never answers one |
| `auditor` | Reads everything, including the audit. Every request that is not a `GET` is refused |

`approvesFor` holds the names the policy uses ("Controller", "IT"). **Signing in:** `POST /api/people/<id>/pair`
returns a one-time pairing code for that person; a phone or a laptop's browser redeems it with `POST /api/pair` as
usual, and every request with that device's token is that person. Removing a person revokes their phones. The box's
own screen is trusted as it always was: it acts as the owner, or as a person when it sends `x-box-person: <id>`.

**The policy.** One rule per line, the first match decides, `#` starts a comment:

```
Fraud referrals go to the Controller.
Over $10,000 goes to the Controller.
Production goes to IT.
Everything else goes to any approver.
```

Which requests: `Everything` (or `Everything else`), `Over $10,000` (or `above`, `more than`), words the request
contains (`Fraud referrals`), `Requests from the credit desk` (the app), or words with an amount (`Payments over
$500`). Who: a name people approve for (`the Controller`, `IT`), or a role (`any approver`, `an admin`, `the owner`).
A request matching no rule goes to the owner. `PUT /api/business {policy}` refuses a line it can't read and names it.

**Rules from outside** (Mana drafts them in a chat). A track reads the rules with `box.policy()` and proposes new text
by starting a task that asks for an OK whose question carries `[policy <hash>]` (the first 12 hex characters of the
text's SHA-256). Once that request is approved, `box.setPolicy(text, approvalId)` applies the text, but only if the
request came from one of the track's own tasks and was approved by an owner or an admin, never by an approver, an agent
or the app. Each new line's "Changed by" names that person and the text's `# source:` line. A rule such as "Rule
changes go to an admin." sends those requests to the right people.

**The owner is the backstop.** An owner may answer any request within their limit (never their own). A request goes
to the owner only when nobody who approves for its name can (they asked for it, or it is above their limit), so one
person away never stops the work.

**Routing.** When a task asks, the approval records `askedBy` (the person who started the task) and `route`:
`{rule, to, amountCents, people, why}`, the rule that matched, who it goes to, the people who could approve it then,
and one sentence such as "Over $10,000 goes to the Controller. Rosa Delgado can approve it." The amount is the
spend or the largest dollar figure in the question, whichever is larger.

**Who may answer** (`POST /api/approvals/<id>`, and `box.answer` from a track), checked again at the moment of the
answer against the people as they are now. Each refusal is a `403` with the reason and a `business` note in the log.

1. Only a person. A tool, a trigger, a log reader, a helper service on the box (running as nobody or a task user) or
   a screen that has not said who it is gets "Only a person can answer". No agent approves an agent.
2. Never your own request: "You asked for this, so someone else has to answer it."
3. Only an owner, admin or approver, and only what the policy sends to a name they approve for.
4. Approving only within your limit. Denying above it is allowed.

The answer records `by` (the person's name) and `person` (their id). A track route called from a person's phone
gets a box bound to that person: its tasks are asked by them, and its answers are theirs. SpacetimeDB's `answer`
reducer is closed on a Business box (the box vouches for no identity), so every answer goes through these checks.

**Waiting for me.** `GET /api/me` returns `{person, company, edition, paused, directory, waiting, requests}`: the
requests this person may approve now, and their own requests (the last 50, newest first, answered ones too), each with
its route. `directory` is every person's id, name, title, role, limit and approvesFor (no phones), so any screen,
an auditor's too, can name who asked and who may approve. `GET /api/approvals?for=me` is
`waiting` alone. Each `approval.asked` event carries the route, so a screen following the log stream can notify only
the people in it.

**The audit.** On a Business box every event of a task carries `who: {asked, seat, approver}` (or `trigger` for a
task no person started, like `schedule`), and a person's own actions carry `who: {by}`. `seat` comes from the task's
`seat` field (`POST /api/tasks {seat: "Credit analyst"}`). `approver` is the person who gave an answer, and on the
task's later events the last person who approved one of its requests. `GET /api/audit?person=&seat=&app=&from=&to=`
returns rows `{seq, at, event, task, title, app, seat, asked, approver, by, what}`; `GET /api/audit.csv` is the same
rows as a CSV file (a cell that starts like a formula gets a leading `'`). For an auditor, an admin or the owner.

### Sign in with a work account (Microsoft Entra ID)

**Why it is here: the path to production.** A company already keeps its people and their groups in Microsoft Entra ID
(or another OpenID Connect provider). With this on, people sign in to the box with their work account, and their role
comes from their Entra groups. Joining, leaving and moving to another team happen in Entra, in one place, instead of
an admin pairing each phone with a code. Pairing still works beside it. The code is `sso.ts` (pure checks, tested in
`sso.test.ts`), the routes in `box.ts`, and `./demo` runs the whole flow against a small provider of its own
(`sso-demo.ts`), so the merge gate needs no internet.

**The flow** is the standard authorization code flow with PKCE:

1. The pairing page asks `GET /api/sso` (open: it returns only `{on, name}`) and shows "Sign in with your work account".
2. `GET /api/sso/start` sends the browser to the provider's sign-in page (from its discovery document) with `state`, a
   `nonce` and a PKCE challenge (S256). A cookie ties the sign-in to that browser. At most 200 sign-ins wait at once,
   each for 10 minutes.
3. The provider sends the browser to `GET /api/sso/callback` on the address the person used. The box checks the state
   and the cookie, trades the code for an ID token (with the client secret from the vault and the PKCE verifier), and
   checks the token: RS256 only, signed by one of the provider's keys (`jwks_uri`, fetched again once for a key it has
   not seen), `iss` exactly the configured issuer, `aud` this app (and `azp` when there are several), not expired, and
   the `nonce` of this sign-in.
4. The `groups` claim gives the role (below). The person is added, or updated if they signed in before. Their id
   (`sso-` and 12 hex characters) comes from the issuer and the subject, so it stays the same at every sign-in. Name
   and address come from the claims; the address stays in the box's state (`GET /api/people` for admins, `GET
   /api/me` for themselves), never in the log.
5. The box sends the browser to `/#sso/<one-time code>` and the page redeems it with `POST /api/sso/redeem {code}`
   for a device token bound to that person, exactly as pairing a phone for them does. No token is ever in an address.
   The code works once, for 2 minutes.

Each sign-in is a `business` note: `{sso: "signed in", person, idp, role, limitCents, approvesFor}`. Each refusal is
`{sso: "refused", idp, why}`: no mapped group, another domain, a bad signature, another app or issuer, a replayed token,
a used or expired sign-in, another browser. Notes never hold an address, a token or the secret.

**Groups to roles.** `groups` maps a group id (Entra: the group's Object ID) to `{role, approvesFor?, limitCents?}`.
Someone in several mapped groups gets the strongest role (owner, admin, approver, requester, auditor, in that order),
every name those groups approve for, and the highest limit among that role's groups. Someone in **no** mapped group is
refused: "Your work account is not in a group that may use this box." If they had signed in before, they are removed
from the people and their devices stop working at once, so taking someone out of the group in Entra takes them off the
box at their next sign-in. A group gives `owner` only when the mapping says so, and only the owner can write such a
mapping.

**Setting it up** (the owner, or an admin). The secret goes to the vault, the rest to `PUT /api/business`:

```
PUT /api/vault/SSO_CLIENT_SECRET {"value": "<the client secret's value>"}      (the owner)
PUT /api/business {"sso": {
  "name": "Fogline (Microsoft Entra ID)",
  "issuer": "https://login.microsoftonline.com/<directory (tenant) id>/v2.0",
  "clientId": "<application (client) id>",
  "secretKey": "SSO_CLIENT_SECRET",
  "domain": "fogline.example",
  "groups": {
    "<Fogline Controllers object id>": {"role": "approver", "approvesFor": ["Controller"], "limitCents": 5000000},
    "<Fogline IT object id>": {"role": "admin", "approvesFor": ["IT"]}
  }
}}
```

`secretKey` must start with `SSO_`, because the box sends that key to the provider and must never be able to name
another key in the vault. `domain` is optional: only addresses at it may sign in. `{"sso": null}` turns it off. The
change is a `business` note with who made it; `GET /api/business` shows the settings (never the secret).

**In Microsoft Entra** (the Entra admin center, `entra.microsoft.com`, as an admin of the tenant):

1. **App registrations, New registration.** Name it (for example "GurtOS Business"). Supported account types:
   "Accounts in this organizational directory only (single tenant)". Redirect URI: platform **Web**,
   `https://<the box's address>/api/sso/callback`, the address people open the portal at. Entra allows plain `http`
   only for `localhost`, so a box tried on the same machine uses `http://localhost:7700/api/sso/callback`. Add one
   redirect URI for each address people use.
2. On the app's **Overview**, copy the **Application (client) ID** into `clientId`, and the **Directory (tenant) ID**
   into `issuer`: `https://login.microsoftonline.com/<directory id>/v2.0`. That address is exactly the `issuer` in
   `https://login.microsoftonline.com/<directory id>/v2.0/.well-known/openid-configuration`; check it there.
3. **Certificates & secrets, Client secrets, New client secret.** Copy its **Value** (Entra shows it once, and the
   Secret ID is not it) into the vault as `SSO_CLIENT_SECRET`. Note when it expires, and put the new one in the
   vault before then.
4. **Token configuration, Add groups claim.** Tick **Security groups**, and under **ID** choose **Group ID**. Without
   this the ID token has no `groups` and everyone is refused. If people are in more than 200 groups, Entra leaves the
   list out; choose "Groups assigned to the application" instead and assign the groups to the app under Enterprise
   applications (that needs Entra ID P1), and the box says so when it happens.
5. **API permissions.** The default Microsoft Graph `User.Read` is enough; the box asks only for `openid profile
   email`. If people cannot consent for themselves, an admin grants consent here once.
6. **Groups, New group.** Group type Security, for example "Fogline Controllers" and "Fogline IT". Add the members.
   Copy each group's **Object ID** into `groups`.

| In Entra | On the box |
|---|---|
| Directory (tenant) ID | `sso.issuer`: `https://login.microsoftonline.com/<it>/v2.0` |
| Application (client) ID | `sso.clientId` |
| Client secret, Value | the vault, under the name in `sso.secretKey` |
| Redirect URI (Web) | `https://<box address>/api/sso/callback` |
| Groups claim, ID token, Group ID | read from the `groups` claim |
| Each group's Object ID | a key in `sso.groups` |

Any other OpenID Connect provider works the same way, as long as its ID token carries a `groups` claim. Not built:
signing out at the provider, and sign-in from the hosted app (`app.gurtos.com`); a device signed in this way lasts
until it is removed, its person is removed, or a later sign-in is refused.

### Shadow mode and a one-week pilot

**Why it is here: the path to production.** A company should not hand an agent its credit desk on day one. Shadow
mode is how a seat earns it, and it is GurtOS Business's answer to the "path to production" criterion: a one-week
pilot, a number that says whether the agent decides the way the company's people do, a bar written in the policy, and
one setting to go live or go back. [docs/pilot.md](../docs/pilot.md) is the plan.

- **The setting.** `PUT /api/business {shadow: ["Credit analyst"]}`, from an admin or the owner, puts seats in shadow;
  `{shadow: []}` takes them all live. Each change is a `business` note with the new list and who made it. Settings >
  People has a switch for each seat, and each seat's row says "Shadow · 18 of 20 agreed (90%)", with the
  disagreements listed below.
- **A suggestion is an ordinary request.** When a task whose `seat` is in shadow calls a tool that records a decision
  (`Tool.decides` in the contract), the core asks first with `askFor`: "Shadow: the Collections clerk would record
  "friendly reminder" for INV-24110 ($1,200 is 12 days past due). Do you decide the same?" The approval carries
  `shadow: <seat>`. The policy routes it and the usual checks decide who may answer: only a person, never the one who
  asked, within their limit. A yes runs the tool, so the person decided, and the log says so (`who.approver`). A no
  is a disagreement: the tool does not run, and the agent gets "Shadow mode: a person decided otherwise, so this was
  not recorded. Do not ask again; move on." After a yes, a tool that spends still goes through the task's budget.
- **Going live.** A policy line sets the bar: `The Credit analyst goes live after 20 suggestions with 95% agreement.`
  From the log, the box counts each seat's suggestions, the ones a person answered and the ones they agreed with.
  When the bar is met it reports `ready`, and an admin turns shadow off. The box never takes a seat live by itself:
  going live widens what an agent does alone, and on GurtOS that is a person's call, the same way no agent approves
  an agent.
- **What it reports.** `GET /api/business` adds `shadow` (the setting) and `pilot`, one entry per seat: `{seat, shadow,
  suggested, answered, agreed, percent, goLive, ready, disagreements}`. Each disagreement has its question, who
  decided otherwise and when. An answer with no person behind it (a task that ended first) does not count.
- **Which tools decide.** A tool opts in with `decides(input)`, which returns the decision in plain words. The credit
  desk marks `credit_decision`, `collections_action` and `ap_action`. `pay_bill` is not marked: its input has no
  amount, so the policy could not route the suggestion by size.

## The kill switch

One switch stops every agent on the box at once: Settings' `paused`. The owner flips it with `PATCH /api/settings
{paused}` (GurtOS Personal's top-bar and Quick Settings switch); the owner or a Business admin can also use
`POST /api/pause` and `POST /api/resume`, which set the same setting. Either way, each running task's systemd unit is
frozen at once (SIGSTOP to its user where the freezer is missing), a task that would ask, call a tool or log a step
waits, a new task stays `queued`, and a reboot keeps it paused. Approvals can still be answered. Resuming thaws every
task and starts the queued ones. Each pull is a `kill-switch` note with who pulled it and from which phone or screen.
`GET /api/pause` (`{paused, by, at, via}`), `GET /api/system` (`paused`) and `GET /api/health` say whether it is on.
Measured on a live run with 10 agents (3 Droid seats on Claude): stopped in 137 ms, every unit frozen in 271 ms, no
agent event while paused, a bad batch undone in 48 ms. `docs/drill.md` has the drill and how to run it
(`core/drill.ts`).

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
| `DELETE /api/pair/self` | A paired device revokes itself (the app's Forget): its token and push subscription stop working |
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

## Remote access and push notifications

**Reach this box from anywhere** (opt in, owner only) gives the box its own address, `https://<name>.box.gurtos.com`,
through the GurtOS relay (`relay/README.md`). The box opens an outbound tunnel (frpc), so nothing is forwarded at
home, and gets its own Let's Encrypt certificate (Caddy on 127.0.0.1). TLS ends on the box: the relay passes the
encrypted bytes by name and cannot read them. Requests through it carry `X-Forwarded-For`, so they need a paired
device's token like any other off-box request. Code: `core/remote.ts`. State: `BOX_HOME/remote.json`,
`BOX_HOME/remote/`, and the box's relay secret in the vault as `BOX_RELAY_SECRET`.

| Request | Does |
|---|---|
| `GET /api/remote` | `{enabled, name, url, state: off, starting, connected or error, error?, relay}`. Checks the address again at most every 30 s. |
| `GET /api/remote/name/<name>` | Owner. Asks the relay: `{name, available, reason?}` |
| `POST /api/remote {name}` | Owner. Enrolls the name, starts the tunnel and TLS, returns `state: starting`; poll until `connected` (5 to 60 s for a new certificate). Names: lowercase letters, digits and hyphens, 3 to 30 characters, some reserved. |
| `DELETE /api/remote` | Owner. Stops both, releases the name at the relay (`released`), removes the secret. The certificate is kept for next time. |

While it is on, `POST /api/pair/start` returns `url: https://app.gurtos.com/pair?box=<name>.box.gurtos.com#<code>` (the
GurtOS app adds the box to its machines) and `boxUrl`, the box's own `https://.../pair#<code>`; `GET /api/boxes`
reports the https address. The API allows CORS from `https://app.gurtos.com` (always) and `BOX_ORIGINS`.

**Push notifications** reach the GurtOS app on a phone. The app subscribes once with the relay gateway's VAPID key
and gives each box the subscription plus a 32-byte key it made for that box. On `approval.asked`, the box pushes to
the phones that should answer: on Business, the people in `approval.route.people` (never `askedBy`); on Server and
Personal, phones paired as the owner. Settings `quietHours` hold pushes back (the request still waits in the inbox).
Pushes need remote access on: they go through the relay's gateway, authenticated with the box's secret. The box
encrypts each one for the phone (RFC 8291), so the gateway forwards bytes it cannot read. Code: `core/push.ts`.

| Request | Does |
|---|---|
| `GET /api/push` | `{subscribed, remote}` for the calling device |
| `PUT /api/push {subscription, key}` | A paired device only (the box's own screen gets `403`). `subscription` is `pushManager.subscribe().toJSON()`; `key` is 32 random bytes, base64url, for this box. |
| `DELETE /api/push` | Turn notifications off for this device |
| `POST /api/push/test` | Send this device a test push: `{sent: 1}`, or `409` when remote access or notifications are off |

The decrypted push is JSON: `{v: 1, type: 'approval' or 'test', machine: <box id>, box: <box name>, url: <box https
origin>, id, task, source, title, body, costCents, mac}` (`source` is the task's, like `shopper:...`). `mac` is base64url HMAC-SHA256 with the device's key for this box
over the JSON of every other field, keys sorted. The app checks it before it shows a push as this box's or acts on
Approve or Deny.

## Running it

```
./demo                  # the merge gate, on a test VM
npm test                # unit tests, any machine
npm run check           # type check
sudo npm run box        # the service itself, on a test VM only
```
