// Tasks, like a system monitor (Figma 57:722): views in the header bar, one row per task with the user it runs as,
// its state, what it does now, its cost of its budget, and a summary strip. And one task's own window.
import type { JSX } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { api, box, pairing, surface, undo, useBox, type Task } from '../live.ts';
import { Alert, AppIcon, Badge, Button, ContextMenu, Icon, IconButton, Menu, Popover, Progress, Sheet, StatusPage, ToggleGroup, type MenuItem } from '../kit/ui.tsx';
import { HeaderBar, InWindow, open, useWin } from '../wm.tsx';
import { STATE, appOf, approvalFor, dollars, hhmm, needsModelKey, ofState, pending, plural } from '../util.ts';
import { AnswerButtons } from './answer.tsx';
import { undoCopy } from './log.tsx';

type View = 'all' | 'running' | 'waiting' | 'done';
const VIEWS: [View, string, (t: Task) => boolean][] = [
  ['all', 'All', () => true],
  ['running', 'Running', (t) => t.state === 'running' || t.state === 'queued'],
  ['waiting', 'Waiting', (t) => t.state === 'waiting'],
  ['done', 'Done', (t) => t.state === 'done' || t.state === 'undone' || t.state === 'failed'],
];
const newestFirst = (a: Task, b: Task) => (b.createdAt ?? '').localeCompare(a.createdAt ?? '') || b.updatedAt.localeCompare(a.updatedAt);
export const costOf = (t: Pick<Task, 'costCents' | 'budgetCents'>) => (t.budgetCents > 0 ? `${dollars(t.costCents)} of ${dollars(t.budgetCents)}` : dollars(t.costCents));
/** "step 4 of 7" or "Batch 2 of 4" in a step is progress the box can show. */
const progressOf = (step?: string) => {
  const m = step?.match(/(\d+)\s+of\s+(\d+)/i);
  return m && +m[2] > 0 ? Math.min(100, (100 * +m[1]) / +m[2]) : undefined;
};

/** What a task does now, in one line. Amber when it waits for you, red when it was stopped. */
export function now(t: Task): { text: string; tone?: 'attention' | 'destructive' } {
  if (t.state === 'waiting') {
    const a = approvalFor(t.id);
    return { text: a ? `Asks: ${a.question}` : 'Waiting for you', tone: 'attention' };
  }
  const blocked = box.events.filter((e) => e.task === t.id && e.type === 'net.blocked').length;
  if (needsModelKey(t)) return { text: 'No model key. Add one in Settings, Agents & Models.', tone: 'destructive' };
  if (t.state === 'failed') return { text: t.error ?? 'Failed', tone: 'destructive' };
  if (t.state === 'undone') return { text: `Undone at ${hhmm(t.updatedAt)}.${blocked ? ` ${plural(blocked, 'attempt')} blocked.` : ''}` };
  if (t.state === 'done') return { text: t.summary || t.step || 'Done' };
  if (blocked) return { text: `${t.step || 'Working'} · ${plural(blocked, 'attempt')} blocked`, tone: 'destructive' };
  return { text: t.step || (t.state === 'queued' ? 'Waiting to start' : 'Starting') };
}

const COLS = 'minmax(240px, 380fr) minmax(90px, 120fr) minmax(150px, 190fr) minmax(110px, 130fr) minmax(200px, 360fr) minmax(120px, 150fr) minmax(70px, 114fr)';

