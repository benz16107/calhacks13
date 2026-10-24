// The box service. Runs as root: replays the log, resumes tasks, loads tracks, serves the API.
//   node --experimental-strip-types core/box.ts
// Env: BOX_HOME (default /var/lib/box), BOX_VAULT, BOX_PORT (default 7700, 0 = off), BOX_LISTEN (default 127.0.0.1).
import type { ChildProcess } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import type { App, Approval, Box, Ctx, LogEvent, LogReader, ModelJob, NewEvent, Route, Task, TaskSpec, TaskState, Tool, Track } from './contract.ts';
import { DB, Live } from './live.ts';
import { Log, apply, canMove, doneLayers, fold, type State } from './log.ts';
import { PLACEHOLDER_KEY, firewall, relayCert, reservePort, startProxy } from './net.ts';
import * as sandbox from './sandbox.ts';
import { HOME, dirs } from './sandbox.ts';
import { usageCents } from './pricing.ts';
import { loadVault } from './vault.ts';

type Handler = (method: string, url: URL, body: any, headers: http.IncomingHttpHeaders) => unknown;

/** A JSON-over-HTTP server. Thrown errors become 400s. */
function jsonServer(handler: Handler, raw?: (req: http.IncomingMessage, res: http.ServerResponse) => boolean) {
  const server = http.createServer(async (req, res) => {
    if (raw?.(req, res)) return;
    let text = '';
    for await (const chunk of req) text += chunk;
    let status = 200;
    let out: unknown;
    try {
      out = await handler(req.method ?? 'GET', new URL(req.url ?? '/', 'http://box'), text ? JSON.parse(text) : {}, req.headers);
      if (out === undefined) [status, out] = [404, { error: 'not found' }];
    } catch (e) {
      status = (e as { status?: number }).status ?? 400;
      out = { error: (e as Error).message };
    }
    res.writeHead(status, { 'content-type': 'application/json' }).end(JSON.stringify(out));
  });
  server.requestTimeout = 0; // approvals can wait for hours
  return server;
}

function listenSocket(server: http.Server, file: string, owner?: { uid: number; gid: number }) {
  fs.rmSync(file, { force: true });
  return new Promise<void>((resolve) =>
    server.listen(file, () => {
      if (owner) fs.chownSync(file, owner.uid, owner.gid);
      fs.chmodSync(file, 0o600);
      resolve();
    }),
  );
}

const dollars = (cents: number) => `$${(cents / 100).toFixed(2)}`;
const BOX_ID = process.env.BOX_ID ?? os.hostname();
const BOX_NAME = process.env.BOX_NAME ?? BOX_ID;

interface Device {
  id: string;
  name: string;
  token: string;
  pairedAt: string;
  revoked?: boolean;
}

class Core {
  log = new Log(path.join(HOME, 'log.jsonl'));
  state: State = fold(this.log.events);
  vault = loadVault();
  tools = new Map<string, { tool: Tool; track: string }>();
  jobs = new Map<string, { job: ModelJob; track: string }>();
  routes = new Map<string, { route: Route; track: string }>();
  apps: (App & { track: string })[] = [];
  readers: (() => void)[] = [];
  listeners = new Set<(e: LogEvent) => void>();
  workers = new Map<string, ChildProcess>();
  brokers = new Map<string, http.Server>();
  waiters = new Map<string, ((approved: boolean) => void)[]>();
  reserved = new Map<string, number>(); // cents a task has in-flight tool calls committed but not yet logged
  inflight = new Map<string, Promise<{ ok: boolean; output?: unknown; error?: string; pending?: boolean }>>(); // one run per task+action
  webhooks = new Map<string, (payload: unknown, headers: Record<string, string>) => unknown>();
  trackSecrets = new Map<string, Set<string>>(); // vault keys each track's routes and triggers may read
  devicesPath = path.join(HOME, 'devices.json');
  devices: Device[] = fs.existsSync(this.devicesPath) ? JSON.parse(fs.readFileSync(this.devicesPath, 'utf8')) : [];
  pairCodes = new Map<string, number>(); // one-time code -> expiry (ms)
  uidTask = new Map<number, string>();
  relay = relayCert(HOME);
  proxyPort = 0;
  live = new Live({
    tasks: () => [...this.state.tasks.values()],
    approvals: () => [...this.state.approvals.values()],
    answer: (id, approved, by) => this.answer(id, approved, by),
  });

