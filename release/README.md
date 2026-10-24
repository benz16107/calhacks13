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
clean clone of main, with downloads from Vultr's network. Plan on 4 GB of memory and 40 GB free for building
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

Two ed25519 keys, both made for v0.1.0-preview and kept off the build machines and out of git:

- **The release signing key** signs `SHA256SUMS`. Its public half is `allowed_signers` here and on each release.
  Fingerprint `SHA256:FWKFb1eAvEBmMhVJwMwTnLnhrmZ5yQZ5947pDvFKcpY`.
- **The update-signing key** signs each system image (`.sqfs`) that `box-update` installs. The release images
  carry its public half (`update.pub`) in `/etc/box-os/update.pub`, so a machine installed from a release only
  takes updates signed by this key. The build copies it to the build machine for the build and deletes the
  machine afterwards.

An image you build yourself makes its own update key on the build machine and trusts only that one.

## Making a release

The steps as they were run for v0.1.0-preview, with how long each took. About 75 minutes from the commit to a
verified release, plus the owners' page updates.

1. **Pick the commit.** `node release/check.ts` and the history scans in `audit.md` are clean, and `./demo`
   passes on that commit. Pin its SHA.
2. **Build, in parallel** (about 13 minutes). Each build is `git clone` then `git checkout <sha>` then
   `BOX_VERSION=<version> BOX_UPDATE_KEY=<update key file> image/build [personal] [arm64]`.
   - x86_64 Server then Personal on a fresh Vultr `vc2-4c-8gb` (5.5 and 7 minutes). Copy the update key to the VM
     for the build and delete the VM afterwards.
   - arm64 Server then Personal natively in the laptop's Lima VM through `BUILD_SHELL='ssh <laptop>
     /opt/homebrew/bin/limactl shell box --'` (5 minutes each). It needs 13 GB free; delete stale `base-*` folders
     under `/var/lib/box-image/*/` if it is full.
   - Check each image: `mount -o loop,ro <iso>.sqfs`, then no `usr/local/bin/droid`, `usr/bin/age` present, the
     right `PRETTY_NAME`, and `etc/box-os/update.pub` equal to the release update key's public half.
3. **Upload to the mirror's `staging/` folder** with `s3cmd put --acl-public` (x86_64 from the Vultr VM takes about
   a minute per ISO; arm64 from the laptop's home uplink about 12 minutes per ISO, so start it as soon as each
   build finishes). A live folder keeps matching its published checksums until the swap in step 6.
4. **Test the final bits.** Add the staged x86_64 Server ISO to Vultr by URL and compare its md5 with the build's;
   deploy a `vc2-2c-4gb` from it, run setup at the console with only a model key, and run one task. Boot-test
   Personal x86_64 with `SSH_PORT=<free port> ISO=<file> image/test --personal` where memory allows.
5. **Sign.** On the machine that holds the release key: download the four staged ISOs (about 17 minutes from a
   Mac-class home link; do it while step 3 runs), `sha256sum` them against the build hosts' hashes, write
   `SHA256SUMS` (the four ISOs plus `gurtos-android-0.1.0.apk`, which the native apps thread publishes on the release;
   download it and keep its line), and `ssh-keygen -Y sign -f <release key> -n gurtos-release SHA256SUMS`. Verify with
   `release/allowed_signers`.
6. **Publish.** `s3cmd mv --acl-public` each staged ISO into `<version>/` and put `SHA256SUMS`, `SHA256SUMS.sig` and
   `allowed_signers` there. Move the tag to the commit (`git tag -f -a`, `git push -f origin <tag>`), update
   `release/notes/<version>.md`, `README.md` and `showcase/src/data/downloads.ts`, then
   `gh release edit <tag> --notes-file ...` and `gh release upload <tag> --clobber ...` (about 2 minutes). GitHub
   caps files at 2 GiB: a larger ISO goes on the mirror only, and the notes say so.
7. **Verify as a stranger** on a clean VM as a new user: download everything from GitHub, run the two commands
   below, and compare the checksum files from the mirror.
8. **Tell the owners** (docs thread: `/download`; showcase thread: `downloads.ts`) the new checksums, then delete
   the build VM, the test VMs and their custom ISOs, and the staging files.

Limits met on the way: Vultr allows two custom ISOs per account, and a monthly fee limit can refuse a new VM.

## Verify a release

```sh
ssh-keygen -Y verify -f allowed_signers -I gurtos -n gurtos-release -s SHA256SUMS.sig < SHA256SUMS
sha256sum -c SHA256SUMS --ignore-missing
```

`allowed_signers` in this folder and on the release must match.
