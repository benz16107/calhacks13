# Roadmap

GurtOS is a preview. It works end to end, and it has not had an outside audit. This page says what is true today,
what has to happen before we would call it 1.0, and what comes after. Dates are not promised, and plans change.

## What exists today

Everything in this list is on `main` and in the latest release, v0.2.0-preview. v0.1.0-preview had the isolation, the
log, undo, approvals, resume after a power cut and the images. v0.2.0-preview adds the disk limit, app permissions,
Replay and setup from another computer ([release notes](release/notes/v0.2.0-preview.md)).

- Each agent task runs as its own Linux user, in its own overlay copy of the files, as a locked-down systemd unit
  (no capabilities, a system call filter, 2 GB of memory, 512 processes, a private `/tmp`). Its network reaches only
  the box's proxy and the hosts the task lists, never link-local addresses such as cloud metadata. Keys stay in a
  root-only vault, and the box adds them to the calls that need them.
- A task whose copy grows past its disk limit (5 GB unless the owner sets another) is stopped and undone.
- One append-only action log, in which each line carries the hash of the line before it. Undo for one task at a
  time. Approvals on the box's screen, Personal's desktop and a paired phone. Tasks that resume after a power cut.
- Permissions for each app, like a phone's: the owner sees what an app may use (keys, money, hosts, folders, a
  shell) when turning it on, and can turn each one off.
- Replay: a finished task can be played back step by step, with its files at each step.
- Two images (Server and Personal) for x86_64 and arm64, updated as a whole system with automatic rollback.
- Setup from another computer: an agent with a one-time code from the screen can set up a new box over the home
  network, with the `gurtos` command or an MCP server (see [AGENT-SETUP.md](AGENT-SETUP.md)).
- 41 OS-level attacks run against a real box in the merge gate. 36 are caught; 5 are not covered (data sent out
  through a host the task was allowed to reach, three ways tasks share the machine's network space, and a command
  that skips Droid's second look): [`tracks/armadin/SCOREBOARD.md`](tracks/armadin/SCOREBOARD.md).
- A first threat model on the docs site: [gurtos.com/docs/security/threat-model](https://gurtos.com/docs/security/threat-model/).
- A relay for remote access and phone push that anyone can run with one command ([`relay/`](relay/),
  [`docs/self-host.md`](docs/self-host.md)). Our hosted relay at `box.gurtos.com` is offline.

## Before 1.0

Nothing here is done. We would not call GurtOS 1.0 until these are.

**Isolation**
- Stronger isolation for each agent, a microVM or gVisor instead of one kernel shared by every task. Today a kernel
  bug can reach every task.
- A hard disk quota for each task. Today the disk limit is a check every 2 seconds, so a fast writer can pass it
  for a moment before the task is stopped.
- Full-disk encryption at install. Today the installer writes an unencrypted disk and the vault is a file readable
  by root.
- A way to limit what a task sends to a host it may reach. Today GurtOS checks where a task connects, not what it
  sends.
- A network namespace for each task. Today every task shares the machine's, so two tasks can talk through an abstract
  Unix socket and a task can read the others' open sockets in `/proc/net`.
- Droid's second look run by the core. Today it runs inside the task, so a command can skip it by calling the broker
  itself. Budgets and the owner's threshold still apply.

**Review**
- An outside security audit.
- Fuzzing of the box's API, its network proxy and the update path.
- A published threat model that an outside reviewer has read. The page above is our own.

**Updates and releases**
- Updates from the screen. Today `box-update` needs a root shell. GurtOS Personal has one through `sudo`, but a
  release build of GurtOS Server does not, so a Server box can only move to a new release by reinstalling.
- Release keys held in hardware, with rotation and several signers. Today there is one signing key and one update
  key, each a file, backed up in a second place.
- Reproducible builds, so anyone can build an ISO and get the same bytes.
- A software bill of materials (SBOM) made and signed automatically with every release. So far they were made
  by hand at release time.

**Self-hosting**
- A relay, push gateway and web app you can run yourself without editing source. The relay installs with one
  command and a box can be pointed at it (`BOX_RELAY`, or the owner's `PUT /api/remote/relay`), but the web app
  reads its relay address from source, and the iPhone, Mac and Android apps point at our address and our push
  credentials.

**Workers and models**
- A pluggable worker and model. Today a task runs Factory's Droid with Claude, through a Factory key or your own
  Anthropic key. Wanted: local open models, Claude Code and other agents. The Droid CLI is Factory's software under
  Factory's terms; GurtOS does not ship it and downloads it on first start. A worker we can redistribute would
  remove that dependency.

**Legal**
- A licence and trademark review by a lawyer: every dependency's licence checked against Apache-2.0
  ([`release/licenses.md`](release/licenses.md) is our first pass and lists the open items, such as the Find app's
  Moss library and SpacetimeDB's licence), and the GurtOS name and the Ubuntu base's trademark rules.

## After 1.0

**Apps**
- A stable, versioned app API and an SDK, so an app written for one version keeps working on the next.
- A signed app catalog where each app declares what it needs (hosts, keys, folders) in a permission manifest the
  box enforces before install. Today apps are folders in this repository, and their permissions are learned from
  what they declare and what they were seen using.
- Demo data out of the default install. Today the images carry sample data for the demo apps.

**Hardware**
- Real hardware and Secure Boot. Today the boot loader is unsigned, so Secure Boot must be off, and we have
  tested virtual machines, not a spread of laptops. GurtOS Server sets up wired networks only.

**Updates**
- An update server with staged and delta updates, and a long-term-support policy. Today an update is a full
  system image fetched from a URL you choose.

**People**
- Accessibility and translations. The setup has larger text, high contrast and reduced motion, and a phone route
  for screen readers; it has not had an accessibility review, and it is English only.
- Business: SAML and SCIM sign-in and provisioning, fleet management, and SIEM export of the action log. Today
  Business is a setting with roles, routed approvals, an audit trail and a kill switch, and it uses sandbox data.
