# calhacks13

Ben's solo Cal Hacks 13.0 project. "calhacks13" is a working name; the OS is not named yet.
Devpost deadline: Sun Oct 25, 9:00 AM PT. Judging at the table Sun 10:30 AM to 12:30 PM.

## What we're building

An OS for an always-on box where AI agents do work safely, watched and controlled from a web portal and a
phone. Ubuntu 24.04 is the base; our parts are the box service, the box's own full-screen screen, first-boot
setup, whole-system updates with rollback, and nothing else installed (no desktop, no user with sudo).
During the build everything runs as a service installed on plain Ubuntu VMs. The bootable image comes last.

The product is four demo moments. Every thread's work serves one of them or plugs into them:

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

The same OS ships in three editions. Server and Personal are built now; Team is a maybe for later. The core,
the tracks and the four moments are shared; the editions differ in who the box belongs to and how its screen
and controls are presented.

- **Server** (what we have built): an always-on box at home or in the cloud. The Vultr VM is a Server box,
  not a separate edition. Agents work 24/7. The box's screen is the home-server OS UI (Figma direction A).
  There is no human user with sudo.
- **Personal:** installed on your own laptop or desktop. You use it as a normal computer: Ubuntu's GNOME
  desktop, your own account with sudo. Agents work beside you as separate users without sudo, on copies of
  your real folders, with undo. The Box layer lives in the desktop: approvals as desktop notifications, a
  top-bar indicator for running tasks, the Box app (the portal in a window), Time Machine for what agents
  changed in your files, and "Ask an agent" on a folder in Files. The desktop side is built in `personal/`.
- **Team (maybe):** one box shared by several people with roles (who may approve what, up to how much),
  routed approvals, per-person budgets, a shared audit trail. Don't build it, but don't design anything that
  blocks it. For example, approvals already record who answered and could later record who is allowed to.

## Decided

- TypeScript on Node 22 or newer. It must run on ARM64 (laptop VM) and x86 (linuxbox and Vultr VMs).
- Factory's Droid SDK is the worker inside every task, with Claude as the model.
- SpacetimeDB, self-hosted on the box (TypeScript module), holds live task status and approvals. The action
  log stays on disk so undo and resume don't depend on it.
- The box's screen and the portal are one web app. Its design comes from Figma (Ben designs in FigJam and
  Figma Agent, Figma Make writes the first code). Don't hand-design UI before that handoff.
- Every track is one folder that registers itself. The core never imports a track.

## Layout

The core thread owns this section. Don't add other top-level folders; ask the core thread.

- `core/` the box service. Core thread only. `core/contract.ts` is the contract (tasks, the action log, the
  five slots, the API tracks get). **Read `core/README.md` before writing a track.**
- `tracks/<name>/` one folder per sponsor track, owned by that track's thread. `track.ts` default-exports a
  `Track`; the box loads every `tracks/*/track.ts` at boot. `demo.ts` is the track's demo step. Its own
  `package.json` if it needs packages (the root is an npm workspace). `tracks/example/` shows every slot.
- `portal/` the web app for the portal and the box's own screen, after the Figma handoff.
- `spikes/` throwaway tests (spike thread). `docs/` tracks and the Figma stage log. `image/` the bootable
  image, last.
- `demo` the merge gate. `./demo` ships your checkout to a test VM and runs the four moments, then every
  `tracks/*/demo.ts`. Exit 0 means you may merge. **Runs from different checkouts are isolated and go side by
  side on one VM**: each has its own `BOX_HOME` (`/var/lib/box-demo/<run>`), task users, ports and SpacetimeDB
  database, and cleans up after itself. A second run from the same checkout (same folder name) waits for the
  first. Machine setup and the SpacetimeDB CLI take a short lock. Don't touch `/var/lib/box` on a VM: that is
  the installed box.

On the box: `BOX_HOME=/var/lib/box` holds `log.jsonl`, `workspaces/`, `views/` and `tasks/<id>/`. The vault
is `/etc/box/vault.env` (root, 0600). The API is `127.0.0.1:7700`. Task users are `box-<id>`, uids 30000 to
39999. Node runs `.ts` directly (type stripping), no build step: `npm test`, `npm run check`.

## Rules for every thread

- Work only in your own folder. If you need a change in the core or the contract, say so in your final
  message instead of making it.
- Done means: a step in the `demo` script that shows your part working, and a README.md in your folder that
  covers what that sponsor requires (see `docs/tracks.md`).
- Merge to main yourself (squash) only when `demo` passes on a test VM. Main must always pass.
- No keys or tokens in the repo. They live in git-ignored files on the test machines.
- Never run box code as root on linuxbox's own system: it runs Ben's real services. Use the test VMs.
- Label test or simulated payments as test, in the UI and the README.
- Write for people: plain words, no em dashes, short sentences.
- Never add Co-Authored-By or "Generated with" lines to commits or PRs.

## Test machines

All three run Ubuntu 24.04 with passwordless root, and each has the sponsor keys in `/etc/box/vault.env`.
`./demo <name>` runs the merge gate on one; plain `./demo` uses the linuxbox VM when it is up, else the laptop.

- **laptop** (ARM64, Lima on Ben's MacBook): `ssh benmac 'limactl shell box -- <command>'`. It sleeps with the
  laptop, so don't rely on it overnight. This is the demo box on Sunday.
- **linuxbox** (x86, always on, Lima on linuxbox): `limactl shell box -- <command>` on linuxbox, with
  `/home/linuxbrew/.linuxbrew/bin` on PATH. The installed box service runs here (`core/install.sh`).
- **vultr** (x86, always on, public IP, San Jose): `ssh vultrbox` from linuxbox, as root. Also the Vultr track's
  second box later.

## If time runs short, cut in this order

Mana app, Figma Sites and Weave extras, Vultr second box, household reorder, /find with Moss, Elastic, Visa,
Fetch.ai, Atlassian, Apify, Coinbase and Solana wallet, credit desk. Never cut: the four moments, SpacetimeDB
inside them, Droid with Claude, Figma for the portal and box screen, the Figma Slides deck.

## Figma stage log

Figma judges a stage log: for ideation, prototyping, handoff and code generation, the Figma tool used, about
how many minutes it took, a 1 to 5 rating, and how its output reached the project. Add a line to
`docs/stagelog.md` whenever your work touches a Figma stage.
