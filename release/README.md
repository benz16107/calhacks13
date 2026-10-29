# Releases

How a GurtOS release is built, signed and published, and how to check one.

| File | What |
|---|---|
| `audit.md` | The public-readiness audit of the repository and its history |
| `check.ts` | `node release/check.ts`: scans main's files for private details and secrets. Run before a release |
| `scan-history.py` | Searches every blob in every ref for real secret values read from files you name |
| `allowed_signers` | The release signing key, in the format `ssh-keygen -Y verify` reads |
| `update.pub` | The update-signing key that release images trust for `box-update` |
| `publish.sh` | Signs `SHA256SUMS` and uploads a release folder to GitHub |
| `image-sbom.py` | Writes the software bill of materials for an image |
| `licenses.md` | What each licence in the images and the repository is, and what needs a decision |
| `notes/<version>.md` | Release notes, with each file's size and SHA-256. Copy the last release's and edit it |

## Build it yourself

Any Ubuntu 24.04 machine or VM with root can build every edition. The build downloads Ubuntu's packages, Node.js
and SpacetimeDB, so it needs the internet.

```sh
git clone https://github.com/benz16107/gurtos.git gurtos && cd gurtos
image/build                     # GurtOS Server, x86_64
image/build personal            # GurtOS Personal, x86_64
image/build arm64               # GurtOS Server, arm64 (on an x86_64 machine: emulated, about an hour)
image/build personal arm64      # GurtOS Personal, arm64
```

The ISOs are in `/var/lib/box-image/out/`. Measured on a fresh 4 vCPU, 8 GB x86_64 cloud VM, from a
clean clone of main, with downloads from the provider's network. Plan on 4 GB of memory and 40 GB free for building
both editions:

| Build | Time | Peak memory | Disk used |
|---|---|---|---|
| Server x86_64 | 5 min 34 s from a fresh `git clone` of the release commit (4 min 24 s earlier) | 1.0 to 1.5 GB | 7 GB (4.4 GB cached base, 2.5 GB output) |
| Personal x86_64 | 6 min 45 s, from a fresh `git clone` of the release commit | 1.7 GB | 11 GB (7 GB cached base, 3.6 GB output) |
| Server arm64, native | 4 min 37 s (Apple M2 Max VM, 6 cores, 8 GB) | | |
| Personal arm64, native | 5 min (same VM, base cached) | | |

A second build of the same edition reuses the cached Ubuntu base in `/var/lib/box-image/<arch>/` and takes a
few minutes. To start clean, delete `/var/lib/box-image`.

## Keys

Two ed25519 keys, both made for v0.1.0-preview, used again for v0.2.0-preview, and kept off the build machines and out of git:

- **The release signing key** signs `SHA256SUMS`. Its public half is `allowed_signers` here and on each release.
  Fingerprint `SHA256:FWKFb1eAvEBmMhVJwMwTnLnhrmZ5yQZ5947pDvFKcpY`.
- **The update-signing key** signs each system image (`.sqfs`) that `box-update` installs. The release images
  carry its public half (`update.pub`) in `/etc/box-os/update.pub`, so a machine installed from a release only
  takes updates signed by this key. The build copies it to the build machine for the build and deletes the
  machine afterwards.

An image you build yourself makes its own update key on the build machine and trusts only that one.

## Making a release

The steps, as they were run for v0.1.0-preview and tightened since. About 75 minutes from the commit to a verified
release. Each build machine is a fresh Ubuntu 24.04 VM of the right architecture, deleted afterwards.

1. **Pick the commit.** `node release/check.ts` and the history scans in `audit.md` are clean, and `./demo` passes
   on that commit. Pin its SHA. Write `notes/<version>.md` from the last release's notes and `git log <last tag>..<sha>`.
2. **Build, in parallel** (about 13 minutes). Each build is `git clone`, then `git checkout <sha>`, then
   `BOX_VERSION=<version> BOX_UPDATE_KEY=<update key file> image/build [personal] [arm64]`.
   - x86_64 Server then Personal on a 4 vCPU, 8 GB VM (5.5 and 7 minutes). Copy the update key to the VM for the
     build and delete the VM afterwards.
   - arm64 Server then Personal natively on an arm64 VM (5 minutes each; the first Personal build is slower, about
     19 minutes cold). It needs 13 GB free; delete stale `base-*` folders under `/var/lib/box-image/*/` if it is
     full. Leave `BOX_TEST_DISC_HOST` unset for a release.
   - Check each image: `mount -o loop,ro <iso>.sqfs`, then no `usr/local/bin/droid`, `usr/bin/age` present, the
     right `PRETTY_NAME`, and `etc/box-os/update.pub` equal to the release update key's public half
     (`release/update.pub`).
   - Check that each unpacked system fits its update slot, 6 GB on Server and 12 GB on Personal
     (`unsquashfs -s` or `du -sh` on the mounted image). An image that does not fit cannot be installed with
     `box-update`.
3. **Copy the files off the build VM** into one folder on the machine that holds the release key, and `sha256sum`
   them against the build VM's hashes.
4. **Test the final bits.** Boot-test every ISO with `ISO=<file> image/test` (add `--personal` and `--arm64` as
   needed): it installs the disc in QEMU, starts it, and checks it comes back after a power cut. A release disc has
   no sshd, so test a Server **update and rollback** with a debug build of the same commit: build Server x86_64 with
   `BOX_SSH_KEY=<public key file>` on the build VM (about 6 minutes), then
   `SSH_PORT=<free port> BUILD_HOST=root@<build vm> image/test --debug` on a machine with KVM (it installs, updates
   to slot B, and checks that a broken update rolls back by itself). Do the same for Personal with `--personal`.
   Then update a Personal install of the previous release to the new `.sqfs` with `sudo box-update apply <url>`.
5. **Sign and stage.** `DRAFT=1 TARGET=<full commit> RELEASE_KEY=<key> release/publish.sh <version> <folder>`
   writes `SHA256SUMS` for the ISOs and update images, signs it and uploads every ISO, update image (`.sqfs` with
   its `.sha256` and `.sig`) and bill of materials to a draft GitHub release, which nobody else sees. To include the
   Android app (`gurtos-android-<version>.apk`), write `SHA256SUMS` by hand with its line too and sign it with
   `ssh-keygen -Y sign -f <release key> -n gurtos-release SHA256SUMS`. Verify with `release/allowed_signers`.
6. **Publish.** Update `README.md`, `notes/<version>.md` and the download page in `site/`, then run the same
   command without `DRAFT`. It uploads what the draft lacks, makes the tag at `TARGET`, publishes the release and
   checks the public `SHA256SUMS`. GitHub caps files at 2 GiB; the script stops before uploading a larger file.
   Each `gurtos-<edition>-<arch>.sqfs` sits beside its `.sha256` and `.sig`, so `box-update apply <url>` finds them.
7. **Verify as a stranger** on a clean VM as a new user: download everything from GitHub and run the two commands
   below.
8. **Update the download pages** (gurtos.com/download in `site/`, and the showcase) with the new checksums. Then
   delete the build VM, the test VMs and their custom ISOs, and the staging files.

Limits met on the way: some cloud providers allow only two custom ISOs per account, and a monthly spending limit can
refuse a new VM.

## Verify a release

```sh
ssh-keygen -Y verify -f allowed_signers -I gurtos -n gurtos-release -s SHA256SUMS.sig < SHA256SUMS
sha256sum -c SHA256SUMS --ignore-missing
```

`allowed_signers` in this folder and on the release must match.
