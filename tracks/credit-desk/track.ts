// The credit desk: a credit analyst and a collections clerk for a small wholesaler, each a box task run by Droid.
// Tools run in the core (CRS and Nessie keys stay in the vault) and every one writes its input and result to the log.
// POST /t/credit-desk/run starts the seats on a case; POST /t/credit-desk/score scores a run against its answer key.
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { Box, Ctx, LogEvent, Track } from '../../core/contract.ts';
import { checkCase, parseCsv } from './check-case.ts';
import { CRS_HOST, checkApplication } from './crs.ts';
import {
  CASES_DIR, DEFAULT_RULES, checkRules, controllerAnswer, loadRules, marker, money, readLog, runInfo, runOf,
  safeId, stageWorkspace, toolUses, workspaceDir, type RunInfo,
} from './desk.ts';
import { NESSIE_HOST, readBank } from './nessie.ts';
import * as scripted from './scripts.ts';
import { scoreRun } from './score.ts';
import { ACTIONS, ANALYST_TOOLS, CLERK_TOOLS, CONTROLLER_ACTIONS, OUTCOMES, analystPrompt, clerkPrompt } from './seats.ts';

const caseFile = (ctx: Ctx, ...p: string[]) => {
  if (!ctx.task) throw new Error('only a task can use this tool');
  return path.join(workspaceDir(ctx.task.workspace), ...p);
};
const application = (ctx: Ctx, id: unknown) => {
  const file = caseFile(ctx, 'case', 'applications', `${safeId(id)}.json`);
  if (!fs.existsSync(file)) throw new Error(`there is no application ${id} in this case`);
  return JSON.parse(fs.readFileSync(file, 'utf8'));
};
const rulesOf = (ctx: Ctx) => loadRules(caseFile(ctx, 'rules.yaml'));

/** What a decision needing the controller returns until the controller has answered. */
function controllerGate(ctx: Ctx, mark: string, question: string) {
  const a = controllerAnswer(ctx.box.approvals(), ctx.task!.id, mark);
  if (a && a.state !== 'pending') return { approval: { id: a.id, approved: a.state === 'approved', by: a.by ?? 'unknown' } };
  return {
    pending: {
      status: 'needs controller',
      ask: question,
      then: 'Call box_ask with exactly this question. When it is answered, call this tool again with the same input to record the outcome.',
    },
  };
}

const strings = { type: 'array', items: { type: 'string' } };
const rulesField = { ...strings, description: 'Rule ids from rules.yaml that this rests on, e.g. ["FRD-1", "LIM-1"].' };

