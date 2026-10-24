// The Factory app's demo step. Offline by default: the box enforces autonomy levels, gurtos-exec runs a job and
// gets back its diff, the team of custom droids is valid, and usage never shows the key. With --live-droid (DEMO_LIVE
// has droid) a real Droid plans first, the demo approves the plan, and the coder and reviewer droids fix a bug.
// DEMO_LIVE=droid,github also opens a pull request on FACTORY_GITHUB_REPO with the vault's GITHUB_TOKEN.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import type { DemoKit, Task } from '../../core/contract.ts';

const LIVE = /\bdroid\b/.test(process.env.DEMO_LIVE ?? '');
const GITHUB = LIVE && /\bgithub\b/.test(process.env.DEMO_LIVE ?? '');
const here = new URL('.', import.meta.url).pathname;

export default async function (d: DemoKit) {
  const { tools } = await d.api<{ tools: string[] }>('GET', '/health');
  d.check(tools.includes('factory.openPullRequest'), 'the box loaded the Factory app and its pull request tool');

  // 3. Autonomy levels, enforced by the OS as well as by Droid.
  d.workspace('factory-demo', { 'README.md': 'demo\n' });
  const spec = { workspace: 'factory-demo', worker: 'fake', prompt: 'write a.txt yes', hosts: ['example.com'], budgetCents: 500 };
  const low = await d.api<Task>('POST', '/tasks', { ...spec, title: 'low autonomy', droid: { autonomy: 'low' } });
  d.check(low.hosts.length === 0 && low.budgetCents === 0, 'low autonomy: the box takes away the network and makes every spend ask');
  const med = await d.api<Task>('POST', '/tasks', { ...spec, title: 'medium autonomy', droid: { autonomy: 'medium', plan: true } });
  d.check(med.hosts[0] === 'example.com' && med.budgetCents === 100, 'medium autonomy: its own hosts, a budget of at most $1');
  const bad = await d.api('POST', '/tasks', { ...spec, title: 'bad', droid: { autonomy: 'max' } }).then(() => 'accepted', (e: Error) => e.message);
  d.check(/droid:/.test(bad), 'a bad autonomy level is refused');
  await d.settled([low.id, med.id]);

  // 6. gurtos-exec: a headless job on the box, its steps, diff and cost back (the scripted worker plays Droid here).
  const out = execFileSync(process.execPath, ['--experimental-strip-types', '--disable-warning=ExperimentalWarning', path.join(here, 'gurtos-exec.ts'), '--box', d.url, '--worker', 'fake', '-o', 'json', 'write fixed.txt fixed by the job'], { encoding: 'utf8', timeout: 60_000 });
  const job = JSON.parse(out.trim().split('\n').pop()!);
  d.check(job.state === 'done' && job.changes.some((c: { path: string }) => c.path === 'fixed.txt') && /fixed by the job/.test(job.diff), 'gurtos-exec ran a job on the box and got back its diff and cost');
  const jobTask = await d.api<Task>('GET', `/tasks/${job.id}`).then((r: any) => r.task);
  d.check(jobTask.user === `box-${job.id}` && jobTask.hosts.length === 0 && jobTask.source === 'droid-exec', 'the job ran as its own Linux user with no network');

  // 2. The team: four custom droids, each with its own tools.
  const droids = fs.readdirSync(path.join(here, 'droids')).map((f) => [f, fs.readFileSync(path.join(here, 'droids', f), 'utf8')] as const);
  const front = (s: string) => Object.fromEntries([...s.matchAll(/^(\w+): (.*)$/gm)].map((m) => [m[1], m[2]]));
  d.check(droids.length === 4 && droids.every(([f, s]) => front(s).name === f.replace('.md', '')), 'the coder, reviewer, credit analyst and shopper droids are valid');
  d.check(front(droids.find(([f]) => f === 'reviewer.md')![1]).tools === 'read-only', 'the reviewer can only read');

  // 7. Usage: percentages only, never the key.
  const usage = await d.api('GET', '/t/factory/usage');
  const vault = fs.readFileSync(path.join(d.home, 'vault.env'), 'utf8');
  const key = vault.match(/^FACTORY_API_KEY=(.+)$/m)?.[1]?.trim();
  d.check((usage.limits.fiveHour || usage.limits.error) && !(key && JSON.stringify(usage).includes(key)), `usage reads Factory's limits without showing the key (${usage.limits.error ?? `${usage.limits.fiveHour.usedPercent}% of 5 hours used`})`);
  const gh = await d.api('GET', '/t/factory/github');
  d.check(gh.label === 'droid' && (gh.repo || gh.error), `the GitHub watcher reports its state (${gh.error ?? gh.repo})`);

  if (!LIVE) return console.log('  skip  real Droid planning and the team: ./demo --live-droid runs them');

  // 1, 2, 4 with a real Droid: a plan to approve, the coder and reviewer, hooks logging every result.
  const live = await d.api<{ task: Task }>('POST', '/t/factory/run', {
    title: 'Fix add() (Factory demo)',
    team: true,
    autonomy: 'medium',
    files: { 'add.js': 'export const add = (a, b) => a - b;\n', 'add.test.js': "import { add } from './add.js';\nimport assert from 'node:assert';\nassert.equal(add(2, 3), 5);\nconsole.log('ok');\n" },
    prompt: 'add.test.js fails. Fix add.js so `node add.test.js` prints ok. Do not change the test.',
  });
  const id = live.task.id;
  const plan = await d.waitFor('Droid to send its plan', async () => (await d.api('GET', '/approvals?state=pending')).find((a: any) => a.task === id && /plan/i.test(a.question)), 240_000);
  d.check(plan.question.length > 60, `Droid planned first in spec mode, and the plan became an approval: "${plan.question.split('\n')[0]}"`);
  await d.api('POST', `/approvals/${plan.id}`, { approved: true, by: 'demo' });
  const done = await d.waitFor('Droid to finish', async () => {
    const t = (await d.api('GET', `/tasks/${id}`)).task as Task;
    if (t.state === 'failed') throw new Error(`the live task failed: ${t.error}`);
    return t.state === 'done' ? t : undefined;
  }, 600_000);
  const { events } = await d.api('GET', `/tasks/${id}`);
  const steps = events.filter((e: any) => e.type === 'task.step');
  const team = ['coder', 'reviewer'].every((n) => steps.some((s: any) => s.data?.droid === n));
  if (!team) for (const s of steps) console.log(`        step ${JSON.stringify(s.data ?? {}).slice(0, 80)} ${s.text.split('\n')[0].slice(0, 120)}`);
  d.check(d.view(live.task.workspace, 'add.js')?.includes('a + b'), 'after the approval Droid fixed add.js');
  d.check(steps.filter((s: any) => s.data?.hook === 'PostToolUse').length >= 2, "Droid's hooks logged each tool call's result");
  d.check(team, 'the coder droid made the change and the reviewer droid checked it');
  d.check(steps.some((s: any) => s.data?.factoryCredits), `Factory usage logged: $${(done.costCents / 100).toFixed(2)} at list price`);

  // The token lives in its own root-only file on the test machine, not the shared vault, so only this run gets it.
  const ghFile = '/root/factory-github.env';
  if (!GITHUB || !fs.existsSync(ghFile)) return console.log(`  skip  the pull request: DEMO_LIVE=droid,github runs it with GITHUB_TOKEN and FACTORY_GITHUB_REPO in ${ghFile}`);
  for (const [, k, v] of fs.readFileSync(ghFile, 'utf8').matchAll(/^(GITHUB_TOKEN|FACTORY_GITHUB_REPO)=(.+)$/gm)) await d.api('PUT', `/vault/${k}`, { value: v.trim() });
  const check = await d.api('POST', '/t/factory/github/check');
  const gid = (await d.api<Task[]>('GET', '/tasks')).find((t) => t.source.startsWith('github:'))?.id; // the boot check may have started it already
  d.check(gid, `the box found a droid-labelled issue on ${check.repo} and started a task for it`);
  const gplan = await d.waitFor('the issue task to send its plan', async () => (await d.api('GET', '/approvals?state=pending')).find((a: any) => a.task === gid), 240_000);
  await d.api('POST', `/approvals/${gplan.id}`, { approved: true, by: 'demo' });
  await d.waitFor('the issue task to finish', async () => ['done', 'failed'].includes((await d.api('GET', `/tasks/${gid}`)).task.state) || undefined, 600_000);
  const gev = (await d.api('GET', `/tasks/${gid}`)).events;
  const pr = gev.find((e: any) => e.type === 'task.step' && e.data?.pr)?.data.pr;
  d.check(pr?.url, `Droid opened a pull request through the vault's token: ${pr?.url}`);
}