  write(e: NewEvent): LogEvent {
    const full = this.log.append(e);
    apply(this.state, full);
    try {
      if (['task.created', 'task.state', 'task.step', 'cost', 'tool.result'].includes(full.type)) {
        const t = full.task && this.state.tasks.get(full.task);
        if (t) this.live.task(t);
      }
      if (full.type === 'approval.asked' || full.type === 'approval.answered') {
        this.live.approval(this.state.approvals.get(full.type === 'approval.asked' ? full.approval.id : full.id)!);
      }
    } catch (err) {
      console.error('spacetime mirror failed:', err); // the log is written; the mirror catches up on reconnect
    }
    for (const l of this.listeners) {
      try {
        l(full);
      } catch (err) {
        console.error('listener failed:', err);
      }
    }
    for (const pump of this.readers) pump();
    return full;
  }

  must(id: string): Task {
    const t = this.state.tasks.get(id);
    if (!t) throw new Error(`no task ${id}`);
    return t;
  }

  move(t: Task, state: TaskState, extra: { layers?: string[]; error?: string; summary?: string } = {}) {
    if (!canMove(t.state, state)) throw new Error(`task ${t.id} is ${t.state}, it cannot become ${state}`);
    this.write({ type: 'task.state', task: t.id, state, ...extra });
  }

  // ---------- tasks ----------

  async createTask(spec: TaskSpec): Promise<Task> {
    const s: Required<TaskSpec> = { workspace: 'home', worker: 'droid', tools: [], hosts: [], budgetCents: 0, source: 'api', ...spec };
    if (!s.title || !s.prompt) throw new Error('a task needs a title and a prompt');
    if (!/^[\w.-]+$/.test(s.workspace) || !fs.existsSync(dirs.workspace(s.workspace))) throw new Error(`no workspace ${s.workspace}`);
    if (!['droid', 'fake'].includes(s.worker)) throw new Error(`no worker ${s.worker}`);
    for (const name of s.tools) if (!this.tools.has(name)) throw new Error(`no tool ${name}`);
    const id = 't' + Date.now().toString(36).slice(-6) + randomBytes(2).toString('hex');
    this.write({ type: 'task.created', task: id, spec: s, user: `box-${id}` });
    const t = this.must(id);
    await this.start(t);
    return t;
  }

  /** Start a queued task, or resume a running or waiting one after a restart. */
  async start(t: Task) {
    try {
      sandbox.kill(t); // a worker left over from a core that died without the box rebooting
      if (t.state === 'queued') this.move(t, 'running', { layers: doneLayers(this.log.events, this.state, t.workspace) });
      // Everything goes through the box's proxy. Its own address stays direct, for Droid's Factory calls.
      const proxy = `http://127.0.0.1:${this.proxyPort}`;
      const env: Record<string, string> = {
        HTTP_PROXY: proxy,
        HTTPS_PROXY: proxy,
        http_proxy: proxy,
        https_proxy: proxy,
        NO_PROXY: '127.0.0.1',
        NODE_USE_ENV_PROXY: '1',
      };
      if (t.worker === 'droid') {
        if (!this.vault.get('FACTORY_API_KEY')) throw new Error('the vault has no FACTORY_API_KEY, which Droid needs');
        // The task holds a placeholder. The proxy swaps in the real key on the way to Factory.
        Object.assign(env, {
          FACTORY_API_KEY: PLACEHOLDER_KEY,
          FACTORY_API_BASE_URL: proxy,
          FACTORY_EXTRA_CA_CERTS: this.relay.caPem,
          NODE_EXTRA_CA_CERTS: this.relay.caPem,
          FACTORY_RIPGREP_PATH: '/usr/bin/rg',
          ...(process.env.BOX_MODEL ? { BOX_MODEL: process.env.BOX_MODEL } : {}),
        });
      }
      const ids = sandbox.prepare(t);
      this.uidTask.set(ids.uid, t.id);
      await this.openBroker(t, ids);
      const child = sandbox.spawnWorker(t, ids, env);
      this.workers.set(t.id, child);
      child.on('exit', (code, signal) => {
        this.workers.delete(t.id);
        if (t.state === 'running' || t.state === 'waiting') {
          this.move(t, code === 0 ? 'done' : 'failed', code === 0 ? {} : { error: `worker exited with ${signal ?? code}` });
        }
        this.finish(t);
      });
    } catch (e) {
      if (canMove(t.state, 'failed')) this.move(t, 'failed', { error: (e as Error).message });
      this.finish(t);
    }
  }

