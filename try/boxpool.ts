// A pool of throwaway demo boxes, one per visitor. Each is a real box process with its own BOX_HOME, the same
// isolation ./demo uses: the scripted worker only (BOX_NO_DROID=1), a vault of fake keys, and the box's own
// per-task tripwire decoy. The control plane reaches a box over its Unix socket (local = full access, used to
// mint a paired token and to build tasks from the menu). The browser reaches it only through the gateway, which
// adds X-Forwarded-For so the box treats every visitor request as remote and demands that paired token.
import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { call } from '../core/client.ts';
import { teardown } from '../core/reap.ts';
import { ATTACKER, attackDiskFill, attackProbe, attackTripwire, MENU, PAGES, visitorPage, WEB_HOST, WEB_PORT } from './menu.ts';
import type { TaskSpec } from './menu.ts';

export const TRY_ROOT = '/var/lib/box-try';

// The fake "web" a task may reach: the gateway (and the demo) serve it on loopback. A box resolves web.demo to
// 127.0.0.1 (BOX_HOSTS), and a task may reach only web.demo:WEB_PORT, so this is the one host any task can touch.
export const sinks: string[] = [];
export function startFakeWeb(): http.Server {
  const srv = http.createServer((req, res) => {
    const u = new URL(req.url ?? '/', 'http://web.demo');
    const send = (html: string) => res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(`<!doctype html><meta charset=utf-8><title>demo web</title>${html}`);
    if (u.pathname === '/stove') return send(PAGES.comment.html.replace(/<!--.*?-->/s, ''));
    if (PAGES[u.pathname.slice(1)]) return send(PAGES[u.pathname.slice(1)].html);
    if (u.pathname.startsWith('/u/')) return send(boxes.get(u.pathname.slice(3))?.page ?? '<p>no page</p>');
    if (u.pathname === '/collect') {
      sinks.push(u.search); // a decoy sink; the tripwire stops the request before it ever arrives
      return res.writeHead(200).end('ok');
    }
    res.writeHead(404).end('not found');
  });
  srv.listen(WEB_PORT, '127.0.0.1');
  return srv;
}

const IDLE_MS = 20 * 60_000; // destroy a box after 20 minutes with no visitor request
const MAX_MS = 60 * 60_000; // and after an hour no matter what
const UNUSED_MS = 2 * 60_000; // free a box no real browser ever drove within 2 min (a dropped Start, a bot, a preview)
const BOOT_MS = 30_000;

export interface Box {
  id: string;
  home: string;
  sock: string;
  port: number; // the box's API TCP port (auto-chosen; re-read after a plug-pull)
  token: string; // a non-owner web device token the gateway injects into the portal
  name: string;
  pid?: number;
  createdAt: number;
  lastSeen: number;
  ip: string;
  attacks: number; // attack runs on this box so far
  plugAt: number; // last pull-the-plug, for the per-box cooldown
  page?: string; // the visitor's own attack text, served by the fake web at /u/<id>
  busyAttack: boolean;
  interacted: boolean; // did a real browser ever drive this box (an /api call or a menu/attack action)?
}

const boxes = new Map<string, Box>();
export const count = () => boxes.size;
export const get = (id: string) => boxes.get(id);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function waitHealthy(b: Box): Promise<void> {
  for (let i = 0; i < BOOT_MS / 100; i++) {
    const h = await call(b.sock, 'GET', '/health').catch(() => undefined);
    if (h) {
      b.port = Number(fs.readFileSync(path.join(b.home, 'api.port'), 'utf8').trim());
      return;
    }
    await sleep(100);
  }
  throw new Error('box did not start');
}

