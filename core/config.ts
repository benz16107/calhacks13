// What the first-run wizard and Settings write: the settings, the setup state, and which apps are off.
// Each is a small JSON file under BOX_HOME, written atomically. Settings are validated here, so a bad value
// never reaches the files or the core.
import fs from 'node:fs';
import path from 'node:path';

export function readJson<T>(file: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
  } catch {
    return fallback;
  }
}

export function writeJson(file: string, value: unknown) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, file);
}

// ---------- settings ----------

export interface Settings {
  /** A single spend above this always asks for an OK, even inside the task's budget. US cents. */
  approvalThresholdCents: number;
  /** The budget a task gets when it does not name one. US cents. 0 means every spend asks. */
  defaultBudgetCents: number;
  /** What network a task gets when it names no hosts: 'none', or the hosts in `defaultHosts`. */
  networkDefault: 'none' | 'allowlist';
  defaultHosts: string[];
  /** Personal: folders agents may work on. Empty means none has been chosen yet, so any folder is allowed. */
  agentFolders: string[];
  /** Quiet hours for notifications: the desktop and phone read these. HH:MM, the box's local time. */
  quietHours: { enabled: boolean; from: string; to: string };
  logRetentionDays: number;
  updateChannel: 'stable' | 'beta';
  autoUpdate: boolean;
  appearance: { theme: 'light' | 'dark' | 'system'; accent: string };
  /** Pause all agents: no task starts, and running ones hold before their next step or tool call. */
  paused: boolean;
  /** The most an Apple Watch may approve with its own token. US cents; 0: a Watch may only deny. */
  watchLimitCents: number;
}

export const DEFAULT_SETTINGS: Settings = {
  approvalThresholdCents: 500, // ask before any single spend over $5
  defaultBudgetCents: 100, // a task may spend $1 without asking
  watchLimitCents: 2500, // a Watch approves up to $25; anything more waits for the iPhone
  networkDefault: 'none',
  defaultHosts: [],
  agentFolders: [],
  quietHours: { enabled: false, from: '22:00', to: '07:00' },
  logRetentionDays: 365,
  updateChannel: 'stable',
  autoUpdate: true,
  appearance: { theme: 'system', accent: '' },
  paused: false,
};

const fail = (field: string, why: string): never => {
  throw new Error(`settings.${field}: ${why}`);
};
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const int = (field: string, v: unknown, min: number, max: number) => {
  if (typeof v !== 'number' || !Number.isInteger(v) || v < min || v > max) fail(field, `must be a whole number from ${min} to ${max}`);
  return v as number;
};
const oneOf = <T extends string>(field: string, v: unknown, options: readonly T[]) => {
  if (!options.includes(v as T)) fail(field, `must be one of ${options.join(', ')}`);
  return v as T;
};
const bool = (field: string, v: unknown) => {
  if (typeof v !== 'boolean') fail(field, 'must be true or false');
  return v as boolean;
};
const hhmm = (field: string, v: unknown) => {
  if (typeof v !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(v)) fail(field, 'must be a time like 22:30');
  return v as string;
};
const list = (field: string, v: unknown, max: number, each: (item: string) => string) => {
  if (!Array.isArray(v) || v.length > max) fail(field, `must be a list of at most ${max} entries`);
  return [...new Set((v as unknown[]).map((x) => (typeof x === 'string' ? each(x.trim()) : fail(field, 'entries must be text'))))];
};
/**
 * Why `s` is not a host a task may be allowed to reach, or undefined. A name, *.domain, or either with :port.
 * Not "*", "*.*", a range like 0.0.0.0/0, or an address on the box itself (loopback, link-local, 0.x).
 */
export function hostProblem(s: unknown): string | undefined {
  if (typeof s !== 'string') return 'hosts are text, like example.com';
  if (!/^(\*\.)?[a-z0-9]([a-z0-9.-]{0,251}[a-z0-9])?(:\d{1,5})?$/i.test(s)) return `"${s.slice(0, 80)}" is not a host name (use example.com, *.example.com or example.com:8080)`;
  const name = s.replace(/:\d+$/, '');
  if (/^(127\.|0\.|169\.254\.)/.test(name) || name === 'localhost') return `"${s}" is this computer itself; tasks never get it`;
  if (/^\*\.[^.]+$/.test(name)) return `"${s}" is a whole top-level domain; name the site`;
  return undefined;
}
const host = (s: string) => {
  const problem = hostProblem(s);
  if (problem) fail('defaultHosts', problem);
  return s.toLowerCase();
};
/**
 * Places an agent may never be given a copy of, whatever the owner or Settings say: the system, the box's own
 * state and keys, and other people's runtime data.
 */
