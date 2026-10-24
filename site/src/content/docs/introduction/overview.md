---
title: What is GurtOS?
description: GurtOS is an operating system where AI agents do real work as separate users, in copies of your files, with no keys, limited network access and an undo.
---

GurtOS is an operating system for a computer whose main users are AI agents. You give it tasks in plain words.
An agent does each task, and GurtOS decides what that agent can touch, what it can reach, and what it must ask
you about first. Everything that happens goes into one log, and you can undo any single task.

## GurtOS and "the box"

GurtOS is the product. Inside it, the service that runs tasks is called `box`, the way the core of macOS is called
Darwin. You will see the internal name in commands and paths: the `box.service` unit, the `/var/lib/box` folder,
`BOX_*` settings and task users named `box-<id>`. In these docs, **the box** means a machine running GurtOS.

The name comes from the German word *Gurt*, a belt or strap. A *Sicherheitsgurt* is a seatbelt. That is the idea:
agents get real access, with a seatbelt on.

## The problem

Agents are useful when they can act: edit files, read the web, call APIs, buy what a job needs.
To let them act today, you usually hand them your machine and your keys.

- **They run as you.** An agent in your terminal can read everything you can read, including your SSH keys,
  browser data and every `.env` file in your home folder.
- **They read untrusted text.** A web page, an email or a document can hold instructions written for the agent.
  If the agent follows them, it can send your secrets somewhere else.
- **Their changes mix with yours.** When two agents and you all edit the same folder, there is no clean way to
  take back one agent's work without losing the rest.
- **They spend without asking.** An API key in an agent's environment has no budget. A loop or a wrong guess
  can spend real money before anyone notices.
- **Nobody keeps the record.** When something goes wrong overnight, you rebuild what happened from scattered
  terminal output, if it still exists.

Running agents in a container or a virtual machine helps with the first point. It does not give you an undo per
task, a budget, an approval on your phone, or a single record of what every agent did.

## What GurtOS does about it

GurtOS treats every piece of agent work as a **task**. A task has a prompt, a workspace (a folder of files), the
tools it may use, the hosts it may reach, and a budget. GurtOS runs each task like this:

1. **As its own Linux user.** Each task gets a user named `box-<id>` with no password, no shell and no `sudo`.
   It runs in a hardened systemd unit with a 2 GB memory cap. It cannot see other processes.
   See [Agents as their own users](/concepts/agent-users/).
2. **In its own copy of the files.** The task works on an overlayfs copy of its workspace. Its changes stay in
   its own layer. When it finishes, that layer joins the workspace. Undo takes the layer out again.
   See [Workspaces and layers](/concepts/workspaces-and-layers/).
3. **Without secrets.** Keys live in a vault only root can read. A task asks its broker to run a tool by name;
   the tool runs inside the GurtOS core with the key and returns only the result.
   See [The vault and the broker](/concepts/vault-and-broker/).
4. **On a short leash.** A firewall rule lets a task's traffic reach only the box's proxy, which allows only
   the hosts in the task's spec. Every refusal is logged.
   See [Network policy](/concepts/network-policy/).
5. **Within a budget.** Tools declare what they cost. A call that would go over the task's budget pauses the
   task until you approve it, from the portal or your phone, while other tasks keep running.
   See [Approvals and budgets](/concepts/approvals-and-budgets/).
6. **On the record.** Every state change, step, tool call, result, approval, cost and blocked connection is one
   line in an append-only log, written to disk before GurtOS moves on.
   See [The action log](/concepts/action-log/).

Because the log is written first, a box that loses power rebuilds every task from it at the next boot and
resumes what was running. Tools receive a stable key per call, so a payment cut off half way is not made twice.

The agent inside each task is Droid, Factory's coding agent, running a Claude model. GurtOS does not depend on
how the agent behaves: the limits above hold whether the agent follows its instructions or not.

## What you see

![A task window: a red alert saying the task tried to reach a host it was not allowed and was blocked, its steps from the action log with the blocked step in red, the files it changed, what it was allowed, and an Undo task button.](../../../assets/screens/task.png)

*A task's window, from a test box running scripted tasks.*

The **portal** is one web app that shows on the box's own screen, in a browser and on a phone. It lists tasks
and what each is doing now, shows each task's steps and file changes, and holds the approvals waiting for you.
Time Machine shows a workspace's layers so you can undo one task. Apps add their own windows, such as a
shopping list or a wallet.

The box also has an [HTTP API](/reference/http-api/) and a live feed through SpacetimeDB, so other software
can do the same things the portal does.

## Who it is for

- People who leave agents running unattended on an always-on machine at home or in the cloud.
- Developers who want agents to work on real repositories without giving them their credentials.
- Anyone who wants a record of what an agent did and a way to take back exactly that.

## What GurtOS is not

- **Not a sandbox for hostile code you run yourself.** GurtOS limits agents' tasks. Apps you install on the box run
  inside the core, as root. Install only apps you trust. See the [threat model](/security/threat-model/).
- **Not a finished product.** GurtOS is an early preview. Some features on these pages are marked **Planned**.
- **Not tied to one machine.** GurtOS Server runs on a small PC, a virtual machine or a cloud instance.

## Related

- [Editions](/introduction/editions/)
- [Architecture](/concepts/architecture/)
- [Install GurtOS Server](/get-started/install-server/)
- [Security model](/security/model/)
