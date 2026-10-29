// The desktop shell (docs/figma/os-v2, "Desktop"): the top bar, the desktop's widgets, the dock, Show Apps,
// Notification Center, Control Center, banners, the lock screen and the boot screen. On a phone: the home screen
// and the tab bar. The wallpaper is the page's background.
import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { addMachine, api, box, changed, hosted, machine, machines, pairing, patchSettings, setPairing, signIn, signedIn, surface, switchMachine, undo, useBox, type Approval, type Pairing } from './live.ts';
import { AddToHomeScreen, InstallCard, ios, standalone } from './pwa/pwa.tsx';
import { NotificationsCard, forget } from './apps/remote.tsx';
import { openMachines } from './apps/machines.tsx';
import { FolderReview } from './apps/folders.tsx';
import { AnswerButtons } from './apps/answer.tsx';
import { Avatar, WaitingList, askInfo } from './apps/business.tsx';
import { Alert, AppIcon, Badge, Button, Icon, Menu, Popover, Progress, Switch } from './kit/ui.tsx';
import { focus, focused, minimize, open, phone, wm } from './wm.tsx';
import { launchable, type Launchable } from './apps/index.tsx';
import { PRODUCT } from './product.ts';
import { RELAY, RELAY_HOST, onRelay, useRelayUp } from './relay.ts';
import { appOf, asks, boxList, dollars, hhmm, ofState, pending, plural, selfBox, taskTitle, testMoney, trackOf, useNow, zone, spentToday } from './util.ts';

/** Which shell overlay is open. One at a time, like a real desktop. */
export const shell = { open: '' as '' | 'notifications' | 'control' | 'apps' | 'menu' | 'boxes' | 'person', locked: false };
export const toggle = (what: typeof shell.open) => ((shell.open = shell.open === what ? '' : what), changed());
export const lock = () => ((shell.open = ''), (shell.locked = true), changed());

/** Local accessibility choices, kept on this screen: Larger text, High contrast, Reduce motion. */
export const access = {
  get: (k: 'larger-text' | 'contrast' | 'reduce-motion') => localStorage.getItem(`gurtos.${k}`) === '1',
  set(k: 'larger-text' | 'contrast' | 'reduce-motion', on: boolean) {
    localStorage.setItem(`gurtos.${k}`, on ? '1' : '0');
    access.apply();
    changed();
  },
  apply() {
    const d = document.documentElement.dataset;
    if (access.get('larger-text')) d.largerText = '';
    else delete d.largerText;
    if (access.get('contrast')) d.contrast = 'high';
    else delete d.contrast;
    if (access.get('reduce-motion')) d.reduceMotion = '';
    else delete d.reduceMotion;
  },
};

const dateOf = (t: number, long = false) =>
  new Date(t).toLocaleDateString('en-US', long ? { weekday: 'long', month: 'long', day: 'numeric', ...zone() } : { weekday: 'short', month: 'short', day: 'numeric', ...zone() }).replace(',', long ? ',' : '');
const hourOf = (t: number) => +new Date(t).toLocaleTimeString('en-GB', { hour: '2-digit', hour12: false, ...zone() }).slice(0, 2);
/** A greeting with no name in it: setup doesn't ask for one. */
const greeting = (t: number) => (hourOf(t) < 5 ? 'Good night' : hourOf(t) < 12 ? 'Good morning' : hourOf(t) < 18 ? 'Good afternoon' : 'Good evening');
const short = (s: string, n = 32) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
const askLine = (a: Approval) => `${short(taskTitle(a.task), 26)}${a.costCents ? `: ${dollars(a.costCents)}` : ''}`;

// ---------- the top bar ----------

function TopButton({ id, label, children, onClick, pill, expanded }: { id?: string; label?: string; children: ComponentChildren; onClick: (e: Event) => void; pill?: boolean; expanded?: boolean }) {
  return (
    <button type="button" id={id} class={`gos-tb${pill ? ' gos-tb-pill' : ''}`} aria-label={label} aria-expanded={expanded} onClick={onClick}>
      {children}
    </button>
  );
}

export function TopBar() {
  const b = useBox();
  const now = useNow(10_000);
  const need = pending().length;
  const running = ofState('running').length;
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const pop = (what: typeof shell.open) => (e: Event) => (setAnchor(e.currentTarget as HTMLElement), toggle(what));
  return (
    <header class="gos-topbar" role="banner">
      <div class="gos-tb-group">
        <TopButton label={`${PRODUCT} menu`} onClick={pop('menu')} expanded={shell.open === 'menu'}>
          <span class="gos-wordmark" aria-hidden="true">
            {PRODUCT}
          </span>
        </TopButton>
        <TopButton pill label={`Computer: ${b.business.company || selfBox().name}. Switch computer`} onClick={pop('boxes')} expanded={shell.open === 'boxes'}>
          <Icon name="computer" />
          <span>{b.business.company || selfBox().name}</span>
          <Icon name="pan-down" />
        </TopButton>
      </div>
      <TopButton label={`${dateOf(now)} ${hhmm(now)}. Notifications`} onClick={pop('notifications')} expanded={shell.open === 'notifications'}>
        <span class="gos-tb-clock">
          {dateOf(now)}
          {'  '}
          {hhmm(now)}
        </span>
      </TopButton>
      <div class="gos-tb-group gos-tb-end">
        {b.down ? (
          <span class="gos-tb-note" role="status">
            <Icon name="network-offline" /> Out of reach
          </span>
        ) : (
          need > 0 && (
            <TopButton label={`${need} ${need === 1 ? 'needs' : 'need'} you`} onClick={pop('notifications')}>
              <Badge>{need}</Badge>
              <span>{need === 1 ? 'needs' : 'need'} you</span>
            </TopButton>
          )
        )}
        {pausedNow() ? (
          <TopButton label={`All agents paused by ${pausedNow()!.by}. Open the kill switch`} onClick={pop('control')}>
            <Icon name="media-playback-pause" />
            <span class="gos-tb-paused">All paused</span>
          </TopButton>
        ) : (
          <TopButton label={`${running} running. Open Tasks`} onClick={() => open('tasks/running')}>
            <Icon name="media-playback-start" />
            <span class="gos-tb-quiet">{running} running</span>
          </TopButton>
        )}
        {b.business.on && <PersonChip pop={pop('person')} />}
        <TopButton label="System menu" onClick={pop('control')} expanded={shell.open === 'control'}>
          <Icon name={b.system?.network.online === false || b.down ? 'network-offline' : 'network-wired'} />
          <Icon name="system-shutdown" />
        </TopButton>
      </div>
      {shell.open === 'menu' && (
        <Popover anchor={anchor} onClose={() => toggle('menu')} label={`${PRODUCT} menu`}>
          <Menu
            label={`${PRODUCT} menu`}
            onClose={() => toggle('menu')}
            items={[
              { label: `About ${PRODUCT}`, icon: 'help-about', run: () => open('settings/about') },
              { label: 'Settings', icon: 'emblem-system', run: () => open('settings') },
              { label: 'App Center', icon: 'preferences-desktop-apps', run: () => open('app-center') },
              'sep',
              { label: 'Lock screen', icon: 'system-lock-screen', run: lock },
              ...(b.owner ? (['sep', { label: 'Run setup again', icon: 'document-edit', run: () => void api('POST', '/setup/reopen').then(() => location.reload()) }] as const) : []),
            ]}
          />
        </Popover>
      )}
      {shell.open === 'boxes' && <BoxMenu anchor={anchor} />}
      {shell.open === 'notifications' && <NotificationCenter anchor={anchor} />}
      {shell.open === 'control' && <ControlCenter anchor={anchor} />}
      {shell.open === 'person' && <PersonMenu anchor={anchor} />}
    </header>
  );
}

