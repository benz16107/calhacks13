// Remote access and push, in ./demo. Offline by default: a relay in this process (names, the frps plugin, the push
// gateway) with a stand-in push service, the box's push encryption read back by a stand-in phone, and the box's own
// API for remote access and notifications. DEMO_LIVE=remote adds the real thing: this demo box enrolls a name with
// the real relay (BOX_RELAY, default box.gurtos.com), gets its own certificate, answers at https://<name>.<relay>, sends a real push through
// the gateway and Mozilla's push service to a stand-in phone, then releases the name.
import { execFileSync } from 'node:child_process';
import { createECDH, createHmac, randomBytes } from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import type { DemoKit } from '../core/contract.ts';
import { send } from '../core/push.ts';
import { keyPair, open as openSealed, phrase } from '../core/quickstart.ts';
import { APP, RELAY, nameProblem as boxRule } from '../core/remote.ts';
import { DOMAIN, RESERVED, load, nameProblem as relayRule, serve } from './server.ts';
import { decrypt, testPhone } from './testphone.ts';

const LIVE = /\bremote\b/.test(process.env.DEMO_LIVE ?? '');
const listening = (s: http.Server) => new Promise<number>((r) => (s.listening ? r((s.address() as any).port) : s.once('listening', () => r((s.address() as any).port))));
const macOk = (msg: string, key: string) => {
  const { mac, ...rest } = JSON.parse(msg);
  return mac === createHmac('sha256', Buffer.from(key, 'base64url')).update(JSON.stringify(rest)).digest('base64url');
};

