---
title: HTTP API
description: How to reach the box's HTTP API, who may call each route, what it sends back, how errors look, and a table of every route.
---

The box's HTTP API is how the portal, a phone and your own scripts list tasks, start them, answer approvals, undo work and follow the action log. Every operation is documented in full under [HTTP API operations](/reference/api/), generated from the routes the core serves.

## Where it listens

| Address | Who can use it |
|---|---|
| `http://127.0.0.1:7700` | Processes on the box. The default. |
| `http://<BOX_LISTEN>:7700` | Anything that can reach that address and holds a paired device token, once you set [`BOX_LISTEN`](/reference/environment/). GurtOS Server from the ISO listens on every address, and its firewall admits private networks only. |
| `BOX_HOME/api.sock` | Root on the box. A Unix socket with mode `0600`, serving the same routes. |

`BOX_PORT` changes the port, and `BOX_PORT=0` turns the TCP listener off. The socket is always on.

Every route answers both with and without the `/api` prefix. These two requests are the same:

```sh
curl -s http://127.0.0.1:7700/api/tasks
curl -s http://127.0.0.1:7700/tasks
```

App routes (`/t/<app>/...`) and webhooks (`/hook/<app>/<name>`) are the exception. They answer only at those paths.

## Who may call what

The box sorts every request into one of three kinds of caller.

| Caller | How the box knows | What it may do |
|---|---|---|
| The box's own screen | The request comes over the socket, or from `127.0.0.1` or `::1`, and carries no proxy header (`X-Forwarded-For`, `Forwarded`, `X-Real-IP`, `X-Forwarded-Host` or `Tailscale-User-Login`) | Everything |
| A paired device | `Authorization: Bearer <token>`, or `?access_token=<token>` for the log stream, which a browser's `EventSource` cannot send headers to | Read, start tasks, undo and answer approvals |
| A device paired as the owner | A token from a code made with `{"owner": true}` on the box's own screen | Everything a paired device may do, plus the owner's routes below |

Anyone else gets `401` and nothing is read, started, approved or undone. Three things stay open without a token: `GET /api/health`, `POST /api/pair` (redeeming a pairing code) and the portal's own pages and assets, which hold nothing private. App routes and webhooks need a token too, except routes an app lists in `openRoutes`: the Mana app's status route and the Jira app's panel routes, which check the app's own secret.

These routes are the **owner's**. Any other caller gets `403`:

- making pairing codes, listing devices and removing them
- setup, settings, the vault, and turning apps on and off
- setting the owner, and starting a task on the owner's folders
- Keep and Undo Keep

A request relayed by a reverse proxy or a tailnet service on the box arrives from `127.0.0.1`, but it carries a proxy header, so it counts as an outside caller and needs a token.

When a paired device answers an approval, the log names the device. The `by` field in the request body is used only when the box's own screen answers.

## Requests and responses

Send JSON with `content-type: application/json` and read JSON back.

```sh
curl -s http://127.0.0.1:7700/api/tasks \
  -H 'content-type: application/json' \
  -d '{"title": "Summarise the notes", "prompt": "Read notes.md and write summary.md.", "budgetCents": 50}'
```

From another machine, send the device token:

```sh
curl -s http://192.0.2.10:7700/api/tasks -H 'authorization: Bearer <device token>'
```

## Errors

A failed request returns an error status and an object with one field:

```json
{ "error": "no workspace notes" }
```

| Status | When |
|---|---|
| 400 | Bad input, a task field the box does not know, a bad setting, or an id that does not exist (`no task t3k9x2a1b2`, `no approval ...`) |
| 401 | An outside request with no token, or with a token that is unknown or revoked |
| 403 | A route that is the owner's, called by anyone else |
| 404 | No such route, or an unknown device or app |
| 500 | An app route threw an error |

## Cross-origin requests

The portal is served from the same address as the API, so it needs no CORS. A web app served from another origin, such as a development server, needs that origin in `BOX_ORIGINS`:

```sh
BOX_ORIGINS=http://localhost:5173
```

Separate several origins with commas, or use `*` for any origin. The box then answers `OPTIONS` preflight requests and adds `access-control-allow-origin` for `GET`, `POST`, `PUT`, `PATCH`, `DELETE` and `OPTIONS`. The only request header it allows is `content-type`, so a cross-origin caller passes its token as `?access_token=`.

## The portal on the same address

The box serves the built portal from `portal/dist` (or the folder in `BOX_PORTAL`) on the API's address. A `GET` for a file returns the file. A page load (an `Accept` header with `text/html`) for any other path returns `index.html`, so the portal's own routes work. A `fetch('/tasks')` without `text/html` still reaches the API. The box's own screen is the portal at `/screen`.

## App routes

An app's routes are served at `/t/<app>/<path>`. For example, the wallet app's page is `/t/wallet/` and the shopper's store is `/t/shopper/store`. `GET /api/apps` lists the windows of the apps that are on; `GET /api/apps?all=1` lists every installed app, on or off. See [Apps and slots](/concepts/apps-and-slots/).

