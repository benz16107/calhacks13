// One task's window (Figma 84:4845): its state, cost, blocked attempts, steps from the log, the files it changed
// and what it was allowed. Undo task is the header bar's main action, behind an alert (84:5090).
import { useEffect, useState } from 'preact/hooks';
import { api, box, hosted, machine, onEvent, undo, useBox, type Approval, type LogEvent, type Task } from '../live.ts';
import { Alert, AppIcon, Badge, Button, Icon, IconButton, Menu, Popover, StatusPage } from '../kit/ui.tsx';
import { HeaderBar, open, useWin } from '../wm.tsx';
import { STATE, appOf, clock, dollars, needsModelKey, sentence, taskTitle, testMoney } from '../util.ts';
import { PRODUCT } from '../product.ts';
import { DiffView, describe, silent, undoCopy, type Diff } from './log.tsx';
import { AnswerButtons } from './answer.tsx';

interface Detail {
  task: Task;
  approvals: Approval[];
  events: LogEvent[];
}

const isBlocked = (e: LogEvent) => e.type === 'net.blocked' || (e.type === 'tool.result' && !e.ok);
/** The owner's own permission setting refused it (core/permissions.ts says where to allow it): not an attack. */
const byPermission = (e: LogEvent) => e.type === 'tool.result' && !e.ok && /Settings, Permissions/.test(e.error ?? '');
const FINISHED: Task['state'][] = ['done', 'failed', 'undone'];
const CHANGE: Record<string, [string, 'success' | 'neutral' | 'destructive']> = { added: ['Added', 'success'], modified: ['Modified', 'neutral'], deleted: ['Deleted', 'destructive'] };
const span = (ms: number) => (ms < 60_000 ? `${Math.max(1, Math.round(ms / 1000))} s` : ms < 3_600_000 ? `${Math.round(ms / 60_000)} min` : `${(ms / 3_600_000).toFixed(1)} h`);

