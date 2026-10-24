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

/** Load the firewall rule. Same rule for every box on the machine, so loading it again is harmless. */
export function firewall() {
  const rules = `add table inet box
delete table inet box
table inet box {
  chain out {
    type filter hook output priority filter; policy accept;
    meta skuid ${TASK_UIDS} ip daddr 127.0.0.1 tcp dport ${PROXY_PORTS} accept
    meta skuid ${TASK_UIDS} counter log prefix "box-block " reject
  }
}
`;
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'box-nft-')), 'rules.nft'); // nft -f wants a real file
  fs.writeFileSync(file, rules);
  execFileSync('nft', ['-f', file]);
  fs.rmSync(path.dirname(file), { recursive: true });
}

/**
 * The box's own CA and a *.factory.ai certificate signed by it. The CA key never leaves BOX_HOME/ca (root
 * only); the CA certificate is public, at BOX_HOME/relay-ca.pem, for Droid tasks to trust.
 */
export function relayCert(home: string) {
  const dir = path.join(home, 'ca');
  const caPem = path.join(home, 'relay-ca.pem');
  if (!fs.existsSync(path.join(dir, 'leaf.pem'))) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    const ssl = (...args: string[]) => execFileSync('openssl', args, { cwd: dir, stdio: 'pipe' });
    const ec = ['-newkey', 'ec', '-pkeyopt', 'ec_paramgen_curve:prime256v1', '-nodes'];
    ssl('req', '-x509', ...ec, '-keyout', 'ca.key', '-out', 'ca.pem', '-days', '3650', '-subj', '/CN=Box relay CA');
    ssl('req', ...ec, '-keyout', 'leaf.key', '-out', 'leaf.csr', '-subj', '/CN=factory.ai');
    fs.writeFileSync(path.join(dir, 'san.ext'), 'subjectAltName=DNS:factory.ai,DNS:*.factory.ai\n');
    ssl('x509', '-req', '-in', 'leaf.csr', '-CA', 'ca.pem', '-CAkey', 'ca.key', '-CAcreateserial', '-out', 'leaf.pem', '-days', '3650', '-extfile', 'san.ext');
    fs.copyFileSync(path.join(dir, 'ca.pem'), caPem);
    fs.chmodSync(caPem, 0o644);
  }
  return { key: fs.readFileSync(path.join(dir, 'leaf.key')), cert: fs.readFileSync(path.join(dir, 'leaf.pem')), caPem };
}

