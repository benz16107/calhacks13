// Mirrors tasks and approvals into SpacetimeDB for the portal and the phone, and brings answers back.
// Best effort: the box works without it and catches up when it returns. The log on disk stays the truth.
// Env: BOX_STDB_URL (default ws://127.0.0.1:3000), BOX_STDB_DB (default 'box'), BOX_STDB=off to skip.
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import type { Approval, Task } from './contract.ts';
import { Identity } from 'spacetimedb';
import { DbConnection } from './spacetime/bindings/index.ts';

const URI = process.env.BOX_STDB_URL ?? 'ws://127.0.0.1:3000';
export const DB = process.env.BOX_STDB_DB ?? 'box';
// The box's own SpacetimeDB login, in its home. Boxes side by side on one machine (demo runs on a test VM) used to
// share root's, and one box logging in again changed the identity under every other box, so their next publish
// was refused. A box installed before this starts from root's login, which owns its database.
const cliConfig = path.join(process.env.BOX_HOME ?? '/var/lib/box', 'spacetime', 'cli.toml');
const sharedConfig = path.join(os.homedir(), '.config', 'spacetime', 'cli.toml');
const exec = promisify(execFile);
// One spacetime CLI at a time per machine, and async so publishing never blocks the box's boot or its event loop
// while the lock is held.
const run = (...args: string[]) => exec('flock', ['/run/lock/box-spacetime-cli.lock', 'spacetime', '--config-path', cliConfig, ...args], { encoding: 'utf8' }).then((r) => r.stdout);

/** Publish the module as the box. Whoever publishes owns the database, so only the box can write to it. */
async function publish(): Promise<string> {
  const token = () => fs.readFileSync(cliConfig, 'utf8').match(/spacetimedb_token\s*=\s*"([^"]+)"/)?.[1];
  const login = () => run('login', '--server-issued-login', 'local');
  const mod = new URL('./spacetime', import.meta.url).pathname;
  const attempt = async () => {
    try {
      await run('publish', '--server', 'local', '--module-path', mod, '-y', DB);
    } catch {
      await run('publish', '--server', 'local', '--module-path', mod, '--delete-data', '-y', DB); // only a mirror; the box refills it
    }
  };
  if (!fs.existsSync(cliConfig)) {
    fs.mkdirSync(path.dirname(cliConfig), { recursive: true, mode: 0o700 });
    if (fs.existsSync(sharedConfig)) fs.copyFileSync(sharedConfig, cliConfig);
  }
  if (!fs.existsSync(cliConfig) || !token()) await login();
  try {
    await attempt();
  } catch {
    // A server started fresh does not know the old identity. Get a new one and try once more.
    await run('logout');
    await login();
    await attempt();
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
  step: t.step ?? '',
  note: t.error ?? t.summary ?? '',
});
const approvalRow = (a: Approval) => ({ id: a.id, task: a.task, question: a.question, state: a.state, costCents: Math.round(a.costCents), payee: a.payee ?? '', purpose: a.purpose ?? '', by: a.by ?? '' });

/** A person a Business request is routed to. `canApprove` is false above their limit: they may still deny. */
export type Routed = { person: string; name: string; canApprove: boolean };
export type Routing = { people: Routed[]; remind: Routed[]; remindAfterSec: number };
const requestRow = (a: Approval, r: Routing, reopen = false) => ({
  ...approvalRow(a),
  person: a.person ?? '',
  askedBy: a.askedBy ?? '',
  rule: a.route?.rule ?? '',
  to: a.route?.to ?? '',
  why: a.route?.why ?? '',
  ...r,
  reopen,
});

export class Live {
  private conn?: DbConnection;
  private token = '';
  private box: {
    tasks(): Task[];
    approvals(): Approval[];
    /** An answer given in SpacetimeDB. On GurtOS Business it names the person, and the box's own checks may refuse it (throw). */
    answer(id: string, approved: boolean, by: string, person?: string): unknown;
    /** Devices and screens the box vouches for: [identity, name]. */
    identities(): [string, string][];
    /** Business: people's connections: [identity, person id, name]. */
    people(): [string, string, string][];
    /** Business: who a routed approval goes to, or nothing for an ordinary approval. */
    routed(a: Approval): Routing | undefined;
  };