const NEVER = ['/etc', '/root', '/proc', '/sys', '/dev', '/boot', '/run', '/usr', '/bin', '/sbin', '/lib', '/lib32', '/lib64', '/var/lib', '/var/log', '/opt', '/snap'];
const under = (p: string, root: string) => p === root || p.startsWith(root + '/');
/** Why this folder can never be used by an agent, or undefined if it is not one of the forbidden places. */
export function neverFolder(p: string): string | undefined {
  const home = process.env.BOX_HOME ?? '/var/lib/box';
  const hit = [...NEVER, home].find((r) => under(p, r));
  return hit ? `${p} is inside ${hit}, which holds the system or GurtOS's own keys and state` : undefined;
}

const folder = (s: string) => {
  const clean = path.posix.normalize(s).replace(/\/+$/, '') || '/';
  if (!path.posix.isAbsolute(s) || s.split('/').includes('..') || clean === '/') fail('agentFolders', `"${s}" must be an absolute folder, not / or one with ..`);
  const never = neverFolder(clean);
  if (never) fail('agentFolders', never);
  return clean;
};

/** Apply a partial update to the settings. Unknown keys and bad values throw; objects merge one level deep. */
export function applyPatch(current: Settings, patch: unknown): Settings {
  if (!isObj(patch)) throw new Error('send a JSON object of the settings to change');
  const next: Settings = structuredClone(current);
  for (const [key, v] of Object.entries(patch)) {
    switch (key) {
      case 'approvalThresholdCents':
        next.approvalThresholdCents = int(key, v, 0, 100_000_000);
        break;
      case 'defaultBudgetCents':
        next.defaultBudgetCents = int(key, v, 0, 100_000_000);
        break;
      case 'watchLimitCents':
        next.watchLimitCents = int(key, v, 0, 100_000);
        break;
      case 'networkDefault':
        next.networkDefault = oneOf(key, v, ['none', 'allowlist'] as const);
        break;
      case 'defaultHosts':
        next.defaultHosts = list(key, v, 100, host);
        break;
      case 'agentFolders':
        next.agentFolders = list(key, v, 50, folder);
        break;
      case 'quietHours': {
        if (!isObj(v)) fail(key, 'must be {enabled, from, to}');
        const q = v as Record<string, unknown>;
        for (const k of Object.keys(q)) if (!['enabled', 'from', 'to'].includes(k)) fail(`quietHours.${k}`, 'unknown setting');
        if ('enabled' in q) next.quietHours.enabled = bool('quietHours.enabled', q.enabled);
        if ('from' in q) next.quietHours.from = hhmm('quietHours.from', q.from);
        if ('to' in q) next.quietHours.to = hhmm('quietHours.to', q.to);
        break;
      }
      case 'logRetentionDays':
        next.logRetentionDays = int(key, v, 1, 3650);
        break;
      case 'updateChannel':
        next.updateChannel = oneOf(key, v, ['stable', 'beta'] as const);
        break;
      case 'autoUpdate':
        next.autoUpdate = bool(key, v);
        break;
      case 'paused':
        next.paused = bool(key, v);
        break;
      case 'appearance': {
        if (!isObj(v)) fail(key, 'must be {theme, accent}');
        const a = v as Record<string, unknown>;
        for (const k of Object.keys(a)) if (!['theme', 'accent'].includes(k)) fail(`appearance.${k}`, 'unknown setting');
        if ('theme' in a) next.appearance.theme = oneOf('appearance.theme', a.theme, ['light', 'dark', 'system'] as const);
        if ('accent' in a) {
          if (typeof a.accent !== 'string' || !/^(#[0-9a-fA-F]{6})?$/.test(a.accent)) fail('appearance.accent', 'must be a color like #5b8cff, or empty for the default');
          next.appearance.accent = a.accent as string;
        }
        break;
      }
      default:
        throw new Error(`settings.${key}: unknown setting (known: ${Object.keys(DEFAULT_SETTINGS).join(', ')})`);
    }
  }
  return next;
}

export const loadSettings = (home: string): Settings => applyPatch(structuredClone(DEFAULT_SETTINGS), readJson(path.join(home, 'settings.json'), {}));
export const saveSettings = (home: string, s: Settings) => writeJson(path.join(home, 'settings.json'), s);

/**
 * Why an agent may not be given a copy of this real folder, or undefined if it may. Only a Personal box (it has
 * an owner) hands out folders, and only the owner's home or the folders the owner chose in Settings: never the
 * system or the box's own keys, and never a folder that belongs to root.
 */
export function folderRefusal(real: string, ctx: { hasOwner: boolean; ownerHome?: string; chosen: string[]; folderUid: number; allowRootOwned?: boolean }): string | undefined {
  const never = neverFolder(real);
  if (never) return never;
  if (!ctx.hasOwner && !ctx.chosen.length) return 'Folders are for GurtOS Personal: this computer has no owner yet, and no folders were chosen in Settings, Permissions.';
  // The owner's list, once they have one, is the list: a folder in their home that isn't on it is refused too.
  const allowed = ctx.chosen.length ? insideAny(real, ctx.chosen) : !!ctx.ownerHome && insideAny(real, [ctx.ownerHome]);
  if (!allowed) {
    // Name the folder the way the owner sees it: "Pictures", not a path.
    const top = ctx.ownerHome && insideAny(real, [ctx.ownerHome]) ? real.slice(ctx.ownerHome.length + 1).split('/')[0] : real;
    return ctx.chosen.length || ctx.ownerHome ? `${top} is not on your list. Add it in GurtOS Settings, Permissions.` : `${real} is not one of the folders agents may use. Add it in GurtOS Settings, Permissions.`;
  }
  if (ctx.folderUid === 0 && !ctx.allowRootOwned) return `${real} belongs to root; agents are only given a person's folders`;
  return undefined;
}

/** Whether `dir` is one of the folders, or inside one. */
export const insideAny = (dir: string, folders: string[]) => folders.some((f) => dir === f || dir.startsWith(f + '/'));

// ---------- setup ----------

export interface SetupState {
  done: boolean;
  finishedAt?: string;
  /** Set on a box that already had tasks when this feature arrived: it never shows the wizard. */
  migrated?: boolean;
  steps: Record<string, { at: string; data?: unknown }>;
}

/** The steps the wizard walks through, in order. The box accepts any step id; this is the suggested list. */
export const SETUP_STEPS = ['welcome', 'network', 'safety', 'folders', 'apps', 'keys', 'updates', 'phone'] as const;

/**
 * A box was already in use if a person answered an approval, paired a phone, or started a task themselves.
 * Tasks the box starts on its own (a track's trigger at boot, like the photo index) do not count, so a fresh
 * install is not mistaken for an old box and the first-run wizard still shows.
 */
export function hadHumanUse(events: { type: string; source?: string; spec?: { source: string } }[], trackNames: string[], pairedDevices: number): boolean {
  const automatic = new Set([...trackNames, 'schedule', 'webhook', 'file']);
  return (
    pairedDevices > 0 ||
    events.some((e) => e.type === 'approval.answered') ||
    events.some((e) => e.type === 'task.created' && !automatic.has(e.spec?.source ?? ''))
  );
}

export const loadSetup = (home: string, hasHistory: boolean): SetupState => {
  const file = path.join(home, 'setup.json');
  if (fs.existsSync(file)) return readJson<SetupState>(file, { done: false, steps: {} });
  // A box that already ran tasks before the wizard existed is already set up.
  const fresh: SetupState = hasHistory ? { done: true, migrated: true, finishedAt: new Date().toISOString(), steps: {} } : { done: false, steps: {} };
  writeJson(file, fresh);
  return fresh;
};
export const saveSetup = (home: string, s: SetupState) => writeJson(path.join(home, 'setup.json'), s);

export function recordStep(s: SetupState, id: unknown, data: unknown): void {
  if (typeof id !== 'string' || !/^[a-z][\w-]{0,31}$/.test(id)) throw new Error('step: an id like "network" (letters, digits, - and _)');
  if (data !== undefined && JSON.stringify(data).length > 4096) throw new Error('data: at most 4 KB. Keys go to PUT /api/vault/<NAME>, never here');
  if (Object.keys(s.steps).length >= 40 && !(id in s.steps)) throw new Error('too many steps');
  s.steps[id] = { at: new Date().toISOString(), ...(data === undefined ? {} : { data }) };
}

// ---------- apps ----------

export const loadDisabled = (home: string): Set<string> => new Set(readJson<{ disabled?: string[] }>(path.join(home, 'apps.json'), {}).disabled ?? []);
export const saveDisabled = (home: string, disabled: Set<string>) => writeJson(path.join(home, 'apps.json'), { disabled: [...disabled].sort() });
