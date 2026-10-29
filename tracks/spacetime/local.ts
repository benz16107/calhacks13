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

const WAIT_MS = Number(process.env.BOX_STDB_WAIT_MS ?? 10_000);
let conn: Promise<DbConnection> | undefined;
let generation = 0;

async function connect(): Promise<DbConnection> {
  const mine = ++generation;
  let auth: string | undefined;
  try {
    auth = token();
  } catch {
    throw new Error("Live state (SpacetimeDB) is not set up on this computer yet: the box's login for it is missing."); // not kept: the next call looks again
  }
  return new Promise<DbConnection>((resolve, reject) => {
    const timer = setTimeout(() => fail(`no answer in ${WAIT_MS / 1000} s`), WAIT_MS);
    const fail = (e: unknown) => {
      clearTimeout(timer);
      reject(new Error(`Live state (SpacetimeDB) is not reachable on this computer: ${e instanceof Error ? e.message : String(e)}`));
    };
    DbConnection.builder()
      .withUri(URI)
      .withDatabaseName(DB)
      .withToken(auth)
      .onConnect((c) => {
        c.subscriptionBuilder()
          .onApplied(() => (clearTimeout(timer), resolve(c)))
          .onError((_ctx) => fail('the subscription was refused'))
          .subscribe(['SELECT * FROM job', 'SELECT * FROM agent', 'SELECT * FROM meter', 'SELECT * FROM activity', 'SELECT * FROM approval']);
      })
      .onConnectError((_ctx, e) => fail(e))
      .onDisconnect(() => {
        if (mine === generation) conn = undefined; // not a connection that was already replaced
      })
      .build();
  });
}

/** One connection, opened on first use and again after it drops. It follows the queue and the agents. A failed attempt is not kept: the next call tries again. */
export function local(): Promise<DbConnection> {
  conn ??= connect().catch((e) => {
    conn = undefined;
    throw e;
  });
  return conn;
}

/** Run one call; if the box's identity changed under us (SpacetimeDB was reinstalled), reconnect once and retry. */
export async function withBox<T>(fn: (c: DbConnection) => Promise<T>): Promise<T> {
  try {
    return await fn(await local());
  } catch (e) {
    if (!/only the box/.test(String((e as Error)?.message ?? e))) throw e;
    const old = conn;
    conn = undefined;
    (await old)?.disconnect();
    return fn(await local());
  }
}
