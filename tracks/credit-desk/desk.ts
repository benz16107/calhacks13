// Shared pieces of the credit desk: the box's log, the rules file, run workspaces and controller questions.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { LogEvent } from '../../core/contract.ts';

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
  // The agent must never see the answers.
  fs.cpSync(info.caseDir, path.join(dir, 'case'), { recursive: true, filter: (src) => path.basename(src) !== 'answer_key.json' });
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
