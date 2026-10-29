---
title: Security model
description: The layers that keep an agent task inside its limits on GurtOS, what each layer stops, and the settings that enforce it.
---

GurtOS assumes the agent in a task can be wrong or can be turned against you, by a bad instruction, a buggy plan or a web page with hidden instructions. So it does not rely on the agent's judgement or on its own permission prompts. Each task runs with high autonomy inside limits the operating system enforces. This page lists those limits, layer by layer, and what each one stops.

## Why keys never reach an agent

Agent tools often keep API keys and tokens where the agent itself, or any program running as the same user, can read
them: in an environment variable, a `.env` file or the agent's own configuration folder. Anything that can read that
file can take the key. That includes the agent after it reads a page with hidden instructions, a malicious plugin, and
ordinary malware. In February 2026, researchers reported the first case of infostealer malware taking an AI agent's
configuration folder from a victim's machine, including a gateway token and the device's private key
([BleepingComputer](https://www.bleepingcomputer.com/news/security/infostealer-malware-found-stealing-openclaw-secrets-for-first-time/)).
The malware was not aimed at that agent: it collected any file that looked like it held a token or a private key.

GurtOS never gives a key to an agent. Keys live in a vault that only root can read. A task runs as its own Linux user,
holds placeholders, and asks for work by tool name; the box makes the call with the key and returns only the
result. Model calls go through the box's proxy, which adds the key on the way out. So a task has no key to leak, to
send to a web page, or to leave in a file for malware to find. The layers below are how that holds.

For what GurtOS does and does not defend against, read the [threat model](/docs/security/threat-model/). For a picture of the zones, read [trust boundaries](/docs/security/trust-boundaries/).

## 1. Each task is its own Linux user

Every task runs as a new system user, `box-<id>`, with a uid between 30000 and 39999. The user has no password, no login shell (`/usr/sbin/nologin`), no sudo and no group shared with anything else. Its home is a folder inside the task's own directory. When the task ends, the box kills its processes and deletes the user.

**Stops:** a task reading or changing another task's files, the box's state, or your files, through ordinary file permissions. A task cannot become root through sudo.

See [Agents as their own users](/docs/concepts/agent-users/).

## 2. A hardened service unit per task

The worker starts as a transient systemd unit, `box-task-<id>`, with these properties:

| Property | Effect |
|---|---|
| `NoNewPrivileges=yes` | No setuid program or file capability can raise its privileges |
| `CapabilityBoundingSet=` | No Linux capabilities at all |
| `RestrictSUIDSGID=yes` | It cannot create setuid or setgid files |
| `ProtectSystem=strict` | The whole file system is read-only to it |
| `ReadWritePaths=` its copy and its home | The only two places it can write |
| `ProtectHome=yes` | `/home`, `/root` and `/run/user` are invisible |
| `PrivateTmp=yes` | Its own `/tmp`, not shared with other tasks |
| `PrivateDevices=yes` | No access to physical devices |
| `ProtectProc=invisible` | It sees only its own processes in `/proc`, not the box's or other tasks' |
| `InaccessiblePaths=-/run/dbus` | No D-Bus |
| `RestrictAddressFamilies=AF_UNIX AF_INET AF_INET6 AF_NETLINK` | No raw packet sockets or other socket families |
| `MemoryMax=2G`, `MemorySwapMax=0` | At most 2 GB of memory, and no swap |
| `TasksMax=512` | At most 512 processes and threads |
| `CPUQuota=200%` | At most two CPU cores |
| `SystemCallFilter=` | No mount, kernel module, debug, raw I/O, reboot, swap, clock, obsolete or CPU-emulation system calls, and no `bpf`, keyring or `userfaultfd` calls. Only the machine's own architecture. |
| `ProtectKernelModules`, `ProtectKernelTunables`, `ProtectKernelLogs`, `ProtectControlGroups`, `ProtectClock`, `ProtectHostname`, `LockPersonality`, `RestrictRealtime` | No loading modules, changing kernel settings, reading the kernel log, changing control groups, the clock or the host name, switching personality, or realtime scheduling |

**Stops:** writing outside its copy, seeing or signalling other processes, using devices, gaining privileges, and one task exhausting the machine's memory, CPU or process table.

## 3. Its own copy of the files

A task never works on the real files. It gets an overlayfs copy: its own changes on top of the changes of tasks that finished before it, on top of the workspace's base files. The base files are in a folder only root can enter. The copy's top folder belongs to the task's user with mode `0700`, so no other task can enter it. When the task finishes, its changes become a layer that later tasks see, and undo takes that one layer out.

Undo takes the layer out of the view, then deletes its files from disk as soon as no running task still reads it.

On GurtOS Personal a task can work on a copy of the owner's real folders. Only the owner may hand out a folder. It must be in the owner's home, or, once the owner has chosen folders in Settings (`agentFolders`), inside one of those folders. It must not belong to root, and can never be the system or the box's own state: `/etc`, `/root`, `/proc`, `/sys`, `/dev`, `/boot`, `/run`, `/usr`, `/bin`, `/sbin`, `/lib`, `/lib32`, `/lib64`, `/var/lib`, `/var/log`, `/opt`, `/snap` and the box's data folder are refused, and Settings cannot add them. Links are followed to where they really go before the check. Nothing reaches the real folder until the owner chooses Keep, and Keep keeps each file's owner and mode.

**Stops:** a task damaging the original files, a task seeing another running task's changes, a bad task's changes outliving an undo, and an agent being given the system's or the box's own files. See [Workspaces and layers](/docs/concepts/workspaces-and-layers/).

## 4. No secrets in the task

Secrets live in the vault, `/etc/box/vault.env`, readable by root only. The box refuses to start if the file is readable by anyone else. A task's environment holds no secret. It holds a decoy cloud key (`AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`) that is never real. If the decoy shows up in a plain web request, a step, a tool call or a note, the box stops the task and undoes it, logs it in a `security` note, and alerts the owner's paired phones when remote access is on.

When a task needs something done with a key (call a paid API, pay, sign), it asks its broker to run a tool by name. The broker is a Unix socket owned by the task's user with mode `0600`. The tool runs inside the core, reads only the vault keys it declares, and returns a result. The task never sees the key.

**Stops:** a hijacked agent reading keys from files, its environment or memory, because they are not there. See [The vault and the broker](/docs/concepts/vault-and-broker/).

## 5. Network only through the box's proxy

An nftables rule on the box's output path matches every connection by its owner's uid. Task users (30000 to 39999) may connect to `127.0.0.1` on ports 8800 to 8899 and nothing else. The box's proxy listens on one port in that range (8888 on an installed box), but the rule opens the whole range, so another program of yours that listens there is reachable from a task. Every other packet is rejected and counted.

The proxy knows which task opened each connection from the uid that owns it, so tasks carry no token. It allows only the hosts in the task's `hosts` list:

- `example.com` allows that host on any port, `example.com:8080` only that port, `*.example.com` its subdomains.
- It resolves the name once and connects to that address, so the name cannot change between the check and the connection.
- It never reaches link-local addresses (the cloud metadata service). A name that resolves to the box or to a private network needs an exact `host:port`, and the box's own ports (the API, SpacetimeDB, the proxy range) are always refused.
- A task holds at most 256 proxy connections at once.
- Every refusal is a `net.blocked` event in the action log.

A task with an empty `hosts` list has no network at all. A task that names no hosts gets none, unless the owner sets Settings `networkDefault` to `allowlist`, which gives it the hosts in `defaultHosts`.

**Stops:** sending data to a host the task was not given, going around the proxy, reaching the box's API or SpacetimeDB to approve itself, and reaching services on your local network. See [Network policy](/docs/concepts/network-policy/).

## 6. The model key stays outside the task

Droid needs a model key: a Factory API key, or your own Anthropic key. A Droid task holds only a placeholder. Its calls go through the box's proxy:

- Plain API calls go to the proxy as Droid's base URL, and the proxy puts the vault's key on the request.
- Model calls to `*.factory.ai` over HTTPS are answered by the proxy with a certificate from the box's own certificate authority. Only Droid tasks are told to trust that authority. The proxy swaps the placeholder for the real key and forwards the call over real TLS. It relays only the paths Droid calls, and refuses and logs any other.
- With your own Anthropic key, calls to `api.anthropic.com` get the key in the `authorization` or `x-api-key` header only.
- On either key, a model call that asks the service to fetch a page, an MCP server or a file by URL for the task is refused.

The authority's private key is in `BOX_HOME/ca`, root only. Tasks that are not Droid tasks get no Factory access through the proxy.

**Stops:** the one key every Droid task needs from ever entering a task.

## 7. Budgets and approvals

Every tool declares what a call costs. Before a call runs, the broker adds the cost to what the task has spent and to what its other calls in flight have reserved. If the total would pass the task's budget, the task pauses and asks for an OK. The tool runs only after someone approves.

- A single spend above Settings `approvalThresholdCents` always asks, even inside the budget. The default is 500 cents, $5.
- A task that names no budget gets Settings `defaultBudgetCents`, 100 cents ($1) by default, so a spend past $1 asks.
- The box's own budget question, a task's own questions and a tool's questions have different ids (`<task>.budget.<action>`, `<task>.task.<key>` and `<task>.tool.<call>.ask.<hash>`), so a task cannot answer the budget question in advance with a cheap one.
- One approval per action. A call retried while waiting shares one approval and is charged once.
- The first answer wins, from any device.
- A task's pending approvals close when it ends.
- Agents can also ask for an OK before anything risky.

**Stops:** a task spending past its budget, or a large single amount, without a person agreeing, and two payments fired at once together passing the budget. See [Approvals and budgets](/docs/concepts/approvals-and-budgets/).

## 8. Everything is written down

Every state change, step, tool call and result, approval and answer, cost and refused connection is a line in the action log, `BOX_HOME/log.jsonl`. Each line is written and fsynced before the box acts on it. The file is root-only. Tasks cannot read or write it.

**Gives you:** a record of what each agent did, which person approved what and from which device, and the base for undo and resume. Each line carries the hash of the line before it (`prev`), so an edit in the middle shows. Nothing signs the log, so root can rewrite the whole chain. A task writes at most 20 MB to it, and 64 KB per step. See [The action log](/docs/concepts/action-log/).

A task's part of the log can also leave the box as a signed receipt that anyone can check in a browser. See
[Verify a receipt](/docs/guides/verify-a-receipt/).

## 9. Only paired devices reach the API

On the Ubuntu install, the box's HTTP API listens on `127.0.0.1` unless you set `BOX_LISTEN`. GurtOS Server and GurtOS Personal from the ISO listen on every address behind an inbound firewall (below). Wherever it listens, it sorts each request:

- **The box's own screen.** A request over the Unix socket, or from `127.0.0.1` with no proxy header such as `X-Forwarded-For`, a Host of `127.0.0.1` or `localhost`, and no Origin but the box's own address, may do everything. Another page in a browser on the same machine does not count.
- **A paired device.** Any other request must carry the token of a device paired with a one-time code from the box's own screen. It may read, start tasks, undo and answer approvals. The log names the device as the approver; the request cannot choose the name.
- **An app's page** under `/t/<app>/` runs sandboxed in the browser, with a window token that reaches only that app's routes and reads tasks and approvals. It answers only its own app's requests.
- **Anyone else** gets `401`. Only the health check, redeeming a pairing code, the portal's own pages, Business work-account sign-in and the open routes of apps (see the [threat model](/docs/security/threat-model/#access-to-the-boxs-services)) are open. Wrong pairing codes are limited to 5 a minute per address. Request bodies are capped at 10 MB, or 1 MB without a token.

Answering approvals through the GurtOS MCP server is off unless `BOX_MCP_ANSWER=on`.

Pairing codes, the list of devices, setup, settings, the vault, apps on and off, the owner, folders and Keep are the **owner's**: the box's own screen, or a device paired as the owner from that screen. Anyone else gets `403`. No route returns a vault value.

SpacetimeDB, which mirrors live tasks and approvals for the box's own screen, has no login of its own, so it listens on `127.0.0.1` only. Its `answer` reducer also works only from a connection the box has vouched for (the box's own screen, or a paired phone that told the box its SpacetimeDB identity through the API), and it records the vouched name. Phones follow the box's API instead.

The OS image adds an inbound firewall. It drops everything that comes in except replies to the box's own connections, ping and DHCP. On both editions it lets the API on port 7700, and the setup port 7701 while setup from another computer is open, in from private networks only (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, Tailscale's `100.64.0.0/10`, link-local and IPv6 unique local addresses), never from the public internet. SpacetimeDB's port is never open. Debug builds also allow SSH. On Personal, the firewall also opens the port of each Settings, Sharing service for as long as that service is on.

