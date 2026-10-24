---
title: Licence
description: GurtOS is open source under the Apache License 2.0. This page links the licence and lists the licences of the third-party software GurtOS is built from.
---

## GurtOS

GurtOS is open source under the **Apache License 2.0**. The source is at
[github.com/benz16107/calhacks13](https://github.com/benz16107/calhacks13), and the full licence text is in its
[LICENSE](https://github.com/benz16107/calhacks13/blob/main/LICENSE) file.

In short, you may use, copy, change and share GurtOS, including in commercial products, as long as you keep the
licence and copyright notices and state what you changed. The licence includes a patent grant from contributors.
It gives no warranty. The LICENSE file is the authority; this summary is not legal advice.

These docs are part of the same repository, in `site/`, under the same licence.

## Third-party software

GurtOS is built from other people's work, each under its own licence. The main parts:

| Component | Where it is used | Licence |
|---|---|---|
| Ubuntu 24.04 packages | The OS images and the Ubuntu install | Each package's own licence, mostly free and open source |
| Node.js | Runs the core, the apps and the portal's build | MIT, with bundled components under their own licences |
| SpacetimeDB | Live task and approval tables | See SpacetimeDB's licence |
| Factory's Droid CLI | The agent inside each task | Factory's terms |
| Preact, esbuild | The portal | MIT |
| Atkinson Hyperlegible, Adwaita icons | The portal's fonts and icons | SIL Open Font License 1.1; Adwaita icons under their own licence |
| Instrument Sans, IBM Plex Mono | These docs' fonts | SIL Open Font License 1.1 |
| Astro, Starlight, Pagefind | These docs | MIT |

Model providers and apps that call outside services, such as Anthropic, Factory, Jira, Elastic, Stripe or Apify, are
used under your own account and that provider's terms.

## Related

- [Contributing](/project/contributing/)
- [Report a vulnerability](/security/reporting/)
