---
title: Log events
description: Every event type in the action log, its fields, an example line for each, and how the box writes and reads log.jsonl.
---

The action log is `BOX_HOME/log.jsonl`: one JSON object per line, in the order things happened. The box rebuilds every task and approval from it at boot. For what the log is for, read [The action log](/docs/concepts/action-log/).

## How the file is written

- **Append only.** The box never rewrites or deletes a line.
- **One write per event, then `fsync`.** An event the API has answered for is on disk.
- **Mode `0600`, owned by root.** Tasks cannot read it.
- **A torn last line is dropped at boot.** A hard power cut can leave half a line at the end. At boot the box cuts the file back to the last newline, counting in bytes, and reads every complete line before it. No complete line is ever lost or changed.
- **A full disk loses only the event.** If the disk fills part way through a line, the box cuts the half line off again and the call that wrote the event fails. The next event starts on a clean line.
- **A task cannot flood it.** The log stays in the box's memory, so a task may write at most 64 KB in one step, question or cost, and 20 MB in all through its broker. A bigger step gets a `413`, and a task past 20 MB gets a `429`. Nothing is written for either. A tool call's input counts toward the 20 MB but not the 64 KB. The count starts again when the box restarts.
- **Vault keys never appear.** Before an event is written, the value of any vault key named `*KEY`, `*TOKEN`, `*SECRET`, `*PASSWORD` or `*ACCESS`, if it has 8 or more characters, is replaced with `[a vault key]`. A value kept under another name, such as `ATLASSIAN_SITE`, is not hidden.

## Fields on every event

