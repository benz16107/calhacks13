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
  /**
   * Droid worker: the Claude model, 'haiku' (cheap checks, photo descriptions), 'sonnet' (most work, the default)
   * or 'opus' (hard tasks), or a full model id. The task records the id it ran on.
   */
  model?: string;
  /** Tool names the task may call through the broker. Default none. */
  tools?: string[];
  /** Host names the task's network may reach. Default: the owner's network setting (none on a new box). */
  hosts?: string[];
  /** Spending above this, in US cents, pauses the task for an OK. Default: the owner's setting (`defaultBudgetCents`, 100 on a new box). */
  budgetCents?: number;
  /** Who started it, for the log and the portal: 'jira:BOX-12', 'asi1', 'schedule', 'portal'. */
  source?: string;
  /** Personal: a real folder of the owner's to work on (a copy; Keep applies it). The API links it to a workspace. */
  folder?: string;
  /**
   * Personal: several real folders in one task (Files' multi-folder selection). The task sees them side by
   * side, each as a top-level folder named after the real one; Keep and Undo apply to each real folder.
   * `folder` is then the first of them, for readers that only know one.
   */
  folders?: string[];
  /** The agent seat doing the work, like 'Credit analyst'. Shown in the audit. */
  seat?: string;
  /** How Droid works on it. Leave out for high autonomy and no plan. Ignored by the fake worker. */
  droid?: DroidOptions;
}

/**
 * Droid's options for a task. The box enforces the autonomy level too, so it holds even if Droid ignored it:
 * `low` gets no network beyond the model and asks before any spending, `medium` keeps its hosts and a budget of at
 * most $1, `high` keeps what the task asked for. Droid itself also runs at that level and asks before commands above it.
 */
export interface DroidOptions {
  /** Plan first: Droid writes a plan in Factory's spec mode, and starts work only once the owner approves the plan. */
  plan?: boolean;
  autonomy?: 'low' | 'medium' | 'high';
}

/** A TaskSpec with its defaults filled in. */
export type FullSpec = Required<Omit<TaskSpec, 'folder' | 'folders' | 'seat' | 'droid' | 'model'>> & { folder?: string; folders?: string[]; seat?: string; droid?: DroidOptions; model?: string };

export interface Task extends FullSpec {
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
  /** Business: the id of the person who asked for this task. Set by the core, never by the caller. */
  requestedBy?: string;
  /** The app (track) that created the task through its box, whatever `source` it gave. Set by the core. */
  app?: string;
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
  /** Who answered: 'portal', 'phone', 'jira:ben'. On a Business box, the person's name. */
  by?: string;
  /** Business: the id of the person who answered. */
  person?: string;
  /** Business: the phone or screen the answer came from. */
  via?: string;
  /** Business: the id of the person who asked for the task. They may not answer it. */
  askedBy?: string;
  /** Business: where the policy sent this request, and why. */
  route?: ApprovalRoute;
  /** Business shadow mode: the seat this is a suggestion from. A yes runs its tool; a no is a disagreement. */
  shadow?: string;
}

/** Business: who a request goes to. Set when it is asked; the people who may answer are checked again when they do. */
export interface ApprovalRoute {
  /** The policy line that matched: 'Over $10,000 goes to the Controller.' */
  rule: string;
  /** Who it goes to, as the policy says it: 'the Controller', 'IT', 'any approver'. */
  to: string;
  /** The amount the rules and limits were checked against, in US cents. */
  amountCents: number;
  /** The people who could approve it when it was asked. */
  people: { id: string; name: string }[];
  /** One sentence for people: the rule, and who can approve or why nobody can. */
  why: string;
}

/** Business: who is behind a log event. Ids are people's ids from /api/people. */
export interface Who {
  /** The person who asked for the task. */
  asked?: string;
  /** What started the task when no person did: its source, like 'schedule' or 'jira:BOX-12'. */
  trigger?: string;
  /** The agent seat doing the work. */
  seat?: string;
  /** On an answer, the person who gave it. On the task's later events, the last person who approved one of its requests. */
  approver?: string;
  /** A person's own action that is not part of a task: the kill switch, a change to people or the policy. */
  by?: string;
}

// ---------- The action log ----------
// One JSON object per line in BOX_HOME/log.jsonl. Append-only and fsynced per line.
// Every task and approval is rebuilt from it at boot, which is how tasks resume after a hard kill.

interface Base {
  /** Line number, from 1. */
  seq: number;
  at: string;
  /** SHA-256 of the previous log line, so an edited, removed or reordered entry breaks the chain after it. */
  prev?: string;
  task?: string;
  /** Business: who asked, which seat, who approved. Written only while the Business edition is on. */
  who?: Who;
}
type Ev<T extends string, D> = Base & { type: T } & D;

