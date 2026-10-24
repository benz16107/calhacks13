// The box's live state in SpacetimeDB: what the portal, the phones and the agents share, as it happens.
// The action log on disk is the truth. The box mirrors tasks and approvals here; people answer approvals here;
// agents (through the box's tools) share a work queue here; GurtOS Business requests reach only the people they
// are routed to; timers fire here. Only the box (whoever published the module) writes the mirrored tables.
import { ScheduleAt, Timestamp } from 'spacetimedb';
import { SenderError, schema, t, table, type InferSchema, type ReducerCtx } from 'spacetimedb/server';

const taskCols = {
  id: t.string(),
  title: t.string(),
  state: t.string(),
  source: t.string(),
  workspace: t.string(),
  worker: t.string(),
  costCents: t.u32(),
  budgetCents: t.u32(),
  updatedAt: t.string(),
  /** The latest step: what it is doing now. */
  step: t.string(),
  /** The error if it failed, else its summary. */
  note: t.string(),
};
const approvalCols = {
  id: t.string(),
  task: t.string(),
  question: t.string(),
  costCents: t.u32(),
  payee: t.string(),
  purpose: t.string(),
  state: t.string(),
  by: t.string(),
};
/** A GurtOS Business approval, routed by the policy. Never public: only the people it is routed to are sent it. */
const requestCols = {
  ...approvalCols,
  /** The id of the person who answered. */
  person: t.string(),
  /** The id of the person who asked for the task. They may not answer it. */
  askedBy: t.string(),
  /** The policy line that matched, who it goes to, and one sentence for people. */
  rule: t.string(),
  to: t.string(),
  why: t.string(),
};
const routedPerson = t.object('RoutedPerson', { person: t.string(), name: t.string(), canApprove: t.bool() });

const job = table(
  { public: true },
  {
    id: t.u64().primaryKey().autoInc(),
    /** Which queue: 'credit-desk:applications', 'fetch:team'. Agents claim from one queue. */
    queue: t.string().index('btree'),
    title: t.string(),
    /** What the job needs, as the poster wrote it (JSON or text). No secrets: every screen on the box sees it. */
    payload: t.string(),
    /** open, claimed, done, failed */
    state: t.string(),
    /** The task holding it, '' while open. */
    agent: t.string().index('btree'),
    agentName: t.string(),
    /** The tool call that claimed it: the same call after a power cut gets the same job back. */
    claimKey: t.string(),
    result: t.string(),
    postedAt: t.timestamp(),
    updatedAt: t.timestamp(),
  },
);
const reminder = table(
  {},
  {
    scheduledId: t.u64().primaryKey().autoInc(),
    scheduledAt: t.scheduleAt(),
    request: t.string().index('btree'),
    person: t.string(),
    name: t.string(),
    canApprove: t.bool(),
  },
);
const sweepTimer = table({}, { scheduledId: t.u64().primaryKey().autoInc(), scheduledAt: t.scheduleAt() });

