# Figma handoff

Everything the portal thread needs to build the portal, the phone view and the box's own screen from Figma.
Claude Code made these files through Figma's MCP server, in Ben's School team (UofT account). Screenshots of
every screen are in `docs/figma/`.

## Files

| File | Link | What is in it |
|---|---|---|
| Ideation board (FigJam) | https://www.figma.com/board/KvHiDv5HIJuGYOZDDkp8VG | Architecture, the four demo moments, the 25 tracks by slot |
| Design system and screens | https://www.figma.com/design/oppzH621OOOMA31rgLbxbM | Page "Design system": tokens, text styles, components, foundations sheet. Page "Screens": the 9 screens |
| Prototype (Figma Make) | added after the prototype stage | Approve from the phone; undo one task |
| Pitch deck (Figma Slides) | added after the slides stage | |

File key for MCP calls: `oppzH621OOOMA31rgLbxbM`.

The API these screens use is in `core/README.md`, section "The API for the portal and the phone". The box
serves the built portal from `portal/dist` on the same address as the API, so the box screen and a phone need
one address.

## How to read it (the code generation stage)

1. Load the `figma-design-to-code` skill, then `create_session` with the file key.
2. Call `get_design_context` with the file key and a screen's node ID below. It returns reference code and a
   screenshot. Adapt it to the portal's own components and the tokens below; do not paste it as is.
3. Use `get_variable_defs` on a node if you need the exact variables it uses.
4. Log your own minutes and rating in `docs/stagelog.md` as the code generation stage.

## Screens

All portal screens are 1440 wide with a 240 px side nav. Phone screens are 390 x 844. The box screen is
1920 x 1080 in Night mode. Open any of them with `https://www.figma.com/design/oppzH621OOOMA31rgLbxbM/?node-id=<id with a dash>`.

| Brief | Screen (frame name) | Node ID | Screenshot | Data it shows |
|---|---|---|---|---|
| a | Portal / Tasks | `6:16` | `docs/figma/a-portal-tasks.png` | `GET /api/tasks` once, then the SpacetimeDB `task` table live: `title`, `id`, `source`, `step` (the Live column), `state`, `costCents` of `budgetCents`. Filter tabs count by state |
| b | Portal / Approvals | `7:126` | `docs/figma/b-portal-approvals.png` | The SpacetimeDB `approval` table where `state` is `pending` (or `GET /api/approvals?state=pending`): `question`, `costCents`, `task`. Approve and Deny call the `answer` reducer or `POST /api/approvals/<id> {approved, by: "portal"}`. The answered list is the same table with `state` approved or denied, and `by` |
| c | Portal / Task detail | `8:191` | `docs/figma/c-task-detail.png` | `GET /api/tasks/<id>` (`task`, `approvals`, `events`): steps are its events in `seq` order. `GET /api/tasks/<id>/diff` (`changes`, `diff`). Undo is `POST /api/tasks/<id>/undo`. Blocked rows are `net.blocked` events and failed `tool.result` events |
| d | Phone / Approval | `9:284` | `docs/figma/d-phone-approval.png` | One pending approval, large buttons |
| d | Phone / Tasks | `9:349` | `docs/figma/d-phone-tasks.png` | Compact task list |
| d | Phone / Approved | `9:305` | `docs/figma/d-phone-approved.png` | The state after Approve: the task runs again |
| e | Box screen / Status | `10:353` | `docs/figma/e-box-screen.png` | Pending approvals (count and questions), running tasks with their `step`, the last 3 lines of `GET /api/log`, `GET /api/health`, pairing QR and code |
| f | Portal / Credit desk | `11:353` | `docs/figma/f-credit-desk.png` | The credit desk track's routes: `GET /t/credit-desk/runs` (runs and their two seat tasks) and `POST /t/credit-desk/score {run}` (`caught`, `total`, `false_alarms`, `decisions.applications`, `simple_rule`, `moment`). Each row's rules come from the `credit-desk.credit_decision` tool calls in the log. The track has no `apps` entry yet, so the side nav link is the portal's own |
| g | Phone / Shopper approval (Visa, test payment) | `9:423` | `docs/figma/g-phone-shopper-visa.png` | A purchase within budget, marked as a test payment |

The foundations sheet (colors in both modes, type ramp, spacing) is node `12:16`, screenshot `docs/figma/foundations.png`.

## Components

All on the "Design system" page. Text properties are named so you can map them straight to data.

| Component | Node ID | Properties | Maps to |
|---|---|---|---|
| StatusPill | `3:20` (set) | `State`: queued, running, waiting, done, failed, undone | `task.state`. Labels: Queued, Running, Waiting for OK, Done, Failed, Undone (struck through) |
| Button | `3:33` (set) | `Kind`: Primary, Secondary, Danger. `Size`: Regular (36 px), Large (48 px). `Label` | Large on the phone and box screen. Danger only for Undo |
| RuleChip | `3:34` | `Rule` | A rule id from `tracks/credit-desk/rules/credit-rules.draft.yaml` |
| TaskRow | `4:2` | `Title`, `Meta`, `Live`, `Cost`, nested StatusPill | One task: `Live` is `task.step` |
| TaskRowCompact | `9:275` | `Title`, `Live`, `Cost`, nested StatusPill | The phone list |
| ApprovalCard | `4:12` | `Question`, `Amount`, `Context`, `Task`, `Asked` | One pending `Approval`. Hide the amount row when `costCents` is 0 |
| LogStep | `4:38` (set) | `Kind`: Step, Blocked. `Seq`, `Time`, `Text`, `Data` | One log event. `Seq` is `event.seq` |
| DiffLine | `4:48` (set) | `Change`: Added, Removed, Context. `Code` | One line of the unified diff |
| NavItem | `4:55` (set) | `State`: Default, Current. `Label`, `Count` | Side nav entries |
| SideNav | `5:6` | `Product name` (placeholder "Box") | Portal navigation. Apps come from `GET /api/apps` |

