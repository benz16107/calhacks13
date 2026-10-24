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
import { execFile, execFileSync, spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { Task } from './contract.ts';

export const HOME = process.env.BOX_HOME ?? '/var/lib/box';

// A workspace's base is BOX_HOME/workspaces/<ws>, unless it is linked to a real folder (Personal edition):
// then the base is that folder, so Keep writes the task's changes straight into the owner's files.
const bases = new Map<string, string>();
// A workspace over several real folders: its top-level folders are named by a label for each real folder.
const multis = new Map<string, Record<string, string>>();
export const linkBase = (ws: string, realPath: string) => bases.set(ws, realPath);
export const linkMulti = (ws: string, folders: Record<string, string>) => multis.set(ws, folders);
export const isLinked = (ws: string) => bases.has(ws) || multis.has(ws);
/** For a workspace over several folders: the label of each and the real folder behind it. */
export const multiRoots = (ws: string) => multis.get(ws);

/** The real folders behind a linked workspace, as [label, path]. A single folder has the empty label. */
const rootsOf = (ws: string): [string, string][] => (multis.has(ws) ? Object.entries(multis.get(ws)!) : [['', bases.get(ws)!]]);

/** The real file a change path (relative to the task's workspace) belongs to. */
function realOf(ws: string, rel: string): string {
  const folders = multis.get(ws);
  if (!folders) return path.join(dirs.workspace(ws), rel);
  const [label, ...rest] = rel.split('/');
  if (!(label in folders)) throw new Error(`${rel} is not inside any of this task's folders`);
  return path.join(folders[label], ...rest);
}

/** The clean copy a linked task works on, taken when it started. */
const taskBase = (id: string) => path.join(HOME, 'tasks', id, 'base');

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
/**
 * Fast folders: the task's base is the owner's real folder, mounted again with the owner's user and group mapped to
 * the task's, instead of a copy. Writes still go to the task's own layer; the real folder only changes on Keep.
 * Returns why it can't be used for this task, or '' after mounting.
 */
function mountFast(task: Task, base: string, uid: number, gid: number): string {
  const roots = rootsOf(task.workspace);
  if (roots.length !== 1 || roots[0][0]) return 'a task on several folders uses a copy';
  const real = roots[0][1];
  const owner = fs.statSync(real);
  // Every file must be the owner's: anyone else's would be unreadable to the task through the mapping.
  const walk = (dir: string): string => {
    for (const name of fs.readdirSync(dir)) {
      const f = path.join(dir, name);
      const st = fs.lstatSync(f);
      if (st.uid !== owner.uid || st.gid !== owner.gid) return `${path.relative(real, f)} belongs to another user`;
      if (st.isDirectory()) {
        const why = walk(f);
        if (why) return why;
      }
    }
    return '';
  };
  const why = walk(real);
  if (why) return why;
  fs.mkdirSync(base, { recursive: true });
  try {
    if (!mounted(base)) run('mount', '--bind', '-o', `X-mount.idmap=u:${owner.uid}:${uid}:1 g:${owner.gid}:${gid}:1`, real, base);
  } catch (e) {
    return `this kernel can't map a folder (${(e as Error).message.split('\n')[0]})`;
  }
  return '';
}

const isFast = (id: string) => fs.existsSync(path.join(HOME, 'tasks', id, 'fast'));

export async function prepare(task: Task, opts: { fast?: boolean } = {}): Promise<{ uid: number; gid: number; fast?: boolean; why?: string }> {
  const t = dirs.task(task.id);
  if (!tryRun('id', '-u', task.user)) {
    // Task users live in uids 30000-39999 so one firewall rule can cover all of them.
    runLocked('useradd', '--system', '-K', 'SYS_UID_MIN=30000', '-K', 'SYS_UID_MAX=39999', '--user-group',
      '--no-create-home', '--home-dir', path.join(t, 'home'), '--shell', '/usr/sbin/nologin', task.user);
  }
  const uid = Number(run('id', '-u', task.user));
  const gid = Number(run('id', '-g', task.user));
  fs.mkdirSync(t, { recursive: true, mode: 0o710 });
  // Only this task's own group can walk into its folder: another task that learns this id gets EACCES, not a
  // listing. (tasks/ itself lets everyone pass through but not list.)
  fs.chownSync(t, 0, gid);
  fs.chmodSync(t, 0o710);
  for (const d of ['upper', 'work', 'root', 'home']) fs.mkdirSync(path.join(t, d), { recursive: true, mode: 0o700 });
  // The overlay's top directory takes the upper dir's owner, so only this task's user can enter its copy.
  fs.chownSync(dirs.upper(task.id), uid, gid);
  fs.chownSync(path.join(t, 'home'), uid, gid);
  // A linked (real-folder) workspace: the owner's files keep their own permissions, so overlay would refuse
  // the agent write access to copy them up. Give the task a writable copy of the folder as its lower instead.
  // It is also a clean snapshot, so the owner editing the folder mid-task can't disturb the agent.
  let base = dirs.workspace(task.workspace);
  let fast: boolean | undefined, why: string | undefined;
  if (isLinked(task.workspace)) {
    base = path.join(t, 'base');
    // Fast folders, for a new task with the setting on, or a resumed fast task (its mount is gone after a restart).
    if (isFast(task.id) || (opts.fast && !fs.existsSync(path.join(t, 'base.done')))) {
      why = mountFast(task, base, uid, gid);
      fast = !why;
      if (fast) fs.writeFileSync(path.join(t, 'fast'), '');
    }
    // A task resumed after a restart keeps the copy it started with: faster, and its snapshot stays its snapshot.
    if (!fast && !fs.existsSync(path.join(t, 'base.done'))) {
      fs.rmSync(base, { recursive: true, force: true });
      fs.mkdirSync(base, { recursive: true });
      // cp shares the data blocks where the filesystem can (btrfs, XFS), and runs without blocking the box.
      // shortcut: a full copy on ext4; an idmapped lower would need none (docs/perf/filesystem.md)
      for (const [label, real] of rootsOf(task.workspace)) {
        const dest = label ? path.join(base, label) : base;
        fs.mkdirSync(dest, { recursive: true });
        await exec('cp', ['-a', '--reflink=auto', `${real}/.`, dest]);
      }
      // The copy belongs to this task's user alone and is closed to everyone else, with the owner's files keeping
      // their own modes (a 0600 file stays 0600). The user can still change every file in it: overlayfs checks the
      // caller against the file's own owner and mode, so the owner bits are made writable, no one else's.
      await exec('chown', ['-R', `${uid}:${gid}`, base]);
      await exec('chmod', ['-R', 'u+rwX,go-rwx', base]);
      fs.writeFileSync(path.join(t, 'base.done'), '');
    }
  }
  mountOverlay(dirs.root(task.id), [...task.layers.map(dirs.upper), base], dirs.upper(task.id));
  return { uid, gid, ...(fast !== undefined ? { fast, ...(why ? { why } : {}) } : {}) };
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
  'MemorySwapMax=0', // a hard 2 GB everywhere: with swap allowed, a memory hog thrashes instead of being stopped
  'TasksMax=512',
  'CPUQuota=200%', // at most two cores, so one task can't starve the box or the others
  // System calls a task never needs (mounts, kernel modules, ptrace and perf, raw I/O, reboot, swap, clock, keyrings,
  // bpf) fail with EPERM; only the machine's own architecture is allowed.
  'SystemCallArchitectures=native',
  'SystemCallFilter=~@mount @module @debug @raw-io @reboot @swap @obsolete @cpu-emulation @clock keyctl add_key request_key bpf userfaultfd',
  'SystemCallErrorNumber=EPERM',
  'ProtectKernelModules=yes',
  'ProtectKernelTunables=yes',
  'ProtectKernelLogs=yes',
  'ProtectControlGroups=yes',
  'ProtectClock=yes',
  'ProtectHostname=yes',
  'LockPersonality=yes',
  'RestrictRealtime=yes',
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
  const lowers = [...task.layers.map(dirs.upper), isLinked(task.workspace) && fs.existsSync(taskBase(task.id)) ? taskBase(task.id) : dirs.workspace(task.workspace)];
  const below = (rel: string) => lowers.map((l) => path.join(l, rel)).find((f) => fs.existsSync(f)) ?? fastBelow(task, rel);
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
  const lowers = [...task.layers.map(dirs.upper), isLinked(task.workspace) && fs.existsSync(taskBase(task.id)) ? taskBase(task.id) : dirs.workspace(task.workspace)];
  const below = (rel: string) => lowers.map((l) => path.join(l, rel)).find((f) => fs.existsSync(f)) ?? fastBelow(task, rel);
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
// A fast task's base is a mount of the real folder; once it is unmounted, what it started from is the real folder.
function fastBelow(task: Task, rel: string) {
  if (!isFast(task.id) || !isLinked(task.workspace)) return undefined;
  const real = realOf(task.workspace, rel);
  return fs.existsSync(real) ? real : undefined;
}

const sha = (file: string) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const exec = promisify(execFile);
// A file's size and modification time: enough to tell an owner's edit, without reading the file.
const stamp = (file: string) => {
  const st = fs.statSync(file);
  return `${st.size}:${st.mtimeMs}`;
};
// Records from before stamps hold a SHA-256 and are still checked that way.
const unchanged = (file: string, rec: string | undefined) => rec !== undefined && (/^[0-9a-f]{64}$/.test(rec) ? sha(file) === rec : stamp(file) === rec);
// A second name for the same file where it can (instant, and the old content stays with it when the real path is
// replaced by a rename); a copy, sharing blocks where the filesystem can, across filesystems.
const place = (src: string, dst: string) => {
  try {
    fs.linkSync(src, dst);
  } catch {
    fs.copyFileSync(src, dst, fs.constants.COPYFILE_FICLONE);
  }
};

/** Record the size and modification time of every real file the task started with, to catch owner edits at Keep
 *  time. Only for linked (real-folder) workspaces. */
export function snapshotBase(task: Task) {
  if (!isLinked(task.workspace)) return;
  const base = taskBase(task.id);
  const manifest: Record<string, string> = {};
  const walk = (rel: string) => {
    for (const name of fs.readdirSync(path.join(base, rel))) {
      const r = rel ? path.join(rel, name) : name;
      const st = fs.lstatSync(path.join(base, r));
      if (st.isDirectory()) walk(r);
      else if (st.isFile()) {
        const real = realOf(task.workspace, r);
        if (fs.existsSync(real)) manifest[r] = stamp(real);
      }
    }
  };
  if (fs.existsSync(base)) walk('');
  fs.writeFileSync(path.join(dirs.task(task.id), 'manifest.json'), JSON.stringify(manifest));
}

/** Create `dir` and any missing parents, each owned by (and moded like) its nearest existing ancestor. */
function mkdirOwned(dir: string) {
  if (fs.existsSync(dir)) return;
  mkdirOwned(path.dirname(dir));
  const parent = fs.statSync(path.dirname(dir));
  fs.mkdirSync(dir, { mode: parent.mode & 0o7777 });
  fs.chownSync(dir, parent.uid, parent.gid);
  fs.chmodSync(dir, parent.mode & 0o7777); // mkdir's mode is cut by the umask
}

export interface KeepMeta {
  path: string;
  change: Change['change'];
  /** The real file before Keep: its owner and mode, to put back on undo. Absent for a new file. */
  before?: { mode: number; uid: number; gid: number };
  /** Hash of the kept content, so undo can tell if the owner has edited it since. */
  after?: string;
}

/**
 * Apply a done task's changes to its linked real folder, atomically per file and all-or-nothing on conflict.
 * If the owner changed any of the same files since the task started, nothing is applied and the clash is
 * reported. A kept file keeps the real file's owner, group and mode; a new file takes the owner of the folder
 * it lands in with mode 0644 (0755 if it was executable). The task's uid and its a+rwX layer permissions
 * never reach the owner's files. Before-images and metadata go under BOX_HOME/timemachine/<task> so Keep
 * can be undone later.
 */
export function keep(task: Task): { kept?: Change[]; conflicts?: string[] } {
  if (!isLinked(task.workspace)) throw new Error(`workspace ${task.workspace} is not a real folder; nothing to keep`);
  const upper = dirs.upper(task.id);
  const manifestPath = path.join(dirs.task(task.id), 'manifest.json');
  const manifest: Record<string, string> = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : {};
  const cs = changesOf(task);

  // Conflict: the owner touched a file this task also touched, since the task started.
  const conflicts: string[] = [];
  for (const c of cs) {
    const real = realOf(task.workspace, c.path);
    const isFile = fs.existsSync(real) && fs.statSync(real).isFile();
    if (c.change === 'added' && isFile) conflicts.push(c.path); // the owner created it too
    if ((c.change === 'modified' || c.change === 'deleted') && !(isFile ? unchanged(real, manifest[c.path]) : manifest[c.path] === undefined)) conflicts.push(c.path);
  }
  if (conflicts.length) return { conflicts };

  const saveDir = path.join(HOME, 'timemachine', task.id);
  fs.mkdirSync(path.join(HOME, 'timemachine'), { recursive: true, mode: 0o700 }); // copies of the owner's old files: root only
  fs.mkdirSync(saveDir, { recursive: true, mode: 0o700 });
  const meta: KeepMeta[] = [];
  for (const c of cs) {
    const real = realOf(task.workspace, c.path);
    const m: KeepMeta = { path: c.path, change: c.change };
    if (fs.existsSync(real)) {
      const st = fs.statSync(real);
      m.before = { mode: st.mode & 0o7777, uid: st.uid, gid: st.gid };
      // a before-image so Time Machine can undo this Keep
      fs.mkdirSync(path.dirname(path.join(saveDir, c.path)), { recursive: true });
      place(real, path.join(saveDir, c.path)); // the real path is replaced by a rename below, so this keeps the old content
    }
    if (c.change === 'deleted') {
      fs.rmSync(real, { force: true });
    } else {
      mkdirOwned(path.dirname(real));
      const src = path.join(upper, c.path);
      const srcMode = fs.statSync(src).mode;
      const dirStat = fs.statSync(path.dirname(real));
      const mode = m.before?.mode ?? (srcMode & 0o111 ? 0o755 : 0o644);
      const owner = m.before ?? { uid: dirStat.uid, gid: dirStat.gid };
      const tmp = `${real}.box-${process.pid}`;
      fs.copyFileSync(src, tmp, fs.constants.COPYFILE_FICLONE);
      fs.chownSync(tmp, owner.uid, owner.gid);
      fs.chmodSync(tmp, mode);
      fs.renameSync(tmp, real); // atomic per file
      m.after = stamp(real);
    }
    meta.push(m);
  }
  fs.writeFileSync(path.join(saveDir, 'kept.json'), JSON.stringify({ at: new Date().toISOString(), changes: meta }));
  return { kept: cs };
}

/**
 * Undo a Keep from its before-images: put each file back with its old content, owner and mode, and remove
 * the files Keep added. If the owner has edited a kept file since, nothing is changed and the clash is reported.
 */
export function unkeep(task: Task): { reverted?: Change[]; conflicts?: string[] } {
  const saveDir = path.join(HOME, 'timemachine', task.id);
  const file = path.join(saveDir, 'kept.json');
  if (!fs.existsSync(file) || fs.existsSync(path.join(saveDir, 'reverted.json'))) throw new Error(`task ${task.id} has no Keep to undo`);
  const { changes } = JSON.parse(fs.readFileSync(file, 'utf8')) as { changes: KeepMeta[] };
  const conflicts = changes
    .filter((m) => m.after !== undefined)
    .filter((m) => {
      const real = realOf(task.workspace, m.path);
      return !fs.existsSync(real) || !unchanged(real, m.after);
    })
    .map((m) => m.path);
  if (conflicts.length) return { conflicts };
  for (const m of changes) {
    const real = realOf(task.workspace, m.path);
    if (m.before) {
      mkdirOwned(path.dirname(real));
      const tmp = `${real}.box-${process.pid}`;
      place(path.join(saveDir, m.path), tmp);
      fs.chownSync(tmp, m.before.uid, m.before.gid);
      fs.chmodSync(tmp, m.before.mode);
      fs.renameSync(tmp, real);
    } else {
      fs.rmSync(real, { force: true }); // Keep added it
    }
  }
  fs.writeFileSync(path.join(saveDir, 'reverted.json'), JSON.stringify({ at: new Date().toISOString() }));
  return { reverted: changes.map(({ path: p, change }) => ({ path: p, change })) };
}

/** The worker's own last error message, from the end of its log, for the failed task's error. */
export function workerError(task: Task): string | undefined {
  try {
    const log = path.join(dirs.task(task.id), 'worker.log');
    const tail = fs.readFileSync(log, 'utf8').slice(-4000).split('\n').map((l) => l.trim()).filter(Boolean);
    const noise = (l: string) => /^at |^Node\.js v|^\^+$|^\{$|^\}$|^file:\/\/\//.test(l);
    const err = [...tail].reverse().find((l) => /error|failed|denied|cannot|not found|refused/i.test(l) && !noise(l)) ?? [...tail].reverse().find((l) => !noise(l));
    return err?.slice(0, 300);
  } catch {
    return undefined;
  }
}

/** Put the task's file changes on disk, so a step the log calls done survives a power cut. */
export const flush = (task: Task) => tryRun('sync', '-f', dirs.upper(task.id));

/** Stop everything the task's user runs. */
export const kill = (task: Task) => tryRun('pkill', '-KILL', '-u', task.user);

/**
 * The kill switch for one task: stop every process of it at once, or let them carry on. The unit's cgroup freezer
 * stops them all in one step; where it is missing, SIGSTOP and SIGCONT to the task's user do the same.
 */
export function freeze(task: Task, on: boolean): 'frozen' | 'stopped' | 'running' {
  if (tryRun('systemctl', on ? 'freeze' : 'thaw', `box-task-${task.id}`) !== undefined) return on ? 'frozen' : 'running';
  tryRun('pkill', on ? '-STOP' : '-CONT', '-u', task.user);
  return on ? 'stopped' : 'running';
}

/** After a task ends: unmount its copy, open its layer to later tasks' users, remove its user. */
export function seal(task: Task) {
  // A task that failed while being set up may have no user and no layer yet; skip what is not there.
  if (tryRun('id', '-u', task.user)) kill(task);
  unmount(dirs.root(task.id));
  if (fs.existsSync(dirs.upper(task.id))) {
    // Later tasks run as other users and must be able to change files this task made, through their own
    // copies. The layer's own folder becomes root-only, so no task can reach the layer directly.
    tryRun('chmod', '-R', 'a+rwX', dirs.upper(task.id));
    tryRun('chown', 'root:root', dirs.upper(task.id));
    tryRun('chmod', '0700', dirs.upper(task.id));
  }
  // User and group ids are handed out again, so once the task ends nothing of it may stay readable by "its" id.
  // The snapshot of a folder lingers until the owner decides (days, on Personal); it is root's alone from now on.
  const base = path.join(dirs.task(task.id), 'base');
  if (isFast(task.id)) unmount(base); // the owner's real folder: never walk it as the task's copy
  if (fs.existsSync(base) && !mounted(base)) tryRun('chown', '-R', 'root:root', base);
  if (fs.existsSync(dirs.task(task.id))) {
    tryRun('chown', 'root:root', dirs.task(task.id));
    tryRun('chmod', '0700', dirs.task(task.id));
  }
  if (tryRun('id', '-u', task.user)) {
    try {
      runLocked('userdel', task.user);
    } catch {} // already gone
  }
}

/** Delete an undone task's files: its layer, scratch space and copy. The caller makes sure nothing still reads them. */
export function purge(task: Task) {
  if (isFast(task.id)) unmount(path.join(dirs.task(task.id), 'base'));
  for (const d of ['upper', 'work', 'base', 'root']) {
    const dir = path.join(dirs.task(task.id), d);
    if (!fs.existsSync(dir)) continue;
    if (fs.readFileSync('/proc/self/mountinfo', 'utf8').includes(` ${dir} `)) continue; // still mounted: leave it
    tryRun('rm', '-rf', '--one-file-system', dir);
  }
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