const spacetimedb = schema({
  owner: table({}, { identity: t.identity().primaryKey() }),
  // Identities the box has vouched for: a paired phone, or the box's own screen. Private: not readable by clients.
  device: table({}, { identity: t.identity().primaryKey(), name: t.string(), at: t.string() }),
  task: table({ public: true }, { ...taskCols, id: t.string().primaryKey() }),
  approval: table({ public: true }, { ...approvalCols, id: t.string().primaryKey(), state: t.string().index('btree') }),

  // ---- 1. Agents coordinate: a shared work queue with atomic claims, and who is doing what ----
  job,
  agent: table(
    { public: true },
    {
      /** The task id: one agent is one task. */
      task: t.string().primaryKey(),
      name: t.string(),
      queue: t.string(),
      /** working, idle, waiting (for an OK), gone (the task ended) */
      status: t.string(),
      job: t.u64(),
      jobTitle: t.string(),
      /** Jobs it has finished. */
      done: t.u32(),
      at: t.timestamp(),
    },
  ),

  // ---- 2 and 3. GurtOS Business: requests reach only their people; first answer wins; who is looking ----
  // A person's connection, vouched for by the box when their paired phone or laptop says which identity it holds.
  person: table({}, { identity: t.identity().primaryKey(), person: t.string().index('btree'), name: t.string(), at: t.string() }),
  request: table({}, { ...requestCols, id: t.string().primaryKey(), state: t.string().index('btree'), at: t.timestamp(), reminded: t.string() }),
  /** Who a request is routed to. `canApprove` is false above their limit: they may still deny. */
  routedTo: table(
    {},
    {
      key: t.string().primaryKey(),
      request: t.string().index('btree'),
      person: t.string().index('btree'),
      name: t.string(),
      canApprove: t.bool(),
      /** Added by a reminder timer, not by the policy at the time of asking. */
      reminded: t.bool(),
    },
  ),
  /** What each connection has open right now: "Rosa is viewing". Gone when it disconnects. */
  viewer: table({}, { conn: t.connectionId().primaryKey(), identity: t.identity(), id: t.string().index('btree'), name: t.string(), person: t.string(), since: t.timestamp() }),

  // ---- 5. Timers in the database ----
  reminder,
  sweepTimer,

  // ---- 6. Live meters ----
  /** One row: how many tasks are in each state and the total spent, kept by putTask as tasks change. */
  meter: table(
    { public: true },
    { id: t.u8().primaryKey(), queued: t.u32(), running: t.u32(), waiting: t.u32(), done: t.u32(), failed: t.u32(), undone: t.u32(), spentCents: t.u64(), at: t.timestamp() },
  ),
  /** Activity per minute ('2026-10-24T14:05'), for the last 24 hours: steps, cents spent, requests asked, tasks finished and failed. */
  activity: table(
    { public: true },
    { minute: t.string().primaryKey(), steps: t.u32(), costCents: t.u32(), asked: t.u32(), finished: t.u32(), failed: t.u32() },
  ),
});
export default spacetimedb;

type Ctx = ReducerCtx<InferSchema<typeof spacetimedb>>;
const SECOND = 1_000_000n;

// Whoever publishes the module is the box. Only the box may write tasks and approvals.
export const init = spacetimedb.init((ctx) => {
  ctx.db.owner.insert({ identity: ctx.sender });
  ctx.db.sweepTimer.insert({ scheduledId: 0n, scheduledAt: ScheduleAt.interval(600n * SECOND) });
});

const mustBeBox = (ctx: { sender: any; db: any }) => {
  if (!ctx.db.owner.identity.find(ctx.sender)) throw new SenderError('only the box may do this');
};

// ---------- meters: kept as the mirror changes, so no screen ever adds them up ----------

const minuteOf = (ts: Timestamp) => ts.toDate().toISOString().slice(0, 16);
function count(ctx: Ctx, add: { steps?: number; costCents?: number; asked?: number; finished?: number; failed?: number }) {
  const minute = minuteOf(ctx.timestamp);
  const old = ctx.db.activity.minute.find(minute) ?? { minute, steps: 0, costCents: 0, asked: 0, finished: 0, failed: 0 };
  const row = {
    minute,
    steps: old.steps + (add.steps ?? 0),
    costCents: old.costCents + (add.costCents ?? 0),
    asked: old.asked + (add.asked ?? 0),
    finished: old.finished + (add.finished ?? 0),
    failed: old.failed + (add.failed ?? 0),
  };
  if (ctx.db.activity.minute.find(minute)) ctx.db.activity.minute.update(row);
  else ctx.db.activity.insert(row);
}
const STATES = ['queued', 'running', 'waiting', 'done', 'failed', 'undone'] as const;
function meter(ctx: Ctx, oldState: string | undefined, newState: string, costDelta: number) {
  const m = ctx.db.meter.id.find(0) ?? { id: 0, queued: 0, running: 0, waiting: 0, done: 0, failed: 0, undone: 0, spentCents: 0n, at: ctx.timestamp };
  const row: Record<string, any> = { ...m, at: ctx.timestamp, spentCents: m.spentCents + BigInt(costDelta) };
  if (oldState && (STATES as readonly string[]).includes(oldState)) row[oldState] = Math.max(0, row[oldState] - 1);
  if ((STATES as readonly string[]).includes(newState)) row[newState] += 1;
  if (ctx.db.meter.id.find(0)) ctx.db.meter.id.update(row as typeof m);
  else ctx.db.meter.insert(row as typeof m);
}

// ---------- the mirror ----------