export function TasksApp({ view }: { view: string }) {
  const b = useBox();
  const win = useWin();
  const v = (VIEWS.find(([k]) => k === view)?.[0] ?? 'all') as View;
  const [q, setQ] = useState('');
  const [searching, setSearching] = useState(false);
  const [sel, setSel] = useState<string>();
  const [menu, setMenu] = useState<{ x: number; y: number; t: Task }>();
  const [confirm, setConfirm] = useState<Task>();
  const [busy, setBusy] = useState(false);
  const [newTask, setNewTask] = useState(view === 'new');
  const [more, setMore] = useState<HTMLElement | null>(null);
  const all = [...b.tasks.values()].sort(newestFirst);
  const test = VIEWS.find(([k]) => k === v)![2];
  const needle = q.trim().toLowerCase();
  const shown = all.filter((t) => test(t) && (!needle || `${t.title} ${t.id} ${appOf(t).title}`.toLowerCase().includes(needle)));

  const doUndo = async (t: Task) => {
    setBusy(true);
    try {
      await undo(t.id);
      win?.toast(`Undid ${t.title}`);
    } catch (e) {
      win?.toast(`Could not undo: ${(e as Error).message}`);
    }
    setBusy(false);
    setConfirm(undefined);
  };
  const items = (t: Task): (MenuItem | 'sep')[] => [
    { label: 'Open', icon: 'document-open-recent', run: () => open(`task/${t.id}`) },
    { label: 'Copy task ID', icon: 'edit-copy', run: () => void navigator.clipboard?.writeText(t.id).then(() => win?.toast(`Copied ${t.id}`)) },
    'sep',
    { label: 'Undo task…', icon: 'edit-undo', destructive: true, disabled: t.state === 'undone' || t.state === 'running' || t.state === 'queued', run: () => setConfirm(t) },
  ];
  const keys = (e: KeyboardEvent) => {
    const i = shown.findIndex((t) => t.id === sel);
    const go = (n: number) => {
      e.preventDefault();
      const t = shown[Math.max(0, Math.min(shown.length - 1, n))];
      if (!t) return;
      setSel(t.id);
      (document.getElementById(`row-${t.id}`) as HTMLElement | null)?.focus();
    };
    if (e.key === 'ArrowDown') go(i + 1);
    else if (e.key === 'ArrowUp') go(i - 1);
    else if (e.key === 'Enter' && sel) open(`task/${sel}`);
    else if ((e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) && sel) {
      e.preventDefault();
      const r = document.getElementById(`row-${sel}`)!.getBoundingClientRect();
      setMenu({ x: r.left + 40, y: r.bottom - 8, t: b.tasks.get(sel)! });
    }
  };

  const running = ofState('running').length;
  const waiting = pending().length;
  return (
    <>
      <HeaderBar
        start={
          <Button kind="flat" icon="list-add" onClick={() => setNewTask(true)} aria-label="New task">
            <span class="gos-hide-phone">New task</span>
          </Button>
        }
        center={<ToggleGroup label="Show" value={v} onChange={(k) => win?.navigate(k === 'all' ? 'tasks' : `tasks/${k}`)} options={VIEWS.map(([k, label, f]) => [k, label, all.filter(f).length])} />}
        end={
          <>
            {searching ? (
              <span class="g-search gos-head-search">
                <Icon name="system-search" />
                <input
                  class="g-field"
                  type="search"
                  placeholder="Search tasks"
                  aria-label="Search tasks"
                  value={q}
                  autoFocus
                  onInput={(e) => setQ((e.target as HTMLInputElement).value)}
                  onKeyDown={(e) => e.key === 'Escape' && (e.stopPropagation(), setQ(''), setSearching(false))}
                />
              </span>
            ) : (
              <IconButton icon="system-search" label="Search tasks" onClick={() => setSearching(true)} />
            )}
            <IconButton icon="open-menu" label="Main menu" onClick={(e) => setMore(e.currentTarget as HTMLElement)} aria-expanded={!!more} />
          </>
        }
      />
      {more && (
        <Popover anchor={more} onClose={() => setMore(null)} align="end" label="Main menu">
          <Menu
            label="Main menu"
            onClose={() => setMore(null)}
            items={[
              { label: 'Activity', icon: 'view-list', run: () => open('activity') },
              { label: 'Time Machine', icon: 'document-open-recent', run: () => open('time-machine') },
              'sep',
              { label: 'Permissions…', icon: 'security-high', run: () => open('settings/permissions') },
            ]}
          />
        </Popover>
      )}
      <div class="g-window-content gos-tasks">
        <div class="g-table" role="grid" aria-label="Tasks" aria-rowcount={shown.length} style={{ '--cols': COLS } as JSX.CSSProperties} onKeyDown={keys}>
          <div class="g-thead" role="row">
            <span role="columnheader">Task</span>
            <span role="columnheader">App</span>
            <span role="columnheader">Runs as</span>
            <span role="columnheader">State</span>
            <span role="columnheader">Now</span>
            <span role="columnheader">Cost</span>
            <span role="columnheader">Started</span>
          </div>
          <div class="gos-tbody">
            {shown.map((t, i) => {
              const app = appOf(t);
              const n = now(t);
              const p = t.state === 'running' ? progressOf(t.step) : undefined;
              const [word, kind] = STATE[t.state];
              return (
                <div
                  id={`row-${t.id}`}
                  class="g-tr"
                  role="row"
                  aria-selected={t.id === sel}
                  tabIndex={t.id === sel || (!sel && i === 0) ? 0 : -1}
                  onClick={() => setSel(t.id)}
                  onDblClick={() => open(`task/${t.id}`)}
                  onContextMenu={(e) => (e.preventDefault(), setSel(t.id), setMenu({ x: e.clientX, y: e.clientY, t }))}
                  key={t.id}
                >
                  <span class="g-td gos-task-cell" role="gridcell">
                    <AppIcon id={app.id} title={app.title} size={28} />
                    <span class="gos-two">
                      <span class="t-body gos-ellipsis">{t.title}</span>
                      <span class="t-caption t-secondary">Task {t.id}</span>
                    </span>
                  </span>
                  <span class="g-td t-body" role="gridcell">
                    {app.title}
                  </span>
                  <span class="g-td t-mono t-secondary" role="gridcell">
                    {t.user}
                  </span>
                  <span class="g-td" role="gridcell">
                    <Badge kind={kind}>{word}</Badge>
                  </span>
                  <span class={`g-td t-caption${n.tone ? ` t-${n.tone}` : ' t-secondary'}`} role="gridcell" title={n.text}>
                    {p !== undefined || t.state === 'running' ? (
                      <span class="gos-now">
                        <span class="gos-ellipsis">{n.text}</span>
                        <Progress value={p} label={`${t.title} progress`} />
                      </span>
                    ) : (
                      n.text
                    )}
                  </span>
                  <span class="g-td t-body" role="gridcell">
                    {costOf(t)}
                  </span>
                  <span class="g-td t-body t-secondary" role="gridcell">
                    {hhmm(t.createdAt)}
                  </span>
                  {t.state === 'waiting' && approvalFor(t.id) && (
                    <span class="gos-row-ask" role="gridcell">
                      <AnswerButtons a={approvalFor(t.id)!} large />
                    </span>
                  )}
                </div>
              );
            })}
            {shown.length === 0 && (
              <StatusPage icon={needle ? 'system-search' : 'view-list'} title={needle ? 'No tasks match' : all.length ? 'No tasks in this view' : 'No tasks yet'}>
                {needle ? `Nothing matches "${q}".` : all.length ? 'Pick All to see every task.' : 'A task starts from New task, from an app, or from the API.'}
              </StatusPage>
            )}
          </div>
        </div>
        <div class="g-summary">
          <div>
            <span class="g-summary-label">Running</span>
            <span class="g-summary-value">{running}</span>
            <span class="g-summary-sub">{running === 1 ? 'task working now' : 'tasks working now'}</span>
          </div>
          <div>
            <span class="g-summary-label">Waiting for you</span>
            <span class={`g-summary-value${waiting ? ' t-attention' : ''}`}>{waiting}</span>
            <span class="g-summary-sub">approvals in the top bar</span>
          </div>
          <div>
            <span class="g-summary-label">Spent today</span>
            <span class="g-summary-value">{dollars(b.today.cents)}</span>
            <span class="g-summary-sub">{b.settings?.defaultBudgetCents ? `default budget ${dollars(b.settings.defaultBudgetCents)} a task` : 'models and tools, test money'}</span>
          </div>
          <div>
            <span class="g-summary-label">Blocked today</span>
            <span class={`g-summary-value${b.today.blocked ? ' t-destructive' : ''}`}>{b.today.blocked}</span>
            <span class="g-summary-sub">attempts to reach hosts or keys</span>
          </div>
        </div>
      </div>
      {menu && <ContextMenu at={menu} items={items(menu.t)} onClose={() => setMenu(undefined)} label={`${menu.t.title} actions`} />}
      {confirm && (
        <Alert
          title={`Undo "${confirm.title}"?`}
          body={undoCopy(confirm).body}
          action={undoCopy(confirm).action}
          destructive
          busy={busy}
          onConfirm={() => void doUndo(confirm)}
          onCancel={() => setConfirm(undefined)}
        />
      )}
      {newTask && <NewTaskSheet onClose={() => (setNewTask(false), view === 'new' && win?.navigate('tasks'))} />}
    </>
  );
}

