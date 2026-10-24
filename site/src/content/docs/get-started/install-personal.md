---
title: Install GurtOS Personal
description: GurtOS Personal runs agents beside you on your own Ubuntu desktop. It is in development; this page describes what it will install and how it will work.
sidebar:
  label: Install Personal
  badge:
    text: Preview
    variant: note
---

GurtOS Personal puts the GurtOS service on your own laptop or desktop. You keep using the computer as usual, with
Ubuntu's GNOME desktop and your own account. Agents work beside you as separate users without `sudo`, on copies
of your real folders, and nothing they change reaches your files until you choose **Keep**.

:::caution[Preview, in development]
GurtOS Personal has no release yet and no supported installer. The core already runs agents on copies of an owner's
folders with Keep and Undo, through its API. The desktop pieces below run on test machines and are not released.
To try the core part today, see [the API steps](/guides/keep-or-undo/#with-the-api-works-today).
:::

## What it will install

Personal is the same core as Server, plus a layer for the desktop. The pieces being built:

| Piece | What it does |
|---|---|
| The GurtOS service | The same core as Server: task users, the vault, the network proxy, approvals and the action log. It runs as a system service, with your user name as `BOX_OWNER`. |
| Approvals as notifications | A small service in your desktop session follows the box's live events. An approval appears as a GNOME notification with **Approve** and **Deny**. The log records the answer as `desktop:<your user name>`. |
| Top-bar indicator | Shows how many agents are working and how many requests need you. Its menu lists them, and you can answer a request from there. |
| The GurtOS app | The portal in its own window, pinned to the dock, with a badge for requests that need you. |
| Ask an agent | An item in the Files right-click menu. A dialog asks what to do, the budget, and which folders the task may touch. |
| Review | When a task on your folders finishes, a window shows the files it changed and the diff, with **Keep** and **Undo**. |
| Welcome | A first-run window after GNOME's own account setup. It explains how agents work on this computer and offers to pair a phone. |

## How it will work

1. You right-click a folder in Files and choose **Ask an agent**.
2. You describe the job and set a budget. GurtOS starts a task as a new Linux user, working on an overlay copy of
   that folder. Your own files are not touched while it works.
3. The agent's requests reach you as notifications. Other tasks, and your own work, carry on.
4. When the task finishes, the review window shows what it changed. **Keep** applies those changes to your real
   folder. **Undo** throws them away.

The rules that keep an agent apart from your account are the ones GurtOS Server uses. See
[Agents as their own users](/concepts/agent-users/) and [Workspaces and layers](/concepts/workspaces-and-layers/).

## Requirements, when released

- Ubuntu 24.04 with the GNOME desktop, on x86_64 or arm64.
- An account with `sudo` for the install. Agents never get it.
- At least 8 GB of memory. Each task may use up to 2 GB.

## Related

- [Give an agent a folder, then keep or undo](/guides/keep-or-undo/)
- [Editions](/introduction/editions/)
- [Roadmap](/project/roadmap/)
