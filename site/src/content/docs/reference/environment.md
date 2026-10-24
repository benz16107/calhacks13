---
title: Environment variables
description: Every environment variable the box service, its tasks, the test suite and the image build read, with what each does and its default.
---

Environment variables configure the box service itself. Secrets never go here: they belong in the vault (see [Vault keys](/reference/vault-keys/)). On an installed box, set variables in a systemd drop-in for `box.service`:

```ini title="/etc/systemd/system/box.service.d/local.conf"
[Service]
Environment=BOX_LISTEN=192.0.2.10
Environment="BOX_NAME=Home box"
```

Then run `systemctl daemon-reload && systemctl restart box.service`.

## The box service

| Variable | Default | Does |
|---|---|---|
| `BOX_HOME` | `/var/lib/box` | Where the action log, workspaces and tasks live. See [Files and paths](/reference/files-and-paths/). |
| `BOX_VAULT` | `/etc/box/vault.env` | The vault file. It must be readable by root only, or the box will not start. |
| `BOX_PORT` | `7700` | The HTTP API's TCP port. `0` turns the TCP listener off (the Unix socket stays). `auto` takes any free port and writes it to `BOX_HOME/api.port`. |
| `BOX_LISTEN` | `127.0.0.1` | The address the HTTP API listens on. Requests from anywhere but the box itself need a paired device's token, but set this only to an address on a network you trust. GurtOS Server from the ISO sets `0.0.0.0` at each start, behind its inbound firewall. |
| `BOX_ORIGINS` | none | Browser origins allowed to call the API from another site, comma separated, or `*`. The portal served by the box needs none. |
| `BOX_PORTAL` | `portal/dist` in the source tree | The folder of the built portal the box serves |
| `BOX_ID` | the machine's hostname | This box's id, in `GET /api/boxes`, `GET /api/system` and pairing. On the OS image the hostname is `gurt-<id>`, where `<id>` is the first 6 hex digits of the SHA-256 of the box's public key, such as `gurt-bf07fe`. |
| `BOX_NAME` | the value of `BOX_ID` | This box's name for people |
| `BOX_URL` | none | This box's own address for other devices, such as `http://box.local:7700`. GurtOS Server from the ISO sets it to `http://<its address>:7700` at each start. Shown in `GET /api/boxes`. With it set, `POST /api/pair/start` returns an absolute `url`, so the QR code on the box's own screen opens on a phone. |
| `BOX_PEERS` | `[]` | Other boxes one portal can list, as a JSON array of `{"id", "name", "url", "stdb"}`. See [Add a second box](/guides/add-a-second-box/). |
| `BOX_OWNER` | none | Personal (preview): the owner's Linux user. An owner set at runtime with `PUT /api/owner` (saved in `BOX_HOME/owner.json`) wins over it. On the GurtOS Personal image, `box-owner.service` sets it after the desktop's own setup makes the first account. Leave it unset on a Server box. |
| `BOX_EDITION` | `personal` with an owner, else `server` | The edition `GET /api/system` reports: `server`, `personal` or `business`. |
| `BOX_APPROVAL_WAIT_MS` | `150000` | How long one `/ask` or over-budget `/call` waits for an answer before returning "pending, call again". Keep it under the worker's tool-call timeout. |
| `BOX_MODEL` | `claude-sonnet-4-6` | The model Droid tasks use. When set, it is passed into every Droid task; when unset, the worker uses the default. |
| `BOX_PROXY_PORT` | `8888` | The task proxy's port. `auto` picks a free port in 8800 to 8887. It must stay in 8800 to 8899, the range the firewall lets tasks reach. |
| `BOX_STDB_URL` | `ws://127.0.0.1:3000` | Where the box reaches SpacetimeDB |
| `BOX_STDB_DB` | `box` | The SpacetimeDB database name |
| `BOX_STDB` | on | `off` skips SpacetimeDB. The box works without it; the portal falls back to the log stream. |

## SpacetimeDB

`spacetimedb.service` reads one setting from `/etc/box/stdb.env`, if the file exists:

| Variable | Default | Does |
|---|---|---|
| `STDB_LISTEN` | `127.0.0.1` | The address SpacetimeDB listens on, port 3000. SpacetimeDB has no login: anyone who can reach it can read every task and answer approvals. Widen it only on a network you trust. |

## Inside a task

The box sets these in every task's environment. A task's environment holds no secrets.

| Variable | Value |
|---|---|
| `BOX_TASK` | The task's id |
| `BOX_SOCKET` | The path of the task's broker socket |
| `HOME` | `BOX_HOME/tasks/<id>/home` |
| `PATH` | `/usr/local/bin:/usr/bin:/bin` |
| `LANG` | `C.UTF-8` |
| `HTTP_PROXY`, `HTTPS_PROXY`, `http_proxy`, `https_proxy` | The box's proxy on `127.0.0.1` |
| `NO_PROXY` | `127.0.0.1` |
| `NODE_USE_ENV_PROXY` | `1` |

Droid tasks also get:

| Variable | Value |
|---|---|
| `FACTORY_API_KEY` | A placeholder. The proxy swaps in the real key on the way to Factory. With only an Anthropic key in the vault, the task user's `~/.factory/settings.json` holds a placeholder Anthropic key instead. |
| `FACTORY_API_BASE_URL` | The box's proxy |
| `FACTORY_EXTRA_CA_CERTS`, `NODE_EXTRA_CA_CERTS` | The box's own CA certificate, `BOX_HOME/relay-ca.pem` |
| `FACTORY_RIPGREP_PATH` | `/usr/bin/rg` |
| `BOX_MODEL` | Only when the box service has it set |

## The test suite

| Variable | Does |
|---|---|
| `BOX_SHELL` | The command that runs a shell on the test machine, such as `ssh my-vm`. `./demo` ships the checkout there. |
| `DEMO_LIVE` | App names, separated by commas or spaces, whose paid or slow live calls should run. Off by default, so runs are offline. `droid` turns on the real Droid steps, which spend Factory credit; `--live-droid` does the same. |
| `DEMO_LIVE_DROID_FORCE` | Runs the real Droid steps even when Factory's 5-hour limit is nearly used up. Without it, the suite turns them off at 90%. |
| `BOX_NO_DROID` | Set by the suite on the box it starts when real Droid is off: a Droid task is refused instead of spending credit. |
| `BOX_DEMO` | Set by the suite on the box it starts. Lets a test run give agents a root-owned folder, which a real box refuses. |

See [The test suite](/reference/test-suite/).

## The image build

| Variable | Default | Does |
|---|---|---|
| `BUILD_SHELL` | the maintainers' build machine | The command that runs a shell on an Ubuntu 24.04 machine with root where the image is built, such as `ssh build-vm`. Set it. |
| `BOX_SSH_KEY` | none | A public key file. Makes a debug build: adds sshd and lets that key log in as root. Release builds have no sshd. |
| `BOX_TIMEZONE` | `America/Los_Angeles` | The image's time zone. GurtOS Personal's own setup asks for one. |

## App variables

| Variable | Read by | Default | Does |
|---|---|---|---|
| `PORT` | `tracks/wallet/seller.ts` | `4021` | The port of the wallet's x402 test API |
| `FIND_CLOUD_SYNC` | The Find app | off | `1` pushes the search index to the Moss cloud copy, at most every 10 minutes and only when it changed |
| `BOX_URL` | The Jira app's Forge app, `tracks/jira/forge` | none, set it | A Forge variable, not a box setting: the public address the Jira panel calls, ending in `/t/jira`. Set with `forge variables set`. |
| `BOX_SECRET` | The Jira app's Forge app | none | An encrypted Forge variable: the same shared secret as `JIRA_BOX_SECRET` in the box's vault. Set with `forge variables set --encrypt`. |

The ASI:One app passes its own settings (`BOX_API`, `FETCH_*`) to the chat agent it starts. You do not set them.

## Related

- [Files and paths](/reference/files-and-paths/)
- [HTTP API](/reference/http-api/)
