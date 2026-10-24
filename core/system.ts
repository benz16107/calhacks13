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

export function updateState() {
  const read = (f: string) => {
    try {
      return fs.readFileSync(f, 'utf8');
    } catch {
      return '';
    }
  };
  return { ...version(), ...updateStateFrom(read('/proc/cmdline'), read('/data/update/trial'), read('/data/update/last'), isImage()) };
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
