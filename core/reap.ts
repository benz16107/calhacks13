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

/**
 * Remove stale demo boxes. A demo finishes in a couple of minutes and tears itself down, so any box older
 * than maxAgeMs is a stuck orphan (its demo was SIGKILLed before its trap could run); kill it even if its
 * box process is still alive. `force` reaps every demo box now, regardless of age. Never touches /var/lib/box.
 */
export function reap(maxAgeMs = 3600_000, force = false) {
  if (!fs.existsSync(DEMO_ROOT)) return;
  for (const name of fs.readdirSync(DEMO_ROOT)) {
    const home = path.join(DEMO_ROOT, name);
    try {
      if (!fs.statSync(home).isDirectory()) continue;
      const age = Date.now() - fs.statSync(home).mtimeMs;
      if (!force && age < maxAgeMs) continue; // a healthy run is minutes old; leave it be
      // The box here is detached, so find and kill it by its BOX_HOME before removing the files.
      for (const pid of fs.readdirSync('/proc')) {
        if (!/^\d+$/.test(pid)) continue;
        try {
          if (fs.readFileSync(`/proc/${pid}/environ`, 'utf8').split('\0').includes(`BOX_HOME=${home}`)) process.kill(Number(pid), 'SIGKILL');
        } catch {} // gone, or not ours
      }
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
