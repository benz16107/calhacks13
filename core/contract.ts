// The contract between the core and everything else. Tracks import types from this file.
// The core never imports a track: it loads every tracks/<name>/track.ts at boot.
// Change this file only from the core thread.

import type { Tokens } from './pricing.ts';

// ---------- Tasks ----------

export type TaskState =
  | 'queued' // created, not started yet
  | 'running' // the worker is working
  | 'waiting' // paused until someone answers an approval
  | 'done' // finished; its file changes are part of the workspace
  | 'failed' // stopped with an error; its file changes are not applied
  | 'undone'; // removed; its file changes are gone, other tasks keep theirs

/** What a trigger or app asks for when it starts a task. */
export interface TaskSpec {
  title: string;
  /** What the worker should do. For the fake worker, one command per line (see core/workers/fake.ts). */
  prompt: string;
  /** Name of a folder in BOX_HOME/workspaces. The task works on its own copy of it. Default 'home'. */
  workspace?: string;
  /** Default 'droid'. 'fake' runs scripted steps with no model, for tests. */
  worker?: 'droid' | 'fake';
  /** Tool names the task may call through the broker. Default none. */
  tools?: string[];
  /** Host names the task's network may reach. Default none. */
  hosts?: string[];
  /** Spending above this, in US cents, pauses the task for an OK. Default 0. */
  budgetCents?: number;
  /** Who started it, for the log and the portal: 'jira:BOX-12', 'asi1', 'schedule', 'portal'. */
  source?: string;
}

export interface Task extends Required<TaskSpec> {
  id: string;
  state: TaskState;
  /** Linux user the task runs as: 'box-<id>'. */
  user: string;
  /** Finished tasks whose changes this task saw when it started, newest first. */
  layers: string[];
  costCents: number;
  /** The latest step, for a one-line "doing now". */
  step?: string;
  /**
   * Personal edition, for a task on a real folder: where its changes stand.
   * pending (done, waiting for the owner), kept (applied to the real folder), conflict (the owner edited the
   * same files; nothing applied), undone (discarded, or a Keep was undone from Time Machine).
   */
  review?: 'pending' | 'kept' | 'conflict' | 'undone';
  createdAt: string;
  updatedAt: string;
  error?: string;
  summary?: string;
}

export interface Approval {
  /** '<task id>.<key>'. The same key asked twice returns the same approval. */
  id: string;
  task: string;
  question: string;
  /** The spending being asked about, in US cents. 0 when it is not about money. */
  costCents: number;
  /** Who gets paid, or the host being reached. For the phone's "to" row. */
  payee?: string;
  /** What the spend or action is for. */
  purpose?: string;
  state: 'pending' | 'approved' | 'denied';
  /** Who answered: 'portal', 'phone', 'jira:ben'. */
  by?: string;
}

// ---------- The action log ----------
// One JSON object per line in BOX_HOME/log.jsonl. Append-only and fsynced per line.
// Every task and approval is rebuilt from it at boot, which is how tasks resume after a hard kill.

interface Base {
  /** Line number, from 1. */
  seq: number;
  at: string;
  task?: string;
}
type Ev<T extends string, D> = Base & { type: T } & D;

export type LogEvent =
  | Ev<'task.created', { task: string; spec: Required<TaskSpec>; user: string }>
  | Ev<'task.state', { task: string; state: TaskState; layers?: string[]; error?: string; summary?: string }>
  /** Progress the worker reports: plans, steps, diffs. `data` is what the worker needs to resume. */
  | Ev<'task.step', { task: string; text: string; data?: unknown }>
  /** Personal: the owner's decision on a real-folder task's changes, or a conflict that stopped it. */
  | Ev<'keep', { task: string; result: 'pending' | 'kept' | 'conflict' | 'reverted'; changes?: { path: string; change: string }[]; conflicts?: string[] }>
  | Ev<'tool.call', { task: string; key: string; tool: string; input: unknown }>
  /** `cents` is what the call spent; it counts toward the task's cost. */
  | Ev<'tool.result', { task: string; key: string; ok: boolean; output?: unknown; error?: string; cents?: number }>
  | Ev<'approval.asked', { task: string; approval: Approval }>
  | Ev<'approval.answered', { task: string; id: string; approved: boolean; by: string }>
  | Ev<'cost', { cents: number; what: string; model?: string; tokens?: Tokens }>
  | Ev<'net.blocked', { task: string; host: string }>
  /** Anything a track wants in the log. */
  | Ev<'note', { track: string; data: unknown }>;

/** A log event before the log gives it a seq and a time. */
export type NewEvent = LogEvent extends infer E ? (E extends unknown ? Omit<E, 'seq' | 'at'> : never) : never;

// ---------- What tracks get ----------

