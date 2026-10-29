// Each task's network. A firewall rule lets task users reach nothing but this proxy, and the proxy lets each
// task reach only its own hosts. It knows the caller by the uid that owns the connection, so tasks carry
// no token.
//
// It also relays Droid's calls to Factory, so a task only ever holds a placeholder key. Droid sends some
// calls to FACTORY_API_BASE_URL (pointed here, plain HTTP) and its model calls to prem.factory.ai over
// HTTPS. For those the proxy answers TLS itself, with a certificate from the box's own CA, which only Droid
// tasks are told to trust. Either way the proxy swaps the placeholder for the vault's key and forwards
// the call over real TLS.
import { execFileSync } from 'node:child_process';
import dns from 'node:dns/promises';
import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import tls from 'node:tls';
import type { Task } from './contract.ts';

// The installed box uses 8888. BOX_PROXY_PORT=auto (the demo) takes a free one in 8800-8887.
const PROXY_PORTS = '8800-8899';
export const TASK_UIDS = '30000-39999'; // the range sandbox.ts gives task users
export const PLACEHOLDER_KEY = 'fk-placeholder-the-box-adds-the-key';
const FACTORY = /^([a-z0-9-]+\.)*factory\.ai$/;
export const ANTHROPIC_PLACEHOLDER = 'sk-ant-placeholder-the-box-adds-the-key';
const ANTHROPIC = 'api.anthropic.com';
/**
 * The Factory paths Droid calls (captured from droid 0.248 in a real session): models, its own settings and limits,
 * the session copy in the owner's Factory account, and telemetry. Any other path, such as running a Factory-hosted
 * connector's tool, would reach a service outside the task's allow-list with the owner's key.
 */
const FACTORY_PATHS = /^\/api\/(llm\/|cli\/|feature-flags$|organization\/managed-settings$|billing\/limits$|connectors\/tools\/list$|apps\/cloud-sync\/sessions\/batch$|ingest$)/;
export const factoryPath = (p: string) => FACTORY_PATHS.test(p);
/** Open connections a task may hold to the proxy at once (a browser keeps about 6 a host; npm a few dozen). */
export const MAX_OPEN = 256;
/** Hosts the proxy answers TLS for itself, to put the vault's model key on the way out. Only for Droid tasks. */
const relayed = (host: string) => FACTORY.test(host) || host === ANTHROPIC;
const SAN = 'subjectAltName=DNS:factory.ai,DNS:*.factory.ai,DNS:api.anthropic.com\n';

/**
 * Load the firewall: a task user may reach the box's proxy and nothing else. Boxes on one machine share the
 * rule, so a table that is already right is left alone (rewriting it would drop the per-task rules below).
 */
export function firewall() {
  const has = (() => {
    try {
      const t = execFileSync('nft', ['list', 'table', 'inet', 'box'], { encoding: 'utf8', stdio: 'pipe' });
      return t.includes('jump blocked') && t.includes(`dport ${PROXY_PORTS}`);
    } catch {
      return false; // no such table yet
    }
  })();
  if (has) return;
  const rules = `add table inet box
delete table inet box
table inet box {
  chain blocked {
    meta skuid ${TASK_UIDS} counter log prefix "box-block " reject
  }
  chain out {
    type filter hook output priority filter; policy accept;
    meta skuid ${TASK_UIDS} ip daddr 127.0.0.1 tcp dport ${PROXY_PORTS} accept
    meta skuid ${TASK_UIDS} jump blocked
  }
}
`;
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'box-nft-')), 'rules.nft'); // nft -f wants a real file
  fs.writeFileSync(file, rules);
  execFileSync('nft', ['-f', file]);
  fs.rmSync(path.dirname(file), { recursive: true });
}

/**
 * Log this task's refused connections with its uid in the prefix. The kernel does not print the uid of a refused
 * connection, so each task gets its own log rule ahead of the general one; the box reads the log and turns each
 * line into a net.blocked event.
 */
export function logBlocked(uid: number, taskId: string) {
  const insert = () =>
    execFileSync('nft', ['insert', 'rule', 'inet', 'box', 'blocked', 'meta', 'skuid', String(uid), 'counter', 'log', 'prefix', `"box-block:${uid} "`, 'reject', 'comment', `"task-${taskId}"`], { stdio: 'pipe' });
  try {
    insert();
  } catch {
    try {
      firewall(); // another box on this machine (older code) may have put back the old table; make ours again
      insert();
    } catch {} // no firewall on this machine: nothing is refused, so nothing to log
  }
}

