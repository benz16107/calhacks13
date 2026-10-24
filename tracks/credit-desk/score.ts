// Scores a run against the case's answer_key.json, from the box's log alone.
// A planted error is caught when a finding names one of its rows and is about the same problem (closest wording,
// rule ids included). Decisions are compared field by field. The simple rule is the rules file's baseline.
import fs from 'node:fs';
import path from 'node:path';
import type { LogEvent, Task } from '../../core/contract.ts';
import { toolUses, type RunInfo, type ToolUse } from './desk.ts';
import { DUNNING } from './seats.ts';

const STOP = new Set('the and for with that this from are was not but its has have had any all one per into than then them they their there what when who will would should could also only more most less such each other been were which while about after before over under onto off out own same very can may'.split(' '));
const ID = /\b[A-Z]{1,4}-\d{3,6}\b/g;
const tokens = (s: string) =>
  new Set((s.toLowerCase().replace(/(\d),(\d)/g, '$1$2').match(/[a-z0-9]+(?:[-.][a-z0-9]+)*/g) ?? []).filter((w) => w.length > 2 && !STOP.has(w)));
function similarity(a: Set<string>, b: Set<string>) {
  let n = 0;
  for (const w of a) if (b.has(w)) n++;
  return a.size && b.size ? n / Math.sqrt(a.size * b.size) : 0;
}
/** A finding at least this close in wording to a 'fine' entry is about the same thing. Below it, a person judges it. */
const FINE_MIN = 0.15;
const locId = (w: { file: string; id?: string }) => w.id ?? path.basename(w.file).replace(/\.json$/, '');

const recorded = (uses: ToolUse[], tool: string) => uses.filter((u) => u.tool === tool && u.ok && u.output?.status === 'recorded');
/** The last recorded entry per subject wins: a seat may revise itself. */
function lastBy<T>(items: T[], key: (t: T) => string) {
  const m = new Map<string, T>();
  for (const i of items) m.set(key(i), i);
  return m;
}

