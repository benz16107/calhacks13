// Offline tests for the Elastic track: the document each log event becomes, and that the mapping covers it.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import type { Box, LogEvent, Task } from '../../core/contract.ts';

// The track reads BOX_HOME and DEMO_LIVE when it loads: a scratch home, shipping on, as in DEMO_LIVE=elastic ./demo.
process.env.BOX_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'elastic-test-'));
process.env.DEMO_LIVE = 'elastic';
const { MAPPING, OUTBOX, toDoc, default: track } = await import('./track.ts');
const { compareChains, localChain } = await import('./chain.ts');
const { sha256 } = await import('./docs.ts');
test.after(() => fs.rmSync(process.env.BOX_HOME!, { recursive: true, force: true }));

const task = {
  id: 't1', title: 'Job routine', source: 'schedule', workspace: 'jobs', worker: 'fake', hosts: ['boards.greenhouse.io'],
  tools: ['example.spend'], budgetCents: 100, prompt: 'p', state: 'failed', user: 'box-t1', layers: [], costCents: 35,
  createdAt: '', updatedAt: '',
} satisfies Task;
const at = '2026-10-24T03:00:00.000Z';
const events: LogEvent[] = [
  { seq: 1, at, type: 'task.created', task: 't1', user: 'box-t1', spec: { ...task } },
  { seq: 2, at, type: 'tool.call', task: 't1', key: 'line2', tool: 'example.spend', input: { cents: 35 } },
  { seq: 3, at, type: 'tool.result', task: 't1', key: 'line2', ok: true, output: { paid: 35 }, cents: 35 },
  { seq: 4, at, type: 'net.blocked', task: 't1', host: 'www.linkedin.com:443' },
  { seq: 5, at, type: 'approval.asked', task: 't1', approval: { id: 't1.k', task: 't1', question: 'Spend?', costCents: 50, state: 'pending' } },
  { seq: 6, at, type: 'approval.answered', task: 't1', id: 't1.k', approved: false, by: 'phone' },
  { seq: 7, at, type: 'cost', task: 't1', cents: 2, what: 'model', model: 'sonnet', tokens: { input: 10, output: 5, cacheWrite: 0, cacheRead: 1 } },
  { seq: 8, at, type: 'task.step', task: 't1', text: 'write plan.txt' },
  { seq: 9, at, type: 'task.state', task: 't1', state: 'done' },
  { seq: 10, at, type: 'task.state', task: 't1', state: 'failed', error: 'worker exited with 1' },
  { seq: 11, at, type: 'note', track: 'shopper', data: { kind: 'watch' } },
  { seq: 12, at, type: 'note', track: 'elastic', data: { kind: 'integrity', ok: false, checked: 11, throughSeq: 11, pending: 0, edited: [4], missing: [], reordered: [], localBreaks: [5] } },
  { seq: 13, at, prev: 'p', who: { asked: 'sam', seat: 'Credit analyst', approver: 'rosa' }, type: 'approval.asked', task: 't1', approval: { id: 't1.k2', task: 't1', question: 'Spend $200?', costCents: 20000, state: 'pending', askedBy: 'sam', route: { rule: 'r', to: 'the Controller', amountCents: 20000, people: [{ id: 'rosa', name: 'Rosa Delgado' }], why: 'w' } } },
  { seq: 14, at, who: { asked: 'sam', approver: 'rosa' }, type: 'approval.answered', task: 't1', id: 't1.k2', approved: true, by: 'Rosa Delgado', person: 'rosa', via: 'phone' },
];
const doc = (n: number, extra = {}) => toDoc(events[n - 1], events[n - 1].type === 'note' ? undefined : task, extra);

test('each document says whose it is, when, and what happened in one sentence', () => {
  const d = doc(4);
  assert.equal(d['@timestamp'], at);
  assert.deepEqual([d.event.seq, d.event.type, d.app, d.task.title, d.task.hosts], [4, 'net.blocked', 'schedule', 'Job routine', ['boards.greenhouse.io']]);
  assert.deepEqual(d.net, { host: 'www.linkedin.com:443', domain: 'www.linkedin.com' });
  assert.match(d.message, /blocked "Job routine" from reaching www\.linkedin\.com:443; it may reach only boards\.greenhouse\.io/);
});

test('spending lands in cost_cents, with the tool name from its call', () => {
  const r = doc(3, { tool: 'example.spend' });
  assert.deepEqual([r.cost_cents, r.tool.name, r.tool.track, r.tool.ok], [35, 'example.spend', 'example', true]);
  assert.equal(doc(7).cost_cents, 2);
  assert.deepEqual(doc(7).cost.tokens, { input: 10, output: 5, cache_write: 0, cache_read: 1 });
});

test('a done task lists the files it changed; a failed one says why', () => {
  const d = doc(9, { changes: [{ path: 'b.txt', change: 'added' }, { path: 'a.txt', change: 'modified' }] });
  assert.deepEqual(d.files, { added: ['b.txt'], modified: ['a.txt'], deleted: [], count: 2 });
  assert.match(d.message, /is done, changing 2 files: b\.txt \(added\), a\.txt \(modified\)/);
  assert.match(doc(10).message, /failed: worker exited with 1; its file changes were not applied/);
  assert.equal(doc(11).app, 'shopper');
});

