---
title: Environment variables
description: Every environment variable the box service, its tasks, the test suite and the image build read, with what each does and its default.
---

Environment variables configure the box service itself. Secrets never go here: they belong in the vault (see [Vault keys](/docs/reference/vault-keys/)). On an installed box, set variables in a systemd drop-in for `box.service`:

```ini title="/etc/systemd/system/box.service.d/local.conf"
[Service]
Environment=BOX_LISTEN=192.0.2.10
Environment="BOX_NAME=Home box"
```

Then run `systemctl daemon-reload && systemctl restart box.service`. On a GurtOS image the drop-in lives in the system slot, which a system update replaces, so make it again after an update. [Disk layout and updates](/docs/reference/disk-layout/) lists what survives.

## The box service

| Variable | Default | Does |
|---|---|---|
| `BOX_HOME` | `/var/lib/box` | Where the action log, workspaces and tasks live. See [Files and paths](/docs/reference/files-and-paths/). |
| `BOX_VAULT` | `/etc/box/vault.env` | The vault file. It must be readable by root only, or the box will not start. |
| `BOX_PORT` | `7700` | The HTTP API's TCP port. `0` turns the TCP listener off (the Unix socket stays). `auto` takes any free port and writes it to `BOX_HOME/api.port`. |
| `BOX_LISTEN` | `127.0.0.1` | The address the HTTP API listens on. Requests from anywhere but the box itself need a paired device's token, but set this only to an address on a network you trust. Both editions from the ISO set `0.0.0.0` at each start (`box-env`), behind an inbound firewall that lets in private networks only. |
| `BOX_ORIGINS` | none | Browser origins allowed to call the API from another site, comma separated, or `*`. The portal served by the box needs none. The web app at `BOX_APP` and an app's own sandboxed page (origin `null`) are always allowed. Every call still needs a token, and a sandboxed page's token reaches only its own app. |
| `BOX_PORTAL` | `portal/dist` in the source tree | The folder of the built portal the box serves |
| `BOX_ID` | the machine's hostname | This box's id, in `GET /api/boxes`, `GET /api/system` and pairing. On the OS image the hostname is `gurt-<id>`, where `<id>` is the first 6 hex digits of the SHA-256 of the box's public key, such as `gurt-bf07fe`. |
| `BOX_NAME` | the value of `BOX_ID` | This box's name for people. The name chosen in setup wins over it. |
| `BOX_URL` | none | This box's own address for other devices, such as `http://box.local:7700`. Both editions from the ISO set it to `http://<its address>:7700` at each start. Shown in `GET /api/boxes`. With it set, `POST /api/pair/start` returns an absolute `url`, so the QR code on the box's own screen opens on a phone. The address of remote access, while it is on, takes its place. |
| `BOX_PEERS` | `[]` | Other boxes one portal can list, as a JSON array of `{"id", "name", "url", "stdb"}`. See [Add a second box](/docs/guides/add-a-second-box/). |
| `BOX_OWNER` | none | Personal (preview): the owner's Linux user. An owner set at runtime with `PUT /api/owner` (saved in `BOX_HOME/owner.json`) wins over it. On the GurtOS Personal image, `box-owner.service` runs `personal/install.sh`, which writes it to `box.service.d/personal.conf` for the first person in the `sudo` group once the desktop's own setup has made that account. Leave it unset on a Server box. |
| `BOX_EDITION` | `personal` with an owner, else `server` | The edition `GET /api/system` reports: `server`, `personal` or `business`. `business` also turns the Business edition on the first time the box starts, until its saved setting says otherwise. |
| `BOX_APPROVAL_WAIT_MS` | `150000` | How long one `/ask` or over-budget `/call` waits for an answer before returning "pending, call again". Keep it under the worker's tool-call timeout. |
| `BOX_MODEL` | `claude-sonnet-5-5` | The model a Droid task uses when it names none: `haiku`, `sonnet`, `opus` or a model id that starts with `claude-`. The task records the exact id it ran on. |
| `BOX_REVIEW` | on | `off` switches off the second look, the Haiku check of risky agent steps in Droid tasks. |
| `BOX_TASK_DISK_CAP` | 5 GiB | How many bytes a task may write to its own copy before the box stops and undoes it. An app's own permission can set a different limit; this variable wins over both. |
| `BOX_PROXY_PORT` | `8888` | The task proxy's port. `auto` picks a free port in 8800 to 8887. It must stay in 8800 to 8899, the range the firewall lets tasks reach. |
| `BOX_SETUP_PORT` | `7701` | The port of the setup channel, which opens on every address while setup from another computer is on and closes within two hours. The image's firewall lets it in from private networks only. `auto` takes any free port. |
| `BOX_STDB_URL` | `ws://127.0.0.1:3000` | Where the box reaches SpacetimeDB |
| `BOX_STDB_DB` | `box` | The SpacetimeDB database name |
| `BOX_STDB` | on | `off` skips SpacetimeDB. The box works without it; the portal falls back to the log stream. |
| `BOX_RELAY` | `https://box.gurtos.com` | The relay a box uses for remote access when its owner has not chosen another in Settings, Remote access. A hosted relay is not running during the preview, so set this to a relay you run: see [Self-host](/docs/guides/self-host/). |
| `BOX_APP` | `https://app.gurtos.com` | The web app the box lets call its API. The app is up, but it reaches a box only at an https address that a relay gives it. |
| `BOX_FRPC`, `BOX_CADDY` | `/usr/local/bin/frpc`, `/usr/local/bin/caddy` | The tunnel and certificate programs remote access starts |
| `BOX_ACME_CA` | none | A certificate authority address, for tests. Leave it unset to use Let's Encrypt. |

