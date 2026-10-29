// Notifications on this device, and reaching the box from anywhere.
// Push: one subscription with the GurtOS push gateway's key serves every paired machine. Each machine gets its own
// random push key, which it uses to sign its pushes, so one machine can't send a push that passes as another's
// (the service worker checks, see pwa/sw.ts).
import { useEffect, useState } from 'preact/hooks';
import { api, callMachine, machine, machines, updateMachine, useBox, type Machine } from '../live.ts';
import { Alert, Badge, Button, Group, Icon, Row } from '../kit/ui.tsx';
import { ios, standalone } from '../pwa/pwa.tsx';
import { PRODUCT } from '../product.ts';
import { RELAY, SELF_HOST_DOCS, relayDown } from '../relay.ts';
const b64url = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64url = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

export const pushWorks = () => typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window && isSecureContext;
/** An iPhone allows web push only for apps added to the Home Screen. */
export const needsHomeScreen = () => ios() && !standalone();

/**
 * The relay whose push gateway this browser subscribes with: the one the computer on screen uses (the owner may have
 * chosen their own), else the default. shortcut: one subscription has one gateway key, so computers on different
 * relays can't all push to one browser; fine while an owner runs one relay, revisit if people mix relays.
 */
async function pushRelay() {
  const m = machine() ?? machines()[0];
  const host = m ? await callMachine<{ relay?: string }>(m, 'GET', '/remote').then((r) => r.relay, () => undefined) : undefined;
  return host ? `https://${host}` : RELAY;
}

/** This browser's subscription with the gateway's key (a new one if the key changed). */
async function subscription() {
  const reg = await navigator.serviceWorker.ready;
  const { publicKey } = (await fetch(`${await pushRelay()}/v1/push/key`, { signal: AbortSignal.timeout(10_000) }).then(
    (r) => (r.ok ? r.json() : Promise.reject()),
  ).catch(() => {
    throw new Error(`${PRODUCT}'s push service isn't answering right now. Try again later.`);
  })) as { publicKey: string };
  let sub = await reg.pushManager.getSubscription();
  const key = sub?.options.applicationServerKey;
  if (sub && (!key || b64url(new Uint8Array(key)) !== publicKey)) {
    await sub.unsubscribe();
    sub = null;
  }
  return sub ?? reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: unb64url(publicKey) });
}

/** Turn on notifications from every paired machine. Returns the machines that could not be reached. */
export async function turnOn() {
  if ((await Notification.requestPermission()) !== 'granted') throw new Error('Notifications are blocked for this app. Allow them in the browser or phone settings, then try again.');
  const sub = (await subscription()).toJSON();
  const missed: string[] = [];
  for (const m of machines()) {
    const pushKey = m.pushKey ?? b64url(crypto.getRandomValues(new Uint8Array(32)));
    await callMachine(m, 'PUT', '/push', { subscription: sub, key: pushKey }).then(
      () => updateMachine({ ...m, pushKey }),
      () => missed.push(m.box.name),
    );
  }
  return missed;
}

/** Turn notifications off on every paired machine, then drop the subscription. */
export async function turnOff() {
  for (const m of machines()) await callMachine(m, 'DELETE', '/push').catch(() => {});
  await (await (await navigator.serviceWorker.ready).pushManager.getSubscription())?.unsubscribe();
}

/** Whether this device gets notifications from the machine on screen, from the box itself. */
function usePush() {
  const [on, setOn] = useState<boolean>();
  const m = machine();
  const load = () => (m ? callMachine<{ subscribed: boolean }>(m, 'GET', '/push').then((r) => setOn(r.subscribed), () => setOn(false)) : undefined);
  useEffect(() => void load(), [m?.box.id]);
  return [on, load] as const;
}