## Tokens

Every color in the file is a variable. The Color collection has two modes: **Paper** (portal and phone) and
**Night** (the box's own screen, which stays on all day). The CSS names below are the variables' code syntax,
so `get_design_context` output already uses them.

```css
:root {                                  /* Paper */
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
}
[data-theme="night"] {                   /* Night: the box screen */
  --color-bg-canvas: #121513;      --color-bg-surface: #1C201D;      --color-bg-sunken: #262B27;
  --color-border-default: #3A403B; --color-border-strong: #6B726C;
  --color-text-primary: #ECEAE3;   --color-text-secondary: #B4B9B3;  --color-text-inverse: #121513;
  --color-action-primary: #ECEAE3; --color-action-on-primary: #121513;
  --color-action-danger: #EE9C8A;  --color-action-on-danger: #121513;
  --color-focus: #9CBDE0;
  --color-state-running-fg: #9CBDE0; --color-state-running-bg: #142235;
  --color-state-waiting-fg: #E9B65A; --color-state-waiting-bg: #3A2A0D;
  --color-state-done-fg: #8CC495;    --color-state-done-bg: #15281A;
  --color-state-failed-fg: #EE9C8A;  --color-state-failed-bg: #3B1913;
  --color-state-neutral-fg: #B4B9B3; --color-state-neutral-bg: #262B27;
  --color-diff-add: #15281A;         --color-diff-remove: #3B1913;
}
:root {
  --space-1: 4px; --space-2: 8px; --space-3: 12px; --space-4: 16px;
  --space-5: 24px; --space-6: 32px; --space-7: 48px; --space-8: 64px;
  --radius-sm: 4px; --radius-md: 6px; --target-min: 44px;
}
```

All text pairs pass WCAG AA (4.5:1) in both modes; the lowest is 5.7:1. `--color-border-strong` is for control
outlines only.

### Type

IBM Plex Sans for words people read, IBM Plex Mono for anything a machine wrote: ids, paths, hosts, money,
log lines, rule ids. Both are OFL. **Self-host them** (for example `@fontsource/ibm-plex-sans` and
`@fontsource/ibm-plex-mono`): the box screen must render with no internet.

| Text style | Font | Size / line height | Use |
|---|---|---|---|
| Display/XL | Plex Sans SemiBold, -1.5 tracking | 96 / 104 | Box screen headline ("3 tasks need you") |
| Display/L | Plex Sans SemiBold, -0.5 | 40 / 48 | Page titles, phone amounts |
| Title | Plex Sans SemiBold, -0.2 | 24 / 32 | Amounts, box screen lines |
| Heading | Plex Sans SemiBold | 17 / 24 | Section heads, approval questions |
| Body | Plex Sans Regular | 16 / 24 | Portal body |
| Body strong | Plex Sans Medium | 16 / 24 | Task titles, buttons |
| Body phone | Plex Sans Regular | 17 / 24 | Phone body (Apple HIG default) |
| Small | Plex Sans Regular | 13 / 18 | Secondary lines |
| Label | Plex Sans Medium, +0.4 | 12 / 16 | Column heads, kickers, state pills |
| Mono | Plex Mono Regular | 14 / 20 | Ids, hosts, money |
| Mono small | Plex Mono Regular | 12 / 16 | Log data, rule chips |

## Rules the screens follow

- Color only ever means a task state, and the state is always also written as a word.
- Money is shown against its budget: `$0.03 of $0.50`. The core formats dollars as `$X.XX` (`core/box.ts`).
- Every log step shows its `seq`, so anything on screen can be found in `log.jsonl`.
- Blocked attempts are shown in full, in the failed color, with what was stopped and why.
- Test payments say TEST in words, on the card itself.
- No shadows. Surfaces separate with a 1 px `--color-border-default` line. Radius 4 for controls, 6 for cards.
- Phone and box screen buttons are 48 px tall (HIG minimum is 44 pt).
- The box screen stays on: shift the whole layout by a few pixels every few minutes to avoid burn-in.

## What is illustrative

These values are examples in the mockups; the real ones come from the running box.

- Task ids, times, costs and the "1,284" log count.
- Credit desk "Caught 14 of 14": score the desk's log against `answer_key.json` (see its `scoring` field).
  Decisions, limits, rule ids and the fraud evidence are the answer key's expected results.
- The shopper item and prices. The Visa test card ending 4242 is Stripe's standard test card.
- The pairing QR encodes `https://box.local/pair?code=7Q4M-2KXD`. The core has no pairing route yet: the core
  thread decides the real URL.
- "Box" is a placeholder product name until Ben names the OS (SideNav `Product name` property).
