// Time: a past decision gets reopened, and defended. The tools read the box's log as the desk's memory, so "what we
// knew in October" is exactly what the October task had read when it decided, and "does it still hold" is whatever
// the log has recorded since.
import fs from 'node:fs';
import path from 'node:path';
import type { Ctx, LogEvent, Tool } from '../../core/contract.ts';
import { parseCsv } from './check-case.ts';
import { caseFile, checkRules, controllerGate, marker, money, readLog, rulesField, rulesOf, runInfo, runOf, safeId, seatOf, type RunInfo } from './desk.ts';
import { changes, customerNow, laterReviews, pastDecisions, type Now, type Past } from './history.ts';
import { NESSIE_HOST, readBank } from './nessie.ts';

export const REVIEW_OUTCOMES = ['keep', 'reduce', 'suspend'];

const customerRow = (ctx: Ctx, id: string) => {
  const f = caseFile(ctx, 'case', 'customers.csv');
  const c = fs.existsSync(f) ? parseCsv(fs.readFileSync(f, 'utf8')).find((x) => x.customer_id === id) : undefined;
  if (!c) throw new Error(`there is no customer ${id} in this case`);
  return c;
};

/** The bank's returned items for this case, from Nessie when the case is loaded there, else from the case's own record. */
async function returnsOf(ctx: Ctx, info: RunInfo): Promise<{ payment_id: string; amount: number; date: string; reason: string }[]> {
  const meta = JSON.parse(fs.readFileSync(path.join(info.caseDir, 'case.json'), 'utf8'));
  if (info.nessie) {
    const bank = await readBank({ what: 'deposits' }, ctx.secret('NESSIE_API_KEY'), new Map(), meta.as_of, info.run);
    return (bank.money_out ?? []).flatMap((w: { date: string; description: string }) => {
      const m = w.description.match(/^RETURNED ITEM (\S+) \| ([^|]+) \| exact ([\d.]+)/);
      return m ? [{ payment_id: m[1], reason: m[2].trim(), amount: Number(m[3]), date: w.date }] : [];
    });
  }
  const f = path.join(info.caseDir, 'sources', 'bank_events.csv');
  return fs.existsSync(f) ? parseCsv(fs.readFileSync(f, 'utf8')).filter((r) => r.event === 'returned').map((r) => ({ payment_id: r.payment_id, amount: Number(r.amount), date: r.date, reason: r.reason })) : [];
}

export const reviewTools: Tool[] = [
  {
    name: 'credit-desk.history',
    description: "What the desk decided about a customer or applicant before, from the box's log: the decision, the data the deciding task had read at that moment (CRS answers, bank deposits, the application), the rule ids, and who approved it and when. Give a customer_id from this case, or an application_id.",
    input: { type: 'object', properties: { customer_id: { type: 'string' }, application_id: { type: 'string' } } },
    async run(input, ctx) {
      let who: { ein?: string; name?: string; application_id?: string };
      if (input.customer_id) {
        const c = customerRow(ctx, safeId(input.customer_id));
        who = { ein: c.ein, name: c.legal_name };
      } else if (input.application_id) who = { application_id: safeId(input.application_id) };
      else throw new Error('give a customer_id or an application_id');
      const past = pastDecisions(readLog(), who);
      return past.length
        ? { found: past.length, decisions: past, note: 'Each decision shows only what the deciding task had read up to that moment in the log.' }
        : { found: 0, note: 'The box has no earlier credit decision for this business in its log. It may predate the desk.' };
    },
  },
  {
    name: 'credit-desk.review',
    description: 'Record the review of an existing customer\'s credit: keep, reduce or suspend its limit and terms. The tool finds the earlier decision in the log and attaches what the desk knew then next to what it knows now. Changing a limit the controller approved comes back "needs controller" with a question for box_ask.',
    input: {
      type: 'object',
      properties: {
        customer_id: { type: 'string' },
        outcome: { type: 'string', enum: REVIEW_OUTCOMES },
        band: { type: 'string' },
        limit: { type: 'number', description: 'The new limit in dollars (the current one for keep).' },
        terms: { type: 'string' },
        rules: rulesField,
        why: { type: 'string' },
      },
      required: ['customer_id', 'outcome', 'limit', 'terms', 'rules', 'why'],
    },
    secrets: ['NESSIE_API_KEY'],
    hosts: [NESSIE_HOST],
    async run(input, ctx) {
      const id = safeId(input.customer_id);
      if (!REVIEW_OUTCOMES.includes(input.outcome)) throw new Error(`outcome must be one of: ${REVIEW_OUTCOMES.join(', ')}`);
      const rulesFile = rulesOf(ctx);
      const rules = checkRules(rulesFile, input.rules);
      const c = customerRow(ctx, id);
      const info = runInfo(readLog(), runOf(ctx.task!.source)!)!;
      const then: Past | undefined = pastDecisions(readLog(), { ein: c.ein, name: c.legal_name }).at(-1);
      const now: Now = customerNow(info.caseDir, id, await returnsOf(ctx, info));
      const changed = then ? changes(then, now) : [];
      const limit = Math.max(0, Number(input.limit));
      // A limit the controller approved is changed only by the controller (REV-6), as is any limit above authority.
      const needs = input.outcome !== 'keep' && (Boolean(then?.approval) || now.limit > rulesFile.authority || limit > rulesFile.authority);
      let approval: { id: string; approved: boolean; by: string; reason?: string } | undefined;
      if (needs) {
        const mark = marker(id, input.outcome, limit);
        const since = then ? ` ${then.approval ? `${then.approval.by} approved ${money(then.decision.limit)}` : `The desk set ${money(then.decision.limit)}`} on ${then.case_date} (${then.application_id}).` : '';
        const verb = input.outcome === 'suspend' ? 'suspend the credit of' : 'cut the limit of';
        const gate = controllerGate(ctx, mark, `Credit desk ${mark}: ${verb} ${c.legal_name} (${id}) from ${money(now.limit)} to ${money(limit)} on ${input.terms}${input.band ? `, band ${input.band}` : ''}?${since} Since then: ${changed.join(' ') || 'see the review.'} Rules: ${rules.join(', ')}.`);
        // The controller sees then and now before deciding, not after.
        if (gate.pending) return { ...gate.pending, before: then ?? null, now, changes: changed };
        approval = gate.approval!;
        if (!approval.approved) return { status: 'denied', reason: approval.reason ?? null, then: 'The controller said no. Do not ask again; revise the review to answer the reason, or keep the account as it is and record that.' };
      }
      const review = {
        customer_id: id, ein: c.ein, name: c.legal_name, case_date: now.case_date, outcome: input.outcome, band: input.band ?? null, limit, terms: input.terms, rules,
        decided_by: approval ? `controller (${approval.by})` : seatOf(ctx.task!), approval: approval ?? null,
        reopens: then ? { application_id: then.application_id, run: then.run, case_date: then.case_date, log_entry: then.seq, limit: then.decision.limit, terms: then.decision.terms } : null,
      };
      ctx.log(`Review of ${id}: ${input.outcome} to ${money(limit)} ${input.terms}${then ? `, reopening ${then.application_id} from ${then.case_date}` : ''}; ${review.decided_by}; ${rules.join(', ')}`);
      return { status: 'recorded', review, then: then ?? null, now, changes: changed, why: input.why };
    },
  },
];

