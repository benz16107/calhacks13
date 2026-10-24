// Start the seats on a case. The route POST /t/credit-desk/run, the nightly re-check and a guest's credit request all
// come through here, so a run is made one way.
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { Box } from '../../core/contract.ts';
import { checkCase } from './check-case.ts';
import { DEFAULT_RULES, loadRules, stageWorkspace, type RunInfo } from './desk.ts';
import * as scripted from './scripts.ts';
import { caseDirOf } from './uploads.ts';
import { ANALYST_TOOLS, AP_TOOLS, CLERK_TOOLS, analystPrompt, apPrompt, clerkPrompt } from './seats.ts';

/** {case} or {dir}, optional {rules}, {seats}, {scripted}, {script: {analyst: "fake worker lines"}} (no model), and {extra}: more instructions for the analyst seat. */
export async function startRun(box: Box, body: any): Promise<Response> {

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
  const info: RunInfo = { run, caseId: meta.case_id, caseDir, rulesFile, workspace: `credit-desk-${run}`, nessie: meta.nessie === true, ...(body.guest ? { guest: true } : {}) };
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
  const worker = body.scripted || body.script ? 'fake' : 'droid';
  const script = body.script ?? scripted.SCRIPTS[meta.case_id] ?? {};
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
    const prompt = worker === 'fake' ? (script as Record<string, string>)[seat.key] : seat.prompt(brief) + (body.extra && seat.key === 'analyst' ? `\n\n${body.extra}` : '');
    if (!prompt) continue;
    tasks[seat.key] = (await box.createTask({
      title: `${seat.title}: ${meta.case_id}`, workspace: info.workspace, worker, seat: seat.title, source: `credit-desk:${run}`, tools: withBank([...seat.tools]), prompt,
    })).id;
  }
  return Response.json({ run, workspace: info.workspace, rules: rulesFile, tasks });
}
