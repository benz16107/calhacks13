// What one action-log event becomes in Elastic: one flat document, its mapping, and who sent it.
// Pure apart from reading the environment once. Nothing here talks to Elastic.
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { LogEvent, Task } from '../../core/contract.ts';

export const INDEX = 'box-actions';
/** Where Elastic's agent and its alert rules leave requests for a box. The box reads them and asks the owner. */
export const REQUESTS = 'box-requests';
export const HOME = path.resolve(process.env.BOX_HOME ?? '/var/lib/box');
export const installed = HOME === '/var/lib/box';
// Two Lima VMs both call themselves lima-box, so the machine id is what keeps their documents apart.
const machine = (() => {
  try {
    return fs.readFileSync('/etc/machine-id', 'utf8').trim().slice(0, 12) || os.hostname();
  } catch {
    return os.hostname();
  }
})();
/** Which box and run a document came from. The installed box is run 'installed'; a ./demo run is its run id. */
export const BOX = { name: process.env.BOX_NAME ?? os.hostname(), machine, run: installed ? 'installed' : path.basename(HOME) };
export const DIR = path.join(HOME, 'elastic');
export const OUTBOX = path.join(DIR, 'outbox.ndjson');

// Only the installed box ships, and a ./demo run with DEMO_LIVE=elastic. Dev and test boxes with their own BOX_HOME
// stay out of the index. A demo (DEMO_LIVE set, maybe empty) keeps its whole outbox for the demo step.
export const inDemo = process.env.DEMO_LIVE !== undefined;
export const live = installed || (process.env.DEMO_LIVE ?? '').split(/[\s,]+/).includes('elastic');

/** The hash of one log line, the same SHA-256 the core chains entries with. */
export const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

const kw = { type: 'keyword' };
const text = { type: 'text' };
const long = { type: 'long' };
export const MAPPING = {
  dynamic: false, // anything not listed stays in _source only (event.original, for example)
  properties: {
    '@timestamp': { type: 'date' },
    message: text,
    // Meaning, not words: ELSER finds "who approved the release" in a step that says "Priya OK'd deploy 7".
    semantic: { type: 'semantic_text' },
    app: kw,
    cost_cents: { type: 'double' },
    error: { type: 'keyword', ignore_above: 1024, fields: { text } },
    summary: text,
    event: { properties: { seq: long, type: kw, hash: kw, prev: kw } },
    box: { properties: { name: kw, machine: kw, run: kw } },
    // Business: the people behind an event. These are the fields Elastic's roles filter on.
    who: { properties: { asked: kw, seat: kw, approver: kw, trigger: kw, by: kw } },
    task: {
      properties: {
        id: kw, title: { type: 'keyword', fields: { text } }, source: kw, workspace: kw, worker: kw, state: kw, seat: kw,
        hosts: kw, tools: kw, budget_cents: { type: 'double' }, user: kw, prompt: text,
      },
    },
    step: { properties: { text } },
    tool: { properties: { name: kw, track: kw, key: kw, ok: { type: 'boolean' }, input: text, output: text, error: { type: 'keyword', ignore_above: 1024 } } },
    approval: {
      properties: {
        id: kw, question: text, cost_cents: { type: 'double' }, state: kw, approved: { type: 'boolean' }, by: kw,
        person: kw, via: kw, asked_by: kw, to: kw, route_people: kw,
      },
    },
    cost: { properties: { what: kw, model: kw, tokens: { properties: { input: long, output: long, cache_write: long, cache_read: long } } } },
    net: { properties: { host: kw, domain: kw } },
    files: { properties: { added: kw, modified: kw, deleted: kw, count: { type: 'integer' } } },
    note: { properties: { track: kw, kind: kw, data: text } },
    // The box checking its own log against this index. Written through the create-only key, so it cannot be changed.
    integrity: { properties: { ok: { type: 'boolean' }, checked: long, through_seq: long, pending: long, edited: long, missing: long, reordered: long, local_breaks: long } },
  },
};

