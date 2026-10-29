// The Jira track's demo step. Two agent tasks become Jira issues; one of them strays (tries an unknown host,
// changes a settings file) and asks for an OK. The calls the Forge app makes approve it, then roll back just that
// task. Then the rest of the control room: a production change decided in Jira Service Management, a Confluence
// incident page and daily report, the activity the Rovo agent and gadget read, a task started from a teammate's
// issue, pause all, and a bulk roll back. Offline by default: a stand-in for Jira Cloud on this machine takes the
// box's REST calls. DEMO_LIVE=jira ./demo uses the real demo site instead, then deletes what it made.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import type { DemoKit, Task } from '../../core/contract.ts';
import { dailyTitle } from './confluence.ts';

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
  // Live, reports go to a scratch space so the real daily page is never overwritten, and JSM uses the site's
  // approval request type with the signed-in account as approver.
  const cfg = {
    project: 'BOX',
    ...(stub && { site: stub.url }),
    start: { workspace: 'jira', worker: 'fake', budgetCents: 0 },
    jsm: stub ? { serviceDesk: '1', requestType: '1', match: ['production'], approvers: ['acct-approver'] } : { serviceDesk: '11', requestType: '145', match: ['production'] },
    confluence: { space: stub ? 'AGENTS' : 'GURTDEMO' },
  };
  fs.writeFileSync(conf, JSON.stringify(cfg));
  const made: string[] = [];
  const pages: string[] = [];
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

    // The calls the Forge panel makes, with and without the shared secret. They arrive through Caddy, so they
    // carry X-Forwarded-For: the box treats them as remote, and only the track's own check lets them in.
    const port = fs.readFileSync(path.join(d.home, 'api.port'), 'utf8').trim();
    const panel = (method: string, p: string, token: string, body?: unknown) =>
      fetch(`http://127.0.0.1:${port}/t/jira${p}`, {
        method,
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.7' },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    const approval = `${B.id}.task.line3`;
    // The Forge app sends the Atlassian account id; the box asks Atlassian for the name. A name in the body is ignored.
    const me = stub ? { accountId: 'acct-user', displayName: 'Jira user' } : await jira('GET', '/rest/api/3/myself');
    const acting = { account: me.accountId, by: 'Someone else entirely' };
    const refused = await Promise.all([panel('POST', '/undo', '', { task: B.id }), panel('POST', '/answer', 'guess'.repeat(10), { task: B.id, approval, approved: true })]);
    d.check(refused.every((r) => r.status === 401), 'without the shared secret the panel routes refuse to approve or roll back (401)');
    const secret = key('JIRA_BOX_SECRET');
    if (!secret) {
      console.log('  skip  approve and roll back from Jira: no JIRA_BOX_SECRET in /etc/box/vault.env on this machine');
      return;
    }
    d.check((await panel('POST', '/answer', secret, { task: A.id, approval, approved: true })).status === 404, "an approval can't be answered through another task's issue");
    const nameOnly = await panel('POST', '/answer', secret, { task: B.id, approval, approved: true, by: 'Mallory' });
    d.check(nameOnly.status === 400, 'an answer that names someone but carries no Atlassian account is refused (400)');
    await panel('POST', '/answer', secret, { task: B.id, approval, approved: true, ...acting });
    await d.settled([B.id]);
    d.check(d.view('jira', 'settings.txt') === 'retries=0', 'approved from Jira, task B finished');
    await panel('POST', '/undo', secret, { task: B.id, ...acting });
    d.check(d.view('jira', 'settings.txt') === undefined && d.view('jira', 'README.md') === 'the box', 'rolled back from Jira: B\'s settings change is gone, A\'s fix stays');
    const audit = await (await panel('GET', `/task?id=${B.id}`, secret)).json();
    d.check(
      audit.task.state === 'undone' && audit.audit.some((l: { text: string }) => l.text === `Approved by jira:${me.displayName}`) && audit.blocked[0]?.host.startsWith('attacker.example') && audit.diff.includes('+retries=0'),
      'the panel\'s audit view shows the block, who approved, the roll back and the diff it undid',
    );
    const b2 = await issue(B.id, (i) => i.fields.labels.includes('box-undone') && i.comments.some((c: string) => c.includes(`Rolled back by jira:${me.displayName}`)));
    d.check(b2.fields.status.name === 'Done' && b2.text.includes(`Rolled back by jira:${me.displayName}`), `${b2.key} says who rolled it back, in a comment and the description`);
    d.check(b2.text.includes('+retries=0'), `${b2.key} still shows the diff it undid, though the box deleted those files`);
    const secrets = vault.split('\n').map((l) => l.split('=').slice(1).join('=').trim()).filter((v) => v.length > 8);
    // Live, check the text the box wrote; Jira's own JSON carries the site and email, which are not secrets.
    const sent = stub ? stub.bodies.join('\n') : JSON.stringify([a.text, a.comments, b2.text, b2.comments]);
    d.check(!secrets.some((s) => sent.includes(s)), 'no vault secret is in anything the box sent to Jira');

    // ---- the rest of the control room ----
    const call = async (method: string, p: string, body?: unknown) => {
      const r = await panel(method, p, secret, body);
      const out = await r.json();
      if (!r.ok) throw new Error(`${method} ${p}: ${r.status} ${out.error}`);
      return out;
    };
    const opened = () => JSON.parse(fs.existsSync(path.join(d.home, 'jira', 'jsm.json')) ? fs.readFileSync(path.join(d.home, 'jira', 'jsm.json'), 'utf8') : '{}');

    // JSM: B's "production" question also opened a request; the panel answered first, so the box closed it.
    const bReq = await d.waitFor('B\'s JSM request', async () => opened()[approval]?.key, 40000).catch(() => undefined);
    if (bReq) made.push(bReq);
    d.check(bReq, `B's production push opened Jira Service Management request ${bReq} for its approvers`);
    // C asks for a production deploy and nobody answers in GurtOS: the JSM approver decides.
    const C = await start('Ship the hotfix', 'write hotfix.txt deployed\nask Deploy the hotfix to production?');
    const cReq = await d.waitFor('C\'s JSM request', async () => opened()[`${C.id}.task.line2`]?.key, 40000);
    made.push(cReq);
    if (stub) stub.approve(cReq);
    else {
      const ap = (await jira('GET', `/rest/servicedeskapi/request/${cReq}/approval`)).values[0];
      await jira('POST', `/rest/servicedeskapi/request/${cReq}/approval/${ap.id}`, { decision: 'approve' });
    }
    await d.settled([C.id]);
    const cTask = await d.api('GET', `/tasks/${C.id}`);
    d.check(d.view('jira', 'hotfix.txt') === 'deployed' && cTask.approvals[0].by.includes(`via JSM ${cReq}`), `C waited for ${cReq}; approved in JSM, it shipped (${cTask.approvals[0].by})`);
    if (stub) {
      const closed = await d.waitFor(`${bReq} to be closed`, async () => stub.comments(bReq!).some((c) => c.includes('Answered in GurtOS')), 30000).catch(() => false);
      d.check(closed, `${bReq} was closed with a note: B was already answered in GurtOS`);
    }

    // Confluence: B's blocked attempt has an incident page, and today's report lists the tasks.
    const page = (title: (t: string) => boolean) => (stub ? stub.page(title) : undefined);
    if (stub) {
      const inc = await d.waitFor('the incident page', async () => page((t) => t.includes('attacker.example')), 20000);
      d.check(inc.body.includes('Tidy the settings') && inc.body.includes('refused'), `Confluence incident page: "${inc.title}"`);
    }
    await call('POST', '/report');
    const today = dailyTitle(new Date().toISOString().slice(0, 10));
    if (stub) {
      const daily = page((t) => t === today);
      d.check(daily?.body.includes('Ship the hotfix') && daily.body.includes('attacker.example'), `Confluence daily page "${today}" lists the tasks and the blocked attempt`);
    } else pages.push(today);

    // What the Rovo agent and the dashboard gadget read.
    const act = await call('GET', '/activity?source=demo');
    const bRow = act.tasks.find((t: { id: string }) => t.id === B.id);
    d.check(act.totals.tasks >= 3 && bRow?.blocked[0]?.startsWith('attacker.example') && bRow.issue === b.key && act.byProject.some((p: { project: string }) => p.project === 'BOX'),
      `activity: ${act.totals.tasks} tasks, ${act.totals.blocked} blocked, by project ${act.byProject.map((p: { project: string; tasks: number }) => `${p.project} ${p.tasks}`).join(', ')}`);

    // A teammate's issue, assigned to the GurtOS agent: the task works in its own space and reports back there.
    const teammate = (await jira('POST', '/rest/api/3/issue', { fields: { project: { key: stub ? 'OPS' : 'BOX' }, issuetype: { name: 'Task' }, summary: 'Write the on-call notes', labels: [] } })).key;
    made.push(teammate);
    const started = await call('POST', '/start', { issue: { key: teammate, summary: 'Write the on-call notes', description: 'write oncall.md Page Sam first, then Priya.' }, ...acting });
    const again = await call('POST', '/start', { issue: { key: teammate, summary: 'x', description: 'write x.md x' }, ...acting });
    await d.settled([started.task.id]);
    const report = await d.waitFor(`the report on ${teammate}`, async () => {
      const cs = (await jira('GET', `/rest/api/3/issue/${teammate}/comment`)).comments.map((c: { body: unknown }) => JSON.stringify(c.body));
      return cs.find((c: string) => c.includes('+Page Sam first'));
    }, 30000);
    d.check(d.view('jira', 'oncall.md') === 'Page Sam first, then Priya.' && report && (again.already || again.task.id === started.task.id),
      `assigned ${teammate} to the GurtOS agent: the task ran, the diff came back as a comment, a second start did not run it twice`);

    // Pause all: a new task waits; resume, and it runs.
    await call('POST', '/pause', { paused: true, ...acting });
    const D = await start('Paused job', 'write paused.txt later');
    await new Promise((r) => setTimeout(r, 1500));
    const waited = (await d.api('GET', `/tasks/${D.id}`)).task.state === 'queued' && (await call('GET', '/activity')).paused;
    const resumeFromJira = await call('POST', '/pause', { paused: false, ...acting }).then(() => 200, (e: Error) => Number(e.message.match(/: (\d{3}) /)?.[1]));
    await d.api('PATCH', '/settings', { paused: false }); // the box's own screen resumes
    await d.settled([D.id]);
    d.check(waited && d.view('jira', 'paused.txt') === 'later', 'pause all from Jira held a new task in the queue; the box\'s screen resumed it and it ran');
    d.check(resumeFromJira === 403, 'resuming from Jira is refused on a Server box (403): it stays with the screen and the owner\'s phone');

    // Bulk roll back from a JQL list: A's fix and the hotfix, picked by issue key. Each says what came back.
    const cIssue = (await issue(C.id, () => true)).key;
    const bulk = await call('POST', '/undo-many', { issues: [a.key, cIssue, 'NOPE-1'], ...acting });
    const [ra, rc, rx] = bulk.results;
    d.check(ra.ok && rc.ok && !rx.ok && ra.changes.some((x: { path: string }) => x.path === 'README.md') && d.view('jira', 'README.md') === 'teh box' && d.view('jira', 'hotfix.txt') === undefined && d.view('jira', 'oncall.md') !== undefined,
      `bulk roll back of ${a.key} and ${cIssue}: both came back (${[...ra.changes, ...rc.changes].map((x: { path: string }) => x.path).join(', ')}), NOPE-1 was refused, the on-call notes stayed`);
    // GurtOS Business: a Jira account acts as the GurtOS person it is linked to, and Business decides by role,
    // limit and who asked. Offline only: the live site has no Jira accounts for these people.
    if (!stub) console.log('  skip  Business people mapping: offline only (the demo site has no accounts for these people)');
    else await business(d, stub, call, start, opened);
  } finally {
    fs.rmSync(conf, { force: true });
    stub?.server.close();
    // Live runs leave the site as they found it: issues and JSM requests deleted, report pages removed.
    if (live) {
      for (const k of made) await jira('DELETE', `/rest/api/3/issue/${k}`).catch(() => {});
      const sp = (await jira('GET', '/wiki/api/v2/spaces?keys=GURTDEMO').catch(() => ({ results: [] }))).results?.[0];
      if (sp) for (const pg of (await jira('GET', `/wiki/api/v2/pages?space-id=${sp.id}&limit=50`)).results ?? []) await jira('DELETE', `/wiki/api/v2/pages/${pg.id}`).catch(() => {});
    }
  }
}

