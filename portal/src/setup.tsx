// The first-run setup wizard (Figma 54:86 to 75:2286, docs/figma/os-v2/README.md "Setup, Server"). One window on
// the wallpaper, one decision per step. Each step is recorded with POST /api/setup/step; the last one finishes
// setup and main.tsx shows the desktop. Switches and lists apply at once, like everywhere else in GurtOS.
import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { api, box, loadSetup, patchSettings, surface, useBox, type SetupChannel } from './live.ts';
import { AppIcon, Badge, Button, ComboRow, Group, Icon, IconButton, LinkRow, Popover, Row, Sheet, SwitchRow, ToggleGroup } from './kit/ui.tsx';
import { access } from './shell.tsx';
import { phone } from './wm.tsx';
import { PRODUCT } from './product.ts';
import { dollars, hhmm, selfBox, sentence, useNow } from './util.ts';
import './setup.css';
import { QuickStartHere, hasQuickStart } from './apps/quickstart.tsx';
import { Qr, pairLink } from './apps/settings.tsx';
import { pairNote, relayUp, useRelayUp, type PairCode } from './relay.ts';

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
  fail: (e: unknown) => void;
}
interface Vault {
  name: string;
  setAt: string | null;
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
            {PRODUCT} runs AI agents on this computer. Each agent works in its own space and asks you before it spends money or reaches somewhere new. Setup takes a few minutes.
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
          {all.some((i) => wifi(i.name)) && (
            <Group title="Wi-Fi">
              {all.filter((i) => wifi(i.name)).map((i) => (
                <Row icon="network-wireless-signal-excellent" title={`Wi-Fi (${i.name})`} sub={i.address} key={i.name}>
                  <span class="t-success">Connected</span>
                </Row>
              ))}
            </Group>
          )}
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
    summary: (w) => (NAME_OK.test(w.draft.boxName.trim()) ? 'Quiet hours use this time zone.' : 'Give this computer a name to go on.'),
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
    id: 'updates',
    label: 'Updates',
    page: () => <UpdatesStep />,
    summary: () => '',
  },
  {
    id: 'done',
    label: 'Done',
    page: (w) => <DoneStep w={w} />,
    summary: () => '',
  },
];

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

  const w: Wiz = { draft, set: (p) => setDraft((d) => ({ ...d, ...p })), vault, reloadVault, fail: (e) => setError((e as Error).message) };
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
  const up = useRelayUp();
  const showCode = !owner || now - owner.at < 10_000;
  const url = showCode && typeof code === 'object' ? pairLink(code, up) : undefined;
  return { code: showCode ? code : undefined, url, owner: owner?.device, showCode, checking: typeof code === 'object' && !url && up === undefined };
}

/** The pairing QR, and where the phone has to be for it to work. */
const PairQr = ({ text, label }: { text: string; label: string }) => (
  <>
    <Qr class="gos-setup-qr" text={text} label={label} />
    <p class="t-caption t-secondary">{pairNote(text)}</p>
  </>
);

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

const NoQr = ({ checking }: { checking?: boolean }) =>
  checking ? <div class="gos-setup-qr gos-skeleton" role="status" aria-label="Making a code" /> : <p class="t-caption t-secondary gos-setup-noqr">This screen does not know the address phones use to reach this computer. Open {PRODUCT} from a laptop on the same network to show the code.</p>;

