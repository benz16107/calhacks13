// Offline: node --experimental-strip-types --disable-warning=ExperimentalWarning --test tracks/shopper/passkey.test.ts
// A small software authenticator (a P-256 key) stands in for Face ID.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { Authenticator } from './softauth.ts';
import { canonical, passkeys } from './passkey.ts';

const A = 'https://home.box.gurtos.com';
const dir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'passkey-'));
const B = 'https://other.box.gurtos.com';
async function enrolled(origin = A, auth = new Authenticator()) {
  const pk = passkeys(dir());
  const opts: any = await pk.registerOptions(origin, 'Ben phone');
  await pk.register(origin, auth.create(opts, origin), 'Ben phone');
  return { pk, auth };
}
const approval = { id: 't1.k1', question: 'Buy 2 × filters for $13.00?', costCents: 1300 };

test('canonical JSON sorts keys at every level', () => {
  assert.equal(canonical({ b: 1, a: [{ d: 2, c: undefined, e: null }] }), '{"a":[{"d":2,"e":null}],"b":1}');
});

test('enroll, then sign an approval and verify it', async () => {
  const { pk, auth } = await enrolled();
  const [stored] = pk.list();
  assert.equal(stored.rpId, 'home.box.gurtos.com');
  assert.equal(stored.device, 'Ben phone');
  const opts: any = await pk.options(A, 'approval', approval.id, approval);
  assert.equal(opts.userVerification, 'required');
  const who = await pk.verify(A, 'approval', approval.id, approval, auth.get(opts, A));
  assert.deepEqual(who, { credentialId: stored.id, device: 'Ben phone', rpId: 'home.box.gurtos.com', userVerified: true });
});

test('a signature for one payload fails for another, and the challenge is then spent', async () => {
  const { pk, auth } = await enrolled();
  const opts: any = await pk.options(A, 'approval', approval.id, approval);
  const sig = auth.get(opts, A);
  await assert.rejects(pk.verify(A, 'approval', approval.id, { ...approval, costCents: 13000 }, sig), /different request/);
  await assert.rejects(pk.verify(A, 'approval', approval.id, approval, sig), /expired or was already used/);
  // Same payload under another approval id: no pending challenge for it.
  const o2: any = await pk.options(A, 'approval', 't1.k1', approval);
  await assert.rejects(pk.verify(A, 'approval', 't1.k2', approval, auth.get(o2, A)), /expired or was already used/);
});

test('a used signature cannot be replayed, even against a fresh challenge', async () => {
  const { pk, auth } = await enrolled();
  const sig = auth.get(await pk.options(A, 'approval', approval.id, approval), A);
  await pk.verify(A, 'approval', approval.id, approval, sig);
  await assert.rejects(pk.verify(A, 'approval', approval.id, approval, sig), /already used/);
  await pk.options(A, 'approval', approval.id, approval);
  await assert.rejects(pk.verify(A, 'approval', approval.id, approval, sig), /different request/);
});

test('a passkey only works on its own address', async () => {
  const { pk, auth } = await enrolled();
  await assert.rejects(pk.options(B, 'approval', approval.id, approval), /not set up for this address/);
  // Signed at A, sent from B.
  const opts: any = await pk.options(A, 'approval', approval.id, approval);
  await assert.rejects(pk.verify(B, 'approval', approval.id, approval, auth.get(opts, A)), /different address/);
  // A page at A that claims another RP ID.
  const o2: any = await pk.options(A, 'approval', approval.id, approval);
  await assert.rejects(pk.verify(A, 'approval', approval.id, approval, auth.get(o2, A, 'other.box.gurtos.com')), /different address|failed/);
  // Enrolling at a second address is refused once the first has a passkey.
  await assert.rejects(pk.registerOptions(B, 'Laptop'), /another address/);
});

