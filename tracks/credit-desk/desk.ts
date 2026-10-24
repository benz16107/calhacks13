// Shared pieces of the credit desk: the box's log, the rules file, run workspaces and controller questions.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Ctx, LogEvent } from '../../core/contract.ts';
import { booksFromCase } from './books.ts';

export const HOME = process.env.BOX_HOME ?? '/var/lib/box';
export const TRACK_DIR = new URL('.', import.meta.url).pathname;
export const CASES_DIR = path.join(TRACK_DIR, 'cases');
export const DEFAULT_RULES = path.join(TRACK_DIR, 'rules', 'credit-rules.yaml');

export const workspaceDir = (ws: string) => path.join(HOME, 'workspaces', ws);
export const safeId = (id: unknown) => {
  if (typeof id !== 'string' || !/^[\w.-]+$/.test(id)) throw new Error(`not a valid id: ${JSON.stringify(id)}`);
  return id;
};

/** The box's action log, read from disk. A torn last line (after a power cut) is skipped. */
export function readLog(): LogEvent[] {
  const file = path.join(HOME, 'log.jsonl');
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf8').split('\n').flatMap((l) => {
    try {
      return l ? [JSON.parse(l) as LogEvent] : [];
    } catch {
      return [];
    }
  });
}

export interface ToolUse { task: string; key: string; tool: string; input: any; ok?: boolean; output?: any; error?: string; seq: number }

/** Every tool call by these tasks, paired with its result, in log order. */
export function toolUses(events: LogEvent[], tasks: Set<string>): ToolUse[] {
  const uses = new Map<string, ToolUse>();
  for (const e of events) {
    if (e.type === 'tool.call' && tasks.has(e.task)) uses.set(`${e.task}.${e.key}`, { task: e.task, key: e.key, tool: e.tool, input: e.input, seq: e.seq });
    if (e.type === 'tool.result') {
      const u = uses.get(`${e.task}.${e.key}`);
      if (u) Object.assign(u, { ok: e.ok, output: e.output, error: e.error });
    }
  }
  return [...uses.values()];
}

// ---------- the rules file ----------
// Any rules file works if it gives each rule an `id: XXX-N` line and the analyst an `authority_limit: N`.

export interface Rules { file: string; ids: Set<string>; authority: number }

export function loadRules(file: string): Rules {
  const text = fs.readFileSync(file, 'utf8');
  const ids = new Set([...text.matchAll(/^\s*-?\s*id:\s*([A-Za-z]+-[A-Za-z0-9]+)\s*$/gm)].map((m) => m[1]));
  const authority = Number(text.match(/^\s*authority_limit:\s*(\d+)/m)?.[1]);
  if (!ids.size) throw new Error(`${file} has no rule ids (lines like "id: SOD-1")`);
  if (!Number.isFinite(authority)) throw new Error(`${file} has no authority_limit for the credit analyst`);
  return { file, ids, authority };
}

export function checkRules(rules: Rules, cited: unknown): string[] {
  if (!Array.isArray(cited) || !cited.length) throw new Error('cite at least one rule id from rules.yaml');
  const unknown = cited.filter((r) => !rules.ids.has(String(r)));
  if (unknown.length) throw new Error(`these rule ids are not in rules.yaml: ${unknown.join(', ')}`);
  return cited.map(String);
}

// ---------- runs ----------
// A run is one case worked by one or both seats. Its workspace holds the case without the answer key.

export interface RunInfo { run: string; caseId: string; caseDir: string; rulesFile: string; workspace: string; nessie: boolean }

/** The run's starting files, staged in a root-only folder for box.workspace: the case without its answer key. */
export function stageWorkspace(info: RunInfo): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'credit-desk-'));
  // The agent must never see the answers, nor the bank's own records when the bank (Nessie) holds them.
  const hidden = new Set(['answer_key.json', 'controller.json', 'guarantors.json', ...(info.nessie ? ['bank_events.csv'] : [])]);
  fs.cpSync(info.caseDir, path.join(dir, 'case'), { recursive: true, filter: (src) => !hidden.has(path.basename(src)) });
  // The seats never see protected attributes or the guarantor's identity; the CRS tool reads those from the original.
  const apps = path.join(dir, 'case', 'applications');
  if (fs.existsSync(apps)) {
    for (const f of fs.readdirSync(apps).filter((x) => x.endsWith('.json'))) {
      const file = path.join(apps, f);
      fs.writeFileSync(file, JSON.stringify(redactApplication(JSON.parse(fs.readFileSync(file, 'utf8'))), null, 2) + '\n');
    }
  }
  fs.mkdirSync(path.join(dir, 'books'));
  fs.writeFileSync(path.join(dir, 'books', 'ledger.beancount'), booksFromCase(info.caseDir));
  fs.copyFileSync(info.rulesFile, path.join(dir, 'rules.yaml'));
  const meta = JSON.parse(fs.readFileSync(path.join(info.caseDir, 'case.json'), 'utf8'));
  const profile = meta.company_profile && path.resolve(info.caseDir, meta.company_profile);
  if (profile && fs.existsSync(profile)) fs.copyFileSync(profile, path.join(dir, 'company.md'));
  return dir;
}

/** The run a task belongs to: its source is 'credit-desk:<run>'. */
export const runOf = (source: string) => (source.startsWith('credit-desk:') ? source.slice('credit-desk:'.length) : undefined);

export function runInfo(events: LogEvent[], run: string): RunInfo | undefined {
  for (const e of events) {
    const d = e.type === 'note' && e.track === 'credit-desk' ? (e.data as { kind?: string; info?: RunInfo }) : undefined;
    if (d?.kind === 'run.started' && d.info?.run === run) return d.info;
  }
}

