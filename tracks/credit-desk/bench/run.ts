// Runs the DABstep dev questions (data/dev.jsonl, see README.md) as GurtOS tasks and scores them with DABstep's own scorer.
// Run it on the test VM, as root, next to a bench box (box.sh start, then box.sh run):
//   node --experimental-strip-types run.ts [--ids 5,49] [--limit 2] [--concurrency 2] [--timeout-min 30]
//                                          [--max-start 60] [--stop-at 75] [--fake]
// One workspace per question, holding only context/ (the benchmark's files). One Droid task per question, one attempt,
// no network hosts, no tools. The task writes answer.txt; this script reads it from the workspace's view and scores it.
// Environment: BENCH_API (default http://127.0.0.1:7700), BENCH_DATA and BENCH_OUT (default data/ and results/ beside this file), BOX_HOME (default /var/lib/box), BOX_VAULT (default /etc/box/vault.env).
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { questionScorer } from './scorer.ts';

const here = path.dirname(new URL(import.meta.url).pathname);
const API = process.env.BENCH_API ?? 'http://127.0.0.1:7700';
const HOME = process.env.BOX_HOME ?? '/var/lib/box';
const VAULT = process.env.BOX_VAULT ?? '/etc/box/vault.env';
const DATA = process.env.BENCH_DATA ?? path.join(here, 'data'); // questions with answers, and the context files
const OUT = process.env.BENCH_OUT ?? path.join(here, 'results');

