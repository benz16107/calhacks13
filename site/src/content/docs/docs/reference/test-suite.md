---
title: The test suite
description: What the ./demo integration suite checks on a real Linux machine, how runs stay isolated, how to run it, and the unit tests and type check.
---

`./demo` is GurtOS's integration test suite. It installs nothing permanent: it starts a fresh box process on a test machine, as root, and acts out the core scenarios with real Linux users, real overlay mounts, a real firewall rule and a real SpacetimeDB database. Then it runs every app's own test step. A change is ready to merge only when it exits 0.

:::danger
Run it only on a disposable test machine. It needs root, creates and deletes Linux users, mounts filesystems and loads an nftables rule. Never run it on a machine that hosts anything you care about.
:::

## Requirements

- Ubuntu 24.04, ARM64 or x86, with passwordless `sudo`. A small VM is enough.
- Network access the first time, to install Node.js, the Droid CLI and SpacetimeDB through `core/setup.sh`. The suite runs that script for you and later runs reuse it.
- Optional: keys in `/etc/box/vault.env` on the test machine. Each run copies them into its own vault. Use sandbox or test-mode keys only.
- Real Droid steps are off by default, because they spend Factory credit. They run with `--live-droid` or `DEMO_LIVE=droid` and a `FACTORY_API_KEY`; otherwise they are reported as pending. Before a run with real Droid, the suite prints how much of Factory's 5-hour and weekly limits is used, and turns real Droid off for that run when the 5-hour limit is 90% used, unless `DEMO_LIVE_DROID_FORCE=1` is set.

## Running it

From the source tree:

```sh
BOX_SHELL='ssh my-vm' ./demo          # ship this checkout to my-vm and run it there
./demo --here                         # run on this machine; only on a test VM
./demo --live-droid                   # also run the real Droid steps, which spend Factory credit
DEMO_LIVE=wallet,find ./demo          # also make these apps' paid or slow live calls
```

`BOX_SHELL` is any command that opens a shell on the test machine. The suite copies every tracked and new file of your checkout (not ignored ones) to `/opt/box-dev/<checkout folder>/` there, keeps `node_modules` between runs, and runs `./demo --here` as root.

By default every step stays offline and spends nothing. `DEMO_LIVE` names the apps whose live calls should run: test-network payments, Stripe test mode, outside APIs, and `droid` for real model calls. Separate names with commas or spaces. `--skip-droid` is still accepted and does nothing, since real Droid is off unless asked for.

## What it checks

The core scenarios run first.

