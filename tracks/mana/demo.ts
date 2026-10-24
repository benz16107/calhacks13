// The Mana track's demo step: the public status shows a task waiting for an OK, with its question, and no prompt.
import type { DemoKit, Task } from '../../core/contract.ts';

export default async function (d: DemoKit) {
  d.workspace('mana', {});
  const prompt = 'ask May the Mana demo spend 0 dollars?\nwrite ok.txt yes';
  const t = await d.api<Task>('POST', '/tasks', { title: 'Mana status check', workspace: 'mana', worker: 'fake', prompt });
  const status = () => d.api('GET', '/t/mana/status');
  const s = await d.waitFor('the task to wait for an OK', async () => {
    const s = await status();
    return s.approvals.some((a: { task: string }) => a.task === t.id) ? s : undefined;
  });
  d.check(s.active.some((x: Task) => x.id === t.id && x.state === 'waiting') && s.counts.waiting >= 1, 'GET /t/mana/status lists the waiting task and its question');
  d.check(!JSON.stringify(s).includes('write ok.txt'), 'the public status carries no prompt');

  const approval = s.approvals.find((a: { task: string }) => a.task === t.id);
  await d.api('POST', `/approvals/${approval.id}`, { approved: true, by: 'demo' });
  await d.settled([t.id]);
  d.check((await status()).recent.some((x: Task) => x.id === t.id && x.state === 'done'), 'after the OK it shows the task done');
}
