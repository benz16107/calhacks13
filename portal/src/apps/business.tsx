// GurtOS Business for each person (docs/figma/business/3 and 6): Waiting for me (what the rules send to the person
// signed in here), My requests (what they asked for and who it waits on), and one request with the agent's work.
import './business.css';
import { box, nameOf, useBox, type Approval, type LogEvent } from '../live.ts';
import { AppIcon, Badge, Icon, IconButton, StatusPage } from '../kit/ui.tsx';
import { HeaderBar, open, phone, useWin } from '../wm.tsx';
import { AnswerButtons } from './answer.tsx';
import { appOf, hhmm } from '../util.ts';
import { useState } from 'preact/hooks';

const money = (cents: number) => `$${Math.round(cents / 100).toLocaleString('en-US')}`;
const firstName = (name: string) => name.split(' ')[0];
const when = (t: string | number) => `${new Date(t).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).replace(',', '')}, ${hhmm(t)}`;

/**
 * What a request is about, read from its question: the subject and id when it names them ("approve Bright Harbor
 * Catering Inc. (APP-1042) for $40,000, Net 30"), else its first sentence. An app's marker ("Credit desk [...]:") goes.
 */
export function askInfo(a: Approval) {
  const q = a.question.replace(/^[^:[\]]{0,40}\[[^\]]*\]:\s*/, '');
  const head = q.includes('?') ? q.slice(0, q.indexOf('?') + 1) : q;
  const named = /\b(?:approve|put|release|hold|write off)\s+(.+?)\s+\(([A-Z]{2,6}-\d{2,7})\)/i.exec(head);
  const fraud = /fraud/i.test(a.route?.rule ?? '') || /fraud (referral|flag)/i.test(q);
  const t = box.tasks.get(a.task);
  const app = t ? appOf(t) : { id: 'tasks', title: 'Tasks' };
  const terms = /\b(Net \d+|cash in advance)\b/i.exec(head)?.[1];
  const title = named ? named[1].replace(/,?\s+(Inc|LLC|Co)\.?$/i, '') : head[0].toUpperCase() + head.slice(1);
  // The credit desk's "approve <customer> for $N" is a credit line; anything else is named by its app.
  const kind = fraud ? 'Fraud flag' : app.id === 'credit-desk' && /^approve\b/i.test(head) ? 'Credit line' : app.title;
  return {
    title,
    id: named?.[2],
    line: [kind, named?.[2], terms].filter(Boolean).join(' · '),
    terms,
    fraud,
    amount: a.route?.amountCents ?? a.costCents,
    app,
    seat: t?.seat,
    askedBy: a.askedBy ?? t?.requestedBy,
    trigger: t && !(a.askedBy ?? t.requestedBy) ? t.source : undefined,
  };
}

/** "Requested by Sam Chen · prepared by Credit analyst agent". */
function byLine(a: Approval) {
  const i = askInfo(a);
  const asked = i.askedBy ? `Requested by ${nameOf(i.askedBy)}` : i.trigger ? (/web form$/.test(i.trigger) ? 'Requested on the web form' : `Started by ${i.trigger.split(':')[0].replace(/-/g, ' ')}`) : '';
  return [asked, i.seat ? `prepared by ${i.seat} agent` : 'prepared by an agent'].filter(Boolean).join(' · ');
}

/** The amount, or a red Fraud flag, or an answered state. */
function AskBadge({ a, mine }: { a: Approval; mine?: boolean }) {
  const i = askInfo(a);
  if (a.state === 'approved') return <Badge kind="success">Approved</Badge>;
  if (a.state === 'denied') return <Badge kind="destructive">Denied</Badge>;
  if (mine) return <Badge>Waiting</Badge>;
  return i.fraud ? <Badge kind="destructive">Fraud flag</Badge> : i.amount ? <Badge>{money(i.amount)}</Badge> : <Badge>Needs you</Badge>;
}

