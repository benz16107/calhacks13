// Remote access: this box's own HTTPS address, <name>.box.gurtos.com, through the GurtOS relay. Opt in, owner only.
//
// Two helpers run beside the box, as hardened transient units the box starts and stops:
//   box-tunnel  frpc: one outbound connection to the relay (no port forwarding at home). The relay hands it every
//               connection for this box's name, still encrypted.
//   box-tls     Caddy on 127.0.0.1: the box's own Let's Encrypt certificate (the challenge comes back through the
//               tunnel), then a reverse proxy to the box's API. Every request through it carries X-Forwarded-For,
//               so the box treats it as remote: a paired device's token is required, exactly as on the home network.
// TLS ends here, on the box. The relay sees names and byte counts, never what goes through.
// State: BOX_HOME/remote.json (name, ports), BOX_HOME/remote/ (configs, certificates), the secret in the vault.
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import dns from 'node:dns/promises';
import fs from 'node:fs';
import https from 'node:https';
import net from 'node:net';
import path from 'node:path';
import { notPublic } from './net.ts';

/** The relay a box uses unless its owner chose another in Settings (Remote.relay). */
export const RELAY = (process.env.BOX_RELAY ?? 'https://box.gurtos.com').replace(/\/+$/, '');

/** Why this can't be a relay address, or undefined: https, a host name (not an address), no login, path or query. */
export function relayProblem(url: unknown): string | undefined {
  let u: URL;
  try {
    u = new URL(String(url));
  } catch {
    return 'url: the relay\'s https address, like https://relay.example.com';
  }
  if (u.protocol !== 'https:') return 'url: the relay must be https';
  if (u.username || u.password || u.search || u.hash || (u.pathname !== '/' && u.pathname !== '')) return 'url: only the address, like https://relay.example.com (no path, query or login)';
  if (net.isIP(u.hostname.replace(/^\[|\]$/g, '')) || !/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(u.hostname)) return 'url: use the relay\'s public host name, like relay.example.com, not an IP address';
  if (/\.(localhost|local|internal|lan|home|arpa)$/.test(u.hostname)) return 'url: the relay must be on the public internet, so phones anywhere can reach it';
  return undefined;
}

/** relayProblem, then where the name really leads: never this machine or a private network (phones could not reach it). */
export async function checkRelay(url: unknown, lookup = (h: string) => dns.lookup(h, { all: true })): Promise<string> {
  const problem = relayProblem(url);
  if (problem) throw err(400, problem);
  const u = new URL(String(url));
  const found = await lookup(u.hostname).catch(() => []);
  if (!found.length) throw err(400, `url: ${u.hostname} does not resolve`);
  if (found.some((a) => notPublic(a.address))) throw err(400, `url: ${u.hostname} leads to a private or local address; the relay must be on the public internet`);
  return u.origin;
}
/** The GurtOS app: one web app for every machine a person pairs. Each box lets it call the API (CORS). */
export const APP = (process.env.BOX_APP ?? 'https://app.gurtos.com').replace(/\/+$/, '');
const FRPC = process.env.BOX_FRPC ?? '/usr/local/bin/frpc';
const CADDY = process.env.BOX_CADDY ?? '/usr/local/bin/caddy';
/** Let's Encrypt's staging CA for tests (its certificates are not trusted, so the self-check skips verifying). */
const ACME_CA = process.env.BOX_ACME_CA ?? '';
export const SECRET_KEY = 'BOX_RELAY_SECRET';

/** The relay's rules for a name (relay/server.ts has the same; the demo checks they agree). */
export function nameProblem(name: unknown): string | undefined {
  if (typeof name !== 'string' || !name) return 'choose a name';
  if (name.length < 3) return 'use at least 3 characters';
  if (name.length > 30) return 'use at most 30 characters';
  if (!/^[a-z0-9-]+$/.test(name)) return 'use only lowercase letters, digits and hyphens';
  if (name.startsWith('-') || name.endsWith('-')) return "a name can't start or end with a hyphen";
  if (name.includes('--')) return "a name can't have two hyphens in a row";
  return undefined; // reserved names are the relay's list; it answers for them
}

interface Saved {
  name: string;
  host: string;
  url: string;
  tunnel: { host: string; port: number; serverName: string };
  ports: { https: number; http: number };
  at: string;
}

