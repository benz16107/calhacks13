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

/** "owner/name", from what the owner typed: a pasted https://github.com/owner/name(.git) link works too. Throws on anything else. */
export function repoName(value: string) {
  const name = value.trim().replace(/^https:\/\/github\.com\//, '').replace(/\.git$/, '').replace(/\/$/, '');
  if (!/^[\w.-]+\/[\w.-]+$/.test(name) || name.split('/').some((p) => /^\.+$/.test(p))) throw new Error('FACTORY_GITHUB_REPO should look like owner/name, for example you/project');
  return name;
}

/** A header that signs one git command into GitHub with the token, so the token never lands in a file or a URL. */
const authHeader = (token: string) => `http.extraheader=AUTHORIZATION: basic ${Buffer.from(`x-access-token:${token}`).toString('base64')}`;

/**
 * Run git. A failed command's own message repeats its whole command line, header and token included, and these
 * messages end up in the log and in front of the task. So a failure is rewritten as "git <command> failed: <git's
 * own first line>", with the token (and its encoded form) blanked out.
 */
function git(args: string[], opts: { cwd?: string; env?: NodeJS.ProcessEnv; token?: string } = {}) {
  try {
    return execFileSync('git', args, { cwd: opts.cwd, env: opts.env, stdio: 'pipe', timeout: 120_000 }).toString();
  } catch (e) {
    let why = String((e as { stderr?: Buffer }).stderr ?? (e as Error).message).trim().split('\n').find((l) => l.trim()) ?? 'no reason given';
    for (const t of opts.token ? [opts.token, Buffer.from(`x-access-token:${opts.token}`).toString('base64')] : []) why = why.split(t).join('***');
    const verb = args.find((a) => /^[a-z][a-z-]*$/.test(a));
    throw new Error(`git ${verb ? `${verb} ` : ''}failed: ${why}`);
  }
}

/** Open issues with the `droid` label, oldest first. Pull requests are left out. */
export async function issues(repo: string, token: string): Promise<Issue[]> {
  const list = await gh(token, 'GET', `/repos/${repo}/issues?state=open&labels=${LABEL}&sort=created&direction=asc&per_page=20`);
  return list.filter((i: any) => !i.pull_request).map((i: any) => ({ number: i.number, title: i.title, body: i.body ?? '', url: i.html_url }));
}

/** A shallow clone of the repo, made by the core. The task gets a copy-on-write copy of it as its workspace. */
export function clone(repo: string, dir: string, url = `https://github.com/${repo}.git`, token = '') {
  fs.rmSync(dir, { recursive: true, force: true });
  git([...(token ? ['-c', authHeader(token)] : []), 'clone', '--quiet', '--depth', '1', url, dir], { token });
}

/**
 * Commit what the task changed in its copy (`root`) to a new branch and open a pull request. The copy is copied
 * again first, so the task's own files are never written by root. Calling it twice returns the same pull request.
 *
 * The task's copy is not trusted: Droid, or whatever hijacked it, can write anything under .git, and git runs here
 * as root. A hook (.git/hooks/pre-commit) or a config line (core.fsmonitor, an alias, a credential helper) would run
 * a command with the vault in reach. So git sees only the repository's objects, refs and HEAD: the hooks, the config
 * and every other file under .git are replaced before it runs, links under .git are dropped, and a .git that is
 * itself a link or a file is refused.
 */
export async function openPullRequest(o: { repo: string; token: string; root: string; branch: string; title: string; body: string; remote?: string }) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'factory-pr-'));
  try {
    const gitDir = path.join(o.root, '.git');
    if (!fs.lstatSync(gitDir, { throwIfNoEntry: false })?.isDirectory()) throw new Error('the task has no git repository of its own (.git), so there is nothing to commit');
    // Nested repositories are plain folders to the commit; only the top .git is read.
    // Inside .git a link would let git read a file the task chose (HEAD pointing at the vault), so none is copied.
    const inside = (src: string) => src === gitDir || src.startsWith(gitDir + path.sep);
    fs.cpSync(o.root, tmp, { recursive: true, verbatimSymlinks: true, filter: (src) => (inside(src) ? !fs.lstatSync(src).isSymbolicLink() : path.basename(src) !== '.git') });
    const safe = path.join(tmp, '.git');
    for (const f of fs.readdirSync(safe)) if (!['objects', 'refs', 'HEAD', 'packed-refs', 'shallow'].includes(f)) fs.rmSync(path.join(safe, f), { recursive: true, force: true });
    fs.rmSync(path.join(safe, 'objects', 'info', 'alternates'), { force: true });
    fs.writeFileSync(path.join(safe, 'config'), '[core]\n\trepositoryformatversion = 0\n\tfilemode = true\n\tbare = false\n');
    const env = { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1', GIT_TERMINAL_PROMPT: '0' };
    const run = (extra: string[], ...args: string[]) =>
      git(['-c', 'core.hooksPath=/dev/null', '-c', 'core.fsmonitor=false', '-c', 'user.name=GurtOS Droid', '-c', 'user.email=droid@gurtos.invalid', ...extra, ...args], { cwd: tmp, env, token: o.token });
    const g = (...args: string[]) => run([], ...args);
    // The branch the pull request goes into is the repository's own default, never whatever branch the task checked out.
    const base = ((await gh(o.token, 'GET', `/repos/${o.repo}`)).default_branch as string | undefined) || 'main';
    g('reset', '-q'); // the index was dropped with the rest of .git; this rebuilds it from HEAD and keeps the task's files
    g('checkout', '-q', '-B', o.branch);
    g('add', '-A');
    if (!g('status', '--porcelain').trim()) throw new Error('the task changed no files, so there is nothing to open a pull request for');
    g('commit', '-q', '-m', o.title);
    const remote = o.remote ?? `https://github.com/${o.repo}.git`;
    run(['-c', authHeader(o.token)], 'push', '-q', '--force', remote, `HEAD:refs/heads/${o.branch}`);
    const files = g('show', '--name-only', '--format=', 'HEAD').trim().split('\n').filter(Boolean);
    const owner = o.repo.split('/')[0];
    const open = await gh(o.token, 'GET', `/repos/${o.repo}/pulls?state=open&head=${owner}:${o.branch}`);
    const pr = open[0] ?? (await gh(o.token, 'POST', `/repos/${o.repo}/pulls`, { title: o.title, body: o.body, head: o.branch, base }));
    return { url: pr.html_url as string, number: pr.number as number, branch: o.branch, base, files };
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}
