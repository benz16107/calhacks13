---
title: Report a vulnerability
description: How to report a security problem in GurtOS privately, what to include in your report, what happens next, and which parts of GurtOS are in scope.
---

GurtOS is a preview maintained by one person, and it has not had an outside audit. If you find a way for an agent, a web page, an app or a person to get past one of its protections, please report it privately. Do not open a public issue or pull request for it, post it in a chat, or publish details until a fix is available.

## How to report

Use GitHub's private vulnerability reporting:
[github.com/benz16107/calhacks13/security/advisories/new](https://github.com/benz16107/calhacks13/security/advisories/new).
A private report reaches the maintainer only, and lets us fix the problem before it is public.

If reporting through GitHub is not possible for you, open a public issue that says only that you need a private way
to report a security problem, with no details. We will arrange one.

## What to include

- **What you ran, what you saw, and what you expected.**
- **Version and edition.** The build in Settings, About on GurtOS Server, or GurtOS Settings, About GurtOS on
  GurtOS Personal, or the source commit. Any environment variables you changed, such as `BOX_LISTEN`.
- **What the attacker needs:** a task on the box, a paired phone, a page an agent reads, or only network access.
- **Evidence** that it works, such as the relevant lines from the action log with every secret value removed, or a
  short script.

Please test only on a box you own, with test keys. Do not use real payment keys or other people's data.

## What happens next

- We aim to acknowledge a report within 7 days and to tell you what we plan to do. One person reads these, so it can
  take longer; a second message after 7 days is welcome.
- We cannot promise a fix date, and GurtOS has no bug bounty.
- A fix lands on `main` first and ships in the next release. We publish an advisory on GitHub once the fix is
  released, and credit you in it and in the release notes unless you ask us not to.
- Please give us 90 days, or until the fix is released if that is sooner, before you publish details.

## Supported versions

`main` and the next release, once it is published, get security fixes. v0.1.0-preview does not: several security
bugs found since are fixed on `main` only. Use it with test keys, and move to the next release when it is out.

On GurtOS Personal, `sudo box-update apply <url>` installs a newer signed image. A release build of GurtOS Server has
no shell, so it cannot install an update in place yet: moving it to a new release means reinstalling, which erases
its disk.

## Scope

In scope:

- The box service and its API (`core/`), the network proxy and firewall, the sandbox around each task, the vault and
  the action log.
- First-run setup, pairing, and setup from another computer (port 7701).
- The update and rollback path and its signature checks, and the release files and their signatures.
- The portal, the GurtOS Personal desktop layer, and the phone, Watch, Mac and Android apps.
- The relay in `relay/` and the live demo in `try/`, as code you can run. Their hosted copies are offline.
- The web app at app.gurtos.com.

Out of scope:

- Attacks that already need root on the box, or the owner's own account on GurtOS Personal.
- A stolen paired phone that the owner has not revoked.
- A language model that can be talked into asking for something. That is expected; the box's approvals, budgets and
  network limits are what contain it. A way to get past them is in scope.
- Data a task sends to a host it was allowed to reach. GurtOS does not inspect it today.
- Findings in software GurtOS only packages, such as Ubuntu's packages, Node.js or SpacetimeDB: please report those
  upstream.
- The optional and test apps' own sandbox services (test payments, devnet money), unless the finding reaches the box.

The [threat model](/docs/security/threat-model/#what-gurtos-does-not-defend-against) lists the limits we know about.
The attack scoreboard, 41 attacks run against a real box on every merge with each one published as caught or not
covered, is in
[`tracks/armadin/SCOREBOARD.md`](https://github.com/benz16107/calhacks13/blob/main/tracks/armadin/SCOREBOARD.md).

## Related

- [Security model](/docs/security/model/)
- [Threat model](/docs/security/threat-model/)
