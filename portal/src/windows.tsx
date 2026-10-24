// App windows (Figma direction A, page "OS screens"): Tasks (24:383), one task (24:554), Activity (26:1223),
// Time Machine (27:1163), Settings with pairing (31:1736), the phone's pairing page, and each track's own app.
import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import qrcode from 'qrcode-generator';
import { api, box, onEvent, pairing, surface, undo, useBox, type Approval, type LogEvent, type Pairing, type Task } from './live.ts';
import { appList, boxList, ofState } from './home.tsx';
import { PRODUCT } from './product.ts';
import { ApprovalBanner, CloseIcon, Glyph, STATE_WORDS, StatePill, askedAt, clock, dollars, hhmm, plural, taskTitle } from './ui.tsx';

interface Diff {
  changes: { path: string; change: 'added' | 'modified' | 'deleted' }[];
  diff: string;
}

export function Window({ route, onClose }: { route: string; onClose: () => void }) {
  useBox();
  const [name, ...rest] = route.split('/');
  const arg = rest.join('/');
  const view = ((): { title: string; sub: string; glyph: string; body: ComponentChildren; wide?: boolean } => {
    switch (name) {
      case 'tasks': {
        const all = [...box.tasks.values()];
        return {
          title: 'Tasks',
          sub: `${plural(all.length, 'task')} · ${ofState('waiting').length} waiting for you · ${ofState('running').length} running`,
          glyph: 'tasks',
          body: <TasksApp filter={arg || 'all'} />,
        };
      }
      case 'task': {
        const t = box.tasks.get(arg);
        return { title: taskTitle(arg), sub: t ? `Task ${t.id} · runs as box-${t.id} · ${STATE_WORDS[t.state].toLowerCase()}` : `Task ${arg}`, glyph: 'tasks', body: <TaskApp id={arg} key={arg} /> };
      }
      case 'activity':
        return { title: 'Activity', sub: `Every action every agent took · ${plural(box.events.at(-1)?.seq ?? 0, 'event')} · live`, glyph: 'activity', body: <ActivityApp /> };
      case 'time-machine':
        return { title: 'Time Machine', sub: 'Undo any task on its own. The base files are never written.', glyph: 'time-machine', body: <TimeMachineApp /> };
      case 'settings':
        return { title: 'Pair a phone', sub: 'Settings · approvals and live tasks on your phone', glyph: 'pair', body: <SettingsApp /> };
      case 'pair':
        return { title: 'Pair this phone', sub: `with ${PRODUCT} on ${boxList().find((x) => x.self)?.name ?? location.host}`, glyph: 'pair', body: <PairApp code={arg} /> };
      case 'app': {
        const a = box.apps.find((x) => `${x.track}/${x.name}` === arg);
        const def = appList().find((x) => x.hash === `#${route}`);
        return {
          title: a?.title ?? arg,
          sub: a ? `/t/${a.track}${a.href}` : '',
          glyph: def?.glyph ?? 'tasks',
          wide: true,
          body: a ? <iframe class="track-frame" title={a.title} src={`/t/${a.track}${a.href}`} /> : <p class="empty">No app called {arg} on this box.</p>,
        };
      }
      default:
        return { title: 'Not found', sub: '', glyph: 'tasks', body: <p class="empty">Nothing here.</p> };
    }
  })();

  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), [route]);
  useEffect(() => {
    document.title = `${view.title} · ${PRODUCT}`;
    return () => void (document.title = PRODUCT);
  }, [view.title]);
  return (
    <div class="window-layer">
      <section class={`window${view.wide ? ' window-wide' : ''}`} role="dialog" aria-labelledby="window-title">
        <header class="chrome">
          <button class="back phone-only" onClick={onClose}>
            <svg viewBox="0 0 12 12" aria-hidden="true">
              <path d="M7.5 2.5L4 6l3.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none" />
            </svg>
            Home
          </button>
          <span class="tile-28 desk-only" aria-hidden="true">
            <Glyph name={view.glyph} title={view.title} />
          </span>
          <h2 id="window-title" tabIndex={-1} ref={heading}>
            {view.title}
          </h2>
          <span class="chrome-sub">{view.sub}</span>
          <button class="window-close desk-only" onClick={onClose} aria-label="Close and go home">
            <CloseIcon />
          </button>
        </header>
        <div class="window-body">{view.body}</div>
      </section>
    </div>
  );
}

// ---------- Tasks ----------

