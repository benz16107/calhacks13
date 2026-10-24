// Spike 4 client: subscribe to the task table and print every change as it arrives.
// With PING=1 it also times its own reducer call until the update comes back.
import { DbConnection } from './module_bindings/index.js';

const HOST = process.env.SPACETIMEDB_HOST ?? 'ws://localhost:3000';
const DB = process.env.SPACETIMEDB_DB_NAME ?? 'spike4';
const ts = () => new Date().toISOString().slice(11, 23);

DbConnection.builder()
  .withUri(HOST)
  .withDatabaseName(DB)
  .onConnect(conn => {
    conn.db.task.onInsert((_c, r) => console.log(`${ts()} [insert] #${r.id} ${r.name} ${r.status}`));
    conn.db.task.onUpdate((_c, old, r) => console.log(`${ts()} [update] #${r.id} ${old.status} -> ${r.status}`));
    conn.subscriptionBuilder()
      .onApplied(ctx => {
        console.log(`${ts()} subscribed, ${[...ctx.db.task.iter()].length} tasks`);
        if (process.env.PING) ping(conn);
      })
      .subscribeToAllTables();
  })
  .onConnectError((_c, e) => { console.error('connect error', e); process.exit(1); })
  .build();

function ping(conn: DbConnection) {
  const first = [...conn.db.task.iter()][0];
  if (!first) { console.log('no task to ping'); process.exit(1); }
  const times: number[] = [];
  const once = (i: number) => {
    const t0 = performance.now(), status = `ping-${i}`;
    const cb = (_c: unknown, _o: unknown, r: { status: string }) => {
      if (r.status !== status) return;
      conn.db.task.removeOnUpdate(cb);
      times.push(performance.now() - t0);
      if (i < 20) once(i + 1);
      else { times.sort((a, b) => a - b); console.log(`round trip call -> update, 20 runs: median ${times[10].toFixed(1)} ms, max ${times[19].toFixed(1)} ms`); process.exit(0); }
    };
    conn.db.task.onUpdate(cb);
    conn.reducers.setStatus({ id: first.id, status });
  };
  once(1);
}
