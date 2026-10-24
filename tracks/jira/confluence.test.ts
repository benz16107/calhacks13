import assert from 'node:assert/strict';
import test from 'node:test';
import { dailyPage, ensureSpace, incidentPage, type Api, type DayTask, type Incident } from './confluence.ts';

/** A fake Confluence: spaces and pages in memory, with the version rule real Confluence enforces. */
function fake() {
  const calls: { method: string; path: string; body?: any }[] = [];
  const spaces: any[] = [];
  const pages: any[] = [];
  const api: Api = async (method, path, body: any) => {
    calls.push({ method, path, body });
    if (method === 'GET' && path.startsWith('/wiki/api/v2/spaces')) return { results: spaces.filter((s) => path.includes(`keys=${s.key}`)) };
    if (method === 'POST' && path === '/wiki/rest/api/space') return void spaces.push({ id: String(100 + spaces.length), key: body.key });
    if (method === 'GET' && path.startsWith('/wiki/api/v2/pages?')) {
      const title = decodeURIComponent(/title=([^&]*)/.exec(path)![1]);
      return { results: pages.filter((x) => x.title === title) };
    }
    if (method === 'POST' && path === '/wiki/api/v2/pages') {
      const pg = { id: String(500 + pages.length), title: body.title, body, version: { number: 1 }, _links: { webui: `/spaces/X/pages/${500 + pages.length}` } };
      pages.push(pg);
      return pg;
    }
    if (method === 'PUT') {
      const pg = pages.find((x) => x.id === path.split('/').pop())!;
      assert.equal(body.version.number, pg.version.number + 1);
      Object.assign(pg, { body, version: body.version });
      return pg;
    }
    throw new Error('unexpected ' + method + ' ' + path);
  };
  return { api, calls, pages };
}

const evil = '<script>alert(1)</script><ac:structured-macro ac:name="html">&';
const task = (o: Partial<DayTask> = {}): DayTask => ({ id: 't1', title: 'Fix the build', state: 'done', source: 'cli', issue: 'BOX-1', costCents: 25, blocked: [], changes: [{ path: 'a.ts', change: 'modified' }], approvals: [], ...o });
const inc: Incident = { task: 't2', title: evil, issue: 'BOX-2', source: 'web', at: '2026-10-24T10:00:00Z', host: 'evil.example', worker: 'droid', workspace: 'main', allowedHosts: ['api.github.com'], prompt: evil, steps: [evil], outcome: 'The task kept running without it.' };

test('ensureSpace creates a missing space once and reuses it', async () => {
  const f = fake();
  const a = await ensureSpace(f.api, 'AGENTS', 'Agent reports');
  const b = await ensureSpace(f.api, 'AGENTS', 'Agent reports');
  assert.deepEqual(a, b);
  assert.equal(f.calls.filter((c) => c.method === 'POST').length, 1);
});

test('dailyPage is idempotent by title and bumps the version', async () => {
  const f = fake();
  const space = { id: '100', key: 'AGENTS' };
  const one = await dailyPage(f.api, space, '2026-10-24', [task()], 'https://x.atlassian.net');
  const two = await dailyPage(f.api, space, '2026-10-24', [task(), task({ id: 't3', title: 'Second' })], 'https://x.atlassian.net');
  assert.equal(one.id, two.id);
  assert.equal(f.pages.length, 1);
  assert.equal(one.url, 'https://x.atlassian.net/wiki/spaces/X/pages/500');
  assert.match(f.pages[0].body.body.value, /2 tasks/);
  assert.match(f.pages[0].body.body.value, /href="https:\/\/x\.atlassian\.net\/browse\/BOX-1"/);
});

test('agent text cannot inject markup or macros', async () => {
  const f = fake();
  const space = { id: '100', key: 'AGENTS' };
  await incidentPage(f.api, space, inc, 'x.atlassian.net');
  await dailyPage(f.api, space, '2026-10-24', [task({ title: evil, blocked: [evil], issue: evil, approvals: [{ question: evil, state: 'denied', by: evil }] })], 'x.atlassian.net');
  for (const pg of f.pages) {
    const v: string = pg.body.body.value;
    assert.ok(!v.includes('<script'));
    assert.ok(!v.includes('ac:name="html"'));
    assert.ok(v.includes('&lt;script&gt;'));
  }
});

test('incident page says what happened and the title is stable', async () => {
  const f = fake();
  const space = { id: '100', key: 'AGENTS' };
  const a = await incidentPage(f.api, space, { ...inc, title: 'Read a page' }, 'x.atlassian.net');
  const b = await incidentPage(f.api, space, { ...inc, title: 'Read a page' }, 'x.atlassian.net');
  assert.equal(a.id, b.id);
  assert.match(f.pages[0].title, /^Blocked: Read a page tried to reach evil\.example \(2026-10-24\)$/);
  assert.match(f.pages[0].body.body.value, /refused at the box&#39;s proxy/);
});

test('payments from wallet tools are labelled test money', async () => {
  const f = fake();
  await dailyPage(f.api, { id: '1', key: 'A' }, '2026-10-24', [task({ source: 'coinbase-wallet' })], 'x');
  assert.match(f.pages[0].body.body.value, /test money/);
});
