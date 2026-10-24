// The Mana track: the read-only box status that the Mana app shows. GET /t/mana/status.
// Public on purpose, so it carries no prompts, tool calls, log lines or secrets: task titles, states, cost, and the
// questions waiting for an OK.
import type { Task, TaskState, Track } from '../../core/contract.ts';

const STATES: TaskState[] = ['queued', 'running', 'waiting', 'done', 'failed', 'undone'];
const brief = (t: Task) => ({ id: t.id, title: t.title, state: t.state, step: t.step?.slice(0, 160), costCents: t.costCents, source: t.source, updatedAt: t.updatedAt });
const newest = (ts: Task[]) => ts.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

export default {
  name: 'mana',
  routes: {
    'GET /status': (_req, box) => {
      const tasks = box.tasks();
      const inState = (...s: TaskState[]) => tasks.filter((t) => s.includes(t.state));
      return Response.json(
        {
          at: new Date().toISOString(),
          counts: Object.fromEntries(STATES.map((s) => [s, inState(s).length])),
          costCents: tasks.reduce((n, t) => n + t.costCents, 0),
          active: newest(inState('queued', 'running', 'waiting')).slice(0, 20).map(brief),
          recent: newest(inState('done', 'failed', 'undone')).slice(0, 10).map(brief),
          approvals: box.approvals().filter((a) => a.state === 'pending').map(({ id, task, question, costCents }) => ({ id, task, question, costCents })),
        },
        // The Mana app fetches this from the judge's browser on mana.space.
        { headers: { 'access-control-allow-origin': '*', 'cache-control': 'no-store' } },
      );
    },
  },
} satisfies Track;
