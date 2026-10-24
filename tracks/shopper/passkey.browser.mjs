// A real-browser check of Approve with Face ID (a script for screenshots and for us, not shipped to users).
// Chromium with a virtual authenticator stands in for the phone. A tiny local server serves passkey.js and the
// five passkey routes over passkeys() in a temp folder, on http://localhost.
//
//   NODE_PATH=<a folder with playwright in node_modules> \
//     node --experimental-strip-types --disable-warning=ExperimentalWarning tracks/shopper/passkey.browser.mjs
//
// Playwright is not a dependency of this repo. CHROME=<path> picks a browser binary; SHOT=<file.png> saves a screenshot.
import fs from 'node:fs';
import http from 'node:http';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { passkeys } from './passkey.ts';

const { chromium } = createRequire(import.meta.url)('playwright');
const pk = passkeys(fs.mkdtempSync(path.join(os.tmpdir(), 'passkey-browser-')));
const JS = fs.readFileSync(new URL('./passkey.js', import.meta.url));
// The server builds what gets signed from the subject; the page only names the approval.
const approvals = {
  't1.k1': { question: 'Buy 2 × Hario V60 filters for $17.98? TEST PAYMENT.', costCents: 1798, payee: 'GurtOS Test Store' },
  't1.k2': { question: 'Buy 20 × Hario V60 filters for $179.80? TEST PAYMENT.', costCents: 17980, payee: 'GurtOS Test Store' },
};
const payloadOf = (id) => ({ id, ...approvals[id] });

const PAGE = `<!doctype html><meta charset="utf-8"><title>Approve with Face ID</title>
<body style="font:16px system-ui;margin:2rem;max-width:36rem"><h1>Approve with Face ID</h1><pre id="out">running</pre></body>`;

const routes = {
  'GET /passkey/status': (req) => ({ usable: pk.usable(req.headers.origin ?? `http://${req.headers.host}`), passkeys: pk.list().map(({ device, rpId, createdAt }) => ({ device, rpId, createdAt })) }),
  'POST /passkey/register/options': (req, b) => pk.registerOptions(req.headers.origin, b.device, b.proof),
  'POST /passkey/register': async (req, b) => { const s = await pk.register(req.headers.origin, b.response, b.device); return { device: s.device, rpId: s.rpId }; },
  'POST /passkey/options': (req, b) => {
    if (b.purpose === 'enroll') return pk.options(req.headers.origin, 'enroll', String(b.subject), null);
    if (b.purpose !== 'approval' || !approvals[b.subject]) throw new Error('no such approval');
    return pk.options(req.headers.origin, 'approval', b.subject, payloadOf(b.subject));
  },
  // Test only: the approval's amount changes after the phone signed it.
  'POST /test/raise': () => { approvals['t1.k1'].costCents = 179800; return { ok: true }; },
  'POST /passkey/approve': async (req, b) => {
    if (!approvals[b.approval]) throw new Error('no such approval');
    const who = await pk.verify(req.headers.origin, 'approval', b.approval, payloadOf(b.approval), b.assertion);
    return { approved: true, approval: b.approval, by: who.device, ...who };
  },
};

const server = http.createServer(async (req, res) => {
  const send = (status, type, body) => res.writeHead(status, { 'content-type': type }).end(body);
  if (req.url === '/') return send(200, 'text/html; charset=utf-8', PAGE);
  if (req.url === '/t/shopper/passkey.js') return send(200, 'text/javascript', JS);
  const route = routes[`${req.method} ${req.url.replace(/^\/t\/shopper/, '')}`];
  if (!route) return send(404, 'application/json', '{"error":"not found"}');
  let raw = '';
  for await (const c of req) raw += c;
  try {
    send(200, 'application/json', JSON.stringify(await route(req, raw ? JSON.parse(raw) : {})));
  } catch (e) {
    send(400, 'application/json', JSON.stringify({ error: e.message }));
  }
});
await new Promise((r) => server.listen(0, 'localhost', r));
const port = server.address().port;

const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined });
let failed = false;
try {
  const page = await browser.newPage();
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('WebAuthn.enable');
  const { authenticatorId } = await cdp.send('WebAuthn.addVirtualAuthenticator', {
    options: { protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true },
  });

  await page.goto(`http://localhost:${port}/`);
  const result = await page.evaluate(async () => {
    const pk = await import('/t/shopper/passkey.js');
    const out = { supported: pk.supported() };
    out.enrolled = await pk.enroll('Test phone');
    out.approved = await pk.approve('t1.k1');
    // A signature for the $17.98 approval, sent for the $179.80 one.
    const sig = await pk.sign('approval', 't1.k1');
    const r = await fetch('/t/shopper/passkey/approve', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ approval: 't1.k2', assertion: sig }) });
    out.swapped = { status: r.status, ...(await r.json()) };
    // The phone signed $17.98, then the amount changed to $1,798.00 before the box checked it.
    const sig1 = await pk.sign('approval', 't1.k1');
    await fetch('/t/shopper/test/raise', { method: 'POST' });
    const r1 = await fetch('/t/shopper/passkey/approve', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ approval: 't1.k1', assertion: sig1 }) });
    out.amountChanged = { status: r1.status, ...(await r1.json()) };
    // The same signature sent twice for its own approval: the first passes, the second is refused.
    const sig2 = await pk.sign('approval', 't1.k2');
    const send = () => fetch('/t/shopper/passkey/approve', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ approval: 't1.k2', assertion: sig2 }) }).then(async (x) => ({ status: x.status, ...(await x.json()) }));
    out.first = await send();
    out.replayed = await send();
    // A second passkey without proof is refused.
    try { await pk.enroll('Second phone'); out.secondWithoutProof = 'allowed'; } catch (e) { out.secondWithoutProof = e.message; }
    document.getElementById('out').textContent = JSON.stringify(out, null, 2);
    return out;
  });
  const { credentials } = await cdp.send('WebAuthn.getCredentials', { authenticatorId });
  if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT, fullPage: true });

  // The same page on 127.0.0.1: a browser will not make a passkey for an IP address, so the page falls back to a tap.
  await page.goto(`http://127.0.0.1:${port}/`);
  const onIp = await page.evaluate(async () => {
    const pk = await import('/t/shopper/passkey.js');
    try { await pk.enroll('IP page'); return 'allowed'; } catch (e) { return `supported() ${pk.supported()}: ${e.message}`; }
  });

  console.log(JSON.stringify({ ...result, authenticatorSignCount: credentials[0]?.signCount, onIp }, null, 2));
  const ok = result.supported && result.approved.approved && result.approved.userVerified && result.swapped.status === 400 && result.amountChanged.status === 400 &&
    result.first.approved && result.replayed.status === 400 && result.secondWithoutProof !== 'allowed' && onIp !== 'allowed';
  console.log(ok ? 'PASS: enrolled, approved with a verified signature, and refused a swapped approval, a changed amount, a replay and an unproved enrollment' : 'FAIL');
  failed = !ok;
} finally {
  await browser.close();
  server.close();
}
process.exit(failed ? 1 : 0);
