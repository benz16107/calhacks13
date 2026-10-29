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

/** True when a folder on the way to this change's real file is a link: Keep, which runs as root, would write wherever it points. */
function linkOnTheWay(ws: string, rel: string): boolean {
  const folders = multis.get(ws);
  const [root, inner] = folders ? [folders[rel.split('/')[0]], rel.split('/').slice(1)] : [dirs.workspace(ws), rel.split('/')];
  let p = root;
  for (const part of inner.slice(0, -1)) {
    const st = fs.lstatSync((p = path.join(p, part)), { throwIfNoEntry: false });
    if (!st) return false; // Keep makes the rest as real folders
    if (!st.isDirectory()) return true;
  }
  return false;
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

// stderr is kept with the error, not printed: an expected miss ('no such user' as a task ends) is no news in the journal.
const run = (cmd: string, ...args: string[]) => execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
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

/** The kernel's limit on an overlay's lower layers: a workspace's base plus 499 finished tasks. */
export const MAX_LOWERS = 500;

function mountOverlay(target: string, lowers: string[], upper?: string) {
  if (mounted(target)) return;
  // Mount options stop at one page (4 KB): about 110 full layer paths. So each layer gets a short name (a symlink in a
  // folder of its own), the mount runs from that folder, and the folder goes once the mount holds the layers. A short
  // name also keeps a ',' or ':' in a real folder's path out of the options.
  // shortcut: past MAX_LOWERS a workspace takes no new task; settling its oldest layers into one would lift that.
  const names = fs.mkdtempSync(path.join(HOME, '.lowers-'));
  try {
    lowers.forEach((l, i) => fs.symlinkSync(l, path.join(names, i.toString(36))));
    const opts = [`lowerdir=${lowers.map((_, i) => i.toString(36)).join(':')}`];
    if (upper) opts.push(`upperdir=${upper}`, `workdir=${path.join(path.dirname(upper), 'work')}`);
    execFileSync('mount', ['-t', 'overlay', 'overlay', '-o', opts.join(','), target], { cwd: names, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } finally {
    fs.rmSync(names, { recursive: true, force: true });
  }
}

const unmount = (dir: string) => mounted(dir) && tryRun('umount', '-l', dir);

/** Create the task's user, folders and copy of the workspace. Safe to call again after a reboot. */
export async function prepare(task: Task): Promise<{ uid: number; gid: number }> {
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
  if (isLinked(task.workspace)) {
    base = path.join(t, 'base');
    // A task resumed after a restart keeps the copy it started with: faster, and its snapshot stays its snapshot.
    if (!fs.existsSync(path.join(t, 'base.done'))) {
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
  return { uid, gid };
}

/**
 * Write a file the box makes for a task into the task's home (`rel`, like `.factory/settings.json`), as root, never
 * through a link the task left there: a task owns its home, and could point ~/.factory at the box's own state. A
 * folder on the way that is not a real folder is replaced; a real one keeps what the task put in it (Droid's
 * sessions). Call it only while none of the task's processes run, so nothing can swap a link in meanwhile.
 */
export function writeHomeFile(task: Task, ids: { uid: number; gid: number }, rel: string, text: string) {
  const parts = rel.split('/');
  let dir = path.join(dirs.task(task.id), 'home');
  for (const part of parts.slice(0, -1)) {
    dir = path.join(dir, part);
    const st = fs.lstatSync(dir, { throwIfNoEntry: false });
    if (st?.isDirectory()) continue;
    if (st) fs.rmSync(dir, { force: true }); // a link or a file where the folder goes: the task's own, so it goes (never its target)
    fs.mkdirSync(dir, { mode: 0o700 });
    fs.lchownSync(dir, ids.uid, ids.gid);
  }
  const file = path.join(dir, parts.at(-1)!);
  fs.rmSync(file, { recursive: true, force: true }); // whatever is there: a link itself goes, never what it points at
  const fd = fs.openSync(file, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW, 0o600);
  try {
    fs.writeSync(fd, text);
    fs.fchownSync(fd, ids.uid, ids.gid);
  } finally {
    fs.closeSync(fd);
  }
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

const isWhiteout = (st: fs.Stats) => st.isCharacterDevice() && st.rdev === 0;

/** What a folder held below the task's layer when it started: its files and subfolders, as the task saw them. */
function lowerTree(lowers: string[], rel: string): { files: string[]; dirs: string[] } {
  const seen = new Map<string, 'file' | 'dir' | 'hidden'>();
  for (const l of lowers) {
    const walk = (r: string) => {
      let names: string[];
      try {
        names = fs.readdirSync(path.join(l, r));
      } catch {
        return; // not in this layer
      }
      for (const n of names) {
        const p = path.join(r, n);
        if (seen.get(p) === 'hidden' || seen.get(p) === 'file') continue; // a higher layer removed or replaced it
        const st = fs.lstatSync(path.join(l, p));
        if (isWhiteout(st)) seen.set(p, seen.get(p) ?? 'hidden');
        else if (st.isDirectory()) (seen.set(p, 'dir'), walk(p));
        else if (!seen.has(p)) seen.set(p, 'file');
      }
    };
    walk(rel);
  }
  const of = (k: string) => [...seen].filter(([, v]) => v === k).map(([p]) => p);
  return { files: of('file'), dirs: of('dir') };
}

/** Which of these folders in a layer are opaque (removed and made again: nothing below shows through). */
function opaqueDirs(upper: string, rels: string[]): string[] {
  if (!rels.length) return [];
  // Node has no xattr call; python3 is on every GurtOS image and on Ubuntu.
  const py = 'import os,sys\nup=sys.argv[1]\nfor p in sys.stdin.read().split("\\0"):\n  try:\n    if p and os.getxattr(os.path.join(up,p),"trusted.overlay.opaque",follow_symlinks=False)==b"y": print(p)\n  except OSError: pass';
  const r = spawnSync('python3', ['-c', py, upper], { input: rels.join('\0'), encoding: 'utf8' });
  return r.status === 0 ? r.stdout.split('\n').filter(Boolean) : [];
}

/**
 * The files a task changed, from its own layer only. Cost: the number of changes, not the workspace size, except
 * for a folder the task removed: each file that was in it is listed as deleted too, after the folder itself.
 */
export function changes(task: Task): Change[] {
  const upper = dirs.upper(task.id);
  const lowers = [...task.layers.map(dirs.upper), isLinked(task.workspace) && fs.existsSync(taskBase(task.id)) ? taskBase(task.id) : dirs.workspace(task.workspace)];
  const below = (rel: string) => lowers.map((l) => path.join(l, rel)).find((f) => fs.existsSync(f));
  const out: Change[] = [];
  const both: string[] = []; // folders in the layer that were also there before: one of them may be opaque
  const walk = (rel: string) => {
    for (const name of fs.readdirSync(path.join(upper, rel)).sort()) {
      const r = path.join(rel, name);
      const st = fs.lstatSync(path.join(upper, r));
      if (isWhiteout(st)) {
        out.push({ path: r, change: 'deleted' });
        const was = below(r);
        if (was && fs.lstatSync(was).isDirectory()) {
          const t = lowerTree(lowers, r); // rm -rf of a folder: its files are gone too
          out.push(...[...t.dirs, ...t.files].map((p) => ({ path: p, change: 'deleted' as const })));
        }
      } else if (st.isDirectory()) {
        if (below(r)) both.push(r);
        walk(r);
      }
      // Files and links only: a pipe, socket or device a task made would hang or mislead the box that reads it.
      else if (st.isFile() || st.isSymbolicLink()) out.push({ path: r, change: below(r) ? 'modified' : 'added' });
    }
  };
  if (fs.existsSync(upper)) walk('');
  const listed = new Set(out.map((c) => c.path));
  for (const d of opaqueDirs(upper, both)) {
    // rm -rf then mkdir: what was in the folder before is gone, apart from what the task wrote there again.
    const t = lowerTree(lowers, d);
    for (const p of [...t.dirs, ...t.files]) if (!listed.has(p) && !fs.existsSync(path.join(upper, p))) (listed.add(p), out.push({ path: p, change: 'deleted' }));
  }
  return out.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0)); // a folder before what is in it
}

/** What a task changed, from its own layer only, and a unified diff of it. */
export function diff(task: Task, maxBytes = 200_000): { changes: Change[]; diff: string } {
  const upper = dirs.upper(task.id);
  const lowers = lowersOf(task);
  const below = (rel: string) => holder(lowers, rel);
  const changes = changesOf(task);
  let text = '';
  for (const c of changes) {
    if (text.length > maxBytes) break;
    const before = c.change === 'added' ? undefined : below(c.path);
    if (c.change === 'deleted' && before && fs.lstatSync(path.join(before, c.path)).isDirectory()) continue; // a removed folder: its files are listed one by one
    text += diffFiles(c.path, before ? { root: before, rel: c.path } : undefined, c.change === 'deleted' ? undefined : { root: upper, rel: c.path });
  }
  return { changes, diff: text.slice(0, maxBytes) };
}
const changesOf = changes;

/**
 * Open `root/rel` to read as root, only if it is a regular file that really is there: no link at the end or on the
 * way (a task can swap a folder in its layer for a link between the listing and the read), and never a pipe.
 */
export function openPlain(root: string, rel: string): number | undefined {
  let fd: number;
  try {
    fd = fs.openSync(path.join(root, rel), fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
  } catch {
    return undefined; // missing, or a link at the end
  }
  try {
    if (fs.fstatSync(fd).isFile() && fs.readlinkSync(`/proc/self/fd/${fd}`) === path.join(fs.realpathSync(root), rel)) return fd;
  } catch {}
  fs.closeSync(fd);
}

/** The top layer that holds `rel`, or undefined when none does or the top one deleted it (an overlayfs whiteout). */
function holder(layers: string[], rel: string): string | undefined {
  for (const l of layers) {
    const st = fs.lstatSync(path.join(l, rel), { throwIfNoEntry: false });
    if (st) return st.isCharacterDevice() && st.rdev === 0 ? undefined : l;
  }
}

/** What a side of a change is, when it is not a file to compare: a link and where it points. */
const describe = (f: string) => {
  const st = fs.lstatSync(f, { throwIfNoEntry: false });
  return st?.isSymbolicLink() ? `link to ${fs.readlinkSync(f)}` : st ? `(not shown: not a plain file here)` : undefined;
};

/** A unified diff of one change. Each side is read from a descriptor the box opened itself (openPlain), never by name. */
function diffFiles(p: string, a?: { root: string; rel: string }, b?: { root: string; rel: string }): string {
  const fa = a && openPlain(a.root, a.rel);
  const fb = b && openPlain(b.root, b.rel);
  try {
    if ((a && fa === undefined) || (b && fb === undefined)) {
      // A link (or something odd) on either side: say what each side is, in the diff's own form.
      const da = a && (fa === undefined ? describe(path.join(a.root, a.rel)) : '(a file)');
      const db = b && (fb === undefined ? describe(path.join(b.root, b.rel)) : '(a file)');
      return `--- a/${p}\n+++ b/${p}\n@@ -${da ? 1 : '0,0'} +${db ? 1 : '0,0'} @@\n${da ? `-${da}\n` : ''}${db ? `+${db}\n` : ''}`;
    }
    // The child reads the open files as /dev/fd/3 and /dev/fd/4, so no path is looked up again.
    const r = spawnSync('diff', ['-u', '--label', `a/${p}`, '--label', `b/${p}`, fa === undefined ? '/dev/null' : '/dev/fd/3', fb === undefined ? '/dev/null' : '/dev/fd/4'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore', fa ?? 'ignore', fb ?? 'ignore'],
    });
    return r.stdout ?? '';
  } finally {
    if (fa !== undefined) fs.closeSync(fa);
    if (fb !== undefined) fs.closeSync(fb);
  }
}

// ---------- the flight recorder: a task's own layer at each step, for replay ----------
type ReplayChange = Change & { big?: true };
type Replay = { points: { seq: number; changes: ReplayChange[] }[]; capped?: true; state: Record<string, string>; bytes: number };
const BIG = 1024 ** 2; // files over 1 MB are noted, not kept
const CAP = 50 * 1024 ** 2; // per task
const replayFile = (id: string) => path.join(dirs.task(id), 'replay.json');
const readReplay = (id: string): Replay => {
  try {
    return JSON.parse(fs.readFileSync(replayFile(id), 'utf8'));
  } catch {
    return { points: [], state: {}, bytes: 0 };
  }
};
const lowersOf = (task: Task) => [...task.layers.map(dirs.upper), isLinked(task.workspace) && fs.existsSync(taskBase(task.id)) ? taskBase(task.id) : dirs.workspace(task.workspace)];

/** After event `seq`, keep what changed in the task's layer since the last record (beside it, never in the log). */
export function recordReplay(task: Task, seq: number) {
  const upper = dirs.upper(task.id);
  if (!fs.existsSync(upper)) return;
  const r = readReplay(task.id);
  if (r.capped) return;
  const now: Record<string, string> = {};
  const walk = (rel: string) => {
    for (const name of fs.readdirSync(path.join(upper, rel))) {
      const p = path.join(rel, name);
      const st = fs.lstatSync(path.join(upper, p));
      if (st.isCharacterDevice() && st.rdev === 0) now[p] = 'deleted'; // overlayfs whiteout
      else if (st.isDirectory()) walk(p);
      else if (st.isFile()) now[p] = `${st.size}:${st.mtimeMs}`;
    }
  };
  walk('');
  const lowers = lowersOf(task);
  const below = (rel: string) => lowers.some((l) => fs.existsSync(path.join(l, rel)));
  const out: ReplayChange[] = [];
  for (const [p, stamp] of Object.entries(now)) {
    if (r.state[p] === stamp) continue;
    if (stamp === 'deleted') {
      out.push({ path: p, change: 'deleted' });
      continue;
    }
    const size = Number(stamp.split(':')[0]);
    const change = below(p) ? 'modified' : 'added';
    if (size > BIG) {
      out.push({ path: p, change, big: true });
      continue;
    }
    if (r.bytes + size > CAP) {
      r.capped = true;
      break;
    }
    const fd = openPlain(upper, p); // the task is running: the name may lead elsewhere by now
    if (fd === undefined) continue;
    const dst = path.join(dirs.task(task.id), 'replay', String(seq), p);
    try {
      fs.mkdirSync(path.dirname(dst), { recursive: true, mode: 0o700 });
      fs.writeFileSync(dst, fs.readFileSync(fd), { mode: 0o600 });
    } finally {
      fs.closeSync(fd);
    }
    r.bytes += size;
    out.push({ path: p, change });
  }
  for (const p of Object.keys(r.state)) if (!(p in now)) out.push({ path: p, change: 'deleted' }); // a file it made, then removed
  if (!out.length && !r.capped) return;
  if (out.length) r.points.push({ seq, changes: out });
  r.state = now;
  fs.writeFileSync(replayFile(task.id), JSON.stringify(r), { mode: 0o600 });
}

/** The recorded points: which event changed which files. */
export function replayPoints(task: Task) {
  const r = readReplay(task.id);
  return { points: r.points, ...(r.capped ? { capped: true } : {}) };
}

/** What the task's layer held right after event `seq`, as a diff against the files it started from. */
export function diffAt(task: Task, seq: number, maxBytes = 200_000): { changes: ReplayChange[]; diff: string } {
  const view = new Map<string, { change: Change['change']; file?: string; big?: true }>();
  for (const pt of readReplay(task.id).points) {
    if (pt.seq > seq) break;
    for (const c of pt.changes) view.set(c.path, c.change === 'deleted' ? { change: 'deleted' } : { change: c.change, ...(c.big ? { big: true } : { file: path.join(dirs.task(task.id), 'replay', String(pt.seq), c.path) }) });
  }
  const lowers = lowersOf(task);
  const below = (rel: string) => holder(lowers, rel);
  const changes: ReplayChange[] = [];
  let text = '';
  for (const [p, v] of [...view.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const before = below(p);
    if (v.change === 'deleted' && !before) continue; // made and removed within the task: nothing to show
    changes.push({ path: p, change: v.change === 'deleted' ? 'deleted' : before ? 'modified' : 'added', ...(v.big ? { big: true } : {}) });
    if (v.big || text.length > maxBytes) continue;
    text += diffFiles(p, before ? { root: before, rel: p } : undefined, v.file ? { root: v.file.slice(0, -p.length - 1), rel: p } : undefined);
  }
  return { changes, diff: text.slice(0, maxBytes) };
}

const sha = (file: string) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const exec = promisify(execFile);
// A file's size and modification time: enough to tell an owner's edit, without reading the file. A link is its own
// entry, not what it points at.
const stamp = (file: string) => {
  const st = fs.lstatSync(file);
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
    if (fs.lstatSync(src).isSymbolicLink()) fs.symlinkSync(fs.readlinkSync(src), dst); // the link, never what it points at
    else fs.copyFileSync(src, dst, fs.constants.COPYFILE_FICLONE);
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
  /** A folder the task removed: Keep removes it once its files are gone, and undo makes it again. */
  dir?: true;
  /** Hash of the kept content, so undo can tell if the owner has edited it since. */
  after?: string;
}

/** A file error in words, for a Keep that could not finish. */
const fileTrouble = (e: NodeJS.ErrnoException) =>
  ({ EACCES: 'permission denied', EPERM: 'permission denied', ENOSPC: 'the disk is full', EDQUOT: 'the disk is full', EROFS: 'the folder is read-only', ENOTDIR: 'a file is where a folder should be', EISDIR: 'a folder is where a file should be', ENOENT: 'it is no longer there' } as Record<string, string>)[e.code ?? ''] ?? e.message;

/** Put the owner's files back as they were before Keep, from the before-images in saveDir. */
function revert(ws: string, saveDir: string, changes: KeepMeta[]) {
  for (const m of changes) {
    const real = realOf(ws, m.path);
    if (m.dir) {
      if (!fs.existsSync(real)) {
        mkdirOwned(path.dirname(real));
        fs.mkdirSync(real);
        if (m.before) (fs.chownSync(real, m.before.uid, m.before.gid), fs.chmodSync(real, m.before.mode));
      }
    } else if (m.before) {
      mkdirOwned(path.dirname(real));
      const tmp = `${real}.box-${process.pid}`;
      place(path.join(saveDir, m.path), tmp);
      if (fs.lstatSync(tmp).isSymbolicLink()) fs.lchownSync(tmp, m.before.uid, m.before.gid); // the link itself, never what it points at
      else (fs.chownSync(tmp, m.before.uid, m.before.gid), fs.chmodSync(tmp, m.before.mode));
      fs.renameSync(tmp, real);
    } else {
      fs.rmSync(real, { force: true }); // Keep added it
    }
  }
}

/**
 * Apply a done task's changes to its linked real folder, atomically per file and all or nothing. If the owner
 * changed any of the same files since the task started, nothing is applied and the clash is reported; if a file
 * cannot be written, the ones already written are put back and it throws. A kept file keeps the real file's owner,
 * group and mode; a new file takes the owner of the folder it lands in with mode 0644 (0755 if it was
 * executable). The task's uid and its a+rwX layer permissions never reach the owner's files. A folder the task
 * removed goes once its files are gone, never with something the owner put in it since. Before-images and
 * metadata go under BOX_HOME/timemachine/<task> so Keep can be undone later.
 */
export function keep(task: Task): { kept?: Change[]; conflicts?: string[] } {
  if (!isLinked(task.workspace)) throw new Error('This task worked in a space of its own, not on one of your folders, so there is nothing to keep.');
  const upper = dirs.upper(task.id);
  const manifestPath = path.join(dirs.task(task.id), 'manifest.json');
  const manifest: Record<string, string> = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : {};
  const cs = changesOf(task);

  // Conflict: the owner touched a file this task also touched, since the task started.
  const conflicts: string[] = [];
  for (const c of cs) {
    const real = realOf(task.workspace, c.path);
    if (linkOnTheWay(task.workspace, c.path)) {
      conflicts.push(c.path); // the real folder has a link where the task made a folder: never write through it
      continue;
    }
    const isFile = fs.existsSync(real) && fs.statSync(real).isFile();
    if (c.change === 'added' && isFile) conflicts.push(c.path); // the owner created it too
    if ((c.change === 'modified' || c.change === 'deleted') && !(isFile ? unchanged(real, manifest[c.path]) : manifest[c.path] === undefined)) conflicts.push(c.path);
  }
  if (conflicts.length) return { conflicts };

  const saveDir = path.join(HOME, 'timemachine', task.id);
  fs.mkdirSync(path.join(HOME, 'timemachine'), { recursive: true, mode: 0o700 }); // copies of the owner's old files: root only
  fs.rmSync(saveDir, { recursive: true, force: true }); // left by a Keep that could not finish
  fs.mkdirSync(saveDir, { recursive: true, mode: 0o700 });
  const meta: KeepMeta[] = [];
  let at = '';
  try {
    for (const c of cs) {
      at = c.path;
      const real = realOf(task.workspace, c.path);
      const m: KeepMeta = { path: c.path, change: c.change };
      const lst = fs.lstatSync(real, { throwIfNoEntry: false }); // a link is never taken for the folder it points at
      if (lst?.isDirectory() && c.change === 'deleted') {
        meta.push({ ...m, dir: true, before: { mode: lst.mode & 0o7777, uid: lst.uid, gid: lst.gid } }); // removed below, once empty
        continue;
      }
      const st = fs.existsSync(real) ? fs.statSync(real) : undefined;
      if (st) {
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
        const srcStat = fs.lstatSync(src);
        const dirStat = fs.statSync(path.dirname(real));
        const mode = m.before?.mode ?? (srcStat.mode & 0o111 ? 0o755 : 0o644);
        const owner = m.before ?? { uid: dirStat.uid, gid: dirStat.gid };
        const tmp = `${real}.box-${process.pid}`;
        try {
          if (srcStat.isSymbolicLink()) {
            // A link the task made stays a link: copying what it points at would hand the owner's folder (and the next
            // task) a file the task could not read, read by root.
            fs.symlinkSync(fs.readlinkSync(src), tmp);
            fs.lchownSync(tmp, owner.uid, owner.gid);
          } else {
            fs.copyFileSync(src, tmp, fs.constants.COPYFILE_FICLONE);
            fs.chownSync(tmp, owner.uid, owner.gid);
            fs.chmodSync(tmp, mode);
          }
          fs.renameSync(tmp, real); // atomic per file
        } catch (e) {
          try {
            fs.rmSync(tmp, { force: true });
          } catch {} // never made
          throw e;
        }
        m.after = stamp(real);
      }
      meta.push(m);
    }
    // The folders the task removed, deepest first, once empty: a file the owner added to one since stays.
    for (const m of [...meta].reverse()) {
      if (!m.dir) continue;
      try {
        fs.rmdirSync(realOf(task.workspace, m.path));
      } catch (e) {
        if (!['ENOTEMPTY', 'EEXIST', 'ENOENT'].includes((e as NodeJS.ErrnoException).code ?? '')) throw e;
      }
    }
  } catch (e) {
    try {
      revert(task.workspace, saveDir, meta);
      fs.rmSync(saveDir, { recursive: true, force: true });
    } catch (again) {
      throw new Error(`${at} could not be written (${fileTrouble(e as NodeJS.ErrnoException)}), and putting your folder back failed too (${fileTrouble(again as NodeJS.ErrnoException)}). Check it before you run Keep again.`);
    }
    throw new Error(`${at} could not be written (${fileTrouble(e as NodeJS.ErrnoException)}), so nothing was kept. Your folder is as it was.`);
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
  if (!fs.existsSync(file) || fs.existsSync(path.join(saveDir, 'reverted.json'))) throw new Error(`"${task.title}" has no Keep to undo.`);
  const { changes } = JSON.parse(fs.readFileSync(file, 'utf8')) as { changes: KeepMeta[] };
  const conflicts = changes
    .filter((m) => m.after !== undefined || linkOnTheWay(task.workspace, m.path))
    .filter((m) => {
      const real = realOf(task.workspace, m.path);
      return linkOnTheWay(task.workspace, m.path) || !fs.lstatSync(real, { throwIfNoEntry: false }) || !unchanged(real, m.after);
    })
    .map((m) => m.path);
  if (conflicts.length) return { conflicts };
  revert(task.workspace, saveDir, changes);
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

/** How much the task's own layer holds, in bytes (du -sb: apparent size, so a sparse file counts in full). */
export async function layerBytes(task: Task): Promise<number> {
  try {
    const { stdout } = await exec('du', ['-sb', '--one-file-system', dirs.upper(task.id)]);
    return Number(stdout.split(/\s/)[0]) || 0;
  } catch {
    return 0;
  }
}

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
  if (fs.existsSync(base)) tryRun('chown', '-R', 'root:root', base);
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
  fs.rmSync(path.join(dirs.task(task.id), 'replay'), { recursive: true, force: true }); // the recording goes with the layer
  fs.rmSync(replayFile(task.id), { force: true });
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
  // A lower-only overlay needs two layers; the empty dir keeps that true with no tasks done.
  const lowers = [...layers.map(dirs.upper), ...(layers.length ? [] : [path.join(HOME, 'empty')]), dirs.workspace(workspace)];
  // Tasks started side by side can finish past the limit: keep the view it has rather than none.
  if (lowers.length > MAX_LOWERS) throw new Error(`${layers.length} finished tasks are more than one view can stack (${MAX_LOWERS - 1}); it stays as it was`);
  unmount(v);
  mountOverlay(v, lowers);
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
