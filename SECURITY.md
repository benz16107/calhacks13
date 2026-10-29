# Security policy

GurtOS is a preview maintained by one person, and it has not had an outside audit. We still want to hear about
problems, and we treat every report seriously.

## Report a vulnerability

Use GitHub's private vulnerability reporting:
**<https://github.com/benz16107/gurtos/security/advisories/new>**

Please do not open a public issue or pull request for a security problem. A private report reaches the maintainer
only, and lets us fix it before it is public.

Include:
- what you ran, what you saw, and what you expected;
- the version and build (Server: Settings, About; Personal: GurtOS Settings, About GurtOS; from source: the commit)
  and the edition;
- what the attacker needs: a task on the box, a paired phone, a page an agent reads, or only network access;
- anything that shows it works, such as a log excerpt or a short script.

If reporting through GitHub is not possible for you, open a public issue that says only that you need a private way
to report a security problem, with no details. We will arrange one.

## What to expect

- We aim to acknowledge a report within 7 days and to tell you what we plan to do. One person reads these, so it
  can take longer; a second message after 7 days is welcome.
- We cannot promise a fix date, and we cannot pay bounties.
- A fix lands on `main` first and ships in the next release. We publish an advisory on GitHub once the fix is
  released, and credit you in it and in the release notes unless you ask us not to.
- Please give us 90 days, or until the fix is released if that is sooner, before you publish details.

## Supported versions

| Version | Supported |
|---|---|
| `main` | Yes. Fixes land here first |
| v0.2.0-preview | Yes |
| v0.1.0-preview | No. Several security bugs found since are fixed in v0.2.0-preview and on `main`. Use it with test keys only, and move to v0.2.0-preview |
| Anything older | No |

GurtOS updates as a whole system image. On GurtOS Personal, `sudo box-update apply <url>` installs a newer signed
image. A release build of GurtOS Server has no shell, so it cannot install an update in place yet: moving it to a
new release means reinstalling, which erases its disk. Adding an in-product updater is on the [roadmap](ROADMAP.md).

## Scope

In scope:
- the box service and its API (`core/`), the network proxy and firewall, the sandbox around each task, the vault
  and the action log;
- first-run setup, pairing, and setup from another computer (port 7701);
- the update and rollback path and its signature checks (`image/`), and the release files and their signatures;
- the portal (`portal/`), the GurtOS Personal desktop layer (`personal/`) and the phone, Watch, Mac and Android apps
  (`native/`);
- the relay in `relay/` and the live demo in `try/`, as code you can run. Their hosted copies are offline;
- the web app at app.gurtos.com.

Out of scope:
- attacks that already need root on the box, or the owner's own account on GurtOS Personal;
- a stolen paired phone that the owner has not revoked;
- a language model that can be talked into asking for something. That is expected; the box's approvals, budgets
  and network limits are what contain it. A way to get past them is in scope;
- data a task sends to a host it was allowed to reach. GurtOS does not inspect it today, and says so (below);
- findings in software we only package, such as Ubuntu's packages, Node.js or SpacetimeDB: please report those
  upstream;
- the demo and test apps' own sandbox services (test payments, devnet money), unless the finding reaches the box.

## What we have published

- **The threat model:** what GurtOS protects, who it defends against and what it does not:
  [gurtos.com/docs/security/threat-model](https://gurtos.com/docs/security/threat-model/). How it is built:
  [gurtos.com/docs/security/model](https://gurtos.com/docs/security/model/).
- **The attack scoreboard:** 41 OS-level attacks run against a real box in the merge gate, with their results.
  36 are caught and 5 are not covered: data sent out through a host the task was allowed to reach; what tasks share
  through the machine's network space (an abstract Unix socket between two tasks, root services on abstract sockets,
  and `/proc/net`); and a command that skips Droid's second look by calling the broker itself:
  [`tracks/armadin/SCOREBOARD.md`](tracks/armadin/SCOREBOARD.md). The mapping to the OWASP lists is in
  [`tracks/armadin/OWASP.md`](tracks/armadin/OWASP.md).
- **The known limits** in the [roadmap](ROADMAP.md): one kernel shared by every task, a disk limit that is a check
  every 2 seconds rather than a quota, no disk encryption, release keys kept in files, no outside audit.
