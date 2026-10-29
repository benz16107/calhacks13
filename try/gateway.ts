// The public live demo (try.gurtos.com when ours is running). Each visitor gets a throwaway GurtOS box (try/boxpool.ts). The browser
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
const NEW_PER_HOUR = 10; // new boxes per IP per hour (visitors at one event or office share an address); total cap still bounds it
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

// A request the browser marks as coming from our own page: the fetch Metadata header, or an Origin matching the
// host. A cross-site form post, a crawler or a bare curl fails this, so none of them can allocate or drive a box.
function sameSite(req: http.IncomingMessage): boolean {
  const sf = req.headers['sec-fetch-site'];
  if (typeof sf === 'string') return sf === 'same-origin' || sf === 'same-site';
  const origin = req.headers.origin;
  if (!origin) return false;
  const host = String(req.headers['x-forwarded-host'] ?? req.headers.host ?? '').split(',')[0].trim();
  return origin === `https://${host}` || origin === `http://${host}`;
}
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
// This visitor has no box any more (wiped when idle, too old, or a host reset). The header lets the page tell it apart from other 409s.
const gone = (res: http.ServerResponse) => res.writeHead(409, { 'content-type': 'application/json', 'x-try-gone': '1' }).end(JSON.stringify({ error: 'This demo computer was reset. Reload for a new one.' }));

const PORTAL_DIST = fileURLToPath(new URL('../portal/dist/', import.meta.url));
const MIME: Record<string, string> = { '.webmanifest': 'application/manifest+json', '.png': 'image/png' };
/** Serve a static portal file from disk (manifest, icons) by its exact basename. No path traversal: basename only. */
function serveStatic(res: http.ServerResponse, p: string) {
  const file = path.join(PORTAL_DIST, path.basename(p));
  fs.readFile(file, (err, data) => {
    if (err) return void res.writeHead(404).end('not found');
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] ?? 'application/octet-stream', 'cache-control': 'public, max-age=3600' }).end(data);
  });
}