  finish(t: Task) {
    this.closePending(t, 'task ended'); // nothing waits on a task that has stopped
    this.brokers.get(t.id)?.close();
    this.brokers.delete(t.id);
    sandbox.seal(t);
    if (t.state === 'done' || t.state === 'undone') this.refreshView(t.workspace);
  }

  refreshView(workspace: string) {
    sandbox.refreshView(workspace, doneLayers(this.log.events, this.state, workspace));
  }

  async undo(id: string): Promise<Task> {
    const t = this.must(id);
    if (t.state === 'undone') return t;
    this.move(t, 'undone');
    for (const a of this.state.approvals.values()) if (a.task === id && a.state === 'pending') this.answer(a.id, false, 'undo');
    if (this.workers.has(id)) sandbox.kill(t); // the exit handler finishes it
    else this.finish(t);
    return t;
  }

  // ---------- approvals ----------

  /** Pause the task until someone answers. The same key returns the same approval, even after a restart. */
  /** Back to running once nothing of this task's is still waiting. */
  settleTask(t: Task) {
    const stillWaiting = [...this.state.approvals.values()].some((x) => x.task === t.id && x.state === 'pending');
    if (t.state === 'waiting' && !stillWaiting) this.move(t, 'running');
  }

  /**
   * Ask for an OK and wait a bounded time. The approval id is the same for the same question (`key`), so a
   * tool call retried after a timeout reuses one approval instead of making a new one. Returns 'pending' if
   * no answer came within the window, so the worker can report "waiting, call again" and poll past a client
   * tool-call timeout (Droid gives up after ~3 minutes). Any copy's answer resolves the one request.
   */
  async askFor(t: Task, key: string, opts: { question: string; costCents?: number; payee?: string; purpose?: string }): Promise<'approved' | 'denied' | 'pending'> {
    const id = `${t.id}.${key}`;
    if (!this.state.approvals.has(id)) {
      const approval: Approval = { id, task: t.id, question: opts.question, costCents: opts.costCents ?? 0, payee: opts.payee, purpose: opts.purpose, state: 'pending' };
      this.write({ type: 'approval.asked', task: t.id, approval });
    }
    const a = this.state.approvals.get(id)!;
    if (a.state !== 'pending') {
      this.settleTask(t);
      return a.state === 'approved' ? 'approved' : 'denied';
    }
    if (t.state === 'running') this.move(t, 'waiting');
    const wait = Number(process.env.BOX_APPROVAL_WAIT_MS ?? 150000); // under Droid's ~3 min tool-call limit
    const answered = await new Promise<boolean | undefined>((resolve) => {
      const w = (v: boolean) => resolve(v);
      this.waiters.set(id, [...(this.waiters.get(id) ?? []), w]);
      setTimeout(() => {
        this.waiters.set(id, (this.waiters.get(id) ?? []).filter((x) => x !== w));
        resolve(undefined); // still pending; the waiter is removed but the approval stays open
      }, wait).unref();
    });
    if (answered === undefined) return 'pending';
    this.settleTask(t);
    return answered ? 'approved' : 'denied';
  }

  /** Close any approvals still pending for a task that has ended, so none lingers. */
  closePending(t: Task, by: string) {
    for (const a of this.state.approvals.values()) if (a.task === t.id && a.state === 'pending') this.answer(a.id, false, by);
  }

  answer(id: string, approved: boolean, by: string): Approval {
    const a = this.state.approvals.get(id);
    if (!a) throw new Error(`no approval ${id}`);
    if (a.state !== 'pending') return a; // the first answer wins
    this.write({ type: 'approval.answered', task: a.task, id, approved, by });
    for (const resolve of this.waiters.get(id) ?? []) resolve(approved);
    this.waiters.delete(id);
    return a;
  }

  // ---------- tools and jobs ----------

  ctx(track: string, key: string, secrets: string[] = [], task?: Task): Ctx {
    return {
      box: this.boxFor(track),
      task,
      key: `${task?.id ?? 'box'}.${key}`,
      secret: (name) => {
        if (!secrets.includes(name)) throw new Error(`${name} is not in this tool's secrets`);
        const v = this.vault.get(name);
        if (v === undefined) throw new Error(`the vault has no ${name}`);
        return v;
      },
      cost: (cents, what) => this.write({ type: 'cost', task: task?.id, cents, what }),
      log: (text, data) => task && this.write({ type: 'task.step', task: task.id, text, data }),
    };
  }

