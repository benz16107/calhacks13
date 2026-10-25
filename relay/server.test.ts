import assert from 'node:assert/strict';
import { createPublicKey, generateKeyPairSync, verify } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { DOMAIN, Limit, SELF, api, apnsTarget, load, nameProblem, plugin, pushTargetProblem, vapidHeader, type ApnsSend } from './server.ts';

const fresh = () => load(fs.mkdtempSync(path.join(os.tmpdir(), 'relay-')));
const u = (p: string) => new URL(p, 'http://x');

test('names: lowercase, 3 to 30 characters, reserved and look-alike names refused', () => {
  for (const ok of ['rosa', 'abc', 'ben-laptop', 'a1b2c3', 'x'.repeat(30)]) assert.equal(nameProblem(ok), undefined, ok);
  for (const bad of ['', 'ab', 'x'.repeat(31), 'Rosa', 'ro_sa', 'ro.sa', '-rosa', 'rosa-', 'xn--rsa', 'www', 'relay', 'app', 'admin', 'calhacks', 'ro sa', 'rösa'])
    assert.ok(nameProblem(bad), bad);
  assert.ok(nameProblem(42));
});

test('enroll, check a secret, refuse a second claim, release with the secret only', async () => {
  const r = fresh();
  const a = await api(r, 'POST', u('/v1/names'), { name: 'rosa' }, undefined, '203.0.113.4');
  assert.equal(a.status, 200);
  const { secret, host } = a.body as any;
  assert.equal(host, `rosa.${DOMAIN}`);
  assert.ok(r.names.check('rosa', secret));
  assert.ok(!r.names.check('rosa', secret + 'x'));
  assert.ok(!r.names.all.rosa.hash.includes(secret), 'only a hash is stored');
  assert.equal((await api(r, 'POST', u('/v1/names'), { name: 'rosa' }, undefined, '203.0.113.5')).status, 409);
  assert.deepEqual((await api(r, 'GET', u('/v1/names/rosa'), {}, undefined, '203.0.113.4')).body, { name: 'rosa', available: false, reason: 'that name is taken' });
  assert.equal((await api(r, 'DELETE', u('/v1/names/rosa'), {}, 'Bearer rosa.wrong', '203.0.113.4')).status, 403);
  assert.equal((await api(r, 'DELETE', u('/v1/names/rosa'), {}, `Bearer rosa.${secret}`, '203.0.113.4')).status, 200);
  assert.equal(((await api(r, 'GET', u('/v1/names/rosa'), {}, undefined, '203.0.113.4')).body as any).available, true);
});

test('enrollment is rate limited per address', async () => {
  const r = fresh();
  const codes = [];
  for (let i = 0; i < 7; i++) codes.push((await api(r, 'POST', u('/v1/names'), { name: `box-${i}x` }, undefined, '198.51.100.9')).status);
  assert.deepEqual(codes, [200, 200, 200, 200, 200, 429, 429]);
});

test('a name nobody used for 30 days is free again', () => {
  const r = fresh();
  r.names.enroll('olds', Date.now() - 31 * 24 * 3600 * 1000);
  assert.equal(r.names.taken('olds'), false);
});

test('frps plugin: a box logs in only with its secret and routes only its own name', () => {
  const r = fresh();
  const secret = r.names.enroll('rosa');
  const login = (user: string, s: string) => plugin('Login', { user, metas: { secret: s } }, r.names, r.selfSecret);
  const proxy = (user: string, s: string, c: object) => plugin('NewProxy', { user: { user, metas: { secret: s } }, ...c }, r.names, r.selfSecret);
  assert.equal(login('rosa', secret).reject, false);
  assert.equal(login('rosa', 'nope').reject, true);
  assert.equal(login('ben', secret).reject, true, "another box's secret");
  const https = proxy('rosa', secret, { proxy_type: 'https', custom_domains: [`rosa.${DOMAIN}`] }) as any;
  assert.equal(https.reject, false);
  assert.equal(https.content.bandwidth_limit_mode, 'server', 'the relay sets the bandwidth limit');
  assert.equal(proxy('rosa', secret, { proxy_type: 'http', custom_domains: [`rosa.${DOMAIN}`] }).reject, false);
  assert.equal(proxy('rosa', secret, { proxy_type: 'https', custom_domains: [`ben.${DOMAIN}`] }).reject, true, "someone else's name");
  assert.equal(proxy('rosa', secret, { proxy_type: 'https', custom_domains: [`rosa.${DOMAIN}`, 'evil.example'] }).reject, true);
  assert.equal(proxy('rosa', secret, { proxy_type: 'https', subdomain: 'rosa' }).reject, true, 'exact domain only');
  assert.equal(proxy('rosa', secret, { proxy_type: 'tcp', remote_port: 22 }).reject, true, 'no raw ports');
  assert.equal(proxy('rosa', 'nope', { proxy_type: 'https', custom_domains: [`rosa.${DOMAIN}`] }).reject, true);
  // The relay's own route for its API, and nothing else for it.
  assert.equal(plugin('NewProxy', { user: { user: SELF, metas: { secret: r.selfSecret } }, proxy_type: 'https', custom_domains: [DOMAIN] }, r.names, r.selfSecret).reject, false);
  assert.equal(plugin('NewProxy', { user: { user: SELF, metas: { secret: r.selfSecret } }, proxy_type: 'https', custom_domains: ['rosa.' + DOMAIN] }, r.names, r.selfSecret).reject, true);
  assert.equal(login(SELF, 'x'.repeat(43)).reject, true);
  // Released: the next heartbeat is refused, so the tunnel drops.
  r.names.release('rosa');
  assert.equal(plugin('Ping', { user: { user: 'rosa', metas: { secret } } }, r.names, r.selfSecret).reject, true);
});

