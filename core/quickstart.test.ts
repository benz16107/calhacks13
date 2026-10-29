import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import test from 'node:test';
import http from 'node:http';
import { Target, bundle, deliver, keyPair, label, open, parseSend, phrase, question, seal } from './quickstart.ts';

const s = randomBytes(16).toString('base64url');

test('a sealed bundle opens only with the right private key and the QR secret, and any change is caught', () => {
  const target = keyPair();
  const other = keyPair();
  const box = seal(target.pk, s, { keys: { ANTHROPIC_API_KEY: 'sk-test' } });
  assert.deepEqual(open(target.privateKey, s, box), { keys: { ANTHROPIC_API_KEY: 'sk-test' } });
  assert.ok(!JSON.stringify(box).includes('sk-test'), 'the relay sees ciphertext only');
  assert.throws(() => open(other.privateKey, s, box), 'another key');
  assert.throws(() => open(target.privateKey, randomBytes(16).toString('base64url'), box), 'the relay does not have the secret');
  const ct = Buffer.from(box.ct, 'base64url');
  ct[0] ^= 1;
  assert.throws(() => open(target.privateKey, s, { ...box, ct: ct.toString('base64url') }), 'a changed byte');
  assert.throws(() => open(target.privateKey, s, { ...box, eph: keyPair().pk }), 'a swapped sender key');
});

test('the check phrase is four words, the same for the same key, and differs between keys', () => {
  const a = keyPair().pk;
  assert.equal(phrase(a), phrase(a));
  assert.equal(phrase(a).split(' ').length, 4);
  assert.notEqual(phrase(a), phrase(keyPair().pk));
});

test('a send is checked at the boundary, and the bundle copies only the settings meant to travel', () => {
  const good = { rv: 'r'.repeat(22), pk: keyPair().pk, s, phonePk: keyPair().pk, n: 'GurtOS Laptop' };
  assert.equal(parseSend(good).n, 'GurtOS Laptop');
  for (const bad of [{ ...good, rv: 'x' }, { ...good, pk: 'short' }, { ...good, s: '' }, { ...good, phonePk: undefined }]) assert.throws(() => parseSend(bad));
  const b = bundle({ from: 'GurtOS Cloud', keys: {}, settings: { approvalThresholdCents: 500, paused: true, agentFolders: ['/home/a'], quietHours: { enabled: false } }, apps: ['shopper'], phonePk: good.phonePk });
  assert.deepEqual(Object.keys(b.settings).sort(), ['approvalThresholdCents', 'quietHours'], 'never paused, never folder paths');
  assert.match(question({ keys: ['ANTHROPIC_API_KEY'], apps: 6, n: 'GurtOS Laptop', pk: good.pk }), /^Send your Anthropic key, 6 apps and your spending rules to "GurtOS Laptop" \(check phrase: \w+ \w+ \w+ \w+\)\?$/);
  assert.match(question({ keys: [], apps: 1, n: 'X', pk: good.pk }), /^Send 1 app and your spending rules \(no keys\) to "X"/);
  assert.deepEqual(['APIFY_TOKEN', 'STRIPE_API_KEY', 'ANTHROPIC_API_KEY', 'ASI_ONE_API_KEY'].map(label), ['Apify token', 'Stripe API key', 'Anthropic key', 'ASI:One API key'], 'people read the question: keys in plain words');
});

test('with the relay offline, Quick Start says so in words on both computers, not "fetch failed"', async () => {
  const closed = http.createServer();
  await new Promise<void>((r) => closed.listen(0, '127.0.0.1', r));
  const relay = `http://127.0.0.1:${(closed.address() as { port: number }).port}`;
  await new Promise((r) => closed.close(r));
  const t = new Target({ relay, app: 'https://app.example', apply: {} as never, apps: () => [], remoteOn: async () => '', ownerCode: () => '', note: () => {} });
  t.start('New computer');
  for (let i = 0; i < 100 && t.state === 'waiting'; i++) await new Promise((r) => setTimeout(r, 20));
  assert.equal(t.state, 'error');
  assert.match(t.error ?? '', /^Quick Start needs the GurtOS relay at 127\.0\.0\.1:\d+, and this computer couldn't reach it\. Set it up on its own screen instead\.$/);
  const p = { rv: 'r'.repeat(22), pk: keyPair().pk, s, phonePk: keyPair().pk, n: 'New computer', keys: [], at: 0, by: 'phone' };
  await assert.rejects(deliver(relay, p, bundle({ from: 'Old', keys: {}, settings: {}, apps: [], phonePk: p.phonePk })), (e: Error & { status?: number }) => e.status === 502 && /^Quick Start needs the GurtOS relay/.test(e.message));
});

test('Quick Start reads the relay each time, so a relay the owner changed since is the one it uses (core/box.ts passes a getter)', async () => {
  const closedPort = async () => {
    const s = http.createServer();
    await new Promise<void>((r) => s.listen(0, '127.0.0.1', r));
    const port = (s.address() as { port: number }).port;
    await new Promise((r) => s.close(r));
    return port;
  };
  const [first, second] = [await closedPort(), await closedPort()];
  let relay = `http://127.0.0.1:${first}`;
  const t = new Target({ get relay() { return relay; }, app: 'https://app.example', apply: {} as never, apps: () => [], remoteOn: async () => '', ownerCode: () => '', note: () => {} });
  relay = `http://127.0.0.1:${second}`; // PUT /api/remote/relay after the first Quick Start
  t.start('New computer');
  for (let i = 0; i < 100 && t.state === 'waiting'; i++) await new Promise((r) => setTimeout(r, 20));
  assert.match(t.error ?? '', new RegExp(`127\\.0\\.0\\.1:${second}\\b`));
});