const FILTERS: [string, string, (t: Task) => boolean][] = [
  ['all', 'All', () => true],
  ['waiting', 'Waiting', (t) => t.state === 'waiting'],
  ['running', 'Running', (t) => t.state === 'running' || t.state === 'queued'],
  ['done', 'Done', (t) => t.state === 'done'],
  ['failed', 'Failed', (t) => t.state === 'failed'],
  ['undone', 'Undone', (t) => t.state === 'undone'],
];
const newestFirst = (a: Task, b: Task) => (b.createdAt ?? '').localeCompare(a.createdAt ?? '') || b.updatedAt.localeCompare(a.updatedAt);
const costOf = (t: Pick<Task, 'costCents' | 'budgetCents'>) => (t.budgetCents > 0 ? `${dollars(t.costCents)} of ${dollars(t.budgetCents)}` : dollars(t.costCents));

/** One line on what a task is doing, for lists. */
function liveStatus(t: Task) {
  if (t.state === 'waiting') {
    const a = [...box.approvals.values()].find((x) => x.task === t.id && x.state === 'pending');
    if (a) return `Asks: ${a.question}`;
  }
  if (t.state === 'failed') return t.error ?? 'Failed';
  if (t.state === 'undone') return 'Undone: its changes are gone';
  if (t.state === 'done') return t.summary || t.step || 'Done';
  return t.step || 'Starting';
}

function TasksApp({ filter }: { filter: string }) {
  const b = useBox();
  const all = [...b.tasks.values()].sort(newestFirst);
  const [, , test] = FILTERS.find(([k]) => k === filter) ?? FILTERS[0];
  const shown = all.filter(test);
  return (
    <>
      <p class="lede">
        {b.live === 'spacetimedb' ? 'Live from SpacetimeDB' : b.down ? 'The box is out of reach, showing the last known state' : "Live from the box's action log"}, updated{' '}
        {clock(b.updatedAt)}.
      </p>
      <nav class="tabs" aria-label="Show">
        {FILTERS.filter(([k, , f]) => k === 'all' || k === filter || all.some(f)).map(([k, label, f]) => (
          <a class="tab" href={`#tasks/${k}`} aria-current={k === filter ? 'page' : undefined} key={k}>
            {label} {all.filter(f).length}
          </a>
        ))}
      </nav>
      <div class="table" role="list">
        <div class="table-head desk-only" aria-hidden="true">
          <span>Task</span>
          <span>Live status</span>
          <span>State</span>
          <span class="num">Cost of budget</span>
        </div>
        {shown.map((t) => (
          <a class="trow" role="listitem" href={`#task/${t.id}`} key={t.id}>
            <span class="trow-task">
              <span class="trow-title">{t.title}</span>
              <span class="trow-meta mono">
                {t.id} · {t.source}
              </span>
            </span>
            <span class="trow-live">{liveStatus(t)}</span>
            <span class="trow-state">
              <StatePill state={t.state} />
            </span>
            <span class="trow-cost mono">{costOf(t)}</span>
          </a>
        ))}
        {shown.length === 0 && <p class="empty">{all.length ? 'No tasks in this view.' : 'No tasks yet. A task starts from a trigger, a track or the API.'}</p>}
      </div>
    </>
  );
}

// ---------- One task ----------

interface Detail {
  task: Task;
  approvals: Approval[];
  events: LogEvent[];
}

