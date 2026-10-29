---
title: Changelog
description: What changed in GurtOS, release by release, newest first.
---

Everything here is a preview and may change. Dates are in Eastern Time.

## v0.2.0-preview

Released <date>, from commit `ef08913`. GurtOS Server and GurtOS Personal for x86_64 and arm64, on the
[Download](/download/) page and the [release page](https://github.com/benz16107/calhacks13/releases/tag/v0.2.0-preview),
where the release notes say how to upgrade and what was tested. The v0.1.0-preview images do not have these changes.

**Setup**
- Set up a new computer from one you already own: the new computer shows a code on its screen, and an agent or the
  `gurtos` command on your other computer finishes setup over the network, while the code lasts.
- GurtOS Server setup is 8 steps: welcome, network, name, owner and phone, model key, what agents may do, updates and
  done. GurtOS Personal setup is 6. Neither asks about optional apps: only the model app is on at first (and Find on
  Personal), and the rest wait in the App Center. Optional apps that use test money say so.
- Pairing codes forgive the way people type them: `5FFF-BAEB` and `5fffbaeb` both work.
- Pairing QR codes open the computer's own pairing page on the home network, so a phone pairs with no hosted
  service. Remote access says when the relay is not answering, and the owner can choose their own relay in Settings,
  Remote access, Relay (or `PUT /api/remote/relay`).

**Apps and permissions**
- Apps ask for permissions like a phone app: turning one on shows what it may do, and Settings, Permissions changes it.
- Replay plays back a finished task step by step, with its files at each step.
- Receipts: a signed receipt for a finished task that anyone can check in a browser at [gurtos.com/verify](/verify/).
  An optional app.

**Safety**
- A per-task disk cap: a task that fills its space is stopped and undone.
- A task can no longer lower its own spending with a negative or invalid cost.
- Diff, Replay and Keep never follow links in a task's files, so a link to the vault shows as a link.
- Only a page from the box's own address counts as the box's screen. Request bodies are capped at 10 MB, or 1 MB
  without a token, and wrong pairing codes are limited to 5 a minute per address.
- The proxy never reaches link-local addresses such as cloud metadata, and private-network hosts need an exact
  `host:port`. A key that a tool quotes in its output is cut out of the log.
- Factory's pull request tool no longer runs a task's git hooks or config as root.
- A task can no longer approve its own budget question with a cheap one and then spend past its budget.
- App pages under `/t/<app>/` run sandboxed, with a token that reaches only that app's routes, so a bug in an app's
  page cannot use the owner's controls.
- Through Factory, the proxy relays only the paths Droid calls. Answering approvals through the MCP server is off
  unless `BOX_MCP_ANSWER=on`.
- Limits per task: 64 KB per step, question or cost, 20 MB of log and 256 open proxy connections. The setup port
  7701 answers private networks only.
- SpacetimeDB installs from pinned, checksummed release files instead of a script from the internet.

**Reliability**
- A workspace takes up to 499 finished tasks, then refuses new ones in words. Before, about 110 stopped new tasks.
- A full disk no longer leaves a torn log line that stops the next boot. First boot survives a power cut. The box's
  own state files are written atomically, and a torn one is set aside so the box still starts.
- Undo on a kept task takes the change back out of your folder, or refuses if you edited a kept file since. Keep is
  all or nothing.
- The first start downloads Droid in the background and retries; boot and the screen no longer wait for it. A task
  started before Droid is ready waits in the queue.
- Errors people see are sentences, such as the one for a missing model key.

**Install and updates**
- The installer never offers the disc or USB stick it started from. With several disks it lists them; a disk with
  data, or a USB disk, needs `erase` typed first.
- `box-update` refuses another architecture, an older build (unless `--allow-older`), and an update while a new
  system is still on trial. A slot whose write did not finish is never started.

**Project**
- A security policy, code of conduct, roadmap, issue templates, a licence report and SBOMs for every image.
- Continuous integration runs the tests, the type check, the public-repo check and a secret scan on every pull
  request.

## v0.1.0-preview

Released 2026-10-24, from commit `58576a7`. The first public images: GurtOS Server and GurtOS Personal for x86_64
and arm64, on the [Download](/download/) page.

### 2026-10-24: access, setup and GurtOS Personal

**Security**
- From anywhere but the box itself, every API request needs a paired device's token. The health check, redeeming a
  pairing code and the portal's own pages stay open.
- Setup, settings, the vault, apps on and off, the owner, the owner's folders, Keep and Undo Keep are for the owner:
  the box's own screen, or a phone paired as the owner.
- SpacetimeDB listens on `127.0.0.1` only. Phones follow the box's API and its log stream instead.
- Folders handed to agents must be in the owner's home or a folder the owner chose in Settings, never the system or
  the box's own state.
- Undo deletes the task's layer from disk.
- The OS image has an inbound firewall. GurtOS Server opens its API to private networks only (home networks and
  Tailscale), never the public internet, and sets its own address for pairing, so the box's screen shows a QR code.
- SpacetimeDB's `answer` works only from a connection the box has vouched for, and records the vouched name.
- Apps can mark routes as open (`openRoutes`) when the route is public on purpose or checks its own secret, as the
  Mana status page and the Jira panel do.

**GurtOS Personal**
- An installer ISO, `gurtos-personal-<arch>.iso`, with Ubuntu's GNOME desktop, GNOME's own first-boot setup and the
  same A/B updates and rollback as Server. The first account becomes the owner.
- The desktop layer: approvals as notifications, a top-bar indicator, the GurtOS app, **Ask an Agent** in Files, a
  review window with Keep and Undo, and a first-run welcome.
- Undo Keep (`POST /api/tasks/<id>/unkeep`) puts kept files back with their old content, owner and mode.
- Keep never changes a file's owner or widens its permissions. A task can work on several folders at once.
- `task.review` and a `keep` log event say where a task's changes stand.
- The owner can be set while the box runs (`PUT /api/owner`).

**Core**
- The box's API for first-run setup, settings, the App Center and the vault: `/api/setup`, `/api/settings`,
  `/api/apps?all=1` with enable and disable, `GET /api/vault` (names only) and `PUT /api/vault/<NAME>`.
- Settings the core enforces: a spend above `approvalThresholdCents` (default $5) always asks; a default budget;
  a default network rule and hosts; folders agents may use.
- `GET /api/system` reports the edition, version, build, hostname and network.
- A failed task's error ends with the worker's own last error message.
- Images are named `gurtos-<edition>-<arch>`. Debug builds add `-debug`.

**Test suite**
- Real Droid tasks are off by default, because they spend model credit. `--live-droid` turns them on.

### 2026-10-24: the OS image and the portal

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
- The screen shows the portal's box screen. Each box names itself `gurt-<id>` from the first 6 hex digits of a hash
  of its own key.

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

### 2026-10-23: the core and the apps

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

- [Roadmap](/docs/project/roadmap/)
- [Contributing](/docs/project/contributing/)
