import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import type { FullSpec } from './contract.ts';
import { Log, approvalId, canMove, chainBreaks, doneLayers, fold, hashLine, plainText } from './log.ts';

const spec: FullSpec = { title: 't', prompt: 'p', workspace: 'w', worker: 'fake', tools: [], hosts: [], budgetCents: 0, source: 'test' };

test('replays the log after a hard kill left half a line', () => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'log-')), 'log.jsonl');
  const log = new Log(file);
  log.append({ type: 'task.created', task: 'a', spec, user: 'box-a' });
  log.append({ type: 'task.state', task: 'a', state: 'running', layers: [] });
  fs.appendFileSync(file, '{"seq":3,"type":"task.st'); // the power went out mid-write

  const again = new Log(file);
  assert.equal(again.events.length, 2);
  again.append({ type: 'cost', task: 'a', cents: 5, what: 'model' });
  const s = fold(new Log(file).events);
  assert.equal(s.tasks.get('a')?.state, 'running');
  assert.equal(s.tasks.get('a')?.costCents, 5);
});

test('a torn tail is trimmed by bytes, so a multi-byte character earlier survives', () => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'log-')), 'log.jsonl');
  const log = new Log(file);
  // An earlier line with em dashes (3 bytes each in UTF-8): its byte length exceeds its character length.
  log.append({ type: 'task.created', task: 'a', spec: { ...spec, title: 'buy milk — bread — eggs' }, user: 'box-a' });
  log.append({ type: 'task.state', task: 'a', state: 'running', layers: [] });
  fs.appendFileSync(file, '{"seq":3,"type":"task.st'); // power cut mid-write

  const again = new Log(file);
  assert.equal(again.events.length, 2);
  assert.equal(again.events[0].type === 'task.created' && again.events[0].spec.title, 'buy milk — bread — eggs');
  again.append({ type: 'cost', task: 'a', cents: 5, what: 'model' });
  const reread = fold(new Log(file).events);
  assert.equal(reread.tasks.get('a')?.costCents, 5);
  assert.equal(reread.tasks.get('a')?.title, 'buy milk — bread — eggs'); // the good line was not corrupted
});

test('done layers are newest first and skip undone tasks', () => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'log-')), 'log.jsonl');
  const log = new Log(file);
  for (const id of ['a', 'b', 'c']) {
    log.append({ type: 'task.created', task: id, spec, user: `box-${id}` });
    log.append({ type: 'task.state', task: id, state: 'running' });
  }
  for (const id of ['b', 'a', 'c']) log.append({ type: 'task.state', task: id, state: 'done' });
  log.append({ type: 'task.state', task: 'a', state: 'undone' });
  assert.deepEqual(doneLayers(log.events, fold(log.events), 'w'), ['c', 'b']);
});

test('state changes follow the rules', () => {
  assert.ok(canMove('running', 'waiting'));
  assert.ok(canMove('done', 'undone'));
  assert.ok(!canMove('done', 'running'));
  assert.ok(!canMove('undone', 'done'));
});

test('a worker\'s closing step becomes the task summary', () => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'log-')), 'log.jsonl');
  const log = new Log(file);
  log.append({ type: 'task.created', task: 'a', spec, user: 'box-a' });
  log.append({ type: 'task.step', task: 'a', text: 'Read page.html', data: { tool: 'Read' } });
  assert.equal(fold(log.events).tasks.get('a')?.summary, undefined);
  log.append({ type: 'task.step', task: 'a', text: 'Summarized the listing: a used road bike.', data: { summary: true } });
  const t = fold(new Log(file).events).tasks.get('a');
  assert.equal(t?.summary, 'Summarized the listing: a used road bike.');
  assert.equal(t?.step, 'Summarized the listing: a used road bike.');
});

