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
| A settings screen in the portal for vault keys | Planned | A release build of the OS image has no shell, so today keys need a debug build or the Ubuntu install. |
| A setting for the API's listen address | Planned | Today it is the `BOX_LISTEN` environment variable. |
| Authentication on the HTTP API | Planned | The API trusts anyone who can reach it. Today the protection is that it listens on `127.0.0.1`. |
| Requiring a paired device for every answer | Planned | Answers without a device token, and SpacetimeDB's `answer` reducer, are accepted today. |
| The QR code on the box's own screen | Preview | The screen shows the pairing code, but not the QR code, until the box knows the address phones use. |
| Push notifications to phones | Not built | A request shows when the portal is open on the phone. |
| Public downloads of the ISO | Planned | Today the ISO is built from source. |

## The OS image

| Item | Status | Why |
|---|---|---|
| Tested on real PCs, UTM, Parallels and cloud providers | Planned | Tested so far in QEMU on x86_64 (BIOS and UEFI) and arm64 (emulated). |
| Verified, read-only system slots (dm-verity) | Not built | Slots are plain writable ext4 today. |
| Update key rotation and rollback protection | Not built | One signing key, and an older signed image still installs. |
| A hardware watchdog | Not built | A system that hangs, rather than failing its health check, stays hung until someone restarts it. |
| Boot menu updates without a reinstall | Not built | The boot menu is written once at install. |
| Signed boot loader for Secure Boot | Not built | Secure Boot must be off today. |
| Wi-Fi | Not built | Only wired networking is set up. |

## Tasks and workspaces

| Item | Status | Why |
|---|---|---|
| Squashing old layers into the base | Not built | A workspace's view can stack about 60 layers before mount options run out. |
| The worker's own error in the log | Not built | A failed task records only "worker exited with N". |
| Logging allowed connections, not only refusals | Not built | Only `net.blocked` events are logged today. |

## GurtOS Personal

| Item | Status | Why |
|---|---|---|
| Owner folders with Keep and Undo in the core | Preview | Works through the API. |
| The desktop layer | Preview | Notifications with Approve and Deny, a top-bar indicator, the GurtOS app window, **Ask an agent** in Files, a review window and a first-run welcome. In development, not released. |
| An installer for Personal | Planned | No supported install steps yet. |
| Undoing a Keep from Time Machine | Planned | Before-images are saved, but restoring them is manual. |

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