  /** Run a tool for a task. A key already answered in the log returns the logged result without running again. */
  async callTool(t: Task, key: string, name: string, input: unknown): Promise<{ ok: boolean; output?: unknown; error?: string; pending?: boolean }> {
    if (!t.tools.includes(name)) throw new Error(`this task may not use ${name}`);
    const entry = this.tools.get(name);
    if (!entry) throw new Error(`no tool ${name}`);
    // Resume dedup: a call already finished and logged under this exact key returns its result.
    const prev = this.log.events.findLast((e) => e.type === 'tool.result' && e.task === t.id && e.key === key);
    if (prev?.type === 'tool.result') return { ok: prev.ok, output: prev.output, error: prev.error };
    // Collapse a call that is retried while the first is still waiting (Droid re-calls after its timeout):
    // the same tool and arguments share one in-flight run, so it is approved and charged once.
    const action = `${name}:${createHash('sha256').update(JSON.stringify(input ?? {})).digest('hex').slice(0, 16)}`;
    const flight = `${t.id}|${action}`;
    const existing = this.inflight.get(flight);
    if (existing) return existing;
    const run = this.runTool(t, key, name, input, action, entry);
    this.inflight.set(flight, run);
    void run.finally(() => this.inflight.delete(flight));
    return run;
  }

  private async runTool(t: Task, key: string, name: string, input: unknown, action: string, entry: { tool: Tool; track: string }) {
    const result = (r: { ok: boolean; output?: unknown; error?: string; cents?: number }) => {
      this.write({ type: 'tool.result', task: t.id, key, ...r });
      return r;
    };
    const cost = entry.tool.cost?.(input) ?? 0;
    // Count spending this task's other in-flight calls have committed, so two payments at once can't both pass.
    const committed = () => t.costCents + (this.reserved.get(t.id) ?? 0);
    if (cost > 0 && committed() + cost > t.budgetCents) {
      const meta = entry.tool.approval?.(input) ?? {};
      const q = `Spend ${dollars(cost)}${meta.payee ? ` to ${meta.payee}` : ''} on ${name}${meta.purpose ? ` (${meta.purpose})` : ''}? Budget ${dollars(t.budgetCents)}, spent ${dollars(t.costCents)}.`;
      // Approval id keyed by the action, so a retry of the same call reuses it instead of asking again.
      const outcome = await this.askFor(t, `budget.${action}`, { question: q, costCents: cost, payee: meta.payee, purpose: meta.purpose });
      if (outcome === 'pending') return { ok: false, pending: true, error: 'Waiting for the box owner to approve this spend. Call this tool again to check.' };
      if (outcome === 'denied') return result({ ok: false, error: 'not approved' });
    }
    this.reserved.set(t.id, (this.reserved.get(t.id) ?? 0) + cost); // reserve now, with no await before it, so a parallel call sees this spend
    this.write({ type: 'tool.call', task: t.id, key, tool: name, input });
    try {
      const output = await entry.tool.run(input, this.ctx(entry.track, key, entry.tool.secrets, t));
      return result({ ok: true, output, ...(cost ? { cents: cost } : {}) }); // result and cost in one line: counted once
    } catch (e) {
      return result({ ok: false, error: (e as Error).message });
    } finally {
      this.reserved.set(t.id, (this.reserved.get(t.id) ?? 0) - cost); // release; the real cost is now in the log
    }
  }

  async job(name: string, input: unknown, task?: string) {
    const entry = this.jobs.get(name);
    if (!entry) throw new Error(`no model job ${name}`);
    const key = `job.${name}.${randomBytes(4).toString('hex')}`;
    return entry.job.run(input, this.ctx(entry.track, key, entry.job.secrets, task ? this.must(task) : undefined));
  }

  // ---------- the broker: one socket per task, owned by its user ----------

