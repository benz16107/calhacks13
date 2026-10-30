# The portal: GurtOS on the box's screen, a laptop and a phone

One web app in three places. The box serves it on the same address as its API:

- **The box's own screen** (`/screen`, full screen in the kiosk): a desktop with a top bar, a dock, windows you can
  move, resize, minimize and maximize, Notification Center, Control Center, a lock screen, and a boot screen while
  the box starts. The first time the box starts, the setup wizard runs here.
- **A laptop** (`/`): the same desktop.
- **A phone** (`/`, under 700 px wide): a home screen with what needs you, a tab bar, and one app at a time.

It is built from the GurtOS design system (`docs/figma/system.md`, screens in `docs/figma/os-v2/`) as a kit of CSS
and Preact components in `src/kit/`. Track apps get the same kit at `/kit/gurtos.css` and `/kit/gurtos.js`:
see [KIT.md](KIT.md) and the live style guide at `/kit/index.html`.

Every screen shows the box's real state: tasks and approvals from SpacetimeDB on the box's own screen, and the action
log over Server-Sent Events everywhere. Money from a test app (Shopper, Agent wallet) is test money and says so.

## Figma and the real app

Left: the Figma frame. Right: the app running on a dev box with scripted tasks (`./dev-box.sh`), at the same size.
The real screens show the dev box's data, so names and numbers differ from the mockups.

### The desktop (1920 x 1080)

| Figma | The app |
|---|---|
| ![](../docs/figma/os-v2/desktop/home-approval-banner.png) | ![](screenshots/desktop.png) |
| ![](../docs/figma/os-v2/desktop/notification-center.png) | ![](screenshots/notification-center.png) |
| ![](../docs/figma/os-v2/desktop/control-center.png) | ![](screenshots/control-center.png) |
| ![](../docs/figma/os-v2/desktop/lock-screen.png) | ![](screenshots/lock.png) |
| ![](../docs/figma/os-v2/desktop/boot-after-power-cut.png) | ![](screenshots/boot.png) |
| ![](../docs/figma/os-v2/desktop/restored-after-power-cut.png) | ![](screenshots/restored.png) |
| ![](../docs/figma/os-v2/windows/tasks.png) | ![](screenshots/tasks.png) |
| ![](../docs/figma/os-v2/windows/task-detail.png) | ![](screenshots/task.png) |
| ![](../docs/figma/os-v2/windows/task-detail-undo-confirm.png) | ![](screenshots/task-undo.png) |
| ![](../docs/figma/os-v2/windows/activity.png) | ![](screenshots/activity.png) |
| ![](../docs/figma/os-v2/windows/time-machine.png) | ![](screenshots/time-machine.png) |
| ![](../docs/figma/os-v2/windows/app-center.png) | ![](screenshots/app-center.png) |
| ![](../docs/figma/os-v2/windows/app-center-shopper-detail.png) | ![](screenshots/app-center-detail.png) |

Show Apps, with search: ![](screenshots/show-apps.png)

### Setup (1920 x 1080)

| Figma | The app |
|---|---|
| ![](../docs/figma/os-v2/setup/01-welcome.png) | ![](screenshots/setup/01-welcome.png) |
| ![](../docs/figma/os-v2/setup/04-owner.png) | ![](screenshots/setup/04-owner.png) |
| ![](../docs/figma/os-v2/setup/05-ai-models.png) | ![](screenshots/setup/05-model-key.png) |
| ![](../docs/figma/os-v2/setup/06-permissions.png) | ![](screenshots/setup/06-permissions.png) |
| ![](../docs/figma/os-v2/setup/12-done.png) | ![](screenshots/setup/08-done.png) |

All eight steps are in `screenshots/setup/`: welcome, network, name and time zone, owner, model key, permissions,
updates, done. Setup asks only what GurtOS needs. Apps are optional and stay in App Center, so the frames' Apps, Keys
for apps, Remote access, Privacy and Appearance steps are left out; each is in Settings. The screenshots are from a
fresh dev box (`DEV_SEED=fresh ./dev-box.sh`): no keys, no tasks.

