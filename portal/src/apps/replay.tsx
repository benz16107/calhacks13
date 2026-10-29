// The flight recorder: scrub through a finished task like a video. Every point of its action log in order (steps, tool
// calls, blocks, requests with who answered, spending so far, Keep or Undo), and at each point the files in the
// task's own layer as they were, against the owner's files. Read-only; core decides what each person may see.
import { useEffect, useMemo, useState } from 'preact/hooks';
import { api, useBox, type LogEvent, type Task } from '../live.ts';
import { Button, Icon, IconButton, StatusPage } from '../kit/ui.tsx';
import { HeaderBar, phone } from '../wm.tsx';
import { clock, dollars, plural, taskTitle } from '../util.ts';
import { DiffView, describe, type Diff } from './log.tsx';
import { filesAt, nextInteresting, replayPoints, type Kind } from './replay-model.ts';
import './replay.css';

const KIND: Record<Kind, [string, string]> = {
  start: ['Started', 'media-playback-start'],
  step: ['Step', 'applications-science'],
  tool: ['Tool', 'utilities-terminal'],
  blocked: ['Blocked', 'process-stop'],
  ask: ['Request', 'dialog-question'],
  approved: ['Approved', 'object-select'],
  denied: ['Denied', 'process-stop'],
  spend: ['Spent', 'dialog-password'],
  running: ['Running', 'media-playback-start'],
  waiting: ['Needs you', 'appointment-soon'],
  done: ['Done', 'emblem-ok'],
  failed: ['Failed', 'dialog-error'],
  undone: ['Undone', 'edit-undo'],
  kept: ['Kept', 'folder'],
  keep: ['Keep', 'folder'],
  note: ['Note', 'help-about'],
};
const TONE: Partial<Record<Kind, string>> = { blocked: 'is-bad', denied: 'is-bad', failed: 'is-bad', ask: 'is-ask', waiting: 'is-ask', approved: 'is-ok', kept: 'is-ok', undone: 'is-undone' };

interface Recorded {
  seq: number;
  /** big: over 1 MB, so not kept. */
  changes: (Diff['changes'][number] & { big?: boolean })[];
}

