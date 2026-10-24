// The first-run setup wizard (Figma 54:86 to 75:2286, docs/figma/os-v2/README.md "Setup, Server"). One window on
// the wallpaper, one decision per step. Each step is recorded with POST /api/setup/step; the last one finishes
// setup and main.tsx shows the desktop. Switches and lists apply at once, like everywhere else in GurtOS.
import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import qrcode from 'qrcode-generator';
import { api, box, loadApps, loadSetup, patchSettings, surface, useBox, type AppInfo } from './live.ts';
import { AppIcon, Badge, Button, Chip, ComboRow, Group, Icon, IconButton, LinkRow, Popover, Row, Sheet, SwitchRow, ToggleGroup } from './kit/ui.tsx';
import { access } from './shell.tsx';
import { phone } from './wm.tsx';
import { PRODUCT } from './product.ts';
import { dollars, hhmm, keyLabel, plural, selfBox, sentence, useNow } from './util.ts';
import './setup.css';
import { RemoteAccess } from './apps/remote.tsx';

interface Step {
  id: string;
  label: string;
  optional?: boolean;
  /** Next stays off until this is true. Skip (or skipLabel) is the way past it. */
  ready?: (w: Wiz) => boolean;
  skipLabel?: string;
  page: (w: Wiz) => ComponentChildren;
  summary: (w: Wiz) => string;
  data?: (w: Wiz) => Record<string, unknown>;
}
interface Draft {
  language: string;
  keyboard: string;
  boxName: string;
  timezone: string;
  autoTime: boolean;
  owner: 'phone' | 'screen';
}
interface Wiz {
  draft: Draft;
  set: (p: Partial<Draft>) => void;
  vault: Vault[];
  reloadVault: () => void;
  setKey: (name: string) => void;
  fail: (e: unknown) => void;
}
interface Vault {
  name: string;
  setAt: string | null;
}
interface PairCode {
  code: string;
  url: string;
  expiresAt: string;
}
interface Device {
  id: string;
  name: string;
  pairedAt: string;
  owner?: boolean;
}

