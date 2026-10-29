// node --experimental-strip-types --test portal/relay.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { onRelay, pairLink, pairNote, relayDown } from './src/relay.ts';

const code = { code: 'eef8169a', expiresAt: '' };
const lan = 'http://192.168.1.20:7700/pair#eef8169a';

test('a pairing QR uses the home network unless the relay can help', () => {
  // Remote access off, after setup: the hosted app could only send the phone back to the home network.
  const plain = { ...code, url: 'https://app.gurtos.com/pair#code=eef8169a&lan=192.168.1.20%3A7700&n=Home', boxUrl: lan };
  assert.equal(pairLink(plain, false), lan);
  assert.equal(pairLink(plain, true), lan);
  // During setup (rv): wait for the relay check, then pair over the internet only if it answers.
  const meet = { ...plain, url: 'https://app.gurtos.com/pair#code=eef8169a&rv=AAAAAAAAAAAAAAAAAAAAAA&n=Home' };
  assert.equal(pairLink(meet, undefined), undefined);
  assert.equal(pairLink(meet, true), meet.url);
  assert.equal(pairLink(meet, false), lan);
  // Remote access on: the hosted app with the computer's own address.
  const remote = { ...code, url: 'https://app.gurtos.com/pair?box=home.box.gurtos.com#eef8169a', boxUrl: 'https://home.box.gurtos.com/pair#eef8169a' };
  assert.equal(pairLink(remote, false), remote.url);
  // No BOX_URL: the hosted link is all there is. An older core's bare code uses this page's address.
  assert.equal(pairLink({ ...plain, boxUrl: undefined }, false), plain.url);
  assert.equal(pairLink({ ...code, url: '/pair' }, false, 'http://10.0.0.5:7700'), 'http://10.0.0.5:7700/#pair/eef8169a');
  assert.equal(pairLink({ ...code, url: '/pair' }, false), undefined);
});

test('the note says where the phone has to be', () => {
  assert.match(pairNote(lan), /same Wi-Fi or network/);
  assert.match(pairNote('https://app.gurtos.com/pair#code=x&rv=y'), /doesn't need/);
});

test('relay errors and addresses', () => {
  for (const m of ['fetch failed', 'the relay answered 502', "can't reach the relay: fetch failed", 'The operation was aborted due to timeout']) assert.ok(relayDown(m), m);
  for (const m of ['name taken', 'only the owner can do this', 'the relay answered 409']) assert.ok(!relayDown(m), m);
  assert.ok(onRelay('rosa.box.gurtos.com'));
  for (const h of ['box.gurtos.com', 'a.b.box.gurtos.com', 'rosa.box.gurtos.com.evil.com', 'ro.box.gurtos.com']) assert.ok(!onRelay(h), h);
});