export default {
  name: 'credit-desk',

  tools: [
    {
      name: 'credit-desk.crs',
      description: "Run the CRS checks on an application's guarantor: credit reports from TransUnion, Equifax and Experian, identity verification, Fraud Finder, public records (bankruptcies, liens, judgments) and the phone number's owner. Returns a summary with the CRS request id of every check.",
      input: { type: 'object', properties: { application_id: { type: 'string' } }, required: ['application_id'] },
      secrets: ['CRS_USERNAME', 'CRS_PASSWORD'],
      hosts: [CRS_HOST],
      async run(input: { application_id: string }, ctx) {
        const app = application(ctx, input.application_id);
        const caseId = JSON.parse(fs.readFileSync(caseFile(ctx, 'case', 'case.json'), 'utf8')).case_id;
        const s = await checkApplication(app, caseId, () => [ctx.secret('CRS_USERNAME'), ctx.secret('CRS_PASSWORD')]);
        const scores = Object.entries(s.credit).map(([b, r]: [string, any]) => `${b} ${r.score ?? r.file ?? r.error}`).join(', ');
        const id: any = s.identity, fr: any = s.fraud;
        ctx.log(`CRS on ${app.application_id} (${s.source}): ${scores}; identity ${id.error ?? (id.verified ? 'verified' : 'not verified')}; fraud score ${fr.risk_score ?? fr.error}`);
        return s;
      },
    },
    {
      name: 'credit-desk.bank',
      description: 'Read the bank (Capital One Nessie). {what: "deposits"}: payments received into the operating account, with payer and remittance memo. {what: "bills", customer_id}: the invoices the bank holds for a customer. {what: "statements", application_id}: an applicant\'s monthly deposits.',
      input: {
        type: 'object',
        properties: { what: { type: 'string', enum: ['deposits', 'bills', 'statements'] }, customer_id: { type: 'string' }, application_id: { type: 'string' } },
        required: ['what'],
      },
      secrets: ['NESSIE_API_KEY'],
      hosts: [NESSIE_HOST],
      async run(input, ctx) {
        // Names from this case's own files, so the bank never hands back another case's records.
        const names = new Map<string, string>();
        const customers = caseFile(ctx, 'case', 'customers.csv');
        if (fs.existsSync(customers)) for (const c of parseCsv(fs.readFileSync(customers, 'utf8'))) names.set(c.customer_id, c.legal_name);
        const apps = caseFile(ctx, 'case', 'applications');
        if (fs.existsSync(apps)) for (const f of fs.readdirSync(apps).filter((f) => f.endsWith('.json'))) {
          const a = JSON.parse(fs.readFileSync(path.join(apps, f), 'utf8'));
          names.set(a.application_id, a.business?.legal_name);
        }
        return readBank(input, ctx.secret('NESSIE_API_KEY'), names);
      },
    },
    {
      name: 'credit-desk.flag',
      description: 'Record one problem found in the data: wrong, missing, stale, contradictory between sources, or suspicious. ids are the applications or rows involved (APP-1043, C-1007, INV-24105, PMT-8812, SO-5521).',
      input: {
        type: 'object',
        properties: {
          ids: strings,
          problem: { type: 'string', description: 'Short name of the problem.' },
          detail: { type: 'string', description: 'What is wrong, with the evidence from each source.' },
          conclusion: { type: 'string', description: 'What the desk should do about it.' },
          rules: rulesField,
        },
        required: ['ids', 'problem', 'detail', 'conclusion', 'rules'],
      },
      async run(input, ctx) {
        if (!Array.isArray(input.ids) || !input.ids.length) throw new Error('ids must list the applications or rows involved');
        const rules = checkRules(rulesOf(ctx), input.rules);
        ctx.log(`Problem: ${input.problem} (${input.ids.join(', ')}; ${rules.join(', ')})`);
        return { status: 'recorded', finding: ctx.key };
      },
    },
    {
      name: 'credit-desk.credit_decision',
      description: 'Record the decision on a credit application. Needs the CRS checks first. A limit above the analyst\'s authority, a fraud hold, or needs_controller comes back "needs controller" with a question for box_ask.',
      input: {
        type: 'object',
        properties: {
          application_id: { type: 'string' },
          outcome: { type: 'string', enum: OUTCOMES },
          band: { type: 'string', description: 'Risk band from rules.yaml, or "none".' },
          limit: { type: 'number', description: 'Credit limit in dollars; 0 when there is no credit.' },
          terms: { type: 'string', description: 'e.g. "Net 30", "Net 15", "cash in advance".' },
          rules: rulesField,
          data: { type: 'object', description: 'The figures the decision used: scores, revenue figures, record amounts, dates.' },
          why: { type: 'string' },
          needs_controller: { type: 'boolean', description: 'True when a rule requires the controller to sign off.' },
        },
        required: ['application_id', 'outcome', 'limit', 'terms', 'rules', 'why'],
      },
      async run(input, ctx) {
        const app = application(ctx, input.application_id);
        if (!OUTCOMES.includes(input.outcome)) throw new Error(`outcome must be one of: ${OUTCOMES.join(', ')}`);
        const rulesFile = rulesOf(ctx);
        const rules = checkRules(rulesFile, input.rules);
        const limit = Math.max(0, Number(input.limit ?? 0));
        // No terms before the checks: the decision must rest on CRS answers this task actually received.
        const crs = toolUses(readLog(), new Set([ctx.task!.id])).findLast((u) => u.tool === 'credit-desk.crs' && u.ok && u.input?.application_id === app.application_id);
        if (!crs) throw new Error(`run credit-desk.crs on ${app.application_id} first: no decision before the checks`);
        const requestIds = JSON.stringify(crs.output).match(/"request_id":"([^"]+)"/g)?.map((m) => m.slice(14, -1)) ?? [];

        const name = app.business?.legal_name ?? app.application_id;
        const aboveAuthority = input.outcome === 'approve' && limit > rulesFile.authority;
        const needs = input.outcome === 'fraud hold' || aboveAuthority || input.needs_controller === true;
        let approval: { id: string; approved: boolean; by: string } | undefined;
        if (needs) {
          const mark = marker(app.application_id, input.outcome, limit);
          const why = String(input.why ?? '').slice(0, 400);
          const question = input.outcome === 'fraud hold'
            ? `Credit desk ${mark}: fraud referral. Put ${name} (${app.application_id}) on fraud hold, no credit, cash in advance only? The analyst found: ${why} Rules: ${rules.join(', ')}.`
            : `Credit desk ${mark}: ${input.outcome} ${name} (${app.application_id})${input.outcome === 'approve' ? ` for ${money(limit)}, ${input.terms}, band ${input.band ?? '?'}` : ''}? Proposed by the credit analyst; ${aboveAuthority ? `above the analyst's ${money(rulesFile.authority)} authority` : 'a rule needs your sign-off'}. Why: ${why} Rules: ${rules.join(', ')}.`;
          const gate = controllerGate(ctx, mark, question);
          if (gate.pending) return gate.pending;
          approval = gate.approval;
        }
        const decision = {
          application_id: app.application_id,
          outcome: approval && !approval.approved ? 'sent back by the controller' : input.outcome,
          band: input.band ?? null,
          limit: approval && !approval.approved ? 0 : limit,
          terms: input.terms,
          decided_by: approval ? `controller (${approval.by})` : 'credit analyst',
          approval: approval ?? null,
          rules,
        };
        ctx.log(`Decision on ${app.application_id}: ${decision.outcome}, ${money(decision.limit)} ${decision.terms}, band ${decision.band}; ${decision.decided_by}; ${rules.join(', ')}`);
        return { status: 'recorded', decision, crs_request_ids: requestIds, crs_source: crs.output.source };
      },
    },
    {
      name: 'credit-desk.collections_action',
      description: `Record a collections action on a customer, invoice, payment or order. ${CONTROLLER_ACTIONS.join(' and ')} need the controller and come back "needs controller" with a question for box_ask.`,
      input: {
        type: 'object',
        properties: {
          subject: { type: 'string', description: 'Customer, invoice, payment or order id.' },
          action: { type: 'string', enum: ACTIONS },
          detail: { type: 'string', description: 'What exactly, with amounts and dates.' },
          rules: rulesField,
          data: { type: 'object', description: 'The figures used: balances, days past due, limits.' },
          needs_controller: { type: 'boolean' },
        },
        required: ['subject', 'action', 'detail', 'rules'],
      },
      async run(input, ctx) {
        const subject = safeId(input.subject);
        if (!ACTIONS.includes(input.action)) throw new Error(`action must be one of: ${ACTIONS.join(', ')}`);
        const rules = checkRules(rulesOf(ctx), input.rules);
        let approval: { id: string; approved: boolean; by: string } | undefined;
        if (CONTROLLER_ACTIONS.includes(input.action) || input.needs_controller === true) {
          const mark = marker(subject, input.action);
          const gate = controllerGate(ctx, mark, `Credit desk ${mark}: ${input.action} for ${subject}? The collections clerk asks: ${String(input.detail).slice(0, 400)} Rules: ${rules.join(', ')}.`);
          if (gate.pending) return gate.pending;
          approval = gate.approval;
        }
        const done = approval && !approval.approved ? 'refused by the controller' : input.action;
        ctx.log(`Collections: ${done} on ${subject} (${rules.join(', ')})`);
        return { status: 'recorded', action: { subject, action: done, decided_by: approval ? `controller (${approval.by})` : 'collections clerk', approval: approval ?? null, rules } };
      },
    },
  ],

  routes: {
    // Start the seats on a case: {case: "fogline-2026-10"} or {dir: "/path/to/case"}, optional {rules: "/path/to/rules.yaml"}
    // and {seats: ["analyst", "clerk"]}. {scripted: true} runs the Fogline case's scripted seats: no model, about 10 seconds.
    'POST /run': async (req, box) => {
      const body = await req.json().catch(() => ({}));
      if (body.scripted && (body.dir || (body.case ?? 'fogline-2026-10') !== 'fogline-2026-10')) {
        return Response.json({ error: 'scripted seats exist only for the fogline-2026-10 case' }, { status: 400 });
      }
      const caseDir = body.dir ? path.resolve(String(body.dir)) : path.join(CASES_DIR, safeId(body.case ?? 'fogline-2026-10'));
      const { problems } = checkCase(caseDir);
      if (problems.length) return Response.json({ error: 'the case does not follow the format in README.md', problems }, { status: 400 });
      const meta = JSON.parse(fs.readFileSync(path.join(caseDir, 'case.json'), 'utf8'));
      const caseRules = meta.rules && path.resolve(caseDir, meta.rules);
      const rulesFile = body.rules ? path.resolve(String(body.rules)) : caseRules && fs.existsSync(caseRules) ? caseRules : DEFAULT_RULES;
      loadRules(rulesFile);
      const run = randomBytes(3).toString('hex');
      const info: RunInfo = { run, caseId: meta.case_id, caseDir, rulesFile, workspace: `credit-desk-${run}`, nessie: meta.nessie === true };
      const staged = stageWorkspace(info);
      try {
        box.workspace(info.workspace, staged);
      } finally {
        fs.rmSync(staged, { recursive: true, force: true });
      }
      box.note({ kind: 'run.started', info });

      const apps = fs.existsSync(path.join(caseDir, 'applications')) ? fs.readdirSync(path.join(caseDir, 'applications')).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)).sort() : [];
      const profile = path.join(caseDir, meta.company_profile ?? '-');
      const company = fs.existsSync(profile) ? fs.readFileSync(profile, 'utf8').match(/^#\s+(.+)$/m)?.[1] ?? 'the company' : 'the company';
      const brief = { company, asOf: meta.as_of, applications: apps, bank: info.nessie, hasProfile: fs.existsSync(profile) };
      const seats: string[] = body.seats ?? ['analyst', 'clerk'];
      const worker = body.scripted ? 'fake' : 'droid';
      const tasks: Record<string, string> = {};
      const withBank = (tools: string[]) => tools.filter((t) => info.nessie || t !== 'credit-desk.bank');
      if (seats.includes('analyst') && apps.length) {
        tasks.analyst = (await box.createTask({
          title: `Credit analyst: ${meta.case_id}`, workspace: info.workspace, worker, source: `credit-desk:${run}`, tools: withBank(ANALYST_TOOLS),
          prompt: worker === 'fake' ? scripted.analyst : analystPrompt(brief),
        })).id;
      }
      if (seats.includes('clerk') && fs.existsSync(path.join(caseDir, 'customers.csv'))) {
        tasks.clerk = (await box.createTask({
          title: `Collections clerk: ${meta.case_id}`, workspace: info.workspace, worker, source: `credit-desk:${run}`, tools: withBank(CLERK_TOOLS),
          prompt: worker === 'fake' ? scripted.clerk : clerkPrompt(brief),
        })).id;
      }
      return Response.json({ run, workspace: info.workspace, rules: rulesFile, tasks });
    },

    // Score a run against its case's answer key, and put the score in the log. {run}
    'POST /score': async (req, box) => {
      const { run } = await req.json().catch(() => ({}));
      const events = readLog();
      const info = runInfo(events, String(run));
      if (!info) return Response.json({ error: `no credit desk run ${run}` }, { status: 404 });
      if (!fs.existsSync(path.join(info.caseDir, 'answer_key.json'))) return Response.json({ error: `${info.caseId} has no answer_key.json` }, { status: 400 });
      const score = scoreRun(info, events, box.tasks());
      box.note({ kind: 'score', run: info.run, summary: score.summary, caught: score.caught, total: score.total, moment: score.moment });
      return Response.json(score);
    },

    'GET /runs': (_req, box: Box) => {
      const runs = runsOf(readLog()).map((r) => r.info);
      return Response.json(runs.map((r) => ({ ...r, tasks: box.tasks().filter((t) => runOf(t.source) === r.run).map((t) => ({ id: t.id, title: t.title, state: t.state, costCents: t.costCents })) })));
    },

    // The window: the cases, the runs, and for one run (?run=, default the latest) its seats, decisions, problems,
    // actions, what waits for the controller, and the score against the answer key.
    'GET /': () => new Response(PAGE, { headers: { 'content-type': 'text/html; charset=utf-8' } }),
    // shortcut: re-reads the whole log on every refresh (the window asks every 2.5 s); keep a cursor if the log grows large.
    'GET /state': (req, box) => Response.json(windowState(readLog(), box, new URL(req.url).searchParams.get('run'))),
    'GET /rules': (req) => {
      const r = runsOf(readLog()).find((x) => x.info.run === new URL(req.url).searchParams.get('run'));
      return new Response(fs.readFileSync(r?.info.rulesFile ?? DEFAULT_RULES, 'utf8'), { headers: { 'content-type': 'text/plain; charset=utf-8' } });
    },
  },

  apps: [{ name: 'credit-desk', title: 'Credit desk', href: '/' }],
} satisfies Track;

