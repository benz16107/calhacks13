// A reason for every credit pull. The box lets a seat pull a person's CRS reports only for a stated purpose, on a
// named application or customer, and only a limited number of times per task. The rule is modelled on the permissible
// purposes in the Fair Credit Reporting Act, 15 U.S.C. 1681b(a). It is the desk's own control, not a statement that the
// desk is legally compliant: the sandbox only holds test people, and the statute has more conditions than a tool can check.
import fs from 'node:fs';
import path from 'node:path';
import type { Ctx } from '../../core/contract.ts';
import { application, caseFile, controllerGate, marker, readLog, runInfo, runOf, safeId, toolUses } from './desk.ts';

export const PURPOSES: Record<string, { basis: string; for: string }> = {
  'credit-application': { basis: '15 U.S.C. 1681b(a)(2): written instructions of the consumer', for: 'an application the guarantor signed a credit check consent for' },
  'account-review': { basis: '15 U.S.C. 1681b(a)(3)(A): review of an existing account of the consumer', for: 'a customer already on the books, with consent on file' },
};
/** A pull for an application older than this, or already decided, is outside a live application and asks first. */
export const LIVE_DAYS = 30;

export interface PullFacts {
  asOf: string;
  /** Present for an application. */
  app?: { id: string; receivedAt: string; consent: boolean; guaranteeSigned: boolean; decided: boolean };
  /** Present for an existing customer: the guarantor on file and when consent was given. */
  customer?: { id: string; consent: string | null };
  /** Pulls this task has made, this one included. */
  pulls: number;
  limit: number;
}

export type PullVerdict =
  | { ok: true; subject: string; purpose: string; basis: string }
  | { ok: false; refuse: string }
  | { ok: false; ask: { subject: string; why: string } };

/** The rule, pure so it can be tested: may this task pull this subject for this purpose now? */
export function judge(input: { purpose?: unknown; application_id?: unknown; customer_id?: unknown }, f: PullFacts): PullVerdict {
  const purpose = String(input.purpose ?? '');
  const p = PURPOSES[purpose];
  if (!p) return { ok: false, refuse: `name a purpose: ${Object.keys(PURPOSES).join(' or ')}. A credit pull without a stated reason is not made.` };
  if (Boolean(input.application_id) === Boolean(input.customer_id)) return { ok: false, refuse: 'name exactly one of application_id or customer_id: every pull is tied to an application or an account.' };
  if (f.pulls > f.limit) return { ok: false, refuse: `this task has used its ${f.limit} credit pulls. A task cannot pull more reports than the case has applications and accounts, plus one.` };
  if (input.application_id) {
    if (purpose !== 'credit-application') return { ok: false, refuse: `an application is pulled for credit-application, not ${purpose}.` };
    const a = f.app!;
    if (!a.consent || !a.guaranteeSigned) return { ok: false, refuse: `${a.id} has no signed credit check consent and personal guarantee, so there is no permissible purpose to pull.` };
    const age = (Date.parse(f.asOf) - Date.parse(a.receivedAt)) / 86_400_000;
    if (a.decided) return { ok: false, ask: { subject: a.id, why: 'the desk has already decided it, so it is no longer a live application' } };
    if (age > LIVE_DAYS) return { ok: false, ask: { subject: a.id, why: `it was received ${Math.floor(age)} days before the case date, past the ${LIVE_DAYS} days a pull stays live` } };
    return { ok: true, subject: a.id, purpose, basis: p.basis };
  }
  if (purpose !== 'account-review') return { ok: false, refuse: `a customer is pulled for account-review, not ${purpose}.` };
  const c = f.customer!;
  if (!c.consent) return { ok: false, refuse: `${c.id} has no consent on file for a review pull.` };
  return { ok: true, subject: c.id, purpose, basis: p.basis };
}

export const PULLS_TOOL = 'credit-desk.crs';

// consent_on_file is the date of a signed consent that covers reviews (REV-5). Without it a customer is never pulled.
type Guarantors = Record<string, { consent_on_file: string | null; guarantor: Record<string, unknown>; then?: Record<string, any> }>;
// Read from the original case, never from the seat's workspace: the seats must not see a guarantor's identity.
export const guarantorsOf = (ctx: Ctx): Guarantors => {
  const info = runInfo(readLog(), runOf(ctx.task?.source ?? '') ?? '');
  const f = info ? path.join(info.caseDir, 'sources', 'guarantors.json') : '';
  const all = f && fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : {};
  return Object.fromEntries(Object.entries(all).filter(([k]) => !k.startsWith('_'))) as Guarantors; // _note keys are for people
};