const apply = (w: Wiz, patch: Record<string, unknown>) => void patchSettings(patch).catch(w.fail);
const vaultEntry = (w: Wiz, name: string) => w.vault.find((v) => v.name === name);
const keySet = (w: Wiz, name: string) => !!vaultEntry(w, name) || box.allApps.some((a) => a.access.secrets.some((s) => s.name === name && s.set));
const setText = (w: Wiz, name: string) => {
  const at = vaultEntry(w, name)?.setAt;
  return at ? `Set at ${hhmm(at)}` : 'Set';
};
/** An app's name for people: its window's title, else its id in sentence case ('credit-desk' is Credit desk). */
const nice = (a: AppInfo) => {
  const t = (a.ui[0]?.title ?? a.title).replace(/\s*\(.*\)$/, '');
  return t === a.id ? a.id[0].toUpperCase() + a.id.slice(1).replaceAll('-', ' ') : t;
};
// Setup offers six apps; the rest are in App Center. The model app has its own step.
const ORDER = ['find', 'shopper', 'wallet', 'credit-desk', 'jira', 'fetch'];
const offered = () => ORDER.map((id) => box.allApps.find((a) => a.id === id)).filter((a): a is AppInfo => !!a);
const enabled = () => offered().filter((a) => a.status === 'enabled');
/** The keys the apps that are on need, each once: the Apps step's footer and the Keys step count the same list. */
const needed = () => [...new Map(enabled().flatMap((a) => a.access.secrets.filter((s) => !s.optional)).map((s) => [s.name, s])).values()];
const list = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`);
/** What an app may reach, in words: "Reaches visa.com and cybersource.com", or that it stays on this computer. */
function reach(a: AppInfo) {
  const domains = [...new Set(a.access.hosts.filter((h) => /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(h)).map((h) => h.split('.').slice(-2).join('.')))];
  if (!domains.length) return a.access.hosts.length ? 'Stays on this computer' : 'No internet';
  return `Reaches ${list(domains.length > 3 ? [...domains.slice(0, 2), `${domains.length - 2} more`] : domains)}`;
}
/** The model key that lets agents think: an Anthropic key or a Factory key. Either one is enough. */
const MODEL_KEYS = ['ANTHROPIC_API_KEY', 'FACTORY_API_KEY'] as const;
const modelKey = (w: Wiz) => MODEL_KEYS.find((k) => keySet(w, k));
const iface = () => box.system?.network.interfaces.find((i) => !i.address.startsWith('127.') && i.name !== 'lo');
const wifi = (name = '') => name.startsWith('w');

// ---------- the steps ----------

export const STEPS: Step[] = [
  {
    id: 'welcome',
    label: 'Welcome',
    page: (w) => (
      <div class="gos-setup-split">
        <div class="gos-setup-col">
          <Intro big title={`Welcome to ${PRODUCT}`}>
            {PRODUCT} runs AI agents on this computer. Each agent works in its own space and asks you before it spends money or reaches somewhere new. Setup takes about 10 minutes. Steps marked optional can be skipped.
          </Intro>
          <div class="g-list">
            <ComboRow icon="preferences-desktop-locale" title="Language" value={w.draft.language} options={[['en-US', 'English (United States)']]} onChange={(v) => w.set({ language: v })} />
            <ComboRow icon="preferences-desktop-keyboard" title="Keyboard" value={w.draft.keyboard} options={[['us', 'English (US)']]} onChange={(v) => w.set({ keyboard: v })} />
          </div>
          <Access />
        </div>
        {!phone() && <PhoneHandoff />}
      </div>
    ),
    summary: () => '',
    data: (w) => ({ language: w.draft.language, keyboard: w.draft.keyboard, largerText: access.get('larger-text'), highContrast: access.get('contrast'), reduceMotion: access.get('reduce-motion') }),
  },
  {
    id: 'network',
    label: 'Network',
    page: () => {
      const all = (box.system?.network.interfaces ?? []).filter((i) => i.name !== 'lo' && !i.address.startsWith('127.'));
      const online = box.system?.network.online !== false;
      return (
        <div class="gos-setup-col">
          <Intro title="Connect to a network">GurtOS needs the internet for AI models and for apps that reach the web. A cable is the most reliable.</Intro>
          <Group title="Wired">
            {all.filter((i) => !wifi(i.name)).map((i) => (
              <Row icon="network-wired" title={`Ethernet (${i.name})`} sub={i.address} key={i.name}>
                <span class={online ? 't-success' : 't-secondary'}>{online ? 'Connected' : 'No internet'}</span>
              </Row>
            ))}
            {!all.some((i) => !wifi(i.name)) && <Row icon="network-offline" title="No cable" sub="Plug a network cable into this computer." />}
          </Group>
          <Group title="Wi-Fi" caption="Use Wi-Fi when there is no cable.">
            {all.filter((i) => wifi(i.name)).map((i) => (
              <Row icon="network-wireless-signal-excellent" title={`Wi-Fi (${i.name})`} sub={i.address} key={i.name}>
                <span class="t-success">Connected</span>
              </Row>
            ))}
          </Group>
        </div>
      );
    },
    summary: () => {
      const i = iface();
      if (box.system?.network.online === false) return 'This computer is offline. Connect it to finish setting up AI models.';
      return i ? `Online through ${wifi(i.name) ? 'Wi-Fi' : 'Ethernet'}.` : 'Online.';
    },
    data: () => ({ online: box.system?.network.online ?? null, interface: iface()?.name ?? null }),
  },
  {
    id: 'name',
    label: 'Name and time zone',
    page: (w) => <NameStep w={w} />,
    ready: (w) => NAME_OK.test(w.draft.boxName.trim()),
    summary: (w) => (NAME_OK.test(w.draft.boxName.trim()) ? 'Quiet hours and update times use this time zone.' : 'Give this computer a name to go on.'),
    data: (w) => ({ boxName: w.draft.boxName.trim(), timezone: w.draft.timezone, autoTime: w.draft.autoTime }),
  },
  {
    id: 'phone',
    label: 'Owner',
    page: (w) => <OwnerStep w={w} />,
    summary: () => "You can add more phones later. Only the owner's phone can change settings.",
    data: (w) => ({ owner: w.draft.owner, device: ownerDevice?.name ?? null }),
  },
  {
    id: 'remote',
    label: 'Remote access',
    optional: true,
    page: () => (
      <div class="gos-setup-col">
        <Intro title="Reach this computer from anywhere">Optional. Off until you turn it on, and you can change it later in Settings.</Intro>
        <RemoteAccess title="" />
      </div>
    ),
    summary: () => 'Without it, phones reach this computer only on your own network.',
  },
  {
    id: 'models',
    label: 'Model key',
    page: (w) => <ModelsStep w={w} />,
    ready: (w) => !!modelKey(w),
    skipLabel: 'Skip for now',
    summary: (w) => (modelKey(w) ? 'Model key saved. Agents can start tasks.' : "Add one key to go on. If you skip, agents can't start a task until you add a key in Settings."),
    data: (w) => ({ worker: 'droid', via: modelKey(w) === 'ANTHROPIC_API_KEY' ? 'anthropic' : modelKey(w) === 'FACTORY_API_KEY' ? 'factory' : 'none' }),
  },
  {
    id: 'safety',
    label: 'Permissions',
    page: (w) => <SafetyStep w={w} />,
    summary: () => "A spend over the limit always asks, even inside a task's budget.",
    data: () => {
      const s = box.settings;
      return s ? { networkDefault: s.networkDefault, defaultHosts: s.defaultHosts, approvalThresholdCents: s.approvalThresholdCents, defaultBudgetCents: s.defaultBudgetCents, quietHours: s.quietHours } : {};
    },
  },
  {
    id: 'apps',
    label: 'Apps',
    optional: true,
    page: (w) => <AppsStep w={w} />,
    summary: (w) => {
      const keys = needed().filter((s) => !keySet(w, s.name)).length;
      return `${plural(enabled().length, 'app')} on.${keys ? ` The next step asks for the ${plural(keys, 'key')} they need.` : ' They need no more keys.'}`;
    },
    data: () => ({ on: enabled().map((a) => a.id) }),
  },
  {
    id: 'keys',
    label: 'Keys for apps',
    optional: true,
    page: (w) => <KeysStep w={w} />,
    summary: (w) => {
      const all = needed();
      if (!all.length) return 'No app you turned on needs a key.';
      return `${all.filter((s) => keySet(w, s.name)).length} of ${all.length} keys set. An app with a missing key waits until you add it.`;
    },
    data: (w) => ({ set: needed().filter((s) => keySet(w, s.name)).map((s) => s.name), missing: needed().filter((s) => !keySet(w, s.name)).map((s) => s.name) }),
  },
  {
    id: 'updates',
    label: 'Updates',
    page: (w) => <UpdatesStep w={w} />,
    summary: () => 'You can go back to the previous system in Settings > Updates.',
    data: () => ({ autoUpdate: box.settings?.autoUpdate, updateChannel: box.settings?.updateChannel }),
  },
  {
    id: 'privacy',
    label: 'Privacy and logs',
    optional: true,
    page: (w) => <PrivacyStep w={w} />,
    summary: () => {
      const shared = [on('elastic') && 'the log copy to Elastic', on('mana') && 'the public status page'].filter(Boolean) as string[];
      return shared.length ? `On: ${list(shared)}. Everything else stays on this computer.` : 'Nothing leaves this computer unless you turn it on here.';
    },
    data: () => ({ logRetentionDays: box.settings?.logRetentionDays, elastic: on('elastic'), mana: on('mana') }),
  },
  {
    id: 'appearance',
    label: 'Appearance',
    optional: true,
    page: (w) => <AppearanceStep w={w} />,
    summary: () => {
      const a = box.settings?.appearance;
      const theme = THEMES.find(([v]) => v === a?.theme)?.[1] ?? 'Follow the system';
      const accent = ACCENTS.find(([v]) => v === (a?.accent || ACCENTS[0][0]))?.[1] ?? 'custom';
      return `${theme}, ${accent} accent.`;
    },
    data: () => ({ ...box.settings?.appearance }),
  },
  {
    id: 'done',
    label: 'Done',
    page: (w) => <DoneStep w={w} />,
    summary: () => '',
  },
];
const on = (id: string) => box.allApps.find((a) => a.id === id)?.status === 'enabled';

// ---------- the wizard ----------

export function SetupWizard() {
  const b = useBox();
  const recorded = b.setup?.steps ?? {};
  const firstOpen = () => {
    const i = STEPS.findIndex((s) => s.id !== 'done' && !recorded[s.id]);
    return i < 0 ? 0 : i;
  };
  const [cur, setCur] = useState(firstOpen);
  const [draft, setDraft] = useState<Draft>(() => {
    const d = (id: string) => (recorded[id]?.data ?? {}) as Record<string, any>;
    return {
      language: d('welcome').language ?? 'en-US',
      keyboard: d('welcome').keyboard ?? 'us',
      boxName: d('name').boxName ?? b.system?.boxName ?? '',
      timezone: d('name').timezone ?? b.system?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
      autoTime: d('name').autoTime ?? true,
      owner: d('phone').owner ?? 'phone',
    };
  });
  const [vault, setVault] = useState<Vault[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [keyFor, setKeyFor] = useState<string>();
  const [accessAt, setAccessAt] = useState<HTMLElement | null>(null);
  const heading = useRef<HTMLDivElement>(null);
  const reloadVault = () => void api<Vault[]>('GET', '/vault').then(setVault, () => setVault([]));
  useEffect(reloadVault, []);
  // The system facts may arrive after the first render: fill the name and time zone once they do.
  useEffect(() => {
    if (!b.system) return;
    // A computer fresh from the installer is on UTC; a phone or laptop doing setup knows the real time zone.
    const here = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const guess = /^(Etc\/)?UTC$/.test(b.system.timezone) && here && !/^(Etc\/)?UTC$/.test(here) ? here : b.system.timezone;
    setDraft((d) => ({ ...d, boxName: d.boxName || b.system!.boxName, timezone: d.timezone || guess }));
  }, [b.system?.boxName]);
  // Another screen (the owner's phone, or the box's own) moved setup on: follow it.
  const count = Object.keys(recorded).length;
  useEffect(() => setCur((c) => Math.max(c, firstOpen())), [count]);
  // Each step starts with its heading focused, so Tab goes on from there (in the kiosk too, which starts unfocused).
  useEffect(() => (window.focus(), (heading.current?.querySelector('h1') as HTMLElement | null)?.focus()), [cur]);

  const w: Wiz = { draft, set: (p) => setDraft((d) => ({ ...d, ...p })), vault, reloadVault, setKey: setKeyFor, fail: (e) => setError((e as Error).message) };
  const step = STEPS[cur];
  const last = cur === STEPS.length - 1;

  const go = async (skip = false) => {
    setBusy(true);
    setError('');
    try {
      if (last) {
        await api('POST', '/setup/finish');
        await loadSetup();
        return; // main.tsx shows the desktop now
      }
      await api('POST', '/setup/step', { id: step.id, data: skip ? { skipped: true } : (step.data?.(w) ?? {}) });
      await loadSetup();
      setCur(cur + 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const submit = (e: Event) => (e.preventDefault(), !busy && void go());
  const summary = error ? '' : step.summary(w);

  return (
    <div class="gos-setup-layer">
      <section class="g-window gos-setup" aria-label={`${PRODUCT} Setup`}>
        <div class="g-split">
          <nav class="g-sidebar gos-setup-side" aria-label="Setup steps">
            <div class="gos-setup-brand">
              <p class="gos-setup-wordmark">
                <b>Gurt</b>OS Setup
              </p>
              <p class="t-caption t-secondary">{b.system?.boxName ?? selfBox().name}</p>
            </div>
            <ol class="gos-setup-steps">
              {STEPS.map((s, i) => {
                const rec = recorded[s.id];
                const skipped = !!rec?.data?.skipped;
                const state = i === cur ? 'current' : rec && !skipped ? 'done' : 'upcoming';
                return (
                  <li key={s.id}>
                    <button type="button" class="g-step" data-state={state} aria-current={i === cur ? 'step' : undefined} disabled={i !== cur && !rec} onClick={() => setCur(i)}>
                      <span class="g-step-marker" aria-hidden="true">
                        {state === 'done' ? <Icon name="object-select" /> : i + 1}
                      </span>
                      <span>
                        {s.label}
                        {skipped && i !== cur && <span class="g-step-sub">Skipped</span>}
                        {state === 'done' && <span class="g-sr"> (done)</span>}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
            <p class="t-caption t-secondary gos-setup-later">You can change all of this later in Settings.</p>
          </nav>
          <form class="g-split-main" onSubmit={submit}>
            <header class="g-headerbar gos-setup-head">
              <div class="g-headerbar-start t-caption t-secondary">
                Step {cur + 1} of {STEPS.length}
              </div>
              <h2 class="g-headerbar-title">{step.label}</h2>
              <div class="g-headerbar-end">
                <IconButton icon="preferences-desktop-accessibility" label="Accessibility" aria-expanded={!!accessAt} onClick={(e) => setAccessAt(accessAt ? null : (e.currentTarget as HTMLElement))} />
              </div>
            </header>
            <div class="gos-setup-page" ref={heading} key={step.id}>
              {step.page(w)}
            </div>
            <footer class="gos-setup-footer">
              <Button large disabled={cur === 0 || busy} onClick={() => setCur(cur - 1)}>
                Back
              </Button>
              <p class={`gos-setup-summary${error ? ' t-destructive' : ''}`} role={error ? 'alert' : 'status'}>
                {error ? `That did not work: ${error}` : summary}
              </p>
              {(step.optional || (step.skipLabel && !step.ready?.(w))) && (
                <Button large kind="flat" disabled={busy} onClick={() => void go(true)}>
                  {step.skipLabel ?? 'Skip'}
                </Button>
              )}
              <button type="submit" class="g-btn g-btn-suggested g-btn-large" disabled={busy || (step.ready ? !step.ready(w) : false)}>
                {last ? `Start using ${PRODUCT}` : 'Next'}
              </button>
            </footer>
          </form>
        </div>
        {keyFor && <KeySheet name={keyFor} onClose={() => setKeyFor(undefined)} after={() => (reloadVault(), void loadApps())} />}
      </section>
      {accessAt && (
        <Popover anchor={accessAt} onClose={() => setAccessAt(null)} align="end" label="Accessibility" class="gos-setup-access-pop">
          <Access />
        </Popover>
      )}
    </div>
  );
}

function Intro({ title, big, children }: { title: string; big?: boolean; children: ComponentChildren }) {
  return (
    <div class={`gos-setup-intro${big ? '' : ' is-small'}`}>
      <h1 class={big ? 't-display' : 't-title1'} tabIndex={-1}>
        {title}
      </h1>
      <p class="t-body t-secondary">{children}</p>
    </div>
  );
}

/** The screen's own accessibility choices. They apply at once and stay on this screen. */
function Access() {
  useBox();
  const row = (k: 'larger-text' | 'contrast' | 'reduce-motion', title: string, sub?: string) => <SwitchRow title={title} sub={sub} checked={access.get(k)} onChange={(v) => access.set(k, v)} />;
  return (
    <Group title="Accessibility">
      {row('larger-text', 'Larger text')}
      {row('contrast', 'High contrast')}
      {row('reduce-motion', 'Reduce motion')}
      {/* This computer's own screen has no screen reader; the phone's does, and every step works there. */}
      <Row
        icon="preferences-desktop-accessibility"
        title="Screen reader"
        sub={surface === 'box screen' ? "Scan the code with your phone to set up with VoiceOver or TalkBack. Every step works there." : "Your device's screen reader reads every step."}
      />
    </Group>
  );
}

// ---------- pairing the owner's phone ----------

let ownerDevice: Device | undefined;
const loopback = ['127.0.0.1', 'localhost'].includes(location.hostname);
const formatCode = (c: string) => c.toUpperCase().match(/.{1,4}/g)?.join('-') ?? c;

/**
 * A one-time owner code for the QR, renewed when it expires. Once a phone pairs as the owner the wizard mints no
 * more codes: it keeps the used code up for ten seconds, so both screens can be compared, then says who paired.
 */
function usePairing() {
  const [code, setCode] = useState<PairCode | string>();
  const [owner, setOwner] = useState<{ device: Device; at: number }>();
  useEffect(() => {
    let count = -1;
    let done = false;
    let timer = 0;
    const fresh = () =>
      api<PairCode>('POST', '/pair/start', { owner: true }).then(
        (c) => {
          if (done) return;
          setCode(c);
          clearTimeout(timer);
          timer = setTimeout(fresh, Math.max(5000, Date.parse(c.expiresAt) - Date.now()));
        },
        (e) => setCode((e as Error).message),
      );
    const poll = () =>
      api<Device[]>('GET', '/devices').then(
        (d) => {
          const o = d.filter((x) => x.owner).at(-1);
          if (o && (count < 0 || d.length > count) && !done) {
            done = true; // the owner is paired: no new code
            clearTimeout(timer);
            ownerDevice = o;
            setOwner({ device: o, at: count < 0 ? 0 : Date.now() });
          }
          if (count < 0 && !o) void fresh();
          count = d.length;
        },
        () => count < 0 && ((count = 0), void fresh()),
      );
    void poll();
    const t = setInterval(poll, 3000);
    return () => ((done = true), clearInterval(t), clearTimeout(timer));
  }, []);
  const now = useNow(1000);
  // The phone opens the app's own pairing route on the box's address (BOX_URL), never this screen's loopback.
  const origin = typeof code === 'object' ? (/^https?:/.test(code.url) ? new URL(code.url).origin : selfBox().url ? new URL(selfBox().url!).origin : loopback ? undefined : location.origin) : undefined;
  const showCode = !owner || now - owner.at < 10_000;
  const url = showCode && typeof code === 'object' && /^https?:/.test(code.url) ? code.url : origin && typeof code === 'object' ? `${origin}/#pair/${code.code}` : undefined;
  return { code: showCode ? code : undefined, url, owner: owner?.device, showCode };
}