function AskRow({ a, mine, selected, onPick }: { a: Approval; mine?: boolean; selected?: boolean; onPick: () => void }) {
  const i = askInfo(a);
  const only = a.route?.people.length === 1 && a.route.people[0].id === box.business.me?.person?.id;
  const sub = mine
    ? a.state === 'pending'
      ? `Waiting for ${a.route?.people.map((p) => p.name).join(' or ') || 'an approver'}`
      : `${a.state === 'approved' ? 'Approved' : 'Denied'} by ${a.by ?? 'someone'}`
    : i.fraud
      ? `Flagged by ${i.seat ?? 'an'} agent${only ? ' · only you can clear it' : ''}`
      : byLine(a);
  return (
    <button type="button" class="gos-plain biz-ask" aria-current={selected ? 'true' : undefined} onClick={onPick}>
      <AppIcon id={i.app.id === 'tasks' ? 'credit-desk' : i.app.id} title={i.app.title} size={32} />
      <span class="gos-two gos-grow">
        <span class="biz-ask-head">
          <span class="t-body-strong">{i.title}</span>
          <AskBadge a={a} mine={mine} />
        </span>
        <span class="t-caption">{i.line}</span>
        <span class="t-caption t-secondary">{sub}</span>
      </span>
    </button>
  );
}

/** The person signed in here, on this box. */
const who = () => {
  const p = box.business.me?.person;
  return p ? [p.name, p.title, box.business.company].filter(Boolean).join(' · ') : '';
};

