// Quick Start (core/quickstart.ts): set up a new GurtOS computer from one you already own, with your phone as the
// bridge. The new computer shows a QR and four words. The phone asks a computer it owns to send its keys, apps and
// spending rules; the owner approves exactly what leaves; the new computer applies them and the phone pairs as its owner.
import { useEffect, useState } from 'preact/hooks';
import { api, callMachine, machines, type Machine } from '../live.ts';
import { Button, Group, Icon, SwitchRow } from '../kit/ui.tsx';
import { keyLabel } from '../util.ts';
import { Qr } from './settings.tsx';
import { pairWith } from '../shell.tsx';
import { openSealed, phoneKey, type Sealed } from './qs-crypto.ts';
import { RELAY, onRelay } from '../relay.ts';


interface View {
  state: 'off' | 'waiting' | 'applying' | 'done' | 'stopped' | 'error';
  url?: string;
  phrase?: string;
  steps: { text: string; ok: boolean }[];
  error?: string;
}

/** Whether this GurtOS has Quick Start: an older core answers 404. */
export const hasQuickStart = () => api<View>('GET', '/quickstart').then(() => true, () => false);

// ---------- the new computer's screen (setup's Welcome step) ----------

/** A QR and four words for the phone, then each step as the new computer applies it. */
export function QuickStartHere({ onDone, onBack }: { onDone: () => void; onBack: () => void }) {
  const [v, setV] = useState<View>();
  const [error, setError] = useState('');
  const start = () => (setError(''), api<View>('POST', '/quickstart/start').then(setV, (e) => setError((e as Error).message)));
  useEffect(() => void start(), []);
  const live = v?.state === 'waiting' || v?.state === 'applying';
  useEffect(() => {
    if (!live) return;
    const t = setInterval(() => void api<View>('GET', '/quickstart').then((x) => setV((o) => ({ ...o, ...x })), () => {}), 2000);
    return () => clearInterval(t);
  }, [live]);
  useEffect(() => void (v?.state === 'done' && onDone()), [v?.state]);
  const stop = () => api<View>('POST', '/quickstart/stop').then((x) => setV((o) => ({ ...o, ...x })), (e) => setError((e as Error).message));
  return (
    <>
      <p class="t-caption t-secondary">Copies your keys, apps and spending rules from a GurtOS computer you own. Scan with the phone you use as its owner.</p>
      {v?.state === 'waiting' && v.url && (
        <>
          <Qr text={v.url} label="Quick Start: a QR code for your phone" />
          <p class="t-caption t-secondary">Check that your phone shows:</p>
          <p class="gos-setup-code gos-qs-phrase">{v.phrase}</p>
        </>
      )}
      {!!v?.steps.length && (
        <ol class="gos-qs-steps" aria-live="polite">
          {v.steps.map((s) => (
            <li key={s.text}>
              <Icon name="object-select" /> {s.text}
            </li>
          ))}
        </ol>
      )}
      {v?.state === 'applying' && (
        <p class="t-caption" role="status">
          Setting up from your other computer…
        </p>
      )}
      {(error || v?.state === 'error' || v?.state === 'stopped') && (
        <p class={v?.state === 'stopped' && !error ? 't-caption t-secondary' : 'gos-error'} role="alert">
          {error || v?.error || 'Quick Start stopped. Nothing more will be applied.'}
        </p>
      )}
      {live ? (
        <Button onClick={() => void stop()}>Stop</Button>
      ) : (
        <span class="gos-actions">
          {(error || v?.state === 'error' || v?.state === 'stopped') && <Button onClick={() => void start()}>Start again</Button>}
          <Button kind="flat" onClick={onBack}>
            Back
          </Button>
        </span>
      )}
    </>
  );
}

// ---------- the phone (app.gurtos.com/quickstart#rv=…&pk=…&s=…&n=…) ----------