const PAGE = fs.readFileSync(new URL('./app.html', import.meta.url), 'utf8');

const runsOf = (events: LogEvent[]) =>
  events.flatMap((e) => (e.type === 'note' && e.track === 'credit-desk' && (e.data as any)?.kind === 'run.started' ? [{ info: (e.data as any).info as RunInfo, at: e.at }] : []));

function windowState(events: LogEvent[], box: Box, want: string | null) {
  const cases = fs.readdirSync(CASES_DIR).filter((c) => fs.existsSync(path.join(CASES_DIR, c, 'case.json'))).map((c) => {
    const meta = JSON.parse(fs.readFileSync(path.join(CASES_DIR, c, 'case.json'), 'utf8'));
    return { id: c, title: meta.title ?? c, as_of: meta.as_of, scripted: c === 'fogline-2026-10' };
  });
  const runs = runsOf(events);
  const r = runs.find((x) => x.info.run === want) ?? runs.at(-1);
  const rulesFile = r?.info.rulesFile ?? DEFAULT_RULES;
  const rulesText = fs.readFileSync(rulesFile, 'utf8');
  const rules = { file: path.basename(rulesFile), count: loadRules(rulesFile).ids.size, version: rulesText.match(/^version:\s*(.+)$/m)?.[1] ?? null, source: rulesText.match(/^source:\s*"?([^"\n]+)"?$/m)?.[1] ?? null };
  const base = { cases, rules, runs: runs.map((x) => ({ run: x.info.run, case: x.info.caseId, at: x.at })).reverse() };
  if (!r) return { ...base, run: null };

  const tasks = box.tasks().filter((t) => runOf(t.source) === r.info.run);
  const ids = new Set(tasks.map((t) => t.id));
  const uses = toolUses(events, ids);
  const pending = box.approvals().filter((a) => ids.has(a.task) && a.state === 'pending');
  const seat = (t: { title: string }) => (t.title.startsWith('Credit analyst') ? 'analyst' : 'clerk');
  // The desk's own log lines are the readable story of a seat; Droid's raw tool calls are not.
  const story = (id: string) => events.filter((e) => e.type === 'task.step' && e.task === id && /^(CRS on|Problem:|Decision on|Collections:)/.test(e.text)).slice(-5).map((e) => (e as { text: string }).text);
  const score = fs.existsSync(path.join(r.info.caseDir, 'answer_key.json')) ? scoreRun(r.info, events, box.tasks()) : null;
  const appDir = path.join(r.info.caseDir, 'applications');
  const applications = (fs.existsSync(appDir) ? fs.readdirSync(appDir).filter((f) => f.endsWith('.json')).sort() : []).map((f) => {
    const a = JSON.parse(fs.readFileSync(path.join(appDir, f), 'utf8'));
    const decision = uses.findLast((u) => u.tool === 'credit-desk.credit_decision' && u.ok && u.output?.status === 'recorded' && u.input.application_id === a.application_id);
    const last = uses.findLast((u) => u.tool === 'credit-desk.credit_decision' && u.ok && u.input.application_id === a.application_id);
    const crs = uses.findLast((u) => u.tool === 'credit-desk.crs' && u.ok && u.input.application_id === a.application_id)?.output;
    const ask = pending.find((p) => p.question.includes(`[${a.application_id} `));
    return {
      id: a.application_id, business: a.business?.legal_name, requested: a.request?.credit_limit, terms: a.request?.terms,
      decision: decision?.output.decision ?? null, why: decision?.input.why ?? null,
      // The analyst's latest proposal when it still waits for the controller (above authority, fraud hold).
      proposed: last?.output?.status === 'needs controller' ? { outcome: last.input.outcome, limit: last.input.limit, terms: last.input.terms } : null,
      checks: crs ? { transunion: crs.credit?.transunion?.score ?? null, identity: crs.identity?.verified ?? null, fraud: crs.fraud?.risk_score ?? null, source: crs.source } : null,
      simple_rule: score?.simple_rule.find((x: { application_id: string }) => x.application_id === a.application_id) ?? null,
      ask: ask ? { id: ask.id, question: ask.question } : null,
    };
  });
  const started = Date.parse(r.at);
  const last = Math.max(started, ...tasks.map((t) => Date.parse(t.updatedAt)));
  return {
    ...base,
    run: {
      run: r.info.run, case: r.info.caseId, at: r.at, minutes: Math.max(1, Math.round((last - started) / 60000)),
      costCents: tasks.reduce((n, t) => n + t.costCents, 0), scripted: tasks.some((t) => t.worker === 'fake'),
      seats: tasks.map((t) => ({ seat: seat(t), id: t.id, state: t.state, costCents: t.costCents, story: story(t.id) })),
      approvals: pending.map((p) => ({ id: p.id, question: p.question, seat: seat(tasks.find((t) => t.id === p.task)!) })),
      applications,
      problems: uses.filter((u) => u.tool === 'credit-desk.flag' && u.ok).map((u) => ({ ids: u.input.ids, problem: u.input.problem, rules: u.input.rules, seat: seat(tasks.find((t) => t.id === u.task)!) })),
      actions: uses.filter((u) => u.tool === 'credit-desk.collections_action' && u.ok && u.output?.status === 'recorded').map((u) => ({ ...u.output.action, detail: u.input.detail })),
      score: score && { summary: score.summary, caught: score.caught, total: score.total, false_alarms: score.false_alarms.length, errors: score.errors, moment: score.moment },
    },
  };
}