test('every field a document has is in the mapping, so none is silently left out of search', () => {
  const mapped = new Set<string>();
  const walk = (props: Record<string, any>, at = '') => {
    for (const [k, v] of Object.entries(props)) v.properties ? walk(v.properties, `${at}${k}.`) : mapped.add(at + k);
  };
  walk(MAPPING.properties);
  const leaves = (o: Record<string, any>, at = ''): string[] =>
    Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' && !Array.isArray(v) ? leaves(v, `${at}${k}.`) : v === undefined ? [] : [at + k]));
  const extra = { tool: 'example.spend', changes: [{ path: 'b.txt', change: 'added' as const }] };
  const missing = events.flatMap((_, i) => leaves(doc(i + 1, extra))).filter((f) => f !== 'event.original' && !mapped.has(f));
  assert.deepEqual([...new Set(missing)], []);
});

test('the reader ships every event once, in order, in bulk; a failed send is sent again', async () => {
  const sent: string[] = [];
  let down = true;
  const box = {
    task: () => task,
    job: async (name: string, input: { lines: string }) => {
      assert.equal(name, 'elastic.bulk');
      if (down) throw new Error('Elastic is down');
      sent.push(...input.lines.split('\n').filter(Boolean));
      return { indexed: 1 };
    },
  } as unknown as Box;
  const reader = track.logReaders[0];
  const settle = () => new Promise((r) => setTimeout(r, 20));
  await reader.read(events[1], box); // Elastic is down: the document waits in the outbox
  await settle();
  assert.equal(sent.length, 0);
  down = false;
  for (const e of events.slice(2, 4)) await reader.read(e, box);
  await settle();
  assert.deepEqual(sent.map((l) => JSON.parse(l).event.seq), [2, 3, 4]);
  assert.equal(fs.readFileSync(path.join(path.dirname(OUTBOX), 'sent'), 'utf8'), String(fs.statSync(OUTBOX).size), 'it knows everything was sent');
});

test('with no Elastic keys, or empty ones, the job sends nothing and does not fail', async () => {
  const job = track.modelJobs[0];
  const missing = { secret: (n: string) => { throw new Error(`the vault has no ${n}`); } };
  const empty = { secret: () => ' ' };
  for (const ctx of [missing, empty]) assert.deepEqual(await job.run({ lines: '' }, ctx as any), { skipped: 'the vault has no ELASTIC_URL or ELASTIC_BOX_KEY' });
});

test('a document carries the entry hash, the chain link, the people behind it and a sentence to search by meaning', () => {
  const d = doc(13);
  assert.equal(d.event.hash, sha256(JSON.stringify(events[12])));
  assert.equal(d.event.prev, 'p');
  assert.deepEqual(d.who, { asked: 'sam', seat: 'Credit analyst', approver: 'rosa', trigger: undefined, by: undefined });
  assert.deepEqual([d.approval.to, d.approval.route_people, d.approval.asked_by], ['the Controller', ['rosa'], 'sam']);
  assert.match(d.semantic, /paused to ask: Spend \$200\?/);
  const a = doc(14);
  assert.deepEqual([a.approval.person, a.approval.via, a.who.approver], ['rosa', 'phone', 'rosa']);
  assert.equal(doc(7).semantic, undefined, 'a cost line is not searched by meaning');
  const n = doc(12);
  assert.deepEqual([n.integrity.ok, n.integrity.edited, n.integrity.local_breaks], [false, 1, 1]);
  assert.match(n.message, /INTEGRITY ALERT.*first at entry 4/);
});

test('the chain check names an edited, a missing and a reordered entry, and a clean log passes', () => {
  const local = ['a', 'b', 'c', 'd', 'e'];
  const remote = new Map(local.map((h, i) => [i + 1, h] as [number, string]));
  assert.deepEqual(compareChains(local, remote), { ok: true, checked: 5, pending: 0, throughSeq: 5, edited: [], missing: [], reordered: [], localBreaks: [] });
  assert.equal(compareChains([...local, 'f'], remote).pending, 1, 'an entry not shipped yet is not a problem');
  assert.deepEqual(compareChains(['a', 'X', 'c', 'd', 'e'], remote).edited, [2]);
  assert.deepEqual(compareChains(['a', 'b', 'c'], remote).missing, [4, 5]);
  const swapped = compareChains(['a', 'c', 'b', 'd', 'e'], remote);
  assert.deepEqual([swapped.reordered, swapped.edited, swapped.ok], [[2, 3], [], false]);
  assert.equal(compareChains(local, remote, [3]).ok, false, 'a broken local link alone fails the check');
  // A rewritten chain: every entry from the edit on has a new hash, so the box's own links agree and Elastic's copy does not.
  assert.deepEqual(compareChains(['a', 'b', 'C', 'D', 'E'], remote).edited, [3, 4, 5]);
});

test('the local chain check reads a log file: a clean one passes, an edited line breaks the link after it', () => {
  const file = path.join(process.env.BOX_HOME!, 'log-check.jsonl');
  const lines: string[] = [];
  let prev = '0'.repeat(64);
  for (let i = 1; i <= 4; i++) {
    const line = JSON.stringify({ seq: i, at, prev, type: 'note', track: 'x', data: i });
    lines.push(line);
    prev = sha256(line);
  }
  fs.writeFileSync(file, lines.join('\n') + '\n');
  assert.deepEqual(localChain(file).breaks, []);
  lines[1] = lines[1].replace('"data":2', '"data":9');
  fs.writeFileSync(file, lines.join('\n') + '\n');
  assert.deepEqual(localChain(file).breaks, [3]);
  // Stripping prev from every line after the edit does not hide it.
  fs.writeFileSync(file, lines.map((l, i) => (i < 2 ? l : JSON.stringify({ ...JSON.parse(l), prev: undefined }))).join('\n') + '\n');
  assert.deepEqual(localChain(file).breaks, [3, 4]);
});
