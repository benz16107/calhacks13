// The Jira track. Every box task becomes a Jira issue holding its prompt, steps, tool calls, the agent's own
// account of its reasoning, cost, approvals, blocked attempts and the diff of the files it changed. The Forge app
// (forge/) is the control room: an issue panel, a Rovo agent, bulk roll back, a dashboard gadget, and starting
// tasks from Jira issues, all through this track's routes. See README.md.
import { createHash, timingSafeEqual } from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import type { Approval, Box, LogEvent, Task, Track } from '../../core/contract.ts';
import { dailyPage, ensureSpace, incidentPage, type DayTask } from './confluence.ts';
import { decision, isRisky, openRequest, settle, type JsmConfig } from './jsm.ts';

const HOME = process.env.BOX_HOME ?? '/var/lib/box';
const DIR = path.join(HOME, 'jira');

/** BOX_HOME/jira/config.json turns syncing on for one box. No file, no sync, so test runs never touch Jira.
 *  skipSources leaves out tasks whose source starts with any of them, such as a watcher's periodic checks. */
type Config = {
  project: string;
  site?: string;
  skipSources?: string[];
  /** What a task started from a Jira issue gets. Untrusted issue text becomes its prompt, so keep it narrow. */
  start?: { workspace?: string; worker?: 'droid' | 'fake'; budgetCents?: number; hosts?: string[]; tools?: string[] };
  /** Risky approvals (over a limit, production, outside a task's folder) become JSM requests with approvers. */
  jsm?: JsmConfig;
  /** Confluence reports: a daily page and an incident page per blocked attempt, in `space` (by Jira project in `projects`). */
  confluence?: { space: string; name?: string; projects?: Record<string, string> };
};
const config = (): Config | undefined => {
  try {
    return JSON.parse(fs.readFileSync(path.join(DIR, 'config.json'), 'utf8'));
  } catch {
    return undefined;
  }
};

/** What this box already wrote to Jira for one task: its issue, and the last event it commented on. */
type Synced = { issue?: string; commented: number };
const syncedFile = (id: string) => path.join(DIR, `${id.replace(/[^\w-]/g, '')}.json`);
const loadSynced = (id: string): Synced => {
  try {
    return JSON.parse(fs.readFileSync(syncedFile(id), 'utf8'));
  } catch {
    return { commented: 0 };
  }
};
const saveSynced = (id: string, s: Synced) => {
  fs.mkdirSync(DIR, { recursive: true, mode: 0o700 });
  fs.writeFileSync(syncedFile(id), JSON.stringify(s));
};

// ---------- reading the box ----------

/** The box's own API, on its root-only socket. Tracks get no events or diffs in-process, so we ask it. Its errors
 *  keep their status, so a Business refusal (403, with the reason) reaches the person in Jira as it is. */
