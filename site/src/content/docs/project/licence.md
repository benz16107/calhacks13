---
title: Licence
description: The licence for GurtOS and these docs is to be decided. This page lists the licences of the third-party software GurtOS is built from.
---

## GurtOS

**Licence to be decided.** GurtOS has not chosen a licence yet. Until it does, no licence is granted to use, copy,
change or share the GurtOS source or its OS images. This page will name the licence when one is chosen.

## These docs

**Licence to be decided**, on the same terms.

## Third-party software

GurtOS is built from other people's work, each under its own licence. The main parts:

| Component | Where it is used | Licence |
|---|---|---|
| Ubuntu 24.04 packages | The OS image and the Ubuntu install | Each package's own licence, mostly free and open source |
| Node.js | Runs the core, the apps and the portal's build | MIT, with bundled components under their own licences |
| SpacetimeDB | Live task and approval tables | See SpacetimeDB's licence |
| Factory's Droid CLI | The agent inside each task | Factory's terms |
| Preact, esbuild | The portal | MIT |
| Instrument Sans, IBM Plex Mono | The portal's and these docs' fonts | SIL Open Font License 1.1 |
| Astro, Starlight, Pagefind | These docs | MIT |

Apps that call outside services, such as Jira, Elastic, Stripe or Apify, use those services under your own account
and that provider's terms.

## Related

- [Contributing](/project/contributing/)
- [Report a vulnerability](/security/reporting/)
