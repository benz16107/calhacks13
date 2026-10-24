// The action log: append-only JSONL, fsynced per line, and the fold that rebuilds tasks from it.
import fs from 'node:fs';
import type { Approval, LogEvent, NewEvent, Task, TaskState } from './contract.ts';

export class Log {
  readonly events: LogEvent[] = [];
  private fd: number;

  constructor(path: string) {
    let text = fs.existsSync(path) ? fs.readFileSync(path, 'utf8') : '';
    // A hard kill can leave half a line at the end. Drop it so the next append starts clean.
    const end = text.lastIndexOf('\n') + 1;
    if (end < text.length) {
      fs.truncateSync(path, end);
      text = text.slice(0, end);
    }
    for (const line of text.split('\n')) if (line) this.events.push(JSON.parse(line));
    this.fd = fs.openSync(path, 'a', 0o600);
  }

  append(e: NewEvent): LogEvent {
    const full = { seq: this.events.length + 1, at: new Date().toISOString(), ...e } as LogEvent;
    fs.writeSync(this.fd, JSON.stringify(full) + '\n');
    fs.fsyncSync(this.fd);
    this.events.push(full);
    return full;
  }
}

/** Which state changes are allowed. Anything not undone can be undone. */
const next: Record<TaskState, TaskState[]> = {
  queued: ['running', 'failed', 'undone'],
  running: ['waiting', 'done', 'failed', 'undone'],
  waiting: ['running', 'done', 'failed', 'undone'],
  done: ['undone'],
  failed: ['undone'],
  undone: [],
};
export const canMove = (from: TaskState, to: TaskState) => next[from].includes(to);

export interface State {
  tasks: Map<string, Task>;
  approvals: Map<string, Approval>;
}

/** Apply one event. The core uses this both live and when replaying the log at boot. */
export function apply(s: State, e: LogEvent): void {
  const t = e.task ? s.tasks.get(e.task) : undefined;
  if (t) t.updatedAt = e.at;
  switch (e.type) {
    case 'task.created':
      s.tasks.set(e.task, {
        ...e.spec,
        id: e.task,
        state: 'queued',
        user: e.user,
        layers: [],
        costCents: 0,
        createdAt: e.at,
        updatedAt: e.at,
      });
      break;
    case 'task.state':
      if (!t) break;
      t.state = e.state;
      if (e.layers) t.layers = e.layers;
      if (e.error) t.error = e.error;
      if (e.summary) t.summary = e.summary;
      break;
    case 'cost':
      if (t) t.costCents += e.cents;
      break;
    case 'tool.result':
      if (t && e.cents) t.costCents += e.cents;
      break;
    case 'approval.asked':
      s.approvals.set(e.approval.id, { ...e.approval });
      break;
    case 'approval.answered': {
      const a = s.approvals.get(e.id);
      if (a) Object.assign(a, { state: e.approved ? 'approved' : 'denied', by: e.by });
      break;
    }
  }
}

export function fold(events: LogEvent[]): State {
  const s: State = { tasks: new Map(), approvals: new Map() };
  for (const e of events) apply(s, e);
  return s;
}

/** Finished tasks whose layers make up a workspace, newest first. */
export function doneLayers(events: LogEvent[], s: State, workspace: string): string[] {
  const order: string[] = [];
  for (const e of events) if (e.type === 'task.state' && e.state === 'done') order.push(e.task);
  return order.filter((id) => s.tasks.get(id)?.state === 'done' && s.tasks.get(id)?.workspace === workspace).reverse();
}