/** Start a task by hand: a title, what to do, which hosts it may reach and a budget. */
function NewTaskSheet({ onClose }: { onClose: () => void }) {
  const b = useBox();
  const win = useWin();
  const [title, setTitle] = useState('');
  const [prompt, setPrompt] = useState('');
  const [hosts, setHosts] = useState((b.settings?.networkDefault === 'allowlist' ? b.settings.defaultHosts : []).join(', '));
  const [budget, setBudget] = useState(b.settings?.defaultBudgetCents ? (b.settings.defaultBudgetCents / 100).toFixed(2) : '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true);
    setError('');
    try {
      const t = await api<Task>('POST', '/tasks', {
        title: title.trim(),
        prompt: prompt.trim(),
        // Who started it, for the log, the task window and Jira: the paired device's name, else "box screen" or "portal".
        source: pairing()?.device.name ?? surface,
        hosts: hosts.split(/[\s,]+/).filter(Boolean),
        ...(budget.trim() ? { budgetCents: Math.round(parseFloat(budget) * 100) } : {}),
      });
      box.tasks.set(t.id, t);
      onClose();
      win?.toast(`Started ${t.title}`, 'Open', () => open(`task/${t.id}`));
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };
  const ok = title.trim() && prompt.trim() && (!budget.trim() || parseFloat(budget) >= 0);
  return (
    <InWindow>
      <Sheet title="New task" onCancel={onClose} onDone={() => void go()} done="Start" doneDisabled={!ok || busy}>
        <label class="gos-field">
          <span class="t-body-strong">Title</span>
          <input class="g-field" value={title} maxLength={120} placeholder="Tidy the budget sheet" onInput={(e) => setTitle((e.target as HTMLInputElement).value)} />
        </label>
        <label class="gos-field">
          <span class="t-body-strong">What to do</span>
          <textarea class="g-field gos-textarea" rows={5} value={prompt} placeholder="Add this month's internet bill and write a one-line summary." onInput={(e) => setPrompt((e.target as HTMLTextAreaElement).value)} />
        </label>
        <label class="gos-field">
          <span class="t-body-strong">Hosts it may reach</span>
          <input class="g-field" value={hosts} placeholder="None" onInput={(e) => setHosts((e.target as HTMLInputElement).value)} />
          <span class="t-caption t-secondary">Separate them with commas. Everything else is blocked and logged.</span>
        </label>
        <label class="gos-field">
          <span class="t-body-strong">Budget in dollars</span>
          <input class="g-field" inputMode="decimal" value={budget} placeholder="No budget" onInput={(e) => setBudget((e.target as HTMLInputElement).value)} />
          <span class="t-caption t-secondary">Spending above it stops and asks you first.</span>
        </label>
        {error && (
          <p class="gos-error" role="alert">
            Could not start it: {error}
          </p>
        )}
      </Sheet>
    </InWindow>
  );
}