export function ReplayApp({ id }: { id: string }) {
  useBox();
  const [detail, setDetail] = useState<{ task: Task; events: LogEvent[] }>();
  const [final, setFinal] = useState<Diff & { undone?: boolean }>();
  // The file state at each point, where this computer records it (GET /api/tasks/:id/replay); else the final files only.
  const [recorded, setRecorded] = useState<Recorded[] | null>();
  const [capped, setCapped] = useState(false); // core stops recording a task at 50 MB or 20,000 entries
  const [diffs, setDiffs] = useState<Record<number, Diff>>({});
  const [error, setError] = useState('');
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [said, setSaid] = useState('');
  useEffect(() => {
    api<{ task: Task; events: LogEvent[] }>('GET', `/tasks/${id}`).then(setDetail, (e) => setError((e as Error).message));
    api<Diff & { undone?: boolean }>('GET', `/tasks/${id}/diff`).then(setFinal, () => setFinal({ changes: [], diff: '' }));
    api<{ points: Recorded[]; capped?: boolean }>('GET', `/tasks/${id}/replay`).then((r) => (setRecorded(r.points), setCapped(!!r.capped)), () => setRecorded(null));
  }, [id]);
  const points = useMemo(() => (detail ? replayPoints(detail.events) : []), [detail]);
  const last = points.length - 1;
  const p = points[Math.min(i, last)];

  // Play: one point at a time, a little longer on the ones that matter.
  useEffect(() => {
    if (!playing) return;
    if (i >= last) return void setPlaying(false);
    const t = setTimeout(() => setI(i + 1), points[i + 1]?.interesting ? 1400 : 700);
    return () => clearTimeout(t);
  }, [playing, i, last]);
  // Keep the current row in view beside the card; on a phone the card above already shows this point.
  useEffect(() => void (!phone() && document.getElementById(`rp-${p?.seq}`)?.scrollIntoView({ block: 'nearest' })), [p?.seq]);

  // The files as they were at this point: the newest recorded state at or before it.
  const at = recorded && p ? filesAt(recorded.map((r) => r.seq), p.seq) : undefined;
  useEffect(() => {
    if (at === undefined || diffs[at]) return;
    api<Diff>('GET', `/tasks/${id}/diff?at=${at}`).then((d) => setDiffs((x) => ({ ...x, [at]: d })), () => {});
  }, [at]);

  const go = (n: number) => (setPlaying(false), setI(Math.max(0, Math.min(last, n))));
  const sentence = (j: number) => (points[j] && detail ? describe(points[j].event, detail.events).text : '');
  // What a screen reader hears: each point when stepping, and only the ones that matter while playing.
  useEffect(() => {
    if (!p || (playing && !p.interesting)) return;
    setSaid(`${i + 1} of ${points.length}. ${KIND[p.kind][0]}. ${sentence(i)}. ${dollars(p.costCents)} spent so far.`);
  }, [i, p?.seq]);
  const keys = (e: KeyboardEvent) => {
    const t = e.target as HTMLElement;
    if (t.tagName === 'INPUT' && (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'Home' || e.key === 'End')) return; // the slider moves itself
    if (e.key === ' ' && t.tagName !== 'BUTTON') (e.preventDefault(), setPlaying(!playing && i < last));
    else if (e.key === 'ArrowRight') (e.preventDefault(), go(i + 1));
    else if (e.key === 'ArrowLeft') (e.preventDefault(), go(i - 1));
    else if (e.key === 'Home') (e.preventDefault(), go(0));
    else if (e.key === 'End') (e.preventDefault(), go(last));
    else if (e.key.toLowerCase() === 'n') (e.preventDefault(), go(nextInteresting(points, i, e.shiftKey ? -1 : 1)));
  };

  const title = detail?.task.title ?? taskTitle(id);
  const head = <HeaderBar title={`Replay: ${title}`} />;
  if (error)
    return (
      <>
        {head}
        <div class="g-window-content">
          <StatusPage icon="dialog-warning" title="Could not load this task">
            {error}
          </StatusPage>
        </div>
      </>
    );
  if (!detail || !p)
    return (
      <>
        {head}
        <div class="g-window-content">
          <StatusPage icon="document-open-recent" title="Reading the action log" />
        </div>
      </>
    );

  // Files: per point where recorded; else the final changes, said plainly.
  const keptOrUndone = points.slice(0, i + 1).findLast((x) => x.kind === 'kept' || x.kind === 'undone');
  // Files at each point where core recorded them. No points: a task from before recording, or an undone task whose
  // files were purged. A finished task still has its final changes; an undone one has nothing left to show.
  const files = recorded?.length
    ? at === undefined
      ? { note: 'No files changed yet.' }
      : {
          diff: diffs[at],
          note:
            keptOrUndone?.kind === 'undone'
              ? 'As they were before Undo removed them.'
              : capped && at === recorded.at(-1)?.seq && p.seq > at
                ? 'Recording stopped for this task (it reached 50 MB, or its files passed 20,000 entries), so this shows the last files it kept.'
                : `Files in the task's own layer at this point, against your files.`,
        }
    : final?.undone || (recorded && !final?.changes.length)
      ? { note: "This task's files are gone." }
      : recorded
        ? { diff: final, note: 'This task ran before GurtOS kept its files at each step, so this shows its final changes.' }
        : { diff: final, note: i < last ? "The task's final changes. This computer keeps a task's files at the end only." : "The task's final changes, against your files." };
  const marks = points.flatMap((x, j) => (x.interesting ? [{ j, kind: x.kind }] : []));

  return (
    <>
      {head}
      <div class={`g-window-content gos-rp${phone() ? ' is-phone' : ''}`} onKeyDown={keys}>
        <div class="gos-rp-transport" role="group" aria-label="Replay controls">
          <span class="gos-rp-buttons">
            <IconButton icon="go-previous" label="Step back (Left arrow)" onClick={() => go(i - 1)} disabled={i === 0} />
            <IconButton icon={playing ? 'media-playback-pause' : 'media-playback-start'} label={playing ? 'Pause (Space)' : 'Play (Space)'} onClick={() => (i >= last ? (setI(0), setPlaying(true)) : setPlaying(!playing))} />
            <IconButton icon="go-next" label="Step forward (Right arrow)" onClick={() => go(i + 1)} disabled={i === last} />
            <Button onClick={() => go(nextInteresting(points, i))} disabled={nextInteresting(points, i) === i} aria-keyshortcuts="N" title="Jump to the next request, block, error, Keep or Undo (N)">
              Next event
            </Button>
          </span>
          <span class="gos-rp-scrub">
            <input
              type="range"
              class="gos-rp-range"
              min={0}
              max={last}
              value={i}
              aria-label="Point in the task"
              aria-valuetext={`${i + 1} of ${points.length}: ${KIND[p.kind][0]}, ${sentence(i)}`}
              onInput={(e) => go(Number((e.target as HTMLInputElement).value))}
            />
            <span class="gos-rp-marks" aria-hidden="true">
              {marks.map((m) => (
                <i class={`gos-rp-mark ${TONE[m.kind] ?? ''}`} style={{ left: `${last ? (m.j / last) * 100 : 0}%` }} key={m.j} />
              ))}
            </span>
          </span>
          <span class="t-caption t-secondary gos-rp-pos">
            {i + 1} of {points.length} · {clock(p.at)} · {dollars(p.costCents)} spent so far
          </span>
        </div>
        <p class="g-sr" aria-live="polite">
          {said}
        </p>
        <div class="gos-rp-body">
          <section class="gos-rp-now" aria-label="This point">
            <p class={`gos-rp-kind ${TONE[p.kind] ?? ''}`}>
              <Icon name={KIND[p.kind][1]} /> {KIND[p.kind][0]}
            </p>
            <p class="t-title3">{sentence(i)}</p>
            <p class="t-caption t-secondary">
              {clock(p.at)} · {dollars(p.costCents)} spent so far{p.kind === 'start' && detail.task.hosts.length ? ` · may reach ${detail.task.hosts.join(', ')}` : ''}
            </p>
            <h3 class="t-heading gos-rp-files-head">Files</h3>
            <p class="t-caption t-secondary">{files.note}</p>
            {files.diff && files.diff.changes.length > 0 && (
              <>
                <p class="t-caption">
                  {plural(files.diff.changes.length, 'file')}: {files.diff.changes.map((c) => `${c.path} (${c.change}${(c as { big?: boolean }).big ? ', over 1 MB, not kept' : ''})`).join(', ')}
                </p>
                <DiffView text={files.diff.diff} />
              </>
            )}
          </section>
          <ol class="gos-rp-list" aria-label="Every point, oldest first">
            {points.map((x, j) => (
              <li key={x.seq}>
                <button type="button" id={`rp-${x.seq}`} class={`gos-rp-row ${TONE[x.kind] ?? ''}`} aria-current={j === i ? 'step' : undefined} onClick={() => go(j)}>
                  <span class="t-caption t-secondary gos-rp-time">{clock(x.at)}</span>
                  <Icon name={KIND[x.kind][1]} />
                  <span class="gos-rp-text">{describe(x.event, detail.events).text}</span>
                  {x.costCents > 0 && <span class="t-caption t-secondary">{dollars(x.costCents)}</span>}
                </button>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </>
  );
}