/** Waiting for me and My requests: the phone's home on a Business box, and the left of the desktop window. */
export function WaitingList({ selected, onPick }: { selected?: string; onPick?: (a: Approval) => void }) {
  const b = useBox();
  const me = b.business.me;
  const pick = onPick ?? ((a: Approval) => open(`request/${a.id}`));
  if (!me?.person)
    return (
      <StatusPage icon="avatar-default" title="Sign in to see what waits for you">
        On {b.business.company || 'this box'}, each person sees what the rules send to them. Pick who you are from the person menu in the top bar.
      </StatusPage>
    );
  const waiting = me.waiting;
  const rules = [...new Set(waiting.map((a) => a.route?.rule).filter(Boolean))];
  const paused = me.paused;
  return (
    <div class="biz-waiting">
      <header class="biz-waiting-head">
        <h1 class="t-title1">Waiting for me</h1>
        <p class="t-caption t-secondary">{who()}</p>
      </header>
      {paused && (
        <div class="g-banner biz-paused-note" role="status">
          <Icon name="media-playback-pause" />
          <span class="t-body">
            All agents are paused by {paused.by}. You can still answer what waits for you.
          </span>
        </div>
      )}
      {waiting.length ? (
        <>
          <div class="g-list">
            {waiting.map((a) => (
              <AskRow a={a} selected={a.id === selected} onPick={() => pick(a)} key={a.id} />
            ))}
          </div>
          <p class="t-caption t-secondary biz-why">These wait for you because of the rules: {rules.join(' ')}</p>
        </>
      ) : (
        <div class="g-list">
          <div class="g-row">
            <span class="g-row-text">
              <span class="g-row-title">Nothing waits for you</span>
              <span class="g-row-sub">{me.person.role === 'requester' ? 'You ask; others approve. Your requests are below.' : 'Requests the rules send to you show up here and as notifications.'}</span>
            </span>
          </div>
        </div>
      )}
      {me.requests.length > 0 && (
        <section class="g-group" aria-label="My requests">
          <div class="g-group-head">
            <h2 class="g-group-title">My requests</h2>
          </div>
          <div class="g-list">
            {me.requests.map((a) => (
              <AskRow a={a} mine selected={a.id === selected} onPick={() => pick(a)} key={a.id} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

/** The agent's steps before it asked. A task that works on several cases (APP-1042, APP-1043) keeps this case's steps. */
function stepsOf(task: string, before: number, id?: string): LogEvent[] {
  const steps = box.events.filter((e) => e.type === 'task.step' && e.task === task && e.seq < before);
  const several = !!id && steps.some((e) => e.type === 'task.step' && /\b[A-Z]{2,6}-\d{2,7}\b/.test(e.text) && !e.text.includes(id));
  return (several ? steps.filter((e) => e.type === 'task.step' && e.text.includes(id!)) : steps).slice(-6);
}

/** One request: the agent's work as evidence, who it was sent to and why, and Deny and Approve when it is yours. */
export function RequestDetail({ id }: { id: string }) {
  const b = useBox();
  const a = b.approvals.get(id) ?? [...(b.business.me?.waiting ?? []), ...(b.business.me?.requests ?? [])].find((x) => x.id === id);
  if (!a) return <StatusPage icon="preferences-system-time" title="This request is not here">It may have been answered and closed, or it belongs to another box.</StatusPage>;
  const known = [...(b.business.me?.waiting ?? []), ...(b.business.me?.requests ?? [])].find((x) => x.id === id);
  const full: Approval = { ...known, ...a, route: a.route ?? known?.route, askedBy: a.askedBy ?? known?.askedBy };
  const i = askInfo(full);
  const me = b.business.me?.person;
  const mine = !!me && i.askedBy === me.id;
  const canAnswer = !!b.business.me?.waiting.some((w) => w.id === id);
  const askedEvent = b.events.find((e) => e.type === 'approval.asked' && e.approval.id === id);
  const answeredEvent = b.events.find((e) => e.type === 'approval.answered' && e.id === id);
  const created = b.events.find((e) => e.type === 'task.created' && e.task === full.task);
  const evidence = stepsOf(full.task, askedEvent?.seq ?? Infinity, i.id);
  const lastStep = evidence.at(-1);
  const askerFirst = i.askedBy ? firstName(nameOf(i.askedBy)) : '';
  const route = full.route;
  const title = (id: string) => b.business.me?.directory.find((p) => p.id === id)?.title;
  const waitingOn = route?.people.map((p) => p.name).join(' or ');
  const waitingOnTitled = route?.people.map((p) => [p.name, title(p.id)].filter(Boolean).join(', ')).join(' or ');
  return (
    <article class="biz-request" aria-label={i.title}>
      <h1 class="t-title2 biz-request-title">{i.fraud ? `Fraud flag on ${i.title}` : i.title}</h1>
      <p class="biz-request-amount">
        {!i.fraud && i.amount > 0 && <span class="biz-money">{money(i.amount)}</span>}
        {mine && <AskBadge a={full} mine />}
        <span class="t-body t-secondary">{[i.terms, i.id].filter(Boolean).join(' · ')}</span>
      </p>
      {!mine && (
        <p class="biz-request-by t-body-strong">
          <Icon name="avatar-default" />
          {byLine(full)}
        </p>
      )}
      {!mine && route && (
        <details class="biz-route" open={!phone()}>
          <summary>
            <Icon name="pan-end" />
            <span>
              {canAnswer ? `Sent to you: ${route.rule[0].toLowerCase()}${route.rule.slice(1)}` : route.why}
              {canAnswer && askerFirst ? ` ${nameOf(i.askedBy)} can't approve it, because ${askerFirst} asked for it.` : ''}
            </span>
          </summary>
          <p class="t-caption t-secondary">
            {route.people.length ? `${route.people.map((p) => p.name).join(' or ')} can approve it. ` : ''}
            {i.askedBy ? `Not offered to ${nameOf(i.askedBy)}: ${askerFirst} asked for it. ` : ''}Not offered to an agent: an agent never approves an agent.
          </p>
        </details>
      )}
      {mine ? (
        <ol class="g-list biz-steps" aria-label="Where it stands">
          <li class="biz-step is-done">
            <Icon name="object-select" />
            <span class="gos-two">
              <span class="t-body">You asked for it</span>
              <span class="t-caption t-secondary">{created ? when(created.at) : ''}</span>
            </span>
          </li>
          {i.seat && (
            <li class="biz-step is-done">
              <Icon name="object-select" />
              <span class="gos-two">
                <span class="t-body">{i.seat} agent prepared it</span>
                <span class="t-caption t-secondary">
                  {lastStep?.type === 'task.step' ? `${lastStep.text} · ` : ''}
                  {askedEvent ? hhmm(askedEvent.at) : ''}
                </span>
              </span>
            </li>
          )}
          <li class={`biz-step${full.state === 'pending' ? ' is-waiting' : ' is-done'}`}>
            <Icon name={full.state === 'pending' ? 'preferences-system-time' : full.state === 'approved' ? 'object-select' : 'process-stop'} />
            <span class="gos-two">
              <span class="t-body">
                {full.state === 'pending' ? (waitingOnTitled ? `Waiting for ${waitingOnTitled}` : 'Nobody can approve it yet') : `${full.state === 'approved' ? 'Approved' : 'Denied'} by ${full.by ?? 'someone'}`}
              </span>
              <span class="t-caption t-secondary">
                {full.state === 'pending' ? `${route?.rule ?? ''}${askedEvent ? ` · ${hhmm(askedEvent.at)}` : ''}` : answeredEvent ? when(answeredEvent.at) : ''}
              </span>
            </span>
          </li>
        </ol>
      ) : (
        evidence.length > 0 && (
          <section class="g-group" aria-label="The agent's work">
            <div class="g-group-head">
              <h2 class="g-group-title">The agent's checks</h2>
            </div>
            <ol class="g-list biz-steps">
              {evidence.map((e) => (
                <li class="biz-step is-done" key={e.seq}>
                  <Icon name="object-select" />
                  <span class="t-body">{e.type === 'task.step' ? e.text : ''}</span>
                </li>
              ))}
            </ol>
            {i.app.id === 'credit-desk' && <p class="t-caption t-secondary">Sandbox data from CRS and Capital One Nessie test accounts.</p>}
          </section>
        )
      )}
      {mine && full.state === 'pending' && (
        <p class="biz-lock t-caption">
          <Icon name="system-lock-screen" />
          You can't approve this: you asked for it. {waitingOn ? `You'll see here when ${firstName(waitingOn.split(' or ')[0])} answers.` : 'An admin can raise a limit or change a rule.'}
        </p>
      )}
      {!mine && full.state === 'pending' && !canAnswer && (
        <p class="biz-lock t-caption">
          <Icon name="system-lock-screen" />
          {me ? `This doesn't wait for you. ${waitingOn ? `It waits for ${waitingOn}.` : ''}` : 'Sign in as a person to answer.'}
        </p>
      )}
      {(canAnswer || (!mine && b.resolved.has(id))) && (
        <div class="biz-answer">
          <AnswerButtons a={full} large />
        </div>
      )}
      {!mine && full.state !== 'pending' && !b.resolved.has(id) && (
        <p class={`gos-answered${full.state === 'approved' ? ' is-ok' : ''}`} role="status">
          <Icon name={full.state === 'approved' ? 'object-select' : 'process-stop'} />
          {full.state === 'approved' ? 'Approved' : 'Denied'} by {full.by ?? 'someone'}
          {answeredEvent ? ` at ${hhmm(answeredEvent.at)}` : ''}
        </p>
      )}
    </article>
  );
}

/** The Waiting for me window: the list, and on a wide screen the request beside it. */
export function WaitingApp() {
  const b = useBox();
  const [picked, setPicked] = useState<string>();
  const first = b.business.me?.waiting[0]?.id ?? b.business.me?.requests[0]?.id;
  const sel = picked ?? first;
  if (phone())
    return (
      <>
        <HeaderBar title="Waiting for me" />
        <div class="g-window-content">
          <WaitingList />
        </div>
      </>
    );
  return (
    <div class="g-split">
      <nav class="g-sidebar biz-sidebar" aria-label="Requests">
        <HeaderBar title={b.business.company || 'Waiting for me'} controls={false} flat />
        <div class="g-sidebar-body">
          <WaitingList selected={sel} onPick={(a) => setPicked(a.id)} />
        </div>
      </nav>
      <div class="g-split-main">
        <HeaderBar title="" />
        <div class="g-window-content">{sel ? <RequestDetail id={sel} key={sel} /> : <StatusPage icon="preferences-system-time" title="Nothing waits for you" />}</div>
      </div>
    </div>
  );
}

/** One request in its own window (a notification or a phone row opens it). */
export function RequestApp({ id }: { id: string }) {
  const b = useBox();
  const win = useWin();
  const a = b.approvals.get(id);
  const mine = !!a && !!b.business.me?.person && (a.askedBy ?? b.tasks.get(a.task)?.requestedBy) === b.business.me.person.id;
  return (
    <>
      <HeaderBar start={<IconButton icon="go-previous" label={mine ? 'My requests' : 'Waiting for me'} onClick={() => win?.close()} />} title={mine ? 'My requests' : 'Waiting for me'} />
      <div class="g-window-content">
        <RequestDetail id={id} />
      </div>
    </>
  );
}

const TONES = ['#1f4e5a', '#b0503a', '#4b5f86', '#5a6270', '#3c6b3f', '#7a5a22', '#5c4a7d', '#8a4f3a'];
/** A person's initials on their own color, the same on every screen. */
export function Avatar({ name, size = 20 }: { name: string; size?: number }) {
  const initials = name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  const tone = TONES[[...name].reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 7) % TONES.length];
  return (
    <span class="biz-avatar" style={{ '--avatar': `${size}px`, '--tone': tone } as never} aria-hidden="true">
      {initials}
    </span>
  );
}
