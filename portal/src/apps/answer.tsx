// Deny and Approve for one request. The first answer wins, from any screen. After an answer the request stays in
// place for a moment with what happened, so a second quick tap can't land on the next request that moves up.
import { useEffect, useRef, useState } from 'preact/hooks';
import { HOLD, answer, base, box, changed, pairing, useBox, type Approval } from '../live.ts';
import { Button, Icon } from '../kit/ui.tsx';
import { dollars, who } from '../util.ts';

let lastAnswer = 0;
/** What an Approve button names: the spend, or on GurtOS Business the amount the rules checked (not for a fraud flag). */
const amountOf = (a: Approval) => a.costCents || (a.route && !/fraud/i.test(a.route.rule) ? a.route.amountCents : 0);
const whole = (cents: number) => `$${Math.round(cents / 100).toLocaleString('en-US')}`;

// Shopper purchases are approved with Face ID (a passkey) once one is set up; a plain approve is refused at payment.
interface Passkeys {
  enrolled: boolean;
  usable: boolean;
  here: boolean;
  passkeys?: { rpId: string }[];
}
const withToken = (input: RequestInfo | URL, init: RequestInit = {}) => {
  const token = pairing()?.token;
  const url = typeof input === 'string' && input.startsWith('/') ? base() + input : input; // passkey.js asks /t/shopper/...
  return fetch(url, { ...init, headers: { ...(init.headers as Record<string, string>), ...(token ? { authorization: `Bearer ${token}` } : {}) } });
};
/** The machine is on another origin (app.gurtos.com): Face ID has to run on the box's own address. */
const elsewhereOrigin = () => !!base() && new URL(base()).origin !== location.origin;
// shortcut: asked once per page and machine, so a passkey set up meanwhile shows after a reload.
const asked = new Map<string, Promise<Passkeys | undefined>>();
function passkeysFor(a: Approval) {
  if (!box.tasks.get(a.task)?.source.startsWith('shopper:')) return undefined;
  if (!asked.has(base()))
    asked.set(
      base(),
      withToken(`/t/shopper/passkey/status?origin=${encodeURIComponent(location.origin)}`).then((r) => (r.ok ? (r.json() as Promise<Passkeys>) : undefined), () => undefined),
    );
  return asked.get(base());
}

export function AnswerButtons({ a, after, large, denyOnly }: { a: Approval; after?: () => void; large?: boolean; denyOnly?: boolean }) {
  useBox();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const shownAt = useRef(Date.now());
  const [keys, setKeys] = useState<Passkeys>();
  useEffect(() => void passkeysFor(a)?.then(setKeys), [a.id, box.tasks.has(a.task)]);
  const live = box.approvals.get(a.id) ?? a;
  const r = box.resolved.get(a.id);
  if (live.state !== 'pending' || r) {
    const ok = r ? r.approved : live.state === 'approved';
    const by = r?.by ?? live.by;
    const text = r?.mine ? (ok ? 'Approved' : 'Denied') : `Already ${ok ? 'approved' : 'denied'}${by ? ` on ${who(by)}` : ''}`;
    return (
      <p class={`gos-answered${ok ? ' is-ok' : ''}`} role="status">
        <Icon name={ok ? 'object-select' : 'process-stop'} />
        {text}
      </p>
    );
  }
  const go = (yes: boolean) => {
    // A tap on a request that just slid into place, or right after another answer, is a slip: ignore it.
    const now = Date.now();
    const moved = Math.max(0, ...[...box.resolved.values()].map((x) => x.at + HOLD)); // when the list last closed a gap
    if (now - shownAt.current < 600 || now - lastAnswer < HOLD + 600 || (now >= moved && now - moved < 600)) return;
    lastAnswer = now;
    setBusy(true);
    setError('');
    const faceId = yes && keys?.enrolled && ((keys.usable && keys.here) || elsewhereOrigin());
    (faceId ? approveWithFaceId(live) : answer(live, yes)).then(
      () => (setBusy(false), after && setTimeout(after, 1600)),
      (e) => (setError((e as Error).message), setBusy(false)),
    );
  };
  // Face ID is set up for another address (or this browser can't use it): Approve has to happen there.
  const elsewhere = keys?.enrolled && !(keys.usable && keys.here) && !elsewhereOrigin();
  const rp = keys?.passkeys?.[0]?.rpId;
  return (
    <>
      <Button large={large} onClick={() => go(false)} disabled={busy || box.down}>
        Deny
      </Button>
      {denyOnly ? null : elsewhere ? (
        <p class="gos-faceid-note" role="note">
          <Icon name="dialog-password" />
          {keys!.here ? "This browser can't use Face ID. Approve on another device." : `Face ID is set up on ${rp ?? 'another address'}; approve there`}
        </p>
      ) : (
        <Button large={large} kind="suggested" onClick={() => go(true)} disabled={busy || box.down}>
          {keys?.enrolled ? 'Approve with Face ID' : amountOf(live) > 0 ? `Approve ${live.costCents > 0 ? dollars(live.costCents) : whole(amountOf(live))}` : 'Approve'}
        </Button>
      )}
      {error && (
        <p class="gos-error" role="alert">
          {error}
        </p>
      )}
    </>
  );
}

/** Face ID, then the box answers the approval (Shopper's passkey.js), with this device's token. */
async function approveWithFaceId(a: Approval) {
  // From app.gurtos.com: the box's own approve page runs Face ID and answers, top level (a sheet on an iPhone).
  // Opened before any await, so it counts as the tap's own window. The live log shows the answer.
  if (elsewhereOrigin()) {
    window.open(`${base()}/t/shopper/approve?approval=${encodeURIComponent(a.id)}&access_token=${encodeURIComponent(pairing()?.token ?? '')}`, '_blank');
    return;
  }
  const url = `${base()}/t/shopper/passkey.js`;
  const mod = (await import(/* @vite-ignore */ url)) as { approve: (id: string, o: { fetch: typeof fetch; base: string }) => Promise<Approval | undefined> };
  const got = await mod.approve(a.id, { fetch: withToken as typeof fetch, base: `${base()}/t/shopper` });
  box.resolved.set(a.id, { at: Date.now(), approved: true, mine: true });
  box.approvals.set(a.id, { ...a, ...(got?.state ? got : { state: 'approved' }) });
  setTimeout(changed, HOLD + 50);
  changed();
}
