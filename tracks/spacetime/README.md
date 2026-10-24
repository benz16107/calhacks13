# Live: SpacetimeDB as the box's live state

Agents on one machine need to share work without colliding. The people responsible for them need to see every
request the moment it is asked, on every screen at once, and answer from wherever they are. Usually that takes a
database, a WebSocket server, a cache and a pile of auth glue, and it breaks in the gaps between them. An ordinary
operating system has nothing for it.

GurtOS runs one self-hosted SpacetimeDB per box as its live state. The box mirrors tasks and approvals into it,
agents share work queues through it, people answer through it, and the rules about who may see and do what are
enforced inside the database, in the same transaction as the change. For more than one machine, each box can
publish a status summary to SpacetimeDB Maincloud, where each viewer is sent only the machines that let them in.
It is light (one engine on the box, no extra services), open source, and part of the GurtOS suite. The action log
on disk stays the record of truth; SpacetimeDB is how that state moves.

**Best shown in:** all three editions, strongest in GurtOS Business (several people, routed requests).

## What is in it

| | Feature | Why it is there | Criterion | From |
|---|---|---|---|---|
| 1 | **A shared work queue with atomic claims, and agent presence** | Several agents split one job (one invoice, one customer, one file each). The `claimJob` procedure takes the oldest open job in one transaction, so two agents asking at the same instant get two different jobs. Each agent's row says what it is doing now. An agent whose task ends holding a job gives it back. | Agents coordinating | OS (module) + this app (tools) |
| 2 | **Each person is sent only their own requests** | In GurtOS Business a request routed to Rosa must not reach Priya's phone. Beside the public `approval` table (which the box's own screens read), each routed request is a row in a private table; the `my_requests` view sends each connection only what is routed to that person, whatever it subscribes to. A person's answer goes to the box's `answerAs`, so self-approval and limits still hold. | Live shared state, used safely | OS (module) |
| 3 | **No double approvals, with presence** | Two people can open the same request. Each sees "Rosa is viewing". The first answer wins inside the `answer` and `answerRequest` reducers, and the later one is refused with "already approved by Rosa Delgado", so a screen can say who won. Presence is per connection and clears when it drops. | Instant sync | OS (module) |
| 4 | **One live view across machines (Maincloud)** | An owner with a box at home, one in the cloud and a laptop wants one view. Opt in, and the box reports counts only (running, waiting, done and failed today, spent today, online) to `gurtos-fleet` on Maincloud. The `my_machines` view sends each viewer only the machines that granted them. Off removes the box and every grant. Never a prompt, a file or a key. | Live shared state across devices | This app (`fleet/`) |
| 5 | **Timers in the database** | "Remind Priya if Rosa hasn't answered in 4 hours" fires as a scheduled reducer: the request reaches Priya's live client at that moment, marked as a reminder. It nudges screens only; a phone push still comes from the core's push sender. The Business policy has no reminder line yet, so a route carries one only if Business adds `route.remind`. A sweep clears stale presence and old activity. On Maincloud a sweep marks a box offline when it stops reporting. | Real-time backend doing the work | OS (module) + `fleet/` |
| 6 | **Live cost and activity meters** | Running, waiting, done, failed and total spend are kept by the reducers as tasks change, plus activity per minute for the last day. No screen adds anything up; each is sent the change. | Instant sync | OS (module) |

"OS" means it is in `core/spacetime` and every box has it. "This app" means `tracks/spacetime`.

## How agents use the queue

A task never connects to SpacetimeDB: its network reaches only its own hosts, and the box's ports are refused.
It calls these tools through the box's broker, and the box calls the database for it, naming the task. So one
agent cannot claim as another. Every claim, finish and post is a `tool.call` and `tool.result` in the action log, and
jobs posted from the box's screen (`POST /t/spacetime/jobs`) write a `jobsPosted` note, so undo, resume and the
audit see them. The job and agent tables are a mirror: the log is the record.

| Tool | Does |
|---|---|
| `spacetime.claim {queue}` | The next open job, or `{job: null}` when the queue is empty. A call repeated after a power cut returns the job it already claimed. |
| `spacetime.finish {id, result, ok?}` | Done (or failed), with a short result others can read. Only the agent holding it can finish it. |
| `spacetime.post {queue, jobs}` | Put up to 200 jobs on a queue, for example one per customer. |
| `spacetime.team {queue}` | Who is on the queue, what each is doing, and how many jobs are open, in hand and done. |