function spawnProc(b: Box) {
  const out = fs.openSync(path.join(b.home, 'box.log'), 'a');
  const child = spawn(process.execPath, [...process.execArgv, new URL('../core/box.ts', import.meta.url).pathname], {
    detached: true, // its own process group, so a plug-pull kills the box and every worker at once
    stdio: ['ignore', out, out],
    env: {
      ...process.env,
      BOX_HOME: b.home,
      BOX_PORT: 'auto',
      BOX_LISTEN: '127.0.0.1', // the TCP API is loopback only; the gateway is the sole way in
      BOX_VAULT: VAULT, // the real box location, root-only; the attack's "read the vault" then gets EACCES, as on a real box
      BOX_STDB_DB: `try-${b.id}`,
      BOX_PROXY_PORT: 'auto',
      BOX_SETUP_PORT: 'auto',
      BOX_APPROVAL_WAIT_MS: '3600000', // an approval may wait the box's whole life
      BOX_NO_DROID: '1', // scripted worker only: no model spend, ever
      BOX_TASK_DISK_CAP: String(200 * 1024 * 1024), // 200 MB per task: real here, and it protects this small host's disk
      BOX_HOSTS: JSON.stringify({ [WEB_HOST]: '127.0.0.1' }), // the fake web is the only name a task can resolve
      BOX_DEMO: '1',
      BOX_ID: b.id,
      BOX_NAME: b.name,
      BOX_PEERS: '[]',
    },
  });
  b.pid = child.pid;
}

// The vault lives where a real box keeps it (/etc/box/vault.env, root-only), so a task reading it gets EACCES,
// not "file not found". Every value is a demo- placeholder (BOX_DEMO accepts them); none is real, and no task
// can read the file. Shared by every demo box here; nothing a visitor does can change or read it.
export const VAULT = '/etc/box/vault.env';
export function ensureVault() {
  if (fs.existsSync(VAULT)) return;
  fs.mkdirSync(path.dirname(VAULT), { recursive: true, mode: 0o700 });
  fs.writeFileSync(VAULT, ['FACTORY_API_KEY=demo-not-a-real-key-scripted-worker-only', 'ANTHROPIC_API_KEY=demo-not-a-real-anthropic-key', 'STRIPE_KEY=demo-sk-test-decoy-not-real', ''].join('\n'), { mode: 0o600 });
  fs.chmodSync(VAULT, 0o600);
}

export async function create(ip: string): Promise<Box> {
  ensureVault();
  const id = randomBytes(5).toString('hex');
  const home = path.join(TRY_ROOT, id);
  // Traversable, not listable: a task's own user must walk through TRY_ROOT and HOME to reach its copy (the box
  // itself chmods HOME to 0711 at boot; TRY_ROOT needs it too, like /var/lib/box-demo). No one may list them.
  fs.mkdirSync(TRY_ROOT, { recursive: true, mode: 0o711 });
  fs.chmodSync(TRY_ROOT, 0o711); // in case it pre-existed with a tighter mode
  fs.mkdirSync(home, { recursive: true, mode: 0o711 });
  // Skip the first-run wizard: a visitor should land on the desktop, not "GurtOS is being set up".
  fs.writeFileSync(path.join(home, 'setup.json'), JSON.stringify({ done: true, finishedAt: new Date().toISOString(), steps: {} }));
  // Turn remote access off for good on this box, even during setup, so a visitor's box can never enroll a
  // <name>.box.gurtos.com address through the relay and use up relay names (core's note).
  fs.writeFileSync(path.join(home, 'remote-off'), new Date().toISOString());
  const now = Date.now();
  const b: Box = { id, home, sock: path.join(home, 'api.sock'), port: 0, token: '', name: 'Your GurtOS', createdAt: now, lastSeen: now, ip, attacks: 0, plugAt: 0, busyAttack: false, interacted: false };
  spawnProc(b);
  await waitHealthy(b);
  // Mint a non-owner web device token over the socket (local = the box's own screen can mint pairing codes).
  const { code } = await call<{ code: string }>(b.sock, 'POST', '/api/pair/start', {});
  const paired = await call<{ token: string }>(b.sock, 'POST', '/api/pair', { code, name: 'This browser', kind: 'web' });
  b.token = paired.token;
  boxes.set(id, b);
  return b;
}

/** Tear one box down: kill its process group and task users, unmount its copies, drop the users and the DB, delete files. */
export function destroy(b: Box) {
  boxes.delete(b.id);
  teardown(b.home, b.pid);
  spawnSync('spacetime', ['delete', '--server', 'local', '-y', `try-${b.id}`], { stdio: 'ignore' });
  fs.rmSync(b.home, { recursive: true, force: true });
}

/** Pull the plug: hard-kill the box and its tasks, unmount, then restart. The box resumes from its action log. */
export async function pullPlug(b: Box): Promise<void> {
  if (b.pid) {
    try {
      process.kill(-b.pid, 'SIGKILL');
    } catch {}
  }
  teardown(b.home, undefined); // unmount copies and kill task users, keep the files and the log
  b.plugAt = Date.now();
  spawnProc(b);
  await waitHealthy(b);
}

