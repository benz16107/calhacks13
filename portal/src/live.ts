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
export interface Restored { at: number; tasks: string[]; restarted: boolean; lostAt?: number }
/** A box the portal can show: this one, and peers from BOX_PEERS (GET /api/boxes). */
export interface BoxEntry { id: string; name: string; stdb?: string; self?: boolean; url?: string }
/** This phone's pairing with this box (POST /api/pair), kept in the browser. */
export interface Pairing { token: string; device: { id: string; name: string }; box: { id: string; name: string } }

/** Who answers from this screen. It goes into the log as `by`. */
export const surface: 'box screen' | 'phone' | 'portal' =
  location.pathname === '/screen' ? 'box screen' : matchMedia('(max-width: 699px), (pointer: coarse)').matches ? 'phone' : 'portal';

export const box = {
  tasks: new Map<string, Task>(),
  approvals: new Map<string, Approval>(),
  /** The newest events of the log, oldest first. */
  events: [] as LogEvent[],
  apps: [] as AppEntry[],
  boxes: [] as BoxEntry[],
  health: undefined as Health | undefined,
  /** When tasks or approvals last changed, for "updated 19:04:22". */
  updatedAt: Date.now(),
  /** How tasks and approvals stay live. */
  live: 'connecting' as 'connecting' | 'spacetimedb' | 'log stream' | 'offline',
  /** The box's API stopped answering (a power cut, or this device lost the network). */
  down: false,
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
  box.updatedAt = Date.now();
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
  if (e.seq <= (box.events.at(-1)?.seq ?? 0)) return; // already have it (a reconnect replays one line)
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
  // Start one line back: the box sends the stream's headers with its first event, so a replayed line opens it at once.
  const es = new EventSource(`/api/log/stream?after=${Math.max(0, (box.events.at(-1)?.seq ?? 0) - 1)}`);
  es.onmessage = (m) => take(JSON.parse(m.data));
  es.onopen = () => {
    if (activeBeforeDrop) void cameBack(activeBeforeDrop);
    activeBeforeDrop = undefined;
    box.down = false;
    if (box.live === 'offline') box.live = 'log stream';
    changed();
  };
  es.onerror = () => {
    if (!activeBeforeDrop) {
      activeBeforeDrop = [...box.tasks.values()].filter((t) => ['queued', 'running', 'waiting'].includes(t.state)).map((t) => t.id);
      dropAt = Date.now();
    }
    box.down = true;
    if (box.live !== 'spacetimedb') box.live = 'offline';
    changed();
    // Retry every second ourselves: the browser's own retry backs off, which is slow after a power cut.
    es.close();
    setTimeout(follow, 1000);
  };
}

/** The box was out of reach (a power cut, or the phone's network). Say which tasks carried on. */
async function cameBack(before: string[]) {
  const started = box.health?.startedAt;
  await Promise.all([refresh(), loadHealth()]).catch(() => {});
  const restarted = !!box.health?.startedAt && box.health.startedAt !== started;
  const tasks = before.filter((id) => ['running', 'waiting', 'done', 'queued'].includes(box.tasks.get(id)?.state ?? ''));
  if (tasks.length && (restarted || Date.now() - dropAt > 3000)) box.restored = { at: Date.now(), tasks, restarted, lostAt: dropAt };
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

/** One reconnect at a time, backing off to a minute: a failed connect fires both callbacks below. */
let retryTimer = 0;
let failures = 0;
function retry(h: Health) {
  if (retryTimer) return;
  retryTimer = setTimeout(() => ((retryTimer = 0), spacetime(h)), Math.min(60_000, 2000 * 2 ** failures++));
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
          failures = 0;
          box.live = 'spacetimedb';
          for (const r of c.db.task.iter()) taskRow(r as TaskRow);
          for (const r of c.db.approval.iter()) approvalRow(r as ApprovalRow);
        })
        .subscribeToAllTables();
    })
    .onDisconnect(() => {
      conn = undefined;
      if (box.live !== 'offline') box.live = 'log stream';
      changed();
      retry(h);
    })
    .onConnectError(() => {
      if (box.live === 'connecting' || box.live === 'spacetimedb') box.live = 'log stream';
      changed();
      retry(h);
    })
    .build();
}

// ---------- actions ----------

export const pairing = (): Pairing | undefined => JSON.parse(localStorage.getItem('pairing') ?? 'null') ?? undefined;

/**
 * Approve or deny. A paired phone answers with its device token, so the log names the phone. Otherwise through
 * SpacetimeDB when it's connected (the box hears it live), else the HTTP API.
 */
export async function answer(a: Approval, approved: boolean) {
  const p = pairing();
  let by: string = surface;
  if (p) {
    const r = await fetch(`/api/approvals/${a.id}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${p.token}` },
      body: JSON.stringify({ approved }),
    });
    if (r.status === 401) localStorage.removeItem('pairing'); // revoked on the box: pair again
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? r.statusText);
    by = p.device.name;
  } else if (conn) conn.reducers.answer({ id: a.id, approved, by });
  else await api('POST', `/approvals/${a.id}`, { approved, by });
  box.approvals.set(a.id, { ...a, state: approved ? 'approved' : 'denied', by });
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
    box.down = true;
  });
  box.boxes = await api<BoxEntry[]>('GET', '/boxes').catch(() => []);
  changed();
  follow();
  if (box.health) spacetime(box.health);
}
