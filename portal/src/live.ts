// Live state from the box. The HTTP API once, then SpacetimeDB for tasks and approvals, and the action log over
// Server-Sent Events. When SpacetimeDB's port is out of reach (a phone through a tunnel), the log stream alone keeps
// tasks and approvals live: every change is a log event, so each one triggers a refetch.
import { useEffect, useReducer } from 'preact/hooks';
import type { Approval, ApprovalRoute, LogEvent, Task } from '../../core/contract.ts';
import { DbConnection } from '../../core/spacetime/bindings/index.ts';
import { APP_HOST } from './relay.ts';

export type { Approval, ApprovalRoute, LogEvent, Task };

// ---------- GurtOS Business (core/README.md, "Business edition") ----------
export type Role = 'owner' | 'admin' | 'approver' | 'requester' | 'auditor';
export interface Person {
  id: string;
  name: string;
  role: Role;
  title?: string;
  /** The most this person may approve, in US cents. null means no limit. */
  limitCents: number | null;
  /** The names in the rules this person approves for: 'Controller', 'Fraud reviewer'. */
  approvesFor: string[];
  /** Phones paired as this person (GET /api/people only, for admins). */
  phones?: { id: string; name: string; pairedAt: string }[];
}
export interface Seat { name: string; about?: string; may?: string }
export interface RuleView {
  line: string;
  to: string;
  any?: boolean;
  overCents?: number;
  phrase?: string;
  app?: string;
  blocked?: boolean;
  /** The people who approve under this rule now. */
  approvers: string[];
  changed: { by: string; at: string } | null;
}
export interface Paused { by: string; at: string; via?: string }
/** A seat's shadow record: its suggestions, how often a person decided the same, and the policy's go-live line. */
export interface Pilot {
  seat: string;
  shadow: boolean;
  suggested: number;
  answered: number;
  agreed: number;
  percent: number | null;
  goLive: { seat: string; after: number; percent: number; line: string } | null;
  ready: boolean;
  disagreements: { approval: string; task: string; at: string; question: string; by: string }[];
}
export interface BusinessView { on: boolean; company: string; policy: string; rules: RuleView[]; seats: Seat[]; shadow: string[]; pilot: Pilot[]; paused: Paused | null }
export interface Me {
  edition: string;
  company: string;
  paused: Paused | null;
  person: Person | null;
  /** Everyone's name, title, role, limit and what they approve for (no phones). */
  directory: Pick<Person, 'id' | 'name' | 'title' | 'role' | 'limitCents' | 'approvesFor'>[];
  waiting: Approval[];
  /** Requests nobody can approve now, which this person may still deny. */
  stuck?: Approval[];
  requests: Approval[];
}
/** A person's name from their id, for any screen. */
export const nameOf = (id?: string) => (id && box.business.me?.directory.find((p) => p.id === id)?.name) || id || '';
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
    /** optional: the app works without it (core's optionalSecrets), so it never counts as missing. */
    secrets: { name: string; set: boolean; optional?: true }[];
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
/** Command setup: an agent on another computer sets this one up with a one-time code (core's /api/setup/code). */
/** The code and its time limit come only from POST /api/setup/code; GET /api/setup carries the rest ({open: false} when closed). */
export interface SetupChannel { code?: string; expiresAt?: string; open: boolean; port?: number; urls?: string[]; remote?: string; devices?: { name: string; since?: string }[] }
export interface SetupState { done: boolean; /** false until the vault holds a model key: no task can start. */ modelKey?: boolean; finishedAt?: string; migrated?: boolean; steps: Record<string, { at: string; data?: any }>; suggested: string[]; channel?: SetupChannel | null }
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
  /** GurtOS Business: the company's name. */
  company?: string;
  paused?: { paused: boolean; by: string | null; at: string | null; via: string | null };
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
export interface Pairing { token: string; device: { id: string; name: string; person?: string }; box: { id: string; name: string } }
/** A box this device is paired with. On a box's own portal there is one, the box itself (url ''). On app.gurtos.com
 *  there can be many, each called at its own https address with its own token. */
export interface Machine extends Pairing { url: string; edition?: string; pushKey?: string }