## Webhooks

An app that uses the `webhook` trigger serves `POST /hook/<app>/<name>`. The JSON body becomes the payload, and the app usually starts a task:

```sh
curl -s http://127.0.0.1:7700/hook/example/start \
  -H 'content-type: application/json' -d '{"title": "From a webhook"}'
```

The response is the new task, or `{"ok": true}` if the app chose not to start one. From another machine the caller needs a device token, like any other route. See [Triggers](/concepts/triggers/).

## Following the action log

Two ways to read the log as it grows:

- **Polling.** `GET /api/log?after=<seq>` returns every event after that line. Keep the last `seq` you saw.
- **Streaming.** `GET /api/log/stream` sends Server-Sent Events. It replays from `?after=<seq>` or the `Last-Event-ID` header, then streams new events live. Each event is `id: <seq>` and `data: <json>`. A `: beat` comment arrives every 25 seconds.

```sh
curl -N http://127.0.0.1:7700/api/log/stream?after=0
```

Both accept `task=<id>` to follow one task. From another machine, add `access_token=<token>` to the stream's query. The box's own screen also follows SpacetimeDB on the box: see [Live updates](/reference/live-updates/).

## Setup, settings, apps and the vault

What the first-run setup and Settings are built on. Reads of `/api/setup`, `/api/settings`, `/api/system` and `/api/apps` are open to any paired device. Every change is the owner's.

- `GET /api/system` returns the product, edition, version, build, hostname, time zone, network interfaces, box id and name, owner, start time and uptime.
- `GET /api/setup` returns `{done, finishedAt, migrated, steps, suggested}`. Until `done` is true, the box's own screen shows the setup steps. `POST /api/setup/step {"id": "network", "data": {...}}` records a step, `POST /api/setup/finish` marks setup done, and `POST /api/setup/reopen` shows it again. `data` is at most 4 KB and is for answers, never keys.
- `GET /api/settings` returns the settings, and `PATCH /api/settings` changes only the keys you send. Each change is a `note` event in the log with the old and new value. The settings and their defaults:

  | Setting | Default | Does |
  |---|---|---|
  | `approvalThresholdCents` | `10000` | A single spend above this always asks for an OK, even inside the task's budget. |
  | `defaultBudgetCents` | `0` | The budget of a task that names none. `0` means every spend asks. |
  | `networkDefault` | `none` | With `allowlist`, a task that names no hosts gets `defaultHosts`. |
  | `defaultHosts` | `[]` | Hosts for `networkDefault: allowlist`, in the task `hosts` syntax. |
  | `agentFolders` | `[]` | Personal. Folders agents may be given besides the owner's home. |
  | `quietHours` | `{enabled: false, from: "22:00", to: "07:00"}` | Read by the desktop and the phone for notifications. |
  | `logRetentionDays` | `365` | Stored for later use. |
  | `updateChannel`, `autoUpdate` | `stable`, `true` | Stored for the updater to read. |
  | `appearance` | `{theme: "system", accent: ""}` | Stored for the screens to read. |

  An unknown key or a bad value is a `400` that names the field.
- `POST /api/apps/<id>/enable` and `/disable` turn an app on or off without a reinstall. The choice survives a restart.
- `GET /api/vault` lists the names of the keys in the vault and when each was set through the API. `PUT /api/vault/<NAME> {"value": "..."}` sets or replaces one key. The log records the name, never the value. **No route returns a value.** See [Vault keys](/reference/vault-keys/).

## GurtOS Personal: the owner and real folders

:::note[Preview]
On a GurtOS Personal box the owner is a person's account. `GET /api/owner` returns `{user, uid, home}`, or `null` on a Server box. `PUT /api/owner {"user": "alice"}` makes an existing account the owner, and `DELETE /api/owner` forgets it. Once an owner is set, changing it takes the box's socket or a phone paired as the owner.

The owner can start a task on real folders: `folder`, one absolute path, or `folders`, a list of up to 10. A folder must be in the owner's home or in Settings `agentFolders`, must not belong to root, and can never be the system or the box's own state. The box links it to a workspace named `owner-<folder name>-<hash>` and the task works on a copy. When it is done, `POST /api/tasks/<id>/keep` writes its changes into the real folder, or returns `{conflicts}` if the owner changed the same files meanwhile. `POST /api/tasks/<id>/unkeep` undoes a Keep from the saved copies, and `POST /api/tasks/<id>/undo` throws the changes away. See [Keep or Undo](/guides/keep-or-undo/).
:::

## Pairing

A phone pairs once and gets its own device token:

1. The box's own screen asks for a one-time code, `POST /api/pair/start`, and shows it as a QR code. With `{"owner": true}` the phone becomes an owner device. The code works once and expires after 5 minutes.
2. The QR code opens the portal's pairing screen on the phone (`/#pair/<code>`), which redeems the code: `POST /api/pair {"code": "...", "name": "My phone"}` returns `{token, device, box}`.
3. The phone sends `Authorization: Bearer <token>` with every request, and the log records the phone's name when it answers an approval.
4. `DELETE /api/devices/<id>` stops that token. Its next request gets 401.

