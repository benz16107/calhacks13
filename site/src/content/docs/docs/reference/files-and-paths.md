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
│   └── t3k9x2a1b2/               root, the task's group, 0710 while it runs, then root 0700
│       ├── upper/                task user 0700 while it runs, then root 0700: the task's layer
│       ├── work/                 root 0700   overlayfs scratch space
│       ├── root/                 the task's copy of the workspace, an overlay mount only its user can enter
│       ├── home/                 task user 0700: the task user's home
│       ├── broker.sock           task user 0600: the task's broker
│       ├── worker.log            the worker's output
│       └── replay.json, replay/  root 0600   what the layer held after each step, for replay
├── cursors/                      each log reader's position, one file per reader
├── devices.json                  root 0600   paired phones and their tokens
├── settings.json                 root 0600   the owner's settings
├── setup.json                    root 0600   first-run setup: done or not, and each step taken
├── apps.json                     root 0600   the apps that are turned off
├── permissions.json              root 0600   what the owner allowed each app to do
├── vault-meta.json               root 0600   when each vault key was set through the API, never a value
├── owner.json                    root 0600   Personal: the owner's account, when set at runtime
├── links.json                    root 0600   Personal: workspaces linked to the owner's real folders
├── business.json                 root 0600   Business: people, policy, seats and shadow mode
├── paused.json                   root 0600   who paused all agents, while they are paused (the box also writes it when permissions.json cannot be read)
├── tripwire.key                  root 0600   the secret the decoy keys in every task are made from
├── clean-stop                    written when the box stops cleanly, so the next start is not announced as a power cut
├── remote.json, remote-off       root 0600   remote access: the name and address, and the mark that the owner turned it off
├── relay.json                    root 0600   the relay the owner chose in Settings, if any
├── remote/                       the tunnel and certificate programs' config: frpc.toml, Caddyfile, relay-ca.pem, caddy/
├── spacetime/                    root 0700   cli.toml (the box's SpacetimeDB login) and fleet.json (the fleet view's token)
├── timemachine/                  root 0700   Personal: files as they were before each Keep
├── api.sock                      root 0600   the HTTP API on a Unix socket
├── api.port                      the TCP port the API listens on
├── ca/                           root 0700   the box's own CA and its key
├── relay-ca.pem                  0644        the CA certificate Droid tasks trust
└── empty/                        an empty folder that keeps an overlay with no done tasks valid
```

| Path | What |
|---|---|
| `log.jsonl` | Every event, one JSON object per line, append only and fsynced per line. See [Log events](/docs/reference/log-events/). |
| `workspaces/<name>/` | A workspace's base files. Tasks never write here; no task user can reach it. |
| `views/<name>/` | A read-only overlay: the base plus every done task's layer, newest on top. Rebuilt when a task finishes or is undone. |
| `tasks/<id>/` | One folder per task. While the task runs it belongs to root and the task's own group, so another task gets "permission denied" even if it learns the id. When the task ends the box makes it root-only and deletes the task user, because user ids are handed out again. |
| `tasks/<id>/upper/` | Everything the task changed. This is its layer. Undo takes it out of the view, then deletes it, with `work/`, `base/` and `root/`, as soon as no running task still reads it as a lower layer. An undone task's diff is empty. When the task ends, the box makes the files in it writable by any task user, so a later task can change them through its own copy, and makes the folder itself root-only. |
| `tasks/<id>/root/` | The task's working copy: its layer over the layers it saw at start, over the base. Unmounted when the task ends. |
| `tasks/<id>/home/` | The task user's home directory |
| `tasks/<id>/broker.sock` | See [Broker API](/docs/reference/broker/) |
| `tasks/<id>/worker.log` | Standard output and error of the worker |
| `tasks/<id>/replay.json`, `tasks/<id>/replay/<seq>/` | The task's flight recorder: its changed files after each step and tool result, for replay. Deleted with the layer. |
| `tasks/<id>/base/`, `base.done`, `manifest.json` | Personal (preview): for a task on real folders, a snapshot of the folders it works on, a mark that the copy finished, and a hash of every file in them at start, used to spot the owner's edits at Keep time |
| `cursors/<app>.<reader>` | The number of events that log reader has handled |
| `devices.json` | Paired phones, with their tokens and whether each was paired as the owner's. Revoked phones stay, marked revoked. |
| `settings.json` | The settings from `PATCH /api/settings`. Missing keys take their defaults. See [HTTP API](/docs/reference/http-api/#setup-settings-apps-and-the-vault). |
| `setup.json` | Whether first-run setup is done, and the steps taken. A box that ran tasks before setup existed is marked done. |
| `apps.json` | `{"disabled": [...]}`: the apps turned off. A new box starts with every app off except the model app (`anthropic`), and the owner turns on the rest in App Center. A box that ran tasks before keeps what it ran. |
| `permissions.json` | Each app's permissions from Settings, Permissions: what the owner turned off, its money per day, its disk limit, and the hosts, shell use and folders it has been seen using |
| `vault-meta.json` | Each vault key set through the API, with the time. Names only. |
| `owner.json` | Personal (preview): `{user, setAt}` from `PUT /api/owner`. It wins over `BOX_OWNER`. |
| `links.json` | Personal (preview): each linked workspace and the real folder, or folders, it points at. A link is never repointed. |
| `business.json` | GurtOS Business: whether it is on, the company name, the policy, the people and seats, and shadow mode. A box with no file has Business off, unless `BOX_EDITION=business`. |
| `timemachine/<id>/` | Personal (preview): the files a Keep replaced, as they were before, with their owners and modes, and `kept.json`. `POST /api/tasks/<id>/unkeep` puts them back, and writes `reverted.json`. |
| `remote.json`, `remote-off`, `relay.json`, `remote/` | Remote access (opt in). `remote/` holds the config of the tunnel (`frpc`) and certificate (`caddy`) programs the box starts, and the relay's certificate. A relay's secret is in the vault as `BOX_RELAY_SECRET`. |
| `spacetime/cli.toml`, `spacetime/fleet.json` | The login the box publishes its SpacetimeDB module with, and the Maincloud identity of the optional fleet view |
| `ca/` | The key and certificate the proxy uses to relay Droid's model calls. The key never leaves this folder. |

### State files

The JSON state files above are written beside their final name and renamed into place, so a power cut leaves the old file or the new one, never half of one. The log is the exception: it is append only.

If `devices.json`, `owner.json`, `vault-meta.json` or `permissions.json` cannot be read when the box starts (a disk that failed under a write), the box renames it to `<name>.torn-<time>`, where `<time>` is milliseconds since 1970. It prints a warning, starts without the file, and writes a `security` note that names it. The box still starts, and it grants nobody access:

- No `devices.json` means no phone is paired. Pair your phones again.
- An unreadable `owner.json` still counts as an owner being set, so only root or the owner's phone can change the owner.
- An unreadable `permissions.json` loses the owner's "off" switches, so the box pauses all agents and records that GurtOS did it. No agent starts until the owner checks Settings, Permissions, and resumes them.
- An unreadable `remote.json` is kept as `remote.json.torn` and remote access starts off. Turning it on again works.

`settings.json`, `setup.json`, `apps.json` and `business.json` fall back to their defaults when unreadable, and are not set aside.

### App folders

Apps keep their own state under `BOX_HOME`:

| Path | App | Holds |
|---|---|---|
| `inbox/example/` | `example` | Files dropped here start a task |
| `find/` | `find` | `docs.json`, every indexed entry, so a restart needs no new descriptions, and `inference.json` |
| `jira/` | `jira` | `config.json` (turns syncing on), `people.json`, `jsm.json`, `daily.json` and issue keys |
| `elastic/` | `elastic` | `outbox.ndjson` (documents waiting for Elastic), `sent` (how far it got), and `requests.json`, the requests it has already answered |
| `receipts/` | `receipts` | The receipt signing key (`key.json`, root only) and each receipt as `<id>.json` |
| `fetch/` | `fetch` | The chat agent's seed (root only), its on switch and its outbox |
| `shopper/` | `shopper` | `orders.jsonl` and `store-events.jsonl` (test store orders and requests), and enrolled passkeys |
| `wallet/` | `wallet` | `0700`. A durable mark per payment, so one call never pays twice, `payments.jsonl` and `audit.jsonl` |
| `vultr/` | `vultr` | `firewall.json`, and the backup's `manifest.json` and `last.json` |
| `credit-desk/` | `credit-desk` | Uploaded cases and the `recheck.on` switch |

## `/etc/box`

| Path | Owner and mode | What |
|---|---|---|
| `vault.env` | root `0600` | The vault: one `KEY=value` per line. The box refuses to start if group or others have any access to it. See [Vault keys](/docs/reference/vault-keys/). |
| `identity.key` | root `0600` | The box's own ed25519 key. OS image only. |
| `identity.pub` | `0644` | Its public key. The first 6 hex digits of its SHA-256 hash name the box: its hostname is `gurt-<digits>`, such as `gurt-bf07fe`, and the box service uses the hostname as its id. On GurtOS Personal, a name the person gives the computer in Settings wins. OS image only. |
| `stdb.env` | root | Optional. `STDB_LISTEN=<address>` makes SpacetimeDB listen on that address instead of `127.0.0.1`. |

On the OS image, `/etc/box` is `0700` and lives on the data partition, so it survives system updates. On GurtOS Personal the data partition also holds `/home`, saved network connections, account pictures and types (AccountsService) and Bluetooth pairings.

## Installed software

| Path | What |
|---|---|
| `/opt/box/` | The box service's source, copied there by `core/install.sh`. On the OS image it is part of the system slot. |
| `/usr/local/bin/node` | Node.js 24, installed by `core/setup.sh` when the machine has no Node.js 22 or newer |
| `/usr/local/bin/droid` | The Droid CLI. `core/setup.sh droid` checks it against a SHA-256 pinned in the script. On the OS image, `box-droid.service` runs that after the first start, because the image may not ship it. |
| `/usr/local/bin/frpc`, `/usr/local/bin/caddy` | The tunnel and certificate programs for remote access, pinned releases checked against a SHA-256 in `core/setup.sh` |
| `/usr/local/bin/spacetime` | A link to `/root/.local/bin/spacetime`. When the machine has no `spacetime`, `core/setup.sh` installs SpacetimeDB 2.13.0 from the release files on GitHub, each checked against a SHA-256 pinned in the script, and runs no script from the internet. The CLI and server are in `/root/.local/share/spacetime/bin/2.13.0/`, and `/root/.local/bin/spacetime` is its version manager. |
| `/var/lib/spacetimedb/` | SpacetimeDB's data |
| `/root/.config/spacetime/` | The login an older install made for the box's SpacetimeDB database. The box copies it to `BOX_HOME/spacetime/cli.toml` once and uses its own copy after that. |

## OS image only

| Path | What |
|---|---|
| `/etc/box-os/release` | `BUILD` and `ARCH`. GurtOS Personal adds `EDITION=personal` and its slot size. Debug builds add `DEBUG=sshd-with-a-root-key`. |
| `/etc/os-release` | `NAME="GurtOS"`, `PRETTY_NAME="GurtOS <edition> <version>"`, `ID=gurtos`, `ID_LIKE=ubuntu` |
| `/etc/box-os/update.pub` | The public key every system update must be signed with |
| `/boot/efi/boot/grub/grubenv` | Which slot starts: `saved_entry`, `next_entry` for a one-time trial, and `just_installed` |
| `/data/update/` | `trial` (the slot on trial), `last` (the last update's result) and `writing` (a slot whose update has not finished) |
| `/data/droid/droid` | A copy of the Droid CLI, put back after a system update |
| `/run/box-os/droid` | Where the Droid download stands: `state` (`downloading`, `offline`, `retrying` or `ready`), `message` and `at`. It retries with growing waits and never holds up boot. |
| `/run/box-os/box.env` | `BOX_LISTEN` and `BOX_URL`, worked out at each start by `box-env` |
| `/usr/local/sbin/box-install`, `box-update`, `box-firstboot` | The installer, updates and first-boot setup |
| `/usr/local/lib/box-os/` | The disk's GRUB menu, the kiosk browser, `box-droid` and `box-env`. GurtOS Personal adds `box-hostname` and `carry.d/`, the scripts that carry people's accounts into a new slot. |

See [Disk layout and updates](/docs/reference/disk-layout/).

## Services

| Unit | Where | Does |
|---|---|---|
| `box.service` | Every box | The box service. `Restart=always`. Runs `/opt/box/core/box.ts` with `BOX_HOME=/var/lib/box`. |
| `spacetimedb.service` | Every box | SpacetimeDB on `127.0.0.1:3000`, or the address in `/etc/box/stdb.env` |
| `box-task-<id>` | Every box | One transient unit per running task, made with `systemd-run` |
| `box-firstboot.service` | OS image | Makes the identity key and an empty vault if missing, and sets the hostname. Runs at every start. |
| `box-kiosk.service` | GurtOS Server image | A full-screen browser on the portal's box screen, `http://127.0.0.1:7700/screen`, as the `kiosk` user |
| `box-droid.service` | OS image | Downloads the Droid CLI after the first start, and puts it back after an update. Retries until it works. |
| `box-owner.service`, `box-owner.path` | GurtOS Personal image | After the desktop's own setup makes the first account, sets that account as the owner |
| `box-voice.service` | GurtOS Personal image | Downloads the speech model for Talk to your computer once |
| `box-sharing-fw.service` | GurtOS Personal image | Opens the ports of the Sharing services that are turned on |
| `box-confirm.service` | OS image | Waits for health, then keeps or rolls back a system update |
| `box-tunnel`, `box-tls` | Every box, when remote access is on | Transient units for the tunnel (`frpc`) and the box's own certificate (`caddy`) |
| `box-install.service` | Install disc | Installs the box on a disk |

