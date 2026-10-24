// GurtOS Business: one box shared by a company. People hold roles, agents hold seats, and a policy in plain words
// sends each approval to the people who may answer it. Pure functions; core/box.ts keeps the state and the files.
import type { ApprovalRoute, LogEvent, Task, Who } from './contract.ts';
import type { Sso } from './sso.ts';

export const ROLES = ['owner', 'admin', 'approver', 'requester', 'auditor'] as const;
export type Role = (typeof ROLES)[number];
/** Roles that may answer a request, when the policy sends it to them and it is within their limit. */
const ANSWERS: Role[] = ['owner', 'admin', 'approver'];

export interface Person {
  /** Short and stable, like 'rosa'. The log refers to people by it. */
  id: string;
  name: string;
  role: Role;
  /** Job title, for people to read: 'Controller', 'Sales'. */
  title?: string;
  /** The most this person may approve, in US cents. null means no limit. Approvers must have one. */
  limitCents: number | null;
  /** The names in the policy this person approves for: 'Controller', 'IT'. */
  approvesFor: string[];
  /** Their work address, from a work-account sign-in. Kept in the box's state only, never in the log. */
  email?: string;
}

/** An agent seat, for people to read: what it does and how far it may go on its own. */
export interface Seat {
  name: string;
  about?: string;
  may?: string;
}

export interface Business {
  on: boolean;
  company: string;
  policy: string;
  people: Person[];
  seats: Seat[];
  /** Seats in shadow mode: their decisions are suggestions a person decides. Empty takes every seat live. */
  shadow: string[];
  /** Who last changed each line of the policy, and when. */
  policyMeta: Record<string, { by: string; at: string }>;
  /** Sign-in with work accounts (OpenID Connect), when an admin set it up. */
  sso?: Sso;
}

/** Agent seats, checked: at most 20, each a name and two short lines. */
export function checkSeats(v: unknown): Seat[] {
  const text = (x: unknown, max: number) => x === undefined || (typeof x === 'string' && x.length <= max);
  if (!Array.isArray(v) || v.length > 20 || v.some((s) => !s || typeof s !== 'object' || typeof s.name !== 'string' || !s.name.trim() || s.name.length > 60 || !text(s.about, 120) || !text(s.may, 80))) {
    throw new Error('seats: up to 20 of {name, about?, may?}, like {"name": "Credit analyst", "about": "checks new customers through CRS", "may": "Up to $10,000; above, proposes"}');
  }
  return v.map((s) => ({ name: s.name.trim(), ...(s.about ? { about: s.about } : {}), ...(s.may ? { may: s.may } : {}) }));
}

/** The shadow setting, checked: names of seats on this box. */
export function checkShadow(v: unknown, seats: Seat[]): string[] {
  if (!Array.isArray(v) || v.some((s) => typeof s !== 'string')) throw new Error('shadow: a list of seat names, like ["Credit analyst"], or [] for none');
  const out = v.map((s) => seats.find((x) => x.name.toLowerCase() === s.trim().toLowerCase())?.name ?? '');
  const bad = v.filter((_, i) => !out[i]);
  if (bad.length) throw new Error(`shadow: no seat named ${bad.join(', ')} (seats: ${[...new Set(seats.map((x) => x.name))].join(', ') || 'none yet'}; declare one with PUT /api/business {seats}, or run a task with that seat)`);
  return [...new Set(out)];
}

export const DEFAULT_POLICY = `# Who approves what. One rule per line, in plain words. The first rule that matches decides.
# Examples: "Over $10,000 goes to the Controller."  "Fraud referrals go to the Controller."  "Production changes go to IT."
Everything goes to any approver.
`;

