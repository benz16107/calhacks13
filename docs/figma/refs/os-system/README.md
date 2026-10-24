# OS system references

Collected Fri Oct 23, 2026 for the GurtOS design system and setup wizard. Each image comes from the vendor's own page or
docs (GNOME's GitLab counts), cropped or shrunk for the repo. The older mood references for the box screen are in
[`../README.md`](../README.md).

| # | Reference | Source | What to take from it |
|---|---|---|---|
| 01 | GNOME Settings (GNOME 50) | https://release.gnome.org/50/ (image `settings-sound-screenshot.webp`) | A sidebar of short icon rows in groups with thin dividers on the left; on the right, boxed lists under plain section titles, where each row is an icon, a title and one control at the end. |
| 02 | libadwaita widgets: preferences window, alert dialog, empty state, toast | https://gnome.pages.gitlab.gnome.org/libadwaita/doc/main/class.PreferencesWindow.html, https://gnome.pages.gitlab.gnome.org/libadwaita/doc/main/class.StatusPage.html, https://gnome.pages.gitlab.gnome.org/libadwaita/doc/main/class.ToastOverlay.html, https://developer.gnome.org/hig/patterns/feedback/dialogs.html | Four small patterns to copy as components: a group is a bold title, one grey line and a card of 3 rows; an empty state is a big grey icon, a bold title and one line; a toast is a dark pill with an Undo button; a confirm dialog has two equal buttons and tints the dangerous one red instead of filling it. Montage of four official images, made for this folder. |
| 03 | GNOME Initial Setup mockup | https://gitlab.gnome.org/Teams/Design/os-mockups/-/blob/master/initial-setup/initial-setup-2026-jimmac.png (steps "Typing" and "About You" cropped) | A wizard step is one icon, one title, one grey sentence and one group of controls. Previous and Next sit in a top bar with "Step 4 of 9" between them, and Next is the only filled button. This is the GNOME design team's mockup, not a screenshot of a build. |
| 04 | elementary AppCenter | https://elementary.io/ (image `images/screenshots/appcenter.png`) | A store window is a rounded hero banner over a 3-column grid of rows; each row is an app icon, a name, a one-line summary and one outlined button that shows the action or price. |
| 05 | elementary Screen Time settings | https://elementary.io/ (image `images/screenshots/screen-time-limits.png`) | When a page needs more rights, show one inline bar at the top ("Some settings require administrator rights") with an Unlock button, and grey out the controls below it until it is used. |
| 06 | macOS System Settings | https://support.apple.com/en-ca/guide/mac-help/mh15217/mac | A search field and a sidebar of grouped icon rows; each icon is a rounded square in its own flat color with a white glyph. The detail pane holds rounded sections whose rows put a label on the left and a switch, a popup or a stepper on the right. |
| 07 | macOS Setup Assistant (Migration Assistant step) | https://support.apple.com/en-ca/guide/macbook-air/apda75cd668e/mac | One decision per screen: a large glyph, a bold title, a grey explanation, then radio choices that include "Set up as new". Continue is bottom right and a back chevron is top left, with no sidebar. |
| 08 | Windows 11 Settings rows | https://learn.microsoft.com/en-us/windows/advanced-settings/developer-mode | A settings card row is a left icon, a title, a grey subtitle, then a state word ("On", "Off") next to a switch, plus a chevron if the row expands. The word makes the state readable without judging the switch position. |
| 09 | Windows 11 first-run setup (OOBE) | https://learn.microsoft.com/en-us/windows/configuration/windows-backup/ (image `oobe-restore.png`) | A centered card about two thirds of the screen wide floats over a soft wallpaper. Art or an avatar fills the left half, copy and one selectable card fill the right, and Continue sits bottom right with a plain "Learn more" link beside it. |
| 10 | Ubuntu installer, "Applications" step | https://ubuntu.com/tutorials/install-ubuntu-desktop (step 5, image on the tutorial page) | Choices are radio cards with a title and one grey sentence, and the selected card gets a tint of the accent color. An illustration fills the left half, and Back, a dot progress row and Next run along the bottom. |
| 11 | Ubuntu installer, "Ready to install" step | https://ubuntu.com/tutorials/install-ubuntu-desktop (step 9, image on the tutorial page) | The last wizard step is a review card that lists every choice in plain rows. The final action is the one green button in the whole flow, so the point of no return has its own color. |
| 12 | Ubuntu App Center, Manage page | https://snapcraft.io/snap-store (screenshots on the listing, uploaded by Canonical) | A sidebar with Explore, Featured and categories, and Manage pinned to the bottom with a count badge. The Manage page puts "Updates available" first, then a table of installed apps with size, age and an Uninstall or Open button on each row. |
| 13 | Synology DSM 7 Security Advisor | https://www.synology.com/en-us/dsm/overview/security | Web window chrome: a small title bar with the title left and help, minimize, maximize and close at the right. Inside, one big green check and "Good", then rows that each carry a state icon. A model for a "box is healthy" window. |
| 14 | umbrelOS Settings | https://umbrel.com/umbrelos (image `umbrelos/hero/settings.webp`) | A web OS window: a device card on the left with name, version, IP, uptime and usage bars; on the right filter pills, a search field and grouped rows of icon, title, subtitle and one chevron or control. Red is used only for "Shut down". |
| 15 | iOS Settings search | https://support.apple.com/en-ca/guide/iphone/iph079e1fe9d/ios | A search result is a colored icon, a title and a grey breadcrumb that says where the setting lives ("Sounds & Haptics > Alarms and Timers"). The search field floats at the bottom within thumb reach. |

Flat UI is PNG (01, 02, 03, 05, 06, 07, 08, 12, 15). Pictures with photos or soft shadows are JPEG quality 80 (04, 09,
10, 11, 13, 14). All are 1400 px wide or narrower and under 350 KB.

Wanted but not captured:

- **GNOME HIG sidebars page.** `developer.gnome.org/hig/patterns/containers/sidebars.html` is a 404. The real page,
  `patterns/nav/sidebars.html`, has only a grey diagram, so the GNOME Settings screenshot (01) stands in for it.
- **A running GNOME Initial Setup screenshot.** The `gnome-initial-setup` repo holds no screenshots and the GNOME release
  notes show none. The design team's mockup (03) is the closest official image.
- **macOS Time Machine and Activity Monitor.** Apple's Time Machine pages (back up, restore) carry no screenshot.
  Activity Monitor is already in `../11-macos-activity-monitor.jpg`.
- **Windows Task Manager and the main Windows Settings page.** Microsoft's current support pages for Task Manager and
  startup apps have no images, and Learn had no page with a Task Manager screenshot. The Settings rows (08) are a crop from
  a Learn page.
- **Windows 11 first-run, other screens.** Only the "Welcome back" restore screen (09) is published by Microsoft in a
  page I could fetch. microsoft.com/windows/features loads its images lazily and showed only a stock photo.
- **elementary System Settings (Switchboard).** elementary.io shows apps only. Screen Time (05) is the closest settings pane.
- **Ubuntu App Center docs.** documentation.ubuntu.com has no App Center page with images, and the ubuntu.com blog post
  that covers it returned a 500 error. The Snapcraft listing (12) is the only official source I found.
- **Synology Control Panel.** synology.com shows no Control Panel image, so the Security Advisor window (13) stands in. I did
  not try kb.synology.com.
- **iOS setup (Quick Start).** The iPhone guide's setup page has only a diagram of the side button, and Apple's HIG
  "Onboarding" page has only an illustration. Image 15 covers Settings instead.