export const putTask = spacetimedb.reducer(taskCols, (ctx, row) => {
  mustBeBox(ctx);
  const old = ctx.db.task.id.find(row.id);
  if (old) ctx.db.task.id.update(row);
  else ctx.db.task.insert(row);
  if (old?.state !== row.state || old.costCents !== row.costCents) meter(ctx, old?.state, row.state, row.costCents - (old?.costCents ?? 0));
  const moved = old?.state !== row.state;
  count(ctx, {
    steps: old && row.step && old.step !== row.step ? 1 : 0,
    costCents: Math.max(0, row.costCents - (old?.costCents ?? row.costCents)),
    finished: old && moved && row.state === 'done' ? 1 : 0,
    failed: old && moved && row.state === 'failed' ? 1 : 0,
  });
  if (moved) agentFollows(ctx, row.id, row.state);
});

/** Count the meter again from the task table: after the box refills it, and on a box upgraded from an older module. */
export const recountMeter = spacetimedb.reducer((ctx) => {
  mustBeBox(ctx);
  const row: Record<string, any> = { id: 0, queued: 0, running: 0, waiting: 0, done: 0, failed: 0, undone: 0, spentCents: 0n, at: ctx.timestamp };
  for (const t of ctx.db.task.iter()) {
    if ((STATES as readonly string[]).includes(t.state)) row[t.state] += 1;
    row.spentCents += BigInt(t.costCents);
  }
  if (ctx.db.meter.id.find(0)) ctx.db.meter.id.update(row as any);
  else ctx.db.meter.insert(row as any);
});

export const putApproval = spacetimedb.reducer(approvalCols, (ctx, row) => {
  mustBeBox(ctx);
  const old = ctx.db.approval.id.find(row.id);
  if (!old) {
    ctx.db.approval.insert(row);
    if (row.state === 'pending') count(ctx, { asked: 1 });
  } else if (old.state === 'pending' || row.state !== 'pending') ctx.db.approval.id.update(row); // an answer is never undone
});

/** The box vouches for a connection: it may now answer approvals, under this name. Only the box may call it. */
export const registerDevice = spacetimedb.reducer({ identity: t.identity(), name: t.string(), at: t.string() }, (ctx, row) => {
  mustBeBox(ctx);
  if (ctx.db.device.identity.find(row.identity)) ctx.db.device.identity.update(row);
  else ctx.db.device.insert(row);
  // A screen reconnects with a new identity each time; keep the table small by dropping the oldest beyond 200.
  const all = [...ctx.db.device.iter()].sort((a, b) => a.at.localeCompare(b.at));
  for (const old of all.slice(0, Math.max(0, all.length - 200))) ctx.db.device.identity.delete(old.identity);
});

export const removeDevice = spacetimedb.reducer({ identity: t.identity() }, (ctx, { identity }) => {
  mustBeBox(ctx);
  ctx.db.device.identity.delete(identity);
});

/**
 * Answer an approval. Only a connection the box has vouched for may (see registerDevice), and the answer is
 * recorded under that connection's registered name: whatever `by` the caller sends is ignored. The first answer
 * wins; a later one is refused with who answered first, so that screen can say "Already approved by ...".
 */
export const answer = spacetimedb.reducer({ id: t.string(), approved: t.bool(), by: t.string() }, (ctx, { id, approved }) => {
  const who = ctx.db.device.identity.find(ctx.sender);
  if (!who) throw new SenderError('this connection is not a paired phone or the box\'s own screen');
  const a = ctx.db.approval.id.find(id);
  if (!a) throw new SenderError(`no approval ${id}`);
  if (a.state !== 'pending') throw new SenderError(`already ${a.state} by ${a.by || 'someone'}`);
  ctx.db.approval.id.update({ ...a, state: approved ? 'approved' : 'denied', by: who.name });
});

// ---------- 1. the work queue ----------

/** Put jobs on a queue, all at once. The box calls it for a track or for a task's `spacetime.post`. */
export const postJobs = spacetimedb.reducer({ queue: t.string(), jobs: t.array(t.object('NewJob', { title: t.string(), payload: t.string() })) }, (ctx, { queue, jobs }) => {
  mustBeBox(ctx);
  if (!queue) throw new SenderError('name the queue');
  for (const j of jobs) {
    ctx.db.job.insert({ id: 0n, queue, title: j.title, payload: j.payload, state: 'open', agent: '', agentName: '', claimKey: '', result: '', postedAt: ctx.timestamp, updatedAt: ctx.timestamp });
  }
});

