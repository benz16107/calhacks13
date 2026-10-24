// Each task's network. A firewall rule lets task users reach nothing but this proxy, and the proxy lets each
// task reach only its own hosts. It knows the caller by the uid that owns the connection, so tasks carry
// no token. It also relays Droid's Factory API calls and adds the vault's key on the way, so a task only
// ever holds a placeholder key.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import type { Task } from './contract.ts';

export const PROXY_PORT = Number(process.env.BOX_PROXY_PORT ?? 8888);
const PROXY_PORTS = '8800-8899'; // the installed box uses 8888; demo runs pick from 8800-8887
export const TASK_UIDS = '30000-39999'; // the range sandbox.ts gives task users

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

export interface ProxyHooks {
  taskOf(uid: number): Task | undefined;
  blocked(task: Task, host: string): void;
  factoryKey(): string | undefined;
}

export function startProxy(hooks: ProxyHooks) {
  const who = (sock: net.Socket) => {
    const uid = uidOf(sock);
    return uid === undefined ? undefined : hooks.taskOf(uid);
  };

  const server = http.createServer((req, res) => {
    const t = who(req.socket);
    if (!t) return void res.writeHead(403).end('not a task');
    const pipeBack = (up: http.IncomingMessage) => {
      res.writeHead(up.statusCode ?? 502, up.headers);
      up.pipe(res);
    };

    // Droid's own calls: FACTORY_API_BASE_URL points here. Swap the placeholder for the real key.
    if (req.url?.startsWith('/')) {
      const key = hooks.factoryKey();
      if (t.worker !== 'droid' || !key) return void res.writeHead(403).end('no Factory access for this task');
      const up = https.request(
        { host: 'api.factory.ai', path: req.url, method: req.method, headers: { ...req.headers, host: 'api.factory.ai', authorization: `Bearer ${key}` } },
        pipeBack,
      );
      up.on('error', () => res.destroy());
      return void req.pipe(up);
    }

    // Plain HTTP through the proxy.
    // shortcut: an allowed name that resolves to 127.0.0.1 reaches local services; block private addresses before real use.
    const url = new URL(req.url ?? '');
    if (!allowed(t.hosts, url.hostname, url.port || '80')) {
      hooks.blocked(t, url.host);
      return void res.writeHead(403).end('blocked by the box');
    }
    const up = http.request(url, { method: req.method, headers: req.headers }, pipeBack);
    up.on('error', () => res.writeHead(502).end());
    req.pipe(up);
  });

  // HTTPS through the proxy: the task asks for a tunnel to host:port.
  server.on('connect', (req: http.IncomingMessage, client: net.Socket, head: Buffer) => {
    const t = who(client);
    const [host, port = '443'] = (req.url ?? '').split(':');
    if (!t || !allowed(t.hosts, host, port)) {
      if (t) hooks.blocked(t, `${host}:${port}`);
      return void client.end('HTTP/1.1 403 Forbidden\r\n\r\n');
    }
    const up = net.connect(Number(port), host, () => {
      client.write('HTTP/1.1 200 Connection Established\r\n\r\n');
      up.write(head);
      up.pipe(client);
      client.pipe(up);
    });
    up.on('error', () => client.destroy());
    client.on('error', () => up.destroy());
  });

  server.listen(PROXY_PORT, '127.0.0.1');
  return server;
}
