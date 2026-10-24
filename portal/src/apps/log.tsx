// The action log in words, and a task's diff. Shared by Tasks, Activity and Time Machine.
import { box, type LogEvent, type Task } from '../live.ts';
import { STATE, clock, dollars } from '../util.ts';
import './windows.css';

export interface Diff {
  changes: { path: string; change: 'added' | 'modified' | 'deleted' }[];
  diff: string;
}

function toolOf(events: LogEvent[], key: string) {
  const c = events.findLast((e) => e.type === 'tool.call' && e.key === key);
  return c?.type === 'tool.call' ? c.tool : 'the tool';
}
const short = (v: unknown, n = 120) => {
  const s = typeof v === 'string' ? v : (JSON.stringify(v) ?? '');
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
};

/** One log event as a sentence. `tone` marks what deserves color: blocked attempts, requests, spending. */
export function describe(e: LogEvent, events: LogEvent[]): { text: string; data: string; tone?: 'blocked' | 'ask' | 'money' } {
  switch (e.type) {
    case 'task.created': {
      const s = e.spec;
      return {
        text: `Created by ${s.source}: worker ${s.worker === 'droid' ? 'Droid' : 'scripted (test)'}, ${s.hosts.length ? `hosts ${s.hosts.join(', ')}` : 'no network'}${s.budgetCents ? `, budget ${dollars(s.budgetCents)}` : ''}`,
        data: `task.created  user ${e.user}  hosts ${s.hosts.join(' ') || 'none'}`,
      };
    }
    case 'task.state':
      return {
        text: `${STATE[e.state][0]}${e.error ? `: ${e.error}` : ''}${e.summary ? `: ${e.summary}` : ''}`,
        data: `task.state ${e.state}`,
        tone: e.state === 'failed' ? 'blocked' : undefined,
      };
    case 'task.step':
      return { text: e.text, data: e.data === undefined ? 'task.step' : `task.step  ${short(e.data, 80)}` };
    case 'keep':
      return {
        text: e.result === 'kept' ? 'Kept: its changes are in your folder' : e.result === 'conflict' ? `Not kept: you changed ${e.conflicts?.join(', ') ?? 'the same files'} too` : e.result === 'reverted' ? 'The Keep was undone' : 'Waiting for you to Keep its changes',
        data: `keep ${e.result}`,
      };
    case 'tool.call':
      return { text: `Asked the box to run ${e.tool}`, data: `tool.call  ${e.tool}  ${short(e.input, 80)}` };
    case 'tool.result':
      return e.ok
        ? { text: `${toolOf(events, e.key)} finished${e.cents ? `, spent ${dollars(e.cents)}` : ''}`, data: `tool.result  ok${e.cents ? `  ${dollars(e.cents)}` : ''}`, tone: e.cents ? 'money' : undefined }
        : { text: `Blocked: ${toolOf(events, e.key)} was refused: ${e.error}`, data: 'tool.result  refused', tone: 'blocked' };
    case 'approval.asked':
      return { text: `Asks: ${e.approval.question}`, data: `approval.asked  ${e.approval.id}`, tone: 'ask' };
    case 'approval.answered':
      return { text: `${e.approved ? 'Approved' : 'Denied'} by ${e.by}`, data: `approval.answered  by ${e.by}`, tone: 'ask' };
    case 'cost':
      return { text: `Spent ${dollars(e.cents)} on ${e.what}${e.model ? ` (${e.model})` : ''}`, data: `cost  ${e.model ?? ''}`.trim(), tone: 'money' };
    case 'net.blocked':
      return { text: `Blocked: reaching ${e.host}, not one of this task's hosts`, data: `net.blocked  ${e.host} is not in this task's hosts`, tone: 'blocked' };
    case 'note':
      return { text: `${e.track}: ${short(e.data)}`, data: 'note' };
    default:
      return { text: (e as LogEvent).type, data: '' };
  }
}

