// The real worker: Factory's Droid with Claude, inside the task's copy of the workspace.
// The box already limits what the task can touch (its own user, its own files, its network). By default Droid
// runs with high autonomy; a task's `droid` options can ask for a plan first and a lower autonomy level.
// Box tools and box_ask reach it through workers/mcp.ts; Droid's hooks report to the box through workers/hook.ts.
// The model key never enters the task: it holds placeholders, and the box's proxy adds the vault's Factory or Anthropic key.
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { AutonomyLevel, DroidInteractionMode, DroidMessageType, ToolConfirmationOutcome, ToolConfirmationType, createSession, resumeSession } from '@factory/droid-sdk/node';
import { call } from '../client.ts';

const sock = process.env.BOX_SOCKET!;
const step = (text: string, data?: unknown) => call(sock, 'POST', '/step', { text, data });
const hash = (s: string) => createHash('sha256').update(s).digest('hex').slice(0, 12);
// An approval can wait longer than one request: /ask returns pending after a while, so ask again until it is answered.
async function ask(key: string, question: string): Promise<boolean> {
  for (;;) {
    const r = await call(sock, 'POST', '/ask', { key, question });
    if (!r.pending) return !!r.approved;
  }
}
const { task, steps } = await call(sock, 'GET', '/task');
const previous: string | undefined = steps.findLast((s: { data?: { session?: string } }) => s.data?.session)?.data.session;
const opts: { plan?: boolean; autonomy?: 'low' | 'medium' | 'high' } = task.droid ?? {};
const autonomy = { low: AutonomyLevel.Low, medium: AutonomyLevel.Medium, high: AutonomyLevel.High }[opts.autonomy ?? 'high'];

// Droid's hooks and team, in the task user's own ~/.factory: every tool call and its result go to the log, risky
// commands wait for the owner, and each app's custom droids (tracks/*/droids/*.md) are there to delegate to.
const factory = path.join(process.env.HOME!, '.factory');
fs.mkdirSync(path.join(factory, 'droids'), { recursive: true });
const hook = (event: string) => ({
  type: 'command',
  command: [process.execPath, '--experimental-strip-types', '--disable-warning=ExperimentalWarning', new URL('./hook.ts', import.meta.url).pathname, event].map((a) => `'${a}'`).join(' '),
  timeout: 86_400, // a risky command may wait a long time for its OK
});
fs.writeFileSync(path.join(factory, 'hooks.json'), JSON.stringify({ PreToolUse: [{ matcher: 'Execute', hooks: [hook('pre')] }], PostToolUse: [{ matcher: '*', hooks: [hook('post')] }] }));
const tracks = new URL('../../tracks/', import.meta.url).pathname;
for (const t of fs.existsSync(tracks) ? fs.readdirSync(tracks) : []) {
  const dir = path.join(tracks, t, 'droids');
  if (fs.existsSync(dir)) for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.md'))) fs.copyFileSync(path.join(dir, f), path.join(factory, 'droids', f));
}

const mcp = {
  name: 'box',
  command: process.execPath,
  args: ['--experimental-strip-types', '--disable-warning=ExperimentalWarning', new URL('./mcp.ts', import.meta.url).pathname],
  env: { BOX_SOCKET: sock },
};
let planDenied = false;
type Handlers = Pick<NonNullable<Parameters<typeof createSession>[0]>, 'permissionHandler' | 'askUserHandler'>;
const handlers: Handlers = {
  // What Droid asks permission for becomes a box approval. With high autonomy (the default) Droid asks for nothing
  // but a plan; with low or medium it asks before commands above its level.
  permissionHandler: async ({ toolUses, options }): Promise<any> => {
    const offered = (o: ToolConfirmationOutcome) => options.some((x: { value: string }) => x.value === o);
    for (const use of toolUses as { details: any }[]) {
      const d = use.details;
      if (d.type === ToolConfirmationType.ExitSpecMode) {
        // Plan first: the plan is a step in the log and the question of an approval on the portal and phone.
        await step(`Plan: ${d.title ?? task.title}`, { plan: d.plan });
        const ok = await ask(`droid.plan.${hash(d.plan)}`, `Approve Droid's plan for "${task.title}"?\n\n${String(d.plan).slice(0, 4000)}`);
        if (!ok) {
          planDenied = true;
          return ToolConfirmationOutcome.Cancel;
        }
        const run = `proceed_auto_run_${opts.autonomy ?? 'high'}` as ToolConfirmationOutcome;
        return offered(run) ? run : ToolConfirmationOutcome.ProceedOnce;
      }
      if (d.type === ToolConfirmationType.Execute) {
        const why = d.riskLevelReason ? ` (${d.riskLevelReason})` : '';
        if (!(await ask(`droid.exec.${hash(d.fullCommand ?? d.command)}`, `Droid wants to run: ${d.fullCommand ?? d.command}${why}`))) return ToolConfirmationOutcome.Cancel;
      }
    }
    return ToolConfirmationOutcome.ProceedOnce;
  },
  // Droid's own questions become box approvals: a yes or no from the portal or phone.
  askUserHandler: async ({ questions }) => ({
    answers: await Promise.all(
      questions.map(async (q) => {
        const yes = await ask(`droid.ask.${q.index}.${hash(q.question)}`, q.question);
        return { index: q.index, question: q.question, answer: yes ? (q.options[0] ?? 'yes') : 'no' };
      }),
    ),
  }),
};

const session = previous
  ? await resumeSession(previous, { mcpServers: [mcp], ...handlers })
  : await createSession({
      cwd: process.cwd(),
      modelId: process.env.BOX_MODEL ?? 'claude-sonnet-4-6',
      autonomyLevel: autonomy,
      ...(opts.plan ? { interactionMode: DroidInteractionMode.Spec } : {}),
      mcpServers: [mcp],
      ...handlers,
    });
if (!previous) await step(`Droid started (${session.settings.modelId}, ${opts.plan ? 'plan first, ' : ''}${opts.autonomy ?? 'high'} autonomy)`, { session: session.id });

const prompt = previous
  ? `The box restarted while you were working on this. Check what is already done in the files, then finish:\n\n${task.prompt}`
  : task.prompt;
let text = '';
try {
  for await (const msg of session.stream(prompt)) {
    if (msg.type === DroidMessageType.ToolCall) {
      await step(`${msg.name} ${JSON.stringify((msg as { input?: unknown }).input ?? '').slice(0, 200)}`, { tool: msg.name });
    } else if (msg.type === DroidMessageType.Assistant) {
      text += msg.text;
    } else if (msg.type === DroidMessageType.Result) {
      const u = msg.tokenUsage;
      // The core prices these at the model's list rates (core/pricing.ts). Factory bills in its own credits.
      if (u) {
        const tokens = { input: u.inputTokens, output: u.outputTokens, cacheWrite: u.cacheCreationTokens, cacheRead: u.cacheReadTokens };
        await call(sock, 'POST', '/usage', { model: session.settings.modelId, what: 'model', tokens });
        // Factory's own count for this turn, for the Factory app's usage view.
        const credits = u.factoryCredits;
        if (credits) await step(`Factory usage: ${credits.toLocaleString('en-US')} credits`, { factoryCredits: credits });
      }
      if (!msg.success) throw new Error(msg.error?.message ?? `Droid stopped: ${msg.subtype}`);
    }
  }
  if (planDenied) throw new Error('the owner turned down the plan, so nothing was changed');
  if (text.trim()) await step(text.trim().slice(-2000), { summary: true });
} finally {
  await session.close();
}