  async openBroker(t: Task, owner: { uid: number; gid: number }) {
    const server = jsonServer(async (method, url, body) => {
      const route = `${method} ${url.pathname}`;
      if ((route === 'POST /call' || route === 'POST /ask') && !body.key) throw new Error('a key is required');
      if (route === 'GET /task') {
        const steps = this.log.events.flatMap((e) => (e.type === 'task.step' && e.task === t.id ? [{ text: e.text, data: e.data }] : []));
        return { task: t, steps };
      }
      if (route === 'GET /tools') {
        return t.tools.map((name) => {
          const { description, input } = this.tools.get(name)!.tool;
          return { name, description, input: input ?? { type: 'object' } };
        });
      }
      if (route === 'POST /step') {
        sandbox.flush(t);
        return this.write({ type: 'task.step', task: t.id, text: String(body.text), data: body.data });
      }
      if (route === 'POST /cost') return this.write({ type: 'cost', task: t.id, cents: Number(body.cents), what: String(body.what) });
      if (route === 'POST /usage') {
        const tokens = body.tokens;
        return this.write({ type: 'cost', task: t.id, cents: usageCents(String(body.model), tokens), what: String(body.what ?? 'model'), model: String(body.model), tokens });
      }
      if (route === 'POST /call') return this.callTool(t, String(body.key), String(body.tool), body.input);
      if (route === 'POST /ask') {
        const outcome = await this.askFor(t, String(body.key), { question: String(body.question), costCents: Number(body.costCents ?? 0), payee: body.payee, purpose: body.purpose });
        return outcome === 'pending' ? { pending: true } : { approved: outcome === 'approved' };
      }
    });
    this.brokers.set(t.id, server);
    await listenSocket(server, dirs.socket(t.id), owner);
  }

  // ---------- tracks ----------

  boxFor(track: string): Box {
    return {
      createTask: (spec) => this.createTask({ source: track, ...spec }),
      workspace: (name, fromDir) => sandbox.workspace(name, fromDir),
      task: (id) => this.state.tasks.get(id),
      tasks: () => [...this.state.tasks.values()],
      undo: (id) => this.undo(id),
      approvals: () => [...this.state.approvals.values()],
      answer: (id, approved, by) => this.answer(id, approved, by),
      on: (l) => (this.listeners.add(l), () => this.listeners.delete(l)),
      job: (name, input, task) => this.job(name, input, task),
      note: (data, task) => void this.write({ type: 'note', track, task, data }),
      onWebhook: (name, handler) => {
        if (!/^[\w-]+$/.test(name)) throw new Error(`bad webhook name ${name}`);
        this.webhooks.set(`/hook/${track}/${name}`, handler);
      },
      secret: (name) => {
        if (!this.trackSecrets.get(track)?.has(name)) throw new Error(`${name} is not in track ${track}'s secrets`);
        const v = this.vault.get(name);
        if (v === undefined) throw new Error(`the vault has no ${name}`);
        return v;
      },
    };
  }

  /** Feed a log reader every event from its saved position. Retries an event that throws after 5 s. */
  addReader(track: string, reader: LogReader) {
    const cursor = path.join(HOME, 'cursors', `${track}.${reader.name}`);
    fs.mkdirSync(path.dirname(cursor), { recursive: true });
    let pos = fs.existsSync(cursor) ? Number(fs.readFileSync(cursor, 'utf8')) : 0;
    let busy = false;
    const pump = async () => {
      if (busy) return;
      busy = true;
      while (pos < this.log.events.length) {
        try {
          await reader.read(this.log.events[pos], this.boxFor(track));
        } catch (e) {
          console.error(`log reader ${track}.${reader.name} failed, retrying:`, e);
          setTimeout(pump, 5000);
          break;
        }
        fs.writeFileSync(cursor, String(++pos));
      }
      busy = false;
    };
    this.readers.push(pump);
  }

  async loadTracks() {
    const root = new URL('../tracks/', import.meta.url).pathname;
    if (!fs.existsSync(root)) return [];
    const loaded: Track[] = [];
    for (const name of fs.readdirSync(root).sort()) {
      const file = path.join(root, name, 'track.ts');
      if (!fs.existsSync(file)) continue;
      try {
        const track: Track = (await import(file)).default;
        if (track?.name !== name) throw new Error(`track.ts must default-export a Track named "${name}"`);
        this.trackSecrets.set(name, new Set(track.secrets ?? []));
        for (const tool of track.tools ?? []) {
          if (this.tools.has(tool.name)) throw new Error(`tool ${tool.name} already exists`);
          this.tools.set(tool.name, { tool, track: name });
        }
        for (const job of track.modelJobs ?? []) this.jobs.set(job.name, { job, track: name });
        for (const [key, route] of Object.entries(track.routes ?? {})) {
          const [method, p] = key.split(' ');
          this.routes.set(`${method} /t/${name}${p}`, { route, track: name });
        }
        for (const app of track.apps ?? []) this.apps.push({ ...app, track: name });
        for (const r of track.logReaders ?? []) this.addReader(name, r);
        loaded.push(track);
      } catch (e) {
        console.error(`track ${name} not loaded:`, e); // one broken track must not stop the box
      }
    }
    return loaded;
  }

