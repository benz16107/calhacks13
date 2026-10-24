// Where tasks run: one Linux user per task, and one overlayfs copy of the workspace per task.
// Each finished task's changes are a layer. A workspace's view is its base plus every done layer,
// newest on top. Undo takes one layer out of the stack; nothing else changes.
//
// BOX_HOME/
//   workspaces/<ws>/   base files (only root can reach them directly)
//   views/<ws>/        read-only view: base + done layers
//   tasks/<id>/        root 0711
//     upper/           the task's changes (its layer)    work/  overlayfs scratch
//     root/            the task's copy of the workspace, only its user can enter
//     home/            the task user's home              broker.sock  worker.log
import { execFileSync, spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { Task } from './contract.ts';

export const HOME = process.env.BOX_HOME ?? '/var/lib/box';

// A workspace's base is BOX_HOME/workspaces/<ws>, unless it is linked to a real folder (Personal edition):
// then the base is that folder, so Keep writes the task's changes straight into the owner's files.
const bases = new Map<string, string>();
export const linkBase = (ws: string, realPath: string) => bases.set(ws, realPath);
export const isLinked = (ws: string) => bases.has(ws);

export const dirs = {
  workspace: (ws: string) => bases.get(ws) ?? path.join(HOME, 'workspaces', ws),
  view: (ws: string) => path.join(HOME, 'views', ws),
  task: (id: string) => path.join(HOME, 'tasks', id),
  upper: (id: string) => path.join(HOME, 'tasks', id, 'upper'),
  root: (id: string) => path.join(HOME, 'tasks', id, 'root'),
  socket: (id: string) => path.join(HOME, 'tasks', id, 'broker.sock'),
};

const run = (cmd: string, ...args: string[]) => execFileSync(cmd, args, { encoding: 'utf8' }).trim();
const tryRun = (cmd: string, ...args: string[]) => {
  try {
    return run(cmd, ...args);
  } catch {
    return undefined;
  }
};

/** useradd and userdel lock /etc/passwd, and boxes running side by side can collide on it. Try again. */
function runLocked(cmd: string, ...args: string[]) {
  for (let i = 0; ; i++) {
    try {
      return run(cmd, ...args);
    } catch (e) {
      if (i >= 20) throw e;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100 + Math.random() * 200);
    }
  }
}

export function init() {
  for (const d of ['workspaces', 'views', 'tasks']) fs.mkdirSync(path.join(HOME, d), { recursive: true, mode: 0o700 });
  // Task users may pass through HOME and tasks/ to reach their own folder, and read nothing else.
  fs.chmodSync(HOME, 0o711);
  fs.chmodSync(path.join(HOME, 'tasks'), 0o711);
  fs.mkdirSync(path.join(HOME, 'empty'), { recursive: true });
}

/** Make a workspace, empty or copied from a folder. An existing one is left alone. */
export function workspace(name: string, fromDir?: string) {
  if (!/^[\w.-]+$/.test(name)) throw new Error(`bad workspace name ${name}`);
  const dir = dirs.workspace(name);
  if (fs.existsSync(dir)) return;
  if (fromDir) fs.cpSync(fromDir, dir, { recursive: true });
  else fs.mkdirSync(dir);
  run('chmod', '-R', 'a+rwX', dir); // any task's user may change its own copy
}

const mounted = (dir: string) => fs.readFileSync('/proc/self/mountinfo', 'utf8').includes(` ${dir} `);

function mountOverlay(target: string, lowers: string[], upper?: string) {
  if (mounted(target)) return;
  // shortcut: mount options cap out near 4 KB of lower paths (~60 layers); squash old layers into the base past that.
  const opts = [`lowerdir=${lowers.join(':')}`];
  if (upper) opts.push(`upperdir=${upper}`, `workdir=${path.join(path.dirname(upper), 'work')}`);
  run('mount', '-t', 'overlay', 'overlay', '-o', opts.join(','), target);
}

const unmount = (dir: string) => mounted(dir) && tryRun('umount', '-l', dir);

/** Create the task's user, folders and copy of the workspace. Safe to call again after a reboot. */
export function prepare(task: Task): { uid: number; gid: number } {
  const t = dirs.task(task.id);
  if (!tryRun('id', '-u', task.user)) {
    // Task users live in uids 30000-39999 so one firewall rule can cover all of them.
    runLocked('useradd', '--system', '-K', 'SYS_UID_MIN=30000', '-K', 'SYS_UID_MAX=39999', '--user-group',
      '--no-create-home', '--home-dir', path.join(t, 'home'), '--shell', '/usr/sbin/nologin', task.user);
  }
  const uid = Number(run('id', '-u', task.user));
  const gid = Number(run('id', '-g', task.user));
  fs.mkdirSync(t, { recursive: true, mode: 0o711 });
  for (const d of ['upper', 'work', 'root', 'home']) fs.mkdirSync(path.join(t, d), { recursive: true, mode: 0o700 });
  // The overlay's top directory takes the upper dir's owner, so only this task's user can enter its copy.
  fs.chownSync(dirs.upper(task.id), uid, gid);
  fs.chownSync(path.join(t, 'home'), uid, gid);
  // A linked (real-folder) workspace: the owner's files keep their own permissions, so overlay would refuse
  // the agent write access to copy them up. Give the task a writable copy of the folder as its lower instead.
  // It is also a clean snapshot, so the owner editing the folder mid-task can't disturb the agent.
  let base = dirs.workspace(task.workspace);
  if (isLinked(task.workspace)) {
    base = path.join(t, 'base');
    fs.rmSync(base, { recursive: true, force: true });
    fs.cpSync(dirs.workspace(task.workspace), base, { recursive: true }); // shortcut: whole-folder copy; fine for a document folder, chunk it for huge trees
    run('chmod', '-R', 'a+rwX', base);
  }
  mountOverlay(dirs.root(task.id), [...task.layers.map(dirs.upper), base], dirs.upper(task.id));
  return { uid, gid };
}