interface Ask {
  id: string;
  question: string;
  phrase: string;
  keys: { name: string; chosen: boolean }[];
}

/** The new computer's answer, sealed to this phone: its address and a one-time owner code. Up to 5 minutes. */
async function waitForOwnerCode(rv: string): Promise<Sealed> {
  for (const end = Date.now() + 300_000; Date.now() < end; ) {
    const started = Date.now();
    const r = await fetch(`${RELAY}/v1/rv/${encodeURIComponent(rv)}/owner?wait=25`, { signal: AbortSignal.timeout(35_000) }).catch(() => undefined);
    if (r?.status === 200) return (await r.json()) as Sealed;
    if (Date.now() - started < 2000) await new Promise((x) => setTimeout(x, 2000)); // answered at once: don't spin
  }
  throw new Error("The new computer didn't answer within 5 minutes. On its screen, start Quick Start again.");
}

export function QuickStartPhone() {
  const q = new URLSearchParams(location.hash.slice(1));
  const link = { rv: q.get('rv') ?? '', pk: q.get('pk') ?? '', s: q.get('s') ?? '', n: (q.get('n') ?? '').slice(0, 40) || 'the new computer' };
  const valid = /^[\w-]{22,64}$/.test(link.rv) && /^[\w-]{43}$/.test(link.pk) && /^[\w-]{22,43}$/.test(link.s);
  const [owned, setOwned] = useState<Machine[]>();
  const [from, setFrom] = useState<Machine>();
  const [key, setKey] = useState<{ privateKey: CryptoKey; pk: string }>();
  const [ask, setAsk] = useState<Ask>();
  const [stage, setStage] = useState<'choose' | 'ask' | 'sending' | 'waiting' | 'pairing' | 'done' | 'cancelled'>('choose');
  const [error, setError] = useState('');
  useEffect(() => {
    if (!valid) return;
    phoneKey().then(setKey, () => setError("This browser can't make the one-time key Quick Start needs. Use a current Chrome or Safari, or the GurtOS app."));
    // The computers this phone owns: the owner may read the key list (names only), anyone else gets 403.
    void Promise.all(machines().map((m) => callMachine(m, 'GET', '/vault').then(() => m, () => undefined))).then((xs) => {
      const o = xs.filter((m): m is Machine => !!m);
      setOwned(o);
      if (o.length === 1) setFrom(o[0]);
    });
  }, []);
  // The source fixes the keys when it makes the question, so a change of ticks asks for a new question.
  const question = (keys?: string[]) => {
    if (!from || !key) return;
    setError('');
    callMachine<Ask>(from, 'POST', '/quickstart/send', { ...link, phonePk: key.pk, ...(keys ? { keys } : {}) }).then(
      (a) => (setAsk(a), setStage('ask')),
      (e) => setError((e as Error).message),
    );
  };
  useEffect(question, [from?.box.id, key]);
  const approve = async () => {
    if (!from || !key || !ask) return;
    setError('');
    setStage('sending');
    try {
      await callMachine(from, 'POST', `/quickstart/send/${ask.id}`, { approve: true });
      setStage('waiting');
      const { host, code } = await openSealed<{ host: string; code: string }>(key.privateKey, link.s, await waitForOwnerCode(link.rv));
      if (!onRelay(host)) throw new Error('The new computer answered with an address that is not a GurtOS address.');
      setStage('pairing');
      await pairWith(`https://${host}`, { code, name: from.device.name });
      setStage('done');
      setTimeout(() => location.replace('/'), 2000);
    } catch (e) {
      setStage('choose');
      setAsk(undefined); // a send answers once: Try again asks anew
      setError((e as Error).message);
    }
  };
  const cancel = () => {
    if (from && ask) void callMachine(from, 'POST', `/quickstart/send/${ask.id}`, { approve: false }).catch(() => {});
    setStage('cancelled');
  };
  const busy = stage === 'sending' || stage === 'waiting' || stage === 'pairing';

  return (
    <div class="gos-setup-layer">
      <section class="g-window gos-pair-first" aria-labelledby="qs-title">
        <div class="gos-pair">
          <span class="gos-pair-icon">
            <Icon name="phone" size={32} />
          </span>
          <h1 class="t-title2" id="qs-title">
            Set up {link.n}
          </h1>
          {!valid ? (
            <p class="t-body t-secondary">This Quick Start link is incomplete. On the new computer's screen, start Quick Start again and scan its code.</p>
          ) : stage === 'done' ? (
            <p class="t-body" role="status">
              This phone is {link.n}'s owner now. Opening it…
            </p>
          ) : stage === 'cancelled' ? (
            <p class="t-body t-secondary">Nothing was sent. You can close this page.</p>
          ) : owned && !owned.length ? (
            <p class="t-body t-secondary">
              Quick Start copies the setup of a computer this phone owns. This phone isn't the owner of one yet. Pair it as the owner on that computer (Settings, Devices), then scan {link.n}'s code
              again.
            </p>
          ) : (
            <>
              <p class="t-body t-secondary">Copy your keys, apps and spending rules from a computer you own to {link.n}. This phone then becomes its owner.</p>
              {owned && owned.length > 1 && (
                <Group title="Copy from">
                  {owned.map((m) => (
                    <button type="button" class="g-row gos-mrow" aria-pressed={from?.box.id === m.box.id} onClick={() => (setAsk(undefined), setFrom(m))} key={m.box.id}>
                      <Icon name="computer" />
                      <span class="g-row-text">
                        <span class="g-row-title">{m.box.name}</span>
                      </span>
                      {from?.box.id === m.box.id && <Icon name="object-select" label="Chosen" />}
                    </button>
                  ))}
                </Group>
              )}
              {ask && (
                <>
                  <div class="g-banner g-banner-accent" role="note">
                    <Icon name="security-high" />
                    <div>
                      <p class="t-body-strong">Check that {link.n} shows: {ask.phrase}</p>
                      <p class="t-body">{ask.question}</p>
                    </div>
                  </div>
                  {/* The answer sits under the question; the key list can be long (14 keys on a busy computer). */}
                  {!busy && (
                    <span class="gos-actions">
                      <Button large onClick={cancel}>
                        Cancel
                      </Button>
                      <Button large kind="suggested" onClick={() => void approve()}>
                        Approve
                      </Button>
                    </span>
                  )}
                </>
              )}
              {!ask && !error && from && <p class="t-body t-secondary">Asking {from.box.name}…</p>}
              {!ask && error && from && stage === 'choose' && <Button onClick={() => question()}>Try again</Button>}
              {!owned && <p class="t-body t-secondary">Finding the computers this phone owns…</p>}
              {busy && (
                <p class="t-body" role="status">
                  {stage === 'sending'
                    ? `Sending from ${from?.box.name}…`
                    : stage === 'waiting'
                      ? `${link.n} is setting itself up: keys, apps and its own address. About a minute.`
                      : `Pairing this phone with ${link.n}…`}
                </p>
              )}
              {error && (
                <p class="gos-error" role="alert">
                  {error}
                </p>
              )}
              {ask && !!ask.keys.length && (
                <Group title="Keys to send" caption="Only what you tick leaves this computer. Model keys are ticked to start.">
                  {ask.keys.map((k) => (
                    <SwitchRow
                      title={keyLabel(k.name)}
                      sub={k.name}
                      checked={k.chosen}
                      disabled={busy}
                      onChange={(on) => question(ask.keys.filter((x) => (x.name === k.name ? on : x.chosen)).map((x) => x.name))}
                      key={k.name}
                    />
                  ))}
                </Group>
              )}
              <p class="t-caption t-secondary">GurtOS's relay passes only sealed data. The new computer's key and secret stay in its QR code.</p>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
