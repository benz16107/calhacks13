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
import fs from 'node:fs';
import path from 'node:path';
import type { Task } from './contract.ts';

export const HOME = process.env.BOX_HOME ?? '/var/lib/box';
export const dirs = {
  workspace: (ws: string) => path.join(HOME, 'workspaces', ws),
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

export function init() {
  for (const d of ['workspaces', 'views', 'tasks']) fs.mkdirSync(path.join(HOME, d), { recursive: true, mode: 0o700 });
  // Task users may pass through HOME and tasks/ to reach their own folder, and read nothing else.
  fs.chmodSync(HOME, 0o711);
  fs.chmodSync(path.join(HOME, 'tasks'), 0o711);
  fs.mkdirSync(path.join(HOME, 'empty'), { recursive: true });
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
    run('useradd', '--system', '-K', 'SYS_UID_MIN=30000', '-K', 'SYS_UID_MAX=39999', '--user-group',
      '--no-create-home', '--home-dir', path.join(t, 'home'), '--shell', '/usr/sbin/nologin', task.user);
  }
  const uid = Number(run('id', '-u', task.user));
  const gid = Number(run('id', '-g', task.user));
  fs.mkdirSync(t, { recursive: true, mode: 0o711 });
  for (const d of ['upper', 'work', 'root', 'home']) fs.mkdirSync(path.join(t, d), { recursive: true, mode: 0o700 });
  // The overlay's top directory takes the upper dir's owner, so only this task's user can enter its copy.
  fs.chownSync(dirs.upper(task.id), uid, gid);
  fs.chownSync(path.join(t, 'home'), uid, gid);
  mountOverlay(dirs.root(task.id), [...task.layers.map(dirs.upper), dirs.workspace(task.workspace)], dirs.upper(task.id));
  return { uid, gid };
}

const WORKERS = new URL('./workers/', import.meta.url).pathname;

/** Start the task's worker as the task's user, inside its copy. No secrets in its environment. */
export function spawnWorker(task: Task, ids: { uid: number; gid: number }, extraEnv: Record<string, string> = {}): ChildProcess {
  const out = fs.openSync(path.join(dirs.task(task.id), 'worker.log'), 'a', 0o600);
  const child = spawn(
    process.execPath,
    ['--experimental-strip-types', '--disable-warning=ExperimentalWarning', path.join(WORKERS, `${task.worker}.ts`)],
    {
      cwd: dirs.root(task.id),
      ...ids,
      stdio: ['ignore', out, out],
      env: {
        HOME: path.join(dirs.task(task.id), 'home'),
        PATH: '/usr/local/bin:/usr/bin:/bin',
        LANG: 'C.UTF-8',
        BOX_TASK: task.id,
        BOX_SOCKET: dirs.socket(task.id),
        ...extraEnv,
      },
    },
  );
  fs.closeSync(out);
  return child;
}

export type Change = { path: string; change: 'added' | 'modified' | 'deleted' };

/** What a task changed, from its own layer only, and a unified diff of it. Cost: the number of changes. */
export function diff(task: Task, maxBytes = 200_000): { changes: Change[]; diff: string } {
  const upper = dirs.upper(task.id);
  const lowers = [...task.layers.map(dirs.upper), dirs.workspace(task.workspace)];
  const below = (rel: string) => lowers.map((l) => path.join(l, rel)).find((f) => fs.existsSync(f));
  const changes: Change[] = [];
  const walk = (rel: string) => {
    for (const name of fs.readdirSync(path.join(upper, rel)).sort()) {
      const r = path.join(rel, name);
      const st = fs.lstatSync(path.join(upper, r));
      if (st.isCharacterDevice() && st.rdev === 0) changes.push({ path: r, change: 'deleted' }); // overlayfs whiteout
      else if (st.isDirectory()) walk(r);
      else changes.push({ path: r, change: below(r) ? 'modified' : 'added' });
    }
  };
  if (fs.existsSync(upper)) walk('');
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
  tryRun('userdel', task.user);
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