const editionName = (e?: string) => (e ? `${PRODUCT} ${e[0].toUpperCase()}${e.slice(1)}` : PRODUCT);
/** app.gurtos.com: every paired machine, then Add and Forget. */
function machineItems() {
  const now = machine();
  return [
    ...machines().map((m) => ({
      label: `${m.box.name} · ${editionName(m.edition)}`,
      icon: m === now || m.box.id === now?.box.id ? 'object-select' : 'computer',
      run: () => (m.box.id === now?.box.id ? undefined : switchMachine(m.box.id)),
    })),
    'sep' as const,
    { label: 'Add a computer…', icon: 'list-add', run: () => location.assign('/pair') },
    ...(now
      ? [{ label: `Forget ${now.box.name}…`, icon: 'user-trash', destructive: true, run: () => confirm(`Forget ${now.box.name} on this device? It stops sending this device notifications, and it needs a new code to pair again.`) && void forget(now).then(() => (setPairing(undefined), location.replace('/'))) }]
      : []),
  ];
}

const roleWord = (p: { title?: string; role: string }) => p.title || p.role[0].toUpperCase() + p.role.slice(1);

/** GurtOS Business: who is signed in on this screen (docs/figma/business/1a-people.png, top right). */
function PersonChip({ pop }: { pop: (e: Event) => void }) {
  const p = box.business.me?.person;
  return (
    <TopButton pill label={p ? `Signed in as ${p.name}, ${roleWord(p)}. Change` : 'Sign in as a person'} onClick={pop} expanded={shell.open === 'person'}>
      {p ? <Avatar name={p.name} size={20} /> : <Icon name="avatar-default" />}
      <span>{p ? `${p.name} · ${roleWord(p)}` : 'Sign in'}</span>
    </TopButton>
  );
}

/**
 * On the box's own screen, pick who is using it; requests, rights and the log follow that person. A paired phone is
 * always the person it was paired for.
 */
function PersonMenu({ anchor }: { anchor: HTMLElement | null }) {
  const b = useBox();
  const me = b.business.me;
  const close = () => toggle('person');
  const items = pairing()
    ? [{ label: `This phone is paired to ${me?.person?.name ?? 'nobody'}`, icon: 'phone', disabled: true, run: () => {} }]
    : [
        ...(me?.directory ?? []).map((p) => ({ label: `${p.name} · ${roleWord(p)}`, icon: p.id === signedIn() ? 'object-select' : 'avatar-default', run: () => signIn(p.id) })),
        ...(signedIn() ? (['sep', { label: "Sign out of this screen", icon: 'system-lock-screen', run: () => signIn(undefined) }] as const) : []),
      ];
  return (
    <Popover anchor={anchor} onClose={close} align="end" label="Who is using this screen">
      <Menu label="Who is using this screen" onClose={close} items={[...items, 'sep', { label: 'Waiting for me', icon: 'preferences-system-time', run: () => open('waiting') }]} />
    </Popover>
  );
}

function BoxMenu({ anchor }: { anchor: HTMLElement | null }) {
  const b = useBox();
  return (
    <Popover anchor={anchor} onClose={() => toggle('boxes')} label="Boxes">
      <Menu
        label="Boxes"
        onClose={() => toggle('boxes')}
        items={[
          ...(hosted ? machineItems() : []),
          ...(hosted ? [] : boxList()).map((x) => ({
            label: x.self ? `${x.name} (this computer)` : x.name,
            icon: x.self ? 'object-select' : 'computer',
            disabled: !x.self && !x.url,
            run: () => (x.self ? undefined : x.url && (location.href = x.url)),
          })),
          ...(b.owner ? (['sep', { label: 'Pair a phone…', icon: 'phone', run: () => open('settings/devices') }] as const) : []),
        ]}
      />
    </Popover>
  );
}

// ---------- notifications ----------

interface Notice {
  id: string;
  at: number;
  /** A request for your OK, with its buttons. Shown before every notice. */
  ask?: Approval;
  app: string;
  appTitle: string;
  title: string;
  body: string;
  /** In Notification Center only, never a banner (a blocked attempt on a task that was undone since). */
  quiet?: boolean;
  actions?: ComponentChildren;
  open: () => void;
}

const appFor = (task: string) => {
  const t = box.tasks.get(task);
  return t ? appOf(t) : { id: 'tasks', title: 'Tasks' };
};

/** Requests that need an answer, newest first. A request just answered stays in place for a moment. */
function askNotices(): Notice[] {
  return asks()
    .map((a): Notice => {
      const app = appFor(a.task);
      return {
        id: a.id,
        at: askedAt(a.id),
        ask: a,
        app: app.id,
        appTitle: app.title,
        title: a.costCents ? `${taskTitle(a.task)} needs you` : a.question,
        body: a.costCents ? `${a.question}${testMoney(box.tasks.get(a.task)) && !/\btest\b/i.test(a.question) ? ' Test money.' : ''}` : `${taskTitle(a.task)} asks. Other tasks keep running.`,
        open: () => open(box.business.on ? `request/${a.id}` : `task/${a.task}`),
        ...(box.business.on ? { title: askInfo(a).fraud ? `Fraud flag on ${askInfo(a).title}` : `${askInfo(a).title} needs you`, body: a.route?.why ?? a.question } : {}),
      };
    })
    .sort((x, y) => y.at - x.at);
}
const askedAt = (id: string) => {
  const e = box.events.findLast((e) => e.type === 'approval.asked' && e.approval.id === id);
  return e ? Date.parse(e.at) : Date.now();
};

/** What happened: blocked attempts (one per task), the last restart, and tasks that finished in the last day. */
function newsNotices(): Notice[] {
  const out: Notice[] = [];
  const blocked = new Map<string, { hosts: Set<string>; at: string; n: number }>();
  for (const e of box.events) {
    if (e.type !== 'net.blocked') continue;
    const g = blocked.get(e.task) ?? { hosts: new Set(), at: e.at, n: 0 };
    g.hosts.add(e.host.replace(/:\d+$/, ''));
    g.at = e.at;
    g.n++;
    blocked.set(e.task, g);
  }
  for (const [task, g] of blocked) {
    const t = box.tasks.get(task);
    const app = appFor(task);
    const undone = t?.state === 'undone';
    out.push({
      id: `blocked-${task}`,
      at: Date.parse(g.at),
      app: app.id,
      appTitle: app.title,
      title: g.n === 1 ? 'An attempt was blocked' : `${g.n} attempts blocked`,
      body: `${taskTitle(task)} tried to reach ${[...g.hosts].join(', ')}. ${t?.hosts.length ? `It may only reach ${t.hosts.join(', ')}.` : 'It may not reach any host.'} It never held a key.${undone ? ` It was undone at ${hhmm(t.updatedAt)}.` : ''}`,
      quiet: undone,
      open: () => open(`task/${task}`),
      actions: !undone && t && (
        <>
          <Button onClick={() => open(`task/${task}`)}>Open task</Button>
          <Button kind="destructive" onClick={() => void undo(task)}>
            Undo task
          </Button>
        </>
      ),
    });
  }
  // GurtOS Business: the kill switch, pulled or let go.
  const sw = box.events.findLast((e) => e.type === 'note' && e.track === 'kill-switch');
  if (sw?.type === 'note') {
    const d = sw.data as { paused: boolean; by: string; via?: string };
    out.push({
      id: `kill-${sw.seq}`,
      at: Date.parse(sw.at),
      app: 'settings',
      appTitle: PRODUCT,
      title: d.paused ? `All agents paused by ${d.by}` : `Agents resumed by ${d.by}`,
      body: d.paused ? `${d.by} used the kill switch${d.via && d.via !== d.by ? ` on ${d.via}` : ''}. Tasks stopped where they were. Only ${resumer()} can resume.` : 'Every task carries on from where it stopped.',
      quiet: !d.paused,
      open: () => toggle('control'),
    });
  }
  const r = box.restored;
  if (r)
    out.push({
      id: `restored-${r.at}`,
      at: r.at,
      app: 'tasks',
      appTitle: PRODUCT,
      title: r.restarted ? 'Back after a restart' : 'Back in reach',
      body: r.tasks.length
        ? `${box.tasks.size} tasks rebuilt from the action log. ${plural(r.tasks.length, 'task')} picked up where ${r.tasks.length === 1 ? 'it' : 'they'} stopped${pending().length ? `. ${pending().length} still ${pending().length === 1 ? 'needs' : 'need'} you` : ''}.`
        : 'Nothing was running, so nothing needed to resume. The action log is complete.',
      open: () => open('tasks/running'),
    });
  const day = Date.now() - 86_400_000;
  for (const t of box.tasks.values()) {
    if ((t.state !== 'done' && t.state !== 'failed') || Date.parse(t.updatedAt) < day) continue;
    const app = appOf(t);
    out.push({
      id: `end-${t.id}`,
      at: Date.parse(t.updatedAt),
      app: app.id,
      appTitle: app.title,
      title: t.state === 'done' ? `${t.title} finished` : `${t.title} failed`,
      body: `${short((t.state === 'done' ? t.summary || t.step : t.error) ?? '', 120)}${t.costCents ? ` ${dollars(t.costCents)}.` : ''}`.trim(),
      quiet: true,
      open: () => open(`task/${t.id}`),
    });
  }
  return out.sort((x, y) => y.at - x.at);
}