function setAgent(ctx: Ctx, task: string, change: Partial<{ name: string; queue: string; status: string; job: bigint; jobTitle: string; done: number }>) {
  const old = ctx.db.agent.task.find(task);
  const row = { task, name: '', queue: '', status: 'idle', job: 0n, jobTitle: '', done: 0, ...old, ...change, at: ctx.timestamp };
  if (old) ctx.db.agent.task.update(row);
  else ctx.db.agent.insert(row);
}

/** A job this agent still holds, if any. */
const holding = (ctx: Ctx, agent: string) => [...ctx.db.job.agent.filter(agent)].find((j) => j.state === 'claimed');

/** An agent's task changed state: a finished task's claimed jobs go back on the queue for another agent. */
function agentFollows(ctx: Ctx, task: string, state: string) {
  const a = ctx.db.agent.task.find(task);
  if (['done', 'failed', 'undone'].includes(state)) {
    for (const j of [...ctx.db.job.agent.filter(task)]) {
      if (j.state === 'claimed') ctx.db.job.id.update({ ...j, state: 'open', agent: '', agentName: '', claimKey: '', updatedAt: ctx.timestamp });
    }
    if (a) setAgent(ctx, task, { status: 'gone', job: 0n, jobTitle: '' });
  } else if (a && a.status !== 'gone') {
    setAgent(ctx, task, { status: state === 'waiting' ? 'waiting' : a.job ? 'working' : 'idle' });
  }
}

/**
 * Claim the oldest open job on a queue for one agent, in one transaction. Two agents asking at the same moment
 * get two different jobs, or one gets nothing: SpacetimeDB runs the transactions one after the other.
 * Returns the job, or nothing when the queue is empty. The box calls it for the task that asked, with the tool
 * call's key, so a call repeated after a power cut returns the job it already claimed.
 */
export const claimJob = spacetimedb.procedure({ queue: t.string(), agent: t.string(), name: t.string(), key: t.string() }, t.option(job.rowType), (ctx, { queue, agent, name, key }) =>
  ctx.withTx((tx) => {
    mustBeBox(tx);
    const again = key ? [...tx.db.job.agent.filter(agent)].find((j) => j.claimKey === key) : undefined;
    if (again) return again;
    let next: any;
    for (const j of tx.db.job.queue.filter(queue)) if (j.state === 'open' && (!next || j.id < next.id)) next = j;
    if (!next) {
      const held = holding(tx as Ctx, agent);
      setAgent(tx as Ctx, agent, { name, queue, status: held ? 'working' : 'idle', job: held?.id ?? 0n, jobTitle: held?.title ?? '' });
      return undefined;
    }
    const row = tx.db.job.id.update({ ...next, state: 'claimed', agent, agentName: name, claimKey: key, updatedAt: tx.timestamp });
    setAgent(tx as Ctx, agent, { name, queue, status: 'working', job: row.id, jobTitle: row.title });
    return row;
  }),
);

/** The agent that holds a job reports it done (or failed) with its result. */
export const finishJob = spacetimedb.reducer({ id: t.u64(), agent: t.string(), ok: t.bool(), result: t.string() }, (ctx, { id, agent, ok, result }) => {
  mustBeBox(ctx);
  const j = ctx.db.job.id.find(id);
  if (!j) throw new SenderError(`no job ${id}`);
  if (j.agent !== agent || j.state !== 'claimed') throw new SenderError(`job ${id} is not held by this agent (${j.state}${j.agentName ? `, ${j.agentName}` : ''})`);
  ctx.db.job.id.update({ ...j, state: ok ? 'done' : 'failed', result, updatedAt: ctx.timestamp });
  const a = ctx.db.agent.task.find(agent);
  const held = holding(ctx, agent);
  setAgent(ctx, agent, { status: held ? 'working' : 'idle', job: held?.id ?? 0n, jobTitle: held?.title ?? '', done: (a?.done ?? 0) + 1 });
});

// ---------- 2. Business: requests reach only the people they are routed to ----------

export const registerPerson = spacetimedb.reducer({ identity: t.identity(), person: t.string(), name: t.string(), at: t.string() }, (ctx, row) => {
  mustBeBox(ctx);
  if (ctx.db.person.identity.find(row.identity)) ctx.db.person.identity.update(row);
  else ctx.db.person.insert(row);
});

