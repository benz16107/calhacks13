---
title: Download GurtOS
description: Download GurtOS v0.1.0-preview, the signed install images for GurtOS Server, with checksums, how to verify them, minimum hardware and install steps.
sidebar:
  label: Download
---

**v0.1.0-preview.** A preview. It works end to end but has not had a security audit. Install it on a spare machine or
a virtual machine: the installer takes the whole disk.

## Which file

| Your machine | File | Size | Download |
|---|---|---|---|
| A PC, server or cloud VM (Intel or AMD) | `gurtos-server-x86_64.iso` | 1.34 GB | [GitHub](https://github.com/benz16107/calhacks13/releases/download/v0.1.0-preview/gurtos-server-x86_64.iso) · [mirror](https://sjc1.vultrobjects.com/gurtos/v0.1.0-preview/gurtos-server-x86_64.iso) |
| An Apple silicon Mac (UTM or Parallels) or an arm64 server | `gurtos-server-arm64.iso` | 1.34 GB | [GitHub](https://github.com/benz16107/calhacks13/releases/download/v0.1.0-preview/gurtos-server-arm64.iso) · [mirror](https://sjc1.vultrobjects.com/gurtos/v0.1.0-preview/gurtos-server-arm64.iso) |
| GurtOS Personal (your own laptop or desktop) | `gurtos-personal-x86_64.iso`, `gurtos-personal-arm64.iso` | | Coming soon. Until then, [build it from source](#build-it-from-source) |

Checksums and signature: [SHA256SUMS](https://sjc1.vultrobjects.com/gurtos/v0.1.0-preview/SHA256SUMS),
[SHA256SUMS.sig](https://sjc1.vultrobjects.com/gurtos/v0.1.0-preview/SHA256SUMS.sig) and
[allowed_signers](https://sjc1.vultrobjects.com/gurtos/v0.1.0-preview/allowed_signers). They are also on the
[release page](https://github.com/benz16107/calhacks13/releases/tag/v0.1.0-preview).

SHA-256:

```text
159753d9a02e546f215c9553512c0bfb43e3b4b3f82f1fc92569a8eef1796a07  gurtos-server-x86_64.iso
c9444fe07f2405c21e23ba700b1e8bac97517a630f1a21d6ede61210e08c8b28  gurtos-server-arm64.iso
```

## Verify it

Put the ISO, `SHA256SUMS`, `SHA256SUMS.sig` and `allowed_signers` in one folder, then:

```sh
ssh-keygen -Y verify -f allowed_signers -I gurtos -n gurtos-release -s SHA256SUMS.sig < SHA256SUMS
sha256sum -c SHA256SUMS --ignore-missing          # Linux
shasum -a 256 -c SHA256SUMS --ignore-missing      # macOS
```

The first line must print
`Good "gurtos-release" signature for gurtos with ED25519 key SHA256:FWKFb1eAvEBmMhVJwMwTnLnhrmZ5yQZ5947pDvFKcpY`.
That fingerprint is also in the repository at `release/allowed_signers`. On Windows, compare
`Get-FileHash <file>.iso` with the line in `SHA256SUMS`.

## Minimum hardware

- 2 cores (4 recommended), 4 GB of memory, and a 20 GB disk (32 GB recommended). The installer uses the whole disk.
- x86_64: BIOS or UEFI. arm64: UEFI. Secure Boot off: the boot loader is not signed.
- Internet on first start. The box downloads Factory's Droid CLI then (GurtOS does not redistribute it), and agents
  call the model over the internet.

## Install

1. Write the ISO to a USB stick (balenaEtcher, or `sudo dd if=gurtos-server-x86_64.iso of=/dev/sdX bs=4M status=progress`),
   or attach it to a VM as its CD. On a cloud VM such as Vultr, add the ISO by its URL as a custom ISO and deploy from
   it. A new Vultr instance shows iPXE for about a minute while the ISO mounts.
2. Start from it. On a blank disk it installs in a few minutes and restarts into GurtOS Setup. A disk with anything on
   it is erased only after you type `erase`.
3. Setup asks for one model key: an Anthropic API key ([console.anthropic.com](https://console.anthropic.com)) or a
   Factory API key ([app.factory.ai](https://app.factory.ai)). Agents never see it. Every app is optional and stays
   off until you add its keys.
4. Open **Tasks**, then **New task**.

On a cloud VM, run setup in the provider's web console: the box's portal only answers private networks.

More detail: [Install GurtOS Server](/get-started/install-server/) and [Your first task](/get-started/first-task/).

## Build it from source

On any Ubuntu 24.04 machine or VM with root and about 10 GB free per image:

```sh
git clone https://github.com/benz16107/calhacks13.git gurtos && cd gurtos
image/build                 # GurtOS Server for this machine's architecture
image/build personal        # GurtOS Personal
```

About 6 minutes on a 4-core, 8 GB VM. Details:
[release/README.md](https://github.com/benz16107/calhacks13/blob/main/release/README.md).

Source: [github.com/benz16107/calhacks13](https://github.com/benz16107/calhacks13). Licence: Apache 2.0.
