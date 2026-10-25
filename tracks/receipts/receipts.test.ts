// Offline tests: build a receipt from a hand-made log, then check it with the code that verify.html runs.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { buildReceipt, newKey, sha256, type Receipt } from './receipt.ts';

// The checker lives in verify.html, so the page and the tests run the same code.
const html = fs.readFileSync(new URL('./verify.html', import.meta.url), 'utf8');
const code = html.match(/<script type="module" id="verifier">([\s\S]*?)<\/script>/)![1];
const { verifyReceipt } = (await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)) as { verifyReceipt: (r: unknown, o?: unknown) => Promise<{ ok: boolean; checks: { name: string; ok: boolean | null; detail: string }[] }> };

// A small log in the core's format: each line carries the hash of the line before it.
function makeLog(): string[] {
  const events: Record<string, unknown>[] = [
    { type: 'task.created', task: 'a', spec: { title: 'Buy a GPU hour', source: 'demo', prompt: 'buy it', hosts: [] }, user: 'box-a' },
    { type: 'task.created', task: 'b', spec: { title: 'Other work', source: 'demo', prompt: 'x', hosts: [] }, user: 'box-b' },
    { type: 'task.state', task: 'a', state: 'running' },
    { type: 'approval.asked', task: 'a', approval: { id: 'a.k', task: 'a', question: 'Spend $8.00 on a GPU hour?', costCents: 800, state: 'pending' } },
    { type: 'task.step', task: 'b', text: 'write other.txt' },
    { type: 'approval.answered', task: 'a', id: 'a.k', approved: true, by: 'Rosa Delgado', person: 'rosa', via: 'phone' },
    { type: 'cost', task: 'a', cents: 800, what: 'example.spend' },
    { type: 'task.state', task: 'a', state: 'done' },
    { type: 'note', track: 'x', data: 1 },
    { type: 'note', track: 'x', data: 2 },
  ];
  const lines: string[] = [];
  let prev = '0'.repeat(64);
  events.forEach((e, i) => {
    const line = JSON.stringify({ seq: i + 1, at: `2026-10-24T10:00:0${i}.000Z`, ...e, prev });
    lines.push(line);
    prev = sha256(line);
  });
  return lines;
}

const key = newKey();
const make = (lines = makeLog(), mode: 'full' | 'redacted' = 'full', anchors = {}) => buildReceipt({ lines, taskId: 'a', mode, box: { name: 'Test box', machine: 'm1' }, key, id: 'r1', anchors });
const names = (v: { checks: { name: string; ok: boolean | null }[] }, ok: boolean | null) => v.checks.filter((c) => c.ok === ok).map((c) => c.name);

test('a receipt checks out: signature, key, chain and every line', async () => {
  const r = make();
  assert.deepEqual([r.task.state, r.task.costCents, r.entries.length, r.chain.from, r.chain.to], ['done', 800, 6, 1, 8]);
  assert.match(r.entries.find((e) => e.type === 'approval.answered')!.text, /Approved by Rosa Delgado from phone/);
  const v = await verifyReceipt(r);
  assert.equal(v.ok, true, JSON.stringify(v.checks));
  assert.deepEqual(names(v, true), ['Signature', 'Signing key', 'Chain', 'Entries']);
});

test('one changed byte anywhere in the receipt breaks the signature', async () => {
  const r = make();
  for (const edit of [(x: Receipt) => (x.task.costCents = 1), (x: Receipt) => (x.task.title = 'Buy a GPU hours'), (x: Receipt) => (x.entries[2].text = 'Denied by Rosa Delgado')]) {
    const t = structuredClone(r);
    edit(t);
    const v = await verifyReceipt(t);
    assert.equal(v.ok, false);
    assert.ok(names(v, false).includes('Signature'));
  }
});

test('a log line changed before the receipt was made shows as a broken chain, even with a valid signature', async () => {
  const lines = makeLog();
  lines[4] = lines[4].replace('write other.txt', 'write other.TXT'); // an entry of another task, between two of this one's
  const v = await verifyReceipt(make(lines));
  assert.equal(v.ok, false);
  assert.deepEqual(names(v, false), ['Chain']);
  assert.match(v.checks.find((c) => c.name === 'Chain')!.detail, /broken at entry 6/);
});

test('a line edited inside the receipt fails the entry check, and the signature too', async () => {
  const r = make();
  const t = structuredClone(r);
  t.entries[2].line = t.entries[2].line!.replace('800', '8');
  const v = await verifyReceipt(t);
  assert.ok(names(v, false).includes('Entries') && names(v, false).includes('Signature'));
});

test('a redacted receipt hides text and amounts, and still checks out', async () => {
  const r = make(makeLog(), 'redacted');
  const all = JSON.stringify(r);
  assert.ok(!all.includes('GPU hour?') && !all.includes('$8.00') && !all.includes('example.spend'));
  assert.equal(r.task.costCents, null);
  assert.ok(r.entries.every((e) => e.line === undefined));
  const v = await verifyReceipt(r);
  assert.equal(v.ok, true, JSON.stringify(v.checks));
  assert.match(v.checks.find((c) => c.name === 'Entries')!.detail, /text left out/);
});

test('the Solana anchor: the chain must reach its fingerprint, and the memo must say the same', async () => {
  const lines = makeLog();
  const head = sha256(lines[9]);
  const solana = { seq: 10, head, sha256: 'ab'.repeat(32), prev: '00'.repeat(32), tx: 'TX', date: '2026-10-24' };
  const r = make(lines, 'full', { solana });
  assert.equal(r.chain.through, 10);
  const memo = `gurtos-audit v1 seq=10 sha256=${solana.sha256} prev=${solana.prev} head=${head}`;
  const good = await verifyReceipt(r, { memo: async () => ({ memo, time: '2026-10-24T11:00:00.000Z' }) });
  assert.deepEqual([good.ok, names(good, true).includes('Solana')], [true, true]);
  const other = await verifyReceipt(r, { memo: async () => ({ memo: memo.replace('head=', 'head=00') }) });
  assert.deepEqual([other.ok, names(other, false)], [false, ['Solana']]);
  const offline = await verifyReceipt(r, { memo: async () => { throw new Error('offline'); } });
  assert.deepEqual([offline.ok, names(offline, null).includes('Solana')], [true, true], 'not reaching Solana is "not checked", not a pass');
});

test('Elastic is reported as the box saw it, never as a pass the page made', async () => {
  const bad = await verifyReceipt(make(makeLog(), 'full', { elastic: { checked: 8, matched: false, at: 'now' } }));
  assert.deepEqual([bad.ok, names(bad, false)], [false, ['Elastic']]);
  const good = await verifyReceipt(make(makeLog(), 'full', { elastic: { checked: 8, matched: true, at: 'now' } }));
  assert.deepEqual([good.ok, names(good, null).includes('Elastic')], [true, true]);
});
