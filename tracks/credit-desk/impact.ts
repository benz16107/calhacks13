// Customer impact of one run, measured from the box's log: how much of a person's attention the desk needed, what it
// stopped, and what the model cost. Compared with doing the work by hand and with the simple rule.
import fs from 'node:fs';
import path from 'node:path';
import type { LogEvent, Task } from '../../core/contract.ts';
import { parseCsv } from './check-case.ts';
import { runOf, toolUses, type RunInfo } from './desk.ts';
import type { Score } from './score.ts';

/**
 * The two estimates the comparison rests on. Both are stated, not measured; see CUSTOMER.md for the sources.
 * MANUAL_MINUTES: a person reviewing one business credit application by hand (reading it, pulling and reading reports,
 * checking references, deciding, writing it up). REVIEW_MINUTES: a person reading one request the desk sends (a few
 * lines with the evidence attached) and answering it.
 */
export const ESTIMATES = {
  manual_minutes_per_application: null as number | null,
  manual_source: 'No published source times the hands-on minutes. Elapsed time from application to decision: under three days for 46% of credit teams, a week or more for more than a quarter (Nuvo with NACM, 2025 B2B Credit Insights; CUSTOMER.md section 4).',
  manual_elapsed: 'under 3 days for 46% of credit teams, a week or more for over a quarter',
  review_minutes_per_request: 3,
  review_source: 'Our assumption: a desk request is one paragraph with the evidence attached. Not measured.',
};

export function impact(info: RunInfo, events: LogEvent[], tasks: Task[], score: Score | null) {
  const run = tasks.filter((t) => runOf(t.source) === info.run);
  const ids = new Set(run.map((t) => t.id));
  const uses = toolUses(events, ids);
  const asked = events.filter((e) => e.type === 'approval.asked' && ids.has(e.task)).map((e) => (e as { approval: { id: string; question: string } }).approval);
  const applications = [...new Set(uses.filter((u) => u.tool === 'credit-desk.crs').map((u) => u.input.application_id))];
  const onApplications = asked.filter((a) => /\[APP-/.test(a.question)).length;

  const decided = new Map<string, any>();
  for (const u of uses) if (u.tool === 'credit-desk.credit_decision' && u.ok && u.output?.status === 'recorded') decided.set(u.input.application_id, u.output.decision);
  // Bad credit stopped: what the simple rule would have extended to applicants the desk refused for fraud or declined.
  const stopped = (score?.simple_rule ?? []).filter((s: any) => s.outcome === 'approve' && ['fraud hold', 'decline'].includes(decided.get(s.application_id)?.outcome))
    .map((s: any) => ({ application_id: s.application_id, amount: s.limit, desk: decided.get(s.application_id).outcome }));
  // Payments stopped: supplier bills the desk held as suspected fraud or voided as duplicates.
  const billsFile = path.join(info.caseDir, 'bills.csv');
  const amount = new Map((fs.existsSync(billsFile) ? parseCsv(fs.readFileSync(billsFile, 'utf8')) : []).map((b) => [b.bill_id, Number(b.amount)]));
  const held = uses.filter((u) => u.tool === 'credit-desk.ap_action' && u.ok && u.output?.status === 'recorded' && ['void', 'refer as suspected fraud', 'hold'].includes(u.output.action.action));
  const exposureCut = uses.filter((u) => u.tool === 'credit-desk.review' && u.ok && u.output?.status === 'recorded' && u.output.now)
    .map((u) => ({ customer_id: u.output.review.customer_id, from: u.output.now.limit, to: u.output.review.limit }));

  // Elapsed: from the run starting to the last application decision, waits for the controller included.
  const started = events.find((e) => e.type === 'note' && (e.data as any)?.kind === 'run.started' && (e.data as any).info?.run === info.run)?.at;
  const at = new Map(events.map((e) => [e.seq, e.at]));
  const decidedAt = uses.filter((u) => u.tool === 'credit-desk.credit_decision' && u.ok && u.output?.status === 'recorded').map((u) => Date.parse(at.get(u.seq) ?? ''));
  const lastDecision = applications.length && decided.size === applications.length ? Math.max(...decidedAt) : NaN;

  const cents = run.reduce((n, t) => n + t.costCents, 0);
  const analystCents = run.filter((t) => t.title.startsWith('Credit analyst')).reduce((n, t) => n + t.costCents, 0);
  const n = applications.length;
  const humanMinutes = asked.length * ESTIMATES.review_minutes_per_request;
  const perApp = n ? (onApplications * ESTIMATES.review_minutes_per_request) / n : 0;
  return {
    run: info.run,
    case: info.caseId,
    scripted: run.some((t) => t.worker === 'fake'),
    applications: n,
    requests_to_a_person: asked.length,
    requests_on_applications: onApplications,
    human_minutes: humanMinutes,
    human_minutes_per_application: Math.round(perApp * 10) / 10,
    manual_minutes_per_application: ESTIMATES.manual_minutes_per_application,
    all_decided_within_minutes: started && !Number.isNaN(lastDecision) ? Math.round((lastDecision - Date.parse(started)) / 60000) : null,
    bad_credit_stopped: { total: stopped.reduce((s: number, x: any) => s + x.amount, 0), items: stopped },
    payments_stopped: (() => {
      const items = [...new Map(held.map((u) => [u.output.action.subject, { bill_id: u.output.action.subject, action: u.output.action.action, amount: amount.get(u.output.action.subject) ?? 0 }])).values()];
      return { total: items.reduce((s, x) => s + x.amount, 0), items };
    })(),
    exposure_cut: exposureCut,
    model_cost: { total_cents: cents, per_application_cents: n ? Math.round(analystCents / n) : null, note: 'Per application counts the credit analyst seat only; the total covers every seat.' },
    simple_rule: { approved: (score?.simple_rule ?? []).filter((s: any) => s.outcome === 'approve').reduce((s: number, x: any) => s + (x.limit ?? 0), 0), minutes: 0 },
    estimates: ESTIMATES,
  };
}

export type Impact = ReturnType<typeof impact>;