test('each entry carries the hash of the line before it, across restarts, and an edit breaks the chain', () => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'log-')), 'log.jsonl');
  const log = new Log(file);
  log.append({ type: 'task.created', task: 'a', spec, user: 'box-a' });
  log.append({ type: 'task.state', task: 'a', state: 'running', layers: [] });
  new Log(file).append({ type: 'cost', task: 'a', cents: 5, what: 'model' }); // a restart carries the chain on
  const lines = () => fs.readFileSync(file, 'utf8').split('\n').filter(Boolean);
  assert.equal(JSON.parse(lines()[0]).prev, '0'.repeat(64));
  assert.equal(JSON.parse(lines()[2]).prev, hashLine(lines()[1]));
  assert.deepEqual(chainBreaks(lines()), []);

  const edited = lines();
  edited[1] = edited[1].replace('running', 'done'); // root rewrites the middle of the record
  assert.deepEqual(chainBreaks(edited), [3]);
  assert.deepEqual(chainBreaks([lines()[0], lines()[2]]), [2]); // a removed entry
  assert.deepEqual(chainBreaks([lines()[1], lines()[0], lines()[2]]), [1, 2, 3]); // a reordered one
});

test('a log from before the chain still loads, and the chain starts at its first new entry', () => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'log-')), 'log.jsonl');
  const old = JSON.stringify({ seq: 1, at: '2026-10-01T00:00:00.000Z', type: 'task.created', task: 'a', spec, user: 'box-a' });
  fs.writeFileSync(file, old + '\n');
  new Log(file).append({ type: 'task.state', task: 'a', state: 'running', layers: [] });
  const lines = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean);
  assert.equal(JSON.parse(lines[1]).prev, hashLine(old));
  assert.deepEqual(chainBreaks(lines), []);
});

test('an event cannot bring its own prev, and stripping prev from the lines after an edit still shows the edit', () => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'log-')), 'log.jsonl');
  const log = new Log(file);
  log.append({ type: 'task.created', task: 'a', spec, user: 'box-a' });
  log.append({ type: 'cost', task: 'a', cents: 5, what: 'model', prev: 'forged' } as any); // a caller tries to set the link
  log.append({ type: 'task.state', task: 'a', state: 'running', layers: [] });
  const lines = () => fs.readFileSync(file, 'utf8').split('\n').filter(Boolean);
  assert.equal(JSON.parse(lines()[1]).prev, hashLine(lines()[0]));
  assert.deepEqual(chainBreaks(lines()), []);

  const edited = lines();
  edited[0] = edited[0].replace('"t"', '"edited"');
  const stripped = edited.map((l, i) => (i === 0 ? l : JSON.stringify({ ...JSON.parse(l), prev: undefined })));
  assert.deepEqual(chainBreaks(stripped), [2, 3], 'lines without prev after the chain began are breaks');
});

test('a write cut short by a full disk never leaves half a line in front of the next one', (t) => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'log-')), 'log.jsonl');
  const log = new Log(file);
  log.append({ type: 'task.created', task: 'a', spec, user: 'box-a' });
  // The disk fills up: the kernel takes part of the line, then refuses the rest.
  const real = fs.writeSync;
  let calls = 0;
  t.mock.method(fs, 'writeSync', (fd: number, data: string | Buffer, ...rest: unknown[]) => {
    if (++calls === 1) return (real as (...a: unknown[]) => number)(fd, Buffer.from(data).subarray(0, 20), ...rest);
    throw Object.assign(new Error('ENOSPC: no space left on device, write'), { code: 'ENOSPC' });
  });
  assert.throws(() => log.append({ type: 'task.state', task: 'a', state: 'running', layers: [] }), /ENOSPC/);
  t.mock.restoreAll();
  assert.equal(log.events.length, 1, 'an event that did not reach the disk is not in memory either');
  // Space comes back and the box carries on: the next line must not land after the torn fragment.
  log.append({ type: 'task.state', task: 'a', state: 'running', layers: [] });
  const again = new Log(file);
  assert.deepEqual(again.events.map((e) => e.seq), [1, 2]);
  assert.deepEqual(chainBreaks(fs.readFileSync(file, 'utf8').split('\n').filter(Boolean)), []);
});

