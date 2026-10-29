// Generic triggers a track reuses to start tasks: a schedule, a webhook, a file change. Each turns its
// event into a TaskSpec (return nothing to skip) and the box starts the task. Put one in a track's
// `triggers` array. The box calls `start(box)` once at boot, so a schedule or watch re-arms after a restart.
import fs from 'node:fs';
import type { Box, TaskSpec, Trigger } from './contract.ts';

/** The first `h:m` (local time) strictly after `after`. */
export function nextDaily(after: number, h: number, m: number): Date {
  const next = new Date(after);
  next.setHours(h, m, 0, 0);
  if (next.getTime() <= after) {
    next.setDate(next.getDate() + 1);
    next.setHours(h, m, 0, 0); // again: a day across a clock change is not 24 hours
  }
  return next;
}

const MAX_TIMER = 2 ** 31 - 1; // about 24.8 days: Node runs a longer timer after 1 ms instead

/**
 * Run on a fixed interval, or once a day at 'HH:MM' (the box's local time). A run missed while the box was off is
 * skipped, not made up: a daily one runs next at its usual time, an interval one counts from when the box started.
 */
export function schedule(opts: { name: string; everyMs?: number; dailyAt?: string; task: () => TaskSpec | undefined | Promise<TaskSpec | undefined> }): Trigger {
  // A bad value would make Node's timer fire after 1 ms, over and over: refuse it when the track loads instead.
  const daily = opts.dailyAt === undefined ? undefined : /^([01]\d|2[0-3]):([0-5]\d)$/.exec(opts.dailyAt);
  if (opts.dailyAt !== undefined && !daily) throw new Error(`schedule ${opts.name}: dailyAt must be a time like 02:00, not "${opts.dailyAt}"`);
  if (opts.everyMs !== undefined && !(Number.isFinite(opts.everyMs) && opts.everyMs >= 1 && opts.everyMs <= MAX_TIMER)) throw new Error(`schedule ${opts.name}: everyMs must be from 1 to ${MAX_TIMER} (about 24 days); use dailyAt for longer`);
  if (!daily && opts.everyMs === undefined) throw new Error(`schedule ${opts.name}: give everyMs or dailyAt`);
  return {
    name: opts.name,
    start(box) {
      const fire = async () => {
        try {
          const spec = await opts.task();
          if (spec) await box.createTask(spec);
        } catch (e) {
          console.error(`schedule ${opts.name} failed:`, e);
        }
      };
      let timer: NodeJS.Timeout | undefined;
      let stopped = false;
      const every = opts.everyMs ? setInterval(fire, opts.everyMs) : undefined;
      every?.unref();
      if (daily) {
        const [h, m] = [Number(daily[1]), Number(daily[2])];
        const arm = (after: number) => {
          const next = nextDaily(after, h, m);
          // A wait past Node's timer limit (not for a day, but a clock set far back) re-arms instead of firing.
          const wait = Math.min(next.getTime() - Date.now(), MAX_TIMER);
          timer = setTimeout(() => {
            if (stopped) return;
            if (Date.now() < next.getTime() - 60_000) return arm(Date.now()); // the clock moved back: wait for the time
            void fire();
            arm(Math.max(Date.now(), next.getTime())); // a timer that fires a moment early must not run this time again
          }, Math.max(wait, 0));
          timer.unref();
        };
        arm(Date.now());
      }
      return () => {
        stopped = true;
        if (every) clearInterval(every);
        clearTimeout(timer);
      };
    },
  };
}

/** Start a task when a POST arrives at /hook/<track>/<name> on the box's API. The JSON body is the payload. */
export function webhook(opts: { name: string; task: (payload: any, headers: Record<string, string>) => TaskSpec | undefined | Promise<TaskSpec | undefined> }): Trigger {
  return {
    name: opts.name,
    start(box) {
      box.onWebhook(opts.name, async (payload, headers) => {
        const spec = await opts.task(payload, headers);
        return spec ? await box.createTask(spec) : undefined;
      });
      return () => {}; // the box stops serving /hook/<track>/ itself when the app is disabled
    },
  };
}

/** Start a task when a file is added or changed under `dir`. Debounced, so a burst of writes fires once per file. */
export function onFileChange(opts: { name: string; dir: string; task: (file: string) => TaskSpec | undefined | Promise<TaskSpec | undefined> }): Trigger {
  return {
    name: opts.name,
    start(box) {
      fs.mkdirSync(opts.dir, { recursive: true });
      const pending = new Map<string, NodeJS.Timeout>();
      const watcher = fs.watch(opts.dir, { recursive: true }, (_event, name) => {
        if (!name) return;
        const file = String(name);
        clearTimeout(pending.get(file));
        pending.set(
          file,
          setTimeout(async () => {
            pending.delete(file);
            try {
              const full = `${opts.dir}/${file}`;
              if (!fs.existsSync(full) || !fs.statSync(full).isFile()) return;
              const spec = await opts.task(file);
              if (spec) await box.createTask(spec);
            } catch (e) {
              console.error(`file trigger ${opts.name} failed:`, e);
            }
          }, 200),
        );
      });
      watcher.unref(); // the box's API keeps the process alive; don't hold it open ourselves
      return () => {
        watcher.close();
        for (const t of pending.values()) clearTimeout(t);
        pending.clear();
      };
    },
  };
}
