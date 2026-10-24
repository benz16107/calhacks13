// The phone app's Machines sheet and Add a machine (docs/figma/phone-app, 1a and 1b). Switch machines the way you
// switch accounts: each shows its edition, whether it answered lately, what waits for you there, and on GurtOS
// Business who you are on it. Other machines are asked lightly (once a minute); the one on screen has its live stream.
import { useEffect, useRef, useState } from 'preact/hooks';
import { box, callMachine, changed, hosted, machine, machines, switchMachine, useBox, type Approval, type Machine } from '../live.ts';
import { Badge, Button, Icon } from '../kit/ui.tsx';
import { PRODUCT } from '../product.ts';
import { hhmm, pending } from '../util.ts';

export const sheet = { open: '' as '' | 'machines' | 'add' };
export const openMachines = () => ((sheet.open = 'machines'), changed());
const close = () => ((sheet.open = ''), changed());

const edition = (e?: string) => (e ? `${PRODUCT} ${e[0].toUpperCase()}${e.slice(1)}` : PRODUCT);
interface Seen {
  at: number;
  waiting: number;
  person?: string;
}
// When each machine last answered, kept across reloads so a sleeping laptop says when it was seen.
const seen: Record<string, Seen> = JSON.parse(localStorage.getItem('gurtos.seen') ?? '{}');
const keep = () => localStorage.setItem('gurtos.seen', JSON.stringify(seen));

async function ask(m: Machine) {
  const waiting = await callMachine<Approval[]>(m, 'GET', '/approvals?state=pending');
  const me = m.edition === 'business' ? await callMachine<{ person?: { name: string; title?: string; role: string } }>(m, 'GET', '/me').catch(() => undefined) : undefined;
  const p = me?.person;
  seen[m.box.id] = { at: Date.now(), waiting: waiting.length, person: p ? `${p.name}, ${p.title ?? p.role[0].toUpperCase() + p.role.slice(1)}` : seen[m.box.id]?.person };
  keep();
  changed();
}
// app.gurtos.com: the other machines, once a minute.
if (hosted) {
  const poll = () => machines().filter((m) => m.box.id !== machine()?.box.id).forEach((m) => void ask(m).catch(() => {}));
  setTimeout(poll, 3000);
  setInterval(poll, 60_000);
}

/** The machine on screen, as the Machines sheet shows it. */
function current(): Seen {
  const p = box.business.me?.person;
  return { at: box.down ? (seen[machine()?.box.id ?? '']?.at ?? 0) : Date.now(), waiting: pending().length, person: p ? `${p.name}, ${p.title ?? p.role}` : undefined };
}

function Tile({ m }: { m: Machine }) {
  if (m.edition === 'business')
    return (
      <span class="gos-mtile is-initials" aria-hidden="true">
        {m.box.name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase()}
      </span>
    );
  return (
    <span class="gos-mtile" aria-hidden="true">
      <Icon name="computer" size={20} />
    </span>
  );
}

export function MachinesSheet() {
  useBox();
  const first = useRef<HTMLButtonElement>(null);
  useEffect(() => first.current?.focus(), [sheet.open]);
  if (!sheet.open) return null;
  if (sheet.open === 'add') return <AddMachine />;
  const now = machine();
  const list = machines();
  return (
    <div class="g-sheet-layer gos-msheet-layer" onClick={(e) => e.target === e.currentTarget && close()} onKeyDown={(e) => e.key === 'Escape' && close()}>
      <section class="g-sheet gos-msheet" role="dialog" aria-modal="true" aria-label="Machines">
        <header class="g-headerbar">
          <div class="g-headerbar-start">
            <Button kind="flat" onClick={close}>
              Close
            </Button>
          </div>
          <h2 class="g-headerbar-title">Machines</h2>
          <div class="g-headerbar-end" />
        </header>
        <div class="g-sheet-body">
          <div class="g-list">
            {list.map((m, i) => {
              const here = m.box.id === now?.box.id;
              const s = here ? current() : seen[m.box.id];
              const online = !!s && Date.now() - s.at < 150_000;
              return (
                <button type="button" class="g-row gos-mrow" aria-current={here ? 'true' : undefined} ref={i === 0 ? first : undefined} onClick={() => (here ? close() : switchMachine(m.box.id))} key={m.box.id}>
                  <Tile m={m} />
                  <span class="g-row-text">
                    <span class="g-row-title">{m.box.name}</span>
                    <span class="g-row-sub">{edition(here ? (box.system?.edition ?? m.edition) : m.edition)}</span>
                    {s?.person && <span class="g-row-sub">Signed in as {s.person}</span>}
                    <span class={`g-row-sub gos-mstate${online ? ' is-online' : ''}`}>{online ? 'Online' : s?.at ? `Asleep · seen ${hhmm(s.at)}` : 'Not reached yet'}</span>
                  </span>
                  {s && s.waiting > 0 && (
                    <span class="gos-mwait">
                      <Badge>{s.waiting}</Badge>
                      <span class="t-caption t-secondary">waiting</span>
                    </span>
                  )}
                  {here && <Icon name="object-select" label="Shown now" />}
                </button>
              );
            })}
            {hosted && (
              <button type="button" class="g-row g-row-add" onClick={() => ((sheet.open = 'add'), changed())}>
                <Icon name="list-add" />
                <span class="g-row-text">
                  <span class="g-row-title">Add a machine</span>
                  <span class="g-row-sub">Scan the QR code on its screen</span>
                </span>
                <Icon name="pan-end" />
              </button>
            )}
          </div>
          <p class="t-caption t-secondary">
            Each machine has its own pairing. On a {PRODUCT} Business machine you are a person with a role; on the others, this phone answers for the owner. Approvals from every machine reach this phone, each named by its machine.
          </p>
        </div>
      </section>
    </div>
  );
}