export interface RemoteDeps {
  secret(): string | undefined;
  setSecret(v: string): void;
  dropSecret(): void;
  apiPort(): number;
  /** The box's own startedAt, so the self-check knows it reached this box and not a stale route. */
  startedAt(): string;
  note(data: unknown): void;
}

type State = 'off' | 'starting' | 'connected' | 'error';
const err = (status: number, message: string) => Object.assign(new Error(message), { status });

/** A call to the relay. When it can't be reached (it is down, or this box is offline), say so in words. */
async function toRelay(url: string, init: RequestInit = {}) {
  try {
    return await fetch(url, init);
  } catch {
    throw err(502, `GurtOS can't reach the relay at ${new URL(url).host} right now, so remote access can't be turned on. Check this computer's internet connection and try again later, or run your own relay (gurtos.com/docs/guides/self-host/).`);
  }
}

export class Remote {
  file: string;
  dir: string;
  deps: RemoteDeps;
  saved?: Saved;
  state: State = 'off';
  error?: string;
  checkedAt = 0;
  /** Unit names: plain on the installed box, with a suffix for a demo box so the two never share one. */
  units: { tunnel: string; tls: string };

  /** Present once the owner turned remote access off; cleared when it is turned on again. */
  offFile: string;
  /** The one pairing rendezvous being watched; a newer code replaces it. */
  watching?: AbortController;

  /** The owner's own relay (Settings), saved in relay.json; else RELAY. */
  relayFile: string;
  custom?: string;
  get relay() {
    return this.custom ?? RELAY;
  }

  constructor(home: string, deps: RemoteDeps) {
    this.relayFile = path.join(home, 'relay.json');
    try {
      const c = JSON.parse(fs.readFileSync(this.relayFile, 'utf8')).url;
      if (!relayProblem(c)) this.custom = new URL(c).origin;
    } catch {} // none chosen
    this.file = path.join(home, 'remote.json');
    this.offFile = path.join(home, 'remote-off');
    this.dir = path.join(home, 'remote');
    this.deps = deps;
    const suffix = path.resolve(home) === '/var/lib/box' ? '' : '-' + createHash('sha256').update(path.resolve(home)).digest('hex').slice(0, 8);
    this.units = { tunnel: `box-tunnel${suffix}`, tls: `box-tls${suffix}` };
    if (fs.existsSync(this.file)) this.saved = JSON.parse(fs.readFileSync(this.file, 'utf8'));
  }

  view() {
    const s = this.saved;
    return { enabled: !!s, name: s?.name ?? null, url: s?.url ?? null, state: this.state, ...(this.error ? { error: this.error } : {}), relay: new URL(this.relay).host };
  }

  /** GET /api/remote/relay: the relay in use, the box's default, and whether the owner chose this one. */
  relayView() {
    return { url: this.relay, default: RELAY, custom: !!this.custom };
  }

  /** PUT /api/remote/relay {url}: the owner's own relay, or null for the default. Only while remote access is off. */
  async setRelay(url: unknown) {
    if (this.saved) throw err(409, `turn remote access off first: this computer's address ${this.saved.host} is on the relay it uses now`);
    if (url === null || url === '' || url === undefined) {
      fs.rmSync(this.relayFile, { force: true });
      this.custom = undefined;
    } else {
      const origin = await checkRelay(url);
      fs.writeFileSync(this.relayFile, JSON.stringify({ url: origin, at: new Date().toISOString() }), { mode: 0o600 });
      this.custom = origin === RELAY ? undefined : origin;
      if (!this.custom) fs.rmSync(this.relayFile, { force: true });
    }
    this.deps.note({ remote: 'relay', relay: this.relay, text: `Remote access relay: ${new URL(this.relay).host}${this.custom ? '' : ' (the default)'}` });
    return this.relayView();
  }

  /** At boot: bring the address back if it was on. */
  boot() {
    if (this.saved) void this.start();
  }

