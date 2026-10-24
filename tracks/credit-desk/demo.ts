// The credit desk's demo step. Scripted seats (the fake worker, no model) drive the real tools, live against CRS and
// Nessie: the fake applicant is caught, the AP clerk's limits hold in code, entries reach the books only through the
// desk and leave them on undo, January reopens October's decision from the log, the auditor's "why" is answered from
// the log, and both runs are scored against their answer keys.
// DEMO_LIVE=droid,credit-desk ./demo also runs every seat with Droid on October then January, answers the controller's
// questions from each case's controller.json (one is a no, with a reason), scores both and saves the evidence to
// /var/lib/box-demo/credit-desk-<run>/. That takes 20 to 30 minutes of model time.
import fs from 'node:fs';
import path from 'node:path';
import type { Approval, DemoKit, LogEvent, Task } from '../../core/contract.ts';
import { parseLedger } from './books.ts';
import crsPush from './demo-crs.ts';
import { toolUses } from './desk.ts';

const results = (events: LogEvent[], tool: string) =>
  events.flatMap((e) => (e.type === 'tool.call' && e.tool === tool ? [e.key] : []))
    .map((k) => events.find((e) => e.type === 'tool.result' && e.key === k))
    .flatMap((e) => (e?.type === 'tool.result' && e.ok ? [e.output as any] : []));

const pendingFor = async (d: DemoKit, ids: string[]) => (await d.api<Approval[]>('GET', '/approvals')).filter((a) => ids.includes(a.task) && a.state === 'pending');

/** Answer every request of these tasks until they finish. `answers` picks yes or no (with a reason) per question. */
async function controller(d: DemoKit, ids: string[], answers: (q: string) => { approve: boolean; reason?: string } = () => ({ approve: true }), ms = 60000, log = false) {
  const end = Date.now() + ms;
  for (let n = 0; Date.now() < end; n++) {
    for (const a of await pendingFor(d, ids)) {
      const ans = answers(a.question);
      if (log) console.log(`  controller: ${ans.approve ? 'yes' : `no ("${ans.reason}")`} to "${a.question.slice(0, 150)}"`);
      if (!ans.approve && ans.reason) await d.api('POST', '/t/credit-desk/reason', { approval: a.id, reason: ans.reason });
      await d.api('POST', `/approvals/${a.id}`, { approved: ans.approve, by: 'Rosa Delgado' });
    }
    const tasks = await Promise.all(ids.map(async (id) => (await d.api<{ task: Task }>('GET', `/tasks/${id}`)).task));
    if (log && n % 20 === 0) console.log(`  ${tasks.map((t) => `${t.title}: ${t.state}, $${(t.costCents / 100).toFixed(2)}`).join(' | ')}`);
    if (tasks.every((t) => ['done', 'failed', 'undone'].includes(t.state))) return tasks;
    await new Promise((r) => setTimeout(r, log ? 3000 : 300));
  }
  throw new Error('the seats did not finish in time');
}

const eventsOf = async (d: DemoKit, id: string) => (await d.api<{ events: LogEvent[] }>('GET', `/tasks/${id}`)).events;