/** Business on for a moment: Dana is the Controller (approves up to $50,000), Lee is a requester. Own ids, so the Business demo's people and counts are untouched; removed at the end. */
async function business(d: DemoKit, stub: Stub, call: (m: string, p: string, b?: unknown) => Promise<any>, start: (t: string, p: string) => Promise<Task>, opened: () => Record<string, { key: string }>) {
  await d.api('PUT', '/business', { on: true, company: 'Fogline', policy: 'Over $10,000 goes to the Controller.\nEverything else goes to any approver.' });
  try {
    await d.api('POST', '/people', { id: 'jira-dana', name: 'Dana Whitfield', role: 'approver', title: 'Controller', limitCents: 5_000_000, approvesFor: ['Controller'] });
    await d.api('POST', '/people', { id: 'jira-lee', name: 'Lee Park', role: 'requester' });
    await d.api('POST', '/people', { id: 'jira-ada', name: 'Ada Brennan', role: 'admin', title: 'IT' });
    fs.writeFileSync(path.join(d.home, 'jira', 'people.json'), JSON.stringify({ 'acct-dana': 'jira-dana', 'acct-lee': 'jira-lee', 'acct-ada': 'jira-ada' }));
    const waitAsk = (t: Task) => d.waitFor(`${t.title} to ask`, async () => (await d.api('GET', `/tasks/${t.id}`)).approvals.find((a: { state: string }) => a.state === 'pending'), 20000);
    const answer = (t: Task, approval: string, account: string) => call('POST', '/answer', { task: t.id, approval, approved: true, account }).then(() => 200, (e: Error) => Number(e.message.match(/: (\d{3}) /)?.[1]));

    const big = await start('Wire the supplier', 'ask Wire $60,000 to the new supplier?');
    const bigAsk = await waitAsk(big);
    d.check(await answer(big, bigAsk.id, 'acct-nobody') === 403, 'Business: a Jira user not linked to a GurtOS person is refused (403)');
    d.check(await answer(big, bigAsk.id, 'acct-lee') === 403, 'Business: Lee, a requester, cannot approve from Jira (403)');
    d.check(await answer(big, bigAsk.id, 'acct-dana') === 403, 'Business: $60,000 is over Dana\'s $50,000 limit, so her approval from Jira is refused (403)');
    await d.api('POST', `/tasks/${big.id}/undo`);

    // Pause from Jira is anyone's; resume only a linked admin's.
    const code = (p: Promise<unknown>) => p.then(() => 200, (e: Error) => Number(e.message.match(/: (\d{3}) /)?.[1]));
    await call('POST', '/pause', { paused: true, account: 'acct-lee' });
    const leeResume = await code(call('POST', '/pause', { paused: false, account: 'acct-lee' }));
    const adaResume = await code(call('POST', '/pause', { paused: false, account: 'acct-ada' }));
    d.check(leeResume === 403 && adaResume === 200 && !(await call('GET', '/activity')).paused, `Business: Lee could pause from Jira but not resume (${leeResume}); Ada, an admin, resumed (${adaResume})`);

    const inv = await start('Pay the invoice', 'ask Pay the $20,000 invoice?\nwrite paid.txt yes');
    const invAsk = await waitAsk(inv);
    await answer(inv, invAsk.id, 'acct-dana');
    await d.settled([inv.id]);
    const got = (await d.api('GET', `/tasks/${inv.id}`)).approvals[0];
    d.check(got.person === 'jira-dana' && got.by === 'Dana Whitfield', `Business: Dana's approval from Jira counts as her: by ${got.by}, person ${got.person}, within her limit`);

    // Dana hands a Jira issue to the agent, so she asked for the task: she can't approve its request in JSM either.
    stub.issue('OPS-9');
    const own = await call('POST', '/start', { issue: { key: 'OPS-9', summary: 'Ship the hotfix', description: 'ask Push the hotfix to production?' }, account: 'acct-dana' });
    const ownTask = (await d.api('GET', `/tasks/${own.task.id}`)).task;
    const req = await d.waitFor('the JSM request for Dana\'s task', async () => opened()[`${own.task.id}.task.line1`]?.key, 40000);
    stub.approve(req, 'acct-dana');
    const refused = await d.waitFor('the box to refuse Dana\'s JSM approval', async () =>
      (await d.api('GET', `/tasks/${own.task.id}`)).events.find((e: any) => e.type === 'note' && e.data?.action === 'jsm.refused'), 40000);
    const still = (await d.api('GET', `/tasks/${own.task.id}`)).approvals[0];
    d.check(ownTask.requestedBy === 'jira-dana' && /asked for this/.test(refused.data.why) && still.state === 'pending',
      `Business: Dana started the task from Jira, so her approval in ${req} was refused ("${refused.data.why}") and it still waits`);
    await d.api('POST', `/tasks/${own.task.id}/undo`);
  } finally {
    await d.api('PATCH', '/settings', { paused: false }).catch(() => {});
    for (const id of ['jira-dana', 'jira-lee', 'jira-ada']) await d.api('DELETE', `/people/${id}`).catch(() => {});
    await d.api('PUT', '/business', { on: false });
    fs.rmSync(path.join(d.home, 'jira', 'people.json'), { force: true });
  }
}