  /**
   * A phone that scanned the pairing QR while remote access is off can ask, through a rendezvous slot on the relay,
   * for this box to turn it on (it holds the QR, so it is the person at this screen). The box then enrolls a name,
   * waits until its address answers, and posts that address back for the phone to pair with. Runs while the code is
   * valid; `alive` turns false once the code is used or expires.
   */
  async watchPairing(rv: string, alive: () => boolean, allowed: () => boolean, boxId: string) {
    this.watching?.abort(); // one watcher at a time: the wizard renews codes, and only the newest QR is on screen
    const mine = (this.watching = new AbortController());
    const live = () => alive() && !mine.signal.aborted;
    const put = (slot: string, body: unknown, headers: Record<string, string> = {}) =>
      fetch(`${this.relay}/v1/rv/${rv}/${slot}`, { method: 'PUT', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body), signal: AbortSignal.timeout(10_000) });
    let failures = 0;
    while (live() && failures < 3) {
      try {
        const r = await fetch(`${this.relay}/v1/rv/${rv}/ask?wait=25`, { signal: AbortSignal.any([mine.signal, AbortSignal.timeout(35_000)]) });
        if (r.status === 404) continue; // nobody asked yet
        if (!r.ok) throw new Error(`relay answered ${r.status}`);
        if (!this.saved) {
          if (!allowed()) throw new Error('this computer is past setup, or its owner turned remote access off: turn it on in Settings, Remote access');
          await this.enableAuto(boxId);
        }
        const until = Date.now() + 150_000;
        while (this.state !== 'connected' && Date.now() < until) {
          if (this.state === 'error') throw new Error(this.error ?? 'remote access failed');
          await new Promise((res) => setTimeout(res, 1000));
        }
        if (this.state !== 'connected') throw new Error('the address did not come up in time');
        const s = this.saved!;
        this.deps.note({ remote: 'on', by: 'setup code', text: `Remote access turned on by the phone that scanned the setup code (${s.host})` });
        await put('host', { host: s.host }, { authorization: `Bearer ${s.name}.${this.deps.secret()}` });
        return;
      } catch (e) {
        if (mine.signal.aborted) return; // a newer code took over
        failures++;
        if (failures >= 3 || !live() || /past setup/.test((e as Error).message)) return void (await put('error', { error: (e as Error).message }).catch(() => {}));
        await new Promise((res) => setTimeout(res, 3000));
      }
    }
  }

  /** Turn remote access on with a name made from the box id (gurt-2a48f6), adding -2, -3 if it is taken. */
  async enableAuto(boxId: string) {
    const base = boxId.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').replace(/--+/g, '-').slice(0, 26).replace(/-+$/, '');
    const root = base.length >= 3 && !nameProblem(base) ? base : `gurt-${base || 'box'}`.slice(0, 26);
    for (const name of [root, `${root}-2`, `${root}-3`, `${root}-${Math.random().toString(36).slice(2, 6)}`]) {
      try {
        return await this.enable(name);
      } catch (e) {
        if ((e as { status?: number }).status !== 409) throw e; // taken or reserved: try the next
      }
    }
    throw new Error('no free name for this box; choose one in Settings, Remote access');
  }

  /** Ask the relay whether a name is free. */
  async available(name: string) {
    const problem = nameProblem(name);
    if (problem) return { name, available: false, reason: problem };
    const r = await toRelay(`${this.relay}/v1/names/${name}`, { signal: AbortSignal.timeout(10_000) });
    if (!r.ok) throw err(502, `the relay answered ${r.status}`);
    return r.json();
  }

  async enable(name: unknown) {
    if (this.saved) {
      if (this.saved.name === name) return this.view();
      throw err(409, `this box is already ${this.saved.host}; turn it off first to change the name`);
    }
    const problem = nameProblem(name);
    if (problem) throw err(400, `name: ${problem}`);
    for (const bin of [FRPC, CADDY]) if (!fs.existsSync(bin)) throw err(500, `${bin} is missing: this box needs a newer GurtOS for remote access`);
    const r = await toRelay(`${this.relay}/v1/names`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name }), signal: AbortSignal.timeout(15_000) });
    const out = (await r.json().catch(() => ({}))) as any;
    if (!r.ok) throw err(r.status === 409 || r.status === 400 || r.status === 429 ? r.status : 502, out.error ?? `the relay answered ${r.status}`);
    // What the relay sends goes into config files: accept only plain host names, a port and a token-like secret.
    const hostOk = (h: unknown) => typeof h === 'string' && /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(h);
    if (out.host !== `${name}.${new URL(this.relay).host}` || !hostOk(out.tunnel?.host) || !hostOk(out.tunnel?.serverName) || !Number.isInteger(out.tunnel?.port) || !/^[A-Za-z0-9_-]{20,200}$/.test(out.secret ?? ''))
      throw err(502, 'the relay sent an answer this box does not accept');
    this.deps.setSecret(out.secret);
    fs.rmSync(this.offFile, { force: true });
    this.saved = { name: out.name, host: out.host, url: `https://${out.host}`, tunnel: { host: out.tunnel.host, port: out.tunnel.port, serverName: out.tunnel.serverName }, ports: await freePorts(), at: new Date().toISOString() };
    fs.writeFileSync(this.file, JSON.stringify(this.saved, null, 2), { mode: 0o600 });
    this.deps.note({ remote: 'on', name: out.name, url: this.saved.url });
    this.state = 'starting';
    void this.start();
    return this.view();
  }

  async disable() {
    const s = this.saved;
    if (!s) return this.view();
    this.stopUnits();
    let released = true;
    try {
      const r = await fetch(`${this.relay}/v1/names/${s.name}`, { method: 'DELETE', headers: { authorization: `Bearer ${s.name}.${this.deps.secret() ?? ''}` }, signal: AbortSignal.timeout(10_000) });
      released = r.ok;
    } catch {
      released = false; // the name expires by itself after 30 days without the tunnel
    }
    this.deps.dropSecret();
    fs.rmSync(this.file, { force: true });
    this.saved = undefined;
    this.state = 'off';
    this.error = undefined;
    fs.writeFileSync(this.offFile, new Date().toISOString()); // the owner chose off: the setup rendezvous must not turn it back on
    this.deps.note({ remote: 'off', name: s.name, released });
    return { ...this.view(), released };
  }

  /** Write the helpers' configs, (re)start them, and wait until the box answers at its address. */
  async start() {
    const s = this.saved!;
    this.state = 'starting';
    this.error = undefined;
    try {
      const secret = this.deps.secret();
      if (!secret) throw new Error(`the vault has no ${SECRET_KEY}; turn remote access off and on again`);
      fs.mkdirSync(path.join(this.dir, 'caddy'), { recursive: true, mode: 0o700 });
      // The tunnel port's CA, fetched over HTTPS from the relay (Web PKI) and pinned for the tunnel. A copy is kept
      // in case the relay's API is down when the box starts.
      const caFile = path.join(this.dir, 'relay-ca.pem');
      try {
        const t = (await (await fetch(`${this.relay}/v1/tunnel`, { signal: AbortSignal.timeout(10_000) })).json()) as { ca: string };
        if (t.ca?.includes('BEGIN CERTIFICATE')) fs.writeFileSync(caFile, t.ca, { mode: 0o600 });
      } catch (e) {
        if (!fs.existsSync(caFile)) throw new Error(`can't reach the relay: ${(e as Error).message}`);
      }
      fs.writeFileSync(path.join(this.dir, 'frpc.toml'), frpcConfig(s, secret, caFile), { mode: 0o600 });
      fs.writeFileSync(path.join(this.dir, 'Caddyfile'), caddyConfig(s, this.deps.apiPort()), { mode: 0o600 });
      this.stopUnits();
      this.run(this.units.tls, [CADDY, 'run', '--adapter', 'caddyfile', '--config', path.join(this.dir, 'Caddyfile')], [`XDG_DATA_HOME=${this.dir}/caddy`, `XDG_CONFIG_HOME=${this.dir}/caddy`]);
      this.run(this.units.tunnel, [FRPC, '-c', path.join(this.dir, 'frpc.toml')], []);
      const until = Date.now() + 150_000; // a new certificate usually takes 5 to 30 s
      let last = '';
      while (Date.now() < until && this.saved === s) {
        last = await this.selfCheck();
        if (!last) return void ((this.state = 'connected'), (this.checkedAt = Date.now()));
        await new Promise((r) => setTimeout(r, 2000));
      }
      if (this.saved === s) throw new Error(last);
    } catch (e) {
      if (this.saved !== s) return;
      this.state = 'error';
      this.error = (e as Error).message;
      console.error(`remote access: ${this.error}`);
    }
  }

  /** For GET /api/remote: check again at most every 30 s, so the screen shows a dropped tunnel. */
  async refresh() {
    if (!this.saved || this.state === 'starting' || Date.now() - this.checkedAt < 30_000) return this.view();
    this.checkedAt = Date.now();
    const problem = await this.selfCheck();
    this.state = problem ? 'error' : 'connected';
    this.error = problem || undefined;
    return this.view();
  }

  /** '' when https://<name>.box.gurtos.com/api/health is this box, else why not. */
  selfCheck(): Promise<string> {
    const s = this.saved!;
    return new Promise((resolve) => {
      const req = https.get(`${s.url}/api/health`, { rejectUnauthorized: !ACME_CA, timeout: 10_000 }, (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => {
          if (res.statusCode !== 200) return resolve(`the address answered ${res.statusCode}`);
          try {
            resolve(JSON.parse(body).startedAt === this.deps.startedAt() ? '' : 'the address reached another box');
          } catch {
            resolve('the address did not answer as a box');
          }
        });
      });
      req.on('timeout', () => req.destroy(new Error('no answer in 10 s')));
      req.on('error', (e) => resolve(`not reachable yet: ${e.message}`));
    });
  }

  run(unit: string, cmd: string[], env: string[]) {
    const props = ['Restart=always', 'RestartSec=3', 'NoNewPrivileges=yes', 'ProtectSystem=strict', `ReadWritePaths=${this.dir}`, 'ProtectHome=yes', 'PrivateTmp=yes', 'PrivateDevices=yes', 'CapabilityBoundingSet=', 'MemoryMax=256M'];
    execFileSync('systemd-run', ['--unit', unit, '--collect', '--quiet', ...props.flatMap((p) => ['-p', p]), ...env.flatMap((e) => ['--setenv', e]), ...cmd], { stdio: 'pipe' });
  }

  stopUnits() {
    for (const u of [this.units.tunnel, this.units.tls]) {
      spawnSync('systemctl', ['stop', u], { stdio: 'ignore' });
      spawnSync('systemctl', ['reset-failed', u], { stdio: 'ignore' });
    }
  }
}

