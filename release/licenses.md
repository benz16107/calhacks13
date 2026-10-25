# Licences

GurtOS's own code is under the [Apache License 2.0](../LICENSE). An image is not one program: it is Ubuntu's
packages, a few other programs and GurtOS's code, side by side, each under its own licence. Putting a GPL program
and an Apache-2.0 program on the same disc does not change either licence. This page lists what the images and the
repository contain, and flags what does not fit a plain Apache-2.0 story. It is a first pass by the maintainers, not
legal advice, and the roadmap lists a proper licence and trademark audit before 1.0.

The machine-readable lists are the SBOMs attached to each release, one for the source and one for each image
(CycloneDX, and SPDX for the source). Each Ubuntu package's licence is read from its own
`/usr/share/doc/<package>/copyright` by `release/image-sbom.py`.

## GurtOS's own code

Apache-2.0: `core/`, `tracks/`, `portal/`, `personal/`, `image/`, `native/`, `relay/`, `site/`, `showcase/`,
`release/` and the scripts. The root `package.json` and every workspace package say so.

## Flagged: read these

| What | Licence | Where | Why it is flagged |
|---|---|---|---|
| **SpacetimeDB** (Clockwork Laboratories) | Business Source License 1.1; becomes AGPL-3.0 with a linking exception on 2031-10-14 | Both images, as the box's live-status database; the `spacetimedb` client library (ISC) is a separate npm package | Not an open-source licence until the change date. The use grant allows one instance per box for your own use, which is how GurtOS runs it. It does **not** allow offering a database service to third parties. Anyone who builds a hosted service from GurtOS must read it. |
| **Factory's Droid CLI** | Factory's EULA and terms (internal use; no redistribution) | **Not in any image.** Each box downloads it on first start. | The one program GurtOS needs that we may not ship. The Droid SDK in `node_modules` is Apache-2.0 and is shipped. Roadmap: a worker we can redistribute. |
| **linux-firmware** (about 25 packages) | Vendor licences, each marked "Redistributable-...", plus two marked "Unknown" | Both images | Binary firmware blobs, not open source. Ubuntu may redistribute them, so we do; the licences vary by vendor. The "Unknown" ones are `linux-firmware-misc` and `linux-firmware-qlogic`. |
| **Ghostscript and the URW fonts** | AGPL-3 (with a font exception for the fonts) | Personal only (the printing stack) | AGPL's network clause applies if you modify and offer it as a service. GurtOS runs it unmodified as a separate program. |
| **Video and audio codecs** (x264, GStreamer "bad" plugins, libde265, FLAC and others) | GPL-2+ with exceptions, LGPL, and a few marked unknown | Personal only | Some codecs are patent-encumbered in some countries, which a licence page cannot settle. Ubuntu ships them in `universe`. |
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

`npm ci --omit=dev` installs 107 packages: MIT 92, ISC 10, Apache-2.0 2 (the Droid SDK and one other),
BSD-3-Clause 2, BSD-2-Clause 1. None is copyleft. The portal's build-time packages are bundled into `portal/dist`:
preact (MIT), qrcode-generator (MIT), esbuild (MIT, build only) and the Atkinson Hyperlegible fonts from Fontsource
(SIL Open Font License 1.1, which allows bundling and redistribution with software).

## The native apps

- **iPhone, Watch and Mac** (`native/apple`): GurtKit has no third-party dependencies, only Apple's frameworks.
- **Android** (`native/android`): a Trusted Web Activity built on `androidbrowserhelper` 2.7.4 and the AndroidX
  libraries it pulls in, all Apache-2.0. The signed APK on the release is built from this source.

## Before 1.0

Everything in the "flagged" table needs a decision a lawyer should make, not us: the SpacetimeDB terms if GurtOS is
ever offered as a hosted service, the firmware and codec rules per country, the Ubuntu trademark terms for a
derivative that ships an Ubuntu desktop, and a replacement for the Droid CLI. They are on the [roadmap](../ROADMAP.md).
