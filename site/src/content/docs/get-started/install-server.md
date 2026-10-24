---
title: Install GurtOS Server
description: Install GurtOS Server from its ISO on a real machine from USB, in UTM or QEMU, or on a cloud instance that boots custom ISOs.
sidebar:
  badge:
    text: Preview
    variant: note
---

The GurtOS ISO is one disc image. Start a machine from it and it installs GurtOS on the machine's disk, then restarts
into the box. There is no desktop, no login prompt and no human account. The screen shows the portal's box screen.

This page covers getting the ISO and installing it four ways: a real machine, UTM on a Mac, QEMU on Linux, and a
cloud instance. If you would rather keep an existing Ubuntu system, see [Install on Ubuntu](/get-started/install-on-ubuntu/).

:::caution[Preview]
In this release a standard (release) build has no way to add keys to the vault or to open the API to your network,
because it has no shell and the portal has no settings screen for them yet. To run real agent tasks today, use a
**debug build** (below) or [install on Ubuntu](/get-started/install-on-ubuntu/). A setup screen in the portal is
[planned](/project/roadmap/).
:::

## Requirements

| | Minimum | Recommended |
|---|---|---|
| CPU | x86_64 or arm64 | 4 cores |
| Memory | 4 GB | 8 GB or more. Each task may use up to 2 GB. |
| Disk | 17 GB | 32 GB. The two system slots take 12 GB. |
| Firmware | BIOS or UEFI, with **Secure Boot off** | |
| Network | A wired connection with DHCP | |

Secure Boot must be off because the box's boot loader is not signed. The box configures every wired network card
with DHCP. Wi-Fi is not set up.

:::danger
Installing erases the target disk. A blank disk is used straight away. A disk with anything on it is erased only
after you type `erase` on the screen, but check which machine you are booting before you do.
:::

## Get the ISO

GurtOS has no public downloads yet. If you have the source, build the ISO on any Ubuntu 24.04 machine or VM where
you have root. The build runs there, not on your own computer:

```sh
BUILD_SHELL='ssh my-build-vm' image/build          # x86_64 ISO: about 12 minutes the first time, 3 after
BUILD_SHELL='ssh my-build-vm' image/build arm64    # arm64 ISO, for Apple silicon and arm64 servers
```

An x86_64 ISO needs an x86_64 build machine. An arm64 ISO builds natively on arm64 in about 20 minutes, or under
emulation on x86_64 in about an hour. The results stay on the build machine in `/var/lib/box-image/out/`:

| File | What it is |
|---|---|
| `box-<arch>.iso` | The install disc. Boots BIOS and UEFI. Also runs as a live system. |
| `root-<arch>.sqfs` | The whole system as one image. It is on the disc, and it is also the update file. |
| `root-<arch>.sqfs.sha256`, `.sig` | Its hash, and the hash signed with the build machine's update key |

`BOX_SSH_KEY=~/.ssh/id_ed25519.pub` makes a **debug build**. It adds an SSH server and lets that key log in as root.
Use it while the portal cannot yet set keys. A debug build is named `<arch>-debug` and says so in
`/etc/box-os/release`, so it cannot be mistaken for a release.

Only images signed by the same build machine can update a box later. See [System updates](/concepts/system-updates/).

## Install on a real machine

1. Write the ISO to a USB stick. This erases the stick. Replace `/dev/sdX` with your stick's device:

   ```sh
   sudo dd if=box-x86_64.iso of=/dev/sdX bs=4M status=progress conv=fsync
   ```

2. Turn Secure Boot off in the machine's firmware settings.
3. Start the machine from the USB stick.
4. The disc's menu waits 5 seconds, then installs. On a blank disk it starts at once. On a disk with data, type
   `erase` when asked.
5. Installing takes about a minute. The machine restarts into the box. Remove the USB stick.

## Install in UTM on a Mac

UTM runs the arm64 ISO on Apple silicon at close to native speed.

1. In UTM, choose **Create a New Virtual Machine**, then **Virtualize**. Emulation is about 10 times slower.
2. Operating system: **Linux**. Leave **Use Apple Virtualization** off. Boot ISO image: `box-arm64.iso`.
3. Memory 4096 MB, 4 CPU cores. Leave **Enable hardware OpenGL acceleration** off; the box's screen draws in
   software. Storage: 32 GB. Skip the shared directory.
4. Before you start it, open the VM's settings. If UTM shows a Secure Boot option, turn it off.
5. Start the VM. The menu waits 5 seconds and installs on the empty disk in about a minute, then restarts into
   the box.

To start over, delete the VM's disk, or start from the ISO, pick **Install** in its menu, and type `erase`.

Parallels also works: **File**, **New**, **Install Windows, Linux or macOS from an image file**, choose
`box-arm64.iso`, then **Other Linux**, with Secure Boot off.

## Install in QEMU on Linux

On an x86_64 Linux host with KVM:

```sh
qemu-img create -f qcow2 box.qcow2 32G
qemu-system-x86_64 -machine q35 -enable-kvm -cpu host -m 4096 -smp 4 \
  -drive if=none,id=cd,media=cdrom,readonly=on,file=box-x86_64.iso \
  -device ide-cd,drive=cd,bootindex=0 \
  -drive if=none,id=hd,file=box.qcow2 -device virtio-blk-pci,drive=hd,bootindex=1 \
  -nic user,model=virtio-net-pci -device virtio-vga
```

The disc boots first, installs on `box.qcow2`, and restarts. After the first install the disc's menu starts the
box that is already on the disk, so you can leave the ISO attached or remove the two `cd` lines.

To test UEFI instead of BIOS, add the OVMF firmware your distribution ships (`-drive if=pflash,...`).

## Install on a cloud instance

Any provider that boots a custom ISO works. On Vultr:

1. Put the ISO at a URL the provider can download from.
2. In the Vultr console, open **Orchestration**, then **ISOs**, then **Add ISO**, and paste the URL.
3. Deploy a **Cloud Compute** instance with that ISO as its image and at least 25 GB of disk.
4. Open the instance's console. It installs, restarts, and shows the portal's box screen.
5. Detach the ISO afterwards, or leave it. Either way the box starts from its disk.

:::caution
A cloud instance has a public address. The box's API listens on `127.0.0.1` only, but SpacetimeDB listens on
port 3000 on every interface. Block port 3000 in the provider's firewall unless you have put an authenticating
proxy in front of it. See the [threat model](/security/threat-model/).
:::

## Check the install

When the box is up, its screen shows the portal's box screen: the home screen with its widgets, the app grid and the
dock. The box names itself `box-<id>`, from its own key.

On a debug build you can also log in over SSH and ask the box directly:

```sh
ssh root@192.0.2.10 'curl -s 127.0.0.1:7700/api/health'
```

```json
{"ok":true,"startedAt":"2026-10-24T07:00:00.000Z","resumed":[],"tasks":0,"tools":["..."],"spacetime":{"port":3000,"database":"box"}}
```

## What has been tested

The installer, first start, power-cut recovery and updates are tested in QEMU: x86_64 with BIOS and with UEFI, an
x86_64 update that is kept and a broken one that rolls back by itself, and arm64 under emulation with UEFI.
UTM, Parallels, Vultr and real PCs follow the same steps but have not been tested yet.

Next, set the box up: [First boot and pairing](/get-started/first-boot/).

## Related

- [Install on Ubuntu](/get-started/install-on-ubuntu/)
- [First boot and pairing](/get-started/first-boot/)
- [Disk layout and updates](/reference/disk-layout/)
- [System updates](/concepts/system-updates/)