  // ---------- the API: portal, demo, phone ----------

  // ---------- pairing a phone, and listing every box ----------

  /** This box plus the peer boxes in BOX_PEERS, so one portal lists and drives several (the Vultr second box). */
  boxes() {
    let peers: unknown[] = [];
    try {
      peers = JSON.parse(process.env.BOX_PEERS ?? '[]');
    } catch (e) {
      console.error('BOX_PEERS is not valid JSON:', e);
    }
    return [{ id: BOX_ID, name: BOX_NAME, stdb: DB, self: true }, ...peers];
  }

  /** Mint a one-time pairing code for the box screen's QR. Good for 5 minutes, usable once. */
  pairNew() {
    const code = randomBytes(4).toString('hex');
    this.pairCodes.set(code, Date.now() + 5 * 60 * 1000);
    return { code, url: `/pair#${code}`, box: { id: BOX_ID, name: BOX_NAME }, expiresInSec: 300 };
  }

  /** A phone redeems the code for a durable device token. */
  pair(body: { code?: string; name?: string }) {
    const expiry = body.code ? this.pairCodes.get(body.code) : undefined;
    if (!expiry || expiry < Date.now()) throw Object.assign(new Error('bad or expired pairing code'), { status: 400 });
    this.pairCodes.delete(String(body.code)); // one-time
    const device: Device = { id: 'd' + randomBytes(5).toString('hex'), name: String(body.name || 'phone').slice(0, 40), token: randomBytes(24).toString('hex'), pairedAt: new Date().toISOString() };
    this.devices.push(device);
    this.saveDevices();
    return { token: device.token, device: { id: device.id, name: device.name }, box: { id: BOX_ID, name: BOX_NAME } };
  }

  revokeDevice(id: string) {
    const d = this.devices.find((x) => x.id === id);
    if (!d) throw Object.assign(new Error(`no device ${id}`), { status: 404 });
    d.revoked = true;
    this.saveDevices();
    return { id, revoked: true };
  }

  deviceByToken(token?: string): Device | undefined {
    const t = (token ?? '').replace(/^Bearer /i, '');
    return t ? this.devices.find((d) => d.token === t && !d.revoked) : undefined;
  }

  saveDevices() {
    fs.writeFileSync(this.devicesPath, JSON.stringify(this.devices, null, 2), { mode: 0o600 });
  }

  /** Pairing and box-listing routes, served as JSON. Kept raw so they can read request headers. */
  pairing(req: http.IncomingMessage, res: http.ServerResponse) {
    const url = new URL(req.url ?? '/', 'http://box');
    const p = url.pathname.replace(/^\/api/, '');
    const m = req.method ?? 'GET';
    const routes = new Set(['/boxes', '/pair/new', '/pair', '/pair/devices']);
    const revoke = p.match(/^\/pair\/devices\/([\w-]+)\/revoke$/);
    if (!routes.has(p) && !revoke) return false;
    void (async () => {
      const json = (status: number, obj: unknown) => res.writeHead(status, { 'content-type': 'application/json' }).end(JSON.stringify(obj));
      try {
        const chunks: Buffer[] = [];
        for await (const c of req) chunks.push(c as Buffer);
        const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : {};
        if (m === 'GET' && p === '/boxes') return json(200, this.boxes());
        if (m === 'POST' && p === '/pair/new') return json(200, this.pairNew());
        if (m === 'POST' && p === '/pair') return json(200, this.pair(body));
        if (m === 'GET' && p === '/pair/devices') return json(200, this.devices.filter((d) => !d.revoked).map(({ token, ...d }) => d));
        if (m === 'POST' && revoke) return json(200, this.revokeDevice(revoke[1]));
        json(404, { error: 'not found' });
      } catch (e) {
        json((e as { status?: number }).status ?? 400, { error: (e as Error).message });
      }
    })();
    return true;
  }

  // ---------- the API: portal, phone, demo. Every route also answers under /api/. ----------

