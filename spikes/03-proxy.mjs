// Spike 3: the one door out for tasks. An HTTP proxy that allows named domains per task.
// It tells which task is calling from the socket owner's uid (read from /proc/net/tcp), so tasks carry no token.
import http from 'node:http';
import net from 'node:net';
import fs from 'node:fs';

const ALLOW = { 30001: ['registry.npmjs.org'], 30002: ['example.com'] }; // uid -> allowed hosts
const PORT = 8888;

function peerUid(sock) {
  // The client's socket is the row whose local address is the client's ip:port.
  const want = `0100007F:${sock.remotePort.toString(16).toUpperCase().padStart(4, '0')}`;
  for (const line of fs.readFileSync('/proc/net/tcp', 'utf8').split('\n').slice(1)) {
    const f = line.trim().split(/\s+/);
    if (f[1] === want) return Number(f[7]);
  }
  return -1;
}
const allowed = (uid, host) => (ALLOW[uid] ?? []).includes(host);
const log = (uid, verb, host, ok) => console.log(JSON.stringify({ t: new Date().toISOString(), uid, verb, host, ok }));

const server = http.createServer((req, res) => {           // plain http://host/path through the proxy
  const uid = peerUid(req.socket), url = new URL(req.url);
  if (!allowed(uid, url.hostname)) { log(uid, req.method, url.hostname, false); res.writeHead(403).end('blocked by box\n'); return; }
  log(uid, req.method, url.hostname, true);
  const up = http.request(url, { method: req.method, headers: req.headers }, r => { res.writeHead(r.statusCode, r.headers); r.pipe(res); });
  up.on('error', e => res.writeHead(502).end(String(e))); req.pipe(up);
});
server.on('connect', (req, sock, head) => {                 // https via CONNECT host:443
  const uid = peerUid(sock), [host, port = '443'] = req.url.split(':');
  if (!allowed(uid, host)) { log(uid, 'CONNECT', host, false); sock.end('HTTP/1.1 403 Forbidden\r\n\r\n'); return; }
  log(uid, 'CONNECT', host, true);
  const up = net.connect(Number(port), host, () => { sock.write('HTTP/1.1 200 Connection Established\r\n\r\n'); up.write(head); up.pipe(sock); sock.pipe(up); });
  up.on('error', () => sock.destroy()); sock.on('error', () => up.destroy());
});
server.listen(PORT, '127.0.0.1', () => console.log(`proxy on 127.0.0.1:${PORT}`));
