---
title: HTTP API
description: How to reach the box's HTTP API, who may call each route, what it sends back, how errors look, and a table of every route.
---

The box's HTTP API is how the portal, a phone and your own scripts list tasks, start them, answer approvals, undo work and follow the action log. Every operation is documented in full under [HTTP API operations](/docs/reference/api/), generated from the routes the core serves.

## Where it listens

| Address | Who can use it |
|---|---|
| `http://127.0.0.1:7700` | Processes on the box. The default. |
| `http://<BOX_LISTEN>:7700` | Anything that can reach that address and holds a paired device token, once you set [`BOX_LISTEN`](/docs/reference/environment/). GurtOS Server from the ISO listens on every address, and its firewall admits private networks only. |
| `BOX_HOME/api.sock` | Root on the box. A Unix socket with mode `0600`, serving the same routes. |

`BOX_PORT` changes the port, and `BOX_PORT=0` turns the TCP listener off. The socket is always on.

Every route answers both with and without the `/api` prefix. These two requests are the same:

```sh
curl -s http://127.0.0.1:7700/api/tasks
curl -s http://127.0.0.1:7700/tasks
```

App routes (`/t/<app>/...`) and webhooks (`/hook/<app>/<name>`) are the exception. They answer only at those paths.

## Who may call what

The box sorts every request into one of these kinds of caller.

| Caller | How the box knows | What it may do |
|---|---|---|
| The box's own screen | The request comes over the socket. Or it comes from `127.0.0.1` or `::1` with no proxy header (`X-Forwarded-For`, `Forwarded`, `X-Real-IP`, `X-Forwarded-Host` or `Tailscale-User-Login`), a `Host` of `127.0.0.1`, `localhost` or `[::1]`, and no `Origin` except the box's own address on the API port | Everything |
| A helper on the box | The same, but the connecting process runs as `nobody` or as a task user | Read, start tasks and answer approvals. Never the owner's routes below |
| A paired device | `Authorization: Bearer <token>`, or `?access_token=<token>` for the log stream, which a browser's `EventSource` cannot send headers to | Read, start tasks, undo and answer approvals |
| A device paired as the owner | A token from a code made with `{"owner": true}` on the box's own screen | Everything a paired device may do, plus the owner's routes below |
| An app's window | A token from `POST /api/apps/<id>/window`, which starts with `w` | Only that app's own routes, `GET /api/tasks`, `GET /api/tasks/<id>`, `GET /api/approvals`, and answers to that app's own requests. See [App routes](#app-routes) |

A web page from another site, opened in a browser on the box, also arrives from `127.0.0.1`. Its `Origin` (or, for a page that points its own name at `127.0.0.1`, its `Host`) gives it away, so it needs a token. So does a page that another program on the box serves, such as an agent's dev server on `localhost:8000`, unless its origin is named in [`BOX_ORIGINS`](/docs/reference/environment/). A `*` in `BOX_ORIGINS` never counts as the box's own screen.

Anyone else gets `401` and nothing is read, started, approved or undone. These stay open without a token:

- `GET /api/health`, which then answers only `{ok, startedAt, paused}`.
- `POST /api/pair`, redeeming a pairing code.
- The work-account sign-in: `GET /api/sso`, `GET /api/sso/start`, `GET /api/sso/callback` and `POST /api/sso/redeem`.
- The portal's own pages and assets, which hold nothing private.

