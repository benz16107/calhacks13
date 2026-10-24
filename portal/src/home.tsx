// The home screen (Figma direction A, box 16:20 and phone 17:25): menu bar, greeting, widgets, app grid, dock,
// and the banners that float over everything: approvals, blocked attempts, and the session restore after a power cut.
import { useEffect, useState } from 'preact/hooks';
import { box, changed, undo, useBox, type Task } from './live.ts';
import { AnswerButtons, Glyph, ago, clock, dollars, plural, taskTitle, trackOf } from './ui.tsx';

/** The box's owner, for the greeting. */
const OWNER = 'Ben';

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
      glyph: a.name in GLYPH_NAMES ? a.name : a.track,
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
const GLYPH_NAMES = { shopper: 1, wallet: 1, find: 1, 'credit-desk': 1 };

const pending = () => [...box.approvals.values()].filter((a) => a.state === 'pending');
const ofState = (...states: Task['state'][]) => [...box.tasks.values()].filter((t) => states.includes(t.state));

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

function useNow(ms: number) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

function MenuBar() {
  const now = useNow(15_000);
  const b = useBox();
  const up = b.health?.startedAt ? ` · up ${uptime(now - Date.parse(b.health.startedAt))}` : '';
  const name = ['127.0.0.1', 'localhost'].includes(location.hostname) ? 'this box' : location.hostname;
  const runningNow = ofState('running').length;
  const d = new Date(now);
  return (
    <header class="menubar">
      <div class="menubar-group">
        <span class="menubar-name">Box</span>
        <a class="menubar-box" href="#settings" title="Boxes and pairing">
          {name} · {b.live === 'offline' ? 'out of reach' : 'online'}
          {up}
        </a>
      </div>
      <div class="menubar-group">
        <span class="menubar-quiet">{runningNow} running</span>
        <time class="menubar-clock" dateTime={d.toISOString()}>
          {d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).replace(',', '')}
          {'  '}
          {d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
        </time>
      </div>
    </header>
  );
}
function uptime(ms: number) {
  const m = Math.floor(ms / 60_000);
  return m < 60 ? `${m} m` : `${Math.floor(m / 60)} h ${m % 60} m`;
}

function Greeting() {
  const b = useBox();
  const hour = new Date().getHours();
  const part = hour < 5 ? 'evening' : hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
  const n = pending().length;
  const r = ofState('running').length;
  const blocked = b.today.blocked;
  const line = [
    n === 0 ? 'Nothing needs your OK.' : `${plural(n, 'task')} ${n === 1 ? 'needs' : 'need'} your OK.`,
    r === 0 ? 'Nothing else is running.' : `${r} ${r === 1 ? 'is' : 'are'} running.`,
    blocked === 0 ? 'Nothing was blocked today.' : `${plural(blocked, 'connection')} ${blocked === 1 ? 'was' : 'were'} blocked today.`,
  ].join(' ');
  return (
    <section class="greeting">
      <h1>
        Good {part}, {OWNER}.
      </h1>
      <p>{b.live === 'offline' ? 'The box is out of reach. This screen will catch up when it is back.' : line}</p>
    </section>
  );
}

function Widgets() {
  const b = useBox();
  const asks = pending();
  const runningTasks = ofState('running', 'queued');
  const layers = ofState('done').length;
  return (
    <section class="widgets" aria-label="Right now">
      <a class="widget widget-needs" href="#tasks/need">
        <span class="widget-head">
          <b class={`widget-big${asks.length ? ' amber' : ''}`}>{asks.length}</b>
          <span class="widget-title">need your OK</span>
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
        <span class="widget-head">
          <b class="widget-big">{runningTasks.length}</b>
          <span class="widget-title">running</span>
        </span>
        {runningTasks.length === 0 && <span class="widget-line">Nothing is running right now.</span>}
        {runningTasks.slice(0, 2).map((t) => (
          <span class="widget-task" key={t.id}>
            <span class="widget-line">
              {t.title}
              <span class="desk-only">{t.step ? ` · ${t.step}` : ''}</span>
            </span>
            <span class="bar" aria-hidden="true">
              <span />
            </span>
          </span>
        ))}
      </a>
      <a class="widget widget-small desk-only" href="#activity">
        <span class="widget-line">Spent today</span>
        <b class="widget-big">{dollars(b.today.cents)}</b>
        <span class="widget-line">on tools and models</span>
      </a>
      <a class="widget widget-small desk-only" href="#time-machine">
        <span class="widget-line">Time Machine</span>
        <b class="widget-big">{plural(layers, 'layer')}</b>
        <span class="widget-line">Undo any task, one at a time</span>
      </a>
    </section>
  );
}

