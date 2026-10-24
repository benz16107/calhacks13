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

## The checkpoint screens

| PNG | Node | What it shows |
|---|---|---|
| `3-settings-permissions.png` | `56:446` | Settings on Permissions (now also in `settings/`) |
| `3-settings-permissions-dark.png` | `57:1122` | The same window in the Dark mode of the same variables |
| `4-desktop-tasks.png` | `57:722` | Tasks as a window, like Activity Monitor |

## System sheets

`system-foundations.png` (colors in both modes, type, spacing, radius, elevation, motion), `system-icons.png` (the
Adwaita symbolic icons), `system-app-icons.png`, `system-controls.png`, `system-lists-and-chrome.png`.
