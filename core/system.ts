// Facts about the box for the first-run wizard and Settings: name, time zone, network, edition, version.
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';

const root = new URL('../', import.meta.url).pathname;

export function version() {
  let v = '0.0.0';
  try {
    v = JSON.parse(fs.readFileSync(`${root}package.json`, 'utf8')).version ?? v;
  } catch {} // no package.json beside us
  let build = 'dev';
  try {
    build = fs.readFileSync(`${root}VERSION`, 'utf8').trim() || build; // ./deploy writes the commit here
  } catch {} // a checkout that was not deployed
  return { version: v, build };
}

export function timezone() {
  try {
    const t = fs.readFileSync('/etc/timezone', 'utf8').trim();
    if (t) return t;
  } catch {} // not a Debian-style box
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

export const edition = () => (process.env.BOX_EDITION ?? (process.env.BOX_OWNER ? 'personal' : 'server')) as 'server' | 'personal' | 'business';

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
