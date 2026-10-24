// The example track: one of each slot, small enough to copy. The demo uses `example.spend`.
import type { Track } from '../../core/contract.ts';

export default {
  name: 'example',

  tools: [
    {
      name: 'example.spend',
      description: 'Spend test money (no real payment). Input: { cents, on }.',
      input: { type: 'object', properties: { cents: { type: 'number' }, on: { type: 'string' } }, required: ['cents', 'on'] },
      secrets: ['DEMO_SECRET'],
      cost: (input: { cents: number }) => input.cents,
      async run(input: { cents: number; on: string }, ctx) {
        ctx.secret('DEMO_SECRET'); // a real tool would call an API with it here; it never leaves the core
        return { paid: input.cents, on: input.on, test: true, receipt: ctx.key };
      },
    },
  ],

  // Served on the box's API: GET /t/example/ is the app's page, POST /t/example/start starts a task.
  routes: {
    'GET /': () => new Response('<h1>Example app</h1>', { headers: { 'content-type': 'text/html' } }),
    'POST /start': async (req, box) => {
      const { title = 'Example task', prompt = 'write hello.txt hi', workspace = 'example' } = await req.json();
      box.workspace(workspace); // makes it the first time, then leaves it alone
      const task = await box.createTask({ title, prompt, workspace, worker: 'fake' });
      return Response.json(task);
    },
  },

  logReaders: [
    {
      name: 'count',
      read(e) {
        if (e.type === 'task.state' && e.state === 'done') counts.done++;
      },
    },
  ],

  modelJobs: [{ name: 'example.echo', run: async (input) => ({ echo: input }) }],

  apps: [{ name: 'example', title: 'Example', href: '/' }],
} satisfies Track;

const counts = { done: 0 };