  api = () =>
    jsonServer(
      async (method, url, body, headers) => {
        const [, a, id, action] = url.pathname.replace(/^\/api(?=\/)/, '').split('/');
        const route = `${method} /${a ?? ''}${id ? '/:id' : ''}${action ? '/' + action : ''}`;
        const q = (name: string) => url.searchParams.get(name);
        switch (route) {
          case 'GET /tasks':
            return [...this.state.tasks.values()];
          case 'POST /tasks':
            return this.createTask(body);
          case 'GET /tasks/:id':
            return {
              task: this.must(id),
              approvals: [...this.state.approvals.values()].filter((x) => x.task === id),
              events: this.log.events.filter((e) => e.task === id),
            };
          case 'GET /tasks/:id/diff':
            return sandbox.diff(this.must(id));
          case 'POST /tasks/:id/undo':
            return this.undo(id);
          case 'GET /approvals':
            return [...this.state.approvals.values()].filter((x) => !q('state') || x.state === q('state'));
          case 'POST /approvals/:id': {
            // A phone sends its device token; it must be a paired, un-revoked device, and `by` becomes its name.
            let by = String(body.by ?? 'api');
            if (headers.authorization) {
              const device = this.deviceByToken(headers.authorization);
              if (!device) throw Object.assign(new Error('pair this phone with the box first'), { status: 401 });
              by = device.name;
            }
            return this.answer(id, body.approved === true, by);
          }
          case 'GET /log':
            return this.log.events.slice(Number(q('after') ?? 0)).filter((e) => !q('task') || e.task === q('task'));
          case 'GET /apps':
            return this.apps;
          case 'GET /health':
            return { ok: true, tasks: this.state.tasks.size, tools: [...this.tools.keys()], spacetime: { port: 3000, database: DB } };
        }
      },
      (req, res) => this.cors(req, res) || this.pairing(req, res) || this.logStream(req, res) || this.webhook(req, res) || this.trackRoute(req, res) || this.portal(req, res),
    );

  /** Browsers on other origins (a portal dev server) need BOX_ORIGINS, comma separated, or '*'. */
  cors(req: http.IncomingMessage, res: http.ServerResponse) {
    const origin = req.headers.origin;
    const allowed = (process.env.BOX_ORIGINS ?? '').split(',').map((o) => o.trim());
    if (!origin || !(allowed.includes(origin) || allowed.includes('*'))) return false;
    res.setHeader('access-control-allow-origin', origin);
    res.setHeader('access-control-allow-headers', 'content-type');
    res.setHeader('access-control-allow-methods', 'GET, POST, OPTIONS');
    if (req.method !== 'OPTIONS') return false;
    res.writeHead(204).end();
    return true;
  }

  /** Follow the action log live over Server-Sent Events, so a reader (Elastic, Jira) need not poll files.
   *  GET /api/log/stream?after=<seq>&task=<id>. Each event is `id: <seq>` + `data: <json>`. Resume with
   *  ?after=<seq> or the Last-Event-ID header; replays from there, then streams new events. */
  logStream(req: http.IncomingMessage, res: http.ServerResponse) {
    const url = new URL(req.url ?? '/', 'http://box');
    if (req.method !== 'GET' || url.pathname.replace(/^\/api/, '') !== '/log/stream') return false;
    const task = url.searchParams.get('task');
    let cursor = Number(req.headers['last-event-id'] ?? url.searchParams.get('after') ?? 0);
    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' });
    const send = (e: LogEvent) => {
      if (task && e.task !== task) return;
      res.write(`id: ${e.seq}
data: ${JSON.stringify(e)}

`);
    };
    for (const e of this.log.events.slice(cursor)) send(e); // replay from where the reader left off
    cursor = this.log.events.length;
    const listener = (e: LogEvent) => send(e);
    this.listeners.add(listener);
    const beat = setInterval(() => res.write(': beat\n\n'), 25000);
    beat.unref();
    const close = () => {
      this.listeners.delete(listener);
      clearInterval(beat);
    };
    req.on('close', close);
    res.on('error', close);
    return true;
  }