| Field | Type | Meaning |
|---|---|---|
| `seq` | integer | The line number, from 1. Use it as a cursor. |
| `at` | string | ISO 8601 time the box wrote it |
| `type` | string | One of the types below |
| `prev` | string | SHA-256 (hex) of the previous line as written, without its newline. The first line holds 64 zeros. A log written before the chain existed starts without it. An edit in the middle breaks the chain after it. Nothing signs the log, so root can rewrite the whole chain. |
| `task` | string, optional | The task the event belongs to |
| `who` | object, optional | GurtOS Business only, while it is on: `asked` (the person who asked for the task), `trigger` (its source, when no person started it), `seat`, `approver` (the person who gave the last approval) and `by` (a person's own action that is not part of a task, such as the kill switch) |

The example lines below leave out `prev` to stay short.

## Event types

| Type | Written when |
|---|---|
| [`task.created`](#taskcreated) | A task is created |
| [`task.state`](#taskstate) | A task changes state |
| [`task.step`](#taskstep) | The worker reports progress |
| [`tool.call`](#toolcall) | A tool starts running for a task |
| [`tool.result`](#toolresult) | A tool finishes, or a call is refused |
| [`approval.asked`](#approvalasked) | A task asks for an OK |
| [`approval.answered`](#approvalanswered) | Someone answers |
| [`cost`](#cost) | Model use or other spending is counted |
| [`net.blocked`](#netblocked) | The proxy or the firewall refuses a task's connection |
| [`keep`](#keep) | A task on a real folder (GurtOS Personal) waits for the owner, or is kept, stopped by a conflict or reverted |
| [`note`](#note) | An app, or the core, writes something of its own |

### `task.created`

| Field | Type | Meaning |
|---|---|---|
| `task` | string | The new task's id |
| `spec` | `TaskSpec` | The full spec, with every default filled in. For a `droid` task it holds the exact `model` id the task will run on, and the prompt ends with anything an app handed over. On GurtOS Personal it can also hold `folder` and `folders`. |
| `user` | string | The Linux user it will run as |
| `requestedBy` | string, optional | GurtOS Business: the id of the person who asked for the task |

```json
{"seq":1,"at":"2026-10-24T09:12:03.411Z","type":"task.created","task":"t3k9x2a1b2","spec":{"workspace":"home","worker":"droid","tools":[],"hosts":[],"budgetCents":25,"source":"api","title":"Fix the failing test","prompt":"Fix the failing test in this project.","model":"claude-sonnet-5-5"},"user":"box-t3k9x2a1b2"}
```

### `task.state`

| Field | Type | Meaning |
|---|---|---|
| `task` | string | |
| `state` | `TaskState` | The new state |
| `layers` | string[], optional | On the move to `running`: the done tasks whose changes this task sees, newest first |
| `error` | string, optional | On `failed`: why, as a sentence a person can read, such as `Your Anthropic key was not accepted. Change it in Settings, Keys.` The core maps common causes (a rejected key, a busy model, no internet, a full disk) to plain words. Otherwise it is the worker's own last error line, cut to 300 characters. |
| `summary` | string, optional | A summary, if one was recorded |

The states are `queued`, `running`, `waiting` (the task asked for an OK), `done`, `failed` and `undone`. A `done` or `failed` task can only move to `undone`, and `undone` is final. The core does not write `task.state` again on a restart: a task that was `running` or `waiting` keeps its state and starts again.

```json
{"seq":2,"at":"2026-10-24T09:12:03.502Z","type":"task.state","task":"t3k9x2a1b2","state":"running","layers":["t2m8b4c9d0"]}
```

```json
{"seq":9,"at":"2026-10-24T09:13:12.004Z","type":"task.state","task":"t7p1q5r2s3","state":"failed","error":"Your Anthropic key was not accepted. Change it in Settings, Keys."}
```

### `task.step`

| Field | Type | Meaning |
|---|---|---|
| `task` | string | |
| `text` | string | A plan, a step, a summary |
| `data` | any, optional | What the worker needs to resume, or extra detail. `{summary: true}` marks the worker's closing message, which becomes the task's summary. |

The worker writes most steps through its broker. The core writes some too: `Handed over N memory block(s)` when apps hand the agent what they remember, the message a Droid task shows while a new computer is still downloading Droid, and the `kept N change(s)` and `keep found a conflict` lines beside a [`keep`](#keep) event. A task's tools can add steps with `ctx.log`.

```json
{"seq":3,"at":"2026-10-24T09:12:05.118Z","type":"task.step","task":"t3k9x2a1b2","text":"Droid started (claude-sonnet-5-5, high autonomy)","data":{"session":"a1b2c3d4"}}
```

### `tool.call`

| Field | Type | Meaning |
|---|---|---|
| `task` | string | |
| `key` | string | The broker key for this call. The same key after a restart returns the logged result instead of running the tool again. |
| `tool` | string | The tool's name |
| `input` | any | The input the task sent |

```json
{"seq":5,"at":"2026-10-24T09:12:40.771Z","type":"tool.call","task":"t3k9x2a1b2","key":"mcp.example.spend.5e1f0a9b2c3d.1","tool":"example.spend","input":{"cents":1,"on":"a test"}}
```

### `tool.result`

| Field | Type | Meaning |
|---|---|---|
| `task` | string | |
| `key` | string | Matches the `tool.call` |
| `ok` | boolean | Whether the tool succeeded |
| `output` | any, optional | What the tool returned |
| `error` | string, optional | Why it failed, or `not approved` |
| `cents` | number, optional | What the call spent. It counts toward the task's cost on this line, once. |

A call the box refuses before it runs (an owner's denial of a spend, a permission turned off in Settings, a shadow-mode denial) has a `tool.result` with `ok: false` and no `tool.call` before it. A call that is waiting for an OK writes no result yet.

```json
{"seq":8,"at":"2026-10-24T09:12:44.210Z","type":"tool.result","task":"t3k9x2a1b2","key":"mcp.example.spend.5e1f0a9b2c3d.1","ok":true,"output":{"paid":1,"on":"a test","test":true,"spentCents":1},"cents":1}
```

### `approval.asked`

| Field | Type | Meaning |
|---|---|---|
| `task` | string | |
| `approval` | `Approval` | The full approval, with `state: "pending"` |

The approval's `id` starts with the task's id and says who asked:

| Id | Asked by |
|---|---|
| `<task>.budget.<tool>:<hash>` | The box, when a tool call would spend past the task's budget, past the owner's always-ask amount or past an app's daily limit |
| `<task>.shadow.<tool>:<hash>` | The box, for a Business shadow-mode decision |
| `<task>.tool.<call>.ask.<hash>` | A tool, through `ctx.ask`. `<call>` is the broker key of the call. |
| `<task>.task.<key>` | The task itself, through `/ask` or `box_ask`. The box adds `task.` in front of the key the task chose, so a task can never pick the id of a budget or tool question and approve it early. |

The same question under the same key gives the same approval, even after a restart.

```json
{"seq":10,"at":"2026-10-24T09:13:01.006Z","type":"approval.asked","task":"t3k9x2a1b2","approval":{"id":"t3k9x2a1b2.budget.example.spend:9f2c41d07a6be315","task":"t3k9x2a1b2","question":"Spend $8.00 to Test Vendor on example.spend (test spend on a GPU hour)? Budget $5.00, spent $0.00.","costCents":800,"payee":"Test Vendor","purpose":"test spend on a GPU hour","state":"pending"}}
```

### `approval.answered`

| Field | Type | Meaning |
|---|---|---|
| `task` | string | |
| `id` | string | The approval's id |
| `approved` | boolean | |
| `by` | string | Who answered: a paired device's name, what the box's own screen sent (`box screen`, `portal`, `phone` or `desktop:<name>`), `jira:<name>`, `asi1`, `undo`, `task ended` |
| `person` | string, optional | GurtOS Business: the id of the person who answered |
| `via` | string, optional | GurtOS Business: the phone or screen the answer came from |

Only the first answer is written. An answer from a paired device always carries the device's name, whatever the request said. When the device reports how it checked you, the name carries it, as in `Rosa's Watch (Face ID, reported)`. On a Business box `by` is the person's name. `undo` and `task ended` mark approvals the box closed itself, with a denial, because the task was undone or stopped.

```json
{"seq":11,"at":"2026-10-24T09:14:22.540Z","type":"approval.answered","task":"t3k9x2a1b2","id":"t3k9x2a1b2.budget.example.spend:9f2c41d07a6be315","approved":true,"by":"My phone"}
```

### `cost`

| Field | Type | Meaning |
|---|---|---|
| `task` | string, optional | The task to charge. Model jobs run for the box itself have none. |
| `cents` | number | US cents, not rounded |
| `what` | string | What it was for, such as `model`, `review` (the second look) or a tool's own label |
| `model` | string, optional | The model name, for model use |
| `tokens` | object, optional | `{input, output, cacheWrite, cacheRead}` |

```json
{"seq":14,"at":"2026-10-24T09:15:02.118Z","type":"cost","task":"t3k9x2a1b2","cents":4.86,"what":"model","model":"claude-sonnet-5-5","tokens":{"input":12000,"output":900,"cacheWrite":0,"cacheRead":48000}}
```

### `net.blocked`

| Field | Type | Meaning |
|---|---|---|
| `task` | string | The task whose connection was refused |
| `host` | string | `host:port` it tried to reach, or `DNS lookups (port 53)` for a task that asked a resolver itself. For a call to the model service that the box refuses, it is the host with the path, such as `api.factory.ai/api/connectors/tools/call`, and for a model call that asks the service to fetch something for the task, the fetched thing in brackets after it. |

Two things write it. The task's proxy writes a line for each refused name or model-service path (GurtOS relays only the Factory calls that Droid makes), and the firewall writes one for a connection that skipped the proxy, at most one per host and task every 5 seconds and one `DNS lookups (port 53)` line per task.

```json
{"seq":7,"at":"2026-10-24T09:12:43.902Z","type":"net.blocked","task":"t3k9x2a1b2","host":"attacker.example:443"}
```

### `keep`

For a task that worked on a real folder of the owner's, which GurtOS Personal links to a workspace. The core writes `pending` when such a task finishes with exit code 0.

| Field | Type | Meaning |
|---|---|---|
| `task` | string | |
| `result` | string | `pending` (done, waiting for the owner), `kept`, `conflict` or `reverted` (a Keep was undone) |
| `changes` | `Change[]`, optional | On `kept` and `reverted`: each path and whether it was added, modified or deleted |
| `conflicts` | string[], optional | On `conflict`: the files the owner changed too. Nothing was applied. |

```json
{"seq":31,"at":"2026-10-24T09:20:15.330Z","type":"keep","task":"t5h2k8m1n4","result":"kept","changes":[{"path":"intro.md","change":"modified"}]}
```

### `note`

| Field | Type | Meaning |
|---|---|---|
| `track` | string | The app that wrote it, or one of the core's own names listed below |
| `task` | string, optional | A task it is about |
| `data` | any | Whatever the app records |
| `text` | string, optional | One sentence for people, such as `Key saved: FACTORY_API_KEY`. The core writes it for its own notes, and Activity and Audit show it. |

The core writes notes under these `track` names. No note ever holds a vault value.

| `track` | What it records in `data` |
|---|---|
| `settings` | `changed`: each setting changed, with its `from` and `to` value. Pausing all agents also writes a `kill-switch` note. |
| `setup` | `step`: a setup step's id (never the answers), `finished` or `reopened`, and `channel: "open"` or `"closed"` for setup from another computer |
| `vault` | `set`: the name of a key that was saved, never the value |
| `apps` | `enabled` or `disabled`: the app's name |
| `owner` | `owner`: the Linux account that owns the box, empty when the owner was removed |
| `kill-switch` | `paused` (true or false), who pulled it (`by`, `via`) and the tasks it froze, or `drill` with an incident drill's numbers |
| `security` | `tripwire` and `where` when a task's decoy key left the task, or `diskCap` and `used` when a task passed its disk limit. Either way the box undoes the task. Also `torn`, the state files that could not be read when the box started. |
| `permissions` | `app` and `id` when an app tried something the owner turned off in Settings (`refused: true`), or `deny` and `perDayCents` when the owner changed an app's permissions |
| `share` | `workspace` and `files` (name and size in bytes) for files shared to a new task |
| `remote` | Remote access turned `on` or `off`, or the relay address chosen |
| `quickstart` | `text` for each Quick Start step, and the keys, apps and rules sent to another computer |
| `business` | GurtOS Business: changes to people, the policy, shadow mode and single sign-on, and answers the box refused |

An app writes under its own name (`find`, say) and decides what `data` holds. Those notes are not part of the core's contract. Read `track` first, then the keys you know.

```json
{"seq":20,"at":"2026-10-24T09:16:40.003Z","type":"note","track":"find","data":{"described":"home/photos/IMG_2041.jpg","model":"gemma4","ms":1840}}
```

```json
{"seq":21,"at":"2026-10-24T09:17:02.511Z","type":"note","track":"vault","data":{"set":"FACTORY_API_KEY"},"text":"Key saved: FACTORY_API_KEY"}
```

## Reading the log

| How | Use it for |
|---|---|
| A `LogReader` in an app | Every event in order, from the start, resuming after restarts. See [App SDK](/docs/reference/app-sdk/#logreader). |
| `GET /api/log?after=<seq>&task=<id>` | Polling with a cursor, optionally for one task |
| `GET /api/log/stream?after=<seq>&task=<id>` | Following live over Server-Sent Events. It replays from `after` (or the `Last-Event-ID` header), then streams new events. |
| `GET /api/tasks/<id>` | One task's events |
| The file itself, as root | Inspection and backup |

## Related

- [The action log](/docs/concepts/action-log/)
- [Resume after power loss](/docs/concepts/resume-after-power-loss/)
- [HTTP API](/docs/reference/http-api/#following-the-action-log)
