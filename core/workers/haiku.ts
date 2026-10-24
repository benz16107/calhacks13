// One Claude Haiku call with no tools, through Droid's SDK so it works with a Factory key or the owner's own
// Anthropic key. Every tool request is refused. Used for the second look (review.ts) and its evaluation.
import { AutonomyLevel, DroidMessageType, ToolConfirmationOutcome, createSession } from '@factory/droid-sdk/node';
import { parseVerdict } from './review.ts';
import type { Verdict } from './review.ts';

export type Usage = { input: number; output: number; cacheWrite: number; cacheRead: number };

export async function askHaiku(prompt: string, modelId: string, cwd: string, onUsage?: (tokens: Usage) => Promise<unknown>): Promise<Verdict> {
  const s = await createSession({ cwd, modelId, autonomyLevel: AutonomyLevel.Off, permissionHandler: () => ToolConfirmationOutcome.Cancel });
  let text = '';
  const work = (async () => {
    for await (const msg of s.stream(prompt)) {
      if (msg.type === DroidMessageType.Assistant) text += msg.text;
      else if (msg.type === DroidMessageType.Result && msg.tokenUsage && onUsage) {
        const u = msg.tokenUsage;
        await onUsage({ input: u.inputTokens, output: u.outputTokens, cacheWrite: u.cacheCreationTokens, cacheRead: u.cacheReadTokens });
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
