// The real worker: Factory's Droid with Claude, inside the task's copy of the workspace.
// The box already limits what the task can touch (its own user, its own files, its network), so Droid
// runs with high autonomy. Box tools and box_ask reach it through workers/mcp.ts.
// Every step that could do harm gets a second look from Claude Haiku first (workers/review.ts).
// The model key never enters the task: it holds placeholders, and the box's proxy adds the vault's Factory or Anthropic key.
import { createHash } from 'node:crypto';
import { AutonomyLevel, DroidMessageType, ToolConfirmationOutcome, createSession, resumeSession } from '@factory/droid-sdk/node';
import { call } from '../client.ts';
import { DEFAULT_MODEL, MODELS } from '../models.ts';
import { classify, parseVerdict, reviewPrompt } from './review.ts';
import type { Scope, Step, Verdict } from './review.ts';

const sock = process.env.BOX_SOCKET!;
const step_ = (text: string, data?: unknown) => call(sock, 'POST', '/step', { text, data });
const { task, steps } = await call(sock, 'GET', '/task');
const previous: string | undefined = steps.findLast((s: { data?: { session?: string } }) => s.data?.session)?.data.session;

const mcp = {
  name: 'box',
  command: process.execPath,
  args: ['--experimental-strip-types', '--disable-warning=ExperimentalWarning', new URL('./mcp.ts', import.meta.url).pathname],
  env: { BOX_SOCKET: sock },
};
// ---------- the second pair of eyes ----------
// Droid asks before each tool use (autonomy Off); this handler waves ordinary steps through, so the agent is as
// free as before. A risky step goes to a separate Haiku call that compares it with the goal. An off-goal answer
// becomes an approval, through the same /ask path every other approval uses, and the step waits for the owner.
const reviewOn = process.env.BOX_REVIEW !== 'off';
const reviewModel = process.env.BOX_MODEL?.startsWith('custom:') ? `custom:${MODELS.haiku}` : MODELS.haiku;
const tools: { name: string; spends?: boolean }[] = await call(sock, 'GET', '/tools');
const scope: Scope = { cwd: process.cwd(), hosts: task.hosts ?? [], spendTools: tools.filter((t) => t.spends).map((t) => t.name.replaceAll('.', '__')) };

/** One Haiku call with no tools: Droid's own session, every tool request refused. Its cost is logged as `review`. */
async function askHaiku(prompt: string): Promise<Verdict> {
  const s = await createSession({
    cwd: process.cwd(),
    modelId: reviewModel,
    autonomyLevel: AutonomyLevel.Off,
    permissionHandler: () => ToolConfirmationOutcome.Cancel,
  });
  let text = '';
  const work = (async () => {
    for await (const msg of s.stream(prompt)) {
      if (msg.type === DroidMessageType.Assistant) text += msg.text;
      else if (msg.type === DroidMessageType.Result && msg.tokenUsage) {
        const u = msg.tokenUsage;
        const tokens = { input: u.inputTokens, output: u.outputTokens, cacheWrite: u.cacheCreationTokens, cacheRead: u.cacheReadTokens };
        await call(sock, 'POST', '/usage', { model: reviewModel, what: 'review', tokens });
      }
    }
  })();
  try {
    await Promise.race([work, new Promise((_, no) => setTimeout(() => no(new Error('timed out after 60 s')), 60_000))]);
  } finally {
    await s.close();
  }
  return parseVerdict(text);
}

/** True when the step may run: Haiku found it on goal, or the owner approved it. Logs the verdict as a step. */
async function mayRun(step: Step): Promise<boolean> {
  const t0 = Date.now();
  let v: Verdict;
  try {
    v = await askHaiku(reviewPrompt(task.prompt, step, scope));
  } catch (e) {
    v = { verdict: 'off_goal', reason: `the check could not run (${(e as Error).message})` }; // a step nobody checked asks the owner
  }
  const shown = step.detail.replace(/\s+/g, ' ').slice(0, 160);
  await step_(`Second look (Haiku): ${v.verdict === 'ok' ? 'on goal' : 'off goal'}. ${step.kind}: ${shown}. ${v.reason}`, { review: { ...v, kind: step.kind, detail: step.detail.slice(0, 500), why: step.why, model: reviewModel, ms: Date.now() - t0 } });
  if (v.verdict === 'ok') return true;
  const key = `review.${createHash('sha256').update(step.kind + step.detail).digest('hex').slice(0, 12)}`;
  const question = `Claude's second look says this step may not serve the task. ${v.reason}\n${step.kind}: ${step.detail.replace(/\s+/g, ' ').slice(0, 400)}`;
  for (;;) {
    const r = await call(sock, 'POST', '/ask', { key, question });
    if (!r.pending) return !!r.approved;
  }
}

const handlers: Pick<NonNullable<Parameters<typeof createSession>[0]>, 'permissionHandler' | 'askUserHandler'> = {
  permissionHandler: async ({ toolUses }) => {
    for (const use of toolUses) {
      const step = reviewOn ? classify(use.details as Record<string, any>, scope) : undefined;
      if (step && !(await mayRun(step))) return ToolConfirmationOutcome.Cancel;
    }
    return ToolConfirmationOutcome.ProceedOnce;
  },
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
      modelId: process.env.BOX_MODEL ?? DEFAULT_MODEL,
      autonomyLevel: AutonomyLevel.Off, // see the second pair of eyes above: the handler, not Droid, decides
      mcpServers: [mcp],
      ...handlers,
    });
if (previous) await session.updateSettings({ autonomyLevel: AutonomyLevel.Off }); // a resumed session must ask first too
if (!previous) await step_(`Droid started (${session.settings.modelId})`, { session: session.id });

const prompt = previous
  ? `The box restarted while you were working on this. Check what is already done in the files, then finish:\n\n${task.prompt}`
  : task.prompt;
let text = '';
try {
  for await (const msg of session.stream(prompt)) {
    if (msg.type === DroidMessageType.ToolCall) {
      await step_(`${msg.name} ${JSON.stringify((msg as { input?: unknown }).input ?? '').slice(0, 200)}`, { tool: msg.name });
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
  if (text.trim()) await step_(text.trim().slice(-2000), { summary: true });
} finally {
  await session.close();
}
