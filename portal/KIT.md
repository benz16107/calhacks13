# The GurtOS kit

The kit is the GurtOS design system (`docs/figma/system.md`) as CSS and a little JavaScript. The portal is built
from it, and every box serves it, so a track's own page can look like the rest of the OS with two lines:

```html
<link rel="stylesheet" href="/kit/gurtos.css" />
<script type="module" src="/kit/gurtos.js"></script>
<body class="g-page">
```

The living style guide is at `/kit/index.html` on any box (for example `http://127.0.0.1:7700/kit/index.html`). It
shows every class below with its markup. Open it in Dark too: the toggle at the top switches.

## How a track page runs

A track's page lives under `/t/<track>/` and is listed by `GET /api/apps`. GurtOS opens it in a window: the window
has the header bar with the app's name, minimize, maximize and close, so **the page should not draw its own title
bar or window frame**. Start the page with its content. The window is 1280 x 820 by default and can be resized down to
360 x 240, so the page must reflow.

The page is in an iframe, sandboxed: the box sends it with `Content-Security-Policy: sandbox` and no same origin, so
the page has no origin of its own and cannot use the owner's controls. The box puts a small script first in the page
so its `fetch` calls carry a window token, which reaches only this app's own routes and reads tasks and approvals;
answering another app's request opens that task's window instead. A request the browser makes by itself
(`<script type=module src>`, `<img>`) carries no token, so add `location.search` to its address. A sandboxed page
has no `localStorage`: keep state in memory or in the app's own routes. `gurtos.js` copies the desktop's Light or
Dark style, high contrast, larger text and reduce motion onto the page as they change (by message). Opened on its own (a browser tab), the page follows the
system's light or dark setting.

## Tokens

Every Figma variable is a CSS variable with the same name: `--color-window-bg`, `--color-view-bg`,
`--color-card-bg`, `--color-text-primary`, `--color-text-secondary`, `--color-accent-bg`, `--color-accent-fg`,
`--color-attention-bg`, `--color-destructive-fg`, `--color-border-default`, the spacing scale `--space-xs` (6) to
`--space-xxl` (48), radii `--radius-sm` (6), `--radius-md` (12), `--radius-lg` (15), shadows `--shadow-1` to
`--shadow-4`, sizes `--size-control` (34) and `--size-control-large` (44). Use them instead of new colors, and the
page is right in Dark for free.

Type is Atkinson Hyperlegible Next, and Atkinson Hyperlegible Mono for IDs, paths and code, with a plain 0 in
both: Atkinson's own 0 has a slash, so `kit/fonts/` holds a 0-only face that loads first (`plain-zero.py` makes it).
The classes are
`t-display`, `t-title1`, `t-title2`, `t-title3`, `t-heading`, `t-body-strong`, `t-body`, `t-caption-strong`,
`t-caption` and `t-mono`, plus the colors `t-secondary`, `t-accent`, `t-attention`, `t-success`, `t-destructive`.

## Components