// app.gurtos.com is the portal in hosted mode: same code, but the machines are a list and none is this page's origin.
// Opening any page with ?hosted tries it on another address (for testing against a dev box).
if (new URLSearchParams(location.search).has('hosted')) localStorage.setItem('gurtos.hosted', '1');
export const hosted = location.hostname === APP_HOST || localStorage.getItem('gurtos.hosted') === '1';
// A notification opens /?machine=<box id>#task/<id>: show that machine.
const picked = new URLSearchParams(location.search).get('machine');
if (picked) localStorage.setItem('gurtos.machine', picked);

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
  /** The log has been read once, so totals from it (today's spending, blocked today) are whole. */
  logLoaded: false,
  restored: undefined as Restored | undefined,
  /** net.blocked events seen live, newest last. */
  blockedLive: [] as LogEvent[],
  /** This device is off the box's screen and not paired (or its pairing was revoked): the box answers 401. */
  unpaired: false,
  /** The owner's first name for the greeting, when the box knows it (GurtOS Personal, GET /api/owner `name`). */
  ownerName: '',
  /** Requests that were waiting here and just got an answer, from this screen or another: shown for a moment. */
  resolved: new Map<string, { at: number; approved: boolean; by?: string; mine: boolean }>(),
  /** GurtOS Business: who is signed in here, what waits for them, the rules and the people. Empty on Server and Personal. */
  business: { on: localStorage.getItem('gurtos.edition') === 'business', company: '', me: undefined as Me | undefined, view: undefined as BusinessView | undefined, people: undefined as Person[] | undefined },
};

/**
 * Who is signed in on this screen. A paired phone is the person it was paired for; the box's own screen (no
 * pairing) says which person is using it, kept here, and sends it as x-box-person on every call.
 */
export const signedIn = () => (pairing() ? undefined : (localStorage.getItem('gurtos.person') ?? undefined));
export function signIn(id: string | undefined) {
  if (id) localStorage.setItem('gurtos.person', id);
  else localStorage.removeItem('gurtos.person');
  box.owner = false;
  void loadBusiness().then(() => loadOwnerRights());
}
/** Whether this screen may change setup, settings, apps and keys: the box's own screen or an owner. */
async function loadOwnerRights() {
  // A Business person's role says it. Anyone else asks the vault, which answers only the owner (a 403 otherwise).
  const person = box.business.on ? box.business.me?.person : undefined;
  box.owner = person
    ? person.role === 'owner'
    : await api('GET', '/vault').then(
        () => true,
        () => false,
      );
  changed();
}
/** The person signed in here, on a Business box. */
export const me = () => (box.business.on ? box.business.me?.person ?? undefined : undefined);
/** On a Business box, whether this person approves this request now: what "Waiting for me" lists. Elsewhere, always. */
export const forMe = (a: Approval) => !box.business.on || !!box.business.me?.waiting.some((w) => w.id === a.id);

