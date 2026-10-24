// The extension's decisions, with no GNOME imports, so Node can test them (personal/demo.ts).

/** A task the owner should review: a finished task on their folders, waiting for Keep or Undo, or after a conflict. */
export const needsReview = (t) => t.review === 'pending' || t.review === 'conflict';
/** Going now. A task waiting for an OK counts under "needs you" instead. */
export const isRunning = (t) => t.state === 'queued' || t.state === 'running';

/** The top bar's numbers. "Needs you" is requests only, the same count everywhere; tasks to review are listed apart. */
export function counts(tasks, pending) {
  return { running: tasks.filter(isRunning).length, needsYou: pending.length };
}

/** Which notifications to withdraw and which to post. Keys are `approval:<id>` and `review:<task id>`. */
export function plan(shownKeys, tasks, pending) {
  const shown = new Set(shownKeys);
  const want = new Set([...pending.map((a) => `approval:${a.id}`), ...tasks.filter(needsReview).map((t) => `review:${t.id}`)]);
  return { close: [...shown].filter((k) => !want.has(k)), post: [...want].filter((k) => !shown.has(k)).sort() };
}

/** Whether quiet hours cover `hhmm` ("23:30"). The window may run past midnight. */
export function quietAt(settings, hhmm) {
  const q = settings?.quietHours;
  if (!q?.enabled) return false;
  const [from, to] = [q.from ?? '22:00', q.to ?? '07:00'];
  return from <= to ? from <= hhmm && hhmm < to : hhmm >= from || hhmm < to;
}

export const dollars = (cents) => `$${((cents ?? 0) / 100).toFixed(2)}`;

/** A task failed only because the vault has no model key yet: the fix is GurtOS Setup. */
export const noModelKey = (error) => /vault has no/i.test(error ?? '') && /(factory_api_key|anthropic_api_key|model key)/i.test(error ?? '');

/** Why a task failed, in one sentence. `key` is true when the fix is a model key in Settings. */
export function failure(error) {
  const e = (error ?? '').replace(/^worker exited with \d+:\s*/i, '').replace(/^Error:\s*/i, '');
  if (/\b401\b|authentication_error|invalid x-api-key|invalid api key/i.test(e)) return { key: true, text: 'Your Anthropic key was not accepted. Check it in GurtOS Settings.' };
  if (noModelKey(error)) return { key: true, text: 'Add an Anthropic API key in GurtOS Settings first.' };
  const first = e.split(/\n/)[0].trim();
  return { key: false, text: first ? (/[.?!]$/.test(first) ? first : first + '.') : 'It stopped with an error.' };
}
