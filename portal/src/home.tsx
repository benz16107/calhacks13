// The desktop (Figma direction A): menu bar (23:93), greeting, widgets, app grid, dock (22:99), the newest
// notification as a floating banner, and Notification Center (25:804) with everything else.
import { useEffect, useState } from 'preact/hooks';
import { box, changed, undo, useBox, type Task } from './live.ts';
import { PRODUCT } from './product.ts';
import { ApprovalBanner, Banner, CloseIcon, Glyph, ago, askedAt, dollars, hasGlyph, hhmm, plural, taskTitle, trackOf } from './ui.tsx';

/** The box's owner, for the greeting. */
const OWNER = 'Ben';
/** How long a blocked attempt or a restart stays on the desktop as a banner. Notification Center keeps it. */
const FRESH_MS = 5 * 60_000;

/** What the desktop shows besides windows. */
export const ui = { notifications: false };
export const toggleNotifications = (open = !ui.notifications) => {
  ui.notifications = open;
  changed();
};

export interface AppDef {
  id: string;
  title: string;
  /** The label under the icon when the full title is too long for the phone grid. */
  short?: string;
  glyph: string;
  hash: string;
  track?: string;
}

/** Built-in apps, then every app a loaded track registers, then Settings. */
export function appList(): AppDef[] {
  const tracks = box.apps
    .filter((a) => a.track !== 'example') // the example track is documentation, not an app anyone uses
    .map((a) => ({
      id: `${a.track}/${a.name}`,
      title: a.title.replace(/\s*\(.*\)$/, ''),
      glyph: hasGlyph(a.name) ? a.name : a.track,
      hash: `#app/${a.track}/${a.name}`,
      track: a.track,
    }));
  return [
    { id: 'tasks', title: 'Tasks', glyph: 'tasks', hash: '#tasks' },
    { id: 'activity', title: 'Activity', glyph: 'activity', hash: '#activity' },
    { id: 'time-machine', title: 'Time Machine', short: 'Undo', glyph: 'time-machine', hash: '#time-machine' },
    ...tracks,
    { id: 'settings', title: 'Settings', glyph: 'settings', hash: '#settings' },
  ];
}

export const pending = () => [...box.approvals.values()].filter((a) => a.state === 'pending');
export const ofState = (...states: Task['state'][]) => [...box.tasks.values()].filter((t) => states.includes(t.state));
/** A restart in the last ten minutes: the desktop says "Welcome back". */
const welcome = () => (box.restored?.restarted && Date.now() - box.restored.at < 600_000 ? box.restored : undefined);

/** Amber count on an app: approvals waiting in that app's tasks. Only the track's first app shows it. */
function badge(app: AppDef, apps: AppDef[]) {
  if (app.id === 'tasks') return pending().length;
  if (!app.track || apps.find((a) => a.track === app.track) !== app) return 0;
  return pending().filter((a) => trackOf(box.tasks.get(a.task) ?? { source: '' }) === app.track).length;
}
function running(app: AppDef) {
  const r = ofState('running', 'waiting');
  if (app.id === 'tasks') return r.length > 0;
  return !!app.track && r.some((t) => trackOf(t) === app.track);
}

export function useNow(ms: number) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

/** This box and its peers. Before GET /api/boxes answers, just this box. */
export function boxList() {
  const fallback = { id: location.host, name: ['127.0.0.1', 'localhost'].includes(location.hostname) ? 'this box' : location.hostname, self: true, url: undefined };
  return box.boxes.length ? box.boxes : [fallback];
}

// ---------- menu bar ----------

