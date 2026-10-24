# The core: how the box works, and how a track plugs in

The core is one Node service that runs as root on the box. The types are in `contract.ts`. This page is the
short version. Read `tracks/example/` for working code of every slot.

## Tasks

A task is a piece of agent work: a prompt, a workspace (a folder of files), the tools it may use, the hosts
its network may reach, and a budget. States: `queued`, `running`, `waiting` (for an approval), `done`,
`failed`, `undone`.

Each task runs as its own Linux user (`box-<id>`, uid 30000 to 39999, no sudo, no shell) in its own
overlayfs copy of the workspace. Its changes stay in its own layer. When it finishes, that layer goes on top
of the workspace's view. **Undo** takes one layer out of the stack. Other tasks keep theirs, and the base
files are never written.

The worker inside a task is Droid with Claude (`worker: 'droid'`), or a scripted fake for tests
(`worker: 'fake'`, see `workers/fake.ts`).

## The action log

`BOX_HOME/log.jsonl`, one JSON event per line, append-only, fsynced per line. Every state change, step, tool
call and result, approval, cost and blocked connection is in it. At boot the core rebuilds every task from it
and resumes what was running. SpacetimeDB only mirrors live status and approvals; the log is the truth.

## The broker and the vault

A task never holds a secret. The vault is `/etc/box/vault.env` (root only, `KEY=value`). A task asks its
broker, a Unix socket only its user can open, to run a tool by name. The tool runs inside the core, reads
the secrets it declared, and returns a result. That result goes into the log, so **never return a secret**.

Worker side of the socket (`BOX_SOCKET` in the worker's environment), JSON over HTTP:

| Request | Does |
|---|---|
| `GET /task` | The task, plus the steps it already logged (to resume) |
| `POST /step {text, data?}` | Log progress: a plan, a step, a diff |
| `POST /call {tool, input, key}` | Run a tool. Above the remaining budget it asks for an OK first. A key already answered returns the logged result, so a resumed task never pays twice. |
| `POST /ask {question, key}` | Pause for an OK, returns `{approved}`. The same key returns the same approval. |
| `POST /cost {cents, what}` | Count model spending |

## Approvals

`POST /ask`, or a tool call over budget, writes `approval.asked` and sets the task to `waiting`. Anyone
answers with `POST /approvals/<id> {approved, by}` on the box's API (and soon through SpacetimeDB from the
portal and phone). The first answer wins. The task carries on, and other tasks never stop.

## Cost

Tools declare `cost(input)` in US cents. The broker counts it when the call succeeds. Workers report model
spending with `POST /cost`. `task.costCents` is the total.

## Writing a track

Make `tracks/<name>/track.ts` and default-export a `Track` with any of these slots:

| Slot | What the core does with it |
|---|---|
| `triggers` | Calls `start(box)` once at boot. Call `box.createTask(...)` whenever you like. |
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

## Your demo step

Make `tracks/<name>/demo.ts` that default-exports `async (d: DemoKit) => { ... }` and calls `d.check(...)`
for each thing your part shows. `./demo` runs it after the four moments on a fresh box with every track
loaded. Keep it under about 10 seconds. Test-mode keys go in `/etc/box/vault.env` on the test VM; the demo
copies them into each run's vault.

## The box's API

`127.0.0.1:7700` and `BOX_HOME/api.sock` (root only). JSON.

| Request | Returns |
|---|---|
| `GET /tasks`, `POST /tasks {TaskSpec}` | Tasks, or the new task |
| `GET /tasks/<id>` | `{task, events}` |
| `POST /tasks/<id>/undo` | The task |
| `GET /approvals`, `POST /approvals/<id> {approved, by}` | Approvals |
| `GET /log?after=<seq>` | Log events |
| `GET /apps`, `GET /health` | Apps; status |
| `/t/<track>/...` | Track routes |

## Running it

```
./demo                  # the merge gate, on a test VM
npm test                # unit tests, any machine
npm run check           # type check
sudo npm run box        # the service itself, on a test VM only
```