/** Settings, Devices: this device's notifications. A box's own screen has no pairing, so it has none. */
export function Notifications() {
  useBox();
  const [on, reload] = usePush();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  if (!machine()) return null;
  const run = (f: () => Promise<unknown>, done: string) => {
    setBusy(true);
    setNote('');
    f().then(
      (missed) => setNote(Array.isArray(missed) && missed.length ? `${done} Not reached: ${missed.join(', ')}. Try again when ${missed.length === 1 ? 'it is' : 'they are'} online.` : done),
      (e) => setNote(`That did not work: ${(e as Error).message}`),
    ).finally(() => (setBusy(false), void reload()));
  };
  const many = machines().length > 1;
  return (
    <Group
      title="Notifications on this device"
      caption={`Requests arrive here even when ${PRODUCT} is closed, with Approve and Deny. They reach the owner's phone (in Business, whoever the rules send them to). Quiet hours hold them back.`}
    >
      {!pushWorks() ? (
        <Row icon="preferences-system-notifications" title="This browser can't show notifications" sub={isSecureContext ? 'Open GurtOS in Safari, Chrome or Firefox.' : "Notifications need an https address, which Remote access gives this computer. They don't work on a plain http page."} />
      ) : needsHomeScreen() ? (
        <Row icon="preferences-system-notifications" title="Add GurtOS to your Home Screen first" sub="An iPhone shows notifications only for apps on the Home Screen. In Safari tap Share, then Add to Home Screen, and pair again from there." />
      ) : (
        <>
          <Row icon="preferences-system-notifications" title={on ? 'On' : 'Off'} sub={on === undefined ? 'Checking…' : on ? `${many ? 'From every paired computer. ' : ''}You can turn them off any time.` : Notification.permission === 'denied' ? 'Blocked for this app in the browser or phone settings.' : 'Turn them on to get requests as notifications.'}>
            {on ? (
              <Button onClick={() => run(turnOff, 'Notifications are off.')} disabled={busy}>
                Turn off
              </Button>
            ) : (
              <Button kind="suggested" onClick={() => run(turnOn, 'Notifications are on.')} disabled={busy || on === undefined}>
                Turn on notifications
              </Button>
            )}
          </Row>
          {on && (
            <Row title="Send a test" sub="GurtOS sends one through the push service, as it would a request.">
              <Button onClick={() => run(() => callMachine<{ sent: number }>(machine()!, 'POST', '/push/test').then((r) => (r.sent ? undefined : Promise.reject(new Error('The box had no subscription to send to.')))), 'Sent. It should arrive in a few seconds.')} disabled={busy}>
                Send a test
              </Button>
            </Row>
          )}
        </>
      )}
      {note && (
        <Row title={<span role="status">{note}</span>} />
      )}
    </Group>
  );
}

/** On the phone's home: a nudge until notifications are on (or dismissed). */
export function NotificationsCard() {
  const [on] = usePush();
  const [hidden, setHidden] = useState(localStorage.getItem('gurtos.notify-hidden') === '1');
  const [error, setError] = useState('');
  if (hidden || on !== false || !pushWorks() || needsHomeScreen() || !machine()) return null;
  return (
    <section class="g-banner g-banner-accent gos-install" aria-label="Notifications">
      <Icon name="preferences-system-notifications" />
      <div>
        <p class="t-body-strong">Get requests as notifications</p>
        <p class="t-caption">{error || 'Approve or deny without opening the app.'}</p>
      </div>
      <Button kind="suggested" onClick={() => void turnOn().then(() => setHidden(true), (e) => setError((e as Error).message))}>
        Turn on
      </Button>
      <button type="button" class="g-icon-btn" aria-label="Not now" title="Not now" onClick={() => (localStorage.setItem('gurtos.notify-hidden', '1'), setHidden(true))}>
        <Icon name="window-close" />
      </button>
    </section>
  );
}

// ---------- remote access ----------

interface Remote {
  enabled: boolean;
  name?: string;
  url?: string;
  state: 'off' | 'starting' | 'connected' | 'error';
  error?: string;
  relay: string;
}
const NAME = /^[a-z0-9-]{3,30}$/;
/** The box's "url: the relay must be ..." as a sentence: "The relay must be ...." */
const said = (m: string) => { const t = m.replace(/^url:\s*/, ''); return t.charAt(0).toUpperCase() + t.slice(1) + (/[.?!]$/.test(t) ? '' : '.'); };

/** An address name from the computer's name: "Home box" becomes "home-box". */
export const slug = (n = '') => n.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30);