function NoticeCard({ n, flat, onHide }: { n: Notice; flat?: boolean; onHide?: () => void }) {
  return (
    <article class={`g-notification gos-note${flat ? ' g-notification-flat' : ''}`} aria-label={n.title}>
      <div class="gos-note-head">
        <AppIcon id={n.app} title={n.appTitle} size={20} />
        <span class="t-caption-strong t-secondary gos-ellipsis">{n.appTitle}</span>
        <span class="t-caption t-secondary gos-note-time">{Date.now() - n.at < 60_000 ? 'now' : hhmm(n.at)}</span>
        {onHide && (
          <button type="button" class="g-icon-btn gos-note-hide" aria-label="Dismiss" title="Dismiss" onClick={onHide}>
            <Icon name="window-close" />
          </button>
        )}
      </div>
      <button type="button" class="gos-plain gos-two" onClick={n.open}>
        <span class="t-heading">{n.title}</span>
        {n.body && <span class="t-body t-secondary">{n.body}</span>}
      </button>
      {(n.ask || n.actions) && <div class="g-notification-actions">{n.ask ? <AnswerButtons a={n.ask} /> : n.actions}</div>}
    </article>
  );
}

const CLEARED = 'gurtos.cleared';
function NotificationCenter({ anchor }: { anchor: HTMLElement | null }) {
  const b = useBox();
  const now = useNow(30_000);
  const [cleared, setCleared] = useState(+(localStorage.getItem(CLEARED) ?? 0));
  const waiting = askNotices();
  const earlier = newsNotices().filter((n) => n.at > cleared);
  const q = b.settings?.quietHours;
  const clear = () => (localStorage.setItem(CLEARED, String(Date.now())), setCleared(Date.now()));
  return (
    <Popover anchor={anchor} onClose={() => toggle('notifications')} align="center" class="gos-nc" label="Notifications">
      <div class="gos-nc-head">
        <h2 class="t-title3">{dateOf(now)}</h2>
        {earlier.length > 0 && (
          <Button kind="flat" onClick={clear}>
            Clear
          </Button>
        )}
      </div>
      <div class="gos-nc-body">
        {waiting.length > 0 && <h3 class="gos-section">Needs you, {waiting.length}</h3>}
        {waiting.map((n) => (
          <NoticeCard n={n} flat key={n.id} />
        ))}
        {earlier.length > 0 && <h3 class="gos-section">Earlier</h3>}
        {earlier.slice(0, 10).map((n) => (
          <NoticeCard n={n} flat key={n.id} />
        ))}
        {waiting.length + earlier.length === 0 && (
          <div class="gos-empty">
            <Icon name="preferences-system-notifications" size={32} />
            <p class="t-body t-secondary">No notifications. Requests, blocked attempts and restarts show up here.</p>
          </div>
        )}
      </div>
      {q && (
        <label class="gos-nc-foot">
          <span class="t-body">Quiet hours</span>
          <span class="t-caption t-secondary">
            {q.from} to {q.to}
          </span>
          <Switch checked={q.enabled} disabled={!b.owner} label="Quiet hours" onChange={(v) => void patchSettings({ quietHours: { enabled: v } })} />
        </label>
      )}
    </Popover>
  );
}

// A request for your OK pops up for 20 seconds, other news for 8. Only what arrives while this screen is open pops up;
// what was there before is in Notification Center and the top bar's count. Requests come before notices.
const dismissed = new Set<string>();
const firstSeen = new Map<string, number>();
const loadedAt = Date.now();
export function Banners() {
  const b = useBox();
  const now = useNow(1000);
  if (shell.open === 'notifications' || shell.locked || b.down) return null;
  const all = [...askNotices(), ...newsNotices().filter((n) => !n.quiet)];
  for (const n of all) if (!firstSeen.has(n.id)) firstSeen.set(n.id, now);
  const fresh = all.filter((n) => {
    const seen = firstSeen.get(n.id)!;
    const arrived = seen > loadedAt + 3000 || n.at > loadedAt - 10_000;
    const answeredHere = n.ask && box.resolved.has(n.ask.id);
    return !dismissed.has(n.id) && arrived && (answeredHere || now - seen < (n.ask ? 20_000 : 8_000));
  });
  // On the phone's home screen the requests are already in front of you.
  const shown = phone() && !wm.wins.some((w) => !w.min) ? fresh.filter((n) => !n.ask) : fresh;
  const top = shown[0];
  if (!top) return null;
  return (
    <div class="gos-banners" role="region" aria-label="Newest notification" aria-live="polite">
      <NoticeCard n={top} onHide={() => (dismissed.add(top.id), changed())} key={top.id} />
      {shown.length > 1 && (
        <button type="button" class="gos-more" onClick={() => toggle('notifications')}>
          {plural(shown.length - 1, 'more notification')}
        </button>
      )}
    </div>
  );
}

// ---------- Control Center ----------

function Tile({ icon, label, sub, on, onClick, disabled }: { icon: string; label: string; sub?: string; on: boolean; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" class="gos-tile" aria-pressed={on} onClick={onClick} disabled={disabled}>
      <Icon name={icon} />
      <span>
        <span class="t-body-strong">{label}</span>
        {sub && <span class="t-caption gos-tile-sub">{sub}</span>}
      </span>
    </button>
  );
}

