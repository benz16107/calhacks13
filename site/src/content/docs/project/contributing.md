---
title: Contributing
description: How the GurtOS source is organized, the rules for changes, and how changes are tested. GurtOS is open source under Apache-2.0.
---

The GurtOS source is public at [github.com/benz16107/calhacks13](https://github.com/benz16107/calhacks13), under the
Apache License 2.0. Report bugs and suggest changes with GitHub issues and pull requests. This page shows how the
source is organized and how changes are tested.

To report a security problem, follow [Report a vulnerability](/security/reporting/) instead.

## How the source is organized

| Folder | What it holds |
|---|---|
| `core/` | The GurtOS service (`box`): tasks, the vault and broker, the network proxy, approvals, the action log and the HTTP API. `core/contract.ts` is the contract every app builds against. |
| `tracks/<name>/` | One folder per app. Each has a `track.ts` that default-exports the app, and a `demo.ts` test step. |
| `portal/` | The web app for the box's screen, a browser and a phone. Its built `dist/` is committed, so the box needs no build step. |
| `image/` | The OS image: the build script, the installer, `box-update` and the files the image adds. |
| `site/` | This documentation. |

The core never imports an app. It loads every `tracks/*/track.ts` at boot, and an app that fails to load is skipped.

## Rules for changes

- **TypeScript on Node.js 22 or newer**, run directly with type stripping: no build step for the core or apps.
  Use `import type`, `.ts` in import paths, and no enums, namespaces or constructor parameter properties.
- **It must run on arm64 and x86_64.**
- **Apps import only types from `core/contract.ts`.** Never another core file, never another app. See the
  [app SDK](/reference/app-sdk/).
- **No keys or tokens in the repository.** They live in the vault on test machines.
- **Never return a secret** from a tool, a route or a job. Results go into the action log.
- **Label test money as test money**, in the UI and in docs.
- **Write for people:** plain words, short sentences, no em dashes.

## Test a change

```sh
npm test          # unit tests, on any machine
npm run check     # type check
./demo            # the test suite, on a test VM; exit 0 means it passes
```

The test suite needs a disposable Ubuntu 24.04 VM with passwordless `sudo`, because the box runs as root, creates
users and mounts filesystems. Never run it on a machine you use for anything else. A change may merge only when the
test suite passes. See [Test suite](/reference/test-suite/).

## Work on these docs

The site is [Astro Starlight](https://starlight.astro.build) in `site/`:

```sh
cd site
npm ci
npm run dev       # a local preview with live reload
npm run build     # the static site in site/dist, with the search index
```

- Pages are Markdown in `site/src/content/docs/`, grouped by the four kinds of documentation: tutorials (Get
  started), how-to guides, reference and explanation (Concepts).
- The product name is one value, `NAME` in `site/src/product.ts`. Write "GurtOS" in prose and the build swaps in
  `NAME`.
- Mark anything not built as **Planned** and anything incomplete as **Preview**, and add it to the
  [roadmap](/project/roadmap/).
- Use example values only: `box.local`, `192.0.2.10`, `your-site.atlassian.net`. Never a real host name, address,
  key or account.
- The HTTP API reference is generated from `site/openapi/box-api.yaml`. Update it when a route changes.

## Related

- [Licence](/project/licence/)
- [Changelog](/project/changelog/)
- [Architecture](/concepts/architecture/)
