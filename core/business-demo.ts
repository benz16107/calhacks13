// GurtOS Business in ./demo. Fogline Supply Co. shares one box: Sam in sales asks for work, two agent seats (a credit
// analyst and a collections clerk) do it, and the policy sends what they ask to Rosa, the controller, on her own phone.
// Offline: the seats are the scripted worker, so no model or sponsor API is called. It proves the rules: nobody
// approves their own request, nobody approves above their limit, only the controller clears a fraud referral, no
// agent approves, an auditor only reads, every event names who asked, which seat and who approved, the kill switch
// stops every agent, and a seat in shadow mode only suggests until the policy says it may go live. It turns Business
// on for its own steps and off again, so no other step sees it.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import type { Approval, DemoKit, LogEvent, Task } from './contract.ts';

// The rules and people from the approved designs (docs/figma/business/).
export const POLICY = `# Fogline Supply: who approves what. A ceiling applies first; then the first rule that matches decides.
Fraud referrals go to the fraud reviewer for approval.
Requests over $50,000 can't be approved in GurtOS.
Requests over $10,000 go to the Controller for approval.
Production goes to IT for approval.
Everything else goes to any approver.`;

export const PEOPLE = [
  { id: 'rosa', name: 'Rosa Delgado', role: 'approver', title: 'Controller', limitCents: 5_000_000, approvesFor: ['Controller', 'Fraud reviewer'] },
  { id: 'sam', name: 'Sam Chen', role: 'requester', title: 'Sales' },
  { id: 'priya', name: 'Priya Nair', role: 'admin', title: 'IT admin', approvesFor: ['IT'] },
  { id: 'owen', name: 'Owen Clarke', role: 'auditor', title: 'Auditor' },
];

export const SEATS = [
  { name: 'Credit analyst', about: 'checks new customers through CRS', may: 'Up to $10,000; above, proposes' },
  { name: 'Collections clerk', about: 'works the ledger against the bank', may: "Can't change limits or terms" },
];

