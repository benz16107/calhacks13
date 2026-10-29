// The Factory app: Droid as a team that plans first, works inside GurtOS's limits, and hands its work back for review.
// - GitHub: the box watches a repo for issues labelled `droid`. Each becomes a Droid task on its own clone that plans
//   first, codes and reviews, then opens a pull request through the vault's token (factory.openPullRequest).
// - A safe runner for `droid exec`: POST /run starts a headless Droid job on this box (see gurtos-exec.ts).
// - Usage: each task's Factory credits, and the Factory plan's limits read with the vault key (GET /usage).
// The worker side (plan approval, autonomy, hooks, custom droids) is in core/workers/droid.ts; the droids are in droids/.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { DroidOptions, TaskSpec, Track } from '../../core/contract.ts';
import { clone, issues, openPullRequest, repoName } from './github.ts';

const HOME = process.env.BOX_HOME ?? '/var/lib/box';
const EVERY_MS = Number(process.env.FACTORY_GITHUB_EVERY_MS ?? 120_000);
const PAGE = fs.readFileSync(new URL('./app.html', import.meta.url), 'utf8');

/** What every Factory task tells Droid: work as a team of custom droids, with the reviewer before the owner. */
export function teamPrompt(goal: string, finish = '') {
  return [
    goal,
    '',
    'Work as a team of custom droids, through the Task tool. Do not edit files yourself.',
    '1. Task with subagent_type `coder`: give it the goal; it makes the change and runs the tests.',
    '2. Task with subagent_type `reviewer`: give it the full diff of the changed files and ask for its verdict.',
    '3. If the verdict is CHANGES, send the reasons to the coder and ask the reviewer again, at most twice.',
    'End with the reviewer\'s last verdict line, the files changed and the test result.',
    finish,
  ].join('\n');
}

const sourceOf = (repo: string, n: number) => `github:${repo}#${n}`;
const opts = (body: any): DroidOptions => ({ plan: body.plan !== false, autonomy: body.autonomy ?? 'medium' });

/** A GitHub issue as a Droid task: a plan first, medium autonomy, no network, and the PR tool to finish. */
export function issueTask(repo: string, issue: { number: number; title: string; body: string; url: string }, workspace: string): TaskSpec {
  return {
    title: `Fix #${issue.number}: ${issue.title}`.slice(0, 200),
    workspace,
    source: sourceOf(repo, issue.number),
    tools: ['factory.openPullRequest'],
    hosts: [],
    droid: { plan: true, autonomy: 'medium' },
    prompt: teamPrompt(
      `Fix GitHub issue #${issue.number} in ${repo} (${issue.url}). The repository is in the current folder.\n\nTitle: ${issue.title}\n\n${issue.body}`,
      'When the reviewer approves, call the box tool factory.openPullRequest with a short title and a body that names the issue (Fixes #N) and the reviewer verdict. Do not push with git yourself; you have no network and no token.',
    ),
  };
}

type BoxApi = Parameters<NonNullable<Track['routes']>[string]>[1];
// A key the vault doesn't have reads as empty: the app runs without it.
const maybe = (box: BoxApi, name: string) => {
  try {
    return box.secret(name);
  } catch {
    return '';
  }
};

type Check = { at?: string; repo?: string; found?: number; started?: string[]; error?: string };
let lastCheck: Check = {};

async function readIssues(box: BoxApi): Promise<Check> {
  const at = new Date().toISOString();
  const typed = maybe(box, 'FACTORY_GITHUB_REPO').trim();
  if (!typed) return { at, error: 'No GitHub repo connected. Add one in Settings, Accounts & Keys.' };
  let repo: string;
  try {
    repo = repoName(typed);
  } catch (e) {
    return { at, repo: typed, error: (e as Error).message };
  }
  const token = maybe(box, 'GITHUB_TOKEN'); // a public repo can be read without one
  let open: Awaited<ReturnType<typeof issues>>;
  try {
    open = await issues(repo, token);
  } catch (e) {
    return { at, repo, error: `Couldn't read its issues. Check the repository name and the GitHub key. (${(e as Error).message})` };
  }
  const seen = new Set(box.tasks().map((t) => t.source));
  const started: string[] = [];
  const failed: string[] = [];
  // One issue that can't start (a clone that fails, a refused task) must not hold up the ones after it.
  for (const issue of open.filter((i) => !seen.has(sourceOf(repo, i.number)))) {
    const ws = `gh-${repo.replace(/\W+/g, '-')}-${issue.number}`.toLowerCase();
    let dir = '';
    try {
      dir = fs.mkdtempSync(path.join(os.tmpdir(), 'factory-clone-'));
      clone(repo, dir, undefined, token);
      box.workspace(ws, dir);
      started.push((await box.createTask(issueTask(repo, issue, ws))).id);
    } catch (e) {
      failed.push(`#${issue.number}: ${(e as Error).message}`);
    } finally {
      if (dir) fs.rmSync(dir, { recursive: true, force: true });
    }
  }
  return { at, repo, found: open.length, started, ...(failed.length ? { error: `Couldn't start ${failed.join('; ')}` } : {}) };
}

