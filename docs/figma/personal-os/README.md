# GurtOS Personal: its own system on GNOME 46 (checkpoint)

Ben's brief: GurtOS Personal must not look like Ubuntu with an app on top. It should feel like its own system on an
Ubuntu base, the way elementary OS, Pop!_OS and Zorin do, in the GurtOS design system (`../system.md`) and native
to GNOME 46, not a copy of macOS. This checkpoint covers the identity and four screens, for Ben to approve before
the rest. The Figma page is "GurtOS Personal OS" in the
[design file](https://www.figma.com/design/oppzH621OOOMA31rgLbxbM).

| PNG | Node | What it shows |
|---|---|---|
| `0-identity.png` | `102:674` | The wallpapers, icon theme, cursor, system font and libadwaita colours |
| `1-desktop-at-rest.png` | `100:166` | The desktop at rest: Hills (light), the GurtOS top bar with "2 running", the dock |
| `2-agents-popover-approval.png` | `100:306` | The GurtOS top-bar item open over a Text Editor window: an approval with Deny and Approve, running tasks with pause, Pause all agents, Ask an Agent, Open GurtOS, GurtOS Settings |
| `3-quick-settings-agents.png` | `101:478` | Quick Settings with the Agents tile on and its menu open: Pause all agents, Quiet hours, what needs your OK, what runs, GurtOS Settings |
| `4-login-and-boot-splash.png` | `101:11795` | The GDM login screen and the Plymouth boot splash side by side (full frames `101:11757` and `101:11791`) |

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
  have pause buttons. It replaces the AppIndicator described in `../system.md`, "On GNOME (Personal)".
- **Quick Settings tile "Agents".** A menu toggle like Wi-Fi: on while agents run, its subtitle says what needs you.
  Its menu holds Pause all agents, Quiet hours, the counts and GurtOS Settings.
- **Still to draw after approval:** the approval notification and its lock-screen form, Activities search results
  for tasks and /find, the Files "Changed by an agent" emblem with the Keep and Undo bar, the GurtOS Settings app
  (libadwaita preferences window), the overview and the lock screen.

## Notes for the Personal thread

- Pause all agents and per-task pause have no core API yet; the core has approvals, undo and settings. Quiet hours
  is `quietHours` in `PATCH /api/settings`.
- Papirus and Bibata are GPL-3.0 and adw-gtk3 is LGPL: ship them as their own packages with their licenses, and
  credit them in About.
- All text in these screens meets WCAG AA. The darkest pair is secondary text on the shell's window colour, 7.6:1.
