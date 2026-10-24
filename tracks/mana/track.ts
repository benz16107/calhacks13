// The Mana track: what the public Mana apps reach on this box, through its public HTTPS address.
//   GET /t/mana/status  the read-only box status (task titles, states, cost, questions waiting for an OK)
//   /t/mana/guest       guest requests the owner approves first (guest.ts)
//   /t/mana/policy      GurtOS Business rules drafted in Mana, applied after an owner or admin says yes (policy.ts)
// Public on purpose, so none of them returns prompts, tool calls, log lines or secrets.
import type { Task, TaskState, Track } from '../../core/contract.ts';
import { expiry, guestReader, guestRoutes } from './guest.ts';
import { policyReader, policyRoutes } from './policy.ts';

const STATES: TaskState[] = ['queued', 'running', 'waiting', 'done', 'failed', 'undone'];
const brief = (t: Task) => ({ id: t.id, title: t.title, state: t.state, step: t.step?.slice(0, 160), costCents: t.costCents, source: t.source, updatedAt: t.updatedAt });
const newest = (ts: Task[]) => ts.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

export default {
  name: 'mana',
  // The public Mana apps call these through the box's public address; every other route still needs a paired phone.
  openRoutes: ['GET /status', 'OPTIONS /guest', 'POST /guest', 'GET /guest', 'OPTIONS /policy', 'POST /policy', 'GET /policy'],
  routes: {
    'GET /status': (_req, box) => {
      const tasks = box.tasks();
      const inState = (...s: TaskState[]) => tasks.filter((t) => s.includes(t.state));
      // A guest's words go to the owner's phone, not to a public page.
      const question = (a: { task: string; question: string }) => (box.task(a.task)?.source.startsWith('guest:') ? 'A guest request from a public app' : a.question);
      return Response.json(
        {
          at: new Date().toISOString(),
          counts: Object.fromEntries(STATES.map((s) => [s, inState(s).length])),
          costCents: tasks.reduce((n, t) => n + t.costCents, 0),
          active: newest(inState('queued', 'running', 'waiting')).slice(0, 20).map(brief),
          recent: newest(inState('done', 'failed', 'undone')).slice(0, 10).map(brief),
          approvals: box.approvals().filter((a) => a.state === 'pending').map((a) => ({ id: a.id, task: a.task, question: question(a), costCents: a.costCents })),
        },
        // The Mana app fetches this from the judge's browser on mana.space.
        { headers: { 'access-control-allow-origin': '*', 'cache-control': 'no-store' } },
      );
    },
    ...guestRoutes,
    ...policyRoutes,
  },
  logReaders: [guestReader, policyReader],
  triggers: [expiry],
} satisfies Track;
