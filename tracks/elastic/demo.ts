// The Elastic track's demo step. Offline by default: the log reader writes each document to an outbox file in
// the run's BOX_HOME instead of Elastic, and the checks read that.
// DEMO_LIVE=elastic ./demo also ships the run to Elastic Serverless, installs the Agent Builder agent from
// agent.ts, and asks it the four questions. That takes about a minute and uses the Elastic trial.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import type { DemoKit, LogEvent, Task } from '../../core/contract.ts';
import { ask, install, TOOLS } from './agent.ts';
import { client, INDEX } from './track.ts';

export const QUESTIONS = [
  { q: 'What did my agents change this week?', tool: 'box.changes', says: /b\.txt|a\.txt|undone/i },
  { q: 'What did it cost this week, by task and by app?', tool: 'box.costs_by', says: /\$\d/ },
  { q: 'Why did the job routine fail?', tool: 'box.task_timeline', says: /linkedin/i },
  { q: 'What got blocked this week, and from where?', tool: 'box.blocked', says: /attacker\.example|linkedin/i },
];

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
  const docs = await d.waitFor('the reader to catch up', async () => {
    const all = fs.existsSync(outbox) ? fs.readFileSync(outbox, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];
    return new Set(all.map((x) => x.event.seq)).size >= log.length ? all : undefined;
  });
  const seqs = new Set(docs.map((x) => x.event.seq));
  d.check(log.every((e) => seqs.has(e.seq)), `all ${log.length} log events became documents, none lost to the hard kill in moment 4`);

  const mine = docs.filter((x) => x.task?.id === job.id);
  const blocked = mine.find((x) => x.event.type === 'net.blocked');
  d.check(
    blocked?.net.host === 'www.linkedin.com:443' && blocked.app === 'schedule' && blocked.task.hosts.includes('boards.greenhouse.io'),
    `the blocked connection is a document with its task, app and allowed hosts: "${blocked?.message}"`,
  );
  const paid = mine.find((x) => x.event.type === 'tool.result');
  d.check(paid?.cost_cents === 35 && paid.tool.name === 'example.spend', 'the tool spending is in cost_cents with the tool name ($0.35, test money)');
  const b = docs.find((x) => x.task?.title === 'B adds b.txt' && x.task.state === 'done');
  d.check(b?.files.added.includes('b.txt'), `a done task's document lists the files it changed: "${b?.message}"`);
  const vault = fs.readFileSync(path.join(d.home, 'vault.env'), 'utf8');
  const secrets = vault.split('\n').map((l) => l.split('=').slice(1).join('=').trim()).filter((v) => v.length > 8);
  d.check(!secrets.some((s) => fs.readFileSync(outbox, 'utf8').includes(s)), 'no vault secret is in any document');

  const live = (process.env.DEMO_LIVE ?? '').split(/[\s,]+/).includes('elastic');
  if (!live) {
    console.log('  skip  shipping to Elastic Serverless and asking the agent: DEMO_LIVE=elastic ./demo runs them');
    return;
  }
  const key = (k: string) => vault.match(new RegExp(`^${k}=(.+)$`, 'm'))?.[1].trim();
  const [url, kibana, apiKey] = [key('ELASTIC_URL'), key('KIBANA_URL'), key('ELASTIC_API_KEY')];
  d.check(url && kibana && apiKey, 'DEMO_LIVE=elastic: ELASTIC_URL, KIBANA_URL and ELASTIC_API_KEY are in /etc/box/vault.env');
  const es = client(url!, apiKey!);
  const kb = client(kibana!, apiKey!);
  await install(kb, es);
  d.check(true, `the Agent Builder agent and its ${TOOLS.length} tools are installed from agent.ts`);

  const run = docs[0].box.run;
  const query = { bool: { filter: [{ term: { 'box.run': run } }, { range: { 'event.seq': { lte: log.length } } }] } };
  const count = await d.waitFor('Elastic to have every event of this run', async () => {
    const { count } = await es<{ count: number }>('POST', `/${INDEX}/_count`, { query });
    return count >= log.length ? count : undefined;
  }, 120_000);
  d.check(count === log.length, `Elastic Serverless has all ${log.length} events of run ${run}, each once`);

  const answers = await Promise.all(QUESTIONS.map((x) => ask(kb, x.q)));
  QUESTIONS.forEach((x, i) => {
    const { answer, tools } = answers[i];
    console.log(`\n  Q: ${x.q}\n  (tools: ${tools.join(', ')})\n${answer.replace(/^/gm, '  | ')}\n`);
    d.check(tools.some((t) => t.startsWith(x.tool)) && x.says.test(answer), `the agent answered "${x.q}" with ${x.tool}*`);
  });
}
