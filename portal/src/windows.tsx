// App windows: Tasks, one task (its steps, blocked attempts, diff and Undo), Activity (the action log), Time Machine,
// Settings (pairing and boxes) and each track's own app. One window at a time, over the home screen.
import { useEffect, useRef, useState } from 'preact/hooks';
import qrcode from 'qrcode-generator';
import { api, box, onEvent, surface, undo, useBox, type Approval, type LogEvent, type Task } from './live.ts';
import { AnswerButtons, Glyph, STATE_WORDS, StatePill, ago, clock, dollars, plural, taskTitle } from './ui.tsx';
import { appList } from './home.tsx';

export function Window({ route, onClose }: { route: string; onClose: () => void }) {
  const [name, ...rest] = route.split('/');
  const arg = rest.join('/');
  const app = appList().find((a) => a.hash === `#${name}` || a.hash === `#${route}`);
  const view = (() => {
    switch (name) {
      case 'tasks':
        return { title: 'Tasks', glyph: 'tasks', body: <TasksApp filter={arg || 'all'} /> };
      case 'task':
        return { title: taskTitle(arg), glyph: 'tasks', body: <TaskApp id={arg} key={arg} /> };
      case 'activity':
        return { title: 'Activity', glyph: 'activity', body: <ActivityApp /> };
      case 'time-machine':
        return { title: 'Time Machine', glyph: 'time-machine', body: <TimeMachineApp /> };
      case 'settings':
        return { title: 'Settings', glyph: 'settings', body: <SettingsApp /> };
      case 'pair':
        return { title: 'Pair this phone', glyph: 'settings', body: <PairApp code={arg} /> };
      case 'app': {
        const a = box.apps.find((x) => `${x.track}/${x.name}` === arg);
        return { title: a?.title ?? arg, glyph: app?.glyph ?? 'tasks', body: a ? <iframe class="track-frame" title={a.title} src={`/t/${a.track}${a.href}`} /> : <p class="empty">No app called {arg} on this box.</p> };
      }
      default:
        return { title: 'Not found', glyph: 'tasks', body: <p class="empty">Nothing here.</p> };
    }
  })();

  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), [route]);
  return (
    <div class="window-layer" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <section class={`window${name === 'app' ? ' window-wide' : ''}`} role="dialog" aria-labelledby="window-title">
        <header class="window-bar">
          <button class="window-close" onClick={onClose} aria-label="Close and go home">
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
            </svg>
            <span class="phone-only">Home</span>
          </button>
          <span class="window-icon" aria-hidden="true">
            <Glyph name={view.glyph} title={view.title} />
          </span>
          <h2 id="window-title" tabIndex={-1} ref={heading}>
            {view.title}
          </h2>
        </header>
        <div class="window-body">{view.body}</div>
      </section>
    </div>
  );
}

// ---------- Tasks ----------

const FILTERS: [string, string, (t: Task) => boolean][] = [
  ['all', 'All', () => true],
  ['need', 'Need you', (t) => t.state === 'waiting'],
  ['running', 'Running', (t) => t.state === 'running' || t.state === 'queued'],
  ['done', 'Done', (t) => t.state === 'done'],
  ['failed', 'Failed', (t) => t.state === 'failed'],
  ['undone', 'Undone', (t) => t.state === 'undone'],
];
const newestFirst = (a: Task, b: Task) => (b.createdAt ?? '').localeCompare(a.createdAt ?? '') || b.updatedAt.localeCompare(a.updatedAt);

