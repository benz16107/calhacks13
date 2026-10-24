import assert from 'node:assert/strict';
import { createDecipheriv, createECDH, createHmac, randomBytes } from 'node:crypto';
import test from 'node:test';
import type { Approval } from './contract.ts';
import { encrypt, message, parseSub, quiet, recipients } from './push.ts';

// RFC 8291 section 5: the example message.
const RFC = {
  plaintext: 'V2hlbiBJIGdyb3cgdXAsIEkgd2FudCB0byBiZSBhIHdhdGVybWVsb24',
  asPrivate: 'yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw',
  uaPublic: 'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4',
  uaPrivate: 'q1dXpw3UpT5VOmu_cf_v6ih07Aems3njxI-JWgLcM94',
  auth: 'BTBZMqHH6r4Tts7J_aSIgg',
  salt: 'DGv6ra1nlYgDCS1FRnbzlw',
  body: 'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN',
};

/** What the phone does: decrypt with its own private key and auth secret. */
function decrypt(body: Buffer, uaPrivate: string, auth: string): string {
  const ua = createECDH('prime256v1');
  ua.setPrivateKey(Buffer.from(uaPrivate, 'base64url'));
  const salt = body.subarray(0, 16);
  const idlen = body[20];
  const asPublic = body.subarray(21, 21 + idlen);
  const h = (k: Buffer, d: Buffer | string) => createHmac('sha256', k).update(d).digest();
  const prkKey = h(Buffer.from(auth, 'base64url'), ua.computeSecret(asPublic));
  const ikm = h(prkKey, Buffer.concat([Buffer.from('WebPush: info\0'), ua.getPublicKey(), asPublic, Buffer.from([1])]));
  const prk = h(salt, ikm);
  const d = createDecipheriv('aes-128-gcm', h(prk, 'Content-Encoding: aes128gcm\0\x01').subarray(0, 16), h(prk, 'Content-Encoding: nonce\0\x01').subarray(0, 12));
  const sealed = body.subarray(21 + idlen);
  d.setAuthTag(sealed.subarray(-16));
  const plain = Buffer.concat([d.update(sealed.subarray(0, -16)), d.final()]);
  assert.equal(plain.at(-1), 2);
  return plain.subarray(0, -1).toString();
}

test('push encryption matches the RFC 8291 example byte for byte', () => {
  const out = encrypt(RFC.uaPublic, RFC.auth, Buffer.from(RFC.plaintext, 'base64url'), { asPrivate: RFC.asPrivate, salt: RFC.salt });
  assert.equal(out.toString('base64url'), RFC.body);
  assert.equal(decrypt(out, RFC.uaPrivate, RFC.auth), 'When I grow up, I want to be a watermelon');
});

test('a fresh push decrypts only on the phone it was made for', () => {
  const phone = createECDH('prime256v1');
  phone.generateKeys();
  const auth = randomBytes(16).toString('base64url');
  const out = encrypt(phone.getPublicKey().toString('base64url'), auth, Buffer.from('{"hi":1}'));
  assert.equal(decrypt(out, phone.getPrivateKey().toString('base64url'), auth), '{"hi":1}');
  assert.throws(() => decrypt(out, phone.getPrivateKey().toString('base64url'), randomBytes(16).toString('base64url')));
});

test('message: the mac covers every field, keys sorted, with this box key', () => {
  const key = randomBytes(32).toString('base64url');
  const m = JSON.parse(message({ type: 'approval', id: 'a1', machine: 'gurt-1' }, key));
  const { mac, ...rest } = m;
  assert.deepEqual(Object.keys(rest), ['id', 'machine', 'type']);
  assert.equal(mac, createHmac('sha256', Buffer.from(key, 'base64url')).update(JSON.stringify(rest)).digest('base64url'));
  const other = JSON.parse(message({ type: 'approval', id: 'a1', machine: 'gurt-2' }, key)).mac;
  assert.notEqual(other, mac);
});

test('parseSub refuses what is not a real subscription', () => {
  const p256dh = (() => { const e = createECDH('prime256v1'); e.generateKeys(); return e.getPublicKey().toString('base64url'); })();
  const good = { subscription: { endpoint: 'https://web.push.apple.com/x', keys: { p256dh, auth: randomBytes(16).toString('base64url') } }, key: randomBytes(32).toString('base64url') };
  assert.equal(parseSub(good).endpoint, 'https://web.push.apple.com/x');
  assert.throws(() => parseSub({ ...good, key: 'short' }), /key/);
  assert.throws(() => parseSub({ ...good, subscription: { ...good.subscription, endpoint: 'http://x' } }), /endpoint/);
  assert.throws(() => parseSub({ ...good, subscription: { ...good.subscription, keys: { p256dh: 'AAAA', auth: good.subscription.keys.auth } } }), /p256dh/);
});

test('recipients: the owner on Server and Personal; on Business only the routed people, never the asker', () => {
  const sub = { endpoint: 'https://x', p256dh: '', auth: '', key: '', at: '' };
  const devices = [
    { id: 'owner', owner: true, push: sub },
    { id: 'judge', push: sub },
    { id: 'owner-off', owner: true },
    { id: 'gone', owner: true, revoked: true, push: sub },
    { id: 'rosa', person: 'p-rosa', push: sub },
    { id: 'sam', person: 'p-sam', push: sub },
    { id: 'dana', person: 'p-dana', push: sub },
  ];
  const a: Approval = { id: 't1.k', task: 't1', question: 'OK?', costCents: 0, state: 'pending' };
  assert.deepEqual(recipients(a, devices).map((d) => d.id), ['owner']);
  const routed = { ...a, askedBy: 'p-sam', route: { people: [{ id: 'p-rosa' }, { id: 'p-sam' }] } };
  assert.deepEqual(recipients(routed, devices).map((d) => d.id), ['rosa']);
});

test('quiet hours, including a span over midnight, in the box time zone', () => {
  const q = { enabled: true, from: '22:00', to: '07:00' };
  const at = (iso: string) => new Date(iso);
  assert.equal(quiet(q, 'UTC', at('2026-10-24T23:30:00Z')), true);
  assert.equal(quiet(q, 'UTC', at('2026-10-24T06:59:00Z')), true);
  assert.equal(quiet(q, 'UTC', at('2026-10-24T07:00:00Z')), false);
  assert.equal(quiet(q, 'UTC', at('2026-10-24T12:00:00Z')), false);
  assert.equal(quiet(q, 'America/Los_Angeles', at('2026-10-24T12:00:00Z')), true, '05:00 in San Francisco');
  assert.equal(quiet({ ...q, enabled: false }, 'UTC', at('2026-10-24T23:30:00Z')), false);
  assert.equal(quiet({ enabled: true, from: '09:00', to: '17:00' }, 'UTC', at('2026-10-24T12:00:00Z')), true);
});
