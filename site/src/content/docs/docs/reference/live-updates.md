---
title: Live updates
description: The SpacetimeDB tables and reducers that carry live task status and approvals to the box's own screen, and the log stream phones follow instead.
---

The portal shows task status and approvals as they change. The box mirrors both into SpacetimeDB, which runs on the box, and the portal subscribes to it when it is open on the box itself (an address of `127.0.0.1`, `localhost` or `[::1]`). A phone or a laptop follows the box's authenticated API and its log stream instead. The action log on disk stays the source of truth: SpacetimeDB is a copy the box refills whenever it reconnects.

## Where it runs

| Setting | Value |
|---|---|
| Address | `ws://127.0.0.1:3000`. SpacetimeDB listens on loopback only, unless `STDB_LISTEN` in `/etc/box/stdb.env` names another address. [`BOX_STDB_URL`](/docs/reference/environment/) changes where the box connects. |
| Database | `box` by default. [`BOX_STDB_DB`](/docs/reference/environment/) changes it. |
| Service | `spacetimedb.service`, data in `/var/lib/spacetimedb` |

At boot the box publishes its module and becomes the database's owner. Whoever publishes owns the database, so only the box can write tasks and approvals. The box logs a failed publish and goes on, and the screens use the log stream. If SpacetimeDB is down, or goes away later, the box keeps working. It reconnects (after 2 seconds, or 5 after a failed connect) and refills the tables from its log. `BOX_STDB=off` skips SpacetimeDB.

## Tables

### `task` and `approval`

The box mirrors these two. Both are public: any client can subscribe to them.

**`task`**

| Column | Type | Meaning |
|---|---|---|
| `id` | string, primary key | The task id |
| `title` | string | |
| `state` | string | `queued`, `running`, `waiting`, `done`, `failed` or `undone` |
| `source` | string | Who started it |
| `workspace` | string | |
| `worker` | string | `droid` or `fake` |
| `costCents` | u32 | Tool spending plus model cost, rounded to a whole cent |
| `budgetCents` | u32 | |
| `updatedAt` | string | ISO 8601 time |
| `step` | string | The latest step: what it is doing now |
| `note` | string | The error if it failed, else its summary |

**`approval`**

| Column | Type | Meaning |
|---|---|---|
| `id` | string, primary key | `<task id>.<key>`. The key is `budget.<action>` for the box's own spend question, `task.<key>` for a question the task asked, `tool.<call>.ask.<hash>` for one a tool asked, or `shadow.<action>` for a Business shadow request. |
| `task` | string | The task that asked |
| `question` | string | The question shown to people |
| `costCents` | u32 | The spending being asked about. 0 when it is not about money. |
| `payee` | string | Who gets paid, or the host being reached. Empty if not given. |
| `purpose` | string | What the spend is for. Empty if not given. |
| `state` | string | `pending`, `approved` or `denied` |
| `by` | string | Who answered. Empty while pending. |

The inbox is the rows where `state` is `pending`.

### Work queue and meters

These four are public too. The box fills them for apps and the home screen.

| Table | Columns |
|---|---|
| `job` | `id` (u64, auto), `queue`, `title`, `payload`, `state` (`open`, `claimed`, `done` or `failed`), `agent` (the task holding it, empty while open), `agentName`, `claimKey`, `result`, `postedAt`, `updatedAt`. Agents share a queue through the box's `spacetime` tools. A finished task's claimed jobs go back on the queue. |
| `agent` | `task` (primary key), `name`, `queue`, `status` (`working`, `idle`, `waiting` or `gone`), `job`, `jobTitle`, `done` (jobs finished), `at` |
| `meter` | One row, `id` 0: `queued`, `running`, `waiting`, `done`, `failed`, `undone` (u32 counts of tasks), `spentCents` (u64), `at` |
| `activity` | One row per minute, `minute` (UTC, like `2026-10-24T14:05`, the primary key): `steps`, `costCents`, `asked`, `finished`, `failed`. Rows older than a day are dropped every 10 minutes. |

### GurtOS Business

Requests that the policy routes to people live in tables that clients cannot read directly: `request`, `routed_to`, `person`, `viewer` and `reminder`. Two public views send each connection only its own part:

- `my_requests` returns the requests routed to the connected person. The box's own screen and an owner's devices get every request. Its columns are the `approval` columns plus `person`, `askedBy`, `rule`, `to`, `why`, `at`, `reminded`, `canApprove` and `remindedMe`.
- `viewers` returns who else has one of those requests open (`id`, `name`, `person`, `since`), for "Rosa is viewing".

