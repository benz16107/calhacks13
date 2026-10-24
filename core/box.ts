// The box service. Runs as root: replays the log, resumes tasks, loads tracks, serves the API.
//   node --experimental-strip-types core/box.ts
// Env: BOX_HOME (default /var/lib/box), BOX_VAULT, BOX_PORT (default 7700, 0 = off), BOX_LISTEN (default 127.0.0.1).
import { spawn, type ChildProcess } from 'node:child_process';
import { execFileSync } from 'node:child_process';
import { createHash, createHmac, randomBytes } from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import type { App, Approval, ApprovalRoute, Box, FullSpec, Ctx, LogEvent, LogReader, ModelJob, NewEvent, Route, Task, TaskSpec, TaskState, Tool, Track, Who } from './contract.ts';
import { DEFAULT_POLICY, amountOf, approversFor, auditRows, checkPerson, checkSeats, checkShadow, goLiveRules, holds, notifyPeople, parsePolicy, pilot, refusal, route, toCsv, whoOf, type Business, type Person } from './business.ts';
import { DB, Live } from './live.ts';
import { Log, apply, canMove, doneLayers, fold, type State } from './log.ts';
import { ANTHROPIC_PLACEHOLDER, PLACEHOLDER_KEY, firewall, logBlocked, stopLoggingBlocked, uidOf, relayCert, reservePort, startProxy } from './net.ts';
import * as sandbox from './sandbox.ts';
import { HOME, dirs } from './sandbox.ts';
import { MODELS, modelProblem, resolveModel } from './models.ts';
import { usageCents } from './pricing.ts';
import { DEFAULT_SETTINGS, SETUP_STEPS, applyPatch, folderRefusal, hadHumanUse, hostProblem, insideAny, neverFolder, loadDisabled, loadSetup, loadSettings, readJson, recordStep, saveDisabled, saveSettings, saveSetup, writeJson, type Settings, type SetupState } from './config.ts';
import * as system from './system.ts';
import { VAULT_NAME, loadVault, removeVaultKey, writeVaultKey } from './vault.ts';
import { challenge, checkSso, noGroup, personId, provider, random, roleFor, verifyIdToken, whoIs, type Claims, type Sso } from './sso.ts';
import * as push from './push.ts';
import { APP, RELAY, Remote, SECRET_KEY } from './remote.ts';

type Handler = (method: string, url: URL, body: any, headers: http.IncomingHttpHeaders, req: http.IncomingMessage) => unknown;

/** A JSON-over-HTTP server. Thrown errors become 400s. */
function jsonServer(handler: Handler, raw?: (req: http.IncomingMessage, res: http.ServerResponse) => boolean) {
  const server = http.createServer(async (req, res) => {
    if (raw?.(req, res)) return;
    let text = '';
    for await (const chunk of req) text += chunk;
    let status = 200;
    let out: unknown;
    try {
      let body: unknown = {};
      try {
        body = text ? JSON.parse(text) : {};
      } catch {
        throw new Error("the request body isn't valid JSON");
      }
      out = await handler(req.method ?? 'GET', new URL(req.url ?? '/', 'http://box'), body, req.headers, req);
      if (out === undefined) [status, out] = [404, { error: 'not found' }];
    } catch (e) {
      status = (e as { status?: number }).status ?? 400;
      out = { error: (e as Error).message };
    }
    res.writeHead(status, { 'content-type': 'application/json' }).end(JSON.stringify(out));
  });
  server.requestTimeout = 0; // approvals can wait for hours
  // Keep idle connections well past any client's own idle time (Node's fetch keeps them 4 s), so the box never closes
  // a socket just as a client reuses it (ECONNRESET). headersTimeout must stay above keepAliveTimeout.
  server.keepAliveTimeout = 65_000;
  server.headersTimeout = 66_000;
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
  /** Paired from the box's own screen as the owner: may use setup, settings, apps and the vault. */
  owner?: boolean;
  /** The phone's SpacetimeDB identity, if it gave one: the box vouches for it so its answers there are accepted. */
  identity?: string;
  /** The app's push subscription and the key it made for this box, once the phone turned notifications on. */
  push?: push.PushSub;
  /** Business: the person this phone signs in as (paired with a code an admin made for them). */
  person?: string;
}

const forbid = (message: string): never => {
  throw Object.assign(new Error(message), { status: 403 });
};

class Core {
  log = new Log(path.join(HOME, 'log.jsonl'));
  state: State = fold(this.log.events);
  vault = loadVault();
  tools = new Map<string, { tool: Tool; track: string }>();
  jobs = new Map<string, { job: ModelJob; track: string }>();
  routes = new Map<string, { route: Route; track: string; open: boolean }>();
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
  screens = new Map<string, string>(); // SpacetimeDB identity -> name, for the box's own screen(s); lost on restart, re-sent on the next page load
  pairCodes = new Map<string, { expiry: number; owner: boolean; person?: string }>(); // one-time code -> expiry (ms), whether it pairs an owner device, and for whom (Business)
  ownerPath = path.join(HOME, 'owner.json');
  // The human with sudo on a Personal box: set at runtime (the image does it after the desktop's own setup
  // makes the account), else BOX_OWNER, else none (a Server box).
  owner: string | null = (() => {
    try {
      return JSON.parse(fs.readFileSync(this.ownerPath, 'utf8')).user ?? null;
    } catch {
      return process.env.BOX_OWNER ?? null;
    }
  })();
  settings: Settings = loadSettings(HOME);
  setup: SetupState = loadSetup(HOME, hadHumanUse(this.log.events as never, fs.existsSync(new URL('../tracks/', import.meta.url)) ? fs.readdirSync(new URL('../tracks/', import.meta.url)) : [], this.devices.length));
  vaultMetaPath = path.join(HOME, 'vault-meta.json');
  vaultMeta: Record<string, string> = fs.existsSync(this.vaultMetaPath) ? JSON.parse(fs.readFileSync(this.vaultMetaPath, 'utf8')) : {};
  startedAt = new Date().toISOString();
  apiPort = 0;
  /** This box's own https address through the GurtOS relay, when the owner turned it on. */
  remote = new Remote(HOME, {
    secret: () => this.vault.get(SECRET_KEY),
    setSecret: (v) => (writeVaultKey(SECRET_KEY, v), this.vault.set(SECRET_KEY, v)),
    dropSecret: () => (removeVaultKey(SECRET_KEY), this.vault.delete(SECRET_KEY)),
    apiPort: () => this.apiPort,
    startedAt: () => this.startedAt,
    note: (data) => this.write({ type: 'note', track: 'remote', data }),
  });
  // Was the last stop clean (a restart or deploy), so the screen should not say it came back from a power cut?
  cleanStart = (() => {
    const marker = path.join(HOME, 'clean-stop');
    const clean = fs.existsSync(marker);
    fs.rmSync(marker, { force: true });
    return clean;
  })();
  resumed: string[] = []; // tasks boot() restarted after a power cut, for the screen's banner
  // GurtOS Business: people, their roles and the policy. Off unless turned on, so Server and Personal are unchanged.
  businessPath = path.join(HOME, 'business.json');
  tripped = new Set<string>(); // tasks whose decoy key has already been caught

  /**
   * Tripwire: every task holds a decoy cloud key in its environment, the same each time it starts. It is never real,
   * so it only ever leaves a task if an agent tries to move secrets. Derived from a box-only key, so it is not in the log.
   */
  decoy(id: string) {
    const f = path.join(HOME, 'tripwire.key');
    if (!fs.existsSync(f)) fs.writeFileSync(f, randomBytes(32).toString('hex'), { mode: 0o600 });
    const h = createHmac('sha256', fs.readFileSync(f, 'utf8')).update(id).digest();
    return { id: 'AKIA' + h.subarray(0, 10).toString('hex').toUpperCase().slice(0, 16), secret: h.subarray(10).toString('base64').replace(/[^A-Za-z0-9]/g, '').slice(0, 40) };
  }

  leaks(t: Task, text: string) {
    const d = this.decoy(t.id);
    return text.includes(d.secret) || text.includes(d.id);
  }

  /** The decoy left the task: stop and undo it, log where it was caught (never the key), and tell the owner's phones. */
  tripwire(t: Task, where: string) {
    if (this.tripped.has(t.id)) return;
    this.tripped.add(t.id);
    this.write({ type: 'note', track: 'security', task: t.id, data: { tripwire: true, where } });
    void this.undo(t.id).catch((e) => console.error(`tripwire: could not undo ${t.id}: ${(e as Error).message}`));
    const fields = { type: 'tripwire', id: `tripwire.${t.id}`, task: t.id, source: t.source, costCents: 0, title: 'An agent tried to leak a key', body: `"${t.title}" tried to send its decoy key out (${where}). The box stopped it and undid its changes.`.slice(0, 200) };
    if (this.remote.saved) for (const d of this.devices.filter((x) => x.owner && x.push && !x.revoked)) void this.pushTo(d, fields, fields.id).catch(() => {});
  }
  business: Business = { on: process.env.BOX_EDITION === 'business', company: '', policy: DEFAULT_POLICY, people: [], seats: [], shadow: [], policyMeta: {}, ...readJson<Partial<Business>>(this.businessPath, {}) };
  // The kill switch is Settings' `paused`: every agent stops until someone resumes them. Who pulled it is kept beside it.
  pausedPath = path.join(HOME, 'paused.json');
  pausedMeta: { by: string; at: string; via?: string } | null = readJson(this.pausedPath, null);
  get paused(): { by: string; at: string; via?: string } | null {
    return this.settings.paused ? (this.pausedMeta ?? { by: 'the owner', at: this.startedAt }) : null;
  }
  // The last person who approved one of each task's requests, for the `who` on its later events.
  lastApprover = new Map(this.log.events.flatMap((e) => (e.type === 'approval.answered' && e.approved && e.person ? [[e.task, e.person] as [string, string]] : [])));
  linksPath = path.join(HOME, 'links.json');
  links: Record<string, string | Record<string, string>> = fs.existsSync(this.linksPath) ? JSON.parse(fs.readFileSync(this.linksPath, 'utf8')) : {};
  uidTask = new Map<number, string>();
  relay = relayCert(HOME);
  proxyPort = 0;
  live = new Live({
    tasks: () => [...this.state.tasks.values()],
    approvals: () => [...this.state.approvals.values()],
    // On GurtOS Business only a person's connection answers in SpacetimeDB, and the box checks it again as that person.
    answer: (id, approved, by, person) =>
      this.business.on
        ? person
          ? this.answerAs(id, approved, this.person(person), 'SpacetimeDB')
          : console.error(`spacetime: ignored an answer to ${id}; on GurtOS Business only a person answers`)
        : this.answer(id, approved, by),
    identities: () => this.identities(),
    people: () => this.peopleIdentities(),
    routed: (a) => this.routing(a),
  });

  write(e: NewEvent): LogEvent {
    if (this.business.on && !e.who) {
      const who = this.whoFor(e);
      if (who) e = { ...e, who };
    }
    const full = this.log.append(e);
    apply(this.state, full);
    // Tripwire: the task's decoy key in anything it wrote (a step, a tool's input or output, a note).
    if (full.task && ['task.step', 'tool.call', 'tool.result', 'note'].includes(full.type) && (full as { track?: string }).track !== 'security') {
      const t = this.state.tasks.get(full.task);
      if (t && !this.tripped.has(t.id) && this.leaks(t, JSON.stringify(full))) queueMicrotask(() => this.tripwire(t, full.type));
    }
    if (full.type === 'approval.answered' && full.approved && full.person) this.lastApprover.set(full.task, full.person);
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
    if (full.type === 'approval.asked') void this.pushApproval(full.approval);
    return full;
  }

