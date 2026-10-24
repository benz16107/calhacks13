// The Spacetime app: SpacetimeDB as the box's live nervous system. Agents share a work queue through it (the box
// claims for them, so two agents never take the same job), and with the owner's OK the box publishes a status
// summary to Maincloud for the multi-machine view. The module itself is core/spacetime; this track is its tools,
// its window and its fleet reporter. See README.md.
import type { Box, LogEvent, Track } from '../../core/contract.ts';
import { DB, local, withBox } from './local.ts';
import { fleet } from './fleet.ts';
import { bundle, page } from './page.ts';

const QUEUE = { type: 'string', description: "The queue's name, like 'credit-desk:applications'. Agents working together use the same name." };
const checkQueue = (q: unknown) => {
  if (typeof q !== 'string' || !/^[\w.:@/-]{1,80}$/.test(q)) throw new Error('queue: a name of letters, digits and . : @ / - _, at most 80 characters');
  return q;
};
type NewJob = { title: string; payload?: unknown };
const checkJobs = (jobs: unknown) => {
  if (!Array.isArray(jobs) || !jobs.length || jobs.length > 200) throw new Error('jobs: a list of 1 to 200 titles, or {title, payload?}');
  return (jobs as (NewJob | string)[]).map((j, i) => {
    if (typeof j === 'string') j = { title: j }; // a bare string is a job with just a title
    if (!j || typeof j.title !== 'string' || !j.title.trim() || j.title.length > 200) throw new Error(`jobs[${i}].title: text, 1 to 200 characters`);
    const payload = j.payload === undefined ? '' : typeof j.payload === 'string' ? j.payload : JSON.stringify(j.payload);
    if (payload.length > 8000) throw new Error(`jobs[${i}].payload: at most 8,000 characters`);
    return { title: j.title.trim(), payload };
  });
};

/** What a screen or an agent needs to know about one queue: who is on it, doing what, and how far it got. */
async function team(queue?: string) {
  const c = await local();
  const jobs = [...c.db.job.iter()].filter((j) => !queue || j.queue === queue);
  const count = (s: string) => jobs.filter((j) => j.state === s).length;
  return {
    queue: queue ?? null,
    open: count('open'),
    claimed: count('claimed'),
    done: count('done'),
    failed: count('failed'),
    agents: [...c.db.agent.iter()]
      .filter((a) => !queue || a.queue === queue)
      .map((a) => ({ task: a.task, name: a.name, status: a.status, job: a.job ? { id: String(a.job), title: a.jobTitle } : null, done: a.done })),
  };
}

const owner = (req: Request) => ['screen', 'owner'].includes(req.headers.get('x-box-caller') ?? '');
const forbid = () => Response.json({ error: "only the box's owner can change this" }, { status: 403 });

