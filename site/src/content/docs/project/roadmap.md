---
title: Roadmap
description: Everything in GurtOS that is planned or in preview, in one list, with the gap each item closes. None of it has a date.
---

These are the known gaps and the work intended to close them. Nothing here has a date. Items move to the
[changelog](/project/changelog/) when they ship.

**Preview** means built and working, but incomplete or likely to change. **Planned** means not built yet, and
intended. **Not built** means a known gap with no plan yet; it is listed so you can weigh the limit for yourself.

## Setup and access

| Item | Status | Why |
|---|---|---|
| Authentication on the HTTP API | Preview | Built: from anywhere but the box itself, every request needs a paired device's token, and setup, settings, the vault and the owner's folders need the owner. Pairing a phone as the owner still takes a command on the box. |
| First-run setup, Settings and App Center screens in the portal | Planned | The box's API for them is built (`/api/setup`, `/api/settings`, `/api/apps`, `/api/vault`). The portal has no screens for them yet, so a release build of the OS image still cannot take keys. |
| Starting a task from the portal | Planned | Today tasks start from the API, apps and triggers, or Files on GurtOS Personal. |
| A setting for the API's listen address and the phone address | Planned | GurtOS Server from the ISO sets them by itself for private networks. On the Ubuntu install and GurtOS Personal they are the `BOX_LISTEN` and `BOX_URL` environment variables, set by hand. |
| Push notifications to phones | Not built | A request shows when the portal is open on the phone. |
| Public downloads of the ISO | Planned | Today the ISO is built from source. |

## The OS image

| Item | Status | Why |
|---|---|---|
| Tested on real PCs, UTM and Parallels | Planned | Tested so far in QEMU on x86_64 (BIOS and UEFI) and arm64 (emulated), and on a Vultr instance. |
| Verified, read-only system slots (dm-verity) | Not built | Slots are plain writable ext4 today. |
| Update key rotation and rollback protection | Not built | One signing key, and an older signed image still installs. |
| A hardware watchdog | Not built | A system that hangs, rather than failing its health check, stays hung until someone restarts it. |
| Boot menu updates without a reinstall | Not built | The boot menu is written once at install. |
| Signed boot loader for Secure Boot | Not built | Secure Boot must be off today. |
| Wi-Fi on GurtOS Server | Not built | Server sets up wired networking only. GurtOS Personal has NetworkManager and Wi-Fi. |

## Tasks and workspaces

| Item | Status | Why |
|---|---|---|
| Squashing old layers into the base | Not built | A workspace's view can stack about 60 layers before mount options run out. |
| Logging allowed connections, not only refusals | Not built | Only `net.blocked` events are logged today. |

## GurtOS Personal

| Item | Status | Why |
|---|---|---|
| The GurtOS Personal ISO, desktop layer, Keep and Undo Keep | Preview | Built and walked end to end on a fresh install in a virtual machine. |
| Filling the vault from the desktop | Planned | A fresh install has an empty vault; today it takes a terminal command. |
| Pairing a phone on Personal | Planned | Needs `BOX_LISTEN` and `BOX_URL` set by hand. |
| GurtOS Personal on arm64 and real laptops | Planned | Tested on x86_64 virtual machines only. |

## GurtOS Business

| Item | Status |
|---|---|
| Roles that decide who may start, approve and undo | Planned |
| Approvals routed to the person or team that owns the decision | Planned |
| One audit view across boxes, with exports | Planned |
| Fleet management with staged whole-system updates | Planned |

## More than one box

| Item | Status | Why |
|---|---|---|
| Listing and switching between boxes in one portal | Preview | The box lists its peers from `BOX_PEERS`. Switching opens the other box's own portal. |

## Apps

| Item | Status |
|---|---|
| A Find window in the portal | Planned |
| A hosted vision model for Find on boxes without a GPU | Planned |
| Payments through a custodial wallet, so no private key is on the box | Planned |
| Signed calls from the Jira panel to the box, instead of one shared secret | Planned |
| Guests in the ASI:One chat, with the owner approving their requests | Planned |

## Related

- [Changelog](/project/changelog/)
- [Editions](/introduction/editions/)
- [Threat model](/security/threat-model/)