  /** Business: who asked for the task this event belongs to, which seat works it, and who approved. */
  whoFor(e: NewEvent): Who | undefined {
    const t = e.type === 'task.created' ? { source: e.spec.source, seat: e.spec.seat, requestedBy: e.requestedBy } : e.task ? this.state.tasks.get(e.task) : undefined;
    return t ? whoOf(e as { type: string; person?: string; by?: string }, t, e.task ? this.lastApprover.get(e.task) : undefined) : undefined;
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

  /** `requestedBy` is the person who asked (Business), from their paired phone or the track route they called. */
  async createTask(spec: TaskSpec, requestedBy?: string): Promise<Task> {
    const known = ['title', 'prompt', 'workspace', 'worker', 'tools', 'hosts', 'budgetCents', 'source', 'folder', 'folders', 'seat', 'droid', 'model'];
    const unknown = Object.keys(spec ?? {}).filter((k) => !known.includes(k));
    if (unknown.length) throw new Error(`unknown task field${unknown.length > 1 ? 's' : ''}: ${unknown.join(', ')} (known: ${known.join(', ')})`);
    // What a task does not name comes from the owner's settings: the budget and the network it gets.
    const dflt = { hosts: this.settings.networkDefault === 'allowlist' ? this.settings.defaultHosts : [], budgetCents: this.settings.defaultBudgetCents };
    const s: FullSpec = { workspace: 'home', worker: 'droid', tools: [], source: 'api', ...spec, hosts: spec.hosts ?? dflt.hosts, budgetCents: spec.budgetCents ?? dflt.budgetCents };
    if (!s.title || !s.prompt) throw new Error('a task needs a title and a prompt');
    if (s.droid !== undefined) {
      const { plan, autonomy, ...rest } = s.droid as Record<string, unknown>;
      if (Object.keys(rest).length || (plan !== undefined && typeof plan !== 'boolean') || (autonomy !== undefined && !['low', 'medium', 'high'].includes(autonomy as string)))
        throw new Error("droid: {plan?: true or false, autonomy?: 'low', 'medium' or 'high'}");
      // Droid's autonomy level, enforced by the box as well: the network and the budget follow it.
      if (autonomy === 'low') Object.assign(s, { hosts: [], budgetCents: 0 });
      if (autonomy === 'medium') s.budgetCents = Math.min(s.budgetCents, 100);
    }
    // Checked here, at the one door every task comes through (the API, tracks, triggers).
    if (typeof s.title !== 'string' || s.title.length > 200) throw new Error('title: text, at most 200 characters');
    if (typeof s.prompt !== 'string' || s.prompt.length > 100_000) throw new Error('prompt: text, at most 100,000 characters');
    if (!Number.isInteger(s.budgetCents) || s.budgetCents < 0 || s.budgetCents > 100_000) throw new Error('budgetCents: a whole number of cents from 0 to 100000 ($1,000)');
    if (!Array.isArray(s.hosts) || s.hosts.length > 50) throw new Error('hosts: a list of at most 50 host names');
    for (const h of s.hosts) {
      const problem = hostProblem(h);
      if (problem) throw new Error(`hosts: ${problem}`);
    }
    s.hosts = s.hosts.map((h) => h.toLowerCase());
    if (!Array.isArray(s.tools) || s.tools.some((x) => typeof x !== 'string')) throw new Error('tools: a list of tool names');
    if (!/^[\w.-]+$/.test(s.workspace) || !fs.existsSync(dirs.workspace(s.workspace))) throw new Error(`no workspace ${s.workspace}`);
    if (!['droid', 'fake'].includes(s.worker)) throw new Error(`no worker ${s.worker}`);
    const why = modelProblem(s.model);
    if (why) throw new Error(why);
    if (s.worker === 'droid') s.model = resolveModel(s.model); // the task records the exact model it ran on, the default too
    else delete s.model; // a scripted worker runs no model
    if (s.seat !== undefined && (typeof s.seat !== 'string' || !s.seat.trim() || s.seat.length > 60)) throw new Error('seat: text, at most 60 characters, like "Credit analyst"');
    // A demo run spends no Factory credit unless it was asked to: a track that wants a real agent must be gated behind DEMO_LIVE=droid.
    if (s.worker === 'droid' && process.env.BOX_NO_DROID) throw new Error('real Droid is off in this demo run (it spends Factory credit); DEMO_LIVE=droid ./demo, or ./demo --live-droid, turns it on');
    for (const name of s.tools) if (!this.tools.has(name)) throw new Error(`no tool ${name}`);
    // Apps may hand the agent what they remember. A Droid task gets it after its prompt; any task logs what it was handed.
    // Never for a guest's task (a stranger through the public Mana app or ASI:One): its result goes back to the stranger.
    // Each app gets 2 s, and all of them together may add 8,000 characters, so a slow app or a long memory cannot hold up or swamp a task.
    const handed: string[] = [];
    const guest = /^guest(-run)?:/.test(s.source) || s.workspace === 'guest';
    let room = 8000;
    for (const [name, rec] of guest ? [] : this.installed) {
      if (!this.active.has(name) || !rec.track?.taskContext || room <= 0) continue;
      try {
        const text = await Promise.race([
          Promise.resolve(rec.track.taskContext(spec, this.boxFor(name))),
          new Promise<never>((_, no) => setTimeout(() => no(new Error('took longer than 2 s')), 2000).unref()),
        ]);
        if (text) handed.push(text.slice(0, room)), (room -= text.length);
      } catch (e) {
        console.error(`track ${name}: taskContext failed, the task starts without it:`, (e as Error).message);
      }
    }
    const id = 't' + Date.now().toString(36).slice(-6) + randomBytes(2).toString('hex');
    this.write({ type: 'task.created', task: id, spec: s.worker === 'droid' && handed.length ? { ...s, prompt: `${s.prompt}\n\n${handed.join('\n\n')}` } : s, user: `box-${id}`, ...(requestedBy ? { requestedBy } : {}) });
    if (handed.length) this.write({ type: 'task.step', task: id, text: `Handed over ${handed.length} memory block${handed.length > 1 ? 's' : ''}`, data: { memory: handed.join('\n\n') } });
    const t = this.must(id);
    if (!this.settings.paused) await this.start(t); // paused: it stays queued until the owner resumes
    return t;
  }

  /** Start a queued task, or resume a running or waiting one after a restart. */
  async start(t: Task) {
    if (this.paused) return; // the kill switch is on: it starts when someone resumes the agents
    try {
      sandbox.kill(t); // a worker left over from a core that died without the box rebooting
      // A linked (real-folder) workspace is not layer-stacked: each task starts from the real folder, and
      // the owner Keeps or Undoes it. An owned workspace stacks done tasks as layers (Server undo model).
      const layers = sandbox.isLinked(t.workspace) ? [] : doneLayers(this.log.events, this.state, t.workspace);
      if (t.state === 'queued') this.move(t, 'running', { layers });
      // Everything goes through the box's proxy. Its own address stays direct, for Droid's Factory calls.
      const proxy = `http://127.0.0.1:${this.proxyPort}`;
      const env: Record<string, string> = {
        HTTP_PROXY: proxy,
        HTTPS_PROXY: proxy,
        http_proxy: proxy,
        https_proxy: proxy,
        NO_PROXY: '127.0.0.1',
        NODE_USE_ENV_PROXY: '1',
        AWS_ACCESS_KEY_ID: this.decoy(t.id).id, // the tripwire: a decoy, never a real key
        AWS_SECRET_ACCESS_KEY: this.decoy(t.id).secret,
      };
      let byok: string | undefined; // the model id, when the task runs on the owner's own Anthropic key
      if (t.worker === 'droid') {
        if (!this.modelVia()) this.vault = loadVault(); // a key added to the file by hand since boot
        // An image downloads Droid at first boot (its license forbids shipping it in the image).
        if (!fs.existsSync('/usr/local/bin/droid')) throw new Error('Droid is still downloading; it arrives a minute after the first start with a network connection');
        const via = this.modelVia();
        if (!via) throw new Error('the vault has no model key: add ANTHROPIC_API_KEY or FACTORY_API_KEY in Setup');
        // The task holds placeholders. The proxy swaps in the real key on the way to Factory or Anthropic.
        if (via === 'anthropic') byok = resolveModel(t.model);
        Object.assign(env, {
          FACTORY_API_KEY: PLACEHOLDER_KEY, // the SDK wants one even when the model is the owner's own key
          FACTORY_API_BASE_URL: proxy,
          FACTORY_EXTRA_CA_CERTS: this.relay.caPem,
          NODE_EXTRA_CA_CERTS: this.relay.caPem,
          FACTORY_RIPGREP_PATH: '/usr/bin/rg',
          BOX_MODEL: byok ? `custom:${byok}` : resolveModel(t.model),
          ...(process.env.BOX_REVIEW ? { BOX_REVIEW: process.env.BOX_REVIEW } : {}),
        });
      }
      const ids = await sandbox.prepare(t);
      if (byok) {
        // Droid reads its own-key models from the task user's ~/.factory/settings.json; the key there is a placeholder.
        const dir = path.join(dirs.task(t.id), 'home', '.factory');
        fs.mkdirSync(dir, { recursive: true });
        // The task's model, plus Haiku for the second-pair-of-eyes check (core/workers/review.ts).
        const customModels = [...new Set([byok, MODELS.haiku])].map((model) => ({ model, displayName: 'Claude (your Anthropic key)', baseUrl: 'https://api.anthropic.com', apiKey: ANTHROPIC_PLACEHOLDER, provider: 'anthropic', maxOutputTokens: 8192 }));
        fs.writeFileSync(path.join(dir, 'settings.json'), JSON.stringify({ customModels }));
        execFileSync('chown', ['-R', `${ids.uid}:${ids.gid}`, dir]);
      }
      sandbox.snapshotBase(t);
      this.uidTask.set(ids.uid, t.id);
      logBlocked(ids.uid, t.id);
      await this.openBroker(t, ids);
      if (this.paused) {
        // Paused while this task was getting ready. Resume starts it again from the top.
        this.brokers.get(t.id)?.close();
        this.brokers.delete(t.id);
        return;
      }
      const child = sandbox.spawnWorker(t, ids, env);
      this.workers.set(t.id, child);
      child.on('exit', (code, signal) => {
        this.workers.delete(t.id);
        if (t.state === 'running' || t.state === 'waiting') {
          const why = code === 0 ? undefined : sandbox.workerError(t);
          this.move(t, code === 0 ? 'done' : 'failed', code === 0 ? {} : { error: `worker exited with ${signal ?? code}${why ? `: ${why}` : ''}` });
          // A task on the owner's real folder waits for their Keep or Undo.
          if (code === 0 && sandbox.isLinked(t.workspace)) this.write({ type: 'keep', task: t.id, result: 'pending' });
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
    stopLoggingBlocked(t.id);
    this.brokers.get(t.id)?.close();
    this.brokers.delete(t.id);
    sandbox.seal(t);
    if ((t.state === 'done' || t.state === 'undone') && !sandbox.isLinked(t.workspace)) this.refreshView(t.workspace);
    this.sweepUndone();
  }

  /**
   * The firewall refuses a task's direct connections (the ones that go around the proxy) and logs each with the
   * task's uid. Follow that kernel log and write a net.blocked event for each, so the action log shows an
   * attempt the proxy never saw. One event per task and destination every few seconds, not one per retry.
   */
  watchBlocked() {
    const child = spawn('journalctl', ['-k', '-f', '-n', '0', '-o', 'cat'], { stdio: ['ignore', 'pipe', 'ignore'] });
    child.on('error', () => {}); // no journal on this machine: the proxy's refusals are still logged
    child.unref();
    const lastSeen = new Map<string, number>();
    let buf = '';
    child.stdout?.on('data', (chunk: Buffer) => {
      buf += chunk.toString();
      const lines = buf.split('\n');
      buf = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.includes('box-block')) continue;
        const uid = Number(/box-block:(\d+)/.exec(line)?.[1]); // the per-task rule's prefix carries the uid
        const dst = /DST=(\S+)/.exec(line)?.[1];
        const dpt = /DPT=(\d+)/.exec(line)?.[1];
        const task = this.state.tasks.get(this.uidTask.get(uid) ?? '');
        if (!task || !dst) continue; // not one of this box's tasks (another box on the machine, or a stray)
        if (dst.startsWith('127.0.0.53') && dpt === '53') continue; // the tool's own resolver lookup: refused, but not an attack to show anyone
        // Other DNS lookups (a task asking a resolver itself; the proxy resolves names for tasks) are refused and logged
        // once per task, so a run of them can't flood the log but an attempt still shows.
        const dns = dpt === '53';
        const host = dns ? 'DNS lookups (port 53)' : dpt ? `${dst}:${dpt}` : dst;
        const key = `${task.id}|${host}`;
        if (dns ? lastSeen.has(key) : Date.now() - (lastSeen.get(key) ?? 0) < 5000) continue;
        lastSeen.set(key, Date.now());
        this.write({ type: 'net.blocked', task: task.id, host });
      }
    });
    return child;
  }

  /** Delete the files of undone tasks that no running task still reads as a lower layer. */
  sweepUndone() {
    const needed = new Set<string>();
    for (const t of this.state.tasks.values()) if (t.state === 'queued' || t.state === 'running' || t.state === 'waiting') for (const l of t.layers) needed.add(l);
    for (const t of this.state.tasks.values()) if (t.state === 'undone' && !needed.has(t.id) && !this.workers.has(t.id)) sandbox.purge(t);
  }

  refreshView(workspace: string) {
    sandbox.refreshView(workspace, doneLayers(this.log.events, this.state, workspace));
  }

  async undo(id: string): Promise<Task> {
    const t = this.must(id);
    if (t.state === 'undone') return t;
    this.move(t, 'undone');
    for (const a of this.state.approvals.values()) if (a.task === id && a.state === 'pending') this.answer(a.id, false, 'undo');
    if (this.workers.has(id)) {
      sandbox.kill(t); // the exit handler finishes it
      if (this.paused) sandbox.freeze(t, false); // a stopped task takes the kill once it is let go
    } else this.finish(t);
    return t;
  }

  // ---------- approvals ----------

  /** Pause the task until someone answers. The same key returns the same approval, even after a restart. */
  pauseWaiters: (() => void)[] = [];
  /** Resolves at once, or when the owner turns Pause all agents off. */
  untilResumed(): Promise<void> {
    return this.settings.paused ? new Promise((r) => this.pauseWaiters.push(r)) : Promise.resolve();
  }

  /** Pause all agents off: release every held step and start the tasks that queued meanwhile. */
  resumeAll() {
    for (const r of this.pauseWaiters.splice(0)) r();
    for (const t of this.state.tasks.values()) {
      if (this.workers.has(t.id)) sandbox.freeze(t, false);
      else if (t.state === 'queued' || t.state === 'running' || t.state === 'waiting') void this.start(t);
    }
  }

  /** The kill switch changed, from Settings or /api/pause: freeze or thaw every task at once, and log who did it. */
  pauseChanged(on: boolean, req: http.IncomingMessage) {
    const { name, via, who } = this.actor(req);
    const how = new Set<string>();
    if (on) {
      this.pausedMeta = { by: name, at: new Date().toISOString(), via };
      writeJson(this.pausedPath, this.pausedMeta);
      for (const t of this.state.tasks.values()) if (this.workers.has(t.id)) how.add(sandbox.freeze(t, true));
    } else {
      this.pausedMeta = null;
      fs.rmSync(this.pausedPath, { force: true });
    }
    this.write({ type: 'note', track: 'kill-switch', data: { paused: on, by: name, via, ...(on ? { tasks: [...this.workers.keys()], how: [...how] } : {}) }, ...(who ? { who } : {}) });
    if (!on) this.resumeAll();
  }

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
  async askFor(t: Task, key: string, opts: { question: string; costCents?: number; payee?: string; purpose?: string; shadow?: string }): Promise<'approved' | 'denied' | 'pending'> {
    const id = `${t.id}.${key}`;
    if (!this.state.approvals.has(id)) {
      const approval: Approval = { id, task: t.id, question: opts.question, costCents: opts.costCents ?? 0, payee: opts.payee, purpose: opts.purpose, state: 'pending', ...(opts.shadow ? { shadow: opts.shadow } : {}) };
      if (this.business.on) Object.assign(approval, { ...(t.requestedBy ? { askedBy: t.requestedBy } : {}), route: this.routeOf(approval, t) });
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

  answer(id: string, approved: boolean, by: string, person?: string, via?: string): Approval {
    const a = this.state.approvals.get(id);
    if (!a) throw new Error(`no approval ${id}`);
    if (a.state !== 'pending') return a; // the first answer wins
    this.write({ type: 'approval.answered', task: a.task, id, approved, by, ...(person ? { person } : {}), ...(via ? { via } : {}) });
    for (const resolve of this.waiters.get(id) ?? []) resolve(approved);
    this.waiters.delete(id);
    return a;
  }

  // ---------- GurtOS Business: people, the policy, the audit ----------

  /** Where the policy sends a request. Asked before Business was turned on, it is worked out now. */
  routeOf(a: Pick<Approval, 'question' | 'costCents' | 'payee' | 'purpose'>, t: Task): ApprovalRoute {
    const ask = { text: [a.question, a.purpose, a.payee].filter(Boolean).join(' '), amountCents: amountOf(a.costCents, a.question), app: this.appOf(t) };
    return route(parsePolicy(this.business.policy), ask, this.business.people, t.requestedBy);
  }

  /** The app (track) a task came from, from its source ('credit-desk:abc'), or '' for the API or a phone. */
  appOf(t: Task): string {
    const name = t.source.split(':')[0];
    return this.installed.has(name) ? name : '';
  }

  /**
   * Answer as a person, on a Business box: only a person, never their own request, only one the policy sends to
   * them, and to approve, only within their limit. A refusal is logged and answered with 403. Off, as before.
   */
  answerAs(id: string, approved: boolean, p: Person | undefined, by: string): Approval {
    if (!this.business.on) return this.answer(id, approved, by);
    const a = this.state.approvals.get(id);
    if (!a) throw new Error(`no approval ${id}`);
    const t = this.must(a.task);
    const r = a.route ?? this.routeOf(a, t);
    const why = refusal(p, { to: r.to, amountCents: r.amountCents, askedBy: a.askedBy ?? t.requestedBy, rule: r.rule }, approved);
    if (why) {
      this.write({ type: 'note', track: 'business', task: a.task, data: { refused: id, approved, by: p?.id ?? by, person: !!p, why } });
      forbid(why);
    }
    return this.answer(id, approved, p!.name, p!.id, by); // `by` is the phone's name, or what the box's screen says
  }

  /** Business: every paired connection that belongs to a person, for SpacetimeDB: [identity, person id, name]. */
  peopleIdentities(): [string, string, string][] {
    if (!this.business.on) return [];
    return this.devices.flatMap((d) => {
      const p = !d.revoked && d.identity ? this.person(d.person) : undefined;
      return p ? [[d.identity!, p.id, p.name] as [string, string, string]] : [];
    });
  }

  /**
   * Business: who SpacetimeDB sends a routed request to. `notifyPeople` is the one definition, shared with push and
   * Waiting for me: the people who can approve it now, or, when nobody can, everyone who may deny it and every owner
   * (`canApprove: false`). The route's own list is only who could approve it when it was asked.
   */
  routing(a: Approval) {
    if (!this.business.on || !a.route) return undefined;
    const r = a.route;
    const t = this.state.tasks.get(a.task);
    const { ids, stuck } = notifyPeople({ to: r.to, amountCents: r.amountCents, askedBy: a.askedBy ?? t?.requestedBy, rule: r.rule }, this.business.people);
    const row = (id: string, canApprove: boolean) => {
      const p = this.person(id);
      return p ? [{ person: p.id, name: p.name, canApprove }] : [];
    };
    // A route may name people to remind when nobody has answered in time; SpacetimeDB's timer brings them in.
    const remind = (r as { remind?: { afterMs: number; people: { id: string; name: string }[] } }).remind;
    return {
      people: ids.flatMap((id) => row(id, !stuck)),
      remind: (remind?.people ?? []).flatMap((p) => row(p.id, !stuck && ids.includes(p.id))),
      remindAfterSec: Math.round((remind?.afterMs ?? 0) / 1000),
    };
  }

  saveBusiness() {
    writeJson(this.businessPath, this.business);
  }

  person(id: string | undefined): Person | undefined {
    return id ? this.business.people.find((p) => p.id === id) : undefined;
  }

  /**
   * The person behind a request on a Business box: the person a paired phone was paired for, or, on the box's own
   * screen, the person it says with the `x-box-person` header (the screen is trusted, as it always was). A helper
   * service on the box (one running as nobody or as a task user) is never a person.
   */
  personOf(req: http.IncomingMessage): Person | undefined {
    if (!this.business.on) return undefined;
    const device = this.deviceOf(req);
    if (device) return this.person(device.person);
    const said = req.headers['x-box-person'];
    return this.isLocal(req) && !this.serviceCaller(req) && typeof said === 'string' ? this.person(said) : undefined;
  }

  /** Who is acting, for the log: the person, else the phone, else the box's screen; and the phone or screen it came from. */
  actor(req: http.IncomingMessage): { name: string; via: string; who?: Who } {
    const p = this.personOf(req);
    const via = this.deviceOf(req)?.name ?? 'box screen';
    return p ? { name: p.name, via, who: { by: p.id } } : { name: via, via };
  }

  /** People, the policy and the kill switch: the owner (the box's screen, an owner phone) or a Business admin. */
  requireAdmin(req: http.IncomingMessage) {
    const role = this.personOf(req)?.role;
    if (!this.isOwner(req) && role !== 'admin' && role !== 'owner') forbid('only an admin or the owner can do this');
  }

  /** The audit: the owner, a Business admin, or an auditor. */
  requireAuditor(req: http.IncomingMessage) {
    const role = this.personOf(req)?.role;
    if (!this.isOwner(req) && role !== 'admin' && role !== 'owner' && role !== 'auditor') forbid('only an auditor, an admin or the owner can read the audit');
  }

  setBusiness(body: unknown, req: http.IncomingMessage) {
    if (!body || typeof body !== 'object') throw new Error('send {on, company, policy}');
    const b = body as Record<string, unknown>;
    const unknown = Object.keys(b).filter((k) => !['on', 'company', 'policy', 'seats', 'sso', 'shadow'].includes(k));
    if (unknown.length) throw new Error(`unknown field: ${unknown.join(', ')} (known: on, company, policy, seats, sso, shadow)`);
    if ('on' in b) {
      if (typeof b.on !== 'boolean') throw new Error('on: true or false');
      if (!this.isOwner(req)) forbid('only the owner turns GurtOS Business on or off');
    }
    this.requireAdmin(req);
    if ('company' in b && (typeof b.company !== 'string' || b.company.length > 80)) throw new Error('company: text, at most 80 characters');
    if ('policy' in b) parsePolicy(b.policy as string); // throws naming the bad line
    if ('seats' in b) b.seats = checkSeats(b.seats);
    if ('sso' in b) {
      b.sso = b.sso === null ? undefined : checkSso(b.sso); // null turns work-account sign-in off
      const owners = (s?: Sso) => Object.values(s?.groups ?? {}).some((g) => g.role === 'owner');
      if ((owners(b.sso as Sso | undefined) || owners(this.business.sso)) && !this.isOwner(req)) forbid('only the owner can map a group to the owner role');
    }
    // A seat counts once it is declared, or once a task on this box has worked in it (the credit desk's seats).
    const worked = [...this.state.tasks.values()].flatMap((t) => (t.seat ? [{ name: t.seat }] : []));
    if ('shadow' in b) b.shadow = checkShadow(b.shadow, [...((b.seats as Business['seats']) ?? this.business.seats), ...worked]);
    const { name, who } = this.actor(req);
    const was = this.business.on;
    if ('policy' in b) {
      // Who changed each rule: a line that is new or changed gets this person and time; the others keep theirs.
      const at = new Date().toISOString();
      const meta: Business['policyMeta'] = {};
      for (const r of parsePolicy(b.policy as string)) meta[r.line] = this.business.policyMeta[r.line] ?? { by: name, at };
      this.business.policyMeta = meta;
    }
    Object.assign(this.business, b);
    this.saveBusiness();
    this.write({ type: 'note', track: 'business', data: { changed: Object.keys(b), on: this.business.on, by: name, ...('shadow' in b ? { shadow: this.business.shadow } : {}) }, ...(who ? { who } : {}) });
    // On Business only people answer in SpacetimeDB: the box stops vouching for devices and vouches for people instead.
    if (was !== this.business.on) {
      for (const [identity, n] of [...this.screens, ...this.devices.filter((d) => d.identity && !d.revoked).map((d) => [d.identity!, d.name] as [string, string])]) this.business.on ? this.live.unregister(identity) : this.live.register(identity, n);
      for (const d of this.devices) if (d.identity && !d.revoked && d.person) this.business.on ? this.live.registerPerson(d.identity, d.person, this.person(d.person)?.name ?? d.name) : this.live.removePerson(d.identity);
    }
    return this.businessView();
  }

  /** The edition's settings for the screens: each rule with who approves under it and who last changed it. */
  businessView() {
    const rules = parsePolicy(this.business.policy).map((r) => ({
      ...r,
      approvers: r.blocked ? [] : this.business.people.filter((p) => p.role !== 'requester' && p.role !== 'auditor' && holds(p, r.to)).map((p) => p.name),
      changed: this.business.policyMeta[r.line] ?? null,
    }));
    // A rule that sends requests to a name nobody approves for routes them to the owner, or nowhere: say so.
    const warnings = rules.filter((r) => !r.blocked && !r.approvers.length).map((r) => `Nobody approves for ${r.to.replace(/^(the|any|an|a)\s+/i, '')} yet: "${r.line}" sends requests to the owner, or they wait.`);
    const b = this.business;
    const record = pilot(this.log.events, b.shadow, goLiveRules(b.policy), b.seats.map((s) => s.name));
    return { on: b.on, company: b.company, policy: b.policy, rules, warnings, seats: b.seats, sso: b.sso ?? null, shadow: b.shadow, pilot: record, paused: this.paused };
  }

  /**
   * Rules from outside (Mana drafts them in a chat): applied only when a track's own request for exactly this text was
   * approved by an owner or an admin, so no rule can let an approver, an agent or the app itself change the rules.
   */
  policyFrom(track: string, text: unknown, approvalId: string) {
    if (typeof text !== 'string') throw new Error('policy: text');
    const a = this.state.approvals.get(approvalId);
    const t = a && this.state.tasks.get(a.task);
    if (!a || !t || t.source.split(':')[0] !== track) throw new Error(`no request ${approvalId} from ${track}`);
    const mark = `[policy ${createHash('sha256').update(text).digest('hex').slice(0, 12)}]`;
    if (!a.question.includes(mark)) throw new Error(`request ${approvalId} is not for this text: its question must carry ${mark}`);
    const p = this.person(a.person);
    if (a.state !== 'approved' || !p || (p.role !== 'owner' && p.role !== 'admin')) forbid('only an owner or an admin approving the request changes the rules');
    parsePolicy(text); // throws naming the bad line
    const source = /^#\s*source:\s*(.+)$/m.exec(text)?.[1]?.trim() ?? track;
    const at = new Date().toISOString();
    const meta: Business['policyMeta'] = {};
    for (const r of parsePolicy(text)) meta[r.line] = this.business.policyMeta[r.line] ?? { by: `${p!.name} (from ${source})`, at };
    Object.assign(this.business, { policy: text, policyMeta: meta });
    this.saveBusiness();
    this.write({ type: 'note', track: 'business', data: { changed: ['policy'], by: p!.name, approval: approvalId, source }, who: { by: p!.id } });
  }

  /** "Who would approve this?": where a request would go, without asking it. */
  tryRoute(q: URLSearchParams) {
    const text = (q.get('text') ?? '').slice(0, 500);
    const amountCents = Math.max(0, Math.round(Number(q.get('amount') ?? 0)) || 0);
    const asked = q.get('asked') ?? undefined;
    return route(parsePolicy(this.business.policy), { text, amountCents, app: q.get('app') ?? undefined }, this.business.people, asked);
  }

  /** Add or change a person. Only the owner makes someone an owner. */
  putPerson(body: unknown, req: http.IncomingMessage) {
    const p = checkPerson(body, this.business.people);
    const old = this.person(p.id);
    if ((p.role === 'owner' || old?.role === 'owner') && !this.isOwner(req) && this.personOf(req)?.role !== 'owner') forbid('only the owner can add or change an owner');
    this.business.people = old ? this.business.people.map((x) => (x.id === p.id ? p : x)) : [...this.business.people, p];
    this.saveBusiness();
    const { name, who } = this.actor(req);
    this.write({ type: 'note', track: 'business', data: { person: p.id, change: old ? 'changed' : 'added', role: p.role, limitCents: p.limitCents, approvesFor: p.approvesFor, by: name }, ...(who ? { who } : {}) });
    return p;
  }

  removePerson(id: string, req: http.IncomingMessage) {
    const p = this.person(id);
    if (!p) throw Object.assign(new Error(`no person ${id}`), { status: 404 });
    if (p.role === 'owner' && !this.isOwner(req) && this.personOf(req)?.role !== 'owner') forbid('only the owner can remove an owner');
    this.business.people = this.business.people.filter((x) => x.id !== id);
    this.saveBusiness();
    for (const d of this.devices) if (d.person === id && !d.revoked) this.revokeDevice(d.id); // their phones stop working at once
    const { name, who } = this.actor(req);
    this.write({ type: 'note', track: 'business', data: { person: id, change: 'removed', by: name }, ...(who ? { who } : {}) });
    return { id, removed: true };
  }

  peopleView() {
    return this.business.people.map((p) => ({ ...p, phones: this.devices.filter((d) => d.person === p.id && !d.revoked).map((d) => ({ id: d.id, name: d.name, pairedAt: d.pairedAt })) }));
  }

  /** What a person may approve now, and their own requests still waiting: "Waiting for me". */
  me(req: http.IncomingMessage) {
    const p = this.personOf(req);
    const pending = [...this.state.approvals.values()].filter((a) => a.state === 'pending');
    const withRoute = (a: Approval) => ({ ...a, route: a.route ?? this.routeOf(a, this.must(a.task)) });
    return {
      edition: system.edition(this.owner, this.business.on),
      company: this.business.company,
      paused: this.paused,
      person: p ?? null,
      // Names, titles and limits, so any screen (an auditor's too) can say who asked and who may approve. Phones stay with admins.
      directory: this.business.people.map(({ id, name, title, role, limitCents, approvesFor }) => ({ id, name, title, role, limitCents, approvesFor })),
      waiting: p ? this.waitingFor(p).map(withRoute) : [],
      // Nobody can approve these (above every limit, a ceiling, or only the asker approves for the name); this person
      // can still deny them, and an admin can raise a limit or change a rule.
      stuck: p ? this.stuckFor(p).map(withRoute) : [],
      // Their own requests, newest first: waiting ones say who they wait for, answered ones who answered.
      requests: p ? [...this.state.approvals.values()].filter((a) => (a.askedBy ?? this.state.tasks.get(a.task)?.requestedBy) === p.id).reverse().slice(0, 50).map(withRoute) : [],
    };
  }

  /** Pending requests nobody can approve now that this person may still deny. */
  stuckFor(p: Person): Approval[] {
    return [...this.state.approvals.values()].filter((a) => {
      if (a.state !== 'pending') return false;
      const t = this.must(a.task);
      const r = a.route ?? this.routeOf(a, t);
      const req = { to: r.to, amountCents: r.amountCents, askedBy: a.askedBy ?? t.requestedBy, rule: r.rule };
      return !approversFor(req, this.business.people).length && !refusal(p, req, false);
    });
  }

  /** The pending requests this person may approve now. */
  waitingFor(p: Person): Approval[] {
    return [...this.state.approvals.values()].filter((a) => {
      if (a.state !== 'pending') return false;
      const t = this.must(a.task);
      const r = a.route ?? this.routeOf(a, t);
      return approversFor({ to: r.to, amountCents: r.amountCents, askedBy: a.askedBy ?? t.requestedBy, rule: r.rule }, this.business.people).some((x) => x.id === p.id);
    });
  }

  audit(q: URLSearchParams) {
    const name = (id: string) => this.person(id)?.name ?? id;
    return auditRows(this.log.events, this.state.tasks, { name, app: (t) => this.appOf(t) }, { person: q.get('person'), seat: q.get('seat'), app: q.get('app'), from: q.get('from'), to: q.get('to') });
  }

  /** The audit as a CSV file: GET /api/audit.csv, with the same filters as /api/audit. */
  auditCsv(req: http.IncomingMessage, res: http.ServerResponse) {
    const url = new URL(req.url ?? '/', 'http://box');
    if (req.method !== 'GET' || url.pathname.replace(/^\/api/, '') !== '/audit.csv') return false;
    try {
      this.requireAuditor(req);
      res.writeHead(200, { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="gurtos-audit.csv"' }).end(toCsv(this.audit(url.searchParams)));
    } catch (e) {
      res.writeHead((e as { status?: number }).status ?? 400, { 'content-type': 'application/json' }).end(JSON.stringify({ error: (e as Error).message }));
    }
    return true;
  }

  /** An auditor reads and never changes anything, on any route. */
  readOnly(req: http.IncomingMessage, res: http.ServerResponse) {
    if (req.method === 'GET' || req.method === 'OPTIONS' || this.personOf(req)?.role !== 'auditor') return false;
    res.writeHead(403, { 'content-type': 'application/json' }).end(JSON.stringify({ error: 'an auditor can read everything and change nothing' }));
    return true;
  }

  // ---------- the kill switch: stop every agent on the box, and let them carry on ----------

  /** The kill switch, for the owner or a Business admin (Settings' `paused` is the owner's way to the same switch). */
  pause(req: http.IncomingMessage) {
    this.requireAdmin(req);
    return this.setPaused(true, req);
  }

  resume(req: http.IncomingMessage) {
    this.requireAdmin(req);
    return this.setPaused(false, req);
  }

  setPaused(on: boolean, req: http.IncomingMessage) {
    if (this.settings.paused !== on) {
      this.settings = applyPatch(this.settings, { paused: on });
      saveSettings(HOME, this.settings);
      this.write({ type: 'note', track: 'settings', data: { changed: { paused: { from: !on, to: on } } } });
      this.pauseChanged(on, req);
    }
    return this.pauseView();
  }

  pauseView() {
    return { paused: !!this.paused, by: this.paused?.by ?? null, at: this.paused?.at ?? null, via: this.paused?.via ?? null };
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
      ask: async (question, opts) => {
        if (!task) return false;
        // The same question in the same tool call is the same approval; a different one gets its own. A slow owner is not a "no":
        // askFor gives up waiting after a while but leaves the approval open, so ask again until it is answered.
        const askKey = `${key}.ask.${createHash('sha256').update(question).digest('hex').slice(0, 8)}`;
        for (;;) {
          const r = await this.askFor(task, askKey, { question, purpose: opts?.purpose });
          if (r !== 'pending') return r === 'approved';
        }
      },
    };
  }

  /** Run a tool for a task. A key already answered in the log returns the logged result without running again. */
  async callTool(t: Task, key: string, name: string, input: unknown): Promise<{ ok: boolean; output?: unknown; error?: string; pending?: boolean }> {
    if (!t.tools.includes(name)) throw new Error(`this task may not use ${name}`);
    if (this.leaks(t, JSON.stringify(input ?? null))) {
      this.tripwire(t, `a call to ${name}`);
      return { ok: false, error: 'refused by the box' };
    }
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
    // Shadow mode: a seat's decision is a suggestion, asked through the policy like any request. A person's yes runs it.
    const seat = this.business.on && t.seat && entry.tool.decides && this.business.shadow.some((s) => s.toLowerCase() === t.seat!.toLowerCase()) ? t.seat : undefined;
    if (seat) {
      const q = `Shadow: the ${seat} would ${String(entry.tool.decides!(input)).slice(0, 300)}. Do you decide the same?`;
      const outcome = await this.askFor(t, `shadow.${action}`, { question: q, shadow: seat });
      if (outcome === 'pending') return { ok: false, pending: true, error: 'Shadow mode: a person decides this. Call this tool again to check.' };
      if (outcome === 'denied') return result({ ok: false, error: 'Shadow mode: a person decided otherwise, so this was not recorded. Do not ask again; move on.' });
    }
    const cost = entry.tool.cost?.(input) ?? 0;
    // Count spending this task's other in-flight calls have committed, so two payments at once can't both pass.
    const committed = () => t.costCents + (this.reserved.get(t.id) ?? 0);
    const overBudget = committed() + cost > t.budgetCents;
    const overThreshold = cost > this.settings.approvalThresholdCents; // the owner's rule: a spend this big always asks
    if (cost > 0 && (overBudget || overThreshold)) {
      const meta = entry.tool.approval?.(input) ?? {};
      const why = overBudget ? `Budget ${dollars(t.budgetCents)}, spent ${dollars(t.costCents)}.` : `Spends above ${dollars(this.settings.approvalThresholdCents)} always ask.`;
      const q = `Spend ${dollars(cost)}${meta.payee ? ` to ${meta.payee}` : ''} on ${name}${meta.purpose ? ` (${meta.purpose})` : ''}? ${why}`;
      // Approval id keyed by the action, so a retry of the same call reuses it instead of asking again.
      const outcome = await this.askFor(t, `budget.${action}`, { question: q, costCents: cost, payee: meta.payee, purpose: meta.purpose });
      if (outcome === 'pending') return { ok: false, pending: true, error: 'Waiting for the box owner to approve this spend. Call this tool again to check.' };
      if (outcome === 'denied') return result({ ok: false, error: 'not approved' });
    }
    this.reserved.set(t.id, (this.reserved.get(t.id) ?? 0) + cost); // reserve now, with no await before it, so a parallel call sees this spend
    this.write({ type: 'tool.call', task: t.id, key, tool: name, input });
    try {
      const output = await entry.tool.run(input, this.ctx(entry.track, key, entry.tool.secrets, t));
      // A metered tool (x402 "upto") is approved for its cap but may charge less: it reports spentCents, from 0 to the cap.
      const spent = (output as { spentCents?: unknown } | null)?.spentCents;
      const cents = typeof spent === 'number' && Number.isFinite(spent) && spent >= 0 && spent <= cost ? spent : cost;
      return result({ ok: true, output, ...(cents ? { cents } : {}) }); // result and cost in one line: counted once
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
          return { name, description, input: input ?? { type: 'object' }, spends: !!this.tools.get(name)!.tool.cost };
        });
      }
      if (route === 'POST /step' || route === 'POST /call' || route === 'POST /ask') await this.untilResumed(); // Pause all agents
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

  /** Point a workspace at a real folder on disk (the owner's ~/Documents/thesis). Tasks copy it; Keep writes back. */
  linkWorkspace(name: string, realPath: string) {
    if (!/^[\w.-]+$/.test(name)) throw new Error(`bad workspace name ${name}`);
    const real = path.resolve(realPath);
    if (!fs.existsSync(real) || !fs.statSync(real).isDirectory()) throw new Error(`no folder ${real}`);
    if (this.owner) {
      // The owner's folder may be 0700; let task users read it through their overlay copies.
      try {
        execFileSync('setfacl', ['-R', '-m', 'u:root:rX', real]);
      } catch {} // setfacl may be absent; the mount still works when perms already allow
    }
    if (this.links[name] && this.links[name] !== real) throw new Error(`workspace ${name} already points at ${this.links[name]}`); // never repoint: Keep would write into the wrong folder
    this.links[name] = real;
    sandbox.linkBase(name, real);
    fs.writeFileSync(this.linksPath, JSON.stringify(this.links, null, 2), { mode: 0o600 });
  }

  /** Link several of the owner's folders as one workspace. Each shows up as a top-level folder named by its label. */
  linkWorkspaces(name: string, folders: Record<string, string>) {
    if (!/^[\w.-]+$/.test(name)) throw new Error(`bad workspace name ${name}`);
    for (const real of Object.values(folders)) if (!fs.existsSync(real) || !fs.statSync(real).isDirectory()) throw new Error(`no folder ${real}`);
    const had = this.links[name];
    if (had && JSON.stringify(had) !== JSON.stringify(folders)) throw new Error(`workspace ${name} already points somewhere else`); // never repoint
    fs.mkdirSync(dirs.workspace(name), { recursive: true }); // a marker, so the workspace exists; the folders are the real ones
    this.links[name] = folders;
    sandbox.linkMulti(name, folders);
    fs.writeFileSync(this.linksPath, JSON.stringify(this.links, null, 2), { mode: 0o600 });
  }

  folderRefusal(real: string): string | undefined {
    return folderRefusal(real, { hasOwner: !!this.owner, ownerHome: this.ownerInfo()?.home, chosen: this.settings.agentFolders, folderUid: fs.statSync(real).uid, allowRootOwned: !!process.env.BOX_DEMO });
  }

  /**
   * Link the folder(s) a Personal task works on and return its workspace. The name carries a hash of the full
   * real paths, so same-named folders in different places never share a workspace.
   */
  linkFolders(given: unknown): string {
    if (!Array.isArray(given) || !given.length || given.length > 10 || given.some((f) => typeof f !== 'string' || !f)) throw new Error('folders: a list of 1 to 10 folders');
    const reals = [...new Set((given as string[]).map((f) => fs.realpathSync(f)))].sort();
    for (const r of reals) {
      const why = this.folderRefusal(r);
      if (why) throw new Error(why);
    }
    for (const a of reals) for (const b of reals) if (a !== b && b.startsWith(a + '/')) throw new Error(`${b} is inside ${a}; pick one of them, or the same file would be changed twice`);
    const hash = (x: string) => createHash('sha256').update(x).digest('hex').slice(0, 6);
    if (reals.length === 1) {
      const name = `owner-${path.basename(reals[0]).replace(/[^\w.-]/g, '-')}-${hash(reals[0])}`;
      this.linkWorkspace(name, reals[0]);
      return name;
    }
    const used = new Set<string>();
    const labels: Record<string, string> = {};
    for (const r of reals) {
      const base = path.basename(r).replace(/[^\w.-]/g, '-') || 'folder';
      let label = base;
      for (let i = 2; used.has(label); i++) label = `${base}-${i}`;
      used.add(label);
      labels[label] = r;
    }
    const name = `owner-${reals.length}folders-${hash(reals.join('\n'))}`;
    this.linkWorkspaces(name, labels);
    return name;
  }

  /** Apply a done task's changes to its linked real folder (owner's Keep), or report a conflict. */
  keep(id: string) {
    const t = this.must(id);
    if (t.state !== 'done') throw new Error(`task ${id} is ${t.state}; only a done task can be kept`);
    if (t.review === 'kept') throw new Error(`task ${id} was already kept`);
    const out = sandbox.keep(t);
    if (out.conflicts) {
      this.write({ type: 'keep', task: id, result: 'conflict', conflicts: out.conflicts });
      this.write({ type: 'task.step', task: id, text: `keep found a conflict: you changed ${out.conflicts.join(', ')} too`, data: { keep: 'conflict', conflicts: out.conflicts } });
    } else {
      this.write({ type: 'keep', task: id, result: 'kept', changes: out.kept });
      // The same fact as a step, for readers that follow steps (the desktop layer's first version did).
      this.write({ type: 'task.step', task: id, text: `kept ${out.kept?.length ?? 0} change(s) to ${this.links[t.workspace]}`, data: { keep: 'applied', changes: out.kept } });
    }
    return out;
  }

  /** Undo a Keep from Time Machine's before-images, unless the owner has edited the kept files since. */
  unkeep(id: string) {
    const t = this.must(id);
    if (t.review !== 'kept') throw new Error(`task ${id} has no Keep to undo`);
    const out = sandbox.unkeep(t);
    if (out.reverted) this.write({ type: 'keep', task: id, result: 'reverted', changes: out.reverted });
    return out;
  }

  /**
   * What a track gets. A route called from a person's phone gets a box bound to that person (Business): its tasks
   * are asked by them and its answers are theirs. Tools, triggers and log readers get one with no person, so on a
   * Business box they can never answer a request: no agent approves an agent.
   */
  boxFor(track: string, person?: Person): Box {
    return {
      createTask: (spec) => this.createTask({ source: track, ...spec }, person?.id),
      workspace: (name, fromDir) => sandbox.workspace(name, fromDir),
      linkWorkspace: (name, realPath) => this.linkWorkspace(name, realPath),
      task: (id) => this.state.tasks.get(id),
      tasks: () => [...this.state.tasks.values()],
      undo: (id) => this.undo(id),
      approvals: () => [...this.state.approvals.values()],
      answer: (id, approved, by) => this.answerAs(id, approved, person, by),
      on: (l) => (this.listeners.add(l), () => this.listeners.delete(l)),
      job: (name, input, task) => this.job(name, input, task),
      note: (data, task) => void this.write({ type: 'note', track, task, data }),
      onWebhook: (name, handler) => {
        if (!/^[\w-]+$/.test(name)) throw new Error(`bad webhook name ${name}`);
        this.webhooks.set(`/hook/${track}/${name}`, handler);
      },
      policy: () => this.business.policy,
      setPolicy: (text, approvalId) => this.policyFrom(track, text, approvalId),
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
    return pump;
  }

  // ---------- apps: every track is an app that can be turned on and off ----------

  installed = new Map<string, { track?: Track; error?: string }>();
  active = new Set<string>();
  disabled = loadDisabled(HOME);
  trackPumps = new Map<string, (() => void)[]>();
  triggerRuns = new Map<string, { stops: (() => void)[]; unstoppable: boolean; starting: Promise<unknown>[] }>();
  needsRestart = new Set<string>(); // apps disabled while a trigger without a stop function was running

  /** Import every track in tracks/ to read what it is, without turning any of them on. */
  async discoverTracks() {
    const root = new URL('../tracks/', import.meta.url).pathname;
    if (!fs.existsSync(root)) return;
    for (const name of fs.readdirSync(root).sort()) {
      const file = path.join(root, name, 'track.ts');
      if (!fs.existsSync(file)) continue;
      try {
        const track: Track = (await import(file)).default;
        if (track?.name !== name) throw new Error(`track.ts must default-export a Track named "${name}"`);
        this.installed.set(name, { track });
      } catch (e) {
        console.error(`track ${name} not loaded:`, e); // one broken track must not stop the box
        this.installed.set(name, { error: (e as Error).message });
      }
    }
  }

  /** Turn an app on: its tools, jobs, routes, apps and log readers become live. Triggers start separately. */
  register(name: string) {
    const rec = this.installed.get(name);
    const track = rec?.track;
    if (!track) throw new Error(rec?.error ?? `no app ${name}`);
    if (this.active.has(name)) return;
    for (const tool of track.tools ?? []) if (this.tools.has(tool.name)) throw new Error(`tool ${tool.name} already exists`); // check before adding any
    this.trackSecrets.set(name, new Set(track.secrets ?? []));
    for (const tool of track.tools ?? []) this.tools.set(tool.name, { tool, track: name });
    for (const job of track.modelJobs ?? []) this.jobs.set(job.name, { job, track: name });
    for (const [key, route] of Object.entries(track.routes ?? {})) {
      const [method, p] = key.split(' ');
      this.routes.set(`${method} /t/${name}${p}`, { route, track: name, open: (track.openRoutes ?? []).includes(key) });
    }
    for (const app of track.apps ?? []) this.apps.push({ ...app, track: name });
    this.trackPumps.set(name, (track.logReaders ?? []).map((r) => this.addReader(name, r)));
    this.active.add(name);
    if (rec) rec.error = undefined;
  }

  /** Start an app's triggers. A trigger that returns a stop function can be switched off without a restart. */
  startTriggers(name: string) {
    const track = this.installed.get(name)?.track;
    const run = { stops: [] as (() => void)[], unstoppable: false, starting: [] as Promise<unknown>[] };
    this.triggerRuns.set(name, run);
    for (const trig of track?.triggers ?? []) {
      run.starting.push(
        Promise.resolve()
          .then(() => trig.start(this.boxFor(name)))
          .then((stop) => {
            if (typeof stop === 'function') run.stops.push(stop);
            else run.unstoppable = true;
          })
          .catch((e) => console.error(`trigger ${name}.${trig.name} failed:`, e)),
      );
    }
  }

  /** Turn an app off: take everything it registered out, and stop its triggers. */
  async unregister(name: string) {
    if (!this.active.has(name)) return;
    const run = this.triggerRuns.get(name);
    await Promise.allSettled(run?.starting ?? []);
    for (const stop of run?.stops ?? []) {
      try {
        stop();
      } catch (e) {
        console.error(`stopping a trigger of ${name} failed:`, e);
      }
    }
    if (run?.unstoppable) this.needsRestart.add(name); // it keeps running until the box restarts
    this.triggerRuns.delete(name);
    for (const [k, v] of this.tools) if (v.track === name) this.tools.delete(k);
    for (const [k, v] of this.jobs) if (v.track === name) this.jobs.delete(k);
    for (const [k, v] of this.routes) if (v.track === name) this.routes.delete(k);
    for (const k of this.webhooks.keys()) if (k.startsWith(`/hook/${name}/`)) this.webhooks.delete(k);
    this.apps = this.apps.filter((a) => a.track !== name);
    const pumps = new Set(this.trackPumps.get(name) ?? []);
    this.readers = this.readers.filter((r) => !pumps.has(r));
    this.trackPumps.delete(name);
    this.trackSecrets.delete(name);
    this.active.delete(name);
  }

  async enableApp(name: string) {
    const rec = this.installed.get(name);
    if (!rec) throw Object.assign(new Error(`no app ${name}`), { status: 404 });
    this.disabled.delete(name);
    saveDisabled(HOME, this.disabled);
    if (!this.active.has(name)) {
      try {
        this.register(name);
        this.startTriggers(name);
      } catch (e) {
        rec.error = (e as Error).message;
        throw e;
      }
    }
    this.needsRestart.delete(name);
    this.write({ type: 'note', track: 'apps', data: { enabled: name } });
    return this.appEntry(name);
  }

  async disableApp(name: string) {
    if (!this.installed.has(name)) throw Object.assign(new Error(`no app ${name}`), { status: 404 });
    this.disabled.add(name);
    saveDisabled(HOME, this.disabled);
    await this.unregister(name);
    this.write({ type: 'note', track: 'apps', data: { disabled: name } });
    return this.appEntry(name);
  }

  /** The first paragraph of the app's README, for an app that gives no description of its own. */
  readmeBlurb(name: string): string {
    try {
      const text = fs.readFileSync(new URL(`../tracks/${name}/README.md`, import.meta.url), 'utf8');
      const para = text.split(/\n\s*\n/).map((p) => p.trim()).find((p) => p && !p.startsWith('#') && !p.startsWith('|') && !p.startsWith('```'));
      return (para ?? '').replace(/[*_`]/g, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/\s+/g, ' ').slice(0, 240);
    } catch {
      return '';
    }
  }

  /** One app for the App Center: what it is, what it can reach (names only), and whether it is on. */
  appEntry(name: string) {
    const rec = this.installed.get(name);
    const track = rec?.track;
    const tools = track?.tools ?? [];
    const jobs = track?.modelJobs ?? [];
    const secretNames = [...new Set([...tools.flatMap((t) => t.secrets ?? []), ...jobs.flatMap((j) => j.secrets ?? []), ...(track?.secrets ?? [])])].sort();
    const ui = (track?.apps ?? []).map((a) => ({ name: a.name, title: a.title, href: a.href }));
    const status = this.active.has(name) ? 'enabled' : rec?.error && !this.disabled.has(name) ? 'error' : 'disabled';
    return {
      id: name,
      track: name,
      name,
      title: track?.title ?? ui[0]?.title ?? name,
      description: track?.description ?? this.readmeBlurb(name),
      status,
      enabled: status === 'enabled',
      ...(rec?.error ? { error: rec.error } : {}),
      ...(this.needsRestart.has(name) ? { restartNeeded: true } : {}),
      access: {
        tools: tools.map((t) => ({ name: t.name, description: t.description })),
        jobs: jobs.map((j) => j.name),
        hosts: [...new Set(tools.flatMap((t) => t.hosts ?? []))].sort(),
        secrets: secretNames.map((n) => ({ name: n, set: this.vault.has(n), ...(track?.optionalSecrets?.includes(n) ? { optional: true } : {}) })),
        triggers: (track?.triggers ?? []).map((t) => t.name),
        routes: Object.keys(track?.routes ?? {}),
      },
      ui,
    };
  }

  /** At boot: find every app and turn on the ones that are enabled. */
  async loadTracks() {
    await this.discoverTracks();
    // A new box (no apps.json, nothing in the log yet) starts with only the apps whose keys are all in the vault,
    // and never the example app: a stranger's fresh install loads nothing it can't run. A box already in use keeps
    // what it ran, and demo boxes keep every app on.
    if (!fs.existsSync(path.join(HOME, 'apps.json')) && !this.log.events.length && !process.env.BOX_DEMO) {
      for (const name of this.installed.keys()) {
        const need = this.appEntry(name).access.secrets;
        if (name === 'example' || need.some((k) => !k.set && !('optional' in k))) this.disabled.add(name);
      }
      saveDisabled(HOME, this.disabled);
    }
    const loaded: Track[] = [];
    for (const [name, rec] of this.installed) {
      if (!rec.track || this.disabled.has(name)) continue;
      try {
        this.register(name);
        loaded.push(rec.track);
      } catch (e) {
        console.error(`track ${name} not loaded:`, e);
        rec.error = (e as Error).message;
      }
    }
    return loaded;
  }

  /** Every SpacetimeDB identity the box vouches for: the screens that said so, and the paired phones that gave theirs. */
  identities(): [string, string][] {
    if (this.business.on) return []; // a Business box takes answers only through the API, as a person
    return [...this.screens, ...this.devices.filter((d) => d.identity && !d.revoked).map((d) => [d.identity!, d.name] as [string, string])];
  }

  /** The caller says which SpacetimeDB identity it holds; the box vouches for it under the caller's name. */
  vouch(req: http.IncomingMessage, identity: unknown) {
    if (typeof identity !== 'string' || !/^[0-9a-f]{64}$/i.test(identity)) throw new Error('identity: the 64 hex characters of your SpacetimeDB identity');
    const device = this.deviceOf(req);
    if (!device && !this.isLocal(req)) throw Object.assign(new Error('pair this phone with the box first'), { status: 401 });
    const name = device ? device.name : 'box screen';
    const id = identity.toLowerCase();
    if (device) device.identity = id;
    else this.screens.set(id, name);
    if (device) this.saveDevices();
    if (!this.business.on) this.live.register(id, name);
    else if (this.person(device?.person)) this.live.registerPerson(id, device!.person!, this.person(device!.person)!.name); // sent only their own requests
    return { identity: id, name };
  }

  /** The owner, with the account's id and home folder when it is a real account. */
  ownerInfo() {
    if (!this.owner) return null;
    const f = this.passwd(this.owner);
    // name: the account's full name (the first part of the GECOS field), for the screen's greeting; '' when unset.
    return { user: this.owner, name: (f?.[4] ?? '').split(',')[0].trim(), uid: f ? Number(f[2]) : null, home: f?.[5] ?? `/home/${this.owner}` };
  }

  passwd(user: string): string[] | undefined {
    if (!/^[a-z_][a-z0-9_-]{0,31}$/.test(user)) return undefined;
    try {
      return execFileSync('getent', ['passwd', user], { encoding: 'utf8' }).trim().split(':');
    } catch {
      return undefined; // no such account
    }
  }

  /**
   * Make an existing account the owner, or with no user go back to BOX_OWNER (or none). The account must be a
   * person's: not root, not a system account, not one of the box's own task users.
   */
  setOwner(user: unknown) {
    if (user === undefined) {
      fs.rmSync(this.ownerPath, { force: true });
      this.owner = process.env.BOX_OWNER ?? null;
    } else {
      if (typeof user !== 'string') throw new Error('user: the account name of the owner');
      const f = this.passwd(user);
      if (!f) throw new Error(`user: no account named "${String(user).slice(0, 40)}" on this machine (create it first)`);
      const uid = Number(f[2]);
      if (!((uid >= 1000 && uid < 30000) || (uid >= 40000 && uid < 65534))) throw new Error(`user: "${user}" is a system account (uid ${uid}); the owner is a person's account`);
      fs.writeFileSync(this.ownerPath, JSON.stringify({ user, setAt: new Date().toISOString() }), { mode: 0o600 });
      this.owner = user;
    }
    this.write({ type: 'note', track: 'owner', data: { owner: this.owner } });
    return this.ownerInfo();
  }

  /** Changing an owner that already exists takes the box's socket (root) or an owner-paired phone, not any local process. */
  requireOwnerChange(req: http.IncomingMessage) {
    this.requireOwner(req);
    if (this.owner && req.socket.remoteAddress !== undefined && !this.deviceOf(req)?.owner) {
      throw Object.assign(new Error('the owner is already set; change it from the box service or the owner\'s phone'), { status: 403 });
    }
  }

  /** Hostname, time zone, network, edition and version, for the wizard and Settings. */
  async systemFacts() {
    const v = system.version();
    const edition = system.edition(this.owner, this.business.on);
    return {
      product: 'GurtOS',
      edition,
      editionName: `GurtOS ${edition[0].toUpperCase()}${edition.slice(1)}`,
      version: v.version,
      build: v.build,
      hostname: os.hostname(),
      timezone: system.timezone(),
      network: { online: await system.online(), interfaces: system.interfaces() },
      boxId: BOX_ID,
      boxName: BOX_NAME,
      owner: this.owner,
      model: { ready: !!this.modelVia(), via: this.modelVia() },
      ...(this.business.on ? { company: this.business.company } : {}),
      paused: this.pauseView(),
      startedAt: this.startedAt,
      uptimeSec: Math.round(process.uptime()),
    };
  }

  /** Which model key the box will use: Factory's if it has one, else the owner's own Anthropic key. */
  modelVia(): 'factory' | 'anthropic' | null {
    return this.vault.get('FACTORY_API_KEY') ? 'factory' : this.vault.get('ANTHROPIC_API_KEY') ? 'anthropic' : null;
  }

  /** The setup state with the suggested step order. Until `done`, the box's screen shows the wizard. */
  setupView() {
    return { model: { ready: !!this.modelVia(), via: this.modelVia() }, modelKey: !!this.modelVia(), done: this.setup.done, finishedAt: this.setup.finishedAt ?? null, migrated: this.setup.migrated ?? false, steps: this.setup.steps, suggested: SETUP_STEPS };
  }

  // ---------- pairing a phone, and listing every box ----------

  /** This box plus the peer boxes in BOX_PEERS, so one portal lists and drives several (the Vultr second box). */
  boxes() {
    let peers: unknown[] = [];
    try {
      peers = JSON.parse(process.env.BOX_PEERS ?? '[]');
    } catch (e) {
      console.error('BOX_PEERS is not valid JSON:', e);
    }
    const self = { id: BOX_ID, name: BOX_NAME, url: this.boxUrl(), stdb: DB, self: true };
    return [self, ...peers];
  }

  /** Mint a one-time pairing code for the box screen's QR. Good for 5 minutes, usable once. */
  pairStart(owner = false, person?: string) {
    const code = randomBytes(4).toString('hex');
    const expiry = Date.now() + 5 * 60 * 1000;
    this.pairCodes.set(code, { expiry, owner, ...(person ? { person } : {}) });
    // With BOX_URL set (the image sets it from the box's address) the url is absolute, so the box screen's QR
    // opens on a phone. Without it the url is a path the page prefixes with its own origin. With remote access on,
    // the QR opens the GurtOS app, which adds this box to its machines (`boxUrl` is the box's own copy).
    const remote = this.remote.saved;
    const url = remote ? `${APP}/pair?box=${remote.host}#${code}` : `${this.boxUrl()}/pair#${code}`;
    return { code, url, ...(remote ? { boxUrl: `${remote.url}/pair#${code}` } : {}), expiresAt: new Date(expiry).toISOString(), box: { id: BOX_ID, name: BOX_NAME } };
  }

  /** A phone redeems the code for a durable device token. */
  wrongCodes: number[] = [];
  pair(body: { code?: string; name?: string; identity?: string }) {
    // Pairing is reachable from outside the box, so guessing codes is limited: 10 wrong ones a minute, from everyone together.
    this.wrongCodes = this.wrongCodes.filter((at) => Date.now() - at < 60_000);
    if (this.wrongCodes.length >= 10) throw Object.assign(new Error('too many wrong pairing codes; wait a minute and ask the box\'s screen for a new one'), { status: 429 });
    const entry = body.code ? this.pairCodes.get(body.code) : undefined;
    if (!entry || entry.expiry < Date.now()) {
      this.wrongCodes.push(Date.now());
      throw Object.assign(new Error('bad or expired pairing code'), { status: 400 });
    }
    this.pairCodes.delete(String(body.code)); // one-time
    const person = this.person(entry.person);
    if (entry.person && !person) throw Object.assign(new Error('the person this code was for has been removed'), { status: 400 });
    const name = String(body.name || (person ? `${person.name}'s phone` : 'phone')).slice(0, 40);
    const device: Device = { id: 'd' + randomBytes(5).toString('hex'), name, token: randomBytes(24).toString('hex'), pairedAt: new Date().toISOString(), ...(entry.owner ? { owner: true } : {}), ...(person ? { person: person.id } : {}), ...(typeof body.identity === 'string' && /^[0-9a-f]{64}$/i.test(body.identity) ? { identity: body.identity.toLowerCase() } : {}) };
    this.devices.push(device);
    this.saveDevices();
    if (device.identity && !this.business.on) this.live.register(device.identity, device.name);
    else if (device.identity && person) this.live.registerPerson(device.identity, person.id, person.name);
    // The edition comes along, so a phone shows the right home (GurtOS Business: Waiting for me) from its first frame.
    return { token: device.token, device: { id: device.id, name: device.name, ...(person ? { person: person.id } : {}) }, box: { id: BOX_ID, name: BOX_NAME }, edition: system.edition(this.owner, this.business.on) };
  }

  // ---------- Business: sign in with a work account (OpenID Connect) ----------

  /** Sign-ins gone to the provider, by `state`, and finished ones waiting for the page, by one-time code. Both expire and are capped. */
  ssoPending = new Map<string, { nonce: string; verifier: string; browser: string; redirect: string; device: string; expiry: number }>();
  ssoDone = new Map<string, { expiry: number; person?: string; device?: string; error?: string }>();

  /** GET /api/sso, /api/sso/start and /api/sso/callback, POST /api/sso/redeem. Open routes: they say nothing private. */
  ssoRoutes(req: http.IncomingMessage, res: http.ServerResponse) {
    const url = new URL(req.url ?? '/', 'http://box');
    const p = url.pathname.replace(/^\/api(?=\/)/, '');
    const m = req.method ?? 'GET';
    const cfg = this.business.on ? this.business.sso : undefined;
    const json = (status: number, obj: unknown) => res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' }).end(JSON.stringify(obj));
    const go = (to: string) => res.writeHead(302, { location: to, 'cache-control': 'no-store' }).end();
    if (m === 'GET' && p === '/sso') return json(200, cfg ? { on: true, name: cfg.name } : { on: false }), true;
    if (m === 'GET' && (p === '/sso/start' || p === '/sso/callback')) {
      (p === '/sso/start' ? this.ssoStart(req, res, url, cfg) : this.ssoCallback(req, url, cfg)).then(go, (e: Error) => {
        // The log never holds an address: the provider's own message can name the account.
        if (p === '/sso/callback') this.write({ type: 'note', track: 'business', data: { sso: 'refused', idp: cfg?.name ?? null, why: e.message.replace(/[^\s'"@]+@[^\s'"]+/g, '<address>') } });
        go(this.ssoFinish({ error: e.message }));
      });
      return true;
    }
    if (m !== 'POST' || p !== '/sso/redeem') return false;
    void (async () => {
      let text = '';
      for await (const c of req) text += c;
      const code = (() => {
        try {
          return String(JSON.parse(text).code ?? '');
        } catch {
          return '';
        }
      })();
      const done = this.ssoDone.get(code);
      this.ssoDone.delete(code); // one-time
      const p = this.person(done?.person);
      if (!done || done.expiry < Date.now()) return json(400, { error: 'This sign-in has expired. Sign in again.' });
      if (done.error || !p) return json(403, { error: done.error ?? 'You were removed from this box.' });
      // A device token bound to the person, exactly as pairing a phone for them makes one.
      const device: Device = { id: 'd' + randomBytes(5).toString('hex'), name: (done.device || `${p.name}'s work sign-in`).slice(0, 40), token: randomBytes(24).toString('hex'), pairedAt: new Date().toISOString(), person: p.id };
      this.devices.push(device);
      this.saveDevices();
      json(200, { token: device.token, device: { id: device.id, name: device.name, person: p.id }, box: { id: BOX_ID, name: BOX_NAME } });
    })();
    return true;
  }

  /** Forget expired entries; at the cap, refuse new ones (`full`) or drop the oldest. */
  sweep<T extends { expiry: number }>(map: Map<string, T>, full?: string) {
    for (const [k, v] of map) if (v.expiry < Date.now()) map.delete(k);
    if (map.size < 200) return;
    if (full) throw new Error(full);
    map.delete(map.keys().next().value!);
  }

  /** Where the page picks up a finished sign-in: a one-time code in the fragment, so no token is ever in an address. */
  ssoFinish(done: { person?: string; device?: string; error?: string }) {
    this.sweep(this.ssoDone);
    const code = random();
    this.ssoDone.set(code, { ...done, expiry: Date.now() + 2 * 60_000 });
    return `/#sso/${code}`;
  }

  /** To the provider's sign-in page, with state, nonce and PKCE. It comes back to /api/sso/callback on the address the person used. */
  async ssoStart(req: http.IncomingMessage, res: http.ServerResponse, url: URL, cfg?: Sso) {
    if (!cfg) throw new Error('Sign-in with work accounts is not set up on this box.');
    const { authorization_endpoint } = await provider(cfg.issuer);
    this.sweep(this.ssoPending, 'Too many sign-ins are in progress. Try again in a few minutes.');
    const h = req.headers;
    const host = String(h['x-forwarded-host'] ?? h.host ?? '').split(',')[0].trim();
    const proto = String(h['x-forwarded-proto'] ?? 'http').split(',')[0].trim();
    if (!/^[\w.:[\]-]{1,200}$/.test(host) || !/^https?$/.test(proto)) throw new Error('This request has no usable address to come back to.');
    const [state, nonce, verifier, browser] = [random(), random(), random(32), random()];
    const redirect = `${proto}://${host}/api/sso/callback`; // the provider accepts only the redirect addresses registered for the app
    this.ssoPending.set(state, { nonce, verifier, browser, redirect, device: (url.searchParams.get('device') ?? '').trim().slice(0, 40), expiry: Date.now() + 10 * 60_000 });
    // The sign-in must come back to the browser that started it, so nobody can hand someone else a link that signs them in as the sender.
    res.setHeader('set-cookie', `gurtos_sso=${browser}; Path=/api/sso; Max-Age=600; HttpOnly; SameSite=Lax${proto === 'https' ? '; Secure' : ''}`);
    const q = new URLSearchParams({ response_type: 'code', client_id: cfg.clientId, redirect_uri: redirect, scope: 'openid profile email', state, nonce, code_challenge: challenge(verifier), code_challenge_method: 'S256' });
    return `${authorization_endpoint}${authorization_endpoint.includes('?') ? '&' : '?'}${q}`;
  }

  /** Back from the provider: check the state, trade the code for an ID token, check the token and the groups, then sign the person in. */
  async ssoCallback(req: http.IncomingMessage, url: URL, cfg?: Sso) {
    const state = url.searchParams.get('state') ?? '';
    const pending = this.ssoPending.get(state);
    this.ssoPending.delete(state); // one-time
    if (!pending || pending.expiry < Date.now()) throw new Error('This sign-in has expired or was already used. Sign in again.');
    if (!(req.headers.cookie ?? '').split(/;\s*/).includes(`gurtos_sso=${pending.browser}`)) throw new Error('This sign-in was started in another browser. Sign in again here.');
    if (!cfg) throw new Error('Sign-in with work accounts is not set up on this box.');
    const said = url.searchParams.get('error');
    if (said) throw new Error(`The sign-in provider said no: ${(url.searchParams.get('error_description') ?? said).slice(0, 300)}`);
    const secret = this.vault.get(cfg.secretKey);
    if (!secret) throw new Error(`The client secret is not in the vault yet (${cfg.secretKey}).`);
    const prov = await provider(cfg.issuer);
    const r = await fetch(prov.token_endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
      body: new URLSearchParams({ grant_type: 'authorization_code', code: url.searchParams.get('code') ?? '', redirect_uri: pending.redirect, client_id: cfg.clientId, client_secret: secret, code_verifier: pending.verifier }),
      signal: AbortSignal.timeout(10_000),
    });
    const tokens = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(`The sign-in provider refused the code: ${String(tokens.error_description ?? tokens.error ?? r.status).slice(0, 300)}`);
    const check = (keys: JsonWebKey[]) => verifyIdToken(tokens.id_token, { keys, issuer: cfg.issuer, clientId: cfg.clientId, nonce: pending.nonce });
    let claims: Claims;
    try {
      claims = check(prov.keys);
    } catch (e) {
      if (!(e as { unknownKey?: boolean }).unknownKey) throw e;
      claims = check((await provider(cfg.issuer, true)).keys); // the provider rotated its keys
    }
    return this.ssoFinish({ person: this.ssoPerson(cfg, claims), device: pending.device });
  }

  /** The person for these claims: added or updated from the groups, or, when no group maps any more, removed with their devices. */
  ssoPerson(cfg: Sso, claims: Claims): string {
    const id = personId(cfg.issuer, claims.sub);
    const old = this.person(id);
    const { name, email } = whoIs(claims, cfg.domain);
    const role = roleFor(claims.groups, cfg.groups);
    if (!role) {
      if (old) {
        this.business.people = this.business.people.filter((x) => x.id !== id);
        this.saveBusiness();
        for (const d of this.devices) if (d.person === id && !d.revoked) this.revokeDevice(d.id);
        this.write({ type: 'note', track: 'business', data: { sso: 'removed', person: id, idp: cfg.name, why: 'no group maps to a role any more' }, who: { by: id } });
      }
      throw new Error(noGroup(claims));
    }
    const p = checkPerson({ id, name, ...role, ...(email ? { email } : {}) }, this.business.people);
    this.business.people = old ? this.business.people.map((x) => (x.id === id ? p : x)) : [...this.business.people, p];
    this.saveBusiness();
    this.write({ type: 'note', track: 'business', data: { sso: 'signed in', person: id, idp: cfg.name, role: p.role, limitCents: p.limitCents, approvesFor: p.approvesFor, ...(old ? {} : { added: true }) }, who: { by: id } });
    return id;
  }

  // ---------- remote access and push notifications ----------

  /** Where phones reach this box: its https address when remote access is on, else BOX_URL. */
  boxUrl() {
    return this.remote.saved?.url ?? (process.env.BOX_URL ?? '').replace(/\/+$/, '');
  }

  /** Tell the phones that should answer this approval. Quiet hours hold it back; the request still waits in the inbox. */
  async pushApproval(a: Approval) {
    // Business: the request's approvers, or, if nobody can approve it, whoever may deny it and the owner (plus owner
    // phones paired before Business), so a stuck request never waits unseen.
    const t0 = this.state.tasks.get(a.task);
    const n = this.business.on && a.route && t0 ? notifyPeople({ to: a.route.to, amountCents: a.route.amountCents, askedBy: a.askedBy ?? t0.requestedBy, rule: a.route.rule }, this.business.people) : undefined;
    const routed = n ? { ...a, route: { ...a.route!, people: n.ids.map((id) => ({ id, name: '' })) } } : a;
    const to = [...push.recipients(routed, this.devices), ...(n?.stuck ? this.devices.filter((d) => d.owner && !d.person && d.push && !d.revoked) : [])];
    if (!to.length || !this.remote.saved) return;
    if (push.quiet(this.settings.quietHours, system.timezone())) return void console.log(`push for ${a.id} held for quiet hours`);
    const t = this.state.tasks.get(a.task);
    const text = n?.stuck
      ? { title: 'Nobody can approve this', body: `${a.question.slice(0, 120)} Nobody's limit or rule allows it: deny it, or an admin can raise a limit.`.slice(0, 200) }
      : push.approvalText(a, t?.title ?? '');
    // `source` lets the app hold back one-tap Approve where the approval needs a ceremony in the app (Shopper's Face ID).
    await Promise.allSettled(to.map((d) => this.pushTo(d, { type: 'approval', id: a.id, task: a.task, source: t?.source ?? '', costCents: a.costCents, ...text }, a.id)));
  }

  /** One push to one device, through the relay's gateway, encrypted for that phone and signed with its key for this box. */
  async pushTo(d: Device, fields: Record<string, string | number>, topic: string) {
    const s = this.remote.saved;
    const secret = this.vault.get(SECRET_KEY);
    if (!d.push) throw Object.assign(new Error('turn on notifications on this phone first'), { status: 409 });
    if (!s || !secret) throw Object.assign(new Error('notifications go through the relay: turn on "Reach this box from anywhere" first'), { status: 409 });
    try {
      const r = await push.send(RELAY, s.name, secret, d.push, { v: 1, machine: BOX_ID, box: BOX_NAME, url: s.url, ...fields }, topic);
      if (r.gone) delete d.push, this.saveDevices(); // the phone dropped the subscription
      return r;
    } catch (e) {
      console.error(`push to ${d.name} failed: ${(e as Error).message}`);
      throw e;
    }
  }

  /** One test push per device every 10 s, so a phone can't use up the box's push allowance at the relay. */
  lastTest = new Map<string, number>();
  testThrottle(d: Device) {
    if (Date.now() - (this.lastTest.get(d.id) ?? 0) < 10_000) throw Object.assign(new Error('one test every 10 seconds'), { status: 429 });
    this.lastTest.set(d.id, Date.now());
  }

  /** GET, POST and DELETE /api/remote, GET /api/remote/name/<name>; GET, PUT and DELETE /api/push, POST /api/push/test. */
  remoteRoutes(req: http.IncomingMessage, res: http.ServerResponse) {
    const p = new URL(req.url ?? '/', 'http://box').pathname.replace(/^\/api(?=\/)/, '');
    const m = req.method ?? 'GET';
    const name = p.match(/^\/remote\/name\/([^/]+)$/)?.[1];
    const d = this.deviceOf(req);
    const phone = () => d ?? (() => { throw Object.assign(new Error('only a paired phone gets notifications'), { status: 403 }); })();
    let act: ((body: any) => unknown) | undefined;
    if (p === '/remote' && m === 'GET') act = () => this.remote.refresh();
    else if (p === '/remote' && m === 'POST') act = (b) => (this.requireOwner(req), this.remote.enable(b?.name));
    else if (p === '/remote' && m === 'DELETE') act = () => (this.requireOwner(req), this.remote.disable());
    else if (name && m === 'GET') act = () => (this.requireOwner(req), this.remote.available(decodeURIComponent(name)));
    else if (p === '/push' && m === 'GET') act = () => ({ subscribed: !!d?.push, remote: !!this.remote.saved });
    else if (p === '/push' && m === 'PUT') act = (b) => ((phone().push = push.parseSub(b)), this.saveDevices(), { subscribed: true });
    else if (p === '/push' && m === 'DELETE') act = () => (delete phone().push, this.saveDevices(), { subscribed: false });
    else if (p === '/push/test' && m === 'POST')
      act = async () => (this.testThrottle(phone()), await this.pushTo(phone(), { type: 'test', id: `test-${Date.now()}`, task: '', title: 'Notifications work', body: `${BOX_NAME} will tell this phone when a task needs your OK.` }, 'test'), { sent: 1 });
    if (!act) return false;
    void (async () => {
      const json = (status: number, obj: unknown) => res.writeHead(status, { 'content-type': 'application/json' }).end(JSON.stringify(obj));
      try {
        const chunks: Buffer[] = [];
        for await (const c of req) chunks.push(c as Buffer);
        let body = {};
        try {
          body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : {};
        } catch {
          throw new Error("the request body isn't valid JSON");
        }
        json(200, await act(body));
      } catch (e) {
        json((e as { status?: number }).status ?? 400, { error: (e as Error).message });
      }
    })();
    return true;
  }

  revokeDevice(id: string) {
    const d = this.devices.find((x) => x.id === id);
    if (!d) throw Object.assign(new Error(`no device ${id}`), { status: 404 });
    d.revoked = true;
    this.saveDevices();
    if (d.identity) this.live.unregister(d.identity);
    if (d.identity && d.person) this.live.removePerson(d.identity);
    return { id, revoked: true };
  }

  /**
   * The request comes from the box's own screen: over the local socket, or from this machine's loopback with
   * no proxy header. A request relayed by a reverse proxy or a tailnet serve looks local to the box, but it
   * carries forwarding headers, so it does not count.
   */
  isLocal(req: http.IncomingMessage): boolean {
    const addr = req.socket.remoteAddress; // undefined on a unix socket
    const loopback = addr === undefined || addr === '127.0.0.1' || addr === '::1' || addr === '::ffff:127.0.0.1';
    const h = req.headers;
    const relayed = !!(h['x-forwarded-for'] || h.forwarded || h['x-real-ip'] || h['tailscale-user-login'] || h['x-forwarded-host']);
    // A web page in a browser on this machine also arrives from loopback. Only the box's own pages count: a request
    // a browser marks as coming from another site (Origin) is not the box's screen, whatever address it came from.
    const origin = h.origin;
    const foreign = !!origin && !/^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/.test(origin);
    return loopback && !relayed && !foreign;
  }

  /**
   * Who is calling, for a track route (the x-box-caller header): 'screen' (the box's own screen), 'owner' (a phone
   * paired as the owner), 'device:<id>' (another paired phone), 'service' (a helper on the box, like the ASI:One
   * agent) or 'none' (an open route reached through a proxy with no token).
   */
  callerOf(req: http.IncomingMessage): string {
    const device = this.deviceOf(req);
    if (device) return device.owner ? 'owner' : `device:${device.id}`;
    if (this.isLocal(req)) return this.serviceCaller(req) ? 'service' : 'screen';
    return 'none';
  }

  /** The box's own screen, or a device that was paired as the owner. */
  isOwner(req: http.IncomingMessage): boolean {
    // The box's own screen is the owner, unless it says it is someone else (Business: x-box-person).
    const p = this.personOf(req);
    return (this.isLocal(req) && !this.serviceCaller(req) && !p) || !!this.deviceOf(req)?.owner || p?.role === 'owner';
  }

  /**
   * A loopback caller that runs as `nobody` or as a task user: a helper service on the box (the ASI:One agent
   * runs as nobody), not the box's own screen. It may still use the API like the screen does, but never the
   * owner's controls (vault, settings, folders, Keep), so a flaw in a helper cannot become the owner's rights.
   */
  serviceCaller(req: http.IncomingMessage): boolean {
    if (req.socket.remoteAddress === undefined) return false; // the root-only socket
    const uid = uidOf(req.socket);
    return uid === 65534 || (uid !== undefined && uid >= 30000 && uid <= 39999);
  }

  /** Setup, settings, apps on and off, and the vault are for the owner only. */
  requireOwner(req: http.IncomingMessage) {
    if (!this.isOwner(req)) throw Object.assign(new Error("only the box's own screen or the owner's paired device can do this"), { status: 403 });
  }

  /** The paired, un-revoked device this request is from: by `Authorization: Bearer` or `?access_token=`. */
  deviceOf(req: http.IncomingMessage): Device | undefined {
    const q = new URL(req.url ?? '/', 'http://box').searchParams.get('access_token') ?? undefined;
    return this.deviceByToken(req.headers.authorization) ?? this.deviceByToken(q);
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
    const del = (p.match(/^\/devices\/([\w-]+)$/) || p.match(/^\/pair\/devices\/([\w-]+)\/revoke$/))?.[1];
    // Match the exact method and path. Anything else (a GET of /pair, which is a portal page route) is not
    // ours, so return false and let the static portal handler serve the app.
    let act: ((body: any) => unknown) | undefined;
    if (m === 'GET' && p === '/boxes') act = () => this.boxes();
    else if (m === 'POST' && (p === '/pair/start' || p === '/pair/new')) act = (body) => (this.requireOwner(req), this.pairStart(body?.owner === true));
    else if (m === 'GET' && (p === '/devices' || p === '/pair/devices')) act = () => (this.requireOwner(req), this.devices).filter((d) => !d.revoked).map(({ token, push, ...d }) => ({ ...d, push: !!push }));
    else if (m === 'DELETE' && p === '/pair/self') act = () => this.revokeDevice((this.deviceOf(req) ?? (() => { throw Object.assign(new Error('this request carries no paired device token'), { status: 403 }); })()).id); // a phone forgets itself
    else if ((m === 'DELETE' || m === 'POST') && del) act = () => (this.requireOwner(req), this.revokeDevice(del));
    const needsBody = m === 'POST' && p === '/pair';
    if (!act && !needsBody) return false;
    void (async () => {
      const json = (status: number, obj: unknown) => res.writeHead(status, { 'content-type': 'application/json' }).end(JSON.stringify(obj));
      try {
        const chunks: Buffer[] = [];
        for await (const c of req) chunks.push(c as Buffer);
        const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : {};
        json(200, act ? act(body) : this.pair(body));
      } catch (e) {
        json((e as { status?: number }).status ?? 400, { error: (e as Error).message });
      }
    })();
    return true;
  }

  // ---------- the API: portal, phone, demo. Every route also answers under /api/. ----------

  api = () =>
    jsonServer(
      async (method, url, body, headers, req) => {
        const [, a, rawId, action] = url.pathname.replace(/^\/api(?=\/)/, '').split('/');
        const id = rawId ? decodeURIComponent(rawId) : rawId; // ids may hold spaces (Droid's questions); the client encodes them
        const route = `${method} /${a ?? ''}${rawId ? '/:id' : ''}${action ? '/' + action : ''}`;
        const q = (name: string) => url.searchParams.get(name);
        switch (route) {
          case 'GET /tasks':
            return [...this.state.tasks.values()];
          case 'POST /tasks': {
            // "Ask an agent on this folder" (Personal): link the real folder(s), then make the task on them.
            if (body.folder && body.folders) throw new Error('send folder or folders, not both');
            const given = body.folders ?? (body.folder ? [body.folder] : undefined);
            if (given || (typeof body.workspace === 'string' && sandbox.isLinked(body.workspace))) this.requireOwner(req); // the owner's folders are the owner's to hand out
            if (given) {
              body.workspace = this.linkFolders(given);
              if (body.folders) body.folder = String(body.folders[0]); // readers that know one folder see the first
            }
            // Who started it: an off-box caller is named by its paired device, never by what it sends.
            const device = this.deviceOf(req);
            if (device) body.source = `phone:${device.name}`;
            else if (!this.isLocal(req)) throw Object.assign(new Error('pair this phone with the box first'), { status: 401 });
            return this.createTask(body, this.personOf(req)?.id);
          }
          case 'GET /tasks/:id':
            return {
              task: this.must(id),
              approvals: [...this.state.approvals.values()].filter((x) => x.task === id),
              events: this.log.events.filter((e) => e.task === id),
            };
          case 'GET /tasks/:id/diff': {
            const t = this.must(id);
            if (t.state === 'undone') return { changes: [], diff: '', undone: true }; // an undone task's changes are gone
            const roots = sandbox.multiRoots(t.workspace); // several folders: each change path starts with its label
            return { ...sandbox.diff(t), ...(roots ? { roots } : {}) };
          }
          case 'POST /tasks/:id/keep':
            this.requireOwner(req); // Keep writes into the owner's real files
            return this.keep(id);
          case 'POST /tasks/:id/unkeep':
            this.requireOwner(req);
            return this.unkeep(id);
          case 'POST /tasks/:id/undo':
            return this.undo(id);
          case 'GET /approvals': {
            if (q('for') === 'me') {
              const p = this.personOf(req); // "Waiting for me": what this person may approve now
              return p ? this.waitingFor(p) : [];
            }
            return [...this.state.approvals.values()].filter((x) => !q('state') || x.state === q('state'));
          }
          case 'POST /approvals/:id': {
            // A phone sends its device token; it must be a paired, un-revoked device, and `by` becomes its name.
            let by = String(body.by ?? 'api'); // the box's own screen says who it is
            const device = this.deviceOf(req);
            if (headers.authorization && !device) throw Object.assign(new Error('pair this phone with the box first'), { status: 401 });
            if (device) by = device.name; // a paired phone is named by its device, whatever it sends
            else if (!this.isLocal(req)) throw Object.assign(new Error('pair this phone with the box first'), { status: 401 });
            return this.answerAs(id, body.approved === true, this.personOf(req), by); // Business checks who may answer
          }
          case 'GET /business':
            return this.businessView();
          case 'GET /business/:id':
            return id === 'route' ? this.tryRoute(url.searchParams) : undefined;
          case 'PUT /business':
            return this.setBusiness(body, req);
          case 'GET /people':
            this.requireAdmin(req);
            return this.peopleView();
          case 'POST /people':
            this.requireAdmin(req);
            return this.putPerson(body, req);
          case 'DELETE /people/:id':
            this.requireAdmin(req);
            return this.removePerson(id, req);
          case 'POST /people/:id/pair':
            // A one-time code that pairs a phone (or a laptop's browser) as this person.
            this.requireAdmin(req);
            if (!this.person(id)) throw Object.assign(new Error(`no person ${id}`), { status: 404 });
            // Pairing a phone as the owner gives the owner's rights: only the owner may do that, never an admin.
            if (this.person(id)!.role === 'owner' && !this.isOwner(req)) forbid('only the owner can pair a phone as the owner');
            return { ...this.pairStart(false, id), person: id };
          case 'GET /me':
            return this.me(req);
          case 'GET /audit':
            this.requireAuditor(req);
            return this.audit(url.searchParams);
          case 'GET /pause':
            return this.pauseView();
          case 'POST /pause':
            return this.pause(req);
          case 'POST /resume':
            return this.resume(req);
          case 'POST /drill': {
            // The incident drill's numbers (core/drill.ts), kept in the log beside the pause they measured.
            this.requireAdmin(req);
            if (!body || typeof body !== 'object' || JSON.stringify(body).length > 2048) throw new Error('send the drill numbers as a small JSON object');
            const { name, who } = this.actor(req);
            return this.write({ type: 'note', track: 'kill-switch', data: { drill: body, by: name }, ...(who ? { who } : {}) });
          }
          case 'GET /log':
            return this.log.events.slice(Number(q('after') ?? 0)).filter((e) => !q('task') || e.task === q('task'));
          case 'GET /owner':
            return this.ownerInfo();
          case 'PUT /owner':
            this.requireOwnerChange(req);
            return this.setOwner(body?.user);
          case 'DELETE /owner':
            this.requireOwnerChange(req);
            return this.setOwner(undefined);
          case 'GET /apps': {
            // Default: the apps that have a window, enabled ones only, in the shape the portal reads
            // ({name, title, href, track}) plus what the App Center shows. ?all=1: every installed app, on or off.
            if (q('all')) return [...this.installed.keys()].map((n) => this.appEntry(n));
            return this.apps.map((a) => ({ ...a, ...this.appEntry(a.track), name: a.name, title: a.title, href: a.href }));
          }
          case 'POST /apps/:id/enable':
            this.requireOwner(req);
            return this.enableApp(id);
          case 'POST /apps/:id/disable':
            this.requireOwner(req);
            return this.disableApp(id);
          case 'POST /pair/:id':
            if (id !== 'identity') return undefined;
            return this.vouch(req, body?.identity);
          case 'GET /system':
            return this.systemFacts();
          case 'GET /setup':
            return this.setupView();
          case 'POST /setup/:id': {
            this.requireOwner(req);
            if (id === 'step') {
              recordStep(this.setup, body.id ?? body.step, body.data);
              saveSetup(HOME, this.setup);
              this.write({ type: 'note', track: 'setup', data: { step: body.id ?? body.step } }); // the step id only: data may be personal
            } else if (id === 'finish') {
              this.setup.done = true;
              this.setup.finishedAt = new Date().toISOString();
              saveSetup(HOME, this.setup);
              this.write({ type: 'note', track: 'setup', data: { finished: true } });
            } else if (id === 'reopen') {
              this.setup.done = false;
              delete this.setup.finishedAt;
              saveSetup(HOME, this.setup);
              this.write({ type: 'note', track: 'setup', data: { reopened: true } });
            } else return undefined;
            return this.setupView();
          }
          case 'GET /settings':
            return this.settings;
          case 'PATCH /settings': {
            this.requireOwner(req);
            const next = applyPatch(this.settings, body);
            const changed = Object.fromEntries(Object.keys(body).map((k) => [k, { from: (this.settings as any)[k], to: (next as any)[k] }]));
            this.settings = next;
            saveSettings(HOME, next);
            const who = this.actor(req).who; // Business: the person who changed them
            this.write({ type: 'note', track: 'settings', data: { changed }, ...(who ? { who } : {}) });
            if ('paused' in body && changed.paused.from !== next.paused) this.pauseChanged(next.paused, req); // the kill switch
            return this.settings;
          }
          case 'GET /vault':
            this.requireOwner(req);
            // Names and when each was set. No route returns a value.
            return [...new Set([...this.vault.keys(), ...Object.keys(this.vaultMeta)])].sort().map((name) => ({ name, setAt: this.vaultMeta[name] ?? null }));
          case 'PUT /vault/:id': {
            this.requireOwner(req);
            if (!VAULT_NAME.test(id)) throw new Error('key names are capital letters, digits and _ (like STRIPE_KEY), 2 to 64 characters');
            writeVaultKey(id, body?.value); // validates; throws without echoing the value
            this.vault.set(id, String(body.value).trim());
            this.vaultMeta[id] = new Date().toISOString();
            fs.writeFileSync(this.vaultMetaPath, JSON.stringify(this.vaultMeta, null, 2), { mode: 0o600 });
            const who = this.actor(req).who;
            this.write({ type: 'note', track: 'vault', data: { set: id }, ...(who ? { who } : {}) }); // the name only, never the value
            return { name: id, setAt: this.vaultMeta[id] };
          }
          case 'GET /health': {
            // Open for the outage check and remote access's self-check; the rest only for this machine or a paired device.
            const open = { ok: true, startedAt: this.startedAt, paused: !!this.paused };
            if (!this.isLocal(req) && !this.deviceOf(req)) return open;
            return { ...open, cleanStart: this.cleanStart, resumed: this.resumed, tasks: this.state.tasks.size, tools: [...this.tools.keys()], spacetime: { port: 3000, database: DB } };
          }
        }
      },
      (req, res) => this.cors(req, res) || this.gate(req, res) || this.ssoRoutes(req, res) || this.readOnly(req, res) || this.pairing(req, res) || this.remoteRoutes(req, res) || this.logStream(req, res) || this.auditCsv(req, res) || this.webhook(req, res) || this.trackRoute(req, res) || this.portal(req, res),
    );

  /** The GurtOS app (app.gurtos.com) may call the box from the browser; other origins (a portal dev server) need BOX_ORIGINS, comma separated, or '*'. Tokens are required either way. */
  cors(req: http.IncomingMessage, res: http.ServerResponse) {
    const origin = req.headers.origin;
    const allowed = [APP, ...(process.env.BOX_ORIGINS ?? '').split(',').map((o) => o.trim())];
    if (!origin || !(allowed.includes(origin) || allowed.includes('*'))) return false;
    res.setHeader('access-control-allow-origin', origin);
    res.setHeader('access-control-allow-headers', 'content-type, authorization');
    res.setHeader('access-control-allow-methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
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
    res.flushHeaders(); // send the headers now, so a reader sees the stream open before the first event
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
        const person = this.personOf(req);
        const headers: Record<string, string> = { ...(req.headers as Record<string, string>), 'x-box-caller': this.callerOf(req) }; // set by the box, never by the caller
        delete headers['x-box-person']; // Business: the person's id, set by the box below, never by the caller
        if (person) headers['x-box-person'] = person.id;
        const request = new Request(url, { method: req.method, headers, body: hasBody ? Buffer.concat(chunks) : undefined });
        const r = await entry.route(request, this.boxFor(entry.track, person));
        res.writeHead(r.status, Object.fromEntries(r.headers)).end(Buffer.from(await r.arrayBuffer()));
      } catch (e) {
        res.writeHead(500, { 'content-type': 'application/json' }).end(JSON.stringify({ error: (e as Error).message }));
      }
    })();
    return true;
  }

  /** The portal file this request would be answered with, or undefined if it is an API call. */
  portalTarget(req: http.IncomingMessage): string | undefined {
    const root = path.resolve(process.env.BOX_PORTAL ?? new URL('../portal/dist/', import.meta.url).pathname);
    const { pathname } = new URL(req.url ?? '/', 'http://box');
    if (req.method !== 'GET' || pathname.startsWith('/api/') || pathname.startsWith('/t/') || pathname.startsWith('/hook/') || !fs.existsSync(root)) return undefined;
    const file = path.resolve(root, '.' + decodeURIComponent(pathname));
    const isFile = file.startsWith(root + path.sep) && fs.existsSync(file) && fs.statSync(file).isFile();
    if (!isFile && !(req.headers.accept ?? '').includes('text/html')) return undefined; // fetch('/tasks') still gets the API
    return isFile ? file : path.join(root, 'index.html');
  }

  /** The built portal, if there is one, on the same address as the API: files, and index.html for page loads. */
  portal(req: http.IncomingMessage, res: http.ServerResponse) {
    const target = this.portalTarget(req);
    if (!target) return false;
    const types: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json' };
    res.writeHead(200, { 'content-type': types[path.extname(target)] ?? 'application/octet-stream' }).end(fs.readFileSync(target));
    return true;
  }

  /**
   * Who may reach the API at all. A request from the box's own screen is trusted (it is on the machine). Any
   * other must carry a paired phone's token, as `Authorization: Bearer ...` or `?access_token=` (an EventSource
   * cannot set headers), except: the health check, redeeming a pairing code, and the portal's own pages, which
   * hold nothing private. Without a token the answer is 401 and nothing is read, started, approved or undone.
   */
  gate(req: http.IncomingMessage, res: http.ServerResponse): boolean {
    if (this.isLocal(req)) return false;
    const m = req.method ?? 'GET';
    const p = new URL(req.url ?? '/', 'http://box').pathname.replace(/^\/api(?=\/)/, '');
    if (m === 'OPTIONS' || (m === 'GET' && p === '/health') || (m === 'POST' && p === '/pair') || this.portalTarget(req)) return false;
    if ((m === 'GET' && /^\/sso(\/start|\/callback)?$/.test(p)) || (m === 'POST' && p === '/sso/redeem')) return false; // work-account sign-in
    // A track route that is public on purpose, or checks its own secret, is reachable through a proxy.
    if (this.routes.get(`${m} ${new URL(req.url ?? '/', 'http://box').pathname}`)?.open) return false;
    if (this.deviceOf(req)) return false;
    res.writeHead(401, { 'content-type': 'application/json' }).end(JSON.stringify({ error: 'pair this phone with the box first' }));
    return true;
  }

  async boot() {
    sandbox.workspace('home');
    try {
      firewall();
      this.watchBlocked();
    } catch (e) {
      console.error(`WARNING: the firewall rule did not load, so tasks are not network-limited: ${(e as Error).message}`);
    }
    this.proxyPort = await startProxy({
      taskOf: (uid) => {
        const t = this.state.tasks.get(this.uidTask.get(uid) ?? '');
        return t?.state === 'running' || t?.state === 'waiting' ? t : undefined;
      },
      blocked: (t, host) => this.write({ type: 'net.blocked', task: t.id, host }),
      leaked: (t, text) => {
        if (!this.leaks(t, text)) return false;
        this.tripwire(t, 'a web request');
        return true;
      },
      factoryKey: () => this.vault.get('FACTORY_API_KEY'),
      anthropicKey: () => this.vault.get('ANTHROPIC_API_KEY'),
    }, this.relay);
    const tracks = await this.loadTracks();
    for (const [name, real] of Object.entries(this.links)) typeof real === 'string' ? sandbox.linkBase(name, real) : sandbox.linkMulti(name, real);
    for (const ws of fs.readdirSync(path.join(HOME, 'workspaces'))) this.refreshView(ws);
    // Resume what was going when the box went down. Approvals still pending stay pending.
    for (const t of this.state.tasks.values()) {
      if (t.state === 'queued' || t.state === 'running' || t.state === 'waiting') {
        if (this.paused) {
          console.log(`${t.id} (${t.state}) waits: the agents were paused by ${this.paused.by}`);
          continue; // resuming the agents starts it
        }
        console.log(`resuming ${t.id} (${t.state})`);
        this.resumed.push(t.id);
        if (!(this.settings.paused && t.state === 'queued')) void this.start(t);
      }
    }
    this.sweepUndone();
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
      this.apiPort = port;
      this.remote.boot(); // the box's https address, if the owner turned it on
    }
    for (const track of tracks) this.startTriggers(track.name);
    this.live.start(); // publishes and connects in the background; the API above is already serving
    console.log(`box up: ${this.state.tasks.size} tasks in the log, tracks: ${tracks.map((t) => t.name).join(', ') || 'none'}`);
  }
}

// One bad connection or task must not take the box down. The log keeps the truth either way.
process.on('uncaughtException', (e) => console.error('uncaught:', e));
// A clean stop (systemctl restart, a deploy) leaves a marker, so the next boot is not announced as a power cut.
process.on('SIGTERM', () => {
  try {
    fs.writeFileSync(path.join(HOME, 'clean-stop'), new Date().toISOString());
  } catch {} // the marker is a courtesy for the screen
  process.exit(0);
});
process.on('unhandledRejection', (e) => console.error('unhandled:', e));
sandbox.init();
await new Core().boot();
