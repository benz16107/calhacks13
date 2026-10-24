# The GurtOS system

How every GurtOS screen is built: the box's own screen, the portal in a browser, the phone, and Personal's own
windows on GNOME. This is our HIG. The Figma source is the page "GurtOS system" in the
[design file](https://www.figma.com/design/oppzH621OOOMA31rgLbxbM) (node IDs below). The research behind it is in
`refs/os-system/`, and the first screens built with it are in `os-v2/`.

## Why it changed

The first build designed each app as its own page, so every app had its own layout, menus and buttons. It looked like
a set of SaaS dashboards. Now there is one system underneath. Every app is a window with the same header bar. Every
setting is a row in a boxed list. Everything that waits for you carries the same amber count.

The system is rooted in GNOME's libadwaita, because GurtOS is Ubuntu underneath and Personal runs on GNOME. It takes
elementary OS's restraint. It keeps GurtOS's own identity: the night wallpaper, the amber "needs you", the app
icons, and a hyperlegible typeface.

## Five rules

1. **One accent, one alarm.** Blue (`accent`) means "you can act here": the main button, a switch that is on, the
   selection. Amber (`attention`) means one thing only: an approval that waits for you. Red (`destructive`) is for
   undo, delete and blocked attempts. Nothing else is colored except app icons.
2. **Windows, not pages.** An app is a window with a header bar. It never takes over the screen with its own
   navigation.
3. **Rows, not forms.** Settings and choices are rows in boxed lists. One control per row, at the end.
4. **Shadows only on what floats.** Windows, popovers, dialogs and notifications have elevation. Cards on a window
   get the faint Elevation 1 and a border. Nothing else has a shadow.
5. **Say what will happen.** Buttons are verbs with their object ("Approve $8.00", "Undo task"). Subtitles say the
   effect ("The task pauses until you answer").

## Foundations

### Type: Atkinson Hyperlegible Next and Mono

One family for the whole OS. The Braille Institute designed Atkinson Hyperlegible for low-vision readers, and its
letters are drawn to be told apart: capital I, lowercase l and 1 differ, and zero is slashed so it never reads as O.
GurtOS shows people pairing codes (`7Q4M-2KXD`), task IDs (`box-tq3x8k2m1v`), money and host names, often on a box
screen across the room or on a phone in a hurry. Misreading one of those is the failure we design against. The Mono
cut covers IDs, codes and log lines with the same shapes. Both are SIL OFL and on Fontsource, so the box renders them
with no internet. We did not use Inter, Geist or Space Grotesk; GNOME's own Adwaita Sans is based on Inter.

| Style | Size / line | Weight | Use |
|---|---|---|---|
| Display | 34 / 40 | Bold | Setup titles |
| Title 1 | 28 / 34 | Bold | Page titles, big numbers in summaries |
| Title 2 | 22 / 28 | Bold | Section titles on long pages |
| Title 3 | 18 / 24 | SemiBold | Dialog titles |
| Heading | 15 / 20 | Bold | Header bar titles, group titles, button labels |
| Body strong | 15 / 22 | Medium | Task names, selected sidebar item |
| Body | 15 / 22 | Regular | Everything else |
| Caption strong | 13 / 18 | SemiBold | Column headers, badges |
| Caption | 13 / 18 | Regular | Subtitles, hints |
| Mono | 14 / 20 | Mono Regular | IDs, codes, paths in logs |
| Numeric | 40 / 44 | Bold | One big number in a widget |

Figma text styles are named `GurtOS/<style>`. Larger text in Accessibility scales every style by 1.25.

### Color

Variables in the collection "GurtOS Color", modes Light and Dark. CSS names are `--color-<group>-<name>`.

| Token | Light | Dark | Use |
|---|---|---|---|
| `window/bg` | #F6F5F2 | #1E2228 | Window background |
| `view/bg` | #FDFCFA | #262B32 | Content views, tables, fields |
| `sidebar/bg` | #ECEAE5 | #181B20 | Sidebars, the setup step list |
| `headerbar/bg` | #EDEBE6 | #2B3038 | Header bars |
| `card/bg` | #FEFDFB | #2C3139 | Boxed lists |
| `popover/bg` | #FEFDFB | #30363F | Menus, popovers |
| `button/bg` | #E3E0DA | #3A404A | Default buttons, toggle groups |
| `border/default` | #DCD8D0 | #3B414B | Separators, card edges |
| `border/strong` | #8A8D92 | #737A84 | Field edges, the off switch (3:1) |
| `text/primary` | #1D2127 | #EEECE7 | Text and symbolic icons |
| `text/secondary` | #565C64 | #AEB4BC | Subtitles, captions |
| `accent/bg` | #2F64A6 | #78A9E6 | Suggested buttons, switches on, progress |
| `accent/fg` | #2A5C99 | #8DB8EE | Links, focus ring |
| `accent/subtle` | #DCE6F3 | #2C4361 | Selected rows and sidebar items |
| `attention/bg` | #F2B544 | #F2B544 | The amber count; text on it is #1A1206 |
| `attention/fg` | #7E5200 | #F2C063 | Amber text ("Asks to spend $8.00") |
| `success/fg` | #2E6B3A | #7CC48A | Done, connected |
| `destructive/bg` | #B3392B | #E06A5B | Destructive buttons |
| `destructive/fg` | #A3322A | #F08A7D | Blocked, failed |

The desktop tokens (`desktop/*`, `topbar/*`, `dock/*`) are the same in both modes: the top bar is always dark and the
wallpaper is always night. Translucent chrome uses tokens with alpha built in (`topbar/pill` 12%, `dock/surface` 80%,
`dock/edge` 12%, `scrim` 45%), never a paint opacity on top of a token. Each app icon has its own tile color
(`app/*`), muted so a dock of ten reads as one set.

Contrast, checked with the WCAG formula: body text is at least 13.4:1 in Light and 11.1:1 in Dark. Secondary text is
at least 5.6:1 and 6.3:1. Every colored text token is at least 5.3:1 on every surface. White on the accent is 6.0:1,
and dark text on the amber is 10.1:1. Field edges and the off switch are at least 3:1 (WCAG 1.4.11).

### Spacing, radius, size

A 6 px grid, as in GNOME: `space/xxs` 3, `xs` 6, `sm` 12, `md` 18, `lg` 24, `xl` 36, `xxl` 48.

- Inside a control: 6. Between controls and inside rows: 12. Window and dialog padding: 18 to 24. Between groups on
  a page: 22 to 24. Setup pages: 36 to 48.
- Radius: `sm` 6 for buttons, fields and sidebar items; `md` 12 for boxed lists, cards and popovers; `lg` 15 for
  windows; `xl` 24 for the dock and phone sheets; `full` for pills, switches and badges. A container's radius is its
  child's radius plus the gap between them (the toggle group is 6 + 3 = 9).
- Sizes: controls 34 tall, large controls 44 (setup and phone, the touch minimum), rows 52 or 64 with a subtitle,
  header bars 47, the top bar 32.

### Elevation

Four effect styles, `GurtOS/Elevation 1` to `4`: card (boxed lists on a window), popover (menus, dropdown lists,
toasts), window, dialog (dialogs, sheets, notifications over the desktop).

### Motion

`motion/duration-fast` 100 ms for press and hover, `base` 200 ms for popovers, toasts and switches, `slow` 300 ms for
windows, sheets and setup pages. Things arriving ease out, things leaving ease in. With Reduce motion on, everything
fades in place with no movement. The box screen shifts its whole layout by a few pixels every few minutes against
burn-in.

### Icons

- **Symbolic icons** are GNOME's Adwaita set, 16 px, from adwaita-icon-theme (GNOME Project, CC BY-SA 3.0 or LGPL 3;
  credit "GNOME Project" in About). They take the text color, so they work in both modes. 51 are in Figma as
  `icon/<adwaita name>`. Add more from the same theme only; never mix in another family.
