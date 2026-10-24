// The real worker: Factory's Droid with Claude, inside the task's copy of the workspace.
// The box already limits what the task can touch (its own user, its own files, its network). A task's `droid`
// options can ask for a plan first and a lower autonomy level. Droid itself always runs at autonomy Off and asks the
// worker before every tool use: the worker answers ordinary steps at once, applies the task's autonomy level to
// commands, and gives every risky step a second look from Claude Haiku first (workers/review.ts).
// Box tools and box_ask reach it through workers/mcp.ts; Droid's hooks report to the box through workers/hook.ts.
// The model key never enters the task: it holds placeholders, and the box's proxy adds the vault's Factory or Anthropic key.
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { AutonomyLevel, DroidInteractionMode, DroidMessageType, ToolConfirmationOutcome, ToolConfirmationType, createSession, resumeSession } from '@factory/droid-sdk/node';
import { call } from '../client.ts';
import { DEFAULT_MODEL, MODELS } from '../models.ts';
import { askHaiku } from './haiku.ts';
import { classify, reviewPrompt } from './review.ts';
import type { Scope, Step, Verdict } from './review.ts';

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
// ---------- the second pair of eyes ----------
// Risky steps (review.ts) go to a separate Haiku call that compares them with the goal. An off-goal answer becomes an
// approval, through the same /ask path every other approval uses, and the step waits for the owner.
let declined = ''; // the step the owner refused, if any
const reviewOn = process.env.BOX_REVIEW !== 'off';
const reviewModel = process.env.BOX_MODEL?.startsWith('custom:') ? `custom:${MODELS.haiku}` : MODELS.haiku;
const tools: { name: string; spends?: boolean }[] = await call(sock, 'GET', '/tools');
const scope: Scope = { cwd: process.cwd(), hosts: task.hosts ?? [], spendTools: tools.filter((t) => t.spends).map((t) => t.name.replaceAll('.', '__')) };

/** True when the step may run: Haiku found it on goal, or the owner approved it. Logs the verdict as a step. */
async function mayRun(s: Step): Promise<boolean> {
  const t0 = Date.now();
  let v: Verdict;
  try {
    v = await askHaiku(reviewPrompt(task.prompt, s, scope), reviewModel, process.cwd(), (tokens) => call(sock, 'POST', '/usage', { model: reviewModel, what: 'review', tokens }));
  } catch (e) {
    v = { verdict: 'off_goal', reason: `the check could not run (${(e as Error).message})` }; // a step nobody checked asks the owner
  }
  const shown = s.detail.replace(/\s+/g, ' ').slice(0, 160);
  await step(`Second look (Haiku): ${v.verdict === 'ok' ? 'on goal' : 'off goal'}. ${s.kind}: ${shown}. ${v.reason}`, { review: { ...v, kind: s.kind, detail: s.detail.slice(0, 500), why: s.why, model: reviewModel, ms: Date.now() - t0 } });
  if (v.verdict === 'ok') return true;
  const ok = await ask(`review.${hash(s.kind + s.detail)}`, `Claude's second look says this step may not serve the task. ${v.reason}\n${s.kind}: ${s.detail.replace(/\s+/g, ' ').slice(0, 400)}`);
  if (!ok) declined = `${s.kind}: ${s.detail.replace(/\s+/g, ' ').slice(0, 120)}`;
  return ok;
}

let planDenied = false;
const RANK = { low: 1, medium: 2, high: 3 } as Record<string, number>;
type Handlers = Pick<NonNullable<Parameters<typeof createSession>[0]>, 'permissionHandler' | 'askUserHandler'>;
const handlers: Handlers = {
  // What Droid asks permission for becomes a box approval. Droid runs at autonomy Off, so it asks about every tool use.
  permissionHandler: async ({ toolUses }): Promise<any> => {
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
        continue; // proceed once, below: the run stays at autonomy Off so every step still gets its look
      }
      if (d.type === ToolConfirmationType.Execute && opts.autonomy && (RANK[d.impactLevel] ?? 3) > RANK[opts.autonomy]) {
        // A lower autonomy level asks the owner before commands above it.
        const why = d.riskLevelReason ? ` (${d.riskLevelReason})` : '';
        if (!(await ask(`droid.exec.${hash(d.fullCommand ?? d.command)}`, `Droid wants to run: ${d.fullCommand ?? d.command}${why}`))) return ToolConfirmationOutcome.Cancel;
      }
      const risky = reviewOn ? classify(d as Record<string, any>, scope) : undefined;
      if (risky && !(await mayRun(risky))) return ToolConfirmationOutcome.Cancel;
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
      modelId: process.env.BOX_MODEL ?? DEFAULT_MODEL,
      autonomyLevel: AutonomyLevel.Off, // the handler above decides, not Droid
      ...(opts.plan ? { interactionMode: DroidInteractionMode.Spec } : {}),
      mcpServers: [mcp],
      ...handlers,
    });
if (previous) await session.updateSettings({ autonomyLevel: AutonomyLevel.Off }); // a resumed session must ask first too
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
      if (!msg.success) throw new Error(declined ? `stopped: the owner did not approve this step (${declined})` : (msg.error?.message ?? `Droid stopped: ${msg.subtype}`));
    }
  }
  if (planDenied) throw new Error('the owner turned down the plan, so nothing was changed');
  if (text.trim()) await step(text.trim().slice(-2000), { summary: true });
} finally {
  await session.close();
}
