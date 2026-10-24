// The audit's fingerprint and verify logic, offline. node --experimental-strip-types --test tracks/wallet/audit.test.ts
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

process.env.BOX_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-test-'));
const { audits, fingerprint, latestAudit, verify } = await import('./audit.ts');
const { walletDir } = await import('./lib.ts');

const log = path.join(process.env.BOX_HOME, 'log.jsonl');
const ev = (seq: number) => JSON.stringify({ seq, type: 'note', at: 'x', data: seq }) + '\n';
fs.writeFileSync(log, ev(1) + ev(2) + ev(3) + '{"seq":4,"ty'); // torn last line

test('a torn last line is ignored', () => {
  assert.equal(fingerprint(log).seq, 3);
  assert.equal(fingerprint(log, 2).seq, 2);
});

test('verify matches untouched history, and catches an edited old line', async () => {
  const a = fingerprint(log, 2);
  const b = fingerprint(log, 3);
  const zero = '0'.repeat(64);
  fs.writeFileSync(path.join(walletDir(), 'audit.jsonl'), JSON.stringify({ date: 'd', ...a, prev: zero }) + '\n' + JSON.stringify({ date: 'd', ...b, prev: a.sha256 }) + '\n');
  assert.equal((await latestAudit())?.seq, 3);
  assert.equal((await audits()).length, 2);
  assert.equal((await verify(log, false)).ok, true);
  fs.appendFileSync(log, ev(4)); // new events after a record do not break it
  assert.equal((await verify(log, false)).ok, true);
  fs.writeFileSync(log, fs.readFileSync(log, 'utf8').replace('"data":1', '"data":9'));
  const v = await verify(log, false);
  assert.equal(v.ok, false);
  assert.deepEqual(v.checks.map((c) => c.matches), [false, false]);
});
