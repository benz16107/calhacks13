// try.gurtos.com: the public live demo. Each visitor gets a throwaway GurtOS box (try/boxpool.ts). The browser
// only ever talks to this gateway; the gateway forwards a short whitelist of read/approve/undo routes to the
// visitor's box over loopback, always adding X-Forwarded-For so the box treats the request as remote and demands
// the paired token the gateway injected. Task creation, the attack runs and the plug are the gateway's own
// endpoints, built from constants over the box's control socket. Caddy terminates TLS and proxies here.
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import * as pool from './boxpool.ts';
import { classify, PAGES, visitorPage } from './menu.ts';

const PORT = Number(process.env.TRY_PORT ?? 7788); // Caddy proxies to this loopback port
const MAX_BOXES = Number(process.env.TRY_MAX_BOXES ?? 5);
const BODY_MAX = 8 * 1024;
const NEW_PER_HOUR = 3; // new boxes per IP per hour
const ATTACKS_PER_HOUR = 20; // attack runs per IP per hour
const REQ_PER_SEC = 100; // request burst per IP; a normal portal load is ~25 requests at once (fonts, assets, API)
const PLUG_COOLDOWN = 30_000;

// ---------- per-IP limits ----------
const buckets = new Map<string, { t: number; n: number }>(); // req/sec token bucket
const newLog = new Map<string, number[]>(); // box-creation times
const attackLog = new Map<string, number[]>(); // attack-run times
const within = (log: Map<string, number[]>, ip: string, max: number, ms = 3_600_000) => {
  const now = Date.now();
  const arr = (log.get(ip) ?? []).filter((t) => now - t < ms);
  log.set(ip, arr);
  return arr.length < max;
};
const note = (log: Map<string, number[]>, ip: string) => log.get(ip)!.push(Date.now());
function rateOk(ip: string): boolean {
  const now = Date.now();
  const b = buckets.get(ip) ?? { t: now, n: 0 };
  if (now - b.t > 1000) ((b.t = now), (b.n = 0));
  b.n++;
  buckets.set(ip, b);
  return b.n <= REQ_PER_SEC;
}

const clientIp = (req: http.IncomingMessage) => String(req.headers['x-forwarded-for'] ?? '').split(',')[0].trim() || req.socket.remoteAddress || 'unknown';
const cookies = (req: http.IncomingMessage) => Object.fromEntries(String(req.headers.cookie ?? '').split(';').map((c) => c.trim().split('=').map(decodeURIComponent)).filter((p) => p[0]));

async function readBody(req: http.IncomingMessage): Promise<string> {
  let data = '';
  for await (const c of req) {
    data += c;
    if (data.length > BODY_MAX) throw Object.assign(new Error('body too large'), { status: 413 });
  }
  return data;
}
const json = (res: http.ServerResponse, status: number, body: unknown) => res.writeHead(status, { 'content-type': 'application/json' }).end(JSON.stringify(body));