// ---------- the controller ----------
// Tools cannot pause a task, so a decision that needs the controller comes back with a question. The task asks it
// with box_ask; the core pauses the task until someone answers; the tool then finds the answer by its marker.

export const marker = (subject: string, action: string, amount = 0) => `[${subject} ${action} ${amount}]`;

export function controllerAnswer(approvals: { task: string; question: string; state: string; id: string; by?: string }[], task: string, mark: string) {
  return approvals.findLast((a) => a.task === task && a.question.includes(mark));
}

export const money = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;

// ---------- what tools share ----------
// Tools read the case from the run's base workspace, which no task can write: a task changes only its own copy.

export const caseFile = (ctx: Ctx, ...p: string[]) => {
  if (!ctx.task) throw new Error('only a task can use this tool');
  return path.join(workspaceDir(ctx.task.workspace), ...p);
};
/** The full application, from the original case: only tools in the core read it. The seats get a redacted copy. */
export const application = (ctx: Ctx, id: unknown) => {
  const info = runInfo(readLog(), runOf(ctx.task?.source ?? '') ?? '');
  if (!info) throw new Error('only a credit desk task can use this tool');
  const file = path.join(info.caseDir, 'applications', `${safeId(id)}.json`);
  if (!fs.existsSync(file)) throw new Error(`there is no application ${id} in this case`);
  return JSON.parse(fs.readFileSync(file, 'utf8'));
};
export const rulesOf = (ctx: Ctx) => loadRules(caseFile(ctx, 'rules.yaml'));

/** What a decision needing the controller returns until the controller has answered. */
export function controllerGate(ctx: Ctx, mark: string, question: string): { pending?: { status: string; ask: string; then: string }; approval?: { id: string; approved: boolean; by: string; reason?: string } } {
  const a = controllerAnswer(ctx.box.approvals(), ctx.task!.id, mark);
  if (a && a.state !== 'pending') {
    return { approval: { id: a.id, approved: a.state === 'approved', by: a.by ?? 'unknown', ...(a.state === 'denied' ? { reason: denyReason(a.id) } : {}) } };
  }
  return {
    pending: {
      status: 'needs controller',
      ask: question,
      then: 'Call box_ask with exactly this question. When it is answered, call this tool again with the same input to record the outcome.',
    },
  };
}

/** The reason the controller gave with a no (the window asks for one), from the log. */
export function denyReason(approval: string): string | undefined {
  for (const e of readLog().reverse()) {
    const d = e.type === 'note' && e.track === 'credit-desk' ? (e.data as { kind?: string; approval?: string; reason?: string }) : undefined;
    if (d?.kind === 'answer.reason' && d.approval === approval) return d.reason;
  }
}

/** A task's seat: 'Credit analyst', 'Collections clerk' or 'AP clerk', from its title. */
export const seatOf = (t: { title: string }) => t.title.split(':')[0];

export const strings = { type: 'array', items: { type: 'string' } };
export const rulesField = { ...strings, description: 'Rule ids from rules.yaml that this rests on, e.g. ["FRD-1", "LIM-1"].' };

/** Rule id to its text, from a rules file (folded `>-` texts joined into one line). */
export function ruleTexts(file: string): Map<string, string> {
  const out = new Map<string, string>();
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  for (let i = 0; i < lines.length; i++) {
    const id = lines[i].match(/^\s*-\s*id:\s*([A-Za-z]+-[A-Za-z0-9]+)\s*$/)?.[1];
    if (!id) continue;
    const t = lines[i + 1]?.match(/^\s*text:\s*(.*)$/)?.[1] ?? '';
    if (t && t !== '>-' && t !== '>') { out.set(id, t); continue; }
    const body: string[] = [];
    for (let j = i + 2; j < lines.length && /^\s{6,}\S/.test(lines[j]); j++) body.push(lines[j].trim());
    out.set(id, body.join(' '));
  }
  return out;
}

// ---------- fairness and privacy ----------
// Protected attributes under ECOA and Regulation B (12 CFR 1002.4, 1002.5): race, color, religion, national origin,
// sex, marital status, age, receipt of public assistance. Plus the usual proxies and the guarantor's identity data.
export const PROTECTED_KEYS = [
  'race', 'ethnicity', 'color', 'colour', 'religion', 'national_origin', 'nationality', 'citizenship', 'sex', 'gender',
  'marital_status', 'age', 'dob', 'date_of_birth', 'birth_date', 'public_assistance', 'disability', 'sexual_orientation', 'pregnancy',
];
const GUARANTOR_KEPT = ['title', 'ownership_pct'];

/** What a seat may see of an application: no protected attribute anywhere, and of the guarantor only role and stake. */
export function redactApplication(app: any): any {
  const strip = (v: any): any => {
    if (Array.isArray(v)) return v.map(strip);
    if (v && typeof v === 'object') {
      return Object.fromEntries(Object.entries(v).filter(([k]) => !PROTECTED_KEYS.includes(k.toLowerCase())).map(([k, x]) => [k, strip(x)]));
    }
    return v;
  };
  const out = strip(app);
  if (out.guarantor) {
    out.guarantor = {
      ...Object.fromEntries(GUARANTOR_KEPT.filter((k) => k in out.guarantor).map((k) => [k, out.guarantor[k]])),
      held_by_the_desk: 'Name, SSN, date of birth, address and contacts are checked through CRS by the desk\'s tools and never shown to a seat.',
    };
  }
  return out;
}
