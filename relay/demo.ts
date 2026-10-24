// Remote access and push, in ./demo. Offline by default: a relay in this process (names, the frps plugin, the push
// gateway) with a stand-in push service, the box's push encryption read back by a stand-in phone, and the box's own
// API for remote access and notifications. DEMO_LIVE=remote adds the real thing: this demo box enrolls a name with
// the real relay, gets its own certificate, answers at https://<name>.box.gurtos.com, sends a real push through
// the gateway and Mozilla's push service to a stand-in phone, then releases the name.
import { createECDH, createHmac, randomBytes } from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import type { DemoKit } from '../core/contract.ts';
import { send } from '../core/push.ts';
import { nameProblem as boxRule } from '../core/remote.ts';
import { RESERVED, load, nameProblem as relayRule, serve } from './server.ts';
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
  const relay = load(fs.mkdtempSync(path.join(os.tmpdir(), 'relay-demo-')));
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
    const own = await ask('NewProxy', { user: as(secret), proxy_type: 'https', custom_domains: [`${name}.box.gurtos.com`] });
    d.check(own.reject === false && own.content.bandwidth_limit_mode === 'server', "a box may route its own name (HTTPS passed through by SNI), with the relay's bandwidth limit");
    const other = await ask('NewProxy', { user: as(secret), proxy_type: 'https', custom_domains: ['rosa.box.gurtos.com'] });
    const tcp = await ask('NewProxy', { user: as(secret), proxy_type: 'tcp', remote_port: 22 });
    d.check(other.reject === true && tcp.reject === true, "a box can't take another box's name or open a raw port");

    // A push: the box encrypts it for the phone, the gateway signs it and forwards it, the phone decrypts it.
    const phone = createECDH('prime256v1');
    phone.generateKeys();
    const auth = randomBytes(16);
    const sub = { endpoint: `http://127.0.0.1:${pushPort}/push/1`, p256dh: phone.getPublicKey().toString('base64url'), auth: auth.toString('base64url'), key: randomBytes(32).toString('base64url'), at: '' };
    const fields = { v: 1, type: 'approval', machine: 'demo-box', box: 'Demo box', url: `https://${name}.box.gurtos.com`, id: 't1.k1', task: 't1', title: 'Approve $20.00 to Box Test Store?', body: 'Buy the USB-C cable', costCents: 2000 };
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
  const cors = await fetch(`${d.url}/api/tasks`, { method: 'OPTIONS', headers: { origin: 'https://app.gurtos.com', 'access-control-request-method': 'GET', 'access-control-request-headers': 'authorization' } });
  const evil = await fetch(`${d.url}/api/tasks`, { method: 'OPTIONS', headers: { origin: 'https://evil.example', 'access-control-request-method': 'GET' } });
  d.check(cors.headers.get('access-control-allow-origin') === 'https://app.gurtos.com' && !evil.headers.get('access-control-allow-origin'), 'the GurtOS app (app.gurtos.com) may call the box from the browser; other sites may not');
  d.check((await raw('DELETE', '/api/push', undefined, phoneH)).body.subscribed === false, 'the phone turns notifications off');
  const forgot = await raw('DELETE', '/api/pair/self', undefined, phoneH);
  d.check(forgot.body.revoked === true && (await raw('GET', '/api/push', undefined, phoneH)).status === 401, 'a phone that forgets the box revokes its own pairing');

  if (!LIVE) return console.log('    (DEMO_LIVE=remote runs the real relay, a real certificate and a real push)');

  // ---------- live: the real relay ----------
  const name = `demo-${randomBytes(3).toString('hex')}`;
  const on = await raw('POST', '/api/remote', { name });
  d.check(on.body.state === 'starting', `live: the box enrolled ${name}.box.gurtos.com with the relay`);
  try {
    const up = await d.waitFor('the box to answer at its https address', async () => {
      const s = (await raw('GET', '/api/remote')).body;
      if (s.state === 'error') throw new Error(s.error);
      return s.state === 'connected' ? s : undefined;
    }, 150_000);
    const base = up.url;
    const health = await fetch(`${base}/api/health`);
    d.check(health.ok && (await fetch(`${base}/api/tasks`)).status === 401, `live: ${base} answers with a trusted certificate, and refuses a request without a token`);
    const start = await d.api('POST', '/pair/start', { owner: true });
    d.check(start.url.startsWith(`https://app.gurtos.com/pair?box=${name}.box.gurtos.com#`), 'live: the pairing QR opens the GurtOS app with this box');
    const owner = (await (await fetch(`${base}/api/pair`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code: start.code, name: 'Owner phone' }) })).json()) as any;
    const key = (await (await fetch('https://box.gurtos.com/v1/push/key')).json()).publicKey;
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
  } finally {
    const offAgain = await raw('DELETE', '/api/remote');
    const free = (await (await fetch(`https://box.gurtos.com/v1/names/${name}`)).json()) as any;
    d.check(offAgain.body.enabled === false && offAgain.body.released && free.available, 'live: turning it off released the name');
  }
}