test('a box upgraded from v0.1.0-preview answers from its old approvals, and a task still cannot name the core\'s', () => {
  // A v0.1.0-style log: a task's own question was <task>.<key>, a tool's <task>.<call>.ask.<hash>, a budget one <task>.budget.<action>.
  const ask = (id: string, question: string) => ({ type: 'approval.asked' as const, task: 'a', approval: { id, task: 'a', question, costCents: 0, state: 'pending' as const } });
  const s = fold(
    [
      { type: 'task.created', task: 'a', spec, user: 'box-a' },
      ask('a.deploy', 'Deploy to production?'),
      { type: 'approval.answered', task: 'a', id: 'a.deploy', approved: true, by: 'owner' },
      ask('a.line2.ask.0123abcd', 'Send the invoice?'),
      ask('a.budget.example.spend:00ff', 'Spend $900?'),
    ].map((e, i) => ({ ...e, seq: i + 1, at: '2026-10-24T20:00:00Z' })) as never,
  );
  assert.equal(approvalId(s.approvals, 'a', 'task.deploy', { key: 'deploy' }), 'a.deploy', "the task's answered question is reused, not asked again");
  assert.equal(approvalId(s.approvals, 'a', 'task.other', { key: 'other' }), 'a.task.other', 'a new question gets the new id');
  assert.equal(approvalId(s.approvals, 'a', 'task.budget.example.spend:00ff', { key: 'budget.example.spend:00ff' }), 'a.task.budget.example.spend:00ff', "a task's key in the core's space never reaches the core's approval");
  assert.equal(approvalId(s.approvals, 'a', 'tool.line2.ask.0123abcd', { key: 'line2.ask.0123abcd', question: 'Send the invoice?' }), 'a.line2.ask.0123abcd', "a tool's pending question is the same one");
  assert.equal(approvalId(s.approvals, 'a', 'tool.line2.ask.0123abcd', { key: 'line2.ask.0123abcd', question: 'Something else?' }), 'a.tool.line2.ask.0123abcd', 'other words: a new question');
  assert.equal(approvalId(s.approvals, 'a', 'budget.example.spend:00ff'), 'a.budget.example.spend:00ff', "the core's own keys did not change");
});

test('an agent\'s question is shown as plain text: no direction overrides or invisible characters, at most the cap', () => {
  assert.equal(plainText('\u202eDEVORPPA\u202c ok', 2000), 'DEVORPPA ok');
  assert.equal(plainText('a\u200bb\u2066c\u2069\u0007d\ufeff', 100), 'abcd');
  assert.equal(plainText('line one\nline two\ttab', 100), 'line one\nline two\ttab', 'newlines and tabs stay');
  assert.equal(plainText('Café — 写真 ✓', 100), 'Café — 写真 ✓', 'letters and symbols of any language stay');
  const long = plainText(`${'A'.repeat(100_000)} [policy 0123456789ab]`, 2000);
  assert.equal(long.length, 2000);
  assert.ok(long.startsWith('AAA') && long.includes('…') && long.endsWith('[policy 0123456789ab]'), 'the start and the end stay');
});

test('a task records the app that created it, whatever source it gave', () => {
  const s = fold([{ type: 'task.created', task: 'a', spec: { ...spec, source: 'github:owner/repo#7' }, user: 'box-a', app: 'factory' }, { type: 'task.created', task: 'b', spec: { ...spec, source: 'jira:BOX-1' }, user: 'box-b' }].map((e, i) => ({ ...e, seq: i + 1, at: '2026-10-29T20:00:00Z' })) as never);
  assert.equal(s.tasks.get('a')?.app, 'factory');
  assert.equal(s.tasks.get('b')?.app, undefined, 'a task from before: the box falls back to its source (box.ts appOf)');
});
