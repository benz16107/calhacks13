---
title: App SDK
description: The TypeScript types an app uses to plug into GurtOS, with every field explained, the rules apps follow, and a minimal working app.
---

An app is a folder of TypeScript that the box loads at boot. It can add tools that tasks call, start tasks from triggers, read the action log, serve pages and routes, and run model jobs. Every type below comes from one file, `core/contract.ts`. For the ideas behind the slots, read [Apps and slots](/docs/concepts/apps-and-slots/).

In the source tree an app lives at `tracks/<name>/track.ts`, and the type it default-exports is named `Track`. The rest of this page calls it an app.

## Rules

- **Import only types** from `core/contract.ts`, plus the generic triggers from `core/triggers.ts`. Never import other core files or another app. The core never imports an app.
- **Name tools `<app>.<verb>`**, for example `wallet.pay`. Tool names must be unique across the box.
- **Node runs `.ts` directly** by stripping types. Use `import type`, write `.ts` in import paths, and avoid enums, namespaces and constructor parameter properties.
- **Never return a secret.** A tool's result goes into the action log. A route's response goes to whoever called it. Return derived facts instead.
- **Put keys in the vault**, never in the source. Declare which keys each tool, job or the app itself may read.
- **One broken app is skipped.** If `track.ts` throws while loading, exports a name that differs from its folder, or adds a tool name that already exists, the box logs it and starts without that app.
- **Packages** go in the app's own `package.json`. The source tree is an npm workspace.
- Apps load in folder name order.

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

Restart the box service and the tool is installed, the schedule is armed, and the page is at `/t/hello/` and in the portal's app grid. The owner can turn the app off and on again without a restart. `tracks/example/` in the source tree uses every slot.

## `Track`

What `track.ts` default-exports.

| Field | Type | Meaning |
|---|---|---|
| `name` | `string` | Must equal the folder name. |
| `title` | `string?` | The name in the App Center. Defaults to the first window's title, then `name`. |
| `description` | `string?` | One or two plain sentences for the App Center. Defaults to the first paragraph of the app's `README.md`. |
| `secrets` | `string[]` | Vault keys the app's routes and triggers may read with `box.secret()`. Tools and model jobs declare their own. |
| `triggers` | `Trigger[]` | Started when the app turns on: at boot, or when the owner enables it. |
| `tools` | `Tool[]` | Tasks that list a tool's name can call it through their broker. |
| `logReaders` | `LogReader[]` | Fed every log event in order, from the start, resuming after restarts. |
| `modelJobs` | `ModelJob[]` | Work the box does for itself. Anyone with a `Box` can run one with `box.job()`. |
| `apps` | `App[]` | Pages listed in the portal's app grid. |
| `routes` | `Record<string, Route>` | HTTP routes keyed `'METHOD /path'`, served at `/t/<name>/path`. |
| `openRoutes` | `string[]` | Route keys, as in `routes`, that need no paired device's token from off the box. For a route that is public on purpose, or checks its own credential such as a shared secret. An open route must return nothing private unless its own check passes. |

## `TaskSpec`

What a trigger, route or API call asks for when it starts a task.

| Field | Type | Default | Meaning |
|---|---|---|---|
| `title` | `string` | required | A short name for people |
| `prompt` | `string` | required | What the worker should do. For the `fake` worker, one command per line. |
| `workspace` | `string` | `'home'` | A folder in `BOX_HOME/workspaces`. The task works on its own copy. |
| `worker` | `'droid' \| 'fake'` | `'droid'` | Droid with Claude, or scripted steps with no model for tests |
| `tools` | `string[]` | `[]` | Tool names the task may call |
| `hosts` | `string[]` | `[]` | Hosts the task's network may reach. See [Network policy](/docs/concepts/network-policy/). |
| `budgetCents` | `number` | Settings `defaultBudgetCents`, `0` unless changed | Spending above this, in US cents, pauses the task for an OK |
| `source` | `string` | the app's name, or `'api'` | Who started it: `'schedule'`, `'api'`, `'jira:BOX-12'` |
| `folder` | `string?` | none | GurtOS Personal: a real folder of the owner's that the task works on a copy of. Through the API only the owner may send it. |
| `folders` | `string[]?` | none | GurtOS Personal: several real folders in one task, side by side. `folder` is then the first. |

