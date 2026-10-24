// Generic triggers a track reuses to start tasks: a schedule, a webhook, a file change. Each turns its
// event into a TaskSpec (return nothing to skip) and the box starts the task. Put one in a track's
// `triggers` array. The box calls `start(box)` once at boot, so a schedule or watch re-arms after a restart.
import fs from 'node:fs';
import type { Box, TaskSpec, Trigger } from './contract.ts';

/** Run on a fixed interval, or once a day at 'HH:MM' (the box's local time). */
export function schedule(opts: { name: string; everyMs?: number; dailyAt?: string; task: () => TaskSpec | undefined | Promise<TaskSpec | undefined> }): Trigger {
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
      if (opts.dailyAt) {
        const [h, m] = opts.dailyAt.split(':').map(Number);
        const arm = () => {
          const now = new Date();
          const next = new Date(now);
          next.setHours(h, m, 0, 0);
          if (next <= now) next.setDate(next.getDate() + 1);
          timer = setTimeout(() => {
            if (stopped) return;
            void fire();
            arm();
          }, next.getTime() - now.getTime());
          timer.unref();
        };
        arm();
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