const WORKERS = new URL('./workers/', import.meta.url).pathname;

// What a task's worker may not do, on top of being its own user: see other processes, share /tmp, write
// outside its copy and home, use devices, gain privileges, reach D-Bus, or use more than its share.
const HARDENING = [
  'NoNewPrivileges=yes',
  'ProtectProc=invisible',
  'PrivateTmp=yes',
  'ProtectSystem=strict',
  'ProtectHome=yes',
  'PrivateDevices=yes',
  'CapabilityBoundingSet=',
  'RestrictSUIDSGID=yes',
  'InaccessiblePaths=-/run/dbus',
  'RestrictAddressFamilies=AF_UNIX AF_INET AF_INET6 AF_NETLINK',
  'MemoryMax=2G',
  'TasksMax=512',
];

/** Start the task's worker as a hardened systemd unit, as the task's user, inside its copy. No secrets in its environment. */
export function spawnWorker(task: Task, ids: { uid: number; gid: number }, extraEnv: Record<string, string> = {}): ChildProcess {
  const unit = `box-task-${task.id}`;
  const home = path.join(dirs.task(task.id), 'home');
  const log = path.join(dirs.task(task.id), 'worker.log');
  const env = { HOME: home, PATH: '/usr/local/bin:/usr/bin:/bin', LANG: 'C.UTF-8', BOX_TASK: task.id, BOX_SOCKET: dirs.socket(task.id), ...extraEnv };
  tryRun('systemctl', 'stop', unit); // left running by a box that died without the machine going down
  tryRun('systemctl', 'reset-failed', unit);
  const props = [...HARDENING, `ReadWritePaths=${dirs.root(task.id)} ${home}`, `StandardOutput=append:${log}`, `StandardError=append:${log}`];
  return spawn(
    'systemd-run',
    [
      '--wait',
      '--quiet',
      '--collect',
      `--unit=${unit}`,
      `--uid=${ids.uid}`,
      `--gid=${ids.gid}`,
      `--working-directory=${dirs.root(task.id)}`,
      ...Object.entries(env).map(([k, v]) => `--setenv=${k}=${v}`),
      ...props.flatMap((p) => ['-p', p]),
      process.execPath,
      '--experimental-strip-types',
      '--disable-warning=ExperimentalWarning',
      path.join(WORKERS, `${task.worker}.ts`),
    ],
    { stdio: 'ignore' },
  );
}

export type Change = { path: string; change: 'added' | 'modified' | 'deleted' };

/** The files a task changed, from its own layer only. Cost: the number of changes, not the workspace size. */
export function changes(task: Task): Change[] {
  const upper = dirs.upper(task.id);
  const lowers = [...task.layers.map(dirs.upper), dirs.workspace(task.workspace)];
  const below = (rel: string) => lowers.map((l) => path.join(l, rel)).find((f) => fs.existsSync(f));
  const out: Change[] = [];
  const walk = (rel: string) => {
    for (const name of fs.readdirSync(path.join(upper, rel)).sort()) {
      const r = path.join(rel, name);
      const st = fs.lstatSync(path.join(upper, r));
      if (st.isCharacterDevice() && st.rdev === 0) out.push({ path: r, change: 'deleted' }); // overlayfs whiteout
      else if (st.isDirectory()) walk(r);
      else out.push({ path: r, change: below(r) ? 'modified' : 'added' });
    }
  };
  if (fs.existsSync(upper)) walk('');
  return out;
}

/** What a task changed, from its own layer only, and a unified diff of it. */
export function diff(task: Task, maxBytes = 200_000): { changes: Change[]; diff: string } {
  const upper = dirs.upper(task.id);
  const lowers = [...task.layers.map(dirs.upper), dirs.workspace(task.workspace)];
  const below = (rel: string) => lowers.map((l) => path.join(l, rel)).find((f) => fs.existsSync(f));
  const changes = changesOf(task);
  let text = '';
  for (const c of changes) {
    if (text.length > maxBytes) break;
    const before = c.change === 'added' ? '/dev/null' : below(c.path)!;
    const after = c.change === 'deleted' ? '/dev/null' : path.join(upper, c.path);
    const r = spawnSync('diff', ['-u', '--label', `a/${c.path}`, '--label', `b/${c.path}`, before, after], { encoding: 'utf8' });
    text += r.stdout;
  }
  return { changes, diff: text.slice(0, maxBytes) };
}
const changesOf = changes;