const boxCall = <T = any>(method: string, p: string, body?: unknown, headers: Record<string, string> = {}) =>
  new Promise<T>((resolve, reject) => {
    const req = http.request({ socketPath: path.join(HOME, 'api.sock'), method, path: p, headers: { 'content-type': 'application/json', ...headers } }, (res) => {
      let text = '';
      res.setEncoding('utf8');
      res.on('data', (c) => (text += c));
      res.on('end', () => {
        try {
          const data = text ? JSON.parse(text) : {};
          (res.statusCode ?? 500) < 400 ? resolve(data) : reject(Object.assign(new Error(data.error ?? `box API ${res.statusCode}`), { status: res.statusCode }));
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.end(body === undefined ? undefined : JSON.stringify(body));
  });
const boxApi = <T = any>(p: string) => boxCall<T>('GET', p);

type Diff = { changes: { path: string; change: string }[]; diff: string };
type View = { task: Task; approvals: Approval[]; events: LogEvent[] } & Diff;

async function view(id: string): Promise<View> {
  const { task, approvals, events } = await boxApi(`/tasks/${encodeURIComponent(id)}`);
  let d: Diff = await boxApi(`/tasks/${encodeURIComponent(id)}/diff`).catch(() => ({ changes: [], diff: '' }));
  // Undo deletes a task's files, so its diff goes empty. Keep the last one: the record of what was rolled back.
  const kept = syncedFile(id).replace(/\.json$/, '.diff.json');
  if (d.changes.length) {
    fs.mkdirSync(DIR, { recursive: true, mode: 0o700 });
    fs.writeFileSync(kept, JSON.stringify({ changes: d.changes.slice(0, 200), diff: clip(d.diff, 8000) }));
  } else if (task.state === 'undone' && fs.existsSync(kept)) {
    d = JSON.parse(fs.readFileSync(kept, 'utf8'));
  }
  return { task, approvals, events, ...d };
}

const clip = (s: string, max: number) => (s.length > max ? s.slice(0, max) + ` ... (${s.length - max} more characters)` : s);
const json = (v: unknown) => (v === undefined ? '' : typeof v === 'string' ? v : JSON.stringify(v));
const dollars = (cents: number) => `$${(cents / 100).toFixed(2)}`;
const time = (at: string) => at.slice(11, 19);
/** Approvals someone can still answer usefully: a finished task waits for nothing. */
const answerable = (v: View) => (['running', 'waiting'].includes(v.task.state) ? v.approvals.filter((a) => a.state === 'pending') : []);
const spent = (t: Task) => `Spent ${dollars(t.costCents)}${t.budgetCents ? ` of a ${dollars(t.budgetCents)} budget` : ', with no budget'}`;
const isSummary = (e: LogEvent) => e.type === 'task.step' && (e.data as { summary?: boolean } | undefined)?.summary === true;

/** One readable line per log event: the audit trail shown in the issue and in the panel. */
function lines(events: LogEvent[]): { at: string; kind: string; text: string }[] {
  const out: { at: string; kind: string; text: string }[] = [];
  const add = (e: LogEvent, kind: string, text: string) => out.push({ at: e.at, kind, text: clip(text, 300) });
  for (const e of events) {
    if (e.type === 'task.created') add(e, 'start', `Started by ${e.spec.source}, worker ${e.spec.worker}, workspace ${e.spec.workspace}`);
    else if (e.type === 'task.state') add(e, 'state', `Now ${e.state}${e.error ? `: ${e.error}` : ''}`);
    else if (e.type === 'task.step' && !isSummary(e)) add(e, 'step', e.text);
    else if (e.type === 'tool.call') add(e, 'tool', `Called ${e.tool} with ${json(e.input)}`);
    else if (e.type === 'tool.result') add(e, 'tool', e.ok ? `Got ${json(e.output)}${e.cents ? ` for ${dollars(e.cents)}` : ''}` : `Tool failed: ${e.error}`);
    else if (e.type === 'approval.asked') add(e, 'approval', `Asked for an OK: ${e.approval.question}`);
    else if (e.type === 'approval.answered') add(e, 'approval', `${e.approved ? 'Approved' : 'Denied'} by ${e.by}`);
    else if (e.type === 'cost') add(e, 'cost', `Spent ${dollars(e.cents)} on ${e.what}${e.model ? ` (${e.model})` : ''}`);
    else if (e.type === 'net.blocked') add(e, 'blocked', `Blocked: tried to reach ${e.host}`);
    else if (e.type === 'note') add(e, 'note', rollbackBy(e) ? `Roll back asked for by ${rollbackBy(e)}` : `Note from ${e.track}: ${json(e.data)}`);
  }
  return out;
}

/** Blocked attempts, one per host: when it first happened and how many times. */
function blockedHosts(events: LogEvent[]) {
  const by = new Map<string, { at: string; host: string; times: number }>();
  for (const e of events) if (e.type === 'net.blocked') by.set(e.host, { at: by.get(e.host)?.at ?? e.at, host: e.host, times: (by.get(e.host)?.times ?? 0) + 1 });
  return [...by.values()];
}

const rollbackBy = (e: LogEvent) =>
  e.type === 'note' && e.track === 'jira' && (e.data as { action?: string })?.action === 'rollback' ? String((e.data as { by?: string }).by) : undefined;

// ---------- Atlassian Document Format: Jira Cloud's rich text. Text nodes are plain text, never markup. ----------

const text = (s: string, marks?: { type: string }[]) => ({ type: 'text', text: s || ' ', ...(marks && { marks }) });
const para = (...content: object[]) => ({ type: 'paragraph', content });
const heading = (s: string) => ({ type: 'heading', attrs: { level: 3 }, content: [text(s)] });
const code = (s: string, language?: string) => ({ type: 'codeBlock', attrs: language ? { language } : {}, content: [text(s)] });
const bullets = (items: string[]) => ({ type: 'bulletList', content: items.map((s) => ({ type: 'listItem', content: [para(text(s))] })) });
const doc = (content: object[]) => ({ type: 'doc', version: 1, content });
const panel = (kind: 'info' | 'note' | 'success' | 'warning' | 'error', s: string) => ({ type: 'panel', attrs: { panelType: kind }, content: [para(text(s))] });
/** At most `max` items, each clipped, with a count of the rest, so no list can push the issue past Jira's limit. */
const capped = (items: string[], max: number) =>
  bullets([...items.slice(0, max).map((s) => clip(s, 300)), ...(items.length > max ? [`and ${items.length - max} more`] : [])]);

/** The issue's description: everything the action log knows about the task. Kept under Jira's 32,767 characters. */
function describe(v: View) {
  const { task, approvals, events, changes, diff } = v;
  const blocked = blockedHosts(events).map((b) => `${time(b.at)} UTC: tried to reach ${b.host}${b.times > 1 ? ` (${b.times} times)` : ''}. The box refused the connection.`);
  const said = events.filter(isSummary).map((e) => (e as { text: string }).text);
  const log = lines(events);
  const shown = log.slice(-40);
  const by = events.map(rollbackBy).filter(Boolean).at(-1);
  return doc([
    para(
      text('State: '), text(task.state, [{ type: 'strong' }]),
      text(`. ${spent(task)}. Worker ${task.worker}, workspace ${task.workspace}, started by ${task.source}. GurtOS task ${task.id}.`),
    ),
    ...(task.state === 'undone' ? [panel('warning', `Rolled back${by ? ` by ${by}` : ''}. The file changes below are no longer in the workspace. Other tasks kept theirs.`)] : []),
    ...(task.error ? [panel('error', `Failed: ${clip(task.error, 1000)}`)] : []),
    heading('What it was asked'),
    code(clip(task.prompt, 3000)),
    heading('What it was allowed to use'),
    bullets([`Tools: ${task.tools.join(', ') || 'none'}`, `Hosts: ${task.hosts.join(', ') || 'none'}`, task.budgetCents ? `Budget: ${dollars(task.budgetCents)}; spending above it waits for an OK` : 'Budget: none, so any spending waits for an OK']),
    heading("The agent's reasoning, in its own words"),
    para(text(said.length ? clip(said.join('\n\n'), 3000) : task.summary ? clip(task.summary, 3000) : 'Nothing reported yet.')),
    heading('Approvals'),
    approvals.length ? capped(approvals.map((a) => `${a.question} ${a.state === 'pending' ? 'Waiting for an answer.' : `${a.state === 'approved' ? 'Approved' : 'Denied'} by ${a.by}.`}`), 10) : para(text('None asked.')),
    heading('Blocked attempts'),
    blocked.length ? capped(blocked, 20) : para(text('None.')),
    heading('Files changed'),
    ...(changes.length
      ? [capped(changes.map((c) => `${c.path} (${c.change})`), 30), code(clip(diff, 8000), 'diff')]
      : [para(text('No file changes.'))]),
    heading('Action log (UTC)'),
    ...(log.length > shown.length ? [para(text(`The first ${log.length - shown.length} entries are in the box's log and the GurtOS agent task panel.`, [{ type: 'em' }]))] : []),
    bullets(shown.map((l) => `${time(l.at)} ${l.text}`)),
    para(text('Written by GurtOS from the box\'s append-only action log. Approve or roll back this task from the GurtOS agent task panel on this issue.', [{ type: 'em' }])),
  ]);
}

/** A comment for the events people should notice in the issue's activity. */
function comment(e: LogEvent, v: View) {
  if (e.type === 'approval.asked') return panel('warning', `The agent is waiting for an OK: ${e.approval.question} Approve or deny it in the GurtOS agent task panel.`);
  if (e.type === 'approval.answered') return panel(e.approved ? 'success' : 'note', `${e.approved ? 'Approved' : 'Denied'} by ${e.by}.`);
  if (e.type === 'net.blocked') {
    // One comment per host: a retry loop or repeated lookups must not bury the issue in identical comments.
    if (v.events.some((x) => x.type === 'net.blocked' && x.host === e.host && x.seq < e.seq)) return undefined;
    return panel('error', `Blocked: the task tried to reach ${e.host}, which is not one of its allowed hosts. The box refused the connection.`);
  }
  if (e.type === 'task.state' && e.state === 'failed') return panel('error', `Failed: ${clip(e.error ?? 'no reason given', 1000)}`);
  if (e.type === 'task.state' && e.state === 'undone') {
    const by = v.events.filter((x) => x.seq < e.seq).map(rollbackBy).filter(Boolean).at(-1);
    return panel('info', `Rolled back${by ? ` by ${by}` : ''}. The files this task changed are as they were before it; other tasks kept their changes.`);
  }
}

/** The issue a task was started from, when someone assigned it to the GurtOS agent or ran the Automation action. */
const startedFrom = (t: Task) => t.source.match(/^jira:([A-Z][A-Z0-9_]+-\d+)$/)?.[1];

/** On a teammate's issue, the comments are the whole record: when it starts, what it found, and the diff. */
function report(e: LogEvent, v: View): object[] | undefined {
  const { task } = v;
  if (e.type === 'task.created') {
    return [panel('info', `GurtOS started task ${task.id} from this issue: worker ${task.worker}, in its own copy of workspace ${task.workspace}, allowed hosts: ${task.hosts.join(', ') || 'none'}, budget ${dollars(task.budgetCents)}. Results, approvals and the diff come back here. The GurtOS agent task panel has Approve and Roll back.`)];
  }
  if (e.type === 'task.state' && e.state === 'done') {
    const said = v.events.filter(isSummary).map((x) => (x as { text: string }).text).at(-1) ?? task.summary ?? '';
    return [
      panel('success', `Done. ${spent(task)}.`),
      ...(said ? [heading("What the agent says it did"), para(text(clip(said, 3000)))] : []),
      heading('Files changed'),
      ...(v.changes.length ? [capped(v.changes.map((c) => `${c.path} (${c.change})`), 30), code(clip(v.diff, 8000), 'diff')] : [para(text('No file changes.'))]),
      para(text('Keep it, or roll it back from the GurtOS agent task panel. Roll back removes only this task\'s changes.', [{ type: 'em' }])),
    ];
  }
}

/** Where each box state sits on the project's board. The label keeps the exact state. */
const STATUS: Record<Task['state'], string> = { queued: 'To Do', running: 'In Progress', waiting: 'In Review', done: 'Done', failed: 'Done', undone: 'Done' };

// ---------- writing to Jira ----------

type Jira = (method: string, p: string, body?: unknown) => Promise<any>;

/** A vault key, or '' when the vault lacks it. */
const vaultKey = (box: Box, name: string) => {
  try {
    return box.secret(name).trim();
  } catch {
    return '';
  }
};

function jiraClient(box: Box, c: Config): Jira {
  // A missing key makes Jira answer 401, and the reader retries until the vault has it.
  const site = c.site ?? vaultKey(box, 'ATLASSIAN_SITE');
  const base = /^https?:\/\//.test(site) ? site : `https://${site}`;
  const auth = 'Basic ' + Buffer.from(`${vaultKey(box, 'ATLASSIAN_EMAIL')}:${vaultKey(box, 'ATLASSIAN_API_TOKEN')}`).toString('base64');
  return async (method, p, body) => {
    const r = await fetch(base + p, {
      method,
      headers: { authorization: auth, accept: 'application/json', 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(20_000),
    });
    const out = await r.text();
    if (!r.ok) throw Object.assign(new Error(`Jira ${method} ${p.split('?')[0]}: ${r.status} ${out.slice(0, 300)}`), { status: r.status });
    return out ? JSON.parse(out) : undefined;
  };
}

/** Make or update the task's issue, move it on the board, and comment on what happened. Safe to repeat. */
async function sync(id: string, e: LogEvent, box: Box) {
  const c = config();
  if (!c) return;
  const jira = jiraClient(box, c);
  const v = await view(id);
  const s = loadSynced(id);
  const fields = {
    summary: clip(v.task.title.replace(/\s+/g, ' '), 200),
    labels: ['box', `box-${v.task.id}`, `box-${v.task.state}`],
    description: describe(v),
  };
  const from = startedFrom(v.task);
  if (from) {
    // Started from a teammate's issue: report back on it in comments, and leave its summary, text and status alone.
    if (!s.issue) {
      s.issue = from;
      saveSynced(id, s);
      await jira('PUT', `/rest/api/3/issue/${from}`, { update: { labels: [{ add: 'gurtos' }] } });
    }
  } else if (!s.issue) {
    // A crash between creating the issue and saving its key must not make a second issue.
    const found = await jira('POST', '/rest/api/3/search/jql', { jql: `project = "${c.project}" AND labels = "box-${v.task.id}"`, fields: ['key'], maxResults: 1 });
    s.issue = found?.issues?.[0]?.key ?? (await jira('POST', '/rest/api/3/issue', { fields: { project: { key: c.project }, issuetype: { name: 'Task' }, ...fields } })).key;
    saveSynced(id, s);
  } else {
    await jira('PUT', `/rest/api/3/issue/${s.issue}`, { fields });
  }
  // The Forge panel finds the task through this property, and JQL searches it (boxState = undone, boxBlocked > 0).
  const blocked = v.events.filter((x) => x.type === 'net.blocked').length;
  const pending = answerable(v).length;
  await jira('PUT', `/rest/api/3/issue/${s.issue}/properties/box.task`, {
    id: v.task.id, state: v.task.state, costCents: v.task.costCents, budgetCents: v.task.budgetCents, blocked, pending, source: v.task.source, workspace: v.task.workspace,
  });
  const issue = from ? undefined : await jira('GET', `/rest/api/3/issue/${s.issue}?fields=status`);
  if (issue && issue.fields.status.name !== STATUS[v.task.state]) {
    const { transitions } = await jira('GET', `/rest/api/3/issue/${s.issue}/transitions`);
    const t = transitions.find((x: { to: { name: string } }) => x.to.name === STATUS[v.task.state]);
    if (t) await jira('POST', `/rest/api/3/issue/${s.issue}/transitions`, { transition: { id: t.id } });
  }
  const note = e.seq > s.commented ? ((from && report(e, v)) || [comment(e, v)].filter((n) => n !== undefined)) : [];
  if (note.length) {
    await jira('POST', `/rest/api/3/issue/${s.issue}/comment`, { body: doc(note) });
    s.commented = e.seq;
    saveSynced(id, s);
  }
  return { issue: s.issue };
}

// Events that change what someone in Jira should see now. Steps and costs in between are batched.
const MILESTONES = new Set(['task.created', 'task.state', 'approval.asked', 'approval.answered', 'net.blocked']);
const lastSync = new Map<string, number>();

/** Forge calls carry the shared secret as a bearer token. No secret in the vault means every call is refused. */
function allowed(req: Request, box: Box) {
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  const secret = vaultKey(box, 'JIRA_BOX_SECRET');
  const h = (s: string) => createHash('sha256').update(s).digest();
  return token.length > 0 && secret.length >= 32 && timingSafeEqual(h(token), h(secret));
}
const who = (by: unknown) => `jira:${String(by ?? 'someone').replace(/[^\w .@'-]/g, '').slice(0, 80) || 'someone'}`;
const refuse = (status: number, error: string) => Object.assign(new Error(error), { status });

/** A route that checks the shared secret, and turns a thrown error into {error} with its status. */
const guarded = (fn: (req: Request, box: Box) => Promise<unknown>) => async (req: Request, box: Box) => {
  if (!allowed(req, box)) return Response.json({ error: 'unauthorized' }, { status: 401 });
  try {
    return Response.json(await fn(req, box));
  } catch (e) {
    const status = (e as { status?: number }).status;
    return Response.json({ error: (e as Error).message }, { status: status && status >= 400 && status < 500 ? status : 500 });
  }
};

// ---------- who is acting: on GurtOS Business, a Jira user acts as the GurtOS person they are linked to ----------

const readJson = <T>(file: string, fallback: T): T => {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
};
/** BOX_HOME/jira/people.json links a Jira accountId to a GurtOS Business person id. Roles and limits stay in Business. */
const linkedPerson = (account: unknown) => (typeof account === 'string' ? readJson<Record<string, string>>(path.join(DIR, 'people.json'), {})[account] : undefined);
const isBusiness = async () => ((await boxCall<{ on?: boolean }>('GET', '/api/business').catch(() => ({}))) as { on?: boolean }).on === true;

type Actor = { by: string; person?: string };
/**
 * Who is acting. The Forge app sends the Jira accountId from Atlassian's own context, after Jira's permission check.
 * On a Business box that account must be linked to a person, and Business then decides by role, limit and who
 * asked. On a Server box, the Jira permission is the whole check.
 */
async function actor(box: Box, account: unknown, via?: string): Promise<Actor> {
  const by = who(`${await nameOf(box, account)}${via ? ` via ${via}` : ''}`);
  if (!(await isBusiness())) return { by };
  const person = linkedPerson(account);
  if (!person) throw refuse(403, 'Your Jira account is not linked to a GurtOS person, so GurtOS Business cannot let you act. Ask an admin to link it.');
  return { by, person };
}

/** Who the log names, from Atlassian itself: the account's display name, never a name a caller sends. */
const names = new Map<string, string>();
async function nameOf(box: Box, account: unknown): Promise<string> {
  const c = config();
  if (typeof account !== 'string' || !/^[\w:-]{1,128}$/.test(account)) throw refuse(400, 'account: the Atlassian account id of the person acting');
  if (!c) throw refuse(409, 'Jira is not connected on this box (no jira/config.json).');
  if (!names.has(account)) {
    const u = await jiraClient(box, c)('GET', `/rest/api/3/user?accountId=${encodeURIComponent(account)}`).catch(() => undefined);
    if (!u?.displayName) throw refuse(403, 'Atlassian does not know that account.');
    names.set(account, u.displayName);
  }
  return names.get(account)!;
}
const asPerson = (a: Actor) => ({ 'x-box-person': a.person! });

async function answerAs(box: Box, a: Actor, id: string, approved: boolean) {
  if (!a.person) return box.answer(id, approved, a.by);
  return boxCall('POST', `/api/approvals/${encodeURIComponent(id)}`, { approved, by: 'Jira' }, asPerson(a));
}

/** Roll back one task and say what came back: the files it had changed are as they were before it. */
async function undoAs(box: Box, a: Actor, id: string) {
  const t = box.task(id);
  if (!t) throw refuse(404, `no task ${id}`);
  const issue = loadSynced(id).issue;
  if (t.state === 'undone') return { task: id, issue, title: t.title, ok: true, alreadyUndone: true, changes: [] };
  const { changes } = await view(id); // read before the undo deletes them; view() keeps a copy for the issue too
  box.note({ action: 'rollback', by: a.by }, id); // who asked goes into the log before the undo
  if (a.person) await boxCall('POST', `/api/tasks/${encodeURIComponent(id)}/undo`, {}, asPerson(a));
  else await box.undo(id);
  return { task: id, issue, title: t.title, ok: true, changes };
}

/** Which task wrote each issue, from what this box synced. */
function taskOfIssue(): Map<string, string> {
  const out = new Map<string, string>();
  for (const f of fs.existsSync(DIR) ? fs.readdirSync(DIR) : []) {
    if (!/^t[\w-]+\.json$/.test(f) || f.endsWith('.diff.json')) continue;
    const issue = readJson<Synced>(path.join(DIR, f), { commented: 0 }).issue;
    if (issue) out.set(issue, f.slice(0, -5));
  }
  return out;
}

/** Tasks and what they did in a period, from the box's log: for the Rovo agent, the gadget and the reports. */
async function activity(box: Box, q: URLSearchParams) {
  const since = q.get('since') ?? new Date(Date.now() - 7 * 86400_000).toISOString();
  const until = q.get('until') ?? new Date(Date.now() + 60_000).toISOString();
  const [project, source, text, state] = ['project', 'source', 'q', 'state'].map((k) => q.get(k)?.toLowerCase());
  const events = await boxApi<LogEvent[]>(`/api/log`);
  // Each host once per task. Name lookups to an outside resolver (port 53) are refused by design and counted apart,
  // so a chatty resolver does not hide the attempts that matter.
  const blocked = new Map<string, Set<string>>();
  const lookups = new Map<string, number>();
  for (const e of events) {
    if (e.type !== 'net.blocked' || e.at < since || e.at > until) continue;
    if (/:53$/.test(e.host)) lookups.set(e.task, (lookups.get(e.task) ?? 0) + 1);
    else blocked.set(e.task, (blocked.get(e.task) ?? new Set()).add(e.host));
  }
  const rows: { id: string; title: string; state: string; source: string; issue?: string; project?: string; costCents: number; blocked: string[]; lookups: number; changes: number; createdAt: string; updatedAt: string }[] = [];
  for (const t of box.tasks()) {
    if (t.updatedAt < since || t.createdAt > until) continue;
    const issue = loadSynced(t.id).issue;
    const proj = issue?.split('-')[0];
    if (project && proj?.toLowerCase() !== project) continue;
    if (source && !t.source.toLowerCase().includes(source)) continue;
    if (text && !`${t.title} ${t.source} ${issue ?? ''}`.toLowerCase().includes(text)) continue;
    if (state && t.state !== state) continue;
    const kept = readJson<Diff | undefined>(syncedFile(t.id).replace(/\.json$/, '.diff.json'), undefined);
    rows.push({
      id: t.id, title: t.title, state: t.state, source: t.source, issue, project: proj, costCents: t.costCents,
      blocked: [...(blocked.get(t.id) ?? [])], lookups: lookups.get(t.id) ?? 0, changes: kept?.changes.length ?? 0, createdAt: t.createdAt, updatedAt: t.updatedAt,
    });
  }
  rows.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const count = (s: string) => rows.filter((r) => r.state === s).length;
  const byProject = new Map<string, { project: string; tasks: number; blocked: number; costCents: number }>();
  for (const r of rows) {
    const p = byProject.get(r.project ?? '') ?? { project: r.project ?? 'Not in Jira', tasks: 0, blocked: 0, costCents: 0 };
    p.tasks++;
    p.blocked += r.blocked.length;
    p.costCents += r.costCents;
    byProject.set(r.project ?? '', p);
  }
  const settings = await boxApi<{ paused?: boolean }>('/api/settings').catch(() => ({ paused: false }));
  return {
    since, until,
    tasks: rows.slice(0, 200),
    totals: { tasks: rows.length, done: count('done'), undone: count('undone'), failed: count('failed'), waiting: count('waiting'), blocked: rows.reduce((n, r) => n + r.blocked.length, 0), costCents: rows.reduce((n, r) => n + r.costCents, 0) },
    byProject: [...byProject.values()],
    paused: settings.paused === true,
  };
}

/** A box task from a teammate's Jira issue. Its text is untrusted, so the task gets the narrow spec in config.start. */
async function start(box: Box, a: Actor, issue: { key?: unknown; summary?: unknown; description?: unknown }) {
  const c = config();
  if (!c) throw refuse(409, 'Jira is not connected on this box (no jira/config.json).');
  const key = String(issue.key ?? '');
  if (!/^[A-Z][A-Z0-9_]+-\d+$/.test(key)) throw refuse(400, 'issue.key: a Jira issue key like OPS-12');
  const source = `jira:${key}`;
  const going = box.tasks().find((t) => t.source === source && ['queued', 'running', 'waiting'].includes(t.state));
  if (going) return { task: { id: going.id, title: going.title, state: going.state }, already: true };
  const summary = clip(String(issue.summary ?? '').replace(/\s+/g, ' ').trim(), 150) || key;
  const st = c.start ?? {};
  // The scripted test worker runs its prompt line by line, so it gets the issue's text as it is.
  const prompt = st.worker === 'fake' ? String(issue.description ?? '') : `A teammate asked for this in Jira issue ${key}. Do what it asks in this workspace, then say in a few sentences what you did.\n\n${summary}\n\n${clip(String(issue.description ?? ''), 6000)}`;
  const spec = { title: `${key}: ${summary}`, prompt, source, workspace: st.workspace ?? 'home', worker: st.worker ?? 'droid', budgetCents: st.budgetCents ?? 25, hosts: st.hosts ?? [], tools: st.tools ?? [] };
  // On Business the linked person is who asked, so they cannot approve their own task's requests.
  const t: Task = a.person ? await boxCall('POST', '/api/tasks', spec, asPerson(a)) : await box.createTask(spec);
  box.note({ action: 'start', issue: key, by: a.by }, t.id);
  return { task: { id: t.id, title: t.title, state: t.state } };
}


// ---------- Jira Service Management: a risky approval waits for its JSM approvers ----------

type Opened = Record<string, { key: string; done?: boolean }>;
const jsmFile = () => path.join(DIR, 'jsm.json');

/** Ask the JSM approvers for each risky approval still waiting, and answer the box from their decision. */
async function jsmTick(box: Box) {
  const c = config();
  if (!c?.jsm) return;
  const jira = jiraClient(box, c);
  const opened = readJson<Opened>(jsmFile(), {});
  const save = () => (fs.mkdirSync(DIR, { recursive: true, mode: 0o700 }), fs.writeFileSync(jsmFile(), JSON.stringify(opened)));
  for (const a of box.approvals()) {
    const t = box.task(a.task);
    if (opened[a.id] || a.state !== 'pending' || !t || !['running', 'waiting'].includes(t.state) || !isRisky(c.jsm, a)) continue;
    opened[a.id] = await openRequest(jira, c.jsm, { approvalId: a.id, task: t.id, title: t.title, question: a.question, costCents: a.costCents, issue: loadSynced(t.id).issue });
    save();
    box.note({ action: 'jsm.opened', approval: a.id, request: opened[a.id].key }, t.id);
  }
  for (const [id, o] of Object.entries(opened)) {
    if (o.done) continue;
    const a = box.approvals().find((x) => x.id === id);
    if (!a || a.state !== 'pending') {
      // Answered somewhere else first (portal, phone, the Jira panel): close the request so nobody decides it twice.
      await settle(jira, o.key, `Answered in GurtOS (${a?.state ?? 'gone'}${a?.by ? ` by ${a.by}` : ''}). Nothing to decide here.`).catch(() => {});
      o.done = true;
      save();
      continue;
    }
    const d = await decision(jira, o.key);
    if (d.state === 'pending') continue;
    try {
      // The JSM approver acts as themselves: on Business, the GurtOS person their Jira account is linked to.
      if (!d.by) throw refuse(409, `JSM ${o.key} was decided, but it does not say by whom`);
      const a = await actor(box, d.by.accountId, `JSM ${o.key}`);
      await answerAs(box, a, id, d.state === 'approved');
      o.done = true;
    } catch (e) {
      // Business refused this approver (not linked, wrong role, over their limit): it stays waiting, and the log says why.
      box.note({ action: 'jsm.refused', approval: id, request: o.key, why: (e as Error).message }, a.task);
      o.done = true;
    }
    save();
  }
}

// ---------- Confluence: a daily "What our agents did" page per space, and an incident page per blocked attempt ----------

const spaceFor = (c: Config, project?: string) => c.confluence!.projects?.[project ?? ''] ?? c.confluence!.space;
const spaces = new Map<string, { id: string; key: string }>();
async function space(api: Jira, key: string) {
  if (!spaces.has(key)) spaces.set(key, await ensureSpace(api, key, key === 'AGENTS' ? 'Agent reports' : key));
  return spaces.get(key)!;
}
const siteOf = (box: Box, c: Config) => c.site ?? vaultKey(box, 'ATLASSIAN_SITE');

async function incident(box: Box, c: Config, e: Extract<LogEvent, { type: 'net.blocked' }>) {
  const jira = jiraClient(box, c);
  const v = await view(e.task);
  const issue = loadSynced(e.task).issue;
  const before = lines(v.events.filter((x) => x.seq < e.seq)).slice(-8).map((l) => `${time(l.at)} ${l.text}`);
  const by = v.events.map(rollbackBy).filter(Boolean).at(-1);
  const outcome = v.task.state === 'undone' ? `The task was rolled back${by ? ` by ${by}` : ''}. Its file changes are gone; other tasks kept theirs.`
    : v.task.state === 'failed' ? `The task stopped: ${clip(v.task.error ?? '', 300)}`
    : `The box refused the connection at its proxy and the task carried on without it (now ${v.task.state}). Review it and roll it back from Jira if it was wrong.`;
  return incidentPage(jira, await space(jira, spaceFor(c, issue?.split('-')[0])), {
    task: v.task.id, title: v.task.title, issue, source: v.task.source, at: e.at, host: e.host, worker: v.task.worker,
    workspace: v.task.workspace, allowedHosts: v.task.hosts, prompt: clip(v.task.prompt, 3000), steps: before, outcome,
  }, siteOf(box, c));
}

/** Rewrite today's page, and yesterday's until it has been written after the day ended. */
async function dailyTick(box: Box) {
  const c = config();
  if (!c?.confluence) return;
  const jira = jiraClient(box, c);
  const doneFile = path.join(DIR, 'daily.json');
  const final = readJson<Record<string, boolean>>(doneFile, {});
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400_000).toISOString().slice(0, 10);
  for (const day of [yesterday, today]) {
    if (final[day]) continue;
    const q = new URLSearchParams({ since: `${day}T00:00:00.000Z`, until: `${day}T23:59:59.999Z` });
    const rows = (await activity(box, q)).tasks.slice(0, 60);
    const bySpace = new Map<string, DayTask[]>();
    for (const r of rows) {
      const v = await view(r.id);
      const list = bySpace.get(spaceFor(c, r.project)) ?? [];
      list.push({ id: r.id, title: r.title, state: r.state, source: r.source, issue: r.issue, costCents: r.costCents, blocked: r.blocked, changes: v.changes, approvals: v.approvals.map((a) => ({ question: a.question, state: a.state, by: a.by })) });
      bySpace.set(spaceFor(c, r.project), list);
    }
    for (const [key, tasks] of bySpace) await dailyPage(jira, await space(jira, key), day, tasks, siteOf(box, c));
    if (day === yesterday) {
      final[day] = true;
      fs.mkdirSync(DIR, { recursive: true, mode: 0o700 });
      fs.writeFileSync(doneFile, JSON.stringify(final));
    }
  }
}

/** Run a tick now and every `ms`, one at a time; a failure is logged and the next tick tries again. Returns a
 *  function that runs it now (or right after the one in progress), for events that should not wait for the timer. */
function every(name: string, ms: number, tick: () => Promise<void>) {
  let busy = false;
  let again = false;
  const run = (): void => {
    if (busy) return void (again = true);
    busy = true;
    tick()
      .catch((e) => console.error(`jira: ${name} failed:`, (e as Error).message))
      .finally(() => {
        busy = false;
        if (again) (again = false), run();
      });
  };
  setInterval(run, ms).unref();
  run();
  return run;
}
let jsmNow = () => {};

export default {
  name: 'jira',
  title: 'Jira',
  description: 'Send Jira issues to agents, see every agent action in Jira, and roll back the ones that were wrong.',

  triggers: [
    { name: 'jsm', start: (box) => void (jsmNow = every('JSM approvals', 10_000, () => jsmTick(box))) },
    { name: 'confluence', start: (box) => every('daily Confluence page', 15 * 60_000, () => dailyTick(box)) },
  ],

  logReaders: [
    {
      name: 'issues',
      async read(e, box) {
        const c = config();
        const t = e.task && box.task(e.task);
        if (!c || !t || c.skipSources?.some((p) => t.source.startsWith(p))) return;
        if (!MILESTONES.has(e.type) && Date.now() - (lastSync.get(t.id) ?? 0) < 3000) return;
        lastSync.set(t.id, Date.now());
        try {
          await sync(t.id, e, box);
        } catch (err) {
          // Jira refusing this one issue's content must not stop every later issue. Anything else retries.
          const status = (err as { status?: number }).status ?? 0;
          if (status >= 400 && status < 500 && ![401, 403, 409, 429].includes(status)) console.error(`jira: skipped event ${e.seq}:`, (err as Error).message);
          else throw err;
        }
      },
    },
    {
      // A new approval opens its JSM request now, and an answer closes it, instead of waiting for the next tick.
      name: 'jsm',
      read(e) {
        if (e.type === 'approval.asked' || e.type === 'approval.answered') jsmNow();
      },
    },
    {
      // A blocked attempt gets an incident page while it is news: replaying an old log does not page anyone.
      name: 'incidents',
      async read(e, box) {
        const c = config();
        if (e.type !== 'net.blocked' || !c?.confluence || Date.now() - Date.parse(e.at) > 86400_000) return;
        // A name lookup to an outside resolver is refused by design (tasks resolve through the box's proxy). It
        // shows in the issue and the daily page; it is not an incident worth a page.
        if (/:53$/.test(e.host)) return;
        const t = box.task(e.task);
        if (!t || c.skipSources?.some((p) => t.source.startsWith(p))) return;
        await incident(box, c, e);
      },
    },
  ],

  // Jira's address and API token for the reader; the shared secret the Forge app sends to the routes.
  secrets: ['ATLASSIAN_SITE', 'ATLASSIAN_EMAIL', 'ATLASSIAN_API_TOKEN', 'JIRA_BOX_SECRET'],

  // Served at /t/jira/... The box's public HTTPS address (Caddy in front of the box) forwards only these. Each one
  // checks the shared secret itself (allowed()), so they are open to the paired-phone rule.
  openRoutes: ['GET /task', 'POST /answer', 'POST /undo', 'POST /undo-many', 'GET /activity', 'POST /pause', 'POST /start', 'POST /report'],
  routes: {
    'GET /task': guarded(async (req, box) => {
      const id = new URL(req.url).searchParams.get('id') ?? '';
      if (!box.task(id)) throw refuse(404, `no task ${id}`);
      const v = await view(id);
      return {
        task: v.task,
        pending: answerable(v),
        audit: lines(v.events).slice(-30),
        blocked: blockedHosts(v.events),
        reasoning: v.events.filter(isSummary).map((e) => clip((e as { text: string }).text, 1500)).at(-1) ?? v.task.summary ?? '',
        changes: v.changes,
        diff: clip(v.diff, 6000),
      };
    }),
    'POST /answer': guarded(async (req, box) => {
      const body = await req.json();
      const a = box.approvals().find((x) => x.id === body.approval);
      if (!a || a.task !== body.task) throw refuse(404, `no approval ${body.approval} on task ${body.task}`);
      return answerAs(box, await actor(box, body.account), a.id, body.approved === true);
    }),
    'POST /undo': guarded(async (req, box) => {
      const body = await req.json();
      if (!box.task(body.task)) throw refuse(404, `no task ${body.task}`);
      await undoAs(box, await actor(box, body.account), body.task);
      return box.task(body.task);
    }),
    // Several at once: picked in a JQL list or by the Rovo agent. Each is reported on its own; one failure stops none.
    'POST /undo-many': guarded(async (req, box) => {
      const body = await req.json();
      const a = await actor(box, body.account);
      const byIssue = taskOfIssue();
      const ids: { task?: string; issue?: string }[] = [
        ...(Array.isArray(body.tasks) ? body.tasks : []).map((t: unknown) => ({ task: String(t) })),
        ...(Array.isArray(body.issues) ? body.issues : []).map((k: unknown) => ({ task: byIssue.get(String(k)), issue: String(k) })),
      ];
      if (!ids.length || ids.length > 100) throw refuse(400, 'send tasks or issues: 1 to 100 of them');
      const results = [];
      for (const x of ids) {
        if (!x.task) {
          results.push({ issue: x.issue, ok: false, error: 'not a GurtOS task on this box', changes: [] });
          continue;
        }
        results.push(await undoAs(box, a, x.task).catch((e) => ({ task: x.task, issue: x.issue, ok: false, error: (e as Error).message, changes: [] })));
      }
      return { results };
    }),
    'GET /activity': guarded(async (req, box) => activity(box, new URL(req.url).searchParams)),
    // Every agent on the box stops starting new work; running tasks hold where they are. Logged with who did it.
    // Pausing only stops agents, so anyone the Forge app vouches for may do it. Resuming lets held work carry on, so
    // from Jira only a linked Business admin or owner may; otherwise it stays with the box's screen and the owner's phone.
    'POST /pause': guarded(async (req, box) => {
      const body = await req.json();
      const a = await actor(box, body.account);
      const paused = body.paused === true;
      if (!paused && !a.person) throw refuse(403, 'Resuming agents is for the box\'s own screen, the owner\'s phone, or a GurtOS Business admin. Pausing works from Jira.');
      // Core's kill switch. A pause goes as the box's screen (allowed to anyone the Forge app vouches for); a resume
      // goes as the linked person, and core lets only an admin or the owner do it.
      await boxCall('POST', paused ? '/api/pause' : '/api/resume', {}, paused ? {} : asPerson(a));
      box.note({ action: paused ? 'pause' : 'resume', by: a.by }); // who, from Jira, once the box has done it
      return { paused: (await boxApi<{ paused?: boolean }>('/api/settings')).paused === true };
    }),
    // Write today's "What our agents did" page now, instead of at the next quarter hour.
    'POST /report': guarded(async (_req, box) => {
      if (!config()?.confluence) throw refuse(409, 'Confluence reports are off on this box (no confluence in jira/config.json).');
      await dailyTick(box);
      return { ok: true };
    }),
    'POST /start': guarded(async (req, box) => {
      const body = await req.json();
      return start(box, await actor(box, body.account), body.issue ?? {});
    }),
  },
} satisfies Track;