export default async function (d: DemoKit) {
  // ---------- October: the planted case ----------
  const oct = await d.api('POST', '/t/credit-desk/run', { case: 'fogline-2026-10', scripted: true });
  const seats: string[] = Object.values(oct.tasks);
  d.check(seats.length === 3, 'three seats started, each its own task: credit analyst, collections clerk, AP clerk');
  const ask = await d.waitFor('the fraud referral', async () => (await pendingFor(d, [oct.tasks.analyst]))[0]);
  const [crs] = results(await eventsOf(d, oct.tasks.analyst), 'credit-desk.crs');
  d.check(!crs.identity.verified && crs.fraud.risk_score >= 70, `CRS (${crs.source}): APP-1043's identity fails (${crs.identity.problems.map((p: { code: string }) => p.code).join(', ')}) and its fraud score is ${crs.fraud.risk_score}`);
  d.check(ask.question.includes('[APP-1043 fraud hold 0]'), 'the fraud referral paused the analyst until the controller answers');
  const view = await d.api('GET', `/t/credit-desk/state?run=${oct.run}`);
  d.check(view.run.applications.find((a: { id: string }) => a.id === 'APP-1043')?.ask?.id === ask.id, "the desk's window shows the fraud hold waiting for the controller");

  await controller(d, seats);
  const ap = await eventsOf(d, oct.tasks.ap);
  const pays = results(ap, 'credit-desk.pay_bill');
  d.check(pays.some((p) => p.status === 'refused' && /bank details changed/.test(p.why) && /AP-4/.test(p.why)),
    "the AP clerk could not pay Pacific Paper's bill: its bank details changed from a lookalike email and nobody called (refused in code, AP-4)");
  d.check(pays.some((p) => p.status === 'paid' && p.payment.bill_id === 'B-3304' && p.payment.nessie_withdrawal),
    'it paid a small freight bill from the operating account at Nessie (test money)');
  d.check(pays.some((p) => p.status === 'needs controller' && /AP-1/.test(p.ask)), 'it could not pay a bill it had entered itself without a second person (AP-1)');
  d.check(results(ap, 'credit-desk.ap_action').some((a) => a.action?.subject === 'B-3311' && a.action.action === 'void'), 'it voided the duplicate supplier invoice (AP-3)');

  const decisions = results(await eventsOf(d, oct.tasks.analyst), 'credit-desk.credit_decision');
  const hold = decisions.find((x) => x.decision?.application_id === 'APP-1043');
  d.check(hold?.decision.outcome === 'fraud hold' && hold.decision.decided_by === 'controller (Rosa Delgado)' && hold.crs_request_ids.length === 7,
    `the fraud hold is in the log with Rosa's OK, its rule ids (${hold?.decision.rules.join(', ')}) and the 7 CRS request ids it rests on`);
  d.check(decisions.some((x) => x.status === 'needs controller' && x.ask.includes('[APP-1042 approve 40000]')) && decisions.some((x) => x.decision?.application_id === 'APP-1042' && x.decision.approval),
    'the analyst could not approve $40,000 on its own; it waited, and recorded it only after the controller said yes');

  // ---------- the books: only through the desk, and undo takes a seat's entries out ----------
  const books = async () => (await fetch(`${d.url}/t/credit-desk/books?run=${oct.run}`)).text();
  const before = await books();
  d.check(parseLedger(before).errors.length === 0 && before.includes('fixes PMT-8812') && before.includes('"Pay B-3304"'),
    "the real books (Beancount) carry the clerk's correction of PMT-8812 and the AP payment, every entry balanced");
  await d.api('POST', `/tasks/${oct.tasks.clerk}/undo`);
  const after = await books();
  d.check(!after.includes('fixes PMT-8812') && after.includes('"Pay B-3304"'), "undoing the clerk's task took its entry out of the books; the AP clerk's payment stayed");

  const octScore = await d.api('POST', '/t/credit-desk/score', { run: oct.run });
  d.check(octScore.total === 17 && octScore.false_alarms.length === 0 && octScore.moment[0]?.simple_rule === 'approve $20,000',
    `October scored from the log: ${octScore.summary}. The simple rule approves APP-1043 for $20,000; the desk held it`);

  // ---------- January: the desk reopens October's decision from its own log ----------
  const jan = await d.api('POST', '/t/credit-desk/run', { case: 'fogline-2027-01', scripted: true });
  const cut = await d.waitFor('the review to reach the controller', async () => (await pendingFor(d, [jan.tasks.analyst]))[0], 40000);
  const pending = results(await eventsOf(d, jan.tasks.analyst), 'credit-desk.review').at(-1);
  d.check(pending.before?.decision.limit === 40000 && pending.before.approval?.by === 'Rosa Delgado' && pending.now.returned_payments.length === 2 && pending.now.open_balance === 37770,
    `the review found October's $40,000 decision in the log (log entry ${pending.before?.seq}, approved by Rosa) and set it beside now: 2 returned payments, $37,770 really open`);
  d.check(cut.question.includes('[C-1013 reduce 7500]'), 'cutting a limit Rosa approved went back to Rosa (REV-6): only she can change her own decision');
  await controller(d, Object.values(jan.tasks));
  const janScore = await d.api('POST', '/t/credit-desk/score', { run: jan.run });
  d.check(janScore.caught === 2 && janScore.decisions.reviews[0]?.match, `January scored: ${janScore.summary}`);

  const why = await d.api('GET', '/t/credit-desk/why?subject=APP-1042');
  const answer = why.decisions[0]?.answer.join(' ') ?? '';
  const partial = await d.api('GET', '/t/credit-desk/why?subject=Bright%20Harbor');
  d.check(partial.decisions.length === 1 && partial.decisions[0].application_id === 'APP-1042', 'Ask why finds a customer by part of its name, not only the full name');
  d.check(/TransUnion 790/.test(answer) && /Approved by Rosa Delgado/.test(answer) && /Does it still hold\? No\./.test(answer),
    '"Why did we give Bright Harbor $40,000?" is answered from the log: what the desk knew, the rules, who approved it, and that it no longer holds');

  const vault = fs.readFileSync(path.join(d.home, 'vault.env'), 'utf8');
  const keys = ['CRS_USERNAME', 'CRS_PASSWORD', 'NESSIE_API_KEY'].map((k) => vault.match(new RegExp(`^${k}=(.*)$`, 'm'))?.[1]).filter((v): v is string => !!v && v.length > 4);
  const log = JSON.stringify(await d.api('GET', '/log'));
  d.check(keys.length === 3 && keys.every((k) => !log.includes(k)), 'no CRS or Nessie key is anywhere in the log');

  await crsPush(d); // the CRS push: a reason for every pull, the fraudster who argues, CRS's MCP server, the nightly re-check, the fraud case

  // Real Droid only when the gate allows it too (droid in DEMO_LIVE, and Factory's 5-hour use under the core's limit).
  const live = (process.env.DEMO_LIVE ?? '').split(/[\s,]+/);
  if (live.includes('credit-desk') && live.includes('droid')) await liveRuns(d);
  // DEMO_LIVE=droid,coordinate ./demo: two real analysts share the October applications through SpacetimeDB.
  else if (live.includes('coordinate') && live.includes('droid')) await coordinatedRun(d);
  else console.log('  skip  the live Droid runs on October and January, 20 to 30 minutes of model time: DEMO_LIVE=droid,credit-desk ./demo runs them');
}

