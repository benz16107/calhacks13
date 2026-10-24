// The example track's demo step: a route starts a task, and a task spends through a tool within budget.
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
}