const uptime = (since: string) => {
  const m = Math.max(0, Math.round((Date.now() - Date.parse(since)) / 60_000));
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`;
};
const progressOf = (step?: string) => {
  const m = step?.match(/(\d+)\s+of\s+(\d+)/i);
  return m && +m[2] > 0 ? Math.min(100, (100 * +m[1]) / +m[2]) : undefined;
};

function ControlCenter({ anchor }: { anchor: HTMLElement | null }) {
  const b = useBox();
  const [error, setError] = useState('');
  const s = b.settings;
  const dark = document.documentElement.dataset.theme === 'dark'; // the style in effect (applyTheme)
  const system = (b.settings?.appearance.theme ?? 'system') === 'system';
  const set = (patch: Record<string, unknown>) => patchSettings(patch).catch((e) => setError((e as Error).message));
  const net = b.system?.network;
  const iface = net?.interfaces.find((i) => !i.address.startsWith('127.') && !i.address.includes(':')) ?? net?.interfaces[0];
  const wifi = iface?.name.startsWith('wl');
  const running = ofState('running');
  return (
    <Popover anchor={anchor} onClose={() => toggle('control')} align="end" class="gos-cc" label="System menu">
      <div class="gos-cc-head">
        <div class="gos-two">
          <span class="t-heading">{b.business.company || selfBox().name}</span>
          <span class="t-caption t-secondary">
            {b.system ? `${b.system.editionName} ${b.system.version} · up ${uptime(b.system.startedAt)}` : PRODUCT}
          </span>
        </div>
        <span class="gos-cc-buttons">
          <button type="button" class="g-icon-btn g-icon-btn-default gos-round" aria-label="Settings" title="Settings" onClick={() => (toggle('control'), open('settings'))}>
            <Icon name="emblem-system" />
          </button>
          <button type="button" class="g-icon-btn g-icon-btn-default gos-round" aria-label="Lock screen" title="Lock screen" onClick={lock}>
            <Icon name="system-lock-screen" />
          </button>
        </span>
      </div>
      <div class="gos-tiles">
        <Tile
          icon={b.down || net?.online === false ? 'network-offline' : wifi ? 'network-wireless-signal-excellent' : 'network-wired'}
          label={wifi ? 'Wi-Fi' : 'Wired'}
          sub={b.down ? 'Out of reach' : net?.online === false ? 'Offline' : iface ? `Connected · ${iface.address}` : 'Connected'}
          on={!b.down && net?.online !== false}
          onClick={() => (toggle('control'), open('settings/general'))}
        />
        <Tile
          icon="weather-clear-night"
          label="Quiet hours"
          sub={s ? `${s.quietHours.from} to ${s.quietHours.to}` : undefined}
          on={!!s?.quietHours.enabled}
          disabled={!b.owner || !s}
          onClick={() => set({ quietHours: { enabled: !s!.quietHours.enabled } })}
        />
        <Tile icon="preferences-desktop-appearance" label="Dark style" sub={`${dark ? 'On' : 'Off'}${system ? ', like the system' : ''}`} on={dark} disabled={!b.owner} onClick={() => set({ appearance: { theme: dark ? 'light' : 'dark' } })} />
        <Tile icon="preferences-desktop-accessibility" label="Larger text" sub="This screen" on={access.get('larger-text')} onClick={() => access.set('larger-text', !access.get('larger-text'))} />
      </div>
      {!b.owner && <p class="t-caption t-secondary">Quiet hours and Dark style change from this computer's own screen or the owner's phone.</p>}
      {error && (
        <p class="gos-error" role="alert">
          {error}
        </p>
      )}
      <div class="gos-cc-running">
        <h3 class="t-caption-strong t-secondary">{running.length ? 'Running now' : 'Nothing running'}</h3>
        {running.slice(0, 4).map((t) => {
          const app = appOf(t);
          const p = progressOf(t.step);
          return (
            <button type="button" class="gos-plain gos-cc-task" onClick={() => (toggle('control'), open(`task/${t.id}`))} key={t.id}>
              <AppIcon id={app.id} title={app.title} size={28} />
              <span class="gos-cc-task-text">
                <span class="gos-cc-task-line">
                  <span class="t-body-strong gos-ellipsis">{t.title}</span>
                  <span class="t-caption t-secondary gos-ellipsis">{p !== undefined ? t.step!.match(/\w+\s+\d+\s+of\s+\d+/i)?.[0] : ''}</span>
                </span>
                <Progress value={p} label={`${t.title} progress`} />
              </span>
            </button>
          );
        })}
      </div>
      {(b.business.on || b.owner) && <KillSwitchCard />}
    </Popover>
  );
}

/** The kill switch's state on any edition: Business says who pulled it; elsewhere GET /api/system does. */
export const pausedNow = () => {
  const p = box.business.me?.paused ?? (box.system?.paused?.paused ? box.system.paused : null);
  return p ? { by: p.by ?? 'the owner', at: p.at ?? '', via: p.via ?? undefined } : null;
};
/** Who may resume: an IT admin on GurtOS Business, the owner elsewhere. */
const resumer = () => (box.business.on ? 'an IT admin' : 'the owner');

/** Who may pull the kill switch: an admin or the owner. */
export const mayPause = () => box.owner || ['admin', 'owner'].includes(box.business.me?.person?.role ?? '');
/** The tasks a pause stops: everything still going. */
export const stoppable = () => ofState('running', 'waiting', 'queued');

/** GurtOS Business: the kill switch in Control Center, with its alert (docs/figma/business/5a-kill-switch-box.png). */
function KillSwitchCard() {
  const b = useBox();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const paused = pausedNow();
  const company = b.business.company || selfBox().name;
  const go = async (what: 'pause' | 'resume') => {
    setBusy(true);
    setError('');
    try {
      await api('POST', `/${what}`);
      setConfirm(false);
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  };
  return (
    <div class={`gos-kill${paused ? ' is-paused' : ''}`}>
      <div class="gos-two gos-grow">
        <span class="t-body-strong gos-kill-title">{paused ? 'All agents are paused' : 'Kill switch'}</span>
        <span class="t-caption">
          {paused ? `${paused.by} paused them at ${hhmm(paused.at)}. Requests that need you stay open.` : `${b.business.on ? 'IT admins only' : 'Owner only'}. Stops every agent at once.`}
        </span>
        {!mayPause() && <span class="t-caption t-secondary">Only {resumer()} can {paused ? 'resume' : 'pause'} the agents.</span>}
        {error && (
          <span class="gos-error" role="alert">
            {error}
          </span>
        )}
      </div>
      {paused ? (
        <Button kind="suggested" disabled={!mayPause() || busy} onClick={() => void go('resume')}>
          Resume all agents
        </Button>
      ) : (
        <Button kind="destructive" disabled={!mayPause() || busy} onClick={() => setConfirm(true)}>
          Pause all agents
        </Button>
      )}
      {confirm && (
        <Alert
          title={`Pause all agents at ${company}?`}
          body={`${plural(stoppable().length, 'running task')} stop where they are, and nothing new starts. The ${plural([...b.approvals.values()].filter((a) => a.state === 'pending').length, 'request')} waiting for an OK stay open. Only ${resumer()} can resume. The pause goes in the ${b.business.on ? 'audit log' : 'action log'}.`}
          action="Pause all agents"
          destructive
          busy={busy}
          onConfirm={() => void go('pause')}
          onCancel={() => setConfirm(false)}
        />
      )}
    </div>
  );
}

// ---------- the desktop's widgets ----------

/** How many paid calls ran twice: a resumed task must find its paid call's key in the log and not pay again. */
function paidTwice() {
  const seen = new Map<string, number>();
  for (const e of box.events) if (e.type === 'tool.result' && e.cents) seen.set(`${e.task}/${e.key}`, (seen.get(`${e.task}/${e.key}`) ?? 0) + 1);
  return [...seen.values()].filter((n) => n > 1).length;
}

function Widget({ label, value, tone, lines, onClick }: { label: string; value: string | number; tone?: 'attention' | 'destructive'; lines: string[]; onClick: () => void }) {
  return (
    <button type="button" class="gos-widget-card" onClick={onClick}>
      <span class="gos-widget-label">{label}</span>
      <span class={`gos-widget-value${tone ? ` t-${tone}` : ''}`}>{value}</span>
      {lines.map((l, i) => (
        <span class="gos-widget-line" key={i}>
          {l}
        </span>
      ))}
    </button>
  );
}

/** What the box is doing, on the wallpaper under the windows: what needs you, what runs, what it spent. */
export function DesktopHome() {
  const b = useBox();
  const now = useNow(60_000);
  const need = pending();
  const running = ofState('running');
  if (pausedNow()) return <PausedHome />;
  const r = b.restored && now - b.restored.at < 15 * 60_000 ? b.restored : undefined;
  const blocked = b.today.blocked;
  const summary = r
    ? `${r.lostAt ? `${selfBox().name} was out of reach from ${hhmm(r.lostAt)}` : `${selfBox().name} restarted`} and came back at ${hhmm(r.at)}. Every task is where it was.`
    : b.setup?.modelKey === false
      ? "Add a model key in Settings, Agents & Models, so agents can start tasks."
      : !b.tasks.size
        ? 'Start a task, or open App Center to turn on apps.'
      : [need.length ? `${plural(need.length, 'task')} ${need.length === 1 ? 'needs' : 'need'} you.` : 'Nothing needs you.', `${running.length} ${running.length === 1 ? 'is' : 'are'} running.`, blocked ? `${plural(blocked, 'attempt')} ${blocked === 1 ? 'was' : 'were'} blocked today.` : ''].filter(Boolean).join(' ');
  const twice = paidTwice();
  return (
    <section class="gos-desk" aria-label="Today">
      <h1 class="t-title1 gos-desk-title">
        {r ? 'Welcome back' : greeting(now)}
        {b.business.me?.person ? `, ${b.business.me.person.name.split(' ')[0]}` : b.ownerName ? `, ${b.ownerName}` : ''}
      </h1>
      <p class="t-body gos-desk-sub">{summary}</p>
      <div class="gos-desk-widgets">
        <Widget label="Needs you" value={need.length} tone={need.length ? 'attention' : undefined} lines={need.length ? need.slice(0, 3).map(askLine) : ['Nothing needs you']} onClick={() => toggle('notifications')} />
        {r ? (
          <Widget label="Resumed" value={r.tasks.length} lines={r.tasks.slice(0, 3).map((id) => short(`${taskTitle(id)}${b.tasks.get(id)?.step ? `: ${b.tasks.get(id)!.step}` : ''}`, 40))} onClick={() => open('tasks/running')} />
        ) : (
          <Widget label="Running" value={running.length} lines={running.length ? running.slice(0, 3).map((t) => short(`${t.title}${t.step ? `: ${t.step}` : ''}`, 40)) : ['No task is working now']} onClick={() => open('tasks/running')} />
        )}
        {r ? (
          <Widget label="Paid twice" value={twice} lines={twice ? ['A payment was made again after the restart'] : ['A payment that went through before', 'the power cut was not made again']} onClick={() => open('activity')} />
        ) : (
          <Widget label="Spent today" value={spentToday()} lines={[`${plural(b.tasks.size, 'task')}, ${plural(blocked, 'blocked attempt')}`, 'Models and tools, estimated']} onClick={() => open('activity')} />
        )}
      </div>
      <div class="gos-desk-actions">
        <Button kind="suggested" large icon="list-add" onClick={() => open('tasks/new')}>
          New task
        </Button>
      </div>
    </section>
  );
}

/** GurtOS Business while the kill switch is on (docs/figma/business/5c-all-agents-paused.png). */
function PausedHome() {
  const b = useBox();
  const p = pausedNow()!;
  const stopped = stoppable();
  const waiting = [...b.approvals.values()].filter((a) => a.state === 'pending');
  const seats = new Map<string, number>();
  for (const t of stopped) seats.set(t.seat ?? t.title, (seats.get(t.seat ?? t.title) ?? 0) + 1);
  const from = p.via && p.via !== p.by ? ` from ${p.via === 'box screen' ? "this computer's screen" : p.via}` : '';
  return (
    <section class="gos-desk" aria-label="All agents are paused">
      <h1 class="t-title1 gos-desk-title">All agents are paused</h1>
      <p class="t-body gos-desk-sub">
        {p.by} paused them at {hhmm(p.at)}
        {from}. {plural(stopped.length, 'task')} stopped where they were. Requests that need you stay open.
      </p>
      <div class="gos-desk-widgets">
        <Widget
          label="Needs you"
          value={waiting.length}
          tone={waiting.length ? 'attention' : undefined}
          lines={waiting.slice(0, 3).map((a) => {
            const i = askInfo(a);
            return `${i.id ?? short(i.title, 22)}: ${i.fraud ? 'fraud flag' : i.amount ? `$${Math.round(i.amount / 100).toLocaleString('en-US')}` : 'an OK'}${a.route ? `, for ${a.route.people.map((x) => x.name.split(' ')[0]).join(' or ') || 'nobody yet'}` : ''}`;
          })}
          onClick={() => open('waiting')}
        />
        <Widget label="Paused" value={stopped.length} tone="destructive" lines={[...seats].slice(0, 3).map(([seat, n]) => `${seat}: ${plural(n, 'task')}`)} onClick={() => open('tasks/running')} />
        <Widget label="Spent today" value={spentToday()} lines={['on models, before the pause', `${plural(b.tasks.size, 'task')}, ${plural(b.today.blocked, 'blocked attempt')}`]} onClick={() => open('activity')} />
      </div>
    </section>
  );
}

// ---------- the dock and Show Apps ----------

function DockItem({ app }: { app: Launchable }) {
  useBox();
  const win = wm.wins.find((w) => (app.route.startsWith('app/') ? w.route === app.route : w.route.split('/')[0] === app.route.split('/')[0]));
  const running = app.track ? ofState('running', 'waiting').some((t) => trackOf(t) === app.track) : app.id === 'tasks' && ofState('running', 'waiting').length > 0;
  const need = app.id === 'tasks' ? pending().length : app.track ? pending().filter((a) => trackOf(box.tasks.get(a.task) ?? { source: '' }) === app.track).length : 0;
  const click = () => {
    if (win && win === focused()) minimize(win.id);
    else if (win) focus(win.id);
    else open(app.route);
  };
  return (
    <button type="button" class="gos-dock-item" onClick={click} aria-label={`${app.title}${need ? `, ${plural(need, 'request')} waiting` : ''}${running ? ', running' : ''}`}>
      <span class="gos-tip" aria-hidden="true">
        {app.title}
      </span>
      <AppIcon id={app.icon} title={app.title} size={52} />
      {need > 0 && <Badge>{need}</Badge>}
      <span class={`gos-dot${running || win ? ' is-on' : ''}`} />
    </button>
  );
}

export function Dock() {
  useBox();
  const all = launchable();
  return (
    <nav class="gos-dock" aria-label="Dock">
      {all
        // An app's icon joins the system apps while its window is open; Show apps has every app.
        .filter((a) => !a.system && (!a.track || wm.wins.some((w) => w.route === a.route)))
        .map((a) => (
          <DockItem app={a} key={a.route} />
        ))}
      <span class="gos-dock-divider" aria-hidden="true" />
      {all
        .filter((a) => a.system)
        .map((a) => (
          <DockItem app={a} key={a.route} />
        ))}
      <button type="button" class="gos-dock-item" aria-label="Show apps" aria-expanded={shell.open === 'apps'} onClick={() => toggle('apps')}>
        <span class="gos-tip" aria-hidden="true">
          Show apps
        </span>
        <span class="gos-show-apps">
          <Icon name="view-app-grid" size={20} />
        </span>
        <span class={`gos-dot${shell.open === 'apps' ? ' is-on' : ''}`} />
      </button>
    </nav>
  );
}

/** Show Apps: every app, with search. */
export function Launcher({ home }: { home?: boolean }) {
  useBox();
  const [q, setQ] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (home) return;
    (ref.current?.querySelector('input') as HTMLInputElement | null)?.focus();
    const key = (e: KeyboardEvent) => e.key === 'Escape' && toggle('apps');
    addEventListener('keydown', key);
    return () => removeEventListener('keydown', key);
  }, []);
  const apps = launchable().filter((a) => a.title.toLowerCase().includes(q.trim().toLowerCase()));
  const go = (a: Launchable) => ((shell.open = ''), open(a.route));
  return (
    <div ref={ref} class={`gos-launcher${home ? ' is-home' : ''}`} onClick={(e) => !home && e.target === e.currentTarget && toggle('apps')}>
      {!home && (
        <div class="g-search gos-launcher-search">
          <Icon name="system-search" />
          <input class="g-field" type="search" placeholder="Search apps" aria-label="Search apps" value={q} onInput={(e) => setQ((e.target as HTMLInputElement).value)} onKeyDown={(e) => e.key === 'Enter' && apps[0] && go(apps[0])} />
        </div>
      )}
      <ul class="gos-launcher-grid" aria-label="Apps">
        {apps.map((a) => (
          <li key={a.route}>
            <button type="button" class="gos-launcher-app" onClick={() => go(a)}>
              <AppIcon id={a.icon} title={a.title} size={home ? 56 : 96} />
              <span>{a.title}</span>
            </button>
          </li>
        ))}
      </ul>
      {apps.length === 0 && <p class="gos-launcher-none">No app matches "{q}".</p>}
    </div>
  );
}

// ---------- the phone ----------

/** The phone's home (Figma 90:6534): the box, what needs you with its buttons, what runs, then the apps. */
export function PhoneHome() {
  const b = useBox();
  if (b.business.on)
    return (
      <main class="gos-home gos-home-business" aria-label="Waiting for me">
        <WaitingList home />
        <InstallCard />
        <NotificationsCard />
      </main>
    );
  const list = asks();
  const running = ofState('running');
  return (
    <main class="gos-home" aria-label="Home">
      <header class="gos-home-head">
        <button type="button" class="gos-plain gos-home-box" aria-haspopup="dialog" onClick={openMachines}>
          <h1 class="t-display">{selfBox().name}</h1>
          <Icon name="pan-down" />
        </button>
        <p class="t-caption t-secondary">
          {editionName(b.system?.edition)} · {b.down ? 'Out of reach' : 'Online'} · {running.length} running · {spentToday()} today
        </p>
      </header>
      <InstallCard />
      <NotificationsCard />
      <FolderReview />
      <section class="g-group" aria-label="Needs you">
        <div class="g-group-head">
          <h2 class="g-group-title">Needs you</h2>
        </div>
        <div class="g-list">
          {list.map((a) => {
            const app = appFor(a.task);
            return (
              <div class="gos-home-ask" key={a.id}>
                <button type="button" class="gos-plain gos-home-row" onClick={() => open(`task/${a.task}`)}>
                  <AppIcon id={app.id} title={app.title} size={36} />
                  <span class="gos-two">
                    <span class="t-body-strong">{taskTitle(a.task)}</span>
                    <span class="t-caption t-secondary">{a.question}</span>
                  </span>
                  {a.costCents > 0 && <Badge>{dollars(a.costCents)}</Badge>}
                </button>
                <div class="gos-actions gos-home-buttons">
                  <AnswerButtons a={a} large />
                </div>
              </div>
            );
          })}
          {!list.length && (
            <div class="g-row">
              <span class="g-row-text">
                <span class="g-row-title">Nothing needs you</span>
                <span class="g-row-sub">Requests show up here and as notifications.</span>
              </span>
            </div>
          )}
        </div>
      </section>
      <section class="g-group" aria-label="Running">
        <div class="g-group-head">
          <h2 class="g-group-title">Running</h2>
        </div>
        <div class="g-list">
          {running.map((t) => {
            const app = appOf(t);
            return (
              <button type="button" class="gos-plain gos-home-row" onClick={() => open(`task/${t.id}`)} key={t.id}>
                <AppIcon id={app.id} title={app.title} size={36} />
                <span class="gos-two gos-grow">
                  <span class="t-body-strong gos-ellipsis">{t.title}</span>
                  <span class="t-caption t-secondary gos-ellipsis">{t.step || 'Starting'}</span>
                  <Progress value={progressOf(t.step)} label={`${t.title} progress`} />
                </span>
                <Icon name="pan-end" />
              </button>
            );
          })}
          {!running.length && (
            <div class="g-row">
              <span class="g-row-text">
                <span class="g-row-title">No task is working now</span>
              </span>
            </div>
          )}
        </div>
      </section>
      {b.owner && b.system?.edition === 'server' && (
        <section class="g-group" aria-label="Kill switch">
          <div class="g-group-head">
            <h2 class="g-group-title">Kill switch</h2>
          </div>
          <KillSwitchCard />
        </section>
      )}
      <Button kind="suggested" large icon="list-add" onClick={() => open('tasks/new')}>
        New task
      </Button>
      <section class="g-group" aria-label="Apps">
        <div class="g-group-head">
          <h2 class="g-group-title">Apps</h2>
        </div>
        <Launcher home />
      </section>
    </main>
  );
}

const TABS: [string, string, string][] = [
  ['', 'Home', 'user-home'],
  ['tasks', 'Tasks', 'view-list'],
  ['activity', 'Activity', 'utilities-terminal'],
  ['settings', 'Settings', 'emblem-system'],
];
/** GurtOS Business (docs/figma/business/3): Waiting, Tasks, Audit, Settings. */
const BUSINESS_TABS: [string, string, string][] = [
  ['', 'Waiting', 'preferences-system-time'],
  ['tasks', 'Tasks', 'view-app-grid'],
  ['audit', 'Audit', 'help-about'],
  ['settings', 'Settings', 'emblem-system'],
];
/** The phone's tab bar: Home, Tasks, Activity, Settings. */
export function TabBar() {
  const b = useBox();
  const top = focused();
  const at = top ? top.route.split('/')[0] : '';
  const need = pending().length;
  const go = (route: string) => {
    if (!route) for (const w of wm.wins) w.min = true;
    else open(route);
    changed();
  };
  return (
    <nav class="gos-tabbar" aria-label="Sections">
      {(b.business.on ? BUSINESS_TABS : TABS).map(([route, label, icon]) => (
        <button type="button" class="gos-tab" aria-current={at === route || (route === 'tasks' && at === 'task') || (route === '' && (at === 'request' || at === 'waiting')) ? 'page' : undefined} onClick={() => go(route)} key={label}>
          <span class="gos-tab-icon">
            <Icon name={icon} size={22} />
            {route === (b.business.on ? '' : 'tasks') && need > 0 && <Badge>{need}</Badge>}
          </span>
          {label}
        </button>
      ))}
    </nav>
  );
}

// ---------- the box out of reach, and the lock screen ----------

/** On the box's own screen, the box being out of reach means it is starting: the boot screen (Figma 85:5480). */
export function BootScreen() {
  const b = useBox();
  return (
    <div class="gos-boot" role="status" aria-live="polite">
      <p class="gos-boot-mark" aria-label={PRODUCT}>
        <b>Gurt</b>OS
      </p>
      <p class="t-title3">{b.events.length ? 'Starting again, every task where it was' : 'Starting'}</p>
      <Progress label="Starting" />
      <p class="t-mono gos-boot-line">Starting GurtOS · every task resumes where it was</p>
    </div>
  );
}

/** Off the box, it being out of reach is a bar across the top: answers can't go through until it is back. */
export function OutageBar() {
  const b = useBox();
  if (!b.down) return null;
  return (
    <div class="gos-outage" role="alert">
      <Icon name="network-offline" />
      <span>
        <b>{selfBox().name} is out of reach.</b> Answers won't go through until it is back. This page reconnects by itself.
      </span>
    </div>
  );
}

/** A curtain for an always-on screen (Figma 83:4965): the time, the box, what waits (answer on the phone). */
export function LockScreen() {
  useBox();
  const now = useNow(5000);
  const list = pending();
  const ref = useRef<HTMLDivElement>(null);
  const unlock = () => ((shell.locked = false), changed());
  useEffect(() => {
    ref.current?.focus();
    // It hides what agents do from passers-by; it is not a lock. Any key wakes it.
    const key = (e: KeyboardEvent) => !['Shift', 'Control', 'Alt', 'Meta'].includes(e.key) && unlock();
    addEventListener('keydown', key);
    return () => removeEventListener('keydown', key);
  }, []);
  const first = list[0];
  const app = first && appFor(first.task);
  return (
    <div ref={ref} class="gos-lock" role="dialog" aria-modal="true" aria-label="Screen asleep" tabIndex={-1} onClick={unlock}>
      <p class="gos-lock-time">{hhmm(now)}</p>
      <p class="gos-lock-date">{dateOf(now, true)}</p>
      <p class="gos-lock-box">
        <Icon name="computer" /> {selfBox().name} · agents keep working while it is locked
      </p>
      {first && app && (
        <div class="gos-lock-asks">
          <article class="g-notification gos-note">
            <div class="gos-note-head">
              <AppIcon id={app.id} title={app.title} size={20} />
              <span class="t-caption-strong t-secondary">{app.title}</span>
              <span class="t-caption t-secondary gos-note-time">{hhmm(askedAt(first.id))}</span>
            </div>
            <span class="t-heading">{first.costCents ? `${taskTitle(first.task)} needs you` : first.question}</span>
            <span class="t-body t-secondary">{first.costCents ? `${first.question} ` : ''}Wake the screen to answer here, or answer on your phone.</span>
          </article>
          {list.length > 1 && <p class="gos-lock-more">{list.length - 1} more {list.length === 2 ? 'needs' : 'need'} you</p>}
        </div>
      )}
      <p class="gos-lock-hint">Press any key or click to wake</p>
    </div>
  );
}

/** Lock an always-on box screen after ten idle minutes, so what agents do isn't on show all day. */
export function useIdleLock(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    let last = Date.now();
    const poke = () => (last = Date.now());
    const evs = ['pointerdown', 'keydown', 'pointermove'];
    evs.forEach((e) => addEventListener(e, poke, { passive: true }));
    const t = setInterval(() => !shell.locked && Date.now() - last > 600_000 && lock(), 30_000);
    return () => (clearInterval(t), evs.forEach((e) => removeEventListener(e, poke)));
  }, [enabled]);
}

// ---------- not paired ----------

/** 'rosa.box.gurtos.com' or a full address, as the base the box's API is under. */
const boxUrl = (a: string) => {
  const t = a.trim().replace(/\/+$/, '');
  return /^https?:\/\//.test(t) ? t : `https://${t}`;
};
/** app.gurtos.com: redeem a code on that box, ask it which edition it is, and add it to this app's machines. */
export async function pairWith(url: string, body: { code: string; name: string }) {
  const r = await fetch(`${url}/api/pair`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).catch(() => {
    throw new Error(`nothing answered at ${url}`);
  });
  const p = (await r.json().catch(() => ({}))) as Pairing & { error?: string };
  if (!r.ok) throw new Error(p.error ?? `GurtOS answered ${r.status}`);
  const sys = await fetch(`${url}/api/system`, { headers: { authorization: `Bearer ${p.token}` } }).then((x) => x.json(), () => ({}));
  addMachine({ token: p.token, device: p.device, box: p.box, url, edition: sys.edition });
}

