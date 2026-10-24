// The box's live state in SpacetimeDB: task status and approvals, for the portal and the phone.
// The action log on disk is the truth. The box mirrors it here; people answer approvals here.
import { SenderError, schema, t, table } from 'spacetimedb/server';

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

const spacetimedb = schema({
  owner: table({}, { identity: t.identity().primaryKey() }),
  // Identities the box has vouched for: a paired phone, or the box's own screen. Private: not readable by clients.
  device: table({}, { identity: t.identity().primaryKey(), name: t.string(), at: t.string() }),
  task: table({ public: true }, { ...taskCols, id: t.string().primaryKey() }),
  approval: table({ public: true }, { ...approvalCols, id: t.string().primaryKey() }),
});
export default spacetimedb;

// Whoever publishes the module is the box. Only the box may write tasks and approvals.
export const init = spacetimedb.init((ctx) => {
  ctx.db.owner.insert({ identity: ctx.sender });
});

const mustBeBox = (ctx: { sender: any; db: any }) => {
  if (!ctx.db.owner.identity.find(ctx.sender)) throw new SenderError('only the box may do this');
};

export const putTask = spacetimedb.reducer(taskCols, (ctx, row) => {
  mustBeBox(ctx);
  if (ctx.db.task.id.find(row.id)) ctx.db.task.id.update(row);
  else ctx.db.task.insert(row);
});

export const putApproval = spacetimedb.reducer(approvalCols, (ctx, row) => {
  mustBeBox(ctx);
  const old = ctx.db.approval.id.find(row.id);
  if (!old) ctx.db.approval.insert(row);
  else if (old.state === 'pending' || row.state !== 'pending') ctx.db.approval.id.update(row); // an answer is never undone
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
 * recorded under that connection's registered name: whatever `by` the caller sends is ignored. The first answer wins.
 */
export const answer = spacetimedb.reducer({ id: t.string(), approved: t.bool(), by: t.string() }, (ctx, { id, approved }) => {
  const who = ctx.db.device.identity.find(ctx.sender);
  if (!who) throw new SenderError('this connection is not a paired phone or the box\'s own screen');
  const a = ctx.db.approval.id.find(id);
  if (!a) throw new SenderError(`no approval ${id}`);
  if (a.state !== 'pending') return;
  ctx.db.approval.id.update({ ...a, state: approved ? 'approved' : 'denied', by: who.name });
});
