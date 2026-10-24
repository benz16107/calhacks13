// The desk's memory is the box's action log. "What we knew at the time" is the log replayed up to the moment of a
// decision: the CRS answers and bank statements that task had read, the rule ids it cited, and who approved it.
import fs from 'node:fs';
import path from 'node:path';
import type { LogEvent } from '../../core/contract.ts';
import { parseCsv } from './check-case.ts';
import { ruleTexts, toolUses, type RunInfo } from './desk.ts';

const norm = (s: unknown) => String(s ?? '').toLowerCase().replace(/\b(llc|inc|co|corp|corporation|company)\b/g, '').replace(/[^a-z0-9]/g, '');

export interface Past {
  run: string;
  case: string;
  /** The case date the decision was made on. */
  case_date: string;
  /** When it was recorded on the box. */
  recorded_at: string;
  seq: number;
  task: string;
  application_id: string;
  business: string;
  decision: { outcome: string; band: string | null; limit: number; terms: string; rules: string[]; decided_by: string };
  why: string | null;
  approval: { by: string; at: string; person?: string } | null;
  asked: { requested: number | null; terms: string | null; stated_revenue: number | null; years_in_business: number | null };
  checks: { transunion: number | null; equifax: number | null; experian: number | null; identity: string; fraud_score: number | null; public_records: string; crs_request_ids: string[]; source: string } | null;
  bank: { months: number; average_monthly_deposits: number } | null;
  rules: { id: string; text: string }[];
}

const runsIn = (events: LogEvent[]) =>
  events.flatMap((e) => (e.type === 'note' && e.track === 'credit-desk' && (e.data as any)?.kind === 'run.started' ? [{ info: (e.data as any).info as RunInfo, at: e.at }] : []));

/** Every recorded credit decision for a business (matched by EIN, else by name), oldest first, as the log knew it then. */
export function pastDecisions(events: LogEvent[], who: { ein?: string; name?: string; application_id?: string }, before = Infinity): Past[] {
  const out: Past[] = [];
  const created = new Map<string, string>(); // task id -> run
  for (const e of events) if (e.type === 'task.created' && e.spec.source.startsWith('credit-desk:')) created.set(e.task, e.spec.source.slice('credit-desk:'.length));
  for (const { info } of runsIn(events)) {
    const appDir = path.join(info.caseDir, 'applications');
    if (!fs.existsSync(appDir)) continue;
    const meta = JSON.parse(fs.readFileSync(path.join(info.caseDir, 'case.json'), 'utf8'));
    const tasks = new Set([...created].filter(([, r]) => r === info.run).map(([t]) => t));
    // The log as of each decision: only events written before it count.
    const uses = toolUses(events, tasks).filter((u) => u.seq < before);
    for (const f of fs.readdirSync(appDir).filter((x) => x.endsWith('.json'))) {
      const a = JSON.parse(fs.readFileSync(path.join(appDir, f), 'utf8'));
      const match = (who.application_id && a.application_id === who.application_id) || (who.ein && norm(a.business?.ein) === norm(who.ein)) || (who.name && norm(a.business?.legal_name) === norm(who.name));
      if (!match) continue;
      const d = uses.findLast((u) => u.tool === 'credit-desk.credit_decision' && u.ok && u.output?.status === 'recorded' && u.input.application_id === a.application_id);
      if (!d) continue;
      const crs = uses.findLast((u) => u.tool === 'credit-desk.crs' && u.ok && u.task === d.task && u.seq < d.seq && u.input.application_id === a.application_id)?.output;
      const bankUse = uses.findLast((u) => u.tool === 'credit-desk.bank' && u.ok && u.task === d.task && u.seq < d.seq && u.input.application_id === a.application_id)?.output;
      const answered = d.output.decision.approval && events.find((e) => e.type === 'approval.answered' && e.id === d.output.decision.approval.id);
      const months = bankUse?.deposits?.length ?? 0;
      const texts = fs.existsSync(info.rulesFile) ? ruleTexts(info.rulesFile) : new Map<string, string>();
      const pr = crs?.public_records;
      out.push({
        run: info.run, case: info.caseId, case_date: meta.as_of, recorded_at: events.find((e) => e.seq === d.seq)?.at ?? '', seq: d.seq, task: d.task,
        application_id: a.application_id, business: a.business?.legal_name,
        decision: d.output.decision, why: d.input.why ?? null,
        approval: answered && answered.type === 'approval.answered' ? { by: answered.by, at: answered.at, person: (answered as any).person } : null,
        asked: { requested: a.request?.credit_limit ?? null, terms: a.request?.terms ?? null, stated_revenue: a.business?.annual_revenue ?? null, years_in_business: a.business?.years_in_business ?? null },
        checks: crs ? {
          transunion: crs.credit?.transunion?.score ?? null, equifax: crs.credit?.equifax?.score ?? null, experian: crs.credit?.experian?.score ?? null,
          identity: crs.identity?.verified ? 'verified' : crs.identity?.error ?? `failed (${(crs.identity?.problems ?? []).map((p: { code: string }) => p.code).join(', ')})`,
          fraud_score: crs.fraud?.risk_score ?? null,
          public_records: pr ? `${pr.bankruptcies?.length ?? 0} bankruptcies, ${pr.judgments?.length ?? 0} judgments, ${pr.liens?.length ?? 0} liens` : 'not read',
          crs_request_ids: JSON.stringify(crs).match(/"request_id":"([^"]+)"/g)?.map((m) => m.slice(14, -1)) ?? [], source: crs.source,
        } : null,
        bank: months ? { months, average_monthly_deposits: Math.round(bankUse.deposits.reduce((n: number, x: { amount: number }) => n + x.amount, 0) / months) } : null,
        rules: d.output.decision.rules.map((id: string) => ({ id, text: texts.get(id) ?? '' })),
      });
    }
  }
  return out.sort((x, y) => x.seq - y.seq);
}