// ---------- the whitelist: what a browser may ask a box ----------
export function allowedToBox(method: string, p: string): boolean {
  if (method === 'GET') {
    if (/^\/(app\.js|app\.css|manifest\.webmanifest|source\.txt)$/.test(p)) return true;
    if (/^\/(icon-\d+\.png)$/.test(p)) return true;
    if (/^\/(assets|kit)\//.test(p)) return true;
    if (p === '/api/health' || p === '/api/system' || p === '/api/setup' || p === '/api/boxes' || p === '/api/apps') return true;
    if (p === '/api/tasks' || p === '/api/approvals') return true;
    if (/^\/api\/tasks\/[\w-]+(\/diff)?$/.test(p)) return true;
    if (/^\/api\/log(\/stream)?(\?|$)/.test(p.split('#')[0])) return true;
    if (/^\/t\//.test(p)) return true; // track pages, read-only (our boxes load no tracks, so these 404)
    return false;
  }
  if (method === 'POST') {
    if (/^\/api\/approvals\/[^/]+$/.test(p.split('?')[0])) return true; // approve or deny
    if (/^\/api\/tasks\/[\w-]+\/undo$/.test(p.split('?')[0])) return true; // undo
    return false;
  }
  return false;
}

/** Forward a request to a visitor's box over loopback, as a remote caller (X-Forwarded-For set). Streams SSE. */
function proxyToBox(b: pool.Box, req: http.IncomingMessage, res: http.ServerResponse, ip: string, body?: string) {
  const headers: http.OutgoingHttpHeaders = { 'x-forwarded-for': ip };
  for (const h of ['authorization', 'content-type', 'accept', 'last-event-id', 'x-box-person']) if (req.headers[h]) headers[h] = req.headers[h] as string;
  const up = http.request({ host: '127.0.0.1', port: b.port, method: req.method, path: req.url, headers }, (r) => {
    res.writeHead(r.statusCode ?? 502, r.headers);
    r.pipe(res);
  });
  up.on('error', () => (res.headersSent ? res.destroy() : res.writeHead(502).end('box unreachable')));
  req.on('close', () => up.destroy());
  up.end(body);
}

// ---------- the console: the real portal, with our controls and the attack overlay injected ----------
let shell = ''; // the injected markup, read once at boot
try {
  shell = fs.readFileSync(new URL('./console.html', import.meta.url).pathname, 'utf8');
} catch {}

async function serveConsole(b: pool.Box, req: http.IncomingMessage, res: http.ServerResponse, ip: string) {
  // Fetch the box's own index.html over loopback, then inject the pairing bootstrap and our console.
  const html = await new Promise<string>((resolve, reject) => {
    http.get({ host: '127.0.0.1', port: b.port, path: '/', headers: { 'x-forwarded-for': ip, accept: 'text/html', authorization: `Bearer ${b.token}` } }, (r) => {
      let t = '';
      r.on('data', (c) => (t += c));
      r.on('end', () => resolve(t));
    }).on('error', reject);
  });
  const boot = `<script>try{localStorage.setItem('pairing',${JSON.stringify(JSON.stringify({ token: b.token, device: { id: 'web', name: 'This browser' }, box: { id: b.id, name: b.name } }))});window.__TRY__={attack:${/attack/.test(req.url ?? '')}}}catch(e){}</script>`;
  const out = html.replace('</head>', `${boot}</head>`).replace('</body>', `${shell}</body>`);
  res.writeHead(200, {
    'content-type': 'text/html; charset=utf-8',
    'content-security-policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self' data:; frame-ancestors 'none'; base-uri 'none'",
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
  }).end(out);
}

function busyPage(res: http.ServerResponse) {
  res.writeHead(503, { 'content-type': 'text/html; charset=utf-8', 'retry-after': '120' }).end(
    `<!doctype html><meta charset=utf-8><title>GurtOS demo is full</title><style>body{font:16px/1.6 system-ui;max-width:32rem;margin:15vh auto;padding:0 1.5rem;color:#1a1a1a;background:#f6f5f2}a{color:#0a5}</style>
<h1>The live demo is full right now</h1><p>Every demo computer is in use (we cap how many run at once so each one stays fast). Try again in a couple of minutes.</p><p>Meanwhile: <a href="https://calhacks.gurtos.com">see the walkthrough and video</a>.</p>`,
  );
}

// ---------- the server ----------
function setSid(res: http.ServerResponse, sid: string) {
  res.setHeader('set-cookie', `try_sid=${sid}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=3600`);
}

const server = http.createServer(async (req, res) => {
  const ip = clientIp(req);
  const url = req.url ?? '/';
  const p = url.split('?')[0];
  const method = req.method ?? 'GET';
  try {
    if (!rateOk(ip)) return void json(res, 429, { error: 'slow down' });

    // Resolve the visitor's box from the session cookie.
    const sid = cookies(req).try_sid;
    let b = sid ? [...boxesBySid.entries()].find(([s]) => s === sid)?.[1] : undefined;
    if (b && !pool.get(b.id)) ((b = undefined), sid && boxesBySid.delete(sid)); // its box was reaped
    if (b) b.lastSeen = Date.now();

    // The console page: create a box if this visitor has none.
    if (method === 'GET' && (p === '/' || p === '/attack')) {
      if (!b) {
        if (pool.count() >= MAX_BOXES) return busyPage(res);
        const live = [...boxesBySid.values()].some((x) => x.ip === ip);
        if (!live && !within(newLog, ip, NEW_PER_HOUR)) return busyPage(res);
        if (live) {
          b = [...boxesBySid.values()].find((x) => x.ip === ip)!; // one live box per IP: reuse it
        } else {
          b = await pool.create(ip);
          note(newLog, ip);
        }
        const ns = randomBytes(9).toString('hex');
        boxesBySid.set(ns, b);
        setSid(res, ns);
      }
      return void (await serveConsole(b, req, res, ip));
    }

    // Our own control endpoints.
    if (p.startsWith('/try/')) {
      if (method === 'GET' && p === '/try/menu') return void json(res, 200, { menu: pool.menu(), pages: pool.pages() });
      if (!b) return void json(res, 409, { error: 'reload the page' });
      if (method === 'POST' && p === '/try/task') {
        const { id } = JSON.parse((await readBody(req)) || '{}');
        const taskId = await pool.startMenu(b, String(id));
        return void json(res, 200, { taskId });
      }
      if (method === 'POST' && p === '/try/plug') {
        if (Date.now() - b.plugAt < PLUG_COOLDOWN) return void json(res, 429, { error: 'just a moment since the last pull' });
        await pool.pullPlug(b);
        return void json(res, 200, { ok: true });
      }
      if (method === 'POST' && p === '/try/attack') {
        if (b.busyAttack) return void json(res, 409, { error: 'an attack is already running' });
        if (!within(attackLog, ip, ATTACKS_PER_HOUR)) return void json(res, 429, { error: 'too many attack runs; try again later' });
        const body = JSON.parse((await readBody(req)) || '{}');
        let pagePath: string;
        let asks: string[];
        if (body.which && PAGES[body.which]) {
          pagePath = `/${body.which}`;
          asks = ['read the box vault', 'send keys to another host'];
        } else {
          const text = String(body.text ?? '').slice(0, 4096);
          if (!text.trim()) return void json(res, 400, { error: 'paste some attack text, or pick a prepared page' });
          b.page = visitorPage(text);
          pagePath = `/u/${b.id}`;
          asks = classify(text);
        }
        note(attackLog, ip);
        const result = await pool.runAttack(b, pagePath, asks);
        return void json(res, 200, result);
      }
      return void json(res, 404, { error: 'no such endpoint' });
    }

    // Everything else is a box route: enforce the whitelist, then forward.
    if (!b) {
      if (p.startsWith('/api/')) return void json(res, 409, { error: 'reload the page' });
      res.writeHead(302, { location: '/' }).end();
      return;
    }
    if (!allowedToBox(method, p)) return void json(res, 403, { error: 'that is not part of the live demo' });
    const body = method === 'POST' ? await readBody(req) : undefined;
    proxyToBox(b, req, res, ip, body);
  } catch (e) {
    const status = (e as { status?: number }).status ?? 500;
    if (!res.headersSent) json(res, status, { error: (e as Error).message });
  }
});

// sid -> box. Kept here (not in the pool) because a box can outlive a session and vice versa.
const boxesBySid = new Map<string, pool.Box>();

// On shutdown (a restart is the scheduled reset), tear down every box so nothing leaks and the next start is clean.
let shuttingDown = false;
function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  try {
    pool.destroyAll();
  } catch {}
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Start the servers only when run as the entry point, so tests can import the pure helpers above.
import { fileURLToPath } from 'node:url';
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  pool.reapRoot();
  pool.startFakeWeb();
  server.listen(PORT, '127.0.0.1', () => console.log(`try gateway on 127.0.0.1:${PORT}`));
  setInterval(() => pool.reap(), 60_000);
}
