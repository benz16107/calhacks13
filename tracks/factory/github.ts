// GitHub for the Factory app: find issues to fix, and open a pull request with a task's changes.
// Everything here runs in the core, never in a task. The token comes from the vault and is sent only to GitHub.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const API = process.env.FACTORY_GITHUB_API ?? 'https://api.github.com';
export const LABEL = 'droid';

export interface Issue {
  number: number;
  title: string;
  body: string;
  url: string;
}

async function gh(token: string, method: string, url: string, body?: unknown) {
  const r = await fetch(url.startsWith('http') ? url : `${API}${url}`, {
    method,
    headers: { accept: 'application/vnd.github+json', 'user-agent': 'gurtos-factory', ...(token ? { authorization: `Bearer ${token}` } : {}), ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20_000),
  });
  const data: any = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(`GitHub ${method} ${url}: ${r.status} ${data.message ?? ''}`.trim()), { status: r.status, data });
  return data;
}

/** Open issues with the `droid` label, oldest first. Pull requests are left out. */
export async function issues(repo: string, token: string): Promise<Issue[]> {
  const list = await gh(token, 'GET', `/repos/${repo}/issues?state=open&labels=${LABEL}&sort=created&direction=asc&per_page=20`);
  return list.filter((i: any) => !i.pull_request).map((i: any) => ({ number: i.number, title: i.title, body: i.body ?? '', url: i.html_url }));
}

/** A shallow clone of the repo, made by the core. The task gets a copy-on-write copy of it as its workspace. */
export function clone(repo: string, dir: string, url = `https://github.com/${repo}.git`) {
  fs.rmSync(dir, { recursive: true, force: true });
  execFileSync('git', ['clone', '--quiet', '--depth', '1', url, dir], { stdio: 'pipe', timeout: 120_000 });
}

/**
 * Commit what the task changed in its copy (`root`) to a new branch and open a pull request. The copy is copied
 * again first, so the task's own files are never written by root. Calling it twice returns the same pull request.
 */
export async function openPullRequest(o: { repo: string; token: string; root: string; branch: string; title: string; body: string; remote?: string }) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'factory-pr-'));
  try {
    fs.cpSync(o.root, tmp, { recursive: true });
    const git = (...args: string[]) => execFileSync('git', ['-c', 'safe.directory=*', '-c', 'user.name=GurtOS Droid', '-c', 'user.email=droid@gurtos.invalid', ...args], { cwd: tmp, stdio: 'pipe', timeout: 120_000 }).toString();
    const base = git('rev-parse', '--abbrev-ref', 'HEAD').trim();
    git('checkout', '-q', '-B', o.branch);
    git('add', '-A');
    if (!git('status', '--porcelain').trim()) throw new Error('the task changed no files, so there is nothing to open a pull request for');
    git('commit', '-q', '-m', o.title);
    // The token goes in a header for this one push, never into a file or the task.
    const auth = `AUTHORIZATION: basic ${Buffer.from(`x-access-token:${o.token}`).toString('base64')}`;
    const remote = o.remote ?? `https://github.com/${o.repo}.git`;
    execFileSync('git', ['-c', `http.extraheader=${auth}`, 'push', '-q', '--force', remote, `HEAD:refs/heads/${o.branch}`], { cwd: tmp, stdio: 'pipe', timeout: 120_000 });
    const files = git('show', '--name-only', '--format=', 'HEAD').trim().split('\n').filter(Boolean);
    const owner = o.repo.split('/')[0];
    const open = await gh(o.token, 'GET', `/repos/${o.repo}/pulls?state=open&head=${owner}:${o.branch}`);
    const pr = open[0] ?? (await gh(o.token, 'POST', `/repos/${o.repo}/pulls`, { title: o.title, body: o.body, head: o.branch, base }));
    return { url: pr.html_url as string, number: pr.number as number, branch: o.branch, base, files };
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}
