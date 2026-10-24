// Scripted seats for the Fogline case: the box's fake worker calls the desk's real tools, live against CRS and Nessie,
// with no model. The demo uses them, and so does the window's quick run, so the fraud hold can be shown in seconds.
const call = (tool: string, input: object) => `call ${tool} ${JSON.stringify(input)}`;
const fraudHold = { application_id: 'APP-1043', outcome: 'fraud hold', band: 'none', limit: 0, terms: 'cash in advance', rules: ['FRD-1', 'FRD-2'], data: { fraud_score: 88 }, why: 'Identity check fails and the fraud score is 88.' };

export const analyst = [
  'missing case/answer_key.json',
  call('credit-desk.crs', { application_id: 'APP-1043' }),
  call('credit-desk.bank', { what: 'statements', application_id: 'APP-1043' }),
  call('credit-desk.flag', {
    ids: ['APP-1043', 'BC-1043'], problem: 'Fake applicant: synthetic identity', rules: ['FRD-1', 'FRD-2', 'FRD-3'],
    detail: 'TransUnion identity fails (2201 SSN not associated with the name, 2202 date of birth does not match the file). Fraud Finder risk score 88: prepaid VoIP phone the applicant does not own, email first seen days ago. The LLC was filed 2026-09-01 but claims 4 years in business.',
    conclusion: 'Fraud hold: no credit, cash in advance only, refer to the controller.',
  }),
  call('credit-desk.credit_decision', fraudHold),
  'ask Credit desk [APP-1043 fraud hold 0]: fraud referral. Put Pacific Crest Provisions LLC (APP-1043) on fraud hold, no credit? Its owner fails TransUnion identity (2201, 2202) and Fraud Finder scores it 88. A simple rule would approve $20,000. Rules: FRD-1, FRD-2.',
  call('credit-desk.credit_decision', fraudHold),
  call('credit-desk.crs', { application_id: 'APP-1042' }),
  call('credit-desk.credit_decision', { application_id: 'APP-1042', outcome: 'approve', band: 'A', limit: 40000, terms: 'Net 30', rules: ['BND-A', 'LIM-1'], why: 'Clean 790 file.' }),
].join('\n');

export const clerk = [
  call('credit-desk.bank', { what: 'deposits' }),
  call('credit-desk.flag', {
    ids: ['PMT-8812', 'INV-24089', 'INV-24098'], problem: 'Payment applied to the wrong invoice', rules: ['COL-6'],
    detail: "Golden Gate Bagel paid 1,940.00 with remittance INV-24098, and the bank deposit carries that memo, but the payment was applied to Greenleaf Juice's INV-24089.",
    conclusion: 'Reapply PMT-8812 to INV-24098. INV-24089 is still open.',
  }),
  call('credit-desk.collections_action', { subject: 'SO-5528', action: 'release order', detail: 'Piedmont is current once INV-24111 carries its real 2026 date.', rules: ['ORD-1'] }),
  call('credit-desk.collections_action', { subject: 'C-1005', action: 'release credit hold', detail: 'The customer asks to ship SO-5521.', rules: ['COL-3'] }),
].join('\n');