function TaskApp({ id }: { id: string }) {
  const b = useBox();
  const [detail, setDetail] = useState<Detail>();
  const [diff, setDiff] = useState<Diff>();
  const [error, setError] = useState('');
  const load = () =>
    Promise.all([api<Detail>('GET', `/tasks/${id}`), api<Diff>('GET', `/tasks/${id}/diff`).catch(() => undefined)])
      .then(([d, f]) => {
        setDetail(d);
        setDiff(f);
      })
      .catch((e) => setError((e as Error).message));
  useEffect(() => {
    void load();
    let t = 0;
    return onEvent((e) => {
      if (e.task !== id) return;
      clearTimeout(t);
      t = setTimeout(load, 200);
    });
  }, [id]);

  if (error) return <p class="empty">Could not load this task: {error}</p>;
  if (!detail) return <p class="empty">Loading…</p>;
  const t: Task = { ...detail.task, ...b.tasks.get(id), hosts: detail.task.hosts, tools: detail.task.tools, user: detail.task.user };
  const asks = detail.approvals.map((a) => b.approvals.get(a.id) ?? a).filter((a) => a.state === 'pending');
  const blocked = detail.events.filter((e) => e.type === 'net.blocked');
  const model = detail.events.reduce((c, e) => c + (e.type === 'cost' && e.model ? e.cents : 0), 0);
  const created = detail.events.find((e) => e.type === 'task.created');
  return (
    <div class="task">
      <div class="task-top">
        <div class="task-title">
          <h3>{t.title}</h3>
          <StatePill state={t.state} />
        </div>
        <div class="task-actions">
          {t.workspace.startsWith('owner-') && <KeepButton task={t} events={detail.events} after={load} />}
          <UndoButton task={t} after={load} />
        </div>
      </div>

      {blocked.length > 0 && (
        <div class="blocked-summary">
          <p class="blocked-lead">
            This task tried {blocked.length === 1 ? 'something' : `${blocked.length} things`} it is not allowed to do. {blocked.length === 1 ? 'It was' : `All ${blocked.length} were`} blocked and logged.
          </p>
          <p>
            It tried to reach {[...new Set(blocked.map((e) => (e.type === 'net.blocked' ? e.host : '')))].join(', ')}, and{' '}
            {t.hosts.length ? `may only reach ${t.hosts.join(', ')}` : 'may not reach any host'}. It never had a key to send: the vault is root only and the task runs as {t.user}.
          </p>
        </div>
      )}
      {(t.error || (t.summary && t.state === 'done')) && <p class={t.error ? 'task-error' : 'task-summary'}>{t.error ?? t.summary}</p>}

      {asks.map((a) => (
        <ApprovalBanner a={a} at={askedAt(a.id)} flat key={a.id} />
      ))}

      <dl class="facts">
        <Fact k="Runs as" v={t.user} />
        <Fact k="Workspace" v={t.workspace} />
        <Fact k="Worker" v={t.worker === 'droid' ? 'droid · Claude' : 'scripted (test)'} />
        <Fact k="May reach" v={t.hosts.join(', ') || 'no network'} />
        <Fact k="Tools" v={t.tools.join(', ') || 'none'} />
        <Fact k="Source" v={t.source} />
        <Fact k="Started" v={created ? clock(created.at) : '?'} />
        <Fact k="Task id" v={t.id} />
      </dl>

      <div class="task-columns">
        <section class="col-main">
          <h3>Steps, from the action log</h3>
          <ol class="steps">
            {detail.events.map((e) => (
              <Step e={e} events={detail.events} key={e.seq} />
            ))}
          </ol>
        </section>
        <section class="col-side">
          <h3>Files it changed</h3>
          {!diff || diff.changes.length === 0 ? (
            <p class="empty">{diff ? 'No files changed.' : 'No changes to show.'}</p>
          ) : (
            <>
              <ul class="files">
                {diff.changes.map((c) => (
                  <li key={c.path}>
                    <code>{c.path}</code>
                    <span class={`change change-${c.change}`}>{c.change}</span>
                  </li>
                ))}
              </ul>
              <DiffView text={diff.diff} undone={t.state === 'undone'} />
            </>
          )}
          <p class="footnote">
            From <code>GET /api/tasks/{t.id}/diff</code>.{' '}
            {t.state === 'undone'
              ? 'Undone: these changes were taken out of the files. Other tasks kept theirs.'
              : t.workspace.startsWith('owner-')
                ? 'They stay in the task\'s copy until you Keep them; your folder is untouched until then.'
                : "These files live only in this task's layer until it is undone."}
          </p>
          <div class="card cost-card">
            <span class="label">Cost</span>
            <span class="cost-line">
              <b>{dollars(t.costCents)}</b>
              {t.budgetCents > 0 && <span>of a {dollars(t.budgetCents)} budget</span>}
            </span>
            <span class="mono small">
              Model{t.worker === 'droid' ? ' (Claude in Droid)' : ''} {dollars(model)}
              <br />
              Tools {dollars(Math.max(0, t.costCents - model))}
            </span>
          </div>
        </section>
      </div>
    </div>
  );
}

const Fact = ({ k, v }: { k: string; v: string }) => (
  <div>
    <dt>{k}</dt>
    <dd class="mono">{v}</dd>
  </div>
);

/** Personal edition: a done task on one of the owner's real folders waits for Keep before the folder changes. */
function KeepButton({ task, events, after }: { task: Task; events: LogEvent[]; after: () => void }) {
  const [result, setResult] = useState('');
  const kept = events.findLast((e) => e.type === 'task.step' && (e.data as { keep?: string })?.keep === 'applied');
  if (kept) return <p class="task-undone">Kept: the changes are in your folder.</p>;
  if (task.state !== 'done') return null;
  const go = () =>
    api<{ kept?: unknown[]; conflicts?: string[] }>('POST', `/tasks/${task.id}/keep`)
      .then((r) => (r.conflicts ? setResult(`Not kept: you changed ${r.conflicts.join(', ')} too. Nothing was written.`) : after()))
      .catch((e) => setResult(`Could not keep: ${(e as Error).message}`));
  return (
    <div class="undo">
      <button class="btn btn-primary" onClick={go}>
        Keep changes
      </button>
      <span class="footnote" role={result ? 'status' : undefined}>
        {result || 'Writes them into your real folder. Until then it is untouched.'}
      </span>
    </div>
  );
}