/** "Why did we decide this?", answered from the log alone. `subject` is an application id, a customer id or a name. */
export function why(events: LogEvent[], subject: string) {
  const runs = events.flatMap((e) => (e.type === 'note' && e.track === 'credit-desk' && (e.data as any)?.kind === 'run.started' ? [(e.data as any).info as RunInfo] : []));
  let who: { ein?: string; name?: string; application_id?: string } = /^APP-/i.test(subject) ? { application_id: subject.toUpperCase() } : { name: subject };
  if (/^C-\d+$/i.test(subject)) {
    for (const r of runs) {
      const f = path.join(r.caseDir, 'customers.csv');
      const c = fs.existsSync(f) ? parseCsv(fs.readFileSync(f, 'utf8')).find((x) => x.customer_id === subject.toUpperCase()) : undefined;
      if (c) { who = { ein: c.ein, name: c.legal_name }; break; }
    }
  }
  const decisions = pastDecisions(events, who);
  const usd = (n: number | null) => (n == null ? '?' : `$${n.toLocaleString('en-US')}`);
  return decisions.map((d) => {
    // The application's EIN links it to the customer it became in later cases.
    const ein = (() => {
      const r = runs.find((x) => x.run === d.run)!;
      const f = path.join(r.caseDir, 'applications', `${d.application_id}.json`);
      return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')).business?.ein : undefined;
    })();
    const later = ein ? laterReviews(events, ein, d.seq) : [];
    const c = d.checks;
    const answer = [
      `On ${d.case_date} the desk decided: ${d.decision.outcome === 'approve' ? `approve ${d.business} (${d.application_id}) for ${usd(d.decision.limit)} on ${d.decision.terms}, band ${d.decision.band}` : `${d.decision.outcome} for ${d.business} (${d.application_id})`}.`,
      `They asked for ${usd(d.asked.requested)} on ${d.asked.terms}, with stated revenue of ${usd(d.asked.stated_revenue)}.`,
      c ? `What it knew then (${c.source}): TransUnion ${c.transunion ?? 'no score'}, Equifax ${c.equifax ?? 'no score'}, Experian ${c.experian ?? 'no score'}; identity ${c.identity}; fraud score ${c.fraud_score}; ${c.public_records}.` : 'The log has no CRS answers for it.',
      d.bank ? `Bank deposits averaged ${usd(d.bank.average_monthly_deposits)} a month over ${d.bank.months} months.` : '',
      d.why ? `The analyst's reason: ${d.why}` : '',
      `Rules: ${d.rules.map((r) => `${r.id} (${r.text})`).join('; ')}.`,
      d.approval ? `Approved by ${d.approval.by} on ${d.approval.at.slice(0, 10)} at ${d.approval.at.slice(11, 16)} UTC (log time).` : 'Within the analyst\'s own authority; nobody else had to approve it.',
      later.length
        ? `Does it still hold? No. ${later.map((l) => `On ${l.review.case_date ?? l.at.slice(0, 10)} the desk reviewed it: ${l.review.outcome} to ${usd(l.review.limit)} on ${l.review.terms}, ${l.review.decided_by}`).join('. ')}.`
        : 'Does it still hold? Nothing recorded since has changed it.',
    ].filter(Boolean);
    return { ...d, later, answer, crs_request_ids: c?.crs_request_ids ?? [] };
  });
}
