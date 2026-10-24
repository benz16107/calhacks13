// Live state from the box. The HTTP API once, then SpacetimeDB for tasks and approvals, and the action log over
// Server-Sent Events. When SpacetimeDB's port is out of reach (a phone through a tunnel), the log stream alone keeps
// tasks and approvals live: every change is a log event, so each one triggers a refetch.
import { useEffect, useReducer } from 'preact/hooks';
import type { Approval, LogEvent, Task } from '../../core/contract.ts';
import { DbConnection } from '../../core/spacetime/bindings/index.ts';

export type { Approval, LogEvent, Task };
export interface AppEntry { name: string; title: string; href: string; track: string }
/** An installed app (a track) as the App Center sees it: GET /api/apps?all=1. Names only, never a key. */
export interface AppInfo {
  id: string;
  title: string;
  description: string;
  status: 'enabled' | 'disabled' | 'error';
  error?: string;
  restartNeeded?: boolean;
  access: {
    tools: { name: string; description: string }[];
    jobs: string[];
    hosts: string[];
    secrets: { name: string; set: boolean }[];
    triggers: string[];
    routes: string[];
  };
  ui: { name: string; title: string; href: string }[];
}
export interface Settings {
  approvalThresholdCents: number;
  defaultBudgetCents: number;
  networkDefault: 'none' | 'allowlist';
  defaultHosts: string[];
  agentFolders: string[];
  quietHours: { enabled: boolean; from: string; to: string };
  logRetentionDays: number;
  updateChannel: 'stable' | 'beta';
  autoUpdate: boolean;
  appearance: { theme: 'light' | 'dark' | 'system'; accent: string };
}
export interface SetupState { done: boolean; finishedAt?: string; migrated?: boolean; steps: Record<string, { at: string; data?: any }>; suggested: string[] }
export interface System {
  product: string;
  edition: string;
  editionName: string;
  version: string;
  build: string;
  hostname: string;
  timezone: string;
  network: { online: boolean; interfaces: { name: string; address: string; family?: string }[] };
  boxId: string;
  boxName: string;
  owner: string | null;
  startedAt: string;
  uptimeSec: number;
}
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
  /** Every installed app, on or off, for the App Center and setup. */
  allApps: [] as AppInfo[],
  boxes: [] as BoxEntry[],
  settings: undefined as Settings | undefined,
  setup: undefined as SetupState | undefined,
  system: undefined as System | undefined,
  /** This screen may change setup, settings, apps and keys: the box's own screen or the owner's paired phone. */
  owner: false,
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
  /** This device is off the box's screen and not paired (or its pairing was revoked): the box answers 401. */
  unpaired: false,
  /** Requests that were waiting here and just got an answer, from this screen or another: shown for a moment. */
  resolved: new Map<string, { at: number; approved: boolean; by?: string; mine: boolean }>(),
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
  const [, force] = useReducer((n: number, _: void) => n + 1, 0);
  useEffect(() => {
    subs.add(force);
    return () => void subs.delete(force);
  }, []);
  return box;
}