test('logins are rate limited per box', () => {
  const r = fresh();
  const secret = r.names.enroll('loopy');
  const lim = new Limit(3, 60_000);
  const res = [1, 2, 3, 4].map(() => plugin('Login', { user: 'loopy', metas: { secret } }, r.names, r.selfSecret, lim).reject);
  assert.deepEqual(res, [false, false, false, true]);
});

test('push gateway: only known push services, signed with the app key, payload passed through as is', async () => {
  for (const e of ['https://fcm.googleapis.com/fcm/send/abc', 'https://web.push.apple.com/QW', 'https://updates.push.services.mozilla.com/wpush/v2/x'])
    assert.equal(pushTargetProblem(e), undefined, e);
  for (const e of ['http://fcm.googleapis.com/x', 'https://169.254.169.254/latest', 'https://example.com/push', 'nonsense', 'https://fcm.googleapis.com.evil.example/x'])
    assert.ok(pushTargetProblem(e), e);

  const r = fresh();
  const secret = r.names.enroll('rosa');
  const payload = Buffer.alloc(120, 7);
  let seen: { url: string; init: any } | undefined;
  const send = (async (url: string, init: any) => ((seen = { url, init }), new Response('', { status: 201 }))) as typeof fetch;
  const body = { endpoint: 'https://web.push.apple.com/QWxpY2U', payload: payload.toString('base64url'), ttl: 600, urgency: 'high', topic: 'rosa:t1.k1' };
  assert.equal((await api(r, 'POST', u('/v1/push'), body, 'Bearer rosa.bad', '203.0.113.1', send)).status, 403);
  const a = await api(r, 'POST', u('/v1/push'), body, `Bearer rosa.${secret}`, '203.0.113.1', send);
  assert.deepEqual(a.body, { status: 201, gone: false });
  assert.ok(Buffer.from(seen!.init.body).equals(payload), 'the gateway forwards the bytes it got');
  assert.equal(seen!.init.headers['content-encoding'], 'aes128gcm');
  assert.ok(seen!.init.headers.topic.length <= 32);
  // The VAPID JWT verifies against the public key the app subscribed with.
  const [, t, k] = seen!.init.headers.authorization.match(/^vapid t=([^,]+), k=(.+)$/);
  assert.equal(k, r.vapid.publicKey);
  const [h, c, s] = t.split('.');
  assert.equal(JSON.parse(Buffer.from(c, 'base64url').toString()).aud, 'https://web.push.apple.com');
  const pub = Buffer.from(k, 'base64url');
  const key = createPublicKey({ key: { kty: 'EC', crv: 'P-256', x: pub.subarray(1, 33).toString('base64url'), y: pub.subarray(33).toString('base64url') }, format: 'jwk' });
  assert.ok(verify('sha256', Buffer.from(`${h}.${c}`), { key, dsaEncoding: 'ieee-p1363' }, Buffer.from(s, 'base64url')));
  assert.ok(vapidHeader(r.vapid, 'https://fcm.googleapis.com/x').startsWith('vapid t='));
  // A push service that forgot the subscription: the box is told to drop it.
  const gone = (async () => new Response('gone', { status: 410 })) as typeof fetch;
  assert.equal(((await api(r, 'POST', u('/v1/push'), body, `Bearer rosa.${secret}`, '203.0.113.1', gone)).body as any).gone, true);
});