The older names `POST /api/pair/new`, `GET /api/pair/devices` and `POST /api/pair/devices/<id>/revoke` still work. A `GET /pair` is a portal page, not an API route.

See [Approve from your phone](/guides/approve-from-your-phone/).

## Every route

The last column says who may call the route from outside the box. The box's own screen may call all of them.

| Method and path | Does | From outside |
|---|---|---|
| [`GET /api/tasks`](/reference/api/operations/listtasks/) | List every task | Paired |
| [`POST /api/tasks`](/reference/api/operations/createtask/) | Start a task | Paired. Owner with `folder` or `folders` |
| [`GET /api/tasks/<id>`](/reference/api/operations/gettask/) | One task, its approvals and its log events | Paired |
| [`GET /api/tasks/<id>/diff`](/reference/api/operations/gettaskdiff/) | What the task changed, and a unified diff | Paired |
| [`POST /api/tasks/<id>/undo`](/reference/api/operations/undotask/) | Undo the task | Paired |
| [`POST /api/tasks/<id>/keep`](/reference/api/operations/keeptask/) | Personal: apply a done task's changes to the real folders | Owner |
| [`POST /api/tasks/<id>/unkeep`](/reference/api/operations/unkeeptask/) | Personal: undo a Keep | Owner |
| [`GET /api/owner`](/reference/api/operations/getowner/) | Personal: the owner, or `null` | Paired |
| [`PUT /api/owner`](/reference/api/operations/setowner/) | Personal: make an account the owner | Owner |
| [`DELETE /api/owner`](/reference/api/operations/clearowner/) | Personal: forget the saved owner | Owner |
| [`GET /api/approvals?state=`](/reference/api/operations/listapprovals/) | Approvals, all or in one state | Paired |
| [`POST /api/approvals/<id>`](/reference/api/operations/answerapproval/) | Approve or deny. The first answer wins. | Paired |
| [`GET /api/log?after=&task=`](/reference/api/operations/readlog/) | Log events after a cursor | Paired |
| [`GET /api/log/stream?after=&task=`](/reference/api/operations/streamlog/) | The log as Server-Sent Events | Paired |
| [`GET /api/apps`](/reference/api/operations/listapps/) | Apps that are on, or every app with `?all=1` | Paired |
| [`POST /api/apps/<id>/enable`](/reference/api/operations/enableapp/) | Turn an app on | Owner |
| [`POST /api/apps/<id>/disable`](/reference/api/operations/disableapp/) | Turn an app off | Owner |
| [`GET /api/system`](/reference/api/operations/getsystem/) | Edition, version, hostname, network, uptime | Paired |
| [`GET /api/setup`](/reference/api/operations/getsetup/) | Whether first-run setup is done | Paired |
| [`POST /api/setup/step`](/reference/api/operations/recordsetupstep/) | Record a setup step | Owner |
| [`POST /api/setup/finish`](/reference/api/operations/finishsetup/) | Mark setup done | Owner |
| [`POST /api/setup/reopen`](/reference/api/operations/reopensetup/) | Show setup again | Owner |
| [`GET /api/settings`](/reference/api/operations/getsettings/) | The settings | Paired |
| [`PATCH /api/settings`](/reference/api/operations/updatesettings/) | Change some settings | Owner |
| [`GET /api/vault`](/reference/api/operations/listvault/) | Names of the keys in the vault | Owner |
| [`PUT /api/vault/<NAME>`](/reference/api/operations/setvaultkey/) | Set one key | Owner |
| [`GET /api/health`](/reference/api/operations/gethealth/) | `{ok, startedAt, resumed, tasks, tools, spacetime}` | Open |
| [`GET /api/boxes`](/reference/api/operations/listboxes/) | This box and its peers from `BOX_PEERS` | Paired |
| [`POST /api/pair/start`](/reference/api/operations/newpairingcode/) | Make a one-time pairing code | Owner |
| [`POST /api/pair`](/reference/api/operations/redeempairingcode/) | Trade a code for a device token | Open |
| [`POST /api/pair/identity`](/reference/api/operations/vouchidentity/) | Register a live SpacetimeDB connection, so its answers count | Paired |
| [`GET /api/devices`](/reference/api/operations/listdevices/) | Paired phones | Owner |
| [`DELETE /api/devices/<id>`](/reference/api/operations/revokedevice/) | Revoke a phone | Owner |
| [`POST /hook/<app>/<name>`](/reference/api/operations/callwebhook/) | Call an app's webhook | Paired |
| `/t/<app>/...` | App routes, defined by each app | Paired, or open if the app lists the route in `openRoutes` |

## Known limits

- `GET /api/tasks/<id>` for an unknown id returns 400, not 404.
- A device token stays valid until you remove the device. There is no expiry.
- Any process on the box that connects from `127.0.0.1` without a proxy header counts as the box's own screen. Task users cannot reach the API port, because their network goes only to the box's proxy. See [Network policy](/concepts/network-policy/).