function TasksApp({ filter }: { filter: string }) {
  const b = useBox();
  const all = [...b.tasks.values()].sort(newestFirst);
  const [, , test] = FILTERS.find(([k]) => k === filter) ?? FILTERS[0];
  const asks = [...b.approvals.values()].filter((a) => a.state === 'pending');
  return (
    <>
      <div class="tabs" role="group" aria-label="Show">
        {FILTERS.map(([k, label, f]) => (
          <a class="tab" href={`#tasks/${k}`} aria-current={k === filter ? 'page' : undefined} key={k}>
            {label} <span class="tab-count">{all.filter(f).length}</span>
          </a>
        ))}
      </div>
      {(filter === 'all' || filter === 'need') && asks.length > 0 && (
        <section class="section">
          <h3>Waiting for your OK</h3>
          {asks.map((a) => (
            <ApprovalCard a={a} key={a.id} showTask />
          ))}
        </section>
      )}
      <section class="section">
        {filter === 'need' && asks.length === 0 && <p class="empty">Nothing is waiting for you.</p>}
        <ul class="rows">
          {all.filter(test).map((t) => (
            <li key={t.id}>
              <a class="row" href={`#task/${t.id}`}>
                <span class="row-main">
                  <span class="row-title">{t.title}</span>
                  <span class="row-meta">
                    <code>{t.id}</code> · {t.source} · {ago(t.updatedAt)}
                  </span>
                  {(t.step || t.error || t.summary) && <span class="row-live">{t.error ?? (t.state === 'done' && t.summary ? t.summary : t.step)}</span>}
                </span>
                <StatePill state={t.state} />
                <span class="row-cost">
                  <code>{dollars(t.costCents)}</code> of <code>{dollars(t.budgetCents)}</code>
                </span>
              </a>
            </li>
          ))}
        </ul>
        {all.length === 0 && <p class="empty">No tasks yet. A task starts from a trigger, a track or the API.</p>}
      </section>
    </>
  );
}

function ApprovalCard({ a, showTask }: { a: Approval; showTask?: boolean }) {
  return (
    <div class="card card-ask">
      {showTask && (
        <a class="card-kicker" href={`#task/${a.task}`}>
          {taskTitle(a.task)} · <code>{a.task}</code>
        </a>
      )}
      <p class="card-question">{a.question}</p>
      {a.costCents > 0 && (
        <p class="card-meta">
          Spending <code>{dollars(a.costCents)}</code>. Other tasks keep running while this one waits.
        </p>
      )}
      <AnswerButtons a={a} big={surface !== 'portal'} />
    </div>
  );
}

// ---------- One task ----------

interface Detail {
  task: Task;
  approvals: Approval[];
  events: LogEvent[];
}
interface Diff {
  changes: { path: string; change: 'added' | 'modified' | 'deleted' }[];
  diff: string;
}

function TaskApp({ id }: { id: string }) {
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
  useBox(); // approvals answered elsewhere show here at once

  if (error) return <p class="empty">Could not load this task: {error}</p>;
  if (!detail) return <p class="empty">Loading…</p>;
  const t = { ...detail.task, ...box.tasks.get(id), hosts: detail.task.hosts, tools: detail.task.tools };
  const asks = detail.approvals.map((a) => box.approvals.get(a.id) ?? a).filter((a) => a.state === 'pending');
  const blocked = detail.events.filter((e) => e.type === 'net.blocked' || (e.type === 'tool.result' && !e.ok));
  return (
    <>
      <section class="task-head">
        <StatePill state={t.state} />
        <span class="task-cost">
          <code>{dollars(t.costCents)}</code> of <code>{dollars(t.budgetCents)}</code> budget
        </span>
        <dl class="facts">
          <div>
            <dt>Task</dt>
            <dd>
              <code>{t.id}</code>, runs as <code>{t.user}</code>
            </dd>
          </div>
          <div>
            <dt>Started by</dt>
            <dd>{t.source}</dd>
          </div>
          <div>
            <dt>Works on</dt>
            <dd>
              its own copy of <code>{t.workspace}</code>
            </dd>
          </div>
          <div>
            <dt>Worker</dt>
            <dd>{t.worker === 'droid' ? 'Droid with Claude' : 'scripted (test)'}</dd>
          </div>
          <div>
            <dt>May reach</dt>
            <dd>{t.hosts.length ? t.hosts.map((h) => <code key={h}>{h} </code>) : 'no network'}</dd>
          </div>
          <div>
            <dt>Tools</dt>
            <dd>{t.tools.length ? t.tools.map((h) => <code key={h}>{h} </code>) : 'none'}</dd>
          </div>
        </dl>
        {(t.error || t.summary) && <p class={t.error ? 'task-error' : 'task-summary'}>{t.error ?? t.summary}</p>}
      </section>

      {asks.map((a) => (
        <ApprovalCard a={a} key={a.id} />
      ))}

      {blocked.length > 0 && (
        <section class="section">
          <h3>Blocked</h3>
          <ul class="log">
            {blocked.map((e) => (
              <LogLine e={e} events={detail.events} key={e.seq} />
            ))}
          </ul>
          <p class="note">
            The box stopped {blocked.length === 1 ? 'this' : 'these'} and wrote {blocked.length === 1 ? 'it' : 'them'} in the log. The task never held a key: the vault
            makes calls for it.
          </p>
        </section>
      )}

      <Changes task={t} diff={diff} reload={load} />

      <section class="section">
        <h3>Every step</h3>
        <ul class="log">
          {detail.events.map((e) => (
            <LogLine e={e} events={detail.events} key={e.seq} />
          ))}
        </ul>
      </section>
    </>
  );
}