export function scoreRun(info: RunInfo, events: LogEvent[], tasks: Task[]) {
  const key = JSON.parse(fs.readFileSync(path.join(info.caseDir, 'answer_key.json'), 'utf8'));
  const runTasks = tasks.filter((t) => t.source === `credit-desk:${info.run}`);
  const uses = toolUses(events, new Set(runTasks.map((t) => t.id)));

  // ---------- planted errors ----------
  const findings = uses.filter((u) => u.tool === 'credit-desk.flag' && u.ok).map((u, i) => {
    const text = [u.input.problem, u.input.detail, u.input.conclusion].join(' ');
    const ids = new Set<string>([...(u.input.ids ?? []).map(String), ...(text.match(ID) ?? [])]);
    return { n: i + 1, task: u.task, ids, text, words: tokens(`${text} ${(u.input.rules ?? []).join(' ')}`), input: u.input };
  });
  const targets = [
    ...(key.planted_errors ?? []).map((e: any) => ({ kind: 'error', e, ids: new Set<string>(e.where.map(locId)), words: tokens(`${e.category} ${e.title} ${e.what_is_wrong} ${e.correct_conclusion} ${(e.rules ?? []).join(' ')}`) })),
    ...(key.not_errors ?? []).map((e: any) => ({ kind: 'fine', e, ids: new Set<string>(e.where.map(locId)), words: tokens(e.why_fine) })),
  ];
  // Each finding goes to its closest target among those sharing a row. Two seats flagging the same error is one
  // catch and a repeat, never a false alarm. It is a false alarm only when it is about what the key calls fine.
  const placed = new Map<number, { t: (typeof targets)[number]; s: number; words: number }>();
  for (const f of findings) {
    for (const t of targets) {
      const shared = [...f.ids].filter((id) => t.ids.has(id)).length;
      const words = similarity(f.words, t.words);
      const s = words + 0.05 * shared;
      if (shared && (t.kind === 'error' || words >= FINE_MIN) && s > (placed.get(f.n)?.s ?? 0)) placed.set(f.n, { t, s, words });
    }
  }
  const caughtBy = new Map<string, { f: (typeof findings)[number]; words: number }>();
  for (const f of findings) {
    const p = placed.get(f.n);
    if (p?.t.kind === 'error' && p.words > (caughtBy.get(p.t.e.id)?.words ?? -1)) caughtBy.set(p.t.e.id, { f, words: p.words });
  }
  const errors = (key.planted_errors ?? []).map((e: any) => ({
    id: e.id, title: e.title, caught: caughtBy.has(e.id), by: caughtBy.get(e.id)?.f.input.problem ?? null,
    findings: findings.filter((f) => placed.get(f.n)?.t.e === e).length,
  }));
  const falseAlarms = findings.filter((f) => placed.get(f.n)?.t.kind === 'fine').map((f) => ({ problem: f.input.problem, ids: [...f.ids], key_says: placed.get(f.n)!.t.e.why_fine }));
  const other = findings.filter((f) => !placed.has(f.n)).map((f) => ({ problem: f.input.problem, ids: [...f.ids] }));

  // ---------- application decisions ----------
  const credit = lastBy(recorded(uses, 'credit-desk.credit_decision'), (u) => u.input.application_id);
  const crs = lastBy(uses.filter((u) => u.tool === 'credit-desk.crs' && u.ok), (u) => u.input.application_id);
  const norm = (s: unknown) => String(s ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
  const applications = (key.application_decisions ?? []).map((d: any) => {
    const want = {
      outcome: /fraud/.test(d.desk.outcome) ? 'fraud hold' : /decline/.test(d.desk.outcome) ? 'decline' : /cash/.test(d.desk.outcome) ? 'cash in advance' : 'approve',
      limit: d.desk.limit, terms: norm(d.desk.terms), band: d.desk.band, controller: /controller/.test(d.desk.decided_by),
    };
    const u = credit.get(d.application_id);
    const dec = u?.output.decision;
    const got = dec && { outcome: dec.outcome, limit: Number(dec.limit ?? 0), terms: norm(dec.terms), band: dec.band, controller: Boolean(dec.approval) };
    const fields = got ? (want.outcome === 'approve' ? (['outcome', 'limit', 'terms', 'band', 'controller'] as const) : (['outcome', 'controller'] as const)) : [];
    const wrong = got ? fields.filter((k) => String(got[k]) !== String(want[k])) : ['no decision recorded'];
    return { application_id: d.application_id, match: wrong.length === 0, wrong, want, got: got ?? null, decided_by: dec?.decided_by ?? null };
  });

  // ---------- the simple rule, on the same CRS answers ----------
  const simple = (key.application_decisions ?? []).map((d: any) => {
    const file = path.join(info.caseDir, 'applications', `${d.application_id}.json`);
    const a = JSON.parse(fs.readFileSync(file, 'utf8'));
    const tu = crs.get(d.application_id)?.output?.credit?.transunion?.score;
    if (tu == null) return { application_id: d.application_id, outcome: 'not computed (no CRS result in this run)' };
    const ok = tu >= 620 && !a.declarations?.bankruptcy_last_7_years && a.business.years_in_business >= 2 && a.request.credit_limit <= 0.1 * a.business.annual_revenue;
    return { application_id: d.application_id, outcome: ok ? 'approve' : 'decline', limit: ok ? a.request.credit_limit : 0, transunion_score: tu };
  });
  const moment = simple.filter((s: any) => s.outcome === 'approve' && credit.get(s.application_id)?.output.decision.outcome === 'fraud hold')
    .map((s: any) => ({ application_id: s.application_id, simple_rule: `approve $${s.limit.toLocaleString('en-US')}`, desk: 'fraud hold', decided_by: credit.get(s.application_id)?.output.decision.decided_by }));

  // ---------- collections and orders ----------
  const actions = recorded(uses, 'credit-desk.collections_action');
  // The answer key writes steps as 'phone call; hold new orders'; the first part is the action.
  const collections = (key.collections ?? []).map((c: any) => {
    const want = norm(c.dunning_step) === 'none' ? 'no action' : (DUNNING.find((x) => norm(c.dunning_step).startsWith(x)) ?? norm(c.dunning_step));
    const got = actions.filter((u) => u.output.action.subject === c.customer_id && DUNNING.includes(u.output.action.action)).map((u) => u.output.action.action);
    const match = want === 'no action' ? got.length > 0 && got.every((g) => g === 'no action') : got.includes(want);
    return { customer_id: c.customer_id, match, want, got };
  });
  const orderActs = lastBy(actions.filter((u) => ['hold order', 'release order'].includes(u.output.action.action)), (u) => u.output.action.subject);
  const orders = (key.order_decisions ?? []).map((o: any) => {
    const got = orderActs.get(o.order_id)?.output.action.action.replace(' order', '') ?? null;
    return { order_id: o.order_id, match: got === o.decision, want: o.decision, got };
  });

  // ---------- supplier bills (the AP clerk) ----------
  const paidBy = new Map<string, any>();
  for (const u of uses) if (u.tool === 'credit-desk.pay_bill' && u.ok && u.output?.status === 'paid') paidBy.set(u.output.payment.bill_id, u.output.payment);
  const apActs = lastBy(recorded(uses, 'credit-desk.ap_action'), (u) => u.output.action.subject);
  const entered = recorded(uses, 'credit-desk.enter_bill').map((u) => u.output.bill);
  const bills = (key.ap_decisions ?? []).map((b: any) => {
    const want = String(b.decision).startsWith('enter') ? 'enter' : b.decision;
    let got: string | null;
    if (want === 'enter') {
      const e = entered.find((x: any) => x.supplier_invoice === b.bill_id);
      const p = e && paidBy.get(e.bill_id);
      got = !e ? null : p && !p.approval ? 'paid alone' : 'enter';
    } else {
      const p = paidBy.get(b.bill_id);
      const act = apActs.get(b.bill_id)?.output.action.action;
      got = p ? 'pay' : act === 'refer as suspected fraud' ? 'hold' : act ?? null;
    }
    const who = paidBy.get(b.bill_id)?.approval ? 'controller' : 'AP clerk';
    const match = got === want && (want !== 'pay' || who === b.who);
    return { bill_id: b.bill_id, match, want: `${want}${want === 'pay' ? ` (${b.who})` : ''}`, got: got && got === 'pay' ? `pay (${who})` : got };
  });

  // ---------- reviews of past decisions ----------
  const reviewed = lastBy(recorded(uses, 'credit-desk.review'), (u) => u.output.review.customer_id);
  const reviews = (key.review_decisions ?? []).map((r: any) => {
    const got = reviewed.get(r.customer_id)?.output.review;
    const want = { outcome: r.outcome, band: r.band, limit: r.limit, terms: norm(r.terms), controller: /controller/.test(r.decided_by) };
    const g = got && { outcome: got.outcome, band: got.band, limit: Number(got.limit), terms: norm(got.terms), controller: Boolean(got.approval) };
    const wrong = g ? (Object.keys(want) as (keyof typeof want)[]).filter((k) => String(g[k]) !== String(want[k])) : ['no review recorded'];
    return { customer_id: r.customer_id, reopens: r.reopens, match: wrong.length === 0, wrong, want, got: g ?? null, reopened: got?.reopens ?? null };
  });

  const count = (xs: { match?: boolean; caught?: boolean }[]) => xs.filter((x) => x.match ?? x.caught).length;
  const caught = count(errors);
  // Precision: of the findings the answer key can judge, how many were about a real planted error.
  const onErrors = findings.filter((f) => placed.get(f.n)?.t.kind === 'error').length;
  const judged = onErrors + falseAlarms.length;
  const parts = [
    [applications, 'credit decisions'], [reviews, 'reviews'], [collections, 'collection steps'], [orders, 'order decisions'], [bills, 'supplier bills'],
  ].filter(([xs]) => (xs as unknown[]).length).map(([xs, name]) => `${count(xs as { match: boolean }[])} of ${(xs as unknown[]).length} ${name}`);
  return {
    run: info.run,
    case: info.caseId,
    summary: `caught ${caught} of ${errors.length} planted errors; ${falseAlarms.length} false alarm${falseAlarms.length === 1 ? '' : 's'}` +
      (judged ? ` (precision ${Math.round((100 * onErrors) / judged)}%)` : '') + `; ${parts.join(', ')} match the answer key`,
    caught,
    total: errors.length,
    precision: judged ? onErrors / judged : null,
    errors,
    false_alarms: falseAlarms,
    other_findings: other,
    decisions: { applications, reviews, collections, orders, bills },
    simple_rule: simple,
    moment,
  };
}

export type Score = ReturnType<typeof scoreRun>;