/** The requests index. The box reads its own rows; Elastic's agent and rules write them. */
export const REQUESTS_MAPPING = {
  dynamic: false,
  properties: {
    '@timestamp': { type: 'date' },
    action: kw, // 'undo' (ask to stop a task and remove its changes), or 'alert' (an alert rule fired)
    task: kw,
    rule: kw,
    reason: text,
    box: { properties: { machine: kw } },
    by: kw,
  },
};

type Change = { path: string; change: 'added' | 'modified' | 'deleted' };
const json = (v: unknown, max = 2000) => (v === undefined ? undefined : JSON.stringify(v).slice(0, max));
const usd = (cents: number) => `$${(cents / 100).toFixed(2)}`;

/**
 * One log event as one flat document. `t` is the task as the box knows it now; only its fixed fields
 * (title, source, workspace, worker, hosts, tools, budget) are copied, so every document says whose it is.
 */
export function toDoc(e: LogEvent, t?: Task, extra: { tool?: string; changes?: Change[] } = {}) {
  const title = t ? `"${t.title}"` : 'the box';
  const d: Record<string, any> = {
    '@timestamp': e.at,
    // `hash` is the line's SHA-256 and `prev` the one the core chained to it. Elastic keeps these where the box cannot rewrite them.
    event: { seq: e.seq, type: e.type, hash: sha256(JSON.stringify(e)), prev: e.prev, original: json(e, 8000) },
    box: BOX,
    app: e.type === 'note' ? e.track : t?.source.split(':')[0],
  };
  if (e.who) d.who = { asked: e.who.asked, seat: e.who.seat, approver: e.who.approver, trigger: e.who.trigger, by: e.who.by };
  if (t) {
    d.task = { id: t.id, title: t.title, source: t.source, workspace: t.workspace, worker: t.worker, hosts: t.hosts, tools: t.tools, budget_cents: t.budgetCents, seat: t.seat };
  }
  switch (e.type) {
    case 'task.created':
      Object.assign(d.task ?? (d.task = { id: e.task, title: e.spec.title, source: e.spec.source }), { user: e.user, prompt: e.spec.prompt.slice(0, 4000) });
      d.app ??= e.spec.source.split(':')[0];
      d.message = `Task ${title} was created by ${e.who?.asked ?? e.spec.source}: worker ${e.spec.worker}, hosts ${e.spec.hosts.join(', ') || 'none'}, budget ${usd(e.spec.budgetCents)}`;
      break;
    case 'task.state': {
      d.task = { ...d.task, state: e.state };
      d.error = e.error;
      d.summary = e.summary;
      const c = extra.changes ?? [];
      const by = (k: Change['change']) => c.filter((x) => x.change === k).map((x) => x.path).slice(0, 200);
      if (e.state === 'done') d.files = { added: by('added'), modified: by('modified'), deleted: by('deleted'), count: c.length };
      const changed = c.length ? `, changing ${c.length} file${c.length > 1 ? 's' : ''}: ${c.slice(0, 10).map((x) => `${x.path} (${x.change})`).join(', ')}` : '';
      const said: Record<string, string> = {
        queued: 'is queued', running: 'is running', waiting: 'is waiting for an OK', done: 'is done',
        undone: 'was undone: its file changes were removed', failed: `failed: ${e.error ?? 'no reason given'}; its file changes were not applied`,
      };
      d.message = `Task ${title} ${said[e.state]}${changed}${e.summary ? `. Summary: ${e.summary}` : ''}`;
      break;
    }
    case 'task.step':
      d.step = { text: e.text.slice(0, 4000) };
      d.message = `${title}: ${e.text.slice(0, 500)}`;
      break;
    case 'tool.call':
      d.tool = { name: e.tool, track: e.tool.split('.')[0], key: e.key, input: json(e.input) };
      d.message = `${title} called ${e.tool} with ${json(e.input, 300)}`;
      break;
    case 'tool.result': {
      const name = extra.tool;
      d.tool = { name, track: name?.split('.')[0], key: e.key, ok: e.ok, output: json(e.output), error: e.error };
      d.cost_cents = e.cents;
      d.message = `${name ?? 'A tool'} ${e.ok ? 'returned' : `failed (${e.error})`} for ${title}${e.cents ? `, spending ${usd(e.cents)}` : ''}`;
      break;
    }
    case 'approval.asked': {
      const a = e.approval;
      d.approval = { id: a.id, question: a.question, cost_cents: a.costCents, state: 'pending', asked_by: a.askedBy, to: a.route?.to, route_people: a.route?.people.map((p) => p.id) };
      d.message = `${title} paused to ask: ${a.question}${a.route ? ` (goes to ${a.route.to}; ${a.route.people.map((p) => p.name).join(', ') || 'nobody'} may answer)` : ''}`;
      break;
    }
    case 'approval.answered':
      d.approval = { id: e.id, approved: e.approved, by: e.by, person: e.person, via: e.via, state: e.approved ? 'approved' : 'denied' };
      d.message = `${e.by} ${e.approved ? 'approved' : 'denied'} the request from ${title} (${e.id})${e.via ? ` from ${e.via}` : ''}`;
      break;
    case 'cost': {
      const k = e.tokens;
      d.cost_cents = e.cents;
      d.cost = { what: e.what, model: e.model, tokens: k && { input: k.input, output: k.output, cache_write: k.cacheWrite, cache_read: k.cacheRead } };
      d.message = `${title} spent ${usd(e.cents)} on ${e.what}${e.model ? ` (${e.model})` : ''}`;
      break;
    }
    case 'net.blocked':
      d.net = { host: e.host, domain: e.host.replace(/:\d+$/, '') };
      d.message = `The box blocked ${title} from reaching ${e.host}; it may reach only ${t?.hosts.join(', ') || 'no hosts'}`;
      break;
    case 'note': {
      const data = e.data as { kind?: unknown; ok?: boolean; checked?: number; throughSeq?: number; pending?: number; edited?: number[]; missing?: number[]; reordered?: number[]; localBreaks?: number[] };
      const kind = typeof data?.kind === 'string' ? data.kind : undefined;
      d.note = { track: e.track, kind, data: json(e.data, 4000) };
      d.message = `${e.track} noted ${kind ?? 'something'}${t ? ` for ${title}` : ''}: ${json(e.data, 300)}`;
      if (kind === 'integrity') {
        // The counts are searchable; the seqs of the entries that do not match stay in note.data.
        d.integrity = { ok: data.ok, checked: data.checked, through_seq: data.throughSeq, pending: data.pending, edited: data.edited?.length, missing: data.missing?.length, reordered: data.reordered?.length, local_breaks: data.localBreaks?.length };
        d.message = data.ok
          ? `The ${BOX.name} box checked its log against this index: ${data.checked} entries match${data.pending ? `, ${data.pending} not shipped yet` : ''}`
          : `INTEGRITY ALERT: the ${BOX.name} box's log no longer matches this index: ${data.edited?.length ?? 0} edited, ${data.missing?.length ?? 0} missing, ${data.reordered?.length ?? 0} reordered, ${data.localBreaks?.length ?? 0} broken links (first at entry ${[...(data.edited ?? []), ...(data.missing ?? []), ...(data.reordered ?? []), ...(data.localBreaks ?? [])].sort((a, b) => a - b)[0]})`;
      }
      break;
    }
  }
  // Steps, tool calls, approvals, blocks and notes are what people search for by meaning. Costs and plain state changes are not.
  if (['task.created', 'task.step', 'tool.call', 'tool.result', 'approval.asked', 'approval.answered', 'net.blocked', 'note'].includes(e.type) || (e.type === 'task.state' && e.state === 'failed')) d.semantic = d.message;
  return d;
}