## Ports

| Port | Interface | What |
|---|---|---|
| 7700 | `127.0.0.1` by default (`BOX_LISTEN`). Both editions from the ISO listen on every address, and their firewall lets private networks in. | The HTTP API and the portal |
| 7701 | Every address, only while setup from another computer is open (`BOX_SETUP_PORT`). The image's firewall lets it in from private networks only, like 7700. | The setup channel. It closes at finish, at Stop, or after two hours, and every request needs the setup token. |
| 3000 | `127.0.0.1` by default (`STDB_LISTEN`) | SpacetimeDB |
| 8888 | `127.0.0.1` | The task proxy on the installed box. Test runs pick a free port in 8800 to 8887. The firewall lets task users reach 8800 to 8899 on `127.0.0.1` and nothing else. A task may hold at most 256 open connections to it. |

Tasks can never reach the API, SpacetimeDB or the proxy range through a host name either: the proxy refuses an address on the box itself unless the task's hosts name that exact `host:port`, and then still never those ports. It never reaches link-local addresses, such as a cloud metadata service.

On the OS image, `/etc/nftables.conf` is the inbound firewall. It drops everything coming in except replies to the box's own connections, ping and DHCP. Both editions also let port 7700 in from private networks (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `100.64.0.0/10`, `169.254.0.0/16`, IPv6 `fc00::/7` and `fe80::/10`), and port 7701 from the same networks while it is open. Port 3000 is never open. Debug builds also open SSH on port 22. On GurtOS Personal, `box-sharing-fw.service` adds the ports of the Sharing services that are on. The firewall never flushes the ruleset, so the box's own task table (`inet box`) stays.

## Related

- [Environment variables](/docs/reference/environment/)
- [Workspaces and layers](/docs/concepts/workspaces-and-layers/)
