# Figma handoff

Everything the portal thread needs to build the box's own screen, the portal and the phone from Figma. Claude Code
made these files through Figma's MCP server, in Ben's School team (UofT account).

**The look is direction A, a home-server OS** (Ben's pick, Fri Oct 23): a wallpaper, widgets, an app grid and a dock,
like umbrelOS. Apps open as windows, approvals arrive as notification banners, and the phone is the same OS in a
pocket. The box's screen and the portal are the same desktop: on the box it fills the display, in a browser it fills
the tab. Research and the three directions are in `docs/figma/refs/` and `docs/figma/directions/`.

**Built:** every screen in the set. On the box: home, Tasks, Notification Center, task detail, Activity, Time Machine,
Credit desk, Shopper, Wallet, Find, pairing, and the session restore. On the phone: home, the approval as a
notification, running tasks as Live Activities, and the task list. The clickable prototype is in Figma Design and Figma Make (below).

## Files

| File | Link | What is in it |
|---|---|---|
| Design system and screens | https://www.figma.com/design/oppzH621OOOMA31rgLbxbM | Page "OS screens": the current screens. Page "Design system": tokens, text styles, components. Page "Directions": the three OS directions. Page "Screens": the first, dashboard-style screens (superseded) |
| Ideation board (FigJam) | https://www.figma.com/board/KvHiDv5HIJuGYOZDDkp8VG | Architecture, the four demo moments, the 25 tracks by slot, the moodboard |
| Prototype (Figma Design) | Phone: https://www.figma.com/proto/oppzH621OOOMA31rgLbxbM/?node-id=23-304&starting-point-node-id=23%3A304 · Box: https://www.figma.com/proto/oppzH621OOOMA31rgLbxbM/?node-id=24-454&starting-point-node-id=24%3A454 | The two flows below, wired between the real screens |
| Prototype (Figma Make) | https://www.figma.com/make/19hhCgh3CFsgfi1eBienAS | The same two flows as a small working web page, in direction A's tokens |
| Pitch deck (Figma Slides) | https://www.figma.com/slides/SBrJtJiY20k88X3IGzKwZW | 13 slides: OpenClaw's demand and security record (sourced), doing it by hand, the box, the four moments with their real screens, architecture, tracks, the Figma workflow |

File key for MCP calls: `oppzH621OOOMA31rgLbxbM`. Open a node with
`https://www.figma.com/design/oppzH621OOOMA31rgLbxbM/?node-id=<id with a dash>`.

The API is in `core/README.md`, section "The API for the portal and the phone". The box serves the built portal from
`portal/dist` on the same address as the API, so the box screen and a phone need one address.

## How to read it (the code generation stage)

1. Load the `figma-design-to-code` skill, then `create_session` with the file key.
2. Call `get_design_context` with the file key and a screen's node ID below. It returns reference code, the
   variables it uses (as the CSS names below) and download links for vector assets such as the wallpaper.
3. Build components first (the tables below), then screens from them.
4. Log your own minutes and rating in `docs/stagelog.md` as the code generation stage.

## Screens (page "OS screens", node `23:83`)

The box screen is 1920 x 1080. Phone screens are 390 x 844.

| Screen | Node ID | Screenshot | What it shows, and its data |
|---|---|---|---|
| Box / Home | `23:84` | `docs/figma/os/box-home.png` | Menu bar (box switcher, Notifications with the pending count, clock), greeting, four widgets, the app grid, the dock, and an approval banner. Widgets: pending approvals (SpacetimeDB `approval` where `state` is `pending`), running tasks with their `step` and progress (SpacetimeDB `task`), money spent today (sum of `costCents`), and Time Machine's layer count (finished tasks). App badges count each app's pending approvals |
| Box / Tasks | `24:283` (window `24:383`) | `docs/figma/os/box-tasks.png` | The Tasks app as a window over the desktop. `GET /api/tasks` once, then the SpacetimeDB `task` table live: `title`, `id`, `source`, `step` (Live status), `state`, `costCents` of `budgetCents`. Tabs count by state |
| Box / Task detail | `24:454` (window `24:554`) | `docs/figma/os/box-task-detail.png` | One task as a window. `GET /api/tasks/<id>` (`task`, `approvals`, `events`): steps are its events in `seq` order, blocked rows are `net.blocked` events and failed `tool.result` events. `GET /api/tasks/<id>/diff` for the files. Undo is `POST /api/tasks/<id>/undo` |
| Box / Notification Center | `25:629` (panel `25:804`) | `docs/figma/os/box-notification-center.png` | Opens from Notifications in the menu bar. Pending approvals first (SpacetimeDB `approval` where `state` is `pending`), each with Approve and Deny; then earlier notices from the log: blocked attempts (`net.blocked`) and the session restore |
| Box / Activity | `26:1123` (window `26:1223`) | `docs/figma/os/box-activity.png` | The action log as an activity monitor. Top: one row per task (like processes): runs as, state, steps (`task.step` events), tool calls (`tool.call`), blocked (`net.blocked`), cost, budget. Bottom: the log live over SSE (`GET /api/log?after=<seq>`), blocked lines in the failed color, and today's spend. The spend-per-hour bars are illustrative |
| Box / Time Machine | `27:1063` (window `27:1163`) | `docs/figma/os/box-time-machine.png` | Undo one task. One workspace's layers, newest first (finished tasks: `task.state done` with `layers`), shown as a receding stack and a list. The selected layer's preview: what comes back (its diff, reversed) and what stays (other tasks' files). Undo is `POST /api/tasks/<id>/undo` |
| Box / Credit desk | `26:827` (window `26:927`) | `docs/figma/os/box-credit-desk.png` | The credit desk track's app. `GET /t/credit-desk/runs` and `POST /t/credit-desk/score {run}` (`caught`, `total`, `false_alarms`, `decisions.applications`, `simple_rule`, `moment`). Each row's rule ids come from its `credit-desk.credit_decision` tool call; rules 0.2 |
| Box / Shopper | `30:1183` (window `30:1283`, banner `30:1353`) | `docs/figma/os/box-shopper.png` | The Shopper track's app (`/t/shopper/`) with its purchase banner. Watch list (rules, store, price now, state), orders, and a standing TEST PAYMENTS notice. The banner is an Approval with "Approve $13.00 test payment" |
| Box / Wallet | `30:1369` (window `30:1469`) | `docs/figma/os/box-wallet.png` | The wallet track's app: balance in devnet USDC (test money), the address, how x402 payments work, and each payment with its task, API, amount, status and Solana transaction |
| Box / Find | `31:1407` (panel `31:1583`) | `docs/figma/os/box-find.png` | A Spotlight-style search over tasks, the action log, workspace files and photos. Photos come from the planned Moss index, described on the box's GPU. The two photo thumbnails are AI-generated stand-ins, labeled as such in the layer names |
| Box / Pair a phone | `31:1636` (window `31:1736`) | `docs/figma/os/box-pair.png` | Settings: a QR code, the code to compare, and paired phones. The QR encodes the example `https://box.local/pair?code=7Q4M-2KXD`; the core has no pairing route yet |
| Box / Home after a power cut | `31:1765` | `docs/figma/os/box-after-power-cut.png` | Moment 4 as a session restore: "Welcome back", the running widget says "resumed", and an Info banner lists what picked up where it stopped. Data: the `task.state` events after boot and the boot time |
| Box / Boot | `34:2342` | `docs/figma/os/box-boot.png` | The boot screen after a power cut: the wallpaper, the product name, and progress while the box rebuilds every task from `log.jsonl` (moment 4, before the "Welcome back" home) |
| Phone / Home | `23:304` | `docs/figma/os/phone-home.png` | The same OS on a phone: the Dynamic Island shows how many tasks run, two widgets, the app grid with badges, the dock |
| Phone / Approval notification | `32:1801` | `docs/figma/os/phone-approval.png` | The approval arrives on the lock screen as a notification with full-width Approve and Deny (48 px). Other pending approvals stack below it, collapsed |
| Phone / Live Activity | `32:1853` | `docs/figma/os/phone-live-activity.png` | Running tasks as Live Activities: the Dynamic Island expanded with one task's progress, and lock-screen cards with step progress and the latest `step`. Data: the SpacetimeDB `task` table |
| Phone / Tasks | `32:1907` | `docs/figma/os/phone-tasks.png` | The Tasks app on the phone: filter chips by state and TaskRowCompact rows |

Apps and where they come from: Tasks, Activity and Time Machine are the core's own. Credit desk, Shopper and Wallet
are tracks (`GET /api/apps` lists them; open `/t/<track><href>`). Find is the planned Moss track. Settings holds
pairing.

## Prototype

Two flows, in Figma Design (page "OS screens", flow starting points) and as a Figma Make file:

1. **Phone: approve from a notification** (start `23:304`). The phone home; after 1.2 s the approval drops in as a
   banner (`33:1893`); Approve leads to "running again" (`33:1969`), then the Live Activity and the task list. Deny
   returns home.
2. **Box: undo one task** (start `24:454`). The task detail window; Undo opens a confirm dialog (`33:2041`); confirming
   shows the task undone, its files removed and a new log line (`33:2144`). "Keep it" goes back.

Screenshots of the in-between states: `docs/figma/os/prototype-*.png`. To embed the Design prototype:
`https://www.figma.com/embed?embed_host=share&url=` followed by the URL-encoded prototype link above.

## Components

On the "Design system" page. Desktop pieces are new; window content reuses the first components.

### The desktop

| Component | Node ID | Properties | Notes |
|---|---|---|---|
| Wallpaper | `22:40` (set) | `Size`: Desktop, Phone | Four flat hill layers and a crescent moon, all desktop variables. No gradient, no photo. Export as SVG. Weave art was planned here but Ben's Figma account is not linked to Weave yet |
| MenuBar | `22:68` | `Product name`, `Box name`, `Uptime`, `Status`, `Clock` | The box switcher moves between this box and the Vultr box. Notifications opens Notification Center |
| Dock | `22:99` | none | Apps, a divider, then the boxes. A dot under an app means it has a running task; under a box, it is the one you are on |
| PhoneDock | `22:176` | none | Four apps |
| AppTile | `21:72` (set) | `Size`: 96, 64, 40, 28. `Glyph` (swap) | 96 on the box grid, 64 in docks and on the phone, 40 in banners, 28 in window title bars |
| Glyph/... | `21:20` Tasks, `21:23` Activity, `21:28` Time Machine, `21:32` Credit desk, `21:36` Shopper, `21:40` Wallet, `21:44` Find, `21:50` Settings, `21:54` Pair, `21:59` Box | none | Drawn for this product on a 48 px grid; not an icon library |
| Badge | `21:73` | `Count` | Amber means "needs you" everywhere on the desktop |
| Widget | `21:75` | `Title`, `Value`, `Caption` | A glanceable number. The richer widgets on the home screen are the same glass card with a list or progress bars |
| Banner | `22:67` (set) | `Kind`: Approval, Info. `Size`: Box (460 wide), Phone (366 wide, 48 px buttons). `Kicker`, `Meta`, `Body` | Approval has Approve and Deny (the `answer` reducer or `POST /api/approvals/<id> {approved, by}`). Info is for what the box tells you, such as a session restore |
| WindowChrome | `22:90` | `Title`, `Subtitle` | The title bar of an app window |

### Inside windows

| Component | Node ID | Properties | Maps to |
|---|---|---|---|
| StatusPill | `3:20` (set) | `State`: queued, running, waiting, done, failed, undone | `task.state`. Labels: Queued, Running, Waiting for OK, Done, Failed, Undone (struck through) |
| Button | `3:33` (set) | `Kind`: Primary, Secondary, Danger. `Size`: Regular (36 px), Large (48 px). `Label` | Large on the phone. Danger only for Undo |
| TaskRow | `4:2` | `Title`, `Meta`, `Live`, `Cost`, nested StatusPill | One task: `Live` is `task.step` |
| TaskRowCompact | `9:275` | `Title`, `Live`, `Cost`, nested StatusPill | The phone list |
| ApprovalCard | `4:12` | `Question`, `Amount`, `Context`, `Task`, `Asked` | One pending `Approval`. Hide the amount row when `costCents` is 0 |
| LogStep | `4:38` (set) | `Kind`: Step, Blocked. `Seq`, `Time`, `Text`, `Data` | One log event. `Seq` is `event.seq` |
| DiffLine | `4:48` (set) | `Change`: Added, Removed, Context. `Code` | One line of the unified diff |
| RuleChip | `3:34` | `Rule` | A rule id the credit desk cites |

## Tokens

Every color, spacing and radius in the file is a variable; the CSS names are the variables' code syntax, so
`get_design_context` output already uses them.

The **desktop** (wallpaper, menu bar, widgets, dock) is always dark. **Windows, banners and Notification Center** are
Paper surfaces: light, solid, and readable on any wallpaper.

```css
:root {
  /* Desktop */
  --color-desktop-sky: #27313F;        --color-desktop-moon: #E9DFC8;
  --color-desktop-hill-far: #46586B;   --color-desktop-hill-mid: #36475A;
  --color-desktop-hill-near: #28343F;  --color-desktop-hill-front: #1C252D;
  --color-desktop-glass: #141A21;      /* used at 80% opacity, with backdrop-filter: blur(24px) */
  --color-desktop-glass-edge: #FFFFFF; /* used at 12% opacity as a 1 px border */
  --color-desktop-text: #F2EFE8;       --color-desktop-text-secondary: #B9C0C8;
  --color-desktop-accent: #F2B544;     --color-desktop-on-accent: #1A1206;   /* amber: needs you */
  --color-desktop-tile: #EEEAE2;       --color-desktop-glyph: #1E242B;

  /* Windows, banners, Notification Center (Paper) */
  --color-bg-canvas: #F3F1EA;      --color-bg-surface: #FBFAF6;      --color-bg-sunken: #E6E7E1;
  --color-border-default: #D3D6CF; --color-border-strong: #6B726C;
  --color-text-primary: #1C201D;   --color-text-secondary: #535A54;  --color-text-inverse: #FBFAF6;
  --color-action-primary: #1C201D; --color-action-on-primary: #FBFAF6;
  --color-action-danger: #9C3326;  --color-action-on-danger: #FBFAF6;
  --color-focus: #2D5784;
  --color-state-running-fg: #2D5784; --color-state-running-bg: #DDE8F2;
  --color-state-waiting-fg: #7F4C00; --color-state-waiting-bg: #F8EBD0;
  --color-state-done-fg: #2E6338;    --color-state-done-bg: #DFEDDC;
  --color-state-failed-fg: #9C3326;  --color-state-failed-bg: #F6E0DA;
  --color-state-neutral-fg: #535A54; --color-state-neutral-bg: #E6E7E1;
  --color-diff-add: #DFEDDC;         --color-diff-remove: #F6E0DA;

  --space-1: 4px; --space-2: 8px; --space-3: 12px; --space-4: 16px;
  --space-5: 24px; --space-6: 32px; --space-7: 48px; --space-8: 64px;
  --radius-sm: 4px; --radius-md: 6px; --radius-window: 14px; --radius-widget: 24px; --target-min: 44px;
}
```

Shadows: only things that float above the desktop have one (banners, Notification Center, windows):
`0 12px 32px rgb(0 0 0 / 0.28)`.

The Color collection still has a Night mode from the first design; direction A does not use it.

### Type

Instrument Sans for words people read, IBM Plex Mono for anything a machine wrote: ids, paths, hosts, money in
tables, log lines, rule ids. Both are OFL. **Self-host them** (for example `@fontsource/instrument-sans` and
`@fontsource/ibm-plex-mono`): the box screen must render with no internet.

| Text style | Font | Size / line height | Use |
|---|---|---|---|
| Display/XL | Instrument Sans SemiBold, -1.5 tracking | 96 / 104 | Rare, very large numbers |
| Display/M | Instrument Sans SemiBold, -0.8 | 56 / 64 | The desktop greeting |
| Display/L | Instrument Sans SemiBold, -0.5 | 40 / 48 | Widget values, page titles in windows |
| Title | Instrument Sans SemiBold, -0.2 | 24 / 32 | The line under the greeting, amounts |
| Heading | Instrument Sans SemiBold | 17 / 24 | Window titles, section heads |
| Body | Instrument Sans Regular | 16 / 24 | Text |
| Body strong | Instrument Sans Medium | 16 / 24 | App labels, task titles, buttons |
| Body phone | Instrument Sans Regular | 17 / 24 | Phone body (Apple HIG default) |
| Small | Instrument Sans Regular | 13 / 18 | Secondary lines, phone app labels |
| Label | Instrument Sans Medium, +0.4 | 12 / 16 | Kickers, column heads, state pills |
| Mono | IBM Plex Mono Regular | 14 / 20 | Ids, hosts, money in tables |
| Mono small | IBM Plex Mono Regular | 12 / 16 | Log data, rule chips |

## Rules the screens follow

- Amber on the desktop means "needs you" and nothing else. Inside windows, color means a task state, and the state is
  always also written as a word.
- Glass is only for things that sit on the wallpaper (widgets, dock, the box switcher), and it is 80% opaque, so text
  keeps its contrast on any wallpaper. Anything you read closely is a solid Paper surface.
- Money is shown against its budget: `$0.03 of $0.50`. The core formats dollars as `$X.XX`.
- Every log step shows its `seq`, so anything on screen can be found in `log.jsonl`.
- Blocked attempts are shown in full, in the failed color, with what was stopped and why.
- Test payments say TEST in words, on the banner and in the app.
- Touch targets on the phone are at least 44 pt (Apple HIG).
- The box screen stays on: shift the whole layout by a few pixels every few minutes to avoid burn-in.

## Contrast

All text passes WCAG AA (4.5:1). Desktop: text on glass 14.1:1, secondary text on glass 8.8:1, amber on glass 8.9:1,
glyph on tile 13.0:1, text on the bare sky 10.5:1. Paper: the lowest pair is 5.7:1.

## What is illustrative

These are examples in the mockups; the real values come from the running box.

- Task ids, times, costs, the greeting's name, and counts like "9 layers".
- The Vultr box in the switcher and dock: the second box is planned, not running yet.
- Credit desk scores: score the desk's log against `answer_key.json` (see its `scoring` field).
- "Box" is a placeholder product name until Ben names the OS (MenuBar `Product name`).
