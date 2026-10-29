// Settings (Figma 76:2071 to 77:4131): a sidebar of ten pages, each a column of boxed lists. Changes go to
// PATCH /api/settings, the vault, apps on and off, and pairing. Only the owner may change anything: the box's own
// screen or the owner's paired phone. Everyone else reads.
import './settings.css';
import { AppPermissions, askPermissions } from './permissions.tsx';
import { Notifications, RemoteAccess } from './remote.tsx';
import type { ComponentChildren, JSX } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import qrcode from 'qrcode-generator';
import { api, box, loadApps, loadSetup, onEvent, pairing, patchSettings, useBox, type AppInfo, dayOf } from '../live.ts';
import { AddRow, Alert, AppIcon, Badge, Button, ComboRow, Group, Icon, IconButton, LinkRow, Row, Sheet, SwitchRow } from '../kit/ui.tsx';
import { HeaderBar, InWindow, open, phone, useWin } from '../wm.tsx';
import { access } from '../shell.tsx';
import { PRODUCT } from '../product.ts';
import { dollars, keyLabel, plural, selfBox, sentence, testApp, byApp, useNow } from '../util.ts';
import { pairLink as link, pairNote, useRelayUp, type PairCode } from '../relay.ts';
import { KillSwitchPage, PeoplePage, RulesPage } from './company.tsx';
/** One model key lets agents think: an Anthropic key or a Factory key. */
const MODEL_KEYS = ['ANTHROPIC_API_KEY', 'FACTORY_API_KEY'];

type Page = [id: string, title: string, icon: string, words: string];
/** GurtOS Business adds a COMPANY group (docs/figma/business/1a-people.png): people, rules and the kill switch. */
const COMPANY: (Page | 'sep' | 'company')[] = [
  'company',
  ['people', 'People', 'avatar-default', 'people roles approvers limits phones pair add a person agent seats'],
  ['rules', 'Rules', 'help-about', 'rules policy who approves controller limits fraud always on'],
  ['kill-switch', 'Kill switch', 'process-stop', 'kill switch pause all agents resume stop'],
  'sep',
];
const ALL_PAGES: (Page | 'sep' | 'company')[] = [
  ['general', 'General', 'computer', 'name address time zone network ethernet wi-fi restart run setup again'],
  ['agents', 'Agents & Models', 'applications-science', 'worker droid claude model keys spend today'],
  'sep',
  ...COMPANY,
  ['permissions', 'Permissions', 'security-high', 'internet hosts network folders spending budget approval quiet hours'],
  ['keys', 'Accounts & Keys', 'dialog-password', 'vault keys secrets owner replace'],
  ['apps', 'Apps', 'view-app-grid', 'apps on off app center'],
  ['devices', 'Devices', 'phone', 'phones pair revoke qr code notifications push'],
  ['remote', 'Remote access', 'web-browser', 'reach from anywhere address https relay name'],
  'sep',
  ['updates', 'Updates', 'software-update-available', 'system update version build rollback'],
  ['privacy', 'Privacy & Logs', 'preferences-system-privacy', 'action log keep retention size sharing'],
  ['appearance', 'Appearance', 'preferences-desktop-appearance', 'style light dark theme accent color wallpaper larger text contrast motion'],
  'sep',
  ['about', 'About', 'help-about', 'version build edition box id uptime credits icons typeface'],
];
/** The pages this box shows: COMPANY only on GurtOS Business. */
const pageList = () => (box.business.on ? ALL_PAGES : ALL_PAGES.filter((p) => !COMPANY.includes(p)));
const pagesNow = () => pageList().filter((p): p is Page => typeof p !== 'string');

/** The app title without its note in brackets: "Shopper (test payments)" is Shopper. A track with no title of its own shows its id as words. */
export function appTitle(a: Pick<AppInfo, 'title' | 'id'>) {
  const t = a.title.replace(/\s*\(.*\)$/, '');
  return t === a.id ? t[0].toUpperCase() + t.slice(1).replace(/-/g, ' ') : t;
}

/** Change settings, and say why when the box refuses. */
function useSet() {
  const win = useWin();
  return (patch: Record<string, unknown>) => patchSettings(patch).catch((e) => win?.toast(`Not changed: ${(e as Error).message}`));
}