export function MenuBar() {
  const now = useNow(15_000);
  const b = useBox();
  const [menu, setMenu] = useState(false);
  const boxes = boxList();
  const self = boxes.find((x) => x.self) ?? boxes[0];
  const up = b.health?.startedAt ? ` · up ${uptime(now - Date.parse(b.health.startedAt))}` : '';
  const status = `${b.down ? 'out of reach' : 'online'}${up}${welcome() ? ' · restored after a power cut' : ''}`;
  const n = pending().length;
  const d = new Date(now);
  return (
    <header class="menubar">
      <div class="menubar-group">
        <span class="menubar-name desk-only">{PRODUCT}</span>
        <div class="switcher-wrap">
          <button class="switcher" aria-expanded={menu} aria-haspopup="true" onClick={() => setMenu(!menu)}>
            <span class="tile-28" aria-hidden="true">
              <Glyph name="box" />
            </span>
            <span class="switcher-name">{self.name}</span>
            <svg class="chevron" viewBox="0 0 12 12" aria-hidden="true">
              <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none" />
            </svg>
            <span class="switcher-count desk-only">
              {boxes.indexOf(self) + 1} of {plural(boxes.length, 'box', 'boxes')}
            </span>
          </button>
          {menu && <BoxMenu onClose={() => setMenu(false)} />}
        </div>
        <span class="menubar-quiet desk-only">{status}</span>
      </div>
      <div class="menubar-group">
        <span class="menubar-quiet desk-only">
          {ofState('running').length} running · {ofState('waiting').length} waiting
        </span>
        <button class="notif-button" aria-expanded={ui.notifications} onClick={() => toggleNotifications()} aria-label={`Notifications, ${plural(n, 'request')} waiting`}>
          <span aria-hidden="true">Notifications</span>
          {n > 0 && (
            <span class="badge" aria-hidden="true">
              {n}
            </span>
          )}
        </button>
        <time class="menubar-clock desk-only" dateTime={d.toISOString()}>
          {d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).replace(',', '')}
          {'  '}
          {hhmm(now)}
        </time>
      </div>
    </header>
  );
}
function uptime(ms: number) {
  const m = Math.floor(ms / 60_000);
  return m < 60 ? `${m} m` : `${Math.floor(m / 60)} h ${m % 60} m`;
}

function BoxMenu({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    addEventListener('keydown', esc);
    return () => removeEventListener('keydown', esc);
  }, []);
  return (
    <div class="box-menu" role="menu">
      {boxList().map((x) => (
        <a role="menuitem" class="box-menu-item" key={x.id} href={x.self ? '#settings' : x.url} aria-disabled={!x.self && !x.url} onClick={() => onClose()}>
          <span class="tile-28" aria-hidden="true">
            <Glyph name="box" />
          </span>
          <span class="box-menu-name">{x.name}</span>
          <span class="box-menu-note">{x.self ? 'this box' : x.url ? 'switch' : 'no address yet'}</span>
        </a>
      ))}
      <a role="menuitem" class="box-menu-item" href="#settings" onClick={() => onClose()}>
        <span class="tile-28" aria-hidden="true">
          <Glyph name="pair" />
        </span>
        <span class="box-menu-name">Pair a phone</span>
      </a>
    </div>
  );
}

// ---------- the desktop ----------

function Greeting() {
  const b = useBox();
  const w = welcome();
  // The last log line before the boot: the outage began after it.
  const lost = w && (w.lostAt ?? box.events.findLast((e) => Date.parse(e.at) < w.at)?.at);
  if (w) {
    return (
      <section class="greeting">
        <h1>Welcome back.</h1>
        <p>
          {lost ? `The box went down after ${hhmm(lost)} and booted at ${hhmm(w.at)}.` : `The box booted at ${hhmm(w.at)}.`} Every task is where it was.
        </p>
      </section>
    );
  }
  const hour = new Date().getHours();
  const part = hour < 5 ? 'evening' : hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
  const n = pending().length;
  const r = ofState('running').length;
  const blocked = b.today.blocked;
  const line = [
    n === 0 ? 'Nothing needs your OK.' : `${plural(n, 'task')} ${n === 1 ? 'needs' : 'need'} your OK.`,
    r === 0 ? 'Nothing else is running.' : `${r} ${r === 1 ? 'is' : 'are'} running.`,
    blocked === 0 ? 'Nothing was blocked today.' : `${plural(blocked, 'attempt')} ${blocked === 1 ? 'was' : 'were'} blocked today.`,
  ].join(' ');
  return (
    <section class="greeting">
      <h1>
        Good {part}, {OWNER}.
      </h1>
      <p>{b.down ? 'The box is out of reach. This screen catches up when it is back.' : line}</p>
    </section>
  );
}

