---
title: Install GurtOS Personal
description: Install GurtOS Personal from its ISO on your own computer. You get Ubuntu's GNOME desktop with your own account, and agents work beside you as separate users.
sidebar:
  label: Install GurtOS Personal
  badge:
    text: Preview
    variant: note
---

GurtOS Personal is GurtOS on your own laptop or desktop. You use it as a normal computer, with Ubuntu's GNOME desktop
and your own account with `sudo`. Agents work beside you as separate users without `sudo`, on copies of your
folders, and nothing in your folders changes until you choose **Keep**.

It installs from its own ISO, like [GurtOS Server](/docs/get-started/install-server/), and updates the same way: the
whole system at once, with an automatic rollback if the new system is not healthy.

:::caution[Preview]
GurtOS Personal installs and runs, and has been walked end to end on a fresh install. It has not run on a real
laptop yet. See [What is not finished](#what-is-not-finished).
:::

## Requirements

| | Minimum | Recommended |
|---|---|---|
| CPU | x86_64 or arm64 | 4 cores |
| Memory | 4 GB | 8 GB or more. The desktop needs room, and each task may use up to 2 GB. |
| Disk | 29 GB | 48 GB. The two system slots take 24 GB. |
| Firmware | BIOS or UEFI on x86_64, UEFI on arm64, with **Secure Boot off** | |
| Network | Wired or Wi-Fi, with internet on first start: the computer downloads Factory's Droid CLI (about 300 MB) then, and the voice model for **Talk to your computer** | |

The installer refuses a disk smaller than 29 GB. The arm64 image builds natively. An arm64 test disc was installed in
a VM on a Mac, but the published Personal arm64 ISO has not been booted.

:::danger
The installer takes the whole disk. Dual boot with another operating system is not supported. The installer never
offers the disc or USB stick it started from. With one empty internal disk it uses that disk at once. With several
disks it lists them and asks for a number. A disk that holds data, and any USB or removable disk, is erased only after
you type `erase` on the screen. Back up first.
:::

## Get the ISO

Download `gurtos-personal-x86_64.iso` (Intel or AMD, 2.00 GB), or `gurtos-personal-arm64.iso` (Apple silicon in UTM
or Parallels, 1.99 GB), from the [Download](/download/) page and check its checksum. Sizes are for the v0.2.0-preview
release.

Or build it from the [source](https://github.com/benz16107/gurtos) on an Ubuntu 24.04 build machine where you
have root:

```sh
BUILD_SHELL='ssh my-build-vm' image/build personal          # gurtos-personal-x86_64.iso
BUILD_SHELL='ssh my-build-vm' image/build personal arm64    # gurtos-personal-arm64.iso
```

The build leaves `gurtos-personal-<arch>.iso` and its update file `gurtos-personal-<arch>.sqfs` (with `.sha256` and
`.sig`) in `/var/lib/box-image/out/` on the build machine. With `BOX_SSH_KEY` it makes a debug build named with
`-debug`.

## Install

1. Write the ISO to a USB stick, or attach it to a virtual machine, and start from it. The steps are the same as for
   [GurtOS Server](/docs/get-started/install-server/#install-on-a-real-machine): Secure Boot off, then start from the disc.
2. The disc's menu says GurtOS Personal and waits 5 seconds, then installs. Answer the installer's questions if it
   asks any: a number to pick a disk when there are several, and `erase` for a disk with data or a USB disk. The
   installer's screen says it takes about 2 minutes.
3. The machine restarts into GNOME's own first-boot setup: language, keyboard, time zone, your name and a password.
   The account it makes is an administrator, so it is in the `sudo` group.
4. As soon as that account exists, GurtOS makes it the box's **owner**. Only the owner can hand folders
   to agents, keep their changes and change settings.
5. Log in. After GNOME's welcome, **GurtOS Setup** opens. It has six steps: **Welcome**, **AI models**, **Folders**,
   **Permissions**, **Pair a phone** and **Done**. The first Setup turns the Find app on and every other app off. You
   turn on more in GurtOS Settings, then **Apps**. GurtOS is in the dock, and its indicator is in the top bar.

## Add your model key

Agents need one model key: an **Anthropic API key** from [console.anthropic.com](https://console.anthropic.com), or a
**Factory API key** from [app.factory.ai](https://app.factory.ai). Paste it at Setup's **AI models** step and press
Enter. GurtOS checks an Anthropic key with one call to Anthropic and says if it was refused. To add or replace a key
later, choose **GurtOS Settings** in the top-bar menu, then **Agents** (the model key) or **Accounts & Keys** (every key). The key
never shows on screen again, and agents never see it. Apps are optional and off until you turn them on in
**Apps**, and the apps that need a key say which.

If you start a task before adding a key, it fails at once, and a notification asks you to add a model key in Settings.

## Use it

Right-click a folder in Files and choose **New Agent Task…**. Describe the job and set a budget. The agent works on a
copy of the folder as its own user.

![Files with a folder's menu open, showing New Agent Task…, and Keep Changes and Undo Task for a task that is waiting for you.](../../../../assets/screens/personal-files-ask.png)

*New Agent Task in Files. Keep Changes and Undo Task appear while a task's changes wait for you.*

Requests for your OK arrive as notifications with **Deny** and **Approve**, and wait under **Needs you** in the GurtOS app. The log records your answer as
`desktop:<your user name>`.

![A GurtOS notification asking to approve a $2.99 renewal, with Deny and Approve, and the GurtOS app listing two requests under Needs you.](../../../../assets/screens/personal-approval.png)

*A request as a notification, and both requests under Needs you in the GurtOS app. Amounts are test money.*

When the task is done, it waits under **Ready to review**. Its page shows what changed, line by line, and what the task
could reach. **Keep changes** writes the changes into your folder; **Undo task** throws them away. Your folder is
untouched until you choose.

![The GurtOS app's page for the task Add October's receipts to the budget: one changed file, what it can reach, its steps, and Undo task and Keep changes buttons.](../../../../assets/screens/personal-review.png)

*A finished task on its page in the GurtOS app.*

See [Give an agent a folder, then keep or undo](/docs/guides/keep-or-undo/) for the details, including undoing a Keep.

## What updates keep

GurtOS Personal updates the whole system, like Server, and rolls back by itself if the new system is not healthy.
See [System updates](/docs/concepts/system-updates/).

An update keeps your files, your account and its `sudo` membership, other people's accounts, Wi-Fi and network
connections, Bluetooth pairings, time zone, language, the computer's name and login settings.

Software you install yourself with `apt`, and other changes outside your home folder and those settings, are gone
after the next system update, because the update replaces the whole system. Ubuntu's Software Updater is still
installed and can update the running system, but the next GurtOS update replaces that too.

## What is not finished

- **Phones.** The box listens on every address and tells a phone its own address when it starts, so a phone on the same
  network can pair. A laptop that moves to another network keeps showing the old address in the pairing code until
  the box restarts (`sudo systemctl restart box.service`). GurtOS Setup's **Pair a phone** step shows a code only when a
  phone can reach the computer. See [Approve from your phone](/docs/guides/approve-from-your-phone/).
- **Testing.** Personal x86_64 installs, comes up healthy and survives a power cut in a virtual machine. An arm64 test
  disc was installed in a VM on a Mac. Neither has run on a real laptop.

## Related

- [Give an agent a folder, then keep or undo](/docs/guides/keep-or-undo/)
- [Editions](/docs/introduction/editions/)
- [Agents as their own users](/docs/concepts/agent-users/)
- [Roadmap](/docs/project/roadmap/)
