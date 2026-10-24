# The box OS

This folder builds the **Server edition** (see Editions in `CLAUDE.md`): it turns a fresh machine into the box. "Ubuntu plus our stuff" means you install Ubuntu, log in, and run
`core/install.sh`. The box OS is one disc you start a machine from, and what comes up is the box: no desktop,
no login prompt, no human account. The screen shows the box's own page. The system updates as a whole and
rolls itself back if a new version is not healthy.

## Build it

```
image/build              # x86_64 ISO: about 12 minutes the first time, 3 after that
image/build arm64        # arm64 ISO for UTM on a Mac: cross-built under emulation, about an hour
image/build all          # both
BUILD_SHELL='ssh benmac /opt/homebrew/bin/limactl shell box --' image/build arm64
                         # arm64 built natively in the laptop's Lima VM: about 20 minutes, most of it downloads
```

It ships this checkout to the build VM (`ssh vultrbox`; any Ubuntu 24.04 VM with root works:
`BUILD_SHELL='ssh my-vm' image/build`) and builds there as root. Never run it on linuxbox itself. The outputs stay
on the build VM in `/var/lib/box-image/out/`:

| File | What |
|---|---|
| `box-<arch>.iso` | The install disc. Boots BIOS and UEFI. Also a live system. |
| `root-<arch>.sqfs` | The whole system as one image. It is on the disc, and it is also the update file. |
| `root-<arch>.sqfs.sha256`, `.sig` | Its hash, and the hash signed with the build VM's update key |

The first build caches Ubuntu plus the box's dependencies in `/var/lib/box-image/<arch>/base-*`. That cache is
rebuilt only when the package list in `build` or `core/setup.sh` changes.

`BOX_SSH_KEY=~/.ssh/id_ed25519.pub image/build` makes a **debug build**:
it adds sshd and lets that key log in as root. Release builds have no sshd.

## Start it

The disc's menu waits 5 seconds. On a machine with no box yet, it installs. On a machine that already has the box
on its disk, it starts that. A blank disk is used straight away. A disk with anything on it is erased only after
someone types `erase` on the screen. The installer then restarts into the box, and the screen shows the portal's
box screen.

**linuxbox, in a VM** (no root): `image/test` fetches the ISO, installs it on an empty QEMU disk, restarts into
the box and waits for it to report healthy on the serial console. Then it removes the disc and pulls the plug,
and the box must come back from its own disk, healthy, with the same identity. It saves screenshots of the box's
screen. `--uefi` uses UEFI firmware instead of BIOS. `--arm64` tests the arm64 ISO, emulated, so about 5 times
slower. `--debug` tests a debug build and adds a system update to slot B and a broken update that must roll
back by itself.

**Vultr**: put the ISO at a URL (for example on the build VM:
`cd /var/lib/box-image/out && python3 -m http.server 8080`, then `http://<build-vm-ip>:8080/box-x86_64.iso`).
In Vultr: Orchestration, ISOs, Add ISO, paste the URL. Deploy a Cloud Compute instance with that ISO as its
image (at least 25 GB of disk). Open the instance's console: it installs, restarts, and shows the box. Detach
the ISO afterwards or leave it; either way the box starts from its disk.

**UTM on a Mac** (Apple silicon), the quickest way to try it:
1. In UTM: Create a New Virtual Machine, then **Virtualize** (not Emulate: emulation is about 10 times slower).
2. Operating System: **Linux**. Leave "Use Apple Virtualization" off. Boot ISO Image: `box-arm64.iso`.
3. Memory 4096 MB, 4 CPU cores. Leave "Enable hardware OpenGL acceleration" off: the box's screen draws in
   software. Storage 32 GB (it needs at least 17 GB). Skip the shared directory.
4. Before you start it, open the VM's settings. If UTM shows a Secure Boot option, turn it off: the box's boot
   loader is not signed.
5. Start it. The menu waits 5 seconds and installs on the empty disk (about a minute), then restarts into the
   box. The screen shows the portal's box screen. To pair a phone, open Settings there.
6. To start over, delete the VM's disk. Or start from the ISO, pick "Install" in its menu, and type `erase`.

**Parallels** also works (File, New, "Install Windows, Linux or macOS from an image file", `box-arm64.iso`, then
"Other Linux"), with Secure Boot off.

**A real machine**: write the ISO to a USB stick (`dd if=box-x86_64.iso of=/dev/sdX bs=4M`) and start from it.
Secure Boot must be off: the box's boot loader is not signed.

## How updates work

The installer splits the disk into five parts:

| Partition | Label | Holds |
|---|---|---|
| BIOS boot, 1 MB (x86) | `box-bios` | GRUB, for BIOS machines like Vultr |
| ESP, 512 MB | `BOX-ESP` | GRUB, its menu, and `grubenv`, which says which slot starts |
| System slot A, 6 GB | `box-a` | A whole system: kernel, Ubuntu, the box service |
| System slot B, 6 GB | `box-b` | The other system. Empty until the first update. |
| Data, the rest | `box-data` | Everything that must outlive an update |

The box runs from one slot. `box-update apply <file or URL>` checks the update's signature and hash, writes it
to the other slot, and restarts. GRUB starts the new slot **once** (`next_entry` in `grubenv`, which GRUB clears
as it uses it). At every start, `box-confirm.service` waits up to 5 minutes for the box's `/health`. If the new
system is healthy, it becomes the default. If not, the box restarts and GRUB starts the old slot, because the
default never changed. A new kernel that panics restarts by itself after 10 seconds (`panic=10`) and lands on
the old slot the same way.

```
box-update status                       # which slot runs, what the other holds, the last update's result
box-update apply https://host/root-x86_64.sqfs
box-update rollback                     # make the other slot the default again
```

The update image is the same `root-<arch>.sqfs` the build makes, fetched with its `.sha256` and `.sig`. The
signature must verify against `/etc/box-os/update.pub`, the build VM's key, baked into the image. That key stays
on the build VM in `/var/lib/box-image/update-signing.key`. Images from another build VM will not install.

What lives on the data partition, bind-mounted in place: `/var/lib/box` (the action log, workspaces, tasks),
`/etc/box` (the vault and the box's identity key), `/var/lib/spacetimedb`,
`/root/.config/spacetime` (the identity that owns the box's SpacetimeDB database), and `/var/log/journal`, so
logs from a failed update are still there after the rollback. An update also copies over `/etc/machine-id`, SSH
host keys, and the task users core made (`box-*`, uids 30000 to 39999), so a resumed task keeps its uid.

**Trade-offs, written down:**
- The slots are plain writable ext4, not read-only or verified (no dm-verity). Changes made by hand inside a
  running slot are lost at the next update, by design.
- A system that hangs instead of panicking or failing its health check stays hung until someone restarts it.
  A hardware watchdog would cover that; VMs do not all have one.
- The GRUB menu on the ESP is written once at install and never updated. A change to the boot menu itself
  needs a reinstall.
- The two 6 GB slots cost 12 GB of disk. The minimum disk is about 17 GB.
- Updates are signed with one ed25519 key on one build VM. There is no key rotation and no rollback protection
  (an old signed image installs fine).

## Tested

With `image/test` in QEMU on linuxbox, Oct 24:
- x86_64 with BIOS (like Vultr) and with UEFI: installs on a blank 24 GB disk in about a minute, starts healthy
  with every track loaded, shows the portal's box screen, and survives the disc being removed and the power cut.
- x86_64 debug build: an update to slot B is confirmed, and a broken update (its box service never starts) rolls
  back to slot B by itself after the 5-minute health check.
- arm64, emulated with UEFI: installs, starts healthy, shows the screen, and survives the disc being removed and
  the power cut. It has not run on real Apple hardware or in UTM yet.
- The installer also finds the disc on a USB CD drive.

Not tested: Vultr itself, Parallels, a real PC, the kernel-panic path of a bad update, and an update fetched by URL.

## What is different from stock Ubuntu

Stock Ubuntu Server 24.04 has a login prompt, a user with sudo, snapd, cloud-init and apt upgrades. The box OS:

- **Is built from 40 named packages** (`packages` in `build`), 440 with their dependencies, by mmdebstrap
  instead of the Ubuntu installer. There is no snapd, cloud-init, sudo, desktop, apport, unattended-upgrades,
  man pages, or apt: the box only ever updates as a whole system image.
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
  vault in `/etc/box` on the data partition. The box's hostname is `box-<id>`, from that key, and core uses it as
  the box's id, so two boxes never share a name. Pairing a phone is core's (`POST /api/pair/new`), from the
  portal's Settings.
- **Has an A/B disk layout, a static GRUB menu and `box-update`** (above), instead of grub-mkconfig and apt.
- **Boots its install disc live**, with a custom initramfs boot method (`boot=boxlive`): the disc's squashfs
  is a read-only root with a RAM layer on top.
- **Networking** is systemd-networkd with DHCP on every wired card (no netplan).

Every file the image adds is in `rootfs/`, at the path it gets on the box.

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
| `rootfs/etc/systemd/` | The box OS's services, and drop-ins that put core's services on the data partition |
