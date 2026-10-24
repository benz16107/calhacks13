#!/usr/bin/env -S node --experimental-strip-types --disable-warning=ExperimentalWarning
// gurtos-exec: run a headless Droid job (like `droid exec`) on a GurtOS box instead of your own machine.
// The job runs as its own Linux user on its own copy of the repo, with no key and only the network you allow.
// You get its steps live, then its diff and cost. Nothing you own is changed.
//
//   gurtos-exec [--box URL] [--token T] [--repo URL] [--auto low|medium|high] [--plan] [--team]
//               [--host H]... [-o text|json] "what Droid should do"
//
// GURTOS_BOX and GURTOS_TOKEN (a paired device's token) can stand in for --box and --token.
// Exit code: 0 done, 1 failed or undone, 2 bad arguments.
import { parseArgs } from 'node:util';

const { values: a, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    box: { type: 'string', default: process.env.GURTOS_BOX ?? 'http://127.0.0.1:7700' },
    token: { type: 'string', default: process.env.GURTOS_TOKEN },
    repo: { type: 'string' },
    auto: { type: 'string', default: 'medium' },
    plan: { type: 'boolean', default: false },
    team: { type: 'boolean', default: false },
    host: { type: 'string', multiple: true, default: [] },
    output: { type: 'string', short: 'o', default: 'text' },
    worker: { type: 'string' }, // 'fake' for tests: a scripted worker, no model
  },
});
const prompt = positionals.join(' ').trim();
if (!prompt || !['low', 'medium', 'high'].includes(a.auto!) || !['text', 'json'].includes(a.output!)) {
  console.error('usage: gurtos-exec [--box URL] [--token T] [--repo URL] [--auto low|medium|high] [--plan] [--team] [--host H] [-o text|json] "prompt"');
  process.exit(2);
}
const json = a.output === 'json';
const say = (s: string) => json || console.log(s);

async function api(method: string, path: string, body?: unknown) {
  const r = await fetch(new URL(path, a.box), {
    method,
    headers: { ...(a.token ? { authorization: `Bearer ${a.token}` } : {}), ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${method} ${path}: ${r.status} ${j.error ?? ''}`);
  return j;
}

const { task } = await api('POST', '/t/factory/run', { prompt, repo: a.repo, autonomy: a.auto, plan: a.plan, team: a.team, hosts: a.host, worker: a.worker });
say(`task ${task.id} on ${a.box} (${a.auto} autonomy${a.plan ? ', plan first' : ''})`);

let seen = 0;
const asked = new Set<string>();
let t = task;
for (;;) {
  const d = await api('GET', `/api/tasks/${task.id}`);
  t = d.task;
  const steps = d.events.filter((e: { type: string }) => e.type === 'task.step');
  for (const s of steps.slice(seen)) say(`  ${s.text.split('\n')[0].slice(0, 160)}`);
  seen = steps.length;
  for (const ap of d.approvals.filter((x: { state: string; id: string }) => x.state === 'pending' && !asked.has(x.id))) {
    asked.add(ap.id);
    say(`  waiting for the owner's OK on the portal or phone: ${ap.question.split('\n')[0]}`);
  }
  if (['done', 'failed', 'undone'].includes(t.state)) break;
  await new Promise((r) => setTimeout(r, 1500));
}

const { diff, changes } = await api('GET', `/api/tasks/${task.id}/diff`);
const usage = await api('GET', '/t/factory/usage').catch(() => ({ tasks: [] }));
const credits = usage.tasks.find((x: { id: string }) => x.id === task.id)?.credits ?? 0;
if (json) {
  console.log(JSON.stringify({ id: t.id, state: t.state, error: t.error, summary: t.summary, costCents: t.costCents, factoryCredits: credits, changes, diff }));
} else {
  say(diff || '(no changes)');
  say(`${t.state}: ${changes.length} files changed, $${(t.costCents / 100).toFixed(2)}, ${credits.toLocaleString('en-US')} Factory credits${t.error ? `\n${t.error}` : ''}`);
}
process.exit(t.state === 'done' ? 0 : 1);
