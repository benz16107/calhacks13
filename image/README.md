# GurtOS images

This folder builds GurtOS, in the two editions from Editions in `CLAUDE.md`:

- **GurtOS Server** turns a fresh machine into the box. No desktop, no login prompt, no human account: the screen
  shows the portal's box screen.
- **GurtOS Personal** is Ubuntu's GNOME desktop for the person who owns the computer, with the box beside them.
  GNOME's own first-boot setup makes their account, and that account gets sudo. Agents stay separate users
  without sudo.

"Ubuntu plus our stuff" means you install Ubuntu, log in, and run `core/install.sh`. GurtOS is one disc you start
a machine from, and what comes up is the box. The system updates as a whole and rolls itself back if a new
version is not healthy. Both editions are Ubuntu 24.04 underneath (`ID_LIKE=ubuntu` in `/etc/os-release`).

## Build it yourself

You need an Ubuntu 24.04 machine or VM with root (sudo), about 12 GB of free disk for each edition and
architecture you build, and a network connection: the build downloads Ubuntu's packages, Node.js and
SpacetimeDB. (Droid is not in the image: each machine downloads it on first start.) The build runs as root, installs build tools, mounts loop devices and runs chroots, so use a
VM or a machine set aside for it.

```
git clone https://github.com/benz16107/calhacks13 gurtos && cd gurtos
image/build                      # GurtOS Server for x86_64
image/build personal             # GurtOS Personal for x86_64
image/build arm64                # GurtOS Server for arm64
image/build personal arm64       # GurtOS Personal for arm64
```

It builds on this machine (it asks for sudo). To build on another machine instead, give it a shell there:
`BUILD_SHELL='ssh my-vm' image/build`. It copies this checkout over and builds there as root. Build each
architecture on a machine of that architecture: arm64 on an x86_64 machine works, under emulation, but takes
about an hour (`BUILD_SHELL='ssh my-arm-vm' image/build arm64`).

