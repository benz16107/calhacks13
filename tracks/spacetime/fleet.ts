// Reports this box's status to the GurtOS fleet on Maincloud, once its owner turns it on (off on a new box).
// What leaves the box: its id, name, edition and version, how many tasks are queued, running and waiting for an OK,
// how many finished or failed today, what it spent today, and whether it is online. Never a prompt, a file, a
// request's text or a key. The box connects with its own Maincloud identity (a token kept root-only in
// BOX_HOME/spacetime/fleet.json); only that identity can change its row, and only identities it granted see it.
import fs from 'node:fs';
import path from 'node:path';
import { Identity } from 'spacetimedb';
import type { Box, Task } from '../../core/contract.ts';
import { DbConnection } from './fleet/bindings/index.ts';

const HOST = process.env.BOX_FLEET_URL ?? 'https://maincloud.spacetimedb.com';
const NAME = process.env.BOX_FLEET_DB ?? 'gurtos-fleet';
const HOME = process.env.BOX_HOME ?? '/var/lib/box';
const FILE = path.join(HOME, 'spacetime', 'fleet.json');
const ROOT = new URL('../../', import.meta.url).pathname;

type Saved = { on: boolean; token?: string };
const load = (): Saved => {
  try {
    return JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch {
    return { on: false };
  }
};
const save = (s: Saved) => {
  fs.mkdirSync(path.dirname(FILE), { recursive: true, mode: 0o700 });
  fs.writeFileSync(FILE, JSON.stringify(s), { mode: 0o600 });
};

const day = (iso: string) => new Date(iso).toLocaleDateString('en-CA');
const read = (f: string) => {
  try {
    return fs.readFileSync(f, 'utf8').trim();
  } catch {
    return '';
  }
};

/** The summary, counted from the box's tasks. Only numbers and the box's own name leave the machine. */
export function summary(tasks: Task[], now = new Date()) {
  const today = day(now.toISOString());
  const n = (s: string) => tasks.filter((t) => t.state === s).length;
  const todays = tasks.filter((t) => day(t.updatedAt) === today);
  const owner = fs.existsSync(path.join(HOME, 'owner.json')) || !!process.env.BOX_OWNER;
  return {
    boxId: process.env.BOX_ID || read('/etc/hostname') || 'box',
    name: process.env.BOX_NAME || process.env.BOX_ID || read('/etc/hostname') || 'box',
    edition: process.env.BOX_EDITION ?? (owner ? 'personal' : 'server'),
    version: [JSON.parse(read(`${ROOT}package.json`) || '{}').version, read(`${ROOT}VERSION`)].filter(Boolean).join(' '),
    queued: n('queued'),
    running: n('running'),
    waiting: n('waiting'),
    doneToday: todays.filter((t) => t.state === 'done').length,
    failedToday: todays.filter((t) => t.state === 'failed').length,
    spentTodayCents: Math.round(todays.reduce((s, t) => s + t.costCents, 0)),
  };
}

class Fleet {
  private box?: Box;
  private conn?: DbConnection;
  private identity = '';
  private lastReport = '';
  private error = '';
  private timer?: ReturnType<typeof setInterval>;
  private soon?: ReturnType<typeof setTimeout>;
  private retry?: ReturnType<typeof setTimeout>;
  private off?: () => void;

  start(box: Box) {
    this.box = box;
    if (load().on) this.connect();
    this.off = box.on((e) => {
      if (e.type === 'task.state' || e.type === 'task.created' || e.type === 'cost' || e.type.startsWith('approval.')) this.reportSoon();
    });
    return () => this.stop();
  }

  private stop() {
    this.off?.();
    clearInterval(this.timer);
    clearTimeout(this.retry);
    this.conn?.disconnect();
    this.conn = undefined;
  }

  private connect(failures = 0) {
    if (this.conn || !load().on) return;
    DbConnection.builder()
      .withUri(HOST)
      .withDatabaseName(NAME)
      .withToken(load().token)
      .onConnect((c, identity, token) => {
        this.conn = c;
        this.identity = identity.toHexString();
        this.error = '';
        if (load().token !== token) save({ ...load(), token });
        this.report();
        clearInterval(this.timer);
        this.timer = setInterval(() => this.report(), 15_000);
        c.subscriptionBuilder().subscribe(['SELECT * FROM me']);
      })
      .onDisconnect(() => {
        this.conn = undefined;
        clearInterval(this.timer);
        if (load().on) this.retry = setTimeout(() => this.connect(), 5000);
      })
      .onConnectError((_ctx, e) => {
        this.error = `cannot reach Maincloud: ${e?.message ?? e}`;
        this.retry = setTimeout(() => this.connect(failures + 1), Math.min(60_000, 2000 * 2 ** failures));
      })
      .build();
  }

  private reportSoon() {
    if (!this.conn || this.soon) return;
    this.soon = setTimeout(() => ((this.soon = undefined), this.report()), 1000);
  }

  private report() {
    if (!this.conn || !this.box) return;
    this.conn.reducers.report(summary(this.box.tasks())).then(
      () => (this.lastReport = new Date().toISOString()),
      (e: Error) => (this.error = e.message),
    );
  }

  async set(on: boolean) {
    if (on) {
      save({ ...load(), on: true });
      this.connect();
      for (let i = 0; i < 50 && !this.conn && !this.error; i++) await new Promise((r) => setTimeout(r, 100));
    } else {
      // Off means gone: Maincloud forgets this box and everyone it let see it.
      await this.conn?.reducers.leave({}).catch(() => {});
      save({ ...load(), on: false });
      this.stop();
      if (this.box) this.start(this.box); // keep listening, so turning it on again needs no restart
    }
    return this.status();
  }

  /** Let one Maincloud identity see this box. */
  async grant(identity: unknown, label: unknown) {
    if (typeof identity !== 'string' || !/^[0-9a-f]{64}$/i.test(identity)) throw new Error('identity: the 64 hex characters of the viewer\'s Maincloud identity');
    if (!this.conn) throw new Error('turn the fleet view on first');
    const name = typeof label === 'string' && label.trim() ? label.trim().slice(0, 60) : 'a viewer';
    await this.conn.reducers.grantViewer({ viewer: Identity.fromString(identity), label: name });
    return { granted: identity, label: name };
  }

  status() {
    return { on: load().on, connected: !!this.conn, host: HOST, database: NAME, identity: this.identity || null, lastReport: this.lastReport || null, error: this.error || null };
  }

  where() {
    return { host: HOST, database: NAME };
  }
}

export const fleet = new Fleet();
