// Spike 5: Droid's door to Factory. The task's droid has only a placeholder key and FACTORY_API_BASE_URL
// pointing here. This swaps in the real key from its own environment and forwards to api.factory.ai.
import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs';

const REAL = process.env.FACTORY_REAL_KEY ?? '';
const UPSTREAM = 'api.factory.ai';

function peerUid(sock) {
  const want = `0100007F:${sock.remotePort.toString(16).toUpperCase().padStart(4, '0')}`;
  const row = fs.readFileSync('/proc/net/tcp', 'utf8').split('\n').map(l => l.trim().split(/\s+/)).find(f => f[1] === want);
  return row ? Number(row[7]) : -1;
}

http.createServer((req, res) => {
  const uid = peerUid(req.socket);
  if (uid < 30000 || uid > 39999) { res.writeHead(403).end('tasks only\n'); return; }
  const headers = { ...req.headers, host: UPSTREAM, authorization: `Bearer ${REAL}` };
  const up = https.request({ host: UPSTREAM, path: req.url, method: req.method, headers }, r => {
    console.log(JSON.stringify({ t: new Date().toISOString(), uid, m: req.method, url: req.url, status: r.statusCode }));
    res.writeHead(r.statusCode, r.headers); r.pipe(res);
  });
  up.on('error', e => { console.log(JSON.stringify({ uid, url: req.url, error: e.message })); res.writeHead(502).end(); });
  req.pipe(up);
}).listen(7799, '127.0.0.1', () => console.log('broker on 127.0.0.1:7799'));