How long, measured from a fresh `git clone` (so including Ubuntu's base) on a Vultr vc2-4c-8gb (4 vCPU, 8 GB):

| Build | Time | Peak memory | Disk used |
|---|---|---|---|
| GurtOS Server, x86_64 | 6 min 16 s | 1.0 GB | about 7 GB |
| GurtOS Personal, x86_64 | about 6 min | 1.7 GB | about 11 GB |
| GurtOS Server, arm64, natively on an Apple M2 Max VM (6 cores, 8 GB) | 4 min 42 s | | |

A second build of the same edition reuses the cached Ubuntu base and takes about half as long. Most of the time is
downloads. arm64 on an x86_64 machine runs under emulation and takes about an hour.

The outputs are on the build machine in `/var/lib/box-image/out/`:

| File | What |
|---|---|
| `gurtos-<edition>-<arch>.iso` | The install disc. Boots BIOS and UEFI. Also a live system. |
| `gurtos-<edition>-<arch>.sqfs` | The whole system as one image. It is on the disc, and it is also the update file. |
| `gurtos-<edition>-<arch>.sqfs.sha256`, `.sig` | Its hash, and the hash signed with the update key |

Edition is `server` or `personal`. The first build caches Ubuntu plus the dependencies in
`/var/lib/box-image/<arch>/base-*` (`personal-<arch>` for Personal). That cache is rebuilt only when the package
list in `build` or `core/setup.sh` changes.

Options, as environment variables:

| Variable | Does |
|---|---|
| `BOX_VERSION=0.1.0-preview` | The version in `/etc/os-release`, the disc menu and the console banner. Default: the build date. |
| `BOX_UPDATE_KEY=<file>` | An ed25519 private key (PEM) to sign updates with. The image trusts its public half. Default: a key the build machine makes once in `/var/lib/box-image/update-signing.key`. |
| `BOX_TIMEZONE=Europe/Paris` | The time zone until someone changes it. Default: UTC. |
| `BOX_SSH_KEY=~/.ssh/id_ed25519.pub` | A **debug build** (`...-debug.iso`): adds sshd and lets that key log in as root. Release builds have no sshd. |

The update key decides which updates a machine accepts, for as long as it runs. Keep it outside the repository,
and keep it: machines installed from an image only take updates signed with the same key. With `BOX_UPDATE_KEY`
it is copied to the build machine for the build (outside the source folder, so it never enters the image) and
deleted afterwards. To make one: `openssl genpkey -algorithm ed25519 -out update.key`.

## Start it

The disc's menu says GurtOS Server or GurtOS Personal. On a machine without GurtOS it waits 5 seconds, then
installs. On a machine that already has GurtOS on its disk it waits 30 seconds, then starts that; pick Install to
install again. A blank disk is used straight away. A
disk with anything on it is erased only after someone types `erase` on the screen. The installer then restarts
into GurtOS. Server's screen opens GurtOS's setup wizard; Personal shows GNOME's welcome, which makes the first
account, and then GurtOS Setup (see First-run setup below).

**In a QEMU VM on a Linux machine** (no root): `image/test` takes the ISO from `/var/lib/box-image/out` (or
from `BUILD_HOST` over ssh), installs it on an empty QEMU disk, restarts into
it and waits for the box to report healthy on the serial console. Then it removes the disc and pulls the plug,
and the box must come back from its own disk, healthy, with the same identity. It saves screenshots of the
screen. `--uefi` uses UEFI firmware instead of BIOS. `--arm64` tests the arm64 ISO, emulated, so about 5 times
slower. `--personal` tests the Personal edition. `--debug` tests a debug build and adds a system update to slot B
and a broken update that must roll back by itself; with `--personal` it also checks that a person's account, sudo
and files survive the update.

**Vultr** (Server): put the ISO at a URL, for example a release download, or from the build machine:
`cd /var/lib/box-image/out && python3 -m http.server 8080`, then `http://<build-machine>:8080/gurtos-server-x86_64.iso`.
In Vultr: Orchestration, ISOs, Add ISO, paste the URL. Deploy a Cloud Compute instance with that ISO as its
image (at least 25 GB of disk). Open the instance's console. A new instance first shows iPXE ("Custom OS
selected. Please mount an ISO") for about a minute while Vultr attaches the ISO, then restarts into the disc by
itself. The installer's screen stays dark for a minute or two, then copies the system with a progress bar; from
the disc's menu to the box's screen takes about 3 minutes on a 4-vCPU instance and 5 to 8 on a 1-vCPU one: wait for
the box's screen before detaching the ISO or restarting. Detach the ISO afterwards: GurtOS starts from its disk
either way, but with the ISO attached every start waits 30 seconds at the disc's menu. To reinstall, restart with
the ISO attached and pick Install within those 30 seconds (Vultr's reinstall refuses ISO instances).

On any cloud VM with only a public address, the firewall lets nothing reach the box's API, so first-run setup
happens on the provider's web console, which shows the box's screen. To reach the portal afterwards from your own
computer or phone, join the box to a private network such as Tailscale (its addresses are allowed), or, on a
debug build, forward the port over ssh: `ssh -L 7700:127.0.0.1:7700 root@<box>`, then open `http://127.0.0.1:7700`.

**UTM on a Mac** (Apple silicon), the quickest way to try it:
1. In UTM: Create a New Virtual Machine, then **Virtualize** (not Emulate: emulation is about 10 times slower).
2. Operating System: **Linux**. Leave "Use Apple Virtualization" off. Boot ISO Image: `gurtos-server-arm64.iso`
   (or `gurtos-personal-arm64.iso`).
3. Memory 4096 MB, 4 CPU cores. Leave "Enable hardware OpenGL acceleration" off: the screen draws in software.
   Storage 32 GB for Server (it needs at least 17 GB), 48 GB for Personal (at least 29 GB). Skip the shared
   directory.
4. Before you start it, open the VM's settings. If UTM shows a Secure Boot option, turn it off: the boot loader
   is not signed.
5. Start it. The menu waits 5 seconds and installs on the empty disk (about a minute), then restarts into
   GurtOS. Server opens the setup wizard on its screen. Personal shows GNOME's welcome, then GurtOS Setup.
6. To start over, delete the VM's disk. Or start from the ISO, pick "Install" in its menu, and type `erase`.

**Parallels** also works (File, New, "Install Windows, Linux or macOS from an image file", the arm64 ISO, then
"Other Linux"), with Secure Boot off.

**A real machine**: write the ISO to a USB stick (`dd if=gurtos-server-x86_64.iso of=/dev/sdX bs=4M`) and start
from it. Secure Boot must be off: the boot loader is not signed.

## How updates work

The installer splits the disk into five parts:

| Partition | Label | Holds |
|---|---|---|
| BIOS boot, 1 MB (x86) | `box-bios` | GRUB, for BIOS machines such as many cloud VMs |
| ESP, 512 MB | `BOX-ESP` | GRUB, its menu, and `grubenv`, which says which slot starts |
| System slot A, 6 GB (Personal: 12 GB) | `box-a` | A whole system: kernel, Ubuntu, the box service |
| System slot B, the same size | `box-b` | The other system. Empty until the first update. |
| Data, the rest | `box-data` | Everything that must outlive an update |

GurtOS runs from one slot. `box-update apply <file or URL>` checks the update's signature and hash, writes it to
the other slot, and restarts. GRUB starts the new slot **once** (`next_entry` in `grubenv`, which GRUB clears as
it uses it). At every start, `box-confirm.service` waits up to 5 minutes for the box's `/health`. If the new
system is healthy, it becomes the default. If not, it restarts and GRUB starts the old slot, because the default
never changed. A new kernel that panics restarts by itself after 10 seconds (`panic=10`) and lands on the old
slot the same way.

```
box-update status                       # which slot runs, what the other holds, the last update's result
box-update apply https://host/gurtos-server-x86_64.sqfs
box-update rollback                     # make the other slot the default again
```

The update image is the `.sqfs` the build makes, fetched with its `.sha256` and `.sig`. The signature must
verify against `/etc/box-os/update.pub`, the update key's public half, baked into the image (see
`BOX_UPDATE_KEY`). Images signed with another key will not install. An update must be
the same edition: a Personal system updated with a Server image would lose its desktop.

What lives on the data partition, bind-mounted in place: `/var/lib/box` (the action log, workspaces, tasks),
`/etc/box` (the vault and the box's identity key), `/var/lib/spacetimedb`, `/root/.config/spacetime` (the identity
that owns the box's SpacetimeDB database), and `/var/log/journal`, so logs from a failed update are still there
after the rollback. An update also copies over `/etc/machine-id`, the time zone, SSH host keys, and the task users core made
(`box-*`, uids 30000 to 39999), so a resumed task keeps its uid.

**Trade-offs, written down:**
- The slots are plain writable ext4, not read-only or verified (no dm-verity). Changes made by hand inside a
  running slot are lost at the next update, by design.
- A system that hangs instead of panicking or failing its health check stays hung until someone restarts it.
  A hardware watchdog would cover that; VMs do not all have one.
- The GRUB menu on the ESP is written once at install and never updated. A change to the boot menu itself
  needs a reinstall.
- The two 6 GB slots cost 12 GB of disk (24 GB on Personal).
- Updates are signed with one ed25519 key. There is no key rotation and no rollback protection (an old signed
  image installs fine).

## First-run setup

The wizard is the portal's (`portal/src/setup.tsx`), and whether setup is done is the box's (`GET /api/setup`,
in `core/`). The image only gets a person to it:

- **Server:** the kiosk opens the portal's box screen (`/screen`), which shows the wizard until setup is done.
  Its "pair your phone" step is the pairing QR code. `BOX_URL` is the box's own address from the first start
  (`box-env`), so the QR opens on a phone on the same network.
- **Personal:** GNOME's own setup makes the account first. At that person's first login the Personal layer's own
  "GurtOS Setup" (`personal/setupwin.py`, started from `/etc/xdg/autostart/box-setup.desktop`) opens for the owner
  until the box says setup is done. It is native, with seven steps. The portal's longer wizard shows only on a
  Server box's screen, and in the Box window until setup is done.

Updates do not touch it: setup's state lives with the box on the data partition.

## Network and firewall

`/etc/nftables.conf` drops everything coming in except replies to the box's own connections, ping and DHCP. On
both editions the box's API and portal (port 7700) are also open to private networks (10/8, 172.16/12,
192.168/16, Tailscale's 100.64/10, link-local, IPv6 ULA), so a phone on the same network can pair; the box
listens on every address and sets `BOX_URL` to its own address at each start (`box-env`), so the pairing QR code
opens on the phone. Never from the public internet: every request that does not come from the box itself
already needs a paired phone's token (core's "Who may reach the API"), and the firewall keeps it that way one
layer further out. SpacetimeDB (port 3000) is never open to the network; the portal falls back to the API's log
stream. On Personal, `BOX_URL` is read when the box starts, so after a laptop moves to another network it shows
the old address until the next restart. Debug builds also open ssh (22).

The time zone is UTC unless the build set `BOX_TIMEZONE`. Personal's GNOME setup asks for it. On Server, change
it with `timedatectl set-timezone` on a debug build; the setup wizard does not set it yet. Updates keep it.

## GurtOS Personal

`image/build personal` makes the same disc, installer, A/B slots and updates, with a desktop in place of the
kiosk:

- **GNOME, from Ubuntu**: `ubuntu-desktop-minimal` plus the parts Ubuntu only recommends (NetworkManager,
  the terminal, text editor, keyring, Yaru themes). No snaps: Ubuntu's Firefox is a snap, which cannot be built
  into an image, so the browser is GNOME Web. Yaru is the theme for every app, not only in Ubuntu's own session
  (`rootfs-personal/usr/share/glib-2.0/schemas/`; the layer's own icon theme sits on top of it). GNOME's distributor
  logo is GurtOS's (`LOGO=gurtos-logo` in `/etc/os-release`). Ubuntu's crash
  reporting is off (`/etc/default/apport`): its Python hook fails on any system whose `ID` is not `ubuntu`.
- **The GurtOS theme** comes from `personal/theme`: Papirus-based GurtOS icons, the Bibata cursor, GNOME Console,
  and a Plymouth boot splash (`splash` is on Personal's kernel line with `plymouth.ignore-serial-consoles`, and
  `/etc/plymouth/plymouthd.conf` names the theme; Server boots without one). The login screen offers only the GurtOS
  session: Ubuntu's own sessions are removed. The image installs
  their packages up front, so the layer's install needs no network. It does not ship a software store (GNOME
  Software or Snap Store): software installed with `apt` is gone after the next system update (see the trade-off
  below), so a store would install things that later disappear.
- **Talk to your computer** needs a local speech model (faster-whisper `base.en`, about 600 MB with its Python
  environment). It is not in the image, which would then be larger than 2 GiB: `box-voice.service` runs
  `personal/voice-setup.sh` once the network is up, retrying every minute, into `/opt/box/voice-venv` and
  `/opt/box/voice-models`, which live on the data partition, so a system update keeps them.
- **First boot runs GNOME's own setup** (`gnome-initial-setup`, started by GDM because the machine has no
  account yet). The account it makes is an administrator, so that person is in the `sudo` group. Root's password
  stays locked. The box's task users (`box-*`) are never in `sudo`.
