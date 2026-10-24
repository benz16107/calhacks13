---
title: The action log
description: GurtOS writes every task event to one append-only, fsynced file. It is the record of what every agent did, and the box rebuilds itself from it at boot.
---

Every agent action on a box is a line in one file: `BOX_HOME/log.jsonl`. Task creation, every step, every tool call and result, every approval and answer, every cost and every blocked connection. The log is the truth. Everything else, including the portal and the live tables, is a view of it.

## Format

One JSON object per line. Each event has a line number, a time, a type, and the task it belongs to:

```json
{"seq":214,"at":"2026-10-24T19:02:07.118Z","type":"task.step","task":"tk3m9qz1a2f","text":"Plan: list road bikes under $800 from the shop listing"}
{"seq":215,"at":"2026-10-24T19:02:09.530Z","type":"tool.call","task":"tk3m9qz1a2f","key":"mcp.apify.run.4f1c2a.1","tool":"apify.run","input":{"actor":"apify/rag-web-browser"}}
{"seq":216,"at":"2026-10-24T19:02:21.004Z","type":"tool.result","task":"tk3m9qz1a2f","key":"mcp.apify.run.4f1c2a.1","ok":true,"output":{"count":3},"cents":50}
```

`seq` starts at 1 and counts lines. The portal shows it on every step, so anything on screen can be found in the file.

The event types:

| Type | When |
|---|---|
| `task.created` | A task is created, with its full spec and its user |
| `task.state` | A task changes state, with the layers it started on, an error or a summary |
| `task.step` | The worker reports progress: a plan, a step, a diff, a final message |
| `tool.call` | A tool is about to run, with its input |
| `tool.result` | The tool returned, with its output or error and what it spent |
| `approval.asked` | A task paused for an OK |
| `approval.answered` | Someone answered, and who |
| `cost` | Model spending or other spending, with the model and token counts |
| `net.blocked` | The proxy refused a connection |
| `keep` | Personal: a decision on a task that ran on the owner's folders: pending, kept, conflict or reverted |
| `note` | Anything an app wants on the record. The core also writes notes for setup steps, settings changes, apps turned on or off, a new owner, and vault keys set, with the key's name and never its value. |

The exact fields of each are in [log events](/reference/log-events/).

## Written before it counts

The core appends each event and calls `fsync` before it acts on it. A step the log calls done is on disk. Before it logs a worker's step, the core also flushes the task's own files to disk, so a step and the file changes it describes survive a power cut together.

A hard power cut can leave half a line at the end of the file. At startup the core finds the last complete line and truncates anything after it. It works in bytes, so a multi-byte character earlier in the file cannot make it cut a good line.

## Rebuilt at every boot

The core holds no task database. At boot it reads the log from the first line and applies each event in order to rebuild every task and every approval. Then it resumes whatever was queued, running or waiting. This is why a box can lose power in the middle of work and carry on. See [resume after power loss](/concepts/resume-after-power-loss/).

Undo, too, is decided from the log. A workspace's layers are the tasks whose last state is `done`, in the order they finished.

SpacetimeDB holds a live mirror of tasks and approvals for the portal and phone. If it loses data, the core refills it from the log.

## Reading the log

From outside the box:

- `GET /api/log?after=<seq>&task=<id>` returns events after a line number, optionally for one task. Good for polling with a cursor.
- `GET /api/log/stream?after=<seq>&task=<id>` streams events as Server-Sent Events. Each event has `id: <seq>`. Reconnect with `?after=` or the `Last-Event-ID` header, and the box replays from there, then streams live.
- `GET /api/tasks/<id>` returns one task with its whole log.

From inside the box, an app uses a log reader. The core feeds it every event in order, from the first, and saves its position in `BOX_HOME/cursors/` after each one. If the reader throws, the core retries that event after 5 seconds. A reader never misses an event, even across restarts. A crash between handling an event and saving the position can hand the reader that event again, so a reader should be safe to repeat. See [apps and slots](/concepts/apps-and-slots/).

## Sending it elsewhere

Two apps follow the log out of the box:

- **Jira** turns every task into an issue with its steps, approvals, blocked attempts and diff. See [connect Jira](/guides/connect-jira/).
- **Elastic** ships every event to an Elasticsearch index and puts an agent on top that answers questions about it. See [send the log to Elastic](/guides/send-the-log-to-elastic/).

Both read with a log reader, so they catch up after a restart from where they stopped.

## What not to put in it

Tool results go into the log, and through it to the portal, Jira and Elastic. A tool must never return a secret. The test suite checks that no vault value reaches a task's files, environment or log, and several apps check their own log entries the same way.

The log is append-only. Nothing in the core edits or deletes a line. It is root-only (`0600`), so tasks cannot read it.

## Limits

- The log grows without limit. This release has no rotation or archiving.
- Every boot reads the whole file. For a long-lived box, that time grows with the log.
- A failed task's error is `worker exited with <code>` and the worker's last error message. When that message is generic, the cause is usually in the steps right before it.

## Related

- [Log events](/reference/log-events/)
- [Resume after power loss](/concepts/resume-after-power-loss/)
- [Cost](/concepts/cost/)
- [Live updates](/reference/live-updates/)
