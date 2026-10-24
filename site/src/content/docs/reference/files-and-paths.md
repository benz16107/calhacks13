---
title: Files and paths
description: Where GurtOS keeps its log, workspaces, task copies, vault and identity on disk, with owners and modes, plus its services and network ports.
---

Paths below assume the defaults: `BOX_HOME=/var/lib/box` and `BOX_VAULT=/etc/box/vault.env`. The box service runs as root and creates everything under `BOX_HOME` itself.

## `BOX_HOME`

```text
/var/lib/box/                     root 0711
├── log.jsonl                     root 0600   the action log
├── workspaces/                   root 0700   base files, one folder per workspace
│   └── home/                                 always exists
├── views/                        root 0700   read-only views: base plus every done layer
│   └── home/
├── tasks/                        root 0711
│   └── t3k9x2a1b2/               root 0711   one per task
│       ├── upper/                task user 0700 while it runs, then root 0700: the task's layer
│       ├── work/                 root 0700   overlayfs scratch space
│       ├── root/                 the task's copy of the workspace, an overlay mount only its user can enter
│       ├── home/                 task user 0700: the task user's home
│       ├── broker.sock           task user 0600: the task's broker
│       └── worker.log            the worker's output
├── cursors/                      each log reader's position, one file per reader
├── devices.json                  root 0600   paired phones and their tokens
├── links.json                    Personal: workspaces linked to the owner's real folders
├── timemachine/                  Personal: files as they were before each Keep
├── api.sock                      root 0600   the HTTP API on a Unix socket
├── api.port                      the TCP port the API listens on
├── ca/                           root 0700   the box's own CA and its key
├── relay-ca.pem                  0644        the CA certificate Droid tasks trust
└── empty/                        an empty folder that keeps an overlay with no done tasks valid
```

| Path | What |
|---|---|
| `log.jsonl` | Every event, one JSON object per line, append only and fsynced per line. See [Log events](/reference/log-events/). |
| `workspaces/<name>/` | A workspace's base files. Tasks never write here; no task user can reach it. |
| `views/<name>/` | A read-only overlay: the base plus every done task's layer, newest on top. Rebuilt when a task finishes or is undone. |
| `tasks/<id>/upper/` | Everything the task changed. This is its layer. Undo removes it from views; the folder stays on disk, so its diff still answers. |
| `tasks/<id>/root/` | The task's working copy: its layer over the layers it saw at start, over the base. Unmounted when the task ends. |
| `tasks/<id>/home/` | The task user's home directory |
| `tasks/<id>/broker.sock` | See [Broker API](/reference/broker/) |
| `tasks/<id>/worker.log` | Standard output and error of the worker |
| `cursors/<app>.<reader>` | The number of events that log reader has handled |
| `devices.json` | Paired phones, with their tokens. Revoked phones stay, marked revoked. |
| `links.json` | Personal (preview): each linked workspace and the real folder it points at |
| `timemachine/<id>/` | Personal (preview): the files a Keep replaced, as they were before, and `kept.json` |
| `tasks/<id>/base/`, `tasks/<id>/manifest.json` | Personal (preview): for a task on a real folder, a snapshot of the folder it works on, and a hash of every file in it at start, used to spot the owner's edits at Keep time |
| `ca/` | The key and certificate the proxy uses to relay Droid's model calls. The key never leaves this folder. |

### App folders

Apps keep their own state under `BOX_HOME`:

| Path | App | Holds |
|---|---|---|
| `inbox/example/` | `example` | Files dropped here start a task |
| `elastic/outbox.ndjson`, `elastic/sent` | `elastic` | Documents waiting for Elastic, and how far it got |
| `fetch/` | `fetch` | The chat agent's seed (root only), its on switch and its outbox |
| `find/docs.json` | `find` | Every indexed entry, so a restart needs no new descriptions |
| `jira/` | `jira` | `config.json` (turns syncing on) and issue keys |
| `shopper/orders.jsonl` | `shopper` | Test store orders |
| `wallet/` | `wallet` | A durable mark per payment, so one call never pays twice |

## `/etc/box`

| Path | Owner and mode | What |
|---|---|---|
| `vault.env` | root `0600` | The vault: one `KEY=value` per line. The box refuses to start if anyone but root can read it. See [Vault keys](/reference/vault-keys/). |
| `identity.key` | root `0600` | The box's own ed25519 key. OS image only. |
| `identity.pub` | `0644` | Its public key. The first 10 hex digits of its SHA-256 hash name the box: its hostname, and so its id, is `box-<digits>`. OS image only. |

On the OS image, `/etc/box` lives on the data partition, so it survives system updates.

## Installed software

| Path | What |
|---|---|
| `/opt/box/` | The box service's source, copied there by `core/install.sh` |
| `/usr/local/bin/node` | Node.js 24, installed by `core/setup.sh` |
| `/usr/local/bin/droid` | The Droid CLI, checked against its published SHA-256 |
| `/usr/local/bin/spacetime` | The SpacetimeDB CLI and server |
| `/var/lib/spacetimedb/` | SpacetimeDB's data |
| `/root/.config/spacetime/` | The identity that owns the box's SpacetimeDB database |

## OS image only

| Path | What |
|---|---|
| `/etc/box-os/release` | `BUILD` and `ARCH`. Debug builds add `DEBUG=sshd-with-a-root-key`. |
| `/etc/box-os/update.pub` | The public key every system update must be signed with |
| `/boot/efi/boot/grub/grubenv` | Which slot starts: `saved_entry`, and `next_entry` for a one-time trial |
| `/data/update/` | `trial` (the slot on trial) and `last` (the last update's result) |
| `/usr/local/sbin/box-install`, `box-update`, `box-firstboot` | The installer, updates and first-boot setup |
| `/usr/local/lib/box-os/` | The disk's GRUB menu and the kiosk browser |

See [Disk layout and updates](/reference/disk-layout/).

## Services

| Unit | Where | Does |
|---|---|---|
| `box.service` | Every box | The box service. `Restart=always`. Runs `/opt/box/core/box.ts` with `BOX_HOME=/var/lib/box`. |
| `spacetimedb.service` | Every box | SpacetimeDB on port 3000 |
| `box-task-<id>` | Every box | One transient unit per running task, made with `systemd-run` |
| `box-firstboot.service` | OS image | Makes the identity key and an empty vault if missing, and sets the hostname. Runs at every start. |
| `box-kiosk.service` | OS image | A full-screen browser on the portal's box screen, `http://127.0.0.1:7700/screen`, as the `kiosk` user |
| `box-confirm.service` | OS image | Waits for health, then keeps or rolls back a system update |
| `box-install.service` | Install disc | Installs the box on a disk |

## Ports

| Port | Interface | What |
|---|---|---|
| 7700 | `127.0.0.1` by default (`BOX_LISTEN`) | The HTTP API and the portal |
| 3000 | All interfaces | SpacetimeDB |
| 8888 | `127.0.0.1` | The task proxy on the installed box. Test runs pick a free port in 8800 to 8887. The firewall lets task users reach 8800 to 8899 on `127.0.0.1` and nothing else. |

Tasks can never reach the API, SpacetimeDB or the proxy range through a host name either: the proxy refuses any address on the box itself for those ports.

## Related

- [Environment variables](/reference/environment/)
- [Workspaces and layers](/concepts/workspaces-and-layers/)
