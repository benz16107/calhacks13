// The Spacetime app's demo step, against this box's own SpacetimeDB on loopback (no network, no model):
//  1. Three agents claim from one work queue at once: every job goes to exactly one agent. 30 claims fired at the
//     same instant for 10 jobs: 10 distinct jobs, 20 empty answers. An agent that ends holding jobs gives them back.
//  2. Two phones on one request: each sees the other viewing it, the first answer wins in the reducer, and the
//     second phone is told who answered first. The task carries on.
//  3. GurtOS Business, on a scratch database the demo publishes and owns: a request routed to Rosa reaches only
//     Rosa's connection; Priya's and a stranger's are sent nothing, and nobody can read the private tables. A timer
//     in the database brings Priya in when Rosa hasn't answered in time, and her live client receives it then.
//     Then on this box with GurtOS Business on: Sam's task asks for $20,000, the policy routes it to Rosa, and only
//     Rosa's phone (reaching SpacetimeDB through the box with its token) is sent it. She approves in SpacetimeDB; the
//     box checks her answer with its own Business rules and logs it as hers. Priya's phone is sent nothing.
//  4. The meters SpacetimeDB keeps match the box's own task list.
// DEMO_LIVE=spacetime ./demo also turns on the Maincloud fleet view: the box reports its summary, a viewer it
// granted sees it live, a stranger sees nothing, and turning it off removes it from Maincloud.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import type { DemoKit, LogEvent, Task } from '../../core/contract.ts';
import { DbConnection } from '../../core/spacetime/bindings/index.ts';
import { DbConnection as FleetConnection } from './fleet/bindings/index.ts';

const STDB = 'http://127.0.0.1:3000';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const MODULE = new URL('../../core/spacetime', import.meta.url).pathname;
/** A fresh SpacetimeDB identity: what any phone, or a stranger who reached the port, would have. */
const identity = async (host = STDB) => (await (await fetch(`${host}/v1/identity`, { method: 'POST' })).json()) as { token: string; identity: string };

type Detail = { task: Task; events: LogEvent[] };
type Conn = DbConnection;