export async function api<T = any>(method: string, path: string, body?: unknown, timeoutMs = 15_000): Promise<T> {
  const token = pairing()?.token;
  const r = await fetch(`/api${path}`, {
    method,
    headers: { ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  }).catch((e: Error) => {
    throw new Error(e.name === 'TimeoutError' ? 'The box did not answer in time' : 'The box is out of reach');
  });
  const out = await r.json().catch(() => ({ error: `${r.status} ${r.statusText}` }));
  if (r.status === 401) {
    // Off the box's own screen, every call needs a paired token. A revoked one is forgotten, so this device pairs again.
    if (token) localStorage.removeItem('pairing');
    if (!box.unpaired) ((box.unpaired = true), changed());
  }
  if (!r.ok) throw Object.assign(new Error(out.error ?? `${r.status} ${r.statusText}`), { status: r.status });
  return out as T;
}
/** The pairing token as a query, for what can't send a header: the log stream and track pages in a window. */
export const tokenQuery = (sep = '?') => (pairing() ? `${sep}access_token=${encodeURIComponent(pairing()!.token)}` : '');

/** How long an answered request stays in place, showing its answer, before the next one moves up. */
export const HOLD = 1600;
/** Keep an approval, and note when one that was waiting here gets its answer, so the screen can say so. */
function setApproval(a: Approval) {
  const old = box.approvals.get(a.id);
  if (old?.state === 'pending' && a.state !== 'pending' && !box.resolved.has(a.id)) {
    box.resolved.set(a.id, { at: Date.now(), approved: a.state === 'approved', by: a.by, mine: false });
    setTimeout(changed, HOLD + 50);
  }
  box.approvals.set(a.id, a);
}

async function refresh() {
  const [tasks, approvals] = await Promise.all([api<Task[]>('GET', '/tasks'), api<Approval[]>('GET', '/approvals')]);
  box.tasks = new Map(tasks.map((t) => [t.id, t]));
  for (const a of approvals) setApproval(a);
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
  // Settings, setup and apps change through the API from any screen; their log notes keep every screen in step.
  if (e.type === 'note' && Date.now() - Date.parse(e.at) < 60_000) {
    if (e.track === 'settings') void loadSettings();
    if (e.track === 'setup') void loadSetup();
    if (e.track === 'apps') void loadApps();
  }
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
let es: EventSource | undefined;
let retryFollow = 0;
function follow() {
  clearTimeout(retryFollow);
  es?.close();
  if (box.unpaired) return;
  // Start one line back: the box sends the stream's headers with its first event, so a replayed line opens it at once.
  const stream = new EventSource(`/api/log/stream?after=${Math.max(0, (box.events.at(-1)?.seq ?? 0) - 1)}${tokenQuery('&')}`);
  es = stream;
  stream.onmessage = (m) => take(JSON.parse(m.data));
  stream.onopen = () => {
    if (activeBeforeDrop) void cameBack(activeBeforeDrop);
    activeBeforeDrop = undefined;
    misses = 0;
    box.down = false;
    if (box.live === 'offline') box.live = 'log stream';
    changed();
  };
  stream.onerror = () => {
    if (stream !== es) return;
    drop();
  };
}
/** The box went out of reach: say so, and keep trying every second (the browser's own retry backs off, slow after a power cut). */
function drop() {
  if (!activeBeforeDrop) {
    activeBeforeDrop = [...box.tasks.values()].filter((t) => ['queued', 'running', 'waiting'].includes(t.state)).map((t) => t.id);
    dropAt = Date.now();
  }
  box.down = true;
  box.live = 'offline';
  changed();
  es?.close();
  es = undefined;
  clearTimeout(retryFollow);
  retryFollow = setTimeout(follow, 1000);
}
// A hard power-off leaves the stream's connection hanging without an error. Ask the box every 4 seconds; two misses
// in a row mean it is out of reach, so a phone shows that within about 10 seconds.
let misses = 0;
function heartbeat() {
  setInterval(async () => {
    const ok = await fetch('/api/health', { cache: 'no-store', signal: AbortSignal.timeout(3500) }).then((r) => r.ok, () => false);
    if (ok) {
      misses = 0;
      if (box.down && !es) follow();
    } else if (++misses >= 2 && !box.down) drop();
  }, 4000);
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
  // SpacetimeDB's task table has no hosts, tools or user: fetch the full task the first time it appears.
  if (!old) void api<{ task: Task }>('GET', `/tasks/${r.id}`).then(({ task }) => {
    const now = box.tasks.get(r.id);
    if (now) box.tasks.set(r.id, { ...task, ...now, hosts: task.hosts, tools: task.tools, user: task.user, createdAt: task.createdAt, prompt: task.prompt });
    changed();
  }, () => {});
  changed();
}
function approvalRow(r: ApprovalRow) {
  setApproval({ ...r, by: r.by || undefined } as Approval);
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
 * Approve or deny, and only say it worked once the box has it. A paired phone answers with its device token, so the
 * log names the phone. The box's own screen answers through SpacetimeDB when it is connected (the box hears it live)
 * and checks the row changed, else through the HTTP API. If the box is out of reach, the answer fails and says so.
 */
export async function answer(a: Approval, approved: boolean) {
  if (box.down) throw new Error('The box is out of reach. Your answer did not go through.');
  const mine = pairing()?.device.name ?? surface;
  let got: Approval | undefined;
  if (!pairing() && conn && box.live === 'spacetimedb') {
    conn.reducers.answer({ id: a.id, approved, by: surface });
    for (let i = 0; i < 25 && box.approvals.get(a.id)?.state === 'pending'; i++) await new Promise((r) => setTimeout(r, 200));
    got = box.approvals.get(a.id)?.state === 'pending' ? undefined : box.approvals.get(a.id);
  }
  got ??= await api<Approval>('POST', `/approvals/${a.id}`, { approved, by: surface }, 8000).catch((e: Error) => {
    throw new Error(`${e.message}. Your answer did not go through.`);
  });
  const theirs = got.state !== (approved ? 'approved' : 'denied') || (got.by && got.by !== mine && got.by !== surface);
  box.resolved.set(a.id, { at: Date.now(), approved: got.state === 'approved', by: got.by, mine: !theirs });
  setTimeout(changed, HOLD + 50);
  box.approvals.set(a.id, got);
  changed();
  return got;
}

export async function undo(id: string) {
  const t = await api<Task>('POST', `/tasks/${id}/undo`);
  box.tasks.set(id, t);
  changed();
  return t;
}

// ---------- settings, setup, apps, system ----------

/** Light, Dark, or what the device prefers. The desktop itself is the same in both. */
export function applyTheme() {
  const t = box.settings?.appearance.theme ?? 'system';
  const dark = t === 'dark' || (t === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  applyAccent();
  for (const f of document.querySelectorAll('iframe')) {
    try {
      f.contentDocument!.documentElement.dataset.theme = document.documentElement.dataset.theme;
    } catch {} // a frame from another origin keeps its own
  }
}
/** The accent color from Settings, Appearance, mixed for light or dark. Empty means the system's blue. */
function applyAccent() {
  const hex = box.settings?.appearance.accent;
  const s = document.documentElement.style;
  const names = ['--color-accent-bg', '--color-accent-fg', '--color-accent-subtle'];
  if (!hex) return names.forEach((n) => s.removeProperty(n));
  const dark = document.documentElement.dataset.theme === 'dark';
  s.setProperty('--color-accent-bg', dark ? `color-mix(in srgb, ${hex}, white 40%)` : hex);
  s.setProperty('--color-accent-fg', dark ? `color-mix(in srgb, ${hex}, white 50%)` : `color-mix(in srgb, ${hex}, black 8%)`);
  s.setProperty('--color-accent-subtle', dark ? `color-mix(in srgb, ${hex} 35%, #1e2228)` : `color-mix(in srgb, ${hex} 16%, white)`);
}
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);

export async function loadSettings() {
  box.settings = await api<Settings>('GET', '/settings').catch(() => box.settings);
  applyTheme();
  changed();
}
export async function loadSetup() {
  box.setup = await api<SetupState>('GET', '/setup').catch(() => box.setup);
  changed();
}
export async function loadApps() {
  const [on, all] = await Promise.all([api<AppEntry[]>('GET', '/apps').catch(() => box.apps), api<AppInfo[]>('GET', '/apps?all=1').catch(() => box.allApps)]);
  box.apps = on;
  box.allApps = all;
  changed();
}
export async function loadSystem() {
  box.system = await api<System>('GET', '/system').catch(() => box.system);
  changed();
}
/** Change settings. Only the owner may; anyone else gets the box's own error, which names why. */
export async function patchSettings(patch: Partial<Settings> | Record<string, unknown>) {
  box.settings = await api<Settings>('PATCH', '/settings', patch);
  applyTheme();
  changed();
}

export async function start() {
  heartbeat();
  await Promise.all([refresh(), loadHealth(), loadApps(), loadSettings(), loadSetup(), loadSystem()]).catch(() => {
    if (box.unpaired) return;
    box.live = 'offline';
    box.down = true;
  });
  if (box.unpaired) return changed();
  box.boxes = await api<BoxEntry[]>('GET', '/boxes').catch(() => []);
  box.owner = await api('GET', '/vault').then(
    () => true,
    () => false,
  );
  changed();
  follow();
  // SpacetimeDB listens on the box's loopback only (core c6f747e): the box's own screen subscribes, others follow the log.
  if (box.health && ['127.0.0.1', 'localhost', '[::1]'].includes(location.hostname)) spacetime(box.health);
}
