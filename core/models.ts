// The Claude models a task can run on. A task names one by alias (or a full id); the box fills in the rest.
// `haiku` is for cheap checks and photo descriptions, `sonnet` for most work, `opus` for hard tasks.
// All three ids were run through Droid with a Factory key on the x86 test VM on Oct 24 2026 (tracks/anthropic/README.md).
export const MODELS = { haiku: 'claude-haiku-5-5', sonnet: 'claude-sonnet-5-5', opus: 'claude-opus-5-5' } as const;
export const DEFAULT_MODEL = MODELS.sonnet;

/** A task's model id: its alias or id, else the box's BOX_MODEL, else the default. */
export function resolveModel(asked?: string): string {
  const pick = (asked as string | null | undefined) || process.env.BOX_MODEL?.replace(/^custom:/, '') || DEFAULT_MODEL;
  return MODELS[pick as keyof typeof MODELS] ?? pick;
}

/** Why a model name is refused, or undefined. Only an alias or a Claude model id: the box prices and records Claude. */
export function modelProblem(asked: unknown): string | undefined {
  if (asked === undefined || asked === null || asked === '') return;
  if (typeof asked !== 'string' || !(asked in MODELS || /^claude-[a-z0-9][a-z0-9.-]{1,50}$/.test(asked))) return 'model: haiku, sonnet, opus, or a Claude model id that starts with claude-';
}