  constructor(box: Live['box']) {
    this.box = box;
  }

  /** Returns at once. Publishing and connecting happen in the background, so the box's API is up straight away. */
  start() {
    if (process.env.BOX_STDB === 'off') return;
    void (async () => {
      try {
        this.token = await publish();
      } catch (e) {
        const err = e as Error & { stderr?: string };
        console.error(`spacetime: publish failed, so the portal and phone are not live: ${err.stderr || err.message}`);
        return;
      }
      this.connect();
    })();
  }

  private connect() {
    const retry = (ms: number) => setTimeout(() => this.connect(), ms);
    DbConnection.builder()
      .withUri(URI)
      .withDatabaseName(DB)
      .withToken(this.token)
      .onConnect((conn) => {
        conn.db.approval.onUpdate((_ctx, _old, row) => this.answered(row));
        conn.db.myRequests.onInsert((_ctx, row) => this.answered(row)); // a view: a changed row arrives as a new one
        conn.subscriptionBuilder()
          .onApplied(() => {
            // Answers given while the box was away come first, then the box refills everything.
            for (const row of conn.db.approval.iter()) this.answered(row);
            for (const row of conn.db.myRequests.iter()) this.answered(row);
            this.conn = conn;
            for (const [identity, name] of this.box.identities()) this.register(identity, name);
            for (const [identity, person, name] of this.box.people()) this.registerPerson(identity, person, name);
            for (const t of this.box.tasks()) this.task(t);
            for (const a of this.box.approvals()) this.approval(a);
            conn.reducers.recountMeter({}); // runs after the refill above: reducer calls are applied in order
          })
          // The box is the database's owner, so my_requests sends it every Business request.
          .subscribe(['SELECT * FROM task', 'SELECT * FROM approval', 'SELECT * FROM my_requests']);
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

  private answered(row: { id: string; state: string; by: string; person?: string }) {
    if (row.state === 'pending') return;
    const a = this.box.approvals().find((x) => x.id === row.id);
    if (a?.state !== 'pending') return;
    try {
      this.box.answer(row.id, row.state === 'approved', row.by || 'someone', row.person || undefined);
    } catch (e) {
      // The box's own checks refused it (the person was removed, or their limit changed): it waits again.
      console.error(`spacetime: refused ${row.state === 'approved' ? 'an approval' : 'a denial'} of ${row.id} by ${row.by}: ${(e as Error).message}`);
      const r = this.box.routed(a);
      if (r) this.conn?.reducers.putRequest(requestRow(a, r, true));
    }
  }

  /** Business: vouch for a person's connection, so it is sent the requests routed to them and may answer them. */
  registerPerson(identity: string, person: string, name: string) {
    this.conn?.reducers.registerPerson({ identity: Identity.fromString(identity), person, name, at: new Date().toISOString() });
  }

  removePerson(identity: string) {
    this.conn?.reducers.removePerson({ person: '', identity: Identity.fromString(identity) });
  }

  /** Vouch for a SpacetimeDB identity (a paired phone or the box's own screen) so its answers are accepted. */
  register(identity: string, name: string) {
    this.conn?.reducers.registerDevice({ identity: Identity.fromString(identity), name, at: new Date().toISOString() });
  }

  unregister(identity: string) {
    this.conn?.reducers.removeDevice({ identity: Identity.fromString(identity) });
  }

  task(t: Task) {
    this.conn?.reducers.putTask(taskRow(t));
  }

  /** Every approval goes to the public table, as before (the box's screen, the portal and Personal read it). A routed Business request is also written to the private table that `my_requests` sends only to its people. */
  approval(a: Approval) {
    this.conn?.reducers.putApproval(approvalRow(a));
    const r = this.box.routed(a);
    if (r) this.conn?.reducers.putRequest(requestRow(a, r));
  }
}
