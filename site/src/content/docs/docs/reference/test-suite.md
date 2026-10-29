---
title: The test suite
description: What npm test, npm run check and the ./demo integration suite check, how to run them, and what the attack tests and their scoreboard show.
---

GurtOS has three checks. `npm test` runs unit tests and `npm run check` type-checks the code. Both run on any machine with Node.js. `./demo` is the integration suite. It starts a fresh box process on a test machine, as root, and acts out the core scenarios with real Linux users, real overlay mounts, a real firewall rule and a real SpacetimeDB database. Then it runs every app's own test step. A change is ready to merge only when `./demo` exits 0.

:::danger
Run `./demo` only on a disposable test machine. It needs root, creates and deletes Linux users, mounts filesystems and loads an nftables rule. Never run it on a machine that hosts anything you care about.
:::

## Unit tests and type check

These run on any machine with Node.js 22.18 or newer, without root:

```sh
npm test           # unit tests: core/*.test.ts, relay/*.test.ts and tracks/*/*.test.ts
npm run check      # tsc -p .: a TypeScript type check of core, relay, try and every app
```

`npm test` runs `node --test --test-force-exit` over those three globs. `npm run check` writes no files. The portal and the Personal desktop layer are not part of either command: the portal builds with its own `npm run build` in `portal/`, and `./demo` exercises both.

## Requirements for `./demo`

- Ubuntu 24.04, ARM64 or x86, with passwordless `sudo`. A small VM is enough.
- Network access the first time, to install Node.js, the Droid CLI and SpacetimeDB. The suite runs `core/setup.sh` for you, and later runs reuse what it installed. It also runs `npm ci` in the shipped checkout.
- Optional: keys in `/etc/box/vault.env` on the test machine. Each run copies them into its own vault. Use sandbox or test-mode keys only.
- Real Droid steps are off by default, because they spend Factory credit. They run with `--live-droid` or `DEMO_LIVE=droid`, and need a `FACTORY_API_KEY` in the test machine's vault. Otherwise they are reported as `PENDING`.

## Running it

From the source tree:

```sh
BOX_SHELL='ssh my-vm' ./demo          # ship this checkout to my-vm and run it there
./demo my-vm                          # the same, for a machine named in ~/.config/gurtos/machines
./demo --here                         # run on this machine; only on a test VM
./demo --live-droid                   # also run the real Droid steps, which spend Factory credit
DEMO_ONLY=security ./demo my-vm       # only the scenarios named "security: ..."
DEMO_LIVE=find ./demo my-vm           # also make an app's paid or slow live calls
```

`BOX_SHELL` is any command that opens a shell on the test machine. `./demo <name>` reads the line `name=<command>` from `~/.config/gurtos/machines` (or the file `GURTOS_MACHINES` names), and a machine called `default` is used when you give neither. The suite copies every tracked and new file of your checkout (not ignored ones) to `/opt/box-dev/<checkout folder>/` there, keeps `node_modules` between runs, and runs `./demo --here` as root.

