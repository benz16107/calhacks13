// Activity (Figma 84:5312): the action log as an event viewer. Filters in the sidebar, one row per event, newest
// first, blocked rows red and requests amber, and the selected event's fields below. Live over the log stream.
import { useEffect, useState } from 'preact/hooks';
import { useBox, type LogEvent, dayOf } from '../live.ts';
import { Badge, Icon } from '../kit/ui.tsx';
import { HeaderBar, open } from '../wm.tsx';
import { clock, pending, plural, taskTitle } from '../util.ts';
import { describe, fieldsOf, kindOf } from './log.tsx';

type Filter = 'all' | 'blocked' | 'approvals' | 'vault' | 'tasks';
const isBlocked = (e: LogEvent) => e.type === 'net.blocked' || (e.type === 'tool.result' && !e.ok);
const FILTERS: [Filter, string, string, (e: LogEvent) => boolean][] = [
  ['all', 'All events', 'utilities-terminal', () => true],
  ['blocked', 'Blocked', 'process-stop', isBlocked],
  ['approvals', 'Requests', 'object-select', (e) => e.type === 'approval.asked' || e.type === 'approval.answered'],
  ['vault', 'Keys', 'dialog-password', (e) => e.type === 'note' && e.track === 'vault'],
  ['tasks', 'Tasks', 'view-app-grid', (e) => e.type === 'task.created' || e.type === 'task.state' || e.type === 'keep'],
];
// shortcut: shows the newest 500 matching events; page through GET /api/log when someone needs older ones here.
const SHOWN = 500;

export function ActivityApp() {
  const b = useBox();
  const [filter, setFilter] = useState<Filter>('all');
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<number>();
  const [, label, , test] = FILTERS.find((f) => f[0] === filter)!;
  const needle = q.trim().toLowerCase();
  const shown = b.events
    .filter(test)
    .slice(-SHOWN * 2)
    .reverse()
    .filter((e) => !needle || `${e.seq} ${e.task ? taskTitle(e.task) : ''} ${kindOf(e)} ${describe(e, b.events).text}`.toLowerCase().includes(needle))
    .slice(0, SHOWN);
  const selected = shown.find((e) => e.seq === sel) ?? shown[0];
  const today = dayOf();
  const todayCount = b.events.filter((e) => dayOf(e.at) === today).length;

  useEffect(() => {
    if (selected) document.getElementById(`ev-${selected.seq}`)?.scrollIntoView({ block: 'nearest' });
  }, [selected?.seq]);
  const keys = (e: KeyboardEvent) => {
    const i = shown.indexOf(selected!);
    const go = (n: number) => (e.preventDefault(), setSel(shown[Math.max(0, Math.min(shown.length - 1, n))]?.seq));
    if (e.key === 'ArrowDown') go(i + 1);
    else if (e.key === 'ArrowUp') go(i - 1);
    else if (e.key === 'Home') go(0);
    else if (e.key === 'End') go(shown.length - 1);
    else if (e.key === 'PageDown') go(i + 10);
    else if (e.key === 'PageUp') go(i - 10);
    else if (e.key === 'Enter' && selected?.task) open(`task/${selected.task}`);
  };

  return (
    <div class="g-split gos-w-activity">
      <nav class="g-sidebar" aria-label="Filters">
        <HeaderBar title="Activity" controls={false} flat />
        <div class="g-sidebar-body">
          {FILTERS.map(([k, text, icon]) => (
            <button type="button" class="g-sidebar-item" aria-current={k === filter ? 'page' : undefined} onClick={() => (setFilter(k), setSel(undefined))} key={k}>
              <Icon name={icon} />
              <span>{text}</span>
              {k === 'approvals' && pending().length > 0 && <Badge>{pending().length}</Badge>}
            </button>
          ))}
        </div>
      </nav>
      <div class="g-split-main">
        <HeaderBar
          start={
            <span class={`gos-w-live${b.down ? ' is-down' : ''}`}>
              <Icon name={b.down ? 'network-offline' : 'media-playback-start'} />
              {b.down ? 'Out of reach, reconnecting' : `Live · ${plural(todayCount, 'event')} today`}
            </span>
          }
          title={label}
          end={
            <span class="g-search gos-w-filter">
              <Icon name="system-search" />
              <input class="g-field" type="search" placeholder="Filter" aria-label="Filter events" value={q} onInput={(e) => (setQ((e.target as HTMLInputElement).value), setSel(undefined))} />
            </span>
          }
        />
        <div class="gos-w-log">
          <div class="gos-w-cols" aria-hidden="true">
            <span>#</span>
            <span>Time</span>
            <span>Task</span>
            <span>Kind</span>
            <span>What happened</span>
          </div>
          <div class="gos-w-list" role="listbox" tabIndex={0} aria-label={`${label}, newest first`} aria-activedescendant={selected ? `ev-${selected.seq}` : undefined} onKeyDown={keys}>
            {shown.map((e) => {
              const d = describe(e, b.events);
              const kind = kindOf(e);
              const tone = d.tone === 'blocked' || isBlocked(e) ? 'is-blocked' : d.tone === 'ask' ? 'is-ask' : e.type === 'task.state' && e.state === 'undone' ? 'is-undone' : '';
              return (
                <div
                  id={`ev-${e.seq}`}
                  role="option"
                  aria-selected={e === selected}
                  class={`gos-w-ev${tone === 'is-blocked' ? ' is-blocked' : ''}`}
                  onClick={() => setSel(e.seq)}
                  onDblClick={() => e.task && open(`task/${e.task}`)}
                  key={e.seq}
                >
                  <span class="gos-w-mono">{e.seq}</span>
                  <span class="gos-w-mono">{clock(e.at)}</span>
                  <span>{e.task ? taskTitle(e.task) : ''}</span>
                  <span>
                    <span class={`gos-w-kind ${tone}`}>{kind}</span>
                  </span>
                  <span class="gos-w-what" title={d.text}>
                    {d.text}
                  </span>
                </div>
              );
            })}
            {!shown.length && <p class="gos-w-empty">{needle ? `No event matches "${q}".` : filter === 'all' ? 'The log is empty.' : `No ${label.toLowerCase()} events yet.`}</p>}
          </div>
          {selected && (
            <section class="gos-w-detail" aria-label="The selected event">
              <p class="t-heading">
                {kindOf(selected)}
                {selected.task && (
                  <>
                    {' '}
                    <button type="button" class="gos-link t-caption" onClick={() => open(`task/${selected.task}`)}>
                      Open the task
                    </button>
                  </>
                )}
              </p>
              <dl class="gos-w-fields">
                {fieldsOf(selected).main.map(([k, v]) => (
                  <div key={k}>
                    <dt>{k}</dt>
                    <dd>{v}</dd>
                  </div>
                ))}
              </dl>
              <details class="gos-w-tech">
                <summary class="t-caption">Technical details</summary>
                <dl class="gos-w-fields">
                  {fieldsOf(selected).raw.map(([k, v]) => (
                    <div key={k}>
                      <dt>{k}</dt>
                      <dd class="gos-w-mono">{v}</dd>
                    </div>
                  ))}
                </dl>
              </details>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
