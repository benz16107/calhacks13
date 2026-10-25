# Security policy

GurtOS is a preview and has not had an outside audit. We still want to hear about problems, and we will treat a
report seriously.

## Report a vulnerability

Use GitHub's private vulnerability reporting:
**<https://github.com/benz16107/calhacks13/security/advisories/new>**

Please do not open a public issue or pull request for a security problem. A private report reaches the
maintainers only, and lets us fix it before it is public.

Include:
- what you ran and what you saw, and what you expected;
- the version (`/etc/os-release` on the box, or the release tag) and the edition (Server or Personal);
- whether it needs a paired phone, a task, or only network access to the box;
- anything that shows it works, such as a log excerpt or a short script.

We acknowledge a report within a few days and tell you what we plan to do. This is a small project, so we cannot
promise a fix time, and we cannot pay bounties. We will credit you in the fix if you want that.

If reporting through GitHub is not possible for you, open a public issue that says only that you need a private
way to report a security problem, and no details. We will arrange one.

## Supported versions

| Version | Supported |
|---|---|
| `main` | Fixes land here first |
| v0.1.0-preview | Yes, until the next release. It is a preview: expect fixes to come as a new image |
| anything older | No |

GurtOS updates as a whole system image (`box-update`). A fix reaches a running box when it applies the next
signed image.

## What we have published about security

- **The threat model:** what GurtOS protects, who it defends against and what it does not:
  [gurtos.com/docs/security/threat-model](https://gurtos.com/docs/security/threat-model/), and how it is built:
  [gurtos.com/docs/security/model](https://gurtos.com/docs/security/model/).
- **The attack scoreboard:** sixteen OS-level attacks run against a real box on every merge, with the results as
  they came out, including the two that are **not covered** (a disk fill, and data sent out through a host the task
  was allowed to reach): [`tracks/armadin/SCOREBOARD.md`](tracks/armadin/SCOREBOARD.md). The mapping to the OWASP
  lists is in [`tracks/armadin/OWASP.md`](tracks/armadin/OWASP.md).
- **The known limits** in the [roadmap](ROADMAP.md): one kernel shared by all tasks, no disk quotas, no disk
  encryption, release keys kept in files, no outside audit.

## Scope

In scope: the box service and its API, the network proxy and firewall, the sandbox around a task, the vault, the
update and rollback path and its signature checks, pairing and the phone and desktop apps, the relay in `relay/`,
and the images and release files.

Out of scope: attacks that need root on the box already, a stolen paired phone that the owner has not revoked, the
behaviour of a language model (a model that can be talked into asking for something is expected, and the box's
approvals and limits are what contain it), and findings in software we only package (report those upstream).
