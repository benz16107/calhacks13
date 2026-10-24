// The incident drill (GurtOS Business, docs/drill.md): during a live run, pull the kill switch and measure how long it
// takes until every agent has stopped; undo a bad batch; resume; and write the numbers into the action log.
//   node --experimental-strip-types core/drill.ts <box socket> <title words of the bad batch> [quiet seconds]
// Run it as root on the box (it reads each task unit's freezer state). It acts as the box's own screen, which is the
// owner, so the log names "box screen" for the pause and the resume.
import { execFileSync } from 'node:child_process';
import { call } from './client.ts';
import type { LogEvent, Task } from './contract.ts';

const [sock, bad, quietArg] = process.argv.slice(2);
if (!sock || !bad) throw new Error('usage: core/drill.ts <box socket> <title words of the bad batch> [quiet seconds]');
const quietMs = Number(quietArg ?? 5) * 1000;
const api = <T = any>(m: string, p: string, b?: unknown) => call<T>(sock, m, p, b);
const ms = (a: number, b: number) => Math.round(b - a);
const frozen = (id: string) => {
  try {
    return execFileSync('systemctl', ['show', '-p', 'FreezerState', '--value', `box-task-${id}`], { encoding: 'utf8' }).trim();
  } catch {
    return 'gone';
  }
};

const live = (await api<Task[]>('GET', '/tasks')).filter((t) => t.state === 'running' || t.state === 'waiting');
if (!live.length) throw new Error('no agent is working: start a run first');

// 1. Pull the switch, and time it: the call returns once every unit is frozen; then confirm each one, and that the
//    log stays quiet (no step, tool call or question from any agent) for a few seconds.
const t0 = performance.now();
await api('POST', '/pause');
const tReturned = performance.now();
const pending = new Set(live.map((t) => t.id));
while (pending.size) for (const id of [...pending]) if (['frozen', 'gone'].includes(frozen(id))) pending.delete(id);
const tAllFrozen = performance.now();
const before = (await api<LogEvent[]>('GET', '/log')).at(-1)!.seq;
await new Promise((r) => setTimeout(r, quietMs));
const after = (await api<LogEvent[]>('GET', `/log?after=${before}`)).filter((e) => e.task && live.some((t) => t.id === e.task) && ['task.step', 'tool.call', 'approval.asked', 'cost'].includes(e.type));

// 2. Undo the bad batch: its tasks' changes go; every other task keeps its own.
const batch = (await api<Task[]>('GET', '/tasks')).filter((t) => t.title.toLowerCase().includes(bad.toLowerCase()) && t.state !== 'undone');
const tUndo = performance.now();
for (const t of batch) await api('POST', `/tasks/${t.id}/undo`);
const tUndone = performance.now();

// 3. Resume, and time until the first agent moves again.
const resumeAt = (await api<LogEvent[]>('GET', '/log')).at(-1)!.seq;
const t1 = performance.now();
await api('POST', '/resume');
let tMoved = 0;
for (let i = 0; i < 600 && !tMoved; i++) {
  const moved = (await api<LogEvent[]>('GET', `/log?after=${resumeAt}`)).some((e) => e.task && ['task.step', 'tool.call', 'tool.result', 'cost'].includes(e.type));
  if (moved) tMoved = performance.now();
  else await new Promise((r) => setTimeout(r, 100));
}

const result = {
  agents: live.length,
  stopMs: ms(t0, tReturned),
  allFrozenMs: ms(t0, tAllFrozen),
  quietSeconds: quietMs / 1000,
  eventsWhilePaused: after.length,
  undone: batch.map((t) => t.title),
  undoMs: ms(tUndo, tUndone),
  resumeToFirstStepMs: tMoved ? ms(t1, tMoved) : null,
};
// The numbers go into the action log, so the audit carries the drill too.
await api('POST', '/drill', result);
console.log(JSON.stringify(result, null, 2));
