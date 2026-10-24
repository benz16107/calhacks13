// Mirrors tasks and approvals into SpacetimeDB for the portal and the phone, and brings answers back.
// Best effort: the box works without it and catches up when it returns. The log on disk stays the truth.
// Env: BOX_STDB_URL (default ws://127.0.0.1:3000), BOX_STDB_DB (default 'box'), BOX_STDB=off to skip.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Approval, Task } from './contract.ts';
import { DbConnection } from './spacetime/bindings/index.ts';

const URI = process.env.BOX_STDB_URL ?? 'ws://127.0.0.1:3000';
export const DB = process.env.BOX_STDB_DB ?? 'box';
const cliConfig = path.join(os.homedir(), '.config', 'spacetime', 'cli.toml');
const run = (...args: string[]) => execFileSync('spacetime', args, { stdio: 'pipe', encoding: 'utf8' });

/** Publish the module as the box. Whoever publishes owns the database, so only the box can write to it. */
function publish(): string {
  const token = () => fs.readFileSync(cliConfig, 'utf8').match(/spacetimedb_token\s*=\s*"([^"]+)"/)?.[1];
  if (!fs.existsSync(cliConfig) || !token()) run('login', '--server-issued-login', 'local');
  const mod = new URL('./spacetime', import.meta.url).pathname;
  try {
    run('publish', '--server', 'local', '--module-path', mod, '-y', DB);
  } catch {
    run('publish', '--server', 'local', '--module-path', mod, '--delete-data', '-y', DB); // only a mirror; the box refills it
  }
  return token()!;
}

const taskRow = (t: Task) => ({
  id: t.id,
  title: t.title,
  state: t.state,
  source: t.source,
  workspace: t.workspace,
  worker: t.worker,
  costCents: Math.round(t.costCents),
  budgetCents: Math.round(t.budgetCents),
  updatedAt: t.updatedAt,
  note: t.error ?? t.summary ?? '',
});
const approvalRow = (a: Approval) => ({ ...a, costCents: Math.round(a.costCents), by: a.by ?? '' });

export class Live {
  private conn?: DbConnection;
  private token = '';
  private box: { tasks(): Task[]; approvals(): Approval[]; answer(id: string, approved: boolean, by: string): unknown };

  constructor(box: Live['box']) {
    this.box = box;
  }

  start() {
    if (process.env.BOX_STDB === 'off') return;
    try {
      this.token = publish();
    } catch (e) {
      console.error(`spacetime: publish failed, so the portal and phone are not live: ${(e as Error).message}`);
      return;
    }
    this.connect();
  }

  private connect() {
    const retry = (ms: number) => setTimeout(() => this.connect(), ms);
    DbConnection.builder()
      .withUri(URI)
      .withDatabaseName(DB)
      .withToken(this.token)
      .onConnect((conn) => {
        conn.db.approval.onUpdate((_ctx, _old, row) => this.answered(row));
        conn.subscriptionBuilder()
          .onApplied(() => {
            // Answers given while the box was away come first, then the box refills everything.
            for (const row of conn.db.approval.iter()) this.answered(row);
            this.conn = conn;
            for (const t of this.box.tasks()) this.task(t);
            for (const a of this.box.approvals()) this.approval(a);
          })
          .subscribeToAllTables();
      })
      .onDisconnect(() => {
        this.conn = undefined;
        retry(2000);
      })
      .onConnectError((_ctx, e) => {
        console.error(`spacetime: cannot connect: ${e?.message ?? e}`);
        retry(5000);
      })
      .build();
  }

  private answered(row: { id: string; state: string; by: string }) {
    if (row.state === 'pending') return;
    const a = this.box.approvals().find((x) => x.id === row.id);
    if (a?.state === 'pending') this.box.answer(row.id, row.state === 'approved', row.by || 'someone');
  }

  task(t: Task) {
    this.conn?.reducers.putTask(taskRow(t));
  }

  approval(a: Approval) {
    this.conn?.reducers.putApproval(approvalRow(a));
  }
}