function Qr({ text, label }: { text: string; label: string }) {
  const q = qrcode(0, 'M');
  q.addData(text);
  q.make();
  return <div class="gos-setup-qr" role="img" aria-label={label} dangerouslySetInnerHTML={{ __html: q.createSvgTag({ cellSize: 6, margin: 0, scalable: true }) }} />;
}

function PairState({ p }: { p: ReturnType<typeof usePairing> }) {
  const now = useNow(1000);
  if (p.owner) return <p class="t-caption-strong t-success" role="status">Paired: {p.owner.name}. It is the owner's phone now.</p>;
  if (typeof p.code !== 'object') return <p class="t-caption t-secondary">{p.code ? `Pairing is not available: ${p.code}` : 'Making a code…'}</p>;
  const left = Math.max(0, Math.round((Date.parse(p.code.expiresAt) - now) / 1000));
  return (
    <p class="t-caption t-secondary" role="status">
      Waiting for your phone. The code changes in {Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}.
    </p>
  );
}

/** After pairing: who the owner's phone is, in place of the QR. */
const Paired = ({ name }: { name: string }) => (
  <div class="gos-setup-paired">
    <Icon name="object-select" size={32} />
    <p class="t-heading">Paired: {name}</p>
    <p class="t-caption t-secondary">Approvals and running tasks now reach that phone. Add more phones later in Settings &gt; Devices.</p>
  </div>
);