type Res = { status: number; body: any; text: string; type: string };
type Caller = (method: string, p: string, body?: unknown) => Promise<Res>;
const RELAYED = { 'x-forwarded-for': '203.0.113.9' }; // what a phone's request through a proxy looks like: not the box's screen
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default async function (d: DemoKit) {
  // Read the port now: the box may have restarted (pull the plug) since the kit was made.
  const base = () => `http://127.0.0.1:${fs.readFileSync(path.join(d.home, 'api.port'), 'utf8').trim()}`;
  const send = async (headers: Record<string, string>, method: string, p: string, body?: unknown): Promise<Res> => {
    const r = await fetch(base() + p, { method, headers: { 'content-type': 'application/json', ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
    const text = await r.text();
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {} // the CSV export is not JSON
    return { status: r.status, body: json, text, type: r.headers.get('content-type') ?? '' };
  };
  const screen: Caller = (m, p, b) => send({}, m, p, b); // the box's own screen: the owner
  try {
    await steps(d, send, screen);
  } finally {
    await screen('POST', '/api/resume');
    await screen('PUT', '/api/business', { on: false });
  }
}

async function steps(d: DemoKit, send: (h: Record<string, string>, m: string, p: string, b?: unknown) => Promise<Res>, screen: Caller) {
  const ok = (r: Res, what: string) => {
    if (r.status !== 200) throw new Error(`${what}: HTTP ${r.status} ${r.text.slice(0, 200)}`);
    return r.body;
  };

  // ---------- people and roles ----------
  ok(await screen('PUT', '/api/business', { on: true, company: 'Fogline Supply', policy: POLICY, seats: SEATS }), 'turn Business on');
  const sys = ok(await screen('GET', '/api/system'), 'system');
  d.check(sys.edition === 'business' && sys.editionName === 'GurtOS Business' && sys.company === 'Fogline Supply', 'the owner turns GurtOS Business on for Fogline Supply from the box\'s screen, with its rules and two agent seats');
  for (const p of PEOPLE) ok(await screen('POST', '/api/people', p), `add ${p.name}`);
  const phones: Record<string, Caller> = {};
  for (const p of PEOPLE) {
    const { code } = ok(await screen('POST', `/api/people/${p.id}/pair`), `a pairing code for ${p.name}`);
    const { token, device } = ok(await send(RELAYED, 'POST', '/api/pair', { code }), `pair ${p.name}'s phone`);
    if (device.person !== p.id) throw new Error(`${p.name}'s phone paired as ${device.person}`);
    phones[p.id] = (m, path, b) => send({ authorization: `Bearer ${token}`, ...RELAYED }, m, path, b);
  }
  const { rosa, sam, priya, owen } = phones;
  d.check(ok(await priya('GET', '/api/people'), 'people').length === 4, 'four people with roles, each phone paired as its person: Rosa Delgado (Controller, approves up to $50,000), Sam Chen (Sales, requester), Priya Nair (IT admin), Owen Clarke (auditor)');
  const samPeople = await sam('GET', '/api/people');
  const samPolicy = await sam('PUT', '/api/business', { policy: 'Everything goes to Sam.' });
  d.check(samPeople.status === 403 && samPolicy.status === 403, 'only an admin or the owner sees and changes people and the policy: Sam gets 403 for both');

  // ---------- Sam asks; the seats work; the policy routes what they ask ----------
  d.workspace('fogline-business', { 'README.md': 'Fogline Supply Co., credit and collections' });
  const start = async (who: Caller, seat: string, title: string, prompt: string, more: object = {}): Promise<Task> =>
    ok(await who('POST', '/api/tasks', { title, seat, prompt, worker: 'fake', workspace: 'fogline-business', ...more }), `start ${title}`);
  const big = await start(sam, 'Credit analyst', 'Credit analyst: APP-1042', "say CRS: guarantor credit 790, band A; identity verified; Fraud Finder no reasons\nask Credit desk [APP-1042 approve 40000]: approve Bright Harbor Catering Inc. (APP-1042) for $40,000, Net 30, band A? Proposed by the credit analyst; above the analyst's $10,000 authority. Rules: BND-A, LIM-1.\nwrite APP-1042.txt approved, $40,000 Net 30");
  const fraud = await start(sam, 'Credit analyst', 'Credit analyst: APP-1043', 'ask Credit desk: fraud referral. Put Pacific Crest Provisions LLC (APP-1043) on fraud hold, no credit? Its owner fails identity (2201, 2202) and Fraud Finder scores it 88. A simple rule would approve $20,000.\nwrite APP-1043.txt fraud hold, cash in advance');
  const huge = await start(sam, 'Credit analyst', 'Credit analyst: APP-1047', 'ask Credit desk: approve Bayview Grocers (APP-1047) for $75,000, Net 30?');
  const small = await start(sam, 'Collections clerk', 'Collections clerk: INV-24102', 'ask Collections: write off the last $2,400 on INV-24102 for Mission St. Taqueria?\nwrite INV-24102.txt written off');
  const own = await start(rosa, 'Credit analyst', 'Credit analyst: APP-1048', 'ask Credit desk: approve Tamarind Kitchen (APP-1048) for $12,000, Net 30?');
  const asked = await d.waitFor('five requests', async () => {
    const all = ok(await screen('GET', '/api/approvals?state=pending'), 'approvals') as Approval[];
    const mine = [big, fraud, huge, small, own].map((t) => all.find((a) => a.task === t.id));
    return mine.every(Boolean) ? (mine as Approval[]) : undefined;
  });
  const [aBig, aFraud, aHuge, aSmall, aOwn] = asked;
  const to = (a: Approval) => a.route!.people.map((p) => p.id).join(',');
  d.check(aBig.askedBy === 'sam' && aBig.route?.rule === 'Requests over $10,000 go to the Controller for approval.' && to(aBig) === 'rosa', `the analyst's $40,000 approval is routed by the policy: "${aBig.route?.why}"`);
  d.check(aFraud.route?.rule === 'Fraud referrals go to the fraud reviewer for approval.' && to(aFraud) === 'rosa', `the fraud referral: "${aFraud.route?.why}"`);
  d.check(aSmall.route?.to === 'any approver' && to(aSmall) === 'rosa', `the clerk's $2,400 write-off: "${aSmall.route?.why}"`);
  d.check(to(aHuge) === '' && aHuge.route?.rule === "Requests over $50,000 can't be approved in GurtOS.", `$75,000: "${aHuge.route?.why}"`);
  d.check(to(aOwn) === '' && aOwn.askedBy === 'rosa', `Rosa's own $12,000 request: "${aOwn.route?.why}"`);

  // ---------- Waiting for me ----------
  const me = async (who: Caller) => ok(await who('GET', '/api/me'), 'me');
  const ids = (list: Approval[]) => list.map((a) => a.id).sort().join(' ');
  const [mRosa, mSam, mPriya] = [await me(rosa), await me(sam), await me(priya)];
  const forMe = ok(await rosa('GET', '/api/approvals?for=me'), 'for=me');
  // Other steps' requests may also be on the box; these five are the ones that matter here.
  const has = (list: Approval[], a: Approval) => list.some((x) => x.id === a.id);
  d.check([aBig, aFraud, aSmall].every((a) => has(mRosa.waiting, a)) && ![aHuge, aOwn].some((a) => has(mRosa.waiting, a)) && ids(forMe) === ids(mRosa.waiting),
    "Waiting for me, on Rosa's phone: the $40,000 approval, the fraud referral and the $2,400 write-off, and not the $75,000 one or her own");
  d.check(mSam.waiting.length === 0 && mSam.requests.length === 4 && mSam.requests.every((a: Approval) => a.route?.why), "Sam is sent no approvals; he sees his own four requests and who each waits for");
  d.check(mPriya.waiting.length === 0, 'Priya (IT admin) is sent none of them');
  d.check(mRosa.stuck?.some((a: Approval) => a.id === aHuge.id) && !mSam.stuck?.length, "the $75,000 one nobody can approve is on Rosa's list under \"Nobody can approve these\", for her to deny");
  const warned = ok(await priya('PUT', '/api/business', { policy: `${POLICY}\nRefunds go to Treasury.` }), 'warn');
  ok(await priya('PUT', '/api/business', { policy: POLICY }), 'restore');
  d.check(warned.warnings?.some((w: string) => w.startsWith('Nobody approves for Treasury')), `a rule to a name nobody approves for saves with a warning: "${warned.warnings?.[0]}"`);

  // ---------- the rules ----------
  const answer = (who: Caller, a: Approval, approved = true) => who('POST', `/api/approvals/${encodeURIComponent(a.id)}`, { approved, by: 'phone' });
  const self = await answer(sam, aBig);
  d.check(self.status === 403 && /You asked for this/.test(self.body.error), `self-approval refused: Sam approving his own request gets "${self.body.error}"`);
  const selfRosa = await answer(rosa, aOwn);
  d.check(selfRosa.status === 403 && /You asked for this/.test(selfRosa.body.error), 'self-approval refused for an approver too: Rosa cannot approve her own $12,000 request');
  const over = await answer(rosa, aHuge);
  d.check(over.status === 403 && /above your \$50,000 limit/.test(over.body.error), `over-limit refused: Rosa approving $75,000 gets "${over.body.error}"`);
  const notHers = await answer(priya, aFraud);
  d.check(notHers.status === 403 && /goes to the fraud reviewer/.test(notHers.body.error), `only Rosa clears a fraud referral: Priya, an admin, gets "${notHers.body.error}"`);
  const auditorAnswer = await answer(owen, aBig);
  const auditorTask = await owen('POST', '/api/tasks', { title: 'x', prompt: 'write x.txt x', worker: 'fake' });
  const auditorReads = await owen('GET', '/api/audit');
  d.check(auditorAnswer.status === 403 && auditorTask.status === 403 && auditorReads.status === 200, 'the auditor reads the audit and can change nothing: answering and starting a task are refused');

  // An agent on the box answering: a helper service (it runs as nobody, like the ASI:One agent) that says it is Rosa.
  const port = fs.readFileSync(path.join(d.home, 'api.port'), 'utf8').trim();
  const py = `import json,urllib.request as u
r=u.Request('http://127.0.0.1:${port}/api/approvals/${encodeURIComponent(aBig.id)}',data=b'{"approved":true,"by":"helper agent"}',headers={'content-type':'application/json','x-box-person':'rosa'},method='POST')
try: print(u.urlopen(r).status)
except Exception as e: print(e.code, json.loads(e.read())['error'])`;
  const agent = spawnSync('runuser', ['-u', 'nobody', '--', 'python3', '-c', py], { encoding: 'utf8' });
  d.check(/^403 Only a person can answer/.test(agent.stdout), `agent approving agent refused: a helper agent on the box answering as "rosa" gets "${agent.stdout.trim().slice(4)}"`);
  const unsigned = await screen('POST', `/api/approvals/${encodeURIComponent(aBig.id)}`, { approved: true, by: 'box screen' });
  d.check(unsigned.status === 403, 'the box\'s screen answers only once it says which person is answering');
  const still = ok(await screen('GET', '/api/approvals?state=pending'), 'approvals') as Approval[];
  d.check(asked.every((a) => still.some((s) => s.id === a.id)), 'after seven refused answers, all five requests are still waiting');

  // ---------- Rosa answers from her phone ----------
  for (const a of [aBig, aFraud, aSmall]) {
    const r = ok(await answer(rosa, a), `Rosa approves ${a.id}`);
    if (r.state !== 'approved' || r.by !== 'Rosa Delgado' || r.person !== 'rosa' || r.via !== "Rosa Delgado's phone") throw new Error(`${a.id} is ${r.state} by ${r.by} on ${r.via}`);
  }
  await d.settled([big.id, fraud.id, small.id]);
  d.check(d.view('fogline-business', 'APP-1043.txt') === 'fraud hold, cash in advance', 'Rosa approves the three sent to her, from her phone; the seats carry on and finish');

  // ---------- the audit ----------
  const { events } = ok(await screen('GET', `/api/tasks/${big.id}`), 'task') as { events: LogEvent[] };
  const yes = events.find((e) => e.type === 'approval.answered')!;
  d.check(events.every((e) => e.who?.asked === 'sam' && e.who.seat === 'Credit analyst') && yes.who?.approver === 'rosa' && events.filter((e) => e.seq > yes.seq).every((e) => e.who?.approver === 'rosa'),
    `every one of the $40,000 task's ${events.length} events carries who asked (sam) and its seat (Credit analyst), and from the approval on, who approved (rosa)`);
  const byRosa = ok(await owen('GET', '/api/audit?person=rosa'), 'audit by person') as { event: string; what: string; task: string }[];
  const approvedRows = byRosa.filter((r) => r.event === 'approval.answered').map((r) => r.task);
  const refusedRows = byRosa.filter((r) => r.what.includes('"refused"'));
  d.check([big.id, fraud.id, small.id].every((t) => approvedRows.includes(t)) && refusedRows.length === 2, `the auditor filters by person: Rosa's ${approvedRows.length} approvals and her ${refusedRows.length} refused attempts (her own request, and $75,000)`);
  const clerk = ok(await owen('GET', `/api/audit?seat=${encodeURIComponent('Collections clerk')}`), 'audit by seat') as { task: string; seat: string }[];
  const today = new Date().toISOString().slice(0, 10);
  const none = ok(await owen('GET', '/api/audit?from=2099-01-01'), 'audit by date');
  d.check(clerk.some((r) => r.task === small.id) && clerk.every((r) => r.seat === 'Collections clerk') && none.length === 0, 'and by seat (only collections clerk work, the credit desk\'s own clerk included) and by date');
  const csv = await owen('GET', `/api/audit.csv?person=sam&from=${today}&to=${today}`);
  const lines = csv.text.trim().split('\r\n');
  d.check(csv.status === 200 && csv.type.startsWith('text/csv') && lines[0] === 'seq,at,event,task,title,app,seat,asked,approver,by,what' && lines.slice(1).every((l) => l.includes('Sam Chen')), `the audit exports to CSV: ${lines.length - 1} rows of Sam's requests, each naming him`);

  // ---------- the kill switch ----------
  const pausedBySam = await sam('POST', '/api/pause');
  d.check(pausedBySam.status === 403, 'Sam cannot pull the kill switch');
  const loop = Array.from({ length: 8 }, (_, i) => `sleep 0.4\nwrite tick-${i}.txt ${i}`).join('\n');
  const k1 = await start(sam, 'Credit analyst', 'Credit analyst: review C-1002', loop.replaceAll('tick', 'c1002'));
  const k2 = await start(sam, 'Collections clerk', 'Collections clerk: aging run', loop.replaceAll('tick', 'aging'));
  const stepsOf = async (t: Task) => (ok(await screen('GET', `/api/tasks/${t.id}`), 'task').events as LogEvent[]).filter((e) => e.type === 'task.step').length;
  await d.waitFor('both seats at work', async () => (await stepsOf(k1)) >= 2 && (await stepsOf(k2)) >= 2);
  const seq0 = (ok(await owen('GET', '/api/log'), 'log') as LogEvent[]).at(-1)!.seq; // earlier steps pull the same switch from Settings
  const t0 = performance.now();
  const paused = { ...ok(await priya('POST', '/api/pause'), 'pause'), seq0 };
  const stopMs = Math.round(performance.now() - t0);
  await sleep(300); // a step already on its way when the switch was pulled still lands
  const before = [await stepsOf(k1), await stepsOf(k2)];
  const k3 = await start(sam, 'Credit analyst', 'Credit analyst: APP-1049', 'write APP-1049.txt queued');
  await sleep(2000);
  const after = [await stepsOf(k1), await stepsOf(k2)];
  const freezer = spawnSync('systemctl', ['show', '-p', 'FreezerState', '--value', `box-task-${k1.id}`], { encoding: 'utf8' }).stdout.trim();
  const k3State = (ok(await screen('GET', `/api/tasks/${k3.id}`), 'task').task as Task).state;
  const seen = [ok(await rosa('GET', '/api/system'), 'system').paused, ok(await rosa('GET', '/api/me'), 'me').paused];
  d.check(paused.paused && paused.by === 'Priya Nair' && before.join() === after.join() && k3State === 'queued',
    `Priya (IT admin) pulls the kill switch: both seats stop mid-task in ${stopMs} ms (no step in 2 s; ${freezer === 'frozen' ? 'frozen by systemd' : 'stopped by signal'}), and a new task waits in the queue`);
  d.check(seen[0].paused && seen[0].by === 'Priya Nair' && seen[1]?.by === 'Priya Nair', 'every screen and phone sees it: GET /api/system and /api/me say "paused by Priya Nair"');
  ok(await priya('POST', '/api/resume'), 'resume');
  await d.settled([k1.id, k2.id, k3.id]);
  const log = ok(await owen('GET', '/api/log'), 'log') as LogEvent[];
  const switches = log.filter((e) => e.type === 'note' && e.track === 'kill-switch' && e.seq > paused.seq0);
  d.check(switches.length === 2 && switches.every((e) => e.who?.by === 'priya'), 'resumed: all three finish, and the log holds both pulls of the switch, by Priya');

  // ---------- shadow mode: a seat's decisions are suggestions a person decides, until the policy says it may go live ----------
  // The clerk's real tool (credit-desk.collections_action) needs only a rules file in its workspace, so this stays offline.
  const GO_LIVE = 'The Collections clerk goes live after 3 suggestions with 60% agreement.';
  const samShadow = await sam('PUT', '/api/business', { shadow: ['Collections clerk'] });
  ok(await priya('PUT', '/api/business', { policy: `${POLICY}\n${GO_LIVE}`, shadow: ['Collections clerk'] }), 'shadow on');
  d.workspace('fogline-shadow', { 'rules.yaml': 'authority_limit: 10000\nrules:\n  - id: COL-1\n' });
  const remind = (inv: string) =>
    start(sam, 'Collections clerk', `Collections clerk: ${inv}`, `call credit-desk.collections_action {"subject":"${inv}","action":"friendly reminder","detail":"$1,200 is 12 days past due","rules":["COL-1"]}`, { workspace: 'fogline-shadow', tools: ['credit-desk.collections_action'] });
  const sh = [await remind('INV-24110'), await remind('INV-24111'), await remind('INV-24112')];
  const sug = await d.waitFor('three shadow suggestions', async () => {
    const all = ok(await screen('GET', '/api/approvals?state=pending'), 'approvals') as Approval[];
    const mine = sh.map((t) => all.find((a) => a.task === t.id));
    return mine.every(Boolean) ? (mine as Approval[]) : undefined;
  });
  const callsOf = async (t: Task) => (ok(await screen('GET', `/api/tasks/${t.id}`), 'task').events as LogEvent[]).filter((e) => e.type === 'tool.call').length;
  d.check(samShadow.status === 403 && sug.every((a) => a.shadow === 'Collections clerk' && to(a) === 'rosa') && (await callsOf(sh[0])) === 0,
    `an admin (Priya) puts the Collections clerk in shadow; its decision becomes a suggestion, routed by the policy like any request: "${sug[0].question}" (${sug[0].route?.why})`);
  const pilotOf = async () => (ok(await screen('GET', '/api/business'), 'business').pilot as { seat: string; shadow: boolean; suggested: number; answered: number; agreed: number; percent: number; ready: boolean; disagreements: { by: string; question: string }[] }[]).find((p) => p.seat === 'Collections clerk')!;
  const samYes = await answer(sam, sug[0]);
  ok(await answer(rosa, sug[0]), 'Rosa agrees');
  ok(await answer(rosa, sug[1], false), 'Rosa decides otherwise');
  const [yes1] = await d.settled([sh[0].id]);
  // The scripted clerk stops at a tool error, so its task ends failed; a real agent reads the error and moves on.
  const no1 = await d.waitFor('the declined suggestion', async () => {
    const t = ok(await screen('GET', `/api/tasks/${sh[1].id}`), 'task').task as Task;
    return t.state === 'failed' ? t : undefined;
  });
  const yesEvents = ok(await screen('GET', `/api/tasks/${yes1.id}`), 'task').events as LogEvent[];
  const ran = yesEvents.find((e) => e.type === 'tool.result');
  d.check(samYes.status === 403 && yes1.state === 'done' && ran?.type === 'tool.result' && ran.ok && ran.who?.approver === 'rosa',
    "Rosa's yes runs the clerk's tool, and the log says she decided (Sam, who asked, can't answer his own seat's suggestion)");
  const mid = await pilotOf();
  d.check(no1.state === 'failed' && /a person decided otherwise/.test(no1.error ?? '') && (await callsOf(no1)) === 0 && mid.disagreements.length === 1 && mid.disagreements[0].by === 'Rosa Delgado',
    `Rosa's no records a disagreement and the tool never runs; the agent is told "${no1.error?.replace(/^.*?Shadow mode/, 'Shadow mode')}"`);
  d.check(mid.answered === 2 && mid.agreed === 1 && mid.percent === 50 && !mid.ready, `after two answers: ${mid.agreed} of ${mid.answered} agreed (${mid.percent}%), not ready ("${GO_LIVE}")`);
  ok(await answer(rosa, sug[2]), 'Rosa agrees again');
  await d.settled([sh[2].id]);
  const done3 = await pilotOf();
  d.check(done3.answered === 3 && done3.agreed === 2 && done3.percent === 67 && done3.ready && done3.shadow, `the threshold turns it ready: ${done3.agreed} of ${done3.answered} agreed (${done3.percent}%), "ready to go live"`);
  ok(await priya('PUT', '/api/business', { shadow: [] }), 'go live');
  const live = await remind('INV-24113');
  const [liveDone] = await d.settled([live.id]);
  const liveAsked = (ok(await screen('GET', '/api/approvals'), 'approvals') as Approval[]).some((a) => a.task === live.id);
  const flips = (ok(await owen('GET', '/api/log'), 'log') as LogEvent[]).flatMap((e) => (e.type === 'note' && e.track === 'business' && (e.data as { shadow?: string[] }).shadow ? [e.data as { shadow: string[]; by: string }] : []));
  const last = flips.at(-1);
  d.check(liveDone.state === 'done' && !liveAsked && (await pilotOf()).shadow === false && last?.by === 'Priya Nair' && last.shadow.length === 0,
    'Priya takes it live with one setting (shadow: []), logged with her name: the clerk\'s next decision runs without asking');

  // ---------- off again ----------
  ok(await screen('PUT', '/api/business', { on: false }), 'turn Business off');
  const back = ok(await screen('GET', '/api/system'), 'system');
  const plain = ok(await screen('POST', `/api/approvals/${encodeURIComponent(aHuge.id)}`, { approved: false, by: 'box screen' }), 'answer off');
  for (const t of [huge, own]) ok(await screen('POST', `/api/tasks/${t.id}/undo`), 'undo');
  d.check(back.edition !== 'business' && plain.state === 'denied' && plain.by === 'box screen', `turned off, the box is GurtOS ${back.edition[0].toUpperCase()}${back.edition.slice(1)} again and answers as it always did`);
}
