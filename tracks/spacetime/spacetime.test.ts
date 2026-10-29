// The box's connection to its own SpacetimeDB must not get stuck: a failure is not kept (the next call tries
// again), a server that never answers gives up, and the Live board's routes say why when the database is down.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import type { Track } from '../../core/contract.ts';

const home = fs.mkdtempSync(path.join(os.tmpdir(), 'spacetime-test-'));
// A port that accepts connections and never answers, like a database that hangs.
const silent = net.createServer((s) => s.on('error', () => {}));
await new Promise<void>((r) => silent.listen(0, '127.0.0.1', r));
Object.assign(process.env, { BOX_HOME: home, BOX_STDB_URL: `ws://127.0.0.1:${(silent.address() as net.AddressInfo).port}`, BOX_STDB_WAIT_MS: '400' });
const { local } = await import('./local.ts');
const { default: track } = await import('./track.ts');
test.after(() => {
  silent.close();
  fs.rmSync(home, { recursive: true, force: true });
});

test('a connection that failed is not kept: once the login file exists the next call tries again', async () => {
  await assert.rejects(local(), /not set up on this computer yet/);
  fs.mkdirSync(path.join(home, 'spacetime'));
  fs.writeFileSync(path.join(home, 'spacetime', 'cli.toml'), 'spacetimedb_token = "abc"\n');
  const t0 = Date.now();
  await assert.rejects(local(), /not reachable on this computer: no answer in 0.4 s/, 'a database that never answers is given up on');
  assert.ok(Date.now() - t0 < 3000);
  await assert.rejects(local(), /not reachable/, 'and the next call tries again, not the same failure');
});

test("the Live board's routes answer 503 with the reason when the database is down", async () => {
  for (const key of ['GET /team', 'GET /snapshot']) {
    const r = await (track as Track).routes![key](new Request('http://box/t/spacetime/x'), {} as any);
    assert.equal(r.status, 503, key);
    assert.match(((await r.json()) as any).error, /Live state \(SpacetimeDB\) is not reachable/);
  }
});
