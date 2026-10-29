---
title: Triggers
description: Triggers start GurtOS tasks without you, on a schedule, from a webhook, when a file arrives or from a chat. Each turns an event into a task spec.
---

You can start a task by hand: **New task** in the portal's Tasks window, the same **New task** button on a phone, or the [HTTP API](/docs/reference/http-api/). The apps on the box start tasks from their own pages and chats too. Most agent work on an always-on box starts some other way: at night, when a ticket is filed, when a receipt lands in a folder, when you ask in a chat. A trigger is the code that turns such an event into a task.

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

`schedule` runs on a fixed interval with `everyMs`, or once a day at `dailyAt: 'HH:MM'` in the box's local time. `dailyAt` is a 24-hour time such as `02:00` or `17:30`. `everyMs` is from 1 millisecond to about 24 days (2,147,483,647 ms). Anything else, or neither one, makes the app fail to load, with a message that names the schedule, and the app shows `status: error`. For a longer wait, use `dailyAt`.

A daily schedule computes its next run from the clock each time, so it stays on time after a restart, and it runs once a day even if the clock moves. An interval schedule counts again from when the box started, so a restart moves its next run. If the `task` function throws, the error is logged and the schedule carries on.

A schedule does not catch up on runs it missed while the box was off. A daily one fires at its next usual time, and an interval one fires one interval after the box starts.

### Webhook

`webhook` serves `POST /hook/<app>/<name>` on the box's API. The JSON body is the payload, and the request headers are passed too, so the `task` function can check a signature. The response is the task the box created, or `{ok: true}` if the event was skipped.

The webhook is served on the box's API address, which listens on `127.0.0.1` by default. A request from the box's own machine needs no token. A request from anywhere else, including one that arrives through a reverse proxy, needs a paired device's token as `Authorization: Bearer <token>`, and without one it gets `401`. So an outside service that cannot send that header cannot reach a webhook. The core does not check a signature, so if the sender signs its calls, check the signature in the `task` function. A service that proves itself with its own secret fits an app route listed in `openRoutes` better. See [apps and slots](/docs/concepts/apps-and-slots/).

### File change

`onFileChange` watches a folder and its subfolders. When a file is added or changed, it waits 200 ms for writes to settle, then fires once for that file with its path relative to the folder. Deleted files and folders do not fire.

The folder is created if it does not exist. Files in it are not part of any workspace. A trigger that wants a task to work on the file copies it into a workspace first.

## Writing your own trigger

Anything that can call `box.createTask` from the core can start tasks. The included apps have their own triggers. The last two are optional apps that need that service's account:

- /find rescans its workspaces at boot, after every task and every minute. It starts a Claude description task only when you press **Describe with Claude** on the Find page.
- The shopping agent runs a check every 20 seconds and starts a purchase task when a watched price drops. It buys from a test store only.
- The ASI:One app runs a chat agent that starts a task when a paired owner asks for work.

A trigger runs inside the core, so it may read the vault keys its app lists in `secrets` with `box.secret(name)`. It must never put a secret in a task's prompt.

## Why triggers create tasks, not actions

A trigger could call an API directly. GurtOS has it start a task instead, so the work gets everything a task gets: its own user and files, its own hosts, a budget that asks before spending, a place in the log, and undo. A task started at 2 AM by a schedule waits for your OK the same way as one you started by hand.

## Related

- [Schedule a routine](/docs/guides/schedule-a-routine/)
- [Apps and slots](/docs/concepts/apps-and-slots/)
- [App SDK](/docs/reference/app-sdk/)
- [Reach GurtOS from ASI:One](/docs/guides/asi-one/)