export function stopLoggingBlocked(taskId: string) {
  try {
    const out = execFileSync('nft', ['-a', 'list', 'chain', 'inet', 'box', 'blocked'], { encoding: 'utf8', stdio: 'pipe' });
    for (const line of out.split('\n')) {
      const handle = line.includes(`comment "task-${taskId}"`) ? /# handle (\d+)/.exec(line)?.[1] : undefined;
      if (handle) execFileSync('nft', ['delete', 'rule', 'inet', 'box', 'blocked', 'handle', handle], { stdio: 'pipe' });
    }
  } catch {} // already gone
}

/**
 * The box's own CA and a *.factory.ai certificate signed by it. The CA key never leaves BOX_HOME/ca (root
 * only); the CA certificate is public, at BOX_HOME/relay-ca.pem, for Droid tasks to trust.
 */
export function relayCert(home: string) {
  const dir = path.join(home, 'ca');
  const caPem = path.join(home, 'relay-ca.pem');
  const ssl = (...args: string[]) => execFileSync('openssl', args, { cwd: dir, stdio: 'pipe' });
  const ec = ['-newkey', 'ec', '-pkeyopt', 'ec_paramgen_curve:prime256v1', '-nodes'];
  if (!fs.existsSync(path.join(dir, 'ca.pem'))) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    ssl('req', '-x509', ...ec, '-keyout', 'ca.key', '-out', 'ca.pem', '-days', '3650', '-subj', '/CN=Box relay CA');
    fs.copyFileSync(path.join(dir, 'ca.pem'), caPem);
    fs.chmodSync(caPem, 0o644);
  }
  // A box made before a name was added gets a new leaf from the same CA, so tasks keep trusting it.
  const sanFile = path.join(dir, 'san.ext');
  if (!fs.existsSync(path.join(dir, 'leaf.pem')) || (fs.existsSync(sanFile) ? fs.readFileSync(sanFile, 'utf8') : '') !== SAN) {
    ssl('req', ...ec, '-keyout', 'leaf.key', '-out', 'leaf.csr', '-subj', '/CN=factory.ai');
    fs.writeFileSync(sanFile, SAN);
    ssl('x509', '-req', '-in', 'leaf.csr', '-CA', 'ca.pem', '-CAkey', 'ca.key', '-CAcreateserial', '-out', 'leaf.pem', '-days', '3650', '-extfile', 'san.ext');
  }
  return { key: fs.readFileSync(path.join(dir, 'leaf.key')), cert: fs.readFileSync(path.join(dir, 'leaf.pem')), caPem };
}

/** The uid that owns the other end of a loopback connection, from /proc/net/tcp. */
export function uidOf(sock: net.Socket): number | undefined {
  const hex = (port: number) => `0100007F:${port.toString(16).toUpperCase().padStart(4, '0')}`;
  const [client, server] = [hex(sock.remotePort ?? 0), hex(sock.localPort ?? 0)];
  for (const line of fs.readFileSync('/proc/net/tcp', 'utf8').split('\n').slice(1)) {
    const f = line.trim().split(/\s+/);
    if (f[1] === client && f[2] === server) return Number(f[7]);
  }
}

/**
 * Whether a request is from the box's own screen: over the box's socket (no address), or from loopback with no proxy
 * header, a Host that names this machine and no Origin but the box's own address (`port`) or one in `origins`
 * (BOX_ORIGINS, for a portal dev server). A web page on another site that points its own name at 127.0.0.1 (DNS
 * rebinding) still sends its own Host; a page served by anything else on this machine, an agent's dev server say,
 * sends its own Origin. Neither is the box's screen.
 */