/** Undo, with a second press to confirm: it can't be redone. */
function UndoButton({ task, after }: { task: Task; after: () => void }) {
  const [armed, setArmed] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 6000);
    return () => clearTimeout(t);
  }, [armed]);
  if (task.state === 'undone') return <p class="task-undone">Undone. Other tasks kept their changes.</p>;
  const go = async () => {
    if (!armed) return setArmed(true);
    try {
      await undo(task.id);
      after();
    } catch (e) {
      setError((e as Error).message);
    }
    setArmed(false);
  };
  return (
    <div class="undo">
      <button class="btn btn-danger" onClick={go}>
        {armed ? 'Yes, undo it' : 'Undo this task'}
      </button>
      <span class="footnote" role={armed || error ? 'status' : undefined}>
        {error ? `Could not undo: ${error}` : armed ? "Press again to undo. This can't be redone." : "Removes only this task's changes. Other tasks keep theirs."}
      </span>
    </div>
  );
}

/** A unified diff as Figma's DiffLine rows. `reverse` shows what comes back if the task is undone. */
function DiffView({ text, reverse, undone }: { text: string; reverse?: boolean; undone?: boolean }) {
  const rows = text.split('\n').flatMap((l): { sign: string; code: string; kind: string }[] => {
    if (l.startsWith('+++ ')) return [{ sign: ' ', code: l.slice(6), kind: 'file' }];
    if (l.startsWith('--- ') || l.startsWith('@@') || l.startsWith('\\') || l === '') return [];
    const add = l.startsWith('+') !== !!reverse;
    if (l[0] === '+' || l[0] === '-') return [{ sign: add ? '+' : '-', code: l.slice(1), kind: add ? 'add' : 'del' }];
    return [{ sign: ' ', code: l.slice(1), kind: 'ctx' }];
  });
  return (
    <div class={`diff${undone ? ' diff-undone' : ''}`} role="region" aria-label={reverse ? 'What comes back' : 'Changes'}>
      {rows.slice(0, 400).map((r, i) => (
        <div class={`dl dl-${r.kind}`} key={i}>
          <span class="dl-sign">{r.sign}</span>
          <span class="dl-code">{r.code}</span>
        </div>
      ))}
    </div>
  );
}

// ---------- the action log ----------

function toolOf(events: LogEvent[], key: string) {
  const c = events.findLast((e) => e.type === 'tool.call' && e.key === key);
  return c?.type === 'tool.call' ? c.tool : 'the tool';
}
const short = (v: unknown, n = 120) => {
  const s = typeof v === 'string' ? v : JSON.stringify(v) ?? '';
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
};

/** One log event as a sentence. `tone` marks what deserves color: blocked attempts, requests, spending. */
export function describe(e: LogEvent, events: LogEvent[]): { text: string; data: string; tone?: 'blocked' | 'ask' | 'money' } {
  switch (e.type) {
    case 'task.created':
      return { text: `Task created by ${e.spec.source}`, data: `task.created  user ${e.user}  hosts ${e.spec.hosts.join(' ') || 'none'}` };
    case 'task.state':
      return {
        text: `${STATE_WORDS[e.state]}${e.error ? `: ${e.error}` : ''}${e.summary ? `: ${e.summary}` : ''}`,
        data: `task.state ${e.state}`,
        tone: e.state === 'failed' ? 'blocked' : undefined,
      };
    case 'task.step':
      return { text: e.text, data: e.data === undefined ? 'task.step' : `task.step  ${short(e.data, 80)}` };
    case 'tool.call':
      return { text: `Asked the box to run ${e.tool}`, data: `tool.call  ${e.tool}  ${short(e.input, 80)}` };
    case 'tool.result':
      return e.ok
        ? { text: `${toolOf(events, e.key)} finished${e.cents ? `, spent ${dollars(e.cents)}` : ''}`, data: `tool.result  ok${e.cents ? `  ${dollars(e.cents)}` : ''}`, tone: e.cents ? 'money' : undefined }
        : { text: `Refused: ${toolOf(events, e.key)}: ${e.error}`, data: `tool.result  refused`, tone: 'blocked' };
    case 'approval.asked':
      return { text: `Asked for an OK: ${e.approval.question}`, data: `approval.asked  ${e.approval.id}`, tone: 'ask' };
    case 'approval.answered':
      return { text: `${e.approved ? 'Approved' : 'Denied'} by ${e.by}`, data: `approval.answered  by ${e.by}`, tone: 'ask' };
    case 'cost':
      return { text: `Spent ${dollars(e.cents)} on ${e.what}`, data: `cost  ${e.model ?? ''}`.trim(), tone: 'money' };
    case 'net.blocked':
      return { text: `Blocked: it tried to reach ${e.host}`, data: `net.blocked  ${e.host} is not in this task's hosts`, tone: 'blocked' };
    case 'note':
      return { text: `${e.track}: ${short(e.data)}`, data: 'note' };
  }
}