function Widgets() {
  const b = useBox();
  const asks = pending();
  const runningTasks = ofState('running', 'queued');
  const resumed = welcome()?.tasks;
  const layers = ofState('done').length;
  return (
    <section class="widgets" aria-label="Right now">
      <a class="widget widget-needs" href="#tasks/waiting">
        <span class="widget-count">
          <b class={asks.length ? 'amber' : ''}>{asks.length}</b>
          <span>need your OK</span>
        </span>
        <span class="desk-only widget-lines">
          {asks.length === 0 && <span class="widget-line">Nothing is waiting for you.</span>}
          {asks.slice(0, 3).map((a) => (
            <span class="widget-line" key={a.id}>
              {taskTitle(a.task)}: {a.costCents ? `spend ${dollars(a.costCents)}` : a.question}
            </span>
          ))}
        </span>
        <span class="phone-only widget-line">{dollars(b.today.cents)} spent today</span>
      </a>
      <a class="widget widget-running" href="#tasks/running">
        <span class="widget-count">
          <b>{runningTasks.length}</b>
          <span>{resumed?.length ? 'resumed' : 'running'}</span>
        </span>
        {runningTasks.length === 0 && <span class="widget-line">Nothing is running right now.</span>}
        {runningTasks.slice(0, 2).map((t) => (
          <span class="widget-task" key={t.id}>
            <span class="widget-line">
              {t.title}
              <span class="desk-only">{resumed?.includes(t.id) ? ' · resumed' : t.step ? ` · ${t.step}` : ''}</span>
            </span>
            <span class="bar" aria-hidden="true">
              <span />
            </span>
          </span>
        ))}
      </a>
      <a class="widget widget-small desk-only" href="#activity">
        <span class="widget-line">Spent today</span>
        <b class="widget-value">{dollars(b.today.cents)}</b>
        <span class="widget-line">on tools and models</span>
      </a>
      <a class="widget widget-small desk-only" href="#time-machine">
        <span class="widget-line">Time Machine</span>
        <b class="widget-value">{plural(layers, 'layer')}</b>
        <span class="widget-line">Undo any task on its own</span>
      </a>
    </section>
  );
}

function AppIcon({ app, size, apps }: { app: AppDef; size: 'grid' | 'dock'; apps: AppDef[] }) {
  const n = size === 'grid' ? badge(app, apps) : 0;
  const label = `${app.title}${n ? `, ${plural(n, 'request')} waiting` : ''}${size === 'dock' && running(app) ? ', running' : ''}`;
  return (
    <a class={`app app-${size}`} href={app.hash} aria-label={label}>
      <span class="app-icon">
        <span class="app-tile">
          <Glyph name={app.glyph} title={app.title} />
        </span>
        {n > 0 && <span class="badge">{n}</span>}
      </span>
      {size === 'grid' ? (
        <span class="app-label">
          <span class={app.short ? 'desk-only' : ''}>{app.title}</span>
          {app.short && <span class="phone-only">{app.short}</span>}
        </span>
      ) : (
        <span class={`dot${running(app) ? ' dot-on' : ''}`} />
      )}
    </a>
  );
}

/** Greeting, widgets and the app grid. Hidden from keyboard and screen readers while a window covers it. */
export function Desktop({ covered }: { covered: boolean }) {
  useBox();
  const apps = appList();
  return (
    <main class="desktop" inert={covered}>
      <Greeting />
      <Widgets />
      <span class="desktop-gap" aria-hidden="true" />
      <nav class="grid" aria-label="Apps">
        {apps.map((a) => (
          <AppIcon app={a} size="grid" apps={apps} key={a.id} />
        ))}
      </nav>
    </main>
  );
}

/** Apps, a divider, then the boxes. A dot under an app means it has a running task; under a box, it's this one. */
export function Dock() {
  useBox();
  const apps = appList();
  const phone = [apps[0], apps[1], ...apps.filter((a) => a.track).slice(0, 2)];
  return (
    <nav class="dock" aria-label="Dock">
      {apps.map((a) => (
        <span class={phone.includes(a) ? 'dock-item' : 'dock-item desk-only'} key={a.id}>
          <AppIcon app={a} size="dock" apps={apps} />
        </span>
      ))}
      <span class="dock-divider desk-only" aria-hidden="true" />
      {boxList().map((x) => (
        <a
          class="app app-dock dock-box desk-only"
          key={x.id}
          href={x.self ? '#settings' : x.url}
          aria-disabled={!x.self && !x.url}
          aria-label={`${x.name}${x.self ? ', this box' : x.url ? '' : ', no address yet'}`}
          title={!x.self && !x.url ? 'This box has no address yet' : undefined}
        >
          <span class="app-icon">
            <span class="app-tile">
              <Glyph name="box" />
            </span>
          </span>
          <span class="dock-box-name">{x.name}</span>
          <span class={`dot${x.self ? ' dot-on' : ''}`} />
        </a>
      ))}
    </nav>
  );
}

// ---------- notifications ----------

const hidden = new Set<string>();
const hide = (id: string) => () => {
  hidden.add(id);
  changed();
};

interface Notice {
  id: string;
  at: number;
  waiting: boolean;
  render: (flat: boolean, onHide?: () => void) => preact.JSX.Element;
}