/** Settings and setup: give this computer its own https address through the relay. Owner only. */
export function RemoteAccess({ title = 'Reach this computer from anywhere' }: { title?: string }) {
  const b = useBox();
  const [r, setR] = useState<Remote>();
  const [error, setError] = useState('');
  const [typed, setName] = useState<string>();
  const name = typed ?? slug(b.system?.boxName); // starts from the computer's name, so Turn on works in one tap
  const [check, setCheck] = useState<{ name: string; available: boolean; reason?: string; failed?: string }>();
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const load = () => api<Remote>('GET', '/remote').then((x) => (setR(x), setError('')), (e) => setError((e as Error).message));
  useEffect(() => void load(), []);
  // The relay this computer uses: the default, or the owner's own (PUT /api/remote/relay, only while remote access is off).
  const [own, setOwn] = useState<{ url: string; default: string; custom: boolean }>();
  const [ownTyped, setOwnTyped] = useState<string>();
  const [ownError, setOwnError] = useState('');
  useEffect(() => void api<NonNullable<typeof own>>('GET', '/remote/relay').then(setOwn, () => {}), []);
  const chooseRelay = (url: string | null) => {
    setBusy(true);
    api<NonNullable<typeof own>>('PUT', '/remote/relay', { url })
      .then((x) => (setOwn(x), setOwnTyped(undefined), setOwnError(''), load()), (e) => setOwnError(said((e as Error).message)))
      .finally(() => setBusy(false));
  };
  // A certificate takes 10 to 60 s: follow it until it connects or fails.
  useEffect(() => {
    if (r?.state !== 'starting') return;
    const t = setInterval(load, 2000);
    return () => clearInterval(t);
  }, [r?.state]);
  const relay = r?.relay ?? new URL(RELAY).host;
  // The box asks its relay; when the relay doesn't answer, say so instead of waiting on the name for ever.
  const words = (m: string) => (relayDown(m) ? `The relay at ${relay} isn't answering, so remote access can't turn on right now. Phones on your own network can still pair in Devices.` : m);
  useEffect(() => {
    setCheck(undefined);
    if (!NAME.test(name)) return;
    const t = setTimeout(
      () => api<{ name: string; available: boolean; reason?: string }>('GET', `/remote/name/${name}`).then(setCheck, (e) => setCheck({ name, available: false, failed: words((e as Error).message) })),
      400,
    );
    return () => clearTimeout(t);
  }, [name, r?.relay]);
  const act = (f: () => Promise<Remote>) => {
    setBusy(true);
    f().then((x) => (setR(x), setError('')), (e) => setError(words((e as Error).message))).finally(() => setBusy(false));
  };
  const valid = NAME.test(name);
  const ready = valid && check?.available && check.name === name;
  const why = !b.owner
    ? "Only this computer's own screen or the owner's phone can turn it on."
    : !name
      ? 'Type a name first.'
      : !valid
        ? 'Use 3 to 30 lowercase letters, digits and hyphens.'
        : !check
          ? 'Checking the name…'
          : check.failed
            ? check.failed
            : !check.available
            ? `That name is taken${check.reason ? `: ${check.reason}` : ''}. Try another.`
            : undefined;
  const down = relayDown(error) || !!check?.failed;
  const state = r?.state === 'connected' ? (['Connected', 'success'] as const) : r?.state === 'starting' ? (['Getting a certificate…', 'accent'] as const) : r?.state === 'error' ? (['Not working', 'destructive'] as const) : undefined;
  return (
    <Group
      title={title || undefined}
      caption="This computer gets its own secure address. The relay only passes encrypted traffic along and cannot read it. Every phone still needs a pairing code."
    >
      {error && <Row icon="dialog-warning" title="Remote access is not available" sub={error} />}
      {r?.enabled ? (
        <>
          <Row icon="web-browser" title={r.url ? <a href={r.url} target="_blank" rel="noopener">{r.url.replace(/^https:\/\//, '')}</a> : r.name} sub={r.state === 'error' ? words(r.error ?? 'It stopped working.') : r.state === 'starting' ? 'This takes up to a minute.' : 'Phones paired from now on use this address.'}>
            {state && <Badge kind={state[1]}>{state[0]}</Badge>}
          </Row>
          <Row title="Turn off" sub="The address stops working and its name is released.">
            <Button kind="destructive" onClick={() => setConfirm(true)} disabled={!b.owner || busy}>
              Turn off
            </Button>
          </Row>
        </>
      ) : (
        r && (
          <>
            <Row title="Name" sub="Lowercase letters, digits and hyphens.">
              <span class="gos-remote-name">
                <input class="g-field" value={name} maxLength={30} autoCapitalize="none" autoComplete="off" spellcheck={false} aria-label="Name for this computer's address" disabled={!b.owner} onInput={(e) => setName((e.target as HTMLInputElement).value.toLowerCase().trim())} />
                <span class="t-body t-secondary">.{relay}</span>
              </span>
            </Row>
            <Row title={valid ? `https://${name}.${relay}` : 'Your address'} sub={why ?? 'Available.'}>
              <Button kind="suggested" onClick={() => act(() => api<Remote>('POST', '/remote', { name }))} disabled={!b.owner || busy || !ready}>
                Turn on
              </Button>
            </Row>
          </>
        )
      )}
      {(down || r?.state === 'error' || own?.custom) && (
        <a class="g-row" href={SELF_HOST_DOCS} target="_blank" rel="noopener">
          <Icon name="network-server" />
          <span class="g-row-text">
            <span class="g-row-title">Use your own relay</span>
            <span class="g-row-sub">Run the relay on a domain you control, then type its address below. How: {SELF_HOST_DOCS.replace(/^https:\/\//, '')}</span>
          </span>
          <Icon name="pan-end" />
        </a>
      )}
      {own && b.owner && !r?.enabled && (down || r?.state === 'error' || own.custom) && (
        <Row title="Relay" sub={ownError || (own.custom ? `Your own relay. The default is ${new URL(own.default).host}.` : 'The default relay.')}>
          <span class="gos-remote-name">
            <input class="g-field" value={ownTyped ?? own.url} inputMode="url" autoCapitalize="none" autoComplete="off" spellcheck={false} aria-label="Relay address" placeholder="https://relay.example.com" onInput={(e) => setOwnTyped((e.target as HTMLInputElement).value.trim())} />
            <Button onClick={() => chooseRelay(ownTyped ?? own.url)} disabled={busy || !ownTyped || ownTyped === own.url}>
              Save
            </Button>
            {own.custom && (
              <Button kind="flat" onClick={() => chooseRelay(null)} disabled={busy}>
                Use the default
              </Button>
            )}
          </span>
        </Row>
      )}
      {confirm && (
        <Alert
          title="Turn off remote access?"
          body={`Phones that use ${r?.url?.replace(/^https:\/\//, '') ?? 'this address'} lose this computer until it is on again. The name is released, so someone else may take it.`}
          action="Turn off"
          destructive
          busy={busy}
          onConfirm={() => (setConfirm(false), act(() => api<Remote>('DELETE', '/remote')))}
          onCancel={() => setConfirm(false)}
        />
      )}
    </Group>
  );
}

/** Forget a machine on this device, and tell the box, so it stops sending this device pushes. */
export async function forget(m: Machine) {
  await callMachine(m, 'DELETE', '/pair/self').catch(() => {}); // an older box has no such route: forget it here anyway
}

/** Machines paired since notifications were turned on (or with no push key yet) join them, silently. */
export function syncPush() {
  if (!pushWorks() || needsHomeScreen() || Notification.permission !== 'granted') return;
  if (machines().some((m) => !m.pushKey)) void turnOn().catch(() => {});
}

/**
 * The installed app's first screen, before pairing (docs/figma/phone-app, 4d). iOS asks for notifications only after
 * a tap in the Home Screen app, so this has its own button. Pairing then joins this phone's subscription.
 */
export function NotifyFirst({ onDone }: { onDone: () => void }) {
  const [error, setError] = useState('');
  const done = () => (localStorage.setItem('gurtos.notify-asked', '1'), onDone());
  const on = () =>
    Notification.requestPermission()
      .then((p) => (p === 'granted' ? subscription().then(() => {}) : undefined))
      .then(done, (e) => setError((e as Error).message));
  return (
    <div class="gos-setup-layer">
      <section class="g-window gos-pair-first" aria-labelledby="notify-first-title">
        <div class="gos-pair">
          <img class="gos-a2hs-icon" src="/icon-180.png" alt="" width="64" height="64" />
          <h1 class="t-title2" id="notify-first-title">
            Get approvals on this phone
          </h1>
          <p class="t-body t-secondary">{PRODUCT} sends a notification when something needs you, and names the computer it came from. Nothing else.</p>
          <Button kind="suggested" large onClick={() => void on()}>
            Turn on notifications
          </Button>
          <Button kind="flat" onClick={done}>
            Not now
          </Button>
          {error && (
            <p class="gos-error" role="alert">
              {error}
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
/** Show NotifyFirst: the installed app, push works, and the phone has not been asked yet. */
export const askNotifyFirst = () => standalone() && pushWorks() && Notification.permission === 'default' && !localStorage.getItem('gurtos.notify-asked');