export const dollars = (cents: number) => `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: cents % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
/** Compare policy names loosely: case, a leading "the" or "any", and a plural s don't matter. */
const key = (s: string) => s.toLowerCase().trim().replace(/\.$/, '').replace(/^(the|any|an|a|all)\s+/, '').replace(/s$/, '');

// ---------- people ----------

/** A new or changed person, checked. With the id of someone who exists, the fields given change and the rest stay. */
export function checkPerson(input: unknown, people: Person[]): Person {
  if (!isObj(input)) throw new Error('send a person: {name, role}, and for an approver {limitCents, approvesFor}');
  const fields = ['id', 'name', 'role', 'title', 'limitCents', 'approvesFor', 'email'];
  const unknown = Object.keys(input).filter((k) => !fields.includes(k));
  if (unknown.length) throw new Error(`unknown field${unknown.length > 1 ? 's' : ''}: ${unknown.join(', ')} (known: ${fields.join(', ')})`);
  const old = typeof input.id === 'string' ? people.find((p) => p.id === input.id) : undefined;
  const p = { limitCents: null, approvesFor: [], ...old, ...input } as Record<string, unknown>;
  if (typeof p.name !== 'string' || !p.name.trim() || p.name.length > 60) throw new Error('name: text, 1 to 60 characters');
  if (!ROLES.includes(p.role as Role)) throw new Error(`role: one of ${ROLES.join(', ')}`);
  if (p.title !== undefined && (typeof p.title !== 'string' || p.title.length > 40)) throw new Error('title: text, at most 40 characters');
  if (p.email !== undefined && (typeof p.email !== 'string' || p.email.length > 120 || !/^[^\s@]+@[^\s@]+$/.test(p.email))) throw new Error('email: an address, at most 120 characters');
  if (p.limitCents !== null && (!Number.isInteger(p.limitCents) || (p.limitCents as number) < 0 || (p.limitCents as number) > 1e12)) throw new Error('limitCents: a whole number of cents, or null for no limit');
  if (p.role === 'approver' && p.limitCents === null) throw new Error('limitCents: an approver needs a spending limit, in US cents ($50,000 is 5000000)');
  if (!Array.isArray(p.approvesFor) || p.approvesFor.length > 10 || p.approvesFor.some((g) => typeof g !== 'string' || !/^[\w &.'-]{1,40}$/.test(g))) {
    throw new Error('approvesFor: up to 10 names from the policy, like ["Controller"] or ["IT"]');
  }
  let id = old?.id ?? (typeof input.id === 'string' ? input.id : '');
  if (!old) {
    if (id && !/^[a-z][a-z0-9-]{0,30}$/.test(id)) throw new Error('id: lowercase letters, digits and -, starting with a letter');
    if (!id) {
      const base = (p.name as string).trim().split(/\s+/)[0].toLowerCase().replace(/[^a-z0-9]/g, '') || 'person';
      id = /^[a-z]/.test(base) ? base : `p${base}`;
      for (let i = 2; people.some((x) => x.id === id); i++) id = `${base}-${i}`;
    }
  }
  return {
    id,
    name: (p.name as string).trim(),
    role: p.role as Role,
    ...(p.title ? { title: p.title as string } : {}),
    limitCents: p.limitCents as number | null,
    approvesFor: [...new Set((p.approvesFor as string[]).map((g) => g.trim()))],
    ...(p.email ? { email: p.email as string } : {}),
  };
}

// ---------- the policy ----------

export interface Rule {
  /** The line as written, ending in a period. */
  line: string;
  /** Who it goes to, as written: 'the Controller'. */
  to: string;
  any?: boolean;
  /** Matches only above this amount, in US cents. */
  overCents?: number;
  /** Words the request must contain, like 'fraud referral'. */
  phrase?: string;
  /** The app the request must come from, like 'credit desk'. */
  app?: string;
  /** "... can't be approved in GurtOS": a ceiling. It applies whatever its place in the list. */
  blocked?: boolean;
}

/**
 * Read a policy: one rule per line, "<which requests> go(es) to <who>", the first match decides. Which requests:
 * "Everything" or "Everything else"; "Over $10,000" (also "above", "more than"); words the request contains
 * ("Fraud referrals"); "Requests from the credit desk"; or words with an amount ("Payments over $500"). Who: a name
 * people approve for ("the Controller", "IT"), or a role ("any approver", "an admin", "the owner"). # starts a comment.
 */
export function parsePolicy(text: string): Rule[] {
  if (typeof text !== 'string' || text.length > 8000) throw new Error('policy: text, at most 8,000 characters');
  goLiveRules(text); // throws naming a go-live line it can't read
  const rules: Rule[] = [];
  for (const [i, raw] of text.split('\n').entries()) {
    const line = raw.replace(/#.*$/, '').trim();
    if (!line || GOES_LIVE.test(line)) continue;
    const ceiling = /^(.+?)\s+(?:can['’]?t|cannot) be approved(?:\s+in\s+gurtos)?\.?$/i.exec(line);
    const m = ceiling ? [line, ceiling[1], 'nobody'] : /^(.+?)\s+go(?:es)?\s+to\s+(.+?)(?:\s+for approval)?\.?$/i.exec(line);
    if (!m || !key(m[2])) throw new Error(`policy line ${i + 1}: "${line.slice(0, 80)}" needs "goes to", like "Over $10,000 goes to the Controller."`);
    const rule: Rule = { line: line.replace(/\.?$/, '.'), to: m[2].trim(), ...(ceiling ? { blocked: true } : {}) };
    let when = m[1].trim().toLowerCase();
    if (/^(everything|anything)( else)?$/.test(when)) rule.any = true;
    else {
      const amount = /(?:^|\s)(?:over|above|more than)\s+\$([\d,]+(?:\.\d{1,2})?)$/.exec(when);
      if (amount) {
        rule.overCents = Math.round(Number(amount[1].replace(/,/g, '')) * 100);
        when = when.slice(0, amount.index).trim();
      }
      const from = /^(?:requests?\s+|anything\s+)?from\s+(?:the\s+)?(.+)$/.exec(when);
      if (from) rule.app = from[1];
      else if (!/^(|requests?|anything|spending|spends?|amounts?)$/.test(when)) rule.phrase = when;
    }
    rules.push(rule);
  }
  if (!rules.length) throw new Error('policy: at least one rule, like "Everything goes to any approver."');
  return rules;
}

// ---------- shadow mode and going live ----------

const GOES_LIVE = /\bgoes\s+live\b/i;
const GO_LIVE = /^(?:the\s+)?(.+?)\s+goes\s+live\s+after\s+(\d+)\s+suggestions?\s+(?:with|at)\s+(\d+(?:\.\d+)?)\s*%\s+agreement\.?$/i;

export interface GoLive {
  seat: string;
  /** Answered suggestions needed. */
  after: number;
  /** Agreement needed, in percent. */
  percent: number;
  line: string;
}

/** The policy's go-live lines: "The Credit analyst goes live after 20 suggestions with 95% agreement." */
export function goLiveRules(text: string): GoLive[] {
  const out: GoLive[] = [];
  for (const [i, raw] of text.split('\n').entries()) {
    const line = raw.replace(/#.*$/, '').trim();
    if (!GOES_LIVE.test(line)) continue;
    const m = GO_LIVE.exec(line);
    if (!m || +m[2] < 1 || +m[3] > 100) throw new Error(`policy line ${i + 1}: "${line.slice(0, 80)}" should read like "The Credit analyst goes live after 20 suggestions with 95% agreement."`);
    out.push({ seat: m[1].trim(), after: +m[2], percent: +m[3], line: line.replace(/\.?$/, '.') });
  }
  return out;
}

export interface Pilot {
  seat: string;
  shadow: boolean;
  suggested: number;
  /** Suggestions a person answered, and how many of those they decided the same. */
  answered: number;
  agreed: number;
  /** agreed over answered, rounded; null before the first answer. */
  percent: number | null;
  goLive: GoLive | null;
  /** In shadow and the policy's threshold is met: an admin may take it live. */
  ready: boolean;
  disagreements: { approval: string; task: string; at: string; question: string; by: string }[];
}

/**
 * Each seat's shadow record, from the log: every suggestion (an approval with `shadow`) and how a person answered
 * it. Answers with no person (a task that ended first) don't count.
 */
export function pilot(events: LogEvent[], shadow: string[], goLive: GoLive[], seats: string[]): Pilot[] {
  const by = new Map<string, Pilot>();
  const get = (seat: string) => {
    const k = seat.toLowerCase();
    if (!by.has(k)) by.set(k, { seat, shadow: false, suggested: 0, answered: 0, agreed: 0, percent: null, goLive: null, ready: false, disagreements: [] });
    return by.get(k)!;
  };
  for (const s of [...seats, ...shadow, ...goLive.map((g) => g.seat)]) get(s);
  const asked = new Map<string, { seat: string; question: string }>();
  for (const e of events) {
    if (e.type === 'approval.asked' && e.approval.shadow) {
      asked.set(e.approval.id, { seat: e.approval.shadow, question: e.approval.question });
      get(e.approval.shadow).suggested++;
    } else if (e.type === 'approval.answered' && e.person && asked.has(e.id)) {
      const { seat, question } = asked.get(e.id)!;
      const p = get(seat);
      p.answered++;
      if (e.approved) p.agreed++;
      else p.disagreements.push({ approval: e.id, task: e.task, at: e.at, question, by: e.by });
    }
  }
  for (const p of by.values()) {
    p.shadow = shadow.some((s) => s.toLowerCase() === p.seat.toLowerCase());
    p.goLive = goLive.find((g) => g.seat.toLowerCase() === p.seat.toLowerCase()) ?? null;
    p.percent = p.answered ? Math.round((p.agreed * 100) / p.answered) : null;
    p.ready = p.shadow && !!p.goLive && p.answered >= p.goLive.after && p.agreed * 100 >= p.goLive.percent * p.answered;
  }
  return [...by.values()];
}

export interface Ask {
  /** The question, plus its payee and purpose. */
  text: string;
  amountCents: number;
  /** The app (track) the task came from. */
  app?: string;
}

const norm = (s: string) => s.toLowerCase().replace(/[-_]/g, ' ');
function matches(r: Rule, a: Ask): boolean {
  if (r.any) return true;
  if (r.overCents !== undefined && !(a.amountCents > r.overCents)) return false;
  if (r.app && norm(a.app ?? '') !== norm(r.app)) return false;
  if (r.phrase) {
    const text = norm(a.text);
    const p = norm(r.phrase);
    if (!text.includes(p) && !text.includes(p.replace(/s$/, ''))) return false; // "Fraud referrals" matches "fraud referral"
  }
  return true;
}

/**
 * The amount a request is about: the larger of its spending and the largest dollar figure in its question (the part up
 * to the first "?"), so
 * "Raise Bright Harbor from $5,000 to $60,000?" is checked as $60,000 (Mana's review of these rules found that).
 * shortcut: reads figures from the words when a task asks without costCents; give /ask an amount field if a
 * question ever names a big figure that isn't the request.
 */
export function amountOf(costCents: number, question: string): number {
  // Only the question itself, up to its first "?": an agent's explanation after it ("verified revenue $2,150,000")
  // is evidence, not the amount asked for.
  const asked = question.includes('?') ? question.slice(0, question.indexOf('?') + 1) : question;
  const figures = [...asked.matchAll(/\$([\d,]+(?:\.\d{1,2})?)/g)].map((m) => Math.round(Number(m[1].replace(/,/g, '')) * 100));
  return Math.max(costCents, 0, ...figures);
}

/** Whether a person approves for this name or role. */
export function holds(p: Person, to: string): boolean {
  const k = key(to);
  if (k === 'owner') return p.role === 'owner';
  if (k === 'admin') return p.role === 'admin' || p.role === 'owner';
  if (k === 'approver') return p.role === 'approver' || p.role === 'owner';
  return p.approvesFor.some((g) => key(g) === k);
}

/** Why this person may not answer this request, or undefined if they may. Denying is allowed above a limit. */
export function refusal(p: Person | undefined, req: { to: string; amountCents: number; askedBy?: string; rule?: string }, approved: boolean): string | undefined {
  if (!p) return 'Only a person can answer a request on GurtOS Business. Agents and apps never approve: sign in as a person on a paired phone.';
  if (req.askedBy && req.askedBy === p.id) return 'You asked for this, so someone else has to answer it.';
  if (!ANSWERS.includes(p.role)) return `A ${p.role} can't answer requests.`;
  const over = approved && p.limitCents !== null && req.amountCents > p.limitCents ? `This is ${dollars(req.amountCents)}, above your ${dollars(p.limitCents)} limit.` : undefined;
  if (key(req.to) === 'nobody') return approved ? (over ?? `Nobody can approve this in GurtOS: ${req.rule ?? 'a rule says so'}`) : undefined;
  // The owner is the backstop: they may answer anything within their limit, so one person away never stops the work.
  if (!holds(p, req.to) && p.role !== 'owner') return `This goes to ${req.to}. You approve for ${p.approvesFor.join(', ') || 'nothing yet'}.`;
  return over;
}

