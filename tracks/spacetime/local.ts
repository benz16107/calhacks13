// The box's own SpacetimeDB, connected as the box: the identity core/live.ts publishes the module with, so the
// box-only reducers (postJobs, claimJob, finishJob) accept these calls. Tasks never connect to SpacetimeDB; they
// reach the queue through this track's tools, and the box names the task that called.
import fs from 'node:fs';
import path from 'node:path';
import { DbConnection } from '../../core/spacetime/bindings/index.ts';

const URI = process.env.BOX_STDB_URL ?? 'ws://127.0.0.1:3000';
export const DB = process.env.BOX_STDB_DB ?? 'box';
// The box's own SpacetimeDB login, which core/live.ts publishes the module with (BOX_HOME/spacetime/cli.toml).
const token = () => fs.readFileSync(path.join(process.env.BOX_HOME ?? '/var/lib/box', 'spacetime', 'cli.toml'), 'utf8').match(/spacetimedb_token\s*=\s*"([^"]+)"/)?.[1];

let conn: Promise<DbConnection> | undefined;

/** One connection, opened on first use and again after it drops. It follows the queue and the agents. */
export function local(): Promise<DbConnection> {
  conn ??= new Promise<DbConnection>((resolve, reject) => {
    const fail = (e: unknown) => ((conn = undefined), reject(e instanceof Error ? e : new Error(`SpacetimeDB: ${String(e)}`)));
    DbConnection.builder()
      .withUri(URI)
      .withDatabaseName(DB)
      .withToken(token())
      .onConnect((c) => {
        c.subscriptionBuilder()
          .onApplied(() => resolve(c))
          .onError((_ctx) => fail('the subscription was refused'))
          .subscribe(['SELECT * FROM job', 'SELECT * FROM agent', 'SELECT * FROM meter', 'SELECT * FROM activity', 'SELECT * FROM approval']);
      })
      .onConnectError((_ctx, e) => fail(e))
      .onDisconnect(() => (conn = undefined))
      .build();
  });
  return conn;
}

/** Run one call; if the box's identity changed under us (SpacetimeDB was reinstalled), reconnect once and retry. */
export async function withBox<T>(fn: (c: DbConnection) => Promise<T>): Promise<T> {
  try {
    return await fn(await local());
  } catch (e) {
    if (!/only the box/.test(String((e as Error)?.message ?? e))) throw e;
    (await conn)?.disconnect();
    conn = undefined;
    return fn(await local());
  }
}
