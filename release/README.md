# Releases

How a GurtOS release is built, signed and published, and how to check one.

| File | What |
|---|---|
| `audit.md` | The public-readiness audit of the repository and its history |
| `check.ts` | `node release/check.ts`: scans main's files for private details and secrets. Run before a release |
| `scan-history.py` | Searches every blob in every ref for real secret values read from files you name |
| `allowed_signers` | The release signing key, in the format `ssh-keygen -Y verify` reads |
| `update.pub` | The update-signing key that release images trust for `box-update` |
| `notes/<version>.md` | Release notes, with each file's size and SHA-256 |

## Build it yourself

Any Ubuntu 24.04 machine or VM with root can build every edition. The build downloads Ubuntu's packages, Node.js
and SpacetimeDB, so it needs the internet.

```sh
git clone https://github.com/benz16107/calhacks13.git gurtos && cd gurtos
image/build                     # GurtOS Server for this machine's architecture
image/build personal            # GurtOS Personal
image/build arm64               # arm64 on an x86_64 machine: emulated, several times slower
```

The ISOs are in `/var/lib/box-image/out/`. Measured on a fresh Vultr `vc2-4c-8gb` (4 vCPU, 8 GB, x86_64), from a
clean clone of main:

| Build | Time | Peak memory | Disk used |
|---|---|---|---|
| Server x86_64 | measuring | | |
| Personal x86_64 | | | |
| Server arm64, native | | | |
| Personal arm64, native | | | |

A second build of the same edition reuses the cached Ubuntu base in `/var/lib/box-image/<arch>/` and takes a
few minutes. To start clean, delete `/var/lib/box-image`.

## Keys

Two ed25519 keys, both made for v0.1.0-preview and kept off the build machines and out of git:

- **The release signing key** signs `SHA256SUMS`. Its public half is `allowed_signers` here and on each release.
  Fingerprint `SHA256:FWKFb1eAvEBmMhVJwMwTnLnhrmZ5yQZ5947pDvFKcpY`.
- **The update-signing key** signs each system image (`.sqfs`) that `box-update` installs. The release images
  carry its public half (`update.pub`) in `/etc/box-os/update.pub`, so a machine installed from a release only
  takes updates signed by this key. The build copies it to the build machine for the build and deletes the
  machine afterwards.

An image you build yourself makes its own update key on the build machine and trusts only that one.

## Making a release

1. `node release/check.ts` and the history scans in `audit.md` are clean, and `./demo` passes on main.
2. Build the four ISOs from a fresh clone of the tagged commit with `BOX_VERSION=<version>` and
   `BOX_UPDATE_KEY=<the update key>`: x86_64 on a fresh x86_64 VM, arm64 natively on an arm64 machine.
3. On a separate machine, download every ISO, compute `SHA256SUMS`, and sign it:
   `ssh-keygen -Y sign -f <release key> -n gurtos-release SHA256SUMS`.
4. Upload the ISOs, `SHA256SUMS`, `SHA256SUMS.sig` and `allowed_signers` to the mirror (Vultr Object Storage,
   bucket `gurtos`, public-read, one folder per version) and to the GitHub release. GitHub caps release files at
   2 GiB: a larger ISO goes on the mirror only, and the notes say so.
5. Download each file back from both places and verify it as a stranger would (below).

## Verify a release

```sh
ssh-keygen -Y verify -f allowed_signers -I gurtos -n gurtos-release -s SHA256SUMS.sig < SHA256SUMS
sha256sum -c SHA256SUMS --ignore-missing
```

`allowed_signers` in this folder and on the release must match.
