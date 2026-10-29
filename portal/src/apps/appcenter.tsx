// App Center (Figma 79:4011 and 79:4398): every installed app, what it can reach and the keys it needs, with one
// action each. GET /api/apps?all=1; POST /api/apps/<id>/enable or disable; keys go to PUT /api/vault/<NAME>.
import './settings.css';
import { useState } from 'preact/hooks';
import { useBox, type AppInfo } from '../live.ts';
import { AppIcon, Badge, Button, Group, Icon, IconButton, Row, StatusPage } from '../kit/ui.tsx';
import { HeaderBar, open, phone, useWin } from '../wm.tsx';
import { byApp, keyLabel, plural, testApp } from '../util.ts';
import { KeySheet, ReadOnly, appTitle, useToggleApp } from './settings.tsx';

type Filter = 'all' | 'on' | 'off' | 'key';
const FILTERS: [Filter, string, string, (a: AppInfo) => boolean][] = [
  ['all', 'All apps', 'view-app-grid', () => true],
  ['on', 'On', 'object-select', (a) => a.status === 'enabled'],
  ['off', 'Off', 'window-close', (a) => a.status !== 'enabled'],
  ['key', 'Needs a key', 'dialog-password', (a) => a.access.secrets.some((s) => !s.set && !s.optional)],
];

const badge = (a: AppInfo) => (
  <>
    {a.status === 'error' ? <Badge kind="destructive">Error</Badge> : a.status === 'enabled' ? <Badge kind="success">On</Badge> : <Badge kind="neutral">Off</Badge>}
    {testApp(a) && <Badge kind="neutral">Test only</Badge>}
  </>
);

const missing = (a: AppInfo) => a.access.secrets.filter((s) => !s.set && !s.optional);
/** "3 hosts · 1 key missing", or the error in red. */
function meta(a: AppInfo): { text: string; tone?: string } {
  if (a.status === 'error') return { text: a.error ?? 'It did not load', tone: 't-destructive' };
  const hosts = a.access.hosts.length ? plural(a.access.hosts.length, 'host') : 'No internet';
  const keys = a.access.secrets.length ? (missing(a).length ? `${plural(missing(a).length, 'key')} missing` : plural(a.access.secrets.length, 'key')) : 'No keys';
  return { text: `${hosts} · ${keys}` };
}