## SpacetimeDB

`spacetimedb.service` reads one setting from `/etc/box/stdb.env`, if the file exists:

| Variable | Default | Does |
|---|---|---|
| `STDB_LISTEN` | `127.0.0.1` | The address SpacetimeDB listens on, port 3000. SpacetimeDB has no login: anyone who can reach it can read every task and answer approvals. Widen it only on a network you trust. |

## Inside a task

The box sets these in every task's environment. A task's environment holds no secrets. The two `AWS_` variables are decoys: if their values leave the task, the box stops and undoes it.

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
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | A decoy key pair, different for each task and never real |

Droid tasks also get:

| Variable | Value |
|---|---|
| `FACTORY_API_KEY` | A placeholder. The proxy swaps in the real key on the way to Factory. With only an Anthropic key in the vault, the task user's `~/.factory/settings.json` holds a placeholder Anthropic key instead. |
| `FACTORY_API_BASE_URL` | The box's proxy |
| `FACTORY_EXTRA_CA_CERTS`, `NODE_EXTRA_CA_CERTS` | The box's own CA certificate, `BOX_HOME/relay-ca.pem` |
| `FACTORY_RIPGREP_PATH` | `/usr/bin/rg` |
| `BOX_MODEL` | The task's model id, or `custom:<id>` when the task runs on your own Anthropic key |
| `BOX_REVIEW` | Only when the box service has it set |

## The test suite

| Variable | Does |
|---|---|
| `BOX_SHELL` | The command that runs a shell on the test machine, such as `ssh my-vm`. `./demo` ships the checkout there. Without it `./demo` uses the machine named `default` in the machines file. |
| `GURTOS_MACHINES` | The machines file for `./demo <name>` and `./deploy <name>`, one `name=command` per line. Default `~/.config/gurtos/machines`. |
| `DEMO_ONLY` | One app's name (or a core group such as `personal`): `./demo` runs only that step. |
| `DEMO_LIVE` | App names, separated by commas or spaces, whose paid or slow live calls should run. Off by default, so runs are offline. `droid` turns on the real Droid steps, which spend Factory credit; `--live-droid` does the same. |
| `DEMO_LIVE_DROID_FORCE` | Runs the real Droid steps even when Factory's 5-hour limit is nearly used up. Without it, the suite turns them off at 90%. |
| `BOX_NO_DROID` | Set by the suite on the box it starts when real Droid is off: a Droid task is refused instead of spending credit. `core/setup.sh` also reads it: `1` installs everything but Droid, and the image build sets it. |
| `STDB_ROOT` | Read by `core/setup.sh` only, to try its SpacetimeDB step somewhere else. It installs the pinned SpacetimeDB files under that folder instead of `/root/.local`, and does not link `/usr/local/bin/spacetime`. |
| `BOX_DEMO` | Set by the suite on the box it starts. With it set, agents may work on a root-owned folder, which a real box refuses. A new box keeps every app on, and a key that starts with `demo-` is accepted without calling Anthropic. |
| `BOX_HOSTS` | A JSON object such as `{"shop.demo":"127.0.0.1"}` of host names the task proxy resolves itself. For tests only. |

See [The test suite](/docs/reference/test-suite/).

## The image build

| Variable | Default | Does |
|---|---|---|
| `BUILD_SHELL` | none, so the build runs on this machine | The command that runs a shell on an Ubuntu 24.04 machine where the image is built, such as `ssh build-vm`. The machine needs `sudo`. Without it `image/build` runs here, and refuses unless this is Ubuntu 24.04. |
| `BOX_VERSION` | today's date, `YYYY.MM.DD` | The version people see in `os-release` and the disc menu, such as `0.1.0-preview`. Letters, digits and `. + ~ -` only. |
| `BOX_UPDATE_KEY` | a key the build machine makes once | An Ed25519 private key file (PEM) that signs updates. The image trusts its public half. |
| `BOX_SSH_KEY` | none | A public key file. Makes a debug build: adds sshd and lets that key log in as root. Release builds have no sshd. |
| `BOX_TIMEZONE` | `UTC` | The image's time zone. GurtOS Personal's own setup asks for one. |
| `BOX_TEST_DISC_HOST` | none | An ssh host name. With a `BUILD_SHELL` of `ssh <host> ...`, the build copies the disc to `~/box-os/` on that host and checks its checksum. |
| `BOX_NO_VOICE` | `0` | `1` makes `personal/install.sh` skip the local speech model. The image build sets it, and the image fetches the model at first boot. |

