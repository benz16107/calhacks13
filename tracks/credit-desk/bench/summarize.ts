// Joins results/*.json (the real runs, not --fake) into results/summary.json and prints the table for the README.
// A question must appear in only one run: one attempt each. Run: node tracks/credit-desk/bench/summarize.ts
import fs from 'node:fs';
import path from 'node:path';

const dir = path.join(path.dirname(new URL(import.meta.url).pathname), 'results');
const runs = fs.readdirSync(dir).filter((f) => /^\d{8}-\d{4,6}\.json$/.test(f)).sort().map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));
const qs = runs.flatMap((r) => r.questions.filter((q: { state: string }) => q.state !== 'not started').map((q: object) => ({ run: r.run, ...q }))) as any[];
const dup = qs.map((q) => q.id).filter((id, i, a) => a.indexOf(id) !== i);
if (dup.length) throw new Error(`question ${dup.join(', ')} was attempted more than once; this benchmark allows one attempt`);

const sum = (f: (q: any) => number) => qs.reduce((s, q) => s + f(q), 0);
const summary = {
  runs: runs.map((r) => r.run), model: [...new Set(runs.map((r) => r.model))].join(', '),
  questions: qs.length, correct: qs.filter((q) => q.correct).length, noAnswer: qs.filter((q) => q.answer === null).length,
  byLevel: Object.fromEntries(['easy', 'hard'].map((l) => [l, { n: qs.filter((q) => q.level === l).length, correct: qs.filter((q) => q.level === l && q.correct).length }])),
  costUsd: Math.round(sum((q) => q.costCents)) / 100, taskMinutes: Math.round(sum((q) => q.seconds) / 6) / 10,
  wallMinutes: Math.round(runs.reduce((s, r) => s + r.summary.wallSeconds, 0) / 6) / 10,
  tokens: qs.reduce((t: Record<string, number>, q) => (Object.entries(q.tokens ?? {}).forEach(([k, v]) => (t[k] = (t[k] ?? 0) + (v as number))), t), {}),
};
fs.writeFileSync(path.join(dir, 'summary.json'), JSON.stringify(summary, null, 2) + '\n');
console.log(`| Question | Level | Reference | Agent answer | Result | Time | Cost |\n|---|---|---|---|---|---|---|`);
const cell = (s: string | null) => (s === null ? '(none)' : `\`${s.replace(/\|/g, '\\|').slice(0, 60)}${s.length > 60 ? '...' : ''}\``);
for (const q of qs.sort((a, b) => Number(a.id) - Number(b.id))) {
  console.log(`| ${q.id} | ${q.level} | ${cell(q.reference)} | ${cell(q.answer)} | ${q.correct ? 'pass' : 'FAIL'} | ${q.seconds} s | $${(q.costCents / 100).toFixed(2)} |`);
}
console.log(`\n${summary.correct} of ${summary.questions} correct (easy ${summary.byLevel.easy.correct}/${summary.byLevel.easy.n}, hard ${summary.byLevel.hard.correct}/${summary.byLevel.hard.n}), $${summary.costUsd}, ${summary.taskMinutes} task minutes, ${summary.wallMinutes} wall minutes, model ${summary.model}`);
