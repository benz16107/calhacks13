// Spike 4 module: live task status, the shape the box needs.
import { schema, table, t } from 'spacetimedb/server';

const spacetimedb = schema({
  task: table(
    { public: true },
    {
      id: t.u64().primaryKey().autoInc(),
      name: t.string(),
      status: t.string(),
    }
  ),
});
export default spacetimedb;

export const addTask = spacetimedb.reducer({ name: t.string() }, (ctx, { name }) => {
  ctx.db.task.insert({ id: 0n, name, status: 'queued' });
});

export const setStatus = spacetimedb.reducer({ id: t.u64(), status: t.string() }, (ctx, { id, status }) => {
  const row = ctx.db.task.id.find(id);
  if (!row) throw new Error(`no task ${id}`);
  ctx.db.task.id.update({ ...row, status });
});