/** The short name of an event's kind, as Activity's chip shows it. */
export const kindOf = (e: LogEvent) => (e.type === 'task.step' ? 'step' : e.type === 'task.state' && e.state === 'undone' ? 'task.undone' : e.type);

/** Every field of an event worth reading, for Activity's detail pane. Never a key: the log holds none. */
export function fieldsOf(e: LogEvent): [string, string][] {
  const t = e.task ? box.tasks.get(e.task) : undefined;
  const out: [string, string][] = [];
  if (e.task) out.push(['task', e.task]);
  if (t) out.push(['user', t.user]);
  for (const [k, v] of Object.entries(e)) {
    if (['seq', 'at', 'type', 'task', 'spec', 'approval'].includes(k) || v === undefined) continue;
    out.push([k, k === 'cents' ? dollars(v as number) : short(v, 80)]);
  }
  if (e.type === 'approval.asked') out.push(['question', e.approval.question], ['cost', dollars(e.approval.costCents)]);
  if (e.type === 'task.created') out.push(['source', e.spec.source], ['worker', e.spec.worker], ['hosts', e.spec.hosts.join(' ') || 'none'], ['budget', dollars(e.spec.budgetCents)]);
  if (e.type === 'net.blocked') out.push(['allowed', t?.hosts.join(' ') || 'none'], ['by', "the task's network proxy"]);
  const ms = String(new Date(e.at).getMilliseconds()).padStart(3, '0');
  out.push(['at', `${clock(e.at)}.${ms}`]);
  return out;
}

/** What an Undo confirm says. A track can say what else undo does with `undo` in a step's data (Shopper: "Undo
 * refunds this $13.00 test payment."); the newest one wins. */
export function undoCopy(t: Pick<Task, 'id' | 'source'>, files?: number) {
  const step = box.events.findLast((e) => e.task === t.id && e.type === 'task.step' && typeof (e.data as { undo?: unknown })?.undo === 'string');
  const extra = step?.type === 'task.step' ? (step.data as { undo: string }).undo : t.source.startsWith('shopper') ? 'Its test payment is refunded.' : '';
  const refund = /refund/i.test(extra);
  const leave = files === 1 ? 'Its 1 file leaves' : files ? `Its ${files} files leave` : 'Its changes leave';
  return {
    body: `${extra ? `${extra} ` : ''}${leave} the workspace and the task is marked undone. Every other task keeps its changes. The log keeps every step.`,
    action: refund ? 'Undo and refund (test)' : 'Undo task',
  };
}

/** A unified diff, one row per line. `reverse` shows what comes back if the task is undone. */
export function DiffView({ text, reverse, undone }: { text: string; reverse?: boolean; undone?: boolean }) {
  const rows = text.split('\n').flatMap((l): { sign: string; code: string; kind: string }[] => {
    if (l.startsWith('+++ ')) return [{ sign: ' ', code: l.slice(6), kind: 'file' }];
    if (l.startsWith('--- ') || l.startsWith('@@') || l.startsWith('\\') || l === '') return [];
    const add = l.startsWith('+') !== !!reverse;
    if (l[0] === '+' || l[0] === '-') return [{ sign: add ? '+' : '-', code: l.slice(1), kind: add ? 'add' : 'del' }];
    return [{ sign: ' ', code: l.slice(1), kind: 'ctx' }];
  });
  return (
    <div class={`gos-diff${undone ? ' is-undone' : ''}`} role="region" aria-label={reverse ? 'What comes back' : 'Changes'} tabIndex={0}>
      {rows.slice(0, 400).map((r, i) => (
        <div class={`gos-dl gos-dl-${r.kind}`} key={i}>
          <span class="gos-dl-sign" aria-hidden="true">
            {r.sign}
          </span>
          <span class="gos-dl-code">
            {r.kind === 'add' ? <span class="g-sr">added: </span> : r.kind === 'del' ? <span class="g-sr">removed: </span> : null}
            {r.code}
          </span>
        </div>
      ))}
    </div>
  );
}