/** Forget a person's connections: removed from the company, or one phone revoked (with `identity`). */
export const removePerson = spacetimedb.reducer({ person: t.string(), identity: t.option(t.identity()) }, (ctx, { person, identity }) => {
  mustBeBox(ctx);
  if (identity) ctx.db.person.identity.delete(identity);
  else for (const p of [...ctx.db.person.person.filter(person)]) ctx.db.person.identity.delete(p.identity);
});

/**
 * The box mirrors a routed request: the request itself and the people the policy sends it to. `remind` people are
 * added by a timer if it is still pending after `remindAfterSec` (see `remind`). `reopen` puts an answer back to
 * pending, for when the box's own checks refused it.
 */
export const putRequest = spacetimedb.reducer(
  { ...requestCols, people: t.array(routedPerson), remind: t.array(routedPerson), remindAfterSec: t.u32(), reopen: t.bool() },
  (ctx, { people, remind, remindAfterSec, reopen, ...row }) => {
    mustBeBox(ctx);
    const old = ctx.db.request.id.find(row.id);
    if (!old) {
      ctx.db.request.insert({ ...row, at: ctx.timestamp, reminded: '' });
      if (row.state === 'pending') count(ctx, { asked: 1 });
      if (row.state === 'pending' && remindAfterSec > 0) {
        const at = ScheduleAt.time(ctx.timestamp.microsSinceUnixEpoch + BigInt(remindAfterSec) * SECOND);
        for (const p of remind) ctx.db.reminder.insert({ scheduledId: 0n, scheduledAt: at, request: row.id, ...p });
      }
    } else if (old.state === 'pending' || row.state !== 'pending' || reopen) {
      ctx.db.request.id.update({ ...old, ...row }); // an answer is never undone, unless the box refused it
    }
    for (const r of [...ctx.db.routedTo.request.filter(row.id)]) if (!r.reminded) ctx.db.routedTo.key.delete(r.key);
    for (const p of people) {
      const key = `${row.id}/${p.person}`;
      if (ctx.db.routedTo.key.find(key)) ctx.db.routedTo.key.update({ key, request: row.id, ...p, reminded: false });
      else ctx.db.routedTo.insert({ key, request: row.id, ...p, reminded: false });
    }
    if (row.state !== 'pending') for (const r of [...ctx.db.reminder.request.filter(row.id)]) ctx.db.reminder.scheduledId.delete(r.scheduledId);
  },
);

/**
 * A person answers a request routed to them. The first answer wins, here, in one transaction: a second person
 * gets "already approved by Rosa Delgado". The box then runs its own checks on the answer, as that person.
 */
export const answerRequest = spacetimedb.reducer({ id: t.string(), approved: t.bool() }, (ctx, { id, approved }) => {
  const p = ctx.db.person.identity.find(ctx.sender);
  if (!p) throw new SenderError('only a person can answer: this connection is not paired to anyone');
  const q = ctx.db.request.id.find(id);
  const r = ctx.db.routedTo.key.find(`${id}/${p.person}`);
  if (!q || !r) throw new SenderError('this request is not routed to you');
  if (q.state !== 'pending') throw new SenderError(`already ${q.state} by ${q.by || 'someone'}`);
  if (q.askedBy === p.person) throw new SenderError('You asked for this, so someone else has to answer it.');
  if (approved && !r.canApprove) throw new SenderError('This is above your limit: you can deny it, but someone else has to approve it.');
  ctx.db.request.id.update({ ...q, state: approved ? 'approved' : 'denied', by: p.name, person: p.person });
});

// ---------- 3. who is looking at a request ----------

/** Say which request or approval this connection has open ('' when it closes it). People only see their own. */
export const look = spacetimedb.reducer({ id: t.string() }, (ctx, { id }) => {
  const p = ctx.db.person.identity.find(ctx.sender);
  const d = ctx.db.device.identity.find(ctx.sender);
  if (!p && !d) throw new SenderError('this connection is not a paired phone, a person or the box\'s own screen');
  if (!ctx.connectionId) throw new SenderError('say what you are viewing over a live connection');
  ctx.db.viewer.conn.delete(ctx.connectionId);
  if (!id) return;
  if (p && !ctx.db.routedTo.key.find(`${id}/${p.person}`)) throw new SenderError('this request is not routed to you');
  ctx.db.viewer.insert({ conn: ctx.connectionId, identity: ctx.sender, id, name: p?.name ?? d!.name, person: p?.person ?? '', since: ctx.timestamp });
});

