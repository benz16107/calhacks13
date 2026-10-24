// The action log in words, and a task's diff. Shared by Tasks, Activity and Time Machine.
import { box, type LogEvent, type Task } from '../live.ts';
import { STATE, clock, dollars, who } from '../util.ts';
import { STEPS } from '../setup.tsx';
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

/** An app's name for a track id, as App Center shows it. */
const appName = (track: string) => box.apps.find((a) => a.track === track)?.title.replace(/\s*\(.*\)$/, '') ?? track[0].toUpperCase() + track.slice(1).replace(/-/g, ' ');
const words = (k: string) => k.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[._-]+/g, ' ').toLowerCase();

/** A note in the log as a sentence. Core and the apps write notes as data; nobody should read raw JSON on screen. */
export function noteText(e: Extract<LogEvent, { type: 'note' }>): string {
  const d = (e.data ?? {}) as Record<string, any>;
  if (typeof e.data === 'string') return `${appName(e.track)}: ${e.data}`;
  if (typeof d.text === 'string') return d.text;
  const by = typeof d.by === 'string' ? who(d.by) : '';
  switch (e.track) {
    case 'setup':
      if (d.finished) return 'Setup finished';
      if (d.reopened) return 'Setup opened again';
      return `Setup: ${STEPS.find((s) => s.id === d.step)?.label ?? d.step} done`;
    case 'apps':
      return d.enabled ? `${appName(d.enabled)} turned on` : d.disabled ? `${appName(d.disabled)} turned off` : 'Apps changed';
    case 'owner':
      return d.owner ? `The owner is now ${d.owner}` : 'The owner was cleared';
    case 'settings': {
      const c = d.changed ?? {};
      if ('paused' in c) return c.paused.to ? 'Every agent paused' : 'Agents resumed';
      return `Settings changed: ${Object.keys(c).map(words).join(', ')}`;
    }
    case 'kill-switch':
      if (d.drill) return `${by || 'Someone'} ran a kill switch drill`;
      return d.paused ? `${by || 'Someone'} paused every agent` : `${by || 'Someone'} resumed the agents`;
    case 'remote':
      return d.remote === 'on' ? `Remote access turned on${d.url ? `: ${String(d.url).replace(/^https:\/\//, '')}` : ''}` : 'Remote access turned off';
    case 'security':
      return d.tripwire ? `A task touched a planted fake key${d.where ? ` (${d.where})` : ''}. Blocked.` : 'Security note';
    case 'business':
      if (d.refused) return `${by || 'Someone'} tried to ${d.approved ? 'approve' : 'deny'} a request and was refused`;
      if (d.sso) return `Work sign-in ${d.sso}${d.person ? ` for ${d.person}` : ''}`;
      if (d.person) return `${by || 'Someone'} ${d.change ?? 'changed'} ${d.person}`;
      if (d.changed) return `${by || 'Someone'} changed ${(d.changed as string[]).map(words).join(', ')}`;
  }
  // An app's own note: its verb (kind or action), then a few short facts. Everything else is under Technical details.
  const verb = typeof d.kind === 'string' ? d.kind : typeof d.action === 'string' ? d.action : '';
  const facts = Object.entries(d)
    .filter(([k, v]) => k !== 'kind' && k !== 'action' && (typeof v === 'string' || typeof v === 'number') && String(v).length <= 60)
    .slice(0, 3)
    .map(([k, v]) => `${words(k)} ${v}`);
  return `${appName(e.track)}: ${[words(verb), ...facts].filter(Boolean).join(', ') || 'a note'}`;
}

/** A step with nothing to say (the scripted worker's waits): kept in the log for resume, left off every list. */
export const silent = (e: LogEvent) => e.type === 'task.step' && !e.text;

/** One log event as a sentence. `tone` marks what deserves color: blocked attempts, requests, spending. */
export function describe(e: LogEvent, events: LogEvent[]): { text: string; data: string; tone?: 'blocked' | 'ask' | 'money' } {
  switch (e.type) {
    case 'task.created': {
      const s = e.spec;
      return {
        text: `Started by ${s.source}, ${s.worker === 'droid' ? 'a Claude agent' : 'a scripted agent (test)'}, ${s.hosts.length ? `may reach ${s.hosts.join(', ')}` : 'no internet'}${s.budgetCents ? `, budget ${dollars(s.budgetCents)}` : ''}`,
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
      return { text: `Asked GurtOS to run ${e.tool}`, data: `tool.call  ${e.tool}  ${short(e.input, 80)}` };
    case 'tool.result':
      return e.ok
        ? { text: `${toolOf(events, e.key)} finished${e.cents ? `, spent ${dollars(e.cents)}` : ''}`, data: `tool.result  ok${e.cents ? `  ${dollars(e.cents)}` : ''}`, tone: e.cents ? 'money' : undefined }
        : { text: `Blocked: ${toolOf(events, e.key)} was refused: ${e.error}`, data: 'tool.result  refused', tone: 'blocked' };
    case 'approval.asked':
      return { text: `Asks: ${e.approval.question}`, data: `approval.asked  ${e.approval.id}`, tone: 'ask' };
    case 'approval.answered':
      return { text: `${e.approved ? 'Approved' : 'Denied'} by ${who(e.by)}`, data: `approval.answered  by ${e.by}`, tone: 'ask' };
    case 'cost':
      return { text: `Spent ${dollars(e.cents)} on ${e.what}${e.model ? ` (${e.model})` : ''}`, data: `cost  ${e.model ?? ''}`.trim(), tone: 'money' };
    case 'net.blocked':
      return { text: `Blocked: reaching ${e.host}, not one of this task's hosts`, data: `net.blocked  ${e.host} is not in this task's hosts`, tone: 'blocked' };
    case 'note':
      return { text: noteText(e), data: 'note' };
    default:
      return { text: (e as LogEvent).type, data: '' };
  }
}

/** The short name of an event's kind, as Activity's Kind column shows it. */
export function kindOf(e: LogEvent): string {
  switch (e.type) {
    case 'task.created':
      return 'New task';
    case 'task.state':
      return STATE[e.state][0];
    case 'task.step':
      return 'Step';
    case 'tool.call':
      return 'Tool';
    case 'tool.result':
      return e.ok ? 'Tool' : 'Blocked';
    case 'approval.asked':
      return 'Request';
    case 'approval.answered':
      return e.approved ? 'Approved' : 'Denied';
    case 'cost':
      return 'Spent';
    case 'net.blocked':
      return 'Blocked';
    case 'keep':
      return 'Keep';
    case 'note':
      return e.track === 'setup' ? 'Setup' : appName(e.track);
    default:
      return (e as LogEvent).type;
  }
}

/** What Activity's detail pane says about one event: a few facts first, and every raw field under Technical details.
 * Never a key: the log holds none. */
export function fieldsOf(e: LogEvent): { main: [string, string][]; raw: [string, string][] } {
  const t = e.task ? box.tasks.get(e.task) : undefined;
  const ms = String(new Date(e.at).getMilliseconds()).padStart(3, '0');
  const main: [string, string][] = [['What happened', describe(e, box.events).text], ['When', clock(e.at)]];
  if (t) main.push(['Task', t.title]);
  if (e.type === 'approval.asked') main.push(['Cost', dollars(e.approval.costCents)]);
  if (e.type === 'task.created') main.push(['Started by', e.spec.source], ['Sites it may reach', e.spec.hosts.join(', ') || 'None'], ['Budget', dollars(e.spec.budgetCents)]);
  if (e.type === 'net.blocked') main.push(['Sites it may reach', t?.hosts.join(', ') || 'None'], ['Stopped by', "the task's network rules"]);
  const raw: [string, string][] = [['event', String(e.seq)], ['type', e.type]];
  if (e.task) raw.push(['task', e.task]);
  if (t) raw.push(['user', t.user]);
  for (const [k, v] of Object.entries(e)) {
    if (['seq', 'at', 'type', 'task', 'spec', 'approval'].includes(k) || v === undefined) continue;
    raw.push([k, k === 'cents' ? dollars(v as number) : short(v, 400)]);
  }
  raw.push(['at', `${e.at.slice(0, 19)}.${ms}`]);
  return { main, raw };
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
