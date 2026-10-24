---
title: Changelog
description: What changed in GurtOS, newest first. GurtOS has no numbered releases yet; changes are listed by date under one preview.
---

GurtOS has no numbered releases yet. Everything below is part of one early preview and may change. Dates are in
Pacific Time.

## Preview

### 2026-10-24

**GurtOS Personal: owner folders**
- A task can work on a copy of one of the owner's real folders: `folder` on `POST /api/tasks`. The real folder is
  untouched while the task runs.
- `POST /api/tasks/<id>/keep` applies a done task's changes to the real folder, one file at a time, atomically. It
  applies nothing and reports `conflicts` if the owner changed the same files. Before-images are saved for each file
  it replaces.
- `GET /api/owner` and the `BOX_OWNER` setting.

**OS image**
- An installer ISO for x86_64 and arm64. It boots BIOS and UEFI, installs on a blank disk in about a minute, and
  needs `erase` typed on screen before it touches a disk with data on it.
- Two system slots. Signed whole-system updates are tried once and kept only if the box reports healthy within
  5 minutes; otherwise the box rolls back by itself. `box-update status`, `apply` and `rollback`.
- No human account, no login prompt, no `sudo`, no package manager. Release builds have no SSH server.
- The screen shows the portal's box screen. Each box names itself `box-<id>` from its own key.

**Portal**
- One web app for the box's own screen, a browser and a phone: home screen, Tasks, a task's steps and diff with Undo
  (and Keep on Personal), Activity, Time Machine, Notification Center and Settings.
- Pairing a phone from Settings with a QR code. A paired phone answers with its device token, so the log names it.
- A notice after a power cut lists the tasks that resumed. The layout fits screens from 1024 x 768 up.

**Core**
- `GET /api/health` reports when the box started and which tasks it resumed.
- Pairing routes are now `POST /api/pair/start`, `GET /api/devices` and `DELETE /api/devices/<id>`. The earlier
  names still answer.
- `GET /api/boxes` entries carry a `url`, set with `BOX_URL`.
- One approval per action: a tool call that is retried reuses its approval and is charged once. Requests can wait
  past a client's tool-call timeout. Approvals still pending when a task ends are closed.

### 2026-10-23

**Core**
- Each task runs as its own Linux user, in its own overlayfs copy of its workspace, in a hardened systemd unit.
- Undo removes one task's layer from its workspace and leaves every other task's changes.
- The action log: append-only, one JSON event per line, written to disk before the box moves on. At boot the box
  rebuilds every task from it and resumes what was running.
- The vault and the broker: tasks hold no secrets and run tools by name through a socket only their user can open.
- Per-task network allow-lists, enforced by an nftables rule and the box's proxy. Refusals are logged.
- Droid tasks hold a placeholder key. The proxy adds the real key on the way to the model service.
- Budgets and approvals, mirrored live to SpacetimeDB, with structured payee and purpose fields. Spending is
  reserved before a tool runs, so parallel calls cannot overspend.
- Model cost per task, from real token counts at list prices.
- Generic triggers: on a schedule, on a webhook, on a file change.
- The action log as Server-Sent Events.
- `GET /api/tasks/<id>/diff` shows what a task changed.
- `core/install.sh` installs the box as a service on Ubuntu 24.04.

**Apps**
- Apify: web work through Apify Actors, with the token only in the vault.
- Credit desk: a sample finance app with two agent seats, a controller approval and scoring against an answer key.
- Wallet: agents pay for APIs with x402 in USDC on Solana devnet. Test money only.
- Shopper: price and restock watches, reorders from receipts, and signed checkout at a test store. Test payments only.
- Elastic: the action log in Elasticsearch, with an Agent Builder agent that answers questions about it.
- Jira: each task as a Jira issue, with a panel to approve and roll back that task.
- ASI:One: chat with the box from ASI:One through an Agentverse agent.
- Find: search photos, files and task history by meaning.

**Fixes**
- After a power cut, the log trims a half-written last line by bytes, not characters, so text with multi-byte
  characters is never cut short.
- The box starts without waiting for SpacetimeDB.

**Test suite**
- Runs from different checkouts go side by side on one machine.
- `--skip-droid` and `DEMO_LIVE` options.

## Related

- [Roadmap](/project/roadmap/)
- [Contributing](/project/contributing/)
