// The Apify track's demo step: tasks with no network get live web results through Apify Actors, and the token
// never reaches them. Without APIFY_TOKEN in /etc/box/vault.env it shows the tools refuse, then skips the live runs.
import fs from 'node:fs';
import path from 'node:path';
import type { DemoKit, LogEvent, Task } from '../../core/contract.ts';

type Run = { task: Task; events: LogEvent[] };

export default async function (d: DemoKit) {
  const { tools } = await d.api<{ tools: string[] }>('GET', '/health');
  d.check(['apify.run', 'apify.checkPrice', 'apify.findPlaces'].every((t) => tools.includes(t)), 'the box loaded the Apify tools');

  d.workspace('apify', {});
  const token = fs.readFileSync(path.join(d.home, 'vault.env'), 'utf8').match(/^APIFY_TOKEN=(.+)$/m)?.[1].trim();
  // A fake worker with no hosts: the task's own network reaches nothing, so all web work goes through the broker.
  const start = (title: string, tool: string, input: object) =>
    d.api<Task>('POST', '/tasks', { title, workspace: 'apify', worker: 'fake', source: 'demo', tools: [tool], budgetCents: 5, prompt: `call ${tool} ${JSON.stringify(input)}` });
  // Live Actor runs take longer than d.settled waits, and a failed task is a result to check here, not a throw.
  const finish = (id: string) =>
    d.waitFor(`task ${id} to finish`, async () => {
      const r = await d.api<Run>('GET', `/tasks/${id}`);
      return r.task.state === 'done' || r.task.state === 'failed' ? r : undefined;
    }, 180_000);
  const result = (r: Run) => r.events.find((e) => e.type === 'tool.result') as Extract<LogEvent, { type: 'tool.result' }> | undefined;

  if (!token) {
    const r = await finish((await start('Price check with no token', 'apify.checkPrice', { product: '19451577' })).id);
    d.check(r.task.state === 'failed' && result(r)?.error === 'the vault has no APIFY_TOKEN', 'with no APIFY_TOKEN in the vault the tool refuses to run');
    console.log('  skip  live Actor runs: no APIFY_TOKEN in /etc/box/vault.env on this test machine');
    return;
  }

  const [price, places] = await Promise.all([
    start('Watch AirPods Pro at Best Buy', 'apify.checkPrice', { product: 'airpods pro', max: 2 }),
    start('Find coffee near campus', 'apify.findPlaces', { query: 'coffee', near: 'Berkeley, CA', max: 2 }),
  ]);
  const [p, m] = await Promise.all([finish(price.id), finish(places.id)]);

  const deal = (result(p)?.output as { products?: { name: string; price: number; inStock: boolean }[] })?.products?.[0];
  d.check(
    p.task.state === 'done' && typeof deal?.price === 'number' && typeof deal.inStock === 'boolean',
    `Cheerio Scraper read Best Buy live: ${deal?.name?.slice(0, 40)}, $${deal?.price} CAD, ${deal?.inStock ? 'in stock' : 'not in stock'}` +
      (p.task.state === 'failed' ? ` (${result(p)?.error})` : ''),
  );
  const spot = (result(m)?.output as { places?: { name: string; address: string }[] })?.places?.[0];
  d.check(
    m.task.state === 'done' && spot?.name && spot.address,
    `Google Maps Scraper found places live: ${spot?.name}, ${spot?.address}` + (m.task.state === 'failed' ? ` (${result(m)?.error})` : ''),
  );
  d.check(p.task.hosts.length === 0 && m.task.hosts.length === 0, 'both tasks had no network of their own; the Actors did the web work');
  d.check(!JSON.stringify([p, m]).includes(token), 'the Apify token is nowhere in their log or results');
  d.check(p.task.costCents === 1 && m.task.costCents === 0.8, `each task's Apify cost was counted: 1 cent and 0.8 cents`);
}
