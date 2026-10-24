---
title: "Apps and slots"
description: "An app extends GurtOS by filling slots in the core: triggers, tools, log readers, model jobs and portal entries, plus HTTP routes and the vault keys it may read."
---

GurtOS's core does tasks, approvals, undo and the log. Everything else is an app: the Jira connection, the wallet, the shopping agent, /find. An app is a folder of TypeScript that the core loads at boot. It plugs into the core through named slots, and it never changes the core. The owner can turn each app off and on again without a reinstall.

## What an app is

An app is a folder with a `track.ts` file that default-exports an object of type `Track`. In the source tree, apps live in `tracks/<name>/`, and the object's `name` must match the folder name:

```ts
import type { Track } from '../../core/contract.ts';

export default {
  name: 'notes',
  title: 'Notes',
  description: 'Keeps a tidy notes folder.',
  secrets: ['NOTES_API_KEY'],
  triggers: [],
  tools: [],
  logReaders: [],
  modelJobs: [],
  apps: [{ name: 'notes', title: 'Notes', href: '/' }],
  routes: {},
} satisfies Track;
```

Every slot is optional. `title` and `description` describe the app in `GET /api/apps?all=1`; without them the box uses the first window's title and the first paragraph of the app's README. An app may also have its own `package.json` for npm packages, and a `demo.ts` that the test suite runs. The full types are in [the app SDK reference](/reference/app-sdk/).

## The five slots

| Slot | What the core does with it |
|---|---|
| `triggers` | Calls `start(box)` when the app turns on: at boot, or when you turn it on. The trigger starts tasks whenever it likes. |
| `tools` | Tasks that list a tool's name may call it through their broker. It runs in the core, with its declared secrets. |
| `logReaders` | Feeds `read(event)` every log event in order, from the first, and resumes after restarts |
| `modelJobs` | Work the box does for itself, run with `box.job(name, input)`, such as describing a photo |
| `apps` | Entries the portal shows in its app grid. Each has a title and a page under the app's routes. |

### Triggers

A trigger is how work starts without you. It gets a `Box` handle and calls `box.createTask(spec)` when its event happens. GurtOS ships three generic triggers, a schedule, a webhook and a file watcher, that turn an event into a task spec. See [triggers](/concepts/triggers/).

### Tools

A tool is how a task does something it cannot do alone: call a paid API, pay, read a mailbox. The tool runs in the core, not in the task. It declares:

- `name`, as `<app>.<verb>`, such as `wallet.pay`. Tasks list it in `tools`.
- `description` and `input`, a JSON Schema, which the model sees.
- `secrets`, the vault keys `run` may read.
- `hosts`, the hosts `run` talks to, for the reader and the portal.
- `cost(input)`, what a call costs in cents. Above the task's budget, the broker asks first.
- `approval(input)`, the payee and purpose shown on that approval.
- `run(input, ctx)`, which does the work and returns a result.

The result goes into the action log and back to the model. It must never contain a secret. See [the vault and the broker](/concepts/vault-and-broker/).

### Log readers

A log reader follows the action log. The core calls `read(event, box)` for every event, in order, starting from the first event ever written. After each one, it saves the reader's position in `BOX_HOME/cursors/<app>.<reader>`. If `read` throws, the core retries that event after 5 seconds and holds the reader there until it succeeds. So a reader that writes to an outside service catches up after an outage and never skips an event. The Jira and Elastic apps are log readers.

### Model jobs

A model job is model work the box does for itself, outside any task, such as /find describing a photo. Any app's code can run one with `box.job(name, input, task?)`. If `task` is given, the job's cost is counted on that task. A job declares its own `secrets`, like a tool.

### Portal entries

The `apps` slot lists the app's pages for the portal: a `name`, a `title`, and an `href` under the app's routes. `GET /api/apps` returns the entries of apps that are on, and the portal opens `/t/<app><href>`.

## Routes and secrets

Two more fields complete an app.

**`routes`** maps `'METHOD /path'` to a handler that takes a standard `Request` and returns a `Response`. The core serves it at `/t/<app>/path` on the box's API. Like every API route, a request from off the box needs a paired device's token, unless the app lists the route in `openRoutes`. An open route is for something public on purpose, or for an outside service that proves itself with the app's own secret, such as the Jira panel. Webhooks, an app's own pages and its JSON API go here:

```ts
routes: {
  'GET /': () => new Response('<h1>Notes</h1>', { headers: { 'content-type': 'text/html' } }),
  'POST /start': async (req, box) => Response.json(await box.createTask({ title: 'Tidy notes', prompt: '...' })),
},
```

**`secrets`** lists the vault keys the app's routes and triggers may read with `box.secret(name)`. Tools and model jobs declare their own. A route may use a secret to call an outside service, but must never return it in a response or hand it to a task.

## The rules

- An app imports only types from the core's contract. It never imports another core file or another app. The core never imports an app.
- Tool names are `<app>.<verb>`. Two apps cannot define the same tool; the second one fails to load.
- Keys go in the vault, never in the app's folder.
- An app that throws while loading is skipped and logged. It cannot stop the box. `GET /api/apps?all=1` lists it with `status: error` and the error text.

## Turning apps on and off

The owner can turn an app off and on without a reinstall, in the portal's **App Center** or through the API, from the box's own screen or a phone paired as the owner. App Center shows each app's description, the tools, hosts and keys it uses, and one action: **Open**, **Set key**, **Details** or **Turn on**.

| Request | Does |
|---|---|
| `GET /api/apps?all=1` | Every installed app, on or off: `id`, `title`, `description`, `status` (`enabled`, `disabled` or `error`), and `access`: its tools, jobs, the hosts its tools reach, the vault key names it needs with whether each is set, its triggers and routes |
| `POST /api/apps/<id>/disable` | Takes out the app's tools, jobs, routes, webhooks, log readers and windows at once, and stops its triggers. A task that asks for one of its tools is refused. |
| `POST /api/apps/<id>/enable` | Loads it again |

The choice is saved in `apps.json` in the box's state folder, so it survives a restart. A trigger that returned a stop function from `start` stops cleanly. One that returned nothing keeps running until the box restarts, and the app reports `restartNeeded: true`.

## What an app cannot do

Apps run inside the core, as root, with the core's privileges. The slots define what the core offers them, but the core does not sandbox their code. An app is trusted code, like a kernel module. Install only apps you trust. Tasks, the untrusted part, are what GurtOS isolates. See [the security model](/security/model/).

## Apps that ship with GurtOS

GurtOS includes apps for Jira, Elastic, ASI:One, x402 payments, a shopping agent, web work through Apify, /find, a read-only status summary, and a sample credit desk. Each is listed with its tools and routes in [included apps](/reference/apps/).

## Related

- [App SDK](/reference/app-sdk/)
- [Triggers](/concepts/triggers/)
- [Included apps](/reference/apps/)
- [The vault and the broker](/concepts/vault-and-broker/)
