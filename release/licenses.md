# Licences

GurtOS's own code is under the [Apache License 2.0](../LICENSE). An image is not one program: it is Ubuntu's
packages, a few other programs and GurtOS's code, side by side, each under its own licence. Putting a GPL program
and an Apache-2.0 program on the same disc does not change either licence. This page lists what the images and the
repository contain, and flags what does not fit a plain Apache-2.0 story. It is a first pass by the maintainers, not
legal advice, and the roadmap lists a proper licence and trademark review before 1.0. The npm numbers below were
checked against `main`'s lockfiles on Oct 29, 2026; the image numbers come from v0.1.0-preview's SBOMs.

The machine-readable lists are the SBOMs attached to each release, one for the source and one for each image
(CycloneDX, and SPDX for the source). Each Ubuntu package's licence is read from its own
`/usr/share/doc/<package>/copyright` by `release/image-sbom.py`.

## GurtOS's own code

Apache-2.0: `core/`, `tracks/`, `portal/`, `personal/`, `image/`, `native/`, `relay/`, `site/`, `showcase/`,
`release/` and the scripts. The root `package.json` and every workspace package say so.

## Flagged: read these

| What | Licence | Where | Why it is flagged |
|---|---|---|---|
| **Moss** (`@moss-js/moss` 1.21.0, `@moss-js/moss-core` 0.36.0 and its native library), by InferEdge | `@moss-js/moss`: PolyForm Shield 1.0.0. `moss-core` and its native library: marked "Proprietary", with no licence text in the package | **Not on any box or image.** A dev dependency of the Find app only, so `npm ci --omit=dev` (core/install.sh, and so the images) leaves it out. An owner who wants Moss installs it on a source install and accepts InferEdge's terms (tracks/find/README.md) | Decided for the launch: we do not pass it on. PolyForm Shield forbids use in a competing product and the native library has no redistribution grant. Find works without it, searching by words |
| **SpacetimeDB** (Clockwork Laboratories) | Business Source License 1.1. Each version becomes AGPL-3.0 with a linking exception on its own change date: 2031-10-14 for 2.13.0, 2031-10-25 for 2.14.0 | Both images, as the box's live-status database, installed by `core/setup.sh`; the version it installs sets the change date. The `spacetimedb` client library (ISC) is a separate npm package | Not an open-source licence until the change date. The use grant allows "no more than one SpacetimeDB instance in production" per application or service, and no "Database Service" for third parties. One person's box fits. Someone who runs many GurtOS boxes as one service, or offers GurtOS as a hosted service, must read it and may need a licence from Clockwork Labs |
| **Factory's Droid CLI** | Factory's EULA and terms (internal use; no redistribution) | **Not in any image.** Each box downloads it on first start. | The one program GurtOS needs that we may not ship. The Droid SDK in `node_modules` is Apache-2.0 and is shipped. Roadmap: a worker we can redistribute. |
| **linux-firmware** (about 25 packages) | Vendor licences, each marked "Redistributable-...", plus two marked "Unknown" | Both images | Binary firmware blobs, not open source. Ubuntu may redistribute them, so we do; the licences vary by vendor. The "Unknown" ones are `linux-firmware-misc` and `linux-firmware-qlogic`. |
| **Ghostscript and the URW fonts** | AGPL-3 (with a font exception for the fonts) | Personal only (the printing stack) | AGPL's network clause applies if you modify and offer it as a service. GurtOS runs it unmodified as a separate program. |
| **Video and audio codecs** (x264, GStreamer "bad" plugins, libde265, FLAC and others) | GPL-2+ with exceptions, LGPL, and a few marked unknown | Personal only | Some codecs are patent-encumbered in some countries, which a licence page cannot settle. Ubuntu ships them in `universe`. |
| **Atkinson Hyperlegible Next and Mono** (Fontsource packages) | SIL Open Font License 1.1 | Bundled into `portal/dist` (every box, and app.gurtos.com) and the docs site | The OFL allows bundling with software if each copy carries the fonts' copyright notice and the licence. NOTICE now carries the copyright lines; `portal/dist` does not yet carry the licence text beside the font files |
| **Ubuntu Font Licence 1.0** (`fonts-ubuntu`) | UFL 1.0 | Personal only | A font licence with a rename-on-modify rule. We do not modify the fonts. |
| **Ubuntu and GNOME artwork and themes** (Yaru, wallpapers) | CC-BY-SA 3.0 and 4.0, and GPL | Personal only | Share-alike licences on artwork. We ship them unmodified. GurtOS adds its own icon and theme layer under Apache-2.0. |
| **Papirus icons and Bibata cursors** | GPL-3 | Personal only | Copyleft artwork that GurtOS's icon theme is built from at install time. |
| **Ubuntu trademarks** | Canonical's trademark policy | Both images | GurtOS is built on Ubuntu 24.04 and says so in `/etc/os-release` (`ID_LIKE=ubuntu`). It is not Ubuntu and is not endorsed by Canonical. The GurtOS name and marks are ours, and the roadmap includes reviewing them. |
| **Packages with no licence recorded** | n/a | 96 of 444 packages (Server), 244 of 1,263 (Personal) | The package's `copyright` file is not in the machine-readable format, so the script cannot read a short name. The licence is in the file's text. |

