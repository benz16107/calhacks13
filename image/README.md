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

## Build it

```
image/build                      # GurtOS Server, x86_64: about 12 minutes the first time, 3 after that
image/build arm64                # GurtOS Server, arm64, cross-built under emulation: about an hour
image/build all                  # Server, both
image/build personal [arch]      # GurtOS Personal (x86_64 unless arm64)
BUILD_SHELL='ssh benmac /opt/homebrew/bin/limactl shell box --' image/build arm64
                                 # arm64 built natively in the laptop's Lima VM: about 20 minutes, mostly downloads
```

It ships this checkout to the build VM (`ssh vultrbox`; any Ubuntu 24.04 VM with root works:
`BUILD_SHELL='ssh my-vm' image/build`) and builds there as root. Never run it on linuxbox itself. x86_64 builds
need an x86_64 build VM. The outputs stay on the build VM in `/var/lib/box-image/out/`:

| File | What |
|---|---|
| `gurtos-<edition>-<arch>.iso` | The install disc. Boots BIOS and UEFI. Also a live system. |
| `gurtos-<edition>-<arch>.sqfs` | The whole system as one image. It is on the disc, and it is also the update file. |
| `gurtos-<edition>-<arch>.sqfs.sha256`, `.sig` | Its hash, and the hash signed with the build VM's update key |

Edition is `server` or `personal`. The first build caches Ubuntu plus the dependencies in
`/var/lib/box-image/<arch>/base-*` (`personal-<arch>` for Personal). That cache is rebuilt only when the package
list in `build` or `core/setup.sh` changes.

`BOX_SSH_KEY=~/.ssh/id_ed25519.pub image/build` makes a **debug build** (`...-debug.iso`): it adds sshd and lets
that key log in as root. Release builds have no sshd.

## Start it

The disc's menu says GurtOS Server or GurtOS Personal. On a machine without GurtOS it waits 5 seconds, then
installs. On a machine that already has GurtOS on its disk it waits 30 seconds, then starts that; pick Install to
install again. A blank disk is used straight away. A
disk with anything on it is erased only after someone types `erase` on the screen. The installer then restarts
into GurtOS. Server shows the portal's box screen. Personal shows GNOME's welcome, which makes the first account.

**linuxbox, in a VM** (no root): `image/test` fetches the ISO, installs it on an empty QEMU disk, restarts into
it and waits for the box to report healthy on the serial console. Then it removes the disc and pulls the plug,
and the box must come back from its own disk, healthy, with the same identity. It saves screenshots of the
screen. `--uefi` uses UEFI firmware instead of BIOS. `--arm64` tests the arm64 ISO, emulated, so about 5 times
slower. `--personal` tests the Personal edition. `--debug` tests a debug build and adds a system update to slot B
and a broken update that must roll back by itself; with `--personal` it also checks that a person's account, sudo
and files survive the update.