const NoQr = () => <p class="t-caption t-secondary gos-setup-noqr">This screen does not know the address phones use to reach this computer. Set BOX_URL on it, or open {PRODUCT} from a laptop to show the code.</p>;

function PhoneHandoff() {
  const p = usePairing();
  return (
    <aside class="g-card gos-setup-handoff" aria-label="Set up from your phone">
      <h3 class="t-heading gos-setup-handoff-head">
        <Icon name="phone" />
        Set up from your phone
      </h3>
      {!p.showCode && p.owner ? (
        <Paired name={p.owner.name} />
      ) : (
        <>
          <p class="t-caption t-secondary">Scan the code with your phone's camera. Every step works there too, and this screen follows along.</p>
          {p.url ? <Qr text={p.url} label="Set up from your phone: a QR code" /> : <NoQr />}
          {typeof p.code === 'object' && <p class="gos-setup-code">{formatCode(p.code.code)}</p>}
          <p class="t-caption t-secondary">Check that your phone shows the same code.</p>
          <PairState p={p} />
        </>
      )}
    </aside>
  );
}

function OwnerStep({ w }: { w: Wiz }) {
  const p = usePairing();
  const choice = (v: Draft['owner'], icon: string, title: string, children: ComponentChildren) => (
    <div
      class="gos-setup-choice"
      role="radio"
      aria-checked={w.draft.owner === v}
      tabIndex={w.draft.owner === v ? 0 : -1}
      onClick={() => w.set({ owner: v })}
      onKeyDown={(e) => (e.key === ' ' || e.key === 'ArrowRight' || e.key === 'ArrowLeft' || e.key === 'ArrowDown' || e.key === 'ArrowUp') && (e.preventDefault(), w.set({ owner: e.key === ' ' ? v : w.draft.owner === 'phone' ? 'screen' : 'phone' }))}
    >
      <span class="gos-setup-choice-head">
        <span class="gos-setup-radio" aria-hidden="true" />
        <Icon name={icon} />
        <span class="t-heading">{title}</span>
      </span>
      {children}
    </div>
  );
  return (
    <div class="gos-setup-col">
      <Intro title="Who owns this computer">The owner approves spending and changes settings. Pair your phone so approvals reach you anywhere, or keep the owner on this screen.</Intro>
      <div class="gos-setup-choices" role="radiogroup" aria-label="Owner">
        {choice(
          'phone',
          'phone',
          'Pair my phone',
          <>
            <p class="t-body t-secondary">Approvals and running tasks come to your phone. It never holds a key: it can only answer.</p>
            {w.draft.owner === 'phone' && !p.showCode && p.owner && <Paired name={p.owner.name} />}
            {w.draft.owner === 'phone' && p.showCode && (
              <div class="gos-setup-pair">
                {p.url ? <Qr text={p.url} label="Pair the owner's phone: a QR code" /> : <NoQr />}
                <div class="gos-setup-pair-text">
                  <p class="t-caption t-secondary">Scan with your phone's camera, then check the code matches.</p>
                  {typeof p.code === 'object' && <p class="gos-setup-code">{formatCode(p.code.code)}</p>}
                  <PairState p={p} />
                </div>
              </div>
            )}
          </>,
        )}
        {choice('screen', 'system-lock-screen', 'Only this screen', <p class="t-body t-secondary">For a computer with no phone nearby. Whoever stands at this screen is the owner. You can pair a phone later in Settings &gt; Devices.</p>)}
      </div>
    </div>
  );
}