/** Add a machine: scan its QR code (where the browser can read one), or type the code. */
function AddMachine() {
  const video = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<'start' | 'scanning' | 'none' | string>('start');
  // BarcodeDetector reads QR codes in Chrome on Android. Safari on an iPhone has none, so there the Camera app scans.
  const Detector = (globalThis as { BarcodeDetector?: new (o: { formats: string[] }) => { detect: (v: HTMLVideoElement) => Promise<{ rawValue: string }[]> } }).BarcodeDetector;
  useEffect(() => {
    if (!Detector || !navigator.mediaDevices) return void setState('none');
    let stream: MediaStream | undefined;
    let timer = 0;
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }).then(
      (s) => {
        stream = s;
        if (!video.current) return;
        video.current.srcObject = s;
        void video.current.play();
        setState('scanning');
        const d = new Detector({ formats: ['qr_code'] });
        const look = async () => {
          const hit = (await d.detect(video.current!).catch(() => []))[0]?.rawValue;
          let u: URL | undefined;
          try {
            u = hit ? new URL(hit) : undefined;
          } catch {} // not an address
          if (u && u.pathname === '/pair' && (u.origin === location.origin || u.hostname === 'app.gurtos.com')) return location.assign(`/pair${u.search}${u.hash}`);
          if (hit) setState("That QR code isn't a GurtOS pairing code.");
          timer = setTimeout(look, 300);
        };
        void look();
      },
      () => setState('Camera blocked. Allow it for this app, or type the code.'),
    );
    return () => (clearTimeout(timer), stream?.getTracks().forEach((t) => t.stop()));
  }, []);
  return (
    <div class="gos-add-machine" role="dialog" aria-modal="true" aria-label="Add a machine">
      <header class="gos-add-head">
        <Button kind="flat" onClick={() => ((sheet.open = 'machines'), changed())}>
          Cancel
        </Button>
        <h2 class="t-heading">Add a machine</h2>
        <span />
      </header>
      <div class="gos-add-view">
        {state === 'none' ? (
          <p class="t-body gos-add-hint">
            <Icon name="phone" size={32} />
            Open the Camera app and point it at the QR code. It offers app.gurtos.com: tap it, and this app adds the machine.
          </p>
        ) : (
          <video ref={video} playsInline muted aria-label="Camera" />
        )}
        {state !== 'none' && state !== 'scanning' && state !== 'start' && <p class="gos-add-error" role="alert">{state}</p>}
      </div>
      <div class="gos-add-foot">
        <h3 class="t-title3">Point the camera at the QR code on the machine's screen</h3>
        <p class="t-caption t-secondary">
          {PRODUCT} Server: Settings › Devices › Pair a phone. {PRODUCT} Personal: {PRODUCT} Settings › Phone. {PRODUCT} Business: an admin makes a one-time pairing code for you.
        </p>
        <Button large onClick={() => location.assign('/pair')}>
          Type the code instead
        </Button>
      </div>
    </div>
  );
}