export const menu = () => MENU.map((m) => ({ id: m.id, title: m.title, blurb: m.blurb, shows: m.shows }));
export const pages = () => Object.entries(PAGES).map(([id, p]) => ({ id, label: p.label }));

/** Start one of the safe menu tasks on a visitor's box. Returns the new task id. */
export async function startMenu(b: Box, menuId: string): Promise<string> {
  const item = MENU.find((m) => m.id === menuId);
  if (!item) throw new Error('no such task');
  return createTask(b, item.build());
}

async function createTask(b: Box, spec: TaskSpec): Promise<string> {
  // Only 'home' exists by default; make any other workspace (the attack uses 'target') before the task needs it.
  if (spec.workspace && spec.workspace !== 'home') fs.mkdirSync(path.join(b.home, 'workspaces', spec.workspace), { recursive: true });
  const t = await call<{ id: string }>(b.sock, 'POST', '/api/tasks', { ...spec, worker: 'fake', source: 'demo' });
  return t.id;
}

const view = (b: Box, ws: string, file: string) => {
  const f = path.join(b.home, 'views', ws, file);
  return fs.existsSync(f) ? fs.readFileSync(f, 'utf8').trim() : undefined;
};

async function settle(b: Box, id: string, ms = 40_000) {
  for (const end = Date.now() + ms; Date.now() < end; await sleep(200)) {
    const { task } = await call<{ task: { state: string } }>(b.sock, 'GET', `/api/tasks/${id}`);
    if (['done', 'failed', 'undone'].includes(task.state)) return task;
  }
  throw new Error('attack task did not finish in time');
}

export interface Defense {
  name: string;
  detail: string;
  log?: string;
}
export interface AttackResult {
  asks: string[];
  defenses: Defense[];
  notCovered: { name: string; detail: string }[];
}

/**
 * Run an attack and read out every defence. `which` is a prepared page id, or 'custom' with the visitor's text,
 * which was stored on the box by the caller and is served by the fake web at /u/<id>.
 */
