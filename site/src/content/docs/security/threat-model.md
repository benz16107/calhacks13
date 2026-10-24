---
title: Threat model
description: What GurtOS protects, who it protects it from, what stops each attack, and a plain list of the attacks GurtOS does not defend against today.
---

This page states what GurtOS tries to protect, from whom, and where its protection ends. It describes the current release. GurtOS has not had an independent security audit and makes no compliance claims.

## What GurtOS protects

| Asset | Where it lives |
|---|---|
| Your keys and tokens | The vault, `/etc/box/vault.env` |
| Your files | Workspaces under `BOX_HOME/workspaces` |
| Your money | Payment keys in the vault, task budgets and approvals |
| The record of what happened | The action log, `BOX_HOME/log.jsonl` |
| Your say over risky actions | Approvals, answered from the portal or a paired phone |
| The box itself | Root on the machine, the core service, the system image |

## Who GurtOS defends against

The main adversary is **the agent inside a task**, whether it is wrong, buggy, or following instructions it read somewhere. GurtOS treats everything a task does as untrusted.

| Actor | What they try | What stops it |
|---|---|---|
| A prompt-injected agent | Read keys and send them out | No secrets in the task. The vault is root only. The proxy allows only the task's hosts and logs every refusal. |
| | Approve its own request | The firewall blocks task users from the API, SpacetimeDB and every port but the proxy |
| | Spend money | Tools that spend declare a cost. Above the budget, a person must approve. |
| | Damage your files | It writes only to its own copy. Undo removes its layer. |
| A buggy agent | Make wrong edits | Its changes are one layer. Undo that task alone. |
| | Loop or grow without bound | Memory is capped at 2 GB and processes at 512 per task |
| | Fire the same payment twice | One approval and one charge per action. Tools get a stable idempotency key. |
| A malicious web page | Plant instructions in the agent | Same limits as a prompt-injected agent. The attempt and any refused connection are in the log. |
| Another task | Read or change this task's files or processes | Separate users, private copies, `ProtectProc=invisible`, private `/tmp` |
| A power cut | Lose work or pay twice | The log is fsynced per line. Tasks resume from their last logged step. A call cut off mid-way runs again with the same key. |
| A stolen phone | Approve requests | Revoke its device token. Its next answer through the API is refused. See the limits below. |
| A tampered update | Install altered system code | The image must be signed by the build key and match its hash |
| A broken update | Leave the box unusable | The new system is tried once and kept only if it reports healthy |
| Someone at the keyboard | Log in to the box | The OS image has no login prompt, no human account and no SSH in release builds |

## What GurtOS does not defend against

These are known limits of the current release. Some are planned work; see the [roadmap](/project/roadmap/).

### Trust in the core and its apps

- **Root on the box.** The core runs as root and holds every key. Anyone who gets root, through a kernel bug, a bug in the core, or physical access, gets everything.
- **Installed apps.** An app runs inside the core, as root. The `secrets` list limits what `box.secret()` returns, but app code can read the vault file directly. Install only apps you trust as much as the core.
- **Tools extend a task's reach.** A tool runs in the core, outside the task's network limits. A task that may call `apify.run` can have Apify fetch any URL. Give a task only the tools it needs.

### Access to the box's services

- **The HTTP API has no authentication.** Anyone who can reach port 7700 can start tasks, answer approvals and undo work. It listens on `127.0.0.1` by default. If you set `BOX_LISTEN`, the network you expose it on is your access control.
- **SpacetimeDB listens on every interface.** Its `task` and `approval` tables are public, and anyone who can reach port 3000 can call the `answer` reducer. Keep the box on a network you trust, or block port 3000 at your firewall.
- **Device tokens are optional.** A paired phone's token is checked when it is sent, so revoking a phone stops that token. A request with no token is still accepted. Revoking a phone does not lock out someone who can reach the API or SpacetimeDB another way.
- **Webhooks and app routes** have no authentication of their own. An app that needs one must check a secret itself, as the Jira app does.

### Data that leaves on purpose

- **The model provider sees what the agent sees.** Prompts, files the agent reads and tool results go to the model through Factory. Do not give a task files you would not send to that provider.
- **Allowed hosts are trusted with whatever the task sends.** If a task may reach a site, it can send that site anything in its copy. Allowing a broad host, such as a code host or a paste site, allows sending data there.
- **Undo cannot recall what already left.** It removes file changes on the box. A payment made, a message sent or a request to an allowed host is not undone.
- **Search reaches every workspace.** A task given `find.search` can search all workspaces, not only its own, and a photo's description can carry text from the photo into the agent's context.

### Limits of the controls

- **Model spending does not pause a task.** Model cost is counted in `costCents` after each run, and it counts toward the budget check for the next tool call. A task's own model use never stops it for an OK.
- **An agent writes its own questions.** A question a task asks with `box_ask` is the agent's text. Read it as a claim, not a fact. Budget approvals are written by the core from the tool's declared cost.
- **No CPU or time limit per task.** A task can use all the CPU it gets and run until it ends or is undone.
- **Shared kernel.** Tasks are separated by Linux users, systemd and overlayfs, not by virtual machines. A kernel exploit inside a task escapes all of them.
- **Side channels** between tasks on the same machine, such as timing or cache effects, are not addressed.
- **The log is not tamper-evident.** It is append-only by design, but root can edit it, and nothing signs or chains its lines.
- **Denial of service.** Nothing limits how many tasks or approvals a caller of the API can create, or how much a task can write into its own copy.

### The machine and its updates

- **Physical access.** Disks are not encrypted. Anyone with the disk can read the vault and every workspace.
- **No verified boot.** The boot loader is not signed (Secure Boot must be off) and the system slots are not verified at boot (no dm-verity). Someone who can write to the disk can change the system.
- **One update key.** Updates are signed with one ed25519 key on one build machine. There is no key rotation, and no rollback protection: an older signed image still installs. Losing that key means anyone can sign updates.
- **Hangs.** A new system that hangs, instead of crashing or failing its health check, stays hung until someone restarts it. A hardware watchdog would cover this; not every machine has one.

## Reporting a problem

If you find a way past one of the protections on this page, or a gap that is not listed, see [Report a vulnerability](/security/reporting/).

## Related

- [Security model](/security/model/)
- [Trust boundaries](/security/trust-boundaries/)
