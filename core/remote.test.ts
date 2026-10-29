import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { RELAY, Remote, checkRelay, relayProblem } from './remote.ts';

test("an owner's own relay must be a public https host name", async () => {
  assert.equal(relayProblem('https://relay.example.com'), undefined);
  assert.equal(relayProblem('https://relay.example.com/'), undefined);
  for (const bad of ['http://relay.example.com', 'https://203.0.113.5', 'https://[2001:db8::1]', 'https://relay.example.com/v1', 'https://u:p@relay.example.com', 'https://relay.example.com?x=1', 'https://relay.local', 'https://box.internal', 'https://localhost', 'not a url', 42])
    assert.ok(relayProblem(bad), String(bad));
  const at = (address: string) => async () => [{ address, family: 4 }];
  assert.equal(await checkRelay('https://relay.example.com/', at('203.0.113.5')), 'https://relay.example.com');
  for (const inside of ['127.0.0.1', '10.0.0.8', '192.168.1.2', '169.254.169.254', '::1', 'fd00::2'])
    await assert.rejects(checkRelay('https://relay.example.com', at(inside)), /private or local/, inside);
  await assert.rejects(checkRelay('https://relay.example.com', async () => []), /does not resolve/);
});

test('the relay choice is saved, waits until remote access is off, and null goes back to the default', async () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'remote-'));
  const notes: unknown[] = [];
  const deps = { secret: () => undefined, setSecret: () => {}, dropSecret: () => {}, apiPort: () => 0, startedAt: () => '', note: (d: unknown) => notes.push(d) };
  fs.writeFileSync(path.join(home, 'relay.json'), JSON.stringify({ url: 'https://relay.example.com' }));
  const r = new Remote(home, deps);
  assert.deepEqual(r.relayView(), { url: 'https://relay.example.com', default: RELAY, custom: true });
  assert.equal(r.view().relay, 'relay.example.com');
  r.saved = { host: 'rosa.relay.example.com' } as never;
  await assert.rejects(r.setRelay(null), /turn remote access off first/);
  r.saved = undefined;
  assert.deepEqual(await r.setRelay(null), { url: RELAY, default: RELAY, custom: false });
  assert.ok(!fs.existsSync(path.join(home, 'relay.json')));
  await assert.rejects(r.setRelay('http://relay.example.com'), /must be https/);
  assert.equal(notes.length, 1);
});