export default async function (d: DemoKit) {
  const health = await d.api('GET', '/health');
  if (!health.tools.includes('spacetime.claim')) {
    console.log('  skip  the Live app is off on this box');
    return;
  }
  const BOX_DB: string = health.spacetime.database;
  const open: { disconnect(): void }[] = [];
  const connect = (token: string | undefined, queries: string[], db = BOX_DB, uri = STDB) =>
    new Promise<Conn>((resolve, reject) => {
      DbConnection.builder()
        .withUri(uri)
        .withDatabaseName(db)
        .withToken(token)
        .onConnect((c) => (open.push(c), c.subscriptionBuilder().onApplied(() => resolve(c)).onError(() => reject(new Error('subscription refused'))).subscribe(queries)))
        .onConnectError((_c, e) => reject(e))
        .build();
    });
  async function sql(db: string, q: string, token: string) {
    const r = await fetch(`${STDB}/v1/database/${db}/sql`, { method: 'POST', headers: { authorization: `Bearer ${token}` }, body: q });
    if (!r.ok) throw new Error(await r.text());
    const [{ schema, rows }] = await r.json();
    return rows.map((row: unknown[]) => Object.fromEntries(schema.elements.map((e: { name: { some: string } }, i: number) => [e.name.some, row[i]]))) as Record<string, any>[];
  }
  // The box's public tables, read the way any screen on the box reads them.
  const box = await connect(undefined, ['SELECT * FROM job', 'SELECT * FROM agent', 'SELECT * FROM meter']);
  // A scratch database with the same module, published and owned by this step, to act as a box would.
  const cfg = path.join(d.home, 'spacetime-demo.toml');
  const SCRATCH = `${BOX_DB}-module`;
  const cli = (...args: string[]) => spawnSync('spacetime', ['--config-path', cfg, ...args], { encoding: 'utf8' });

  try {
    const html = await fetch(`${d.url}/t/spacetime/`).then((r) => r.text());
    const js = await fetch(`${d.url}/t/spacetime/live.js`);
    d.check(html.includes('live.js') && js.ok && (await js.text()).length > 10_000, 'the box serves the Live window and its built script');

    // ---------- 1. agents coordinate through one queue ----------
    const Q = `demo:${Date.now().toString(36)}`;
    await d.api('POST', '/t/spacetime/jobs', { queue: Q, jobs: Array.from({ length: 12 }, (_, i) => ({ title: `Check invoice ${1001 + i}`, payload: { invoice: 1001 + i } })) });
    d.workspace('spacetime', {});
    const spec = { workspace: 'spacetime', worker: 'fake', source: 'demo', tools: ['spacetime.claim', 'spacetime.finish', 'spacetime.team'] };
    // Each agent holds what it claimed for a few seconds, so all 15 claims happen while all three still hold their jobs.
    const claims = [...Array(5).fill(`call spacetime.claim {"queue":"${Q}"}`), 'sleep 4'].join('\n');
    const agents = await Promise.all(['Agent A', 'Agent B', 'Agent C'].map((title) => d.api<Task>('POST', '/tasks', { ...spec, title, prompt: claims })));
    await d.settled(agents.map((t) => t.id));
    const got: { agent: string; job: string | null }[] = [];
    for (const t of agents) {
      const { events } = await d.api<Detail>('GET', `/tasks/${t.id}`);
      for (const e of events) if (e.type === 'tool.result' && e.ok) got.push({ agent: t.title, job: (e.output as { job: { id: string } | null }).job?.id ?? null });
    }
    const ids = got.flatMap((g) => (g.job ? [g.job] : []));
    const per = agents.map((t) => `${t.title} ${got.filter((g) => g.agent === t.title && g.job).length}`).join(', ');
    d.check(got.length === 15 && ids.length === 12 && new Set(ids).size === 12, `three agents made 15 claims on one queue of 12 jobs at once: 12 distinct jobs, none taken twice, 3 told it was empty (${per})`);
    const back = await d.waitFor('the jobs to go back on the queue', async () => {
      const rows = [...box.db.job.iter()].filter((j) => j.queue === Q);
      return rows.every((j) => j.state === 'open') && agents.every((t) => box.db.agent.task.find(t.id)?.status === 'gone') ? rows : undefined;
    });
    d.check(back.length === 12, 'when the agents ended holding jobs they never finished, SpacetimeDB put all 12 back on the queue and marked the agents gone');
    const first = [...back].sort((a, b) => Number(a.id - b.id))[0];
    const closer = await d.api<Task>('POST', '/tasks', { ...spec, title: 'Agent D', prompt: `call spacetime.claim {"queue":"${Q}"}\ncall spacetime.finish {"id":"${first.id}","result":"Invoice 1001 matches the order"}\ncall spacetime.team {"queue":"${Q}"}` });
    await d.settled([closer.id]);
    const { events: dEvents } = await d.api<Detail>('GET', `/tasks/${closer.id}`);
    const team = (dEvents.findLast((e) => e.type === 'tool.result') as Extract<LogEvent, { type: 'tool.result' }>).output as { done: number; open: number };
    d.check(box.db.job.id.find(first.id)?.state === 'done' && team.done === 1 && team.open === 11, `a fourth agent claimed the oldest job, finished it, and saw the team: ${team.done} done, ${team.open} open`);

    // The same race with nothing in between, on a scratch copy of the module: 30 claims at one instant for 10 jobs.
    cli('login', '--server-issued-login', 'local');
    const pub = cli('publish', '--server', 'local', '--module-path', MODULE, '-y', SCRATCH);
    if (pub.status !== 0) throw new Error(`publishing the scratch database: ${pub.stderr}`);
    const owner = await connect(fs.readFileSync(cfg, 'utf8').match(/spacetimedb_token\s*=\s*"([^"]+)"/)![1], ['SELECT * FROM job'], SCRATCH);
    await owner.reducers.postJobs({ queue: 'race', jobs: Array.from({ length: 10 }, (_, i) => ({ title: `Job ${i + 1}`, payload: '' })) });
    const raced = await Promise.all(Array.from({ length: 30 }, (_, i) => owner.procedures.claimJob({ queue: 'race', agent: `racer-${i}`, name: `Racer ${i}`, key: '' })));
    const won = raced.filter(Boolean).map((j) => String(j!.id));
    d.check(won.length === 10 && new Set(won).size === 10, `30 claims fired at once for 10 jobs: 10 distinct jobs, 20 empty answers, no job twice`);

    // ---------- 2. two phones, one request: presence and the first answer wins ----------
    // Two paired phones, each with its own SpacetimeDB identity, on loopback: SpacetimeDB is not opened to phones
    // (they use the box's authed API); this shows what the database does for any connection that does reach it.
    const phones = [];
    for (const name of ["Rosa's phone", "Priya's phone"]) {
      const { code } = await d.api<{ code: string }>('POST', '/pair/start');
      const { token } = await d.api<{ token: string }>('POST', '/pair', { code, name });
      const id = await identity();
      const c = await connect(id.token, ['SELECT * FROM approval', 'SELECT * FROM viewers']);
      const r = await fetch(`${d.url}/api/pair/identity`, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify({ identity: c.identity!.toHexString() }) });
      if (!r.ok) throw new Error(`pairing ${name}'s identity: ${r.status} ${await r.text()}`);
      phones.push({ name, c, token });
    }
    const outside = await fetch(`${d.url}/stdb/${phones[0].token}/v1/identity`, { method: 'POST' });
    const leaked = outside.ok && (outside.headers.get('content-type') ?? '').includes('json') && !!(await outside.json().catch(() => ({}))).token;
    d.check(!leaked, "SpacetimeDB is not opened to phones: the box's address does not pass it through");
    const [rosa, priya] = phones;
    const W = await d.api<Task>('POST', '/tasks', { ...spec, tools: [], title: 'Ship order 4471', prompt: 'ask Ship order 4471 to Northwind today?\nwrite shipped.txt yes' });
    const ask = await d.waitFor('the request to reach both phones', async () => {
      const a = [...rosa.c.db.approval.iter()].find((x) => x.task === W.id && x.state === 'pending');
      return a && priya.c.db.approval.id.find(a.id) ? a : undefined;
    });
    await sleep(300); // the box vouches for each phone's identity in the background
    await rosa.c.reducers.look({ id: ask.id });
    const seen = await d.waitFor("Rosa's viewing to reach Priya's phone", async () => [...priya.c.db.viewers.iter()].find((v) => v.id === ask.id));
    d.check(seen.name === "Rosa's phone", `Priya's phone shows "${seen.name} is viewing" the request, live`);
    const answers = await Promise.allSettled([rosa.c.reducers.answer({ id: ask.id, approved: true, by: 'ignored' }), priya.c.reducers.answer({ id: ask.id, approved: true, by: 'ignored' })]);
    const winner = answers[0].status === 'fulfilled' ? rosa : priya;
    const lost = answers.find((a) => a.status === 'rejected') as PromiseRejectedResult | undefined;
    d.check(answers.filter((a) => a.status === 'fulfilled').length === 1 && String(lost?.reason?.message ?? lost?.reason).includes(`already approved by ${winner.name}`), `both phones approved at the same instant: one answer won in the reducer, the other was told "${lost?.reason?.message ?? lost?.reason}"`);
    const [shipped] = await d.settled([W.id]);
    const { events: wEvents } = await d.api<Detail>('GET', `/tasks/${W.id}`);
    const answered = wEvents.filter((e) => e.type === 'approval.answered');
    d.check(answered.length === 1 && (answered[0] as { by: string }).by === winner.name && shipped.state === 'done' && shipped.step === 'write shipped.txt yes', `the box logged one answer, by ${winner.name}, and the task carried on to done`);
    rosa.c.disconnect();
    await d.waitFor("Rosa's viewing to clear when she disconnects", async () => ([...priya.c.db.viewers.iter()].some((v) => v.id === ask.id) ? undefined : true));
    priya.c.disconnect();

    // ---------- 3. Business: each person is sent only their own requests; a timer in the database ----------
    const [rosaId, priyaId, stranger] = await Promise.all([identity(), identity(), identity()]);
    const persons = { rosa: await connect(rosaId.token, ['SELECT * FROM my_requests'], SCRATCH), priya: await connect(priyaId.token, ['SELECT * FROM my_requests'], SCRATCH) };
    await owner.reducers.registerPerson({ identity: persons.rosa.identity!, person: 'rosa', name: 'Rosa Delgado', at: new Date().toISOString() });
    await owner.reducers.registerPerson({ identity: persons.priya.identity!, person: 'priya', name: 'Priya Shah', at: new Date().toISOString() });
    const rid = `demo-${Date.now().toString(36)}.credit`;
    const asked = Date.now();
    await owner.reducers.putRequest({
      id: rid, task: 'demo', question: 'Approve a $20,000 credit line for Northwind Traders?', costCents: 0, payee: 'Northwind Traders', purpose: 'trade credit',
      state: 'pending', by: '', person: '', askedBy: 'sam', rule: 'Over $10,000 goes to the Controller.', to: 'the Controller', why: 'Over $10,000 goes to the Controller. Rosa Delgado can approve it.',
      people: [{ person: 'rosa', name: 'Rosa Delgado', canApprove: true }], remind: [{ person: 'priya', name: 'Priya Shah', canApprove: true }], remindAfterSec: 3, reopen: false,
    });
    await d.waitFor("the request to reach Rosa's client", async () => [...persons.rosa.db.myRequests.iter()].find((r) => r.id === rid));
    const priyaNow = [...persons.priya.db.myRequests.iter()].filter((r) => r.id === rid).length;
    const strangerSees = (await sql(SCRATCH, 'SELECT * FROM my_requests', stranger.token)).length;
    const privateRead = await sql(SCRATCH, 'SELECT * FROM request', rosaId.token).then(() => 'read', (e: Error) => e.message);
    d.check(priyaNow === 0 && strangerSees === 0 && /private|no such table/i.test(privateRead), "routed to Rosa, the request reached Rosa's client only: Priya's live client and a stranger were sent nothing, and the request table itself is private");
    const reminded = await d.waitFor("the database's timer to bring Priya in", async () => [...persons.priya.db.myRequests.iter()].find((r) => r.id === rid), 8000);
    const after = (Date.now() - asked) / 1000;
    d.check(reminded.remindedMe && reminded.reminded === 'Priya Shah' && after >= 2.5, `Rosa had not answered after 3 seconds, so a scheduled reducer brought Priya in: her client received it at ${after.toFixed(1)} s, marked as a reminder`);
    const race = await Promise.allSettled([persons.priya.reducers.answerRequest({ id: rid, approved: false }), persons.rosa.reducers.answerRequest({ id: rid, approved: true })]);
    const loser = race.find((a) => a.status === 'rejected') as PromiseRejectedResult | undefined;
    d.check(race.filter((a) => a.status === 'fulfilled').length === 1 && /^already (approved|denied) by (Rosa Delgado|Priya Shah)$/.test(String(loser?.reason?.message ?? loser?.reason)), `Rosa and Priya answered at once: the first answer stands, the other got "${loser?.reason?.message ?? loser?.reason}"`);

    // ---------- 3b. the same on this box, end to end through GurtOS Business ----------
    await business(d, connect, sql, BOX_DB);

    // ---------- 4. the meters ----------
    const tasks = await d.api<Task[]>('GET', '/tasks');
    const m = box.db.meter.id.find(0)!;
    const count = (s: string) => tasks.filter((t) => t.state === s).length;
    d.check(m.done === count('done') && m.running === count('running') && m.waiting === count('waiting') && Number(m.spentCents) === Math.round(tasks.reduce((s, t) => s + t.costCents, 0)), `SpacetimeDB's live meter matches the box: ${m.done} done, ${m.running} running, ${m.waiting} waiting, $${(Number(m.spentCents) / 100).toFixed(2)} spent`);

    if ((process.env.DEMO_LIVE ?? '').split(/[\s,]+/).includes('spacetime')) await fleet(d);
    else console.log('  skip  the Maincloud fleet view (it talks to maincloud.spacetimedb.com): DEMO_LIVE=spacetime ./demo runs it');
  } finally {
    for (const c of open) c.disconnect();
    cli('delete', '--server', 'local', '-y', SCRATCH);
  }
}

