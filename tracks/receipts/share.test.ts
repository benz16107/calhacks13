// POST /t/receipts/share against a scratch box folder: it works with a damaged audit file, says so when the log
// no longer holds the task, and writes the signing key all at once.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

const home = fs.mkdtempSync(path.join(os.tmpdir(), 'receipts-test-'));
process.env.BOX_HOME = home;
const { default: track } = await import('./track.ts');
test.after(() => fs.rmSync(home, { recursive: true, force: true }));

let prev = '0'.repeat(64);
const lines = [{ type: 'task.created', task: 'a', spec: { title: 'Do it', source: 'demo', prompt: 'x', hosts: [] }, user: 'box-a' }, { type: 'task.state', task: 'a', state: 'done' }].map((e, i) => {
  const line = JSON.stringify({ seq: i + 1, at: `2026-10-24T10:00:0${i}.000Z`, ...e, prev });
  prev = createHash('sha256').update(line).digest('hex');
  return line;
});
fs.writeFileSync(path.join(home, 'log.jsonl'), lines.join('\n') + '\n');

const notes: unknown[] = [];
const box: any = { task: (id: string) => (['a', 'gone'].includes(id) ? { id, state: 'done' } : undefined), note: (d: unknown) => notes.push(d), secret: () => '' };
const share = (task: string) =>
  track.routes!['POST /share'](new Request('http://127.0.0.1:7700/t/receipts/share', { method: 'POST', headers: { 'x-box-caller': 'screen' }, body: JSON.stringify({ task }) }), box);

test('a receipt is made when the daily audit file ends in a half-written line', async () => {
  fs.mkdirSync(path.join(home, 'wallet'));
  fs.writeFileSync(path.join(home, 'wallet', 'audit.jsonl'), '{"date":"2026-10-24","seq":');
  const r = await share('a');
  assert.equal(r.status, 200, await r.clone().text());
  const body = (await r.json()) as { id: string; anchors: { solana: boolean } };
  assert.equal(body.anchors.solana, false);
  assert.ok(fs.existsSync(path.join(home, 'receipts', `${body.id}.json`)));
  assert.ok(fs.existsSync(path.join(home, 'receipts', 'key.json')) && !fs.existsSync(path.join(home, 'receipts', 'key.json.new')), 'the key file is whole, with nothing left over');
  assert.equal(notes.filter((n: any) => n.kind === 'receipts.key').length, 1, 'the key was logged once');
});

test('a task the log no longer holds gets a clear 404', async () => {
  const r = await share('gone');
  assert.equal(r.status, 404);
  assert.match(((await r.json()) as any).error, /no longer holds/);
});
