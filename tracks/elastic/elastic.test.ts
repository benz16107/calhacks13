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
  for (const ctx of [missing, empty]) assert.deepEqual(await job.run({ lines: '' }, ctx as any), { skipped: 'the vault has no ELASTIC_URL or ELASTIC_API_KEY' });
});
