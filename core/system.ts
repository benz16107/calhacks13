// Facts about the box for the first-run wizard and Settings: name, time zone, network, edition, version.
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';

const root = new URL('../', import.meta.url).pathname;

/** /usr/lib/os-release as key and value. */
function osRelease(): Record<string, string> {
  try {
    return Object.fromEntries(fs.readFileSync('/usr/lib/os-release', 'utf8').split('\n').map((l) => l.match(/^([A-Z_]+)=("?)(.*)\2$/)).filter(Boolean).map((m) => [m![1], m![3]]));
  } catch {
    return {};
  }
}

export type UpdateState = 'current' | 'ready' | 'trial' | 'rolledBack' | 'unknown';

/**
 * Where box-update stands, from what it leaves behind (image/rootfs/usr/local/sbin/box-update): the booted slot in
 * the kernel command line, /data/update/trial ("<slot> <time>") and /data/update/last (its last result line).
 */
export function updateStateFrom(cmdline: string, trial: string, last: string, image: boolean): { state: UpdateState; slot?: string; last?: string; lastAt?: string } {
  const slot = cmdline.match(/\bbox\.slot=([ab])\b/)?.[1];
  if (!image || !slot) return { state: 'unknown' };
  const t = trial.trim().split(/\s+/)[0];
  const l = last.trim();
  const state: UpdateState = t ? (t === slot ? 'trial' : 'ready') : /rolled back|did not start/.test(l) ? 'rolledBack' : 'current';
  return { state, slot, ...(l ? { last: l, lastAt: l.match(/^\S+Z/)?.[0] } : {}) };
}

/**
 * How this computer is updated, from the files box-update keeps (no mount, so it is cheap to ask often). Only an
 * installed image has slots A and B; a checkout installed with core/install.sh, or the install disc running live, has
 * none. Nothing looks for updates by itself yet (no update feed), so `automatic` is false and Settings' autoUpdate
 * and updateChannel are stored but not used.
 */
export function updateFacts(cmdline: string, f: { image: boolean; grubenv?: string; writing?: string; trial?: string }) {
  const slot = cmdline.match(/\bbox\.slot=([ab])\b/)?.[1];
  if (!f.image || !slot) return { install: f.image ? ('disc' as const) : ('checkout' as const), slots: false, automatic: false };
  const other = slot === 'a' ? 'b' : 'a';
  const dflt = f.grubenv?.match(/^saved_entry=([ab])$/m)?.[1];
  const trial = f.trial?.trim().split(/\s+/)[0];
  return {
    install: 'image' as const,
    slots: true,
    automatic: false,
    ...(dflt ? { default: dflt } : {}),
    other: { slot: other, ...(f.writing?.trim() === other ? { unfinished: true } : {}) }, // a cut-off write: it cannot start
    ...(trial ? { trial } : {}),
  };
}

export function updateState() {
  const read = (f: string) => {
    try {
      return fs.readFileSync(f, 'utf8');
    } catch {
      return '';
    }
  };
  const cmdline = read('/proc/cmdline');
  const image = isImage();
  return {
    ...version(),
    ...updateStateFrom(cmdline, read('/data/update/trial'), read('/data/update/last'), image),
    ...updateFacts(cmdline, { image, grubenv: read('/boot/efi/boot/grub/grubenv'), writing: read('/data/update/writing'), trial: read('/data/update/trial') }),
  };
}

/** Running from a GurtOS image (not a checkout on stock Ubuntu). */
export const isImage = () => osRelease().ID === 'gurtos';

export function version() {
  let v = '0.0.0';
  try {
    v = JSON.parse(fs.readFileSync(`${root}package.json`, 'utf8')).version ?? v;
  } catch {} // no package.json beside us
  let build = 'dev';
  try {
    build = fs.readFileSync(`${root}VERSION`, 'utf8').trim() || build; // ./deploy writes the commit here
  } catch {
    build = osRelease().BUILD_ID || build; // a release image names its build in os-release
  }
  return { version: v, build };
}

export function timezone() {
  try {
    const t = fs.readFileSync('/etc/timezone', 'utf8').trim();
    if (t) return t;
  } catch {} // not a Debian-style box
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

export const edition = (owner: string | null, business = false) => (business ? 'business' : (process.env.BOX_EDITION ?? (owner ? 'personal' : 'server'))) as 'server' | 'personal' | 'business';

let cached: { at: number; online: boolean } | undefined;
/** Can this box open an outside connection? A quick TCP connect, remembered for 15 seconds. */
export function online(): Promise<boolean> {
  if (cached && Date.now() - cached.at < 15_000) return Promise.resolve(cached.online);
  return new Promise((resolve) => {
    const done = (ok: boolean) => {
      cached = { at: Date.now(), online: ok };
      resolve(ok);
    };
    const s = net.connect({ host: '1.1.1.1', port: 443 });
    s.setTimeout(1500, () => (s.destroy(), done(false)));
    s.on('connect', () => (s.destroy(), done(true)));
    s.on('error', () => done(false));
  });
}

export function interfaces() {
  return Object.entries(os.networkInterfaces()).flatMap(([name, list]) =>
    (list ?? []).filter((i) => !i.internal && i.family === 'IPv4').map((i) => ({ name, address: i.address, mac: i.mac })),
  );
}

export const DROID = '/usr/local/bin/droid';

/**
 * Where Factory's Droid CLI (the agent worker) stands. A GurtOS image downloads it after the first start and
 * writes how that goes to /run/box-os/droid (image/rootfs/usr/local/lib/box-os/box-droid). On a checkout installed
 * with core/install.sh there is no such file: core/setup.sh installs Droid, so a missing one needs a person.
 */
export function droidState(status = '/run/box-os/droid', bin = DROID): { state: 'ready' | 'downloading' | 'offline' | 'retrying' | 'missing'; message: string; at?: string } {
  if (fs.existsSync(bin)) return { state: 'ready', message: 'Droid is ready.' };
  let kv: Record<string, string> = {};
  try {
    kv = Object.fromEntries(fs.readFileSync(status, 'utf8').split('\n').map((l) => l.match(/^(\w+)=(.*)$/)).filter(Boolean).map((m) => [m![1], m![2].trim()]));
  } catch {} // not an image, or box-droid has not started yet
  const state = (['downloading', 'offline', 'retrying'] as const).find((s) => s === kv.state);
  if (state) return { state, message: kv.message || 'Droid, the agent worker, is downloading. Agent tasks can start once it is here.', ...(kv.at ? { at: kv.at } : {}) };
  if (isImage()) return { state: 'downloading', message: 'Droid, the agent worker, downloads once this computer is online. Agent tasks can start once it is here.' };
  return { state: 'missing', message: "Droid, the agent worker, is not installed on this computer. Run sudo core/setup.sh droid in the GurtOS folder, then start the task again." };
}

/** A task's failure in words a person reads: no "worker exited with", and the common causes named. */
export function failureText(why: string | undefined, code: unknown, via?: string, worker = 'droid'): string {
  const w = (why ?? '').replace(/^Error:\s*/, '');
  // Exit codes 200 to 243 are systemd's own: it could not set the task's unit up (its folder, its user, its limits).
  if (!w && typeof code === 'number' && code >= 200 && code <= 243) return `GurtOS could not start this task's sandbox (systemd code ${code}). Try the task again; if it keeps failing, restart this computer.`;
  if (/ENOSPC|no space left on device|EDQUOT/i.test(w)) return "This computer's disk is full. Free some space, then run the task again.";
  // Only the real agent's failures are about Claude; a scripted task's error is its own tool's (a payment URL down).
  if (worker !== 'droid') return w ? w.slice(0, 300) : `The task stopped with an error (code ${code}).`;
  // Same words as the Personal desktop's banner.
  if (/\b401\b|authentication_error|invalid x-api-key|invalid api key/i.test(w)) return `Your ${via === 'factory' ? 'Factory' : 'Anthropic'} key was not accepted. Change it in Settings, Keys.`;
  if (/\b429\b|rate.?limit|overloaded/i.test(w)) return "Claude is busy or the key's limit was reached. Try again in a minute.";
  if (/ENOTFOUND|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN|fetch failed/i.test(w)) return "Couldn't reach Claude. Check this computer's internet connection.";
  if (/still downloading/i.test(w)) return w;
  if (w) return w.slice(0, 300);
  return code === 'SIGKILL' || code === 137 ? 'The task was stopped: it used more memory than it may.' : `The agent stopped with an error (code ${code}).`;
}

/** A task that could not start, in words: a full disk, or which command failed, never its arguments (paths, mounts). */
export function startFailureText(message: string): string {
  if (/ENOSPC|no space left on device|EDQUOT/i.test(message)) return "This computer's disk is full. Free some space, then run the task again.";
  const cmd = message.match(/^Command failed: (\S+)/)?.[1];
  return cmd ? `GurtOS could not set this task up (${cmd.split('/').pop()} failed). Try the task again; if it keeps failing, restart this computer.` : message;
}
