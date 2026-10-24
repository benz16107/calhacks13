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

/** Anyone with the portal or the phone answers here. The first answer wins; the box picks it up live. */
export const answer = spacetimedb.reducer({ id: t.string(), approved: t.bool(), by: t.string() }, (ctx, { id, approved, by }) => {
  const a = ctx.db.approval.id.find(id);
  if (!a) throw new SenderError(`no approval ${id}`);
  if (a.state !== 'pending') return;
  ctx.db.approval.id.update({ ...a, state: approved ? 'approved' : 'denied', by: by.slice(0, 40) || 'someone' });
});