- **The box service** is the same as on Server, from `core/install.sh`. Its screen is the desktop's, not a kiosk.
- **The Box desktop layer** comes from `personal/install.sh`, with its GurtOS session and theme. See the hook
  below.
- **The computer's name** is `gurt-<id>` until the person names it in Settings. First boot sets it as the
  pretty hostname too. GNOME's setup still names the machine after the new account, so `box-hostname` (run by
  `box-owner.service` right after) puts `gurt-<id>` back, unless the person typed a computer name of their own.

The data partition also holds `/home`, saved Wi-Fi and network connections, AccountsService (account pictures
and types) and Bluetooth pairings. These mounts are required on Personal: a desktop that started without `/home`
would write people's files into the system slot. An update also carries over people's accounts (uids 1000 to
29999), their groups and memberships (sudo among them), time zone, language, computer name and login settings
(`rootfs-personal/usr/local/lib/box-os/carry.d/10-personal`).

**The trade-off:** A/B fits, but a desktop with sudo is a system people change. Software someone installs with
`apt`, and any other change they make outside their home folder and the settings above, is gone after the next
system update, because the update replaces the whole system. Their files, accounts and settings stay. That is
how ChromeOS and Fedora Silverblue behave too. Ubuntu's own update tools (Software Updater) are still installed
and can update the running slot, but the next GurtOS update replaces that too. Dual boot with another OS is not
supported: the installer takes the whole disk.

