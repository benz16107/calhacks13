// The credit desk's demo step. Scripted seats (the fake worker) drive the real tools, live against CRS and Nessie:
// the fake applicant is caught, the analyst pauses for the controller, decisions land in the log with their rule ids
// and CRS request ids, and the run is scored against the answer key.
// DEMO_LIVE=credit-desk ./demo also runs both seats with Droid on the whole case, answers the controller's questions, scores it
// and saves the evidence to /var/lib/box-demo/credit-desk-<run>/. That takes several minutes.
import fs from 'node:fs';
import path from 'node:path';
import type { Approval, DemoKit, LogEvent, Task } from '../../core/contract.ts';

const call = (tool: string, input: object) => `call ${tool} ${JSON.stringify(input)}`;
const fraudHold = { application_id: 'APP-1043', outcome: 'fraud hold', band: 'none', limit: 0, terms: 'cash in advance', rules: ['FRD-1', 'FRD-2'], data: { fraud_score: 88 }, why: 'Identity check fails and the fraud score is 88.' };

const analyst = [
  'missing case/answer_key.json',
  call('credit-desk.crs', { application_id: 'APP-1043' }),
  call('credit-desk.bank', { what: 'statements', application_id: 'APP-1043' }),
  call('credit-desk.flag', {
    ids: ['APP-1043', 'BC-1043'], problem: 'Fake applicant: synthetic identity', rules: ['FRD-1', 'FRD-2', 'FRD-3'],
    detail: 'TransUnion identity fails (2201 SSN not associated with the name, 2202 date of birth does not match the file). Fraud Finder risk score 88: prepaid VoIP phone the applicant does not own, email first seen days ago. The LLC was filed 2026-09-01 but claims 4 years in business.',
    conclusion: 'Fraud hold: no credit, cash in advance only, refer to the controller.',
  }),
  call('credit-desk.credit_decision', fraudHold),
  'ask Credit desk [APP-1043 fraud hold 0]: confirm the fraud hold on Pacific Crest Provisions LLC?',
  call('credit-desk.credit_decision', fraudHold),
  call('credit-desk.crs', { application_id: 'APP-1042' }),
  call('credit-desk.credit_decision', { application_id: 'APP-1042', outcome: 'approve', band: 'A', limit: 40000, terms: 'Net 30', rules: ['BND-A', 'LIM-1'], why: 'Clean 790 file.' }),
].join('\n');

const clerk = [
  call('credit-desk.bank', { what: 'deposits' }),
  call('credit-desk.flag', {
    ids: ['PMT-8812', 'INV-24089', 'INV-24098'], problem: 'Payment applied to the wrong invoice', rules: ['COL-6'],
    detail: "Golden Gate Bagel paid 1,940.00 with remittance INV-24098, and the bank deposit carries that memo, but the payment was applied to Greenleaf Juice's INV-24089.",
    conclusion: 'Reapply PMT-8812 to INV-24098. INV-24089 is still open.',
  }),
  call('credit-desk.collections_action', { subject: 'SO-5528', action: 'release order', detail: 'Piedmont is current once INV-24111 carries its real 2026 date.', rules: ['ORD-1'] }),
  call('credit-desk.collections_action', { subject: 'C-1005', action: 'release credit hold', detail: 'The customer asks to ship SO-5521.', rules: ['COL-3'] }),
].join('\n');

const results = (events: LogEvent[], tool: string) =>
  events.flatMap((e) => (e.type === 'tool.call' && e.tool === tool ? [e.key] : []))
    .map((k) => events.find((e) => e.type === 'tool.result' && e.key === k))
    .flatMap((e) => (e?.type === 'tool.result' && e.ok ? [e.output as any] : []));

