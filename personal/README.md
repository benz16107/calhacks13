# GurtOS Personal: the desktop layer

GurtOS Personal is the OS on your own laptop. You use Ubuntu's GNOME desktop as usual, with your own account and
sudo. Agents work beside you as their own users without sudo, on copies of your folders, and nothing in your folders
changes until you choose Keep. This folder is the GNOME side of that: five small pieces that talk to the box's API on
`127.0.0.1:7700`. The box itself (tasks, the vault, the action log, Keep and Undo) is `core/`.

Tested two ways on a cloud VM: installed onto plain Ubuntu 24.04 with GNOME 46 (Xorg), and as a fresh install of the
GurtOS Personal ISO walked as a new person on Wayland, Ubuntu's default (below).

## What it adds

| Piece | What it does | File |
|---|---|---|
| GurtOS Setup | At the owner's first login, after GNOME's own setup: Welcome, AI models, Folders, Permissions, Apps, Pair a phone, Done. Every answer goes to the box | `box-ui.py setup`, `setupwin.py` |
| Approvals as notifications | Each approval becomes a GNOME notification with Deny and Approve (Approve names the amount). Clicking the body opens the task in GurtOS. An answer from anywhere else (phone, portal, the top bar) withdraws it. In quiet hours it waits in the list with no banner | `box-desktop.py` |
| Top-bar indicator | The GurtOS box icon with "1 running · 2 need you". Its menu: Needs your OK (with Approve and Deny), Ready to review, Running, then Ask an Agent, Open GurtOS and GurtOS settings | `box-desktop.py` |
| The GurtOS app | The portal in its own window (WebKitGTK), first in the dock | `box-ui.py app` |
| Ask an Agent in Files | Right-click one folder or up to ten. One dialog: the task, the folders it may change, its internet, budget and worker. One Droid task on copies of them | `files/box-nautilus.py`, `box-ui.py ask` |
| Keep or Undo | When the task is done, a notification opens the review: what changed, the diff, and a card that asks Keep these changes? Put files back undoes a Keep | `box-ui.py review` |
| Failures | A task that cannot finish says why in a notification (a missing model key instead offers to open GurtOS Setup) | `box-desktop.py` |

**The design.** These windows follow the GurtOS system (`docs/figma/system.md`) and the Personal frames in
`docs/figma/os-v2/personal/`, built from libadwaita's own widgets so they sit among GNOME apps. The system's colour
tokens in light and dark become libadwaita's named colours (`gurtos.css`, `gurtos-dark.css`); the type is Atkinson
Hyperlegible Next and Mono (bundled in `fonts/`, SIL OFL); app icons are the system's glyphs on coloured tiles
(`apptiles.py`, the same paths the portal draws). GNOME's own surfaces (the top bar, notification banners, menus,
Files) stay GNOME's, with GurtOS content: notification titles use GNOME's header capitalization, as the system says.

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
| Apps | Optional. Every app with its icon, the sites it reaches and its keys (amber only when an app that is on misses one); a switch turns it on or off; clicking an app with a missing key opens a sheet to add it | `APIFY_TOKEN` saved: listed by name and time, the chip turned grey; ASI:One turned off and on again in the box |
| Pair a phone | QR and code when the box has an address a phone can reach; otherwise it says so and offers Skip | No address on Personal yet, so Skip |
| Done | Four cards: Ask an Agent, the top bar, Keep or Undo, Time Machine. Start using GurtOS finishes and opens the app | `done: true`, six steps recorded |

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

## Install

On Ubuntu 24.04 with the box installed:

```
sudo core/install.sh && sudo personal/install.sh [owner]
```

`install.sh` installs GNOME if it is missing (`ubuntu-desktop-minimal`) and the libraries the layer uses (GTK 4,
libadwaita, WebKitGTK 6, AyatanaAppIndicator, nautilus-python). It copies this folder to `/opt/box/personal`, adds the
desktop entry, icons, the GurtOS fonts, the Files extension, GurtOS Setup's autostart entry, the user service (enabled for every
account), and a schema override that puts GurtOS first in the dock for new accounts. It sets `BOX_OWNER` on the box
service to the owner you name, or to the first human in the `sudo` group. It is safe to run again.

