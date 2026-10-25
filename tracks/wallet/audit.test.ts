// The audit's fingerprint and verify logic, offline. node --experimental-strip-types --test tracks/wallet/audit.test.ts
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

process.env.BOX_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-test-'));
const { audits, fingerprint, latestAudit, memoText, verify } = await import('./audit.ts');
const { createHash } = await import('node:crypto');
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

test('head is the hash of line N as written, the value the next chained line carries as prev', () => {
  const sha = (t: string) => createHash('sha256').update(t).digest('hex');
  const chain = path.join(process.env.BOX_HOME!, 'chain.jsonl');
  const l1 = JSON.stringify({ seq: 1, type: 'note', prev: '0'.repeat(64) });
  const l2 = JSON.stringify({ seq: 2, type: 'note', prev: sha(l1) });
  const l3 = JSON.stringify({ seq: 3, type: 'note', prev: sha(l2) });
  fs.writeFileSync(chain, [l1, l2, l3].map((l) => l + '\n').join(''));
  assert.equal(fingerprint(chain, 2).head, sha(l2));
  assert.equal(fingerprint(chain, 2).head, JSON.parse(l3).prev);
  assert.equal(fingerprint(chain).head, sha(l3));
  assert.equal(fingerprint(path.join(process.env.BOX_HOME!, 'none.jsonl')).head, undefined);
});

test('the memo puts head last, and is unchanged for records without one', () => {
  const r = { seq: 7, sha256: 'a'.repeat(64), prev: 'b'.repeat(64) };
  assert.equal(memoText(r), `gurtos-audit v1 seq=7 sha256=${r.sha256} prev=${r.prev}`);
  assert.equal(memoText({ ...r, head: 'c'.repeat(64) }), `gurtos-audit v1 seq=7 sha256=${r.sha256} prev=${r.prev} head=${'c'.repeat(64)}`);
  assert.ok(memoText({ ...r, head: 'c'.repeat(64) }).length < 566); // the Memo program takes up to 566 bytes
});

test('verify also catches an edit that keeps the record, via head', async () => {
  const a = fingerprint(log, 2);
  assert.ok(a.head);
  fs.writeFileSync(path.join(walletDir(), 'audit.jsonl'), JSON.stringify({ date: 'd', ...a, head: 'f'.repeat(64), prev: '0'.repeat(64) }) + '\n');
  assert.equal((await verify(log, false)).checks[0].matches, false);
});
