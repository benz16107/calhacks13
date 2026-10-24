import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import type { TaskSpec } from './contract.ts';
import { Log, canMove, doneLayers, fold } from './log.ts';

const spec: Required<TaskSpec> = { title: 't', prompt: 'p', workspace: 'w', worker: 'fake', tools: [], hosts: [], budgetCents: 0, source: 'test' };

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