/**
 * Who a request waits for now: the people who approve for its name and may approve it, or, when none of them can
 * (they asked for it, or it is above their limit), the owner as the backstop.
 */
export function approversFor(req: { to: string; amountCents: number; askedBy?: string; rule?: string }, people: Person[]): Person[] {
  const can = people.filter((p) => !refusal(p, req, true));
  const named = can.filter((p) => holds(p, req.to));
  return named.length ? named : can.filter((p) => p.role === 'owner');
}

/** Where the policy sends a request, who can approve it now, and why. */
export function route(rules: Rule[], ask: Ask, people: Person[], askedBy?: string): ApprovalRoute {
  // A ceiling applies wherever it is in the list; otherwise the first rule that matches decides.
  const rule = rules.find((r) => r.blocked && matches(r, ask)) ?? rules.find((r) => !r.blocked && matches(r, ask));
  const to = rule?.to ?? 'the owner';
  const line = rule?.line ?? 'No rule matched, so it goes to the owner.';
  const req = { to, amountCents: ask.amountCents, askedBy };
  const can = rule?.blocked ? [] : approversFor(req, people);
  const backstop = can.length > 0 && can.every((p) => p.role === 'owner' && !holds(p, to));
  let why: string;
  if (rule?.blocked) why = `${line} Nobody can approve it here.`;
  else if (backstop) why = `${line} Nobody there can approve it, so it goes to the owner: ${can.map((p) => p.name).join(' or ')}.`;
  else if (can.length) why = `${line} ${can.map((p) => p.name).join(' or ')} can approve it.`;
  else {
    const holders = people.filter((p) => ANSWERS.includes(p.role) && holds(p, to));
    const others = holders.filter((p) => p.id !== askedBy);
    why = `${line} Nobody can approve it yet: ${
      !holders.length ? `nobody approves for ${to}.`
      : !others.length ? `the only person who approves for ${to} asked for it.`
      : `it is ${dollars(ask.amountCents)}, above ${others.map((p) => `${p.name}'s ${dollars(p.limitCents ?? 0)}`).join(' and ')} limit.`
    }`;
  }
  return { rule: line, to, amountCents: ask.amountCents, people: can.map((p) => ({ id: p.id, name: p.name })), why };
}

