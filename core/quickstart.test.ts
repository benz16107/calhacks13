import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import test from 'node:test';
import { bundle, keyPair, open, parseSend, phrase, question, seal } from './quickstart.ts';

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
});