const sha = (file: string) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');

/** Record a hash of every file in a linked workspace's real folder when a task starts, to catch later
 *  owner edits at Keep time. Only for linked (real-folder) workspaces. */
export function snapshotBase(task: Task) {
  if (!isLinked(task.workspace)) return;
  const base = dirs.workspace(task.workspace);
  const manifest: Record<string, string> = {};
  const walk = (rel: string) => {
    for (const name of fs.readdirSync(path.join(base, rel))) {
      const r = rel ? path.join(rel, name) : name;
      const st = fs.lstatSync(path.join(base, r));
      if (st.isDirectory()) walk(r);
      else if (st.isFile()) manifest[r] = sha(path.join(base, r));
    }
  };
  if (fs.existsSync(base)) walk('');
  fs.writeFileSync(path.join(dirs.task(task.id), 'manifest.json'), JSON.stringify(manifest));
}

/**
 * Apply a done task's changes to its linked real folder, atomically per file and all-or-nothing on conflict.
 * If the owner changed any of the same files since the task started, nothing is applied and the clash is
 * reported. Before-images are kept under BOX_HOME/timemachine/<task> so the desktop can undo the Keep later.
 */
export function keep(task: Task): { kept?: Change[]; conflicts?: string[] } {
  if (!isLinked(task.workspace)) throw new Error(`workspace ${task.workspace} is not a real folder; nothing to keep`);
  const base = dirs.workspace(task.workspace);
  const upper = dirs.upper(task.id);
  const manifestPath = path.join(dirs.task(task.id), 'manifest.json');
  const manifest: Record<string, string> = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : {};
  const cs = changesOf(task);

  // Conflict: the owner touched a file this task also touched, since the task started.
  const conflicts: string[] = [];
  for (const c of cs) {
    const real = path.join(base, c.path);
    const now = fs.existsSync(real) && fs.statSync(real).isFile() ? sha(real) : undefined;
    if (c.change === 'added' && now !== undefined) conflicts.push(c.path); // the owner created it too
    if ((c.change === 'modified' || c.change === 'deleted') && now !== manifest[c.path]) conflicts.push(c.path);
  }
  if (conflicts.length) return { conflicts };

  const saveDir = path.join(HOME, 'timemachine', task.id);
  fs.mkdirSync(saveDir, { recursive: true });
  for (const c of cs) {
    const real = path.join(base, c.path);
    if (fs.existsSync(real)) {
      // keep a before-image so Time Machine can undo this Keep
      fs.mkdirSync(path.dirname(path.join(saveDir, c.path)), { recursive: true });
      fs.copyFileSync(real, path.join(saveDir, c.path));
    }
    if (c.change === 'deleted') {
      fs.rmSync(real, { force: true });
    } else {
      fs.mkdirSync(path.dirname(real), { recursive: true });
      const tmp = `${real}.box-${process.pid}`;
      fs.copyFileSync(path.join(upper, c.path), tmp);
      fs.renameSync(tmp, real); // atomic per file
    }
  }
  fs.writeFileSync(path.join(saveDir, 'kept.json'), JSON.stringify({ at: new Date().toISOString(), changes: cs }));
  return { kept: cs };
}

/** Put the task's file changes on disk, so a step the log calls done survives a power cut. */
export const flush = (task: Task) => tryRun('sync', '-f', dirs.upper(task.id));

/** Stop everything the task's user runs. */
export const kill = (task: Task) => tryRun('pkill', '-KILL', '-u', task.user);

/** After a task ends: unmount its copy, open its layer to later tasks' users, remove its user. */
export function seal(task: Task) {
  kill(task);
  unmount(dirs.root(task.id));
  // Later tasks run as other users and must be able to change files this task made, through their own
  // copies. The layer's own folder becomes root-only, so no task can reach the layer directly.
  tryRun('chmod', '-R', 'a+rwX', dirs.upper(task.id));
  tryRun('chown', 'root:root', dirs.upper(task.id));
  tryRun('chmod', '0700', dirs.upper(task.id));
  try {
    runLocked('userdel', task.user);
  } catch {} // already gone
}

/** Rebuild a workspace's read-only view from its done layers, newest first. */
export function refreshView(workspace: string, layers: string[]) {
  const v = dirs.view(workspace);
  fs.mkdirSync(v, { recursive: true });
  unmount(v);
  // A lower-only overlay needs two layers; the empty dir keeps that true with no tasks done.
  mountOverlay(v, [...layers.map(dirs.upper), path.join(HOME, 'empty'), dirs.workspace(workspace)]);
}

/** Unmount everything under BOX_HOME. The demo uses it to act out a power cut. */
export function unmountAll() {
  const mine = fs
    .readFileSync('/proc/self/mountinfo', 'utf8')
    .split('\n')
    .map((l) => l.split(' ')[4])
    .filter((m) => m?.startsWith(HOME + '/'));
  for (const m of mine) unmount(m);
}
