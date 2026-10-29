// openPullRequest against a local bare repo and a fake GitHub API: it commits the task's copy to a branch,
// pushes with the token in a header only, and asks GitHub once for the pull request. The task's copy is not
// trusted, so a hook, a config line or a link planted in its .git must not run or be followed.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

const seen: { method: string; url: string; auth?: string; body?: any }[] = [];
const server = http.createServer(async (req, res) => {
  let body = '';
  for await (const c of req) body += c;
  seen.push({ method: req.method!, url: req.url!, auth: req.headers.authorization, body: body && JSON.parse(body) });
  res.setHeader('content-type', 'application/json');
  if (req.method === 'GET' && req.url!.includes('/issues')) return res.end(JSON.stringify([{ number: 1, title: 'add subtracts', body: 'fix it', html_url: 'u1' }, { number: 2, title: 'a PR', pull_request: {}, html_url: 'u2' }]));
  if (req.method === 'GET' && req.url === '/repos/o/r') return res.end(JSON.stringify({ default_branch: 'trunk' }));
  if (req.method === 'GET') return res.end('[]');
  res.statusCode = 201;
  res.end(JSON.stringify({ html_url: 'https://github.example/pr/7', number: 7 }));
});
await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
process.env.FACTORY_GITHUB_API = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
const { issues, openPullRequest, repoName } = await import('./github.ts');
test.after(() => server.close());

const git = (cwd: string, ...a: string[]) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...a], { cwd, stdio: 'pipe' }).toString();
/** A bare "GitHub" repo and a clone of it holding add.js, then the task's change to add.js (not committed). */
function repo() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'factory-test-'));
  const remote = path.join(tmp, 'remote.git');
  const root = path.join(tmp, 'root');
  git(tmp, 'init', '-q', '--bare', '-b', 'main', remote);
  git(tmp, 'clone', '-q', remote, root);
  fs.writeFileSync(path.join(root, 'add.js'), 'a - b\n');
  git(root, 'add', '-A');
  git(root, 'commit', '-q', '-m', 'first');
  git(root, 'push', '-q', 'origin', 'HEAD:main');
  fs.writeFileSync(path.join(root, 'add.js'), 'a + b\n');
  return { tmp, remote, root };
}

test('a pull request from a task copy', async () => {
  const { tmp, remote, root } = repo();
  try {
    assert.deepEqual((await issues('o/r', 'tok')).map((i) => i.number), [1], 'pull requests are not issues');
    const pr = await openPullRequest({ repo: 'o/r', token: 'tok', root, branch: 'droid/issue-1-t1', title: 'Fix add', body: 'Fixes #1', remote });
    assert.equal(pr.number, 7);
    assert.deepEqual(pr.files, ['add.js']);
    assert.equal(git(tmp, '--git-dir', remote, 'show', 'droid/issue-1-t1:add.js'), 'a + b\n');
    const post = seen.find((s) => s.method === 'POST')!;
    assert.deepEqual([post.body.head, post.body.base, post.auth], ['droid/issue-1-t1', 'trunk', 'Bearer tok'], "the pull request goes into the repository's default branch");
    assert.equal(git(root, 'status', '--porcelain').trim(), 'M add.js', "the task's own copy is left as it was");
    assert.ok(!fs.readFileSync(path.join(root, '.git', 'config'), 'utf8').includes('tok'), 'the token is in no file');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("a hook or config line planted in the task's .git does not run, and a link under .git is not followed", async () => {
  const { tmp, remote, root } = repo();
  const marker = path.join(tmp, 'ran');
  const script = path.join(tmp, 'evil.sh');
  fs.writeFileSync(script, `#!/bin/sh\necho "$0" >> ${marker}\n`, { mode: 0o755 });
  try {
    fs.mkdirSync(path.join(root, '.git', 'hooks'), { recursive: true });
    for (const hook of ['pre-commit', 'commit-msg', 'pre-push', 'post-commit']) fs.writeFileSync(path.join(root, '.git', 'hooks', hook), `#!/bin/sh\necho ${hook} >> ${marker}\n`, { mode: 0o755 });
    fs.appendFileSync(path.join(root, '.git', 'config'), `[core]\n\tfsmonitor = ${script}\n\thooksPath = ${path.join(root, '.git', 'hooks')}\n\tsshCommand = ${script}\n[alias]\n\tadd = !${script}\n[credential]\n\thelper = !${script}\n`);
    fs.symlinkSync('/etc/hostname', path.join(root, '.git', 'info-link')); // a link under .git is dropped, not read
    fs.mkdirSync(path.join(root, 'vendor', '.git'), { recursive: true }); // a nested repository is a plain folder to the commit
    fs.writeFileSync(path.join(root, 'vendor', 'x.js'), 'x\n');
    const pr = await openPullRequest({ repo: 'o/r', token: 'tok', root, branch: 'droid/issue-1-t2', title: 'Fix add', body: 'Fixes #1', remote });
    assert.equal(fs.existsSync(marker), false, `nothing the task planted in .git ran: ${fs.existsSync(marker) ? fs.readFileSync(marker, 'utf8') : ''}`);
    assert.deepEqual(pr.files.sort(), ['add.js', 'vendor/x.js']);
    assert.equal(git(tmp, '--git-dir', remote, 'show', 'droid/issue-1-t2:add.js'), 'a + b\n');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('a failed push does not put the token in the error', async () => {
  const { tmp, root } = repo();
  try {
    await assert.rejects(
      openPullRequest({ repo: 'o/r', token: 'ghp_SECRETTOKEN123', root, branch: 'droid/issue-1-t3', title: 't', body: 'b', remote: path.join(tmp, 'missing.git') }),
      (e: Error) => /^git push failed: /.test(e.message) && !e.message.includes('SECRETTOKEN') && !e.message.includes(Buffer.from('x-access-token:ghp_SECRETTOKEN123').toString('base64')),
    );
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('a task with no git repository of its own, or one that is a link, is refused', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'factory-test-'));
  try {
    fs.writeFileSync(path.join(tmp, 'a.txt'), 'a');
    await assert.rejects(openPullRequest({ repo: 'o/r', token: 't', root: tmp, branch: 'b', title: 't', body: 'b' }), /no git repository/);
    fs.mkdirSync(path.join(tmp, 'elsewhere'));
    fs.symlinkSync(path.join(tmp, 'elsewhere'), path.join(tmp, '.git'));
    await assert.rejects(openPullRequest({ repo: 'o/r', token: 't', root: tmp, branch: 'b', title: 't', body: 'b' }), /no git repository/);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('the repository name can be owner/name or a pasted GitHub link, and nothing else', () => {
  assert.equal(repoName(' you/project '), 'you/project');
  assert.equal(repoName('https://github.com/you/project.git'), 'you/project');
  assert.equal(repoName('https://github.com/you/project/'), 'you/project');
  for (const bad of ['project', 'a/b/c', 'https://evil.example/you/project', '../x', 'you/pro ject', '']) assert.throws(() => repoName(bad), /owner\/name/, bad);
});
