// Deny and Approve for one request. The first answer wins, from any screen. After an answer the request stays in
// place for a moment with what happened, so a second quick tap can't land on the next request that moves up.
import { useRef, useState } from 'preact/hooks';
import { HOLD, answer, box, useBox, type Approval } from '../live.ts';
import { Button, Icon } from '../kit/ui.tsx';
import { dollars } from '../util.ts';

let lastAnswer = 0;
/** What an Approve button names: the spend, or on GurtOS Business the amount the rules checked (not for a fraud flag). */
const amountOf = (a: Approval) => a.costCents || (a.route && !/fraud/i.test(a.route.rule) ? a.route.amountCents : 0);
const whole = (cents: number) => `$${Math.round(cents / 100).toLocaleString('en-US')}`;

export function AnswerButtons({ a, after, large }: { a: Approval; after?: () => void; large?: boolean }) {
  useBox();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const shownAt = useRef(Date.now());
  const live = box.approvals.get(a.id) ?? a;
  const r = box.resolved.get(a.id);
  if (live.state !== 'pending' || r) {
    const ok = r ? r.approved : live.state === 'approved';
    const by = r?.by ?? live.by;
    const text = r?.mine ? (ok ? 'Approved' : 'Denied') : `Already ${ok ? 'approved' : 'denied'}${by ? ` on ${by}` : ''}`;
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
    answer(live, yes).then(
      () => (setBusy(false), after && setTimeout(after, 1600)),
      (e) => (setError((e as Error).message), setBusy(false)),
    );
  };
  return (
    <>
      <Button large={large} onClick={() => go(false)} disabled={busy || box.down}>
        Deny
      </Button>
      <Button large={large} kind="suggested" onClick={() => go(true)} disabled={busy || box.down}>
        {amountOf(live) > 0 ? `Approve ${live.costCents > 0 ? dollars(live.costCents) : whole(amountOf(live))}` : 'Approve'}
      </Button>
      {error && (
        <p class="gos-error" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
