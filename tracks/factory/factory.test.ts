// The Factory app's own logic: the GitHub watcher, the plan limits and the run route, against a fake GitHub
// (an HTTP server for the API and a local repository standing in for github.com) and a fake box.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'factory-track-'));
const remote = path.join(tmp, 'o-r.git');
execFileSync('git', ['init', '-q', '--bare', '-b', 'main', remote]);
const work = path.join(tmp, 'work');
execFileSync('git', ['clone', '-q', remote, work], { stdio: 'pipe' });
fs.writeFileSync(path.join(work, 'a.txt'), 'a');
for (const args of [['add', '-A'], ['commit', '-q', '-m', 'first'], ['push', '-q', 'origin', 'HEAD:main']]) execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd: work, stdio: 'pipe' });
// "https://github.com/o/r.git" is the local repository, for the clone the watcher makes.
Object.assign(process.env, { GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: `url.${remote}.insteadOf`, GIT_CONFIG_VALUE_0: 'https://github.com/o/r.git', BOX_HOME: path.join(tmp, 'home') });

let apiCalls = 0;
const server = http.createServer((req, res) => {
  apiCalls++;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify([1, 2].map((n) => ({ number: n, title: `issue ${n}`, body: 'fix it', html_url: `u${n}` }))));
});
await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
process.env.FACTORY_GITHUB_API = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
const { checkGithub, limits, default: track } = await import('./track.ts');
test.after(() => {
  server.close();
  fs.rmSync(tmp, { recursive: true, force: true });
});

/** A box with a vault of `secrets`, a task list, and a createTask that takes a moment (so checks can overlap) and may refuse. */
function fakeBox(secrets: Record<string, string>, refuse: (spec: any) => boolean = () => false) {
  const tasks: { id: string; source: string }[] = [];
  const box = {
    secret: (n: string) => {
      if (!(n in secrets)) throw new Error(`${n} is not in the vault`);
      return secrets[n];
    },
    tasks: () => tasks,
    workspace: () => {},
    createTask: async (spec: any) => {
      await new Promise((r) => setTimeout(r, 30));
      if (refuse(spec)) throw new Error('refused');
      const t = { id: `t${tasks.length + 1}`, source: spec.source };
      tasks.push(t);
      return t;
    },
  };
  return { box: box as any, tasks };
}

test('two checks at once start one task per issue, not two', async () => {
  const { box, tasks } = fakeBox({ FACTORY_GITHUB_REPO: 'o/r' });
  const [a, b] = await Promise.all([checkGithub(box), checkGithub(box)]);
  assert.equal(tasks.length, 2, 'issues 1 and 2 got a task each, once');
  assert.deepEqual(a, b, 'the second caller got the first check, not a second one');
  assert.deepEqual(tasks.map((t) => t.source), ['github:o/r#1', 'github:o/r#2']);
  assert.equal((await checkGithub(box)).started?.length, 0, 'a later check starts nothing: both issues have tasks');
});

test('an issue that cannot start does not hold up the ones after it, and the error names it', async () => {
  const { box, tasks } = fakeBox({ FACTORY_GITHUB_REPO: 'o/r' }, (spec) => spec.source.endsWith('#1'));
  const c = await checkGithub(box);
  assert.deepEqual(tasks.map((t) => t.source), ['github:o/r#2']);
  assert.match(c.error ?? '', /^Couldn't start #1: refused/);
});

test('a pasted link works, and a bad repository name is explained without calling GitHub', async () => {
  const { box, tasks } = fakeBox({ FACTORY_GITHUB_REPO: 'https://github.com/o/r.git' });
  assert.equal((await checkGithub(box)).repo, 'o/r');
  assert.equal(tasks.length, 2);
  const before = apiCalls;
  const bad = await checkGithub(fakeBox({ FACTORY_GITHUB_REPO: 'my project' }).box);
  assert.match(bad.error ?? '', /owner\/name/);
  assert.equal(apiCalls, before, 'GitHub was not asked');
  assert.match((await checkGithub(fakeBox({}).box)).error ?? '', /No GitHub repo connected/);
});

test('the plan limits are asked of Factory once a half minute, and a refused key is said plainly', async () => {
  const real = globalThis.fetch;
  let asked = 0;
  let status = 200;
  globalThis.fetch = (async () => {
    asked++;
    return new Response(JSON.stringify({ limits: { standard: { fiveHour: { usedPercent: 12, secondsRemaining: 600 }, weekly: { usedPercent: 3, secondsRemaining: 86400 } } } }), { status });
  }) as typeof fetch;
  try {
    const first: any = await limits('key-one');
    assert.deepEqual(first.fiveHour, { usedPercent: 12, resetsInMin: 10 });
    await limits('key-one');
    await limits('key-one');
    assert.equal(asked, 1, 'three window refreshes, one request to Factory');
    status = 401;
    const refused: any = await limits('key-two');
    assert.match(refused.error, /didn't accept this API key/);
    assert.match(((await limits('')) as any).error, /Add a Factory API key/);
  } finally {
    globalThis.fetch = real;
  }
});

test('POST /run refuses a body that is not an object, and hosts that are not a list', async () => {
  const run = track.routes!['POST /run'];
  const post = (body: string) => run(new Request('http://box/t/factory/run', { method: 'POST', body }), {} as any);
  for (const body of ['null', '[]', '"hi"', '{', '{"prompt":"  "}']) assert.equal((await post(body)).status, 400, body);
  const r = await post('{"prompt":"do it","hosts":"example.com"}');
  assert.equal(r.status, 400);
  assert.match(((await r.json()) as any).error, /hosts/);
});
