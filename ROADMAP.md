# Roadmap

GurtOS is a preview (v0.1.0-preview). It works end to end, and it has not had an outside audit. This page says what
is true today, what has to happen before we would call it 1.0, and what comes after. Dates are not promised.

Plans change. The ones marked **today** describe what is in the repository now.

## What exists today

- Each agent task runs as its own Linux user, in its own overlay copy of the files, as a hardened systemd unit (no
  capabilities, a seccomp filter, 2 GB of memory, 512 processes, a private `/tmp`), with a network that reaches only
  the proxy and the hosts the task lists. Keys stay in a root-only vault and the box adds them to model calls.
- One append-only action log, undo for one task at a time, approvals on the screen and the phone, and tasks that
  resume after a power cut.
- Two images (Server and Personal) for x86_64 and arm64, updated as a whole system with automatic rollback.
- Sixteen OS-level attacks run against a real box on every merge, with their results published, including the
  two that are not covered (a disk fill and data sent out through an allowed host):
  [`tracks/armadin/SCOREBOARD.md`](tracks/armadin/SCOREBOARD.md).
- A first threat model on the docs site: [gurtos.com/docs/security/threat-model](https://gurtos.com/docs/security/threat-model/).

## Before 1.0

Nothing here is done. We would not call GurtOS 1.0 until these are.

**Isolation**
- Stronger isolation for each agent, a microVM or gVisor instead of one kernel shared by every task. Today a kernel
  bug can reach every task.
- Disk quotas for each task. Today a task can fill the disk (the scoreboard lists it as not covered).
- Full-disk encryption at install. Today the installer writes an unencrypted disk and the vault is a file readable
  by root.

**Review**
- An outside security audit.
- Fuzzing of the box's API, its network proxy and the update path.
- A published threat model that an outside reviewer has read. The page above is our own.

**Releases**
- Release keys held in hardware, with rotation and several signers. Today there is one signing key and one update
  key, each a file on a machine, backed up on a second machine.
- Reproducible builds, so anyone can build an ISO and get the same bytes.
- A software bill of materials (SBOM) with every release. v0.1.0-preview ships one made by hand at release time;
  this item is making it automatic and signed.

**Self-hosting**
- A relay, push gateway and web app you can run yourself with one command. The code is in [`relay/`](relay/) and
  [`docs/self-host.md`](docs/self-host.md) says how, but the iPhone, Mac and Android apps still point at our
  address and our push credentials, and the web app's allow-list names our domain.

**Workers and models**
- A pluggable worker and model. Today a task runs Factory's Droid with Claude, through a Factory key or your own
  Anthropic key. Wanted: local open models, Claude Code and other agents. Note that the Droid CLI is Factory's
  software under Factory's terms; GurtOS does not ship it and downloads it on first start. A worker we can
  redistribute would remove that dependency.

**Legal**
- A licence and trademark audit: every dependency's licence checked against Apache-2.0
  ([`release/licenses.md`](release/licenses.md) is a first pass), and the GurtOS name and the Ubuntu base's
  trademark rules reviewed.

## After 1.0

**Apps**
- A stable, versioned app API and an SDK, so an app written for one version keeps working on the next.
- A signed app catalog where each app declares what it needs (hosts, keys, folders) in a permission manifest the
  box enforces. Today apps are folders in this repository and the App Center only turns them on and off.
- Demo data out of the default install. Today the images carry sample data for the demo apps.

**Hardware**
- Real hardware and Secure Boot. Today the boot loader is unsigned, so Secure Boot must be off, and we have
  tested virtual machines, not a spread of laptops.

**Updates**
- An update server with staged and delta updates, and a long-term-support policy. Today an update is a full
  system image fetched from a URL you choose.

**People**
- Accessibility and translations. The setup has larger text, high contrast and reduced motion, and a phone route
  for screen readers; it has not had an accessibility review, and it is English only.
- Business: SAML and SCIM sign-in and provisioning, fleet management, and SIEM export of the action log. Today
  Business is a setting with roles, routed approvals, an audit trail and a kill switch, and it uses sandbox data.