// ---------- the audit ----------

type TaskFacts = Pick<Task, 'source'> & Partial<Pick<Task, 'requestedBy' | 'seat'>>;

/** Who is behind an event of a task. `last` is the last person who approved one of the task's requests. */
export function whoOf(e: { type: string; person?: string; by?: string }, t: TaskFacts, last?: string): Who {
  const approver = e.type === 'approval.answered' ? (e.person ?? e.by) : last;
  return {
    ...(t.requestedBy ? { asked: t.requestedBy } : { trigger: t.source }),
    ...(t.seat ? { seat: t.seat } : {}),
    ...(approver ? { approver } : {}),
  };
}

export interface AuditRow {
  seq: number;
  at: string;
  event: string;
  task: string;
  title: string;
  app: string;
  seat: string;
  /** Who asked: a person's name, or the trigger. */
  asked: string;
  approver: string;
  /** Who did it, for a person's own action outside a task. */
  by: string;
  what: string;
}

export interface AuditFilter {
  person?: string | null;
  seat?: string | null;
  app?: string | null;
  /** YYYY-MM-DD, inclusive. */
  from?: string | null;
  to?: string | null;
}

/** What an event says, in plain words. */
export function describe(e: LogEvent, tool?: string): string {
  switch (e.type) {
    case 'task.created': return `Started "${e.spec.title}"`;
    case 'task.state': return `Task ${e.state}${e.error ? `: ${e.error}` : ''}`;
    case 'task.step': return e.text;
    case 'tool.call': return `Called ${e.tool}`;
    case 'tool.result': return `${tool ?? 'Tool'} ${e.ok ? 'returned' : `failed: ${e.error}`}${e.cents ? `, spent ${dollars(e.cents)}` : ''}`;
    case 'approval.asked': return `Asked: ${e.approval.question}${e.approval.route ? ` (${e.approval.route.why})` : ''}`;
    case 'approval.answered': return `${e.approved ? 'Approved' : 'Denied'} by ${e.by}${e.via && e.via !== e.by ? ` on ${e.via}` : ''}`;
    case 'cost': return `Spent ${dollars(e.cents)} on ${e.what}`;
    case 'net.blocked': return `Blocked a connection to ${e.host}`;
    case 'keep': return `Keep: ${e.result}`;
    case 'note': return `${e.track}: ${JSON.stringify(e.data)}`;
  }
}