export async function loadBusiness() {
  await loadSystem();
  const on = box.system?.edition === 'business';
  box.business.on = on;
  localStorage.setItem('gurtos.edition', box.system?.edition ?? ''); // so the next load shows the right home from its first frame
  box.business.company = box.system?.company ?? '';
  if (!on) {
    box.business.me = box.business.view = box.business.people = undefined;
    return changed();
  }
  const [me, view] = await Promise.all([api<Me>('GET', '/me').catch(() => box.business.me), api<BusinessView>('GET', '/business').catch(() => box.business.view)]);
  box.business.me = me;
  box.business.view = view;
  const role = me?.person?.role;
  box.business.people = role === 'admin' || role === 'owner' || (!me?.person && !pairing()) ? await api<Person[]>('GET', '/people').catch(() => undefined) : undefined;
  changed();
}
let meTimer = 0;
/** Waiting for me changes with every request asked or answered: fetch it again, at most every 300 ms. */
function loadMeSoon() {
  if (meTimer || !box.business.on) return;
  meTimer = setTimeout(async () => {
    meTimer = 0;
    box.business.me = await api<Me>('GET', '/me').catch(() => box.business.me);
    changed();
  }, 300);
}

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
  // app.gurtos.com has no API of its own: with no machine, there is nothing to ask, only pairing.
  if (noMachine()) {
    if (!box.unpaired) ((box.unpaired = true), changed());
    throw Object.assign(new Error('No computer is paired with this app'), { status: 401 });
  }
  const token = pairing()?.token;
  const r = await fetch(`${base()}/api${path}`, {
    method,
    headers: { ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...(token ? { authorization: `Bearer ${token}` } : {}), ...(signedIn() ? { 'x-box-person': signedIn()! } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  }).catch((e: Error) => {
    throw new Error(e.name === 'TimeoutError' ? `${named()} did not answer in time` : `${named()} is out of reach`);
  });
  const out = await r.json().catch(() => ({ error: `${r.status} ${r.statusText}` }));
  if (r.status === 401) {
    // Off the box's own screen, every call needs a paired token. A revoked one is forgotten, so this device pairs again.
    if (token) setPairing(undefined);
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
/** At most one refresh every 250 ms, even while events keep coming. */
function refreshSoon() {
  if (refreshTimer) return;
  refreshTimer = setTimeout(() => ((refreshTimer = 0), refresh().catch(() => {})), 250);
}

// ---------- the log over SSE ----------

/** The box's calendar day for a time, in its own time zone, so every screen agrees on "today". */
export const dayOf = (t: string | number = Date.now()) => new Date(t).toLocaleDateString('en-CA', box.system?.timezone ? { timeZone: box.system.timezone } : {});
function take(e: LogEvent) {
  if (e.seq <= (box.events.at(-1)?.seq ?? 0)) return; // already have it (a reconnect replays one line)
  box.events.push(e);
  if (box.events.length > KEEP) box.events.splice(0, box.events.length - KEEP);
  const day = dayOf(e.at);
  if (day === dayOf()) {
    if (box.today.day !== day) box.today = { day, cents: 0, blocked: 0 };
    if (e.type === 'cost') box.today.cents += e.cents;
    if (e.type === 'tool.result') box.today.cents += e.cents ?? 0;
    if (e.type === 'net.blocked') box.today.blocked++;
  }
  // A task can show up in the log before the task list catches up (a phone follows the log, and a burst of events
  // keeps pushing the refresh back). Its creation event carries the title and hosts; any other event fetches it.
  if (e.type === 'task.created' && !box.tasks.has(e.task))
    box.tasks.set(e.task, { ...e.spec, id: e.task, state: 'queued', user: e.user, layers: [], costCents: 0, createdAt: e.at, updatedAt: e.at } as Task);
  else if (e.task && !box.tasks.has(e.task)) fetchTask(e.task);
  // A block from the last minute is news; older ones are history the log replays on load.
  if (e.type === 'net.blocked' && Date.now() - Date.parse(e.at) < 60_000) box.blockedLive.push(e);
  if (box.live !== 'spacetimedb' && e.type !== 'note') refreshSoon();
  // Settings, setup and apps change through the API from any screen; their log notes keep every screen in step.
  if (e.type === 'note' && Date.now() - Date.parse(e.at) < 60_000) {
    if (e.track === 'settings') void loadSettings();
    if (e.track === 'setup') void loadSetup();
    if (e.track === 'apps') void loadApps();
    if (e.track === 'business' || e.track === 'kill-switch') void loadBusiness();
  }
  if (e.type === 'approval.asked' || e.type === 'approval.answered') loadMeSoon();
  for (const l of eventListeners) l(e);
  changed();
}
const fetching = new Set<string>();
function fetchTask(id: string) {
  if (fetching.has(id)) return;
  fetching.add(id);
  api<{ task: Task }>('GET', `/tasks/${id}`)
    .then(({ task }) => (box.tasks.set(id, { ...task, ...box.tasks.get(id) }), changed()))
    .catch(() => {})
    .finally(() => fetching.delete(id));
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
  if (noMachine() && !box.unpaired) ((box.unpaired = true), changed());
  if (box.unpaired) return;
  // Start one line back: the box sends the stream's headers with its first event, so a replayed line opens it at once.
  const stream = new EventSource(`${base()}/api/log/stream?after=${Math.max(0, (box.events.at(-1)?.seq ?? 0) - 1)}${tokenQuery('&')}`);
  es = stream;
  stream.onmessage = (m) => take(JSON.parse(m.data));
  stream.onopen = () => {
    retries = 0;
    // Opened offline from the app's cache: read the whole log now that the box answers, so totals are whole.
    if (!box.logLoaded) void api<LogEvent[]>('GET', '/log?after=0').then((l) => (l.forEach(take), (box.logLoaded = true), changed()), () => {});
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
  // Try again soon after a power cut, then less often: 1 s, 2 s, 4 s, up to 30 s while the box stays away.
  retryFollow = setTimeout(follow, Math.min(30_000, 1000 * 2 ** retries++));
}
let retries = 0;
// A hard power-off leaves the stream's connection hanging without an error. Ask the box every 4 seconds; two misses
// in a row mean it is out of reach, so a phone shows that within about 10 seconds.
let misses = 0;
function heartbeat() {
  setInterval(async () => {
    if (noMachine()) {
      // The machine was forgotten while this page was open: stop following it and show pairing.
      es?.close();
      es = undefined;
      if (!box.unpaired) ((box.unpaired = true), changed());
      return;
    }
    const ok = await fetch(`${base()}/api/health`, { cache: 'no-store', signal: AbortSignal.timeout(3500) }).then((r) => r.ok, () => false);
    if (ok) {
      misses = 0;
      if (box.down && !es) ((retries = 0), follow());
    } else if (++misses >= 2 && !box.down) drop();
  }, 4000);
}

/** The box was out of reach (a power cut, or the phone's network). Say which tasks carried on. */
async function cameBack(before: string[]) {
  const started = box.health?.startedAt;
  await Promise.all([refresh(), loadHealth()]).catch(() => {});
  const restarted = !!box.health?.startedAt && box.health.startedAt !== started;
  const tasks = before.filter((id) => ['running', 'waiting', 'done', 'queued'].includes(box.tasks.get(id)?.state ?? ''));
  if (restarted || (tasks.length && Date.now() - dropAt > 3000)) box.restored = { at: Date.now(), tasks, restarted, lostAt: dropAt };
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

/** Every machine this device is paired with. */
export function machines(): Machine[] {
  if (hosted) return JSON.parse(localStorage.getItem('gurtos.machines') ?? '[]');
  const p: Pairing | null = JSON.parse(localStorage.getItem('pairing') ?? 'null');
  return p ? [{ ...p, url: '' }] : [];
}
/** The machine this page shows: the one picked in the box switcher, else the first. */
export const machine = (): Machine | undefined => machines().find((m) => m.box.id === localStorage.getItem('gurtos.machine')) ?? machines()[0];
export const pairing = (): Pairing | undefined => machine();
/** Where this page's machine answers: '' (this page's own origin) on a box, its https address on app.gurtos.com. */
/** This computer's name for sentences: "Home box is out of reach". */
const named = () => box.system?.boxName ?? machine()?.box.name ?? 'This computer';
export const base = () => (hosted ? (machine()?.url ?? '') : '');
const noMachine = () => hosted && !machine();
// Another tab (or Forget) removed the machine this page shows: go to pairing or the next machine.
addEventListener('storage', (e) => hosted && e.key === 'gurtos.machines' && !machines().some((m) => m.box.id === localStorage.getItem('gurtos.machine')) && location.replace('/'));
// app.gurtos.com with no machine yet: straight to pairing, from the first frame.
if (hosted && !machine()) box.unpaired = true;

/** Keep the list, and the service worker's copy of it (it can't read localStorage; it answers from notifications). */
function saveMachines(all: Machine[]) {
  if (hosted) localStorage.setItem('gurtos.machines', JSON.stringify(all));
  else if (all[0]) localStorage.setItem('pairing', JSON.stringify({ token: all[0].token, device: all[0].device, box: all[0].box, ...(all[0].pushKey ? { pushKey: all[0].pushKey } : {}) }));
  else localStorage.removeItem('pairing');
  // caches exist only on a secure page, which is also the only place a service worker runs.
  if (typeof caches !== 'undefined')
    void caches.open('gurtos-pairing').then((c) => void c.put('/machines', new Response(JSON.stringify(all.map((m) => ({ ...m, url: m.url || location.origin }))))));
}
/** Change what is stored for a machine (its push key) without switching to it. */
export const updateMachine = (m: Machine) => saveMachines(machines().map((x) => (x.box.id === m.box.id && x.url === m.url ? m : x)));
/** Call one machine's API (not necessarily the one on screen), with its token. */
export async function callMachine<T = any>(m: Machine, method: string, path: string, body?: unknown): Promise<T> {
  const r = await fetch(`${m.url}/api${path}`, {
    method,
    headers: { ...(body === undefined ? {} : { 'content-type': 'application/json' }), authorization: `Bearer ${m.token}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  }).catch(() => {
    throw new Error(`${m.box.name} is out of reach`);
  });
  const out = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(out.error ?? `${m.box.name} said ${r.status}`), { status: r.status });
  return out as T;
}
/** Add a machine (or renew its pairing) and show it. */
export function addMachine(m: Machine) {
  saveMachines([...machines().filter((x) => x.box.id !== m.box.id), m]);
  localStorage.setItem('gurtos.machine', m.box.id);
}
/** Show another machine. Everything on the page is that machine's, so start over. */
export function switchMachine(id: string) {
  localStorage.setItem('gurtos.machine', id);
  location.replace(location.pathname === '/screen' ? '/screen' : '/');
}
/** Pair this page's machine again, or forget it (revoked on the box, or "Forget this machine"). */
export function setPairing(p: Pairing | undefined) {
  const m = machine();
  if (p) addMachine({ url: m?.url ?? '', ...m, ...p });
  else saveMachines(machines().filter((x) => x.box.id !== m?.box.id));
}

/**
 * Approve or deny, and only say it worked once the box has it. A paired phone answers with its device token, so the
 * log names the phone. The box's own screen answers through SpacetimeDB when it is connected (the box hears it live)
 * and checks the row changed, else through the HTTP API. If the box is out of reach, the answer fails and says so.
 */
export async function answer(a: Approval, approved: boolean) {
  if (box.down) throw new Error(`${named()} is out of reach. Your answer did not go through.`);
  const mine = pairing()?.device.name ?? surface;
  let got: Approval | undefined;
  // A Business box takes answers only through the API, as the person signed in here.
  if (!pairing() && conn && box.live === 'spacetimedb' && !box.business.on) {
    // A late answer is refused by the database ("already approved by <name>"). That is not a lost connection: the check below finds who won, and the API call after it says so.
    conn.reducers.answer({ id: a.id, approved, by: surface }).catch(() => {});
    for (let i = 0; i < 25 && box.approvals.get(a.id)?.state === 'pending'; i++) await new Promise((r) => setTimeout(r, 200));
    got = box.approvals.get(a.id)?.state === 'pending' ? undefined : box.approvals.get(a.id);
  }
  got ??= await api<Approval>('POST', `/approvals/${a.id}`, { approved, by: surface }, 8000).catch((e: Error) => {
    throw new Error(`${e.message.replace(/\.$/, '')}. Your answer did not go through.`);
  });
  // On GurtOS Business an answer is named by its person, so "mine" means the person signed in here gave it.
  const meId = box.business.me?.person?.id;
  const theirs = got.state !== (approved ? 'approved' : 'denied') || (meId ? got.person !== meId : got.by && got.by !== mine && got.by !== surface);
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
  box.allApps = all.filter((a) => a.id !== 'example' || a.status === 'enabled'); // the developers' sample app, unless someone turned it on
  changed();
}
async function loadOwner() {
  const o = await api<{ name?: string } | null>('GET', '/owner').catch(() => null);
  box.ownerName = o?.name?.trim().split(/\s+/)[0] ?? '';
}
export async function loadSystem() {
  box.system = await api<System>('GET', '/system').catch(() => box.system);
  // The switcher shows each machine's name and edition as it last saw them.
  const m = machine(), s = box.system;
  if (hosted && m && s && (m.edition !== s.edition || m.box.name !== s.boxName)) addMachine({ ...m, edition: s.edition, box: { ...m.box, name: s.boxName } });
  changed();
}
/** Change settings. Only the owner may; anyone else gets the box's own error, which names why. */
export async function patchSettings(patch: Partial<Settings> | Record<string, unknown>) {
  box.settings = await api<Settings>('PATCH', '/settings', patch);
  applyTheme();
  changed();
}

export async function start() {
  if (hosted && !machine()) return; // nothing to ask yet: the page is on pairing (box.unpaired)
  heartbeat();
  await Promise.all([refresh(), loadHealth(), loadApps(), loadSettings(), loadSetup(), loadSystem()]).catch(() => {
    if (box.unpaired) return;
    box.live = 'offline';
    box.down = true;
  });
  if (box.unpaired) return changed();
  box.boxes = await api<BoxEntry[]>('GET', '/boxes').catch(() => []);
  await loadOwner();
  await loadBusiness();
  await loadOwnerRights();
  // The log in one answer first, so totals like today's spending are whole from the first frame; the stream picks up after it.
  const log = await api<LogEvent[]>('GET', '/log?after=0').catch(() => undefined);
  for (const e of log ?? []) take(e);
  box.logLoaded = !!log;
  // Started in the last ten minutes with a log from before: a restart, even with nothing to resume.
  const h = box.health;
  if (!box.restored && h?.startedAt && Date.now() - Date.parse(h.startedAt) < 600_000 && log?.some((e) => e.at < h.startedAt!)) {
    box.restored = { at: Date.parse(h.startedAt), tasks: [], restarted: true };
  }
  changed();
  follow();
  // SpacetimeDB listens on the box's loopback only (core c6f747e): the box's own screen subscribes, others follow the log.
  if (box.health && ['127.0.0.1', 'localhost', '[::1]'].includes(location.hostname)) spacetime(box.health);
}

// A phone paired just now knows its box's edition from the pairing, before anything loads: the first frame is right.
if (!box.business.on && (machine() as { edition?: string } | undefined)?.edition === 'business') box.business.on = true;