export interface Box {
  /** Start a task. Rejects an unknown workspace or tool. */
  createTask(spec: TaskSpec): Promise<Task>;
  /** Make a workspace, empty or as a copy of a folder (a git clone, a track's case files). Leaves an existing one alone. */
  workspace(name: string, fromDir?: string): void;
  /** Link a workspace to a real folder (Personal edition). A task works on an overlay copy; Keep writes back. */
  linkWorkspace(name: string, realPath: string): void;
  task(id: string): Task | undefined;
  tasks(): Task[];
  /** Stop the task if it is still going and remove its file changes. Other tasks keep theirs. */
  undo(id: string): Promise<Task>;
  approvals(): Approval[];
  answer(id: string, approved: boolean, by: string): Approval;
  /** Live events as they are written. To read the whole log reliably, use a LogReader. */
  on(listener: (e: LogEvent) => void): () => void;
  /** Run a model job by name. Its cost goes to `task` if given. */
  job(name: string, input: unknown, task?: string): Promise<unknown>;
  /** Write a 'note' event from this track into the log. */
  note(data: unknown, task?: string): void;
  /** Serve POST /hook/<track>/<name>: the handler gets the JSON body and headers and returns JSON. Used by the webhook trigger. */
  onWebhook(name: string, handler: (payload: any, headers: Record<string, string>) => unknown): void;
  /** Read a vault secret from a route or trigger. Only names in the track's `secrets`. Never return it to a task or a response. */
  secret(name: string): string;
}

/** Given to tools and model jobs. They run inside the core, never inside a task. */
export interface Ctx {
  box: Box;
  /** The task that called, if any. */
  task?: Task;
  /**
   * Unique per call and stable across a restart. A call cut off by a power cut runs again with the same key,
   * so pass it to your API as an idempotency key (Stripe and most payment APIs take one).
   */
  key: string;
  /** Read a vault secret. Only names listed in the tool's or job's `secrets`. Never return it. */
  secret(name: string): string;
  /** Record spending in US cents. */
  cost(cents: number, what: string): void;
  /** Add a step to the task's log. */
  log(text: string, data?: unknown): void;
}

// ---------- Slots ----------
// A track is a folder tracks/<name>/ with a track.ts whose default export is a Track.

export interface Track {
  /** Same as the folder name. */
  name: string;
  /** Vault keys this track's routes and triggers may read with box.secret(). Tools and jobs declare their own. */
  secrets?: string[];
  triggers?: Trigger[];
  tools?: Tool[];
  logReaders?: LogReader[];
  modelJobs?: ModelJob[];
  apps?: App[];
  /** HTTP routes, keyed 'METHOD /path', served at /t/<track>/path on the box's API. */
  routes?: Record<string, Route>;
}

/** Starts tasks: a webhook, a schedule, a chat agent. `start` runs once at boot. */
export interface Trigger {
  name: string;
  start(box: Box): void | Promise<void>;
}

/** Something a task uses through the broker. It runs in the core with vault access; the task sees only the result. */
export interface Tool {
  /** '<track>.<verb>', e.g. 'stripe.charge'. Tasks list it in spec.tools. */
  name: string;
  /** Shown to the model. */
  description: string;
  /** JSON Schema for the input, shown to the model. */
  input?: Record<string, unknown>;
  /** Vault keys `run` may read. */
  secrets?: string[];
  /** Hosts `run` talks to. For the README and the portal; tools run in the core, outside task network limits. */
  hosts?: string[];
  /** US cents this call will spend. Above the task's remaining budget, the broker asks for an OK first. */
  cost?(input: any): number;
  /** Structured fields for the budget approval the phone shows: who gets paid and what for. */
  approval?(input: any): { payee?: string; purpose?: string };
  run(input: any, ctx: Ctx): Promise<unknown>;
}

/** Reads every log event in order, from the start, and again after restarts from where it stopped. */
export interface LogReader {
  name: string;
  /** Throw to retry this event later. The core saves the position after each success. */
  read(e: LogEvent, box: Box): void | Promise<void>;
}

/** Model work the box does for itself, such as describing a photo for /find. */
export interface ModelJob {
  name: string;
  secrets?: string[];
  run(input: any, ctx: Ctx): Promise<unknown>;
}

/** A user-facing app the portal lists. Its pages and API are the track's routes. */
export interface App {
  name: string;
  title: string;
  /** Path under /t/<track>/ where the app's page lives. */
  href: string;
}

export type Route = (req: Request, box: Box) => Response | Promise<Response>;

// ---------- Demo steps ----------
// A track shows its part working in tracks/<name>/demo.ts: default-export `async (d: DemoKit) => { ... }`.
// ./demo runs it after the four moments, against a fresh box with every track loaded. Keep it under ~10 s.

export interface DemoKit {
  /** The box's API, as JSON. */
  api<T = any>(method: string, path: string, body?: unknown): Promise<T>;
  /** Print one passing check, or throw to fail the track's demo. */
  check(ok: unknown, what: string): void;
  /** Make a workspace with these files. */
  workspace(name: string, files: Record<string, string>): void;
  /** A file in the workspace as it is now: the base plus every done task. */
  view(workspace: string, file: string): string | undefined;
  /** Wait until the tasks are done. Throws if one fails. */
  settled(ids: string[]): Promise<Task[]>;
  waitFor<T>(what: string, fn: () => Promise<T | undefined>, ms?: number): Promise<T>;
  /** BOX_HOME for this run. */
  home: string;
  /** The box's HTTP API port (the portal is served over TCP, not the socket). */
  port: number;
  /** http://127.0.0.1:<port>, the box's API and portal base. */
  url: string;
}