/**
 * The log as audit rows, filtered. Each row says who asked, which seat did the work and who approved: from the
 * event's own `who` (written on a Business box), else worked out from its task, so events from before Business was
 * turned on read the same way.
 */
export function auditRows(events: LogEvent[], tasks: Map<string, Task>, ctx: { name(id: string): string; app(t: Task): string }, f: AuditFilter = {}): AuditRow[] {
  const last = new Map<string, string>();
  const tools = new Map<string, string>();
  const rows: AuditRow[] = [];
  const has = (v: string | null | undefined) => !!v && v !== '';
  for (const e of events) {
    const t = e.task ? tasks.get(e.task) : undefined;
    const who: Who = e.who ?? (t ? whoOf(e as never, t, last.get(t.id)) : {});
    if (e.type === 'approval.answered' && e.approved) last.set(e.task, who.approver ?? e.person ?? e.by);
    if (e.type === 'tool.call') tools.set(`${e.task}.${e.key}`, e.tool);
    const noteBy = e.type === 'note' ? (e.data as { by?: unknown } | null)?.by : undefined;
    const by = who.by ?? (typeof noteBy === 'string' ? noteBy : undefined);
    const row: AuditRow = {
      seq: e.seq,
      at: e.at,
      event: e.type,
      task: e.task ?? '',
      title: t?.title ?? '',
      app: t ? ctx.app(t) : e.type === 'note' ? e.track : '',
      seat: who.seat ?? '',
      asked: who.asked ? ctx.name(who.asked) : (who.trigger ?? ''),
      approver: who.approver ? ctx.name(who.approver) : '',
      by: by ? ctx.name(by) : '',
      what: describe(e, e.type === 'tool.result' ? tools.get(`${e.task}.${e.key}`) : undefined).slice(0, 1000),
    };
    if (has(f.person) && ![who.asked, who.approver, by].includes(f.person!)) continue;
    if (has(f.seat) && row.seat.toLowerCase() !== f.seat!.toLowerCase()) continue;
    if (has(f.app) && row.app !== f.app) continue;
    if (has(f.from) && e.at.slice(0, 10) < f.from!) continue;
    if (has(f.to) && e.at.slice(0, 10) > f.to!) continue;
    rows.push(row);
  }
  return rows;
}

const COLUMNS: (keyof AuditRow)[] = ['seq', 'at', 'event', 'task', 'title', 'app', 'seat', 'asked', 'approver', 'by', 'what'];

/** CSV for a spreadsheet. A cell that starts like a formula gets a leading ' so a spreadsheet shows it as text. */
export function toCsv(rows: AuditRow[]): string {
  const cell = (v: unknown) => {
    let s = String(v ?? '');
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // text an agent or an applicant wrote must never run as a formula
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [COLUMNS.join(','), ...rows.map((r) => COLUMNS.map((c) => cell(r[c])).join(','))].join('\r\n') + '\r\n';
}