export default async function (d: DemoKit) {
  const run = await d.api('POST', '/t/credit-desk/run', { case: 'fogline-2026-10', worker: 'fake', scripts: { analyst, clerk } });
  const ask = await d.waitFor('the fraud referral', async () =>
    (await d.api<Approval[]>('GET', '/approvals')).find((a) => a.task === run.tasks.analyst && a.state === 'pending'));
  const { task: waiting, events: early } = await d.api<{ task: Task; events: LogEvent[] }>('GET', `/tasks/${run.tasks.analyst}`);
  const [crs] = results(early, 'credit-desk.crs');
  const codes = crs.identity.problems.map((p: { code: string }) => p.code).join(', ');
  d.check(!crs.identity.verified && crs.fraud.risk_score >= 70, `CRS (${crs.source}): APP-1043's identity fails (${codes}) and its fraud score is ${crs.fraud.risk_score}`);
  d.check(waiting.state === 'waiting' && ask.question.includes('[APP-1043 fraud hold 0]'), 'the fraud referral paused the analyst until the controller answers');

  await d.settled([run.tasks.clerk]);
  const { events: clerkEvents } = await d.api<{ events: LogEvent[] }>('GET', `/tasks/${run.tasks.clerk}`);
  const [bank] = results(clerkEvents, 'credit-desk.bank');
  const deposit = bank.deposits.find((x: { description: string }) => x.description.startsWith('PMT-8812'));
  d.check(deposit?.description.includes('memo INV-24098') && !bank.deposits.some((x: { description: string }) => x.description.startsWith('PMT-8823')),
    'Nessie: Golden Gate\'s deposit says INV-24098 (the ledger applied it elsewhere), and the post-dated check has not cleared');
  const release = results(clerkEvents, 'credit-desk.collections_action').find((o) => o.ask?.includes('[C-1005 release credit hold'));
  d.check(release?.status === 'needs controller', 'the clerk cannot release a credit hold; that needs the controller');

  await d.api('POST', `/approvals/${ask.id}`, { approved: true, by: 'controller' });
  await d.settled([run.tasks.analyst]);
  const { events } = await d.api<{ events: LogEvent[] }>('GET', `/tasks/${run.tasks.analyst}`);
  const decisions = results(events, 'credit-desk.credit_decision');
  const hold = decisions.find((x) => x.decision?.application_id === 'APP-1043');
  d.check(hold?.decision.outcome === 'fraud hold' && hold.decision.decided_by === 'controller (controller)' && hold.decision.rules.includes('FRD-1') && hold.crs_request_ids.length === 7,
    `the fraud hold is in the log with the controller's OK, its rule ids (${hold?.decision.rules.join(', ')}) and the 7 CRS request ids it rests on`);
  const big = decisions.find((x) => x.ask?.includes('[APP-1042 approve 40000]'));
  d.check(big?.status === 'needs controller' && !decisions.some((x) => x.decision?.application_id === 'APP-1042'),
    'the analyst cannot approve $40,000 on its own: above its $10,000 authority, nothing is recorded until the controller answers');

  const score = await d.api('POST', '/t/credit-desk/score', { run: run.run });
  d.check(score.total === 14 && score.caught === 2 && score.false_alarms.length === 0, `scored from the log against the answer key: ${score.summary}`);
  d.check(score.moment[0]?.application_id === 'APP-1043' && score.moment[0].simple_rule === 'approve $20,000',
    'the simple rule would have approved APP-1043 for $20,000 on the same CRS answers; the desk held it');

  const vault = fs.readFileSync(path.join(d.home, 'vault.env'), 'utf8');
  const keys = ['CRS_USERNAME', 'CRS_PASSWORD', 'NESSIE_API_KEY'].map((k) => vault.match(new RegExp(`^${k}=(.*)$`, 'm'))?.[1]).filter((v): v is string => !!v && v.length > 4);
  const log = JSON.stringify(await d.api('GET', '/log'));
  d.check(keys.length === 3 && keys.every((k) => !log.includes(k)), 'no CRS or Nessie key is anywhere in the log');

  if ((process.env.DEMO_LIVE ?? '').split(/[\s,]+/).includes('credit-desk')) await live(d);
  else console.log('  skip  the live Droid run on the whole case, about 10 minutes of model time: DEMO_LIVE=credit-desk ./demo runs it');
}

/** Both seats with Droid on the whole case. The controller's questions are answered yes, as Rosa would after reading them. */
async function live(d: DemoKit) {
  const run = await d.api('POST', '/t/credit-desk/run', { case: 'fogline-2026-10' });
  const ids: string[] = Object.values(run.tasks);
  console.log(`  live run ${run.run}: tasks ${ids.join(', ')}`);
  const end = Date.now() + 60 * 60 * 1000;
  for (let n = 0; ; n++) {
    for (const a of await d.api<Approval[]>('GET', '/approvals')) {
      if (ids.includes(a.task) && a.state === 'pending') {
        console.log(`  controller: yes to "${a.question.slice(0, 160)}"`);
        await d.api('POST', `/approvals/${a.id}`, { approved: true, by: 'controller (scripted for the scored run)' });
      }
    }
    const tasks = await Promise.all(ids.map(async (id) => (await d.api<{ task: Task }>('GET', `/tasks/${id}`)).task));
    if (n % 20 === 0) console.log(`  ${tasks.map((t) => `${t.title}: ${t.state}, $${(t.costCents / 100).toFixed(2)}`).join(' | ')}`);
    if (tasks.every((t) => ['done', 'failed', 'undone'].includes(t.state)) || Date.now() > end) break;
    await new Promise((r) => setTimeout(r, 3000));
  }
  const score = await d.api('POST', '/t/credit-desk/score', { run: run.run });
  const out = `/var/lib/box-demo/credit-desk-${run.run}`;
  fs.mkdirSync(out, { recursive: true });
  const log = (await d.api<LogEvent[]>('GET', '/log')).filter((e) => (e.task && ids.includes(e.task)) || (e.type === 'note' && e.track === 'credit-desk'));
  fs.writeFileSync(path.join(out, 'score.json'), JSON.stringify(score, null, 2));
  fs.writeFileSync(path.join(out, 'log.jsonl'), log.map((e) => JSON.stringify(e)).join('\n') + '\n');
  for (const f of ['analyst-report.md', 'clerk-report.md']) fs.writeFileSync(path.join(out, f), d.view(run.workspace, f) ?? '(not written)\n');
  for (const id of ids) {
    const w = path.join(d.home, 'tasks', id, 'worker.log');
    if (fs.existsSync(w)) fs.copyFileSync(w, path.join(out, `${id}.worker.log`));
  }
  console.log(`  live: ${score.summary}\n  evidence in ${out}`);
  d.check(true, `live Droid run scored: ${score.summary}`);
}