export function fromScreen(addr: string | undefined, h: http.IncomingHttpHeaders, port: number, origins: string[] = []): boolean {
  if (addr === undefined) return true; // the root-only socket
  if (addr !== '127.0.0.1' && addr !== '::1' && addr !== '::ffff:127.0.0.1') return false;
  if (h['x-forwarded-for'] || h.forwarded || h['x-real-ip'] || h['tailscale-user-login'] || h['x-forwarded-host']) return false; // relayed by a proxy on the box
  const name = /^(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/i;
  if (h.host !== undefined && !name.test(h.host)) return false;
  if (h.origin === undefined || origins.includes(h.origin)) return true;
  try {
    const o = new URL(h.origin);
    return /^https?:$/.test(o.protocol) && name.test(o.hostname) && Number(o.port || (o.protocol === 'https:' ? 443 : 80)) === port;
  } catch {
    return false; // "null", from a sandboxed page or a file
  }
}

/**
 * Where a request really comes from, for rate limits: the address a proxy on this machine (the setup port, Caddy for
 * remote access, a tailnet serve) put last in X-Forwarded-For, else the connection's own address.
 */
export function sourceOf(addr: string | undefined, h: http.IncomingHttpHeaders): string {
  const xff = String(h['x-forwarded-for'] ?? '').split(',').pop()?.trim();
  return (addr === undefined || addr === '127.0.0.1' || addr === '::1' || addr === '::ffff:127.0.0.1') && xff ? xff : (addr ?? 'socket');
}

/**
 * Wrong guesses at a code, in the last minute: at most `each` from one address and `all` from everyone together. One
 * address can't lock everyone else out, and many together still get too few guesses to matter (60 a minute for the
 * 30 minutes a setup code lasts is 1,800 tries at a 1 in 4,294,967,296 code).
 */
export class Tries {
  each: number;
  all: number;
  from = new Map<string, number[]>();
  constructor(each = 5, all = 60) {
    this.each = each;
    this.all = all;
  }
  private recent(source: string, now: number) {
    const list = (this.from.get(source) ?? []).filter((at) => now - at < 60_000);
    if (list.length) this.from.set(source, list);
    else this.from.delete(source);
    return list;
  }
  /** Why this address may not guess now, or undefined. */
  refusal(source: string, now = Date.now()): string | undefined {
    let total = 0;
    for (const s of [...this.from.keys()]) total += this.recent(s, now).length;
    if (this.recent(source, now).length >= this.each) return 'too many wrong pairing codes from here; wait a minute and ask the screen for a new one';
    if (total >= this.all) return 'too many wrong pairing codes; wait a minute and ask the screen for a new one';
  }
  wrong(source: string, now = Date.now()) {
    if (this.from.size > 10_000) this.from.clear(); // shortcut: a flood from many addresses resets the window
    this.from.set(source, [...this.recent(source, now), now]);
  }
}

/** 'example.com' allows that host on any port, 'example.com:8080' only that port, '*.example.com' its subdomains. */
export function allowed(hosts: string[], host: string, port: string) {
  return hosts.some((h) => h === host || h === `${host}:${port}` || (h.startsWith('*.') && host.endsWith(h.slice(1))));
}

/** Box ports a task must never reach, even through a name it may use: the API, SpacetimeDB, the proxies. */
const reserved = new Set([3000]);
export const reservePort = (port: number) => reserved.add(port);
const boxPort = (port: number) => reserved.has(port) || (port >= 8800 && port <= 8899);

/** Link-local: the cloud's metadata service (169.254.169.254, with the machine's own credentials) and the like. */
const subnets = (...cidrs: string[]) => {
  const list = new net.BlockList();
  for (const [a, bits] of cidrs.map((c) => c.split('/'))) list.addSubnet(a, Number(bits), net.isIPv6(a) ? 'ipv6' : 'ipv4');
  return list;
};
const LINK_LOCAL = subnets('169.254.0.0/16', 'fe80::/10');
/** Private networks: the home or office network, a tailnet (100.64.0.0/10), a cloud VPC. */
const PRIVATE = subnets('10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16', '100.64.0.0/10', 'fc00::/7');
const inList = (list: net.BlockList, ip: string) => {
  const v4 = ip.replace(/^::ffff:(?=\d+\.)/i, '');
  return list.check(v4, net.isIPv4(v4) ? 'ipv4' : 'ipv6');
};

/** Not an address on the public internet: loopback, unspecified, link-local or a private network. */
export const notPublic = (ip: string) => inList(LINK_LOCAL, ip) || inList(PRIVATE, ip) || /^(127\.|0\.)/.test(ip.replace(/^::ffff:/i, '')) || ip === '::1' || ip === '::';

/** An address on the box itself: loopback, link-local, or one of its own interfaces. */
function onTheBox(ip: string) {
  const v4 = ip.replace(/^::ffff:/, '');
  if (/^(127\.|0\.|169\.254\.)/.test(v4) || ip === '::1' || ip === '::' || /^fe80:/i.test(ip)) return true;
  return Object.values(os.networkInterfaces()).flat().some((i) => i?.address === ip || i?.address === v4);
}

/**
 * BOX_HOSTS (JSON, like {"shop.demo":"127.0.0.1"}) names hosts for the proxy to resolve itself: a way for a
 * test or the demo to serve a page on a name that tools send through the proxy. (Names under .localhost are not
 * sent through a proxy by curl, so an agent using them tries to go around it.) Not for production.
 */
function aliasOf(host: string): string | undefined {
  try {
    return (JSON.parse(process.env.BOX_HOSTS ?? '{}') as Record<string, string>)[host];
  } catch {
    return undefined;
  }
}

/**
 * The address a task may connect to for host:port, resolved once so the name cannot change in between.
 * A name that lands on the box itself or on a private network needs host:port listed exactly, so a public name whose
 * owner points it at 10.0.0.1 (or rebinds it) cannot walk a task into the home network. The box's own ports and
 * link-local addresses (the cloud's metadata service) are never reached.
 */
export async function destination(hosts: string[], host: string, port: string): Promise<string | undefined> {
  if (!allowed(hosts, host, port)) return;
  const address = aliasOf(host) ?? (await dns.lookup(host).catch(() => undefined))?.address;
  if (!address || inList(LINK_LOCAL, address)) return;
  const exact = hosts.includes(`${host}:${port}`);
  if (onTheBox(address) && (!exact || boxPort(Number(port)))) return;
  if (inList(PRIVATE, address) && !exact) return;
  return address;
}

/**
 * Why a model call asks the model service to reach the internet for the task, or undefined. A web fetch tool, an MCP
 * server or a file by URL would be fetched from the service's side, to any host, around the task's allow-list. Droid
 * sends none of them (its tools run in the task). What the model wrote into its own earlier tool calls is not looked at.
 */
export function fetchesOnItsOwn(body: unknown): string | undefined {
  const web = (v: unknown) => typeof v === 'string' && /^\s*https?:/i.test(v);
  const walk = (v: unknown): string | undefined => {
    if (Array.isArray(v)) return v.map(walk).find(Boolean);
    if (!v || typeof v !== 'object') return undefined;
    const o = v as Record<string, unknown>;
    if (o.mcp_servers !== undefined) return 'an MCP server';
    const type = typeof o.type === 'string' ? o.type : '';
    if (/^(web_fetch|mcp$)/.test(type)) return `a ${type} tool`;
    if (type === 'url' || web(o.image_url) || web(o.file_url) || web((o.image_url as { url?: unknown } | undefined)?.url)) return 'a file by its address';
    return Object.entries(o).filter(([k]) => !(k === 'input' && /tool_use$/.test(type))).map(([, x]) => walk(x)).find(Boolean);
  };
  return walk(body);
}

/** Only the key headers get the vault's key. Others go as sent: a service may quote a bad header back in its error. */
const KEY_HEADERS = new Set(['authorization', 'x-api-key']);

/** A task's request headers on their way to the model service, with the placeholder swapped for the real key. */
export function withKey(headers: http.IncomingHttpHeaders, host: string, placeholder: string, key: string): http.OutgoingHttpHeaders {
  const out: http.OutgoingHttpHeaders = { host };
  for (const [name, value] of Object.entries(headers)) {
    if (value !== undefined && name !== 'host') out[name] = KEY_HEADERS.has(name) && typeof value === 'string' ? value.replaceAll(placeholder, key) : value;
  }
  return out;
}

export interface ProxyHooks {
  taskOf(uid: number): Task | undefined;
  blocked(task: Task, host: string): void;
  /** True when the task's decoy key is in this request (the box then stops the task): the request is refused. */
  leaked(task: Task, text: string): boolean;
  factoryKey(): string | undefined;
  anthropicKey(): string | undefined;
}

/** Start the proxy. Resolves to its port. */
export async function startProxy(hooks: ProxyHooks, cert: { key: Buffer; cert: Buffer }): Promise<number> {
  const who = (sock: net.Socket) => {
    const uid = uidOf(sock);
    return uid === undefined ? undefined : hooks.taskOf(uid);
  };
  const fail = (res: http.ServerResponse, status: number, text: string) =>
    void (res.headersSent ? res.destroy() : res.writeHead(status).end(text));

  /** Send the request on to `target` and stream the answer back. */
  const forward = (req: http.IncomingMessage, res: http.ServerResponse, up: http.ClientRequest, leaks?: (text: string) => boolean) => {
    req.on('error', () => res.destroy());
    if (leaks) {
      // A task's plain-HTTP body is read for the decoy key before it goes on (shortcut: no backpressure, as in tunnels).
      req.on('data', (c: Buffer) => (leaks(c.toString('latin1')) ? (up.destroy(), fail(res, 403, 'blocked by the box')) : up.write(c)));
      req.on('end', () => up.end());
      return void up.on('response', (r) => (res.writeHead(r.statusCode ?? 502, r.headers), r.pipe(res))).on('error', () => fail(res, 502, 'upstream failed'));
    }
    up.on('response', (r) => {
      r.on('error', () => res.destroy());
      res.writeHead(r.statusCode ?? 502, r.headers);
      r.pipe(res);
    });
    up.on('error', () => fail(res, 502, 'upstream failed'));
    req.pipe(up);
  };

  /** A call to Factory or Anthropic from a Droid task: the placeholder key becomes the real one, and only here. */
  const toFactory = (req: http.IncomingMessage, res: http.ServerResponse, host: string, t?: Task) => {
    const anthropic = host === ANTHROPIC;
    const key = anthropic ? hooks.anthropicKey() : hooks.factoryKey();
    if (!key) return fail(res, 503, `the vault has no ${anthropic ? 'ANTHROPIC_API_KEY' : 'FACTORY_API_KEY'}`);
    const u = new URL(req.url ?? '/', 'http://x');
    const p = u.pathname;
    const to = p + u.search; // checked and sent as one normalized path, so the service can't read it another way
    if (!anthropic && !FACTORY_PATHS.test(p)) {
      if (t) hooks.blocked(t, `${host}${p}`.slice(0, 200));
      return fail(res, 403, 'blocked by the box: GurtOS relays only the Factory calls Droid makes');
    }
    const headers = withKey(req.headers, host, anthropic ? ANTHROPIC_PLACEHOLDER : PLACEHOLDER_KEY, key);
    // A model call is read first, so the model service never fetches anything for the task (fetchesOnItsOwn).
    if (!anthropic && !p.startsWith('/api/llm/')) return forward(req, res, https.request({ host, path: to, method: req.method, headers }));
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (c: Buffer) => ((size += c.length) > 64 * 1024 ** 2 ? req.destroy() : chunks.push(c)));
    req.on('error', () => res.destroy());
    req.on('end', () => {
      const body = Buffer.concat(chunks);
      let why: string | undefined;
      try {
        why = body.length ? fetchesOnItsOwn(JSON.parse(body.toString())) : undefined;
      } catch {} // not JSON: nothing for the service to fetch
      if (why) {
        if (t) hooks.blocked(t, `${host}${p} (${why})`.slice(0, 200));
        return fail(res, 403, `blocked by the box: a model call may not ask the model service to fetch ${why} for the task`);
      }
      const { 'transfer-encoding': _chunked, ...sized } = headers;
      const up = https.request({ host, path: to, method: req.method, headers: { ...sized, 'content-length': String(body.length) } });
      up.on('response', (r) => (r.on('error', () => res.destroy()), res.writeHead(r.statusCode ?? 502, r.headers), r.pipe(res)));
      up.on('error', () => fail(res, 502, 'upstream failed'));
      up.end(body);
    });
  };

  // HTTPS to Factory, after the proxy has answered TLS itself. The task was checked at CONNECT.
  const tunnels = new WeakMap<net.Socket, Task>(); // each relayed TLS connection's task, for the log
  const relay = http.createServer((req, res) => {
    const host = (req.headers.host ?? '').split(':')[0];
    if (!relayed(host)) return fail(res, 403, 'not a model host');
    toFactory(req, res, host, tunnels.get(req.socket));
  });

  const server = http.createServer((req, res) => {
    const t = who(req.socket);
    if (!t) return fail(res, 403, 'not a task');
    // FACTORY_API_BASE_URL points here, so Droid's API calls arrive as plain paths.
    if (req.url?.startsWith('/')) {
      if (t.worker !== 'droid') return fail(res, 403, 'no Factory access for this task');
      return toFactory(req, res, 'api.factory.ai', t);
    }
    // Plain HTTP through the proxy.
    let url: URL;
    try {
      url = new URL(req.url ?? '');
    } catch {
      return fail(res, 400, 'bad url');
    }
    const port = url.port || '80';
    if (hooks.leaked(t, url.href + JSON.stringify(req.headers))) return fail(res, 403, 'blocked by the box');
    void destination(t.hosts, url.hostname, port).then((address) => {
      if (!address) {
        hooks.blocked(t, `${url.hostname}:${port}`);
        return fail(res, 403, 'blocked by the box');
      }
      const headers = { ...req.headers, host: url.host };
      forward(req, res, http.request({ host: address, port, path: url.pathname + url.search, method: req.method, headers }), (text) => hooks.leaked(t, text));
    });
  });

  // HTTPS through the proxy: the task asks for a tunnel to host:port.
  server.on('connect', (req: http.IncomingMessage, client: net.Socket, head: Buffer) => {
    let up: net.Socket | undefined;
    client.on('error', () => up?.destroy());
    const t = who(client);
    const [host, port = '443'] = (req.url ?? '').split(':');
    if (t?.worker === 'droid' && relayed(host) && port === '443') {
      client.write('HTTP/1.1 200 Connection Established\r\n\r\n');
      if (head.length) client.unshift(head);
      const secure = new tls.TLSSocket(client, { isServer: true, ...cert });
      tunnels.set(secure, t);
      secure.on('error', () => client.destroy());
      return void relay.emit('connection', secure);
    }
    if (!t) return void client.end('HTTP/1.1 403 Forbidden\r\n\r\n');
    if (hooks.leaked(t, host)) return void client.end('HTTP/1.1 403 Forbidden\r\n\r\n'); // a key spelled into a host name
    void destination(t.hosts, host, port).then((address) => {
      if (!address) {
        hooks.blocked(t, `${host}:${port}`);
        return void client.end('HTTP/1.1 403 Forbidden\r\n\r\n');
      }
      up = net.connect(Number(port), address, () => {
        client.write('HTTP/1.1 200 Connection Established\r\n\r\n');
        up!.write(head);
        up!.pipe(client);
        // Plain HTTP can arrive in a tunnel too (Node's fetch sends CONNECT host:80): read it for the decoy key.
        // shortcut: no backpressure and a key split across two chunks is missed; fine for requests, revisit for uploads.
        if (port === '443') client.pipe(up!);
        else {
          client.on('data', (c: Buffer) => (hooks.leaked(t, c.toString('latin1')) ? (client.destroy(), up!.destroy()) : up!.write(c)));
          client.on('end', () => up!.end());
        }
      });
      up.on('error', () => client.destroy());
    });
  });
  // A task's open connections to the proxy, each a socket in the box's own process: at most 256 at once.
  const open = new Map<string, number>();
  server.on('connection', (sock: net.Socket) => {
    const t = who(sock);
    if (!t) return;
    const n = open.get(t.id) ?? 0;
    if (n >= MAX_OPEN) return void sock.destroy();
    open.set(t.id, n + 1);
    sock.once('close', () => (open.get(t.id) === 1 ? open.delete(t.id) : open.set(t.id, (open.get(t.id) ?? 1) - 1)));
  });
  server.on('clientError', (_e, sock) => sock.destroy());

  const want = process.env.BOX_PROXY_PORT ?? '8888';
  const ports = want === 'auto' ? Array.from({ length: 88 }, (_, i) => 8800 + i).sort(() => Math.random() - 0.5) : [Number(want)];
  for (const port of ports) {
    const err = await new Promise<NodeJS.ErrnoException | undefined>((resolve) => {
      server.once('error', resolve);
      server.listen(port, '127.0.0.1', () => resolve(undefined));
    });
    if (!err) return port;
    if (err.code !== 'EADDRINUSE' || want !== 'auto') throw err;
  }
  throw new Error('no free proxy port in 8800-8887');
}
