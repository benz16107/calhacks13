# GurtOS

GurtOS is an operating system for a computer where AI agents do work for you, safely. Each agent task runs as
its own Linux user in its own copy of your files. Agents never hold your keys. Their network reaches only the
hosts a task needs. Anything that spends money or needs your judgement stops and asks you, on the box's screen
or your phone. You can undo one task without touching any other, and a box that loses power picks every task
back up when it boots.

**Status: preview (v0.1.0-preview).** GurtOS was built in a weekend at Cal Hacks 13.0. It works end to end and
has been installed from its own ISO on cloud VMs and QEMU, but it has not had a security audit.
Try it on a spare machine or a VM, not on a computer whose disk you need: the installer takes the whole disk.

Docs: [gurtos.com](https://gurtos.com). Hackathon showcase: [calhacks.gurtos.com](https://calhacks.gurtos.com).

## Editions

| Edition | For | What you see |
|---|---|---|
| **GurtOS Server** | An always-on box at home or in the cloud, where agents work 24/7 | The box's own full-screen screen: tasks, approvals, apps. No desktop, no login prompt, no user with sudo |
| **GurtOS Personal** | Your own laptop or desktop | Ubuntu's GNOME desktop with your own account and sudo. Agents work beside you on copies of your folders; nothing changes until you choose Keep |
| **GurtOS Business** | One box shared by a team, with roles and routed approvals | Planned, not built |

Both editions are Ubuntu 24.04 underneath and update as a whole system, with automatic rollback if an update
does not come up healthy.

## Download

Release [v0.1.0-preview](https://github.com/benz16107/calhacks13/releases/tag/v0.1.0-preview). Each file is on
GitHub Releases and on a mirror; both have the same checksums and signature.

| Machine | File | GitHub | Mirror |
|---|---|---|---|
| Server on a PC, server or cloud VM (Intel or AMD) | `gurtos-server-x86_64.iso` | [download](https://github.com/benz16107/calhacks13/releases/download/v0.1.0-preview/gurtos-server-x86_64.iso) | [download](https://sjc1.vultrobjects.com/gurtos/v0.1.0-preview/gurtos-server-x86_64.iso) |
| Server on an Apple silicon Mac (UTM or Parallels) or an arm64 server | `gurtos-server-arm64.iso` | [download](https://github.com/benz16107/calhacks13/releases/download/v0.1.0-preview/gurtos-server-arm64.iso) | [download](https://sjc1.vultrobjects.com/gurtos/v0.1.0-preview/gurtos-server-arm64.iso) |
| Personal on a PC or laptop (Intel or AMD) | `gurtos-personal-x86_64.iso` | coming soon | coming soon |
| Personal on an Apple silicon Mac (UTM or Parallels) | `gurtos-personal-arm64.iso` | coming soon | coming soon |
| Checksums, signature, public key | `SHA256SUMS`, `SHA256SUMS.sig`, `allowed_signers` | [release page](https://github.com/benz16107/calhacks13/releases/tag/v0.1.0-preview) | [SHA256SUMS](https://sjc1.vultrobjects.com/gurtos/v0.1.0-preview/SHA256SUMS), [.sig](https://sjc1.vultrobjects.com/gurtos/v0.1.0-preview/SHA256SUMS.sig), [allowed_signers](https://sjc1.vultrobjects.com/gurtos/v0.1.0-preview/allowed_signers) |

Each Server ISO is 1.34 GB. Checksums are in the [release notes](release/notes/v0.1.0-preview.md). The Personal ISOs
are added to the same release when their build is final; until then, build Personal from source (below).

### Minimum hardware

| | Server | Personal |
|---|---|---|
| Processor | x86_64 or arm64, 2 cores (4 recommended) | x86_64 or arm64, 2 cores (4 recommended) |
| Memory | 4 GB | 4 GB (8 GB recommended) |
| Disk | 20 GB, the whole disk (32 GB recommended) | 32 GB, the whole disk (48 GB recommended) |
| Firmware | BIOS or UEFI on x86_64, UEFI on arm64. Secure Boot off: the boot loader is not signed | Same |
| Network | Wired or Wi-Fi with internet: the first start downloads Factory's Droid CLI, and agents call the model over the internet | Same |

## Verify the download

Check the signature on the checksum file, then the checksum of your ISO. You need OpenSSH 8.1 or newer
(`ssh-keygen`), which macOS, Linux and Windows 10 and later include.

```sh
ssh-keygen -Y verify -f allowed_signers -I gurtos -n gurtos-release -s SHA256SUMS.sig < SHA256SUMS
# Good "gurtos-release" signature for gurtos with ED25519 key SHA256:...
sha256sum -c SHA256SUMS --ignore-missing          # Linux
shasum -a 256 -c SHA256SUMS --ignore-missing      # macOS
```

The release key's fingerprint is also in the [release notes](release/notes/v0.1.0-preview.md) and on
[gurtos.com/download](https://gurtos.com/download/). On Windows, compare `Get-FileHash <file>.iso` with the
line in `SHA256SUMS`.

## Install

1. **Write the ISO to a USB stick** (`sudo dd if=gurtos-server-x86_64.iso of=/dev/sdX bs=4M status=progress`, or
   balenaEtcher), or attach it to a VM as its CD.
   - **UTM on an Apple silicon Mac:** New, Virtualize, Linux, the arm64 ISO. 4 GB memory, 4 cores, 32 GB disk
     (48 GB for Personal). Turn off Secure Boot if UTM offers it.
   - **A cloud VM (for example Vultr):** upload the ISO by URL as a custom ISO and deploy an instance from it.
2. **Start from it.** The menu waits 5 seconds. On a blank disk it installs right away, in about a minute. A disk
   with anything on it is erased only after you type `erase`. It restarts into GurtOS from the disk.
3. **Set it up.**
   - **Server** shows its own screen. Setup walks through the network, what agents may do, apps, keys,
     updates and pairing a phone.
   - **Personal** shows GNOME's welcome, which makes your account (with sudo). Then GurtOS Setup opens.
4. **Add one model key.** That is the only key GurtOS needs. Use either:
   - an **Anthropic API key** from [console.anthropic.com](https://console.anthropic.com) (usage bills your
     Anthropic account), or
   - a **Factory API key** from [app.factory.ai](https://app.factory.ai) (usage uses your Factory credits).

   The key goes into the box's vault. Agents never see it: the box adds it to their model calls on the way out.
5. **Run a task.** Open Tasks, then New task. Give it a prompt, a budget and the sites it may reach.

Every app (Jira, Elastic, Apify, the wallet and the others) is optional and stays off until you turn it on in the
App Center and add the keys it lists.

**On a cloud VM** the box's firewall only lets private networks reach its portal, so set it up from the
provider's web console, which shows the box's screen. To reach the portal from your laptop afterwards, put the
box on a private network you control, such as Tailscale.

Updates: `box-update apply <url>` installs a signed system image to the other slot and restarts; if the new
system is not healthy within 5 minutes, the machine goes back to the old one. Details in
[image/README.md](image/README.md).

## Build it from source

You need an Ubuntu 24.04 machine or VM (x86_64 or arm64) with root and about 40 GB free for the build.

```sh
git clone https://github.com/benz16107/calhacks13.git gurtos
cd gurtos
image/build                     # GurtOS Server, x86_64. On an arm64 machine: image/build arm64
image/build personal            # GurtOS Personal, x86_64
image/build personal arm64      # GurtOS Personal, arm64
```

The ISOs land in `/var/lib/box-image/out/`. Building arm64 on an x86_64 machine works under emulation and takes
several times longer. Times, disk and memory for each build are in [release/README.md](release/README.md), which
also has how the release ISOs were built and signed.

To work on the code without building an image: Node 22.18 or newer, then `npm ci`, `npm test` and
`npm run check`. To run the box itself, use a VM: `sudo core/install.sh` on Ubuntu 24.04 installs the box service.
See [CONTRIBUTING.md](CONTRIBUTING.md).

## How it keeps agents in line

| Risk | What GurtOS does |
|---|---|
| An agent reads a web page that tells it to steal your keys | Agents never hold a secret. The vault (`/etc/box/vault.env`, root only) holds keys, and the box makes keyed calls for the agent. The model key is swapped in by the box's proxy on the way out |
| An agent sends your data somewhere else | Each task's network reaches only the box's proxy, which allows only the hosts that task lists. Every refused connection goes in the action log |
| An agent breaks your files | Each task works in its own copy (an overlay) as its own Linux user without sudo. Undo removes one task's changes and keeps every other task's |
| An agent spends too much | Every tool declares its cost. Above a task's budget, or above your approval threshold, the task stops and asks you on the screen and your phone |
| You need to know what happened | One append-only action log of every step, tool call, approval, cost and blocked connection |
| The power goes out | The log is the truth; at boot the box rebuilds every task from it and resumes what was running |

Read the full model, including what it does not protect against, at
[gurtos.com](https://gurtos.com). Report security problems privately through GitHub's
[security advisories](https://github.com/benz16107/calhacks13/security/advisories/new), not in public issues.

## What is in this repo

| Folder | What |
|---|---|
| `core/` | The box service: tasks, sandbox, network proxy, vault, action log, API |
| `tracks/` | Apps that plug into the box, one folder each |
| `portal/` | The web app for the box's screen, a laptop and a phone |
| `personal/` | The GNOME desktop layer of GurtOS Personal |
| `image/` | The bootable images, installer, updates and rollback |
| `site/`, `showcase/` | gurtos.com and calhacks.gurtos.com |
| `release/` | How releases are built, signed and published |
| `docs/`, `spikes/` | Design notes and the first night's experiments |

## Licence

GurtOS is licensed under the [Apache License 2.0](LICENSE). The images also contain third-party software under
its own licences; see [NOTICE](NOTICE). Factory's Droid CLI is not part of GurtOS: the box downloads it from
Factory on first start, under Factory's terms.
