// Live state from the box. The HTTP API once, then SpacetimeDB for tasks and approvals, and the action log over
// Server-Sent Events. When SpacetimeDB's port is out of reach (a phone through a tunnel), the log stream alone keeps
// tasks and approvals live: every change is a log event, so each one triggers a refetch.
import { useEffect, useReducer } from 'preact/hooks';
import type { Approval, LogEvent, Task } from '../../core/contract.ts';
import { DbConnection } from '../../core/spacetime/bindings/index.ts';

export type { Approval, LogEvent, Task };
export interface AppEntry { name: string; title: string; href: string; track: string }
export interface Health {
  ok: boolean;
  tasks: number;
  tools: string[];
  spacetime: { port: number; database: string };
  /** Asked of the core: when the box last started, and the tasks it resumed then. */
  startedAt?: string;
  resumed?: string[];
}
export interface Restored { at: number; tasks: string[]; restarted: boolean }

/** Who answers from this screen. It goes into the log as `by`. */
export const surface: 'box screen' | 'phone' | 'portal' =
  location.pathname === '/screen' ? 'box screen' : matchMedia('(max-width: 699px), (pointer: coarse)').matches ? 'phone' : 'portal';

export const box = {
  tasks: new Map<string, Task>(),
  approvals: new Map<string, Approval>(),
  /** The newest events of the log, oldest first. */
  events: [] as LogEvent[],
  apps: [] as AppEntry[],
  health: undefined as Health | undefined,
  /** How tasks and approvals stay live. 'offline' means the box is out of reach. */
  live: 'connecting' as 'connecting' | 'spacetimedb' | 'log stream' | 'offline',
  today: { day: '', cents: 0, blocked: 0 },
  restored: undefined as Restored | undefined,
  /** net.blocked events seen live, newest last. */
  blockedLive: [] as LogEvent[],
};

// shortcut: keeps the last 5000 events in memory and replays the whole log on load; page through /api/log when logs get big.
const KEEP = 5000;
const subs = new Set<() => void>();
let frame = 0;
export function changed() {
  frame ||= requestAnimationFrame(() => {
    frame = 0;
    for (const s of subs) s();
  });
}
/** Re-render on any change to the box. */
export function useBox() {
  const [, force] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    subs.add(force);
    return () => void subs.delete(force);
  }, []);
  return box;
}

