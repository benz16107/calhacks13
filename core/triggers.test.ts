import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import type { Box, TaskSpec } from './contract.ts';
import { onFileChange, schedule, webhook } from './triggers.ts';

function fakeBox(created: TaskSpec[]) {
  const hooks = new Map<string, (p: any, h: any) => unknown>();
  const box = { createTask: async (s: TaskSpec) => (created.push(s), { id: 'x' }), onWebhook: (n: string, h: any) => hooks.set(n, h) } as unknown as Box;
  return { box, hooks };
}
const until = async (fn: () => boolean, ms = 2000) => {
  for (const end = Date.now() + ms; Date.now() < end; ) {
    if (fn()) return;
    await new Promise((r) => setTimeout(r, 20));
  }
  throw new Error('timed out');
};

test('schedule fires on its interval', async () => {
  const created: TaskSpec[] = [];
  schedule({ name: 's', everyMs: 30, task: () => ({ title: 't', prompt: 'p' }) }).start(fakeBox(created).box);
  await until(() => created.length >= 1);
});

test('webhook starts a task from its payload', async () => {
  const created: TaskSpec[] = [];
  const { box, hooks } = fakeBox(created);
  webhook({ name: 'w', task: (p: { title: string }) => ({ title: p.title, prompt: 'p' }) }).start(box);
  await hooks.get('w')!({ title: 'from-hook' }, {});
  assert.equal(created[0].title, 'from-hook');
});

test('a new file starts a task', async () => {
  const created: TaskSpec[] = [];
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'trig-'));
  onFileChange({ name: 'f', dir, task: (file) => ({ title: file, prompt: 'p' }) }).start(fakeBox(created).box);
  fs.writeFileSync(path.join(dir, 'a.txt'), 'hi');
  await until(() => created.some((s) => s.title === 'a.txt'));
});