export interface Now {
  case: string;
  case_date: string;
  limit: number;
  terms: string;
  system_open_balance: number;
  returned_payments: { payment_id: string; amount: number; date: string; reason: string }[];
  open_balance: number;
  oldest_days_past_due: number;
  open_orders: { order_id: string; amount: number }[];
}

/** The customer as the current case and the bank show it now. `returns` are the bank's returned items. */
export function customerNow(caseDir: string, customerId: string, returns: { payment_id: string; amount: number; date: string; reason: string }[]): Now {
  const read = (f: string) => (fs.existsSync(path.join(caseDir, f)) ? parseCsv(fs.readFileSync(path.join(caseDir, f), 'utf8')) : []);
  const meta = JSON.parse(fs.readFileSync(path.join(caseDir, 'case.json'), 'utf8'));
  const c = read('customers.csv').find((x) => x.customer_id === customerId);
  if (!c) throw new Error(`no customer ${customerId} in this case`);
  const invoices = read('invoices.csv').filter((i) => i.customer_id === customerId);
  const payments = read('payments.csv').filter((p) => p.customer_id === customerId);
  const mine = returns.filter((r) => payments.some((p) => p.payment_id === r.payment_id));
  const reopened = new Set(mine.map((r) => payments.find((p) => p.payment_id === r.payment_id)!.applied_invoice_id));
  const open = invoices.filter((i) => Number(i.balance) > 0 || reopened.has(i.invoice_id));
  const dpd = (due: string) => Math.round((Date.parse(meta.as_of) - Date.parse(due)) / 86400000);
  return {
    case: meta.case_id, case_date: meta.as_of, limit: Number(c.credit_limit), terms: c.terms,
    system_open_balance: invoices.reduce((n, i) => n + Number(i.balance || 0), 0),
    returned_payments: mine,
    open_balance: open.reduce((n, i) => n + (reopened.has(i.invoice_id) ? Number(i.total) : Number(i.balance)), 0),
    oldest_days_past_due: Math.max(0, ...open.map((i) => dpd(i.due_date))),
    open_orders: read('orders.csv').filter((o) => o.customer_id === customerId).map((o) => ({ order_id: o.order_id, amount: Number(o.amount) })),
  };
}

/** Plain sentences for what changed between a past decision and now. */
export function changes(then: Past, now: Now): string[] {
  const out: string[] = [];
  const usd = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (now.returned_payments.length) {
    out.push(`${now.returned_payments.length} payment${now.returned_payments.length > 1 ? 's' : ''} returned by the bank since then: ` +
      now.returned_payments.map((r) => `${r.payment_id} ${usd(r.amount)} on ${r.date} (${r.reason})`).join('; ') + '.');
  }
  if (now.open_balance !== now.system_open_balance) out.push(`The books show ${usd(now.system_open_balance)} open; with the returned payments it is really ${usd(now.open_balance)}.`);
  if (now.oldest_days_past_due > 0) out.push(`The oldest unpaid invoice is ${now.oldest_days_past_due} days past due. In ${new Date(`${then.case_date}T12:00:00Z`).toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })} the customer had no history with us.`);
  if (now.open_orders.length) out.push(`Waiting to ship: ${now.open_orders.map((o) => `${o.order_id} ${usd(o.amount)}`).join(', ')}.`);
  if (now.limit !== then.decision.limit) out.push(`The limit on the customer record is ${usd(now.limit)}; the desk set ${usd(then.decision.limit)}.`);
  return out;
}

/** Reviews recorded after a decision for the same business (by EIN): does the decision still hold? */
export function laterReviews(events: LogEvent[], ein: string, after: number) {
  return events.flatMap((e) => {
    if (e.type !== 'tool.result' || e.seq <= after || !e.ok) return [];
    const o = e.output as any;
    return o?.status === 'recorded' && o.review && norm(o.review.ein) === norm(ein) ? [{ seq: e.seq, at: e.at, review: o.review }] : [];
  });
}
