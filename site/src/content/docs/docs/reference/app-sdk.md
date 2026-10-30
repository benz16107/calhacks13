---
title: App SDK
description: The TypeScript types an app uses to plug into GurtOS, with every field explained, the rules apps follow, and a minimal working app.
---

An app is a folder of TypeScript that the box reads at boot. The owner turns it on or off in App Center. It can add tools that tasks call, start tasks from triggers, read the action log, serve pages and routes, and run model jobs. Every type below comes from one file, `core/contract.ts`. For the ideas behind the slots, read [Apps and slots](/docs/concepts/apps-and-slots/).

In the source tree an app lives at `tracks/<name>/track.ts`, and the type it default-exports is named `Track`. The rest of this page calls it an app.

## Rules

- **Import only types** from `core/contract.ts`, plus the generic triggers from `core/triggers.ts`. Never import other core files or another app. The core never imports an app.
- **Name tools `<app>.<verb>`**, for example `example.spend`. Tool names must be unique across the apps that are on.
- **Node runs `.ts` directly** by stripping types. Use `import type`, write `.ts` in import paths, and avoid enums, namespaces and constructor parameter properties.
- **Never return a secret.** A tool's result goes into the action log. A route's response goes to whoever called it. Return derived facts instead.
- **Put keys in the vault**, never in the source. Declare which keys each tool, job or the app itself may read.
- **One broken app is skipped.** If `track.ts` throws while loading, exports a name that differs from its folder, or adds a tool name that already exists, the box logs it and starts without that app. `GET /api/apps?all=1` shows the app with its error.
- **An app that is off is read but not registered.** Its tools, jobs, routes, webhooks, log readers and triggers exist only while the owner has it on. A new box starts with only the model app (`anthropic`) on.
- **Pages run sandboxed.** HTML from a route has no origin of its own and no storage, and reaches the box only with its window's token. See [An app's page](#an-apps-page).
- **Packages** go in the app's own `package.json`. The source tree is an npm workspace.
- Apps load in folder name order. `tracks/example/` is skipped on an installed GurtOS image.

## A minimal app

```ts title="tracks/hello/track.ts"
import type { Track } from '../../core/contract.ts';
import { schedule } from '../../core/triggers.ts';

export default {
  name: 'hello',

  tools: [
    {
      name: 'hello.greet',
      description: 'Return a greeting for a name.',
      input: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] },
      async run(input: { name: string }) {
        return { greeting: `Hello, ${input.name}` };
      },
    },
  ],

  triggers: [
    schedule({
      name: 'morning',
      dailyAt: '08:00',
      task: () => ({ title: 'Morning note', prompt: 'Write today.md with three things to do.', tools: ['hello.greet'] }),
    }),
  ],

  routes: {
    'GET /': () => new Response('<h1>Hello</h1>', { headers: { 'content-type': 'text/html' } }),
  },

  apps: [{ name: 'hello', title: 'Hello', href: '/' }],
} satisfies Track;
```

Restart the box service. On a box that has run before, the app is on: the tool is installed, the schedule is armed, and the page is at `/t/hello/` and in the portal's app grid. On a brand-new box it starts off until the owner turns it on in App Center. The owner can turn the app off and on again without a restart. `tracks/example/` in the source tree uses every slot.

## `Track`

What `track.ts` default-exports.

| Field | Type | Meaning |
|---|---|---|
| `name` | `string` | Must equal the folder name. |
| `title` | `string?` | The name in App Center. Defaults to the title of the first entry in `apps`, then `name`. |
| `description` | `string?` | One or two plain sentences for App Center. Defaults to the first paragraph of the app's `README.md`, cut to 240 characters. App Center marks an app **Test only** when its title or description says it uses test money, test payments, test data, a devnet or a sandbox. |
| `secrets` | `string[]?` | Vault keys the app's routes and triggers may read with `box.secret()`. Tools and model jobs declare their own. |
| `optionalSecrets` | `string[]?` | Keys among the app's declared secrets that it can run without. App Center marks them optional, and setup asks only for the others. |
| `taskContext` | `(spec, box) => string \| undefined` | Called for every new task before it starts, except a guest's task. Return plain text to add to a Droid task's prompt, such as what the app remembers that is relevant. A throw or more than 2 seconds is logged and the task starts without it. All apps together may add 8,000 characters. |
| `offByDefault` | `boolean?` | Deprecated and not read. A new box turns on only the model app. |
| `triggers` | `Trigger[]` | Started when the app turns on: at boot after the API is up, or when the owner enables it. |
| `tools` | `Tool[]` | Tasks that list a tool's name can call it through their broker. |
| `logReaders` | `LogReader[]` | Fed every log event in order, from the start, resuming after restarts. |
| `modelJobs` | `ModelJob[]` | Work the box does for itself. Anyone with a `Box` can run one with `box.job()`. |
| `apps` | `App[]` | Pages listed in the portal's app grid. |
| `routes` | `Record<string, Route>` | HTTP routes keyed `'METHOD /path'`, served at `/t/<name>/path`. The path matches exactly, with no wildcards. |
| `openRoutes` | `string[]` | Route keys, as in `routes`, that need no paired device's token from off the box. For a route that is public on purpose, or checks its own credential such as a shared secret. An open route must return nothing private unless its own check passes. |
| `ownOrigin` | `string[]?` | Route keys, as in `routes`, whose HTML page is served with the box's own origin instead of the sandbox every other app page gets. Only for a page that cannot work without a real origin, such as a passkey (WebAuthn) ceremony. Shopper's Face ID page (`GET /approve`) is the one. Such a page runs with the box's origin, so review it like core code: it shows an agent's text only escaped and loads nothing from another site. The window token and every other rule still apply. |

## `TaskSpec`

What a trigger, route or API call asks for when it starts a task.

| Field | Type | Default | Meaning |
|---|---|---|---|
| `title` | `string` | required | A short name for people, at most 200 characters |
| `prompt` | `string` | required | What the worker should do, at most 100,000 characters. For the `fake` worker, one command per line. |
| `workspace` | `string` | `'home'` | A folder in `BOX_HOME/workspaces` that already exists (letters, digits, `_`, `.` and `-`). The task works on its own copy. |
| `worker` | `'droid' \| 'fake'` | `'droid'` | Droid with Claude, or scripted steps with no model for tests |
| `model` | `string?` | `claude-sonnet-5-5`, or `BOX_MODEL` | Droid only: `haiku`, `sonnet` or `opus`, or a model id that starts with `claude-`. Anything else is refused. The task records the exact id it ran on. |
| `tools` | `string[]` | `[]` | Tool names the task may call. A name no app registers is refused. |
| `hosts` | `string[]` | `[]` | At most 50 hosts the task's network may reach, written `example.com`, `*.example.com` or `example.com:8080`. `localhost`, loopback and link-local names and a wildcard over a whole top-level domain are refused. A name that resolves to the box or a private network needs an exact `host:port`. See [Network policy](/docs/concepts/network-policy/). |
| `budgetCents` | `number` | Settings `defaultBudgetCents` (100, or $1, on a new box) | Spending above this, in US cents, pauses the task for an OK. A whole number from 0 to 100000. |
| `source` | `string` | the app's name, or `'api'` | Who started it: `'schedule'`, `'api'`, `'jira:BOX-12'` |
| `folder` | `string?` | none | GurtOS Personal: a real folder of the owner's that the task works on a copy of. Through the API only the owner may send it. |
| `folders` | `string[]?` | none | GurtOS Personal: several real folders in one task, side by side. `folder` is then the first. |
| `seat` | `string?` | none | The agent seat doing the work, such as `Credit analyst`, at most 60 characters. Shown in the audit. |
| `droid` | `{plan?, autonomy?}` | none | How Droid works on it. `plan: true` has Droid write a plan first, and it starts only once the owner approves the plan. `autonomy` is `'low'`, `'medium'` or `'high'`. The box enforces the level: `low` gets no network and a budget of 0, and `medium` keeps its hosts and a budget of at most $1. The `fake` worker ignores it. |

A task that names no `hosts` gets none, or Settings `defaultHosts` when `networkDefault` is `allowlist`. A field the box does not know is refused with an error that names it. A task an app starts is also refused with a plain sentence where the owner turned off that app's permission to run a shell, use folders or reach a host. See [Permissions](#permissions).

## `Task`

A `TaskSpec` with every field filled in, plus:

| Field | Type | Meaning |
|---|---|---|
| `id` | `string` | `t` followed by letters and digits |
| `state` | `TaskState` | See below |
| `user` | `string` | The Linux user it runs as, `box-<id>` |
| `layers` | `string[]` | Finished tasks whose changes it saw when it started, newest first |
| `costCents` | `number` | Tool spending plus model cost, not rounded |
| `step` | `string?` | The latest step, up to 200 characters |
| `createdAt`, `updatedAt` | `string` | ISO 8601 times |
| `error` | `string?` | Why it failed, as a sentence a person can read, such as `Your Anthropic key was not accepted. Change it in Settings, Accounts & Keys.` |
| `summary` | `string?` | A summary, if one was recorded |
| `review` | `string?` | GurtOS Personal, for a task on real folders: `pending` (done, waiting for the owner), `kept`, `conflict` or `undone` |
| `requestedBy` | `string?` | GurtOS Business: the id of the person who asked for the task. The core sets it, never the caller. |
| `app` | `string?` | The app whose box started the task, whatever `source` it gave. The core sets it, never the caller. An app's window answers only the requests of tasks with its own name here. |

## `TaskState`

| State | Meaning | Can become |
|---|---|---|
| `queued` | Created, not started | `running`, `failed`, `undone` |
| `running` | The worker is working | `waiting`, `done`, `failed`, `undone` |
| `waiting` | Paused until an approval is answered | `running`, `done`, `failed`, `undone` |
| `done` | Finished. Its changes are part of the workspace. | `undone` |
| `failed` | Stopped with an error. Its changes are not applied. | `undone` |
| `undone` | Removed. Its changes are gone; other tasks keep theirs. | nothing |

## `Approval`

| Field | Type | Meaning |
|---|---|---|
| `id` | `string` | A task's own question (`POST /ask`) is `<task id>.task.<key>`, a tool's `ctx.ask` is `<task id>.tool.<call key>.ask.<hash>`, and the box's own budget and shadow-mode questions are `<task id>.budget.<action>` and `<task id>.shadow.<action>`. The same key asked twice is the same approval. |
| `task` | `string` | The task that asked |
| `question` | `string` | What people see |
| `costCents` | `number` | The spending asked about. 0 when it is not about money. |
| `payee` | `string?` | Who gets paid, or the host being reached |
| `purpose` | `string?` | What it is for |
| `state` | `'pending' \| 'approved' \| 'denied'` | |
| `by` | `string?` | Who answered: a paired device's name, what the box's own screen sent, `'jira:<name>'`, `'asi1'`. On a Business box, the person's name. |
| `person`, `via`, `askedBy`, `route`, `shadow` | | GurtOS Business: the id of the person who answered, the phone or screen the answer came from, the person who asked for the task (they may not answer it), where the policy sent the request and why, and the seat a shadow-mode suggestion came from |

## `Box`

What triggers, routes, log readers and tools (as `ctx.box`) get to act on the box. Each app gets its own `Box`, which knows the app's name.

| Method | Does |
|---|---|
| `createTask(spec)` | Starts a task and returns it. `source` defaults to the app's name. Rejects an unknown field, workspace or tool, and a value outside the limits above. While Pause all agents is on, the task waits, queued. |
| `workspace(name, fromDir?)` | Makes a workspace, empty or as a copy of a folder. Leaves an existing one alone. Names use letters, digits, `_`, `.` and `-`. |
| `linkWorkspace(name, realPath)` | Personal (preview): points a workspace at a real folder. Tasks work on a copy of it, and Keep writes back. |
| `task(id)` | One task, or `undefined` |
| `tasks()` | Every task |
| `undo(id)` | Stops the task if it is going and removes its file changes. The layer is deleted from disk once no running task reads it. Undoing a kept Personal task also takes its changes out of the real folder, or throws if the owner edited a kept file since. |
| `approvals()` | Every approval |
| `answer(id, approved, by)` | Answers an approval. The first answer wins. On a GurtOS Business box only a signed-in person may answer: a trigger or log reader is refused, and a route answers only as the person who called it. |
| `on(listener)` | Live events as they are written. Returns a function that stops listening. To read the whole log reliably, use a `LogReader`. |
| `job(name, input, task?)` | Runs a model job. Its cost goes to `task` if given. |
| `note(data, task?)` | Writes a `note` event from this app |
| `onWebhook(name, handler)` | Serves `POST /hook/<app>/<name>` (the name uses letters, digits, `_` and `-`). The handler gets the JSON body and the headers and returns JSON. Callers need a paired device's token like the rest of the API, unless the request comes from the box's own screen. |
| `secret(name)` | Reads a vault key listed in the app's `secrets`. Throws for any other name, a missing key, or a key the owner turned off for the app. |
| `policy()` | GurtOS Business: the approval rules as text, one rule per line |
| `setPolicy(text, approvalId)` | GurtOS Business: replaces the rules once a person has said yes. `approvalId` must be an approved request of one of the app's own tasks, answered by an owner or an admin, whose question carries `[policy <hash>]`, the first 12 hex characters of the text's SHA-256. Throws otherwise and changes nothing. |

## `Ctx`

What a tool's `run` and a model job's `run` receive. Both run inside the core, never inside a task.

| Field | Type | Meaning |
|---|---|---|
| `box` | `Box` | The app's `Box` |
| `task` | `Task?` | The task that called, if any |
| `key` | `string` | For a tool call, the task id, a dot and the call's broker key: unique per call and stable across a restart. Pass it to outside APIs as an idempotency key, so a call repeated after a power cut is not paid twice. A model job gets a new key on every run. |
| `secret(name)` | `string` | Reads a vault key listed in the tool's or job's `secrets`. Throws for any other name or a missing key. |
| `cost(cents, what)` | `void` | Records extra spending in US cents |
| `log(text, data?)` | `void` | Adds a step to the calling task's log. Does nothing without a task. |
| `ask(question, opts?)` | `Promise<boolean>` | Asks the owner for an OK on behalf of the task, through the one approval path. Resolves true when approved, and false when denied or when there is no task. The same question in the same call returns the same answer, even after a restart. A slow owner is not a no: it asks again until someone answers. `opts.purpose` is the line on the approval card. |

## `Tool`

| Field | Type | Meaning |
|---|---|---|
| `name` | `string` | `<app>.<verb>`. Tasks list it in `tools`. |
| `description` | `string` | Shown to the model |
| `input` | JSON Schema | The input's shape, shown to the model. Default `{type: 'object'}`. |
| `secrets` | `string[]` | Vault keys `run` may read |
| `hosts` | `string[]` | Hosts `run` talks to, for documentation. Tools run in the core, outside task network limits. |
| `cost(input)` | `number` | US cents this call will spend. If it takes the task above its budget, or is above the box's approval threshold, or takes the app over its daily limit, the broker asks for an OK first. A tool may return `spentCents` (0 up to the cost) in its output to charge less than it was approved for. |
| `approval(input)` | `{payee?, purpose?}` | Fields for the approval card: who gets paid and what for |
| `decides(input)` | `string` | GurtOS Business shadow mode: the decision this tool records, in plain words that finish "the Credit analyst would ...". While the task's seat is in shadow, a person decides first. |
| `run(input, ctx)` | `Promise<unknown>` | Does the work. The result goes to the task and into the log. Throw to fail the call. |

## `Trigger`

| Field | Type | Meaning |
|---|---|---|
| `name` | `string` | |
| `start(box)` | `void \| (() => void) \| Promise<...>` | Runs when the app turns on: at boot, after the API is up, or when the owner enables the app. Call `box.createTask()` whenever you like. Return a function that stops the trigger. |

When the owner turns an app off, the box calls each trigger's stop function. A trigger that returned nothing keeps running until the box restarts, and the app reports `restartNeeded: true`. The generic triggers `schedule`, `webhook` and `onFileChange` are in `core/triggers.ts`. See [Triggers](/docs/concepts/triggers/).

## `LogReader`

| Field | Type | Meaning |
|---|---|---|
| `name` | `string` | |
| `read(event, box)` | `void \| Promise<void>` | Called for every event in order. Throw to have the same event retried after 5 seconds. |

The core saves each reader's position after every event it handles, in `BOX_HOME/cursors/<app>.<reader>`. A new reader starts from the first event in the log.

## `ModelJob`

| Field | Type | Meaning |
|---|---|---|
| `name` | `string` | Called with `box.job(name, input)` |
| `secrets` | `string[]` | Vault keys `run` may read |
| `run(input, ctx)` | `Promise<unknown>` | Does the work |

## `App`

An entry in the portal's app grid.

| Field | Type | Meaning |
|---|---|---|
| `name` | `string` | |
| `title` | `string` | The label under the icon |
| `href` | `string` | Path under `/t/<app>/` where the page lives |

## `Route`

```ts
type Route = (req: Request, box: Box) => Response | Promise<Response>;
```

A standard Web `Request` in, a `Response` out. Routes run in the core. The key `'GET /spend'` is served at `/t/<app>/spend`. The method and path match exactly, and the query string is on `req.url`. A route that throws returns 500 with `{"error": "..."}`. A body over 10 MB gets 413, or over 1 MB when the caller is `none`.

The box sets the request header `x-box-caller` and replaces any copy the caller sends:

| Value | Meaning |
|---|---|
| `screen` | The box's own screen |
| `owner` | A phone paired as the owner |
| `device:<id>` | Another paired phone |
| `service` | A helper on the box, such as the ASI:One agent |
| `none` | An open route reached through a proxy with no token |

On a GurtOS Business box the header `x-box-person` carries the signed-in person's id. A page in a GurtOS window (below) calls as whoever opened the window, so `x-box-caller` is `screen` on the box's own screen and `owner` or `device:<id>` on a phone.

From outside the box a route needs a paired device's token, like the rest of the API, and a request relayed by a reverse proxy on the box counts as outside. An app can list a route in `openRoutes` to skip that check. The route must then return nothing private unless its own check passes, such as a shared secret, as the Jira app's routes do. The owner can turn that off for an app (the `strangers` permission below), and then the route needs a token again.

## An app's page

An app's page is whatever its routes return as HTML or XML, usually `GET /`. GurtOS opens it in a window, in an iframe. The box serves every HTML or XML answer from an app's route with `Content-Security-Policy: sandbox allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals allow-downloads allow-top-navigation-by-user-activation`. If the route sets its own `Content-Security-Policy`, the two are sent together. JSON and other answers are not changed.

The sandbox leaves out `allow-same-origin`, so the page has no origin of its own. It cannot read the portal around it, the device's token or the box's storage, and it cannot act as the box's screen. A bug or injected script in one app's page cannot use the owner's controls. In return:

- **No browser storage.** `localStorage`, cookies and `sessionStorage` are unavailable. Keep state in memory or in the app's own routes.
- **No passkeys, unless the route is in `ownOrigin`.** They need a real origin. Shopper's Face ID page (`GET /approve`) is listed in `ownOrigin` and served without the sandbox. Every other page has no origin.
- **A token of its own.** `POST /api/apps/<app>/window` (from the box's own screen or a paired device) returns `{token, expiresAt}`. A token starts with `w`, lasts 12 hours and ends when the device that opened it is removed (401 `this window has expired: close it and open the app again`). The app must be on, or the answer is 404. The box keeps at most 1000 open windows and drops the oldest. GurtOS opens the page at `/t/<app><href>?access_token=<token>`.
- **The token is carried for you.** The box puts a small script first in every HTML page that adds `Authorization: Bearer <token>` to the page's own `fetch` calls to the box. `/kit/gurtos.js` also adds it to links, forms and `EventSource`. A request the browser makes by itself, such as `<script type="module" src>` or `<img>`, carries no header, so add `location.search` to its address.
- **What the token reaches.** The app's own routes (`/t/<app>/...`), `GET /api/tasks`, `GET /api/tasks/<id>`, `GET /api/approvals`, and `POST /api/approvals/<id>` for requests from the app's own tasks (`task.app`). Everything else is 403: the vault, settings, pairing, another app's routes, and opening another window.
- **Another app's request.** Answering a request that belongs to another app, or to a task no app started, is 403 with `needs: 'shell'` and the task's id. The injected script then asks GurtOS to open that task in its own window, where a person answers.

A page at `/t/hello/` needs no code for tokens. If the app defined a route `'POST /greet'`, the page could do this:

```js
const own = await fetch('./greet', { method: 'POST', body: JSON.stringify({ name: 'Ada' }) }); // the app's own route
const tasks = await (await fetch('/api/tasks')).json(); // a read the token allows
await fetch('/api/vault'); // 403: an app's window may use only its own routes
```

The window sends the desktop's light or dark style to the page by message, and `/kit/gurtos.js` applies it. [portal/KIT.md](https://github.com/benz16107/gurtos/blob/main/portal/KIT.md) in the source tree lists the style classes an app page can use.

## Permissions

The owner controls what each app may do, like a phone's app permissions, in Settings, Permissions (`core/permissions.ts`). The box builds a list for each app from what the app declares and what the box has seen it use. Nothing changes for an app until the owner turns something off.

| Item | What the owner can turn off | Where the box enforces it |
|---|---|---|
| `key:<NAME>` | Using a vault key | `box.secret()` and `ctx.secret()` throw |
| `money` | Spending. The owner can also set a limit per day, counted in UTC from the log. | A tool with `cost` returns an error and never runs. Over the daily limit, the broker asks for an OK first. |
| `strangers` | Open routes (`openRoutes`) | The routes need a paired device's token again |
| `shell` | Running agents that can run commands | `box.createTask()` throws for a spec with `worker: 'droid'` |
| `folders` | Giving agents copies of the owner's folders | `box.createTask()` throws |
| `host:<host>` | Letting its agents reach a host | `box.createTask()` throws |

The refusal reads `<App> isn't allowed to <do it>. The owner can allow it in Settings, Permissions.` It is written to the log. Hosts, shell use and folders appear in the list once a task of the app has used them.

The owner can also set a disk cap for an app's tasks, 5 GB by default. A task that passes it is stopped and undone. The cap applies to tasks whose `source` is exactly the app's name, which is the default for tasks it starts. `GET /api/permissions` and `PUT /api/permissions/<app>` read and change all of this (see [HTTP API](/docs/reference/http-api/#setup-settings-apps-and-the-vault)).

## `DemoKit`

An app's test step, `tracks/<name>/demo.ts`, default-exports `async (d: DemoKit) => { ... }`. The [test suite](/docs/reference/test-suite/) runs it as the step `track <name>` against a fresh box with every app loaded, after the core scenarios. `DEMO_ONLY=<name> ./demo` runs just that step.

| Field | Type | Meaning |
|---|---|---|
| `api(method, path, body?)` | `Promise<T>` | The box's API, as JSON |
| `check(ok, what)` | `void` | Prints one passing check, or throws to fail the step |
| `workspace(name, files)` | `void` | Makes a workspace with these files |
| `view(workspace, file)` | `string?` | A file as it is now: the base plus every done task |
| `settled(ids)` | `Promise<Task[]>` | Waits until the tasks finish. Throws if one fails. |
| `waitFor(what, fn, ms?)` | `Promise<T>` | Polls `fn` until it returns a value |
| `home` | `string` | `BOX_HOME` for this run |
| `port` | `number` | The box's HTTP API port for this run |
| `url` | `string` | `http://127.0.0.1:<port>`, the API and portal for this run |

Keep a step under about 10 seconds, and keep it offline unless `DEMO_LIVE` names the app.

## Related

- [Apps and slots](/docs/concepts/apps-and-slots/)
- [Broker API](/docs/reference/broker/)
- [Log events](/docs/reference/log-events/)
- [Apps](/docs/reference/apps/): the apps that ship today