export const onDisconnect = spacetimedb.clientDisconnected((ctx) => {
  if (ctx.connectionId) ctx.db.viewer.conn.delete(ctx.connectionId);
});

// ---------- 5. timers ----------

/** A reminder is due: if the request is still pending, it now also reaches this person, marked as a reminder. */
export const remind = spacetimedb.reducer({ onSchedule: reminder }, { arg: reminder.rowType }, (ctx, { arg }) => {
  if (!ctx.sender.isEqual(ctx.identity)) throw new SenderError('only the database\'s own timer runs reminders');
  const q = ctx.db.request.id.find(arg.request);
  if (!q || q.state !== 'pending') return;
  const key = `${arg.request}/${arg.person}`;
  if (!ctx.db.routedTo.key.find(key)) ctx.db.routedTo.insert({ key, request: arg.request, person: arg.person, name: arg.name, canApprove: arg.canApprove, reminded: true });
  ctx.db.request.id.update({ ...q, reminded: q.reminded ? `${q.reminded}, ${arg.name}` : arg.name });
});

/** Every 10 minutes: drop activity older than a day, and viewers left behind by a crashed connection. */
export const sweep = spacetimedb.reducer({ onSchedule: sweepTimer }, { arg: sweepTimer.rowType }, (ctx) => {
  if (!ctx.sender.isEqual(ctx.identity)) throw new SenderError('only the database\'s own timer runs the sweep');
  const dayAgo = minuteOf(new Timestamp(ctx.timestamp.microsSinceUnixEpoch - 86_400n * SECOND));
  for (const a of [...ctx.db.activity.iter()]) if (a.minute < dayAgo) ctx.db.activity.minute.delete(a.minute);
  const hourAgo = ctx.timestamp.microsSinceUnixEpoch - 3600n * SECOND;
  for (const v of [...ctx.db.viewer.iter()]) if (v.since.microsSinceUnixEpoch < hourAgo) ctx.db.viewer.conn.delete(v.conn);
});

// ---------- views: what each connection is sent ----------

const myRequest = t.row('MyRequest', { ...requestCols, at: t.timestamp(), reminded: t.string(), canApprove: t.bool(), remindedMe: t.bool() });

/**
 * The requests this connection may see. A person gets only the requests routed to them, enforced here: their
 * client is never sent anyone else's. The box's own screen and an owner's devices (vouched, not a person) get all.
 */
export const myRequests = spacetimedb.view({ name: 'my_requests', public: true }, t.array(myRequest), (ctx) => {
  const p = ctx.db.person.identity.find(ctx.sender);
  const out: any[] = [];
  if (p) {
    for (const r of ctx.db.routedTo.person.filter(p.person)) {
      const q = ctx.db.request.id.find(r.request);
      if (q) out.push({ ...q, canApprove: r.canApprove, remindedMe: r.reminded });
    }
  } else if (ctx.db.device.identity.find(ctx.sender) || ctx.db.owner.identity.find(ctx.sender)) {
    for (const s of ['pending', 'approved', 'denied']) for (const q of ctx.db.request.state.filter(s)) out.push({ ...q, canApprove: true, remindedMe: false });
  }
  return out;
});

/** Who else has a request open, for the requests this connection may see: "Rosa is viewing". */
export const viewers = spacetimedb.view(
  { name: 'viewers', public: true },
  t.array(t.row('Looking', { id: t.string(), name: t.string(), person: t.string(), since: t.timestamp() })),
  (ctx) => {
    const p = ctx.db.person.identity.find(ctx.sender);
    const ids: string[] = [];
    if (p) for (const r of ctx.db.routedTo.person.filter(p.person)) ids.push(r.request);
    else if (ctx.db.device.identity.find(ctx.sender) || ctx.db.owner.identity.find(ctx.sender)) {
      for (const q of ctx.db.request.state.filter('pending')) ids.push(q.id);
      for (const a of ctx.db.approval.state.filter('pending')) ids.push(a.id);
    }
    const out: any[] = [];
    for (const id of ids) for (const v of ctx.db.viewer.id.filter(id)) if (!v.identity.isEqual(ctx.sender)) out.push({ id, name: v.name, person: v.person, since: v.since });
    return out;
  },
);