/** Two free loopback ports for Caddy: 7443 and 7480 on the installed box, others when those are taken. */
async function freePorts() {
  const free = (port: number) => new Promise<number>((resolve) => {
    const s = net.createServer().once('error', () => resolve(0)).listen(port, '127.0.0.1', () => {
      const p = (s.address() as net.AddressInfo).port;
      s.close(() => resolve(p));
    });
  });
  return { https: (await free(7443)) || (await free(0)), http: (await free(7480)) || (await free(0)) };
}

export function frpcConfig(s: Saved, secret: string, caFile: string) {
  const q = JSON.stringify;
  return `# Written by the box (core/remote.ts). The tunnel to the GurtOS relay for ${s.host}.
serverAddr = ${q(s.tunnel.host)}
serverPort = ${s.tunnel.port}
user = ${q(s.name)}
metadatas.secret = ${q(secret)}
loginFailExit = false
transport.tls.enable = true
transport.tls.trustedCaFile = ${q(caFile)}
transport.tls.serverName = ${q(s.tunnel.serverName)}
# A heartbeat every 30 s: the relay drops a tunnel after 90 s without one, and checks the secret again at each.
transport.heartbeatInterval = 30
log.to = "console"

# HTTPS, passed through still encrypted; the PROXY header tells Caddy the caller's address.
[[proxies]]
name = "https"
type = "https"
customDomains = [${q(s.host)}]
localIP = "127.0.0.1"
localPort = ${s.ports.https}
transport.proxyProtocolVersion = "v2"

# Plain HTTP, for the certificate's HTTP-01 challenge and a redirect to HTTPS.
[[proxies]]
name = "http"
type = "http"
customDomains = [${q(s.host)}]
localIP = "127.0.0.1"
localPort = ${s.ports.http}
`;
}

export function caddyConfig(s: Saved, apiPort: number) {
  return `# Written by the box (core/remote.ts). TLS for ${s.host} ends here, on the box.
{
	admin off
	persist_config off
	# These two loggers write the request URI, and a phone's ?access_token= with it. Keep certificate logs only.
	log default {
		exclude http.log.error http.handlers.reverse_proxy
	}
	http_port ${s.ports.http}
	https_port ${s.ports.https}
	default_bind 127.0.0.1
${ACME_CA ? `	acme_ca ${ACME_CA}\n` : ''}	servers {
		listener_wrappers {
			proxy_protocol {
				allow 127.0.0.1/32
			}
			tls
		}
	}
}

${s.host} {
	header Strict-Transport-Security "max-age=31536000"
	reverse_proxy 127.0.0.1:${apiPort}
}
`;
}
