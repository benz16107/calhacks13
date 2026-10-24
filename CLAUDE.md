# GurtOS

Instructions for coding agents (and people) working in this repo. Contributor guide: `CONTRIBUTING.md`.

GurtOS is an operating system for a machine where AI agents do work safely, watched and controlled from a web
portal and a phone. It started as a Cal Hacks 13.0 project. It is a preview: see `README.md`.

**Naming rule:** anything a person reads (the portal, the box screen, the docs, the README) says **GurtOS**,
and the editions are **GurtOS Server**, **GurtOS Personal** and **GurtOS Business**. Internal names stay `box`:
`core/box.ts`, `BOX_*` variables, `box.service`, `box-<id>` users, `/etc/box`. Don't rename those.

## What it does

Ubuntu 24.04 is the base; GurtOS adds the box service, the box's own full-screen screen, first-boot setup,
whole-system updates with rollback, and nothing else (no desktop on Server, no user with sudo). The product is
four moments, and every change serves one of them or plugs into them:

1. **Undo one task.** Each task runs as its own Linux user, in its own copy of the files. Undo one task's
   changes without touching any other task's, outside git.
2. **The booby-trapped page.** An agent reads a web page with hidden instructions that try to steal keys.
   It fails: agents never see secrets (the vault holds them and makes calls for the agent), and the task's
   network only reaches what it needs. The attempt is logged and the task undone.
3. **A pause for your OK.** Any task can stop and ask (for example, spending above its budget). The request
   reaches the portal and phone live while other tasks keep running. Approve, and it carries on.
4. **Pull the plug.** Hard-kill the box. When it boots, every task resumes where it was.

Also: one action log of everything every agent did, and the cost of each task.

## Editions

The same core ships as Server and Personal, and either can run as Business. They differ in who the box belongs to
and how its screen and controls are presented.

- **Server:** an always-on box at home or in the cloud. Agents work 24/7. The screen is the box's own
  full-screen UI. There is no human user with sudo.
- **Personal:** installed on your own laptop or desktop. Ubuntu's GNOME desktop, your own account with sudo.
  Agents work beside you as separate users without sudo, on copies of your real folders, and nothing changes in
  your folders until you choose Keep. The desktop side is in `personal/`.
- **Business (preview):** a setting on a Server or Personal box, not a separate image. One box shared by several
  people: roles, a policy in plain words that routes each approval to who may answer it, an audit trail, a kill
  switch, shadow mode and work-account sign-in. It is off unless turned on, and a box without it behaves exactly as
  before. The rules are `core/business.ts`; `core/README.md` has the API.

## Decided

- TypeScript on Node 22.18 or newer, run directly (type stripping), no build step. It must run on arm64 and x86_64.
- Factory's Droid is the worker inside every task, with Claude as the model. A box needs one model key: an
  Anthropic API key or a Factory API key.
- SpacetimeDB, self-hosted on the box (TypeScript module), holds live task status and approvals. The action
  log stays on disk so undo and resume don't depend on it.
- The box's screen and the portal are one web app (`portal/`). Its design comes from Figma.
- Every app ("track") is one folder that registers itself. The core never imports a track.

## Layout

- `core/` the box service. `core/contract.ts` is the contract (tasks, the action log, the five slots, the API
  tracks get). **Read `core/README.md` before writing a track.**
- `tracks/<name>/` one folder per app. `track.ts` default-exports a `Track`; the box loads every
  `tracks/*/track.ts` at boot. `demo.ts` is the app's demo step. Its own `package.json` if it needs packages
  (the root is an npm workspace). `tracks/example/` shows every slot.
- `portal/` the web app for the portal and the box's own screen.
- `personal/` the GurtOS Personal desktop layer (notifications, top-bar indicator, Files action, Keep and Undo).
- `image/` the bootable images and their installer, updates and rollback.
- `site/` the public docs at gurtos.com. `showcase/` the Cal Hacks showcase at calhacks.gurtos.com.
- `native/` the GurtOS apps for iPhone, Apple Watch and Mac (one SwiftUI project, `native/apple`) and the Android APK
  (`native/android`). They use the box API like the portal; `native/demo.ts` checks their calls.
- `release/` how releases are built, signed and published, and the public-readiness audit.
- `docs/` design notes and the Figma log. `spikes/` throwaway experiments from the first night.
- `demo` the merge gate (below). `deploy` installs origin/main as the box service on a machine you name.

On a box: `BOX_HOME=/var/lib/box` holds `log.jsonl`, `workspaces/`, `views/` and `tasks/<id>/`. The vault is
`/etc/box/vault.env` (root, 0600). The API is `127.0.0.1:7700`. Task users are `box-<id>`, uids 30000 to
39999.

## Rules for every change

- `npm test` and `npm run check` pass on any machine.
- **`./demo` is the merge gate.** It ships your checkout to an Ubuntu 24.04 VM with root and runs the four
  moments, then every `tracks/*/demo.ts`. Exit 0 means you may merge; main must always pass. Runs from different
  checkouts are isolated and can share one VM. Real Droid is off by default because it spends model credit:
  `./demo` uses a scripted worker, and `./demo --live-droid` runs the real steps. An app's own real-model step
  must be gated the same way.
- Done means a step in `demo` that shows your part working, and a README.md in your folder.
- A change to `core/` or the contract is its own change, reviewed on its own.
- **No keys, tokens, passwords, seeds or pairing codes in the repo**, and no machine names, IP addresses or
  personal email addresses in committed files. Keys live in `/etc/box/vault.env` on the box, or git-ignored files.
- Never run box code as root on your own machine: it creates users, firewall rules and services. Use a VM.
- Label test or simulated payments as test, in the UI and the README.
- Write for people: plain words, no em dashes, short sentences.
- No Co-Authored-By or "Generated with" lines in commits or pull requests.
