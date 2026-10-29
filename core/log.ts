// The action log: append-only JSONL, fsynced per line, and the fold that rebuilds tasks from it.
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import type { Approval, LogEvent, NewEvent, Task, TaskState } from './contract.ts';

/** SHA-256 of one log line exactly as written (no newline). Each entry's `prev` is this hash of the line before it. */
export const hashLine = (line: string) => createHash('sha256').update(line).digest('hex');
const ZERO = '0'.repeat(64);

/**
 * The seqs whose `prev` does not match the line before them. Lines before the chain began (an older log) have no
 * `prev` and are skipped; once one line has it, every later line must, or removing `prev` would hide an edit.
 */
export function chainBreaks(lines: string[]): number[] {
  const bad: number[] = [];
  let chained = false;
  lines.forEach((line, i) => {
    const prev = JSON.parse(line).prev;
    if (prev === undefined && !chained) return;
    chained = true;
    if (prev !== (i ? hashLine(lines[i - 1]) : ZERO)) bad.push(i + 1);
  });
  return bad;
}

export class Log {
  readonly events: LogEvent[] = [];
  private fd: number;
  private last = ZERO; // hash of the last line written

  constructor(path: string) {
    // Work in bytes: a hard kill can leave half a line at the end, and truncate counts bytes, not
    // characters. A multi-byte character earlier in the log (an em dash Claude wrote) would make a
    // character count cut the file short and corrupt a good line. `\n` (0x0a) never occurs inside a
    // UTF-8 multi-byte sequence, so the last one is always a real line boundary.
    const buf = fs.existsSync(path) ? fs.readFileSync(path) : Buffer.alloc(0);
    const endByte = buf.lastIndexOf(0x0a) + 1; // bytes up to and including the last newline
    if (endByte < buf.length) fs.truncateSync(path, endByte); // drop the torn tail after it
    const text = buf.subarray(0, endByte).toString('utf8');
    for (const line of text.split('\n')) if (line) (this.events.push(JSON.parse(line)), (this.last = hashLine(line)));
    this.fd = fs.openSync(path, 'a', 0o600);
    this.size = endByte;
  }

  private size: number; // bytes of whole lines on disk

  append(e: NewEvent): LogEvent {
    // prev comes last so an event cannot bring its own: the chain is the log's, not the caller's.
    const full = { seq: this.events.length + 1, at: new Date().toISOString(), ...e, prev: this.last } as LogEvent;
    const line = JSON.stringify(full);
    const bytes = Buffer.from(line + '\n');
    try {
      // A full disk can take part of a line and refuse the rest; keep writing until all of it is down.
      for (let done = 0; done < bytes.length; ) done += fs.writeSync(this.fd, bytes, done);
      fs.fsyncSync(this.fd);
    } catch (err) {
      // Cut the half line off again, so the next event (once there is room) starts on a line of its own.
      try {
        fs.ftruncateSync(this.fd, this.size);
      } catch {} // the boot after this trims a torn tail too
      throw err;
    }
    this.size += bytes.length;
    this.last = hashLine(line);
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
        ...(e.requestedBy ? { requestedBy: e.requestedBy } : {}),
        createdAt: e.at,
        updatedAt: e.at,
      });
      break;
    case 'task.state':
      if (!t) break;
      t.state = e.state;
      if (e.state === 'undone' && t.review && t.review !== 'kept') t.review = 'undone'; // a Kept task's changes are in the real folder until a Keep is undone
      if (e.layers) t.layers = e.layers;
      if (e.error) t.error = e.error;
      if (e.summary) t.summary = e.summary;
      break;
    case 'task.step':
      if (t) {
        t.step = e.text.slice(0, 200);
        if ((e.data as { summary?: boolean } | undefined)?.summary) t.summary = e.text; // the worker's closing message
      }
      break;
    case 'keep':
      if (t) t.review = e.result === 'kept' ? 'kept' : e.result === 'reverted' ? 'undone' : e.result;
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
      if (a) Object.assign(a, { state: e.approved ? 'approved' : 'denied', by: e.by, ...(e.person ? { person: e.person } : {}), ...(e.via ? { via: e.via } : {}) });
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