let checking: Promise<Check> | undefined;
/** One check at a time. The timer and "Check now" can overlap, and two checks would each start a task for the same issue. */
export const checkGithub = (box: BoxApi) =>
  (checking ??= readIssues(box)
    .catch((e): Check => ({ at: new Date().toISOString(), error: `The GitHub check failed. (${(e as Error).message})` }))
    .then((c) => (lastCheck = c))
    .finally(() => (checking = undefined)));

// Factory credits per task, from the worker's "Factory usage" steps in the action log. Read from the file each
// time: a log reader resumes from its saved place after a restart, so a total kept in memory would start again at 0.
// shortcut: reads the whole log per request, fine at this weekend's log sizes; keep a running total if it grows.
function creditsByTask() {
  const m = new Map<string, number>();
  const file = path.join(HOME, 'log.jsonl');
  for (const line of fs.existsSync(file) ? fs.readFileSync(file, 'utf8').split('\n') : []) {
    if (!line.includes('factoryCredits')) continue;
    try {
      const e = JSON.parse(line);
      if (e.type === 'task.step' && e.data?.factoryCredits) m.set(e.task, (m.get(e.task) ?? 0) + e.data.factoryCredits);
    } catch {} // a torn last line after a power cut
  }
  return m;
}

let limitsSeen: { key: string; at: number; value: unknown } | undefined;
/** The plan's limits, asked of Factory at most every 30 s: the window asks every 4 s, and Factory rate-limits keys. */
export async function limits(key: string): Promise<unknown> {
  if (!key) return { error: 'Add a Factory API key in Settings, Accounts & Keys to see your plan here.' };
  if (limitsSeen?.key === key && Date.now() - limitsSeen.at < 30_000) return limitsSeen.value;
  const value = await askFactory(key);
  limitsSeen = { key, at: Date.now(), value };
  return value;
}

