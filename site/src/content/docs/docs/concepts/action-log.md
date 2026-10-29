---
title: The action log
description: GurtOS writes every task event to one append-only, fsynced file. It is the record of what every agent did, and the box rebuilds itself from it at boot.
---

Every agent action on a box is a line in one file: `BOX_HOME/log.jsonl`. Task creation, every step, every tool call and result, every approval and answer, every cost and every blocked connection. The log is the truth. Everything else, including the portal and the live tables, is a view of it.

## Format

One JSON object per line. Each event has a line number, a time, a type, and the task it belongs to:

```json
{"seq":214,"at":"2026-10-24T19:02:07.118Z","type":"task.step","task":"tk3m9qz1a2f","text":"Plan: buy a coffee from the test vendor","prev":"0b9ed912…"}
{"seq":215,"at":"2026-10-24T19:02:09.530Z","type":"tool.call","task":"tk3m9qz1a2f","key":"mcp.example.spend.4f1c2a9e07b3.1","tool":"example.spend","input":{"cents":50,"on":"coffee"},"prev":"de60578e…"}
{"seq":216,"at":"2026-10-24T19:02:09.534Z","type":"tool.result","task":"tk3m9qz1a2f","key":"mcp.example.spend.4f1c2a9e07b3.1","ok":true,"output":{"paid":50,"on":"coffee","test":true},"cents":50,"prev":"f355d875…"}
```

`seq` starts at 1 and counts lines. The portal shows it on every step, so anything on screen can be found in the file.

`prev` is the SHA-256 of the previous line exactly as written (shortened in the examples above). The first line's is 64 zeros. A line that is edited, removed or reordered breaks the chain after it. Nothing in the box checks the chain by itself, and nothing signs it, so anyone with root can rewrite the whole chain. On a GurtOS Business box each event also has a `who` field with the person who asked, the seat and the approver.

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

The exact fields of each are in [log events](/docs/reference/log-events/).

## Written before it counts

The core appends each event and calls `fsync` before it acts on it. A step the log calls done is on disk. Before it logs a worker's step, the core also flushes the task's own files to disk, so a step and the file changes it describes survive a power cut together.

A hard power cut can leave half a line at the end of the file. At startup the core finds the last complete line and truncates anything after it. It works in bytes, so a multi-byte character earlier in the file cannot make it cut a good line.

## Rebuilt at every boot

The core holds no task database. At boot it reads the log from the first line and applies each event in order to rebuild every task and every approval. Then it resumes whatever was queued, running or waiting. This is why a box can lose power in the middle of work and carry on. See [resume after power loss](/docs/concepts/resume-after-power-loss/).

Undo, too, is decided from the log. A workspace's layers are the tasks whose last state is `done`, in the order they finished.

SpacetimeDB holds a live mirror of tasks and approvals for the portal and phone. If it loses data, the core refills it from the log.

## Reading the log

From outside the box:

- `GET /api/log?after=<seq>&task=<id>` returns events after a line number, optionally for one task. Good for polling with a cursor.
- `GET /api/log/stream?after=<seq>&task=<id>` streams events as Server-Sent Events. Each event has `id: <seq>`. Reconnect with `?after=` or the `Last-Event-ID` header, and the box replays from there, then streams live.
- `GET /api/tasks/<id>` returns one task with its whole log.

From inside the box, an app uses a log reader. The core feeds it every event in order, from the first, and saves its position in `BOX_HOME/cursors/` after each one. If the reader throws, the core retries that event after 5 seconds. A reader never misses an event, even across restarts. A crash between handling an event and saving the position can hand the reader that event again, so a reader should be safe to repeat. See [apps and slots](/docs/concepts/apps-and-slots/).

## Sending it elsewhere

Two optional apps follow the log out of the box. Each needs an account with that service:

- **Jira** turns every task into an issue with its steps, approvals, blocked attempts and diff. See [connect Jira](/docs/guides/connect-jira/).
- **Elastic** ships every event to an Elasticsearch index and puts an agent on top that answers questions about it. See [send the log to Elastic](/docs/guides/send-the-log-to-elastic/).

Both read with a log reader, so they catch up after a restart from where they stopped.

## What not to put in it

Tool results go into the log, and through it to the portal and any app that reads it. A tool must never return a secret. The test suite checks that no vault value reaches a task's files, environment or log, and several apps check their own log entries the same way. As a backstop, the core replaces the value of any vault key whose name ends in `KEY`, `TOKEN`, `SECRET`, `PASSWORD` or `ACCESS` (8 characters or more) with `[a vault key]` in every event before it is written.

The log is append-only. Nothing in the core edits or deletes a line. It is root-only (`0600`), so tasks cannot read it.

## Limits

- The log grows without limit. This release has no rotation or archiving. Settings, Privacy & Logs offers "Keep the log for" a number of days, but the choice is only stored. Nothing deletes old events.
- Every boot reads the whole file, and the box keeps every event in memory. For a long-lived box, that time and that memory grow with the log.
- A task writes to the log through its broker: at most 64 KB per step, question or cost, and 20 MB in all since the box last started. That keeps one task from filling the box's memory with log lines.
- A failed task's error is a sentence for a person, such as "Your Anthropic key was not accepted. Change it in Settings, Keys.", or else the worker's own last error message. When that message is generic, the cause is usually in the steps right before it.

## Related

- [Verify a receipt](/docs/guides/verify-a-receipt/)
- [Log events](/docs/reference/log-events/)
- [Resume after power loss](/docs/concepts/resume-after-power-loss/)
- [Cost](/docs/concepts/cost/)
- [Live updates](/docs/reference/live-updates/)