App routes and webhooks need a token too, except routes an app lists in `openRoutes`. A few apps do (Mana, Jira, Apify, Receipts, and Wallet's sell routes). Each checks its own secret, and the owner can turn that off per app in Settings, Permissions.

These routes are the **owner's**. Any other caller gets `403`:

- making pairing codes, listing devices and removing other devices
- setup (steps, finish, reopen, the doctor and stopping the setup port), settings, app permissions, the vault, and turning apps on and off
- setting the owner, and starting a task on the owner's folders
- Keep and Undo Keep, and Undo of a task that was kept
- turning remote access on or off, choosing the relay, and Quick Start (`GET` and stop)

On a GurtOS Business box, a device paired for a person acts as that person, and their role limits what works. People, the policy and the kill switch are for an admin or the owner, the audit is for an auditor, an admin or the owner, and an auditor's requests other than `GET` are refused with `403`. See [Turn on Business](/docs/guides/turn-on-business/).

A request relayed by a reverse proxy or a tailnet service on the box arrives from `127.0.0.1`, but it carries a proxy header, so it counts as an outside caller and needs a token.

When a paired device answers an approval, the log names the device. The `by` field in the request body is used only when the box's own screen answers.

## Requests and responses

Send JSON with `content-type: application/json` and read JSON back. A body that is not valid JSON is a `400`. A body over 10 MB is a `413`, and over 1 MB on the routes that need no token (pairing, the work-account sign-in, an app's open routes). The box stops reading it.

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
| 401 | An outside request with no token, or with a token that is unknown or revoked. A window token that expired. |
| 403 | A route that is the owner's (or a Business admin's), called by anyone else. An app's window asking for anything outside its own routes. |
| 404 | No such route, or an unknown device, app or person |
| 409 | The request clashes with the box's state: Undo of a kept task after you edited a kept file, a relay change while remote access is on, a remote access name that is taken, setup that is already finished |
| 413 | A request body over the size cap |
| 429 | Too many wrong pairing codes from one address, a Watch token made more than 3 times an hour, or a test push within 10 seconds of the last |
| 500 | An app route threw an error |
| 502 | The relay could not be reached, or sent an answer the box does not accept |

## Cross-origin requests

The portal is served from the same address as the API, so it needs no CORS. The GurtOS web app's origin (`BOX_APP`, `https://app.gurtos.com` by default) is always allowed. The hosted web app can only reach a box at an https address that a relay gives it. A web app served from another origin, such as a development server, needs that origin in `BOX_ORIGINS`:

```sh
BOX_ORIGINS=http://localhost:5173
```

Separate several origins with commas, or use `*` for any origin. For an allowed origin the box answers `OPTIONS` preflight requests with `204` and adds `access-control-allow-origin` for `GET`, `POST`, `PUT`, `PATCH`, `DELETE` and `OPTIONS`. The origin `null`, which a sandboxed app page has, is allowed too. The request headers it allows are `content-type`, `authorization` and `x-box-person`. A token is required either way. A browser `EventSource` cannot send headers, so it passes the token as `?access_token=`.

## The portal on the same address

The box serves the built portal from `portal/dist` (or the folder in `BOX_PORTAL`) on the API's address. A `GET` for a file returns the file. A page load (an `Accept` header with `text/html`) for any other path returns `index.html`, so the portal's own routes work. A `fetch('/tasks')` without `text/html` still reaches the API. The box's own screen is the portal at `/screen`. Portal files other than `index.html` carry `access-control-allow-origin: *`, so a sandboxed app page can load `/kit/gurtos.js` as a module.

## App routes

An app's routes are served at `/t/<app>/<path>`. For example, the wallet app's page is `/t/wallet/` and the shopper's store is `/t/shopper/store`. The box tells the route who is calling in an `x-box-caller` header that the caller cannot set: `screen`, `owner`, `device:<id>`, `service` (a helper on the box) or `none` (an open route reached with no token). `GET /api/apps` lists the windows of the apps that are on; `GET /api/apps?all=1` lists every installed app, on or off. See [Apps and slots](/docs/concepts/apps-and-slots/).

### App pages are sandboxed

Every HTML or XML answer from an app route (SVG included) carries `Content-Security-Policy: sandbox` with scripts, forms, popups, dialogs, downloads and links a person clicks, and never `allow-same-origin`. The page has no origin of its own. A bug in one app's page cannot act as the box's screen, reach into the portal around it, or read the opener's token or storage, so a page keeps its state in memory.

The portal opens a page in two steps:

1. `POST /api/apps/<id>/window` returns `{token, expiresAt}`. The box's own screen, or any paired device, may call it. The app must be on (`404` if not).
2. The page opens at `/t/<id>/?access_token=<token>`.

A window token lasts 12 hours, or until the device that opened it is removed. It reaches only:

- the app's own routes, `/t/<id>` and everything under it, as whoever opened the window
- `GET /api/tasks` and `GET /api/tasks/<task id>`
- `GET /api/approvals`
- `POST /api/approvals/<id>` for a request of that app's own tasks

Anything else is `403`. An approval that belongs to another app's task comes back as `403` with `{error, needs: "shell", task}`, and the portal opens that task's window so a person answers there. The box puts a short script at the top of each HTML page that adds the token to the page's own `fetch` calls, and `/kit/gurtos.js` does the same for links, forms and `EventSource`. A request the browser makes by itself (a module script, an image) carries no header, so add `location.search` to its address. Passkeys need a real origin, so they do not work inside a window.

## Webhooks

An app that uses the `webhook` trigger serves `POST /hook/<app>/<name>`. The JSON body becomes the payload, and the app usually starts a task:

```sh
curl -s http://127.0.0.1:7700/hook/example/start \
  -H 'content-type: application/json' -d '{"title": "From a webhook"}'
```

The response is the new task, or `{"ok": true}` if the app chose not to start one. A handler that throws, or a body that is not JSON, is a `400`. From another machine the caller needs a device token, like any other route. See [Triggers](/docs/concepts/triggers/).

## Following the action log

Two ways to read the log as it grows:

- **Polling.** `GET /api/log?after=<seq>` returns every event after that line. Keep the last `seq` you saw.
- **Streaming.** `GET /api/log/stream` sends Server-Sent Events. It replays from `?after=<seq>` or the `Last-Event-ID` header (the header wins), then streams new events live. Each event is `id: <seq>` and `data: <json>`. A `: beat` comment arrives every 25 seconds.

```sh
curl -N http://127.0.0.1:7700/api/log/stream?after=0
```

Both accept `task=<id>` to follow one task. From another machine, add `access_token=<token>` to the stream's query. The box's own screen also follows SpacetimeDB on the box: see [Live updates](/docs/reference/live-updates/).

## Setup, settings, apps and the vault

What the first-run setup and Settings are built on. Reads of `/api/setup`, `/api/settings`, `/api/system`, `/api/update` and `/api/apps` are open to any paired device. Every change is the owner's.

- `GET /api/system` returns the product, edition, edition name, version, build, hostname, time zone, network (`online`, interfaces), box id and name, owner, `model` (`{ready, via}`), `droid` (where the Droid download stands), `paused`, start time and uptime. A Business box adds `company`.
- `GET /api/setup` returns `{model, droid, modelKey, done, finishedAt, migrated, steps, suggested, channel}`. `modelKey` is false until the vault holds `ANTHROPIC_API_KEY` or `FACTORY_API_KEY`. Until `done` is true, the box's own screen shows the setup steps. `POST /api/setup/step {"id": "network", "data": {...}}` records a step, `POST /api/setup/finish` marks setup done, and `POST /api/setup/reopen` shows it again. `data` is at most 4 KB and is for answers, never keys. `suggested` lists the usual step ids in order, and the box accepts any id.
- `GET /api/setup/doctor` lists what a new computer still lacks: `{ok, missing: [{id, text}]}`. `POST /api/setup/code` is for setting up from another computer. It works only on the box's own screen, while setup is open. It returns a one-time code valid for 30 minutes and opens a setup port (7701, or `BOX_SETUP_PORT`), where the other computer pairs with `kind: "setup"`. The port is plain HTTP, and the image's firewall opens it to private networks only, as it does port 7700. Set a cloud computer up from its provider's console, or over a private network such as Tailscale. `POST /api/setup/stop` closes the port. Finishing setup closes it too, and a setup token ends after two hours at most. See `AGENT-SETUP.md` in the source tree.
- `GET /api/settings` returns the settings, and `PATCH /api/settings` changes only the keys you send. Each change is a `note` event in the log with the old and new value. The settings and their defaults:

  | Setting | Default | Does |
  |---|---|---|
  | `approvalThresholdCents` | `500` | A single spend above this always asks for an OK, even inside the task's budget. |
  | `defaultBudgetCents` | `100` | The budget of a task that names none. `0` means every spend asks. |
  | `watchLimitCents` | `2500` | The most an Apple Watch token may approve. `0` means a Watch may only deny. |
  | `networkDefault` | `none` | With `allowlist`, a task that names no hosts gets `defaultHosts`. |
  | `defaultHosts` | `[]` | Hosts for `networkDefault: allowlist`, in the task `hosts` syntax. |
  | `agentFolders` | `[]` | Personal. Folders agents may be given besides the owner's home. |
  | `quietHours` | `{enabled: false, from: "22:00", to: "07:00"}` | Holds pushes back, and the desktop and the phone read it for notifications. |
  | `paused` | `false` | The kill switch. While true no task starts and running ones hold before their next step. The box also sets it at start when `permissions.json` cannot be read (see Known limits). |
  | `logRetentionDays` | `365` | Stored only. The log is kept forever. |
  | `updateChannel`, `autoUpdate` | `stable`, `true` | Stored only. Nothing reads them yet. |
  | `appearance` | `{theme: "system", accent: ""}` | Stored for the screens to read. |

  An unknown key or a bad value is a `400` that names the field.
- `GET /api/update` returns the version and build, then how this computer updates: `install` (`image`, `disc` or `checkout`), `slots`, `automatic` (always `false`) and, on an installed image, the booted `slot`, the `state` (`current`, `ready`, `trial`, `rolledBack` or `unknown`), `default`, `other` and `trial`. See [Update and roll back](/docs/guides/update-and-roll-back/).
- `GET /api/apps` lists the apps. `POST /api/apps/<id>/window` gives an app's page its token. `POST /api/apps/<id>/enable` and `/disable` turn an app on or off without a reinstall. The choice survives a restart. A new box has only the model app on.
- `GET /api/permissions` lists, for each app, what it asks to do and what the owner allowed. `PUT /api/permissions/<app>` takes `deny` (a list of item ids), `perDayCents` (whole cents, or `null` for no daily limit) and `diskBytes` (at least 1 MB, or `null` for the 5 GB default).
- `GET /api/vault` lists the names of the keys in the vault and when each was set through the API. `PUT /api/vault/<NAME> {"value": "..."}` sets or replaces one key. An Anthropic key is checked with a free call first, and one that Anthropic rejects is a `400` and is not saved. The log records the name, never the value. **No route returns a value.** See [Vault keys](/docs/reference/vault-keys/).

## GurtOS Personal: the owner and real folders

:::note[Preview]
On a GurtOS Personal box the owner is a person's account. `GET /api/owner` returns `{user, name, uid, home}`, or `null` on a Server box. `PUT /api/owner {"user": "alice"}` makes an existing account the owner, and `DELETE /api/owner` forgets it. Once an owner is set, changing it takes the box's socket or a phone paired as the owner.

The owner can start a task on real folders: `folder`, one absolute path, or `folders`, a list of up to 10. A folder must be in the owner's home or in Settings `agentFolders`, must not belong to root, and can never be the system or the box's own state. The box links it to a workspace named `owner-<folder name>-<hash>` and the task works on a copy. When it is done, `POST /api/tasks/<id>/keep` writes its changes into the real folder, or returns `{conflicts}` if the owner changed the same files meanwhile. Keep is all or nothing. `POST /api/tasks/<id>/unkeep` undoes a Keep from the saved copies, or changes nothing and returns `{conflicts}` if you edited a kept file since. `POST /api/tasks/<id>/undo` throws the changes away. Undo of a kept task takes its changes out of your folder first (owner only), and answers `409` and leaves your folder as it is if you edited a kept file. See [Keep or Undo](/docs/guides/keep-or-undo/).
:::

## GurtOS Business

:::note[Preview]
These routes work on any box and mean something once Business is on. `GET /api/business` returns the settings and the policy's rules (never a secret), and `PUT /api/business` changes `on`, `company`, `policy`, `seats`, `sso` and `shadow`. Only the owner turns Business on or off. `GET /api/people`, `POST /api/people`, `DELETE /api/people/<id>` and `POST /api/people/<id>/pair` manage people and pair a phone for one. `GET /api/me` is the caller's view: `owner`, `edition`, `company`, `paused`, `person`, `directory`, `waiting`, `stuck` and `requests`. `GET /api/audit` and `GET /api/audit.csv` return the audit rows. `GET /api/pause`, `POST /api/pause` and `POST /api/resume` are the kill switch. The box's own screen acts as the owner, or as a person when it sends `x-box-person: <id>`. Work-account sign-in lets at most 200 sign-ins wait at once and 10 from one address. See [Turn on Business](/docs/guides/turn-on-business/).
:::

## Remote access and push notifications

:::note
A hosted relay is not running during the preview. The code still defaults `BOX_RELAY` to `https://box.gurtos.com`. To use remote access, point the box at a relay you run with `BOX_RELAY` or `PUT /api/remote/relay`. See [Run your own relay](/docs/guides/self-host/) and [Reach your box from anywhere](/docs/guides/reach-your-box-from-anywhere/).
:::

- `GET /api/remote` returns `{enabled, name, url, state, error?, relay}`. `state` is `off`, `starting`, `connected` or `error`, and `relay` is the relay's host. The box checks its address again at most every 30 seconds.
- `POST /api/remote {"name": "rosa"}` (owner) enrolls the name at the relay, starts the tunnel and the certificate, and returns `state: starting`. Poll `GET /api/remote` until `connected`. A name is 3 to 30 lowercase letters, digits and hyphens. `GET /api/remote/name/<name>` (owner) asks the relay whether a name is free. `DELETE /api/remote` (owner) stops both and releases the name.
- `GET /api/remote/relay` returns `{url, default, custom}`. `PUT /api/remote/relay {"url": "https://relay.example.com"}` (owner) chooses a relay. It must be an `https://` host name with no path, query or login, and it must resolve only to public addresses. It answers `409` while remote access is on. `{"url": null}` goes back to the default.
- `GET /api/push`, `PUT /api/push` and `DELETE /api/push` show, set and clear the calling phone's push subscription. `PUT` takes `{subscription, key}` from a paired device only. `POST /api/push/test` sends that phone a test push, or answers `502` with a sentence when it could not be sent, for example because the relay is not answering. Pushes go through the relay, so they need remote access on.
- Quick Start sets up a new computer from one you own: `POST /api/quickstart/start` on the new computer's own screen during setup, `GET /api/quickstart` and `POST /api/quickstart/stop` for the owner, and `POST /api/quickstart/send` and `POST /api/quickstart/send/<id>` from an owner phone on the source computer.

## Pairing

A phone pairs once and gets its own device token:

1. The box's own screen asks for a one-time code, `POST /api/pair/start`, and shows it as a QR code. With `{"owner": true}` the phone becomes an owner device. The code works once and expires after 5 minutes.
2. The response holds `url`, which opens the GurtOS web app with the code, and `boxUrl`, the box's own pairing page (`<address>/pair#<code>`). `boxUrl` is there only when `BOX_URL` or remote access gives the box an address. On the home network, with remote access off, the portal's QR code opens `boxUrl`.
3. The phone's pairing screen redeems the code: `POST /api/pair {"code": "...", "name": "My phone"}` returns `{token, device, box, edition}`. `kind` may be `web` (the default), `iphone` or `mac`. It is never used for a security decision.
4. The phone sends `Authorization: Bearer <token>` with every request, and the log records the phone's name when it answers an approval.
5. `DELETE /api/devices/<id>` stops that token. Its next request gets 401. A paired device can also stop its own with `DELETE /api/pair/self`.

Wrong codes are limited to 5 a minute from one address and 60 a minute overall, then `429`. The address is the one a proxy on the box put last in `X-Forwarded-For`.

An `iphone` device can ask for a separate token for its Apple Watch with `POST /api/devices/self/watch`. The Watch token is never the owner's. It approves only up to Settings `watchLimitCents`, never a Business or Shopper request, and may always deny.

The older names `POST /api/pair/new`, `GET /api/pair/devices` and `POST /api/pair/devices/<id>/revoke` still work. A `GET /pair` is a portal page, not an API route.

See [Approve from your phone](/docs/guides/approve-from-your-phone/).

## Every route

The last column says who may call the route from outside the box. The box's own screen may call all of them.

| Method and path | Does | From outside |
|---|---|---|
| [`GET /api/tasks`](/docs/reference/api/operations/listtasks/) | List every task | Paired |
| [`POST /api/tasks`](/docs/reference/api/operations/createtask/) | Start a task | Paired. Owner with `folder` or `folders` |
| [`GET /api/tasks/<id>`](/docs/reference/api/operations/gettask/) | One task, its approvals and its log events | Paired |
| [`GET /api/tasks/<id>/diff`](/docs/reference/api/operations/gettaskdiff/) | What the task changed, and a unified diff. `?at=<seq>` shows it as of one event. | Paired |
| [`GET /api/tasks/<id>/replay`](/docs/reference/api/operations/gettaskreplay/) | The events that changed files, for stepping through a task | Paired |
| [`POST /api/tasks/<id>/undo`](/docs/reference/api/operations/undotask/) | Undo the task | Paired. Owner for a kept task |
| [`POST /api/tasks/<id>/keep`](/docs/reference/api/operations/keeptask/) | Personal: apply a done task's changes to the real folders | Owner |
| [`POST /api/tasks/<id>/unkeep`](/docs/reference/api/operations/unkeeptask/) | Personal: undo a Keep | Owner |
| [`GET /api/owner`](/docs/reference/api/operations/getowner/) | Personal: the owner, or `null` | Paired |
| [`PUT /api/owner`](/docs/reference/api/operations/setowner/) | Personal: make an account the owner | Owner |
| [`DELETE /api/owner`](/docs/reference/api/operations/clearowner/) | Personal: forget the saved owner | Owner |
| [`GET /api/approvals?state=`](/docs/reference/api/operations/listapprovals/) | Approvals, all or in one state. `?for=me` is the Business "waiting for me" list. | Paired |
| [`POST /api/approvals/<id>`](/docs/reference/api/operations/answerapproval/) | Approve or deny. The first answer wins. | Paired |
| [`GET /api/log?after=&task=`](/docs/reference/api/operations/readlog/) | Log events after a cursor | Paired |
| [`GET /api/log/stream?after=&task=`](/docs/reference/api/operations/streamlog/) | The log as Server-Sent Events | Paired |
| [`GET /api/apps`](/docs/reference/api/operations/listapps/) | Apps that are on, or every app with `?all=1` | Paired |
| [`POST /api/apps/<id>/window`](/docs/reference/api/operations/openappwindow/) | A token for an app's page | Paired |
| [`POST /api/apps/<id>/enable`](/docs/reference/api/operations/enableapp/) | Turn an app on | Owner |
| [`POST /api/apps/<id>/disable`](/docs/reference/api/operations/disableapp/) | Turn an app off | Owner |
| [`GET /api/permissions`](/docs/reference/api/operations/listpermissions/) | What each app may do, and what the owner allowed | Owner |
| [`PUT /api/permissions/<app>`](/docs/reference/api/operations/setpermissions/) | Change one app's permissions | Owner |
| [`GET /api/system`](/docs/reference/api/operations/getsystem/) | Edition, version, hostname, network, uptime | Paired |
| [`GET /api/update`](/docs/reference/api/operations/getupdate/) | How this computer updates, and where an update stands | Paired |
| [`GET /api/setup`](/docs/reference/api/operations/getsetup/) | Whether first-run setup is done | Paired |
| [`POST /api/setup/step`](/docs/reference/api/operations/recordsetupstep/) | Record a setup step | Owner |
| [`POST /api/setup/finish`](/docs/reference/api/operations/finishsetup/) | Mark setup done | Owner |
| [`POST /api/setup/reopen`](/docs/reference/api/operations/reopensetup/) | Show setup again | Owner |
| [`GET /api/setup/doctor`](/docs/reference/api/operations/setupdoctor/) | What a new computer still lacks | Owner |
| [`POST /api/setup/code`](/docs/reference/api/operations/makesetupcode/) | A one-time code for setting up from another computer | Box's own screen only |
| [`POST /api/setup/stop`](/docs/reference/api/operations/stopsetupport/) | Close the setup port | Owner |
| [`GET /api/settings`](/docs/reference/api/operations/getsettings/) | The settings | Paired |
| [`PATCH /api/settings`](/docs/reference/api/operations/updatesettings/) | Change some settings | Owner |
| [`GET /api/vault`](/docs/reference/api/operations/listvault/) | Names of the keys in the vault | Owner |
| [`PUT /api/vault/<NAME>`](/docs/reference/api/operations/setvaultkey/) | Set one key | Owner |
| [`GET /api/health`](/docs/reference/api/operations/gethealth/) | `{ok, startedAt, paused}`, and more for a paired caller | Open |
| [`GET /api/boxes`](/docs/reference/api/operations/listboxes/) | This box and its peers from `BOX_PEERS` | Paired |
| [`POST /api/pair/start`](/docs/reference/api/operations/newpairingcode/) | Make a one-time pairing code | Owner |
| [`POST /api/pair`](/docs/reference/api/operations/redeempairingcode/) | Trade a code for a device token | Open |
| [`POST /api/pair/identity`](/docs/reference/api/operations/vouchidentity/) | Register a live SpacetimeDB connection, so its answers count | Paired |
| [`DELETE /api/pair/self`](/docs/reference/api/operations/forgetself/) | A paired device removes itself | Paired |
| [`POST /api/devices/self/watch`](/docs/reference/api/operations/makewatchtoken/) | An iPhone asks for its Apple Watch's token | Paired iPhone |
| [`GET /api/devices`](/docs/reference/api/operations/listdevices/) | Paired phones | Owner |
| [`DELETE /api/devices/<id>`](/docs/reference/api/operations/revokedevice/) | Revoke a phone | Owner |
| [`GET /api/remote`](/docs/reference/api/operations/getremote/) | Remote access state | Paired |
| [`POST /api/remote`](/docs/reference/api/operations/enableremote/) | Turn remote access on | Owner |
| [`DELETE /api/remote`](/docs/reference/api/operations/disableremote/) | Turn remote access off | Owner |
| [`GET /api/remote/name/<name>`](/docs/reference/api/operations/checkremotename/) | Is a name free at the relay | Owner |
| [`GET /api/remote/relay`](/docs/reference/api/operations/getrelay/) | The relay in use | Paired |
| [`PUT /api/remote/relay`](/docs/reference/api/operations/setrelay/) | Choose a relay | Owner |
| [`GET /api/push`](/docs/reference/api/operations/getpush/) | Whether this phone has notifications on | Paired |
| [`PUT /api/push`](/docs/reference/api/operations/setpush/) | Turn notifications on for this phone | Paired device |
| [`DELETE /api/push`](/docs/reference/api/operations/clearpush/) | Turn notifications off for this phone | Paired device |
| [`POST /api/push/test`](/docs/reference/api/operations/testpush/) | Send this phone a test push | Paired device |
| [`POST /api/quickstart/start`](/docs/reference/api/operations/startquickstart/) | Quick Start on the new computer, during setup | Box's own screen only |
| [`GET /api/quickstart`](/docs/reference/api/operations/getquickstart/) | Where Quick Start stands | Owner |
| [`POST /api/quickstart/stop`](/docs/reference/api/operations/stopquickstart/) | Stop Quick Start | Owner |
| [`POST /api/quickstart/send`](/docs/reference/api/operations/askquickstartsend/) | Ask to send this computer's setup to a new one | Owner phone |
| [`POST /api/quickstart/send/<id>`](/docs/reference/api/operations/answerquickstartsend/) | Approve or refuse that send | Owner phone |
| [`GET /api/business`](/docs/reference/api/operations/getbusiness/) | Business settings, policy rules, seats, pilot | Paired |
| [`PUT /api/business`](/docs/reference/api/operations/setbusiness/) | Change them | Admin. Owner for `on` |
| [`GET /api/business/route`](/docs/reference/api/operations/tryroute/) | Who would a request go to | Paired |
| [`GET /api/people`](/docs/reference/api/operations/listpeople/) | The people | Admin |
| [`POST /api/people`](/docs/reference/api/operations/putperson/) | Add or change a person | Admin |
| [`DELETE /api/people/<id>`](/docs/reference/api/operations/removeperson/) | Remove a person and their phones | Admin |
| [`POST /api/people/<id>/pair`](/docs/reference/api/operations/pairperson/) | A pairing code for a person | Admin |
| [`GET /api/me`](/docs/reference/api/operations/getme/) | The caller's Business view | Paired |
| [`GET /api/audit`](/docs/reference/api/operations/getaudit/) | Audit rows | Auditor |
| [`GET /api/audit.csv`](/docs/reference/api/operations/getauditcsv/) | The same as a CSV file | Auditor |
| [`GET /api/pause`](/docs/reference/api/operations/getpause/) | Whether agents are paused | Paired |
| [`POST /api/pause`](/docs/reference/api/operations/pauseagents/) | Pause every agent | Admin |
| [`POST /api/resume`](/docs/reference/api/operations/resumeagents/) | Let them carry on | Admin |
| [`GET /api/sso`](/docs/reference/api/operations/getsso/) | Is work-account sign-in on | Open |
| [`GET /api/sso/start`](/docs/reference/api/operations/startsso/) | Send the browser to the provider | Open |
| [`GET /api/sso/callback`](/docs/reference/api/operations/ssocallback/) | The provider's return address | Open |
| [`POST /api/sso/redeem`](/docs/reference/api/operations/redeemsso/) | Trade a sign-in code for a device token | Open |
| [`POST /hook/<app>/<name>`](/docs/reference/api/operations/callwebhook/) | Call an app's webhook | Paired |
| `/t/<app>/...` | App routes, defined by each app | Paired, or open if the app lists the route in `openRoutes` |

`POST /api/drill` stores the numbers of an incident drill (`core/drill.ts`) in the log. It is for the drill script and has no page.

## Known limits

- `GET /api/tasks/<id>` for an unknown id returns 400, not 404.
- A device token stays valid until you remove the device. There is no expiry, except for a setup token (until setup finishes, two hours at most). A window token lasts 12 hours.
- Any process on the box that connects from `127.0.0.1` without a proxy header, and does not run as `nobody` or a task user, counts as the box's own screen. Task users cannot reach the API port, because their network goes only to the box's proxy. See [Network policy](/docs/concepts/network-policy/).
- Nothing limits how many tasks or approvals a caller can create through the API. What a task itself writes is limited: a step, question or cost is at most 64 KB (`413`), a task may write 20 MB to the log in all (`429`), and it may hold 256 open connections to the box's proxy. See [Broker](/docs/reference/broker/).
- A state file the box cannot read at start (`devices.json`, `owner.json`, `vault-meta.json`, `permissions.json`) is set aside as `<name>.torn-<time>`, and the box starts with the file empty and says so in the log. An unreadable `devices.json` means no phone is paired, so pair again. An unreadable `owner.json` still counts as an owner being set. An unreadable `permissions.json` pauses all agents, as `GET /api/pause` shows, until the owner checks Settings, Permissions and resumes them. A `remote.json` that cannot be read is set aside as `remote.json.torn` and remote access starts off.
