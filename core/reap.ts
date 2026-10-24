// Tear down a demo box (its mounts, task users and files) synchronously, and reap stale ones left by runs
// that crashed or were interrupted. Used by core/demo.ts. Never touches /var/lib/box (the installed box).
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export const DEMO_ROOT = '/var/lib/box-demo';

export const mountsUnder = (dir: string) =>
  fs
    .readFileSync('/proc/self/mountinfo', 'utf8')
    .split('\n')
    .map((l) => l.split(' ')[4])
    .filter((m): m is string => !!m && m.startsWith(dir + '/'));

/** A box process whose BOX_HOME is `home` is alive. */
function ownerAlive(home: string): boolean {
  for (const pid of fs.readdirSync('/proc')) {
    if (!/^\d+$/.test(pid)) continue;
    try {
      const env = fs.readFileSync(`/proc/${pid}/environ`, 'utf8');
      if (env.split('\0').includes(`BOX_HOME=${home}`)) return true;
    } catch {} // the process ended, or not ours to read
  }
  return false;
}

/** The task users a run created, read from its log. */
function usersOf(home: string): string[] {
  const log = path.join(home, 'log.jsonl');
  if (!fs.existsSync(log)) return [];
  const users = new Set<string>();
  for (const line of fs.readFileSync(log, 'utf8').split('\n')) {
    const m = line.match(/"type":"task\.created".*?"user":"(box-[\w]+)"/);
    if (m) users.add(m[1]);
  }
  return [...users];
}

/** Stop one demo box: kill its box process group and task users, unmount its copies, drop its users. */
export function teardown(home: string, boxPid?: number) {
  if (boxPid) {
    try {
      process.kill(-boxPid, 'SIGKILL');
    } catch {} // already gone
  }
  const users = usersOf(home);
  for (const u of users) spawnSync('pkill', ['-KILL', '-u', u]);
  for (const m of mountsUnder(home).sort((a, b) => b.length - a.length)) spawnSync('umount', ['-l', m]);
  for (const u of users) for (let i = 0; i < 10 && spawnSync('id', [u]).stdout; i++) if (spawnSync('userdel', [u]).status === 0) break;
}

/** Remove demo boxes left by runs that are no longer alive and are older than maxAgeMs. Leaves live runs. */
export function reap(maxAgeMs = 3600_000, force = false) {
  if (!fs.existsSync(DEMO_ROOT)) return;
  for (const name of fs.readdirSync(DEMO_ROOT)) {
    const home = path.join(DEMO_ROOT, name);
    try {
      if (!fs.statSync(home).isDirectory() || ownerAlive(home)) continue;
      const age = Date.now() - fs.statSync(home).mtimeMs;
      if (!force && age < maxAgeMs) continue; // young and ownerless: a run may still be starting up
      teardown(home);
      fs.rmSync(home, { recursive: true, force: true });
      spawnSync('spacetime', ['delete', '--server', 'local', '-y', `box-demo-${name}`]);
    } catch {} // another run may be reaping the same dir
  }
}

/** Run directly to reap now: `node core/reap.ts [--all]`. */
if (import.meta.url === `file://${process.argv[1]}`) {
  reap(process.argv.includes('--all') ? 0 : 3600_000, process.argv.includes('--all'));
  // Also unmount any orphan overlay mounts under DEMO_ROOT whose dir is already gone.
  for (const m of mountsUnder(DEMO_ROOT)) spawnSync('umount', ['-l', m]);
}