**For `image/build personal`:** run `personal/install.sh` in the image's root after the box's own install steps. It
only installs files and packages and never starts anything, so it works in a chroot (the AppArmor profile then loads
at first boot). Two things the image must do itself: boot to GDM and the GNOME session instead of the Server's kiosk
(`box-kiosk.service`, `box-screen.service`), and set the owner once the first account exists, by running
`personal/install.sh <user>` again or writing `BOX_OWNER` into `/etc/systemd/system/box.service.d/personal.conf`.

## How it works

- **The service** (`box-desktop.service`, a systemd user unit in the graphical session) reads the action log once
  (`GET /api/log`) and then follows it live (`GET /api/log/stream`). Events only mean "something changed": it then
  reads `GET /api/tasks` and `GET /api/approvals?state=pending`, and `plan()` in `boxapi.py` decides which
  notifications to post and which to withdraw. So a replayed or missed event cannot leave a stale notification.
  It posts and answers notifications over D-Bus (`org.freedesktop.Notifications`) and answers approvals with
  `POST /api/approvals/<id> {approved, by: "desktop:<user>"}`, so the log records who said yes.
- **Approvals use the critical urgency**, so the banner stays on screen until you answer. The task has stopped and
  is waiting for you. Reviews of finished work use the normal urgency.
- **The indicator is an AppIndicator, not a Shell extension.** Ubuntu 24.04 ships and enables AppIndicator support,
  so the indicator is a few lines in the service that already holds the task and approval state. A Shell extension
  would need its own connection to the box, has to be enabled per account, and breaks when GNOME changes its
  extension API (GNOME 45 moved extensions to ES modules). A crash in the service also cannot take down the shell.
- **The windows** are one GTK 4 and libadwaita application (`dev.box.Box`), so a second launch from Files, the dock
  or a notification opens its window in the same process. GNOME's HIG patterns throughout: header bars, boxed
  lists, Cancel first and Start as the suggested action, Undo in the destructive style with a confirmation.
- **Ask an Agent** sends `POST /api/tasks {title, prompt, folder, budgetCents, source: "files"}`. The core links the
  folder and runs the task as its own user on an overlay copy. Keep is `POST /api/tasks/<id>/keep`, which returns
  `{kept}` or `{conflicts}` (you changed the same file meanwhile; nothing is written). Undo is
  `POST /api/tasks/<id>/undo`, and Undo Keep is `POST /api/tasks/<id>/unkeep`. The task's `review` field
  (`pending`, `kept`, `conflict`, `undone`) is how the desktop knows which tasks still need the owner.
- **Python, not TypeScript.** GNOME's own bindings (PyGObject) ship with Ubuntu's desktop, so the layer needs no
  build step and no npm packages. The box itself stays TypeScript.
- **WebKitGTK and AppArmor.** Ubuntu 24.04 lets only programs with an AppArmor profile create the user namespace
  WebKit's sandbox needs. `files/apparmor-box-ui` gives the GurtOS app the same kind of profile Ubuntu gives Epiphany
  and Geary, so the web sandbox stays on. That is why launchers run `box-ui.py` directly and not through `python3`.

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

- **One folder per task.** The core takes one `folder`, so Files offers Ask an Agent for one folder at a time.
- **May read, the Internet switch and Pause All Agents** from the Figma frames: the core has no API for them yet.
- **Pairing a phone** on Personal: the box has no address a phone can reach yet, so Setup's phone step says so and
  offers Skip until `GET /api/boxes` reports one. The QR path (with `qrencode`) is written but not walked.
- **From the Personal frames, waiting on the core:** "May read" for a folder (the core has one kind of grant, may
  change), "May also read" in Ask an Agent, Pause all agents in the top-bar menu, and a per-task internet choice (the
  dialog shows what Settings gives a new task). The amber count in the top bar is plain text, because an AppIndicator
  label cannot be coloured.
