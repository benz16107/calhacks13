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
| Your say over risky actions | Approvals, answered from the box's own screen or a paired phone |
| Your settings and your devices | Settings, setup, the list of paired devices, and which apps are on |
| The box itself | Root on the machine, the core service, the system image |

## Who GurtOS defends against

The main adversary is **the agent inside a task**, whether it is wrong, buggy, or following instructions it read somewhere. GurtOS treats everything a task does as untrusted.

| Actor | What they try | What stops it |
|---|---|---|
| A prompt-injected agent | Read keys and send them out | No secrets in the task. The vault is root only. The proxy allows only the task's hosts and logs every refusal. |
| | Approve its own request | The firewall blocks task users from the API, SpacetimeDB and every port but the proxy. A task's own questions have their own ids, so it cannot answer the box's budget question in advance. |
| | Spend money | Tools that spend declare a cost. Above the budget, a person must approve. |
| | Damage your files | It writes only to its own copy. Undo removes its layer. |
| A buggy agent | Make wrong edits | Its changes are one layer. Undo that task alone. |
| | Loop or grow without bound | Per task: 2 GB of memory with no swap, 512 processes, two CPU cores, a 5 GB copy, 20 MB of log and 256 proxy connections |
| | Fire the same payment twice | One approval and one charge per action. Tools get a stable idempotency key. |
| A malicious web page | Plant instructions in the agent | Same limits as a prompt-injected agent. The attempt and any refused connection are in the log. A decoy cloud key in every task's environment trips an alarm: if it leaves in a web request, a step or a tool call, the box stops the task and undoes it. |
| Another task | Read or change this task's files or processes | Separate users, private copies, `ProtectProc=invisible`, private `/tmp` |
| A power cut | Lose work or pay twice | The log is fsynced per line. Tasks resume from their last logged step. A call cut off mid-way runs again with the same key. |
| Someone on the internet | Reach the box's API or SpacetimeDB | On the OS image, the inbound firewall drops them. Port 7700 and the setup port 7701 are open to private networks only, port 3000 to nothing. |
| Someone on your network | Read tasks, start work, approve spending, undo tasks | Every request from off the box needs a paired device's token, else `401`. SpacetimeDB listens on `127.0.0.1` only, and its `answer` works only from a connection the box vouched for. |
| | Forge who approved | A paired device's answer is logged under the device's name, whatever the request says |
| | Change settings or keys, or pair a new device | These are the owner's: the box's own screen or a device paired as the owner. Others get `403`. No route returns a vault value. |
| A paired phone that is not the owner's | Read the vault, change settings, hand a task your folders, Keep | All owner-only (`403`) |
| A stolen phone | Approve requests | Remove the device. Its next request is refused. See the limits below. |
| A task, or a person, aiming an agent at system files | Give a task `/etc`, the box's own state or a root-owned folder | Folders are owner-only, must be in the owner's home or, once the owner has chosen folders, inside one of them, and the system and the box's state are always refused, links included |
| A tampered update | Install altered system code | The image must be signed by the build key and match its hash |
| A broken update | Leave the box unusable | The new system is tried once and kept only if it reports healthy |
| Someone at the keyboard | Log in to the box | The OS image has no login prompt, no human account and no SSH in release builds |

## What GurtOS does not defend against

These are known limits of the current release. Some are planned work; see the [roadmap](/docs/project/roadmap/).

### Trust in the core and its apps

- **Root on the box.** The core runs as root and holds every key. Anyone who gets root, through a kernel bug, a bug in the core, or physical access, gets everything.
- **Installed apps.** An app runs inside the core, as root. The `secrets` list limits what `box.secret()` returns, but app code can read the vault file directly. Install only apps you trust as much as the core. An app's page runs sandboxed in the browser, with a token for that app's routes only. A bug in it can't use the owner's controls, and it answers only its own app's requests.
- **Tools extend a task's reach.** A tool runs in the core, outside the task's network limits. A task that may call `apify.run` (from the optional Apify app) can have Apify fetch any URL. Give a task only the tools it needs.

### Access to the box's services

- **The box's own machine is trusted.** A request over the Unix socket, or from `127.0.0.1` with no proxy header, a Host of `127.0.0.1` or `localhost`, and no Origin but the box's own address, counts as the box's own screen and may do everything, owner's actions included. Task users cannot make such a request, because their network reaches only the proxy. Other software you run on the box can. On GurtOS Personal that includes programs you run in your own desktop session.
- **A local proxy that drops forwarding headers looks local.** The box tells relayed requests apart by headers such as `X-Forwarded-For`. A proxy or tunnel on the box that forwards outside requests without them would hand every caller the box's own rights.
- **Device tokens are bearer secrets.** Whoever holds one can use it, and it does not expire. A stolen phone or a copied token works until you remove the device.
- **Plain HTTP on your own network.** On the home network the API serves plain HTTP, so on a network others can watch, a token or a task's contents can be read on the way. Use a VPN such as Tailscale, or turn on remote access through your own relay: then traffic is HTTPS end to end to the box.
- **A paired device is trusted with tasks.** Any paired device, not only the owner's, can start tasks, undo any task and answer any approval.
- **SpacetimeDB has no login.** It listens on `127.0.0.1`, and its `answer` reducer accepts only vouched connections. If you widen it with `STDB_LISTEN`, anyone who can reach port 3000 can still read every task.
- **A private network is trusted to reach the API.** On GurtOS Server and GurtOS Personal from the ISO, anyone on your home network or tailnet can reach port 7700, and port 7701 while setup from another computer is open. They still need a paired device's token (on port 7701, the setup token) for anything but the health check and redeeming a pairing code, and a pairing code comes only from the box's own screen.
- **A relay operator could route a name to itself.** A relay answers for every name under its domain, so a
  malicious operator could send a box's name to the relay and pass Let's Encrypt's challenge to get a certificate for
  it. Every certificate is published in public Certificate Transparency logs, where a second one for your name would
  show. They would still need a pairing code, which comes only from the box's own screen. A hosted relay is not
  running during the preview, so remote access uses a relay you run, and you are its operator.
