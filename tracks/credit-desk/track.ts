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
  DEFAULT_RULES, application, caseFile, checkRules, controllerGate, loadRules, marker, money, readLog, rulesField, rulesOf,
  runInfo, runOf, safeId, seatOf, stageWorkspace, strings, toolUses, type RunInfo,
} from './desk.ts';
import { NESSIE_HOST, readBank } from './nessie.ts';
import * as scripted from './scripts.ts';
import { apTools } from './ap.ts';
import { balances } from './books.ts';
import { bookTools, realBooks } from './bookkeeping.ts';
import { reviewTools, why } from './review.ts';
import { applicationCase, caseDirOf, listCases, personaList, saveUpload, templates } from './uploads.ts';
import { impact } from './impact.ts';
import { letter } from './letters.ts';
import { scoreRun } from './score.ts';
import { ACTIONS, ANALYST_TOOLS, AP_TOOLS, CLERK_TOOLS, CONTROLLER_ACTIONS, OUTCOMES, analystPrompt, apPrompt, clerkPrompt } from './seats.ts';

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
        const info = runInfo(readLog(), runOf(ctx.task!.source)!)!;
        const asOf = JSON.parse(fs.readFileSync(caseFile(ctx, 'case', 'case.json'), 'utf8')).as_of;
        return readBank(input, ctx.secret('NESSIE_API_KEY'), names, asOf, info.run);
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
      decides: (i) => `${i.outcome} ${i.application_id}${i.outcome === 'approve' ? ` for ${money(Number(i.limit) || 0)}, ${i.terms}` : ''}`,
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
        let approval: { id: string; approved: boolean; by: string; reason?: string } | undefined;
        if (needs) {
          const mark = marker(app.application_id, input.outcome, limit);
          const why = String(input.why ?? '').slice(0, 400);
          const question = input.outcome === 'fraud hold'
            ? `Credit desk ${mark}: fraud referral. Put ${name} (${app.application_id}) on fraud hold, no credit, cash in advance only? The analyst found: ${why} Rules: ${rules.join(', ')}.`
            : `Credit desk ${mark}: ${input.outcome} ${name} (${app.application_id})${input.outcome === 'approve' ? ` for ${money(limit)}, ${input.terms}, band ${input.band ?? '?'}` : ''}? Proposed by the credit analyst; ${aboveAuthority ? `above the analyst's ${money(rulesFile.authority)} authority` : 'a rule needs your sign-off'}. Why: ${why} Rules: ${rules.join(', ')}.`;
          const gate = controllerGate(ctx, mark, question);
          if (gate.pending) return gate.pending;
          approval = gate.approval!;
          // A no is not the end: the seat gets the reason and revises, and the same proposal is never asked twice.
          if (!approval.approved) {
            return { status: 'denied', reason: approval.reason ?? null, then: `The controller said no${approval.reason ? `: "${approval.reason}"` : ''}. Do not ask the same question again. Revise the proposal to answer the reason (new terms or limit, or decline), cite the rules, and call this tool again; or record what you will do instead.` };
          }
        }
        const decision = {
          application_id: app.application_id,
          outcome: input.outcome,
          band: input.band ?? null,
          limit,
          terms: input.terms,
          decided_by: approval ? `controller (${approval.by})` : 'credit analyst',
          approval: approval ?? null,
          rules,
          data: input.data ?? null,
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
      decides: (i) => `record "${i.action}" for ${i.subject} (${i.detail})`,
      async run(input, ctx) {
        const subject = safeId(input.subject);
        if (!ACTIONS.includes(input.action)) throw new Error(`action must be one of: ${ACTIONS.join(', ')}`);
        const rules = checkRules(rulesOf(ctx), input.rules);
        let approval: { id: string; approved: boolean; by: string; reason?: string } | undefined;
        if (CONTROLLER_ACTIONS.includes(input.action) || input.needs_controller === true) {
          const mark = marker(subject, input.action);
          const gate = controllerGate(ctx, mark, `Credit desk ${mark}: ${input.action} for ${subject}? The collections clerk asks: ${String(input.detail).slice(0, 400)} Rules: ${rules.join(', ')}.`);
          if (gate.pending) return gate.pending;
          approval = gate.approval!;
          if (!approval.approved) return { status: 'denied', reason: approval.reason ?? null, then: 'The controller said no. Do not ask again; record what you will do instead, citing the reason.' };
        }
        const done = input.action;
        ctx.log(`Collections: ${done} on ${subject} (${rules.join(', ')})`);
        return { status: 'recorded', action: { subject, action: done, decided_by: approval ? `controller (${approval.by})` : 'collections clerk', approval: approval ?? null, rules } };
      },
    },
    ...apTools,
    ...bookTools,
    ...reviewTools,
  ],

  routes: {
    // Start the seats on a case: {case: "fogline-2026-10"} or {dir: "/path/to/case"}, optional {rules: "/path/to/rules.yaml"}
    // and {seats: ["analyst", "clerk"]}. {scripted: true} runs the Fogline case's scripted seats: no model, about 10 seconds.
    'POST /run': async (req, box) => {
      const body = await req.json().catch(() => ({}));
      if (body.scripted && (body.dir || !scripted.SCRIPTS[body.case ?? 'fogline-2026-10'])) {
        return Response.json({ error: `scripted seats exist only for ${Object.keys(scripted.SCRIPTS).join(' and ')}` }, { status: 400 });
      }
      const caseDir = body.dir ? path.resolve(String(body.dir)) : caseDirOf(String(body.case ?? 'fogline-2026-10'));
      if (!caseDir) return Response.json({ error: `no case ${body.case}` }, { status: 404 });
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
      const brief = { company, asOf: meta.as_of, applications: apps, bank: info.nessie, hasProfile: fs.existsSync(profile), follows: meta.follows as string | undefined };
      const seats: string[] = body.seats ?? ['analyst', 'clerk', 'ap'];
      const worker = body.scripted ? 'fake' : 'droid';
      const script = scripted.SCRIPTS[meta.case_id] ?? {};
      const tasks: Record<string, string> = {};
      const withBank = (tools: string[]) => tools.filter((t) => info.nessie || t !== 'credit-desk.bank');
      const has = (f: string) => fs.existsSync(path.join(caseDir, f));
      // Each seat is its own task: its own Linux user, its own copy of the files, and only its own tools.
      const SEATS = [
        { key: 'analyst', title: 'Credit analyst', tools: ANALYST_TOOLS, prompt: analystPrompt, when: apps.length > 0 || has('customers.csv') },
        { key: 'clerk', title: 'Collections clerk', tools: CLERK_TOOLS, prompt: clerkPrompt, when: has('customers.csv') },
        { key: 'ap', title: 'AP clerk', tools: AP_TOOLS, prompt: apPrompt, when: has('bills.csv') },
      ] as const;
      for (const seat of SEATS) {
        if (!seats.includes(seat.key) || !seat.when) continue;
        const prompt = worker === 'fake' ? (script as Record<string, string>)[seat.key] : seat.prompt(brief);
        if (!prompt) continue;
        tasks[seat.key] = (await box.createTask({
          title: `${seat.title}: ${meta.case_id}`, workspace: info.workspace, worker, seat: seat.title, source: `credit-desk:${run}`, tools: withBank([...seat.tools]), prompt,
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

    // The auditor's question: why did the desk decide this, and does it still hold? Answered from the log alone.
    'GET /why': (req) => {
      const subject = String(new URL(req.url).searchParams.get('subject') ?? '').trim();
      if (!subject) return Response.json({ error: 'give a subject: an application id, a customer id or a name' }, { status: 400 });
      return Response.json({ subject, decisions: why(readLog(), subject) });
    },

    // A run's real books as a Beancount file (open it with Fava or bean-check).
    'GET /books': (req, box) => {
      const r = runsOf(readLog()).find((x) => x.info.run === new URL(req.url).searchParams.get('run')) ?? runsOf(readLog()).at(-1);
      if (!r) return new Response('no run yet\n', { status: 404 });
      return new Response(realBooks(r.info, box.tasks()).text, { headers: { 'content-type': 'text/plain; charset=utf-8', 'content-disposition': `inline; filename="${r.info.caseId}-${r.info.run}.beancount"` } });
    },

    // The reason a controller gives with a no. The seat reads it from the log and revises; core approvals carry no text.
    'POST /reason': async (req, box) => {
      const { approval, reason } = await req.json().catch(() => ({}));
      const a = box.approvals().find((x) => x.id === approval);
      if (!a || a.state !== 'pending') return Response.json({ error: 'no pending request with that id' }, { status: 400 });
      const text = String(reason ?? '').trim().slice(0, 500);
      if (text) box.note({ kind: 'answer.reason', approval: a.id, reason: text }, a.task);
      return Response.json({ ok: true });
    },

    // Bring your own scenario: case files, or one application on a CRS test person. Checked before anything runs.
    'POST /upload': async (req) => {
      const body = await req.json().catch(() => ({}));
      try {
        return Response.json(saveUpload(body.files, { title: body.title, as_of: body.as_of }));
      } catch (e) {
        return Response.json({ error: (e as Error).message }, { status: 400 });
      }
    },
    'POST /application': async (req) => {
      try {
        return Response.json(applicationCase(await req.json()));
      } catch (e) {
        return Response.json({ error: (e as Error).message }, { status: 400 });
      }
    },
    'GET /templates': () => Response.json({ files: templates(), personas: personaList() }),

    // Customer impact of a run, from the log (Microsoft's measurable usefulness): attention, losses stopped, model cost.
    'GET /impact': (req, box) => {
      const events = readLog();
      const r = runsOf(events).find((x) => x.info.run === new URL(req.url).searchParams.get('run')) ?? runsOf(events).at(-1);
      if (!r) return Response.json({ error: 'no run yet' }, { status: 404 });
      const score = fs.existsSync(path.join(r.info.caseDir, 'answer_key.json')) ? scoreRun(r.info, events, box.tasks()) : null;
      return Response.json(impact(r.info, events, box.tasks(), score));
    },

    // The letter an applicant gets after an adverse decision (DCL-1, FRR-3). {run, subject}: an application or customer id.
    'GET /letter': (req, box) => {
      const q = new URL(req.url).searchParams;
      const events = readLog();
      const r = runsOf(events).find((x) => x.info.run === q.get('run')) ?? runsOf(events).at(-1);
      if (!r) return new Response('no run yet\n', { status: 404 });
      const text = letterFor(r.info, events, box.tasks(), String(q.get('subject') ?? ''));
      return new Response(text ?? 'No letter: nothing adverse was decided for this subject in this run.\n', { status: text ? 200 : 404, headers: { 'content-type': 'text/plain; charset=utf-8' } });
    },
  },

  apps: [{ name: 'credit-desk', title: 'Credit desk', href: '/' }],
} satisfies Track;

const PAGE = fs.readFileSync(new URL('./app.html', import.meta.url), 'utf8');

const runsOf = (events: LogEvent[]) =>
  events.flatMap((e) => (e.type === 'note' && e.track === 'credit-desk' && (e.data as any)?.kind === 'run.started' ? [{ info: (e.data as any).info as RunInfo, at: e.at }] : []));

const SEAT_KEY: Record<string, string> = { 'Credit analyst': 'analyst', 'Collections clerk': 'clerk', 'AP clerk': 'ap' };

function windowState(events: LogEvent[], box: Box, want: string | null) {
  const cases = listCases().map((c) => ({ ...c, scripted: Boolean(scripted.SCRIPTS[c.id]) }));
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
  const seat = (id: string) => SEAT_KEY[seatOf(tasks.find((t) => t.id === id) ?? { title: '' })] ?? 'clerk';
  const askFor = (subject: string) => pending.find((p) => p.question.includes(`[${subject} `));
  // The desk's own log lines are the readable story of a seat; Droid's raw tool calls are not.
  const story = (id: string) => events.filter((e) => e.type === 'task.step' && e.task === id && /^(CRS on|Problem:|Decision on|Collections:|Review of|Books:|AP:)/.test(e.text)).slice(-6).map((e) => (e as { text: string }).text);
  const score = fs.existsSync(path.join(r.info.caseDir, 'answer_key.json')) ? scoreRun(r.info, events, box.tasks()) : null;
  const appDir = path.join(r.info.caseDir, 'applications');
  const applications = (fs.existsSync(appDir) ? fs.readdirSync(appDir).filter((f) => f.endsWith('.json')).sort() : []).map((f) => {
    const a = JSON.parse(fs.readFileSync(path.join(appDir, f), 'utf8'));
    const decision = uses.findLast((u) => u.tool === 'credit-desk.credit_decision' && u.ok && u.output?.status === 'recorded' && u.input.application_id === a.application_id);
    const last = uses.findLast((u) => u.tool === 'credit-desk.credit_decision' && u.ok && u.input.application_id === a.application_id);
    const crs = uses.findLast((u) => u.tool === 'credit-desk.crs' && u.ok && u.input.application_id === a.application_id)?.output;
    const ask = askFor(a.application_id);
    return {
      id: a.application_id, business: a.business?.legal_name, requested: a.request?.credit_limit, terms: a.request?.terms,
      decision: decision?.output.decision ?? null, why: decision?.input.why ?? null,
      // The analyst's latest proposal while it waits for the controller, or after a no.
      proposed: last && last.output?.status !== 'recorded' ? { outcome: last.input.outcome, limit: last.input.limit, terms: last.input.terms, status: last.output.status, reason: last.output.reason ?? null } : null,
      checks: crs ? { transunion: crs.credit?.transunion?.score ?? null, identity: crs.identity?.verified ?? null, fraud: crs.fraud?.risk_score ?? null, source: crs.source } : null,
      simple_rule: score?.simple_rule.find((x: { application_id: string }) => x.application_id === a.application_id) ?? null,
      ask: ask ? { id: ask.id, question: ask.question } : null,
    };
  });

  // Reviews: the latest per customer, recorded or waiting, with then next to now.
  const reviewUses = uses.filter((u) => u.tool === 'credit-desk.review' && u.ok);
  const reviews = [...new Set(reviewUses.map((u) => u.input.customer_id))].map((cid) => {
    const done = reviewUses.findLast((u) => u.input.customer_id === cid && u.output?.status === 'recorded');
    const last = reviewUses.findLast((u) => u.input.customer_id === cid)!;
    const ask = askFor(cid);
    return {
      customer_id: cid, proposal: { outcome: last.input.outcome, band: last.input.band, limit: last.input.limit, terms: last.input.terms, rules: last.input.rules, why: last.input.why },
      status: done ? 'recorded' : last.output.status, review: done?.output.review ?? null, reason: last.output.reason ?? null,
      then: done?.output.then ?? last.output.before ?? null, now: done?.output.now ?? last.output.now ?? null, changes: done?.output.changes ?? last.output.changes ?? null,
      ask: ask ? { id: ask.id, question: ask.question } : null,
    };
  });
  // When a review still waits, show then and now from the history the analyst read.
  for (const rv of reviews) {
    if (rv.then) continue;
    const h = uses.findLast((u) => u.tool === 'credit-desk.history' && u.ok && u.input.customer_id === rv.customer_id)?.output;
    rv.then = h?.decisions?.at(-1) ?? null;
  }

  // Supplier bills: the case's and those entered in this run, with what the AP clerk did.
  const read = (f: string) => (fs.existsSync(path.join(r.info.caseDir, f)) ? parseCsv(fs.readFileSync(path.join(r.info.caseDir, f), 'utf8')) : []);
  const suppliers = new Map(read('suppliers.csv').map((x) => [x.supplier_id, x]));
  const entered = uses.filter((u) => u.tool === 'credit-desk.enter_bill' && u.ok && u.output?.status === 'recorded').map((u) => ({ ...u.output.bill, entered_here: true }));
  const bills = [...read('bills.csv').map((b) => ({ ...b, amount: Number(b.amount) })), ...entered].map((b: any) => {
    const mine = uses.filter((u) => ['credit-desk.pay_bill', 'credit-desk.ap_action'].includes(u.tool) && u.ok && (u.input.bill_id === b.bill_id || u.input.subject === b.bill_id));
    const last = mine.at(-1);
    const paid = mine.find((u) => u.output?.status === 'paid')?.output.payment;
    const act = mine.findLast((u) => u.output?.status === 'recorded')?.output.action;
    const ask = askFor(b.bill_id);
    const s = suppliers.get(b.supplier_id);
    return {
      bill_id: b.bill_id, supplier: s?.name ?? b.supplier_id, supplier_invoice: b.supplier_invoice, due: b.due_date, amount: b.amount, entered_by: b.entered_by, entered_here: Boolean(b.entered_here),
      bank_changed: s?.bank_changed_on || null, was_paid: b.status === 'paid',
      status: b.status === 'paid' ? 'paid before' : paid ? 'paid' : act ? act.action : last?.output?.status ?? 'open',
      by: paid?.decided_by ?? act?.decided_by ?? null, why: last?.output?.why ?? last?.output?.reason ?? null,
      ask: ask ? { id: ask.id, question: ask.question } : null,
    };
  });

  const books = realBooks(r.info, box.tasks());
  const bal = balances(books.ledger);
  const sum = (prefix: string) => [...bal].filter(([k]) => k.startsWith(prefix)).reduce((n, [, v]) => n + v, 0) / 100;
  const started = Date.parse(r.at);
  const last = Math.max(started, ...tasks.map((t) => Date.parse(t.updatedAt)));
  return {
    ...base,
    run: {
      run: r.info.run, case: r.info.caseId, at: r.at, minutes: Math.max(1, Math.round((last - started) / 60000)),
      costCents: tasks.reduce((n, t) => n + t.costCents, 0), scripted: tasks.some((t) => t.worker === 'fake'),
      seats: tasks.map((t) => ({ seat: seat(t.id), id: t.id, state: t.state, costCents: t.costCents, story: story(t.id) })),
      approvals: pending.map((p) => ({ id: p.id, question: p.question, seat: seat(p.task) })),
      applications, reviews, bills,
      problems: uses.filter((u) => u.tool === 'credit-desk.flag' && u.ok).map((u) => ({ ids: u.input.ids, problem: u.input.problem, rules: u.input.rules, seat: seat(u.task) })),
      actions: uses.filter((u) => u.tool === 'credit-desk.collections_action' && u.ok && u.output?.status === 'recorded').map((u) => ({ ...u.output.action, detail: u.input.detail })),
      books: {
        errors: books.ledger.errors.length, transactions: books.ledger.transactions.length,
        bank: sum('Assets:Bank'), receivable: sum('Assets:Receivable'), payable: -sum('Liabilities:Payable'),
        posted: books.posted.map((p) => ({ seq: p.seq, seat: SEAT_KEY[p.seat] ?? p.seat, kind: p.kind, text: p.text })),
      },
      score: score && { summary: score.summary, caught: score.caught, total: score.total, false_alarms: score.false_alarms.length, precision: score.precision, errors: score.errors, moment: score.moment },
      impact: impact(r.info, events, box.tasks(), score),
    },
  };
}

/** The letter for a recorded decision or review in a run, or null when nothing adverse was decided. */
function letterFor(info: RunInfo, events: LogEvent[], tasks: Box['tasks'] extends () => infer T ? T : never, subject: string): string | null {
  const ids = new Set(tasks.filter((t) => runOf(t.source) === info.run).map((t) => t.id));
  const uses = toolUses(events, ids);
  const meta = JSON.parse(fs.readFileSync(path.join(info.caseDir, 'case.json'), 'utf8'));
  const dec = uses.findLast((u) => u.tool === 'credit-desk.credit_decision' && u.ok && u.output?.status === 'recorded' && u.input.application_id === subject);
  if (dec) {
    const f = path.join(info.caseDir, 'applications', `${safeId(subject)}.json`);
    const app = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : {};
    const d = dec.output.decision;
    return letter({ to: app.business?.legal_name ?? subject, date: meta.as_of, kind: 'decision', outcome: d.outcome, limit: d.limit, terms: d.terms, asked: { limit: app.request?.credit_limit ?? null, terms: app.request?.terms ?? null }, rules: d.rules, usedCreditReport: true });
  }
  const rev = uses.findLast((u) => u.tool === 'credit-desk.review' && u.ok && u.output?.status === 'recorded' && u.input.customer_id === subject);
  if (rev) {
    const v = rev.output.review;
    return letter({ to: v.name, date: meta.as_of, kind: 'review', outcome: v.outcome, limit: v.limit, terms: v.terms, rules: v.rules, usedCreditReport: false });
  }
  return null;
}
