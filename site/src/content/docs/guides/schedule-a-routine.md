---
title: Schedule a routine
description: Write a small app with a schedule trigger so the box starts an agent task every few minutes or once a day, and keeps doing so after restarts.
---

A routine is a task the box starts on its own, on a timer. In this guide you write a small app with a `schedule` trigger, install it on the box, and check that it starts tasks. The schedule re-arms every time the box starts, so it survives restarts and power cuts.

## Before you start

- A box installed on Ubuntu from a source checkout. See [Install on Ubuntu](/get-started/install-on-ubuntu/). On a box installed from the ISO, apps ship inside the system image, so a new app reaches it as a [system update](/guides/update-and-roll-back/).
- A `FACTORY_API_KEY` in the vault, because scheduled tasks run Droid with Claude by default. See [Add a secret](/guides/add-a-secret/).
- Basic TypeScript.

## Steps

1. **Make the app's folder** in your checkout. The folder name is the app's name.

   ```sh
   mkdir -p tracks/nightly
   ```

2. **Write `tracks/nightly/track.ts`.** This app starts one task every day at 02:00, box local time.

   ```ts
   import type { Track } from '../../core/contract.ts';
   import { schedule } from '../../core/triggers.ts';

   export default {
     name: 'nightly',
     triggers: [
       schedule({
         name: 'report',
         dailyAt: '02:00',
         task: () => ({
           title: 'Nightly notes report',
           prompt: 'Read notes/ and write report.md: what changed since yesterday, in five bullet points.',
           workspace: 'home',
           hosts: [],
           budgetCents: 25,
           source: 'schedule',
         }),
       }),
     ],
   } satisfies Track;
   ```

   - `dailyAt: 'HH:MM'` fires once a day at that time. Use `everyMs` instead for a fixed interval, for example `everyMs: 15 * 60_000` for every 15 minutes.
   - `task()` returns a task spec. Return nothing to skip a run, for example when there is no new work.
   - `hosts: []` means the task has no network beyond Claude. Add only the hosts the routine needs. See [Network policy](/concepts/network-policy/).
   - `budgetCents` caps tool spending before the task asks for your OK.

3. **Install the checkout** on the box. The install script copies it to `/opt/box` and restarts the service, which loads every app at boot.

   ```sh
   sudo core/install.sh
   ```

## Check it worked

1. Look for the app in the service's startup line:

   ```sh
   journalctl -u box.service -n 20 | grep 'box up'
   ```

   ```text
   box up: 12 tasks in the log, tracks: example, nightly, wallet
   ```

   If the app failed to load, the journal has `track nightly not loaded:` and the reason. A broken app never stops the box.

2. To see a task without waiting until 02:00, set `everyMs: 60_000` for a test run, install again, and wait a minute. Then list tasks:

   ```sh
   curl -s http://127.0.0.1:7700/api/tasks | grep -o '"title":"Nightly notes report"[^}]*'
   ```

   Change the schedule back when you are done.

## Limits

- A run that falls while the box is off is skipped, not caught up. `dailyAt` arms the next occurrence after each start.
- `everyMs` counts from when the box started, not from a fixed clock time.
- `dailyAt` uses the box's local time zone.
- Schedules live in app code. A screen for creating routines in the portal is not built.

## Related

- [Triggers](/concepts/triggers/)
- [Apps and slots](/concepts/apps-and-slots/)
- [App SDK reference](/reference/app-sdk/)
- [Cost](/concepts/cost/)
