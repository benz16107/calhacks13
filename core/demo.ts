// The four demo moments, headless. ./demo runs this on a test box as root. Exit 0 = pass.
// Each run has its own BOX_HOME and its own box process, so threads can run it at the same time.
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { call } from './client.ts';
import type { DemoKit, LogEvent, Task } from './contract.ts';

const run = randomBytes(3).toString('hex');
const HOME = `/var/lib/box-demo/${run}`;
const API = path.join(HOME, 'api.sock');
const started = Date.now();
const api = <T = any>(method: string, p: string, body?: unknown) => call<T>(API, method, p, body);
const view = (ws: string, file: string) => {
  const f = path.join(HOME, 'views', ws, file);
  return fs.existsSync(f) ? fs.readFileSync(f, 'utf8').trim() : undefined;
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let box: ReturnType<typeof spawn> | undefined;

async function startBox() {
  const out = fs.openSync(path.join(HOME, 'box.log'), 'a');
  // Its own process group, so a hard kill can take the box and every worker at once.
  box = spawn(process.execPath, [...process.execArgv, new URL('./box.ts', import.meta.url).pathname], {
    detached: true,
    stdio: ['ignore', out, out],
    env: { ...process.env, BOX_HOME: HOME, BOX_PORT: '0', BOX_VAULT: path.join(HOME, 'vault.env') },
  });
  for (let i = 0; i < 100; i++) {
    if (await api('GET', '/health').catch(() => undefined)) return;
    await sleep(100);
  }
  throw new Error(`the box did not start; see ${HOME}/box.log`);
}

async function waitFor<T>(what: string, fn: () => Promise<T | undefined>, ms = 20000): Promise<T> {
  for (const end = Date.now() + ms; Date.now() < end; await sleep(150)) {
    const v = await fn();
    if (v) return v;
  }
  throw new Error(`timed out waiting for ${what}`);
}

const task = async (id: string) => (await api<{ task: Task }>('GET', `/tasks/${id}`)).task;
const settled = (ids: string[]) =>
  waitFor('tasks to finish', async () => {
    const ts = await Promise.all(ids.map(task));
    const bad = ts.find((t) => t.state === 'failed');
    if (bad) throw new Error(`${bad.title} failed: ${bad.error}`);
    return ts.every((t) => t.state === 'done') ? ts : undefined;
  });

function check(ok: unknown, what: string) {
  if (!ok) throw new Error(what);
  console.log(`  ok    ${what}`);
}

let passed = 0;
let failed = 0;
let pending = 0;
async function moment(title: string, fn?: () => Promise<void>) {
  if (!fn) {
    console.log(`${title}: PENDING (not built yet)`);
    pending++;
    return;
  }
  console.log(title);
  try {
    await fn();
    passed++;
  } catch (e) {
    console.log(`  FAIL  ${(e as Error).message}`);
    failed++;
  }
}

// ---------- setup ----------

function workspace(name: string, files: Record<string, string>) {
  const dir = path.join(HOME, 'workspaces', name);
  fs.mkdirSync(dir, { recursive: true });
  for (const [file, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
    fs.writeFileSync(path.join(dir, file), text);
  }
  execFileSync('chmod', ['-R', 'a+rwX', dir]); // any task's user may change its own copy
}

workspace('notes', { 'a.txt': 'original a\n' });
// The run's vault: a canary, plus the test machine's real (sandbox) keys if it has any.
const machineVault = fs.existsSync('/etc/box/vault.env') ? fs.readFileSync('/etc/box/vault.env', 'utf8') : '';
fs.writeFileSync(path.join(HOME, 'vault.env'), `DEMO_SECRET=sk_test_canary_never_leaves_the_vault\n${machineVault}`, { mode: 0o600 });
await startBox();

// ---------- moment 1 ----------

await moment('moment 1: undo one task', async () => {
  const base = { workspace: 'notes', worker: 'fake', source: 'demo' };
  const A = await api<Task>('POST', '/tasks', {
    ...base,
    title: 'A edits a.txt',
    prompt: ['whoami who-a.txt', 'write a.txt changed by A', 'sleep 2', 'missing b.txt', 'write done-a.txt yes'].join('\n'),
  });
  const B = await api<Task>('POST', '/tasks', {
    ...base,
    title: 'B adds b.txt',
    prompt: ['whoami who-b.txt', 'write b.txt made by B', 'sleep 2', 'expect a.txt original a', 'write done-b.txt yes'].join('\n'),
  });
  await settled([A.id, B.id]);

  const log = await api<LogEvent[]>('GET', '/log');
  const seqOf = (id: string, state: string) =>
    log.find((e) => e.type === 'task.state' && e.task === id && e.state === state)?.seq ?? Infinity;
  const bothRunning = Math.max(seqOf(A.id, 'running'), seqOf(B.id, 'running'));
  check(bothRunning < Math.min(seqOf(A.id, 'done'), seqOf(B.id, 'done')), 'two tasks ran at the same time');
  const [whoA, whoB] = [view('notes', 'who-a.txt'), view('notes', 'who-b.txt')];
  check(whoA === A.user && whoB === B.user && whoA !== whoB, `each ran as its own Linux user (${whoA}, ${whoB})`);
  check(true, "neither saw the other's changes while running (A: no b.txt, B: original a.txt)");
  check(view('notes', 'a.txt') === 'changed by A' && view('notes', 'b.txt') === 'made by B', 'the workspace shows both tasks\' changes');

  await api('POST', `/tasks/${A.id}/undo`);
  check(view('notes', 'a.txt') === 'original a' && !view('notes', 'done-a.txt'), "undo removed A's changes");
  check(view('notes', 'b.txt') === 'made by B' && view('notes', 'done-b.txt') === 'yes', "B's changes are untouched");
  const original = fs.readFileSync(path.join(HOME, 'workspaces', 'notes', 'a.txt'), 'utf8').trim();
  check(original === 'original a', 'no task ever wrote to the original files');
});

// ---------- moments 2 to 4 ----------

await moment('moment 2: the booby-trapped page');
await moment('moment 3: a pause for your OK');
await moment('moment 4: pull the plug');

// ---------- each track's own steps: tracks/<name>/demo.ts ----------

const kit: DemoKit = { api, check, workspace, view, settled, waitFor, home: HOME };
const tracks = new URL('../tracks/', import.meta.url).pathname;
for (const name of fs.existsSync(tracks) ? fs.readdirSync(tracks).sort() : []) {
  const file = path.join(tracks, name, 'demo.ts');
  if (fs.existsSync(file)) await moment(`track ${name}`, async () => (await import(file)).default(kit));
}

// ---------- cleanup ----------

const users = fs.existsSync(path.join(HOME, 'log.jsonl'))
  ? fs.readFileSync(path.join(HOME, 'log.jsonl'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l) as LogEvent)
      .flatMap((e) => (e.type === 'task.created' ? [e.user] : []))
  : [];
if (box?.pid) process.kill(-box.pid, 'SIGKILL');
for (const u of users) spawnSync('pkill', ['-KILL', '-u', u]);
await sleep(200);
const mounts = fs.readFileSync('/proc/self/mountinfo', 'utf8').split('\n').map((l) => l.split(' ')[4]).filter((m) => m?.startsWith(HOME + '/'));
for (const m of mounts) execFileSync('umount', ['-l', m]);
for (const u of users) spawnSync('userdel', [u]); // most are gone already
if (failed) console.log(`\nkept ${HOME} for a look (box.log, log.jsonl, tasks/*/worker.log)`);
else fs.rmSync(HOME, { recursive: true, force: true });

const secs = ((Date.now() - started) / 1000).toFixed(1);
console.log(`\ndemo: ${passed} passed, ${failed} failed, ${pending} pending (${secs}s)`);
process.exit(failed ? 1 : 0);
