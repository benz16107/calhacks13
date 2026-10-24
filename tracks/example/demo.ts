// The example track's demo step: a route, a tool within budget, and two triggers (webhook, file change).
import fs from 'node:fs';
import path from 'node:path';
import type { DemoKit, Task } from '../../core/contract.ts';

export default async function (d: DemoKit) {
  d.workspace('example', {});
  const t = await d.api<Task>('POST', '/t/example/start', { workspace: 'example', prompt: 'write hello.txt hi' });
  await d.settled([t.id]);
  d.check(d.view('example', 'hello.txt') === 'hi', 'a track route started a task and it ran');

  const s = await d.api<Task>('POST', '/tasks', {
    title: 'Spend within budget',
    workspace: 'example',
    worker: 'fake',
    tools: ['example.spend'],
    budgetCents: 500,
    prompt: 'call example.spend {"cents":300,"on":"coffee"}',
  });
  await d.settled([s.id]);
  const { task, events } = await d.api('GET', `/tasks/${s.id}`);
  d.check(task.costCents === 300, 'a tool call within budget ran and its cost was counted');
  d.check(!JSON.stringify(events).includes('canary'), 'the vault secret it used is not in the log');

  // Webhook trigger: a POST to /hook/<track>/<name> starts a task.
  await d.api('POST', '/hook/example/start', { title: 'via webhook' });
  const byHook = await d.waitFor('the webhook to start a task', async () => (await d.api<Task[]>('GET', '/tasks')).find((x) => x.source === 'webhook'));
  await d.settled([byHook.id]);
  d.check(d.view('home', 'hook.txt') === 'yes', 'a webhook started a task (POST /hook/example/start)');

  // File-change trigger: a new file in the watched inbox starts a task.
  const inbox = path.join(d.home, 'inbox', 'example');
  fs.mkdirSync(inbox, { recursive: true });
  fs.writeFileSync(path.join(inbox, 'job.txt'), 'please');
  const byFile = await d.waitFor('the file drop to start a task', async () => (await d.api<Task[]>('GET', '/tasks')).find((x) => x.source === 'file'));
  await d.settled([byFile.id]);
  d.check(d.view('home', 'seen-job.txt') === 'yes', 'a new file in the inbox started a task');
}
