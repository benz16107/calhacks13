# GurtOS Personal: its own system on GNOME 46

Ben's brief: GurtOS Personal must not look like Ubuntu with an app on top. It should feel like its own system on an
Ubuntu base, the way elementary OS, Pop!_OS and Zorin do, in the GurtOS design system (`../system.md`) and native
to GNOME 46, not a copy of macOS. Ben approved the checkpoint (screens 0 to 4) on Sat Oct 24; screens 5 to 10 and the assets followed. The Figma page is "GurtOS Personal OS" in the
[design file](https://www.figma.com/design/oppzH621OOOMA31rgLbxbM).

| PNG | Node | What it shows |
|---|---|---|
| `0-identity.png` | `102:674` | The wallpapers, icon theme, cursor, system font and libadwaita colours |
| `1-desktop-at-rest.png` | `100:166` | The desktop at rest: Hills (light), the GurtOS top bar with "2 running", the dock |
| `2-agents-popover-approval.png` | `100:306` | The GurtOS top-bar item open over a Text Editor window: an approval with Deny and Approve, running tasks with pause, Pause all agents, Ask an Agent, Open GurtOS, GurtOS Settings |
| `3-quick-settings-agents.png` | `101:478` | Quick Settings with the Agents tile on and its menu open: Pause all agents, Quiet hours, what needs your OK, what runs, GurtOS Settings |
| `4-login-and-boot-splash.png` | `101:11795` | The GDM login screen and the Plymouth boot splash side by side (full frames `101:11757` and `101:11791`) |
| `5-approval-notification.png` | `105:880` | An approval as a shell notification over your work, with Deny and Approve $8.00 |
| `6-lock-screen-approval.png` | `105:1124` | The same approval on the lock screen. Deny works while locked; "Unlock to approve" asks for the password first, because approving spends money |
| `7-activities-search.png` | `106:1063` | Activities search for "invoices": GurtOS tasks first, then Find (files and photo descriptions in your agent folders), then Files |
| `8a-files-changes-waiting.png` | `107:1507` | Files on a folder an agent has finished with: the bar says what changed in the copy, with Review changes, Undo and Keep changes. Nothing has changed here yet, so no emblems |
| `8b-files-changed-by-an-agent.png` | `107:1908` | The same folder after Keep: each changed item carries the "Changed by an agent" emblem, the bar offers Put files back, and the status line counts the changed items |
| `9-gurtos-settings.png` | `107:2212` | GurtOS Settings as a libadwaita preferences window: a view switcher (Agents, Permissions, Apps, Keys, Phone) and the Permissions page |
| `10-app-grid-and-dock.png` | `106:1316` | The overview's app grid with the default apps, and the dock |

## The identity, and how each part ships on GNOME 46

| Part | Choice | How it ships |
|---|---|---|
| Shell theme | The top bar, popovers, Quick Settings, overview, notifications and lock screen use the Dark mode of the GurtOS tokens, as GNOME 46's shell is always dark. Atkinson Hyperlegible, radius 20 on popovers and 24 on Quick Settings, pills in the top bar | A GNOME Shell session mode `gurtos` with its own `gnome-shell-theme.gresource`, the way Ubuntu ships its `ubuntu` mode, so it needs no user-themes extension |
| Accent and app colours | GurtOS blue `#2F64A6` (dark `#78A9E6`); every libadwaita named colour mapped to a GurtOS token (identity sheet) | libadwaita 1.5 has no accent setting, so `/etc/skel/.config/gtk-4.0/gtk.css` sets the named colours. GTK 3 apps get adw-gtk3 (LGPL) with the same colours |
| Icons | Papirus (GPL-3.0) for app, place and mime icons, with folders recoloured to GurtOS slate `#4F6A8F`; Adwaita for symbolic icons; GurtOS's own app icons for its apps | A `GurtOS` icon theme: its folder SVGs, inheriting Papirus, then Adwaita |
| Cursor | Bibata Modern Classic (GPL-3.0): ink-dark with a white edge | `org.gnome.desktop.interface cursor-theme` |
| System font | Atkinson Hyperlegible Next for the interface and documents, Atkinson Hyperlegible Mono for monospace. Not Ubuntu Sans | `font-name`, `document-font-name`, `monospace-font-name` overrides; the fonts are OFL |
| Wallpapers | Hills (default, shared with GurtOS Server), Lake, Dunes and Strata, each with a light and a dark picture. Flat layers, no photos, no gradients | `gnome-background-properties` XML with `picture-uri` and `picture-uri-dark`, so GNOME switches them with the style |
| Dock | The GurtOS dock: floating at the bottom, dark glass, 48 px icons, hides when a window touches it | Ubuntu 24.04's dock (a dash-to-dock fork) set to the bottom, not full width, intelligent autohide |
| Default apps in the dock | Firefox, Files, Text Editor, Console, Software, then GurtOS and Settings, then Show Apps | `org.gnome.shell favorite-apps` |
| Login screen (GDM) | The night Hills, one user with an initials avatar, the password field with an accent arrow, the GurtOS wordmark at the bottom | The same shell theme for GDM, and the wordmark as `org.gnome.login-screen logo` |
| Boot splash (Plymouth) | The night sky colour, the GurtOS wordmark and a spinner; "GurtOS Personal" at the bottom | A Plymouth two-step theme: the wordmark image, the sky colour, the spinner |
| Window buttons | Minimize, maximize and close, as on GurtOS Server | `org.gnome.desktop.wm.preferences button-layout` |

## The GurtOS surfaces, native to the shell

- **Top-bar item.** Between the clock and the system status: an amber count of what needs you, then what runs. It
  opens a shell popover, not an AppIndicator menu, so approvals have real Deny and Approve buttons and running tasks
  have pause buttons.
- **Quick Settings tile "Agents".** A menu toggle like Wi-Fi: on while agents run, its subtitle says what needs you.
  Its menu holds Pause all agents, Quiet hours, the counts and GurtOS Settings.
- **Notifications.** Approvals are shell notifications with two actions. On the lock screen, Deny works; Approve
  unlocks first. Titles are sentence case, as everywhere else in GurtOS.
- **Activities search.** Two search providers: GurtOS tasks (title, state, Review or Running) and Find (files and
  photo descriptions in the agent folders). Both search only this computer.
- **Files.** A bar on a folder with changes waiting (Review changes, Undo, Keep changes), and after Keep the emblem
  `emblem-gurtos-agent` on each item the task changed, with Put files back. Before Keep the folder is untouched, so
  there is nothing to badge.
- **GurtOS Settings.** A libadwaita preferences window with a view switcher: Agents, Permissions, Apps, Keys, Phone.
  Keys are write-only, as on Server.
- **Dock and default apps.** Firefox, Files, Text Editor, Console, Software, then GurtOS and Settings, then Show Apps.
  The app grid adds Calendar, LibreOffice Writer and GurtOS Settings.

## Assets (`assets/`)

| Folder | Files | Where they go on GNOME 46 |
|---|---|---|
| `wallpapers/` | `hills`, `lake`, `dunes`, `strata`, each `-light` and `-dark`, as SVG (the masters) and 3840 x 2160 PNG; `gurtos-backgrounds.xml` | `/usr/share/backgrounds/gurtos/`, and the XML in `/usr/share/gnome-background-properties/`. The default is Hills (`picture-uri` light, `picture-uri-dark` dark) |
| `colors/` | `gurtos-tokens.css`: every GurtOS colour as a CSS variable, light in `:root` and dark under `prefers-color-scheme: dark` and `.gurtos-dark`. `libadwaita-light.css` and `libadwaita-dark.css`: the libadwaita named colours (`@define-color`) | The tokens are for the shell theme and any web view. The libadwaita files are the GTK 4 overrides for the light and dark styles |
| `wordmark/` | `gurtos-wordmark-on-dark` (cream `#F2EFE8`) and `-on-light` (ink `#1D2127`), outlined SVG, PNG at 1x and 2x | Anywhere the name shows: About, the login screen, the boot splash |
| `plymouth/` | `gurtos.plymouth` (a two-step theme on the sky colour `#27313F`), `watermark.png` (the wordmark), `throbber-0001` to `0024.png` (the spinner, 48 px) | `/usr/share/plymouth/themes/gurtos/`, then `update-alternatives` for `default.plymouth` and `update-initramfs -u`. Check it on a test VM: the key names follow Ubuntu's spinner theme |
| `gdm/` | `gurtos-logo.png` (the wordmark, 160 px wide, cream) | `org.gnome.login-screen logo`. The login background is `wallpapers/hills-dark` through the shell theme |
| `icons/` | `emblem-gurtos-agent.svg` (22 px, the accent with the Adwaita flask); `folder-gurtos.svg` (Papirus's folder recoloured to GurtOS slate, GPL-3.0) | The emblem in `hicolor/scalable/emblems/`. The folder colour goes into the GurtOS icon theme for every Papirus folder icon |

The wallpaper SVGs for Lake, Dunes and Strata come from the same generator that drew them in Figma, so the files match
the frames. GurtOS's own app icons are already in the repo with the portal kit and `personal/`.

## Notes for the Personal thread

- Pause all agents and per-task pause have no core API yet; the core has approvals, undo and settings. Quiet hours
  is `quietHours` in `PATCH /api/settings`.
- Papirus and Bibata are GPL-3.0 and adw-gtk3 is LGPL: ship them as their own packages with their licenses, and
  credit them in About.
- All text in these screens meets WCAG AA. The darkest pair is secondary text on the shell's window colour, 7.6:1.
