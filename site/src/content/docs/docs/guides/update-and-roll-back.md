---
title: Update and roll back
description: Install a signed system update on a box, let it prove itself healthy, and roll back to the previous system if you need to.
---

A machine installed from a GurtOS ISO, Server or Personal, holds two complete systems on its disk, in slots A and B. It runs from one. An update is written to the other slot and started once on trial. It becomes the default only if the box comes up healthy within 5 minutes. In this guide you check which system runs, apply an update, and roll back.

A box installed on Ubuntu updates differently. See [Update a box installed on Ubuntu](#update-a-box-installed-on-ubuntu) below.

## Before you start

- A machine installed from a GurtOS ISO, and a root shell on it. On GurtOS Personal, open a terminal and use `sudo`. On GurtOS Server, a **debug build** (`gurtos-server-<arch>-debug.iso`) has SSH for root; a release build has no shell, so it cannot run these commands yet.
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

   The box checks the signature against its build key in `/etc/box-os/update.pub`, checks the hash, and checks that the image is the same edition. If any check fails, it stops and writes nothing:

   ```text
   box-update: the update is not signed by this box's build key
   ```

   If both pass, it writes the other slot and restarts into it once. Add `--no-reboot` to restart later yourself.

3. **Let the box confirm it.** At every start, `box-confirm.service` waits up to 5 minutes for the box service's health check. If the new system is healthy, it becomes the default. If not, the box restarts and the old slot starts, because the default never changed.

## Check it worked

```sh
box-update status
```

`running` shows the other slot and the new build. `default` matches it. `last` shows the result of the last update.

## Roll back

To go back to the system in the other slot, even after an update was confirmed:

```sh
box-update rollback
```

This makes the other slot the default again and restarts into it.

## What survives an update

Everything on the data partition stays: the action log, workspaces and tasks (`/var/lib/box`), the vault and the box's identity (`/etc/box`), SpacetimeDB's data, and the system journal. An update also carries over the machine id, SSH host keys and the task users, so a task that was running resumes with the same Linux user.

On GurtOS Personal, `/home` is on the data partition too, and an update carries over people's accounts, their `sudo` membership, saved network connections, the time zone, language and computer name.

Changes made by hand inside a running system slot are lost at the next update. That is by design. On Personal this includes software installed with `apt` outside your home folder: reinstall it after an update.

## Update a box installed on Ubuntu

A box installed with `core/install.sh` is a service on a normal Ubuntu system. To update it, get a newer checkout and run the install script again:

```sh
sudo core/install.sh
```

It copies the checkout to `/opt/box`, installs dependencies and restarts the service. Tasks resume after the restart. There is no automatic rollback here. To go back, check out the previous version and run the script again. Ubuntu's own packages update the usual way.

## Limits

- An update must be signed by the one key on the build machine that made the box, and be the same edition. Images from another build machine, or of the other edition, will not install.
- There is no protection against installing an older signed image, and no key rotation.
- A new system that hangs, instead of failing its health check or panicking, stays hung until someone restarts the machine.
- A change to the boot menu itself needs a reinstall.
- Updating from the portal is not built. You need a shell on the box.

## Related

- [System updates and rollback](/docs/concepts/system-updates/)
- [Disk layout](/docs/reference/disk-layout/)
- [Install GurtOS Server](/docs/get-started/install-server/)
- [Resume after power loss](/docs/concepts/resume-after-power-loss/)
