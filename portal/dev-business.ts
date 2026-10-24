// Seeds a dev box as GurtOS Business: Fogline Supply from the approved designs (docs/figma/business/), its people, rules
// and two agent seats, and the credit desk's requests as scripted tasks (no model, sandbox data, test money only).
//   DEV_SEED=business portal/dev-box.sh      runs this inside the VM:  node portal/dev-business.ts <port>
import { PEOPLE, POLICY, SEATS } from '../core/business-demo.ts';

const port = process.argv[2] ?? '7790';
async function call(method: string, path: string, body?: unknown, person?: string) {
  const r = await fetch(`http://127.0.0.1:${port}/api${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...(person ? { 'x-box-person': person } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const out = await r.json();
  if (!r.ok) throw new Error(`${method} ${path}: ${out.error}`);
  return out;
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** A scripted agent seat's task. `say` lines are its steps in plain words; `ask` asks for an OK. */
const task = (seat: string, title: string, lines: string[], person?: string, source?: string) =>
  call('POST', '/tasks', { title, seat, worker: 'fake', prompt: lines.join('\n'), source: source ?? 'credit-desk:dev' }, person);

await call('POST', '/setup/finish'); // the wizard is for a real first boot
await call('PUT', '/business', { on: true, company: 'Fogline Supply' });
for (const p of PEOPLE) await call('POST', '/people', p);
await call('PUT', '/business', { policy: POLICY, seats: SEATS }, 'priya'); // Priya, the IT admin, wrote the rules

// Done earlier: a write-off Sam asked for and Rosa approved, so the audit and My requests have an answered one.
const off = await task('Collections clerk', 'Write off INV-24102', [
  'say Mission St. Taqueria paid INV-24102 short by $2,400; the remittance says the order arrived damaged',
  'ask Collections: write off the last $2,400 on INV-24102 for Mission St. Taqueria? The clerk checked the delivery note: two cases arrived broken.',
  'say Written off: $2,400 on INV-24102 (COL-7)',
], 'sam');
for (let i = 0; i < 40 && !(await call('GET', '/approvals?state=pending')).some((a: { task: string }) => a.task === off.id); i++) await sleep(200);
const [wo] = (await call('GET', '/approvals?state=pending')).filter((a: { task: string }) => a.task === off.id);
await call('POST', `/approvals/${encodeURIComponent(wo.id)}`, { approved: true, by: "Rosa Delgado's phone" }, 'rosa');

// Waiting for Rosa: two credit lines over $10,000 and a fraud flag, as in the designs.
await task('Credit analyst', 'Credit line for Bright Harbor Catering', [
  'say CRS on APP-1042: guarantor credit 790 at TransUnion, band A (BND-A)',
  'say Identity checks passed: CRS identity verification',
  'say Fraud Finder: no reasons',
  'say Verified revenue $2,150,000: the lowest of stated, business credit and bank deposits (LIM-2)',
  'say Proposed $40,000 on Net 30: the smallest of the request, band A\'s cap and 10% of revenue (LIM-1)',
  "ask Credit desk [APP-1042 approve 40000]: approve Bright Harbor Catering Inc. (APP-1042) for $40,000, Net 30, band A? Proposed by the credit analyst; above the analyst's $10,000 authority. Rules: BND-A, LIM-1.",
  'say Decision on APP-1042: approved, $40,000 Net 30, band A',
], 'sam');
await task('Credit analyst', 'Credit line for Panaderia Castellanos', [
  'say CRS on APP-1045: fresh pulls disagree (Experian 700, TransUnion 742); the applicant\'s own report is 18 months old (DOC-1)',
  'say Band B on the lowest score, capped at $15,000 (BND-1, BND-B)',
  "ask Credit desk [APP-1045 approve 15000]: approve Panaderia Castellanos LLC (APP-1045) for $15,000, Net 30, band B? They asked for $25,000. Proposed by the credit analyst; above the analyst's $10,000 authority. Rules: DOC-1, BND-B, SOD-2.",
  'say Decision on APP-1045: approved, $15,000 Net 30, band B',
], undefined, 'credit-desk:web form');
await task('Credit analyst', 'Fraud flag on Pacific Crest Provisions', [
  'say CRS on APP-1043: identity fails (2201 SSN not this name, 2202 date of birth, 2101); Fraud Finder 88',
  'say Nobody owns its phone number; 9 credit inquiries between Aug 19 and Sep 12',
  'ask Credit desk [APP-1043 fraud hold 0]: fraud referral. Put Pacific Crest Provisions LLC (APP-1043) on fraud hold, no credit, cash in advance only? Its owner fails TransUnion identity (2201, 2202) and Fraud Finder scores it 88. A simple rule would approve $20,000. Rules: FRD-1, FRD-2.',
  'say Decision on APP-1043: fraud hold, cash in advance',
], 'sam');

// Running now, for Control Center and the kill switch.
await task('Credit analyst', 'Review APP-1046 Lakeshore Diner', ['say Step 1 of 6: CRS checks', 'sleep 2', 'say Step 3 of 6: revenue against the bank deposits', 'sleep 3600'], 'sam');
await task('Collections clerk', 'Apply October payments', ['say 4 of 15 applied', 'sleep 2', 'say 9 of 15 applied', 'sleep 3600']);
await task('Collections clerk', 'Reminders for overdue invoices', ['say 2 of 5 sent', 'sleep 3600']);
console.log(`Business dev box seeded: Fogline Supply, ${PEOPLE.length} people, ${SEATS.length} seats`);