A task that names no `hosts` gets none, or Settings `defaultHosts` when `networkDefault` is `allowlist`. A field the box does not know is refused with an error that names it.

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
| `error` | `string?` | Why it failed. A worker that exits with an error adds its own last error line. |
| `summary` | `string?` | A summary, if one was recorded |
| `review` | `string?` | GurtOS Personal, for a task on real folders: `pending` (done, waiting for the owner), `kept`, `conflict` or `undone` |

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
| `id` | `string` | `<task id>.<key>`. The same key asked twice is the same approval. |
| `task` | `string` | The task that asked |
| `question` | `string` | What people see |
| `costCents` | `number` | The spending asked about. 0 when it is not about money. |
| `payee` | `string?` | Who gets paid, or the host being reached |
| `purpose` | `string?` | What it is for |
| `state` | `'pending' \| 'approved' \| 'denied'` | |
| `by` | `string?` | Who answered: a paired device's name, what the box's own screen sent, `'jira:<name>'`, `'asi1'` |

## `Box`

What triggers, routes, log readers and tools (as `ctx.box`) get to act on the box. Each app gets its own `Box`, which knows the app's name.

| Method | Does |
|---|---|
| `createTask(spec)` | Starts a task and returns it. `source` defaults to the app's name. Rejects an unknown workspace or tool. |
| `workspace(name, fromDir?)` | Makes a workspace, empty or as a copy of a folder. Leaves an existing one alone. Names use letters, digits, `_`, `.` and `-`. |
| `linkWorkspace(name, realPath)` | Personal (preview): points a workspace at a real folder. Tasks work on a copy of it, and Keep writes back. |
| `task(id)` | One task, or `undefined` |
| `tasks()` | Every task |
| `undo(id)` | Stops the task if it is going and removes its file changes. The layer is deleted from disk once no running task reads it. |
| `approvals()` | Every approval |
| `answer(id, approved, by)` | Answers an approval. The first answer wins. |
| `on(listener)` | Live events as they are written. Returns a function that stops listening. To read the whole log reliably, use a `LogReader`. |
| `job(name, input, task?)` | Runs a model job. Its cost goes to `task` if given. |
| `note(data, task?)` | Writes a `note` event from this app |
| `onWebhook(name, handler)` | Serves `POST /hook/<app>/<name>`. The handler gets the JSON body and the headers and returns JSON. |
| `secret(name)` | Reads a vault key listed in the app's `secrets`. Throws for any other name or a missing key. |

## `Ctx`

What a tool's `run` and a model job's `run` receive. Both run inside the core, never inside a task.

| Field | Type | Meaning |
|---|---|---|
| `box` | `Box` | The app's `Box` |
| `task` | `Task?` | The task that called, if any |
| `key` | `string` | Unique per call and stable across a restart. Pass it to outside APIs as an idempotency key, so a call repeated after a power cut is not paid twice. |
| `secret(name)` | `string` | Reads a vault key listed in the tool's or job's `secrets` |
| `cost(cents, what)` | `void` | Records extra spending in US cents |
| `log(text, data?)` | `void` | Adds a step to the calling task's log |

## `Tool`

| Field | Type | Meaning |
|---|---|---|
| `name` | `string` | `<app>.<verb>`. Tasks list it in `tools`. |
| `description` | `string` | Shown to the model |
| `input` | JSON Schema | The input's shape, shown to the model. Default `{type: 'object'}`. |
| `secrets` | `string[]` | Vault keys `run` may read |
| `hosts` | `string[]` | Hosts `run` talks to, for documentation. Tools run in the core, outside task network limits. |
| `cost(input)` | `number` | US cents this call will spend. Above the task's remaining budget, the broker asks for an OK first. |
| `approval(input)` | `{payee?, purpose?}` | Fields for the approval card: who gets paid and what for |
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

A standard Web `Request` in, a `Response` out. Routes run in the core. A route that throws returns 500 with `{"error": "..."}`. From outside the box a route needs a paired device's token, like the rest of the API, and a request relayed by a reverse proxy on the box counts as outside. A route that an outside service calls should still check its own shared secret, as the Jira app's routes do.

## `DemoKit`

An app's test step, `tracks/<name>/demo.ts`, default-exports `async (d: DemoKit) => { ... }`. The [test suite](/docs/reference/test-suite/) runs it against a fresh box with every app loaded.

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