## What each image contains

| Image | Ubuntu packages | Other components in the SBOM |
|---|---|---|
| Server x86_64 | 444 | 560 npm packages (the box's code and its dependencies), about 200 Go modules inside four programs (Caddy 149, frpc 41, the TypeScript native compiler 10 and `age` 4), SpacetimeDB, Node.js, 4 Python packages |
| Server arm64 | 437 | the same, with 203 Go modules |
| Personal x86_64 | 1,263 | the same, plus Go modules in two more system programs (`ipp-usb`, `libsysmetrics`) and 42 Python packages (Ubuntu's own Python libraries for the desktop, and the requirements of the `fetch` app) |
| Personal arm64 | 1,253 | the same, with 207 Go modules |

Ubuntu packages by declared licence, Server x86_64 (444 packages; Personal is similar, with more of the same):
GPL-2 or later 164, LGPL-2.1 or later 122, no licence recorded 96, Expat (MIT) 75, LGPL-2 or later 73, BSD-3-Clause
92, GPL-2 63, GPL-3 or later 63, public domain 58, Apache-2.0 40, MIT 38, BSD-2-Clause 34, ISC 30, and a long tail.
(A package can declare several licences, so the counts add up to more than the number of packages.) No package in
either image declares a non-commercial, "no derivatives" or source-available licence other than the items flagged
above.

## npm packages shipped on the box

`npm ci --omit=dev` (what `core/install.sh` runs on every box and in every image) installs 327 packages on x86_64
or arm64, because the apps in `tracks/` are npm workspaces and their packages come too: MIT 288, Apache-2.0 18,
ISC 10, BSD-3-Clause 6, BSD-2-Clause 2, 0BSD 2 and Unlicense 1. The Moss packages are dev dependencies and are not
among them. None is copyleft. Most of the Apache-2.0 packages belong to the test-money
apps (the x402, Solana and Sign-In with Ethereum libraries); the others are the Droid SDK, the OpenTelemetry API,
`axios-retry`, `reflect-metadata` and TypeScript. TypeScript ships its own `NOTICE.txt`, which stays in its folder
on the box.

The licence of each package is the `license` field in `package-lock.json`, checked against the package's own
`package.json` and licence file where they differ.

## The portal and the docs site

The portal is built into `portal/dist`, which every box serves. Its build-time packages (31 in
`portal/package-lock.json`) are MIT, apart from the two OFL font packages above. What ends up in `portal/dist` is
preact (MIT), qrcode-generator (MIT), the fonts, and GurtOS's own code. esbuild (MIT) only builds it.

The docs site (`site/`, 476 packages) is not shipped on a box; only its built pages are published, at gurtos.com.
Build tools under weaker copyleft run only at build time: lightningcss (MPL-2.0) and sharp's libvips binaries
(LGPL-3.0-or-later), which make the site's images. The published pages carry the Starlight and Astro code (MIT) and
the OFL fonts. Nothing in either lockfile is incompatible with publishing the site under Apache-2.0.

## The native apps

- **iPhone, Watch and Mac** (`native/apple`): GurtKit has no third-party dependencies, only Apple's frameworks.
- **Android** (`native/android`): a Trusted Web Activity built on `androidbrowserhelper` 2.7.4 and the AndroidX
  libraries it pulls in, all Apache-2.0. The signed APK on the release is built from this source.

## Before 1.0

Everything in the "flagged" table needs a decision a lawyer should make, not us: whether Moss may ever be shipped,
the SpacetimeDB terms if GurtOS is run as a fleet or offered as a hosted service, the firmware and codec
rules per country, the Ubuntu trademark terms for a derivative that ships an Ubuntu desktop, and a replacement for
the Droid CLI. One smaller fix needs no lawyer: copy the fonts' licence into `portal/dist`. They are on the [roadmap](../ROADMAP.md).