type Stub = Awaited<ReturnType<typeof stubJira>>;

/** A stand-in for the few Jira Cloud REST calls the box makes, keeping issues in memory. */
async function stubJira() {
  type Issue = { key: string; fields: Record<string, any>; props: Record<string, unknown>; comments: { body: unknown }[]; approval?: string };
  const issues = new Map<string, Issue>();
  const pages: { id: string; spaceId: string; title: string; body: string; version: number }[] = [];
  const spaces: { id: string; key: string }[] = [];
  const newKey = (project: string) => `${project}-${[...issues.keys()].filter((k) => k.startsWith(project + '-')).length + 1}`;
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
      const key = newKey(b.fields.project?.key ?? 'BOX');
      issues.set(key, { key, fields: { labels: [], ...b.fields, status: { name: 'To Do' } }, props: {}, comments: [] });
      return send(201, { key });
    }
    // Jira Service Management: a request whose approval waits until the test approves it. Like the real site, an
    // automation fills Approvers right after it is created.
    if (req.method === 'POST' && p === '/rest/servicedeskapi/request') {
      const key = newKey('SEC');
      issues.set(key, { key, fields: { labels: [], summary: b.requestFieldValues.summary, customfield_10003: [{ accountId: 'bot' }], status: { name: 'Waiting for approval' } }, props: {}, comments: [], approval: 'pending' });
      return send(201, { issueKey: key });
    }
    if (req.method === 'GET' && p === '/rest/api/3/myself') return send(200, { accountId: 'acct-approver' });
    if (req.method === 'GET' && p === '/rest/api/3/user') {
      const id = new URL(req.url!, 'http://x').searchParams.get('accountId');
      const known: Record<string, string> = { 'acct-user': 'Jira user', 'acct-approver': 'Approver', 'acct-dana': 'Dana Whitfield', 'acct-lee': 'Lee Park', 'acct-ada': 'Ada Brennan', 'acct-nobody': 'Nobody Linked' };
      return id && known[id] ? send(200, { accountId: id, displayName: known[id] }) : send(404, {});
    }
    const sd = p.match(/^\/rest\/servicedeskapi\/request\/([\w-]+)\/(approval|comment)$/);
    if (sd) {
      const i = issues.get(sd[1]);
      if (!i) return send(404, {});
      if (sd[2] === 'comment') return (i.comments.push({ body: b.body }), send(201, {}));
      const by = i.approval;
      return send(200, { values: [{ id: '1', finalDecision: by === 'pending' ? 'pending' : 'approved', approvers: by === 'pending' ? [] : [{ approver: { accountId: by, displayName: by }, approverDecision: 'approved' }] }] });
    }
    // Confluence: spaces and pages, enough for the reports.
    if (p === '/wiki/api/v2/spaces') return send(200, { results: spaces.filter((x) => x.key === new URL(req.url!, 'http://x').searchParams.get('keys')) });
    if (req.method === 'POST' && p === '/wiki/rest/api/space') return (spaces.push({ id: String(spaces.length + 100), key: b.key }), send(200, spaces.at(-1)));
    if (req.method === 'GET' && p === '/wiki/api/v2/pages') {
      const q = new URL(req.url!, 'http://x').searchParams;
      return send(200, { results: pages.filter((x) => x.spaceId === q.get('space-id') && x.title === q.get('title')).map((x) => ({ id: x.id, version: { number: x.version } })) });
    }
    if (req.method === 'POST' && p === '/wiki/api/v2/pages') return (pages.push({ id: String(pages.length + 1), spaceId: b.spaceId, title: b.title, body: b.body.value, version: 1 }), send(200, { id: pages.at(-1)!.id }));
    const pg = p.match(/^\/wiki\/api\/v2\/pages\/(\d+)$/);
    if (pg && req.method === 'PUT') {
      const x = pages.find((y) => y.id === pg[1])!;
      Object.assign(x, { title: b.title, body: b.body.value, version: b.version.number });
      return send(200, { id: x.id });
    }
    const m = p.match(/^\/rest\/api\/3\/issue\/([\w-]+)(\/.*)?$/);
    const i = m && issues.get(m[1]);
    if (!i) return send(404, { errorMessages: ['no such issue'] });
    const rest = `${req.method} ${m[2] ?? ''}`;
    if (rest === 'GET ') return send(200, { key: i.key, fields: i.fields });
    if (rest === 'PUT ') {
      if (b.update?.labels) for (const l of b.update.labels) i.fields.labels = [...(i.fields.labels ?? []), l.add];
      return (Object.assign(i.fields, b.fields ?? {}), send(204));
    }
    if (rest.startsWith('PUT /properties/')) return ((i.props[rest.slice(16)] = b), send(200, {}));
    if (rest === 'GET /transitions') return send(200, { transitions: STATUSES.map((name, id) => ({ id: String(id), to: { name, statusCategory: { key: name === 'Done' ? 'done' : 'indeterminate' } } })) });
    if (rest === 'POST /transitions') return ((i.fields.status = { name: STATUSES[Number(b.transition.id)] }), send(204));
    if (rest === 'POST /comment') return (i.comments.push(b), send(201, {}));
    if (rest === 'GET /comment') return send(200, { comments: i.comments });
    send(404, {});
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  return {
    server,
    bodies,
    url: `http://127.0.0.1:${(server.address() as { port: number }).port}`,
    approve: (key: string, account = 'acct-approver') => void (issues.get(key)!.approval = account),
    issue: (key: string) => void issues.set(key, { key, fields: { labels: [], summary: key, status: { name: 'To Do' } }, props: {}, comments: [] }),
    comments: (key: string) => (issues.get(key)?.comments ?? []).map((c) => JSON.stringify(c.body)),
    page: (match: (title: string) => boolean) => pages.find((x) => match(x.title)),
  };
}
