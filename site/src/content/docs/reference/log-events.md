---
title: Log events
description: Every event type in the action log, its fields, an example line for each, and how the box writes and reads log.jsonl.
---

The action log is `BOX_HOME/log.jsonl`: one JSON object per line, in the order things happened. The box rebuilds every task and approval from it at boot. For what the log is for, read [The action log](/concepts/action-log/).

## How the file is written

- **Append only.** The box never rewrites or deletes a line.
- **One write per event, then `fsync`.** An event the API has answered for is on disk.
- **Mode `0600`, owned by root.** Tasks cannot read it.
- **A torn last line is dropped at boot.** A hard power cut can leave half a line at the end. At boot the box cuts the file back to the last newline, counting in bytes, and reads every complete line before it. No complete line is ever lost or changed.

## Fields on every event

| Field | Type | Meaning |
|---|---|---|
| `seq` | integer | The line number, from 1. Use it as a cursor. |
| `at` | string | ISO 8601 time the box wrote it |
| `type` | string | One of the types below |
| `task` | string, optional | The task the event belongs to |

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
| [`net.blocked`](#netblocked) | The proxy refuses a connection |
| [`note`](#note) | An app writes something of its own |

### `task.created`

| Field | Type | Meaning |
|---|---|---|
| `task` | string | The new task's id |
| `spec` | `TaskSpec` | The full spec, with every default filled in |
| `user` | string | The Linux user it will run as |

```json
{"seq":1,"at":"2026-10-24T09:12:03.411Z","type":"task.created","task":"t3k9x2a1b2","spec":{"workspace":"home","worker":"droid","tools":[],"hosts":[],"budgetCents":25,"source":"portal","title":"Fix the failing test","prompt":"Fix the failing test in this project."},"user":"box-t3k9x2a1b2"}
```

### `task.state`

| Field | Type | Meaning |
|---|---|---|
| `task` | string | |
| `state` | `TaskState` | The new state |
| `layers` | string[], optional | On the move to `running`: the done tasks whose changes this task sees, newest first |
| `error` | string, optional | On `failed`: why |
| `summary` | string, optional | A summary, if one was recorded |

```json
{"seq":2,"at":"2026-10-24T09:12:03.502Z","type":"task.state","task":"t3k9x2a1b2","state":"running","layers":["t2m8b4c9d0"]}
```

```json
{"seq":9,"at":"2026-10-24T09:13:12.004Z","type":"task.state","task":"t7p1q5r2s3","state":"failed","error":"worker exited with 1"}
```

### `task.step`

| Field | Type | Meaning |
|---|---|---|
| `task` | string | |
| `text` | string | A plan, a step, a summary |
| `data` | any, optional | What the worker needs to resume, or extra detail |

```json
{"seq":3,"at":"2026-10-24T09:12:05.118Z","type":"task.step","task":"t3k9x2a1b2","text":"Droid started (claude-sonnet-4-6)","data":{"session":"a1b2c3d4"}}
```

### `tool.call`

| Field | Type | Meaning |
|---|---|---|
| `task` | string | |
| `key` | string | The broker key for this call |
| `tool` | string | The tool's name |
| `input` | any | The input the task sent |

```json
{"seq":5,"at":"2026-10-24T09:12:40.771Z","type":"tool.call","task":"t3k9x2a1b2","key":"mcp.wallet.quote.5e1f0a9b2c3d.1","tool":"wallet.quote","input":{"url":"http://api.localhost:4021/joke"}}
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

A refused call (denied over budget) has a `tool.result` with `ok: false` and no `tool.call` before it.

```json
{"seq":8,"at":"2026-10-24T09:12:44.210Z","type":"tool.result","task":"t3k9x2a1b2","key":"mcp.wallet.pay.77aa01c3e9f2.1","ok":true,"output":{"paid":1,"test":true},"cents":1}
```

### `approval.asked`

| Field | Type | Meaning |
|---|---|---|
| `task` | string | |
| `approval` | `Approval` | The full approval, with `state: "pending"` |

```json
{"seq":10,"at":"2026-10-24T09:13:01.006Z","type":"approval.asked","task":"t3k9x2a1b2","approval":{"id":"t3k9x2a1b2.budget.example.spend:9f2c41d07a6be315","task":"t3k9x2a1b2","question":"Spend $8.00 to Test Vendor on example.spend (test spend on a GPU hour)? Budget $5.00, spent $0.00.","costCents":800,"payee":"Test Vendor","purpose":"test spend on a GPU hour","state":"pending"}}
```

### `approval.answered`

| Field | Type | Meaning |
|---|---|---|
| `task` | string | |
| `id` | string | The approval's id |
| `approved` | boolean | |
| `by` | string | Who answered: `portal`, `phone`, a device name, `jira:<name>`, `asi1`, `undo`, `task ended` |

Only the first answer is written. `undo` and `task ended` mark approvals the box closed itself, because the task was undone or stopped.

```json
{"seq":11,"at":"2026-10-24T09:14:22.540Z","type":"approval.answered","task":"t3k9x2a1b2","id":"t3k9x2a1b2.budget.example.spend:9f2c41d07a6be315","approved":true,"by":"My phone"}
```

### `cost`

| Field | Type | Meaning |
|---|---|---|
| `task` | string, optional | The task to charge. Model jobs run for the box itself have none. |
| `cents` | number | US cents, not rounded |
| `what` | string | What it was for, such as `model` |
| `model` | string, optional | The model name, for model use |
| `tokens` | object, optional | `{input, output, cacheWrite, cacheRead}` |

```json
{"seq":14,"at":"2026-10-24T09:15:02.118Z","type":"cost","task":"t3k9x2a1b2","cents":4.86,"what":"model","model":"claude-sonnet-4-6","tokens":{"input":12000,"output":900,"cacheWrite":0,"cacheRead":48000}}
```

### `net.blocked`

| Field | Type | Meaning |
|---|---|---|
| `task` | string | The task whose connection was refused |
| `host` | string | `host:port` it tried to reach |

```json
{"seq":7,"at":"2026-10-24T09:12:43.902Z","type":"net.blocked","task":"t3k9x2a1b2","host":"attacker.example:443"}
```

### `note`

| Field | Type | Meaning |
|---|---|---|
| `track` | string | The app that wrote it |
| `task` | string, optional | A task it is about |
| `data` | any | Whatever the app records |

```json
{"seq":20,"at":"2026-10-24T09:16:40.003Z","type":"note","track":"find","data":{"photo":"photos/IMG_2041.jpg","model":"gemma4","ms":1840}}
```

## Reading the log

| How | Use it for |
|---|---|
| A `LogReader` in an app | Every event in order, from the start, resuming after restarts. See [App SDK](/reference/app-sdk/#logreader). |
| `GET /api/log?after=<seq>` | Polling with a cursor |
| `GET /api/log/stream` | Following live over Server-Sent Events |
| `GET /api/tasks/<id>` | One task's events |
| The file itself, as root | Inspection and backup |

## Related

- [The action log](/concepts/action-log/)
- [Resume after power loss](/concepts/resume-after-power-loss/)
- [HTTP API](/reference/http-api/#following-the-action-log)
