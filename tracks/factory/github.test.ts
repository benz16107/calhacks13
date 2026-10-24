// openPullRequest against a local bare repo and a fake GitHub API: it commits the task's copy to a branch,
// pushes with the token in a header only, and asks GitHub once for the pull request.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

test('a pull request from a task copy', async () => {
  const seen: { method: string; url: string; auth?: string; body?: any }[] = [];
  const server = http.createServer(async (req, res) => {
    let body = '';
    for await (const c of req) body += c;
    seen.push({ method: req.method!, url: req.url!, auth: req.headers.authorization, body: body && JSON.parse(body) });
    res.setHeader('content-type', 'application/json');
    if (req.method === 'GET' && req.url!.includes('/issues')) return res.end(JSON.stringify([{ number: 1, title: 'add subtracts', body: 'fix it', html_url: 'u1' }, { number: 2, title: 'a PR', pull_request: {}, html_url: 'u2' }]));
    if (req.method === 'GET') return res.end('[]');
    res.statusCode = 201;
    res.end(JSON.stringify({ html_url: 'https://github.example/pr/7', number: 7 }));
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  process.env.FACTORY_GITHUB_API = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const { issues, openPullRequest } = await import('./github.ts');

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'factory-test-'));
  const git = (cwd: string, ...a: string[]) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...a], { cwd, stdio: 'pipe' }).toString();
  const remote = path.join(tmp, 'remote.git');
  const root = path.join(tmp, 'root');
  git(tmp, 'init', '-q', '--bare', '-b', 'main', remote);
  git(tmp, 'clone', '-q', remote, root);
  fs.writeFileSync(path.join(root, 'add.js'), 'a - b\n');
  git(root, 'add', '-A');
  git(root, 'commit', '-q', '-m', 'first');
  git(root, 'push', '-q', 'origin', 'HEAD:main');
  fs.writeFileSync(path.join(root, 'add.js'), 'a + b\n'); // the task's change, not committed

  try {
    assert.deepEqual((await issues('o/r', 'tok')).map((i) => i.number), [1], 'pull requests are not issues');
    const pr = await openPullRequest({ repo: 'o/r', token: 'tok', root, branch: 'droid/issue-1-t1', title: 'Fix add', body: 'Fixes #1', remote });
    assert.equal(pr.number, 7);
    assert.deepEqual(pr.files, ['add.js']);
    assert.equal(git(tmp, '--git-dir', remote, 'show', 'droid/issue-1-t1:add.js'), 'a + b\n');
    const post = seen.find((s) => s.method === 'POST')!;
    assert.deepEqual([post.body.head, post.body.base, post.auth], ['droid/issue-1-t1', 'main', 'Bearer tok']);
    assert.equal(git(root, 'status', '--porcelain').trim(), 'M add.js', "the task's own copy is left as it was");
    assert.ok(!fs.readFileSync(path.join(root, '.git', 'config'), 'utf8').includes('tok'), 'the token is in no file');
  } finally {
    server.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