/** GurtOS Business on this box: a routed request reaches only its person's live client, and her answer counts. */
async function business(d: DemoKit, connect: (token: string | undefined, q: string[], db?: string, uri?: string) => Promise<Conn>, sql: (db: string, q: string, token: string) => Promise<Record<string, any>[]>, DB: string) {
  const phone = (token: string) => async <T = any>(method: string, p: string, body?: unknown): Promise<T> => {
    const r = await fetch(`${d.url}${p}`, { method, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    if (!r.ok) throw new Error(`${method} ${p}: ${r.status} ${await r.text()}`);
    return r.json() as Promise<T>;
  };
  const added: string[] = [];
  await d.api('PUT', '/api/business', { on: true, company: 'Fogline Supply', policy: 'Requests over $10,000 go to the Controller for approval.\nEverything else goes to any approver.' });
  try {
    // Their own ids, removed at the end, so the Business step's own people and counts are untouched.
    const people = [
      { id: 'rosa-live', name: 'Rosa Delgado', role: 'approver', title: 'Controller', limitCents: 5_000_000, approvesFor: ['Controller'] },
      { id: 'priya-live', name: 'Priya Nair', role: 'approver', title: 'Operations', limitCents: 500_000, approvesFor: ['Operations'] },
      { id: 'sam-live', name: 'Sam Chen', role: 'requester', title: 'Sales', limitCents: null, approvesFor: [] },
    ];
    added.push(...people.map((p) => p.id));
    const live: Record<string, Conn> = {};
    const call: Record<string, ReturnType<typeof phone>> = {};
    for (const p of people) {
      await d.api('POST', '/api/people', p);
      const { code } = await d.api<{ code: string }>('POST', `/api/people/${p.id}/pair`);
      const { token } = await d.api<{ token: string }>('POST', '/pair', { code, name: `${p.name.split(' ')[0]}'s phone` });
      call[p.id] = phone(token);
      if (p.id === 'sam-live') continue;
      const id = await identity();
      live[p.id] = await connect(id.token, ['SELECT * FROM my_requests'], DB);
      await call[p.id]('POST', '/api/pair/identity', { identity: live[p.id].identity!.toHexString() });
    }
    const T = await call['sam-live']<Task>('POST', '/api/tasks', { title: 'Open a credit line for Northwind', workspace: 'spacetime', worker: 'fake', prompt: 'ask Approve a $20,000 credit line for Northwind Traders?\nwrite northwind.txt approved' });
    const mine = await d.waitFor("Sam's request to reach Rosa's phone", async () => [...live['rosa-live'].db.myRequests.iter()].find((r) => r.task === T.id && r.state === 'pending'));
    await sleep(500); // anything else would have arrived by now
    const priyaGot = [...live['priya-live'].db.myRequests.iter()].filter((r) => r.task === T.id).length;
    const publicRow = (await sql(DB, `SELECT * FROM approval WHERE task = '${T.id}'`, (await identity()).token)).length;
    d.check(mine.askedBy === 'sam-live' && mine.to === 'the Controller' && mine.canApprove && priyaGot === 0 && publicRow === 1, `Sam's $20,000 request was routed to the Controller: Rosa's client was sent it, Priya's was sent nothing ("${mine.why}"); the box's screens still read the public approval table (${publicRow} row)`);
    const priyaTry = await live['priya-live'].reducers.answerRequest({ id: mine.id, approved: true }).then(() => 'answered', (e: Error) => e.message ?? String(e));
    await live['rosa-live'].reducers.answerRequest({ id: mine.id, approved: true });
    const [done] = await d.settled([T.id]);
    const { events } = await d.api<Detail>('GET', `/tasks/${T.id}`);
    const answer = events.find((e) => e.type === 'approval.answered') as { by: string; person?: string } | undefined;
    d.check(/not routed to you/.test(priyaTry) && answer?.by === 'Rosa Delgado' && answer.person === 'rosa-live' && done.state === 'done', `Priya's answer was refused ("${priyaTry}"); Rosa approved in SpacetimeDB, the box checked it with its Business rules and logged it as hers, and the task finished`);
  } finally {
    for (const id of added) await d.api('DELETE', `/api/people/${id}`).catch(() => {});
    await d.api('PUT', '/api/business', { on: false });
  }
}

/** The Maincloud fleet view: opt in, report, a granted viewer sees the box live, a stranger sees nothing, opt out. */
async function fleet(d: DemoKit) {
  const status = await d.api('PUT', '/t/spacetime/fleet', { on: true });
  const on = await d.waitFor('the box to connect to Maincloud', async () => {
    const s = await d.api('GET', '/t/spacetime/fleet');
    return s.connected && s.lastReport ? s : undefined;
  }, 30_000);
  d.check(on.connected, `the owner turned the fleet view on: the box reports to ${status.database} on Maincloud as ${String(on.identity).slice(0, 12)}...`);
  const host = on.host as string;
  const viewers: { disconnect(): void }[] = [];
  const watch = (token: string) =>
    new Promise<FleetConnection>((resolve, reject) =>
      FleetConnection.builder().withUri(host).withDatabaseName(on.database).withToken(token)
        .onConnect((c) => (viewers.push(c), c.subscriptionBuilder().onApplied(() => resolve(c)).subscribe(['SELECT * FROM my_machines'])))
        .onConnectError((_c, e) => reject(e)).build(),
    );
  try {
    const [mine, theirs] = await Promise.all([identity(host), identity(host)]);
    await d.api('POST', '/t/spacetime/fleet/viewers', { identity: mine.identity, label: "Ben's phone" });
    const [me, stranger] = await Promise.all([watch(mine.token), watch(theirs.token)]);
    const W = await d.api<Task>('POST', '/tasks', { title: 'Wait for an OK', workspace: 'spacetime', worker: 'fake', source: 'demo', prompt: 'ask Keep going?' });
    const row = await d.waitFor('the waiting task to show on Maincloud', async () => [...me.db.myMachines.iter()].find((m) => m.waiting >= 1), 20_000);
    d.check(row.online && row.name.length > 0 && [...stranger.db.myMachines.iter()].length === 0, `a viewer the box granted sees "${row.name}" live on Maincloud (online, ${row.waiting} waiting, ${row.doneToday} done today); a stranger's identity is sent nothing`);
    const ask = await d.waitFor('the approval', async () => (await d.api<any[]>('GET', '/approvals?state=pending')).find((a) => a.task === W.id));
    await d.api('POST', `/approvals/${ask.id}`, { approved: false, by: 'demo' });
    await d.api('PUT', '/t/spacetime/fleet', { on: false });
    await d.waitFor('Maincloud to forget the box', async () => ([...me.db.myMachines.iter()].length === 0 ? true : undefined), 15_000);
    d.check(true, 'turned off, the box left Maincloud: its row and every grant are gone');
  } finally {
    for (const c of viewers) c.disconnect();
  }
}
