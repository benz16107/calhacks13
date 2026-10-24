// The Jira track. Every box task becomes a Jira issue holding its prompt, steps, tool calls, the agent's own
// account of its reasoning, cost, approvals, blocked attempts and the diff of the files it changed. A Forge app
// on the issue (forge/) answers the task's approvals and rolls back just that task, through this track's
// routes. See README.md.
import { createHash, timingSafeEqual } from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import type { Approval, Box, LogEvent, Task, Track } from '../../core/contract.ts';

const HOME = process.env.BOX_HOME ?? '/var/lib/box';
const DIR = path.join(HOME, 'jira');

/** BOX_HOME/jira/config.json turns syncing on for one box. No file, no sync, so test runs never touch Jira.
 *  skipSources leaves out tasks whose source starts with any of them, such as a watcher's periodic checks. */
type Config = { project: string; site?: string; skipSources?: string[] };
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

/** The box's own API, on its root-only socket. Tracks get no events or diffs in-process, so we ask it. */
const boxApi = <T = any>(p: string) =>
  new Promise<T>((resolve, reject) => {
    http
      .get({ socketPath: path.join(HOME, 'api.sock'), path: p }, (res) => {
        let text = '';
        res.setEncoding('utf8');
        res.on('data', (c) => (text += c));
        res.on('end', () => {
          try {
            const data = JSON.parse(text);
            (res.statusCode ?? 500) < 400 ? resolve(data) : reject(new Error(data.error ?? `box API ${res.statusCode}`));
          } catch (e) {
            reject(e);
          }
        });
      })
      .on('error', reject);
  });

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
  const blocked = events.flatMap((e) => (e.type === 'net.blocked' ? [`${time(e.at)} UTC: tried to reach ${e.host}. The box refused the connection.`] : []));
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
  if (e.type === 'net.blocked') return panel('error', `Blocked: the task tried to reach ${e.host}, which is not one of its allowed hosts. The box refused the connection.`);
  if (e.type === 'task.state' && e.state === 'failed') return panel('error', `Failed: ${clip(e.error ?? 'no reason given', 1000)}`);
  if (e.type === 'task.state' && e.state === 'undone') {
    const by = v.events.filter((x) => x.seq < e.seq).map(rollbackBy).filter(Boolean).at(-1);
    return panel('info', `Rolled back${by ? ` by ${by}` : ''}. The files this task changed are as they were before it; other tasks kept their changes.`);
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
  if (!s.issue) {
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
  const issue = await jira('GET', `/rest/api/3/issue/${s.issue}?fields=status`);
  if (issue.fields.status.name !== STATUS[v.task.state]) {
    const { transitions } = await jira('GET', `/rest/api/3/issue/${s.issue}/transitions`);
    const t = transitions.find((x: { to: { name: string } }) => x.to.name === STATUS[v.task.state]);
    if (t) await jira('POST', `/rest/api/3/issue/${s.issue}/transitions`, { transition: { id: t.id } });
  }
  const note = e.seq > s.commented ? comment(e, v) : undefined;
  if (note) {
    await jira('POST', `/rest/api/3/issue/${s.issue}/comment`, { body: doc([note]) });
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
const deny = () => Response.json({ error: 'unauthorized' }, { status: 401 });
const who = (by: unknown) => `jira:${String(by ?? 'someone').replace(/[^\w .@'-]/g, '').slice(0, 80) || 'someone'}`;

export default {
  name: 'jira',

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
  ],

  // Jira's address and API token for the reader; the shared secret the Forge app sends to the routes.
  secrets: ['ATLASSIAN_SITE', 'ATLASSIAN_EMAIL', 'ATLASSIAN_API_TOKEN', 'JIRA_BOX_SECRET'],

  // Served at /t/jira/... The box's public HTTPS address (Caddy in front of the box) forwards only these. Each one
  // checks the shared secret itself (allowed()), so they are open to the paired-phone rule.
  openRoutes: ['GET /task', 'POST /answer', 'POST /undo'],
  routes: {
    'GET /task': async (req, box) => {
      if (!allowed(req, box)) return deny();
      const id = new URL(req.url).searchParams.get('id') ?? '';
      if (!box.task(id)) return Response.json({ error: `no task ${id}` }, { status: 404 });
      const v = await view(id);
      return Response.json({
        task: v.task,
        pending: answerable(v),
        audit: lines(v.events).slice(-30),
        blocked: v.events.flatMap((e) => (e.type === 'net.blocked' ? [{ at: e.at, host: e.host }] : [])),
        reasoning: v.events.filter(isSummary).map((e) => clip((e as { text: string }).text, 1500)).at(-1) ?? v.task.summary ?? '',
        changes: v.changes,
        diff: clip(v.diff, 6000),
      });
    },
    'POST /answer': async (req, box) => {
      if (!allowed(req, box)) return deny();
      const { task, approval, approved, by } = await req.json();
      const a = box.approvals().find((x) => x.id === approval);
      if (!a || a.task !== task) return Response.json({ error: `no approval ${approval} on task ${task}` }, { status: 404 });
      return Response.json(box.answer(a.id, approved === true, who(by)));
    },
    'POST /undo': async (req, box) => {
      if (!allowed(req, box)) return deny();
      const { task, by } = await req.json();
      const t = box.task(task);
      if (!t) return Response.json({ error: `no task ${task}` }, { status: 404 });
      if (t.state === 'undone') return Response.json(t);
      box.note({ action: 'rollback', by: who(by) }, task); // who asked goes into the log before the undo
      return Response.json(await box.undo(task));
    },
  },
} satisfies Track;
