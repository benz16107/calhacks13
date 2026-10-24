// Small shared pieces: app glyphs, words for states, money, time, the banner, and the approval buttons.
import type { ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';
import { answer, box, type Approval, type Task } from './live.ts';

// Path data from the Figma glyphs (direction A, 48 px grid, 3 px stroke). Figma draws every size with a 3 px
// stroke, so one copy drawn with a non-scaling stroke matches its 48, 32, 20 and 14 px exports.
const GLYPHS: Record<string, string[]> = {
  tasks: ['M12 16H36M12 24H30M12 32H33'],
  activity: ['M14 34V24M22 34V14M30 34V20M38 34V28'],
  'time-machine': [
    'M14.5 17.5C16.2206 15.302 18.6535 13.7726 21.3801 13.1751C24.1067 12.5775 26.9563 12.9491 29.4384 14.2259C31.9205 15.5027 33.8799 17.6049 34.9793 20.1706C36.0786 22.7363 36.2492 25.6049 35.4616 28.2828C34.674 30.9607 32.9775 33.2802 30.6641 34.8422C28.3507 36.4041 25.5652 37.1107 22.7871 36.8404C20.0089 36.5701 17.4119 35.3397 15.443 33.3611C13.4741 31.3825 12.2566 28.7795 12 26',
    'M12 11V18H19',
    'M24 19V25L28 28',
  ],
  'credit-desk': [
    'M16 10H32C33.1046 10 34 10.8954 34 12V36C34 37.1046 33.1046 38 32 38H16C14.8954 38 14 37.1046 14 36V12C14 10.8954 14.8954 10 16 10Z',
    'M19 18H29M19 24H29M19 30H25',
  ],
  shopper: [
    'M13 18H35L33 38H15L13 18Z',
    'M19 18V15C19 13.6739 19.5268 12.4021 20.4645 11.4645C21.4021 10.5268 22.6739 10 24 10C25.3261 10 26.5979 10.5268 27.5355 11.4645C28.4732 12.4021 29 13.6739 29 15V18',
  ],
  wallet: [
    'M13 15H35C36.6569 15 38 16.3431 38 18V32C38 33.6569 36.6569 35 35 35H13C11.3431 35 10 33.6569 10 32V18C10 16.3431 11.3431 15 13 15Z',
    'M10 21H38M30 29H33',
  ],
  find: ['M30 21C30 25.9706 25.9706 30 21 30C16.0294 30 12 25.9706 12 21C12 16.0294 16.0294 12 21 12C25.9706 12 30 16.0294 30 21Z', 'M28 28L36 36'],
  settings: [
    'M12 16H36M12 24H36M12 32H36',
    'M18 19C19.6569 19 21 17.6569 21 16C21 14.3431 19.6569 13 18 13C16.3431 13 15 14.3431 15 16C15 17.6569 16.3431 19 18 19Z',
    'M30 27C31.6569 27 33 25.6569 33 24C33 22.3431 31.6569 21 30 21C28.3431 21 27 22.3431 27 24C27 25.6569 28.3431 27 30 27Z',
    'M22 35C23.6569 35 25 33.6569 25 32C25 30.3431 23.6569 29 22 29C20.3431 29 19 30.3431 19 32C19 33.6569 20.3431 35 22 35Z',
  ],
  // Glyph/Box (21:59): two server units, from the 32 px export scaled to the 48 px grid.
  box: [
    'M13 12H35C36.1 12 37 12.9 37 14V20C37 21.1 36.1 22 35 22H13C11.9 22 11 21.1 11 20V14C11 12.9 11.9 12 13 12Z',
    'M13 26H35C36.1 26 37 26.9 37 28V34C37 35.1 36.1 36 35 36H13C11.9 36 11 35.1 11 34V28C11 26.9 11.9 26 13 26Z',
    'M16 17H18M16 31H18',
  ],
  // Glyph/Pair (21:54): a phone.
  pair: ['M19 10H29C30.6569 10 32 11.3431 32 13V35C32 36.6569 30.6569 38 29 38H19C17.3431 38 16 36.6569 16 35V13C16 11.3431 17.3431 10 19 10Z', 'M22 33H26'],
};
export const hasGlyph = (name: string) => name in GLYPHS;

/** An app's glyph. Apps without one (a new track) show their first letter. */
export function Glyph({ name, title }: { name: string; title?: string }) {
  const paths = GLYPHS[name];
  if (!paths) return <span class="glyph-letter" aria-hidden="true">{(title ?? name).trim()[0]?.toUpperCase()}</span>;
  return (
    <svg class="glyph" viewBox="0 0 48 48" fill="none" aria-hidden="true">
      {paths.map((d) => (
        <path d={d} stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke" />
      ))}
    </svg>
  );
}

export const CloseIcon = () => (
  <svg viewBox="0 0 12 12" class="close-icon" aria-hidden="true">
    <path d="M2.5 2.5l7 7M9.5 2.5l-7 7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
  </svg>
);

export const dollars = (cents: number) => `$${(cents / 100).toFixed(2)}`;
export const plural = (n: number, one: string, many = one + 's') => `${n} ${n === 1 ? one : many}`;
export const STATE_WORDS: Record<Task['state'], string> = {
  queued: 'Queued',
  running: 'Running',
  waiting: 'Waiting for OK',
  done: 'Done',
  failed: 'Failed',
  undone: 'Undone',
};

export function ago(iso: string | number) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 45) return 'now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
export const clock = (iso: string | number) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
export const hhmm = (iso: string | number) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