/** The uid that owns the other end of a loopback connection, from /proc/net/tcp. */
function uidOf(sock: net.Socket): number | undefined {
  const hex = (port: number) => `0100007F:${port.toString(16).toUpperCase().padStart(4, '0')}`;
  const [client, server] = [hex(sock.remotePort ?? 0), hex(sock.localPort ?? 0)];
  for (const line of fs.readFileSync('/proc/net/tcp', 'utf8').split('\n').slice(1)) {
    const f = line.trim().split(/\s+/);
    if (f[1] === client && f[2] === server) return Number(f[7]);
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

/** An address on the box itself: loopback, link-local, or one of its own interfaces. */
function onTheBox(ip: string) {
  const v4 = ip.replace(/^::ffff:/, '');
  if (/^(127\.|0\.|169\.254\.)/.test(v4) || ip === '::1' || ip === '::' || /^fe80:/i.test(ip)) return true;
  return Object.values(os.networkInterfaces()).flat().some((i) => i?.address === ip || i?.address === v4);
}

/**
 * The address a task may connect to for host:port, resolved once so the name cannot change in between.
 * A name that lands on the box itself needs host:port listed exactly, and never reaches a box port.
 */
export async function destination(hosts: string[], host: string, port: string): Promise<string | undefined> {
  if (!allowed(hosts, host, port)) return;
  const address = (await dns.lookup(host).catch(() => undefined))?.address;
  if (!address) return;
  if (onTheBox(address) && (!hosts.includes(`${host}:${port}`) || boxPort(Number(port)))) return;
  return address;
}

export interface ProxyHooks {
  taskOf(uid: number): Task | undefined;
  blocked(task: Task, host: string): void;
  factoryKey(): string | undefined;
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
  const forward = (req: http.IncomingMessage, res: http.ServerResponse, up: http.ClientRequest) => {
    req.on('error', () => res.destroy());
    up.on('response', (r) => {
      r.on('error', () => res.destroy());
      res.writeHead(r.statusCode ?? 502, r.headers);
      r.pipe(res);
    });
    up.on('error', () => fail(res, 502, 'upstream failed'));
    req.pipe(up);
  };

  /** A call to Factory from a Droid task: the placeholder key becomes the real one, and only here. */
  const toFactory = (req: http.IncomingMessage, res: http.ServerResponse, host: string) => {
    const key = hooks.factoryKey();
    if (!key) return fail(res, 503, 'the vault has no FACTORY_API_KEY');
    const headers: http.OutgoingHttpHeaders = { host };
    for (const [name, value] of Object.entries(req.headers)) {
      if (value !== undefined && name !== 'host') headers[name] = Array.isArray(value) ? value : value.replaceAll(PLACEHOLDER_KEY, key);
    }
    forward(req, res, https.request({ host, path: req.url, method: req.method, headers }));
  };

  // HTTPS to Factory, after the proxy has answered TLS itself. The task was checked at CONNECT.
  const relay = http.createServer((req, res) => {
    const host = (req.headers.host ?? '').split(':')[0];
    if (!FACTORY.test(host)) return fail(res, 403, 'not a Factory host');
    toFactory(req, res, host);
  });

  const server = http.createServer((req, res) => {
    const t = who(req.socket);
    if (!t) return fail(res, 403, 'not a task');
    // FACTORY_API_BASE_URL points here, so Droid's API calls arrive as plain paths.
    if (req.url?.startsWith('/')) {
      if (t.worker !== 'droid') return fail(res, 403, 'no Factory access for this task');
      return toFactory(req, res, 'api.factory.ai');
    }
    // Plain HTTP through the proxy.
    let url: URL;
    try {
      url = new URL(req.url ?? '');
    } catch {
      return fail(res, 400, 'bad url');
    }
    const port = url.port || '80';
    void destination(t.hosts, url.hostname, port).then((address) => {
      if (!address) {
        hooks.blocked(t, `${url.hostname}:${port}`);
        return fail(res, 403, 'blocked by the box');
      }
      const headers = { ...req.headers, host: url.host };
      forward(req, res, http.request({ host: address, port, path: url.pathname + url.search, method: req.method, headers }));
    });
  });

  // HTTPS through the proxy: the task asks for a tunnel to host:port.
  server.on('connect', (req: http.IncomingMessage, client: net.Socket, head: Buffer) => {
    let up: net.Socket | undefined;
    client.on('error', () => up?.destroy());
    const t = who(client);
    const [host, port = '443'] = (req.url ?? '').split(':');
    if (t?.worker === 'droid' && FACTORY.test(host) && port === '443') {
      client.write('HTTP/1.1 200 Connection Established\r\n\r\n');
      if (head.length) client.unshift(head);
      const secure = new tls.TLSSocket(client, { isServer: true, ...cert });
      secure.on('error', () => client.destroy());
      return void relay.emit('connection', secure);
    }
    if (!t) return void client.end('HTTP/1.1 403 Forbidden\r\n\r\n');
    void destination(t.hosts, host, port).then((address) => {
      if (!address) {
        hooks.blocked(t, `${host}:${port}`);
        return void client.end('HTTP/1.1 403 Forbidden\r\n\r\n');
      }
      up = net.connect(Number(port), address, () => {
        client.write('HTTP/1.1 200 Connection Established\r\n\r\n');
        up!.write(head);
        up!.pipe(client);
        client.pipe(up!);
      });
      up.on('error', () => client.destroy());
    });
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
