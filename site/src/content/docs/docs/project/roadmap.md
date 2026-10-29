---
title: Roadmap
description: Everything in GurtOS that is planned or in preview, in one list, with the gap each item closes. None of it has a date.
---

These are the known gaps and the work intended to close them. Nothing here has a date. Items move to the
[changelog](/docs/project/changelog/) when they ship. What has to happen before a 1.0, such as stronger isolation
and an outside audit, is in [ROADMAP.md](https://github.com/benz16107/gurtos/blob/main/ROADMAP.md).

**Preview** means built and working, but incomplete or likely to change. **Planned** means not built yet, and
intended. **Not built** means a known gap with no plan yet; it is listed so you can weigh the limit for yourself.

## Setup and access

| Item | Status | Why |
|---|---|---|
| Authentication on the HTTP API | Preview | Built: from anywhere but the box itself, every request needs a paired device's token, and setup, settings, the vault and the owner's folders need the owner. Pair the owner's phone in setup or in Settings, Devices. |
| A setting for the API's listen address and the phone address | Planned | GurtOS Server and GurtOS Personal from the ISO set them by themselves for private networks. On the Ubuntu install they are the `BOX_LISTEN` and `BOX_URL` environment variables, set by hand. |
| Remote access and push notifications through a relay you run | Preview | Built: an https address per box and push to phones. See [Run your own relay](/docs/guides/self-host/). |
| A hosted relay at `box.gurtos.com` | Not running | It is not running during the preview. Until it is, use your home network, a private network such as Tailscale, or your own relay. |
| The web app's relay address set by configuration | Not built | A self-hosted web app changes one line in `portal/src/relay.ts`. A box's own copy of the web app cannot turn on push through a self-hosted relay. |
| Public downloads of the ISO | Preview | v0.2.0-preview images on the [Download](/download/) page. |

## The OS image

| Item | Status | Why |
|---|---|---|
| Updates from the screen | Not built | `box-update` needs a root shell. GurtOS Personal has one through `sudo`. A release build of GurtOS Server does not, so a Server box moves to a new release by reinstalling, which erases its disk. |
| Tested on real PCs, UTM and Parallels | Planned | Tested so far in QEMU on x86_64 (BIOS and UEFI) and arm64 (emulated), and on a Vultr instance. |
| Verified, read-only system slots (dm-verity) | Not built | Slots are plain writable ext4 today. |
| Update key rotation | Not built | One signing key. |
| Rollback protection | Preview | `box-update` refuses an older build unless you pass `--allow-older`. Nothing stops an older signed image installed with that flag. |
| A hardware watchdog | Not built | A system that hangs, rather than failing its health check, stays hung until someone restarts it. |
| Boot menu updates without a reinstall | Not built | The boot menu is written once at install. |
| Signed boot loader for Secure Boot | Not built | Secure Boot must be off today. |
| Wi-Fi on GurtOS Server | Not built | Server sets up wired networking only. GurtOS Personal has NetworkManager and Wi-Fi. |

## Tasks and workspaces

| Item | Status | Why |
|---|---|---|
| Squashing old layers into the base | Not built | A workspace holds up to 499 finished tasks; past that a new task there is refused. |
| Logging allowed connections, not only refusals | Not built | Only `net.blocked` events are logged today. |

## GurtOS Personal

| Item | Status | Why |
|---|---|---|
| The GurtOS Personal ISO, desktop layer, Keep and Undo Keep | Preview | Built and walked end to end on a fresh install in a virtual machine. |
| Pairing a phone on Personal | Preview | The ISO sets the box's address at each start. After a laptop moves to another network, the QR code shows the old address until the next restart. |
| GurtOS Personal on real laptops | Planned | Tested in virtual machines only: x86_64 end to end, and arm64 to first run. |

## GurtOS Business

| Item | Status |
|---|---|
| Roles that decide who may start, approve and undo | Preview |
| Approvals routed by a written policy to the person who owns the decision | Preview |
| Audit with CSV export and a kill switch, on one box | Preview |
| One audit view across boxes | Planned |
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

- [Changelog](/docs/project/changelog/)
- [Editions](/docs/introduction/editions/)
- [Threat model](/docs/security/threat-model/)
