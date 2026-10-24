---
title: Download GurtOS
description: Download GurtOS v0.1.0-preview, the signed install images for GurtOS Server and GurtOS Personal, with checksums, how to verify them, minimum hardware and install steps.
sidebar:
  label: Download
---

**v0.1.0-preview.** A preview. It works end to end but has not had a security audit. Install it on a spare machine or
a virtual machine: the installer takes the whole disk. All four images are built from one commit (`e36a6cc`) and signed.

## Which file

| Your machine | File | Size | Download |
|---|---|---|---|
| A PC, server or cloud VM (Intel or AMD) | `gurtos-server-x86_64.iso` | 1.37 GB | [GitHub](https://github.com/benz16107/calhacks13/releases/download/v0.1.0-preview/gurtos-server-x86_64.iso) · [mirror](https://sjc1.vultrobjects.com/gurtos/v0.1.0-preview/gurtos-server-x86_64.iso) |
| An Apple silicon Mac (UTM or Parallels) or an arm64 server | `gurtos-server-arm64.iso` | 1.36 GB | [GitHub](https://github.com/benz16107/calhacks13/releases/download/v0.1.0-preview/gurtos-server-arm64.iso) · [mirror](https://sjc1.vultrobjects.com/gurtos/v0.1.0-preview/gurtos-server-arm64.iso) |
| GurtOS Personal on a PC or laptop (Intel or AMD) | `gurtos-personal-x86_64.iso` | 1.78 GB | [GitHub](https://github.com/benz16107/calhacks13/releases/download/v0.1.0-preview/gurtos-personal-x86_64.iso) · [mirror](https://sjc1.vultrobjects.com/gurtos/v0.1.0-preview/gurtos-personal-x86_64.iso) |
| GurtOS Personal on an Apple silicon Mac (UTM or Parallels) | `gurtos-personal-arm64.iso` | 1.77 GB | [GitHub](https://github.com/benz16107/calhacks13/releases/download/v0.1.0-preview/gurtos-personal-arm64.iso) · [mirror](https://sjc1.vultrobjects.com/gurtos/v0.1.0-preview/gurtos-personal-arm64.iso) |

Checksums and signature: [SHA256SUMS](https://sjc1.vultrobjects.com/gurtos/v0.1.0-preview/SHA256SUMS),
[SHA256SUMS.sig](https://sjc1.vultrobjects.com/gurtos/v0.1.0-preview/SHA256SUMS.sig) and
[allowed_signers](https://sjc1.vultrobjects.com/gurtos/v0.1.0-preview/allowed_signers). They are also on the
[release page](https://github.com/benz16107/calhacks13/releases/tag/v0.1.0-preview).

SHA-256:

```text
1676fa7183f35b3ab7b5a9c695adb6d795efc0925aef32c314c884ba42d08c0a  gurtos-server-x86_64.iso
07e3daca006faf892b9a3c2574536303888f36dbf29f38c8651f6a195b712377  gurtos-server-arm64.iso
0ba7ff5caa1bcc73073c94435131b48434a2128a46576320878ea77b2616bca3  gurtos-personal-x86_64.iso
4d78deb9c879b9cc5325208d2e9e18c1d63e0620a7ebbbd2a559449ba8e7bbce  gurtos-personal-arm64.iso
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

- 2 cores (4 recommended) and 4 GB of memory. A 20 GB disk for GurtOS Server, 32 GB for GurtOS Personal. The installer
  uses the whole disk.
- x86_64: BIOS or UEFI. arm64: UEFI. Secure Boot off: the boot loader is not signed.
- Internet on first start. The box downloads Factory's Droid CLI then, about 300 MB (GurtOS does not redistribute it).
  GurtOS Personal also downloads its voice model, about 490 MB. Agents call the model over the internet.

## Install

1. Write the ISO to a USB stick (balenaEtcher, or `sudo dd if=<file>.iso of=/dev/sdX bs=4M status=progress`),
   or attach it to a VM as its CD. On a cloud VM such as Vultr, add the ISO by its URL as a custom ISO and deploy from
   it. A new Vultr instance shows iPXE for about a minute while the ISO mounts.
2. Start from it. On a blank disk it installs in a few minutes and restarts into GurtOS Setup. A disk with anything on
   it is erased only after you type `erase`.
3. Setup asks for one model key: an Anthropic API key ([console.anthropic.com](https://console.anthropic.com)) or a
   Factory API key ([app.factory.ai](https://app.factory.ai)). Agents never see it. Every app is optional and stays
   off until you add its keys.
4. Open **Tasks**, then **New task**.

On GurtOS Personal, GNOME's own first-boot setup runs first and makes your account. See
[Install GurtOS Personal](/get-started/install-personal/).

On a cloud VM, run setup in the provider's web console: the box's portal only answers private networks.

More detail: [Install GurtOS Server](/get-started/install-server/) and [Your first task](/get-started/first-task/).

## Known limits

- On GurtOS Server, the first-boot setup clock reads UTC until the wizard's time zone step.
- On GurtOS Personal, GNOME's first "Welcome!" page still shows Ubuntu's wallpaper behind it.
- Both editions include `age` for encrypted backups. The owner holds the key.

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