export default {
  name: 'spacetime',
  title: 'Live status',
  description: 'Shows tasks, requests and spending on every screen the moment they change, and lets agents share one work queue.',

  tools: [
    {
      name: 'spacetime.claim',
      description:
        "Take the next open job from a shared work queue. Other agents on this box take from the same queue, and SpacetimeDB makes sure no two agents ever get the same job. Input: { queue }. Returns { job: { id, title, payload } }, or { job: null } when the queue is empty. When you finish a job, call spacetime.finish.",
      input: { type: 'object', properties: { queue: QUEUE }, required: ['queue'] },
      async run(input: { queue: string }, ctx) {
        if (!ctx.task) throw new Error('only a task can claim a job');
        const queue = checkQueue(input?.queue);
        const j = await withBox((c) => c.procedures.claimJob({ queue, agent: ctx.task!.id, name: (ctx.task as { seat?: string }).seat || ctx.task!.title, key: ctx.key }));
        return j ? { job: { id: String(j.id), title: j.title, payload: j.payload } } : { job: null, message: `The queue ${queue} is empty: every job is taken or done.` };
      },
    },
    {
      name: 'spacetime.finish',
      description: 'Report a job you claimed as done (or failed), with a short result other agents and people can read. Input: { id, result, ok? } (ok defaults to true).',
      input: { type: 'object', properties: { id: { type: 'string' }, result: { type: 'string' }, ok: { type: 'boolean' } }, required: ['id', 'result'] },
      async run(input: { id: string; result: string; ok?: boolean }, ctx) {
        if (!ctx.task) throw new Error('only a task can finish a job');
        if (!/^\d+$/.test(String(input?.id))) throw new Error('id: the job id spacetime.claim returned');
        const result = String(input.result ?? '').slice(0, 2000);
        await withBox((c) => c.reducers.finishJob({ id: BigInt(input.id), agent: ctx.task!.id, ok: input.ok !== false, result }));
        return { ok: true };
      },
    },
    {
      name: 'spacetime.post',
      description: 'Put jobs on a shared work queue for other agents (or yourself) to claim, for example one job per file or per customer. Input: { queue, jobs: [{ title, payload? }] }, at most 200. Never put keys or secrets in a job: every screen on the box can read it.',
      input: {
        type: 'object',
        properties: { queue: QUEUE, jobs: { type: 'array', items: { type: 'object', properties: { title: { type: 'string' }, payload: {} }, required: ['title'] } } },
        required: ['queue', 'jobs'],
      },
      async run(input: { queue: string; jobs: NewJob[] }) {
        const queue = checkQueue(input?.queue);
        const jobs = checkJobs(input?.jobs);
        await withBox((c) => c.reducers.postJobs({ queue, jobs }));
        return { posted: jobs.length, queue };
      },
    },
    {
      name: 'spacetime.team',
      description: "See who is working on a shared queue and what each agent is doing now: { open, claimed, done, failed, agents: [{ name, status, job, done }] }. Input: { queue }.",
      input: { type: 'object', properties: { queue: QUEUE }, required: ['queue'] },
      async run(input: { queue: string }) {
        return team(checkQueue(input?.queue));
      },
    },
  ],

  // Another app puts jobs on a queue by writing a note to the action log: box.note({ jobs: { queue, items: [{ title, payload }] } }).
  // The log stays the record of what was posted; this reader turns it into live jobs, once each.
  logReaders: [
    {
      name: 'jobs',
      async read(e: LogEvent) {
        if (e.type !== 'note') return;
        const posted = (e.data as { jobs?: { queue?: unknown; items?: unknown } } | null)?.jobs;
        if (!posted) return;
        let queue: string, jobs: { title: string; payload: string }[];
        try {
          queue = checkQueue(posted.queue);
          jobs = checkJobs(posted.items);
        } catch (err) {
          console.error(`spacetime: ignored the jobs in note ${e.seq}: ${(err as Error).message}`);
          return;
        }
        await withBox((c) => c.reducers.postJobs({ queue, jobs }));
      },
    },
  ],

  triggers: [{ name: 'fleet', start: (box: Box) => fleet.start(box) }],

  routes: {
    'GET /': () => new Response(page(), { headers: { 'content-type': 'text/html; charset=utf-8' } }),
    'GET /live.js': () => new Response(bundle(), { headers: { 'content-type': 'text/javascript; charset=utf-8' } }),
    /** The queues and agents as JSON, for a screen that is not connected to SpacetimeDB. */
    'GET /team': async (req) => Response.json(await team(new URL(req.url).searchParams.get('queue') ?? undefined)),
    /** Everything the Live window shows, as JSON, for a screen that cannot reach SpacetimeDB (it listens on the box only). */
    'GET /snapshot': async (req) => {
      const c = await local();
      // On a Business box a person's phone is not sent the box's approvals (their own are in Waiting for me).
      const scoped = !!req.headers.get('x-box-person');
      const ts = (t: { microsSinceUnixEpoch: bigint }) => String(t.microsSinceUnixEpoch);
      const m = c.db.meter.id.find(0);
      return Response.json({
        jobs: [...c.db.job.iter()].map((j) => ({ ...j, id: String(j.id), postedAt: ts(j.postedAt), updatedAt: ts(j.updatedAt) })),
        agents: [...c.db.agent.iter()].map((a) => ({ ...a, job: String(a.job), at: ts(a.at) })),
        meter: m ? { ...m, spentCents: String(m.spentCents), at: ts(m.at) } : null,
        activity: [...c.db.activity.iter()],
        approvals: scoped ? [] : [...c.db.approval.iter()].filter((a) => a.state === 'pending'),
        scoped,
      });
    },
    /** Put jobs on a queue from the box's screen or a helper on the box. */
    'POST /jobs': async (req, box) => {
      if (!['screen', 'owner', 'service'].includes(req.headers.get('x-box-caller') ?? '')) return forbid();
      try {
        const body = await req.json();
        const queue = checkQueue(body?.queue);
        const jobs = checkJobs(body?.jobs);
        await withBox((c) => c.reducers.postJobs({ queue, jobs }));
        // The log stays the record: what was posted, so the audit and a rebuild of the queue can see it.
        box.note({ jobsPosted: { queue, titles: jobs.map((j) => j.title) } });
        return Response.json({ posted: jobs.length, queue });
      } catch (e) {
        return Response.json({ error: (e as Error).message }, { status: 400 });
      }
    },
    /** Where this box's SpacetimeDB is, for the Live window. */
    'GET /where': () => Response.json({ database: DB, fleet: fleet.where() }),
    /** The Maincloud fleet view: off unless the owner turns it on. */
    'GET /fleet': () => Response.json(fleet.status()),
    'PUT /fleet': async (req) => {
      if (!owner(req)) return forbid();
      const body = await req.json().catch(() => ({}));
      if (typeof body?.on !== 'boolean') return Response.json({ error: 'send {"on": true} or {"on": false}' }, { status: 400 });
      return Response.json(await fleet.set(body.on));
    },
    /** Let one Maincloud identity (the owner's GurtOS app, a Business admin's laptop) see this box in its fleet view. */
    'POST /fleet/viewers': async (req) => {
      if (!owner(req)) return forbid();
      const body = await req.json().catch(() => ({}));
      try {
        return Response.json(await fleet.grant(body?.identity, body?.label));
      } catch (e) {
        return Response.json({ error: (e as Error).message }, { status: 400 });
      }
    },
  },

  apps: [{ name: 'live', title: 'Live', href: '/' }],
} satisfies Track;