async function askFactory(key: string) {
  try {
    const r = await fetch('https://api.factory.ai/api/billing/limits', { headers: { authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(8000) });
    if (r.status === 401 || r.status === 403) return { error: "Factory didn't accept this API key. Check it in Settings, Accounts & Keys." };
    const std = ((await r.json().catch(() => ({}))) as any).limits?.standard;
    if (!std?.fiveHour) return { error: `Factory didn't send your plan's limits (error ${r.status}).` };
    const pick = (l: any) => ({ usedPercent: l.usedPercent, resetsInMin: Math.round((l.secondsRemaining ?? 0) / 60) });
    return { fiveHour: pick(std.fiveHour), weekly: pick(std.weekly) };
  } catch {
    return { error: "Couldn't reach Factory. Check this computer's internet connection." };
  }
}

export default {
  name: 'factory',
  title: 'Factory',
  description: 'Turns GitHub issues labelled droid into pull requests: Droid plans, you approve the plan, a reviewer droid checks the change. Needs a GitHub token and a repository name; a Factory key shows your plan usage.',
  secrets: ['GITHUB_TOKEN', 'FACTORY_GITHUB_REPO', 'FACTORY_API_KEY'],
  optionalSecrets: ['GITHUB_TOKEN', 'FACTORY_GITHUB_REPO', 'FACTORY_API_KEY'],

  triggers: [
    {
      name: 'github',
      start(box) {
        const timer = setInterval(() => void checkGithub(box), EVERY_MS);
        void checkGithub(box);
        return () => clearInterval(timer);
      },
    },
  ],

  tools: [
    {
      name: 'factory.openPullRequest',
      description: 'Open a pull request with every change in your copy of the repository. Input: { title, body }. The box pushes with its own token; you never see it.',
      input: { type: 'object', properties: { title: { type: 'string' }, body: { type: 'string' } }, required: ['title', 'body'] },
      secrets: ['GITHUB_TOKEN'],
      async run(input: { title: string; body: string }, ctx) {
        if (typeof input?.title !== 'string' || !input.title.trim() || typeof input.body !== 'string') throw new Error('title and body: text for the pull request');
        const repo = /^github:([^#]+)#(\d+)$/.exec(ctx.task?.source ?? '');
        if (!ctx.task || !repo) throw new Error('only a task started from a GitHub issue can open a pull request');
        const pr = await openPullRequest({
          repo: repo[1],
          token: ctx.secret('GITHUB_TOKEN'),
          root: path.join(HOME, 'tasks', ctx.task.id, 'root'),
          branch: `droid/issue-${repo[2]}-${ctx.task.id}`,
          title: String(input.title).slice(0, 200),
          body: `${input.body}\n\n---\nOpened by Droid on a GurtOS box (task ${ctx.task.id}). The plan was approved by the owner; the reviewer droid checked the diff.`,
        });
        ctx.log(`Pull request #${pr.number} opened: ${pr.url}`, { pr });
        return pr;
      },
    },
  ],

  routes: {
    'GET /': () => new Response(PAGE, { headers: { 'content-type': 'text/html; charset=utf-8' } }),

    // The safe runner for `droid exec`: a headless job on its own copy of a repo (or of the files sent), on this box.
    'POST /run': async (req, box) => {
      const b = await req.json().catch(() => null);
      if (typeof b?.prompt !== 'string' || !b.prompt.trim()) return Response.json({ error: 'prompt: what Droid should do' }, { status: 400 });
      if (b.hosts !== undefined && !Array.isArray(b.hosts)) return Response.json({ error: 'hosts: a list of host names' }, { status: 400 });
      const ws = `exec-${Date.now().toString(36)}`;
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'factory-exec-'));
      try {
        if (b.repo) {
          if (typeof b.repo !== 'string' || !/^https:\/\/[\w.-]+\/[\w./-]+$/.test(b.repo)) return Response.json({ error: 'Use an https:// link to a Git repository.' }, { status: 400 });
          clone('', dir, b.repo);
        } else if (b.files && typeof b.files === 'object') {
          for (const [f, text] of Object.entries(b.files as Record<string, string>)) {
            const to = path.resolve(dir, f);
            if (!to.startsWith(dir + path.sep)) return Response.json({ error: `files: ${f} is outside the folder` }, { status: 400 });
            fs.mkdirSync(path.dirname(to), { recursive: true });
            fs.writeFileSync(to, String(text));
          }
        }
        box.workspace(ws, dir);
      } catch (e) {
        return Response.json({ error: `Couldn't copy that repository. Check the link. (${(e as Error).message.split('\n')[0]})` }, { status: 400 });
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
      try {
        const task = await box.createTask({
          title: String(b.title ?? b.prompt).slice(0, 200),
          prompt: b.team ? teamPrompt(b.prompt) : b.prompt,
          workspace: ws,
          source: 'droid-exec',
          hosts: b.hosts ?? [],
          ...(b.budgetCents !== undefined ? { budgetCents: b.budgetCents } : {}),
          ...(b.worker === 'fake' ? { worker: 'fake' as const } : { droid: opts(b) }),
        });
        return Response.json({ task });
      } catch (e) {
        return Response.json({ error: (e as Error).message }, { status: 400 });
      }
    },

    'GET /github': () => Response.json({ everyMs: EVERY_MS, label: 'droid', ...lastCheck }),
    'POST /github/check': async (_req, box) => Response.json(await checkGithub(box)),

    // Factory usage: each task's credits next to the plan's limits. The key stays here; only percentages go out.
    'GET /usage': async (_req, box) => {
      const credits = creditsByTask();
      const tasks = box
        .tasks()
        .filter((t) => t.worker === 'droid')
        .map((t) => ({ id: t.id, title: t.title, state: t.state, source: t.source, droid: t.droid, credits: credits.get(t.id) ?? 0, costCents: t.costCents, budgetCents: t.budgetCents }));
      return Response.json({ limits: await limits(maybe(box, 'FACTORY_API_KEY')), tasks });
    },
  },

  apps: [{ name: 'factory', title: 'Factory', href: '/' }],
} satisfies Track;
