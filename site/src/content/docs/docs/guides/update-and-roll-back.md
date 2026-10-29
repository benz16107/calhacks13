---
title: Update and roll back
description: Install a signed system update on a box, let it prove itself healthy, and roll back to the previous system if you need to.
---

A machine installed from a GurtOS ISO, Server or Personal, holds two complete systems on its disk, in slots A and B. It runs from one. An update is written to the other slot and started once on trial. It becomes the default only if the box comes up healthy within 5 minutes. In this guide you check which system runs, apply an update, and roll back.

The commands here need a root shell, so they work on GurtOS Personal and on a Server debug build. A release build of GurtOS Server has no shell and no API that applies an update, so it moves to a new release only by reinstalling, which erases its disk.

A box installed on Ubuntu updates differently. See [Update a box installed on Ubuntu](#update-a-box-installed-on-ubuntu) below.

## Before you start

- A machine installed from a GurtOS ISO, and a root shell on it. On GurtOS Personal, open a terminal and use `sudo`. On GurtOS Server, a **debug build** (`gurtos-server-<arch>-debug.iso`) has SSH for root. A release build of GurtOS Server has no shell, so it cannot run `box-update`. It moves to a new release only by reinstalling, which erases its disk.
- An update image of the **same edition** from the same build machine that made your system: `gurtos-<edition>-<arch>.sqfs`, with `gurtos-<edition>-<arch>.sqfs.sha256` and `gurtos-<edition>-<arch>.sqfs.sig` beside it. The edition is `server` or `personal`. `image/build` makes all three.

## Steps

1. **Check what is running.**

   ```sh
   box-update status
   ```

   ```text
   running:  slot a, build 20261024-0700-1a2b3c4
   other:    slot b, empty
   default:  slot a
   ```

2. **Apply the update.** Give it a URL or a local file. The `.sha256` and `.sig` files must sit beside it.

   ```sh
   box-update apply https://updates.example.com/gurtos-server-x86_64.sqfs
   ```

   On Personal, run it as `sudo box-update apply ...` and use the `gurtos-personal-<arch>.sqfs` image.

   First the box checks that it may take an update at all. It refuses in these cases:

   - The running system is on trial. Wait until it is confirmed, at most 5 minutes after it started. The other slot holds the last system known to be healthy, and `apply` will not overwrite it.
   - The running system is not the default one. Restart into the default slot first.

   Then it checks the signature against the update key in `/etc/box-os/update.pub` and checks the hash. If either fails, it stops and writes nothing:

   ```text
   box-update: the update is not signed by this box's update key
   ```

   If both pass, it erases the other slot and writes the update there. Then it checks what it wrote. The update must be a GurtOS system, of the same edition and the same architecture, and not an older build than the running one unless you add `--allow-older`. If one fails, the update is refused, but the other slot has already been erased. It is marked as an update that did not finish and never starts, so `box-update rollback` has nothing to go back to until the next good update. The running system is untouched.

   If every check passes, the box restarts into the new slot once. Add `--no-reboot` to restart later yourself.

3. **Let the box confirm it.** At every start, `box-confirm.service` waits up to 5 minutes for the box service's health check, `/health` on port 7700. If the new system is healthy, it becomes the default. If not, the box restarts and the old slot starts, because the default never changed. The health check covers only the box service: its log loaded, its apps loaded and its API answering. It does not check the screen or SpacetimeDB.

## Check it worked

```sh
box-update status
```

`running` shows the other slot and the new build. `default` matches it. `last` shows the result of the last update. While the new system is on trial, `on trial` shows its slot. An `other` line that says `an update that did not finish` means that slot cannot start.

## Roll back

To go back to the system in the other slot, even after an update was confirmed:

```sh
box-update rollback
```

This makes the other slot the default again and restarts into it. It refuses if the other slot is empty or holds an update that did not finish.

## What survives an update

Everything on the data partition stays: the action log, workspaces and tasks (`/var/lib/box`), the vault and the box's identity (`/etc/box`), SpacetimeDB's data, and the system journal. An update also carries over the machine id, the time zone, SSH host keys and the task users, so a task that was running resumes with the same Linux user.

On GurtOS Personal, `/home` is on the data partition too, and an update carries over people's accounts, their `sudo` membership, saved network connections, the time zone, language and computer name.

Changes made by hand inside a running system slot are lost at the next update. That is by design. On Personal this includes software installed with `apt` outside your home folder: reinstall it after an update.

## Update a box installed on Ubuntu

A box installed with `core/install.sh` is a service on a normal Ubuntu system. To update it, get a newer checkout and run the install script again:

```sh
sudo core/install.sh
```

It copies the checkout to `/opt/box`, installs dependencies and restarts the service. Tasks resume after the restart. There is no automatic rollback here. To go back, check out the previous version and run the script again. Ubuntu's own packages update the usual way.

## Limits

- An update must be signed by the one key on the build machine that made the box, and be the same edition and architecture. Images from another build machine, of the other edition or for another architecture, will not install.
- An older signed image installs only with `--allow-older`. The check compares build dates. There is no key rotation.
- A new system that hangs, instead of failing its health check or panicking, stays hung until someone restarts the machine.
- A change to the boot menu itself needs a reinstall.
- With a second disk that also holds GurtOS plugged in, such as an old install on a USB drive, GRUB and the system's fstab find partitions by label. A start can use that disk's slot or data partition. Unplug it or erase it. `box-update` itself writes only to the disk the running system started from.
- Updating from the portal is not built. Settings, Updates shows the running system and build, and `GET /api/update` reports the update state, but no API applies an update and nothing checks for updates by itself. You need a shell on the box.

## Related

- [System updates and rollback](/docs/concepts/system-updates/)
- [Disk layout](/docs/reference/disk-layout/)
- [Install GurtOS Server](/docs/get-started/install-server/)
- [Resume after power loss](/docs/concepts/resume-after-power-loss/)