  webhook(req: http.IncomingMessage, res: http.ServerResponse) {
    const url = new URL(req.url ?? '/', 'http://box');
    const handler = this.webhooks.get(url.pathname);
    if (req.method !== 'POST' || !handler) return false;
    void (async () => {
      try {
        const chunks: Buffer[] = [];
        for await (const c of req) chunks.push(c as Buffer);
        const text = Buffer.concat(chunks).toString();
        const out = await handler(text ? JSON.parse(text) : {}, req.headers as Record<string, string>);
        res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(out ?? { ok: true }));
      } catch (e) {
        res.writeHead(400, { 'content-type': 'application/json' }).end(JSON.stringify({ error: (e as Error).message }));
      }
    })();
    return true;
  }

  trackRoute(req: http.IncomingMessage, res: http.ServerResponse) {
    const url = new URL(req.url ?? '/', 'http://box');
    const entry = this.routes.get(`${req.method} ${url.pathname}`);
    if (!entry) return false;
    void (async () => {
      try {
        const chunks: Buffer[] = [];
        for await (const c of req) chunks.push(c as Buffer);
        const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
        const request = new Request(url, {
          method: req.method,
          headers: req.headers as Record<string, string>,
          body: hasBody ? Buffer.concat(chunks) : undefined,
        });
        const r = await entry.route(request, this.boxFor(entry.track));
        res.writeHead(r.status, Object.fromEntries(r.headers)).end(Buffer.from(await r.arrayBuffer()));
      } catch (e) {
        res.writeHead(500, { 'content-type': 'application/json' }).end(JSON.stringify({ error: (e as Error).message }));
      }
    })();
    return true;
  }

  /** The built portal, if there is one, on the same address as the API: files, and index.html for page loads. */
  portal(req: http.IncomingMessage, res: http.ServerResponse) {
    const root = path.resolve(process.env.BOX_PORTAL ?? new URL('../portal/dist/', import.meta.url).pathname);
    const { pathname } = new URL(req.url ?? '/', 'http://box');
    if (req.method !== 'GET' || pathname.startsWith('/api/') || pathname.startsWith('/t/') || !fs.existsSync(root)) return false;
    const file = path.resolve(root, '.' + decodeURIComponent(pathname));
    const isFile = file.startsWith(root + path.sep) && fs.existsSync(file) && fs.statSync(file).isFile();
    if (!isFile && !(req.headers.accept ?? '').includes('text/html')) return false; // fetch('/tasks') still gets the API
    const target = isFile ? file : path.join(root, 'index.html');
    const types: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };
    res.writeHead(200, { 'content-type': types[path.extname(target)] ?? 'application/octet-stream' }).end(fs.readFileSync(target));
    return true;
  }

  async boot() {
    sandbox.workspace('home');
    try {
      firewall();
    } catch (e) {
      console.error(`WARNING: the firewall rule did not load, so tasks are not network-limited: ${(e as Error).message}`);
    }
    this.proxyPort = await startProxy({
      taskOf: (uid) => {
        const t = this.state.tasks.get(this.uidTask.get(uid) ?? '');
        return t?.state === 'running' || t?.state === 'waiting' ? t : undefined;
      },
      blocked: (t, host) => this.write({ type: 'net.blocked', task: t.id, host }),
      factoryKey: () => this.vault.get('FACTORY_API_KEY'),
    }, this.relay);
    const tracks = await this.loadTracks();
    for (const ws of fs.readdirSync(path.join(HOME, 'workspaces'))) this.refreshView(ws);
    // Resume what was going when the box went down. Approvals still pending stay pending.
    for (const t of this.state.tasks.values()) {
      if (t.state === 'queued' || t.state === 'running' || t.state === 'waiting') {
        console.log(`resuming ${t.id} (${t.state})`);
        void this.start(t);
      }
    }
    for (const pump of this.readers) pump();
    await listenSocket(this.api(), path.join(HOME, 'api.sock'));
    // BOX_PORT=auto (the demo) takes any free port and writes it to BOX_HOME/api.port.
    const want = process.env.BOX_PORT ?? '7700';
    if (want !== '0') {
      const server = this.api();
      await new Promise<void>((resolve) => server.listen(want === 'auto' ? 0 : Number(want), process.env.BOX_LISTEN ?? '127.0.0.1', resolve));
      const port = (server.address() as { port: number }).port;
      reservePort(port);
      fs.writeFileSync(path.join(HOME, 'api.port'), String(port));
    }
    for (const track of tracks) {
      for (const trig of track.triggers ?? []) {
        Promise.resolve()
          .then(() => trig.start(this.boxFor(track.name)))
          .catch((e) => console.error(`trigger ${track.name}.${trig.name} failed:`, e));
      }
    }
    this.live.start(); // publishes and connects in the background; the API above is already serving
    console.log(`box up: ${this.state.tasks.size} tasks in the log, tracks: ${tracks.map((t) => t.name).join(', ') || 'none'}`);
  }
}

// One bad connection or task must not take the box down. The log keeps the truth either way.
process.on('uncaughtException', (e) => console.error('uncaught:', e));
process.on('unhandledRejection', (e) => console.error('unhandled:', e));
sandbox.init();
await new Core().boot();