## Clients

These are read by programs that talk to a box, not by the box.

| Variable | Read by | Default | Does |
|---|---|---|---|
| `BOX_URL` | `core/claude-mcp.ts` (Claude on your own computer), the GurtOS Personal desktop layer | `http://127.0.0.1:7700` | The box to talk to |
| `BOX_TOKEN` | `core/claude-mcp.ts` | none | A paired device's token. Not needed on the box itself. |
| `BOX_MCP_ANSWER` | `core/claude-mcp.ts` | off | `on` adds the `box_answer_approval` tool, so Claude can approve or deny a waiting request. Without it Claude can read requests but a person answers them. The answer is logged under the paired device's name. |
| `BOX_SETUP_CODE`, `BOX_SETUP_NAME` | `core/claude-mcp.ts` | none, `Claude (setup)` | Instead of a token, the code on a new computer's screen, and the device name it gets |
| `GURTOS_BOX`, `GURTOS_TOKEN` | `tracks/factory/gurtos-exec.ts` | `http://127.0.0.1:7700`, none | The same as its `--box` and `--token` options |

## Relay variables

A relay you run reads these. See [Self-host](/docs/guides/self-host/).

| Variable | Default | Does |
|---|---|---|
| `RELAY_DOMAIN` | `box.gurtos.com` | The domain boxes get names under. Set it to your own. |
| `RELAY_STATE` | `/var/lib/gurtos-relay` | Where the relay keeps its names, secrets and keys |
| `RELAY_TUNNEL_PORT` | `7000` | The port boxes connect their tunnels to. The relay announces it to boxes. |
| `RELAY_PLUGIN_PORT` | `7400` | The loopback port where the tunnel server asks the relay to allow a box |
| `RELAY_API_PORT` | `7401` | The port of the relay's name and push API |

## App variables

| Variable | Read by | Default | Does |
|---|---|---|---|
| `BOX_STDB_WAIT_MS` | The Spacetime app | `10000` | How long it waits for SpacetimeDB to answer before it reports the live state as unreachable |
| `BOX_FLEET_URL` | The Spacetime app's fleet view | `https://maincloud.spacetimedb.com` | The SpacetimeDB host that receives fleet counts. The fleet view is off by default. When the owner turns it on, the box reports its id, name, edition, version and task counts, never a prompt, file or key. |
| `BOX_FLEET_DB` | The Spacetime app's fleet view | `gurtos-fleet` | The database on that host. Point both variables at your own SpacetimeDB to keep the counts to yourself. |
| `PORT` | `tracks/wallet/seller.ts` | `4021` | The port of the wallet's x402 test API |
| `BOX_PUBLIC_URL` | The Wallet app | the request's own host | The public address the wallet's sell routes put in a payment request |
| `FIND_CLOUD_SYNC` | The Find app | off | `1` pushes the search index to the Moss cloud copy, at most every 10 minutes and only when it changed |
| `ELASTIC_VERIFY_MS` | The Elastic app | `600000` | How often it checks the log against Elastic's copy |
| `ELASTIC_REQUESTS_MS` | The Elastic app | `5000` | How often it reads requests left in Elastic |
| `FACTORY_GITHUB_EVERY_MS` | The Factory app | `120000` | How often it looks for GitHub issues labelled `droid` |
| `FACTORY_GITHUB_API` | The Factory app | `https://api.github.com` | The GitHub API address, for GitHub Enterprise or a test |
| `VULTR_BACKUP_EVERY_MS` | The Vultr app | `86400000` | How often it backs up to Vultr Object Storage |
| `BOX_URL` | The Jira app's Forge app, `tracks/jira/forge` | none, set it | A Forge variable, not a box setting: the public address the Jira panel calls, ending in `/t/jira`. Set with `forge variables set`. |
| `BOX_SECRET` | The Jira app's Forge app | none | An encrypted Forge variable: the same shared secret as `JIRA_BOX_SECRET` in the box's vault. Set with `forge variables set --encrypt`. |
| `GURTOS_AGENT_ACCOUNT` | The Jira app's Forge app | none | A Forge variable: the Atlassian account id of the agent. An issue assigned to it starts a task. Without it, adding the label `gurtos-agent` starts one. |

The ASI:One app passes its own settings (`BOX_API`, `FETCH_*`) to the chat agent it starts. You do not set them.

## Related

- [Files and paths](/docs/reference/files-and-paths/)
- [HTTP API](/docs/reference/http-api/)