/** Ask the computer to turn on remote access, then wait for its address (or its reason) for up to 3 minutes. */
async function rendezvous(rv: string): Promise<string> {
  // The relay's rendezvous for a computer without its own address yet (POST /api/pair/start with remote access off).
  const at = `${RELAY}/v1/rv/${encodeURIComponent(rv)}`;
  const put = await fetch(`${at}/ask`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: '{}', signal: AbortSignal.timeout(10_000) }).catch(() => undefined);
  if (!put?.ok) throw new Error("GurtOS's relay isn't answering, so pairing over the internet isn't available right now.");
  const end = Date.now() + 180_000;
  while (Date.now() < end) {
    const ctl = new AbortController();
    const poll = (what: 'host' | 'error') =>
      fetch(`${at}/${what}?wait=25`, { signal: ctl.signal }).then(
        async (r) => (r.status === 200 ? ((await r.json()) as { host?: string; error?: string }) : undefined),
        () => undefined,
      );
    const started = Date.now();
    // The first of the two to answer 200 wins; both answering without news means ask again.
    const got = await new Promise<{ host?: string; error?: string } | undefined>((done) => {
      let left = 2;
      for (const p of [poll('host'), poll('error')]) void p.then((v) => (v ? done(v) : --left || done(undefined)));
    });
    ctl.abort();
    if (got?.error) throw new Error(got.error);
    if (got?.host) {
      if (!onRelay(got.host)) throw new Error('The relay answered with an address that is not a GurtOS address.');
      return got.host;
    }
    if (Date.now() - started < 2000) await new Promise((r) => setTimeout(r, 2000)); // the relay answered at once: don't spin
  }
  throw new Error("No answer within 3 minutes. On the computer's screen, open Settings, Remote access.");
}

