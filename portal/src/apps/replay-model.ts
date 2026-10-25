// The flight recorder's timeline: a task's action log as points to scrub through, with what each one is, whether it
// matters (a request, an answer, a block, an error, Keep or Undo) and what the task had spent by then. No DOM, so
// portal/demo.ts runs the same code on a real task.
import type { LogEvent } from '../live.ts';

export type Kind = 'start' | 'step' | 'tool' | 'blocked' | 'ask' | 'approved' | 'denied' | 'spend' | 'running' | 'waiting' | 'done' | 'failed' | 'undone' | 'kept' | 'keep' | 'note';
export interface Point {
  seq: number;
  at: string;
  kind: Kind;
  /** Spent by the end of this point, in cents (the same sum as the day's spending: costs and paid tool calls). */
  costCents: number;
  /** A request, an answer, a block, an error, Keep or Undo: what "Next event" jumps to. */
  interesting: boolean;
  event: LogEvent;
}

const MATTERS: Kind[] = ['blocked', 'ask', 'approved', 'denied', 'failed', 'undone', 'kept'];

function kindOf(e: LogEvent): Kind {
  switch (e.type) {
    case 'task.created':
      return 'start';
    case 'task.step':
      return 'step';
    case 'tool.call':
      return 'tool';
    case 'tool.result':
      return e.ok ? (e.cents ? 'spend' : 'tool') : 'blocked';
    case 'net.blocked':
      return 'blocked';
    case 'approval.asked':
      return 'ask';
    case 'approval.answered':
      return e.approved ? 'approved' : 'denied';
    case 'cost':
      return 'spend';
    case 'task.state':
      return e.state === 'done' ? 'done' : e.state === 'failed' ? 'failed' : e.state === 'undone' ? 'undone' : e.state === 'waiting' ? 'waiting' : 'running';
    case 'keep':
      return e.result === 'kept' ? 'kept' : e.result === 'reverted' ? 'undone' : 'keep';
    default:
      return 'note';
  }
}

/** Every point of one task, oldest first. Steps with nothing to say (a scripted wait) are left out. */
export function replayPoints(events: LogEvent[]): Point[] {
  let cost = 0;
  const out: Point[] = [];
  for (const e of [...events].sort((a, b) => a.seq - b.seq)) {
    if (e.type === 'task.step' && !e.text) continue;
    if (e.type === 'cost') cost += e.cents;
    if (e.type === 'tool.result') cost += e.cents ?? 0;
    const kind = kindOf(e);
    out.push({ seq: e.seq, at: e.at, kind, costCents: cost, interesting: MATTERS.includes(kind), event: e });
  }
  return out;
}

/** The next (dir 1) or previous (dir -1) point that matters, or the same index when there is none. */
export function nextInteresting(points: Point[], from: number, dir: 1 | -1 = 1): number {
  for (let i = from + dir; i >= 0 && i < points.length; i += dir) if (points[i].interesting) return i;
  return from;
}

/** The last recorded file state at or before a point: which `at` to ask GET /api/tasks/:id/diff for. */
export function filesAt(recorded: number[], seq: number): number | undefined {
  let best: number | undefined;
  for (const s of recorded) if (s <= seq && (best === undefined || s > best)) best = s;
  return best;
}