export type LogEvent =
  | Ev<'task.created', { task: string; spec: FullSpec; user: string; requestedBy?: string; app?: string }>
  | Ev<'task.state', { task: string; state: TaskState; layers?: string[]; error?: string; summary?: string }>
  /** Progress the worker reports: plans, steps, diffs. `data` is what the worker needs to resume. */
  | Ev<'task.step', { task: string; text: string; data?: unknown }>
  /** Personal: the owner's decision on a real-folder task's changes, or a conflict that stopped it. */
  | Ev<'keep', { task: string; result: 'pending' | 'kept' | 'conflict' | 'reverted'; changes?: { path: string; change: string }[]; conflicts?: string[] }>
  | Ev<'tool.call', { task: string; key: string; tool: string; input: unknown }>
  /** `cents` is what the call spent; it counts toward the task's cost. */
  | Ev<'tool.result', { task: string; key: string; ok: boolean; output?: unknown; error?: string; cents?: number }>
  | Ev<'approval.asked', { task: string; approval: Approval }>
  | Ev<'approval.answered', { task: string; id: string; approved: boolean; by: string; person?: string; via?: string }>
  | Ev<'cost', { cents: number; what: string; model?: string; tokens?: Tokens }>
  | Ev<'net.blocked', { task: string; host: string }>
  /** Anything a track wants in the log. */
  | Ev<'note', { track: string; data: unknown; /** A sentence for people (Activity, Audit); the core fills it for its own notes. */ text?: string }>;

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
  /** GurtOS Business: the approval rules as text, one rule per line (core/README.md, "Business edition"). */
  policy(): string;
  /**
   * GurtOS Business: replace the rules with `text`, once a person has said yes. `approvalId` must be an approved
   * request of one of this track's own tasks, answered by an owner or an admin, whose question carries
   * `[policy <hash>]`, the first 12 hex characters of the text's SHA-256. Throws otherwise and changes nothing.
   */
  setPolicy(text: string, approvalId: string): void;
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
  /**
   * Ask the owner for an OK on behalf of this task, through the one approval path (top bar, phone, desktop). Resolves
   * true when approved, false when denied or when there is no task. The same call after a restart returns the same answer.
   */
  ask(question: string, opts?: { purpose?: string }): Promise<boolean>;
}

// ---------- Slots ----------
// A track is a folder tracks/<name>/ with a track.ts whose default export is a Track.

export interface Track {
  /** Same as the folder name. */
  name: string;
  /** Shown in the App Center. Defaults to the first app's title, then the name. */
  title?: string;
  /** One or two plain sentences for the App Center. Defaults to the first paragraph of the track's README. */
  description?: string;
  /** Vault keys this track's routes and triggers may read with box.secret(). Tools and jobs declare their own. */
  secrets?: string[];
  /**
   * Called for every new task before it starts, never for a guest's task (a stranger's: its result goes back to the
   * stranger). Return plain text to hand the task's agent (what GurtOS remembers that is relevant to it), or nothing.
   * For a Droid task the text is added to the end of its prompt; the core logs a step with what was handed over. A throw
   * or more than 2 s is logged and the task starts without it. All apps together may hand over 8,000 characters.
   */
  taskContext?(spec: TaskSpec, box: Box): string | undefined | Promise<string | undefined>;
  /**
   * Keys among this app's declared secrets (track, tool or job) that it can run without, like a payment key it
   * falls back to test mode without. The App Center marks them `optional: true`, and setup asks only for the others.
   */
  optionalSecrets?: string[];
  /**
   * @deprecated Not read by the core: a new box turns on only the model app (`anthropic`), so every other app is off
   * until the owner turns it on. Kept so a track that sets it still loads.
   */
  offByDefault?: boolean;
  triggers?: Trigger[];
  tools?: Tool[];
  logReaders?: LogReader[];
  modelJobs?: ModelJob[];
  apps?: App[];
  /** HTTP routes, keyed 'METHOD /path', served at /t/<track>/path on the box's API. */
  routes?: Record<string, Route>;
  /**
   * Route keys (as in `routes`) that anyone may call without a paired phone's token, for a request that is not
   * from the box's own screen (for example one arriving through a public reverse proxy). Use it for a route that
   * is public on purpose, or that checks its own credential (a shared secret). Every other route needs a paired
   * phone. The core cannot help an open route: it must never return anything private unless its own check passes.
   */
  openRoutes?: string[];
  /**
   * Route keys (as in `routes`) whose HTML page is served with the box's own origin instead of the sandbox every other
   * app page gets: only for a page that cannot work without one, such as a passkey (WebAuthn) ceremony. Such a page runs
   * with the box's origin, so review it like core code: it shows an agent's text only escaped, and loads nothing from
   * another site. The window token and every other rule still apply.
   */
  ownOrigin?: string[];
}

/**
 * Starts tasks: a webhook, a schedule, a chat agent. `start` runs when the app turns on (at boot, or when it is
 * enabled). Return a function that stops it and the app can be switched off without a restart; a trigger that
 * returns nothing keeps running until the box restarts, and the app reports `restartNeeded` when disabled.
 */
export interface Trigger {
  name: string;
  start(box: Box): void | (() => void) | Promise<void | (() => void)>;
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
  /**
   * Business shadow mode: this tool records a decision. Return it in plain words, finishing "the Credit analyst
   * would ...": 'approve APP-1041 for $8,000, Net 30'. While the task's seat is in shadow, a person decides first.
   */
  decides?(input: any): string;
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

/**
 * A track's HTTP route. `req.headers.get('x-box-caller')` says who is calling, set by the box (a copy the caller
 * sends is replaced): 'screen', 'owner', 'device:<id>', 'service' or 'none'.
 */
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
