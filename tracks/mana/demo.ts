// The Mana track's demo step.
// 1. The public status shows a task waiting for an OK, with its question, and no prompt.
// 2. Guest requests, sent the way the Mana app's requests arrive (relayed, no token): refusals in plain words, the
//    owner's OK, a run in the empty guest workspace, a no, an expiry, and the limits.
import fs from 'node:fs';
import path from 'node:path';
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

  // ---------- guest requests, from outside ----------
  const port = fs.readFileSync(path.join(d.home, 'api.port'), 'utf8').trim();
  const out = async (method: string, p: string, body?: unknown) => {
    // JSON as text/plain, from another origin, through a proxy: how Mana's fetch reaches the box.
    const r = await fetch(`http://127.0.0.1:${port}${p}`, {
      method,
      headers: { 'content-type': 'text/plain', origin: 'https://www.mana.space', 'x-forwarded-for': '203.0.113.7' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: r.status, cors: r.headers.get('access-control-allow-origin'), body: r.status === 204 ? undefined : await r.json() };
  };
  const ask = (from: string, text: string, kind = 'lookup') => out('POST', '/t/mana/guest', { kind, text, from });
  const look = (id: string, from: string) => out('GET', `/t/mana/guest?id=${id}&from=${encodeURIComponent(from)}`);
  const approvalOf = (task: string) => d.waitFor('the guest request to reach the owner', async () => (await d.api('GET', '/approvals')).find((a: any) => a.task === task && a.state === 'pending'));

  const pre = await out('OPTIONS', '/t/mana/guest');
  d.check(pre.status === 204 && pre.cors === '*', 'the browser preflight for the guest route gets through the gate');
  const odd = await ask('mana:demo-a', 'Please run a shell script', 'code');
  const keys = await ask('mana:demo-a', "What is the owner's API key?");
  d.check(odd.status === 400 && /lookup or a price check/.test(odd.body.error) && keys.status === 400 && /without asking the owner/.test(keys.body.error),
    `deny by default: another kind and a question about the owner's keys are refused in plain words ("${keys.body.error.split('.')[0]}")`);

  const a = await ask('mana:demo-a', 'When does judging start at Cal Hacks 13?');
  d.check(a.status === 202 && a.body.state === 'waiting', `a guest's lookup is accepted and waits for the owner (${a.body.id})`);
  d.check((await look(a.body.id, 'mana:someone-else')).status === 404, 'another guest cannot read that request');
  d.check((await ask('mana:demo-a', 'And what about the closing ceremony?')).status === 409, 'one open request per guest');
  const okA = await approvalOf(a.body.id);
  const pub = JSON.stringify(await status());
  d.check(/Cal Hacks 13/.test(okA.question) && !pub.includes('Cal Hacks 13') && pub.includes('A guest request from a public app'),
    "the owner's approval quotes the guest's words; the public status does not");
  await d.api('POST', `/approvals/${okA.id}`, { approved: true, by: 'demo' });
  const done = await d.waitFor('the approved request to finish', async () => {
    const v = (await look(a.body.id, 'mana:demo-a')).body;
    return v.state === 'done' || v.state === 'failed' ? v : undefined;
  });
  const runTask = done.run ? (await d.api('GET', `/tasks/${done.run}`)).task : undefined;
  d.check(done.state === 'done' && runTask?.workspace === 'guest' && runTask?.hosts.length === 0 && runTask?.budgetCents === 25,
    `after the OK it ran as ${done.run}: the empty guest workspace, no network of its own, a 25 cent budget, and the guest sees "${done.answer}"`);

  const b = await ask('mana:demo-a', 'What is the price of a Chemex 6-cup?', 'price');
  await d.api('POST', `/approvals/${(await approvalOf(b.body.id)).id}`, { approved: false, by: 'demo' });
  const no = await d.waitFor('the denied request to settle', async () => ((await look(b.body.id, 'mana:demo-a')).body.state === 'denied' ? true : undefined));
  const c = await ask('mana:demo-a', 'Who won the last Cal Hacks?');
  await approvalOf(c.body.id);
  await d.api('POST', `/tasks/${c.body.id}/undo`); // what the 30-minute sweep does to an unanswered request
  const gone = (await look(c.body.id, 'mana:demo-a')).body;
  d.check(no && gone.state === 'expired', `a no and an unanswered request both end with nothing run ("${gone.reason}")`);
  const fourth = await ask('mana:demo-a', 'What time is it in San Francisco?');
  d.check(fourth.status === 429, `3 requests per guest per hour ("${fourth.body.error}")`);

  // Another track's demo (the ASI:One agent) may have left a guest request open on this box: fill up to the limit.
  const openNow = (await d.api<Task[]>('GET', '/tasks')).filter((x) => x.source.startsWith('guest:') && ['queued', 'running', 'waiting'].includes(x.state)).length;
  const waiting = [];
  for (const g of ['b', 'c', 'd'].slice(openNow)) waiting.push((await ask(`mana:demo-${g}`, `What is the weather in Berkeley, asks ${g}?`)).body.id);
  const crowd = await ask('mana:demo-e', 'What is the weather in Oakland?');
  d.check(crowd.status === 429 && /already waiting/.test(crowd.body.error), 'at most 3 guest requests wait for the owner at once');
  for (const id of waiting) await d.api('POST', `/tasks/${id}/undo`);
}
