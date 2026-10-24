// The real worker: Factory's Droid with Claude, inside the task's copy of the workspace.
// The box already limits what the task can touch (its own user, its own files, its network), so Droid
// runs with high autonomy. Box tools and box_ask reach it through workers/mcp.ts.
// The model key never enters the task: it holds placeholders, and the box's proxy adds the vault's Factory or Anthropic key.
import { createHash } from 'node:crypto';
import { AutonomyLevel, DroidMessageType, ToolConfirmationOutcome, createSession, resumeSession } from '@factory/droid-sdk/node';
import { call } from '../client.ts';

const sock = process.env.BOX_SOCKET!;
const step = (text: string, data?: unknown) => call(sock, 'POST', '/step', { text, data });
const { task, steps } = await call(sock, 'GET', '/task');
const previous: string | undefined = steps.findLast((s: { data?: { session?: string } }) => s.data?.session)?.data.session;

const mcp = {
  name: 'box',
  command: process.execPath,
  args: ['--experimental-strip-types', '--disable-warning=ExperimentalWarning', new URL('./mcp.ts', import.meta.url).pathname],
  env: { BOX_SOCKET: sock },
};
type Handlers = Pick<NonNullable<Parameters<typeof createSession>[0]>, 'permissionHandler' | 'askUserHandler'>;
const handlers: Handlers = {
  permissionHandler: () => ToolConfirmationOutcome.ProceedOnce,
  // Droid's own questions become box approvals: a yes or no from the portal or phone.
  askUserHandler: async ({ questions }) => ({
    answers: await Promise.all(
      questions.map(async (q) => {
        const r = await call(sock, 'POST', '/ask', { key: `droid.ask.${q.index}.${createHash('sha256').update(q.question).digest('hex').slice(0, 12)}`, question: q.question });
        return { index: q.index, question: q.question, answer: r.approved ? (q.options[0] ?? 'yes') : 'no' };
      }),
    ),
  }),
};

const session = previous
  ? await resumeSession(previous, { mcpServers: [mcp], ...handlers })
  : await createSession({
      cwd: process.cwd(),
      modelId: process.env.BOX_MODEL ?? 'claude-sonnet-4-6',
      autonomyLevel: AutonomyLevel.High,
      mcpServers: [mcp],
      ...handlers,
    });
if (!previous) await step(`Droid started (${session.settings.modelId})`, { session: session.id });

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
      }
      if (!msg.success) throw new Error(msg.error?.message ?? `Droid stopped: ${msg.subtype}`);
    }
  }
  if (text.trim()) await step(text.trim().slice(-2000), { summary: true });
} finally {
  await session.close();
}