### The hook with `personal/`

`image/build personal` runs, as root, inside the image's chroot, after `core/install.sh`:

```
personal/install.sh
```

The image keeps its side of the deal: Ubuntu's GNOME desktop and every package `personal/install.sh` lists are
already installed, so it needs no network; `/opt/box` already holds the checkout, `personal/` included; nothing
is running (no systemd, no D-Bus, no session), and no account exists yet. `personal/install.sh` keeps its side
(it says so in its header): it only installs files and packages and never starts anything, sets things up for
every future account (`/etc/xdg/autostart`, `systemctl --global`, gschema overrides), and survives being run
again. If `personal/install.sh` is missing, the build goes on without the layer and says so. If it fails, the
build fails.

On the installed machine, `box-owner.service` runs `/opt/box/personal/install.sh` again, as root with systemd
running, so the box learns its owner (`BOX_OWNER`, written to `box.service.d/personal.conf`): when `/etc/group`
changes (GNOME's setup has just made the first account) and at every start until that file exists in the running
slot, which is again after each system update. So `personal/install.sh` must also succeed when there is no
account yet, both in the chroot and at boot.

## Tested

With `image/test` in QEMU on an x86_64 Linux machine:
- Server, x86_64, with BIOS and with UEFI: installs on a blank 24 GB disk in about a minute, starts healthy with
  every track loaded, shows the setup wizard, and survives the disc being removed and a power cut. From outside
  the VM, port 3000 does not answer and port 7700 does from a private address.
- Server and Personal, x86_64 debug builds: an update to slot B is confirmed, and a broken update (its box service
  never starts) rolls back to slot B by itself after the 5-minute health check.
- Server, arm64, emulated with UEFI: installs, starts healthy, shows the screen, and survives the disc being
  removed and a power cut.
- The installer also finds the disc on a USB CD drive.
- Both editions report `PRETTY_NAME="GurtOS <edition> <version>"`, `ID=gurtos`, `ID_LIKE=ubuntu`, a `gurt-<id>`
  hostname, and boot menus that say GurtOS.
- Personal: installs on a blank 40 GB disk and shows GNOME's first-boot welcome. An account made the way GNOME's
  setup makes one (AccountsService, administrator) lands in `sudo`; no task user does. The box learns its owner,
  and after an update the account, its sudo and its files are still there.

On a Vultr cloud VM (vc2-4c-8gb; on a 1-vCPU instance it took about 5 minutes) the Server ISO installed on a blank 160 GB disk with BIOS in about 3 minutes
from the disc booting to the box's screen, came back about 25 s after a hard power-off, and the disc started the
box from disk when it was already installed. GurtOS Personal was also installed on a Vultr VM and walked through
its first run on Wayland.

Not tested: Parallels, a real PC, the kernel-panic path of a bad update, an update fetched by URL, and Personal
on arm64.

## What is different from stock Ubuntu

Stock Ubuntu Server 24.04 has a login prompt, a user with sudo, snapd, cloud-init and apt upgrades. GurtOS Server:

- **Is built from 40 named packages** (`packages` in `build`), 440 with their dependencies, by mmdebstrap
  instead of the Ubuntu installer. There is no snapd, cloud-init, sudo, desktop, apport, unattended-upgrades,
  man pages, or apt: it only ever updates as a whole system image.
- **Calls itself GurtOS.** `/etc/os-release` says `NAME="GurtOS"`, `PRETTY_NAME="GurtOS Server <version>"`,
  `ID=gurtos`, `ID_LIKE=ubuntu`, and keeps Ubuntu's codename for tools that need it. The boot menus, the
  installer and the console banner say GurtOS. The default hostname is `gurt`.
- **Has no human account.** Root's password is locked. There is no `sudo` binary. Every getty is masked, so no
  screen or serial port offers a login. Debug builds add sshd with one key for root, and say so in
  `/etc/box-os/release`.
- **Starts straight into the box.** `box.service` (from `core/install.sh`) and `spacetimedb.service` (from
  `core/setup.sh`) are installed in the image. Node 24 and SpacetimeDB come from `core/setup.sh`.
- **Includes `age`**, which an app's backup uses to encrypt to the owner's key.
- **Downloads Droid on first start.** Factory's Droid CLI, the agent worker, may not be shipped inside the
  image, so the build runs `core/setup.sh` with `BOX_NO_DROID=1` and stops if Droid is in the image anyway. Once
  the network is up, `box-droid.service` runs `core/setup.sh droid` (pinned version, checked checksum), retrying
  every 30 seconds until it works, and keeps a copy in `/data/droid`, so a system update puts it back without
  downloading it again. Until then a Droid task waits with a message saying so.
- **Its screen is the box.** `box-kiosk.service` runs cage, a Wayland compositor that shows one window, with a
  full-screen WebKit view (`rootfs/usr/local/lib/box-os/kiosk.py`) as the `kiosk` user (no password, no shell).
  seatd, a small root daemon, hands that user the display and keyboard. Ubuntu's own browsers are snaps, which
  cannot be built into an image, so the view is WebKitGTK from the Ubuntu archive.
  It shows `http://127.0.0.1:7700/screen`, the portal's box screen, which the box service serves itself.
- **Sets itself up on first start.** `box-firstboot` makes the box's ed25519 identity key and an empty root-only
  vault in `/etc/box` on the data partition. The hostname becomes `gurt-<id>`, from that key, and core uses it as
  the box's id, so two boxes never share a name. Pairing a phone is core's (`POST /api/pair/new`), from the
  portal's Settings.
- **Has an A/B disk layout, a static GRUB menu and `box-update`** (above), instead of grub-mkconfig and apt.
- **Boots its install disc live**, with a custom initramfs boot method (`boot=boxlive`): the disc's squashfs
  is a read-only root with a RAM layer on top.
- **Networking** is systemd-networkd with DHCP on every wired card (no netplan), behind an inbound firewall
  (above).

Every file the image adds is in `rootfs/` (both editions; the kiosk and networking files are Server only) and
`rootfs-personal/` (Personal only), at the path it gets on the machine. Internal names (the `box` service,
`/etc/box`, `box-update`, partition labels) stay as they were.

## Files

| Path | What |
|---|---|
| `build` | The one command. Ubuntu base, core's own install scripts, `rootfs/`, then the squashfs and ISO. |
| `test` | Boot test in QEMU: install, health, power cut, firewall, update, rollback |
| `iso-grub.cfg` | The install disc's menu |
| `rootfs/usr/local/sbin/box-install` | The installer (partitions, slot A, GRUB) |
| `rootfs/usr/local/sbin/box-update` | Updates, rollback, and the health check at every start |
| `rootfs/usr/local/sbin/box-firstboot` | First-boot setup |
| `rootfs/usr/local/lib/box-os/` | The disk's GRUB menu and the kiosk browser |
| `rootfs/etc/initramfs-tools/` | The live boot method for the install disc |
| `rootfs/etc/systemd/` | The services, and drop-ins that put core's services on the data partition |
| `rootfs-personal/` | Personal only: its fstab, NetworkManager, the Yaru override, the update carry-over |
