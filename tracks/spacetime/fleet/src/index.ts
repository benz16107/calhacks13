// The GurtOS fleet on Maincloud: one live view of every machine you own, from anywhere.
// A box that its owner opted in reports a status summary here: how many tasks are running, waiting for an OK,
// done and failed today, what it spent today, and whether it is online. Never a prompt, a file, a request's
// text or a key. Each machine decides who may see it (`grant`), and the `my_machines` view sends each viewer
// only the machines that granted them: the owner's phone, or a Business admin's laptop for the company's boxes.
import { ScheduleAt } from 'spacetimedb';
import { SenderError, schema, t, table } from 'spacetimedb/server';

const summary = {
  /** The box's own id and name, as its owner set them. */
  boxId: t.string(),
  name: t.string(),
  /** server, personal or business */
  edition: t.string(),
  version: t.string(),
  queued: t.u32(),
  running: t.u32(),
  waiting: t.u32(),
  doneToday: t.u32(),
  failedToday: t.u32(),
  spentTodayCents: t.u32(),
};

const sweepTimer = table({}, { scheduledId: t.u64().primaryKey().autoInc(), scheduledAt: t.scheduleAt() });

const spacetimedb = schema({
  /** One row per box, keyed by the box's own Maincloud identity: only that box can change it. Private. */
  machine: table({}, { key: t.identity().primaryKey(), ...summary, online: t.bool(), lastSeen: t.timestamp(), since: t.timestamp() }),
  /** Who may see which machine. Private. */
  grant: table({}, { id: t.u64().primaryKey().autoInc(), machine: t.identity().index('btree'), viewer: t.identity().index('btree'), label: t.string() }),
  sweepTimer,
});
export default spacetimedb;

const SECOND = 1_000_000n;

export const init = spacetimedb.init((ctx) => {
  ctx.db.sweepTimer.insert({ scheduledId: 0n, scheduledAt: ScheduleAt.interval(30n * SECOND) });
});

/** A box reports its summary. The first report creates its row; after that only the same identity can update it. */
export const report = spacetimedb.reducer(summary, (ctx, s) => {
  const old = ctx.db.machine.key.find(ctx.sender);
  const row = { key: ctx.sender, ...s, online: true, lastSeen: ctx.timestamp, since: old?.online ? old.since : ctx.timestamp };
  if (old) ctx.db.machine.key.update(row);
  else ctx.db.machine.insert(row);
});

/** A box lets one identity see it. */
export const grantViewer = spacetimedb.reducer({ viewer: t.identity(), label: t.string() }, (ctx, { viewer, label }) => {
  if (!ctx.db.machine.key.find(ctx.sender)) throw new SenderError('report first: only a machine can grant a view of itself');
  for (const g of ctx.db.grant.machine.filter(ctx.sender)) if (g.viewer.isEqual(viewer)) return;
  ctx.db.grant.insert({ id: 0n, machine: ctx.sender, viewer, label });
});

export const revokeViewer = spacetimedb.reducer({ viewer: t.identity() }, (ctx, { viewer }) => {
  for (const g of [...ctx.db.grant.machine.filter(ctx.sender)]) if (g.viewer.isEqual(viewer)) ctx.db.grant.id.delete(g.id);
});

/** The owner turned the fleet view off: the box takes itself and every grant out. Nothing about it stays here. */
export const leave = spacetimedb.reducer((ctx) => {
  for (const g of [...ctx.db.grant.machine.filter(ctx.sender)]) ctx.db.grant.id.delete(g.id);
  ctx.db.machine.key.delete(ctx.sender);
});

/** A box that disconnects is offline at once; one that stops reporting is offline within a minute (sweep). */
export const onDisconnect = spacetimedb.clientDisconnected((ctx) => {
  const m = ctx.db.machine.key.find(ctx.sender);
  if (m?.online) ctx.db.machine.key.update({ ...m, online: false });
});

export const sweep = spacetimedb.reducer({ onSchedule: sweepTimer }, { arg: sweepTimer.rowType }, (ctx) => {
  if (!ctx.sender.isEqual(ctx.identity)) throw new SenderError("only the database's own timer runs the sweep");
  const stale = ctx.timestamp.microsSinceUnixEpoch - 60n * SECOND;
  for (const m of [...ctx.db.machine.iter()]) if (m.online && m.lastSeen.microsSinceUnixEpoch < stale) ctx.db.machine.key.update({ ...m, online: false });
});

const machineRow = t.row('SeenMachine', { ...summary, key: t.identity(), online: t.bool(), lastSeen: t.timestamp(), since: t.timestamp(), label: t.string() });

/** The machines that granted this connection a view, live. Anyone else is sent nothing. */
export const myMachines = spacetimedb.view({ name: 'my_machines', public: true }, t.array(machineRow), (ctx) => {
  const out: any[] = [];
  for (const g of ctx.db.grant.viewer.filter(ctx.sender)) {
    const m = ctx.db.machine.key.find(g.machine);
    if (m) out.push({ ...m, label: g.label });
  }
  return out;
});

/** A box's own row, so it can check what Maincloud holds about it. */
export const me = spacetimedb.view({ name: 'me', public: true }, t.array(machineRow), (ctx) => {
  const m = ctx.db.machine.key.find(ctx.sender);
  return m ? [{ ...m, label: 'this box' }] : [];
});