- **A stolen relay secret takes over a name's routing.** Turn remote access off and on again to issue a new one.
- **The GurtOS app is only as trustworthy as its host.** `app.gurtos.com` is served by Vercel from the public
  repository, so whoever controls that deployment controls the app's code. A box's own address serves the box's own
  copy. The app reaches a box only at an https address that a relay gives it.
- **Pushes and a shared subscription.** One box sharing a phone's push subscription cannot pose as another: the app
  drops a push whose signature does not match that box's key. The relay can drop or delay pushes and connections,
  but cannot read them.
- **Webhooks and app routes** accept any paired device's token. An app can also mark routes as open (`openRoutes`), with no token at all, for a route that is public on purpose or checks its own secret. Mana (7 routes), Jira (8), Apify (`POST /watch`), Receipts (4) and Wallet's sell routes are open. An open route is only as safe as its own check. The owner can refuse these requests per app in the app's permissions.

### Data that leaves on purpose

- **The model provider sees what the agent sees.** Prompts, files the agent reads and tool results go to the model, through Factory or straight to Anthropic with your own key. Do not give a task files you would not send to that provider.
- **Allowed hosts are trusted with whatever the task sends.** If a task may reach a site, it can send that site anything in its copy. Allowing a broad host, such as a code host or a paste site, allows sending data there.
- **Undo cannot recall what already left.** It removes file changes on the box. A payment made, a message sent or a request to an allowed host is not undone.
- **Photos leave the box only if you choose.** A fresh box sends no photo anywhere. A photo goes to a hosted vision model only if you add that model's key to the vault, and to Claude, through your Factory or Anthropic key, only when you press **Describe with Claude**. With Ollama on your own network, nothing leaves it.
- **Search reaches every workspace.** A task given `find.search` can search all workspaces, not only its own, and a photo's description can carry text from the photo into the agent's context.

### Limits of the controls

- **Model spending does not pause a task.** Model cost is counted in `costCents` after each run, and it counts toward the budget check for the next tool call. A task's own model use never stops it for an OK.
- **An agent writes its own questions.** A question a task asks with `box_ask` is the agent's text. Read it as a claim, not a fact. Budget approvals are written by the core from the tool's declared cost. Answering approvals through the MCP server is off unless `BOX_MCP_ANSWER=on`.
- **No time limit per task.** A task can use up to two CPU cores and run until it ends or is undone.
- **Shared kernel.** Tasks are separated by Linux users, systemd and overlayfs, not by virtual machines. A kernel exploit inside a task escapes all of them.
- **Shared network space and `/dev/shm`.** Every task shares the machine's network namespace, so two tasks can talk through an abstract Unix socket and pool what their separate host lists reach, and a task sees the sockets other tasks have open in `/proc/net`. `/dev/shm` is the machine's own, so a file left there outlives the task and its undo. The [attack scoreboard](https://github.com/benz16107/calhacks13/blob/main/tracks/armadin/SCOREBOARD.md) lists these as not covered.
- **Side channels** between tasks on the same machine, such as timing or cache effects, are not addressed.
- **The log is not signed.** Each line carries the hash of the line before it (`prev`), so an edit in the middle shows. Nothing signs the log, so root can rewrite the whole chain.
- **Denial of service.** A task's copy is capped at 5 GB by a check every 2 seconds, so a fast writer can pass it for a moment. The check measures only the copy, not the task's home folder, `/tmp` or `/dev/shm`, so a task can still fill the disk there. Request bodies are capped at 10 MB, or 1 MB without a token. A task writes at most 20 MB to the log (64 KB per step) and holds at most 256 proxy connections. Nothing limits how many tasks or approvals a caller of the API can create.

### The machine and its updates

- **Physical access.** Disks are not encrypted. Anyone with the disk can read the vault and every workspace.
- **No verified boot.** The boot loader is not signed (Secure Boot must be off) and the system slots are not verified at boot (no dm-verity). Someone who can write to the disk can change the system.
- **One update key.** Updates are signed with one ed25519 key on one build machine. There is no key rotation. An older signed image installs only with `--allow-older`, a check by build date, not a counter the firmware keeps. Losing that key means anyone can sign updates.
- **Hangs.** A new system that hangs, instead of crashing or failing its health check, stays hung until someone restarts it. A hardware watchdog would cover this; not every machine has one.

## Reporting a problem

If you find a way past one of the protections on this page, or a gap that is not listed, see [Report a vulnerability](/docs/security/reporting/).

## Related

- [Run your own relay, push gateway and web app](/docs/guides/self-host/)
- [Security model](/docs/security/model/)
- [Trust boundaries](/docs/security/trust-boundaries/)
