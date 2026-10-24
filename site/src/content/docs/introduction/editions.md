---
title: Editions
description: GurtOS comes in three editions. GurtOS Server is an always-on box, GurtOS Personal is your own computer with agents beside you, and GurtOS Business is planned.
---

GurtOS has one core: the service that runs tasks as separate users, keeps the vault, and writes the action log.
The editions put that core on different machines for different people. For the jobs each one fits, see
[Use cases by edition](/introduction/use-cases/).

## GurtOS Server

An always-on box at home or in the cloud. It has no desktop and no human account. Its screen shows the portal's
box screen, and you use it from the portal in a browser or on your phone.

Use GurtOS Server when you want agents to keep working while you are away: overnight jobs, routines on a schedule,
work that arrives from a webhook, a chat or another app.

- Install it from the GurtOS ISO on a spare PC, a virtual machine, or a cloud instance that accepts custom ISOs.
  See [Install GurtOS Server](/get-started/install-server/).
- Or install the box service on an existing Ubuntu 24.04 machine.
  See [Install on Ubuntu](/get-started/install-on-ubuntu/).

**Status: Preview.** The core, the portal with its setup wizard, and the OS image work and are tested on x86_64 and
arm64 virtual machines.

## GurtOS Personal

Your own laptop or desktop, used as a normal computer, with agents working beside you. You keep Ubuntu's GNOME
desktop and your own account. Agents work as separate users without `sudo`, on copies of your real folders.
When a task finishes, you look at what it changed and choose **Keep** or **Undo**.

It installs from its own GurtOS Personal ISO. GNOME's first-boot setup makes your account, and GurtOS makes that
account the owner. Approvals arrive as desktop notifications, a top-bar indicator shows what agents are doing, the
GurtOS app opens the portal in a window, and **Ask an Agent** in Files hands an agent a folder. You can undo a Keep
later, too.

**Status: Preview.** It installs and runs, and has been walked end to end on a fresh install. Pairing a phone still
needs the box's address set by hand. See [Install GurtOS Personal](/get-started/install-personal/).

## GurtOS Business

A company's agents on the company's machines. **Status: Planned.** Nothing on this page is built yet. The
intent is:

- **Roles.** People get roles that decide what they may start, approve and undo.
- **Routed approvals.** An approval goes to the person or team that owns that kind of decision, such as
  finance for spending above a limit.
- **Audit.** The action log of every box, searchable in one place, with exports.
- **Fleet.** Many boxes managed together, with staged whole-system updates.

## Compare the editions

| | GurtOS Server | GurtOS Personal | GurtOS Business |
|---|---|---|---|
| Status | Preview | Preview | Planned |
| Runs on | A spare PC, a VM or a cloud instance | Your own laptop or desktop | The company's machines |
| Install | The GurtOS Server ISO, or the box service on Ubuntu 24.04 | The GurtOS Personal ISO | Planned |
| Base system | Ubuntu 24.04 packages, no desktop | Ubuntu 24.04 with GNOME | Planned |
| Human login | None. No shell, no `sudo` on the OS image | Your own account, with `sudo` | Planned: people with roles |
| Agents run as | One Linux user per task | One Linux user per task | Planned: the same |
| Agents work on | Workspaces on the box | Copies of your own folders | Planned |
| Undo | Undo any one task | Keep or Undo after each task, and undo a Keep | Planned |
| Approvals | Portal, phone, and apps such as Jira or a chat | Desktop notifications, portal, phone | Planned: routed by role |
| Screen | The portal, full screen on the box's display | Your GNOME desktop | Planned |
| Updates | Whole-system A/B updates with automatic rollback | The same. Your files, accounts and settings stay; software installed with `apt` does not | Planned: staged across a fleet |
| Many machines | One portal can list several boxes (Preview) | One computer | Planned: fleet management |

All editions share the same task model, vault, network policy, approvals, action log and app SDK. A guide for one
applies to the others unless it says otherwise.

## Related

- [Use cases by edition](/introduction/use-cases/)
- [What is GurtOS?](/introduction/overview/)
- [Install GurtOS Server](/get-started/install-server/)
- [Install GurtOS Personal](/get-started/install-personal/)
- [Roadmap](/project/roadmap/)