- **App icons** are GurtOS's own: one glyph on a 48 px grid with 3 px round strokes, on a rounded tile in the app's
  color, with a 3 px darker bottom edge for depth. 11 are in Figma as `app/<name>`. A new app gets a new glyph in the
  same style, not a logo.

## Containers: which one to use

| Use | When | Example |
|---|---|---|
| **Window** | An app, or a place you stay and come back to | Tasks, Settings, App Center, a track's app |
| **Window with a sidebar** | An app with four or more places | Settings, App Center, Time Machine |
| **Sheet** | A short job inside one window that you finish or cancel before going back. Dims that window only | Add a folder, Set a key, Pair a phone |
| **Alert dialog** | One decision with consequences. The title is the question; buttons name the actions; Cancel comes first; a destructive action is tinted red | "Undo this task?" Cancel / Undo task |
| **Popover** | A short list or a few quick settings next to the control that opened it. Closes when you click outside. No more than two fields | Dropdown lists, top bar menus, Control Center |
| **Toast** | Confirms something that just happened, with Undo when it can be undone. 4 seconds, bottom center of the window, one at a time | "Folder removed. Undo" |
| **Notification** | Something happened while you were elsewhere, or needs you. Approvals stay in Notification Center until someone answers | An approval with Deny and Approve |
| **Status page** | An empty or error state: big symbolic icon, a title, one sentence, at most one button | "No tasks yet" |
| **Setup** | First run only. One decision per step | The setup wizard |