| Setting | Effect |
|---|---|
| `--live-droid` | The same as adding `droid` to `DEMO_LIVE` |
| `DEMO_LIVE` | App names, separated by commas or spaces, whose paid or slow live calls should run: test-network payments, Stripe test mode, outside APIs, and `droid` for real model calls. Each app's README names its own value. Off by default, so every step stays offline and spends nothing. |
| `DEMO_ONLY` | Runs only the steps whose title is `track <name>` (an app's step) or starts with `<name>:` (the core scenarios named that way, such as `security`, `personal`, `permissions`, `setup`). `DEMO_ONLY=anthropic` runs the model app's step. The merge gate runs everything. |
| `BOX_REVIEW=off` | Switches off the second look at risky agent steps, so the attack tests can be compared with and without it |
| `--skip-droid` | Still accepted and does nothing, since real Droid is off unless asked for |

Before a run, the suite prints how much of Factory's 5-hour and weekly limits is used. It turns real Droid off for that run when the 5-hour limit is 90% used, unless `DEMO_LIVE_DROID_FORCE=1` reaches the run. The shipped command line passes only `DEMO_LIVE`, `DEMO_ONLY`, `DEMO_SKIP_DROID` and `BOX_REVIEW`, so that variable works only with `./demo --here` started as root.

`DEMO_LIVE=remote` runs the remote-access step against a real relay at `BOX_RELAY`, which defaults to the hosted relay at `box.gurtos.com`. That relay is not running during the preview. Leave `remote` out, or point `BOX_RELAY` at a relay you run (see [Self-host](/docs/guides/self-host/)). Like `DEMO_LIVE_DROID_FORCE`, `BOX_RELAY` reaches the run only with `./demo --here` started as root.

## What it checks

The core scenarios run first, in this order.

| Scenario | Checks |
|---|---|
| Undo one task | Two tasks run at the same time, each as its own Linux user, in its own copy. Neither sees the other's changes while running. The workspace shows both afterwards. One task's diff comes from its own layer. Undoing it removes only its changes; the other task's stay; the original files were never written. |
| Undo with a real agent | A Droid task (Claude) edits a file in its own copy, logs its steps, calls a box tool through the broker, and holds only a placeholder key in every process. Every Factory call it makes is one the box relays: none is refused. Its model cost is priced from real token counts. Undo removes its changes. Needs `--live-droid` and `FACTORY_API_KEY`. |
| The log as a live stream | A reader follows one task's events over Server-Sent Events, in order, with resumable ids, and can replay from the start. |
| The sandbox | Every task runs under a seccomp system-call filter and a CPU cap of two cores. |
| Tripwire keys | The decoy cloud key in a task's environment stops and undoes the task if it leaves in a request, in a tunnel to an allowed host (Node's `fetch`), or in a plain-HTTP body. The key itself appears nowhere in the log or the task's output. |
| Command setup | An agent sets a computer up through MCP with only the 8-character code on its screen. The code works only from the computer's own screen, pairs only as a setup agent and gives nothing without a token. The agent sets a key, a setting and an app, pairs the owner's phone, and every step is in the log with the key by name only. Finishing setup ends its access. |
| Permissions | Each app's manifest comes from what it registers. With money or a key turned off, a task's spend and a route's key read fail with a plain sentence and a log note. A daily limit turns a spend over it into a question. |
| The disk cap | A task that writes past its cap (20 MB here, 5 GB by default) is stopped and undone, and the log says why. |
| The flight recorder | A finished task replays step by step, with its files at each step that changed them. |
| The GurtOS MCP server | Out of the box, Claude Code can list pending requests but has no tool to answer them: a task writes its own log and questions, and could talk an agent into approving. With `BOX_MCP_ANSWER=on` it also answers as its own paired device. It lists the box's tools, starts a task, reads the log and diff, and undoes the task. A refused action comes back as an error, and no key passes through it. |
| A page with hidden instructions | A scripted agent reads a page that tells it to steal the box's keys and does everything the page says. It cannot read the vault. No secret is in its environment or files. Sending to the attacker's host is blocked and logged. Going around the proxy is blocked by the firewall, and that is logged too. It cannot reach SpacetimeDB or the box's API to approve itself. It sees no process but its own. The task is undone. With `--live-droid`, the same page is then given to a real Droid task, and no vault secret may reach its files, environment or log, whatever it does. |
| A pause for your OK | A task over its budget stops and waits, live in SpacetimeDB and in the inbox, with the amount, payee and purpose. Another task keeps running and finishes. An answer through SpacetimeDB reaches the log, and the task carries on. Of two payments made at the same moment, only one fits the budget; the other has to ask, so the task never spends past its budget. |
| Power loss | The box and every worker are killed at once, mid-task, leaving a torn last line in the log. On restart a long job carries on from where it was, with no step done twice or skipped. The box knows the stop was not clean. An approval asked before the cut is still pending, and answering it after the restart lets the task finish. Earlier work and earlier undos are unchanged. |
| Long waits | An approval left unanswered across several wait windows stays one approval. The same call retried while waiting makes one approval and is charged once. A task that ends closes its pending approval. An approval whose id contains spaces can be answered. |
| Pairing and more than one box | `GET /api/boxes` lists this box and its peers. A phone pairs with a one-time code that cannot be reused. The device list carries no token. Its approval is logged with its name. After it is revoked, its next approval gets 401. |
| Real folders (Personal, preview) | The box knows its owner. A task on the owner's folder leaves the real folder untouched while it works, and its diff shows the change. Keep applies it, keeps the owner's ownership and modes, and saves a before-image. Keep refuses when the owner edited the same file meanwhile. Undo Keep puts the folder back. Undo discards a task's changes without touching the folder. |
| Keep and Undo after folders are removed (Personal, preview) | The diff lists every file in a folder the agent removed. Keep applies the removal and leaves a file the owner added meanwhile. Undo of a kept task puts every removed file and folder back, and refuses if the owner edited a kept file since. |
| Several folders and a runtime owner (Personal, preview) | One task works on three folders, two with the same name, and none changes while it works. A conflict in one folder stops Keep in all of them. Undo Keep puts every folder back. A folder inside another, `folder` with `folders`, and a folder outside the chosen ones are refused. The owner can be set to an existing person's account, not root or a system account, and only from the box itself or the owner's phone. |
| A failed task's error | A task whose worker fails carries the worker's own error message in its `failed` event. |
| An outside caller | With no token, or a made-up one, an outside caller gets 401 on every route but the health check and redeeming a pairing code. A paired phone can read, follow the stream with `access_token`, and approve, and the log names it. It cannot make pairing codes, list or remove devices, finish setup, Keep or hand a task a folder (403). Even the owner cannot give a task `/etc`, `/root`, `/proc` or the box's own folder, also through a link. A task's copy of a private file stays private and no other task can read it. After undo, the task's diff is empty and its layer is gone from disk. |
| A task cannot lower its spend or reach past its limits | A negative or made-up cost, token count or amount from a task is refused. A task cannot approve its own spend ahead of time: it asks a harmless $0.01 question under the id the box would use for a $900 spend, the owner approves that, and the $900 spend still asks again with its real amount (the task's question is stored as `<task>.task.budget.<action>`, the box's as `<task>.budget.<action>`). A 70 KB step is refused, and of 300 connections at once to the proxy the box closes those past 256. A link in a task's layer shows in the diff as a link and is kept as a link, never followed as root. A named pipe does not hang the box. A name that leads to the cloud metadata address is refused, and a rebound name gets nothing. Wrong pairing codes are limited per address (the sixth gets 429). An app's page is served with `Content-Security-Policy: sandbox` and no `allow-same-origin`, and its window token reaches the app's own routes and the task list, but not the vault, settings, pairing, another app or another window (403 each). It answers only its own app's requests (403 otherwise), a preflight from the page's `null` origin is allowed, and removing the phone that opened the window ends the window (401). A 2 MB body to an open route gets 413. |
| Setup, settings, the vault and apps | A new box shows the setup steps. A relayed request, or a phone that is not the owner's, cannot change setup; the owner's phone can. Settings start at safe defaults, refuse bad values by name, merge nested fields, are logged and saved. A task with no budget or hosts gets the defaults. A spend above the approval threshold asks even inside the budget. Pause all agents holds a running task before its next step and keeps a new one queued until resumed. A vault key is set through the API, listed by name, never returned, and never in the log. An app turned off loses its tools, routes and webhooks at once, stays off after a restart, and comes back with no reinstall. |