/** app.gurtos.com/pair?rv=…&n=…&lan=…#<code>: the phone can't reach the computer yet. Ask it to get an address. */
function MeetBox({ rv, code, name, lan, onHost }: { rv?: string; code: string; name: string; lan?: string; onHost: (host: string) => void }) {
  const [state, setState] = useState<'ask' | 'busy' | string>('ask');
  // Pairing over the internet goes through the relay. Without it, the home network is the only way, so it leads.
  const up = useRelayUp();
  const go = () => {
    if (!rv) return;
    setState('busy');
    rendezvous(rv).then(onHost, (e) => setState((e as Error).message));
  };
  const local = lan && (
    <a class={`g-btn g-btn-large${up === false ? ' g-btn-suggested' : ''}`} href={`http://${lan}/pair#${code}`}>
      {up === false ? `Open ${name} on this network` : `Same Wi-Fi as ${name}? Open it on this network`}
    </a>
  );
  return (
    <div class="gos-setup-layer">
      <section class="g-window gos-pair-first" aria-labelledby="meet-title">
        <div class="gos-pair">
          <span class="gos-pair-icon">
            <Icon name="phone" size={32} />
          </span>
          <h1 class="t-title2" id="meet-title">
            Pair with {name}
          </h1>
          {up === false ? (
            <>
              <p class="t-body t-secondary">
                {lan ? `Connect this phone to the same Wi-Fi or network as ${name}, then open it.` : `Connect this phone to the same Wi-Fi or network as ${name}, then open ${PRODUCT} at its address on that network and type the code from its screen.`}
              </p>
              {local}
              <p class="t-caption t-secondary">Pairing over the internet needs {PRODUCT}'s relay, which isn't answering right now.</p>
            </>
          ) : (
            <>
              <p class="t-body t-secondary">
                {rv
                  ? `This phone can't reach ${name} directly yet. It can ask ${name} for its own address and pair over the internet.`
                  : `To pair from anywhere, turn on Reach from anywhere on ${name}: Settings, Remote access.`}
              </p>
              {!rv ? null : state === 'busy' ? (
                <p class="t-body" role="status">
                  Asking {name} to turn on its address… about 10 to 60 seconds.
                </p>
              ) : (
                <>
                  <Button kind="suggested" large disabled={up === undefined} onClick={go}>
                    Pair over the internet
                  </Button>
                  <p class="t-caption t-secondary">{name} turns on Remote access, so this phone can reach it and get notifications.</p>
                </>
              )}
              {state !== 'ask' && state !== 'busy' && (
                <p class="gos-error" role="alert">
                  {state}
                </p>
              )}
              {local}
            </>
          )}
        </div>
      </section>
    </div>
  );
}