**Stops:** anyone on the internet reaching the API at all on the OS image, and someone on your network reading tasks, starting work, approving spending or undoing tasks; a paired phone changing settings or the vault; and a forged approval through SpacetimeDB. See [HTTP API](/docs/reference/http-api/#who-may-call-what).

## 10. Signed, whole-system updates

On the GurtOS image, the system updates as one image. An update must carry a valid ed25519 signature from the build machine's key and match its SHA-256 hash. It is written to the slot that is not running, tried once, and kept only if the box reports healthy within 5 minutes. Otherwise the box starts the previous system again.

**Stops:** an unsigned or altered image being installed, and a broken update leaving the box unusable. See [System updates](/docs/concepts/system-updates/).

## 11. No human account on GurtOS Server

GurtOS Server has no login prompt and no user with sudo. Root's password is locked, the `sudo` binary is absent, and every console login is masked. Release builds have no SSH server. The screen is a full-screen browser that runs as a `kiosk` user with no password and no shell, showing the portal from the box's own API. The system is built from 40 named packages and their dependencies, without apt, snapd or cloud-init: it changes only by whole-system updates.

**Stops:** someone at the keyboard, or on the network, logging in to the box. Debug builds add SSH with one key for root and say so in `/etc/box-os/release`.

GurtOS Personal is different on purpose: it is your own computer, and your account has `sudo`. The agents' task users never do.

## 12. Remote access through the relay

Remote access is off until the owner turns it on. Then the box opens one outbound tunnel to a relay and gets its own
address, such as `rosa.box.example.com`, with its own Let's Encrypt certificate. TLS ends on the box, with a
key that never leaves it. A request through the tunnel carries `X-Forwarded-For`, so the box treats it as remote and
asks for a paired device's token, as on the home network. Every phone still needs a pairing code from the box's own
screen. See [Reach your box from anywhere](/docs/guides/reach-your-box-from-anywhere/).

The relay **can** see:

- which names exist, and when each box's tunnel connects, and from which address;
- for each connection to a box, the caller's IP address, the time, the name asked for and the bytes each way;
- the plain-HTTP requests on port 80, which are certificate challenges and redirects only;
- for each push, the push service's endpoint, the time and the size.

The relay **cannot** see anything inside a box's HTTPS connections: pages, API calls, pairing codes, device tokens,
approvals or files. It cannot read a push either: the box encrypts each one for the phone (RFC 8291) before it
reaches the relay's gateway, and signs it with a key made for that box alone.

**Stops:** a network or the relay reading a box's traffic, and one box posing as another when they share a push
subscription. See the [threat model](/docs/security/threat-model/) for what a relay operator could still try.

A hosted relay is not running during the preview, so remote access works with a relay you run. See
[Run your own relay, push gateway and web app](/docs/guides/self-host/).

## What these layers have in common

Every limit is enforced by the kernel, systemd or the box's own core, outside the agent's process. None depends on the model following instructions. The trust that remains is in the core, the apps installed in it, the machine's root account, other software running on the box itself, and the devices you pair. The [threat model](/docs/security/threat-model/) covers those.