const args = process.argv.slice(2);
const opt = (name: string, dflt: string) => (args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : dflt);
const ids = opt('ids', '');
const limit = Number(opt('limit', '15'));
const concurrency = Number(opt('concurrency', '2'));
const timeoutMs = Number(opt('timeout-min', '30')) * 60_000;
const maxStart = Number(opt('max-start', '60')); // do not begin if the 5-hour Factory limit is at or above this percent
const stopAt = Number(opt('stop-at', '75')); // stop the run, and cancel what is running, when it reaches this percent
const fake = args.includes('--fake'); // plumbing test with the box's scripted worker: no model, no credit, nothing saved
if (limit > 15) throw new Error('the slice is at most 15 questions');

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function api<T = any>(method: string, p: string, body?: unknown): Promise<T> {
  const r = await fetch(`${API}${p}`, { method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  const data = await r.json().catch(() => undefined);
  if (!r.ok) throw new Error(`${method} ${p}: ${data?.error ?? r.status}`);
  return data as T;
}

/** Factory's usage, read with the vault's key the way core/demo.ts factoryUse does. The key is never printed. */
async function factoryUse() {
  const key = fs.readFileSync(VAULT, 'utf8').match(/^FACTORY_API_KEY=(.+)$/m)?.[1]?.trim();
  if (!key) throw new Error(`no FACTORY_API_KEY in ${VAULT}`);
  const r = await fetch('https://api.factory.ai/api/billing/limits', { headers: { authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(8000) });
  const std = (await r.json()).limits?.standard;
  if (!std?.fiveHour || !std?.weekly) throw new Error(`could not read Factory's usage (HTTP ${r.status})`);
  return { fiveHour: std.fiveHour.usedPercent as number, weekly: std.weekly.usedPercent as number, resetMin: Math.round((std.fiveHour.secondsRemaining ?? 0) / 60) };
}

interface Question { task_id: string; question: string; guidelines: string; level: string; answer: string }
const all: Question[] = fs.readFileSync(path.join(DATA, 'dev.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
const wanted = ids ? ids.split(',').map((s) => s.trim()) : [];
const questions = (wanted.length ? wanted.map((id) => all.find((q) => q.task_id === id) ?? (() => { throw new Error(`no question ${id} in the dev split`); })()) : all).slice(0, limit);

const run = `${new Date().toISOString().slice(0, 19).replace(/[-:]/g, '').replace('T', '-')}${fake ? '-fake' : ''}`;
const prompt = (q: Question) => `You are an expert data analyst. You will answer one question about a payments dataset.

Your current folder has a context/ directory with the data and its documentation: manual.md, payments-readme.md, payments.csv, fees.json, merchant_data.json, merchant_category_codes.csv and acquirer_countries.csv. Read the documentation first, and check your assumptions against it before you compute anything.

You have Python 3 (standard library only, so csv and json but no pandas) and Node. You have no network. Do not ask anyone for help; nobody will answer.

Question: ${q.question}

Guidelines for the answer. You MUST follow them exactly: ${q.guidelines}

Work the answer out yourself from the files. When you have it, write only the final answer, in the format the guidelines ask for and with nothing else in the file, to answer.txt in your current folder.`;

interface Result {
  id: string; level: string; question: string; guidelines: string; reference: string; answer: string | null;
  correct: boolean; state: string; error?: string; task?: string; model?: string;
  costCents: number; tokens?: Record<string, number>; seconds: number; toolCalls: number;
}

const started = Date.now();
const before = fake ? undefined : await factoryUse();
if (before) {
  console.log(`factory: ${before.fiveHour}% of the 5-hour limit used (resets in ${before.resetMin} min), ${before.weekly}% of the weekly one`);
  if (before.fiveHour >= maxStart) {
    console.log(`not starting: the 5-hour limit is at ${before.fiveHour}% (the cut-off is ${maxStart}%)`);
    process.exit(2);
  }
}

let stopped = false; // set when usage reaches stopAt; nothing new starts and what runs is cancelled
const results: Result[] = [];
const file = path.join(OUT, `${run}.json`);

function save(finished: boolean, after?: Awaited<ReturnType<typeof factoryUse>>) {
  const done = results.filter((r) => r.state !== 'not started');
  const summary = {
    questions: questions.length, finished: done.length, correct: done.filter((r) => r.correct).length,
    noAnswer: done.filter((r) => r.answer === null).length,
    byLevel: Object.fromEntries(['easy', 'hard'].map((l) => [l, { finished: done.filter((r) => r.level === l).length, correct: done.filter((r) => r.level === l && r.correct).length }])),
    costCents: Math.round(done.reduce((s, r) => s + r.costCents, 0) * 100) / 100,
    wallSeconds: Math.round((Date.now() - started) / 1000), taskSeconds: Math.round(done.reduce((s, r) => s + r.seconds, 0)),
    stoppedForUsage: stopped,
  };
  const model = results.find((r) => r.model)?.model;
  if (fake) return console.log(JSON.stringify(summary));
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify({
    run, finished, startedAt: new Date(started).toISOString(),
    benchmark: { name: 'DABstep', split: 'dev', dataset: 'adyen/DABstep @ 0545553f02cedc323dee8658af62555852bc3b24', scorer: 'question_scorer from the adyen/DABstep Space @ d4431c2e4a695cbe43c33aab2adaa304a37ae64a' },
    worker: 'droid', model, network: 'none (no hosts, no tools)', attemptsPerQuestion: 1, concurrency,
    factory: { before, after }, summary, questions: results,
  }, null, 2) + '\n');
}

async function ask(q: Question): Promise<Result> {
  const t0 = Date.now();
  const res: Result = { id: q.task_id, level: q.level, question: q.question, guidelines: q.guidelines, reference: q.answer, answer: null, correct: false, state: 'not started', costCents: 0, seconds: 0, toolCalls: 0 };
  if (stopped) return res;
  const ws = `bench-${run}-q${q.task_id}`;
  const dir = path.join(HOME, 'workspaces', ws);
  fs.mkdirSync(dir, { recursive: true });
  fs.cpSync(path.join(DATA, 'context'), path.join(dir, 'context'), { recursive: true });
  execFileSync('chmod', ['-R', 'a+rwX', dir]); // the task's user writes its own copy
  const task = await api('POST', '/tasks', {
    title: `Benchmark ${q.task_id}`, source: 'bench', workspace: ws, worker: fake ? 'fake' : 'droid', hosts: [], tools: [],
    prompt: fake ? 'write answer.txt NL' : prompt(q),
  });
  res.task = task.id;
  console.log(`start  ${q.task_id} (${q.level}) as task ${task.id}`);
  let state = task.state as string;
  while (!['done', 'failed', 'undone'].includes(state)) {
    await sleep(3000);
    if (stopped || Date.now() - t0 > timeoutMs) {
      await api('POST', `/tasks/${task.id}/undo`).catch(() => {});
      res.error = stopped ? 'cancelled: Factory usage reached the stop line' : `timed out after ${Math.round(timeoutMs / 60000)} minutes`;
      res.state = stopped ? 'cancelled' : 'timeout';
      break;
    }
    for (const a of await api<{ id: string; task: string }[]>('GET', '/approvals?state=pending')) {
      if (a.task === task.id) await api('POST', `/approvals/${a.id}`, { approved: false, by: 'bench (nobody to ask)' });
    }
    state = (await api('GET', `/tasks/${task.id}`)).task.state;
  }
  const { task: t, events } = await api('GET', `/tasks/${task.id}`);
  if (!['cancelled', 'timeout'].includes(res.state)) res.state = t.state;
  res.error ??= t.error;
  res.costCents = t.costCents;
  res.seconds = Math.round((Date.now() - t0) / 1000);
  res.toolCalls = events.filter((e: { type: string; data?: { tool?: string } }) => e.type === 'task.step' && e.data?.tool).length;
  res.model = events.find((e: { type: string; data?: { session?: string }; text?: string }) => e.type === 'task.step' && e.data?.session)?.text?.match(/\((.+)\)/)?.[1];
  const tokens: Record<string, number> = {};
  for (const e of events) if (e.type === 'cost' && e.tokens) for (const [k, v] of Object.entries(e.tokens as Record<string, number>)) tokens[k] = (tokens[k] ?? 0) + v;
  if (Object.keys(tokens).length) res.tokens = tokens;
  // The view is rebuilt when the task finishes; give it a moment.
  const out = path.join(HOME, 'views', ws, 'answer.txt');
  for (let i = 0; i < 20 && res.state === 'done' && !fs.existsSync(out); i++) await sleep(500);
  if (fs.existsSync(out)) res.answer = fs.readFileSync(out, 'utf8').trim();
  // A missing answer is scored as wrong. The leaderboard's evaluate() calls question_scorer(agent_answer, correct_answer).
  res.correct = res.answer !== null && questionScorer(res.answer, q.answer);
  console.log(`${res.correct ? 'PASS ' : 'FAIL '} ${q.task_id} (${q.level}) ${res.state}, ${res.seconds}s, $${(res.costCents / 100).toFixed(2)}: answered ${JSON.stringify(res.answer)}, reference ${JSON.stringify(q.answer)}`);
  return res;
}

// A watcher reads Factory's usage once a minute; at the stop line it halts the run.
let last: Awaited<ReturnType<typeof factoryUse>> | undefined = before;
const watch = fake ? undefined : setInterval(async () => {
  last = await factoryUse().catch(() => last);
  if (last && last.fiveHour >= stopAt && !stopped) {
    stopped = true;
    console.log(`factory: ${last.fiveHour}% of the 5-hour limit used, at the ${stopAt}% stop line. Stopping.`);
  }
}, 60_000);

const queue = [...questions];
await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
  for (let q; (q = queue.shift()); ) {
    results.push(await ask(q));
    save(false, last);
  }
}));
clearInterval(watch);
const after = fake ? undefined : await factoryUse().catch(() => last);
save(true, after);
if (!fake) {
  const s = JSON.parse(fs.readFileSync(file, 'utf8')).summary;
  console.log(`\n${s.correct} of ${s.finished} correct (${s.questions} in the slice), $${(s.costCents / 100).toFixed(2)}, ${s.wallSeconds}s wall clock. Saved ${file}`);
  if (after) console.log(`factory: ${after.fiveHour}% of the 5-hour limit used now (was ${before?.fiveHour}%)`);
}
