---
title: Install GurtOS Server
description: Install GurtOS Server from its ISO on a real machine from USB, in UTM or QEMU, or on a cloud instance that boots custom ISOs.
sidebar:
  badge:
    text: Preview
    variant: note
---

The GurtOS Server ISO is one disc image. Start a machine from it and it installs GurtOS Server on the machine's disk,
then restarts into the box. There is no desktop, no login prompt and no human account. The screen shows the portal's
box screen. For GurtOS on your own desktop computer, see [Install GurtOS Personal](/docs/get-started/install-personal/).

This page covers getting the ISO and installing it four ways: a real machine, UTM on a Mac, QEMU on Linux, and a
cloud instance. If you would rather keep an existing Ubuntu system, see [Install on Ubuntu](/docs/get-started/install-on-ubuntu/).

:::note[What you need]
One model key, so agents can think: an **Anthropic API key** from
[console.anthropic.com](https://console.anthropic.com), or a **Factory API key** from
[app.factory.ai](https://app.factory.ai). Either is enough. Every app (Jira, Elastic, Apify, the wallet and the rest)
is optional and stays off until you add its keys.
:::

## Requirements

| | Minimum | Recommended |
|---|---|---|
| CPU | x86_64 or arm64 | 4 cores |
| Memory | 4 GB | 8 GB or more. Each task may use up to 2 GB. |
| Disk | 20 GB | 32 GB. The two system slots take 12 GB. |
| Firmware | BIOS or UEFI, with **Secure Boot off** | |
| Network | A wired connection with DHCP, and internet on first start: the box downloads Factory's Droid CLI then | |

Secure Boot must be off because the box's boot loader is not signed. The box configures every wired network card
with DHCP. Wi-Fi is not set up.

:::danger
Installing erases the target disk. A blank disk is used straight away. A disk with anything on it is erased only
after you type `erase` on the screen, but check which machine you are booting before you do.
:::

## Get the ISO

Download the ISO from the [Download](/download/) page. Use `gurtos-server-x86_64.iso` for a PC or an x86_64 cloud
instance, and `gurtos-server-arm64.iso` for a Mac with Apple silicon in UTM or an arm64 machine. Check its checksum
before you use it; the Download page shows how.

### Build it yourself

You can also build the ISO from the [source](https://github.com/benz16107/calhacks13) on any Ubuntu 24.04 machine or
VM where you have root. The build runs there, not on your own computer:

```sh
git clone https://github.com/benz16107/calhacks13.git gurtos && cd gurtos
BUILD_SHELL='ssh my-build-vm' image/build          # GurtOS Server, x86_64: about 12 minutes the first time, 3 after
BUILD_SHELL='ssh my-build-vm' image/build arm64    # GurtOS Server, arm64, for Apple silicon and arm64 servers
```

An x86_64 ISO needs an x86_64 build machine. An arm64 ISO builds natively on arm64 in about 20 minutes, or under
emulation on x86_64 in about an hour. The results stay on the build machine in `/var/lib/box-image/out/`:

| File | What it is |
|---|---|
| `gurtos-server-<arch>.iso` | The install disc, for example `gurtos-server-x86_64.iso`. Boots BIOS and UEFI. Also runs as a live system. |
| `gurtos-server-<arch>.sqfs` | The whole system as one image. It is on the disc, and it is also the update file. |
| `gurtos-server-<arch>.sqfs.sha256`, `.sig` | Its hash, and the hash signed with the build machine's update key |

`BOX_SSH_KEY=~/.ssh/id_ed25519.pub` makes a **debug build**. It adds an SSH server and lets that key log in as root,
for development. A debug build is named with `-debug`, for example
`gurtos-server-x86_64-debug.iso`, and says so in `/etc/box-os/release`, so it cannot be mistaken for a release.

Only images signed by the same build key can update a box later. See [System updates](/docs/concepts/system-updates/).

## Install on a real machine

1. Write the ISO to a USB stick. This erases the stick. Replace `/dev/sdX` with your stick's device:

   ```sh
   sudo dd if=gurtos-server-x86_64.iso of=/dev/sdX bs=4M status=progress conv=fsync
   ```

2. Turn Secure Boot off in the machine's firmware settings.
3. Start the machine from the USB stick.
4. The disc's menu waits 5 seconds, then installs. On a blank disk it starts at once. On a disk with data, type
   `erase` when asked. If GurtOS is already on the disk, the menu waits 30 seconds and then starts it; pick
   **Install** in that time to install again.
5. Installing takes about a minute. The machine restarts into the box. Remove the USB stick.

## Install in UTM on a Mac

UTM runs the arm64 ISO on Apple silicon at close to native speed.

1. In UTM, choose **Create a New Virtual Machine**, then **Virtualize**. Emulation is about 10 times slower.
2. Operating system: **Linux**. Leave **Use Apple Virtualization** off. Boot ISO image: `gurtos-server-arm64.iso`.
3. Memory 4096 MB, 4 CPU cores. Leave **Enable hardware OpenGL acceleration** off; the box's screen draws in
   software. Storage: 32 GB. Skip the shared directory.
4. Before you start it, open the VM's settings. If UTM shows a Secure Boot option, turn it off.
5. Start the VM. The menu waits 5 seconds and installs on the empty disk in about a minute, then restarts into
   the box.

To start over, delete the VM's disk, or start from the ISO, pick **Install** in its menu, and type `erase`.

Parallels also works: **File**, **New**, **Install Windows, Linux or macOS from an image file**, choose
`gurtos-server-arm64.iso`, then **Other Linux**, with Secure Boot off.

## Install in QEMU on Linux

On an x86_64 Linux host with KVM:

```sh
qemu-img create -f qcow2 box.qcow2 32G
qemu-system-x86_64 -machine q35 -enable-kvm -cpu host -m 4096 -smp 4 \
  -drive if=none,id=cd,media=cdrom,readonly=on,file=gurtos-server-x86_64.iso \
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
4. Open the instance's console. A new Vultr instance first shows iPXE ("Please mount an ISO") for about a minute
   while the ISO attaches, then restarts into the disc by itself. The installer's screen stays dark for a minute or
   two, then shows a progress bar. From the disc's menu to the box's screen takes about 3 minutes.
5. Detach the ISO afterwards. The box starts from its disk either way, but with the ISO attached every start waits
   30 seconds at the disc's menu.

:::caution
The box's firewall lets its API (port 7700) in from private networks only, and SpacetimeDB from nowhere. A cloud
instance with only a public address is therefore out of reach from your phone or laptop. Use the provider's
console, or put the box on a private network such as Tailscale. See
[Approve from your phone](/docs/guides/approve-from-your-phone/).
:::

## Set it up

The first time the box starts, its screen runs the setup wizard: network, the box's name and time zone, who owns the
box (pair your phone, or keep the owner on this screen), the model key, what agents may do, which apps to turn on and
their keys, updates, privacy and appearance. You can change all of it later in **Settings**.

Paste your Anthropic or Factory key at the **AI models** step. It goes straight into the vault, and no screen shows it
again. If you skip it, tasks cannot run until you add a key in **Settings**, **Accounts & Keys**.

**On a cloud instance, run setup in the provider's web console.** The box's firewall lets its API in only from
private networks, so a cloud instance with only a public address cannot be reached from your browser or phone.
The console shows the box's own screen. Use the keyboard and mouse there to finish setup. To reach the box from a
phone afterwards, put both on a private network such as Tailscale.

## Check the install

After setup, the screen shows the GurtOS desktop: widgets for what needs you and what is running, and a dock. Its clock uses Pacific time. The box names itself `gurt-<id>`, from the first 6 hex digits of a hash of its own key, for example
`gurt-bf07fe`.

On a debug build you can also log in over SSH and ask the box directly:

```sh
ssh root@192.0.2.10 'curl -s 127.0.0.1:7700/api/health'
```

```json
{"ok":true,"startedAt":"2026-10-24T07:00:00.000Z","resumed":[],"tasks":0,"tools":["..."],"spacetime":{"port":3000,"database":"box"}}
```

## What has been tested

The installer, first start, power-cut recovery and updates are tested in QEMU: x86_64 with BIOS and with UEFI, an
x86_64 update that is kept and a broken one that rolls back by itself, and arm64 under emulation with UEFI. A
release ISO has also been installed on a Vultr instance with BIOS: from a blank disk to the box's screen in about
3 minutes, and back on screen about 25 seconds after a hard power-off. UTM, Parallels and real PCs follow the same
steps but have not been tested yet.

Next: [First boot and pairing](/docs/get-started/first-boot/) explains what the box set up, and how to pair more phones.

## Related

- [Install on Ubuntu](/docs/get-started/install-on-ubuntu/)
- [First boot and pairing](/docs/get-started/first-boot/)
- [Disk layout and updates](/docs/reference/disk-layout/)
- [System updates](/docs/concepts/system-updates/)