/** Everything Notification Center lists: approvals waiting, then blocked attempts and restarts, newest first. */
function notices(): Notice[] {
  const out: Notice[] = [];
  for (const a of pending()) {
    const at = askedAt(a.id);
    out.push({ id: a.id, at, waiting: true, render: (flat, onHide) => <ApprovalBanner a={a} at={at} flat={flat} onHide={onHide} key={a.id} /> });
  }
  const blocked = new Map<string, { hosts: Set<string>; at: string }>();
  for (const e of box.events) {
    if (e.type !== 'net.blocked') continue;
    const g = blocked.get(e.task) ?? { hosts: new Set(), at: e.at };
    g.hosts.add(e.host);
    g.at = e.at;
    blocked.set(e.task, g);
  }
  for (const [task, g] of blocked) {
    const t = box.tasks.get(task);
    const allowed = t?.hosts.length ? `It may only reach ${t.hosts.join(', ')}` : 'It may not reach any host';
    const id = `blocked-${task}`;
    out.push({
      id,
      at: Date.parse(g.at),
      waiting: false,
      render: (flat, onHide) => (
        <Banner
          key={id}
          kind="blocked"
          glyph="tasks"
          kicker={`BLOCKED · ${taskTitle(task).toUpperCase()}`}
          meta={`${ago(g.at)} · task ${task}`}
          body={`It tried to reach ${[...g.hosts].join(', ')}. ${allowed}, so the box stopped it and wrote it in the log. It never held a key to send.`}
          open={`#task/${task}`}
          flat={flat}
          onHide={onHide}
        >
          <a class="btn btn-secondary" href={`#task/${task}`}>
            Open the task
          </a>
          {t && t.state !== 'undone' && (
            <button class="btn btn-danger" onClick={() => undo(task).catch(() => {})}>
              Undo this task
            </button>
          )}
        </Banner>
      ),
    });
  }
  const r = box.restored;
  if (r) {
    const id = `restored-${r.at}`;
    const waiting = pending().length;
    out.push({
      id,
      at: r.at,
      waiting: false,
      render: (flat, onHide) => (
        <Banner
          key={id}
          kind="info"
          glyph="box"
          kicker={r.restarted ? 'RESTORED AFTER A POWER CUT' : 'BACK IN REACH'}
          meta={`${ago(r.at)} · ${r.restarted ? `booted ${hhmm(r.at)}` : 'the box was out of reach'}`}
          body={`${plural(r.tasks.length, 'task')} picked up where ${r.tasks.length === 1 ? 'it' : 'they'} stopped: ${r.tasks.map((id) => taskTitle(id)).join(', ')}.${
            waiting ? ` ${waiting === 1 ? '1 approval is' : `${waiting} approvals are`} still waiting.` : ''
          } Nothing was paid twice.`}
          open="#tasks/running"
          flat={flat}
          onHide={onHide}
        >
          <a class="btn btn-secondary" href="#tasks/running">
            Show what resumed
          </a>
        </Banner>
      ),
    });
  }
  return out.sort((x, y) => y.at - x.at);
}

/** The newest notification floats on the desktop. Blocked attempts and restarts leave after a few minutes. */
export function Banners() {
  useBox();
  const now = useNow(10_000);
  const top = ui.notifications ? undefined : notices().find((n) => !hidden.has(n.id) && (n.waiting || now - n.at < FRESH_MS));
  return (
    <div class="banners" role="region" aria-label="Newest notification" aria-live="polite">
      {top?.render(false, hide(top.id))}
    </div>
  );
}

export function NotificationCenter() {
  useBox();
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && toggleNotifications(false);
    addEventListener('keydown', esc);
    return () => removeEventListener('keydown', esc);
  }, []);
  const all = notices();
  const waiting = all.filter((n) => n.waiting);
  const earlier = all.filter((n) => !n.waiting);
  return (
    <aside class="nc" aria-labelledby="nc-title">
      <div class="nc-head">
        <h2 id="nc-title">Notifications</h2>
        <span class="nc-note">{waiting.length ? `${waiting.length} waiting · first answer wins` : 'nothing waiting'}</span>
        <button class="window-close" aria-label="Close notifications" onClick={() => toggleNotifications(false)}>
          <CloseIcon />
        </button>
      </div>
      {waiting.length > 0 && <h3 class="nc-section">Waiting for you</h3>}
      {waiting.map((n) => n.render(true))}
      {earlier.length > 0 && <h3 class="nc-section">Earlier</h3>}
      {earlier.map((n) => n.render(true))}
      {all.length === 0 && <p class="nc-empty">Nothing needs you. Requests for your OK, blocked attempts and restarts show up here.</p>}
    </aside>
  );
}