/** The color says the state, and the word always says it too. */
export function StatePill({ state }: { state: Task['state'] }) {
  return <span class={`pill pill-${state}`}>{STATE_WORDS[state]}</span>;
}

/** The track a task belongs to: its source up to the first colon ('shopper:buy:3' is shopper's). */
export const trackOf = (t: Pick<Task, 'source'>) => t.source.split(':')[0];
export const taskTitle = (id?: string) => (id && box.tasks.get(id)?.title) || id || 'A task';

/** A notification (Figma Banner 22:67): floating on the desktop, or flat in Notification Center. */
export function Banner(props: {
  kind: 'approval' | 'blocked' | 'info';
  glyph: string;
  kicker: string;
  meta: string;
  body: string;
  /** Opens when the body is clicked. */
  open?: string;
  onHide?: () => void;
  flat?: boolean;
  children?: ComponentChildren;
}) {
  return (
    <section class={`banner banner-${props.kind}${props.flat ? ' banner-flat' : ''}`} aria-label={props.kicker.toLowerCase()}>
      <div class="banner-head">
        <span class="banner-icon" aria-hidden="true">
          <Glyph name={props.glyph} />
        </span>
        <span class="banner-meta">
          <span class="banner-kicker">{props.kicker}</span>
          <span class="banner-sub">{props.meta}</span>
        </span>
        {props.onHide && (
          <button class="banner-hide" aria-label="Hide for now" onClick={props.onHide}>
            <CloseIcon />
          </button>
        )}
      </div>
      {props.open ? (
        <a class="banner-text" href={props.open}>
          {props.body}
        </a>
      ) : (
        <p class="banner-text">{props.body}</p>
      )}
      {props.children && <div class="actions">{props.children}</div>}
    </section>
  );
}

/** The approval as a banner: the task's name, the question, and Approve and Deny. */
export function ApprovalBanner({ a, at, flat, onHide }: { a: Approval; at: number; flat?: boolean; onHide?: () => void }) {
  return (
    <Banner
      kind="approval"
      glyph="tasks"
      kicker={`${taskTitle(a.task).toUpperCase()} WANTS YOUR OK`}
      meta={`${at ? ago(at) : 'waiting'} · task ${a.task}`}
      body={a.question}
      open={`#task/${a.task}`}
      flat={flat}
      onHide={onHide}
    >
      <AnswerButtons a={a} />
    </Banner>
  );
}

/** Approve and Deny, with the amount on the button when there is one. */
export function AnswerButtons({ a }: { a: Approval }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const go = async (approved: boolean) => {
    setBusy(true);
    setError('');
    try {
      await answer(a, approved);
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  };
  return (
    <>
      <button class="btn btn-primary" disabled={busy} onClick={() => go(true)}>
        {a.costCents > 0 ? `Approve ${dollars(a.costCents)}` : 'Approve'}
      </button>
      <button class="btn btn-secondary" disabled={busy} onClick={() => go(false)}>
        Deny
      </button>
      {error && (
        <p class="error" role="alert">
          Could not send that: {error}
        </p>
      )}
    </>
  );
}

/** When an approval was asked, from the log. 0 if the log is not loaded that far back. */
export function askedAt(id: string) {
  const e = box.events.findLast((e) => e.type === 'approval.asked' && e.approval.id === id);
  return e ? Date.parse(e.at) : 0;
}