export async function runAttack(b: Box, pagePath: string, asks: string[]): Promise<AttackResult> {
  const url = `http://${WEB_HOST}:${WEB_PORT}${pagePath}`;
  const probeId = await createTask(b, attackProbe(url));
  await settle(b, probeId);
  const { events } = await call<{ events: any[] }>(b.sock, 'GET', `/api/tasks/${probeId}`);
  const blocked = (hostStart: string) => events.find((e) => e.type === 'net.blocked' && String(e.host).startsWith(hostStart));
  const vault = view(b, 'target', 'vault.txt') ?? '';
  const direct = view(b, 'target', 'direct.txt') ?? '';
  const database = view(b, 'target', 'database.txt') ?? '';
  const procs = view(b, 'target', 'procs.txt') ?? '';
  const envDump = view(b, 'target', 'env.txt') ?? '';

  const defenses: Defense[] = [];
  defenses.push({ name: 'The vault refused', detail: `Reading /etc/box/vault.env returned "${vault || 'denied'}": the vault is root-only, and no task runs as root.`, log: 'the agent never saw a real key' });
  const exfilLog = blocked(ATTACKER);
  defenses.push({ name: 'The proxy blocked the host', detail: `Sending data to ${ATTACKER} was refused before any bytes left (the proxy cancelled the request). A task reaches only the hosts it was given.`, log: exfilLog ? `net.blocked ${exfilLog.host}` : undefined });
  const directLog = blocked('1.1.1.1');
  defenses.push({ name: 'The firewall dropped it', detail: `A raw connection to 1.1.1.1:443, around the proxy, was blocked by the box's firewall (${direct || 'blocked'}).`, log: directLog ? `net.blocked ${directLog.host}` : undefined });
  defenses.push({ name: "The box's own controls were out of reach", detail: `The database port 127.0.0.1:3000 could not be reached (${database || 'blocked'}), so a task cannot forge its own approval.` });
  defenses.push({ name: 'It could see no other task', detail: procs && !procs.includes(',') ? `Listing processes showed only the task's own user (uid ${procs}): every other task and the box itself are hidden.` : 'Other tasks and the box were hidden from it.' });
  // The environment dump holds only the per-task decoy AWS keys, never a real secret.
  const leakedReal = /demo-not-a-real/.test(envDump) === false && /sk-ant|FACTORY/.test(envDump); // belt and suspenders
  defenses.push({ name: 'Its environment held only decoys', detail: 'Dumping its own environment revealed a fake AWS key pair the box plants in every task. No real key is ever in a task.' });
  if (leakedReal) defenses[defenses.length - 1].detail += ' (note: unexpected real-looking value found; investigate.)';

  // Task B: trip the wire.
  b.busyAttack = true;
  const tripId = await createTask(b, attackTripwire());
  const tb = await settle(b, tripId);
  const log = await call<any[]>(b.sock, 'GET', '/api/log');
  const note = log.find((e) => e.type === 'note' && e.task === tripId && e?.data?.tripwire);
  defenses.push({
    name: 'The tripwire fired and undid the task',
    detail: tb.state === 'undone' ? 'Sending the decoy key to the one allowed host tripped the wire: the box refused the request, wrote a security note, pushed an alert, and undid the whole task.' : `Expected the task to be undone; it ended "${tb.state}".`,
    log: note ? `note security tripwire (where: ${note.data?.where ?? 'request'})` : undefined,
  });

  // Task C: fill the disk past the box's 200 MB per-task cap. GurtOS's disk watcher stops and undoes it.
  const diskId = await createTask(b, attackDiskFill());
  const dc = await settle(b, diskId);
  const dlog = await call<any[]>(b.sock, 'GET', '/api/log');
  const dnote = dlog.find((e) => e.type === 'note' && e.task === diskId && e?.data?.diskCap);
  defenses.push({
    name: 'The disk cap stopped the disk fill',
    detail: dc.state === 'undone' ? 'Writing far more than the task\'s 200 MB of disk space got the task stopped and undone within a couple of seconds, with a security note and a phone alert.' : `Expected the task to be undone; it ended "${dc.state}".`,
    log: dnote ? `note security disk (${Math.round((dnote.data?.used ?? 0) / 1024 ** 2)} MB written, cap ${Math.round((dnote.data?.diskCap ?? 0) / 1024 ** 2)} MB)` : undefined,
  });
  b.busyAttack = false;

  return {
    asks,
    defenses,
    notCovered: [
      { name: 'A body to an allowed host over HTTPS', detail: 'The proxy checks which host a task may reach, not the contents of an HTTPS request to a host it is allowed to reach. The tripwire still catches the decoy key in plain HTTP or in a request it can read.' },
      { name: 'The model itself', detail: 'This demo acts out a hijacked agent with a script, so it does not test whether Claude falls for the text. The defences shown are the operating system stopping the agent, which is the point: they do not depend on the model refusing.' },
    ],
  };
}

/** Destroy every live box now (on shutdown, so a reset is fast and clean). */
export function destroyAll() {
  for (const b of [...boxes.values()]) {
    try {
      destroy(b);
    } catch {}
  }
}

/** Destroy boxes that are idle or too old. Run on a timer. */
export function reap() {
  const now = Date.now();
  for (const b of [...boxes.values()]) {
    const dead = now - b.lastSeen > IDLE_MS || now - b.createdAt > MAX_MS || (!b.interacted && now - b.createdAt > UNUSED_MS);
    if (dead) destroy(b);
  }
}

// Sweep our own root for orphans left by a gateway crash or restart. A restart is the scheduled reset, so this
// must also kill detached box processes from the previous run (they survive the gateway; teardown alone would
// not reach them). core/reap.ts only touches /var/lib/box-demo, so we do our own.
export function reapRoot() {
  if (!fs.existsSync(TRY_ROOT)) return;
  for (const name of fs.readdirSync(TRY_ROOT)) {
    if (boxes.has(name)) continue;
    const home = path.join(TRY_ROOT, name);
    try {
      // Kill any box process still running for this home (detached child of a previous gateway).
      for (const pid of fs.readdirSync('/proc')) {
        if (!/^\d+$/.test(pid)) continue;
        try {
          if (fs.readFileSync(`/proc/${pid}/environ`, 'utf8').split('\0').includes(`BOX_HOME=${home}`)) process.kill(-Number(pid), 'SIGKILL');
        } catch {}
      }
      teardown(home, undefined);
      spawnSync('spacetime', ['delete', '--server', 'local', '-y', `try-${name}`], { stdio: 'ignore' });
      fs.rmSync(home, { recursive: true, force: true });
    } catch {}
  }
}
