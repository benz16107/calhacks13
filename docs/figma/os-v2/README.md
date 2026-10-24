# GurtOS screens, version 2

Every screen built with the GurtOS system (`../system.md`). They are on the page "GurtOS screens v2" of the
[design file](https://www.figma.com/design/oppzH621OOOMA31rgLbxbM), built only from the components on the page
"GurtOS system". Desktop screens are 1920 x 1080, the box's own screen; the portal in a browser is the same desktop.
Phone screens are 390 x 844.

Read a screen with `get_design_context` on its node ID. Example data (task IDs, costs, times, paths) is made up for
the mockups; the field each value comes from is named in the notes.

## Setup, Server (`setup/`)

A 1200 x 840 window on the wallpaper, before the desktop exists. Each step is one decision. Each step is recorded
with `POST /api/setup/step {id, data}`, and the last calls `POST /api/setup/finish`. The core's suggested ids are
`welcome, network, safety, folders, apps, keys, updates, phone`; the box accepts any id, so the ids below are the
ones to send.

| PNG | Node | Step id | What it shows, and its data |
|---|---|---|---|
| `setup/01-welcome.png` | `54:86` | `welcome` | Language, keyboard, accessibility switches, and "Set up from your phone": a QR of `POST /api/pair/start {owner: true}` (`url`, `code`). Back is disabled |
| `setup/02-network.png` | `74:1126` | `network` | Wired and Wi-Fi rows. Data: `GET /api/system` `network.interfaces` and `online`. Joining Wi-Fi has no API yet |
| `setup/03-name-and-time-zone.png` | `74:1308` | `name` | Box name field and time zone. Data: `boxName`, `hostname`, `timezone` from `GET /api/system`; the answers go in the step's `data` |
| `setup/04-owner.png` | `74:1468` | `phone` | Two choices: pair my phone (selected, with the owner QR and the code) or a passcode on this screen. The code's expiry is `expiresAt` |
| `setup/05-ai-models.png` | `74:1608` | `models` | Droid with Claude (`claude-sonnet-4-6`, the worker's default), and the write-only key field for `FACTORY_API_KEY`: `PUT /api/vault/FACTORY_API_KEY {value}` |
| `setup/06-permissions.png` | `75:1418` | `safety` | `networkDefault` and `defaultHosts`, `approvalThresholdCents`, `defaultBudgetCents`, `quietHours`. `PATCH /api/settings` |
| `setup/07-apps.png` | `55:302` | `apps` | Every app with what it reaches and the keys it needs, and a switch each. `GET /api/apps?all=1` (`access.hosts`, `access.secrets`), then `POST /api/apps/<id>/enable` |
| `setup/08-keys-for-apps.png` | `75:1593` | `keys` | The key names the chosen apps need, grouped by app, each set or not (`access.secrets[].set`). `PUT /api/vault/<NAME>` |
| `setup/09-updates.png` | `75:1774` | `updates` | Systems A and B (from `box-update status`), `autoUpdate`, `updateChannel` |
| `setup/10-privacy-and-logs.png` | `75:1936` | `privacy` | `logRetentionDays`, where the log lives, and two sharing switches (the Elastic and Mana apps, both off) |
| `setup/11-appearance.png` | `75:2115` | `appearance` | `appearance.theme` (light, dark, system) and `appearance.accent` |
| `setup/12-done.png` | `75:2286` | (finish) | A four-card tour and a summary of the choices. "Start using GurtOS" calls `POST /api/setup/finish` |

The footer's Skip shows on the optional steps (apps, keys, privacy, appearance). Next is the only filled button.

## Settings (`settings/`)

One window with a sidebar (280 px) and a page clamped to 680 px. Every page is boxed lists of rows. Changes are
`PATCH /api/settings` unless noted; reads are `GET /api/settings` and `GET /api/system`. Owner only: the box's own
screen or the owner's phone.

| PNG | Node | Page and data |
|---|---|---|
| `settings/01-general.png` | `76:2071` | Name (`boxName`), address (`hostname`), time zone (`timezone`), network (`network.interfaces`), Restart, Run setup again (`POST /api/setup/reopen`) |
| `settings/02-agents-and-models.png` | `76:2395` | The worker and model, the model keys (`GET /api/vault`), and today's spend on models and tools (task `costCents`) |
| `settings/03-permissions.png` | `56:446` | `networkDefault`, `defaultHosts`, `agentFolders` (Personal), `approvalThresholdCents`, `defaultBudgetCents`, `quietHours` |
| `settings/03-permissions-dark.png` | `57:1122` | The same page with the window in the Dark mode of the variables (`appearance.theme`) |
| `settings/04-accounts-and-keys.png` | `76:2694` | Every key name in the vault with when it was set (`GET /api/vault`: `setAt`, null when put there by hand), Replace or Set key, and the owner device. Never a value |
| `settings/04-accounts-and-keys-replace-sheet.png` | `76:3011` | The sheet for `PUT /api/vault/<NAME> {value}`: a password field, Cancel and Save |
| `settings/05-apps.png` | `76:3178` | Every installed app with a switch (`GET /api/apps?all=1`, `status`, `error`; `POST /api/apps/<id>/enable` and `disable`) and a link to App Center |
| `settings/06-devices.png` | `76:3757` | Paired phones with Revoke (`GET /api/devices`, `DELETE /api/devices/<id>`), and a pairing card (`POST /api/pair/start`) |
| `settings/07-updates.png` | `77:3222` | Systems A and B (`box-update status`), last check, `autoUpdate`, `updateChannel`, and Go back (`box-update rollback`), the one destructive button |
| `settings/08-privacy-and-logs.png` | `77:3513` | `logRetentionDays`, the log's size and path, the Elastic and Mana sharing switches, lock-screen titles |
| `settings/09-appearance.png` | `77:3809` | `appearance.theme`, `appearance.accent`, wallpaper, and the accessibility switches |
| `settings/10-about.png` | `77:4131` | The wordmark, `editionName`, `version`, `build`, `boxId`, uptime, and credits for the icons and the typeface |

## Desktop (`desktop/`)

| PNG | Node | What it shows, and its data |
|---|---|---|
| `desktop/home-approval-banner.png` | `83:4401` | The desktop: greeting, three glass widgets on the wallpaper (needs you, running, spent today), and an approval arriving as a banner with Deny and Approve. Banners come from the SpacetimeDB `approval` table; answering calls the `answer` reducer |
| `desktop/notification-center.png` | `83:4554` | Opens from the clock: the approvals that wait (each with its actions), earlier notices (blocked attempts, finished tasks), and Quiet hours |
| `desktop/control-center.png` | `83:4779` | Opens from the system menu: the box and its uptime, Settings, Lock and Power, quick toggles (network, quiet hours, dark style, pause agents), and what is running now with progress |
| `desktop/lock-screen.png` | `83:4965` | The clock, the box's name, the waiting approvals without their actions (unlock or use the phone), and the passcode field |
| `desktop/boot-after-power-cut.png` | `85:5480` | Moment 4 while the box starts: the wordmark, progress, and the log being read |
| `desktop/restored-after-power-cut.png` | `85:5495` | Moment 4 after: "Welcome back", widgets for resumed tasks and "paid twice: 0", and an info notification. Data: the `task.state` events after boot |

## Windows (`windows/`)

| PNG | Node | What it shows, and its data |
|---|---|---|
| `windows/tasks.png` | `57:722` | Tasks, like Activity Monitor: views in the header bar (All, Running, Waiting, Done with counts), one row per task with the user it runs as, its state badge, its `step` and progress, its cost of its budget, and a summary strip (running, waiting, spent today, blocked today) |
| `windows/app-center.png` | `79:4011` | App Center: a sidebar of filters (all, on, off, needs a key) and a grid of app cards with status, hosts and keys, and one action each. `GET /api/apps?all=1` |
| `windows/app-center-shopper-detail.png` | `79:4398` | One app: what it does, Turn off, every host it reaches (`access.hosts`), every key it needs (`access.secrets`), and the tools, windows and triggers it adds |
| `windows/task-detail.png` | `84:4845` | One task: state, time, cost of budget, the blocked-attempts alert, its steps from the log (blocked ones red), the files it changed, and what it was allowed. `GET /api/tasks/<id>` (`task`, `events`), `GET /api/tasks/<id>/diff`. Undo task is the header bar's main action |
| `windows/task-detail-undo-confirm.png` | `84:5090` | The alert dialog before `POST /api/tasks/<id>/undo`: Cancel first, "Undo task" in red |
| `windows/task-detail-undone.png` | `95:8588` | After Undo: the Undone badge, files marked removed, the new log line 1384, and a toast. The prototype's end state |
| `windows/activity.png` | `84:5312` | The action log as an event viewer: filters in the sidebar, one row per event (`seq`, time, task, `type` as a chip, text), blocked events red, approvals amber, and the selected event's fields below. `GET /api/log?after=<seq>` over SSE |
| `windows/time-machine.png` | `85:5256` | One workspace's layers as a stack, newest on top, the base files at the bottom; for the selected layer, what comes out and what stays, and Undo this task |

## Track apps (`tracks/`)

Each track's app restyled into the system: a standard window over the desktop, its views in the header bar, and its
approvals as amber rows. The rules app makers follow are in `../system.md`, "App guidelines".

| PNG | Node | What it shows, and its data |
|---|---|---|
| `tracks/credit-desk.png` | `86:5497` | A run's results (planted errors caught, false alarms, time and cost) and its decisions, each citing rule ids; APP-1042 waits for you. `GET /t/credit-desk/runs`, `POST /t/credit-desk/score` |
| `tracks/shopper.png` | `86:5774` | The test-payments notice, the watch list with prices and limits (one purchase waits for you), and recent orders with test receipts |
| `tracks/wallet.png` | `86:6030` | The devnet USDC balance (test money), how 402 payments work, and payments with their task, API, amount, status and Solana transaction |
| `tracks/find.png` | `86:6245` | A search panel over the desktop with results grouped as tasks, log, files and photos. The two photos are AI-generated stand-ins |
| `tracks/jira.png` | `87:5997` | The project board the box keeps in Jira: To Do, In Progress, In Review (waiting for you) and Done, from the task states |
| `tracks/asi-one.png` | `87:6275` | The box as an Agentverse agent (online, its address), a chat from ASI:One with an approval card, and the tasks chats started |
| `tracks/elastic-insights.png` | `87:6462` | The log copy's status, the four questions, and one answer with a table, from the Agent Builder agent over the log |
| `tracks/mana-status.png` | `87:6686` | Publishing the public status page, what it shows and never shows, and a preview of the page |

## Phone (`phone/`)

The portal on a phone, 390 x 844: a large title, boxed lists and a tab bar (Home, Tasks, Activity, Settings). The lock
screen, the notification and the Live Activities are drawn by the phone's own OS, with GurtOS content. Paired phones
send their device token with every answer (`Authorization: Bearer <token>`).

| PNG | Node | What it shows, and its data |
|---|---|---|
| `phone/1-home.png` | `90:6534` | The box, what needs you (each with its amount), and what is running with progress |
| `phone/2-approval-notification.png` | `90:6649` | The approval as a lock-screen notification with 44 px Deny and Approve |
| `phone/3-live-activity.png` | `90:6708` | The island after approving ("running again", paid once) and two Live Activities with steps and progress |
| `phone/4-tasks.png` | `90:6773` | The task list with views (all, running, waiting, done) and a state badge on each |
| `phone/5-task-detail.png` | `91:6771` | One task: state, cost, the blocked alert, its steps, its files, and Undo task pinned at the bottom |
| `phone/6-pairing.png` | `91:6834` | What the phone shows after scanning: the code to compare, a name for the phone, the owner switch, Pair. `POST /api/pair {code, name}` |
| `phone/7-setup-step-5.png` | `91:6883` | The setup wizard on the phone: step progress, "the box's screen follows along", one step at a time, Back and Next pinned |

## Personal, on GNOME (`personal/`)

GNOME Shell draws the top bar, the indicator menu and notifications, so they keep Ubuntu Sans and Shell's own look,
with GurtOS content and app icons. GurtOS's own windows (review, Ask an Agent, setup) use the GurtOS system, which is
built on libadwaita's patterns, so they sit naturally on the GNOME desktop. Folder grants are `agentFolders` and a
task's `folder` (`POST /api/tasks {folder}`).

| PNG | Node | What it shows |
|---|---|---|
| `personal/indicator-menu.png` | `93:6840` | The AppIndicator menu: what needs your OK (with amounts), what runs, then Ask an Agent, Open GurtOS, Pause all agents, GurtOS settings |
| `personal/approval-notification.png` | `93:7037` | The approval as a GNOME notification over the app you are using, with Deny and Approve |
| `personal/review-keep-or-undo.png` | `93:7177` | A finished task for one folder: what changed (moves, renames, a new file with its diff), that nothing outside the folder changed, and Keep or Undo |
| `personal/ask-an-agent-dialog.png` | `93:7425` | Ask an Agent from a folder in Files: the task, may change (the folder clicked), may also read, internet, budget, worker. Start stays off until the task is written |
| `personal/setup-1-welcome.png` | `94:7497` | GurtOS Setup after GNOME's own setup, 7 steps: what keeps agents safe |
| `personal/setup-2-ai-models.png` | `94:7709` | The worker and the write-only `FACTORY_API_KEY` |
| `personal/setup-3-folders.png` | `94:7906` | The folders agents may use, each May change, May read or Not allowed (`agentFolders`) |
| `personal/setup-4-permissions.png` | `94:8138` | Internet, the single-spend limit, the default budget, quiet hours |
| `personal/setup-5-apps.png` | `94:8359` | Apps with what they reach and the keys they need |
| `personal/setup-6-pair-a-phone.png` | `94:8720` | Optional pairing with a QR and the code |
| `personal/setup-7-done.png` | `94:8897` | A four-card tour: Ask an Agent, the top bar, Keep or Undo, Time Machine |

## Prototype

The page has four flow starting points: "Setup, Server (12 steps)" (`54:86`), "Phone: approve a spend" (`90:6534`),
"Box: undo one task" (`57:722`) and "Desktop and Settings" (`83:4401`). The flows are described in `../../figma.md`.

## System sheets

`system-foundations.png` (colors in both modes, type, spacing, radius, elevation, motion), `system-icons.png` (the
Adwaita symbolic icons), `system-app-icons.png`, `system-controls.png`, `system-lists-and-chrome.png`.