// ---------- the whitelist: what a browser may ask a box ----------
export function allowedToBox(method: string, p: string): boolean {
  if (method === 'GET') {
    if (/^\/(app\.js|app\.css|manifest\.webmanifest|source\.txt|sw\.js)$/.test(p)) return true;
    if (/^\/(icon-\d+\.png)$/.test(p)) return true;
    if (/^\/(assets|kit)\//.test(p)) return true;
    if (p === '/api/health' || p === '/api/system' || p === '/api/setup' || p === '/api/boxes' || p === '/api/apps') return true;
    // Read-only and not secret: these let the real desktop render fully (no console 403s). Mutating them stays blocked.
    if (p === '/api/settings' || p === '/api/owner') return true;
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

/** The landing page. Served on a plain GET with no box: it allocates nothing, so a crawler, a link preview or a
 * health check never claims a slot. A box is created only when the visitor clicks a button (a same-site POST). */
function landingPage(count: number): string {
  const full = count >= MAX_BOXES;
  return `<!doctype html><html lang=en><head><meta charset=utf-8><meta name=viewport content="width=device-width, initial-scale=1">
<title>GurtOS live demo</title><meta name=robots content="noindex">
<style>
 :root{color-scheme:dark}
 body{font:16px/1.6 system-ui,sans-serif;margin:0;background:#141414;color:#f2f2f2}
 .wrap{max-width:40rem;margin:0 auto;padding:4rem 1.5rem 3rem}
 h1{font-size:2rem;margin:0 0 .5rem} .tag{color:#9a9a9a;margin:0 0 2rem}
 .row{display:flex;gap:.75rem;flex-wrap:wrap;margin:1.5rem 0}
 button{font:600 15px system-ui;border-radius:.5rem;padding:.7rem 1.1rem;border:1px solid #333;cursor:pointer;background:#2a2a2a;color:#f2f2f2}
 button.go{background:#0a5c3a;border-color:#0d7a4d} button.atk{background:#1e1e1e}
 button:disabled{opacity:.5;cursor:not-allowed}
 .slots{color:#9a9a9a;font-size:14px;margin:.5rem 0 0}
 .care{margin-top:2.5rem;border-top:1px solid #2a2a2a;padding-top:1.25rem;color:#b9b9b9;font-size:14px}
 .care li{margin:.35rem 0} a{color:#4ab88a}
 #msg{min-height:1.4em;color:#e6a;margin-top:.5rem}
</style></head><body><div class=wrap>
 <h1>GurtOS live demo</h1>
 <p class=tag>Get your own throwaway GurtOS computer in the browser. Wiped after 20 idle minutes.</p>
 <div class=row>
   <button class=go id=start ${full ? 'disabled' : ''}>Start the demo</button>
   <button class=atk id=attack ${full ? 'disabled' : ''}>Attack it yourself</button>
 </div>
 <p class=slots id=slots>${count} of ${MAX_BOXES} demo computers in use.${full ? ' All in use right now, try again in a moment.' : ''}</p>
 <div id=msg></div>
 <div class=care>
   <b>What this is</b>
   <ul>
     <li>A real GurtOS box, just for you. Start a task, approve or deny it, undo it, or pull the plug.</li>
     <li>Or attack it: paste prompt-injection text and watch each defence stop it, with the log lines.</li>
     <li>The worker is scripted. No AI model runs, and there are no real keys anywhere on this host.</li>
     <li>The defences are the real operating system. The agent is acted out, so this does not test the model itself.</li>
   </ul>
   <p>More: <a href="https://gurtos.com">what GurtOS is, and how to install it</a>.</p>
 </div>
</div>
<script>
 async function start(where){
   var m=document.getElementById('msg'); m.textContent='Starting your computer...';
   document.getElementById('start').disabled=true; document.getElementById('attack').disabled=true;
   try{
     var r=await fetch('/try/start',{method:'POST',headers:{'content-type':'application/json'}});
     var d=await r.json().catch(function(){return {};});
     if(r.ok){ location.href=where; return; }
     m.textContent=d.error||'could not start'; refresh();
   }catch(e){ m.textContent='could not start'; refresh(); }
 }
 async function refresh(){
   try{ var d=await (await fetch('/try/slots')).json();
     document.getElementById('slots').textContent=d.count+' of '+d.max+' demo computers in use.'+(d.count>=d.max?' All in use right now, try again in a moment.':'');
     var f=d.count>=d.max; document.getElementById('start').disabled=f; document.getElementById('attack').disabled=f;
   }catch(e){}
 }
 document.getElementById('start').onclick=function(){start('/')};
 document.getElementById('attack').onclick=function(){start('/attack')};
 refresh();
</script></body></html>`;
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

    // A plain GET never allocates a box (so a crawler, a link preview or a health check cannot claim a slot):
    // with a live box it shows the console, otherwise the landing page. HEAD is answered empty, never allocating.
    if (method === 'HEAD') return void res.writeHead(200).end();
    // The manifest and icons are fetched by the browser without credentials (no cookie), so they can't go through
    // the per-box proxy. They are identical for every box and hold nothing private: serve them from disk.
    if (method === 'GET' && /^\/(manifest\.webmanifest|icon-\d+\.png)$/.test(p)) return void serveStatic(res, p);
    if (method === 'GET' && (p === '/' || p === '/attack')) {
      if (b) return void (await serveConsole(b, req, res, ip));
      return void res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'referrer-policy': 'no-referrer' }).end(landingPage(pool.count()));
    }

    // Our own control endpoints.
    if (p.startsWith('/try/')) {
      if (method === 'GET' && p === '/try/menu') return void json(res, 200, { menu: pool.menu(), pages: pool.pages() });
      if (method === 'GET' && p === '/try/slots') return void json(res, 200, { count: pool.count(), max: MAX_BOXES });
      // Allocate a box only here: an explicit same-site POST from the landing's "Start" or "Attack" button.
      if (method === 'POST' && p === '/try/start') {
        if (!sameSite(req)) return void json(res, 403, { error: 'start the demo from the page' });
        if (!b) {
          // Each browser session gets its own box (visitors on one network share an address, so never hand a new
          // visitor someone else's box). The total cap and the per-IP hourly limit still bound abuse.
          if (pool.count() >= MAX_BOXES) return void json(res, 503, { error: 'all demo computers are in use; try again in a moment', count: pool.count(), max: MAX_BOXES });
          if (!within(newLog, ip, NEW_PER_HOUR)) return void json(res, 429, { error: 'you have started a few already; try again in a bit' });
          b = await pool.create(ip);
          note(newLog, ip);
          const ns = randomBytes(9).toString('hex');
          boxesBySid.set(ns, b);
          setSid(res, ns);
        }
        b.interacted = true; // an explicit Start is a real interaction, so the 2-minute sweep won't reclaim it
        return void json(res, 200, { ok: true });
      }
      if (!b) return void gone(res);
      if (!sameSite(req)) return void json(res, 403, { error: 'use the demo from the page' });
      b.interacted = true;
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
      if (p.startsWith('/api/')) return void gone(res);
      res.writeHead(302, { location: '/' }).end();
      return;
    }
    if (!allowedToBox(method, p)) return void json(res, 403, { error: 'that is not part of the live demo' });
    if (p.startsWith('/api/') || p.startsWith('/t/')) b.interacted = true; // a real browser driving the box
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
  setInterval(() => pool.reap(), 30_000); // often enough for the 2-minute no-interaction sweep to free slots
}
