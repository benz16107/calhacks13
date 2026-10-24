---
title: HTTP API
description: How to reach the box's HTTP API, what it sends back, how errors look, who may call it, and a table of every route.
---

The box's HTTP API is how the portal, a phone and your own scripts list tasks, start them, answer approvals, undo work and follow the action log. Every operation is documented in full under [HTTP API operations](/reference/api/), generated from the routes the core serves.

## Where it listens

| Address | Who can use it |
|---|---|
| `http://127.0.0.1:7700` | Processes on the box. The default. |
| `http://<BOX_LISTEN>:7700` | Anything that can reach that address, once you set [`BOX_LISTEN`](/reference/environment/). |
| `BOX_HOME/api.sock` | Root on the box. A Unix socket with mode `0600`, serving the same routes. |

`BOX_PORT` changes the port, and `BOX_PORT=0` turns the TCP listener off. The socket is always on.

Every route answers both with and without the `/api` prefix. These two requests are the same:

```sh
curl -s http://127.0.0.1:7700/api/tasks
curl -s http://127.0.0.1:7700/tasks
```

App routes (`/t/<app>/...`) and webhooks (`/hook/<app>/<name>`) are the exception. They answer only at those paths.

## Requests and responses

Send JSON with `content-type: application/json` and read JSON back.

```sh
curl -s http://127.0.0.1:7700/api/tasks \
  -H 'content-type: application/json' \
  -d '{"title": "Summarise the notes", "prompt": "Read notes.md and write summary.md.", "budgetCents": 50}'
```

## Errors

A failed request returns status 400 and an object with one field:

```json
{ "error": "no workspace notes" }
```

| Status | When |
|---|---|
| 400 | Bad input, or an id that does not exist (`no task t3k9x2a1b2`, `no approval ...`) |
| 401 | `POST /api/approvals/<id>` with a device token that is unknown or revoked |
| 404 | No such route, or `DELETE /api/devices/<id>` for an unknown device |
| 500 | An app route threw an error |

## Authentication and its limits

The API has no authentication. Anyone who can open a connection to the port can start tasks, answer approvals and undo work. That is why it listens on `127.0.0.1` by default.

- To use the portal from another device, put the box on a network you trust, such as a VPN, and set `BOX_LISTEN` to that interface's address.
- Do not expose port 7700 to the internet. If an outside service must call one app route, put a reverse proxy in front that forwards only that path. The [Jira guide](/guides/connect-jira/) does this.
- A paired phone sends `Authorization: Bearer <token>` when it answers an approval. The box checks the token and logs the phone's name. Other routes do not read the header. See [Pairing](#pairing).

:::caution[Planned]
Authentication for every route, so a device token is required instead of optional, is planned. Until then, network access to the port is the access control.
:::

## Cross-origin requests

The portal is served from the same address as the API, so it needs no CORS. A web app served from another origin, such as a development server, needs that origin in `BOX_ORIGINS`:

```sh
BOX_ORIGINS=http://localhost:5173
```

Separate several origins with commas, or use `*` for any origin. The box then answers `OPTIONS` preflight requests and adds `access-control-allow-origin` for `GET`, `POST` and `OPTIONS`.

## The portal on the same address

The box serves the built portal from `portal/dist` (or the folder in `BOX_PORTAL`) on the API's address. A `GET` for a file returns the file. A page load (an `Accept` header with `text/html`) for any other path returns `index.html`, so the portal's own routes work. A `fetch('/tasks')` without `text/html` still reaches the API.

## App routes

An app's routes are served at `/t/<app>/<path>`. For example, the wallet app's page is `/t/wallet/` and the shopper's store is `/t/shopper/store`. `GET /api/apps` lists the pages apps want in the portal's app grid. See [Apps and slots](/concepts/apps-and-slots/).

## Webhooks

An app that uses the `webhook` trigger serves `POST /hook/<app>/<name>`. The JSON body becomes the payload, and the app usually starts a task:

```sh
curl -s http://127.0.0.1:7700/hook/example/start \
  -H 'content-type: application/json' -d '{"title": "From a webhook"}'
```

The response is the new task, or `{"ok": true}` if the app chose not to start one. See [Triggers](/concepts/triggers/).

## Following the action log

Two ways to read the log as it grows:

- **Polling.** `GET /api/log?after=<seq>` returns every event after that line. Keep the last `seq` you saw.
- **Streaming.** `GET /api/log/stream` sends Server-Sent Events. It replays from `?after=<seq>` or the `Last-Event-ID` header, then streams new events live. Each event is `id: <seq>` and `data: <json>`. A `: beat` comment arrives every 25 seconds.

```sh
curl -N http://127.0.0.1:7700/api/log/stream?after=0
```

Both accept `task=<id>` to follow one task. For live task status and approvals, the portal uses SpacetimeDB instead: see [Live updates](/reference/live-updates/).

## Personal: real folders

:::note[Preview]
On a Personal box, `POST /api/tasks` also takes `folder`, an absolute path to one of the owner's folders. The task works on a copy. When it is done, `POST /api/tasks/<id>/keep` writes its changes into the real folder, or returns `{conflicts}` if the owner changed the same files meanwhile, and `POST /api/tasks/<id>/undo` throws the changes away. See [Keep or Undo](/guides/keep-or-undo/).
:::

## Pairing

A phone pairs once and gets its own device token:

1. The portal's Settings asks the box for a one-time code, `POST /api/pair/start`, and shows it as a QR code. The code works once and expires after 5 minutes.
2. The QR code opens the portal's pairing screen on the phone (`/#pair/<code>`), which redeems the code: `POST /api/pair {"code": "...", "name": "My phone"}` returns `{token, device, box}`.
3. When the phone answers an approval, it sends `Authorization: Bearer <token>`, and the log records the phone's name as `by`.
4. `DELETE /api/devices/<id>` stops that token. Its next answer gets 401.

The older names `POST /api/pair/new`, `GET /api/pair/devices` and `POST /api/pair/devices/<id>/revoke` still work. A `GET /pair` is a portal page, not an API route.

See [Approve from your phone](/guides/approve-from-your-phone/).

## Every route

| Method and path | Does |
|---|---|
| [`GET /api/tasks`](/reference/api/operations/listtasks/) | List every task |
| [`POST /api/tasks`](/reference/api/operations/createtask/) | Start a task |
| [`GET /api/tasks/<id>`](/reference/api/operations/gettask/) | One task, its approvals and its log events |
| [`GET /api/tasks/<id>/diff`](/reference/api/operations/gettaskdiff/) | What the task changed, and a unified diff |
| [`POST /api/tasks/<id>/undo`](/reference/api/operations/undotask/) | Undo the task |
| [`POST /api/tasks/<id>/keep`](/reference/api/operations/keeptask/) | Personal (preview): apply a done task's changes to the owner's real folder |
| [`GET /api/owner`](/reference/api/operations/getowner/) | Personal (preview): the owner's user and home, or `null` |
| [`GET /api/approvals?state=`](/reference/api/operations/listapprovals/) | Approvals, all or in one state |
| [`POST /api/approvals/<id>`](/reference/api/operations/answerapproval/) | Approve or deny. The first answer wins. |
| [`GET /api/log?after=&task=`](/reference/api/operations/readlog/) | Log events after a cursor |
| [`GET /api/log/stream?after=&task=`](/reference/api/operations/streamlog/) | The log as Server-Sent Events |
| [`GET /api/apps`](/reference/api/operations/listapps/) | Pages apps add to the portal |
| [`GET /api/health`](/reference/api/operations/gethealth/) | `{ok, startedAt, resumed, tasks, tools, spacetime}` |
| [`GET /api/boxes`](/reference/api/operations/listboxes/) | This box and its peers from `BOX_PEERS` |
| [`POST /api/pair/start`](/reference/api/operations/newpairingcode/) | Make a one-time pairing code |
| [`POST /api/pair`](/reference/api/operations/redeempairingcode/) | Trade a code for a device token |
| [`GET /api/devices`](/reference/api/operations/listdevices/) | Paired phones |
| [`DELETE /api/devices/<id>`](/reference/api/operations/revokedevice/) | Revoke a phone |
| [`POST /hook/<app>/<name>`](/reference/api/operations/callwebhook/) | Call an app's webhook |
| `/t/<app>/...` | App routes, defined by each app |

## Known limits

- Path parameters are not percent-decoded. An approval id with a space or a slash in it, such as one made from Droid's own question, cannot be answered through `POST /api/approvals/<id>`. Answer it with the SpacetimeDB `answer` reducer, which is what the portal does when it is connected.
- `GET /api/tasks/<id>` for an unknown id returns 400, not 404.