The pairing QR opens this computer's own pairing page on the home network, so the phone has to be on the same
Wi-Fi. It goes through app.gurtos.com only when that helps: with remote access on, or during setup when GurtOS's relay
answers (then the phone can pair over the internet). When the relay doesn't answer, Remote access says so and points
to running your own (`src/relay.ts` holds the relay's address; docs/self-host.md).

### Settings (1920 x 1080)

| Figma | The app |
|---|---|
| ![](../docs/figma/os-v2/settings/03-permissions.png) | ![](screenshots/settings/03-permissions.png) |
| ![](../docs/figma/os-v2/settings/03-permissions-dark.png) | ![](screenshots/settings/03-permissions-dark.png) |
| ![](../docs/figma/os-v2/settings/04-accounts-and-keys-replace-sheet.png) | ![](screenshots/settings/04-keys-replace-sheet.png) |
| ![](../docs/figma/os-v2/settings/06-devices.png) | ![](screenshots/settings/06-devices.png) |

All ten pages are in `screenshots/settings/`.

### The kiosk (1280 x 800, the box's real display)

| The desktop | A task |
|---|---|
| ![](screenshots/kiosk.png) | ![](screenshots/kiosk-task.png) |
| ![](screenshots/setup/kiosk-1280.png) | ![](screenshots/settings/kiosk-devices.png) |

### The phone (390 x 844)

| Figma | The app |
|---|---|
| ![](../docs/figma/os-v2/phone/1-home.png) | ![](screenshots/phone-home.png) |
| ![](../docs/figma/os-v2/phone/4-tasks.png) | ![](screenshots/phone-tasks.png) |
| ![](../docs/figma/os-v2/phone/5-task-detail.png) | ![](screenshots/phone-task.png) |
| ![](../docs/figma/os-v2/phone/7-setup-step-5.png) | ![](screenshots/setup/phone.png) |

An unpaired phone: ![](screenshots/phone-pair-first.png)

Differences from the frames, on purpose:

- The phone's home keeps Approve and Deny on each request (QA asked for one tap, not three), and adds Apps and
  "Ask the box" under the frame's two lists. Figma's lock-screen notification, Live Activities and Dynamic Island
  belong to the phone's own OS, which a web page can't draw.
- No greeting names a person: setup doesn't ask for a name.
- Control Center has no Power button and no "Pause agents" tile, and the lock screen has no passcode: the box has no
  API for them yet. Larger text takes the fourth tile.

### GurtOS Business (1920 x 1080 and 390 x 844)

The approved frames from `docs/figma/business/`, beside the app on a dev box seeded as Fogline Supply
(`DEV_SEED=business ./dev-box.sh`, scripted seats, sandbox data). Everything on these screens comes from the box:
`GET /api/me`, `/api/business`, `/api/people` and `/api/audit` (core/README.md, "Business edition").

| Figma | The app |
|---|---|
| ![](../docs/figma/business/1a-people.png) | ![](screenshots/business/1a-people.png) |
| ![](../docs/figma/business/1b-add-a-person.png) | ![](screenshots/business/1b-add-a-person.png) |
| ![](../docs/figma/business/2-rules.png) | ![](screenshots/business/2-rules.png) |
| ![](../docs/figma/business/4-audit.png) | ![](screenshots/business/4-audit.png) |
| ![](../docs/figma/business/5a-kill-switch-box.png) | ![](screenshots/business/5a-kill-switch-box.png) |
| ![](../docs/figma/business/5c-all-agents-paused.png) | ![](screenshots/business/5c-all-agents-paused.png) |

The phones (Figma `3-waiting-for-me-rosa-phone.png`, `5b-kill-switch-phone.png`, `6-server-vs-business.png`):

| Rosa: Waiting for me | Rosa: the request | Sam: his request | Priya: Kill switch | Priya: paused |
|---|---|---|---|---|
| ![](screenshots/business/3-waiting-rosa-phone.png) | ![](screenshots/business/3-request-rosa-phone.png) | ![](screenshots/business/6-my-request-sam-phone.png) | ![](screenshots/business/5b-kill-switch-phone.png) | ![](screenshots/business/5b-paused-phone.png) |

Two phones, one request: Rosa approves $40,000 on hers, and Sam's shows who answered.

| Rosa approves | Sam's phone after |
|---|---|
| ![](screenshots/business/two-phones-rosa-approves.png) | ![](screenshots/business/two-phones-sam-after.png) |

Differences from the frames, on purpose:

- **Who is signed in.** A phone is the person it was paired for (Settings, People, Pair a phone). The box's own
  screen picks a person from the top bar's person menu, and sends it with every call; without one it answers nothing.
- **Add a person** has no email field and says "Add", not "Add and invite": the box sends no email. It shows the
  person's pairing QR code right after adding them.
- **Rules** are the box's policy lines with their values editable in place. The frame's "The Credit analyst may
  approve up to $10,000 on its own" is the credit desk's own rules file, so it shows on People under Agent seats, not
  as a box rule. "Remind Priya when the Controller hasn't answered" is left out: reminders aren't built.
- **Who clears fraud flags** is a name in the rules ("Fraud referrals go to the fraud reviewer"), and "Can clear fraud
  flags" on a person adds them to it. Rosa is the only one.
- **Counts are real.** "Needs you" counts only what the rules send to the person signed in, so Priya, who approves
  nothing, sees none. The frames show 3 for everyone.
- **The request's checks** are the agent's own steps from the log, before it asked.
- Control Center's network tile shows the box's address; the screenshots leave it out.

## The four moments on screen

1. **Undo one task.** Tasks, History and the task window each undo one task behind an alert: "Its files are
   removed. Every other task keeps its own." A Shopper task's alert says its test payment is refunded.
2. **The booby-trapped page.** The task window opens with a red alert: what it tried to reach, the hosts it may
   reach, and that it never held a key. Each blocked step is red in the steps and in Activity.
3. **A pause for your OK.** A request arrives as a banner on the desktop and on every paired phone at once. The
   first answer wins: the request shows "Approved" for a moment, and another screen shows "Already approved on
   Rosa's iPhone".
4. **Pull the plug.** The box's screen shows the boot screen while the box is out of reach, then "Welcome back":
   how many tasks resumed, what still needs you, and "Paid twice: 0", counted from the log. Windows come back where
   they were. A phone shows a red bar within about 10 seconds and won't send an answer until the box is back.

## The flight recorder

Replay (the Task window's Replay button, or the Tasks menu) plays a task's action log back like a video: every step,
tool call, blocked attempt, request and who answered, spending so far, Done or Failed, and Keep or Undo. Play and
pause, step, Next event (the next request, block, error, Keep or Undo), and a scrubber with those events marked. At
each point it shows the task's files as they were there (GET /api/tasks/:id/replay and /diff?at=), against your files. A task
from before GurtOS kept files at each step shows its final changes; an undone task whose files are gone says so.
Space, the arrow keys, Home, End and N work from the keyboard, and a screen reader hears each point.

| Desktop | Dark | Phone |
|---|---|---|
| ![](screenshots/replay-desktop.png) | ![](screenshots/replay-desktop-dark.png) | ![](screenshots/replay-phone.png) |

## Opening it

| From | Address |
|---|---|
| The box's own screen | `http://127.0.0.1:7700/screen` (the kiosk) |
| A laptop or phone | `http://<box address>:7700/`, after pairing |

Off the box's own screen the box answers only paired devices (core c6f747e). An unpaired device sees "Pair this
phone first": scan the QR code in Settings, Devices on the box's screen (it opens `/#pair/<code>`), or type the code.
A paired device sends its token on every call, and as `?access_token=` on the log stream and on track pages in a
window. SpacetimeDB listens on the box's loopback only, so only the box's own screen subscribes to it; phones follow
the log stream. Owner-only actions (setup, settings, keys, apps, devices) work on the box's screen and on a phone
paired as the owner.

## Building and testing

```
cd portal
npm ci                 # esbuild, Preact, the two fonts, a QR encoder: build-time only
npm run build          # writes dist/ (committed, so the box needs no build step), including dist/kit/
node icons.ts          # regenerate src/kit/icons.ts from the system's Adwaita icons
./dev-box.sh           # a seeded box on a Lima test VM at http://127.0.0.1:7790 serving this dist/
./dev-box.sh dist      # ship a new build to it; reload the page
./dev-box.sh restart   # pull its plug and boot it again on the same data
DEV=mine DEV_PORT=7792 ./dev-box.sh   # a second dev box beside it, for another checkout
# DEV_VM (how to reach the VM) and DEV_URL (the address in the pairing QR) are settings too: see the script's top
```

`demo.ts` is the portal's step in `./demo`. The VM has no browser, so it checks what the browser needs: `dist/` is
built from the current sources; the box serves the app, its fonts and wallpaper, and the kit at `/kit/`; the client
routes load; every API the portal reads answers, including the log stream. Then the setup wizard's round trip,
through the same calls: reopen, record a step, a step over 4 KB refused, Permissions through `PATCH
/api/settings` with a bad value refused by name, a key set write-only (no answer ever carries its value), App
Center's key names, a phone paired the ordinary way refused (403) for settings, keys and setup, Revoke, and Finish.

The QA scenarios were replayed with Playwright against a dev box, with the phones' requests sent through a proxy
header so the box treats them as off-box: an unpaired phone, live hosts on a new task, two taps 0.4 s apart (one
approval), the second phone's "Already denied on Rosa's iPhone", and an outage noticed in 9 seconds.

Files: `src/live.ts` (the box's state: HTTP, SpacetimeDB, the log stream, answers, outage detection),
`src/wm.tsx` (windows), `src/shell.tsx` (top bar, desktop, dock, notifications, Control Center, lock, boot,
phone home and tab bar), `src/setup.tsx`, `src/apps/` (Tasks, the task window, Activity, History, Settings,
App Center, track windows, pairing), `src/kit/` (tokens, components, icons, app icons, wallpaper).

## Accessibility

- Every control is a real button, link, input or select with a name. Menus, toggle groups and the Tasks table move
  with the arrow keys; sheets and alerts keep focus inside and return it when they close; Escape closes popovers.
- Every state is a word as well as a color. Text pairs meet WCAG AA in Light and Dark.
- Larger text, high contrast and reduce motion are in Settings, Appearance, and Larger text in Control Center.
  The system's reduce-motion setting is honored too.
- Phone buttons are 44 px tall.

## Limits and asks

- **For the core:** restart, power off and pause agents; joining Wi-Fi, renaming the box and setting its time zone
  (setup keeps those answers in the step's data only); `box-update` status and rollback over the API; the log's size
  and path; a screen passcode; a per-folder read or change mode.
- **Track pages that need restyling to the kit** (their threads own them): Example (`/t/example/`), ASI:One
  (`/t/fetch/`) and Agent wallet (`/t/wallet/`) are unstyled HTML; Shopper and GurtOS Test Store (`/t/shopper/`) use
  their own look and draw their own title, which the window already shows. Figma has frames for each in
  `docs/figma/os-v2/tracks/`. Loading `/kit/gurtos.js` also makes their own fetches carry the phone's token.
- **For the core and the image:** nothing reads Settings `autoUpdate` and `updateChannel` yet, so Settings and setup
  don't show them; Updates shows the running system and how updates work. Owner rights on a phone that is not the
  owner are found by a `GET /api/vault` that answers 403 (a console error); a field in `GET /api/system` would do.
- Progress bars measure only when a task's step says "n of m"; otherwise they move without a number.
