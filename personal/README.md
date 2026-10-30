# GurtOS Personal: GurtOS built into the desktop

GurtOS Personal is the OS on your own laptop, the way elementary OS and Pop!_OS are: Ubuntu 24.04 underneath (kernel,
drivers, packages, updates), and GurtOS on top as part of the desktop, not an app beside it. You use it as a normal
computer, with your own account and sudo. Agents work beside you as their own users without sudo, on copies of your
folders, and nothing in your folders changes until you choose Keep. This folder is that desktop side. It talks to the
box's API on `127.0.0.1:7700`; the box itself (tasks, the keys agents can't read, the action log, Keep and Undo) is `core/`.

Tested on a cloud VM: installed onto plain Ubuntu 24.04 with GNOME 46, and as a fresh install of the GurtOS Personal
ISO walked as a new person, on Wayland (Ubuntu's default) and Xorg.

## What it adds

| Piece | What it does | Where |
|---|---|---|
| The GurtOS session | Its own GNOME session and Shell mode, like Ubuntu's own: it loads the GurtOS Shell extension, Ubuntu's dock, AppIndicator support and tiling. GDM starts it by default, on Wayland or Xorg. An extension a session mode loads cannot be switched off by accident | `theme/session/`, `theme/install.sh` |
| The top bar | An amber "1 needs you" pill (requests only) and "▶ 2 running". Its popover is 420 px wide: Agents with the counts, Needs you as amber cards with Deny and Approve, Ready to review, Running, at most 3 rows each with "Show all N in GurtOS", the lists scrolling inside 80% of the screen, then Pause all agents, Talk to your computer, New task…, Open GurtOS, GurtOS Settings. Offline it says so in one row and turns Pause and New task off | `shell/gurtos@gurtos.dev/` |
| Quick Settings | An Agents tile with the GurtOS tasks icon, on while agents run, subtitle "1 needs you". Its menu: Pause all agents (the core's `paused` setting, the same one Business's kill switch uses; the top bar then says Paused), Quiet hours ("Until 07:00. Requests wait without a sound"), Needs you and Running with counts, GurtOS Settings | `shell/gurtos@gurtos.dev/` |
| Approvals as Shell notifications | Deny and Approve (Approve names the amount); clicking the body opens the task; answered anywhere else, it goes away; in quiet hours it waits in the list without a banner | `shell/gurtos@gurtos.dev/` |
| The lock screen | Each approval as a card in the lock screen's notification list. Deny works while locked. Unlock to approve asks for the password, then approves, because approving can spend money | `shell/gurtos@gurtos.dev/` |
| Activities search | Two sections in the overview: GurtOS (agent tasks by title) and Find (files and photos /find knows, by what is in them). A result opens in the GurtOS app | `search-provider.py` |
| Files | New Agent Task… on one folder or up to ten. While changes wait, the folder's menu has Keep Changes and Undo Task… (the task page asks first), and nothing is marked. After Keep, a notification says how many changes were kept, the "changed by an agent" emblem marks each file an agent added or changed, and Undo Task… on the folder and on those files puts them back | `files/box-nautilus.py` |
| GurtOS Settings | A native libadwaita app with a view switcher: Agents (model key, updates, the action log), Permissions (folders, internet, spending, quiet hours and their hours, and What each app may do: one row per app that is on, each permission a switch, and Money per day for an app that spends, from `/api/permissions`), Apps, Keys, Phone. Phone has Reach this computer from anywhere: a name under box.gurtos.com, checked as you type, then Turn on and Turn off (`/api/remote`). It shows only when the box has that API, and says "Not available right now" with Try again when the relay doesn't answer. Updates shows the system update's state on a computer installed from a GurtOS image; it has no automatic-update switch, because nothing installs updates by itself yet. About is in the window menu, with the credits | `settingswin.py` |
| Talk to your computer | Press Super+Alt+Space or choose it in the top-bar menu or the Agents tile, then say "what did my agents do today?", "find the whiteboard photo" or "approve the grocery order". Speech becomes text on this machine (faster-whisper `base.en`, CPU, `stt.py`), the answer comes from the box and its /find (Moss) search, and it appears as a notification and is spoken by espeak-ng. The top bar shows a red mic and "Listening…" while the microphone is open, and the same shortcut ends the sentence early. It never listens in the background, and the recording is deleted once it is read. Voice can approve or deny a request that spends nothing, signed `voice:<user>`, and refuses to approve anything that moves money: that needs the passkey or the popover | `voice.py`, `stt.py`, `voice-setup.sh` |
| App permissions | Turning on an app for the first time, in Settings, asks "<App> wants to:" with a switch for each thing it may do (money, requests from strangers, commands, sites, then its keys). Turn on saves the answers, then turns the app on; Don't turn on leaves it off and asks again next time. Each change is a permissions note in Activity | `setupwin.py`, `settingswin.py` |
| GurtOS Setup | At the owner's first login, after GNOME's own setup: Welcome, AI models, Folders, Permissions, Pair a phone, Done. It offers no apps: Find is on, the rest are optional in Settings, Apps | `setupwin.py` |
| The GurtOS app | The agent tools as a native GTK 4 and libadwaita app, like Files or Settings (not the Server screen in a window). A sidebar: Agents, Activity, History, then each installed app. **Agents**: Needs you (Approve or Deny inline, with the amount), Running (live), Ready to review, Done, a Pause all switch and New task. **A task**: what it spent against its budget, the approval if it waits, its changes with Keep, Undo or Put files back and a line-by-line diff, what it can reach (folders, internet, apps, its own user), and its steps, live. **Activity**: the action log, searchable, filtered by task or app. **History**: take out one task, or every task since 15 minutes, an hour or the start of today, newest first. **Apps**: each app's own page as a panel of this window; anything outside the app opens in the browser. It follows the log live (`/api/log/stream`). Ctrl+N is New task, Ctrl+F is Activity. The dock, the top bar, notifications, search and Files all open it | `agentsapp.py`, `tasklogic.py` |
| New task | What to do in plain words, the folders it may change (GNOME's folder chooser), Internet on or off with the sites it may reach, and a budget. No folder: it works in a workspace of its own. Files' Ask an Agent… opens the same window | `askwin.py` |
| The look | Figma's "GurtOS Personal OS" theme: the Hills wallpaper (Lake, Dunes and Strata too, each light and dark), a dark Shell with Atkinson Hyperlegible, the floating dock (Firefox, Files, Text Editor, Console, Software, GurtOS, Settings), minimize, maximize and close, Papirus icons with slate folders, the Bibata cursor, GurtOS colours for GTK 4 apps, the GDM logo and a two-step Plymouth splash. Ubuntu's welcome tour, Pro notices and update nags are hidden in the GurtOS session | `theme/` |

![The GurtOS app: Agents](screenshots/app/1-agents.png)

![A running task](screenshots/app/2-task-running.png)

![A finished task: its changes, Keep or Undo, and the diff](screenshots/app/3-task-review.png)

![After Keep: Undo task puts the files back](screenshots/app/3c-task-kept.png)

![New task](screenshots/app/4-new-task.png)

![Activity](screenshots/app/5-activity.png)

![History](screenshots/app/6-timemachine.png)

![An app as a panel: Find](screenshots/app/7-app-find.png)

![Activities search opens Find in the app](screenshots/app/7b-search-to-find.png)

![Dark style](screenshots/app/8b-task-dark.png)

![The GurtOS session: Hills, the floating dock, the GurtOS item in the top bar](screenshots/os/01-desktop.png)

![An approval as a Shell notification, with the count in the top bar](screenshots/os/02-approval.png)

![The top-bar popover](screenshots/os/03-popover.png)

![The Agents tile in Quick Settings, paused](screenshots/os/06-agents-tile.png)

![Paused: the top bar says so](screenshots/os/05-paused.png)

![The lock screen: Deny, or Unlock to approve](screenshots/os/07-lock.png)

![GurtOS Settings, Permissions](screenshots/os/09-settings.png)

![GurtOS Settings, Agents](screenshots/os/09b-settings-agents.png)

![GurtOS Settings, Accounts & Keys](screenshots/os/10-settings-keys.png)

![About GurtOS](screenshots/os/09c-settings-about.png)

![Reach this computer from anywhere: choosing a name](screenshots/os/17-remote-name.png)

![Reach this computer from anywhere: starting](screenshots/os/18-remote-starting.png)

![Activities search: Find and GurtOS](screenshots/os/11-search.png)

![Files after Keep: the emblem on each file an agent changed](screenshots/os/13-files-emblem.png)

![Files: Undo Task on a changed file (shot before the rename from Put Files Back)](screenshots/os/14-files-putback.png)

![The same session on Xorg](screenshots/os/16-xorg.png)

## Figma's theme, and what is left

Figma's "GurtOS Personal OS" frames and assets (`docs/figma/personal-os/`) are applied: the wallpapers, colours,
wordmark, GDM logo, Plymouth theme, emblem and folder icon are in `theme/` and `icons/`, and `theme/make-icons.py`
builds the `GurtOS` icon theme from the installed Papirus with its folders recoloured to slate. What is left:

| Part | Today | Why |
|---|---|---|
| Shell theme | Yaru's dark blue Shell theme, with the GurtOS tokens, font and radii from the extension's `stylesheet.css` | a full `gnome-shell-theme.gresource` (and the Hills login background in GDM) is not built yet |
| The Files bar (Review changes, Undo, Keep changes) | the same actions in the folder's right-click menu | nautilus-python 4 on GNOME 46 has no way to add a bar to a Files window |
| GTK 3 apps | Yaru-blue | adw-gtk3 is not in Ubuntu 24.04's archive, so it is not shipped or credited |
| May read | not shown | the core has no API for it yet |
| Software in the dock | listed, shown when installed | the test VM has no Software app; the image decides which one ships |

**The design.** These windows follow the GurtOS system (`docs/figma/system.md`) and the Personal frames in
`docs/figma/os-v2/personal/`, built from libadwaita's own widgets so they sit among GNOME apps. The system's colour
tokens in light and dark become libadwaita's named colours (`gurtos.css`, `gurtos-dark.css`); the type is Atkinson
Hyperlegible Next and Mono (bundled in `fonts/`, SIL OFL); app icons are the system's glyphs on coloured tiles
(`apptiles.py`, the same paths the portal draws). GNOME's own surfaces (the top bar, notification banners, menus,
Files) stay GNOME's, with GurtOS content. Notification titles are in sentence case, as Figma's frames show.

## GurtOS Setup and the redesign (Oct 24)

Walked on the GurtOS Personal VM as the owner, on Wayland. Each step changes the box as it goes: settings with
`PATCH /api/settings`, keys with the write-only `PUT /api/vault/<NAME>`, apps with `/api/apps/<id>/enable|disable`,
each step with `POST /api/setup/step`, then `POST /api/setup/finish`. It opens by itself at login for the owner only,
after GNOME's own setup, until the box says setup is done, and resumes at the first step not yet taken.

| Step | What it does | Checked |
|---|---|---|
| Welcome | What keeps agents safe on this computer | Opened by itself at login |
| AI models | One model key, write-only: `ANTHROPIC_API_KEY` (your own Anthropic key is enough) or `FACTORY_API_KEY`. A saved key shows as saved, never its value | The VM's key was detected without being shown |
| Folders | The owner's usual folders, each May change or Not allowed (`agentFolders`), plus Add a folder | Documents and Projects saved; a folder outside is refused (self-test) |
| Permissions | Internet for new tasks, the spend that always asks, the default budget, quiet hours | $5.00 saved; quiet hours mute approval banners (self-test) |
| Apps | Removed from Setup for the launch (Oct 29). The same list is GurtOS Settings, Apps: every app with its icon, the sites it reaches and its keys, "Test money only" on Shopper, Agent wallet and ASI:One; Setup only turns Find on the first time | `APIFY_TOKEN` saved: listed by name and time, the chip turned grey; ASI:One turned off and on again in the box |
| Pair a phone | QR and code when the box has an address a phone can reach; otherwise it says so and offers Skip | No address on Personal yet, so Skip |
| Done | Four cards: Ask an Agent, the top bar, Keep or Undo, History. Start using GurtOS finishes and opens the app | `done: true`, six steps recorded |

![GurtOS Setup opens at login](screenshots/setup/00-first-login.png)

![AI models](screenshots/setup/02-models.png)

![Folders](screenshots/setup/03-folders.png)

![Permissions](screenshots/setup/04-permissions.png)

![Apps](screenshots/setup/05-apps.png)

![Apps in dark](screenshots/setup/05-apps-dark.png)

![Pair a phone, with no address yet](screenshots/setup/06-phone.png)

![Done](screenshots/setup/07-done.png)

The rest of the layer in the new system:

![Ask an Agent in Files](screenshots/setup/10-files-menu.png)

![The Ask an Agent dialog](screenshots/setup/11-ask.png)

![An approval as a notification](screenshots/setup/12-approval.png)

![The top-bar menu](screenshots/setup/13-indicator.png)

![Review: Keep these changes?](screenshots/setup/14-review.png)

![Kept, with Put files back](screenshots/setup/15-kept.png)

## A fresh install, as a new person (Oct 24)

The GurtOS Personal ISO (`image/build personal`, debug build `20261024-0542-ada8208`) attached to the cloud VM as a
custom ISO, installed on its wiped disk, and walked by hand as a new person, Maya Chen, on Wayland:

| Step | Result |
|---|---|
| Install from the ISO and restart | Passed. Booted GurtOS Personal 2026.10.24 from its own disk, box healthy, no owner yet, empty vault |
| GNOME's first-boot setup (language, keyboard, time zone, About You, password) | Passed. The account `mayachen` is in `sudo`; `box-owner.service` set `BOX_OWNER=mayachen` within a second |
| First login | Passed. Ubuntu's welcome, then the GurtOS welcome; GurtOS first in the dock, the indicator in the top bar |
| Ask an Agent on `~/Documents/thesis` in Files | Passed. With the empty vault the task failed at once and the desktop said so ("the vault has no FACTORY_API_KEY"); after the key was added, a real Droid task finished in about a minute for 3 cents |
| The review notification and the diff | Passed. The folder was untouched until Keep |
| Keep | Passed. Both files changed, and kept their owner and mode: `chapter1.md` 1000:1000 664, the private `refs.txt` 1000:1000 640 |
| Undo Keep | Passed. Old content back, same owner and modes |
| Undo before Keep | Passed. The folder never changed |
| An approval as a notification, Approve | Passed. The log says `desktop:mayachen` |
| The GurtOS app from the dock, the indicator menu | Passed |
| Log out, restart, log in again | Passed. No second welcome; the service and indicator come back |

![GNOME's first-boot setup](screenshots/install/01-setup-welcome.png)

![About You: the first account, which gets sudo](screenshots/install/06-about.png)

![Setup done](screenshots/install/09-setup-done.png)

![The GurtOS welcome at the first login](screenshots/install/12-gurtos-welcome.png)

![Ask an Agent in Files](screenshots/install/15-files-menu.png)

![The Ask an Agent dialog](screenshots/install/16-ask.png)

![The task is done](screenshots/install/19-review-notification.png)

![The review](screenshots/install/20-review.png)

![Kept](screenshots/install/21-kept.png)

![Undo Keep asks first](screenshots/install/22-unkeep-confirm.png)

![An approval as a notification](screenshots/install/24-approval.png)

![Undo before Keep](screenshots/install/29-undo-confirm.png)

![The GurtOS app](screenshots/install/31-app.png)

Found and passed on: apport's Python hook fails on `ID=gurtos`; GNOME's setup renames the computer to the user name;
apps show Adwaita icons instead of Yaru; setup's first page shows Ubuntu's logo (image thread). A fresh install has
an empty vault with nothing in the first run to fill it, and Personal has no `BOX_URL`, so phone pairing cannot work
yet (core thread). The portal greets the owner as "Ben" (portal thread).

## Talk to your computer: speed

Measured on the 4 vCPU test VM, with a computer-voice recording of "What did my agents do today?" (2.3 s of audio):
the model loads while you are still talking (2.7 s), speech to text takes 1.1 s after you stop, and the box answers in
0.06 s, so **about 1.2 s from the end of the sentence to the written answer**. `tiny.en` is 0.55 s but misheard two of
three requests; `base.en` got all three. Search itself is /find's Moss call (under a millisecond on the test index). Run
`GURTOS_VOICE_WAV=speech.wav personal/voice.py --timing --quiet` to measure a recording. The speech model and its Python
environment are about 600 MB, installed by `voice-setup.sh` (needs a network once; the image build runs it).

## Install

On Ubuntu 24.04 with the box installed:

```
sudo core/install.sh && sudo personal/install.sh [owner]
```

`install.sh` installs GNOME if it is missing (`ubuntu-desktop-minimal`) and what the layer uses (GTK 4, libadwaita,
WebKitGTK 6, nautilus-python, Ubuntu's AppIndicator extension, `dconf-cli`, `librsvg2-common`, and from Figma's
theme `papirus-icon-theme`, `bibata-cursor-theme` and `gnome-console`). It copies this folder
to `/opt/box/personal` and installs the apps, icons, fonts, the Files extension, the search provider and GurtOS Setup's
autostart entry. Then `theme/install.sh` installs the GurtOS session, its Shell mode and extension, the dconf defaults
(`/etc/dconf/profile/user` and `gdm`, `/etc/dconf/db/gurtos.d`, `gdm.d`, then `dconf update`), wallpaper, icon theme,
GTK accents in `/etc/skel`, logos and the Plymouth theme, makes the GurtOS session GDM's default
(`DefaultSession=gurtos.desktop`) and moves existing accounts from Ubuntu's session to it. It sets `BOX_OWNER` on the
box service to the owner you name, or to the first human in the `sudo` group. It is safe to run again.

**For `image/build personal`:** run `personal/install.sh` in the image's root after the box's own install steps. It
only installs files and packages and never starts anything, so it works in a chroot (the AppArmor profile then loads
at first boot). What the image adds itself:
- Packages: `plymouth` and `plymouth-label` (the splash; `install.sh` sets the GurtOS theme only when Plymouth is
  there) and `splash` on the kernel command line; `qrencode` for pairing QR codes.
- `DefaultSession=gurtos.desktop` in its own `/etc/gdm3/custom.conf` (install.sh adds it when missing).
- `/etc/issue` from `theme/issue`; `os-release` with `LOGO=gurtos-logo` (the icon is installed).
- Optional: drop Ubuntu's sessions from `/usr/share/{wayland-sessions,xsessions}/ubuntu*.desktop`, so the login
  screen offers only GurtOS.
- Rebuild the initramfs after install.sh (`update-initramfs -u`), for the two-step Plymouth theme.
  The theme carries its own `lock.png`, `entry.png` and `bullet.png` (drawn for GurtOS): two-step will not load
  without them. The image also ships `/etc/plymouth/plymouthd.conf` and `plymouth.ignore-serial-consoles`.
- GNOME's first-boot setup shows Hills too: `dconf/db/gdm.d/01-gurtos` sets the background for its session.

## How it works

- **The Shell extension** (`shell/gurtos@gurtos.dev/`, GNOME Shell 46, ES modules) follows the action log over
  Server-Sent Events (`GET /api/log/stream`). Events only mean "something changed": it then reads tasks, pending
  approvals and settings, and `plan()` in `logic.js` decides which notifications to post and withdraw, so a replayed
  or missed event cannot leave a stale one. It answers with `POST /api/approvals/<id> {approved, by: "desktop:<user>"}`.
  It shows nothing for an account that is not the box's owner. `logic.js` has no GNOME imports, so the demo step runs
  the same code under Node.
- **Why a session, not a user extension.** GNOME loads the extensions a session mode lists (as Ubuntu does for its
  dock), and the Extensions app cannot turn those off. The session's desktop names are `GurtOS;ubuntu;GNOME`, so
  Ubuntu's own defaults still apply where GurtOS sets none, and its `XDG_CONFIG_DIRS` puts `/etc/xdg/gurtos` first,
  which is how Ubuntu's welcome tour and nags are hidden there without touching Ubuntu's files. The extension is also
  in the default `enabled-extensions`, because only listed extensions keep running on the lock screen.
- **Defaults, not locks.** `theme/dconf/db/gurtos.d/00-gurtos` sets wallpaper, fonts, icons, the dock and favourites
  as defaults people can change. Nothing is locked: the part that must not be turned off (the extension) is held by
  the session mode instead.
- **GurtOS Settings and Setup share their pages** (`setupwin.py`), so they never disagree. Settings applies each
  change at once; Setup records each step.
- **Python for the apps, JavaScript only where GNOME requires it.** PyGObject ships with Ubuntu's desktop, so the
  apps, the search provider and the Files extension need no build step. The Shell extension must be JavaScript.
- **WebKitGTK and AppArmor.** Ubuntu 24.04 lets only programs with an AppArmor profile create the user namespace
  WebKit's sandbox needs. `files/apparmor-box-ui` gives the GurtOS app the same kind of profile Ubuntu gives Epiphany
  and Geary. That is why launchers run `box-ui.py` directly and not through `python3`.

## The demo step

`personal/demo.ts` runs `selftest.py` headless against the demo box, because the test VMs have no desktop. It runs
the layer's own code: the calls the service, the indicator and the dialogs make, and `plan()`'s choices. It checks
that a task stopping for an OK becomes a notification and is counted in the top bar, that Approve lets it finish and
withdraws the notification, that a denial on the phone withdraws it too, and that a folder task leaves the folder
untouched until Keep, asks for a review, Keep writes both changes with the owner's uid, gid and mode, and Undo Keep
puts them back. For GurtOS Setup it checks that a step is recorded, that folders chosen in Setup limit Ask an agent
(two of them make one task, a folder outside is refused), that the spend limit and quiet hours are saved and quiet
hours mute banners, that a key saved in Setup is listed by name and never shown, and that every app is listed with
its access. It puts the box's settings back afterwards. About 4 seconds, no model, no money.

```
BOX_URL=http://127.0.0.1:7700 /usr/bin/python3 personal/selftest.py   # on any box, prints one JSON line per check
```

## The test machine

A cloud VM made for this edition (4 vCPU, 8 GB). Its address and how to delete it are kept outside the repo.

Since Oct 24 it runs a fresh install of the GurtOS Personal debug ISO, owned by `mayachen`, on Wayland (debug builds
have sshd for root). `personal/vm.sh` drives it, with `PERSONAL_VM` set to its ssh host; `wl.py` gives it a virtual
tablet and keyboard through `/dev/uinput`, so it works on Wayland and even in GDM's first-boot setup, where xdotool
and GNOME's remote-desktop input do not:

```
PERSONAL_USER=mayachen personal/vm.sh layer         # replace /opt/box/personal on the installed system, restart the layer
PERSONAL_USER=mayachen personal/vm.sh wl click X Y  # also: wl type TEXT, wl key Return
PERSONAL_USER=mayachen personal/vm.sh shot <name>   # screenshot into personal/screenshots/<name>.png
personal/vm.sh install                              # the older path: the box and this layer onto plain Ubuntu
```

To reinstall from a new ISO: serve it from the build VM, add it with `POST /v2/iso {url}`, wipe the disk
(`wipefs -af /dev/vda`) and `POST /v2/instances/<id>/iso/attach`. The account allows two custom ISOs. Detach and
delete it afterwards.

## Not built yet

- **Pairing a phone** on Personal is offered only when a phone can reach the computer: on the same Wi-Fi when the box has
  a network address (`BOX_URL`, which a GurtOS image sets), or from anywhere through the GurtOS relay. Otherwise Setup's
  phone step says why and offers Skip, and Settings' Phone page says the same. The QR path (with `qrencode`) is written
  but not walked on a phone.
- **From the Personal frames, waiting on the core:** "May read" for a folder (the core has one kind of grant, may
  change), "May also read" in Ask an Agent and a per-task internet choice (the
  dialog shows what Settings gives a new task).

## GurtOS Personal with Business turned on

The native app covers one person's agents. With Business on, its sidebar adds Company, which opens the Business
screens (people, rules, routed approvals, the audit trail) in the browser for now, from the same box.

## UX pass (Oct 24, from docs/ux/audit.md)

- Words follow `docs/ux/words.md`: Undo before and after Keep (no "Put back", "Take out" or "Go back"), New task,
  Needs you, Claude, and one sentence about keys: "GurtOS keeps keys where agents can't read them."
- The model key is checked with one call to Anthropic (`GET /v1/models`) before it is saved; a refused key is never
  stored. With no key, Setup's Next reads "Skip for now". A failed task's banner is a sentence, with Open Settings
  when the key is the problem.
- "Needs you" counts requests only, the same in the pill, the popover, Quick Settings and the app's badge.
- Banners: none replayed at login, and tasks that finish within 3 seconds of each other share one.
- Personal's spending defaults: ask over $5.00, budget $1.00, set by Setup the first time and used by New task.
- Setup offers no apps (launch, Oct 29). The first time, it turns Find on and every other app off. Settings' Apps page
  lists apps for one person (Find, Shopper, Wallet, Factory, ASI:One, Mana, Apify) with "Needs a key", "Uses the internet"
  and "Test money only" chips, and the app's sidebar adds "(test)" to the test-money ones. Settings' Keys page groups
  keys by app.
- Times follow GNOME's clock setting (24-hour or AM/PM) in the app, Settings, Setup and the top bar. Text sizes are in
  pt, so GNOME's Large Text makes GurtOS's windows larger too.
- Plain zeros (P-29, Ben's call): Atkinson Hyperlegible Next draws 0 with a slash and has no plain alternate, so
  `fonts/plain_zero.py` redraws it: the two half-counters become one oval counter at every weight, and the tabular
  zero follows. The font is OFL with no reserved name, so it keeps its name; Mono, used for code, keeps the slash.

## Screenshots for the sites (Oct 24, after the UX fixes)

Taken on the Personal test VM from main, at 1920x1080, with invented demo data (a local demo inbox, never real mail):
`screenshots/os/everyday.png` and `everyday-dark.png` (1680x1050, 16:10 like the sites' display frame; mail, a browser and Files with the GurtOS app, the top-bar pill
and a request banner), and in `screenshots/site/`: `approval.png` (a request banner and Needs you), `indicator.png` (the
top-bar popover), `review.png` (a finished task with Keep changes and Undo task) and `files-menu.png` (Files' menu on a
folder with changes waiting). They replace the site copies made from the older `setup/` and `install/` shots.