export function AppCenterApp({ id }: { id: string }) {
  const b = useBox();
  const win = useWin();
  const toggle = useToggleApp();
  const [filter, setFilter] = useState<Filter>('all');
  const [q, setQ] = useState('');
  const [sheet, setSheet] = useState<string>();
  const [busy, setBusy] = useState('');
  const mobile = phone();
  const app = id ? b.allApps.find((a) => a.id === id) : undefined;
  const [, label, , test] = FILTERS.find((f) => f[0] === filter)!;
  const needle = q.trim().toLowerCase();
  const shown = [...b.allApps].sort(byApp).filter((a) => test(a) && (!needle || `${a.title} ${a.description} ${a.id}`.toLowerCase().includes(needle)));
  const on = b.allApps.filter((a) => a.status === 'enabled').length;
  const run = async (a: AppInfo, enable: boolean) => {
    setBusy(a.id);
    await toggle(a, enable);
    setBusy('');
  };
  const openApp = (a: AppInfo) => a.ui[0] && open(`app/${a.id}/${a.ui[0].name}`);

  /** The one action a card offers. */
  const action = (a: AppInfo) => {
    const ro = !b.owner;
    if (a.status === 'enabled' && a.ui.length) return <Button onClick={() => openApp(a)}>Open</Button>;
    if (missing(a).length && (a.status === 'error' || a.status === 'enabled'))
      return (
        <Button onClick={() => setSheet(missing(a)[0].name)} disabled={ro}>
          Set key
        </Button>
      );
    if (a.status === 'enabled') return <Button onClick={() => win?.navigate(`app-center/${a.id}`)}>Details</Button>;
    return (
      <Button kind="suggested" onClick={() => void run(a, true)} disabled={ro || busy === a.id}>
        Turn on
      </Button>
    );
  };

  const sidebar = (
    <nav class="g-sidebar" aria-label="App Center filters">
      <HeaderBar title="App Center" controls={false} flat />
      <div class="g-sidebar-body gos-set-sidebar-body">
        <label class="g-search gos-set-search">
          <Icon name="system-search" />
          <input class="g-field" type="search" placeholder="Search apps" aria-label="Search apps" value={q} onInput={(e) => (setQ((e.target as HTMLInputElement).value), id && win?.navigate('app-center'))} />
        </label>
        {FILTERS.map(([f, text, icon, t]) => (
          <button type="button" class="g-sidebar-item" aria-current={!app && f === filter ? 'page' : undefined} onClick={() => (setFilter(f), win?.navigate('app-center'))} key={f}>
            <Icon name={icon} />
            <span>{text}</span>
            <small>{b.allApps.filter(t).length}</small>
          </button>
        ))}
      </div>
    </nav>
  );

  const grid = (
    <div class="gos-ac-page">
      {!b.owner && <ReadOnly />}
      <div class="gos-ac-intro">
        <h2 class="t-title2">
          {plural(b.allApps.length, 'app')} installed, {on} on
        </h2>
        <p class="t-body t-secondary">An app adds tools, windows and triggers. Before you turn one on, it shows every host it can reach and every key it needs.</p>
      </div>
      {shown.length ? (
        <ul class="gos-ac-grid" aria-label={label}>
          {shown.map((a) => {
            const m = meta(a);
            return (
              <li class="gos-ac-card" key={a.id}>
                <AppIcon id={a.id} title={appTitle(a)} size={52} />
                <div class="gos-ac-text">
                  <span class="gos-ac-name">
                    <button type="button" class="gos-ac-open" onClick={() => win?.navigate(`app-center/${a.id}`)}>
                      {appTitle(a)}
                    </button>
                    {badge(a)}
                  </span>
                  {a.description && <span class="gos-ac-desc">{a.description}</span>}
                  <span class={m.tone}>{m.text}</span>
                </div>
                {action(a)}
              </li>
            );
          })}
        </ul>
      ) : (
        <StatusPage icon="system-search" title="No apps here">
          {needle ? `Nothing matches "${q}".` : 'Pick All apps to see every app.'}
        </StatusPage>
      )}
    </div>
  );

  const detail = app && (
    <div class="gos-ac-detail">
      {!b.owner && <ReadOnly />}
      <div class="gos-ac-head">
        <AppIcon id={app.id} title={appTitle(app)} size={80} />
        <div>
          <span class="gos-ac-name">
            <h2 class="t-title1">{appTitle(app)}</h2>
            {badge(app)}
          </span>
          {app.description && <p class="t-body t-secondary">{app.description}</p>}
          {app.status === 'error' && <p class="t-body t-destructive">{app.error}</p>}
          {app.restartNeeded && <p class="t-caption t-secondary">One of its triggers keeps running until GurtOS restarts.</p>}
          <div class="gos-actions">
            {app.status === 'enabled' && app.ui.length > 0 && (
              <Button kind="suggested" onClick={() => openApp(app)}>
                Open {appTitle(app)}
              </Button>
            )}
            <Button kind={app.status === 'enabled' ? 'default' : 'suggested'} onClick={() => void run(app, app.status !== 'enabled')} disabled={!b.owner || busy === app.id}>
              {app.status === 'enabled' ? 'Turn off' : 'Turn on'}
            </Button>
          </div>
        </div>
      </div>
      <Group title="What it can reach" caption={app.access.hosts.length ? 'Its tools reach only these. Everything else is blocked and logged.' : undefined}>
        {app.access.hosts.length ? app.access.hosts.map((h) => <Row icon="web-browser" title={h.replace(/\bthe box\b/g, 'this computer')} key={h} />) : <Row icon="network-offline" title="No internet" sub="Its tools reach nothing outside this computer" />}
      </Group>
      <Group title="Keys it needs" caption={app.access.secrets.length ? 'GurtOS keeps them where agents can\'t read them. The app never sees one either.' : undefined}>
        {app.access.secrets.length ? (
          app.access.secrets.map((s) => (
            <Row title={keyLabel(s.name)} sub={<><span class="gos-set-mono">{s.name}</span>{s.optional ? ' · optional, the app works without it' : ''}</>} key={s.name}>
              {s.set ? (
                <span class="gos-set-value t-success">Set</span>
              ) : (
                <Button onClick={() => setSheet(s.name)} disabled={!b.owner}>
                  Set key
                </Button>
              )}
            </Row>
          ))
        ) : (
          <Row title="No keys" />
        )}
      </Group>
      <Group title="What it adds">
        <Row icon="utilities-terminal" title="Tools" sub={app.access.tools.map((t) => t.name).join(', ') || 'None'}>
          <span class="gos-set-value">{app.access.tools.length}</span>
        </Row>
        <Row icon="preferences-desktop-display" title="Windows" sub={app.ui.map((u) => u.title).join(', ') || 'None'}>
          <span class="gos-set-value">{app.ui.length}</span>
        </Row>
        <Row icon="appointment-soon" title="Triggers" sub={app.access.triggers.join(', ') || 'None'}>
          <span class="gos-set-value">{app.access.triggers.length}</span>
        </Row>
      </Group>
    </div>
  );

  if (mobile && !id)
    return (
      <div class="g-split gos-set-mobile">
        <div class="g-split-main">
          <HeaderBar title="App Center" />
          <div class="g-window-content">{grid}</div>
        </div>
        {sheet && <KeySheet name={sheet} onClose={() => setSheet(undefined)} />}
      </div>
    );
  return (
    <div class="g-split">
      {!mobile && sidebar}
      <div class="g-split-main">
        <HeaderBar
          title={id ? (app ? appTitle(app) : id) : label}
          start={id && <IconButton icon="go-previous" label="All apps" onClick={() => win?.navigate('app-center')} />}
        />
        <div class="g-window-content">
          {id ? (
            (detail ?? (
              <StatusPage icon="preferences-desktop-apps" title="No such app" action={<Button onClick={() => win?.navigate('app-center')}>All apps</Button>}>
                {`Nothing called ${id} is installed on this computer.`}
              </StatusPage>
            ))
          ) : (
            grid
          )}
        </div>
      </div>
      {sheet && <KeySheet name={sheet} onClose={() => setSheet(undefined)} />}
    </div>
  );
}
