---
title: Agents as their own users
description: Each GurtOS task runs as its own Linux user with no password, shell or sudo, inside a hardened systemd unit. Here is what that user can and cannot do.
---

GurtOS does not give an agent your account. Each task gets a Linux user of its own, made for that task and removed when it ends. The kernel then enforces most of what the task may and may not touch.

## The task user

When a task starts, the core creates a system user named `box-<id>`:

- Its uid is between 30000 and 39999. One firewall rule covers that whole range, so every task user is network-limited the moment it exists.
- It has no password and its shell is `/usr/sbin/nologin`. Nobody can log in as it.
- It is not in any admin group, and the box has no `sudo` binary on an ISO install.
- Its home folder is inside the task's own folder, `BOX_HOME/tasks/<id>/home`, readable only by it.

When the task ends, the core stops every process that user runs and deletes the user. A resumed task keeps the same user name, and a whole-system update copies task users into the new system, so a task that resumes after an update keeps its uid.

## The hardened unit

The worker does not run as a child of a login session. The core starts it with `systemd-run` as a transient unit, `box-task-<id>`, with these limits:

| Setting | Effect |
|---|---|
| `NoNewPrivileges=yes` | Nothing it runs can gain privileges, even a setuid binary |
| `ProtectProc=invisible` | It sees only its own processes in `/proc` |
| `PrivateTmp=yes` | Its `/tmp` is its own |
| `ProtectSystem=strict`, `ProtectHome=yes` | The whole file system is read-only to it, and `/home` is hidden |
| `ReadWritePaths=` | It may write only its copy of the workspace and its home |
| `PrivateDevices=yes` | No access to hardware devices |
| `CapabilityBoundingSet=` | No Linux capabilities at all |
| `RestrictSUIDSGID=yes` | It cannot create setuid or setgid files |
| `InaccessiblePaths=-/run/dbus` | It cannot reach D-Bus |
| `RestrictAddressFamilies=AF_UNIX AF_INET AF_INET6 AF_NETLINK` | No raw sockets or other exotic families |
| `MemoryMax=2G`, `TasksMax=512` | At most 2 GB of memory and 512 processes or threads |

The worker's working directory is its copy of the workspace. Its environment holds the path to its broker socket, the proxy's address and, for Droid, a placeholder key. It holds no secret.

## What the task user can reach

| Thing | Can it? | Why |
|---|---|---|
| Its own copy of the workspace | Read and write | Only its user can enter the copy |
| The base files and other tasks' layers | No | Only root can reach them directly |
| Other tasks' copies and homes | No | Each is owned by a different user |
| The vault, `/etc/box/vault.env` | No | Root only, mode `0600` |
| Its broker socket | Yes | The socket is owned by its user, mode `0600` |
| Another task's broker socket | No | Owned by another user |
| The network | Only the proxy | An nftables rule rejects everything else from uids 30000 to 39999 |
| The box's API on port 7700 | No | It is not the proxy, so the firewall rejects it |
| Other processes on the box | No | `ProtectProc=invisible` hides them |

This is why a hijacked agent has so little to work with. It can damage its own copy of the files, which you can undo. It cannot read a key, because none is in its reach. It cannot send your files anywhere, because the proxy only lets it reach the hosts in its spec.

## Why users and not containers

A Linux user is the oldest isolation boundary on the system, and every tool already respects it: file permissions, the firewall's `skuid` match, systemd, `pkill -u`. GurtOS combines it with overlayfs for files and the proxy for the network. That covers what an agent task needs without a container runtime, and the worker still sees a normal Ubuntu system with normal tools.

The trade-off is that tasks share one kernel. A kernel bug that lets a user become root would let a task out. See [the threat model](/docs/security/threat-model/).

## On the Personal edition

:::note[Preview]
On GurtOS Personal, you have your own account with sudo, and agents work beside you as separate users without sudo, on copies of your real folders. Task users are never in the `sudo` group, and your folders are only handed out by you, the owner. See [install GurtOS Personal](/docs/get-started/install-personal/).
:::

## Related

- [Network policy](/docs/concepts/network-policy/)
- [Workspaces and layers](/docs/concepts/workspaces-and-layers/)
- [Security model](/docs/security/model/)
- [Files and paths](/docs/reference/files-and-paths/)