The tables `owner`, `device` and `sweep_timer` are private too. See [Turn on Business](/docs/guides/turn-on-business/).

## Reducers

| Reducer | Who may call it | Does |
|---|---|---|
| `answer({id, approved, by})` | A connection the box has vouched for | Answers a pending approval. The first answer wins; a later one is refused with `already approved by <name>` (or `denied`). The answer is recorded under the name the box vouched with (`box screen`, or the phone's device name); the `by` the caller sends is ignored. Any other connection is refused. The box sees the answer within milliseconds and writes `approval.answered` to its log. |
| `answerRequest({id, approved})` | A person's connection, on a Business box | Answers a request routed to that person. It refuses their own request, and an approval above their limit (they may still deny). The box then runs its own checks as that person, and if they refuse, the request goes back to pending. |
| `look({id})` | A vouched connection or a person | Says which request this connection has open, for `viewers`. An empty `id` clears it. |
| `registerDevice({identity, name, at})`, `removeDevice({identity})`, `registerPerson({identity, person, name, at})`, `removePerson({person, identity})` | The box only | Vouch for a connection, or forget it. The vouched identities live in private tables. |
| `putTask(row)`, `putApproval(row)`, `putRequest(row)` | The box only | Insert or update a row. An answered approval is never set back to pending. `putRequest` can reopen a request the box refused. |
| `recountMeter()`, `postJobs({queue, jobs})`, `finishJob({id, agent, ok, result})`, and the `claimJob` procedure | The box only | Keep the meter, and run the work queue. A claim is atomic, so two agents never get the same job. |

Every reducer marked "the box only" refuses any caller that is not the identity that published the module. Two timer reducers, `remind` and `sweep`, run from the database's own schedule and refuse everyone else.

On a Business box the box vouches for people, not for devices, so `answer` is refused there and people use `answerRequest`.

To be vouched for, a client connects, then tells the box its identity with `POST /api/pair/identity {identity}` (64 hex characters, `identity.toHexString()`). The box accepts that from its own screen, or from a paired phone with its token, and registers the identity under that device's name. A Watch token cannot do this, because a Watch answers through the HTTP API, where its approval limit applies.

:::caution
SpacetimeDB has no login. Anyone who can reach port 3000 can read every task, though only a vouched connection can answer an approval. That is why it listens on `127.0.0.1` by default, and the OS image's firewall never opens port 3000. Set `STDB_LISTEN` only to an address on a network you trust. Other devices use the [HTTP API](/docs/reference/http-api/#who-may-call-what), which needs a paired device's token.
:::

## TypeScript client

Install the client at the version the box uses, and import the generated bindings from `core/spacetime/bindings/`:

```sh
npm i spacetimedb@2.13.0
```

```ts
import { DbConnection } from '../core/spacetime/bindings/index.ts';

DbConnection.builder()
  .withUri(`ws://${location.hostname}:3000`)
  .withDatabaseName('box')
  .onConnect((conn) => {
    conn.db.task.onInsert((_ctx, task) => render(task));
    conn.db.task.onUpdate((_ctx, _old, task) => render(task));
    conn.db.approval.onInsert((_ctx, a) => renderInbox(a));
    conn.db.approval.onUpdate((_ctx, _old, a) => renderInbox(a));
    conn.subscriptionBuilder().subscribeToAllTables();
  })
  .build();

// An Approve button:
// conn.reducers.answer({ id: approval.id, approved: true, by: 'phone' });
```

To generate bindings for another app, run this from the source tree:

```sh
spacetime generate --lang typescript --out-dir <your folder> --module-path core/spacetime
```

The module is `core/spacetime/src/index.ts`. `core/spacetime/generate.sh` regenerates the bindings in the tree after you change it.

## Column names

Columns are camelCase in the TypeScript client and snake_case in SQL. `costCents` in TypeScript is `cost_cents` in a query:

```sql
SELECT id, question, cost_cents FROM approval WHERE state = 'pending'
```

## Phones, laptops, and when SpacetimeDB is out of reach

Away from the box, the portal follows the action log's event stream, `GET /api/log/stream?access_token=<token>`, and answers approvals with `POST /api/approvals/<id>` and its device token, so the log names the device. Both carry the same information, from the log itself. See [Following the action log](/docs/reference/http-api/#following-the-action-log).

A client that cannot use either can poll `GET /api/tasks` and `GET /api/approvals?state=pending`.

## Related

- [Approvals and budgets](/docs/concepts/approvals-and-budgets/)
- [The action log](/docs/concepts/action-log/)
- [Environment variables](/docs/reference/environment/): `BOX_STDB_URL`, `BOX_STDB_DB`, `BOX_STDB`
