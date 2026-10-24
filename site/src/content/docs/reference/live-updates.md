---
title: Live updates
description: The SpacetimeDB tables and reducers that carry live task status and approvals to the box's own screen, and the log stream phones follow instead.
---

The portal shows task status and approvals as they change. The box mirrors both into SpacetimeDB, which runs on the box, and the box's own screen subscribes to it. A phone or a laptop follows the box's authenticated API and its log stream instead. The action log on disk stays the source of truth: SpacetimeDB is a copy the box refills whenever it reconnects.

## Where it runs

| Setting | Value |
|---|---|
| Address | `ws://127.0.0.1:3000`. SpacetimeDB listens on loopback only, unless `STDB_LISTEN` in `/etc/box/stdb.env` names another address. |
| Database | `box` by default. [`BOX_STDB_DB`](/reference/environment/) changes it. |
| Service | `spacetimedb.service`, data in `/var/lib/spacetimedb` |

At boot the box publishes its module and becomes the database's owner. Whoever publishes owns the database, so only the box can write tasks and approvals. If SpacetimeDB is down, the box keeps working and catches up when it returns.

## Tables

Both tables are public: any client can subscribe to them.

### `task`

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

### `approval`

| Column | Type | Meaning |
|---|---|---|
| `id` | string, primary key | `<task id>.<key>` |
| `task` | string | The task that asked |
| `question` | string | The question shown to people |
| `costCents` | u32 | The spending being asked about. 0 when it is not about money. |
| `payee` | string | Who gets paid, or the host being reached. Empty if not given. |
| `purpose` | string | What the spend is for. Empty if not given. |
| `state` | string | `pending`, `approved` or `denied` |
| `by` | string | Who answered. Empty while pending. |

The inbox is the rows where `state` is `pending`.

## Reducers

| Reducer | Who may call it | Does |
|---|---|---|
| `answer({id, approved, by})` | A connection the box has vouched for | Answers a pending approval. The first answer wins; later answers change nothing. The answer is recorded under the name the box vouched with (`box screen`, or the phone's device name); the `by` the caller sends is ignored. Any other connection is refused. The box sees the answer within milliseconds and writes `approval.answered` to its log. |
| `registerDevice({identity, name, at})`, `removeDevice({identity})` | The box only | Vouch for a connection, or forget it. The vouched identities live in a private `device` table that clients cannot read. |
| `putTask(row)` | The box only | Inserts or updates a task row |
| `putApproval(row)` | The box only | Inserts or updates an approval row. An answered approval is never set back to pending. |

`putTask`, `putApproval`, `registerDevice` and `removeDevice` refuse any caller that is not the identity that published the module.

To be vouched for, a client connects, then tells the box its identity with `POST /api/pair/identity {identity}` (64 hex characters, `identity.toHexString()`). The box accepts that from its own screen, or from a paired phone with its token, and registers the identity under that device's name.

:::caution
SpacetimeDB has no login. Anyone who can reach port 3000 can read every task, though only a vouched connection can answer an approval. That is why it listens on `127.0.0.1` by default, and the OS image's firewall never opens port 3000. Set `STDB_LISTEN` only to an address on a network you trust. Other devices use the [HTTP API](/reference/http-api/#who-may-call-what), which needs a paired device's token.
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
spacetime generate --lang typescript --module-path core/spacetime
```

## Column names

Columns are camelCase in the TypeScript client and snake_case in SQL. `costCents` in TypeScript is `cost_cents` in a query:

```sql
SELECT id, question, cost_cents FROM approval WHERE state = 'pending'
```

## Phones, laptops, and when SpacetimeDB is out of reach

Away from the box, the portal follows the action log's event stream, `GET /api/log/stream?access_token=<token>`, and answers approvals with `POST /api/approvals/<id>` and its device token, so the log names the device. Both carry the same information, from the log itself. See [Following the action log](/reference/http-api/#following-the-action-log).

A client that cannot use either can poll `GET /api/tasks` and `GET /api/approvals?state=pending`.

## Related

- [Approvals and budgets](/concepts/approvals-and-budgets/)
- [The action log](/concepts/action-log/)
- [Environment variables](/reference/environment/): `BOX_STDB_URL`, `BOX_STDB_DB`, `BOX_STDB`