/** The vault's key names and when each was set. Never a value: no route returns one. Owner only. */
export interface VaultKey {
  name: string;
  setAt: string | null;
}
export function useVault() {
  const b = useBox();
  const [keys, setKeys] = useState<VaultKey[]>();
  const load = () => (b.owner ? api<VaultKey[]>('GET', '/vault').then(setKeys, () => setKeys(undefined)) : setKeys(undefined));
  useEffect(() => {
    void load();
    return onEvent((e) => e.type === 'note' && e.track === 'vault' && void load());
  }, [b.owner]);
  return [keys, load] as const;
}
export const when = (iso: string) => new Date(iso).toLocaleString('en-US', { weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).replace(',', '');

/** Set or replace one key. A password field, so the screen never shows it; the box never gives it back. */
export function KeySheet({ name, onClose, onSaved }: { name?: string; onClose: () => void; onSaved?: () => void }) {
  const win = useWin();
  const [key, setKey] = useState(name ?? '');
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const okName = /^[A-Z][A-Z0-9_]{1,63}$/.test(key);
  const save = async () => {
    setBusy(true);
    setError('');
    try {
      await api('PUT', `/vault/${key}`, { value });
      setValue('');
      await Promise.all([loadApps(), loadSetup()]); // a model key lets tasks start: the desktop and New task stop warning
      onSaved?.();
      onClose();
      win?.toast(`${keyLabel(key)} saved`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };
  return (
    <InWindow>
      <Sheet title={name ? 'Replace a key' : 'Add a key'} onCancel={onClose} onDone={() => void save()} done="Save" doneDisabled={busy || !okName || !value.trim()}>
        {name ? (
          <p>
            <span class="t-body-strong">{keyLabel(name)}</span> <span class="t-caption t-secondary gos-set-mono">{name}</span>
          </p>
        ) : (
          <label class="gos-field">
            <span class="t-body-strong">Name</span>
            <input class="g-field gos-set-mono" value={key} placeholder="STRIPE_SECRET_KEY" autoComplete="off" spellcheck={false} onInput={(e) => setKey((e.target as HTMLInputElement).value.toUpperCase().replace(/[^A-Z0-9_]/g, '_'))} />
          </label>
        )}
        <label class="gos-field">
          <span class={name ? 'g-sr' : 't-body-strong'}>Key</span>
          <input
            class="g-field"
            type="password"
            value={value}
            autoComplete="new-password"
            spellcheck={false}
            aria-label={`New value for ${key || 'the key'}`}
            onInput={(e) => setValue((e.target as HTMLInputElement).value)}
            onKeyDown={(e) => e.key === 'Enter' && okName && value.trim() && !busy && void save()}
          />
          <span class="t-caption t-secondary">Paste the new key. {name ? 'The old one is overwritten, and nothing can read either back.' : 'Nothing can read it back.'} The log records that the key changed, never the key.</span>
        </label>
        {error && (
          <p class="gos-error" role="alert">
            {sentence(error)}
          </p>
        )}
      </Sheet>
    </InWindow>
  );
}

/** The one line under an app: on or off, what is missing, or what broke. */
export function appStatus(a: AppInfo): { text: string; tone?: 'destructive' } {
  const missing = a.access.secrets.filter((s) => !s.set && !s.optional).length;
  if (a.status === 'error') return { text: `Error: ${a.error ?? 'it did not load'}`, tone: 'destructive' };
  if (a.status === 'disabled') return { text: 'Off' };
  return { text: `On${missing ? ` · ${plural(missing, 'key')} missing` : ''}${a.restartNeeded ? ' · restart to stop its triggers' : ''}` };
}

/** Turn an app on or off. */
export function useToggleApp() {
  const win = useWin();
  return async (a: AppInfo, on: boolean) => {
    try {
      await api('POST', `/apps/${a.id}/${on ? 'enable' : 'disable'}`);
      await loadApps();
      win?.toast(`${appTitle(a)} is ${on ? 'on' : 'off'}`);
      if (on) void askPermissions(a.id); // a phone asks what a new app may do: so does GurtOS, once
    } catch (e) {
      win?.toast(`Could not turn ${appTitle(a)} ${on ? 'on' : 'off'}: ${(e as Error).message}`);
      await loadApps();
    }
  };
}

/** Shown once at the top when this screen may only look. */
export const ReadOnly = () => (
  <div class="g-banner g-banner-accent gos-set-banner" role="note">
    <Icon name="security-high" />
    <div class="t-body">Only the owner changes these: on this computer's own screen, or the owner's paired phone. Here you can look.</div>
  </div>
);

// A custom accent from appearance.accent. shortcut: applied while Settings is open; live.applyTheme should call it at start.
// ---------- the window ----------

export function SettingsApp({ page }: { page: string }) {
  const b = useBox();
  const win = useWin();
  const [q, setQ] = useState('');
  const mobile = phone();
  const pages = pagesNow();
  const current = pages.find((p) => p[0] === page) ?? (mobile ? undefined : pages[0]);
  const needle = q.trim().toLowerCase();
  const go = (id: string) => win?.navigate(`settings/${id}`);
  const shown = pageList().filter((p) => !needle || (typeof p !== 'string' && `${p[1]} ${p[3]}`.toLowerCase().includes(needle)));

  const sidebar = (
    <nav class="g-sidebar" aria-label="Settings pages">
      <HeaderBar title="Settings" controls={mobile} flat />
      <div class="g-sidebar-body gos-set-sidebar-body">
        <label class="g-search gos-set-search">
          <Icon name="system-search" />
          <input
            class="g-field"
            type="search"
            placeholder="Search settings"
            aria-label="Search settings"
            value={q}
            onInput={(e) => setQ((e.target as HTMLInputElement).value)}
            onKeyDown={(e) => {
              const first = shown.find((p): p is Page => typeof p !== 'string');
              if (e.key === 'Enter' && first) go(first[0]);
            }}
          />
        </label>
        {shown.map((p, i) =>
          p === 'sep' ? (
            !needle && <div class="g-sidebar-sep" role="separator" key={i} />
          ) : p === 'company' ? (
            !needle && (
              <h3 class="g-sidebar-label" key={i}>
                Company
              </h3>
            )
          ) : (
            <button type="button" class="g-sidebar-item" aria-current={p === current ? 'page' : undefined} onClick={() => go(p[0])} key={p[0]}>
              <Icon name={p[2]} />
              <span>{p[1]}</span>
              {mobile && <Icon name="pan-end" />}
            </button>
          ),
        )}
        {needle && !shown.some((p) => typeof p !== 'string') && <p class="gos-set-none">No setting matches "{q}".</p>}
      </div>
    </nav>
  );
  if (mobile && !current)
    return (
      <div class="g-split gos-set-mobile">
        {sidebar}
      </div>
    );
  const body: Record<string, () => ComponentChildren> = {
    general: () => <General />,
    agents: () => <Agents />,
    permissions: () => <Permissions />,
    keys: () => <Keys />,
    apps: () => <Apps />,
    devices: () => <Devices />,
    remote: () => <RemoteAccess />,
    updates: () => <Updates />,
    privacy: () => <Privacy />,
    appearance: () => <Appearance />,
    about: () => <About />,
    people: () => <PeoplePage />,
    rules: () => <RulesPage />,
    'kill-switch': () => <KillSwitchPage />,
  };
  const company = ['people', 'rules', 'kill-switch'].includes(current![0]);
  return (
    <div class="g-split">
      {!mobile && sidebar}
      <div class="g-split-main">
        <HeaderBar title={current![1]} start={mobile && <IconButton icon="go-previous" label="All settings" onClick={() => win?.navigate('settings')} />} />
        <div class="g-window-content">
          <div class="g-prefs" key={current![0]}>
            {!b.owner && !company && <ReadOnly />}
            {body[current![0]]()}
          </div>
        </div>
      </div>
    </div>
  );
}

const Value = ({ children, tone }: { children: ComponentChildren; tone?: 'success' }) => <span class={`gos-set-value${tone ? ` t-${tone}` : ''}`}>{children}</span>;

// ---------- General ----------

function General() {
  const b = useBox();
  const s = b.system;
  const [busy, setBusy] = useState(false);
  const nets = (s?.network.interfaces ?? []).filter((i) => !i.address.startsWith('127.') && i.address !== '::1');
  const reopen = () => {
    setBusy(true);
    api('POST', '/setup/reopen').then(loadSetup, () => setBusy(false));
  };
  return (
    <>
      <Group title="This computer">
        <Row icon="network-server" title="Name" sub="Set during setup">
          <Value>{s?.boxName ?? selfBox().name}</Value>
        </Row>
        <Row title="Address on your network">
          <Value>{s?.hostname ?? location.hostname}</Value>
        </Row>
        <Row icon="preferences-system-time" title="Time zone">
          <Value>{s?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone}</Value>
        </Row>
      </Group>
      <Group title="Network">
        {nets.map((i) => (
          <Row icon={/^wl/.test(i.name) ? 'network-wireless-signal-excellent' : 'network-wired'} title={`${/^wl/.test(i.name) ? 'Wi-Fi' : 'Ethernet'} (${i.name})`} sub={i.address} key={i.name + i.address}>
            <Value tone={s?.network.online ? 'success' : undefined}>{s?.network.online ? 'Connected' : 'No internet'}</Value>
          </Row>
        ))}
        {!nets.length && <Row icon="network-offline" title="No network" sub="This computer reports no address" />}
      </Group>
      <Group title="Setup">
        <Row title="Run setup again" sub="Shows the setup window on this screen">
          <Button onClick={reopen} disabled={!b.owner || busy}>
            Run setup
          </Button>
        </Row>
      </Group>
    </>
  );
}

// ---------- Agents & Models ----------

function Agents() {
  const b = useBox();
  const [vault, reload] = useVault();
  const [sheet, setSheet] = useState<string>();
  const today = dayOf();
  let model = 0;
  let tools = 0;
  let modelId = '';
  for (const e of b.events) {
    if (e.type === 'cost' && e.model) modelId = e.model;
    if (dayOf(e.at) !== today) continue;
    if (e.type === 'cost') e.model ? (model += e.cents) : (tools += e.cents);
    if (e.type === 'tool.result') tools += e.cents ?? 0;
  }
  const ran = [...b.tasks.values()].filter((t) => dayOf(t.createdAt) === today).length;
  const keyRow = (name: string, what: string) => {
    const k = vault?.find((x) => x.name === name);
    const other = vault?.some((x) => x.name !== name && MODEL_KEYS.includes(x.name));
    return (
      <Row title={what} sub={!b.owner ? 'Only the owner sees which keys are set' : k ? `${name} · ${k.setAt ? `set ${when(k.setAt)}` : 'set outside Settings'}` : `${name} · ${other ? 'not needed, the other key is set' : "not set: tasks can't run until one model key is"}`}>
        <Button onClick={() => setSheet(name)} disabled={!b.owner}>
          {k ? 'Replace' : 'Set key'}
        </Button>
      </Row>
    );
  };
  return (
    <>
      <Group title="Agents" caption="Every task runs as its own user, with an agent inside. Agents use Claude.">
        <Row icon="applications-science" title="Claude" sub="Through Factory's Droid">
          <Value>Default</Value>
        </Row>
        <Row title="Model" sub={modelId ? 'The last one a task used' : "Droid's own default for Claude"}>
          <Value>{modelId || 'Default'}</Value>
        </Row>
      </Group>
      <Group title="Model key" caption="One is enough: an Anthropic API key (console.anthropic.com, bills your Anthropic account) or a Factory API key (app.factory.ai, uses Factory credits). Write-only. Agents never see it.">
        {keyRow('ANTHROPIC_API_KEY', 'Anthropic API key')}
        {keyRow('FACTORY_API_KEY', 'Factory API key')}
        <LinkRow title="Other keys" sub="Keys for the apps that are on" onClick={() => open('settings/keys')} />
      </Group>
      <Group title="Today" caption="Estimates, from the action log">
        <Row title="Spent on models">
          <Value>{dollars(model)}</Value>
        </Row>
        <Row title="Spent on tools">
          <Value>{dollars(tools)}</Value>
        </Row>
        <Row title="Tasks run">
          <Value>{ran}</Value>
        </Row>
      </Group>
      {sheet && <KeySheet name={sheet} onClose={() => setSheet(undefined)} onSaved={reload} />}
    </>
  );
}

// ---------- Permissions ----------

const money = (cents: number[], current: number, none?: string): [string, string][] =>
  [...new Set([...cents, current])].sort((a, b) => a - b).map((c) => [String(c), c === 0 && none ? none : dollars(c)]);
const HOURS = ['22:00-07:00', '23:00-07:00', '21:00-06:00', '00:00-08:00'];

function Permissions() {
  const b = useBox();
  const set = useSet();
  const s = b.settings;
  const [sheet, setSheet] = useState<'hosts' | 'folder'>();
  if (!s) return <Loading />;
  const ro = !b.owner;
  const hours = `${s.quietHours.from}-${s.quietHours.to}`;
  return (
    <>
      <Group title="Internet" caption="What a new task may reach. An app's own hosts are listed in App Center.">
        <ComboRow
          title="Internet for new tasks"
          sub={s.networkDefault === 'none' ? 'A task reaches only the sites it names. The rest is blocked and logged.' : 'Other sites are blocked and logged'}
          value={s.networkDefault}
          options={[
            ['none', 'Only sites the task names'],
            ['allowlist', 'Only the sites below'],
          ]}
          onChange={(v) => set({ networkDefault: v })}
          disabled={ro}
        />
        <LinkRow title="Sites any task may reach" sub={s.defaultHosts.length ? s.defaultHosts.join(', ') : undefined} value={s.defaultHosts.length ? plural(s.defaultHosts.length, 'site') : 'None'} onClick={() => !ro && setSheet('hosts')} />
      </Group>
      {(b.system?.owner || s.agentFolders.length > 0) && (
      <Group title="Folders agents may use" caption={s.agentFolders.length ? 'Agents work on a copy. You keep or undo their changes in Time Machine.' : 'None chosen yet, so a task may work on a copy of any folder you give it.'}>
        {s.agentFolders.map((f) => (
          <Row icon="folder" title={f.split('/').filter(Boolean).at(-1) ?? f} sub={f} key={f}>
            <Value>May change</Value>
            {!ro && <IconButton icon="list-remove" label={`Remove ${f}`} onClick={() => set({ agentFolders: s.agentFolders.filter((x) => x !== f) })} />}
          </Row>
        ))}
        {ro ? !s.agentFolders.length && <Row title="No folders chosen" /> : <AddRow title="Add a folder…" onClick={() => setSheet('folder')} />}
      </Group>
      )}
      <Group title="Spending" caption="A task stops and asks before going over.">
        <ComboRow
          title="Always ask before a single spend over"
          value={String(s.approvalThresholdCents)}
          options={money([100, 500, 1000, 2500, 5000, 10000], s.approvalThresholdCents)}
          onChange={(v) => set({ approvalThresholdCents: +v })}
          disabled={ro}
        />
        <ComboRow
          title="Budget for a task that names none"
          sub="When it runs out, the task stops and asks"
          value={String(s.defaultBudgetCents)}
          options={money([0, 25, 50, 100, 500], s.defaultBudgetCents, 'None: every spend asks')}
          onChange={(v) => set({ defaultBudgetCents: +v })}
          disabled={ro}
        />
      </Group>
      <Group title="Quiet hours">
        <SwitchRow title="Quiet hours" sub="Requests wait without a sound. Nothing over the limit is spent." checked={s.quietHours.enabled} onChange={(v) => set({ quietHours: { enabled: v } })} disabled={ro} />
        <ComboRow
          title="Hours"
          value={hours}
          options={[...new Set([hours, ...HOURS])].map((h) => [h, h.replace('-', ' to ')])}
          onChange={(v) => {
            const [from, to] = v.split('-');
            void set({ quietHours: { from, to } });
          }}
          disabled={ro || !s.quietHours.enabled}
        />
      </Group>
      <AppPermissions />
      {sheet === 'hosts' && <HostsSheet onClose={() => setSheet(undefined)} />}
      {sheet === 'folder' && <FolderSheet onClose={() => setSheet(undefined)} />}
    </>
  );
}

function HostsSheet({ onClose }: { onClose: () => void }) {
  const [text, setText] = useState(box.settings!.defaultHosts.join('\n'));
  const [error, setError] = useState('');
  const save = () =>
    patchSettings({ defaultHosts: text.split(/[\s,]+/).filter(Boolean) }).then(onClose, (e) => setError((e as Error).message));
  return (
    <InWindow>
      <Sheet title="Sites any task may reach" onCancel={onClose} onDone={() => void save()} done="Save">
        <label class="gos-field">
          <span class="t-body-strong">One site on each line</span>
          <textarea class="g-field gos-set-mono" rows={6} value={text} placeholder={'api.example.com\n*.example.com'} spellcheck={false} onInput={(e) => setText((e.target as HTMLTextAreaElement).value)} />
          <span class="t-caption t-secondary">With "Only the sites below", a task that names no sites may reach these. Everything else is blocked and logged.</span>
        </label>
        {error && (
          <p class="gos-error" role="alert">
            Not saved: {error}
          </p>
        )}
      </Sheet>
    </InWindow>
  );
}

function FolderSheet({ onClose }: { onClose: () => void }) {
  const [path, setPath] = useState('');
  const [error, setError] = useState('');
  const save = () =>
    patchSettings({ agentFolders: [...box.settings!.agentFolders, path.trim().replace(/\/+$/, '')] }).then(onClose, (e) => setError((e as Error).message));
  return (
    <InWindow>
      <Sheet title="Add a folder" onCancel={onClose} onDone={() => void save()} done="Add" doneDisabled={!path.trim().startsWith('/')}>
        <label class="gos-field">
          <span class="t-body-strong">Folder</span>
          <input class="g-field gos-set-mono" value={path} placeholder="/home/you/Documents" spellcheck={false} onInput={(e) => setPath((e.target as HTMLInputElement).value)} onKeyDown={(e) => e.key === 'Enter' && path.trim().startsWith('/') && void save()} />
          <span class="t-caption t-secondary">The full path. Agents get a copy of it, never the folder itself.</span>
        </label>
        {error && (
          <p class="gos-error" role="alert">
            Not added: {error}
          </p>
        )}
      </Sheet>
    </InWindow>
  );
}

// ---------- Accounts & Keys ----------

function Keys() {
  const b = useBox();
  const [vault, reload] = useVault();
  const [sheet, setSheet] = useState<string | null>();
  const [devices, setDevices] = useState<Device[]>();
  useEffect(() => void api<Device[]>('GET', '/devices').then(setDevices, () => setDevices([])), []);
  const users = new Map<string, string[]>(MODEL_KEYS.map((k) => [k, ['Agents (one model key is enough)']]));
  // Keys of apps that are on, and any key already in the vault. An app that is off lists its keys in App Center.
  for (const a of b.allApps) if (a.status !== 'disabled') for (const s of a.access.secrets) users.set(s.name, [...(users.get(s.name) ?? []), appTitle(a)]);
  // Droid's key first, then the rest by name.
  const names = [...new Set([...(vault ?? []).map((k) => k.name), ...users.keys()])].sort((x, y) => +MODEL_KEYS.includes(y) - +MODEL_KEYS.includes(x) || x.localeCompare(y));
  const owners = devices?.filter((d) => d.owner) ?? [];
  return (
    <>
      <div class="g-banner g-banner-accent gos-set-banner" role="note">
        <Icon name="security-high" />
        <div class="t-body">GurtOS keeps keys where agents can't read them. You can replace a key but never see it. No screen, phone or log shows one.</div>
      </div>
      <Group title="Keys" caption="The model keys, and the keys of apps that are on. App Center lists the keys each app needs before you turn it on.">
        {names.map((n) => {
          const k = vault?.find((x) => x.name === n);
          const by = users.get(n)?.join(', ');
          const state = !b.owner ? undefined : k ? (k.setAt ? `set ${when(k.setAt)}` : 'set outside Settings') : 'not set';
          return (
            <Row title={keyLabel(n)} sub={[n, by, state].filter(Boolean).join(' · ')} key={n}>
              <Button onClick={() => setSheet(n)} disabled={!b.owner}>
                {k ? 'Replace' : 'Set key'}
              </Button>
            </Row>
          );
        })}
        {b.owner && <AddRow title="Add a key…" onClick={() => setSheet(null)} />}
      </Group>
      <Group title="Owner">
        {owners.map((d) => (
          <Row icon="phone" title={d.name} sub="Approves spending and changes settings" key={d.id}>
            <Value>Owner</Value>
          </Row>
        ))}
        <Row icon="computer" title="This computer's own screen" sub={owners.length ? 'Always the owner' : 'Pair the owner\'s phone in Devices to change settings from it too'}>
          <Value>Owner</Value>
        </Row>
      </Group>
      {sheet !== undefined && <KeySheet name={sheet ?? undefined} onClose={() => setSheet(undefined)} onSaved={reload} />}
    </>
  );
}

// ---------- Apps ----------

function Apps() {
  const b = useBox();
  const toggle = useToggleApp();
  return (
    <>
      <Group title="Installed apps" caption="Turning an app off takes out its tools, windows and triggers at once. Nothing is uninstalled.">
        {[...b.allApps].sort(byApp).map((a) => {
          const st = appStatus(a);
          return (
            <label class="g-approw" key={a.id}>
              <AppIcon id={a.id} title={appTitle(a)} size={44} />
              <span class="g-approw-text">
                <span class="g-approw-name">{appTitle(a)}</span>
                <span class={`g-approw-desc${st.tone ? ` t-${st.tone}` : ''}`}>{testApp(a) ? `${st.text} · test only` : st.text}</span>
              </span>
              <input
                type="checkbox"
                role="switch"
                class="g-switch"
                checked={a.status === 'enabled'}
                disabled={!b.owner}
                aria-label={`${appTitle(a)} on`}
                onChange={(e) => void toggle(a, (e.target as HTMLInputElement).checked)}
              />
            </label>
          );
        })}
        {!b.allApps.length && <Row title="No apps installed" />}
      </Group>
      <Group>
        <LinkRow icon="view-app-grid" title="App Center" sub="What each app can reach and the keys it needs" onClick={() => open('app-center')} />
      </Group>
    </>
  );
}

// ---------- Devices ----------

interface Device {
  id: string;
  name: string;
  pairedAt: string;
  owner?: boolean;
  /** It gets notifications (GET /api/devices never shows the subscription itself). */
  push?: boolean;
  /** When it last called GurtOS, if GurtOS reports it. */
  lastSeen?: string;
}
export const formatCode = (c: string) => c.toUpperCase().match(/.{1,4}/g)?.join('-') ?? c;
const loopback = ['127.0.0.1', 'localhost'].includes(location.hostname);
/** The link in a pairing QR (relay.ts pairLink), with this page's own address for an older core's bare code. */
export function pairLink(c: PairCode, relayUp: boolean | undefined) {
  const self = selfBox().url;
  return link(c, relayUp, self ? new URL(self).origin : loopback ? undefined : location.origin);
}

export function Qr({ text, label, class: cls }: { text: string; label: string; class?: string }) {
  const q = qrcode(0, 'M');
  q.addData(text);
  q.make();
  return <div class={cls} role="img" aria-label={label} dangerouslySetInnerHTML={{ __html: q.createSvgTag({ cellSize: 6, margin: 0, scalable: true }) }} />;
}

function Devices() {
  const b = useBox();
  const win = useWin();
  const now = useNow(1000);
  const [asOwner, setAsOwner] = useState(false);
  const [code, setCode] = useState<PairCode | string>();
  const [devices, setDevices] = useState<Device[]>();
  const [revoke, setRevoke] = useState<Device>();
  /** The phone that just used the code. The used code stays up for 10 s so you can compare it with the phone. */
  const [justPaired, setJustPaired] = useState<Device>();
  const fresh = () => (b.owner ? api<PairCode>('POST', '/pair/start', asOwner ? { owner: true } : {}).then(setCode, (e) => setCode((e as Error).message)) : undefined);
  useEffect(() => void fresh(), [asOwner, b.owner]);
  useEffect(() => {
    if (!b.owner) return; // listing phones is owner only
    let known: Set<string> | undefined;
    let next = 0;
    const poll = () =>
      api<Device[]>('GET', '/devices').then(
        (d) => {
          const added = known && d.find((x) => !known!.has(x.id));
          if (added) {
            setJustPaired(added);
            clearTimeout(next);
            next = setTimeout(() => (setJustPaired(undefined), void fresh()), 10_000);
          }
          known = new Set(d.map((x) => x.id));
          setDevices(d);
        },
        () => setDevices(undefined),
      );
    void poll();
    const t = setInterval(poll, 3000);
    return () => (clearInterval(t), clearTimeout(next));
  }, [asOwner, b.owner]);
  useEffect(() => {
    if (typeof code !== 'object' || justPaired) return;
    const t = setTimeout(fresh, Math.max(5000, Date.parse(code.expiresAt) - Date.now()));
    return () => clearTimeout(t);
  }, [code, justPaired]);
  const doRevoke = (d: Device) =>
    api('DELETE', `/devices/${d.id}`).then(
      () => (setDevices(devices?.filter((x) => x.id !== d.id)), setRevoke(undefined), win?.toast(`${d.name} can no longer answer`)),
      (e) => (setRevoke(undefined), win?.toast(`Could not revoke: ${(e as Error).message}`)),
    );
  const up = useRelayUp();
  const url = typeof code === 'object' ? pairLink(code, up) : undefined;
  const left = typeof code === 'object' ? Math.max(0, Math.round((Date.parse(code.expiresAt) - now) / 1000)) : 0;
  const paired = (d: Device) => new Date(d.pairedAt).toLocaleString('en-US', { weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).replace(',', '');
  // The same phone paired twice leaves an older pairing with its name: offer to remove those.
  const me = pairing()?.device.id;
  const newest = new Map<string, string>();
  for (const d of [...(devices ?? [])].sort((x, y) => x.pairedAt.localeCompare(y.pairedAt))) newest.set(d.name, d.id);
  const older = (devices ?? []).filter((d) => newest.get(d.name) !== d.id && d.id !== me);
  const [clearing, setClearing] = useState(false);
  const clearOlder = async () => {
    setClearing(true);
    for (const d of older) await api('DELETE', `/devices/${d.id}`).catch(() => {});
    setDevices(devices?.filter((x) => !older.includes(x)));
    setClearing(false);
    win?.toast(`Removed ${plural(older.length, 'older pairing')}`);
  };
  return (
    <>
      <Notifications />
      <Group title="Paired phones" caption="A phone can approve or deny. It never holds a key. Revoking one stops its token at once.">
        {devices?.map((d) => (
          <Row
            icon="phone"
            title={d.id === me ? `${d.name} (this phone)` : d.name}
            sub={`${d.owner ? 'Owner' : 'Can approve'} · ${older.includes(d) ? `older pairing, paired again later` : `paired ${paired(d)}`}${d.lastSeen ? ` · seen ${when(d.lastSeen)}` : ''}${d.push ? ' · notifications on' : ''}`}
            key={d.id}
          >
            <Button onClick={() => setRevoke(d)} disabled={!b.owner}>
              Revoke
            </Button>
          </Row>
        ))}
        {devices?.length === 0 && <Row icon="phone" title="No phone yet" sub="Pair one below" />}
        {b.owner && older.length > 0 && (
          <Row title={`${plural(older.length, 'older pairing')} of the same ${older.length === 1 ? 'phone' : 'phones'}`} sub="Each phone was paired again. The newest pairing of each keeps working.">
            <Button onClick={() => void clearOlder()} disabled={clearing}>
              Remove {older.length === 1 ? 'it' : 'them'}
            </Button>
          </Row>
        )}
        {!devices && <Row title={b.owner ? 'GurtOS did not list the paired phones' : 'Only the owner sees the paired phones'} />}
      </Group>
      {!b.owner ? (
        <Group title="Pair a phone">
          <Row icon="security-high" title="Pair from this computer's own screen" sub="Pairing codes come from this computer's screen or the owner's phone, so a stranger on the network can't pair." />
        </Group>
      ) : (
      <Group title="Pair a phone">
        <div class="gos-set-pair">
          <div class="gos-set-qr">
            {url ? (
              <Qr text={url} label="Pairing link as a QR code" />
            ) : typeof code === 'string' ? (
              `Pairing is not available: ${code}`
            ) : code && up !== undefined ? (
              `This screen does not know the address phones use. Open ${PRODUCT} from a laptop for the QR code.`
            ) : (
              'Making a code…'
            )}
          </div>
          <div class="gos-set-pair-text">
            <p class="t-body">1. Point the phone's camera at the code.</p>
            <p class="t-body">2. {PRODUCT} opens on the phone.</p>
            <p class="t-body">3. Check the phone shows the same code, then name it.</p>
            {url && <p class="t-caption t-secondary">{pairNote(url)}</p>}
            {typeof code === 'object' && (
              <>
                <p class="gos-set-code" aria-label={`Code ${code.code.split('').join(' ')}`}>
                  {formatCode(code.code)}
                </p>
                {justPaired ? (
                  <p class="t-body-strong t-success" role="status">
                    <Icon name="object-select" /> Paired: {justPaired.name}
                  </p>
                ) : (
                  <p class="t-caption t-secondary">
                    The code works once and changes in {Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}.
                  </p>
                )}
              </>
            )}
            {b.owner && (
              <label class="t-body">
                <input type="checkbox" role="switch" class="g-switch" checked={asOwner} onChange={(e) => setAsOwner((e.target as HTMLInputElement).checked)} />
                It is the owner's phone: it may change settings and keys
              </label>
            )}
          </div>
        </div>
      </Group>
      )}
      {revoke && (
        <Alert
          title={`Revoke ${revoke.name}?`}
          body="Its token stops working at once. It can pair again with a new code."
          action="Revoke"
          destructive
          onConfirm={() => void doRevoke(revoke)}
          onCancel={() => setRevoke(undefined)}
        />
      )}
    </>
  );
}

// ---------- Updates ----------

function Updates() {
  const sys = useBox().system;
  return (
    <>
      <div class="gos-set-slots">
        <div class="gos-set-slot is-current">
          <div class="gos-set-slot-head">
            <Icon name="network-server" />
            This system
            <Badge kind="success">Running</Badge>
          </div>
          <p>
            {sys ? `${sys.editionName} ${sys.version}, build ${sys.build}. Started ${when(sys.startedAt)}.` : 'Loading…'}
          </p>
        </div>
      </div>
      <Group title="How updates work">
        <Row icon="software-update-available" title="A whole system at a time" sub={`Each update installs into a second copy of the system. If it doesn't start cleanly, ${PRODUCT} goes back to this one by itself.`} />
      </Group>
    </>
  );
}

// ---------- Privacy & Logs ----------

function Privacy() {
  const b = useBox();
  const set = useSet();
  const toggle = useToggleApp();
  const s = b.settings;
  if (!s) return <Loading />;
  const ro = !b.owner;
  const days = String(s.logRetentionDays);
  const label = (d: number) => (d % 365 === 0 ? plural(d / 365, 'year') : plural(d, 'day'));
  // Optional apps that send the log or task titles out. Listed here only while one is on, so it can be turned off.
  const share = (id: string, title: string, sub: string) => {
    const a = b.allApps.find((x) => x.id === id && x.status === 'enabled');
    return a && <SwitchRow title={title} sub={sub} checked onChange={(v) => void toggle(a, v)} disabled={ro} />;
  };
  const sharing = [share('elastic', 'Copy the log to Elastic', 'With the Ask GurtOS app'), share('mana', 'Public status page', 'Mana status shows task titles and states, never prompts or files')].filter(Boolean);
  return (
    <>
      <Group title="The action log" caption="Every step every agent takes. It stays on this computer and holds no keys.">
        <ComboRow
          title="Keep the log for"
          value={days}
          options={[...new Set([30, 90, 365, 1095, 3650, s.logRetentionDays])].sort((x, y) => x - y).map((d) => [String(d), label(d)])}
          onChange={(v) => set({ logRetentionDays: +v })}
          disabled={ro}
        />
        <Row icon="utilities-terminal" title="Size">
          <Value>{plural(b.events.at(-1)?.seq ?? 0, 'event')}</Value>
        </Row>
        <Row title="Where it lives">
          <span class="gos-set-value">
            <code class="gos-set-mono">log.jsonl</code> in GurtOS's data folder
          </span>
        </Row>
        <Row title="Read the log">
          <Button onClick={() => open('activity')}>Open Activity</Button>
        </Row>
      </Group>
      <Group title="Sharing" caption={sharing.length ? 'Turn one off and nothing more is sent.' : undefined}>
        {sharing.length ? sharing : <Row icon="preferences-system-privacy" title="Nothing is shared" sub="The log and your tasks stay on this computer." />}
      </Group>
    </>
  );
}

// ---------- Appearance ----------

const ACCENTS: [string, string][] = [
  ['', 'Blue'],
  ['#2e6b5e', 'Teal'],
  ['#3c6b3f', 'Green'],
  ['#5a6270', 'Slate'],
  ['#9a5236', 'Rust'],
];

function Appearance() {
  const b = useBox();
  const set = useSet();
  const s = b.settings;
  const [, redraw] = useState(0);
  if (!s) return <Loading />;
  const ro = !b.owner;
  const theme = s.appearance.theme;
  const radio = <T extends string>(items: T[], value: T, pick: (v: T) => void) => (e: KeyboardEvent) => {
    const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!d || ro) return;
    e.preventDefault();
    const next = items[(items.indexOf(value) + d + items.length) % items.length];
    pick(next);
    requestAnimationFrame(() => ((e.currentTarget as HTMLElement | null)?.querySelector('[aria-checked="true"]') as HTMLElement | null)?.focus());
  };
  const pickTheme = (t: typeof theme) => set({ appearance: { theme: t } });
  const pickAccent = (a: string) => set({ appearance: { accent: a } });
  const acc = (k: 'larger-text' | 'contrast' | 'reduce-motion') => (on: boolean) => (access.set(k, on), redraw((n) => n + 1));
  const themes: [typeof theme, string, JSX.Element][] = [
    ['light', 'Light', <Mini />],
    ['dark', 'Dark', <Mini dark />],
    ['system', 'Follow this device', <><Mini /><Mini dark half /></>],
  ];
  return (
    <>
      <section class="g-group">
        <div class="g-group-head">
          <h3 class="g-group-title" id="gos-set-style">
            Style
          </h3>
        </div>
        <div class="gos-set-themes" role="radiogroup" aria-labelledby="gos-set-style" onKeyDown={radio(themes.map((t) => t[0]), theme, pickTheme)}>
          {themes.map(([v, label, mini]) => (
            <button type="button" role="radio" class="gos-set-theme" aria-checked={v === theme} tabIndex={v === theme ? 0 : -1} disabled={ro} onClick={() => pickTheme(v)} key={v}>
              <span class="gos-set-preview" aria-hidden="true">
                {mini}
              </span>
              {label}
            </button>
          ))}
        </div>
      </section>
      <section class="gos-set-accent">
        <h3 class="g-group-title" id="gos-set-accent">
          Accent color
        </h3>
        <div class="gos-set-swatches" role="radiogroup" aria-labelledby="gos-set-accent" onKeyDown={radio(ACCENTS.map((a) => a[0]), s.appearance.accent, pickAccent)}>
          {ACCENTS.map(([hex, name]) => (
            <button
              type="button"
              role="radio"
              class="gos-set-swatch"
              aria-checked={hex === s.appearance.accent}
              aria-label={name}
              title={name}
              tabIndex={hex === s.appearance.accent ? 0 : -1}
              disabled={ro}
              style={{ '--swatch': hex || '#2f64a6' } as JSX.CSSProperties}
              onClick={() => pickAccent(hex)}
              key={name}
            />
          ))}
        </div>
        <p class="t-caption t-secondary">Amber and red keep their meaning in every theme: amber waits for you, red undoes or blocks.</p>
      </section>
      <Group title="Display">
        <Row icon="computer" title="Wallpaper">
          <Value>Night hills</Value>
        </Row>
      </Group>
      <Group title="Accessibility" caption="These apply to this screen only.">
        <SwitchRow icon="preferences-desktop-accessibility" title="Larger text" checked={access.get('larger-text')} onChange={acc('larger-text')} />
        <SwitchRow title="High contrast" checked={access.get('contrast')} onChange={acc('contrast')} />
        <SwitchRow title="Reduce motion" checked={access.get('reduce-motion')} onChange={acc('reduce-motion')} />
      </Group>
    </>
  );
}

const Mini = ({ dark, half }: { dark?: boolean; half?: boolean }) => (
  <span class={`gos-set-mini${dark ? ' is-dark' : ''}${half ? ' is-half' : ''}`}>
    <i />
    <i />
    <i />
    <b />
  </span>
);

// ---------- About ----------

function About() {
  const b = useBox();
  const now = useNow(60_000);
  const s = b.system;
  const up = s ? Math.max(0, Math.round((now - Date.parse(s.startedAt)) / 60_000)) : 0;
  const upText = up < 60 ? plural(up, 'min', 'min') : up < 1440 ? `${Math.floor(up / 60)} h ${up % 60} min` : plural(Math.floor(up / 1440), 'day');
  return (
    <>
      <div class="gos-set-about-head">
        <p class="gos-set-wordmark" aria-label={PRODUCT}>
          {PRODUCT.replace(/OS$/, '')}
          <span>{PRODUCT.endsWith('OS') ? 'OS' : ''}</span>
        </p>
        <p class="t-body t-secondary">{s ? `${s.editionName} ${s.version}` : PRODUCT}</p>
      </div>
      <Group title="This computer">
        <Row title="Name">
          <Value>{s?.boxName ?? selfBox().name}</Value>
        </Row>
        <Row title="Edition">
          <Value>{s?.editionName ?? '…'}</Value>
        </Row>
        <Row title="Version">
          <Value>{s ? `${s.version}, build ${s.build}` : '…'}</Value>
        </Row>
        <Row title="Base">
          <Value>Ubuntu 24.04 LTS</Value>
        </Row>
        <Row title="Computer ID">
          <span class="gos-set-value gos-set-mono">{s?.boxId ?? '…'}</span>
        </Row>
        <Row title="Up for">
          <Value>{s ? upText : '…'}</Value>
        </Row>
      </Group>
      <Group title="Open source">
        <Row
          icon="help-about"
          title={`${PRODUCT} is open source under the Apache License 2.0`}
          sub={
            <a href="https://github.com/benz16107/calhacks13" target="_blank" rel="noopener">
              github.com/benz16107/calhacks13
            </a>
          }
        />
      </Group>
      <Group title="Credits">
        <Row title="Symbolic icons" sub="Adwaita">
          <Value>GNOME Project, CC BY-SA 3.0 or LGPL 3</Value>
        </Row>
        <Row title="Typeface" sub="Atkinson Hyperlegible Next and Mono">
          <Value>Braille Institute, SIL Open Font License</Value>
        </Row>
      </Group>
    </>
  );
}

const Loading = () => <div class="gos-skeleton gos-skeleton-short" aria-busy="true" aria-label="Loading" />;