function Changes({ task, diff, reload }: { task: Task; diff?: Diff; reload: () => void }) {
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const doUndo = async () => {
    setBusy(true);
    setError('');
    try {
      await undo(task.id);
      setConfirm(false);
      reload();
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  };
  const n = diff?.changes.length ?? 0;
  return (
    <section class="section">
      <div class="section-head">
        <h3>Changes</h3>
        {task.state !== 'undone' && !confirm && (
          <button class="btn btn-danger" onClick={() => setConfirm(true)}>
            Undo this task
          </button>
        )}
      </div>
      {confirm && (
        <div class="card card-confirm" role="alertdialog" aria-labelledby="undo-q">
          <p id="undo-q" class="card-question">
            Undo “{task.title}”?
          </p>
          <p class="card-meta">
            {task.state === 'running' || task.state === 'waiting' ? 'It stops now and ' : 'Its '}
            {plural(n, 'file change')} {task.state === 'running' || task.state === 'waiting' ? 'go' : 'goes'} away. Every other task keeps its changes. This can't be redone.
          </p>
          <div class="answer">
            <button class="btn btn-danger" disabled={busy} onClick={doUndo}>
              Undo task
            </button>
            <button class="btn btn-secondary" disabled={busy} onClick={() => setConfirm(false)}>
              Keep it
            </button>
          </div>
          {error && (
            <p class="error" role="alert">
              Could not undo: {error}
            </p>
          )}
        </div>
      )}
      {task.state === 'undone' && <p class="note">Undone. These changes were taken out of your files. Other tasks kept theirs.</p>}
      {!diff && <p class="empty">No changes to show.</p>}
      {diff && n === 0 && <p class="empty">This task changed no files.</p>}
      {diff && n > 0 && (
        <>
          <ul class="changes">
            {diff.changes.map((c) => (
              <li key={c.path}>
                <span class={`change change-${c.change}`}>{c.change}</span> <code>{c.path}</code>
              </li>
            ))}
          </ul>
          <pre class={`diff${task.state === 'undone' ? ' diff-undone' : ''}`} aria-label="Unified diff">
            {diff.diff.split('\n').map((l, i) => (
              <span class={l.startsWith('+') && !l.startsWith('+++') ? 'add' : l.startsWith('-') && !l.startsWith('---') ? 'del' : l.startsWith('@@') ? 'hunk' : ''} key={i}>
                {l + '\n'}
              </span>
            ))}
          </pre>
        </>
      )}
    </section>
  );
}

// ---------- the action log ----------

function toolOf(events: LogEvent[], key: string) {
  const c = events.findLast((e) => e.type === 'tool.call' && e.key === key);
  return c?.type === 'tool.call' ? c.tool : 'the tool';
}
const short = (v: unknown) => {
  const s = typeof v === 'string' ? v : JSON.stringify(v);
  return s.length > 160 ? s.slice(0, 157) + '…' : s;
};

/** One log event as a sentence. `tone` marks what deserves color: blocked attempts, requests, spending. */
export function describe(e: LogEvent, events: LogEvent[]): { text: string; tone?: 'blocked' | 'ask' | 'money' } {
  switch (e.type) {
    case 'task.created':
      return {
        text: `Started “${e.spec.title}” as ${e.user}, with ${e.spec.worker === 'droid' ? 'Droid and Claude' : 'the scripted worker'}, ${
          e.spec.hosts.length ? `allowed to reach ${e.spec.hosts.join(', ')}` : 'with no network'
        }`,
      };
    case 'task.state':
      return { text: `${STATE_WORDS[e.state]}${e.error ? `: ${e.error}` : ''}${e.summary ? `: ${e.summary}` : ''}`, tone: e.state === 'failed' ? 'blocked' : undefined };
    case 'task.step':
      return { text: e.text };
    case 'tool.call':
      return { text: `Asked the box to run ${e.tool}` };
    case 'tool.result':
      return e.ok
        ? { text: `${toolOf(events, e.key)} finished${e.cents ? `, spent ${dollars(e.cents)}` : ''}`, tone: e.cents ? 'money' : undefined }
        : { text: `${toolOf(events, e.key)} refused: ${e.error}`, tone: 'blocked' };
    case 'approval.asked':
      return { text: `Asked for an OK: ${e.approval.question}`, tone: 'ask' };
    case 'approval.answered':
      return { text: `${e.approved ? 'Approved' : 'Denied'} by ${e.by}`, tone: 'ask' };
    case 'cost':
      return { text: `Spent ${dollars(e.cents)} on ${e.what}${e.model ? ` (${e.model})` : ''}`, tone: 'money' };
    case 'net.blocked':
      return { text: `Blocked: it tried to reach ${e.host}, which is not on its list`, tone: 'blocked' };
    case 'note':
      return { text: `${e.track}: ${short(e.data)}` };
  }
}

function LogLine({ e, events, withTask }: { e: LogEvent; events: LogEvent[]; withTask?: boolean }) {
  const d = describe(e, events);
  return (
    <li class={`logline${d.tone ? ` tone-${d.tone}` : ''}`}>
      <code class="seq" title="Line in log.jsonl">
        #{e.seq}
      </code>
      <time class="time" dateTime={e.at}>
        {clock(e.at)}
      </time>
      <span class="logtext">
        {withTask && e.task && (
          <a class="logtask" href={`#task/${e.task}`}>
            {taskTitle(e.task)}
          </a>
        )}
        {d.text}
      </span>
    </li>
  );
}

const KINDS: [string, string, (e: LogEvent, events: LogEvent[]) => boolean][] = [
  ['all', 'Everything', () => true],
  ['blocked', 'Blocked', (e, ev) => describe(e, ev).tone === 'blocked'],
  ['ask', 'Approvals', (e) => e.type === 'approval.asked' || e.type === 'approval.answered'],
  ['money', 'Spending', (e, ev) => describe(e, ev).tone === 'money'],
  ['steps', 'Steps', (e) => e.type === 'task.step' || e.type === 'task.state' || e.type === 'task.created'],
];

function ActivityApp() {
  const b = useBox();
  const [kind, setKind] = useState('all');
  const [, , test] = KINDS.find(([k]) => k === kind)!;
  const rows = b.events.filter((e) => test(e, b.events)).slice(-300).reverse();
  return (
    <>
      <p class="lede">
        Everything every agent did, newest first, live. Each line's number is its line in the box's log on disk, <code>log.jsonl</code>.
      </p>
      <div class="tabs" role="group" aria-label="Show">
        {KINDS.map(([k, label]) => (
          <button class="tab" aria-pressed={k === kind} onClick={() => setKind(k)} key={k}>
            {label}
          </button>
        ))}
      </div>
      <ul class="log">
        {rows.map((e) => (
          <LogLine e={e} events={b.events} withTask key={e.seq} />
        ))}
      </ul>
      {rows.length === 0 && <p class="empty">Nothing here yet.</p>}
    </>
  );
}

// ---------- Time Machine ----------

function TimeMachineApp() {
  const b = useBox();
  const layers = [...b.tasks.values()].filter((t) => t.state === 'done' || t.state === 'undone').sort(newestFirst);
  const byWorkspace = new Map<string, Task[]>();
  for (const t of layers) byWorkspace.set(t.workspace, [...(byWorkspace.get(t.workspace) ?? []), t]);
  return (
    <>
      <p class="lede">
        Every finished task is a layer on top of your files. Undo takes one layer out and leaves the others. The files underneath are never written.
      </p>
      {layers.length === 0 && <p class="empty">No finished tasks yet.</p>}
      {[...byWorkspace].map(([ws, ts]) => (
        <section class="section" key={ws}>
          <h3>
            <code>{ws}</code>, {plural(ts.filter((t) => t.state === 'done').length, 'layer')}
          </h3>
          <ul class="rows">
            {ts.map((t) => (
              <li key={t.id}>
                <a class={`row${t.state === 'undone' ? ' row-undone' : ''}`} href={`#task/${t.id}`}>
                  <span class="row-main">
                    <span class="row-title">{t.title}</span>
                    <span class="row-meta">
                      <code>{t.id}</code> · finished {ago(t.updatedAt)} · <code>{dollars(t.costCents)}</code>
                    </span>
                  </span>
                  <StatePill state={t.state} />
                  <span class="row-cost">{t.state === 'done' ? 'See changes and undo' : 'Taken out'}</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}

// ---------- Settings: this box, pairing, boxes ----------

/** Boxes this browser has opened, so a phone can switch between them. Each box serves its own portal. */
function knownBoxes(): { name: string; url: string }[] {
  const list = JSON.parse(localStorage.getItem('boxes') ?? '[]') as { name: string; url: string }[];
  if (!['127.0.0.1', 'localhost'].includes(location.hostname) && !list.some((x) => x.url === location.origin)) {
    list.push({ name: location.hostname, url: location.origin });
    localStorage.setItem('boxes', JSON.stringify(list));
  }
  return list;
}

function Qr({ text, label }: { text: string; label: string }) {
  const q = qrcode(0, 'M');
  q.addData(text);
  q.make();
  return <div class="qr" role="img" aria-label={label} dangerouslySetInnerHTML={{ __html: q.createSvgTag({ cellSize: 6, margin: 2, scalable: true }) }} />;
}

function SettingsApp() {
  const b = useBox();
  const [pair, setPair] = useState<{ code: string; url: string; expiresAt?: string } | string>();
  const [boxes, setBoxes] = useState<{ id?: string; name: string; url: string }[]>();
  useEffect(() => {
    api<{ id: string; name: string; url: string }[]>('GET', '/boxes')
      .then(setBoxes)
      .catch(() => setBoxes(undefined));
  }, []);
  const startPairing = () =>
    api<{ code: string; url: string; expiresAt?: string }>('POST', '/pair/start')
      .then(setPair)
      .catch((e) => setPair((e as Error).message));
  const list = [...(boxes ?? []), ...knownBoxes().filter((k) => !boxes?.some((x) => x.url === k.url))];
  const h = b.health;
  return (
    <>
      <section class="section">
        <h3>This box</h3>
        <dl class="facts">
          <div>
            <dt>Status</dt>
            <dd>{b.live === 'offline' ? 'Out of reach' : h?.ok ? 'Running' : 'Starting'}</dd>
          </div>
          <div>
            <dt>Live updates</dt>
            <dd>
              {b.live === 'spacetimedb'
                ? `SpacetimeDB, database ${h?.spacetime.database}, port ${h?.spacetime.port}`
                : b.live === 'log stream'
                  ? 'The action log stream (SpacetimeDB is out of reach from here)'
                  : b.live}
            </dd>
          </div>
          <div>
            <dt>Tasks</dt>
            <dd>{h?.tasks ?? b.tasks.size}</dd>
          </div>
          <div>
            <dt>Tools</dt>
            <dd>{h?.tools.map((t) => <code key={t}>{t} </code>) ?? 'none'}</dd>
          </div>
          <div>
            <dt>Answers from here</dt>
            <dd>are logged as "{surface}"</dd>
          </div>
        </dl>
      </section>

      <section class="section">
        <h3>Pair a phone</h3>
        {!pair && (
          <button class="btn btn-primary" onClick={startPairing}>
            Show a pairing code
          </button>
        )}
        {typeof pair === 'object' && (
          <div class="pair">
            <Qr text={pair.url} label={`Pairing code ${pair.code}`} />
            <p>
              Scan this with your phone's camera, or open <code>{pair.url}</code> and enter <code class="pair-code">{pair.code}</code>.
              {pair.expiresAt && ` It works once, until ${clock(pair.expiresAt)}.`}
            </p>
          </div>
        )}
        {typeof pair === 'string' && (
          <div class="pair">
            <Qr text={location.origin} label={`Link to ${location.origin}`} />
            <p>
              One-time pairing codes are not on this box yet ({pair}). For now, scan this to open the portal at <code>{location.origin}</code> on a phone that can
              reach the box.
            </p>
          </div>
        )}
      </section>

      <section class="section">
        <h3>Boxes</h3>
        <ul class="rows">
          <li>
            <span class="row row-static">
              <span class="row-main">
                <span class="row-title">This box</span>
                <span class="row-meta">
                  <code>{location.origin}</code>
                </span>
              </span>
              <span class="pill pill-done">Open</span>
            </span>
          </li>
          {list
            .filter((x) => x.url !== location.origin)
            .map((x) => (
              <li key={x.url}>
                <a class="row" href={x.url}>
                  <span class="row-main">
                    <span class="row-title">{x.name}</span>
                    <span class="row-meta">
                      <code>{x.url}</code>
                    </span>
                  </span>
                  <span class="row-cost">Switch</span>
                </a>
              </li>
            ))}
        </ul>
        {!boxes && <p class="note">The box's own list of paired boxes is not on this box yet; this list is the boxes this browser has opened.</p>}
      </section>
    </>
  );
}

/** Where a phone lands after scanning the box's pairing code. */
function PairApp({ code }: { code: string }) {
  const params = new URLSearchParams(location.search);
  const token = code || params.get('code') || params.get('token') || '';
  const [state, setState] = useState<'ask' | 'busy' | 'done' | string>('ask');
  const go = () => {
    setState('busy');
    api('POST', '/pair', { code: token, name: navigator.userAgent.includes('iPhone') ? 'iPhone' : 'Phone' })
      .then((r: { token?: string }) => {
        if (r.token) localStorage.setItem('pairing', JSON.stringify({ box: location.origin, ...r }));
        setState('done');
      })
      .catch((e) => setState((e as Error).message));
  };
  return (
    <section class="section">
      {state === 'done' ? (
        <p class="lede">Paired. Requests from this box now reach this phone. Go home to see them.</p>
      ) : (
        <>
          <p class="lede">
            Pair this phone with the box at <code>{location.host}</code>? It will show the box's tasks and let you answer its requests.
          </p>
          <p class="card-meta">
            Code <code class="pair-code">{token || 'missing'}</code>
          </p>
          <div class="answer answer-big">
            <button class="btn btn-primary" disabled={!token || state === 'busy'} onClick={go}>
              Pair this phone
            </button>
            <a class="btn btn-secondary" href="#">
              Not now
            </a>
          </div>
          {state !== 'ask' && state !== 'busy' && (
            <p class="error" role="alert">
              Could not pair: {state}
            </p>
          )}
        </>
      )}
    </section>
  );
}