| Scenario | Checks |
|---|---|
| Undo one task | Two tasks run at the same time, each as its own Linux user, in its own copy. Neither sees the other's changes while running. The workspace shows both afterwards. One task's diff comes from its own layer. Undoing it removes only its changes; the other task's stay; the original files were never written. |
| Undo with a real agent | A Droid task (Claude) edits a file in its own copy, logs its steps, calls a box tool through the broker, and holds only a placeholder key in every process. Its model cost is priced from real token counts. Undo removes its changes. Needs `--live-droid` and `FACTORY_API_KEY`. |
| The log as a live stream | A reader follows one task's events over Server-Sent Events, in order, with resumable ids, and can replay from the start. |
| A page with hidden instructions | A scripted agent reads a page that tells it to steal the box's keys and does everything the page says. It cannot read the vault. No secret is in its environment or files. Sending to the attacker's host is blocked and logged. Going around the proxy is blocked by the firewall. It cannot reach SpacetimeDB or the box's API to approve itself. It sees no process but its own. The task is undone. With `--live-droid`, the same page is then given to a real Droid task, and no vault secret may reach its files, environment or log, whatever it does. |
| A pause for your OK | A task over its budget stops and waits, live in SpacetimeDB and in the inbox, with the amount, payee and purpose. Another task keeps running and finishes. An answer through SpacetimeDB reaches the log, and the task carries on. Of two payments made at the same moment, only one fits the budget; the other has to ask, so the task never spends past its budget. |
| Power loss | The box and every worker are killed at once, mid-task, leaving a torn last line in the log. On restart a long job carries on from where it was, with no step done twice or skipped. An approval asked before the cut is still pending, and answering it after the restart lets the task finish. Earlier work and earlier undos are unchanged. |
| Long waits | An approval left unanswered across several wait windows stays one approval. The same call retried while waiting makes one approval and is charged once. A task that ends closes its pending approval. |
| Pairing and more than one box | `GET /api/boxes` lists this box and its peers. A phone pairs with a one-time code that cannot be reused. Its approval is logged with its name. After it is revoked, its next approval gets 401. |
| Real folders (Personal, preview) | The box knows its owner. A task on the owner's folder leaves the real folder untouched while it works, and its diff shows the change. Keep applies it, keeps the owner's ownership and modes, and saves a before-image. Keep refuses when the owner edited the same file meanwhile. Undo Keep puts the folder back. Undo discards a task's changes without touching the folder. |
| Several folders and a runtime owner (Personal, preview) | One task works on three folders, two with the same name, and none changes while it works. A conflict in one folder stops Keep in all of them. Undo Keep puts every folder back. A folder inside another, `folder` with `folders`, and a folder outside the chosen ones are refused. The owner can be set to an existing person's account, not root or a system account, and only from the box itself or the owner's phone. |
| A failed task's error | A task whose worker fails carries the worker's own error message in its `failed` event. |
| An outside caller | With no token, or a made-up one, an outside caller gets 401 on every route but the health check and redeeming a pairing code. A paired phone can read, follow the stream with `access_token`, and approve, and the log names it. It cannot make pairing codes, list or remove devices, finish setup, Keep or hand a task a folder (403). Even the owner cannot give a task `/etc`, `/root`, `/proc` or the box's own folder, also through a link. After undo, the task's diff is empty and its layer is gone from disk. |
| Setup, settings, the vault and apps | A new box shows the setup steps. A relayed request, or a phone that is not the owner's, cannot change setup; the owner's phone can. Settings start at safe defaults, refuse bad values by name, merge nested fields, are logged and saved. A task with no budget or hosts gets the defaults. A spend above the approval threshold asks even inside the budget. A vault key is set through the API, listed by name, never returned, and never in the log. An app turned off loses its tools, routes and webhooks at once, stays off after a restart, and comes back with no reinstall. |

Then the suite runs `tracks/<name>/demo.ts` for every app, in folder order, against the same box, then `portal/demo.ts` and `personal/demo.ts` if they exist. See [`DemoKit`](/docs/reference/app-sdk/#demokit).

## Output

Each scenario prints a heading, then one line per check. The run ends with a count of scenarios and app steps that passed, failed or are pending. The numbers vary with the apps installed and the keys present:

```text
  ok    two tasks ran at the same time
  ok    each ran as its own Linux user (box-t3k9x2a1b2, box-t7p1q5r2s3)
  ...
demo: 21 passed, 0 failed, 0 pending (84.2s)
```

| Result | Meaning |
|---|---|
| `ok` | The check passed |
| `FAIL` | A check failed. The rest of that scenario is skipped, and the run exits 1. |
| `PENDING` | The scenario did not run, with the reason, for example a missing key. Pending is not a failure. |
| `skip` | An app step chose not to run part of itself, with the reason |

Exit 0 means every check that ran passed. On a failure the run keeps its `BOX_HOME` for a look: `box.log`, `log.jsonl` and each task's `worker.log`.

## How runs stay isolated

Several runs can share one test machine, from different checkouts, at the same time.

- Each run has its own `BOX_HOME` at `/var/lib/box-demo/<run id>`, its own vault there, and its own box process.
- Each run takes its own API port and proxy port, and its own SpacetimeDB database, `box-demo-<run id>`.
- Task users are named after task ids, which never repeat.
- A second run from the same checkout folder waits for the first.
- Machine setup and the SpacetimeDB CLI take short locks.
- At the end the run kills its processes, unmounts everything under its `BOX_HOME`, deletes its task users and its database, and removes its `BOX_HOME` if every check passed.

A run never touches `/var/lib/box`, the installed box on the same machine.

## Unit tests and type check

These run on any machine with Node.js 22.18 or newer, without root:

```sh
npm test           # unit tests: core/*.test.ts and tracks/*/*.test.ts
npm run check      # TypeScript type check of the core and every app
```

## Related

- [App SDK](/docs/reference/app-sdk/): writing an app's test step
- [Environment variables](/docs/reference/environment/#the-test-suite)
- [Contributing](/docs/project/contributing/)
