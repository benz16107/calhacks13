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

## Decided

- TypeScript on Node 22 or newer. It must run on ARM64 (laptop VM) and x86 (linuxbox and Vultr VMs).
- Factory's Droid SDK is the worker inside every task, with Claude as the model.
- SpacetimeDB, self-hosted on the box (TypeScript module), holds live task status and approvals. The action
  log stays on disk so undo and resume don't depend on it.
- The box's screen and the portal are one web app. Its design comes from Figma (Ben designs in FigJam and
  Figma Agent, Figma Make writes the first code). Don't hand-design UI before that handoff.
- Every track is one folder that registers itself. The core never imports a track.

## Layout

The core thread owns this section and fills it in once the contract exists. Until then, don't create
top-level folders other than your own.

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

- **Laptop VM** (ARM64, Ubuntu 24.04, Lima on Ben's MacBook): `ssh benmac 'limactl shell box -- <command>'`.
  The laptop sleeps when closed, so don't rely on it overnight. This is also the demo box on Sunday.
- **linuxbox VM** (x86, always on): being set up.
- **Vultr VM** (x86): being set up; also the second box for the Vultr track.

## If time runs short, cut in this order

Mana app, Figma Sites and Weave extras, Vultr second box, household reorder, /find with Moss, Elastic, Visa,
Fetch.ai, Atlassian, Apify, Coinbase and Solana wallet, credit desk. Never cut: the four moments, SpacetimeDB
inside them, Droid with Claude, Figma for the portal and box screen, the Figma Slides deck.

## Figma stage log

Figma judges a stage log: for ideation, prototyping, handoff and code generation, the Figma tool used, about
how many minutes it took, a 1 to 5 rating, and how its output reached the project. Add a line to
`docs/stagelog.md` whenever your work touches a Figma stage.