function Step({ e, events }: { e: LogEvent; events: LogEvent[] }) {
  const d = describe(e, events);
  return (
    <li class={`step${d.tone === 'blocked' ? ' step-blocked' : ''}`}>
      <span class="mono small seq" title="Line in log.jsonl">
        {e.seq}
      </span>
      <time class="mono small" dateTime={e.at}>
        {clock(e.at)}
      </time>
      <span class="step-body">
        <span class="step-text">{d.text}</span>
        <span class="mono small step-data">{d.data}</span>
      </span>
    </li>
  );
}

const TABS = ['Tasks', 'Cost', 'Network', 'Events'] as const;

function ActivityApp() {
  const b = useBox();
  const [tab, setTab] = useState<(typeof TABS)[number]>('Tasks');
  const ev = b.events;
  const per = new Map<string, { steps: number; calls: number; blocked: number }>();
  for (const e of ev) {
    if (!e.task) continue;
    const p = per.get(e.task) ?? { steps: 0, calls: 0, blocked: 0 };
    if (e.type === 'task.step') p.steps++;
    if (e.type === 'tool.call') p.calls++;
    if (e.type === 'net.blocked') p.blocked++;
    per.set(e.task, p);
  }
  const tasks = [...b.tasks.values()].sort(newestFirst);
  const spends = ev.filter((e) => (e.type === 'cost' && e.cents) || (e.type === 'tool.result' && e.cents));
  const blocks = ev.filter((e) => e.type === 'net.blocked');
  return (
    <div class="activity">
      <div class="segmented" role="tablist" aria-label="Show">
        {TABS.map((t) => (
          <button role="tab" aria-selected={t === tab} class="seg" onClick={() => setTab(t)} key={t}>
            {t}
          </button>
        ))}
      </div>
      {tab === 'Tasks' && (
        <div class="table table-activity">
          <div class="table-head" aria-hidden="true">
            <span>Task</span>
            <span>Runs as</span>
            <span>State</span>
            <span class="num">Steps</span>
            <span class="num">Tool calls</span>
            <span class="num">Blocked</span>
            <span class="num">Cost</span>
            <span class="num">Budget</span>
          </div>
          {tasks.map((t) => {
            const p = per.get(t.id) ?? { steps: 0, calls: 0, blocked: 0 };
            return (
              <a class="trow" href={`#task/${t.id}`} key={t.id}>
                <span class="trow-title">{t.title}</span>
                <span class="mono">box-{t.id}</span>
                <span class={`state-text state-${t.state}`}>{STATE_WORDS[t.state]}</span>
                <span class="num mono">{p.steps}</span>
                <span class="num mono">{p.calls}</span>
                <span class={`num mono${p.blocked ? ' blocked-count' : ''}`}>{p.blocked}</span>
                <span class="num mono">{dollars(t.costCents)}</span>
                <span class="num mono">{t.budgetCents ? dollars(t.budgetCents) : 'none'}</span>
              </a>
            );
          })}
        </div>
      )}
      {tab === 'Cost' && <EventList events={spends.slice(-200).reverse()} all={ev} empty="Nothing spent yet." />}
      {tab === 'Network' && (
        <>
          <p class="lede">Each task reaches only the hosts in its spec, through the box's proxy. Everything else is refused and written here.</p>
          <EventList events={blocks.slice(-200).reverse()} all={ev} empty="Nothing has been blocked." />
        </>
      )}
      {tab === 'Events' && <EventList events={ev.slice(-300).reverse()} all={ev} empty="The log is empty." />}
      {tab !== 'Events' && (
        <div class="activity-bottom">
          <section class="card live-log">
            <div class="live-log-head">
              <span class="label">Live from log.jsonl</span>
              <span class="small muted">{b.down ? 'reconnecting' : 'following over SSE'}</span>
            </div>
            {ev.slice(-8).reverse().map((e) => (
              <div class={`ll${e.type === 'net.blocked' ? ' ll-blocked' : ''}`} key={e.seq}>
                <span>{e.seq}</span>
                <span>{clock(e.at)}</span>
                <span>{e.type}</span>
                <span>{e.task ?? ''}</span>
                <span class="ll-text">{describe(e, ev).text}</span>
              </div>
            ))}
          </section>
          <div class="activity-side">
            <SpentToday />
            <section class="card">
              <span class="label">Blocked today</span>
              <b class={`big-number${b.today.blocked ? ' blocked-count' : ''}`}>{b.today.blocked}</b>
              <span class="small muted">
                {b.today.blocked
                  ? `from ${[...new Set(blocks.filter((e) => new Date(e.at).toDateString() === new Date().toDateString()).map((e) => taskTitle(e.task)))].join(', ')}`
                  : 'Nothing tried to leave its lane.'}
              </span>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}

function EventList({ events, all, empty }: { events: LogEvent[]; all: LogEvent[]; empty: string }) {
  if (!events.length) return <p class="empty">{empty}</p>;
  return (
    <ol class="steps">
      {events.map((e) => {
        const d = describe(e, all);
        return (
          <li class={`step${d.tone === 'blocked' ? ' step-blocked' : ''}`} key={e.seq}>
            <span class="mono small seq">{e.seq}</span>
            <time class="mono small" dateTime={e.at}>
              {clock(e.at)}
            </time>
            <span class="step-body">
              <span class="step-text">
                {e.task && (
                  <a class="logtask" href={`#task/${e.task}`}>
                    {taskTitle(e.task)}
                  </a>
                )}
                {d.text}
              </span>
              <span class="mono small step-data">{d.data}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** Today's spending: model and tools, and a bar per hour, from the log. */
function SpentToday() {
  const b = useBox();
  const today = new Date().toDateString();
  const hours = new Map<number, number>();
  let model = 0;
  for (const e of b.events) {
    if (new Date(e.at).toDateString() !== today) continue;
    const cents = e.type === 'cost' ? e.cents : e.type === 'tool.result' ? (e.cents ?? 0) : 0;
    if (!cents) continue;
    if (e.type === 'cost' && e.model) model += cents;
    const h = new Date(e.at).getHours();
    hours.set(h, (hours.get(h) ?? 0) + cents);
  }
  const first = Math.min(...hours.keys(), new Date().getHours());
  const span = Array.from({ length: new Date().getHours() - first + 1 }, (_, i) => first + i);
  const max = Math.max(1, ...hours.values());
  return (
    <section class="card">
      <span class="label">Spent today</span>
      <b class="big-number">{dollars(b.today.cents)}</b>
      <span class="small muted">
        tools {dollars(b.today.cents - model)} · model {dollars(model)}
      </span>
      <div class="bars" role="img" aria-label="Spending per hour today">
        {span.map((h) => (
          <span class="bar-col" style={{ height: `${Math.max(4, ((hours.get(h) ?? 0) / max) * 100)}%` }} title={`${h}:00 ${dollars(hours.get(h) ?? 0)}`} key={h} />
        ))}
      </div>
      <span class="small muted">
        spend per hour, {first}:00 to {new Date().getHours()}:00
      </span>
    </section>
  );
}

// ---------- Time Machine ----------

function TimeMachineApp() {
  const b = useBox();
  const finished = [...b.tasks.values()].filter((t) => t.state === 'done' || t.state === 'undone').sort((x, y) => y.updatedAt.localeCompare(x.updatedAt));
  const workspaces = [...new Set(finished.map((t) => t.workspace))];
  const [ws, setWs] = useState(workspaces[0]);
  const here = finished.filter((t) => t.workspace === (ws ?? workspaces[0]));
  const layers = here.filter((t) => t.state === 'done');
  const [sel, setSel] = useState<string>();
  const selected = layers.find((t) => t.id === sel) ?? layers[0];
  const [diffs, setDiffs] = useState(new Map<string, Diff>());
  const ids = layers.map((t) => t.id).join(',');
  useEffect(() => {
    // shortcut: fetches the newest 12 layers' diffs; paginate if a workspace ever has more.
    void Promise.all(layers.slice(0, 12).map((t) => api<Diff>('GET', `/tasks/${t.id}/diff`).then((d) => [t.id, d] as const).catch(() => undefined))).then((r) =>
      setDiffs(new Map(r.filter((x) => !!x))),
    );
  }, [ids]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (!finished.length) return <p class="empty">No finished tasks yet. Each one becomes a layer here that you can undo on its own.</p>;
  const doUndo = async (t: Task) => {
    setBusy(true);
    setError('');
    try {
      await undo(t.id);
      setSel(undefined);
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  };
  const d = selected && diffs.get(selected.id);
  const stays = layers.filter((t) => t !== selected).flatMap((t) => (diffs.get(t.id)?.changes ?? []).map((c) => ({ ...c, from: t.title })));
  return (
    <div class="tm">
      {workspaces.length > 1 && (
        <nav class="tabs" aria-label="Workspace">
          {workspaces.map((w) => (
            <button class="tab" aria-pressed={w === (ws ?? workspaces[0])} onClick={() => (setWs(w), setSel(undefined))} key={w}>
              {w}
            </button>
          ))}
        </nav>
      )}
      <p class="lede">
        Workspace <code>{ws ?? workspaces[0]}</code> · {plural(layers.length, 'task layer')} on top of the base files · undo any one of them
      </p>
      <div class="tm-columns">
        <section class="tm-left">
          <div class="stack" aria-hidden="true">
            {layers.slice(0, 4).map((t, i, arr) => (
              <div class={`stack-layer${t === selected ? ' stack-selected' : ''}`} style={{ marginInline: `${(arr.length - i) * 20}px` }} key={t.id}>
                {t.title}
              </div>
            ))}
            <div class="stack-layer stack-base">Base files, never written</div>
          </div>
          <h3 class="label">Layers, newest first</h3>
          <ul class="layers">
            {here.map((t) => (
              <li key={t.id}>
                <button
                  class={`layer${t === selected ? ' layer-selected' : ''}${t.state === 'undone' ? ' layer-undone' : ''}`}
                  aria-pressed={t === selected}
                  disabled={t.state === 'undone'}
                  onClick={() => setSel(t.id)}
                >
                  <span class="layer-main">
                    <span class="layer-title">{t.title}</span>
                    <span class="mono small muted">
                      {t.id} · {hhmm(t.updatedAt)}
                      {diffs.get(t.id) ? ` · ${summary(diffs.get(t.id)!)}` : ''}
                    </span>
                  </span>
                  <StatePill state={t.state} />
                </button>
              </li>
            ))}
          </ul>
        </section>
        {selected ? (
          <section class="tm-right">
            <h3 class="tm-question">Undo "{selected.title}"?</h3>
            <p class="muted">Time Machine takes this one layer out of the stack. The base files are never written, and every other task keeps its changes.</p>
            <span class="label">Comes back</span>
            {d ? d.changes.length ? <DiffView text={d.diff} reverse /> : <p class="empty">This task changed no files.</p> : <p class="empty">Loading…</p>}
            <span class="label">Stays as it is</span>
            {stays.length ? (
              <ul class="files">
                {stays.map((c) => (
                  <li key={c.path + c.from}>
                    <code>{c.path}</code>
                    <span class="muted">from {c.from}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p class="empty">No other layer changed files here.</p>
            )}
            <div class="actions">
              <button class="btn btn-danger" disabled={busy} onClick={() => doUndo(selected)}>
                Undo {selected.title}
              </button>
              <button class="btn btn-secondary" disabled={busy} onClick={() => setSel(layers.find((t) => t !== selected)?.id)}>
                Keep it
              </button>
            </div>
            {error && (
              <p class="error" role="alert">
                Could not undo: {error}
              </p>
            )}
            <p class="footnote">
              Undo is <code>POST /api/tasks/{selected.id}/undo</code> and is logged as <code>task.state undone</code>. Undoing a Shopper purchase also refunds its order.
            </p>
          </section>
        ) : (
          <section class="tm-right">
            <p class="empty">Every task here is undone. The files are back to the base.</p>
          </section>
        )}
      </div>
    </div>
  );
}
const summary = (d: Diff) => d.changes.map((c) => `${c.path} ${c.change}`).slice(0, 2).join(', ') + (d.changes.length > 2 ? ` +${d.changes.length - 2}` : '');

// ---------- Settings: pairing, this box, boxes ----------

function Qr({ text, label }: { text: string; label: string }) {
  const q = qrcode(0, 'M');
  q.addData(text);
  q.make();
  return <div class="qr" role="img" aria-label={label} dangerouslySetInnerHTML={{ __html: q.createSvgTag({ cellSize: 6, margin: 0, scalable: true }) }} />;
}
const formatCode = (c: string) => c.toUpperCase().match(/.{1,4}/g)?.join('-') ?? c;
const loopback = ['127.0.0.1', 'localhost'].includes(location.hostname);

interface PairCode {
  code: string;
  url: string;
  expiresAt: string;
}
interface Device {
  id: string;
  name: string;
  pairedAt: string;
}

function SettingsApp() {
  const b = useBox();
  const [code, setCode] = useState<PairCode | string>();
  const [devices, setDevices] = useState<Device[]>();
  const fresh = () => api<PairCode>('POST', '/pair/start').then(setCode, (e) => setCode((e as Error).message));
  useEffect(() => {
    void fresh();
    let count = -1;
    const poll = () =>
      api<Device[]>('GET', '/devices').then((d) => {
        if (count >= 0 && d.length > count) void fresh(); // the code was used: show a new one
        count = d.length;
        setDevices(d);
      }, () => setDevices(undefined));
    void poll();
    const t = setInterval(poll, 3000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (typeof code !== 'object') return;
    const t = setTimeout(fresh, Math.max(5000, Date.parse(code.expiresAt) - Date.now()));
    return () => clearTimeout(t);
  }, [code]);
  const remove = (id: string) => api('DELETE', `/devices/${id}`).then(() => setDevices(devices?.filter((d) => d.id !== id)));
  // The phone opens the app's own pairing route. The box's /pair answers API calls, not page loads.
  const selfUrl = boxList().find((x) => x.self)?.url;
  const origin =
    typeof code === 'object' ? (/^https?:/.test(code.url) ? new URL(code.url).origin : selfUrl ? new URL(selfUrl).origin : loopback ? undefined : location.origin) : undefined;
  const url = origin && typeof code === 'object' ? `${origin}/#pair/${code.code}` : undefined;
  const h = b.health;
  const mine = pairing();
  return (
    <div class="settings">
      <section class="pair">
        <div class="qr-card">
          {url ? (
            <Qr text={url} label="Pairing code as a QR code" />
          ) : (
            <p class="muted small">{typeof code === 'string' ? `Pairing is not available on this box: ${code}` : code ? `This screen does not know the address phones use to reach the box (set BOX_URL). Open ${PRODUCT} from a laptop to show the QR code.` : 'Making a code…'}</p>
          )}
        </div>
        <div class="pair-text">
          <h3>Point your phone's camera at the code.</h3>
          <ol>
            <li>{PRODUCT} opens on your phone, on this box's own address.</li>
            <li>Check that the phone shows the same code as this screen.</li>
            <li>Approvals and running tasks now reach that phone. It never holds a key: it can only answer.</li>
          </ol>
          {typeof code === 'object' && <p class="pair-code mono">{formatCode(code.code)}</p>}
          {url && <p class="small muted mono">{url}</p>}
          <span class="label">Paired phones</span>
          <ul class="devices">
            {devices?.map((d) => (
              <li key={d.id}>
                <span>
                  <b>{d.name}</b>
                  <span class="small muted"> paired {new Date(d.pairedAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                </span>
                <button class="btn btn-secondary" onClick={() => remove(d.id)}>
                  Remove
                </button>
              </li>
            ))}
            {devices?.length === 0 && <li class="muted">No phone yet.</li>}
            {!devices && <li class="muted">The box did not list its phones.</li>}
          </ul>
        </div>
      </section>

      <section class="section">
        <h3>This box</h3>
        <dl class="facts">
          <Fact k="Status" v={b.down ? 'out of reach' : h?.ok ? 'running' : 'starting'} />
          <Fact
            k="Live updates"
            v={b.live === 'spacetimedb' ? `SpacetimeDB, database ${h?.spacetime.database}` : b.live === 'log stream' ? 'action log stream (SpacetimeDB out of reach)' : b.live}
          />
          <Fact k="Tasks" v={String(h?.tasks ?? b.tasks.size)} />
          <Fact k="Answers from here" v={mine ? `${mine.device.name} (paired)` : surface} />
        </dl>
        <p class="small muted mono">Tools: {h?.tools.join(', ') || 'none'}</p>
      </section>

      <section class="section">
        <h3>Boxes</h3>
        <ul class="files">
          {boxList().map((x) => (
            <li key={x.id}>
              <span>
                <b>{x.name}</b> <span class="mono small muted">{x.id}</span>
              </span>
              {x.self ? <span class="muted">this box</span> : x.url ? <a href={x.url}>Switch</a> : <span class="muted">no address yet</span>}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

/** Where a phone lands after scanning the box's QR code: /pair#<code>. */
function PairApp({ code }: { code: string }) {
  const guess = /iPhone/.test(navigator.userAgent) ? 'iPhone' : /Android/.test(navigator.userAgent) ? 'Android phone' : 'Phone';
  const [name, setName] = useState(guess);
  const [state, setState] = useState<'ask' | 'busy' | Pairing | string>(pairing() ?? 'ask');
  const go = (e: Event) => {
    e.preventDefault();
    setState('busy');
    api<Pairing>('POST', '/pair', { code, name: name.trim() || guess })
      .then((p) => {
        localStorage.setItem('pairing', JSON.stringify(p));
        setState(p);
      })
      .catch((err) => setState((err as Error).message));
  };
  if (typeof state === 'object')
    return (
      <div class="section">
        <p class="lede">
          This phone is paired with {PRODUCT} on {state.box.name} as <b>{state.device.name}</b>. When a task asks for an OK, it shows here, and your answer goes in the log under that name.
        </p>
        <div class="actions">
          <a class="btn btn-primary" href="/">
            Go to the box
          </a>
          <button class="btn btn-secondary" onClick={() => (localStorage.removeItem('pairing'), setState('ask'))}>
            Pair again
          </button>
        </div>
      </div>
    );
  return (
    <form class="section" onSubmit={go}>
      <p class="lede">Pair this phone with {PRODUCT}. Check that the box's screen shows this code:</p>
      <p class="pair-code mono">{code ? formatCode(code) : 'no code in the link'}</p>
      <label class="field">
        <span class="label">Name this phone</span>
        <input value={name} onInput={(e) => setName((e.target as HTMLInputElement).value)} maxLength={40} autoComplete="off" />
      </label>
      <div class="actions">
        <button class="btn btn-primary" disabled={!code || state === 'busy'}>
          Pair this phone
        </button>
        <a class="btn btn-secondary" href="/">
          Not now
        </a>
      </div>
      {state !== 'ask' && state !== 'busy' && (
        <p class="error" role="alert">
          Could not pair: {state}. Ask the box's screen for a new code.
        </p>
      )}
    </form>
  );
}