// ---------- name, time zone ----------

let zones: [string, string][] | undefined;
function zoneList(current: string): [string, string][] {
  zones ??= (Intl as any).supportedValuesOf('timeZone').map((z: string) => {
    const off = new Intl.DateTimeFormat('en-US', { timeZone: z, timeZoneName: 'shortOffset' }).formatToParts().find((p) => p.type === 'timeZoneName')?.value ?? '';
    const city = z.split('/').at(-1)!.replaceAll('_', ' ');
    return [z, city === 'UTC' ? 'UTC' : `${city} (${off.replace('GMT', 'UTC').replace('-', '−') || 'UTC'})`];
  });
  return zones!.some(([z]) => z === current) ? zones! : [[current, current.replace(/^Etc\//, '')], ...zones!];
}

/** A computer's name: letters, digits, spaces, apostrophes and hyphens ("Ben's laptop"), 1 to 40 characters. */
const NAME_OK = /^[\p{L}\p{N}][\p{L}\p{N} '’-]{0,39}$/u;

function NameStep({ w }: { w: Wiz }) {
  const name = w.draft.boxName.trim();
  const now = useNow(10_000);
  const tz = w.draft.timezone;
  let time = '';
  try {
    time = new Date(now).toLocaleString('en-US', { timeZone: tz, weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  } catch {}
  return (
    <div class="gos-setup-col">
      <Intro title="Name this computer">The name shows in the top bar, on your phone and on your network.</Intro>
      <label class="gos-setup-field">
        <span class="t-heading">Computer name</span>
        <input class="g-field" value={w.draft.boxName} maxLength={40} autoComplete="off" aria-invalid={!NAME_OK.test(name)} aria-describedby="gos-name-hint" onInput={(e) => w.set({ boxName: (e.target as HTMLInputElement).value })} />
        <span id="gos-name-hint" class={`t-caption ${NAME_OK.test(name) ? 't-secondary' : 't-destructive'}`}>
          {!name ? 'Type a name.' : NAME_OK.test(name) ? `On your network as ${box.system?.hostname ?? 'this computer'}. You can rename it later in Settings > General.` : 'Use letters, digits, spaces, apostrophes and hyphens.'}
        </span>
      </label>
      <Group title="Time">
        <ComboRow icon="preferences-system-time" title="Time zone" value={tz} options={zoneList(tz)} onChange={(v) => w.set({ timezone: v })} />
        <SwitchRow title="Set the time automatically" sub="From the internet" checked={w.draft.autoTime} onChange={(v) => w.set({ autoTime: v })} />
        <Row title="Time now">
          <span class="g-row-value">{time}</span>
        </Row>
      </Group>
    </div>
  );
}

// ---------- AI models ----------

function ModelsStep({ w }: { w: Wiz }) {
  const [via, setVia] = useState<(typeof MODEL_KEYS)[number]>(modelKey(w) ?? 'ANTHROPIC_API_KEY');
  const [value, setValue] = useState('');
  const [saved, setSaved] = useState('');
  const [refused, setRefused] = useState('');
  const anthropic = via === 'ANTHROPIC_API_KEY';
  // A quick shape check here; GurtOS itself checks the key with Anthropic or Factory and says if it was refused.
  const shape = anthropic && value.trim() && !value.trim().startsWith('sk-ant-') ? "That isn't an Anthropic key. Anthropic keys start with sk-ant-." : '';
  const save = () => {
    if (!value.trim() || shape) return;
    // GurtOS checks the key with Anthropic: `checked` only when Anthropic accepted it, and a refused key is a 400 in words.
    api<{ check?: 'ok' | 'unchecked'; checked?: boolean; message?: string }>('PUT', `/vault/${via}`, { value: value.trim() }).then(
      (r) => (setValue(''), setRefused(''), setSaved(r?.message ? sentence(r.message) : r?.checked ? `${anthropic ? 'Anthropic' : 'Factory'} key saved.` : "Saved. GurtOS couldn't check it yet."), w.reloadVault()),
      (e) => (setSaved(''), setRefused(sentence((e as Error).message))),
    );
  };
  const vultr = 'VULTR_INFERENCE_KEY';
  return (
    <div class="gos-setup-col">
      <Intro title="Add a model key">
        {PRODUCT} needs one key so agents can think. Use either an Anthropic API key or a Factory API key. GurtOS keeps keys where agents can't read them, and adds the key to their model calls on the way out.
      </Intro>
      <ToggleGroup
        label="Which key"
        value={via}
        onChange={(v) => (setVia(v), setValue(''), setSaved(''), setRefused(''))}
        options={[
          ['ANTHROPIC_API_KEY', 'Anthropic'],
          ['FACTORY_API_KEY', 'Factory'],
        ]}
      />
      <div class="gos-setup-field">
        <label class="t-heading" for="gos-setup-model-key">
          {anthropic ? 'Anthropic API key' : 'Factory API key'}
        </label>
        <input
          id="gos-setup-model-key"
          class="g-field"
          type="password"
          autoComplete="off"
          spellcheck={false}
          placeholder={keySet(w, via) ? `${setText(w, via)}. Paste a new key to replace it.` : anthropic ? 'sk-ant-…' : 'Paste the key'}
          value={value}
          onInput={(e) => setValue((e.target as HTMLInputElement).value)}
          onKeyDown={(e) => e.key === 'Enter' && value.trim() && (e.preventDefault(), save())}
        />
        <span class="t-caption t-secondary">
          {anthropic
            ? 'From console.anthropic.com, under API keys. It starts with sk-ant-. Usage bills your Anthropic account.'
            : 'From app.factory.ai, under Settings, API keys. Usage uses your Factory credits.'}
        </span>
      </div>
      <div class="gos-setup-save">
        <Button kind="suggested" disabled={!value.trim() || !!shape} onClick={save}>
          Save key
        </Button>
        <span class={`t-caption${shape || refused ? ' t-destructive' : saved || keySet(w, via) ? ' t-success' : ' t-secondary'}`} role="status">
          {shape || refused || saved || (keySet(w, via) ? `${setText(w, via)}. You can replace it but never see it.` : 'You can replace a key but never see it.')}
        </span>
      </div>
      <Group title="Model keys">
        {MODEL_KEYS.map((k) => (
          <Row icon="dialog-password" title={k === 'ANTHROPIC_API_KEY' ? 'Anthropic' : 'Factory'} sub={k} key={k}>
            <span class={`g-row-value${keySet(w, k) ? ' t-success' : ''}`}>{keySet(w, k) ? setText(w, k) : 'Not set'}</span>
          </Row>
        ))}
      </Group>
      <Group title="Other models (optional)">
        <Row icon="dialog-password" title="Vultr inference" sub={`${vultr} · photo descriptions for Find`}>
          {keySet(w, vultr) ? <span class="t-success">{setText(w, vultr)}</span> : <Button onClick={() => w.setKey(vultr)}>Add key</Button>}
        </Row>
      </Group>
    </div>
  );
}

/** Set one key: a password field, straight into the vault. The value never comes back. */
function KeySheet({ name, onClose, after }: { name: string; onClose: () => void; after: () => void }) {
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const save = () => {
    setBusy(true);
    api('PUT', `/vault/${name}`, { value: value.trim() }).then(
      () => (after(), onClose()),
      (e) => (setError((e as Error).message), setBusy(false)),
    );
  };
  return (
    <Sheet title={`Set ${name}`} onCancel={onClose} onDone={save} done="Save" doneDisabled={!value.trim() || busy}>
      <label class="gos-setup-field">
        <span class="t-heading">Paste the key</span>
        <input class="g-field" type="password" autoComplete="off" spellcheck={false} value={value} onInput={(e) => setValue((e.target as HTMLInputElement).value)} onKeyDown={(e) => e.key === 'Enter' && value.trim() && (e.preventDefault(), save())} />
        <span class="t-caption t-secondary">It goes into the vault, readable only by root. No screen shows it again.</span>
      </label>
      {error && (
        <p class="t-caption t-destructive" role="alert">
          {sentence(error)}
        </p>
      )}
    </Sheet>
  );
}

// ---------- permissions ----------

const money = (list: number[], cur: number, none?: string): [string, string][] =>
  [...new Set([...list, cur])].sort((a, b) => a - b).map((c) => [String(c), c === 0 && none ? none : dollars(c)]);

function SafetyStep({ w }: { w: Wiz }) {
  const s = box.settings;
  const [hosts, setHosts] = useState<string>();
  if (!s) return <div class="gos-skeleton" aria-busy="true" />;
  const q = s.quietHours;
  return (
    <div class="gos-setup-col">
      <Intro title="What agents may reach and spend">What a task may do before it has to ask you. Change them any time in Settings &gt; Permissions.</Intro>
      <Group title="Internet">
        <ComboRow
          title="Internet for new tasks"
          sub="Other sites are blocked and logged"
          value={s.networkDefault}
          options={[
            ['none', 'Only sites the task names'],
            ['allowlist', 'Only the sites below'],
          ]}
          onChange={(v) => apply(w, { networkDefault: v })}
        />
        <LinkRow title="Sites any task may reach" sub="For a task that names no sites" value={s.defaultHosts.length ? s.defaultHosts.join(', ') : 'None yet'} onClick={() => setHosts(s.defaultHosts.join('\n'))} />
      </Group>
      <Group title="Spending">
        <ComboRow title="Always ask before a single spend over" value={String(s.approvalThresholdCents)} options={money([100, 500, 1000, 2500, 5000, 10000, 25000], s.approvalThresholdCents)} onChange={(v) => apply(w, { approvalThresholdCents: +v })} />
        <ComboRow title="Budget for a task that names none" sub="With no budget, every spend asks you" value={String(s.defaultBudgetCents)} options={money([0, 50, 100, 500, 1000, 2500], s.defaultBudgetCents, 'No budget')} onChange={(v) => apply(w, { defaultBudgetCents: +v })} />
      </Group>
      <Group title="Quiet hours">
        <SwitchRow title={`Quiet hours, ${q.from} to ${q.to}`} sub="Requests wait without a sound. Nothing over the limit is spent." checked={q.enabled} onChange={(v) => apply(w, { quietHours: { enabled: v } })} />
      </Group>
      {hosts !== undefined && (
        <Sheet
          title="Sites any task may reach"
          onCancel={() => setHosts(undefined)}
          onDone={() => (apply(w, { defaultHosts: hosts.split(/[\s,]+/).filter(Boolean) }), setHosts(undefined))}
          done="Save"
        >
          <label class="gos-setup-field">
            <span class="t-heading">One site per line</span>
            <textarea class="g-field" rows={6} value={hosts} placeholder="api.example.com" onInput={(e) => setHosts((e.target as HTMLTextAreaElement).value)} />
            <span class="t-caption t-secondary">Tasks that name no hosts may reach only these. Everything else is blocked and logged.</span>
          </label>
        </Sheet>
      )}
    </div>
  );
}

// ---------- apps and their keys ----------

function AppRow({ a, w }: { a: AppInfo; w: Wiz }) {
  const [busy, setBusy] = useState(false);
  const keys = a.access.secrets.filter((s) => !s.optional).length;
  const missing = a.access.secrets.filter((s) => !s.optional && !keySet(w, s.name)).length;
  const toggle = (v: boolean) => {
    setBusy(true);
    api('POST', `/apps/${a.id}/${v ? 'enable' : 'disable'}`)
      .then(loadApps, w.fail)
      .finally(() => setBusy(false));
  };
  return (
    <div class="g-approw">
      <AppIcon id={a.id} title={a.title} size={44} />
      <div class="g-approw-text">
        <span class="g-approw-name">{nice(a)}</span>
        {a.description && <span class="g-approw-desc">{a.description}</span>}
        <span class="g-chip-set">
          <Chip icon={a.access.hosts.length ? 'web-browser' : 'process-stop'}>{reach(a)}</Chip>
          <Chip icon="dialog-password">{keys ? (missing ? `Needs ${plural(missing, 'key')}` : 'Keys set') : 'No keys needed'}</Chip>
        </span>
        {a.status === 'error' && <span class="t-caption t-destructive">{a.error ?? 'It did not start.'}</span>}
      </div>
      <input type="checkbox" role="switch" class="g-switch" aria-label={`${nice(a)} on`} checked={a.status === 'enabled'} disabled={busy} onChange={(e) => toggle((e.target as HTMLInputElement).checked)} />
    </div>
  );
}

function AppsStep({ w }: { w: Wiz }) {
  return (
    <div class="gos-setup-col">
      <Intro title="Choose apps">Optional. Turn on the apps you want. Each one says what it can reach and how many keys it needs. App Center has more, and you can change this any time.</Intro>
      <div class="g-list">
        {offered().map((a) => (
          <AppRow a={a} w={w} key={a.id} />
        ))}
        {!offered().length && <Row title="No apps are installed" sub="Apps you add later show up in App Center." />}
      </div>
    </div>
  );
}

function KeysStep({ w }: { w: Wiz }) {
  // The keys the footer counts, each once, under the first app that needs it. Optional keys are in App Center.
  const seen = new Set<string>();
  const apps = enabled()
    .map((a) => ({ a, keys: a.access.secrets.filter((s) => !s.optional && !seen.has(s.name) && seen.add(s.name)) }))
    .filter((x) => x.keys.length);
  return (
    <div class="gos-setup-col">
      <Intro title="Keys for your apps">GurtOS keeps keys where agents can't read them. You can replace a key but never see it. Optional keys are in App Center.</Intro>
      {apps.map(({ a, keys }) => (
        <Group title={nice(a)} caption={/shopper|wallet/.test(a.id) ? 'Test payments only: no real money moves.' : undefined} key={a.id}>
          {keys.map((s) => (
            <Row title={keyLabel(s.name)} sub={s.name} key={s.name}>
              {keySet(w, s.name) ? <span class="t-success">{setText(w, s.name)}</span> : <Button onClick={() => w.setKey(s.name)}>Set key</Button>}
            </Row>
          ))}
        </Group>
      ))}
      {!apps.length && (
        <div class="g-list">
          <Row icon="object-select" title="No keys needed" sub="None of the apps you turned on needs a key." />
        </div>
      )}
    </div>
  );
}

// ---------- updates, privacy, appearance ----------

function UpdatesStep({ w }: { w: Wiz }) {
  const s = box.settings;
  const sys = box.system;
  return (
    <div class="gos-setup-col">
      <Intro title="Updates">{PRODUCT} installs each update as a whole system, into a second copy. If the new one does not start cleanly, GurtOS goes back to the old one by itself.</Intro>
      <div class="gos-setup-choices">
        <div class="gos-setup-system is-running">
          <span class="gos-setup-choice-head">
            <Icon name="computer" />
            <span class="t-heading">System A</span>
            <Badge kind="success">Running</Badge>
          </span>
          <span class="t-caption t-secondary">{sys ? `${sys.editionName} ${sys.version}, build ${sys.build}` : PRODUCT}</span>
        </div>
        <div class="gos-setup-system">
          <span class="gos-setup-choice-head">
            <Icon name="computer" />
            <span class="t-heading">System B</span>
            <Badge kind="neutral">Spare</Badge>
          </span>
          <span class="t-caption t-secondary">The next update installs here. The one after goes back to A.</span>
        </div>
      </div>
      {s && (
        <Group title="How to update">
          <SwitchRow title="Install updates automatically" sub="When no task is running" checked={s.autoUpdate} onChange={(v) => apply(w, { autoUpdate: v })} />
          <ComboRow
            title="Channel"
            value={s.updateChannel}
            options={[
              ['stable', 'Stable'],
              ['beta', 'Beta'],
            ]}
            onChange={(v) => apply(w, { updateChannel: v })}
          />
        </Group>
      )}
    </div>
  );
}

const DAYS: [number, string][] = [
  [30, '30 days'],
  [90, '3 months'],
  [180, '6 months'],
  [365, '1 year'],
  [730, '2 years'],
];

function PrivacyStep({ w }: { w: Wiz }) {
  const s = box.settings;
  const share = (id: string, title: string, sub: string) => {
    const a = box.allApps.find((x) => x.id === id);
    return (
      <SwitchRow
        title={title}
        sub={a ? sub : `${sub}. Not installed on this computer.`}
        checked={a?.status === 'enabled'}
        disabled={!a}
        onChange={(v) => void api('POST', `/apps/${id}/${v ? 'enable' : 'disable'}`).then(loadApps, w.fail)}
      />
    );
  };
  const days = s?.logRetentionDays ?? 365;
  return (
    <div class="gos-setup-col">
      <Intro title="Privacy and logs">The action log records every step every agent takes. It stays on this computer and holds no keys.</Intro>
      <Group title="The action log">
        <ComboRow
          title="Keep the log for"
          value={String(days)}
          options={[...DAYS, ...(DAYS.some(([d]) => d === days) ? [] : [[days, `${days} days`] as [number, string]])].map(([d, l]) => [String(d), l])}
          onChange={(v) => apply(w, { logRetentionDays: +v })}
        />
        <Row icon="utilities-terminal" title="Where it lives">
          <span class="g-row-value t-mono">/var/lib/box/log.jsonl</span>
        </Row>
        <Row title="Who can read it">
          <span class="g-row-value">You and your paired phones</span>
        </Row>
      </Group>
      <Group title="Sharing" caption="Off unless you turn it on.">
        {share('elastic', 'Copy the log to Elastic', 'Needs the Elastic insights app and its key')}
        {share('mana', 'Public status page', 'Mana status shows task titles and states, never prompts or files')}
      </Group>
    </div>
  );
}

const THEMES: ['light' | 'dark' | 'system', string][] = [
  ['light', 'Light'],
  ['dark', 'Dark'],
  ['system', 'Follow the system'],
];
// The app tile colors from the design system, so an accent always has a tested contrast pair.
const ACCENTS: [string, string][] = [
  ['#2f64a6', 'blue'],
  ['#2e6b5e', 'teal'],
  ['#3c6b3f', 'green'],
  ['#5a6270', 'slate'],
  ['#8a4f3a', 'rust'],
];

function radioKeys<T>(list: T[], cur: T, pick: (v: T) => void) {
  return (e: KeyboardEvent) => {
    const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    pick(list[(list.indexOf(cur) + d + list.length) % list.length]);
    requestAnimationFrame(() => ((e.currentTarget as HTMLElement)?.querySelector('[aria-checked="true"]') as HTMLElement | null)?.focus());
  };
}

function AppearanceStep({ w }: { w: Wiz }) {
  const a = box.settings?.appearance;
  if (!a) return <div class="gos-skeleton" aria-busy="true" />;
  const accent = a.accent || ACCENTS[0][0];
  const theme = (v: (typeof THEMES)[number][0]) => apply(w, { appearance: { theme: v } });
  const color = (v: string) => apply(w, { appearance: { accent: v === ACCENTS[0][0] ? '' : v } });
  return (
    <div class="gos-setup-col">
      <Intro title="Appearance">How this computer's screen and the portal look. Each phone can choose its own.</Intro>
      <div class="gos-setup-themes" role="radiogroup" aria-label="Style" onKeyDown={radioKeys(THEMES.map(([v]) => v), a.theme, theme)}>
        {THEMES.map(([v, label]) => (
          <button type="button" role="radio" aria-checked={a.theme === v} tabIndex={a.theme === v ? 0 : -1} class="gos-setup-theme" onClick={() => theme(v)} key={v}>
            <span class={`gos-setup-preview is-${v}`} aria-hidden="true">
              <span class="gos-setup-mini">
                <span />
                <span>
                  <i />
                  <i />
                  <i />
                </span>
              </span>
            </span>
            <span class={a.theme === v ? 't-heading' : 't-body'}>{label}</span>
          </button>
        ))}
      </div>
      <div class="gos-setup-field">
        <span class="t-heading" id="gos-setup-accent">
          Accent color
        </span>
        <div class="gos-setup-swatches" role="radiogroup" aria-labelledby="gos-setup-accent" onKeyDown={radioKeys(ACCENTS.map(([v]) => v), accent, color)}>
          {ACCENTS.map(([v, name]) => (
            <button type="button" role="radio" aria-checked={accent === v} aria-label={name} title={name} tabIndex={accent === v ? 0 : -1} class="gos-setup-swatch" style={{ background: v }} onClick={() => color(v)} key={v} />
          ))}
        </div>
        <span class="t-caption t-secondary">Amber and red keep their meaning in every style: amber waits for you, red undoes or blocks.</span>
      </div>
    </div>
  );
}

// ---------- done ----------

function DoneStep({ w }: { w: Wiz }) {
  const s = box.settings;
  const i = iface();
  const owner = ownerDevice?.name ?? (w.draft.owner === 'screen' ? 'This screen' : 'Not paired yet');
  const tour: [ComponentChildren, string, string][] = [
    [<AppIcon id="tasks" size={40} />, 'Tasks', 'Every task is a row: who it runs as, what it does now, what it cost.'],
    [<AppIcon id="time-machine" size={40} />, 'Time Machine', 'Undo any one task. Every other task keeps its changes.'],
    [<AppIcon id="app-center" size={40} />, 'App Center', 'Add apps, and see what each can reach before you turn it on.'],
    [
      <span class="gos-setup-topbar-tile">
        <Badge>3</Badge>
      </span>,
      'The top bar',
      'An amber count means something needs you. Your phone gets it too.',
    ],
  ];
  return (
    <div class="gos-setup-col">
      <Intro big title={`${PRODUCT} is ready`}>
        Here is where things live. Settings changes any of this later.
      </Intro>
      <ul class="gos-setup-tour">
        {tour.map(([icon, title, text]) => (
          <li class="g-card" key={title}>
            {icon}
            <span class="t-heading">{title}</span>
            <span class="t-caption t-secondary">{text}</span>
          </li>
        ))}
      </ul>
      <Group title="What you set up">
        <Row title="Name">
          <span class="g-row-value">{w.draft.boxName || box.system?.boxName}</span>
        </Row>
        <Row title="Network">
          <span class="g-row-value">{box.system?.network.online === false ? 'Offline' : i ? (wifi(i.name) ? 'Wi-Fi' : 'Ethernet') : 'Online'}</span>
        </Row>
        <Row title="Owner">
          <span class="g-row-value">{owner}</span>
        </Row>
        <Row title="Worker">
          <span class="g-row-value">{modelKey(w) === 'ANTHROPIC_API_KEY' ? 'Claude, with your Anthropic key' : modelKey(w) ? 'Claude, with your Factory key' : "No model key yet: agents can't start"}</span>
        </Row>
        <Row title="Apps">
          <span class="g-row-value">{enabled().map(nice).join(', ') || 'None'}</span>
        </Row>
        <Row title="Updates">
          <span class="g-row-value">{s ? `${s.autoUpdate ? 'Automatic' : 'By hand'}, ${s.updateChannel}` : ''}</span>
        </Row>
      </Group>
      {surface !== 'box screen' && <p class="t-caption t-secondary">This computer's own screen opens the desktop at the same time.</p>}
    </div>
  );
}