## Window anatomy

- **Header bar**, 47 px, `headerbar/bg` with a bottom border. Start: the main action ("New Task") or Back. Center:
  the title, or a toggle group when the window has two to five views of the same content. End: search, the menu
  (`open-menu`), then the window controls. At most three buttons on each side.
- **Window controls**: minimize, maximize and close as 24 px circles, 12 px apart, at the end of the header bar.
  Dialogs show close only.
- **Sidebar**: 280 px, `sidebar/bg`, its own header bar with the app's name, then search, then items in groups with
  thin separators. Selected is `accent/subtle`. An amber count on an item means something there waits for you.
- **Content**: preference pages are clamped to 680 px and centered. Tables and logs use the full width.

## Boxed lists and rows

- A group is a Heading, an optional one-line caption, then a card (`card/bg`, `radius/md`, `border/default`,
  Elevation 1) of 2 to 8 rows.
- A row is an optional symbolic icon, a title, an optional subtitle, and one control at the end. Switch applies at
  once. Combo opens a popover list. Disclosure (`pan-end`) opens a subpage. Button runs an action. Value is read only.
- An "add" row is the last row: `list-add` and the label in `accent/fg` ("Add a folder...").
- Titles are nouns or short statements. Subtitles say the effect or the current detail.

## Tables

Tasks and Activity are tables, in the manner of Activity Monitor and Task Manager. Column headers are Caption strong
on `window/bg`; rows are 56 px on `view/bg` with a separator; the selected row is `accent/subtle`. A task's state is a
badge: amber "Needs you", blue "Running", green "Done", grey "Undone", red "Blocked". A summary strip at the bottom
gives the totals.

## Setup

- A 1200 x 840 window centered on the wallpaper, before the desktop exists.
- The step list on the left is the progress indicator: done steps have a check, the current one is bold with an
  accent ring. The header bar says "Step 7 of 12".
- The footer has Back on the left, then a one-line summary, Skip on steps that can be skipped, and Next, the only
  filled button. The last step's button names the commit ("Finish setup").
- Server steps: Welcome (language, accessibility), Network, Name and time zone, Owner (pair a phone or set a
  passcode), AI models, Permissions, Apps, Keys for apps, Updates, Privacy and logs, Appearance, Done. Welcome offers
  "Set up from your phone" with a QR code; the box screen follows along.
- Personal steps, in a "GurtOS Setup" window after GNOME's own setup: Welcome, AI models, Folders agents may use,
  Permissions, Apps, Pair a phone (optional), Done.
- Keys are write-only everywhere: you can set or replace a key, never see one.