function AppIcon({ app, size, apps }: { app: AppDef; size: 'grid' | 'dock'; apps: AppDef[] }) {
  const n = size === 'grid' ? badge(app, apps) : 0;
  const label = `${app.title}${n ? `, ${plural(n, 'approval')} waiting` : ''}`;
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

export function Home() {
  useBox();
  const apps = appList();
  const tracks = apps.filter((a) => a.track);
  const dock = [apps[0], apps[1], apps[2], ...tracks.slice(0, 3)];
  return (
    <>
      <MenuBar />
      <main class="home-main">
        <Greeting />
        <Widgets />
        <nav class="grid" aria-label="Apps">
          {apps.map((a) => (
            <AppIcon app={a} size="grid" apps={apps} key={a.id} />
          ))}
        </nav>
      </main>
      <nav class="dock" aria-label="Dock">
        {dock.map((a, i) => (
          <span class={i === 2 || i > 4 ? 'desk-only' : ''} key={a.id}>
            <AppIcon app={a} size="dock" apps={apps} />
          </span>
        ))}
      </nav>
    </>
  );
}

// ---------- banners ----------

const hidden = new Set<string>();
function hide(id: string) {
  hidden.add(id);
  changed();
}

function Banner(props: { id: string; kicker: string; tone?: 'blocked'; sub: string; text: string; glyph: string; children?: preact.ComponentChildren; open?: string; more?: preact.JSX.Element }) {
  return (
    <section class={`banner${props.tone ? ` banner-${props.tone}` : ''}`} aria-labelledby={`${props.id}-k`}>
      <div class="banner-head">
        <span class="banner-icon" aria-hidden="true">
          <Glyph name={props.glyph} />
        </span>
        <span class="banner-meta">
          <span class="banner-kicker" id={`${props.id}-k`}>
            {props.kicker}
          </span>
          <span class="banner-sub">{props.sub}</span>
        </span>
        {props.more}
        <button class="banner-hide" aria-label="Hide for now" onClick={() => hide(props.id)}>
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
          </svg>
        </button>
      </div>
      {props.open ? (
        <a class="banner-text" href={props.open}>
          {props.text}
        </a>
      ) : (
        <p class="banner-text">{props.text}</p>
      )}
      {props.children}
    </section>
  );
}

function askedAt(id: string) {
  const e = box.events.findLast((e) => e.type === 'approval.asked' && e.approval.id === id);
  return e ? Date.parse(e.at) : 0;
}
/** Blocked and restore banners leave by themselves after a while; nobody dismisses them on the box's screen. */
const FRESH_MS = 5 * 60_000;

/** The newest notification on top, one at a time so the home screen stays readable. The rest wait behind a button. */
export function Banners() {
  const b = useBox();
  const now = useNow(10_000);
  const [all, setAll] = useState(false);
  const items: { at: number; node: (more?: preact.JSX.Element) => preact.JSX.Element }[] = [];

  const r = b.restored && !hidden.has(`restored-${b.restored.at}`) && now - b.restored.at < FRESH_MS ? b.restored : undefined;
  if (r) {
    items.push({
      at: r.at,
      node: (more) => (
        <Banner
          more={more}
          id={`restored-${r.at}`}
          key="restored"
          glyph="time-machine"
          kicker="THE BOX IS BACK"
          sub={r.restarted ? `restarted at ${clock(r.at)}` : 'back in reach'}
          text={`${r.restarted ? 'It lost power and started again.' : 'It was out of reach for a moment.'} ${plural(r.tasks.length, 'task')} picked up where ${r.tasks.length === 1 ? 'it' : 'they'} left off: ${r.tasks.map((id) => taskTitle(id)).join(', ')}.`}
          open="#tasks"
        >
          <div class="answer">
            <a class="btn btn-primary" href="#tasks">
              See tasks
            </a>
          </div>
        </Banner>
      ),
    });
  }

  const blockedByTask = new Map<string, { hosts: Set<string>; at: string }>();
  for (const e of b.blockedLive) {
    if (e.type !== 'net.blocked' || hidden.has(`blocked-${e.task}`) || now - Date.parse(e.at) > FRESH_MS) continue;
    const g = blockedByTask.get(e.task) ?? { hosts: new Set(), at: e.at };
    g.hosts.add(e.host);
    g.at = e.at;
    blockedByTask.set(e.task, g);
  }
  for (const [task, g] of blockedByTask) {
    const t = box.tasks.get(task);
    const allowed = t?.hosts.length ? `It may only reach ${t.hosts.join(', ')}` : 'It may not reach any host';
    items.push({
      at: Date.parse(g.at),
      node: (more) => (
        <Banner
          more={more}
          id={`blocked-${task}`}
          key={`blocked-${task}`}
          tone="blocked"
          glyph="tasks"
          kicker={`BLOCKED · ${taskTitle(task).toUpperCase()}`}
          sub={`${ago(g.at)} · task ${task}`}
          text={`It tried to reach ${[...g.hosts].join(', ')}. ${allowed}, so the box stopped it and wrote it in the log. No key left the box.`}
          open={`#task/${task}`}
        >
          <div class="answer">
            <a class="btn btn-primary" href={`#task/${task}`}>
              See what it did
            </a>
            {t && t.state !== 'undone' && (
              <button class="btn btn-danger" onClick={() => undo(task).catch(() => {})}>
                Undo this task
              </button>
            )}
          </div>
        </Banner>
      ),
    });
  }

  for (const a of pending()) {
    if (hidden.has(a.id)) continue;
    const at = askedAt(a.id);
    items.push({
      at,
      node: (more) => (
        <Banner
          more={more}
          id={a.id}
          key={a.id}
          glyph="tasks"
          kicker={`${taskTitle(a.task).toUpperCase()} WANTS YOUR OK`}
          sub={`${at ? ago(at) : 'waiting'} · task ${a.task}`}
          text={a.question}
          open={`#task/${a.task}`}
        >
          <AnswerButtons a={a} />
        </Banner>
      ),
    });
  }

  items.sort((x, y) => y.at - x.at);
  const more =
    items.length > 1 ? (
      <button class="banner-more" aria-expanded={all} aria-label={all ? 'Show only the newest' : `Show ${plural(items.length - 1, 'more notification')}`} onClick={() => setAll(!all)}>
        {all ? 'Fewer' : `+${items.length - 1}`}
      </button>
    ) : undefined;
  return (
    <div class="banners" role="region" aria-label="Notifications" aria-live="polite">
      {(all ? items : items.slice(0, 1)).map((i, n) => i.node(n === 0 ? more : undefined))}
    </div>
  );
}