/** Off the box's own screen the box answers only paired devices. Pair with the code from the box's screen. */
export function PairFirst() {
  const guess = /iPhone/.test(navigator.userAgent) ? 'iPhone' : /Android/.test(navigator.userAgent) ? 'Android phone' : 'Laptop';
  // The QR opens /pair#<code> (or /#pair/<code>): the code is already in the address. A computer without its own
  // address puts its details in the fragment, where no server log sees them: /pair#code=…&rv=…&lan=…&n=….
  const h = location.hash.slice(1);
  const frag = location.pathname === '/pair' && h.includes('=') ? new URLSearchParams(h) : undefined;
  const fromLink = frag ? (frag.get('code') ?? '') : h.startsWith('pair/') ? h.slice(5) : location.pathname === '/pair' ? h : '';
  const [code, setCode] = useState(decodeURIComponent(fromLink));
  const [name, setName] = useState(guess);
  const [state, setState] = useState<'ask' | 'busy' | string>('ask');
  const revoked = !!localStorage.getItem('gurtos.was-paired');
  const [inSafari, setInSafari] = useState(false);
  // On app.gurtos.com the link names the box: /pair?box=rosa.box.gurtos.com#<code>.
  const [boxAddr, setBoxAddr] = useState(new URLSearchParams(location.search).get('box') ?? '');
  const adding = hosted && machines().length > 0;
  // app.gurtos.com reaches a computer only through the relay.
  const relay = useRelayUp(hosted);
  // Remote access off: the link names no address, only the computer (n), its home address (lan) and, during setup, a
  // rendezvous (rv).
  const meet = hosted && !boxAddr && !!frag && !!fromLink && ['rv', 'n', 'lan'].some((k) => frag.has(k));
  // GurtOS Business: sign in with a work account. The box comes back to /#sso/<one-time code>, redeemed here for this device's token.
  const [work, setWork] = useState<{ on: boolean; name?: string }>();
  const [workError, setWorkError] = useState('');
  useEffect(() => {
    if (hosted) return;
    fetch('/api/sso').then((r) => r.json()).then(setWork, () => {});
    const sso = h.startsWith('sso/') ? h.slice(4) : '';
    if (!sso) return;
    setState('busy');
    api<Pairing>('POST', '/sso/redeem', { code: sso })
      .then((p) => (setPairing(p), localStorage.setItem('gurtos.was-paired', '1'), location.replace('/')))
      .catch((err) => (setState('ask'), setWorkError((err as Error).message)));
  }, []);
  const redeem = (c: string) => {
    setState('busy');
    const body = { code: c.replace(/[^0-9a-z]/gi, '').toLowerCase(), name: name.trim() || guess };
    (hosted ? pairWith(boxUrl(boxAddr), body) : api<Pairing>('POST', '/pair', body).then(setPairing))
      .then(() => {
        localStorage.setItem('gurtos.was-paired', '1');
        location.replace('/');
      })
      .catch((err) => setState((err as Error).message));
  };
  const go = (e: Event) => (e.preventDefault(), redeem(code));
  if (meet) {
    const lan = frag!.get('lan') ?? '';
    const rv = frag!.get('rv') ?? '';
    return (
      <MeetBox
        rv={/^[\w-]{4,64}$/.test(rv) ? rv : undefined}
        code={fromLink}
        name={(frag!.get('n') ?? '').slice(0, 60) || 'Your computer'}
        lan={/^[\w.-]+(:\d{1,5})?$/.test(lan) ? lan : undefined}
        onHost={(host) => (history.replaceState(null, '', `/pair?box=${encodeURIComponent(host)}#${fromLink}`), setBoxAddr(host))}
      />
    );
  }
  // An iPhone's Home Screen app keeps its own storage, so a code redeemed in Safari wouldn't carry over to it.
  if (fromLink && ios() && !standalone() && !inSafari) return <AddToHomeScreen pairCode={decodeURIComponent(fromLink)} box={hosted ? boxAddr : undefined} onSafari={() => (setInSafari(true), redeem(code))} />;
  return (
    <div class="gos-setup-layer">
      <section class="g-window gos-pair-first" aria-labelledby="pair-first-title">
        <form class="gos-pair" onSubmit={go}>
          <span class="gos-pair-icon">
            <Icon name="phone" size={32} />
          </span>
          <h1 class="t-title2" id="pair-first-title">
            {adding ? 'Add a computer' : hosted && fromLink && boxAddr ? `Pair with ${boxAddr}?` : standalone() && !fromLink ? 'Type the pairing code' : `Pair this ${surface === 'phone' ? 'phone' : 'device'} first`}
          </h1>
          <p class="t-body t-secondary">
            {revoked ? 'This device was unpaired, so it needs a new code. ' : ''}
            {PRODUCT} shows tasks and requests only to paired devices. On the computer's own screen, open Settings, then Devices, and scan the QR code. Or type {hosted ? 'its address and ' : ''}the code it shows.
          </p>
          {hosted && relay === false && (
            <div class="g-banner" role="status">
              <Icon name="dialog-warning" />
              <div class="t-caption">
                {PRODUCT}'s relay isn't answering right now, so this page can't reach a computer over the internet. On the same Wi-Fi, open {PRODUCT} at the computer's own address instead, like http://192.168.1.20:7700, and pair there.
              </div>
            </div>
          )}
          {hosted && (
            <label class="gos-field">
              <span class="t-body-strong">Computer's address</span>
              <input class="g-field" value={boxAddr} placeholder={`rosa.${RELAY_HOST}`} inputMode="url" autoComplete="off" autoCapitalize="none" spellcheck={false} onInput={(e) => setBoxAddr((e.target as HTMLInputElement).value)} />
            </label>
          )}
          <label class="gos-field">
            <span class="t-body-strong">Code from its screen</span>
            <input class="g-field gos-code-field" value={code} placeholder="7Q4M-2KXD" autoComplete="off" autoCapitalize="characters" spellcheck={false} onInput={(e) => setCode((e.target as HTMLInputElement).value)} />
          </label>
          <label class="gos-field">
            <span class="t-body-strong">Name this {surface === 'phone' ? 'phone' : 'device'}</span>
            <input class="g-field" value={name} maxLength={40} autoFocus={!!fromLink} onInput={(e) => setName((e.target as HTMLInputElement).value)} />
          </label>
          <button type="submit" class="g-btn g-btn-suggested g-btn-large" disabled={code.replace(/[^0-9a-z]/gi, '').length < 4 || (hosted && !boxAddr.trim()) || state === 'busy'}>
            Pair
          </button>
          {state !== 'ask' && state !== 'busy' && (
            <p class="gos-error" role="alert">
              Could not pair: {state}. Ask its screen for a new code.
            </p>
          )}
          {work?.on && (
            <>
              <Button large icon="avatar-default" disabled={state === 'busy'} onClick={() => location.assign(`/api/sso/start?device=${encodeURIComponent(name.trim() || guess)}`)}>
                Sign in with your work account
              </Button>
              <p class="t-caption t-secondary">{work.name}</p>
            </>
          )}
          {workError && (
            <p class="gos-error" role="alert">
              Could not sign in: {workError}
            </p>
          )}
          <p class="t-caption t-secondary">A paired device can approve, deny and start tasks. It never holds a key.</p>
          {adding && (
            <Button kind="flat" onClick={() => location.replace('/')}>
              Cancel
            </Button>
          )}
        </form>
      </section>
    </div>
  );
}

export { phone, pairing };