Then the suite runs, in this order:

1. `tracks/<name>/demo.ts` for every app, in folder order, against the same box. See [`DemoKit`](/docs/reference/app-sdk/#demokit).
2. The portal's step: a smoke test that the box serves the built portal and every API the portal reads, and that the setup round trip works.
3. Remote access and push (`relay/demo.ts`), against a relay running inside the test.
4. The Personal desktop layer (`personal/demo.ts`), which runs the layer's own Python self-test headless.
5. Two native-app steps: the device kinds and the Apple Watch limits, and every call the iPhone, Watch and Mac apps make. The apps' own Swift tests run on a Mac.
6. GurtOS Business: people, routed approvals, the audit and the kill switch.
7. GurtOS Business sign-in with a work account (OpenID Connect), against a small provider inside the test.

The Business steps turn Business on and off again, so they run near the end. The very last scenario restarts the box. A box whose state files were torn by a failing disk still starts. With `devices.json`, `permissions.json` and `owner.json` cut off half way, the box sets each aside as `<name>.torn-<time>`, starts with no paired phones, pauses its agents until the owner checks Settings, Permissions, and writes a security note that says what it could not read. It is named `security: ...`, so `DEMO_ONLY=security` runs it too.

## The attack tests

`tracks/armadin/` is the app called Attack tests. It has no tools or routes. Its step in `./demo` runs three things against the demo box.

- **A poisoned package.** `poisoned/gurt-chalk-utils` is a harmless imitation of an npm supply-chain worm. A task installs it. Its `postinstall` script runs 11 steps: it reads the environment, dotfiles and the vault, asks the cloud metadata address, sends data to an attacker's host and around the proxy, tries to publish packages, and writes outside the task's copy. The suite checks each step's outcome (the environment holds only the two decoy cloud keys, everything else is blocked or contained). The last step sends the decoy key out with `curl`, which trips the wire, so the task ends undone. The planted canary credentials appear nowhere in the log.
- **A hijacked payment.** In `cases/bec`, a lookalike sender's email says the bank account changed. The credit desk's payment tool refuses the new account in code, before any person is asked. A second, honest bill is over the AP clerk's $5,000 limit, so the task pauses for the controller, who says no. Neither bill is paid. This step uses the credit desk app, which `./demo` leaves on.
- **The attack scoreboard.** Forty-one OS-level attacks, each with an expected result, run as a task's own Linux user inside its sandbox. The step fails if an attack expected to be caught gets through, or if an attack leaves no evidence. A row published as not covered that the core has since closed passes, tagged `FIXED`.

The scoreboard, `tracks/armadin/SCOREBOARD.md`, has 41 rows. In the runs of 2026-10-29, 25 were caught and 16 are published as not covered, each with the fix it needs. Six of the caught rows (reading another task's workspace, reading the vault, sending to a disallowed host, going around the proxy, and reaching the box's API or SpacetimeDB to approve itself) are proved by the core scenarios above, and armadin cites them without running them again.

Caught include: a symlink out of the task's copy, another user's `/proc/<pid>/environ`, `ptrace`, another task's `/tmp`, DNS and IPv6 exfiltration, a fork bomb, a memory hog, a disk fill of the task's layer, the box's API socket and state files, and the box's ports reached through an allowed name.

Not covered include: data sent through a host the task may reach (GurtOS checks where a task connects, not what it sends, except for the decoy cloud key), a disk fill outside the task's layer (`$HOME`, `/tmp`, `/dev/shm`), channels between tasks through `/dev/shm`, abstract Unix sockets and `/proc/net`, and a few thousand small files stalling the box while Find indexes them.

`tracks/armadin/OWASP.md` maps these controls to the OWASP Top 10 for LLM Applications (2025) and for Agentic Applications (2026). `README.md` in the same folder has the table with evidence from real runs.

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

- One `./demo` run uses a machine at a time. The script takes a lock, and a second run waits for the first, because runs side by side failed on timeouts instead of on the code.
- Each run has its own `BOX_HOME` at `/var/lib/box-demo/<run id>`, its own vault there, and its own box process.
- Each run takes its own API port, proxy port and setup port, and its own SpacetimeDB database, `box-demo-<run id>`.
- Task users are named after task ids, which never repeat.
- Machine setup and the SpacetimeDB CLI take short locks.
- A run starts by clearing demo boxes that earlier runs left behind after a crash or an interrupt.
- At the end the run kills its processes, unmounts everything under its `BOX_HOME`, deletes its task users and its database, and removes its `BOX_HOME` if every check passed.

A run never touches `/var/lib/box`, the installed box on the same machine.

## Related

- [App SDK](/docs/reference/app-sdk/): writing an app's test step
- [Environment variables](/docs/reference/environment/#the-test-suite)
- [Contributing](/docs/project/contributing/)
