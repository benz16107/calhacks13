---
title: Triggers
description: Triggers start GurtOS tasks without you, on a schedule, from a webhook, when a file arrives or from a chat. Each turns an event into a task spec.
---

You can start a task by hand through the [HTTP API](/reference/http-api/), and the apps on the box start tasks from their own pages and chats. The portal has no button for a new task yet. Most agent work on an always-on box starts some other way: at night, when a ticket is filed, when a receipt lands in a folder, when you ask in a chat. A trigger is the code that turns such an event into a task.

## How triggers work

A trigger is an object in an app's `triggers` slot with a `name` and a `start(box)` function. The core calls `start` when the app turns on: at boot, after the API is up, or when the owner turns the app on again. It passes a `Box` handle. From then on the trigger can call `box.createTask(spec)` whenever its event happens.

`start` may return a function that stops the trigger. Then the app can be turned off without a restart. The generic triggers below all do this. A trigger that returns nothing keeps running until the box restarts, and the app reports `restartNeeded` when you turn it off.

Because `start` runs at every boot, a trigger re-arms itself after a restart. A schedule keeps its timing, a webhook is served again, and a file watcher watches again.

Every task a trigger starts records where it came from in `source`, so the portal and the log show "schedule", "webhook", "jira:BOX-12" or "asi1" next to it. If the trigger does not set `source`, the core uses the app's name.

## The three generic triggers

GurtOS ships three triggers that any app can reuse from `core/triggers.ts`. Each takes a `task` function that turns its event into a `TaskSpec`. Return nothing to skip the event.

```ts
import { schedule, webhook, onFileChange } from '../../core/triggers.ts';

triggers: [
  schedule({ name: 'nightly', dailyAt: '02:00', task: () => ({ title: 'Nightly report', prompt: '...' }) }),
  webhook({ name: 'ticket', task: (payload) => ({ title: payload.issue, prompt: `Fix ${payload.issue}` }) }),
  onFileChange({ name: 'inbox', dir: '/var/lib/box/inbox/receipts', task: (file) => ({ title: file, prompt: `File ${file}` }) }),
],
```

### Schedule

`schedule` runs on a fixed interval with `everyMs`, or once a day at `dailyAt: 'HH:MM'` in the box's local time. A daily schedule computes its next run from the clock each time, so it stays on time after a restart. If the `task` function throws, the error is logged and the schedule carries on.

A schedule does not catch up on runs it missed while the box was off. It fires at the next scheduled time.

### Webhook

`webhook` serves `POST /hook/<app>/<name>` on the box's API. The JSON body is the payload, and the request headers are passed too, so the `task` function can check a signature. The response is the task the box created, or `{ok: true}` if the event was skipped.

The webhook is served on the box's API address, which listens on `127.0.0.1` by default. For a service on the internet to reach it, you need to publish that path, for example through a reverse proxy that forwards only `/hook/...`. Check the sender in the `task` function, because the core does not authenticate webhook calls.

### File change

`onFileChange` watches a folder and its subfolders. When a file is added or changed, it waits 200 ms for writes to settle, then fires once for that file with its path relative to the folder. Deleted files and folders do not fire.

The folder is created if it does not exist. Files in it are not part of any workspace. A trigger that wants a task to work on the file copies it into a workspace first.

## Writing your own trigger

Anything that can call `box.createTask` from the core can start tasks. The included apps have their own triggers:

- The ASI:One app runs a chat agent that starts a task when a paired owner asks for work.
- The shopping agent runs a check every 20 seconds and starts a purchase task when a watched price drops.
- /find starts a description task when a photo arrives that no vision model could describe.

A trigger runs inside the core, so it may read the vault keys its app lists in `secrets` with `box.secret(name)`. It must never put a secret in a task's prompt.

## Why triggers create tasks, not actions

A trigger could call an API directly. GurtOS has it start a task instead, so the work gets everything a task gets: its own user and files, its own hosts, a budget that asks before spending, a place in the log, and undo. A task started at 2 AM by a schedule waits for your OK the same way as one you started by hand.

## Related

- [Schedule a routine](/guides/schedule-a-routine/)
- [Apps and slots](/concepts/apps-and-slots/)
- [App SDK](/reference/app-sdk/)
- [Reach GurtOS from ASI:One](/guides/asi-one/)
