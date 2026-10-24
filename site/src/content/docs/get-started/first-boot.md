---
title: First boot and pairing
description: What a new box sets up on its first start, what its screen shows, how to add keys, and how to pair a phone so requests reach you.
sidebar:
  badge:
    text: Preview
    variant: note
---

The first time a box starts from its disk, it sets itself up. You do not log in, and there is no setup wizard.
This page explains what happens, what the screen shows, and what to do next.

## What first boot sets up

`box-firstboot.service` runs before the GurtOS service at every start. It creates only what is missing, so a system
update keeps everything it made. Both files live in `/etc/box` on the data partition:

| File | What it is |
|---|---|
| `identity.key`, `identity.pub` | The box's own ed25519 key pair |
| `vault.env` | The vault, empty, readable by root only |

The box's id is the first 10 hex digits of the SHA-256 of its public key. The box takes `box-<id>` as its hostname,
and the service uses it as the box's id and name, so no two boxes share one.

Then the GurtOS service starts. It creates its state folder `/var/lib/box`, makes the `home` workspace, loads its
firewall rule, starts its network proxy, loads every installed app, and listens on `127.0.0.1:7700`. SpacetimeDB
starts beside it on port 3000.

Last, `box-confirm.service` waits for the box to report healthy. On a fresh install this confirms the running
system. After an update, it decides whether to keep the new system. See [System updates](/concepts/system-updates/).

## What the screen shows

The box has no desktop and no login prompt. Every text console is switched off. The screen runs one full-screen
browser window as an unprivileged `kiosk` user. It shows the portal's box screen, served by the box itself at
`http://127.0.0.1:7700/screen`: the home screen with widgets for requests and running tasks, the app grid, and
banners when a task needs you. You can approve, deny and undo from the screen with a keyboard and mouse or a touch
screen.

![The GurtOS home screen: a greeting, widgets for requests waiting, running tasks, money spent today and Time Machine layers, the app grid and the dock.](../../../assets/screens/box-home.png)

*The home screen, from the portal's design. Names, tasks and amounts are examples.*

After a power cut, the screen lists the tasks that picked up where they stopped.

## Add your keys

Agent tasks need `FACTORY_API_KEY` in the vault, and some apps need their own keys. A release build of the OS image
has no shell, and the portal has no screen for keys yet, so for now:

- build a **debug** image (`BOX_SSH_KEY=~/.ssh/id_ed25519.pub image/build`) and add keys over SSH, or
- use [the Ubuntu install](/get-started/install-on-ubuntu/).

See [Add a secret to the vault](/guides/add-a-secret/). A settings screen for keys is [planned](/project/roadmap/).

## Pair a phone

Pairing gives a phone its own device token. When the phone answers a request, the action log records which phone it
was, and you can remove one phone without affecting the others.

In outline:

1. Give the phone a route to the box. The API listens on `127.0.0.1` until you set `BOX_LISTEN`.
2. Open the portal from a laptop at the box's address and open **Settings**. It shows a QR code and a one-time code
   that works for 5 minutes.
3. Scan the QR code with the phone, check the code matches, name the phone and pair it.

The box's own screen shows the code but not the QR code, because it does not know the address your phone uses to
reach it. [Approve from your phone](/guides/approve-from-your-phone/) has the full steps.

## Next

[Your first task](/get-started/first-task/).

## Related

- [Install GurtOS Server](/get-started/install-server/)
- [Approve from your phone](/guides/approve-from-your-phone/)
- [Files and paths](/reference/files-and-paths/)
- [Trust boundaries](/security/trust-boundaries/)