Another app posts jobs without any code of ours: it writes a note to the action log,
`box.note({ jobs: { queue: 'credit-desk:apps', items: [{ title, payload }] } })`, and this app turns it into live jobs.
The box's screen can also post with `POST /t/spacetime/jobs {queue, jobs}` (each job a title string or `{title, payload?}`).

## The Live board

`/t/spacetime/` on the box. Meters across the top (running, waiting, done, spent, activity for the last 30
minutes), then three views: **Agents** (each queue as Open, In hand and Done, with every agent's status), **Requests**
(every waiting request, who is viewing it, Approve and Deny), and **Computers** (the Maincloud switch and every
machine that granted this screen a view). Every number on it arrives over SpacetimeDB subscriptions.

## The fleet view on Maincloud

| Request | Does |
|---|---|
| `GET /t/spacetime/fleet` | `{on, connected, database, identity, lastReport, error}` |
| `PUT /t/spacetime/fleet {on}` | The owner turns it on or off. Off calls `leave`: Maincloud forgets the box and its grants. |
| `POST /t/spacetime/fleet/viewers {identity, label}` | The owner lets one Maincloud identity see this box (the GurtOS app on a phone, a Business admin's laptop). |

A client subscribes to `SELECT * FROM my_machines` on `wss://maincloud.spacetimedb.com`, database `gurtos-fleet`,
with its own identity. The module is `fleet/src/index.ts`; publish it with
`spacetime publish --server maincloud --module-path tracks/spacetime/fleet gurtos-fleet`.

## The module's tables

| Table or view | Who reads it | Holds |
|---|---|---|
| `task`, `approval` | any screen on the box | the mirror of tasks and approvals (as before) |
| `job`, `agent` | any screen on the box | the queues and who is doing what |
| `meter`, `activity` | any screen on the box | the meters |
| `person`, `request`, `routed_to`, `viewer`, `device`, `owner` | nobody (private) | who is who, Business requests, routes, presence |
| `my_requests` (view) | each connection, its own rows | a person's routed requests; all of them for the box's screen |
| `viewers` (view) | each connection, its own rows | who else has a request open, for the requests it may see |

## Demo

`tracks/spacetime/demo.ts` runs in `./demo` with no network and no model:

1. Three agents make 15 claims on a queue of 12 jobs at once: 12 distinct jobs, none twice, 3 told it is empty. They
   end holding them, and all 12 go back on the queue. A fourth agent claims the oldest, finishes it, and reads the
   team: 1 done, 11 open. Then 30 claims at one instant for 10 jobs: 10 distinct jobs, 20 empty answers.
2. Two paired phones (on loopback, each with its own SpacetimeDB identity) on one request: Priya's phone shows "Rosa's phone is viewing". Both approve at the same instant;
   one answer wins in the reducer and the other is told who answered first. The box logs one answer and the task
   carries on. Rosa disconnects and her viewing clears.
3. Business, on a scratch database the step publishes: a request routed to Rosa reaches only Rosa's live client;
   Priya's and a stranger's get nothing, and the request table cannot be read. After 3 seconds a scheduled reducer
   brings Priya in and her client receives it, marked as a reminder. Both answer at once: one stands.
4. The meter in SpacetimeDB matches the box's own task list.

`DEMO_LIVE=spacetime ./demo` adds the Maincloud fleet view: opt in, a granted viewer sees the box live with its
waiting request, a stranger sees nothing, and opting out removes it.

## Limits

- SpacetimeDB listens on the box only, so only the box's own screen subscribes to it. The Live board on any other
  screen (a paired phone or laptop) is shown the same data from `GET /t/spacetime/snapshot`, every 2 seconds, and answers
  through the box's API. Phones do not connect to SpacetimeDB; that is deliberate.
- Per-person visibility is enforced by the database for any connection that reaches it. Today those are the box's own
  screens and local helpers; the public `approval` table, which the box's screens read, still holds every approval.
- The module is republished at every boot (and emptied if its schema changed), and the box refills tasks, approvals,
  people and the meter. Open jobs and agent rows live only in SpacetimeDB: after a reset they are gone, and the log
  still records every post, claim and result. Reminders restart their clock when the box refills a pending request.
- Maincloud's free tier pauses an idle database; the first report wakes it in about a second.