export function TaskApp({ id }: { id: string }) {
  const b = useBox();
  const win = useWin();
  const [detail, setDetail] = useState<Detail>();
  const [diff, setDiff] = useState<Diff>();
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [menu, setMenu] = useState<HTMLElement | null>(null);
  const load = () =>
    Promise.all([api<Detail>('GET', `/tasks/${id}`), api<Diff>('GET', `/tasks/${id}/diff`).catch(() => undefined)])
      .then(([d, f]) => (setDetail(d), setDiff(f), setError('')))
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

  const t: Task | undefined = detail && { ...detail.task, ...b.tasks.get(id), hosts: detail.task.hosts, tools: detail.task.tools, user: detail.task.user };
  const app = t ? appOf(t) : undefined;
  // Undo only when there is something to undo: changed files or money spent. A waiting task answers in its body.
  const undoable = !!t && !['undone', 'running', 'queued', 'waiting'].includes(t.state) && (!!diff?.changes.length || t.costCents > 0);
  const head = (
    <HeaderBar
      start={
        app && (
          <span class="gos-w-task-head">
            <AppIcon id={app.id} title={app.title} size={24} />
            <span>{app.title}</span>
          </span>
        )
      }
      title={t?.title ?? taskTitle(id)}
      end={
        <>
          {t && !['running', 'queued'].includes(t.state) && (
            <Button icon="media-playback-start" onClick={() => open(`replay/${id}`)}>
              Replay
            </Button>
          )}
          {undoable && (
            <Button kind="destructive" onClick={() => setConfirm(true)}>
              Undo task
            </Button>
          )}
          <IconButton icon="open-menu" label="Task menu" aria-expanded={!!menu} onClick={(e) => setMenu(e.currentTarget as HTMLElement)} />
        </>
      }
    />
  );
  const popover = menu && (
    <Popover anchor={menu} onClose={() => setMenu(null)} align="end" label="Task menu">
      <Menu
        label="Task menu"
        onClose={() => setMenu(null)}
        items={[
          { label: 'Copy task ID', icon: 'edit-copy', run: () => void navigator.clipboard?.writeText(id).then(() => win?.toast(`Copied ${id}`)) },
          { label: 'Show in Activity', icon: 'utilities-terminal', run: () => open('activity') },
          { label: 'Show in Time Machine', icon: 'document-open-recent', run: () => open('time-machine') },
          'sep',
          { label: 'All tasks', icon: 'view-list', run: () => open('tasks') },
        ]}
      />
    </Popover>
  );

  if (!detail || !t)
    return (
      <>
        {head}
        {popover}
        <div class="g-window-content">
          {error ? (
            <StatusPage icon="dialog-warning" title="Could not load this task" action={<Button onClick={() => void load()}>Try again</Button>}>
              {error}
            </StatusPage>
          ) : (
            <div class="gos-skeleton" aria-busy="true" />
          )}
        </div>
      </>
    );

  const asks = detail.approvals.map((a) => b.approvals.get(a.id) ?? a).filter((a) => a.state === 'pending');
  const blocked = detail.events.filter((e) => isBlocked(e) && !byPermission(e));
  const refused = [...new Set(detail.events.flatMap((e) => (byPermission(e) && e.type === 'tool.result' ? [sentence(e.error ?? '')] : [])))];
  const looks = detail.events.flatMap((e) => (e.type === 'task.step' && (e.data as { review?: { verdict: string } } | undefined)?.review ? [(e.data as { review: { verdict: string } }).review] : []));
  const hostsTried = [...new Set(blocked.flatMap((e) => (e.type === 'net.blocked' ? [e.host] : [])))];
  const created = detail.events.find((e) => e.type === 'task.created');
  const ended = detail.events.findLast((e) => e.type === 'task.state' && FINISHED.includes(e.state));
  const start = Date.parse(created?.at ?? t.createdAt);
  const timing = ended ? `took ${span(Date.parse(ended.at) - start)}` : t.state === 'waiting' ? 'waiting for you' : t.state === 'queued' ? 'waiting to start' : `running for ${span(Date.now() - start)}`;
  const cost = t.budgetCents > 0 ? `${dollars(t.costCents)} of a ${dollars(t.budgetCents)} budget` : `${dollars(t.costCents)} spent, no budget`;
  const [word, kind] = STATE[t.state];
  const owner = t.workspace.startsWith('owner-');
  const copy = undoCopy(t, diff?.changes.length);
  const doUndo = async () => {
    setBusy(true);
    try {
      await undo(t.id);
      win?.toast(`Undid ${t.title}. Every other task kept its changes.`);
      void load();
    } catch (e) {
      win?.toast(`Could not undo: ${(e as Error).message}`);
    }
    setBusy(false);
    setConfirm(false);
  };

  return (
    <>
      {head}
      {popover}
      <div class="g-window-content gos-scroll">
        {hosted && machine() && (
          <p class="g-chip gos-machine-chip">
            <Icon name="computer" />
            {machine()!.box.name}
            {box.business.me?.person ? ` · signed in as ${box.business.me.person.name}` : ''}
          </p>
        )}
        <div class="gos-w-task">
          <div class="gos-w-task-main">
            <p class="gos-w-state t-body">
              <Badge kind={kind}>{word}</Badge>
              <span>
                Started {clock(start)} · {timing} · {cost}
              </span>
            </p>

            {blocked.length > 0 && (
              <div class="gos-w-alert" role="note">
                <Icon name="dialog-warning" />
                <div>
                  <strong>
                    {blocked.length === 1 ? 'This task tried 1 thing it is not allowed to do. It was blocked and logged.' : `This task tried ${blocked.length} things it is not allowed to do. All ${blocked.length} were blocked and logged.`}
                  </strong>
                  <p class="t-body">
                    {hostsTried.length > 0 && `It tried to reach ${hostsTried.join(', ')}, and ${t.hosts.length ? `may only reach ${t.hosts.join(', ')}` : 'may not reach any host'}. `}
                    It never held a key: {PRODUCT} keeps keys where agents can't read them and makes each call for the agent.
                  </p>
                </div>
              </div>
            )}
            {refused.length > 0 && (
              <div class="g-banner" role="note">
                <Icon name="security-high" />
                <div>
                  <p class="t-body-strong">{refused.length === 1 ? 'Your permission settings stopped 1 thing.' : `Your permission settings stopped ${refused.length} things.`}</p>
                  <p class="t-body">{refused.join(' ')}</p>
                </div>
              </div>
            )}
            {asks.map((a) => (
              <div class="g-banner" key={a.id}>
                <Icon name="dialog-question" />
                <div>
                  <p class="t-body-strong">{a.question}</p>
                  <p class="t-caption t-secondary">{a.costCents ? `${dollars(a.costCents)}${testMoney(t) ? ' (test money)' : ''}` : 'No money involved'} · the first answer wins</p>
                </div>
                <span class="gos-actions">
                  <AnswerButtons a={a} />
                </span>
              </div>
            ))}
            {needsModelKey(t) && (
              <div class="g-banner" role="note">
                <Icon name="dialog-password" />
                <div>
                  <p class="t-body-strong">No model key, so the agent could not think</p>
                  <p class="t-body">Add an Anthropic or Factory API key in Settings, then start the task again.</p>
                </div>
                <Button kind="suggested" onClick={() => open('settings/agents')}>
                  Add a model key
                </Button>
              </div>
            )}
            {(t.error || (t.summary && t.state === 'done')) && <p class={`t-body${t.error ? ' t-destructive' : ''}`}>{t.error ?? t.summary}</p>}

            <h3 class="t-heading">Steps, from the action log</h3>
            <ol class="gos-w-steps">
              {detail.events.filter((e) => !silent(e)).map((e) => {
                const bad = isBlocked(e);
                return (
                  <li class={`gos-w-step${bad ? ' is-blocked' : ''}`} key={e.seq}>
                    <span class="gos-w-mono">{e.seq}</span>
                    <time class="gos-w-mono" dateTime={e.at}>
                      {clock(e.at)}
                    </time>
                    {bad && <Icon name="process-stop" label="Blocked" />}
                    <span class="t-body">{describe(e, detail.events).text}</span>
                  </li>
                );
              })}
            </ol>
          </div>

          <aside class="gos-w-task-side">
            <h3 class="t-heading">Files it changed</h3>
            {diff && diff.changes.length > 0 ? (
              <>
                <div class="gos-w-card">
                  {diff.changes.map((c) => (
                    <div class="gos-w-file" key={c.path}>
                      <Icon name="folder" />
                      <span class="t-mono">{c.path}</span>
                      <Badge kind={CHANGE[c.change][1]}>{CHANGE[c.change][0]}</Badge>
                    </div>
                  ))}
                </div>
                <p class="t-caption t-secondary">
                  {owner ? 'In its own copy until you Keep them. Your folder is untouched until then.' : "In its own copy only. Undo removes this task's layer; every other task keeps its changes."}
                </p>
                <details class="gos-w-diff">
                  <summary>Show the changes line by line</summary>
                  <DiffView text={diff.diff} />
                </details>
              </>
            ) : (
              <p class="t-body t-secondary">{t.state === 'undone' ? 'Undone: its files were removed. Every other task kept its own.' : diff ? 'No files changed.' : 'No changes to show.'}</p>
            )}
            {owner && t.state === 'done' && <KeepButton task={t} events={detail.events} after={load} />}

            <h3 class="t-heading">What it was allowed</h3>
            <div class="gos-w-card">
              <div class="gos-w-fact">
                <span>Runs as</span>
                <span>
                  Its own user <span class="t-mono t-secondary">({t.user})</span>
                </span>
              </div>
              <div class="gos-w-fact">
                <span>Sites it may reach</span>
                <span class="t-mono">{t.hosts.join(', ') || 'none'}</span>
              </div>
              <div class="gos-w-fact">
                <span>Tools</span>
                <span>{t.tools.join(', ') || 'none'}</span>
              </div>
              <div class="gos-w-fact">
                <span>Budget</span>
                <span>{t.budgetCents > 0 ? dollars(t.budgetCents) : 'none, every spend asks'}</span>
              </div>
              <div class="gos-w-fact">
                <span>Agent</span>
                <span>{t.worker === 'droid' ? 'Claude' : 'Scripted (test)'}</span>
              </div>
              {t.model && (
                <div class="gos-w-fact">
                  <span>Model</span>
                  <span class="t-mono">{t.model}</span>
                </div>
              )}
              {looks.length > 0 && (
                <div class="gos-w-fact">
                  <span>Second look</span>
                  <span>{looks.length} risky step{looks.length > 1 ? 's' : ''} checked, {looks.filter((r) => r.verdict !== 'ok').length} off goal</span>
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
      {confirm && <Alert title={`Undo ${t.title}?`} body={copy.body} action={copy.action} destructive busy={busy} onConfirm={() => void doUndo()} onCancel={() => setConfirm(false)} />}
    </>
  );
}

/** Personal edition: a done task on one of the owner's real folders waits for Keep before the folder changes. */
function KeepButton({ task, events, after }: { task: Task; events: LogEvent[]; after: () => void }) {
  const [result, setResult] = useState('');
  // Only the core's own keep events: a task can log a step with any data, including one that looks like a Keep.
  const kept = task.review === 'kept' || events.some((e) => e.type === 'keep' && e.result === 'kept');
  if (kept) return <p class="t-body t-success">Kept: the changes are in your folder.</p>;
  const go = () =>
    api<{ kept?: unknown[]; conflicts?: string[] }>('POST', `/tasks/${task.id}/keep`)
      .then((r) => (r.conflicts ? setResult(`Not kept: you changed ${r.conflicts.join(', ')} too. Nothing was written.`) : after()))
      .catch((e) => setResult(`Could not keep: ${(e as Error).message}`));
  return (
    <div class="gos-keep">
      <Button kind="suggested" onClick={go}>
        Keep changes
      </Button>
      <span class="t-caption t-secondary" role={result ? 'status' : undefined}>
        {result || 'Writes them into your real folder. Until then it is untouched.'}
      </span>
    </div>
  );
}