/** Another computer's agent sets this one up: a one-time code, the addresses, what to tell the agent, who is connected. */
function AgentSetup({ onStop }: { onStop: () => void }) {
  const b = useBox();
  const now = useNow(1000);
  const [made, setMade] = useState<SetupChannel>();
  const [error, setError] = useState('');
  const fresh = () => (setError(''), api<SetupChannel>('POST', '/setup/code').then(setMade, (e) => setError((e as Error).message)));
  useEffect(() => void fresh(), []);
  // Who is connected comes with GET /api/setup; ask every few seconds while this panel is open.
  useEffect(() => {
    const t = setInterval(() => void loadSetup(), 3000);
    return () => clearInterval(t);
  }, []);
  // The code is ours; who is connected and where it answers are live from GET /api/setup.
  const live = b.setup?.channel?.open ? b.setup.channel : undefined;
  const ch = made && { ...made, ...(live ? { urls: live.urls, remote: live.remote, devices: live.devices } : {}) };
  const stop = () => api('POST', '/setup/stop').then(() => (void loadSetup(), onStop()), (e) => setError((e as Error).message));
  const urls = ch?.urls ?? [];
  const devices = ch?.devices ?? [];
  const url = ch?.remote ?? urls[0];
  const expired = !!ch?.expiresAt && Date.parse(ch.expiresAt) < now;
  return (
    <>
      <p class="t-caption t-secondary">An AI agent on another computer, like Claude Code, can do every step for you. This screen follows along.</p>
      {ch?.code && (
        <>
          <p class="gos-setup-code">{formatCode(ch.code)}</p>
          <p class="t-caption t-secondary">{expired ? 'This code ran out.' : `Works once, until ${hhmm(ch.expiresAt!)}.`}</p>
          {url && !expired && (
            <>
              <p class="t-caption-strong">Tell your agent:</p>
              <p class="gos-agent-say">
                Set up the new {PRODUCT} computer at {url} with code {formatCode(ch.code)}, by following AGENT-SETUP.md
              </p>
              {urls.length + (ch.remote ? 1 : 0) > 1 && <p class="t-caption t-secondary">Also at {(ch.remote ? urls : urls.slice(1)).join(', ')}</p>}
            </>
          )}
          <p class="t-caption" role="status">
            {devices.length ? `Connected: ${devices.map((d) => d.name).join(', ')}` : 'No agent connected yet.'}
          </p>
        </>
      )}
      {error && (
        <p class="gos-error" role="alert">
          {sentence(error)}
        </p>
      )}
      <span class="gos-actions">
        {/* A code works once, and a failed try uses it up too. */}
        <Button onClick={() => void fresh()}>New code</Button>
        <Button kind={devices.length ? 'destructive' : 'default'} onClick={() => void stop()}>
          Stop
        </Button>
      </span>
    </>
  );
}

function PhoneHandoff() {
  const b = useBox();
  const p = usePairing();
  // Quick Start and command setup start on the new computer's own screen only, and only with a core that has them.
  const [quick, setQuick] = useState<boolean>();
  const [mode, setMode] = useState<'' | 'quick' | 'agent'>('');
  // Quick Start meets the other computer through the relay: offer it only when the relay answers.
  useEffect(() => void (loopback && Promise.all([hasQuickStart(), relayUp()]).then(([q, up]) => setQuick(q && up))), []);
  const agent = loopback && !!b.setup && 'channel' in b.setup;
  if (mode === 'quick')
    return (
      <aside class="g-card gos-setup-handoff" aria-label="Quick Start from your phone">
        <h3 class="t-heading gos-setup-handoff-head">
          <Icon name="phone" />
          Quick Start from your phone
        </h3>
        <QuickStartHere onBack={() => setMode('')} onDone={() => void api('POST', '/setup/finish').then(loadSetup, loadSetup)} />
      </aside>
    );
  if (mode === 'agent')
    return (
      <aside class="g-card gos-setup-handoff" aria-label="Set up from another computer">
        <h3 class="t-heading gos-setup-handoff-head">
          <Icon name="computer" />
          Set up from another computer
        </h3>
        <AgentSetup onStop={() => setMode('')} />
      </aside>
    );
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
          {p.url ? <PairQr text={p.url} label="Set up from your phone: a QR code" /> : <NoQr checking={p.checking} />}
          {typeof p.code === 'object' && <p class="gos-setup-code">{formatCode(p.code.code)}</p>}
          <p class="t-caption t-secondary">Check that your phone shows the same code.</p>
          <PairState p={p} />
        </>
      )}
      {quick && (
        <div class="gos-qs-choice">
          <p class="t-caption t-secondary">Already have GurtOS on another computer? Copy its keys, apps and rules from your phone.</p>
          <Button onClick={() => setMode('quick')}>Quick Start from your phone</Button>
        </div>
      )}
      {agent && (
        <div class="gos-qs-choice">
          <p class="t-caption t-secondary">Have an AI agent on your laptop? It can set this computer up with a one-time code.</p>
          <Button onClick={() => setMode('agent')}>Set up from another computer</Button>
        </div>
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
                {p.url ? <PairQr text={p.url} label="Pair the owner's phone: a QR code" /> : <NoQr checking={p.checking} />}
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
    </div>
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

// ---------- updates ----------

function UpdatesStep() {
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
    </div>
  );
}

// ---------- done ----------

function DoneStep({ w }: { w: Wiz }) {
  const i = iface();
  const owner = ownerDevice?.name ?? (w.draft.owner === 'screen' ? 'This screen' : 'Not paired yet');
  const tour: [ComponentChildren, string, string][] = [
    [<AppIcon id="tasks" size={40} />, 'Tasks', 'Every task is a row: who it runs as, what it does now, what it cost.'],
    [<AppIcon id="time-machine" size={40} />, 'History', 'Undo any one task. Every other task keeps its changes.'],
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
      </Group>
      {surface !== 'box screen' && <p class="t-caption t-secondary">This computer's own screen opens the desktop at the same time.</p>}
    </div>
  );
}