export default async function (d: DemoKit) {
  // ---------- names ----------
  const tries = ['rosa', 'ab', 'ben-laptop', 'Rosa', 'x'.repeat(31), '-a-b', 'a--b', 'xn--abc', 'www', 'relay', 'app', 'shop-42'];
  d.check(tries.every((n) => !!relayRule(n) === (!!boxRule(n) || RESERVED.has(n))), 'the box and the relay agree on names: lowercase, 3 to 30 characters, reserved names blocked');

  // ---------- a relay in this process ----------
  const relayDir = fs.mkdtempSync(path.join(os.tmpdir(), 'relay-demo-'));
  const relay = load(relayDir);
  const { pluginServer, apiServer } = serve(relay, 0, 0);
  const gw = `http://127.0.0.1:${await listening(apiServer)}`;
  const frp = `http://127.0.0.1:${await listening(pluginServer)}/frp`;
  const pushed: { headers: http.IncomingHttpHeaders; body: Buffer }[] = [];
  const pushService = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (c) => chunks.push(c)).on('end', () => (pushed.push({ headers: req.headers, body: Buffer.concat(chunks) }), res.writeHead(201).end()));
  });
  pushService.listen(0, '127.0.0.1');
  const pushPort = await listening(pushService);
  relay.testPushHosts = [new RegExp(`^127\\.0\\.0\\.1:${pushPort}$`)];
  try {
    const post = async (url: string, body: unknown, auth?: string) => {
      const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', ...(auth ? { authorization: auth } : {}) }, body: JSON.stringify(body) });
      return { status: r.status, body: (await r.json()) as any };
    };
    const name = `demo-${randomBytes(3).toString('hex')}`;
    const enrolled = await post(`${gw}/v1/names`, { name });
    const secret = enrolled.body.secret;
    d.check(enrolled.status === 200 && secret?.length >= 40 && !JSON.stringify(relay.names.all).includes(secret), 'a box enrolls a name and gets a secret; the relay keeps only its hash');
    d.check((await post(`${gw}/v1/names`, { name })).status === 409 && (await post(`${gw}/v1/names`, { name: 'www' })).status === 400, 'a taken name and a reserved name are refused');

    // What frps asks before a box logs in or opens a route.
    const ask = async (op: string, content: unknown) => (await post(`${frp}?op=${op}&version=0.1.0`, { version: '0.1.0', op, content })).body;
    const as = (s: string) => ({ user: name, metas: { secret: s } });
    d.check((await ask('Login', { ...as(secret) })).reject === false && (await ask('Login', { ...as('wrong') })).reject === true, 'the tunnel accepts a box only with its own secret');
    const own = await ask('NewProxy', { user: as(secret), proxy_type: 'https', custom_domains: [`${name}.${DOMAIN}`] });
    d.check(own.reject === false && own.content.bandwidth_limit_mode === 'server', "a box may route its own name (HTTPS passed through by SNI), with the relay's bandwidth limit");
    const other = await ask('NewProxy', { user: as(secret), proxy_type: 'https', custom_domains: [`rosa.${DOMAIN}`] });
    const tcp = await ask('NewProxy', { user: as(secret), proxy_type: 'tcp', remote_port: 22 });
    d.check(other.reject === true && tcp.reject === true, "a box can't take another box's name or open a raw port");

    // A push: the box encrypts it for the phone, the gateway signs it and forwards it, the phone decrypts it.
    const phone = createECDH('prime256v1');
    phone.generateKeys();
    const auth = randomBytes(16);
    const sub = { endpoint: `http://127.0.0.1:${pushPort}/push/1`, p256dh: phone.getPublicKey().toString('base64url'), auth: auth.toString('base64url'), key: randomBytes(32).toString('base64url'), at: '' };
    const fields = { v: 1, type: 'approval', machine: 'demo-box', box: 'Demo box', url: `https://${name}.${DOMAIN}`, id: 't1.k1', task: 't1', title: 'Approve $20.00 to Box Test Store?', body: 'Buy the USB-C cable', costCents: 2000 };
    await send(gw, name, secret, sub, fields, 't1.k1');
    const got = pushed.at(-1)!;
    const text = decrypt(got.body, phone.getPrivateKey(), auth);
    d.check(JSON.parse(text).id === 't1.k1' && macOk(text, sub.key), 'a push decrypts on the phone it was made for, and its mac checks with that phone key for this box');
    d.check(!got.body.includes(Buffer.from('USB-C')) && got.headers['content-encoding'] === 'aes128gcm' && /^vapid t=.+, k=/.test(String(got.headers.authorization)), 'the gateway forwards ciphertext only (it never had the keys), signed with the app VAPID key');
    const forged = await post(`${gw}/v1/push`, { endpoint: sub.endpoint, payload: got.body.toString('base64url') }, `Bearer ${name}.wrong`);
    const elsewhere = await post(`${gw}/v1/push`, { endpoint: 'https://example.com/steal', payload: got.body.toString('base64url') }, `Bearer ${name}.${secret}`);
    d.check(forged.status === 403 && elsewhere.status === 400, "the gateway refuses a box without its secret, and sends only to real push services");
  } finally {
    pluginServer.close();
    apiServer.close();
    pushService.close();
    fs.rmSync(relayDir, { recursive: true, force: true }); // it holds the stand-in relay's keys; every run used to leave one in /tmp
  }

  // ---------- the box's own API ----------
  const raw = async (method: string, p: string, body?: unknown, headers: Record<string, string> = {}) => {
    const r = await fetch(`${d.url}${p}`, { method, headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...headers }, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, headers: r.headers, body: (await r.json().catch(() => ({}))) as any };
  };
  const off = await raw('GET', '/api/remote');
  d.check(off.body.enabled === false && off.body.state === 'off', 'remote access is off until the owner turns it on');
  const code = (await d.api('POST', '/pair/start', {})).code;
  const paired = await raw('POST', '/api/pair', { code, name: "Judge's phone" });
  const phoneH = { authorization: `Bearer ${paired.body.token}`, 'x-forwarded-for': '203.0.113.7' }; // as if through the box's TLS proxy
  const p256dh = (() => { const e = createECDH('prime256v1'); e.generateKeys(); return e.getPublicKey().toString('base64url'); })();
  const subscription = { endpoint: 'https://updates.push.services.mozilla.com/wpush/v2/demo', keys: { p256dh, auth: randomBytes(16).toString('base64url') } };
  const put = await raw('PUT', '/api/push', { subscription, key: randomBytes(32).toString('base64url') }, phoneH);
  const bad = await raw('PUT', '/api/push', { subscription, key: 'short' }, phoneH);
  d.check(put.body.subscribed === true && (await raw('GET', '/api/push', undefined, phoneH)).body.subscribed === true && bad.status === 400 && /key/.test(bad.body.error), 'a paired phone turns notifications on; a bad subscription is refused by field');
  const test = await raw('POST', '/api/push/test', {}, phoneH);
  d.check(test.status === 409 && /Reach this box from anywhere/.test(test.body.error), 'with remote access off, a test push says to turn it on first (pushes go through the relay)');
  const notOwner = await raw('POST', '/api/remote', { name: 'judge-box' }, phoneH);
  const noToken = await raw('GET', '/api/push', undefined, { 'x-forwarded-for': '203.0.113.7' });
  d.check(notOwner.status === 403 && noToken.status === 401, "only the owner turns remote access on, and nothing answers without a paired phone's token");
  d.check((await raw('POST', '/api/remote', { name: 'ab' })).status === 400, 'a bad name is refused before the relay is asked');
  const cors = await fetch(`${d.url}/api/tasks`, { method: 'OPTIONS', headers: { origin: APP, 'access-control-request-method': 'GET', 'access-control-request-headers': 'authorization' } });
  const evil = await fetch(`${d.url}/api/tasks`, { method: 'OPTIONS', headers: { origin: 'https://evil.example', 'access-control-request-method': 'GET' } });
  d.check(cors.headers.get('access-control-allow-origin') === APP && !evil.headers.get('access-control-allow-origin'), 'the GurtOS app (the app address) may call the box from the browser; other sites may not');
  d.check((await raw('DELETE', '/api/push', undefined, phoneH)).body.subscribed === false, 'the phone turns notifications off');
  const forgot = await raw('DELETE', '/api/pair/self', undefined, phoneH);
  d.check(forgot.body.revoked === true && (await raw('GET', '/api/push', undefined, phoneH)).status === 401, 'a phone that forgets the box revokes its own pairing');

  // ---------- the setup QR: what a phone gets when it scans it ----------
  // The QR must open somewhere every phone can reach, whatever network it is on and before remote access is on:
  // the GurtOS app, with the code in the fragment and a rendezvous id, never the box's own private address.
  const setupDone = (await d.api('GET', '/setup')).done;
  const frag = (u: URL) => new URLSearchParams(u.hash.slice(1));
  if (!setupDone) await d.api('POST', '/setup/finish', {});
  const after = new URL((await d.api('POST', '/pair/start', { owner: true })).url);
  d.check(after.origin === APP && !frag(after).get('rv') && !after.search, 'after setup, a pairing link has no rendezvous id, so no code can switch remote access on, and nothing about the box rides in the query (which reaches server logs)');
  await d.api('POST', '/setup/reopen', {});
  let start: any, link: URL, qrText: string | undefined;
  try {
    start = await d.api('POST', '/pair/start', { owner: true });
    qrText = qrRoundTrip(start.url);
    link = new URL(qrText ?? start.url);
  } finally {
    await d.api('POST', '/setup/finish', {});
  }
  d.check(qrText === undefined || qrText === start.url, qrText === undefined ? '(qrencode and zbarimg are not on this machine: the QR image itself was not decoded)' : 'the setup QR, drawn and read back, holds exactly the link the box gave');
  d.check(link.origin === APP && link.pathname === '/pair' && !link.search && frag(link).get('code') === start.code && (frag(link).get('rv') ?? '').length >= 22, 'during setup, with remote access off, the QR opens the GurtOS app with the code and a rendezvous id in the fragment, not an address only the box\'s own network can reach');
  const viaQr = await raw('POST', '/api/pair', { code: frag(link).get('code'), name: 'Phone from the QR' });
  const qrPhone = { authorization: `Bearer ${viaQr.body.token}`, 'x-forwarded-for': '203.0.113.8' };
  d.check(viaQr.status === 200 && (await raw('GET', '/api/tasks', undefined, qrPhone)).status === 200, 'the code read from the QR pairs a phone with the box');
  await raw('DELETE', '/api/pair/self', undefined, qrPhone);
  if (!setupDone) await d.api('POST', '/setup/reopen', {}); // leave setup as this step found it

  // ---------- Quick Start: its guards, offline ----------
  const qs = (u: URL) => new URLSearchParams(u.hash.slice(1));
  const ownerCode = (await d.api('POST', '/pair/start', { owner: true })).code;
  const ownerPhone = { authorization: `Bearer ${(await raw('POST', '/api/pair', { code: ownerCode, name: 'Owner phone' })).body.token}`, 'x-forwarded-for': '203.0.113.9' };
  d.check((await raw('POST', '/api/quickstart/start', {})).status === 409, 'Quick Start only starts on a computer that is still in setup');
  await d.api('POST', '/setup/reopen', {});
  try {
    const st = await d.api('POST', '/quickstart/start', {});
    const qu = new URL(st.url);
    d.check(qu.origin === APP && qu.pathname === '/quickstart' && !qu.search && qs(qu).get('pk')?.length === 43 && (qs(qu).get('s') ?? '').length >= 22 && st.phrase === phrase(qs(qu).get('pk')!), "Quick Start's QR carries the new computer's one-time key, the secret and the rendezvous id after #, and its check phrase");
    const send = { rv: qs(qu).get('rv'), pk: qs(qu).get('pk'), s: qs(qu).get('s'), n: 'Demo box', phonePk: keyPair().pk };
    const plainCode = (await d.api('POST', '/pair/start', {})).code;
    const plainPhone = { authorization: `Bearer ${(await raw('POST', '/api/pair', { code: plainCode, name: 'Family phone' })).body.token}`, 'x-forwarded-for': '203.0.113.10' };
    d.check((await raw('POST', '/api/quickstart/send', send, plainPhone)).status === 403 && (await raw('POST', '/api/quickstart/send', { ...send, pk: 'x' }, ownerPhone)).status === 400, 'only a phone paired as the owner can send a setup, and a bad request is refused by field');
    await raw('DELETE', '/api/pair/self', undefined, plainPhone);
    d.check((await d.api('POST', '/quickstart/stop', {})).state === 'stopped', 'Stop on the new computer ends the session');
    const page = await fetch(`${d.url}/quickstart`, { headers: { accept: 'text/html' } });
    d.check((page.headers.get('content-type') ?? '').startsWith('text/html'), "a browser opening /quickstart on the computer's own address gets the app's page, not the API");
  } finally {
    await d.api('POST', '/setup/finish', {});
  }

  if (!LIVE) return console.log('    (DEMO_LIVE=remote runs the real relay: a phone that scanned the QR turns remote access on, then a real certificate and a real push)');

  // ---------- live: the real relay ----------
  // During setup, a phone that can't reach the box asks it, through the relay, to turn remote access on, then pairs over https.
  await d.api('POST', '/setup/reopen', {});
  const scan = await d.api('POST', '/pair/start', { owner: true });
  const rv = new URLSearchParams(new URL(scan.url).hash.slice(1)).get('rv');
  await fetch(`${RELAY}/v1/rv/${rv}/ask`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: '{}' });
  let name = '';
  try {
    const host: string = await d.waitFor('the box to turn on remote access and post its address', async () => {
      const e = await fetch(`${RELAY}/v1/rv/${rv}/error`);
      if (e.ok) throw new Error(((await e.json()) as any).error);
      const r = await fetch(`${RELAY}/v1/rv/${rv}/host?wait=20`);
      return r.ok ? ((await r.json()) as any).host : undefined;
    }, 180_000);
    name = host.split('.')[0];
    const base = `https://${host}`;
    d.check(host.endsWith(`.${new URL(RELAY).host}`) && /^[a-z0-9-]+$/.test(host.split('.')[0]) && (await raw('GET', '/api/remote')).body.state === 'connected', `live: the phone asked through the relay, and the box turned on ${host} by itself`);
    const health = await fetch(`${base}/api/health`);
    d.check(health.ok && (await fetch(`${base}/api/tasks`)).status === 401, `live: ${base} answers with a trusted certificate, and refuses a request without a token`);
    const owner = (await (await fetch(`${base}/api/pair`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code: scan.code, name: 'Owner phone' }) })).json()) as any;
    d.check(typeof owner.token === 'string', 'live: the phone paired over https with the code from the QR it scanned before the box had an address');
    const next = await d.api('POST', '/pair/start', { owner: true });
    d.check(next.url.startsWith(`${APP}/pair?box=${host}#`), 'live: with remote access on, the pairing QR opens the GurtOS app with this box');
    const key = (await (await fetch(`${RELAY}/v1/push/key`)).json()).publicKey;
    const tp = await testPhone(key);
    try {
      const pushKey = randomBytes(32).toString('base64url');
      const H = { authorization: `Bearer ${owner.token}`, 'content-type': 'application/json' };
      await fetch(`${base}/api/push`, { method: 'PUT', headers: H, body: JSON.stringify({ subscription: tp.subscription, key: pushKey }) });
      await fetch(`${base}/api/push/test`, { method: 'POST', headers: H, body: '{}' });
      const t = await tp.next();
      d.check(JSON.parse(t).type === 'test' && macOk(t, pushKey), "live: a test push reached a real push service subscription and decrypted on the phone");
      // Quiet hours hold an approval's push back (the request still waits in the inbox); outside them it arrives.
      const before = (await d.api('GET', '/settings')).quietHours;
      try {
        await d.api('PATCH', '/settings', { quietHours: { enabled: true, from: '00:00', to: '23:59' } });
        const hushed = await d.api('POST', '/tasks', { title: 'Ask at night', worker: 'fake', prompt: 'ask May I order the filters?' });
        const early = await tp.next(5000).catch(() => undefined);
        d.check(!early, 'live: during quiet hours no push is sent');
        await d.api('PATCH', '/settings', { quietHours: { enabled: false } });
        const task = await d.api('POST', '/tasks', { title: 'Ask over the relay', worker: 'fake', prompt: 'ask May I order the cable?' });
        const a = JSON.parse(await tp.next(60_000));
        d.check(a.type === 'approval' && a.task === task.id && a.url === base && a.machine && macOk(JSON.stringify(a), pushKey), 'live: an approval reached the owner phone as a push that names its machine');
        for (const id of [a.id, `${hushed.id}.line1`]) await fetch(`${base}/api/approvals/${encodeURIComponent(id)}`, { method: 'POST', headers: H, body: JSON.stringify({ approved: true }) });
        await d.settled([task.id, hushed.id]);
      } finally {
        await d.api('PATCH', '/settings', { quietHours: before });
      }
    } finally {
      tp.close();
    }
    // ---------- live: Quick Start through the real relay (this box plays both computers) ----------
    await d.api('DELETE', '/remote'); // the new computer starts without an address
    await d.api('POST', '/setup/reopen', {});
    const st = await d.api('POST', '/quickstart/start', {});
    const f = qs(new URL(st.url));
    const phone = keyPair();
    const asked = await raw('POST', '/api/quickstart/send', { rv: f.get('rv'), pk: f.get('pk'), s: f.get('s'), n: f.get('n'), phonePk: phone.pk }, ownerPhone);
    d.check(asked.status === 200 && asked.body.question.includes(`check phrase: ${st.phrase}`) && /^Send your .* and your spending rules to "/.test(asked.body.question), `live: the source asks its owner, naming what leaves: "${asked.body.question}"`);
    const named: string[] = asked.body.keys.filter((k: any) => k.chosen).map((k: any) => k.name);
    // The answer tries to add every key; only the ones the question named may leave.
    const sent = await raw('POST', `/api/quickstart/send/${asked.body.id}`, { approve: true, keys: asked.body.keys.map((k: any) => k.name) }, ownerPhone);
    const done = await d.waitFor('Quick Start to finish on the new computer', async () => {
      const v = await d.api('GET', '/quickstart');
      if (v.state === 'error') throw new Error(v.error);
      return v.state === 'done' ? v : undefined;
    }, 200_000);
    d.check(sent.body.sent === true && done.steps.some((x: any) => /app/.test(x.text)) && done.steps.some((x: any) => /^Reach from anywhere/.test(x.text)), `live: after the owner's OK, the new computer applied each step: ${done.steps.map((x: any) => x.text).join('; ')}`);
    d.check(done.steps.filter((x: any) => / added \(from /.test(x.text)).length === named.length, `live: only the keys the question named left the source (${named.join(', ') || 'none'}), though the answer asked for all ${asked.body.keys.length}`);
    const sealedOwner = await (await fetch(`${RELAY}/v1/rv/${f.get('rv')}/owner`)).json();
    const { host: qhost, code: qcode } = openSealed(phone.privateKey, f.get('s')!, sealedOwner as any);
    const qp = (await (await fetch(`https://${qhost}/api/pair`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code: qcode, name: 'Phone from Quick Start' }) })).json()) as any;
    d.check(typeof qp.token === 'string' && (await fetch(`https://${qhost}/api/tasks`, { headers: { authorization: `Bearer ${qp.token}` } })).ok, 'live: only the phone could open its pairing code, and it paired with the new computer over https as the owner');
    name = qhost.split('.')[0];
    const again = await d.api('POST', '/quickstart/start', {});
    const g = qs(new URL(again.url));
    await d.api('POST', '/quickstart/stop', {});
    const late = await raw('POST', '/api/quickstart/send', { rv: g.get('rv'), pk: g.get('pk'), s: g.get('s'), n: 'Demo box', phonePk: keyPair().pk }, ownerPhone);
    d.check((await raw('POST', `/api/quickstart/send/${late.body.id}`, { approve: true }, ownerPhone)).status === 409, 'live: once the new computer pressed Stop, a late bundle is refused');
  } finally {
    await d.api('POST', '/setup/finish', {});
    const offAgain = await raw('DELETE', '/api/remote');
    const free = name ? ((await (await fetch(`${RELAY}/v1/names/${name}`)).json()) as any) : { available: true };
    d.check(offAgain.body.enabled === false && (!name || offAgain.body.released) && free.available, 'live: turning it off released the name');
  }
}

/** Draw the text as a QR code and read it back with qrencode and zbarimg, installing them if missing. Undefined if they can't be had. */
function qrRoundTrip(text: string): string | undefined {
  const have = () => ['qrencode', 'zbarimg'].every((t) => { try { execFileSync('sh', ['-c', `command -v ${t}`], { stdio: 'ignore' }); return true; } catch { return false; } });
  if (!have()) try { execFileSync('sh', ['-c', 'DEBIAN_FRONTEND=noninteractive apt-get install -y -qq qrencode zbar-tools >/dev/null 2>&1'], { timeout: 180_000 }); } catch {}
  if (!have()) return undefined;
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'qr-')), 'qr.png');
  execFileSync('qrencode', ['-o', file, '-s', '6', text]);
  return execFileSync('zbarimg', ['-q', '--raw', file]).toString().trim();
}