## The desktop

- **Top bar**, 32 px, always dark. Start: the GurtOS menu and the box switcher. Center: the date and time, which open
  Notification Center. End: the amber count of what needs you, what is running, then the system menu (Control
  Center). Apps keep their own menus in their header bars.
- **Dock**, floating 12 px above the bottom edge: pinned apps, a divider, Settings and App Center, then Show Apps. A
  dot under an app means it has a task running.
- **Wallpaper**: the night hills, flat layers, no photo.

## Words

- Sentence case everywhere, including buttons and window titles. The one exception is the names of Settings pages,
  which are names and keep their capitals (Agents & Models, Privacy & Logs), as in GNOME and macOS.
- Plain words, short sentences, no em dashes.
- Buttons are verbs with an object: "Install", "Undo task", "Approve $8.00". Never "OK" or "Submit".
- Say the amount, the place and the time: "Asks to spend $8.00, over its $5.00 budget".
- Call things what people see: agent, task, app, key, folder, host, box.
- Test money says so: "Test payments only: no real money moves."
- Times are 24-hour (19:04). Money has two decimals ($0.50).

## Accessibility

- Text meets WCAG AA (4.5:1); control edges meet 3:1. The pairs are under Color.
- Focus is a 2 px `accent/fg` ring, 2 px outside the control.
- Targets are 34 px on the desktop and 44 px in setup and on the phone.
- Larger text scales the type ramp by 1.25. High contrast draws every edge in `border/strong` and secondary text in
  `text/primary`. Reduce motion turns movement into fades. The screen reader is Orca on the box and on Personal.

## Components in Figma

On the page "GurtOS system" (`47:86`).

| Component | Node | Properties |
|---|---|---|
| Foundations sheet | `58:190` | Colors in both modes, type, spacing, radius, elevation, motion |
| `icon/*` (51) | section `47:3379` | Adwaita symbolic, 16 px |
| `app/*` (11) | section `48:86` | Tasks, Activity, Time Machine, Settings, App Center, Credit desk, Shopper, Wallet, Find, Jira, ASI:One |
| Button | `49:118` | Style: Suggested, Default, Flat, Destructive. Size: Regular, Large. Label, Show icon, Icon |
| IconButton | `49:131` | Style: Flat, Default. Icon |
| Switch | `49:136` | State: On, Off |
| Badge | `49:147` | Kind: Attention, Accent, Neutral, Success, Destructive. Label |
| Chip | `49:148` | Label, Icon. What an app may reach |
| TextField | `49:161` | Kind: Text, Search. Value |
| Dropdown | `49:162` | Value |
| Progress | `49:175` | Value: 0, 25, 50, 75, 100 |
| Row | `50:147` | Trailing: Switch, Combo, Disclosure, Value, Button. Title, Subtitle, Show subtitle, Show icon, Icon, Value, Show separator |
| SidebarItem | `50:160` | State: Selected, Default. Label, Icon, Show count |
| StepItem | `50:174` | State: Done, Current, Upcoming. Label, Number |
| ToggleItem, ToggleGroup | `50:181`, `50:182` | Label, Count, Show count |
| WindowControls | `50:195` | none |
| AppRow | `55:163` | Name, Description, Icon, Show separator; four chips and an install switch inside |
| Wallpaper | `51:124` | none |
| TopBar | `51:132` | Box name, Clock, Running, Show needs you |
| Dock | `51:160` | none |

Variables: "GurtOS Color" (Light, Dark) and "GurtOS Size" (spacing, radius, sizes, motion), each with its CSS name as
code syntax.

## Not built yet

This is the checkpoint. Next, after Ben's review: sheets and alert dialogs, menus and context menus, popovers,
toasts, notifications and Notification Center, Control Center, the lock screen, status pages, and the screens: the
rest of Settings, App Center, Activity, Time Machine, the track apps (Credit desk, Shopper, Wallet, Find, Jira,
ASI:One), session restore, the other ten Server setup steps, Personal setup, and the phone.
