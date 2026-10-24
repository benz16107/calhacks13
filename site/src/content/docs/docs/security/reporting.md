---
title: Report a vulnerability
description: How to report a security problem in GurtOS privately, what to include in your report, what happens next, and which parts of GurtOS are in scope.
---

If you find a way for an agent, a web page, an app or a person to get past one of GurtOS's protections, please report it privately. Do not open a public issue, post it in a chat, or publish details until a fix is available.

## How to report

Report it through GitHub's private vulnerability reporting: open the
[repository's Security tab](https://github.com/benz16107/calhacks13/security) and choose **Report a vulnerability**.
Only the maintainers can read the report.

- Mark it as a security report, and do not share the details anywhere public.
- If that button is not there, open a public issue that says only that you have a security report and asks for a
  private contact. Put no details in the issue.

## What to include

- **Version.** The build in `/etc/box-os/release` on the OS image, or the source commit.
- **Edition and setup.** Server from the ISO, Server on Ubuntu, or Personal. Any environment variables you changed, such as `BOX_LISTEN`.
- **Steps to reproduce.** The smallest task spec, prompt, page or request that shows the problem.
- **Impact.** What an attacker gains: a secret read, a file changed outside a task's copy, a host reached that was not allowed, an approval skipped, money spent past a budget, or code run as root.
- **Evidence.** The relevant lines from the action log, with every secret value removed.

Please test only on a box you own, with test keys. Do not use real payment keys or other people's data.

## What happens next

1. The maintainers acknowledge your report.
2. They confirm the problem and agree a timeline for a fix with you.
3. The fix ships in a system update, and the [changelog](/docs/project/changelog/) records it.
4. If you want credit, you are named in the changelog entry.

GurtOS has no bug bounty.

## Scope

In scope:

- The core: the box service, the broker, the task proxy and firewall rule, the vault handling, approvals, the action log, undo and resume.
- The OS image: the installer, first-boot setup, system updates and rollback, the kiosk screen.
- The apps that ship with GurtOS (see [Apps](/docs/reference/apps/)) and the portal.

Out of scope:

- Limits already listed in the [threat model](/docs/security/threat-model/#what-gurtos-does-not-defend-against), unless you find a way to make them worse than described.
- Problems in outside services GurtOS talks to, such as the model provider or a payment network. Report those to their owners.
- Attacks that need root on the box or physical access to its disk.

## Related

- [Security model](/docs/security/model/)
- [Threat model](/docs/security/threat-model/)