export type Guard = { refused: { status: 'refused'; why: string; then: string } } | { pending: { status: string; ask: string; then: string } } | { app: any; pull: { subject: string; purpose: string; basis: string; number: number; limit: number } };

/** The checks in front of `credit-desk.crs`. Throws a refusal, returns a question for the controller, or lets the pull go. */
export function guardPull(input: any, ctx: Ctx): Guard {
  const task = ctx.task!;
  const meta = JSON.parse(fs.readFileSync(caseFile(ctx, 'case', 'case.json'), 'utf8'));
  const events = readLog();
  const run = runOf(task.source);
  const siblings = new Set(ctx.box.tasks().filter((t) => runOf(t.source) === run).map((t) => t.id));
  const used = toolUses(events, siblings);
  // Pulls that went through, plus this one. A question that is still waiting for the controller is not a pull yet.
  const mine = used.filter((u) => u.task === task.id && u.tool === PULLS_TOOL && u.ok && u.output?.pull).length + 1;
  const guarantors = guarantorsOf(ctx);
  const apps = fs.existsSync(caseFile(ctx, 'case', 'applications')) ? fs.readdirSync(caseFile(ctx, 'case', 'applications')).filter((f) => f.endsWith('.json')).length : 0;
  const limit = Math.max(2, apps + Object.keys(guarantors).length) + 1;
  // A refusal is an answer, not a crash: the seat keeps working, and the refusal is in the log with its reason.
  const refuse = (why: string): Guard => {
    ctx.box.note({ kind: 'crs.refused', subject: input.application_id ?? input.customer_id ?? null, purpose: input.purpose ?? null, why }, task.id);
    return { refused: { status: 'refused', why, then: 'No report was pulled. A pull needs a stated purpose, a live application or an account with consent on file, and a task has only so many pulls. Do not try to get around this.' } };
  };
  const facts: PullFacts = { asOf: meta.as_of, pulls: mine, limit };
  let subjectApp: any;
  if (input.application_id) {
    const a = (subjectApp = application(ctx, input.application_id));
    facts.app = {
      id: a.application_id, receivedAt: a.received_at, consent: a.declarations?.credit_check_authorized === true, guaranteeSigned: a.declarations?.personal_guarantee_signed === true,
      decided: used.some((u) => u.tool === 'credit-desk.credit_decision' && u.ok && u.output?.status === 'recorded' && u.input?.application_id === a.application_id),
    };
  } else if (input.customer_id) {
    const id = safeId(input.customer_id);
    const g = guarantors[id];
    if (!g) return refuse(`${id} has no guarantor on file in this case, so there is nobody to pull.`);
    facts.customer = { id, consent: g.consent_on_file };
    subjectApp = { application_id: id, guarantor: g.guarantor, submitted_from_ip: undefined, then: g.then };
  }
  const v = judge(input, facts);
  if ('refuse' in v) return refuse(v.refuse);
  if ('ask' in v) {
    const mark = marker(v.ask.subject, 'pull');
    const q = `Credit desk ${mark}: the credit analyst asks to pull the CRS reports for ${v.ask.subject} (purpose: ${input.purpose}), but ${v.ask.why}. Allow this one pull? Rules: CHK-1.`;
    const gate = controllerGate(ctx, mark, q);
    if (gate.pending) return { pending: gate.pending };
    if (!gate.approval!.approved) return refuse(`the controller did not allow a pull outside a live application${gate.approval!.reason ? `: "${gate.approval!.reason}"` : ''}.`);
    return { app: subjectApp, pull: { subject: v.ask.subject, purpose: String(input.purpose), basis: `${PURPOSES[input.purpose].basis}; outside a live application, allowed by ${gate.approval!.by}`, number: mine, limit } };
  }
  return { app: subjectApp, pull: { subject: v.subject, purpose: v.purpose, basis: v.basis, number: mine, limit } };
}
