// Small shared helpers: money, time, task states, and which app a task belongs to.
import { useEffect, useState } from 'preact/hooks';
import { HOLD, box, surface, type Approval, type Task } from './live.ts';

export const dollars = (cents: number) => `$${(cents / 100).toFixed(2)}`;
/** Today's spending, once the log has been read (before that a total would be too low). */
export const spentToday = () => (box.logLoaded ? dollars(box.today.cents) : '…');
export const plural = (n: number, one: string, many = one + 's') => `${n} ${n === 1 ? one : many}`;
/** The box's own screen shows the box's time zone (its browser may run in UTC); a phone or laptop shows its own. */
export const zone = () => (surface === 'box screen' && box.system?.timezone ? { timeZone: box.system.timezone } : {});
export const hhmm = (t: string | number) => new Date(t).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', ...zone() });
export const clock = (t: string | number) => new Date(t).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', ...zone() });
export function ago(t: string | number) {
  const s = Math.max(0, (Date.now() - new Date(t).getTime()) / 1000);
  if (s < 45) return 'now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
export function useNow(ms: number) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

/** A task's state as a badge: amber Needs you, blue Running, green Done, grey Undone, red Failed or Blocked. */
export const STATE: Record<Task['state'], [string, 'attention' | 'accent' | 'success' | 'neutral' | 'destructive']> = {
  waiting: ['Needs you', 'attention'],
  running: ['Running', 'accent'],
  queued: ['Queued', 'neutral'],
  done: ['Done', 'success'],
  undone: ['Undone', 'neutral'],
  failed: ['Failed', 'destructive'],
};

export const pending = () => [...box.approvals.values()].filter((a) => a.state === 'pending');
/** Requests to show with their buttons: the waiting ones, and one just answered, held in place for a moment. */
export const asks = () => [...box.approvals.values()].filter((a) => a.state === 'pending' || Date.now() - (box.resolved.get(a.id)?.at ?? 0) < HOLD);
export const ofState = (...states: Task['state'][]) => [...box.tasks.values()].filter((t) => states.includes(t.state));
export const taskTitle = (id?: string) => (id && box.tasks.get(id)?.title) || id || 'A task';
export const approvalFor = (task: string): Approval | undefined => [...box.approvals.values()].find((a) => a.task === task && a.state === 'pending');
/** When an approval was asked, from the log; 0 if the log isn't loaded that far back. */
export function askedAt(id: string) {
  const e = box.events.findLast((e) => e.type === 'approval.asked' && e.approval.id === id);
  return e ? Date.parse(e.at) : 0;
}

/** A task that failed because the box has no model key (or a bad one): the fix is to add one in Settings. */
export const needsModelKey = (t: Pick<Task, 'state' | 'error'>) =>
  t.state === 'failed' && /api[_ ]?key|FACTORY_API_KEY|ANTHROPIC_API_KEY|unauthori[sz]ed|\b401\b|authenticat|no model key|credentials/i.test(t.error ?? '');

/** The track a task belongs to: its source up to the first colon ('shopper:buy:3' is Shopper's). */
export const trackOf = (t: Pick<Task, 'source'>) => t.source.split(':')[0];
/** The app a task belongs to, for its icon and the App column. Tasks started by people or the API are Tasks'. */
export function appOf(t: Pick<Task, 'source'>): { id: string; title: string } {
  const id = trackOf(t);
  const app = box.allApps.find((a) => a.id === id) ?? box.apps.find((a) => a.track === id);
  return app ? { id, title: app.title.replace(/\s*\(.*\)$/, '') } : { id: 'tasks', title: 'Tasks' };
}

/** This box and its peers. Before GET /api/boxes answers, just this box. */
export function boxList() {
  const name = box.system?.boxName ?? (['127.0.0.1', 'localhost'].includes(location.hostname) ? 'this box' : location.hostname);
  return box.boxes.length ? box.boxes : [{ id: location.host, name, self: true, url: undefined as string | undefined }];
}
export const selfBox = () => boxList().find((b) => b.self) ?? boxList()[0];
