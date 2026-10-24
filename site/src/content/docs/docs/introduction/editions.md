---
title: Editions
description: GurtOS comes in three editions. GurtOS Server is an always-on box, GurtOS Personal is your own computer with agents beside you, and GurtOS Business is a preview you turn on from either.
---

GurtOS has one core: the service that runs tasks as separate users, keeps the vault, and writes the action log.
The editions put that core on different machines for different people. For the jobs each one fits, see
[Use cases by edition](/docs/introduction/use-cases/).

## GurtOS Server

An always-on box at home or in the cloud. It has no desktop and no human account. Its screen shows the portal's
box screen, and you use it from the portal in a browser or on your phone.

Use GurtOS Server when you want agents to keep working while you are away: overnight jobs, routines on a schedule,
work that arrives from a webhook, a chat or another app.

- Install it from the GurtOS ISO on a spare PC, a virtual machine, or a cloud instance that accepts custom ISOs.
  See [Install GurtOS Server](/docs/get-started/install-server/).
- Or install the box service on an existing Ubuntu 24.04 machine.
  See [Install on Ubuntu](/docs/get-started/install-on-ubuntu/).

**Status: Preview.** The core, the portal with its setup wizard, and the OS image work and are tested on x86_64 and
arm64 virtual machines.

## GurtOS Personal

Your own laptop or desktop, used as a normal computer, with agents working beside you. You keep Ubuntu's GNOME
desktop and your own account. Agents work as separate users without `sudo`, on copies of your real folders.
When a task finishes, you look at what it changed and choose **Keep** or **Undo**.

It installs from its own GurtOS Personal ISO. GNOME's first-boot setup makes your account, and GurtOS makes that
account the owner. Approvals arrive as desktop notifications, a top-bar indicator shows what agents are doing, the
GurtOS app shows Needs you, running tasks and what is ready to review, and **New Agent Task…** in Files hands an agent a folder. You can undo a Keep
later, too.

**Status: Preview.** It installs and runs, and has been walked end to end on a fresh install. Pairing a phone still
needs the box's address set by hand. See [Install GurtOS Personal](/docs/get-started/install-personal/).

## GurtOS Business

One box shared by a company. **Status: Preview.** It is not a separate image. You turn it on from a GurtOS Server or
GurtOS Personal box, and the same core then adds:

- **Roles.** People are an owner, admin, approver, requester or auditor, and the role decides what they may start,
  approve and undo.
- **Routed approvals.** A policy in plain words sends each approval to the person who may answer it, such as
  "Over $10,000 goes to the Controller", with a limit per person.
- **Audit.** Every request, answer and change is in the action log, with a CSV export and a kill switch for all agents.
- **A phone app and a desktop portal** that sign in as a person.

Turn it on with [Turn on GurtOS Business](/docs/guides/turn-on-business/). The data in the preview is sandbox data.
**Planned:** managing many boxes together as a fleet, with staged whole-system updates.

## Compare the editions

| | GurtOS Server | GurtOS Personal | GurtOS Business |
|---|---|---|---|
| Status | Preview | Preview | Preview, on top of either |
| Runs on | A spare PC, a VM or a cloud instance | Your own laptop or desktop | The company's machines |
| Install | The GurtOS Server ISO, or the box service on Ubuntu 24.04 | The GurtOS Personal ISO | Not a separate image: turned on from Server or Personal |
| Base system | Ubuntu 24.04 packages, no desktop | Ubuntu 24.04 with GNOME | The base of the edition it is turned on from |
| Human login | None. No shell, no `sudo` on the OS image | Your own account, with `sudo` | People with roles |
| Agents run as | One Linux user per task | One Linux user per task | The same |
| Agents work on | Workspaces on the box | Copies of your own folders | The same as its base |
| Undo | Undo any one task | Keep or Undo after each task, and undo a Keep | The same as its base |
| Approvals | Portal, phone, and apps such as Jira or a chat | Desktop notifications, portal, phone | Routed by role, amount and a written policy |
| Screen | The portal, full screen on the box's display | Your GNOME desktop | The portal on any desktop, and the phone app |
| Updates | Whole-system A/B updates with automatic rollback | The same. Your files, accounts and settings stay; software installed with `apt` does not | Planned: staged across a fleet |
| Many machines | One portal can list several boxes (Preview) | One computer | Planned: fleet management |

All editions share the same task model, vault, network policy, approvals, action log and app SDK. A guide for one
applies to the others unless it says otherwise.

## Related

- [Use cases by edition](/docs/introduction/use-cases/)
- [What is GurtOS?](/docs/introduction/overview/)
- [Install GurtOS Server](/docs/get-started/install-server/)
- [Install GurtOS Personal](/docs/get-started/install-personal/)
- [Roadmap](/docs/project/roadmap/)