**Vultr** (Server): put the ISO at a URL (for example on the build VM:
`cd /var/lib/box-image/out && python3 -m http.server 8080`, then `http://<build-vm-ip>:8080/gurtos-server-x86_64.iso`).
In Vultr: Orchestration, ISOs, Add ISO, paste the URL. Deploy a Cloud Compute instance with that ISO as its
image (at least 25 GB of disk). Open the instance's console. A new instance first shows iPXE ("Custom OS
selected. Please mount an ISO") for about a minute while Vultr attaches the ISO, then restarts into the disc by
itself. The installer's screen stays dark for a minute or two, then copies the system with a progress bar; from
the disc's menu to the box's screen takes about 3 minutes. Detach the ISO afterwards: GurtOS starts from its disk
either way, but with the ISO attached every start waits 30 seconds at the disc's menu. To reinstall, restart with
the ISO attached and pick Install within those 30 seconds (Vultr's reinstall refuses ISO instances).

A box on Vultr has only a public address, so its firewall lets nothing reach the box's API: use it from Vultr's
console, or put the box on a private network (Tailscale's addresses are allowed).

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
   GurtOS. Server shows the portal's box screen; to pair a phone, open Settings there. Personal shows GNOME's
   welcome.
6. To start over, delete the VM's disk. Or start from the ISO, pick "Install" in its menu, and type `erase`.

**Parallels** also works (File, New, "Install Windows, Linux or macOS from an image file", the arm64 ISO, then
"Other Linux"), with Secure Boot off.

**A real machine**: write the ISO to a USB stick (`dd if=gurtos-server-x86_64.iso of=/dev/sdX bs=4M`) and start
from it. Secure Boot must be off: the boot loader is not signed.

## How updates work

The installer splits the disk into five parts:

| Partition | Label | Holds |
|---|---|---|
| BIOS boot, 1 MB (x86) | `box-bios` | GRUB, for BIOS machines like Vultr |
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
verify against `/etc/box-os/update.pub`, the build VM's key, baked into the image. That key stays on the build
VM in `/var/lib/box-image/update-signing.key`. Images from another build VM will not install. An update must be
the same edition: a Personal system updated with a Server image would lose its desktop.

What lives on the data partition, bind-mounted in place: `/var/lib/box` (the action log, workspaces, tasks),
`/etc/box` (the vault and the box's identity key), `/var/lib/spacetimedb`, `/root/.config/spacetime` (the identity
that owns the box's SpacetimeDB database), and `/var/log/journal`, so logs from a failed update are still there
after the rollback. An update also copies over `/etc/machine-id`, SSH host keys, and the task users core made
(`box-*`, uids 30000 to 39999), so a resumed task keeps its uid.

**Trade-offs, written down:**
- The slots are plain writable ext4, not read-only or verified (no dm-verity). Changes made by hand inside a
  running slot are lost at the next update, by design.
- A system that hangs instead of panicking or failing its health check stays hung until someone restarts it.
  A hardware watchdog would cover that; VMs do not all have one.
- The GRUB menu on the ESP is written once at install and never updated. A change to the boot menu itself
  needs a reinstall.
- The two 6 GB slots cost 12 GB of disk (24 GB on Personal).
- Updates are signed with one ed25519 key on one build VM. There is no key rotation and no rollback protection
  (an old signed image installs fine).

## Network and firewall

`/etc/nftables.conf` drops everything coming in except replies to the box's own connections, ping and DHCP. On
GurtOS Server the box's API and portal (port 7700) are also open to private networks (10/8, 172.16/12,
192.168/16, Tailscale's 100.64/10, link-local, IPv6 ULA), so a phone on the same network can pair; the box
listens on every address and sets `BOX_URL` to its own address at each start (`box-env`), so the pairing QR code
opens on the phone. Never from the public internet: every request that does not come from the box itself
already needs a paired phone's token (core's "Who may reach the API"), and the firewall keeps it that way one
layer further out. SpacetimeDB (port 3000) is never open to the network; the portal falls back to the API's log
stream. GurtOS Personal keeps the
API on `127.0.0.1`. Debug builds also open ssh (22). The time zone is Pacific (`BOX_TIMEZONE` at build time
changes it; Personal's own setup asks).

## GurtOS Personal

`image/build personal` makes the same disc, installer, A/B slots and updates, with a desktop in place of the
kiosk:

- **Ubuntu's GNOME desktop**, `ubuntu-desktop-minimal` plus the parts Ubuntu only recommends (NetworkManager,
  the terminal, text editor, keyring, Yaru themes). No snaps: Ubuntu's Firefox is a snap, which cannot be built
  into an image, so the browser is GNOME Web.
- **First boot runs GNOME's own setup** (`gnome-initial-setup`, started by GDM because the machine has no
  account yet). The account it makes is an administrator, so that person is in the `sudo` group. Root's password
  stays locked. The box's task users (`box-*`) are never in `sudo`.
- **The box service** is the same as on Server, from `core/install.sh`. Its screen is the desktop's, not a kiosk.
- **The Box desktop layer** comes from `personal/install.sh`, owned by the Personal thread. See the hook below.
- **The computer's name** is `gurt-<id>` until the person names it in Settings.

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

With `image/test` in QEMU on linuxbox, Oct 24:
- Server, x86_64, with BIOS (like Vultr) and with UEFI: installs on a blank 24 GB disk in about a minute, starts
  healthy with every track loaded, shows the portal's box screen, and survives the disc being removed and the
  power cut.
- Server, x86_64 debug build: an update to slot B is confirmed, and a broken update (its box service never
  starts) rolls back to slot B by itself after the 5-minute health check.
- Server, arm64, emulated with UEFI: installs, starts healthy, shows the screen, and survives the disc being
  removed and the power cut. It has not run on real Apple hardware or in UTM yet.
- The installer also finds the disc on a USB CD drive.
- Both editions report `PRETTY_NAME="GurtOS <edition> <version>"`, `ID=gurtos`, `ID_LIKE=ubuntu`, a
  `gurt-<id>` hostname, and boot menus that say GurtOS.
- Personal, x86_64 debug build, with the Personal thread's committed `personal/install.sh`: installs on a blank
  40 GB disk, shows GNOME's first-boot welcome, and survives the disc being removed and the power cut. An account
  made the way GNOME's setup makes one (AccountsService, administrator) lands in `sudo`; no task user does. After
  an update to slot B that account, its sudo and its files are still there, and GDM asks for a login instead of
  running setup again. A broken update rolls back by itself.

On Vultr (by the QA thread, Oct 23, release ISO built 21:34 PT): the ISO installed on a blank 160 GB disk with
BIOS in about 3 minutes from the disc booting to the box's screen, came back about 25 s after a hard power-off,
and the disc started the box from disk when it was already installed.

Not tested: Parallels, a real PC, the kernel-panic path of a bad update, an update fetched by URL,
clicking through GNOME's setup by hand, the Box desktop layer running in a logged-in session, and Personal on
arm64.

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
  `core/setup.sh`) are installed in the image. Node 24, Droid and SpacetimeDB come from `core/setup.sh`.
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
| `test` | Boot test in QEMU on linuxbox: install, health, power cut, update, rollback |
| `iso-grub.cfg` | The install disc's menu |
| `rootfs/usr/local/sbin/box-install` | The installer (partitions, slot A, GRUB) |
| `rootfs/usr/local/sbin/box-update` | Updates, rollback, and the health check at every start |
| `rootfs/usr/local/sbin/box-firstboot` | First-boot setup |
| `rootfs/usr/local/lib/box-os/` | The disk's GRUB menu and the kiosk browser |
| `rootfs/etc/initramfs-tools/` | The live boot method for the install disc |
| `rootfs/etc/systemd/` | The services, and drop-ins that put core's services on the data partition |
| `rootfs-personal/` | Personal only: its fstab, GDM's first-boot setup, NetworkManager, the update carry-over |