export async function api<T = any>(method: string, path: string, body?: unknown): Promise<T> {
  const r = await fetch(`/api${path}`, {
    method,
    headers: body === undefined ? {} : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const out = await r.json().catch(() => ({ error: `${r.status} ${r.statusText}` }));
  if (!r.ok) throw new Error(out.error ?? `${r.status} ${r.statusText}`);
  return out as T;
}

async function refresh() {
  const [tasks, approvals] = await Promise.all([api<Task[]>('GET', '/tasks'), api<Approval[]>('GET', '/approvals')]);
  box.tasks = new Map(tasks.map((t) => [t.id, t]));
  box.approvals = new Map(approvals.map((a) => [a.id, a]));
  changed();
}
let refreshTimer = 0;
function refreshSoon() {
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => refresh().catch(() => {}), 250);
}

// ---------- the log over SSE ----------

const dayOf = (iso: string) => new Date(iso).toLocaleDateString('en-CA');
function take(e: LogEvent) {
  box.events.push(e);
  if (box.events.length > KEEP) box.events.splice(0, box.events.length - KEEP);
  const day = dayOf(e.at);
  if (day === dayOf(new Date().toISOString())) {
    if (box.today.day !== day) box.today = { day, cents: 0, blocked: 0 };
    if (e.type === 'cost') box.today.cents += e.cents;
    if (e.type === 'tool.result') box.today.cents += e.cents ?? 0;
    if (e.type === 'net.blocked') box.today.blocked++;
  }
  // A block from the last minute is news; older ones are history the log replays on load.
  if (e.type === 'net.blocked' && Date.now() - Date.parse(e.at) < 60_000) box.blockedLive.push(e);
  if (box.live !== 'spacetimedb' && e.type !== 'note') refreshSoon();
  for (const l of eventListeners) l(e);
  changed();
}
const eventListeners = new Set<(e: LogEvent) => void>();
/** Follow log events as they arrive (a task window refetches its own task). */
export function onEvent(l: (e: LogEvent) => void) {
  eventListeners.add(l);
  return () => void eventListeners.delete(l);
}

let activeBeforeDrop: string[] | undefined;
let dropAt = 0;
function follow() {
  const es = new EventSource(`/api/log/stream?after=${box.events.at(-1)?.seq ?? 0}`);
  es.onmessage = (m) => take(JSON.parse(m.data));
  es.onopen = () => {
    if (activeBeforeDrop) void cameBack(activeBeforeDrop);
    activeBeforeDrop = undefined;
    if (box.live === 'offline') box.live = 'log stream';
    changed();
  };
  es.onerror = () => {
    if (!activeBeforeDrop) {
      activeBeforeDrop = [...box.tasks.values()].filter((t) => ['queued', 'running', 'waiting'].includes(t.state)).map((t) => t.id);
      dropAt = Date.now();
    }
    if (box.live !== 'spacetimedb') box.live = 'offline';
    changed();
    if (es.readyState === EventSource.CLOSED) setTimeout(follow, 2000); // the browser gave up; start again
  };
}

/** The box was out of reach (a power cut, or the phone's network). Say which tasks carried on. */
async function cameBack(before: string[]) {
  const started = box.health?.startedAt;
  await Promise.all([refresh(), loadHealth()]).catch(() => {});
  const restarted = !!box.health?.startedAt && box.health.startedAt !== started;
  const tasks = before.filter((id) => ['running', 'waiting', 'done', 'queued'].includes(box.tasks.get(id)?.state ?? ''));
  if (tasks.length && (restarted || Date.now() - dropAt > 3000)) box.restored = { at: Date.now(), tasks, restarted };
  changed();
}

async function loadHealth() {
  box.health = await api<Health>('GET', '/health');
  // A box that started in the last ten minutes and resumed tasks: say so, even on a screen that just booted.
  const h = box.health;
  if (h.resumed?.length && h.startedAt && Date.now() - Date.parse(h.startedAt) < 600_000 && !box.restored) {
    box.restored = { at: Date.parse(h.startedAt), tasks: h.resumed, restarted: true };
  }
}

// ---------- SpacetimeDB ----------

let conn: DbConnection | undefined;
type TaskRow = { id: string; title: string; state: string; source: string; workspace: string; worker: string; costCents: number; budgetCents: number; updatedAt: string; step: string; note: string };
type ApprovalRow = { id: string; task: string; question: string; costCents: number; state: string; by: string };

function taskRow(r: TaskRow) {
  const old = box.tasks.get(r.id);
  const note = r.state === 'failed' ? { error: r.note } : { summary: r.note || old?.summary };
  box.tasks.set(r.id, { ...(old ?? { createdAt: r.updatedAt, layers: [], tools: [], hosts: [], prompt: '', user: `box-${r.id}` }), ...r, ...note } as Task);
  changed();
}
function approvalRow(r: ApprovalRow) {
  box.approvals.set(r.id, { ...r, by: r.by || undefined } as Approval);
  changed();
}

function spacetime(h: Health) {
  const scheme = location.protocol === 'https:' ? 'wss' : 'ws';
  DbConnection.builder()
    .withUri(`${scheme}://${location.hostname}:${h.spacetime.port}`)
    .withDatabaseName(h.spacetime.database)
    .onConnect((c) => {
      c.db.task.onInsert((_ctx, r) => taskRow(r as TaskRow));
      c.db.task.onUpdate((_ctx, _old, r) => taskRow(r as TaskRow));
      c.db.approval.onInsert((_ctx, r) => approvalRow(r as ApprovalRow));
      c.db.approval.onUpdate((_ctx, _old, r) => approvalRow(r as ApprovalRow));
      c.subscriptionBuilder()
        .onApplied(() => {
          conn = c;
          box.live = 'spacetimedb';
          for (const r of c.db.task.iter()) taskRow(r as TaskRow);
          for (const r of c.db.approval.iter()) approvalRow(r as ApprovalRow);
        })
        .subscribeToAllTables();
    })
    .onDisconnect(() => {
      conn = undefined;
      box.live = 'log stream';
      changed();
      setTimeout(() => spacetime(h), 3000);
    })
    .onConnectError(() => {
      if (box.live === 'connecting') box.live = 'log stream';
      changed();
      setTimeout(() => spacetime(h), 15000);
    })
    .build();
}

// ---------- actions ----------

/** Approve or deny. Through SpacetimeDB when it's connected (the box hears it live), else the HTTP API. */
export async function answer(a: Approval, approved: boolean) {
  if (conn) conn.reducers.answer({ id: a.id, approved, by: surface });
  else await api('POST', `/approvals/${a.id}`, { approved, by: surface });
  box.approvals.set(a.id, { ...a, state: approved ? 'approved' : 'denied', by: surface });
  changed();
}

export async function undo(id: string) {
  const t = await api<Task>('POST', `/tasks/${id}/undo`);
  box.tasks.set(id, t);
  changed();
  return t;
}

export async function start() {
  await Promise.all([refresh(), loadHealth(), api<AppEntry[]>('GET', '/apps').then((a) => (box.apps = a))]).catch(() => {
    box.live = 'offline';
  });
  changed();
  follow();
  if (box.health) spacetime(box.health);
}