/** Every seat with Droid, October then January. Rosa's answers come from each case's controller.json. */
async function liveRuns(d: DemoKit) {
  for (const caseId of ['fogline-2026-10', 'fogline-2027-01']) {
    const answersFile = path.join(import.meta.dirname, 'cases', caseId, 'controller.json');
    const scripted: { match: string; approve: boolean; reason?: string }[] = fs.existsSync(answersFile) ? JSON.parse(fs.readFileSync(answersFile, 'utf8')).answers : [];
    const answers = (q: string) => scripted.find((a) => q.includes(a.match)) ?? { approve: true };
    const run = await d.api('POST', '/t/credit-desk/run', { case: caseId });
    const ids: string[] = Object.values(run.tasks);
    console.log(`  live run ${run.run} (${caseId}): tasks ${ids.join(', ')}`);
    await controller(d, ids, answers, 90 * 60 * 1000, true);
    const score = await d.api('POST', '/t/credit-desk/score', { run: run.run });
    const out = `/var/lib/box-demo/credit-desk-${run.run}`;
    fs.mkdirSync(out, { recursive: true });
    const log = (await d.api<LogEvent[]>('GET', '/log')).filter((e) => (e.task && ids.includes(e.task)) || (e.type === 'note' && e.track === 'credit-desk'));
    fs.writeFileSync(path.join(out, 'score.json'), JSON.stringify(score, null, 2));
    fs.writeFileSync(path.join(out, 'log.jsonl'), log.map((e) => JSON.stringify(e)).join('\n') + '\n');
    fs.writeFileSync(path.join(out, 'books.beancount'), await (await fetch(`${d.url}/t/credit-desk/books?run=${run.run}`)).text());
    for (const f of ['analyst-report.md', 'clerk-report.md', 'ap-report.md']) {
      const text = d.view(run.workspace, f);
      if (text) fs.writeFileSync(path.join(out, f), text);
    }
    console.log(`  live ${caseId}: ${score.summary}\n  evidence in ${out}`);
    d.check(true, `live Droid run on ${caseId} scored: ${score.summary}`);
  }
  const why = await d.api('GET', '/t/credit-desk/why?subject=APP-1042');
  console.log(`  why APP-1042: ${why.decisions.at(-1)?.answer.join(' ')}`);
}

/** Opt-in live step: {coordinate: true} on October, analysts only. Each application is claimed from the queue exactly once. */
async function coordinatedRun(d: DemoKit) {
  const file = path.join(import.meta.dirname, 'cases', 'fogline-2026-10', 'controller.json');
  const scripted: { match: string; approve: boolean; reason?: string }[] = JSON.parse(fs.readFileSync(file, 'utf8')).answers;
  const run = await d.api('POST', '/t/credit-desk/run', { case: 'fogline-2026-10', coordinate: true, seats: ['analyst'] });
  const ids: string[] = Object.values(run.tasks);
  console.log(`  coordinated run ${run.run}: analysts ${ids.join(', ')}`);
  await controller(d, ids, (q) => scripted.find((a) => q.includes(a.match)) ?? { approve: true }, 60 * 60 * 1000, true);
  const log = (await d.api<LogEvent[]>('GET', '/log')).filter((e) => e.task && ids.includes(e.task));
  const uses = toolUses(log, new Set(ids));
  const claimed = uses.filter((u) => u.tool === 'spacetime.claim' && u.ok && u.output?.job).map((u) => ({ task: u.task, app: u.output.job.payload?.id ?? JSON.stringify(u.output.job.payload) }));
  const decided = uses.filter((u) => u.tool === 'credit-desk.credit_decision' && u.ok && u.output?.status === 'recorded').map((u) => ({ task: u.task, app: u.input.application_id }));
  const by = (xs: { task: string }[]) => ids.map((t) => xs.filter((x) => x.task === t).length).join(' and ');
  console.log(`  claimed ${by(claimed)} applications, decided ${by(decided)}: ${claimed.map((c) => c.app).join(', ')}`);
  d.check(new Set(claimed.map((c) => c.app)).size === 6 && new Set(decided.map((c) => c.app)).size === 6,
    `two analysts claimed the six applications from the SpacetimeDB queue (${by(claimed)}) and decided all six (${by(decided)})`);
  const out = `/var/lib/box-demo/credit-desk-${run.run}`;
  fs.mkdirSync(out, { recursive: true });
  const score = await d.api('POST', '/t/credit-desk/score', { run: run.run });
  fs.writeFileSync(path.join(out, 'score.json'), JSON.stringify(score, null, 2));
  fs.writeFileSync(path.join(out, 'log.jsonl'), log.map((e) => JSON.stringify(e)).join('\n') + '\n');
  console.log(`  coordinated run: ${score.summary}\n  evidence in ${out}`);
}
