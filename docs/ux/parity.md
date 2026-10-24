# GurtOS Personal vs stock Ubuntu 24.04 Desktop: everyday parity audit

Date 2026-10-24. Audit only, no product code changed, nothing committed. Screenshots are in `docs/ux/shots/parity/`
(`gurtos-NN-*.png`, `ubuntu-NN-*.png`, plus side-by-side sheets `sheet-*.png`). Raw output is in the appendix.

**Bar:** as good as Mac, Windows and stock Linux for normal use, plus better agent handling. Rule used: worse than stock
Ubuntu is P0, a place where macOS or Windows is clearly smoother is P1.

## How it was measured

| | A. GurtOS Personal | B. Stock Ubuntu |
|---|---|---|
| Image | `gurtos-personal-x86_64.iso` (0.1.0-preview, kernel 6.8.0-147) | `ubuntu-24.04.5.1-desktop-amd64.iso`, SHA256 verified against releases.ubuntu.com (kernel installed: 7.0.0-38, the HWE kernel) |
| Install | its own installer, whole 48 GB disk, about 1 minute | GUI installer, **"Default selection"** (the installer's default, = `ubuntu-desktop-minimal`), no third-party software, erase disk, about 7 minutes (15:13 to 15:20) |
| VM | QEMU 11.1 KVM, q35, SeaBIOS, 4 GB RAM, 4 vCPU, virtio-vga 1920x1080, Intel HDA audio, user-mode NAT, 48 GB qcow2 | identical flags |
| Account | `anatest` (administrator), GNOME first-run for A, installer account for B | same name and password |

* Same harness for both: QMP `input-send-event`, `send-key`, `screendump`; a terminal in the guest only to install `openssh-server` and an
  audit key, then everything else over ssh (a `sudoers` drop-in for passwordless sudo was added in both). On GurtOS I also had to open
  port 22 in `/etc/nftables.conf` (see E-6); that change is in neither idle reading's process list.
* Boot: `systemd-analyze`, and wall time from `systemctl reboot` to the greeter on screen (includes shutdown).
* Login: password typed, Enter pressed, time until the screen is non-black, not the greeter, and unchanged for 2.5 s (screendump at about 15 per second, 96x54 grey frames).
* Launch: command sent over a persistent ssh connection (20 ms overhead, measured) to first changed frame and to the frame that then stays still for 0.8 s.
  "Cold" is the first launch after a fresh boot and login. Firefox on stock was launched by a click on its dock icon, because the snap refuses to start from the ssh environment (`cannot open display :0`).
* Idle: 2 minutes at the desktop with nothing open, then `free -m`, `top -bn3 -d5`, `ps` by RSS, PSS total. Screen blank and lock were turned off (`idle-delay 0`) after boot 1 in both.
* Two clean reboots each, so two boot, login, idle and cold-launch readings per OS. A third, crashed boot of A is listed separately.
* All timings are from QEMU/KVM, not real hardware. Both ran the same way, so compare them to each other, not to a laptop.
* **Memory pressure:** linuxbox was under memory pressure earlier in this audit (swap full with other agents' VMs; one of my VMs was stopped, so the first
  GurtOS session and its timings were thrown away). Every reading below was taken after that, with no other `-name ux-` qemu process running
  (checked before each run, `others: 0`). Host swap stayed at about 8 GB used from before my start, so the "swap used under 2 GB"
  condition could not be met; I relaxed it to "no swap I/O" (vmstat `si`/`so` of 0 to 4), which held.

## Headline numbers

| | Stock Ubuntu | GurtOS Personal | Verdict |
|---|---|---|---|
| Kernel + userspace boot (run 1, run 2) | 20.1 s, 18.2 s (3.3 + 16.9, 3.4 + 14.8) | 5.1 s, 5.7 s (1.2 + 3.9, 1.2 + 4.5) | better, 3.5x faster |
| `reboot` command to greeter on screen | 29.0 s, 26.5 s | 11.9 s, 11.4 s | better |
| GDM Enter to desktop stable (cold login) | 3.4 s, 3.1 s | 1.7 s, 1.8 s | better |
| Idle RAM used, 2 min after login (`free -m`) | 1156 MB (with Software Updater popup open), 1047 MB | 902 MB, 903 MB | better, about 150 MB less (about 250 MB less than stock with its updater popup) |
| Idle PSS total | 1007 MB, 833 MB | 795 MB, 790 MB | better |
| Idle CPU (3rd `top` sample) | 99.9% idle, 100.0% idle | 99.6% idle, 99.8% idle | same |
| Processes at idle | 228, 227 | 192, 194 | better |
| Disk used after install | 10 163 MB of 48 GB (`/`) | 4 359 MB (slot `/`, 12 GB slot) + 947 MB (`/data`) = 5 306 MB | better |
| Swap | 3.8 GB `/swap.img` | none | **worse (E-7)** |
| Installer | 12 steps, 7 min | no steps, about 1 min, erases a blank or typed-`erase` disk | different (E-15) |
| First-run setup | installer 12 pages + Welcome 5 pages | GNOME setup 5 pages + GurtOS Setup 7 steps (all skippable by Next) | same-ish |

### What the GurtOS layer costs

At idle the box service (`node box.ts`, 153 MB RSS) and `spacetimedb-standalone` (120 MB RSS) hold about 273 MB, which is 30% of the 902 MB in use,
and 0.8% CPU each in `ps` (0.0 to 0.1 in `top`). Without them GurtOS would sit near 630 MB. The Shell extension adds no separate process. The
`box-confirm` (2.1 s) and `box-droid` (1.4 s) units show in `systemd-analyze blame` but are not on the boot critical path.

### Launch times (seconds, first changed frame / settled frame)

| App | Stock cold (run A, run B) | Stock warm (4 samples) | GurtOS cold | GurtOS warm (4 samples) |
|---|---|---|---|---|
| Files | 2.80 / 3.16, 1.22 / 1.47 | 0.40 to 0.44 / 0.54 to 0.62 | 1.26 / 1.50 | 0.64 to 0.72 / 0.83 to 0.93 |
| Settings | 0.67 / 0.69, 0.67 / 0.68 | 0.43 to 0.45 / 0.45 to 0.47 | 6.04 / 6.07 (one sample; 1.1 s in the earlier, discarded run) | 0.60 to 0.71 / 0.64 to 0.74 |
| Terminal (`gnome-terminal` / Console `kgx`) | 0.52 / 0.54, 0.48 / 0.50 | 0.39 to 0.43 / 0.42 to 0.45 | 0.60 / 0.62 | 0.55 to 0.60 / 0.57 to 0.62 |
| Browser (Firefox snap / GNOME Web) | 2.70 / 4.86, 3.11 / 4.76 | 1.33 to 1.56 / 2.52 to 3.16 | 0.97 / 0.99 | 0.59 / 0.88 to 0.92 |
| Text editor | 0.67 / 0.69, 0.54 / 0.55 | 0.44 to 0.89 / 0.46 to 0.90 | 0.71 / 0.73 | 0.60 to 0.65 / 0.62 to 0.67 |

Reading: GurtOS apps are light (GNOME Web opens 3 to 5 times faster than the Firefox snap) but each warm launch of a GNOME app takes about 0.2 s longer than on stock (E-14).

## The table

Verdict key: same, **worse (P0)**, better, **Mac/Win smoother (P1)**.

| Item | Stock Ubuntu (Default selection) | GurtOS Personal | macOS / Windows | Verdict | Fix |
|---|---|---|---|---|---|
| Boot | 15 to 20 s, snapd, apport, NetworkManager on the path | 5 to 6 s | both about 10 to 20 s cold | better | none |
| Login to desktop | 3.1 to 3.4 s | 1.7 to 1.8 s | similar | better | none |
| Idle RAM / CPU | 1.0 to 1.2 GB, 0% | 0.9 GB, 0%; 273 MB of it is the box | macOS about 3 GB, Windows about 3 GB | better | none |
| Disk after install | 10.2 GB | 5.3 GB (12 GB system slot, 6.7 GB free) | 20 to 30 GB | better | none |
| Swap / OOM protection | 3.8 GB swap file, `systemd-oomd` | none, no oomd, no zram | both compress or swap | **worse (P0)** | E-7 |
| Setup flow | 12 installer pages, then Welcome (Pro, privacy, app tour) | text installer, GNOME setup: language, typing, time zone (search, map), About You, password, All done; GurtOS Setup 7 steps | both ask for Wi-Fi and Apple ID / Microsoft account in setup | same | E-13 (no Wi-Fi step) |
| Wi-Fi UI | panel exists ("No Wi-Fi Adapter Found" in the VM), installer has a network page | panel exists, same message, top-bar network menu, no setup step | both ask during setup | same (panel), Mac/Win smoother (setup) | E-13 |
| Display scaling | 100% / 200%, Fractional Scaling toggle, Night Light, 75 Hz | identical panel | per-display scale in both | same | none |
| Sound | Line Out / Line In, test button, overamplification | identical | same | same | none |
| Printers | CUPS, panel "No Printers / Add Printer", `cups-browsed`, avahi, hplip, ipp-usb | **no CUPS: panel says "No Print Service"**, no avahi | AirPrint, driverless in both | **worse (P0)** | E-1 |
| Online accounts | goa installed (Google, Microsoft, Nextcloud, Exchange, IMAP) | panel lists the providers, `goa-daemon` not installed | built in | **worse (P0)** | E-4 |
| App store | App Center (snap), `snap install` works, Spotify and VLC listed | none; `apt` only | App Store, Microsoft Store | **worse (P0)** | E-2 |
| Install VLC | App Center or `sudo snap install vlc`: 45 s (root used 10.2 GB at first run, 12.2 GB after this and other first-hour updates) | `sudo apt install vlc`: 21 s, +377 MB (lost at the next system update); `apt install firefox` pulls snapd, 72 s, +1.65 GB, also lost | one click | **worse (P0)** | E-2 |
| Install Spotify | `snap install spotify` (listed) | not in the archive; works only if snapd is added by hand (lost at update) | one click | **worse (P0)** | E-2 |
| Updates | Software Updater popup on first login ("78.2 MB will be downloaded"), `unattended-upgrades`, firmware updater | Software Updater says "up to date" but offers **"Upgrade to Ubuntu 26.04.1 LTS"**; real updates are GurtOS image updates (`box-update`), invisible in Settings | automatic with a visible Settings page | **worse (P0)** | E-3 |
| Default browser | Firefox (snap), in dock | GNOME Web (Epiphany), in dock | Safari, Edge | Mac/Win smoother (P1) and H.264 gap | E-10 |
| Mail / calendar / office | none in Default selection (Thunderbird, LibreOffice only in Extended) | none | Mail, Calendar, Pages / Outlook, Word | same | none |
| Media / images / PDF | no media player in Default; Image Viewer, Document Viewer | same apps (Image Viewer, Document Viewer), no media player | QuickTime, Photos / Media Player | same | E-10 for codecs |
| File sharing (Settings > Sharing) | panel with device name, Media Sharing, Remote Desktop (gnome-remote-desktop, rygel) | **panel missing: the Sharing entry opens Online Accounts** | AirDrop, SMB share | **worse (P0)** | E-5 |
| Firewall | `ufw` installed, inactive; everything inbound open | `nftables` default drop: only DHCP and port 7700 from private ranges | both have a firewall that allows common services | **worse (P0, design choice)** | E-6 |
| Screenshots | `Print` opens the screenshot UI (selection, screen, window, record) | identical, `Print` | Cmd+Shift+5, Win+Shift+S | same | none |
| Keyboard shortcuts | Super (overview), Super+A (apps), Alt+Tab, Super+L (`gsettings` checked; Print and Super+A also pressed) | same keys and same gsettings | same | same (Alt+Tab and Super+L not exercised) | none |
| Search | Super, type: apps, files, settings | same, plus GurtOS and Find providers; "term" lists both Terminal and Console | Spotlight | same | E-13 (two terminals) |
| Notifications | banner at top centre | identical | same | same | none |
| Power and battery | Power Mode (Balanced, Power Saver) via `power-profiles-daemon`; `iio-sensor-proxy`, `gnome-power-manager` | only Screen Blank; no power profiles, no sensor proxy | battery pages in both | **worse (P0)** | E-9 |
| Bluetooth | `bluez`, panel "No Bluetooth Found" in VM | same | same | same | none |
| Accessibility | Orca, brltty, speech-dispatcher, Accessibility menu | menu and panel present, **no Orca, brltty or speech-dispatcher** | VoiceOver, Narrator | **worse (P0)** | E-8 |
| Input methods | `ibus` + Chinese, Japanese, Korean engines | **none**, while the setup "Typing" page offers input methods | built in | **worse (P0)** | E-8 |
| Phone, Windows disks, network drives | `gvfs-backends`, `ntfs-3g`, `usbmuxd` | none of them | built in | **worse (P0)** | E-9 |
| Firmware updates, fingerprint, Thunderbolt, hybrid GPU | `fwupd`, `fprintd`, `bolt`, `switcheroo-control` | none | built in | **worse (P0)** | E-9 |
| Utilities | Disks, Disk Usage, Logs, Clocks, Characters, Fonts, Passwords and Keys, Startup Applications | Files, Terminal, Console, Text Editor, Calculator, System Monitor, Language Support, Help, Image and Document Viewer | built in | **worse (P0, low impact)** | E-9 |
| Codecs and apt sources | `restricted multiverse` enabled, `ubuntu-restricted-extras` available | `main universe` only; no `gstreamer1.0-libav` (`avdec_h264`, `avdec_aac` absent) | built in | **worse (P0)** | E-10 |
| Kernel | HWE 7.0.0-38 | GA 6.8.0-147 | n/a | **worse (P0, unmeasured on hardware)** | E-11 |
| About / branding | Ubuntu logo | GurtOS name, **Ubuntu logo** and an "Ubuntu Desktop" settings page | n/a | P2 | E-13 |
| Agents | none | Agents tile, approvals as notifications, GurtOS app, Files "Ask an agent" | none | better | none |

## Findings

Severity P0 means worse than stock Ubuntu. Owners: `image` (what is installed, boot, partitions, firewall), `personal` (the GurtOS layer, its processes,
its Settings and Setup screens).

### E-1 P0, image: no printing
Evidence: `gurtos-44-settings-printers.png` ("No Print Service. The system printing service doesn't seem to be available") against `ubuntu-44-settings-printers.png`
(No Printers, Add Printer). `dpkg` has `printer-driver-pnm2ppa` only. The stock Default selection ships `cups`, `cups-browsed`, `cups-filters`, `cups-pk-helper`, `hplip`,
`ipp-usb`, `system-config-printer-udev`, `avahi-daemon`.
Fix: add `cups cups-browsed cups-filters cups-pk-helper ipp-usb system-config-printer-udev avahi-daemon bluez-cups printer-driver-all` (about 120 MB) to `image/build`'s
Personal package list, and bind `/var/lib/cups` and `/etc/cups` to `/data` in `rootfs-personal/etc/fstab` so printers survive an update.

### E-2 P0, image: no app store, and nothing a user installs survives an update
Evidence: no `snap`, `flatpak`, `gnome-software` or App Center (`gurtos-inspect.txt`). `sudo apt install vlc` works (21 s, root used 4 636 to 5 012 MB) but `/usr` is replaced at the next
system update (`image/README.md` trade-off). `apt install firefox` installed snapd and the Firefox snap in 72 s, 1.65 GB of the 12 GB slot, and `/var/lib/snapd` is not in `rootfs-personal/etc/fstab`,
so that is lost too. Spotify has no apt package. Right after the install, a Shell search for "Firefox" found only a web search (the snap's launcher needs a new login). Stock: App Center and `snap install` (VLC 45 s).
Fix: ship `flatpak` and `gnome-software` with `gnome-software-plugin-flatpak` and the Flathub remote preconfigured as a per-user installation (`~/.local/share/flatpak` is on `/data/home`),
no deb or snap plugin, so an install survives updates (about 80 MB). Put the app in the dock where Ubuntu puts App Center. Second choice: bind `/var/lib/snapd` and `/snap` to `/data` and ship `snapd` plus the App Center snap.

### E-3 P0, image + personal: Software Updater offers a release upgrade to Ubuntu 26.04 and hides GurtOS updates
Evidence: `gurtos-69-update-manager-gui.png`: "The software on this computer is up to date. However, Ubuntu 26.04.1 LTS is now available (you have 0.1.0-preview). Upgrade...".
Pressing Upgrade on an A/B image cannot be right, and the person has no way to see or start a GurtOS update. Stock shows its own update list (`ubuntu-31-now.png`).
Fix: remove `update-manager`, `update-notifier` and `software-properties-gtk` from the Personal image (or set `Prompt=never` in `/etc/update-manager/release-upgrades`
and hide their `.desktop` files), and add a GurtOS "System update" row to Settings or the top-bar menu that shows `box-update` state (available, applied on next restart, rolled back).

### E-4 P0, image: Online Accounts cannot sign in
Evidence: `gurtos-45-settings-online-accounts.png` lists Google, Microsoft, Nextcloud and more, but `/usr/libexec/goa-daemon` does not exist (package `gnome-online-accounts` absent; stock has it plus `evolution-data-server`).
Fix: add `gnome-online-accounts gnome-online-accounts-gtk evolution-data-server` (about 40 MB). The calendar in the clock menu depends on the same service.

### E-5 P0, image: Settings > Sharing is missing
Evidence: `gurtos-46-settings-sharing.png` shows the Online Accounts page (the panel does not exist); stock `ubuntu-46-settings-sharing.png` has device name and Media Sharing. Missing: `gnome-remote-desktop`, `rygel`, `gnome-user-share`.
Fix: add those three. Pair with E-6 so enabling a service opens its port.

### E-6 P0 (design choice for Ben), image: inbound firewall drops everything a desktop uses
Evidence: `nft list ruleset` has `table inet gurtos`, input policy `drop`, accepting only loopback, established, ICMP, DHCP (udp 68, 546) and tcp 7700 from private ranges. ssh (22) timed out
until I added a rule. Stock has `ufw` inactive. This also blocks inbound mDNS (5353, absent here anyway), SMB, remote desktop, KDE Connect, Chromecast and a local dev server.
Fix: on Personal accept the ports of services the person turns on in Settings (a small `gurtos-firewall-open` hook the Sharing panel and `sshd` units call), plus mDNS 5353 and LAN-only for the rest; keep the drop policy only for agent users (`skuid 30000-39999`, already in table `box`).
If the demo should stay locked down, say so on the About page.

### E-7 P0, image: no swap, no zram, no oomd
Evidence: `swapon --show` empty, `SwapTotal 0 kB`, no `systemd-oomd`. Stock has a 3.8 GB `/swap.img` and oomd. On a 4 GB machine a browser, an office suite and an agent will hit the OOM killer with no warning.
Fix: add `systemd-zram-generator` (zram at 50% of RAM, no disk needed) and `systemd-oomd`; about 1 MB.

### E-8 P0, image: no screen reader, braille or input methods
Evidence: `orca`, `brltty`, `speech-dispatcher` and `ibus` are absent (`dpkg` and `command -v`); the GNOME setup "Typing" page lists input methods that cannot work. Stock ships Orca, brltty, speech-dispatcher, ibus with Chinese engines and `gnome-accessibility-themes`.
Fix: add `orca brltty speech-dispatcher speech-dispatcher-espeak-ng ibus ibus-gtk3 ibus-gtk4 ibus-libpinyin ibus-table ibus-m17n gnome-accessibility-themes` (about 90 MB).

### E-9 P0, image: laptop and hardware packages the stock install has
Missing against the Default selection: `power-profiles-daemon` (Settings > Power shows only Screen Blank, `gurtos-47-settings-power.png`, against Power Mode on stock), `iio-sensor-proxy` (auto-rotate, ambient light),
`switcheroo-control` (hybrid GPU), `fprintd` (fingerprint), `bolt` (Thunderbolt), `fwupd` and the Firmware Updater snap, `modemmanager`, `usbmuxd` (iPhone), `ntfs-3g` (write to Windows drives),
`gvfs-backends` (SMB, MTP, network drives in Files), `mesa-vulkan-drivers`, `gnome-power-manager`, `rtkit`, and the utilities Disks, Disk Usage Analyzer, Logs, Clocks, Characters, Fonts, Passwords and Keys, Startup Applications.
Fix: add the packages above (about 150 MB), all from `main`. Battery and Wi-Fi behaviour could not be measured in a VM, so this list comes from the package diff against `minimal.manifest` on the stock ISO, not from observed failures, except Power and Sharing.

### E-10 P0, image: web video and apt sources
Evidence: `gst-inspect-1.0 avdec_h264` and `avdec_aac` report "no" on GurtOS; GNOME Web uses GStreamer, so H.264 and AAC (most MP4) will not play. I did not play a file, this is inferred from the plugin list. On stock the Firefox snap carries its own codecs
(stock GStreamer also lacks `avdec_h264`, so the gap is in the browser, not the OS). GurtOS `apt` sources are `main universe` only, so `ubuntu-restricted-extras`, NVIDIA drivers and `ttf-mscorefonts` cannot be installed; stock has `restricted multiverse`.
Fix: add `gstreamer1.0-libav gstreamer1.0-plugins-bad gstreamer1.0-plugins-ugly gstreamer1.0-vaapi` (about 60 MB), enable `restricted multiverse` in the image's `sources.list`, and check a real H.264 and AAC file in GNOME Web before the demo. Or ship Firefox as a flatpak (E-2).

### E-11 P0 (risk, unmeasured), image: kernel is the GA 6.8, stock installs the HWE 7.0
Evidence: `uname -r` 6.8.0-147-generic on GurtOS, 7.0.0-38-generic on the stock 24.04.5.1 install. Laptops from 2025 on (new Wi-Fi, GPU and audio chips) often need the newer kernel.
Fix: build with `linux-generic-hwe-24.04` instead of `linux-image-generic` in `image/build`'s package list.

### E-12 P1, personal + image: Wi-Fi is not part of setup, and the installer cannot dual boot
Evidence: stock installer page 4 is "Connect to the internet" (`ubuntu-06-step4.png`); GNOME first-run has no network page (`gurtos-03-step2.png` through `gurtos-09-after-password.png`), the person must find the top-bar network menu. macOS and Windows ask in setup. The installer takes the whole disk (README).
Fix: show the network page in `gnome-initial-setup` (upstream has one; this image does not show it, check `/usr/share/gnome-initial-setup/vendor.conf` for a `skip_pages` entry), and say "erases the disk" clearly on the boot menu.

### E-13 P2, personal: branding and copy slips seen in the screenshots
* About shows the Ubuntu logo and the sidebar says "Ubuntu Desktop" (`gurtos-49-settings-about.png`); `LOGO=gurtos-logo` is set but the panel ignores it.
* Search for "term" lists Terminal and Console (`gurtos-62-super-search-term.png`); keep one.
* GurtOS Setup step "Apps" shows copy that is not about the app: Anthropic reads "Solo developers already leave AI agents running on a home server or an always-on desktop." (`gurtos-14-setup-step.png`).
* GurtOS Setup says "Time Machine keeps each agent's changes apart" (`gurtos-10-first-login-15s.png`), an Apple product name.

### E-14 P1, personal: warm app launches take about 0.2 s longer than stock
Evidence: warm first-change time on GurtOS 0.55 to 0.72 s against stock 0.39 to 0.45 s for Files, Settings, Terminal and Text Editor (table above), the same ssh launch path on both. The extra time is in the Shell, not the apps. One cold Settings launch took 6.0 s (the earlier, discarded boot-2 run took 1.1 s), likely host noise, but check it on the demo machine.
Fix: profile the GurtOS session mode (`gnome-shell --mode=gurtos`): look at the extension's window-open hook, the blurred dock (`transparency-mode FIXED`, `background-opacity 0.86`) and the custom window animation; compare with `GNOME_SHELL_SESSION_MODE=ubuntu`.

**Re-measured 2026-10-24 evening, inconclusive.** On one install of the released ISO, while linuxbox was swapping:
GurtOS as shipped, warm first change 0.56 to 0.92 s; the same install with `GNOME_SHELL_SESSION_MODE=ubuntu`, Files
0.67 to 0.69 s (other apps cut short when the VM was stopped for memory); GurtOS with the dock's `transparency-mode
DEFAULT` and intellihide off, 0.57 to 0.99 s. The dock settings don't close the gap, and the session mode doesn't
clearly either. The Personal thread measured 10 to 40 ms between the two session modes up to the window mapping.
Measure once more on the rebuilt ISO on a quiet host; the scripts are in `~/.cache/ux-audit/parity/bin/` on linuxbox.

### E-15 P1, image: no language, keyboard, or disk choice before install
Stock asks language, accessibility, keyboard, network, update, install type, apps, drivers and codecs, disk, account, time zone. GurtOS asks nothing until after install, then GNOME setup asks language, typing, time zone and account. That is faster (1 min against 7) but the person cannot pick a disk or keep Windows. Not a P0 because README states it; list it on the download page.

### E-16 info: what GurtOS does better
Boot 3.5x faster, login 2x faster, 150 MB less idle RAM even with the box (273 MB), half the disk, 192 processes against 228, no popups at first login, the Agents tile and approvals in the top bar and as notifications, and the dock already has the GurtOS app.

## Filesystem and agent speed

Measured by core (`docs/perf/filesystem.md`, baeabc5); the table is in `audit.md`, section "Filesystem and agent speed".

## What I could not measure

* Real hardware: Wi-Fi, battery life and the Power panel with a battery, Bluetooth, fingerprint, suspend and resume, real GPU, HiDPI and fractional scaling in use, sound through speakers or a microphone, a real printer. QEMU has none of these.
* UEFI and Secure Boot (both installs used SeaBIOS); GurtOS ships its own GRUB and the stock ISO is signed, so check Secure Boot on a real laptop.
* H.264 and AAC playback itself (inferred from the plugin list), signing in to an online account, the Upgrade button in Software Updater (not pressed), Alt+Tab and Super+L (shortcut bindings read from `gsettings`; Print and Super+A were pressed).
* An actual GurtOS system update and its effect on apt installs (taken from the README and `fstab`), and `box-voice.service` downloading its speech model.
* The first GurtOS session of this audit (before the VM was stopped for memory) and a 40 s crash recovery boot (5.99 s in `systemd-analyze`, listed in the appendix as boot 0) are not in the headline numbers.
* Mac and Windows columns come from general knowledge, not measurement.

## Appendix: raw output

The scripts are in `~/.cache/ux-audit/parity/bin/` (`qm.py` for QMP, `launchtime.py`, `logintime.py`, `bootwatch.py`, `measure-boot.sh`, `measure-idle.sh`, `inspect.sh`).

### gurtos-boot0

```
### os-release
PRETTY_NAME="GurtOS Personal 0.1.0-preview"
VERSION_ID="0.1.0-preview"
6.8.0-147-generic
4
### systemd-analyze
Startup finished in 1.180s (kernel) + 4.817s (userspace) = 5.997s 
graphical.target reached after 4.803s in userspace.
### critical-chain graphical.target
The time when unit became active or started is printed after the "@" character.
The time the unit took to start is printed after the "+" character.

graphical.target @4.803s
└─multi-user.target @4.803s
  └─getty.target @4.803s
    └─serial-getty@ttyS0.service @4.803s
      └─plymouth-quit-wait.service @1.931s +2.866s
        └─systemd-user-sessions.service @1.920s +6ms
          └─network.target @1.914s
            └─NetworkManager.service @1.292s +621ms
              └─dbus.service @1.259s +24ms
                └─basic.target @1.252s
                  └─sockets.target @1.252s
                    └─ssh.socket @1.252s
                      └─sysinit.target @1.235s
                        └─systemd-resolved.service @553ms +682ms
                          └─systemd-tmpfiles-setup.service @519ms +23ms
                            └─systemd-journal-flush.service @464ms +46ms
                              └─var-log-journal.mount @411ms +10ms
                                └─data.mount @362ms +11ms
                                  └─systemd-fsck@dev-disk-by\x2dlabel-box\x2ddata.service @315ms +36ms
                                    └─dev-disk-by\x2dlabel-box\x2ddata.device @311ms
### blame top 15
2.866s plymouth-quit-wait.service
2.052s box-confirm.service
1.403s box-droid.service
 726ms systemd-binfmt.service
 682ms systemd-resolved.service
 656ms systemd-timesyncd.service
 621ms NetworkManager.service
 279ms udisks2.service
 272ms gpu-manager.service
 240ms dev-vda3.device
 156ms NetworkManager-wait-online.service
 144ms accounts-daemon.service
 118ms user@1000.service
 116ms apparmor.service
  84ms packagekit.service
### uptime
 14:32:16 up 2 min,  2 users,  load average: 0.11, 0.09, 0.03
### running services
21
```

### gurtos-boot1

```
### os-release
PRETTY_NAME="GurtOS Personal 0.1.0-preview"
VERSION_ID="0.1.0-preview"
6.8.0-147-generic
4
### systemd-analyze
Startup finished in 1.152s (kernel) + 3.901s (userspace) = 5.054s 
graphical.target reached after 3.892s in userspace.
### critical-chain graphical.target
The time when unit became active or started is printed after the "@" character.
The time the unit took to start is printed after the "+" character.

graphical.target @3.892s
└─multi-user.target @3.892s
  └─getty.target @3.892s
    └─serial-getty@ttyS0.service @3.892s
      └─plymouth-quit-wait.service @1.634s +2.249s
        └─systemd-user-sessions.service @1.626s +5ms
          └─network.target @1.618s
            └─NetworkManager.service @1.246s +372ms
              └─dbus.service @1.212s +21ms
                └─basic.target @1.204s
                  └─sockets.target @1.204s
                    └─ssh.socket @1.204s
                      └─sysinit.target @1.192s
                        └─systemd-resolved.service @537ms +654ms
                          └─systemd-tmpfiles-setup.service @500ms +26ms
                            └─systemd-journal-flush.service @425ms +67ms
                              └─var-log-journal.mount @383ms +13ms
                                └─data.mount @332ms +9ms
                                  └─systemd-fsck@dev-disk-by\x2dlabel-box\x2ddata.service @309ms +21ms
                                    └─dev-disk-by\x2dlabel-box\x2ddata.device @283ms
### blame top 15
2.249s plymouth-quit-wait.service
2.037s box-confirm.service
 731ms systemd-binfmt.service
 725ms box-droid.service
 654ms systemd-resolved.service
 640ms systemd-timesyncd.service
 372ms NetworkManager.service
 233ms dev-vda3.device
 181ms NetworkManager-wait-online.service
 130ms apparmor.service
 116ms user@105.service
 113ms udisks2.service
 107ms accounts-daemon.service
 106ms user@1000.service
  99ms systemd-udev-trigger.service
### uptime
 14:38:18 up 0 min,  2 users,  load average: 0.10, 0.03, 0.01
### running services
26
```

### gurtos-boot2

```
### os-release
PRETTY_NAME="GurtOS Personal 0.1.0-preview"
VERSION_ID="0.1.0-preview"
6.8.0-147-generic
4
### systemd-analyze
Startup finished in 1.200s (kernel) + 4.450s (userspace) = 5.651s 
graphical.target reached after 4.437s in userspace.
### critical-chain graphical.target
The time when unit became active or started is printed after the "@" character.
The time the unit took to start is printed after the "+" character.

graphical.target @4.437s
└─multi-user.target @4.436s
  └─getty.target @4.436s
    └─serial-getty@ttyS0.service @4.436s
      └─plymouth-quit-wait.service @1.734s +2.691s
        └─systemd-user-sessions.service @1.714s +7ms
          └─network.target @1.707s
            └─NetworkManager.service @1.311s +395ms
              └─dbus.service @1.273s +27ms
                └─basic.target @1.267s
                  └─sockets.target @1.267s
                    └─ssh.socket @1.266s
                      └─sysinit.target @1.250s
                        └─systemd-resolved.service @617ms +632ms
                          └─systemd-tmpfiles-setup.service @590ms +23ms
                            └─systemd-journal-flush.service @498ms +83ms
                              └─var-log-journal.mount @446ms +25ms
                                └─data.mount @389ms +9ms
                                  └─systemd-fsck@dev-disk-by\x2dlabel-box\x2ddata.service @354ms +31ms
                                    └─dev-disk-by\x2dlabel-box\x2ddata.device @351ms
### blame top 15
2.691s plymouth-quit-wait.service
2.043s box-confirm.service
 935ms box-droid.service
 702ms systemd-binfmt.service
 632ms systemd-resolved.service
 605ms systemd-timesyncd.service
 395ms NetworkManager.service
 261ms dev-vda3.device
 158ms NetworkManager-wait-online.service
 130ms udisks2.service
 126ms user@105.service
 122ms apparmor.service
 113ms accounts-daemon.service
 106ms user@1000.service
 104ms systemd-udev-trigger.service
### uptime
 14:52:32 up 0 min,  2 users,  load average: 0.19, 0.05, 0.01
### running services
26
```

### ubuntu-boot0

```
### os-release
PRETTY_NAME="Ubuntu 24.04.5 LTS"
VERSION_ID="24.04"
7.0.0-38-generic
4
### systemd-analyze
Startup finished in 2.328s (kernel) + 12.408s (userspace) = 14.736s 
graphical.target reached after 12.090s in userspace.
### critical-chain graphical.target
The time when unit became active or started is printed after the "@" character.
The time the unit took to start is printed after the "+" character.

graphical.target @12.090s
└─multi-user.target @12.090s
  └─snapd.seeded.service @3.414s +8.675s
    └─basic.target @3.387s
      └─sockets.target @3.387s
        └─snapd.socket @3.382s +4ms
          └─sysinit.target @3.379s
            └─snapd.apparmor.service @1.752s +1.626s
              └─apparmor.service @400ms +1.339s
                └─local-fs.target @391ms
                  └─run-snapd-ns-snapd\x2ddesktop\x2dintegration.mnt.mount @10.524s
                    └─run-snapd-ns.mount @5.573s
                      └─local-fs-pre.target @359ms
                        └─systemd-tmpfiles-setup-dev.service @352ms +7ms
                          └─systemd-sysusers.service @277ms +69ms
                            └─systemd-tmpfiles-setup-dev-early.service @232ms +36ms
                              └─kmod-static-nodes.service @212ms +14ms
                                └─systemd-journald.socket @203ms
                                  └─-.mount @189ms
                                    └─-.slice @189ms
### blame top 15
8.675s snapd.seeded.service
3.273s plymouth-quit-wait.service
1.629s snapd.service
1.626s snapd.apparmor.service
1.436s cloud-init.service
1.339s apparmor.service
1.179s cloud-config.service
1.021s cloud-init-local.service
 856ms systemd-resolved.service
 844ms systemd-oomd.service
 838ms systemd-binfmt.service
 828ms systemd-timesyncd.service
 745ms ssl-cert.service
 521ms dev-loop8.device
 520ms dev-loop9.device
### uptime
 15:26:19 up 4 min,  2 users,  load average: 0.30, 0.22, 0.10
### running services
34
```

### ubuntu-boot1

```
### os-release
PRETTY_NAME="Ubuntu 24.04.5 LTS"
VERSION_ID="24.04"
7.0.0-38-generic
4
### systemd-analyze
Startup finished in 3.255s (kernel) + 16.883s (userspace) = 20.139s 
graphical.target reached after 16.779s in userspace.
### critical-chain graphical.target
The time when unit became active or started is printed after the "@" character.
The time the unit took to start is printed after the "+" character.

graphical.target @16.779s
└─multi-user.target @16.779s
  └─plymouth-quit-wait.service @7.753s +9.024s
    └─systemd-user-sessions.service @7.690s +35ms
      └─network.target @7.675s
        └─NetworkManager.service @5.632s +2.043s
          └─dbus.service @4.880s +743ms
            └─basic.target @4.868s
              └─sockets.target @4.868s
                └─snapd.socket @4.843s +23ms
                  └─sysinit.target @4.815s
                    └─snapd.apparmor.service @4.447s +367ms
                      └─apparmor.service @3.672s +755ms
                        └─local-fs.target @3.660s
                          └─run-snapd-ns-snapd\x2ddesktop\x2dintegration.mnt.mount @10.905s
                            └─run-snapd-ns.mount @10.394s
                              └─local-fs-pre.target @3.452s
                                └─systemd-tmpfiles-setup-dev.service @3.444s +8ms
                                  └─systemd-tmpfiles-setup-dev-early.service @3.166s +268ms
                                    └─kmod-static-nodes.service @3.117s +40ms
                                      └─systemd-journald.socket @3.097s
                                        └─system.slice @3.071s
                                          └─-.slice @3.071s
### blame top 15
9.024s plymouth-quit-wait.service
2.043s NetworkManager.service
1.880s apport.service
1.223s user@120.service
1.118s snapd.seeded.service
1.090s dev-vda2.device
1.073s udisks2.service
 998ms snapd.service
 895ms accounts-daemon.service
 892ms gnome-remote-desktop.service
 833ms power-profiles-daemon.service
 818ms polkit.service
 771ms dev-loop9.device
 769ms dev-loop8.device
 755ms apparmor.service
### uptime
 15:27:19 up 0 min,  2 users,  load average: 0.81, 0.24, 0.08
### running services
37
```

### ubuntu-boot2

```
### os-release
PRETTY_NAME="Ubuntu 24.04.5 LTS"
VERSION_ID="24.04"
7.0.0-38-generic
4
### systemd-analyze
Startup finished in 3.421s (kernel) + 14.784s (userspace) = 18.206s 
graphical.target reached after 14.665s in userspace.
### critical-chain graphical.target
The time when unit became active or started is printed after the "@" character.
The time the unit took to start is printed after the "+" character.

graphical.target @14.665s
└─multi-user.target @14.665s
  └─plymouth-quit-wait.service @7.378s +7.287s
    └─systemd-user-sessions.service @7.368s +7ms
      └─network.target @7.359s
        └─NetworkManager.service @5.011s +2.348s
          └─dbus.service @4.050s +953ms
            └─basic.target @4.019s
              └─sockets.target @4.019s
                └─snapd.socket @3.985s +17ms
                  └─sysinit.target @3.967s
                    └─snapd.apparmor.service @3.513s +453ms
                      └─apparmor.service @2.771s +720ms
                        └─systemd-sysctl.service @2.536s +223ms
                          └─systemd-modules-load.service @2.188s +347ms
                            └─systemd-journald.socket @2.137s
                              └─system.slice @2.110s
                                └─-.slice @2.110s
### blame top 15
7.287s plymouth-quit-wait.service
2.348s NetworkManager.service
1.269s udisks2.service
1.207s snapd.seeded.service
1.151s gnome-remote-desktop.service
1.069s snapd.service
1.065s accounts-daemon.service
1.058s power-profiles-daemon.service
1.047s polkit.service
 975ms dev-vda2.device
 965ms avahi-daemon.service
 953ms dbus.service
 867ms user@120.service
 828ms apport.service
 798ms ModemManager.service
### uptime
 15:37:22 up 0 min,  2 users,  load average: 0.20, 0.06, 0.02
### running services
38
```

### gurtos-idle1

```
### date 14:40:39 uptime up 2 minutes
### free -m
               total        used        free      shared  buff/cache   available
Mem:            3915         902        2002          38        1268        3012
Swap:              0           0           0
### top -bn3 -d5 (3rd sample is the idle reading)
top - 14:40:39 up 2 min,  2 users,  load average: 0.12, 0.08, 0.02
%Cpu(s):  0.0 us,  2.3 sy,  0.0 ni, 95.5 id,  2.3 wa,  0.0 hi,  0.0 si,  0.0 st 
top - 14:40:44 up 3 min,  2 users,  load average: 0.11, 0.07, 0.02
%Cpu(s):  0.1 us,  0.1 sy,  0.0 ni, 99.7 id,  0.0 wa,  0.0 hi,  0.0 si,  0.1 st 
top - 14:40:49 up 3 min,  2 users,  load average: 0.10, 0.07, 0.02
%Cpu(s):  0.1 us,  0.1 sy,  0.0 ni, 99.6 id,  0.0 wa,  0.0 hi,  0.0 si,  0.1 st 
### mpstat-like: loadavg
0.10 0.07 0.02 1/425 2320
### top 10 by RSS
  RSS %CPU     PID USER     COMMAND
318592 1.0    1820 anatest  gnome-shell
154852 0.8     715 root     MainThread
122920 0.8     658 root     spacetimedb-sta
51000  0.1    2198 anatest  xdg-desktop-por
27244  0.0    2107 anatest  tracker-miner-f
27020  0.0    1910 anatest  gjs
26976  0.0    2115 anatest  gjs
24452  0.0    1944 anatest  gsd-media-keys
24452  0.0    2213 anatest  xdg-desktop-por
23552  0.0    1945 anatest  gsd-power
### processes total
192
### RSS by user (MB)
     906 anatest
     449 root
      20 systemd+
      14 colord
      10 polkitd
       6 message+
### df
Filesystem     1M-blocks  Used Available Use% Mounted on
/dev/vda3         11992M 4635M     6726M  41% /
/dev/vda2           511M    9M      503M   2% /boot/efi
/dev/vda5         23513M  996M    21298M   5% /data
/dev/vda5         23513M  996M    21298M   5% /var/lib/box
### smem-ish: Pss total
### Pss
awk: cannot open "/proc/10/smaps_rollup" (No such process)
Pss total MB: 794.752
### box/gurtos processes
154852 0.7     715 root     /usr/local/bin/node --experimental-strip-types --disable-warning=ExperimentalWarning /opt/box/core/box.ts
122920 0.8     658 root     /root/.local/share/spacetime/bin/2.13.0/spacetimedb-standalone start --data-dir /root/.local/share/spacetime/data --jwt-ke
27020  0.0    1910 anatest  /usr/bin/gjs -m /usr/share/gnome-shell/org.gnome.Shell.Notifications
26976  0.0    2115 anatest  /usr/bin/gjs -m /usr/share/gnome-shell/org.gnome.ScreenSaver
18356  0.0    1783 anatest  /usr/libexec/gnome-session-binary --systemd-service --session=gurtos
16744  0.0    1722 anatest  /usr/libexec/gnome-session-binary --session=gurtos
 6364  0.0    1717 anatest  /usr/libexec/gdm-wayland-session env GNOME_SHELL_SESSION_MODE=gurtos XDG_CONFIG_DIRS=/etc/xdg/gurtos:/etc/xdg /usr/bin/gno
 2132  0.0    2194 root     fusermount3 -o rw,nosuid,nodev,fsname=portal,auto_unmount,subtype=portal -- /run/user/1000/doc
    0  0.1      25 root     [kworker/1:0-inode_switch_wbs]
### box RSS sum MB
323.992
### systemd units box
  box-owner.path        loaded active waiting Watch for the first account on this computer
  box-confirm.service   loaded active exited  Check the box is healthy, then keep or roll back a system update
  box-droid.service     loaded active exited  Download the Droid CLI for agent tasks
  box-firstboot.service loaded active exited  First-boot setup: the box's own identity and vault
  box.service           loaded active running The box: agent tasks, each as its own user in its own copy
  spacetimedb.service   loaded active running SpacetimeDB for the box
  app-gnome-at\x2dspi\x2ddbus\x2dbus-1817.scope       loaded active running Application launched by gnome-sess
  app-gnome-spice\x2dvdagent-1935.scope               loaded active running Application launched by gnome-sess
  init.scope                                          loaded active running System and Service Manager
  dbus.service                                        loaded active running D-Bus User Message Bus
  dconf.service                                       loaded active running User preferences database
  filter-chain.service                                loaded active running PipeWire filter chain daemon
  gcr-ssh-agent.service                               loaded active running GCR ssh-agent wrapper
  gnome-keyring-daemon.service                        loaded active running GNOME Keyring daemon
  gnome-session-manager@gurtos.service                loaded active running GNOME Session Manager (session: gu
  gnome-session-monitor.service                       loaded active running Monitor Session leader for GNOME S
  gvfs-daemon.service                                 loaded active running Virtual filesystem service
  gvfs-metadata.service                               loaded active running Virtual filesystem metadata servic
  gvfs-udisks2-volume-monitor.service                 loaded active running Virtual filesystem service - disk 
  org.gnome.SettingsDaemon.A11ySettings.service       loaded active running GNOME accessibility service
  org.gnome.SettingsDaemon.Color.service              loaded active running GNOME color management service
  org.gnome.SettingsDaemon.Datetime.service           loaded active running GNOME date & time service
  org.gnome.SettingsDaemon.Housekeeping.service       loaded active running GNOME maintenance of expirable dat
  org.gnome.SettingsDaemon.Keyboard.service           loaded active running GNOME keyboard configuration servi
  org.gnome.SettingsDaemon.MediaKeys.service          loaded active running GNOME keyboard shortcuts service
  org.gnome.SettingsDaemon.Power.service              loaded active running GNOME power management service
  org.gnome.SettingsDaemon.PrintNotifications.service loaded active running GNOME printer notifications servic
  org.gnome.SettingsDaemon.Rfkill.service             loaded active running GNOME RFKill support service
  org.gnome.SettingsDaemon.ScreensaverProxy.service   loaded active running GNOME FreeDesktop screensaver serv
  org.gnome.SettingsDaemon.Sharing.service            loaded active running GNOME file sharing service
  org.gnome.SettingsDaemon.Smartcard.service          loaded active running GNOME smartcard service
  org.gnome.SettingsDaemon.Sound.service              loaded active running GNOME sound sample caching service
  org.gnome.SettingsDaemon.Wacom.service              loaded active running GNOME Wacom tablet support service
  org.gnome.Shell@wayland.service                     loaded active running GNOME Shell on Wayland
  pipewire-pulse.service                              loaded active running PipeWire PulseAudio
  pipewire.service                                    loaded active running PipeWire Multimedia Service
  tracker-miner-fs-3.service                          loaded active running Tracker file system data miner
  wireplumber.service                                 loaded active running Multimedia Service Session Manager
  xdg-desktop-portal-gnome.service                    loaded active running Portal service (GNOME implementati
  xdg-desktop-portal-gtk.service                      loaded active running Portal service (GTK/GNOME implemen
  xdg-desktop-portal.service                          loaded active running Portal service
  xdg-document-portal.service                         loaded active running flatpak document portal service
  xdg-permission-store.service                        loaded active running sandboxed app permission store
  dbus.socket                                         loaded active running D-Bus User Message Bus Socket
  gcr-ssh-agent.socket                                loaded active running GCR ssh-agent wrapper
  gnome-keyring-daemon.socket                         loaded active running GNOME Keyring daemon
  pipewire-pulse.socket                               loaded active running PipeWire PulseAudio
  pipewire.socket                                     loaded active running PipeWire Multimedia System Sockets
```

### gurtos-idle2

```
### date 14:54:44 uptime up 2 minutes
### free -m
               total        used        free      shared  buff/cache   available
Mem:            3915         903        1982          38        1287        3011
Swap:              0           0           0
### top -bn3 -d5 (3rd sample is the idle reading)
top - 14:54:44 up 2 min,  2 users,  load average: 0.03, 0.04, 0.01
%Cpu(s):  0.0 us,  0.0 sy,  0.0 ni,100.0 id,  0.0 wa,  0.0 hi,  0.0 si,  0.0 st 
top - 14:54:49 up 2 min,  2 users,  load average: 0.03, 0.04, 0.01
%Cpu(s):  0.0 us,  0.1 sy,  0.0 ni, 99.8 id,  0.0 wa,  0.0 hi,  0.0 si,  0.0 st 
top - 14:54:54 up 2 min,  2 users,  load average: 0.02, 0.04, 0.01
%Cpu(s):  0.1 us,  0.1 sy,  0.0 ni, 99.8 id,  0.0 wa,  0.0 hi,  0.0 si,  0.0 st 
### mpstat-like: loadavg
0.02 0.04 0.01 1/426 2173
### top 10 by RSS
  RSS %CPU     PID USER     COMMAND
318368 1.0    1701 anatest  gnome-shell
153032 0.9     714 root     MainThread
119596 0.8     660 root     spacetimedb-sta
51184  0.1    2091 anatest  xdg-desktop-por
27296  0.0    2035 anatest  tracker-miner-f
27040  0.0    1787 anatest  gjs
26992  0.0    2040 anatest  gjs
24584  0.0    1821 anatest  gsd-media-keys
24424  0.0    2106 anatest  xdg-desktop-por
23512  0.0    1822 anatest  gsd-power
### processes total
194
### RSS by user (MB)
     909 anatest
     444 root
      20 systemd+
      15 colord
      10 polkitd
       6 message+
### df
Filesystem     1M-blocks  Used Available Use% Mounted on
/dev/vda3         11992M 4636M     6726M  41% /
/dev/vda2           511M    9M      503M   2% /boot/efi
/dev/vda5         23513M 1029M    21265M   5% /data
/dev/vda5         23513M 1029M    21265M   5% /var/lib/box
Pss total MB: 790.086
```

### ubuntu-idle1

```
### date 15:29:40 uptime up 3 minutes
### free -m
               total        used        free      shared  buff/cache   available
Mem:            3910        1156        1676          67        1368        2754
Swap:           3909           0        3909
### top -bn3 -d5 (3rd sample is the idle reading)
top - 15:29:41 up 3 min,  2 users,  load average: 0.20, 0.24, 0.10
%Cpu(s):  0.0 us,  2.3 sy,  0.0 ni, 97.7 id,  0.0 wa,  0.0 hi,  0.0 si,  0.0 st 
top - 15:29:46 up 3 min,  2 users,  load average: 0.18, 0.24, 0.10
%Cpu(s):  0.2 us,  0.1 sy,  0.0 ni, 99.7 id,  0.0 wa,  0.0 hi,  0.0 si,  0.0 st 
top - 15:29:51 up 3 min,  2 users,  load average: 0.17, 0.23, 0.10
%Cpu(s):  0.0 us,  0.0 sy,  0.0 ni, 99.9 id,  0.0 wa,  0.0 hi,  0.0 si,  0.0 st 
### mpstat-like: loadavg
0.17 0.23 0.10 1/567 2862
### top 10 by RSS
  RSS %CPU     PID USER     COMMAND
409072 2.1    1932 anatest  gnome-shell
207116 13.2   2724 anatest  update-manager
66084  0.1    2488 anatest  gjs
64740  0.1    2098 anatest  evolution-alarm
47136  0.1     775 root     snapd
43424  0.0    2025 anatest  evolution-sourc
41964  0.0    2467 anatest  xdg-desktop-por
36056  0.1    2601 anatest  snapd-desktop-i
31468  0.0    2670 anatest  update-notifier
30916  0.0    2322 anatest  evolution-addre
### processes total
228
### RSS by user (MB)
    1669 anatest
     283 root
      29 systemd+
      20 cups-br+
      17 gnome-r+
      15 colord
      12 polkitd
       7 message+
### df
Filesystem     1M-blocks   Used Available Use% Mounted on
/dev/vda2         48070M 10194M    35403M  23% /
Pss total MB: 1007.26
```

### ubuntu-idle2

```
### date 15:39:28 uptime up 2 minutes
### free -m
               total        used        free      shared  buff/cache   available
Mem:            3910        1047        1901          64        1249        2863
Swap:           3909           0        3909
### top -bn3 -d5 (3rd sample is the idle reading)
top - 15:39:29 up 2 min,  2 users,  load average: 0.12, 0.13, 0.05
%Cpu(s):  2.3 us,  0.0 sy,  0.0 ni, 97.7 id,  0.0 wa,  0.0 hi,  0.0 si,  0.0 st 
top - 15:39:34 up 2 min,  2 users,  load average: 0.11, 0.12, 0.05
%Cpu(s):  0.0 us,  0.0 sy,  0.0 ni, 99.9 id,  0.0 wa,  0.0 hi,  0.0 si,  0.0 st 
top - 15:39:39 up 3 min,  2 users,  load average: 0.10, 0.12, 0.05
%Cpu(s):  0.0 us,  0.0 sy,  0.0 ni,100.0 id,  0.0 wa,  0.0 hi,  0.0 si,  0.0 st 
### mpstat-like: loadavg
0.10 0.12 0.05 1/559 2742
### top 10 by RSS
  RSS %CPU     PID USER     COMMAND
390096 1.7    1949 anatest  gnome-shell
66424  0.1    2478 anatest  gjs
64748  0.1    2119 anatest  evolution-alarm
44968  0.1     780 root     snapd
43440  0.0    2041 anatest  evolution-sourc
41928  0.0    2511 anatest  xdg-desktop-por
36636  0.2    2615 anatest  snapd-desktop-i
31380  0.0    2683 anatest  update-notifier
30824  0.0    2328 anatest  evolution-addre
29292  0.0    2387 anatest  tracker-miner-f
### processes total
227
### RSS by user (MB)
    1448 anatest
     281 root
      29 systemd+
      20 cups-br+
      17 gnome-r+
      15 colord
      12 polkitd
       7 message+
### df
Filesystem     1M-blocks   Used Available Use% Mounted on
/dev/vda2         48070M 10273M    35324M  23% /
Pss total MB: 833.047
```

### Reboot, login, launch (JSON)

```
gurtos-reboot1.json {"reboot_cmd_returned_s": 0.2, "greeter_s": 11.9, "ssh_s": 12.4}
gurtos-reboot2.json {"reboot_cmd_returned_s": 0.0, "greeter_s": 11.4, "ssh_s": 11.8}
ubuntu-reboot1.json {"reboot_cmd_returned_s": 0.0, "greeter_s": 29.0, "ssh_s": 3.0}
ubuntu-reboot2.json {"reboot_cmd_returned_s": 0.0, "greeter_s": 26.5, "ssh_s": 3.0}
gurtos-login-cold2.json {"first_change_s": 1.57, "stable_at_s": 1.71, "total_s": 4.22}
gurtos-login-cold3.json {"first_change_s": 1.62, "stable_at_s": 1.77, "total_s": 4.28}
ubuntu-login-cold2.json {"first_change_s": 0.1, "stable_at_s": 3.4, "total_s": 5.91}
ubuntu-login-cold3.json {"first_change_s": 2.46, "stable_at_s": 3.11, "total_s": 5.62}
# gurtos-launch.jsonl
boot3-cold files cold {"noise": 0.0, "first_change_s": 1.26, "settled_s": 1.5, "frames": 135}
boot3-cold files warm1 {"noise": 0.0, "first_change_s": 0.67, "settled_s": 0.85, "frames": 104}
boot3-cold files warm2 {"noise": 0.0, "first_change_s": 0.64, "settled_s": 0.83, "frames": 107}
boot3-cold settings cold {"noise": 0.0, "first_change_s": 6.04, "settled_s": 6.07, "frames": 143}
boot3-cold settings warm1 {"noise": 0.0, "first_change_s": 0.6, "settled_s": 0.65, "frames": 95}
boot3-cold settings warm2 {"noise": 0.0, "first_change_s": 0.61, "settled_s": 0.64, "frames": 93}
boot3-cold terminal cold {"noise": 0.0, "first_change_s": 0.6, "settled_s": 0.62, "frames": 93}
boot3-cold terminal warm1 {"noise": 0.0, "first_change_s": 0.6, "settled_s": 0.62, "frames": 86}
boot3-cold terminal warm2 {"noise": 0.0, "first_change_s": 0.55, "settled_s": 0.57, "frames": 87}
boot3-cold browser cold {"noise": 0.0, "first_change_s": 0.97, "settled_s": 0.99, "frames": 112}
boot3-cold browser warm1 {"noise": 0.0, "first_change_s": 0.59, "settled_s": 0.92, "frames": 106}
boot3-cold browser warm2 {"noise": 0.0, "first_change_s": 0.59, "settled_s": 0.88, "frames": 102}
boot3-cold editor cold {"noise": 0.0, "first_change_s": 0.71, "settled_s": 0.73, "frames": 99}
boot3-cold editor warm1 {"noise": 0.0, "first_change_s": 0.6, "settled_s": 0.62, "frames": 92}
boot3-cold editor warm2 {"noise": 0.0, "first_change_s": 0.65, "settled_s": 0.67, "frames": 94}
firefox-snap-installed firefox cold {"noise": 0.0, "first_change_s": null, "settled_s": null, "frames": 3056}
firefox-snap-installed firefox warm1 {"noise": 0.0, "first_change_s": null, "settled_s": null, "frames": 3225}
firefox-snap-installed firefox warm2 {"noise": 0.0, "first_change_s": null, "settled_s": null, "frames": 3106}
# gurtos-launch-warm-after-reboot2.jsonl
boot2-unlocked files cold {"noise": 0.0, "first_change_s": 0.68, "settled_s": 0.86, "frames": 102}
boot2-unlocked files warm1 {"noise": 0.0, "first_change_s": 0.72, "settled_s": 0.93, "frames": 106}
boot2-unlocked files warm2 {"noise": 0.0, "first_change_s": 0.7, "settled_s": 0.89, "frames": 103}
boot2-unlocked settings cold {"noise": 0.0, "first_change_s": 0.68, "settled_s": 0.73, "frames": 96}
boot2-unlocked settings warm1 {"noise": 0.0, "first_change_s": 0.71, "settled_s": 0.74, "frames": 93}
boot2-unlocked settings warm2 {"noise": 0.0, "first_change_s": 0.61, "settled_s": 0.66, "frames": 99}
boot2-unlocked terminal cold {"noise": 0.0, "first_change_s": 0.57, "settled_s": 0.59, "frames": 89}
boot2-unlocked terminal warm1 {"noise": 0.0, "first_change_s": 0.56, "settled_s": 0.57, "frames": 84}
boot2-unlocked terminal warm2 {"noise": 0.0, "first_change_s": 0.58, "settled_s": 0.6, "frames": 86}
boot2-unlocked browser cold {"noise": 0.0, "first_change_s": 0.61, "settled_s": 0.93, "frames": 105}
boot2-unlocked browser warm1 {"noise": 0.0, "first_change_s": 0.58, "settled_s": 0.91, "frames": 106}
boot2-unlocked browser warm2 {"noise": 0.0, "first_change_s": 0.74, "settled_s": 1.06, "frames": 94}
boot2-unlocked editor cold {"noise": 0.0, "first_change_s": 0.61, "settled_s": 0.66, "frames": 54}
boot2-unlocked editor warm1 {"noise": 0.0, "first_change_s": 0.62, "settled_s": 0.64, "frames": 93}
boot2-unlocked editor warm2 {"noise": 0.0, "first_change_s": 0.61, "settled_s": 0.63, "frames": 92}
# ubuntu-launch.jsonl
boot2-cold files cold {"noise": 0.0, "first_change_s": 2.8, "settled_s": 3.16, "frames": 155}
boot2-cold files warm1 {"noise": 0.0, "first_change_s": 0.41, "settled_s": 0.56, "frames": 86}
boot2-cold files warm2 {"noise": 0.0, "first_change_s": 0.4, "settled_s": 0.54, "frames": 87}
boot2-cold settings cold {"noise": 0.0, "first_change_s": 0.67, "settled_s": 0.69, "frames": 93}
boot2-cold settings warm1 {"noise": 0.0, "first_change_s": 0.43, "settled_s": 0.45, "frames": 81}
boot2-cold settings warm2 {"noise": 0.0, "first_change_s": 0.44, "settled_s": 0.46, "frames": 78}
boot2-cold terminal cold {"noise": 0.0, "first_change_s": 0.52, "settled_s": 0.54, "frames": 76}
boot2-cold terminal warm1 {"noise": 0.0, "first_change_s": 0.43, "settled_s": 0.45, "frames": 74}
boot2-cold terminal warm2 {"noise": 0.0, "first_change_s": 0.42, "settled_s": 0.44, "frames": 75}
boot2-cold browser cold {"noise": 0.0, "first_change_s": null, "settled_s": null, "frames": 2833}
boot2-cold browser warm1 {"noise": 0.0, "first_change_s": null, "settled_s": null, "frames": 3111}
boot2-cold browser warm2 {"noise": 0.0, "first_change_s": null, "settled_s": null, "frames": 3509}
boot2-cold editor cold {"noise": 0.0, "first_change_s": 0.67, "settled_s": 0.69, "frames": 92}
boot2-cold editor warm1 {"noise": 0.0, "first_change_s": 0.44, "settled_s": 0.46, "frames": 78}
boot2-cold editor warm2 {"noise": 0.0, "first_change_s": 0.89, "settled_s": 0.9, "frames": 26}
firefox-dock-click cold {"noise": 0.0, "first_change_s": 2.7, "settled_s": 4.86, "frames": 309}
firefox-dock-click warm1 {"noise": 0.0, "first_change_s": 1.56, "settled_s": 3.16, "frames": 208}
firefox-dock-click warm2 {"noise": 0.0, "first_change_s": 1.5, "settled_s": 2.52, "frames": 174}
boot3-cold files cold {"noise": 0.0, "first_change_s": 1.22, "settled_s": 1.47, "frames": 141}
boot3-cold files warm1 {"noise": 0.0, "first_change_s": 0.44, "settled_s": 0.62, "frames": 89}
boot3-cold files warm2 {"noise": 0.0, "first_change_s": 0.41, "settled_s": 0.58, "frames": 89}
boot3-cold settings cold {"noise": 0.0, "first_change_s": 0.67, "settled_s": 0.68, "frames": 93}
boot3-cold settings warm1 {"noise": 0.0, "first_change_s": 0.45, "settled_s": 0.47, "frames": 81}
boot3-cold settings warm2 {"noise": 0.0, "first_change_s": 0.45, "settled_s": 0.47, "frames": 81}
boot3-cold terminal cold {"noise": 0.0, "first_change_s": 0.48, "settled_s": 0.5, "frames": 80}
boot3-cold terminal warm1 {"noise": 0.0, "first_change_s": 0.4, "settled_s": 0.42, "frames": 78}
boot3-cold terminal warm2 {"noise": 0.0, "first_change_s": 0.39, "settled_s": 0.43, "frames": 70}
boot3-cold editor cold {"noise": 0.0, "first_change_s": 0.54, "settled_s": 0.55, "frames": 85}
boot3-cold editor warm1 {"noise": 0.0, "first_change_s": 0.45, "settled_s": 0.47, "frames": 78}
boot3-cold editor warm2 {"noise": 0.0, "first_change_s": 0.45, "settled_s": 0.46, "frames": 80}
boot3-cold firefox-dock-click cold {"noise": 0.0, "first_change_s": 3.11, "settled_s": 4.76, "frames": 305}
boot3-cold firefox-dock-click warm1 {"noise": 0.0, "first_change_s": 1.41, "settled_s": 2.81, "frames": 165}
boot3-cold firefox-dock-click warm2 {"noise": 0.0, "first_change_s": 1.33, "settled_s": 2.79, "frames": 184}
```

### gurtos-install-vlc

```
ls: cannot access '/usr/libexec/goa-daemon': No such file or directory
ls: cannot access '/usr/libexec/goa-identity-service': No such file or directory
real	0m1.111s
real	0m21.137s
/dev/vda3         11992M 5012M     6350M  45% /
/usr/bin/vlc
```

### gurtos-install-firefox

```
Setting up firefox (1:1snap1-0ubuntu5) ...
Processing triggers for man-db (2.12.0-4build2) ...
Processing triggers for dbus (1.14.10-4ubuntu4.1) ...
Processing triggers for desktop-file-utils (0.27-2build1) ...
Processing triggers for hicolor-icon-theme (0.17-2) ...
Processing triggers for gnome-menus (3.36.0-1.1ubuntu3) ...

real	1m12.581s
user	0m3.570s
sys	0m1.488s
Name               Version                         Rev    Tracking       Publisher    Notes
bare               1.0                             5      latest/stable  canonical**  base
core24             20260824                        2124   latest/stable  canonical**  base
firefox            158.0.1-1                       9113   latest/stable  mozilla**    -
/dev/vda3         11992M 6667M     4694M  59% /
```

### ubuntu-install-vlc

```
vlc 3.0.24-rc1 from VideoLAN** installed
real	0m45.275s
name:      spotify
summary:   Music for everyone
publisher: Spotify**
store-url: https://snapcraft.io/spotify
/dev/vda2         48070M 12223M    33374M  27% /
```

### gurtos-inspect

```

##### os
PRETTY_NAME="GurtOS Personal 0.1.0-preview"
ID=gurtos
ID_LIKE=ubuntu
6.8.0-147-generic
desktop session: GurtOS:ubuntu:GNOME wayland gurtos 

##### swap / memory
swap lines: 1
MemTotal:        4009156 kB
SwapTotal:             0 kB

##### package managers
apt                      /usr/bin/apt
snap                     -
flatpak                  -
gnome-software           -
snap-store               -
update-manager           /usr/bin/update-manager
software-properties-gtk  /usr/bin/software-properties-gtk
unattended-upgrade       -
fwupdmgr                 -
ubuntu-drivers           /usr/bin/ubuntu-drivers
orca                     -
ibus                     -
cups                     -
lpstat                   -
powerprofilesctl         -
bluetoothctl             /usr/bin/bluetoothctl
nmcli                    /usr/bin/nmcli
wpctl                    /usr/bin/wpctl
pactl                    -
gst-inspect-1.0          /usr/bin/gst-inspect-1.0
ufw                      -
nft                      /usr/sbin/nft
ssh                      /usr/bin/ssh
gnome-screenshot         -
gnome-disks              -
baobab                   -
seahorse                 -
evolution                -
firefox                  -
thunderbird              -
libreoffice              -
vlc                      -
totem                    -
loupe                    -
eog                      /usr/bin/eog
evince                   /usr/bin/evince
papers                   -
gnome-calendar           -
gnome-contacts           -
simple-scan              -

##### apt sources
deb http://archive.ubuntu.com/ubuntu noble main universe
deb http://archive.ubuntu.com/ubuntu noble-updates main universe
deb http://archive.ubuntu.com/ubuntu noble-security main universe

##### unattended / periodic
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Download-Upgradeable-Packages "0";
APT::Periodic::AutocleanInterval "0";
Sat 2026-10-24 15:07:10 EDT     9min -                                 - systemd-tmpfiles-clean.timer   systemd-tmpfiles-clean.service
Sat 2026-10-24 15:34:38 EDT    36min Sat 2026-10-24 14:30:57 EDT       - anacron.timer                  anacron.service
Sat 2026-10-24 22:32:57 EDT       7h Sat 2026-10-24 14:13:13 EDT       - apt-daily.timer                apt-daily.service
Sat 2026-10-24 23:11:37 EDT       8h Sat 2026-10-24 14:13:13 EDT       - motd-news.timer                motd-news.service
Sun 2026-10-25 00:00:00 EDT       9h Sat 2026-10-24 14:13:13 EDT       - dpkg-db-backup.timer           dpkg-db-backup.service
Sun 2026-10-25 03:10:38 EDT      12h Sat 2026-10-24 14:13:13 EDT       - e2scrub_all.timer              e2scrub_all.service
Sun 2026-10-25 06:19:23 EDT      15h Sat 2026-10-24 14:13:13 EDT       - apt-daily-upgrade.timer        apt-daily-upgrade.service
Sun 2026-10-25 10:01:12 EDT      19h Sat 2026-10-24 14:13:13 EDT       - man-db.timer                   man-db.service
Sun 2026-10-25 14:57:12 EDT      23h Sat 2026-10-24 14:57:12 EDT 41s ago update-notifier-download.timer update-notifier-download.service
Mon 2026-10-26 00:35:06 EDT 1 day 9h Sat 2026-10-24 14:13:13 EDT       - fstrim.timer                   fstrim.service
Thu 2026-10-29 23:26:17 EDT   5 days Sat 2026-10-24 14:13:13 EDT       - update-notifier-motd.timer     update-notifier-motd.service

##### snap
/home/anatest/inspect.sh: line 8: snap: command not found

##### apt policy
vlc:
  Candidate: 3.0.20-3build6
firefox:
  Candidate: 1:1snap1-0ubuntu5

##### gnome-control-center panels
about applications background bluetooth color datetime display keyboard mouse multitasking network notifications online-accounts power printers privacy region search sharing sound system ubuntu universal-access users wacom wifi wwan 


##### GUI apps (visible .desktop)
Additional Drivers | software-properties-drivers.desktop
Calculator | org.gnome.Calculator.desktop
Console | org.gnome.Console.desktop
Document Viewer | org.gnome.Evince.desktop
Files | org.gnome.Nautilus.desktop
Find | dev.box.Find.desktop
GNOME System Monitor | gnome-system-monitor-kde.desktop
GurtOS | dev.box.Box.desktop
GurtOS Settings | dev.box.Settings.desktop
Help | yelp.desktop
Image Viewer | org.gnome.eog.desktop
Language Support | gnome-language-selector.desktop
Settings | org.gnome.Settings.desktop
Software Updater | update-manager.desktop
Software & Updates | software-properties-gtk.desktop
System Monitor | org.gnome.SystemMonitor.desktop
Terminal | org.gnome.Terminal.desktop
Text Editor | org.gnome.TextEditor.desktop
Web | org.gnome.Epiphany.desktop

##### default apps
x-scheme-handler/http                                                  org.gnome.Epiphany.desktop
x-scheme-handler/https                                                 org.gnome.Epiphany.desktop
text/html                                                              org.gnome.Epiphany.desktop
x-scheme-handler/mailto                                                
application/pdf                                                        org.gnome.Evince.desktop
image/png                                                              org.gnome.eog.desktop
image/jpeg                                                             org.gnome.eog.desktop
video/mp4                                                              
audio/mpeg                                                             
text/plain                                                             org.gnome.TextEditor.desktop
application/vnd.oasis.opendocument.text                                
application/vnd.openxmlformats-officedocument.wordprocessingml.document 
application/zip                                                        org.gnome.Nautilus.desktop
inode/directory                                                        org.gnome.Nautilus.desktop
application/x-iso9660-image                                            

##### keyboard shortcuts
'Super_L'
['<Super>Tab', '<Alt>Tab']
@as []
['<Super>a']
@as []
['<Super>l']
['']
['']
['<Primary><Alt>t']
['Print']
['<Shift>Print']
['<Ctrl><Shift><Alt>R']
@as []
['<Alt>F4']

##### gsettings sample
@as []
'default'
1.0
uint32 0
true
true
'suspend'
'interactive'
['firefox_firefox.desktop', 'org.gnome.Epiphany.desktop', 'org.gnome.Nautilus.desktop', 'org.gnome.TextEditor.desktop', 'org.gnome.Console.desktop', 'snap-store_snap-store.desktop', 'org.gnome.Software.desktop', 'dev.box.Box.desktop', 'org.gnome.Settings.desktop']
['gurtos@gurtos.dev']
@as []

##### printing
not-found
not-found
inactive
/home/anatest/inspect.sh: line 15: lpstat: command not found
printer-driver-pnm2ppa 

##### bluetooth
inactive

##### audio
PipeWire 'pipewire-0' [1.0.5, anatest@anatestux-gurtos, cookie:2735773693]
 └─ Clients:
        32. pipewire                            [1.0.5, anatest@anatestux-gurtos, pid:1238]
        33. WirePlumber                         [1.0.5, anatest@anatestux-gurtos, pid:1236]
        34. WirePlumber [export]                [1.0.5, anatest@anatestux-gurtos, pid:1236]
        50. gnome-shell                         [1.0.5, anatest@anatestux-gurtos, pid:1701]
        51. GNOME Shell Volume Control          [1.0.5, anatest@anatestux-gurtos, pid:1701]
        52. GNOME Volume Control Media Keys     [1.0.5, anatest@anatestux-gurtos, pid:1821]
        53. xdg-desktop-portal                  [1.0.5, anatest@anatestux-gurtos, pid:2076]
        54. wpctl                               [1.0.5, anatest@anatestux-gurtos, pid:3974]

Audio
 ├─ Devices:
 │      46. Built-in Audio                      [alsa]
 │  
 ├─ Sinks:
 │  *   47. Built-in Audio Analog Stereo        [vol: 0.40]
 │  
 ├─ Sink endpoints:
 │  
 ├─ Sources:
 │  *   48. Built-in Audio Analog Stereo        [vol: 1.00]
 │  
 ├─ Source endpoints:
 │  

##### power
/home/anatest/inspect.sh: line 18: powerprofilesctl: command not found
/org/freedesktop/UPower/devices/DisplayDevice

##### firewall
table inet gurtos
table inet box
sudo: ufw: command not found

##### network
connected:full:missing:enabled:missing:enabled
DEVICE  TYPE      STATE                   CONNECTION         
enp0s1  ethernet  connected               Wired connection 1 
lo      loopback  connected (externally)  lo                 

##### avahi / discovery
inactive
tcp 0.0.0.0:22
tcp 0.0.0.0:7700
tcp 127.0.0.1:3000
tcp 127.0.0.1:8888
tcp 127.0.0.53%lo:53
tcp 127.0.0.54:53
tcp [::]:22
udp 127.0.0.53%lo:53
udp 127.0.0.54:53

##### online accounts / sharing / remote

##### gstreamer codecs
avdec_h264       no
avdec_aac        no
mpg123audiodec   yes
x264enc          no

##### failed units / boot errors
Oct 24 14:52:35 anatestux-gurtos gdm-password][1570]: gkr-pam: unable to locate daemon control file
Oct 24 14:52:35 anatestux-gurtos gdm3[677]: Gdm: on_display_added: assertion 'GDM_IS_REMOTE_DISPLAY (display)' failed
Oct 24 14:52:35 anatestux-gurtos systemd[1222]: Failed to start app-gnome-gnome\x2dkeyring\x2dsecrets-1683.scope - Application launched by gnome-session-binary.
Oct 24 14:52:37 anatestux-gurtos gdm3[677]: Gdm: on_display_removed: assertion 'GDM_IS_REMOTE_DISPLAY (display)' failed

##### disks
NAME    SIZE FSTYPE MOUNTPOINT
sr0    1024M        
vda      48G        
├─vda1    1M        
├─vda2  512M vfat   /boot/efi
├─vda3   12G ext4   /
├─vda4   12G ext4   
└─vda5 23.5G ext4   /data
Filesystem     1M-blocks  Used Available Use% Mounted on
/dev/vda3         11992M 4636M     6726M  41% /
/dev/vda2           511M    9M      503M   2% /boot/efi
/dev/vda5         23513M 1029M    21265M   5% /data
/dev/vda5         23513M 1029M    21265M   5% /var/lib/box
3535	/usr
398	/var
964	/opt

##### user
uid=1000(anatest) gid=1000(anatest) groups=1000(anatest),4(adm),24(cdrom),27(sudo),30(dip),46(plugdev),100(users)
sudo:x:27:anatest
LANG=en_US.UTF-8
LANGUAGE=en
 Static hostname: anatestux-gurtos
 Pretty hostname: gurt-6ff071
       Icon name: computer-vm
         Chassis: vm 🖴
```

### ubuntu-inspect

```
:0

##### os
PRETTY_NAME="Ubuntu 24.04.5 LTS"
ID=ubuntu
ID_LIKE=debian
7.0.0-38-generic
desktop session: ubuntu:GNOME wayland ubuntu 

##### swap / memory
NAME      TYPE SIZE USED PRIO
/swap.img file 3.8G   0B   -1
swap lines: 2
MemTotal:        4004684 kB
SwapTotal:       4003836 kB

##### package managers
apt                      /usr/bin/apt
snap                     /usr/bin/snap
flatpak                  -
gnome-software           -
snap-store               /snap/bin/snap-store
update-manager           /usr/bin/update-manager
software-properties-gtk  /usr/bin/software-properties-gtk
unattended-upgrade       /usr/bin/unattended-upgrade
fwupdmgr                 /usr/bin/fwupdmgr
ubuntu-drivers           /usr/bin/ubuntu-drivers
orca                     /usr/bin/orca
ibus                     /usr/bin/ibus
cups                     -
lpstat                   /usr/bin/lpstat
powerprofilesctl         /usr/bin/powerprofilesctl
bluetoothctl             /usr/bin/bluetoothctl
nmcli                    /usr/bin/nmcli
wpctl                    /usr/bin/wpctl
pactl                    -
gst-inspect-1.0          /usr/bin/gst-inspect-1.0
ufw                      /usr/sbin/ufw
nft                      /usr/sbin/nft
ssh                      /usr/bin/ssh
gnome-screenshot         -
gnome-disks              /usr/bin/gnome-disks
baobab                   /usr/bin/baobab
seahorse                 /usr/bin/seahorse
evolution                -
firefox                  /usr/bin/firefox
thunderbird              -
libreoffice              -
vlc                      -
totem                    -
loupe                    -
eog                      /usr/bin/eog
evince                   /usr/bin/evince
papers                   -
gnome-calendar           -
gnome-contacts           -
simple-scan              -

##### apt sources
URIs: http://ca.archive.ubuntu.com/ubuntu/
Suites: noble noble-updates noble-backports
Components: main restricted universe multiverse
URIs: http://security.ubuntu.com/ubuntu/
Suites: noble-security
Components: main restricted universe multiverse
URIs: http://archive.ubuntu.com/ubuntu/
Suites: noble noble-updates noble-backports
Components: main universe restricted multiverse
URIs: http://security.ubuntu.com/ubuntu/
Suites: noble-security
Components: main universe restricted multiverse

##### unattended / periodic
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Download-Upgradeable-Packages "0";
APT::Periodic::AutocleanInterval "0";
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
Sat 2026-10-24 15:27:09 EDT       57s - - update-notifier-download.timer update-notifier-download.service
Sat 2026-10-24 15:30:00 EDT  3min 47s - - sysstat-collect.timer          sysstat-collect.service
Sat 2026-10-24 15:32:57 EDT      6min - - anacron.timer                  anacron.service
Sat 2026-10-24 15:37:07 EDT     10min - - systemd-tmpfiles-clean.timer   systemd-tmpfiles-clean.service
Sat 2026-10-24 16:44:56 EDT  1h 18min - - fwupd-refresh.timer            fwupd-refresh.service
Sat 2026-10-24 21:00:22 EDT  5h 34min - - apt-daily.timer                apt-daily.service
Sun 2026-10-25 00:00:00 EDT        8h - - dpkg-db-backup.timer           dpkg-db-backup.service
Sun 2026-10-25 00:00:00 EDT        8h - - logrotate.timer                logrotate.service
Sun 2026-10-25 00:07:00 EDT        8h - - sysstat-summary.timer          sysstat-summary.service
Sun 2026-10-25 00:26:42 EDT        9h - - motd-news.timer                motd-news.service
Sun 2026-10-25 02:01:22 EDT       10h - - man-db.timer                   man-db.service
Sun 2026-10-25 03:10:26 EDT       11h - - e2scrub_all.timer              e2scrub_all.service
Sun 2026-10-25 06:28:12 EDT       15h - - apt-daily-upgrade.timer        apt-daily-upgrade.service
Mon 2026-10-26 00:43:36 EDT  1 day 9h - - fstrim.timer                   fstrim.service
Mon 2026-10-26 03:17:02 EDT 1 day 11h - - update-notifier-motd.timer     update-notifier-motd.service

##### snap
snap          2.76.3+ubuntu24.04
snapd         2.76.3+ubuntu24.04
series        16
ubuntu        24.04
kernel        7.0.0-38-generic
architecture  amd64
Name                       Version                         Rev    Tracking         Publisher    Notes
bare                       1.0                             5      latest/stable    canonical**  base
core24                     20260824                        2124   latest/stable    canonical**  base
firefox                    155.0.1-1                       8863   latest/stable/…  mozilla**    -
firmware-updater           0+git.5645b80                   226    1/stable/…       canonical**  -
gnome-46-2404              0+git.b31ceab-sdk0+git.f0723a0  164    latest/stable/…  canonical**  -
gtk-common-themes          0.1-81-g442e511                 1535   latest/stable/…  canonical**  -
mesa-2404                  25.2.8-snap288                  1839   latest/stable/…  canonical**  -
snap-store                 0+git.8334e2e4                  1390   2/stable/…       canonical**  -

##### apt policy
vlc:
  Candidate: 3.0.20-3build6
ubuntu-restricted-extras:
  Candidate: 67
firefox:
  Candidate: 1:1snap1-0ubuntu5

##### gnome-control-center panels
about applications background bluetooth color datetime display keyboard mouse multitasking network notifications online-accounts power printers privacy region search sharing sound system ubuntu universal-access users wacom wifi wwan 


##### GUI apps (visible .desktop)
Additional Drivers | software-properties-drivers.desktop
Advanced Network Configuration | nm-connection-editor.desktop
App Center | snap-store_snap-store.desktop
Calculator | org.gnome.Calculator.desktop
Characters | org.gnome.Characters.desktop
Clocks | org.gnome.clocks.desktop
Disks | org.gnome.DiskUtility.desktop
Disk Usage Analyzer | org.gnome.baobab.desktop
Document Viewer | org.gnome.Evince.desktop
Files | org.gnome.Nautilus.desktop
Firefox | firefox_firefox.desktop
Firmware Updater | firmware-updater_firmware-updater.desktop
Fonts | org.gnome.font-viewer.desktop
GNOME System Monitor | gnome-system-monitor-kde.desktop
Help | yelp.desktop
IBus Preferences | org.freedesktop.IBus.Setup.desktop
Image Viewer | org.gnome.eog.desktop
Input Method | im-config.desktop
Language Support | gnome-language-selector.desktop
Logs | org.gnome.Logs.desktop
Passwords and Keys | org.gnome.seahorse.Application.desktop
Power Statistics | org.gnome.PowerStats.desktop
Settings | org.gnome.Settings.desktop
Software Updater | update-manager.desktop
Software & Updates | software-properties-gtk.desktop
Startup Applications | gnome-session-properties.desktop
System Monitor | org.gnome.SystemMonitor.desktop
Terminal | org.gnome.Terminal.desktop
TeXInfo | info.desktop
Text Editor | org.gnome.TextEditor.desktop
Vim | vim.desktop

##### default apps
x-scheme-handler/http                                                  
x-scheme-handler/https                                                 
text/html                                                              
x-scheme-handler/mailto                                                
application/pdf                                                        org.gnome.Evince.desktop
image/png                                                              org.gnome.eog.desktop
image/jpeg                                                             org.gnome.eog.desktop
video/mp4                                                              
audio/mpeg                                                             
text/plain                                                             org.gnome.TextEditor.desktop
application/vnd.oasis.opendocument.text                                
application/vnd.openxmlformats-officedocument.wordprocessingml.document 
application/zip                                                        org.gnome.Nautilus.desktop
inode/directory                                                        org.gnome.Nautilus.desktop
application/x-iso9660-image                                            

##### keyboard shortcuts
'Super_L'
['<Super>Tab', '<Alt>Tab']
@as []
['<Super>a']
@as []
['<Super>l']
['']
['']
['<Primary><Alt>t']
['Print']
['<Shift>Print']
['<Ctrl><Shift><Alt>R']
['<Super>Up']
['<Alt>F4']

##### gsettings sample
@as []
'default'
1.0
uint32 0
true
true
'suspend'
'interactive'
['ubuntu-desktop-bootstrap_ubuntu-desktop-bootstrap.desktop', 'firefox_firefox.desktop', 'org.gnome.Evolution.desktop', 'org.gnome.Nautilus.desktop', 'org.gnome.Rhythmbox3.desktop', 'libreoffice-writer.desktop', 'snap-store_snap-store.desktop', 'yelp.desktop']
@as []
@as []

##### printing
enabled
enabled
active
lpstat: No destinations added.
avahi-daemon cups cups-browsed cups-bsd cups-client cups-common cups-core-drivers cups-daemon cups-filters cups-filters-core-drivers cups-ipp-utils cups-pk-helper cups-ppdc cups-server-common hplip hplip-data printer-driver-brlaser printer-driver-c2esp printer-driver-foo2zjs printer-driver-foo2zjs-common printer-driver-hpcups printer-driver-m2300w printer-driver-min12xxw printer-driver-pnm2ppa printer-driver-postscript-hp printer-driver-ptouch printer-driver-pxljr printer-driver-sag-gdi printer-driver-splix sane-airscan sane-utils system-config-printer-common system-config-printer-udev 

##### bluetooth
inactive

##### audio
PipeWire 'pipewire-0' [1.0.5, anatest@anatestux-ubuntu, cookie:2059761862]
 └─ Clients:
        32. WirePlumber                         [1.0.5, anatest@anatestux-ubuntu, pid:2313]
        33. WirePlumber [export]                [1.0.5, anatest@anatestux-ubuntu, pid:2313]
        34. pipewire                            [1.0.5, anatest@anatestux-ubuntu, pid:2314]
        50. gnome-shell                         [1.0.5, anatest@anatestux-ubuntu, pid:2650]
        51. GNOME Shell Volume Control          [1.0.5, anatest@anatestux-ubuntu, pid:2650]
        52. GNOME Volume Control Media Keys     [1.0.5, anatest@anatestux-ubuntu, pid:2787]
        53. xdg-desktop-portal                  [1.0.5, anatest@anatestux-ubuntu, pid:3183]
        54. check-new-release-gtk               [1.0.5, anatest@anatestux-ubuntu, pid:4651]
        55. wpctl                               [1.0.5, anatest@anatestux-ubuntu, pid:5870]

Audio
 ├─ Devices:
 │      46. Built-in Audio                      [alsa]
 │  
 ├─ Sinks:
 │  *   47. Built-in Audio Analog Stereo        [vol: 0.40]
 │  
 ├─ Sink endpoints:
 │  
 ├─ Sources:
 │  *   48. Built-in Audio Analog Stereo        [vol: 1.00]
 │  
 ├─ Source endpoints:

##### power
* balanced:
    PlatformDriver:	placeholder

  power-saver:
    PlatformDriver:	placeholder
/org/freedesktop/UPower/devices/DisplayDevice

##### firewall
Status: inactive

##### network
connected:full:missing:enabled:missing:enabled
DEVICE  TYPE      STATE                   CONNECTION     
enp0s1  ethernet  connected               netplan-enp0s1 
lo      loopback  connected (externally)  lo             

##### avahi / discovery
active
tcp 0.0.0.0:22
tcp 127.0.0.1:631
tcp 127.0.0.53%lo:53
tcp 127.0.0.54:53
tcp [::1]:631
tcp [::]:22
udp 0.0.0.0:5353
udp 0.0.0.0:60369
udp 127.0.0.53%lo:53
udp 127.0.0.54:53
udp [::]:39392
udp [::]:5353

##### online accounts / sharing / remote
ii  gnome-online-accounts 3.50.4-0ubuntu2 amd64        service to manage online 
ii  gnome-remote-desktop  46.3-0ubuntu1.2 amd64        Remote desktop daemon for
ii  rygel                 0.42.5-1ubuntu3 amd64        GNOME UPnP/DLNA services

##### gstreamer codecs
avdec_h264       no
avdec_aac        no
mpg123audiodec   yes
x264enc          no

##### failed units / boot errors
Oct 24 15:23:02 anatestux-ubuntu gdm-password][2281]: gkr-pam: unable to locate daemon control file
Oct 24 15:23:03 anatestux-ubuntu gdm3[1461]: Gdm: on_display_added: assertion 'GDM_IS_REMOTE_DISPLAY (display)' failed
Oct 24 15:23:06 anatestux-ubuntu gdm3[1461]: Gdm: on_display_removed: assertion 'GDM_IS_REMOTE_DISPLAY (display)' failed

##### disks
NAME     SIZE FSTYPE   MOUNTPOINT
loop0      4K squashfs /snap/bare/5
loop1   66.8M squashfs /snap/core24/2124
loop2   16.5M squashfs /snap/firmware-updater/226
loop3  260.8M squashfs /snap/firefox/8863
loop4  614.5M squashfs /snap/gnome-46-2404/164
loop5    402M squashfs /snap/mesa-2404/1839
loop6   91.7M squashfs /snap/gtk-common-themes/1535
loop7    828K squashfs /snap/snapd-desktop-integration/391
loop8   50.3M squashfs /snap/snapd/27738
loop9   11.8M squashfs /snap/snap-store/1390
sr0     1024M          
vda       48G          
├─vda1     1M          
└─vda2    48G ext4     /
Filesystem     1M-blocks   Used Available Use% Mounted on
/dev/vda2         48070M 10181M    35416M  23% /
4122	/usr
1991	/var
1	/opt

##### user
uid=1000(anatest) gid=1000(anatest) groups=1000(anatest),4(adm),24(cdrom),27(sudo),30(dip),46(plugdev),100(users),114(lpadmin),123(lxd)
sudo:x:27:anatest
LANG=en_US.UTF-8
LANGUAGE=
 Static hostname: anatestux-ubuntu
       Icon name: computer-vm
         Chassis: vm 🖴
```