test('APNs for the native apps: only GurtOS apps, ciphertext only, Apple token signed with the key, gone tokens dropped', async () => {
  const tok = 'ab'.repeat(32);
  assert.deepEqual(apnsTarget(`https://${DOMAIN}/v1/apns/com.benzhou.gurtos/sandbox/${tok}`), { topic: 'com.benzhou.gurtos', sandbox: true, token: tok });
  for (const e of [`https://${DOMAIN}/v1/apns/com.evil.app/production/${tok}`, `http://${DOMAIN}/v1/apns/com.benzhou.gurtos/production/${tok}`, `https://evil.example/v1/apns/com.benzhou.gurtos/production/${tok}`, `https://${DOMAIN}/v1/apns/com.benzhou.gurtos/production/xyz`, `https://${DOMAIN}/v1/apns/com.benzhou.gurtos/staging/${tok}`, `https://${DOMAIN}:8443/v1/apns/com.benzhou.gurtos/production/${tok}`])
    assert.equal(apnsTarget(e), undefined, e);

  const r = fresh();
  const secret = r.names.enroll('rosa');
  const payload = Buffer.alloc(300, 9).toString('base64url');
  const body = { endpoint: `https://${DOMAIN}/v1/apns/com.benzhou.gurtos/production/${tok}`, payload, ttl: 600, urgency: 'high', topic: 'rosa:t1.k1' };
  const auth = `Bearer rosa.${secret}`;
  assert.equal((await api(r, 'POST', u('/v1/push'), body, auth, '203.0.113.1')).status, 503, 'no APNs key installed yet: a clear 503');

  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  r.apns = { keyId: 'KEY1234567', teamId: 'TEAM123456', key: privateKey };
  let seen: { host: string; path: string; headers: Record<string, string>; body: string } | undefined;
  r.apnsSend = (async (host, p, headers, b) => ((seen = { host, path: p, headers, body: b }), { status: 200, body: '' })) as ApnsSend;
  assert.equal((await api(r, 'POST', u('/v1/push'), body, 'Bearer rosa.bad', '203.0.113.1')).status, 403);
  assert.deepEqual((await api(r, 'POST', u('/v1/push'), body, auth, '203.0.113.1')).body, { status: 200, gone: false });
  assert.equal(seen!.host, 'api.push.apple.com');
  assert.equal(seen!.path, `/3/device/${tok}`);
  assert.equal(seen!.headers['apns-topic'], 'com.benzhou.gurtos');
  assert.equal(seen!.headers['apns-priority'], '10');
  assert.ok(seen!.headers['apns-collapse-id'].length <= 32);
  const sent = JSON.parse(seen!.body);
  assert.equal(sent.e, payload, 'Apple gets the ciphertext as the box made it');
  assert.deepEqual(sent.aps.alert, { title: 'GurtOS', body: 'A request needs you' }, 'and no readable content');
  assert.equal(sent.aps['mutable-content'], 1);
  const [h, c, s] = seen!.headers.authorization.replace(/^bearer /, '').split('.');
  assert.deepEqual(JSON.parse(Buffer.from(h, 'base64url').toString()), { alg: 'ES256', kid: 'KEY1234567' });
  assert.equal(JSON.parse(Buffer.from(c, 'base64url').toString()).iss, 'TEAM123456');
  assert.ok(verify('sha256', Buffer.from(`${h}.${c}`), { key: publicKey, dsaEncoding: 'ieee-p1363' }, Buffer.from(s, 'base64url')));
  // Too big for APNs, or not base64url: refused before Apple is asked.
  assert.equal((await api(r, 'POST', u('/v1/push'), { ...body, payload: 'A'.repeat(4000) }, auth, '203.0.113.1')).status, 400);
  assert.equal((await api(r, 'POST', u('/v1/push'), { ...body, payload: '{"aps":1}'.repeat(20) }, auth, '203.0.113.1')).status, 400);
  // A token Apple no longer knows: the box is told to drop it.
  r.apnsSend = (async () => ({ status: 400, body: '{"reason":"BadDeviceToken"}' })) as ApnsSend;
  assert.deepEqual((await api(r, 'POST', u('/v1/push'), body, auth, '203.0.113.1')).body, { status: 400, gone: true, error: 'BadDeviceToken' });
});

test('rendezvous: slots are write-once, a reader can wait for one, and only the named box can write its host', async () => {
  const r = fresh();
  const id = 'r'.repeat(22);
  const at = (slot: string) => u(`/v1/rv/${id}/${slot}`);
  assert.equal((await api(r, 'GET', at('ask'), {}, undefined, '203.0.113.20')).status, 404);
  const waiting = api(r, 'GET', u(`/v1/rv/${id}/ask?wait=5`), {}, undefined, '203.0.113.20');
  assert.equal((await api(r, 'PUT', at('ask'), { want: 'remote' }, undefined, '203.0.113.21')).status, 200);
  assert.deepEqual((await waiting).body, { want: 'remote' }, 'a waiting reader wakes when the slot is written');
  assert.equal((await api(r, 'PUT', at('ask'), { want: 'other' }, undefined, '203.0.113.21')).status, 409, 'write once');
  const secret = r.names.enroll('rosa');
  assert.equal((await api(r, 'PUT', at('host'), { host: `rosa.${DOMAIN}` }, undefined, '203.0.113.21')).status, 403, 'no secret, no host');
  assert.equal((await api(r, 'PUT', at('host'), { host: `ben.${DOMAIN}` }, `Bearer rosa.${secret}`, '203.0.113.21')).status, 403, "can't point at another box");
  assert.equal((await api(r, 'PUT', at('host'), { host: `rosa.${DOMAIN}` }, `Bearer rosa.${secret}`, '203.0.113.21')).status, 200);
  assert.deepEqual((await api(r, 'GET', at('host'), {}, undefined, '203.0.113.20')).body, { host: `rosa.${DOMAIN}` });
  assert.equal((await api(r, 'GET', u('/v1/rv/short/ask'), {}, undefined, '203.0.113.20')).status, 404, 'ids are long random capabilities');
});
