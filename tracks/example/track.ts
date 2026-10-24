// The example track: one of each slot, small enough to copy. The demo uses `example.spend`.
import type { Track } from '../../core/contract.ts';
import { onFileChange, schedule, webhook } from '../../core/triggers.ts';

const inbox = `${process.env.BOX_HOME ?? '/var/lib/box'}/inbox/example`;

export default {
  name: 'example',

  // All three generic triggers, which any track reuses. A real track returns a Droid task here.
  triggers: [
    webhook({ name: 'start', task: (p: { title?: string }) => ({ title: p.title ?? 'From a webhook', workspace: 'home', worker: 'fake', prompt: 'write hook.txt yes', source: 'webhook' }) }),
    onFileChange({ name: 'inbox', dir: inbox, task: (file) => ({ title: `Saw ${file}`, workspace: 'home', worker: 'fake', prompt: `write seen-${file} yes`, source: 'file' }) }),
    schedule({ name: 'hourly', everyMs: 3600_000, task: () => ({ title: 'Hourly check', workspace: 'home', worker: 'fake', prompt: 'write tick.txt yes', source: 'schedule' }) }),
  ],

  tools: [
    {
      name: 'example.spend',
      description: 'Spend test money (no real payment). Input: { cents, on }.',
      input: { type: 'object', properties: { cents: { type: 'number' }, on: { type: 'string' } }, required: ['cents', 'on'] },
      secrets: ['DEMO_SECRET'],
      cost: (input: { cents: number }) => input.cents,
      approval: (input: { on: string }) => ({ payee: 'Test Vendor', purpose: `test spend on ${input.on}` }),
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