test('plain http off localhost is refused; localhost and https are allowed', async () => {
  const pk = passkeys(dir());
  for (const o of ['http://192.168.1.20:7700', 'http://box.lan:7700', 'https://10.0.0.5', 'null', 'https://x.com/path', '']) assert.equal(pk.usable(o), false, o);
  assert.equal(pk.usable(null), false);
  for (const o of ['https://home.box.gurtos.com', 'http://localhost:7700', 'https://box.example:8443']) assert.equal(pk.usable(o), true, o);
  await assert.rejects(pk.registerOptions('http://192.168.1.20:7700', 'x'), /HTTPS/);
  await assert.rejects(pk.options('http://box.lan:7700', 'approval', 'a', {}), /HTTPS/);
});

test('a second passkey needs proof from the first', async () => {
  const { pk, auth } = await enrolled();
  await assert.rejects(pk.registerOptions(A, 'Laptop'), /Confirm with it first/);
  await assert.rejects(pk.registerOptions(A, 'Laptop', { id: 'nope' }), /expired or was already used/);
  // Proof: the first passkey signs purpose 'enroll' for the new device's name. The route passes no payload.
  const proof = auth.get(await pk.options(A, 'enroll', 'Laptop', null), A);
  const laptop = new Authenticator();
  const opts: any = await pk.registerOptions(A, 'Laptop', proof);
  assert.equal(opts.excludeCredentials.length, 1);
  await pk.register(A, laptop.create(opts, A), 'Laptop');
  assert.deepEqual(pk.list().map((c) => c.device), ['Ben phone', 'Laptop']);
  // The proof is single use.
  await assert.rejects(pk.registerOptions(A, 'Laptop', proof), /already used/);
});

test('two first enrollments racing: the second is refused', async () => {
  const pk = passkeys(dir());
  const o1: any = await pk.registerOptions(A, 'One');
  const o2: any = await pk.registerOptions(A, 'Two');
  await pk.register(A, new Authenticator().create(o1, A), 'One');
  await assert.rejects(pk.register(A, new Authenticator().create(o2, A), 'Two'), /set up first/);
});

test('a counter that goes backwards fails; a counter stuck at 0 (iCloud Keychain) passes', async () => {
  const { pk, auth } = await enrolled(A, new Authenticator(5));
  await pk.verify(A, 'approval', 'a', 1, auth.get(await pk.options(A, 'approval', 'a', 1), A));
  assert.equal(pk.list()[0].counter, 6);
  auth.counter = 2;
  await assert.rejects(pk.verify(A, 'approval', 'b', 1, auth.get(await pk.options(A, 'approval', 'b', 1), A)), /copy/);

  const zero = await enrolled();
  for (const s of ['c', 'd']) await zero.pk.verify(A, 'approval', s, 1, zero.auth.get(await zero.pk.options(A, 'approval', s, 1), A));
});

test('no Face ID check (UV off) is refused', async () => {
  const { pk, auth } = await enrolled();
  auth.uv = false;
  await assert.rejects(pk.verify(A, 'approval', 'a', 1, auth.get(await pk.options(A, 'approval', 'a', 1), A)), /PIN is needed/);
});

test('passkeys.json is 0600 and holds no private key', async () => {
  const d = dir();
  const auth = new Authenticator();
  const pk = passkeys(d);
  await pk.register(A, auth.create(await pk.registerOptions(A, 'Ben phone'), A), 'Ben phone');
  const file = path.join(d, 'passkeys.json');
  assert.equal(fs.statSync(file).mode & 0o777, 0o600);
  const text = fs.readFileSync(file, 'utf8');
  const priv = auth.key.export({ format: 'jwk' }).d!;
  assert.ok(!text.includes(priv) && !text.includes(Buffer.from(priv, 'base64url').toString('base64')));
  assert.ok(!/PRIVATE|"d"\s*:/.test(text));
  assert.deepEqual(Object.keys(JSON.parse(text)[0]).sort(), ['counter', 'createdAt', 'device', 'id', 'publicKey', 'rpId', 'transports']);
  assert.deepEqual(fs.readdirSync(d), ['passkeys.json']); // the temp file was renamed away
});