| Class | Element | Notes |
|---|---|---|
| `g-btn`, `g-btn-suggested`, `g-btn-destructive`, `g-btn-flat`, `g-btn-large` | `<button>` | One suggested button per view. Destructive only to remove or undo. Large (44 px) on phones. |
| `g-icon-btn` | `<button aria-label title>` | A 34 px button with one icon. It must have a name. |
| `g-switch` | `<input type="checkbox" role="switch">` | Turns one setting on or off at once. |
| `g-badge`, `-accent`, `-neutral`, `-success`, `-destructive` | `<span>` | Plain is amber: Needs you. Accent is Running, success Done, neutral Undone, destructive Failed or Blocked. |
| `g-chip`, `g-chip-set` | `<span>` | A host or a key name, with an icon. |
| `g-progress` | `<span role="progressbar" style="--value: 40%"><span></span></span>` | Add `data-indeterminate` when the amount is unknown. |
| `g-field`, `g-search` | `<input>`, a wrapper with a `g-icon` first | Fields are 34 px. |
| `g-group`, `g-group-head`, `g-group-title`, `g-group-caption`, `g-list` | `<section>`, `<div>` | A boxed list: a heading, a caption, then rows in a card. |
| `g-row`, `g-row-text`, `g-row-title`, `g-row-sub`, `g-row-trail`, `g-row-add` | `<div>`, `<label>` (a switch row), `<button>` (opens something) | One control or value at a row's end. |
| `g-combo-wrap`, `g-combo` | `<select>` in a row, with a `pan-down` icon after it | A native select, so the keyboard and phones work. |
| `g-approw`, `g-approw-text`, `g-approw-name`, `g-approw-desc` | `<div>` | An app with its icon, what it does, chips and a switch. |
| `g-toggle-group`, `g-toggle` | `<div role="radiogroup">` of `<button role="radio" aria-checked>` | Two to five views of the same content. Move with the arrow keys. |
| `g-sidebar`, `g-sidebar-item`, `g-split`, `g-split-main` | `<nav>`, `<button aria-current="page">` | A sidebar window, 280 px. |
| `g-prefs` | `<div>` | A settings page: groups clamped to 680 px. |
| `g-table`, `g-thead`, `g-tr`, `g-td`, `g-summary` | grid rows with `style="--cols: 2fr 1fr ..."` | Like Tasks: 56 px rows, a sticky head, a summary strip. |
| `g-headerbar`, `-start`, `-title`, `-subtitle`, `-end` | `<header>` | Inside your page only for a second level (the window already has one). |
| `g-popover`, `g-menu`, `g-menu-item`, `g-menu-sep` | `<div role="menu">`, `<button role="menuitem">` | Menus. `g-destructive` on an item tints it red. |
| `g-dialog`, `g-alert`, `g-alert-title`, `g-alert-body`, `g-alert-actions` | `<dialog class="g-dialog">` opened with `showModal()` | One decision. Cancel first, then the action. |
| `g-sheet-layer`, `g-sheet`, `g-sheet-body` | `<div>` | A short job over the page, with Cancel and Done in its header bar. |
| `g-notification`, `-head`, `-meta`, `-app`, `-title`, `-body`, `-actions` | `<article>` | The same card as the desktop's banners. |
| `g-banner`, `g-banner-accent`, `g-banner-destructive` | `<div>` with a `g-icon` and a `<div>` | A note across the top of a view. Amber by default. |
| `g-status`, `g-status-title`, `g-status-body` | `<div>` | An empty or error state: one 64 px icon, a title, one sentence, at most one button. |
| `g-card` | `<div>` | A plain card. |
| `g-sr` | `<span>` | Text for screen readers only. |

## Elements and functions from gurtos.js

- `<g-icon name="system-search"></g-icon>`: an Adwaita symbolic icon, 16 px, in the text color. `size="64"` for a
  status page, `label="Search"` when the icon is the only thing that names a control. `gurtos.icons` lists every name;
  the style guide shows them all. Ask the portal thread for one that is missing.
- `<g-app-icon app="shopper" size="44"></g-app-icon>`: a GurtOS app icon. Apps without their own glyph get their first
  letter on a grey tile (`title="Household"` picks the letter).
- `gurtos.toast('Saved', { label: 'Undo', run: () => undo() })`: a toast at the bottom for four seconds.

## Rules

- Write for people: plain words, short sentences, no em dashes. Name buttons by what they do ("Approve $8.00").
- Label test or simulated money as test money in the page.
- Keys never show: a field for a key is `type="password"`, and the page writes it with `PUT /api/vault/<NAME>` (owner
  only), never reads it back.
- Keyboard: every control is a real `<button>`, `<a>`, `<input>` or `<select>`, and focus shows (the kit draws it).
- Motion: use the kit's durations (`--duration-fast` 100 ms, `--duration-base` 200 ms). Reduce motion turns them off.

## Inside the portal

The portal's own apps use the same classes through Preact components in `src/kit/ui.tsx` (`Button`, `Switch`,
`Group`, `Row`, `SwitchRow`, `ComboRow`, `LinkRow`, `ToggleGroup`, `Popover`, `Menu`, `ContextMenu`, `Alert`,
`Sheet`, `Toast`, `StatusPage`, `Icon`, `AppIcon`), and the window frame from `src/wm.tsx` (`HeaderBar`, `useWin`).
Icons are regenerated from the system's Adwaita set with `node icons.ts` (add the name to its list).
