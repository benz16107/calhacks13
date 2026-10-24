// What the first-run wizard and Settings write: the settings, the setup state, and which apps are off.
// Each is a small JSON file under BOX_HOME, written atomically. Settings are validated here, so a bad value
// never reaches the files or the core.
import fs from 'node:fs';
import path from 'node:path';

function readJson<T>(file: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
  } catch {
    return fallback;
  }
}

function writeJson(file: string, value: unknown) {
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
}

export const DEFAULT_SETTINGS: Settings = {
  approvalThresholdCents: 10_000,
  defaultBudgetCents: 0,
  networkDefault: 'none',
  defaultHosts: [],
  agentFolders: [],
  quietHours: { enabled: false, from: '22:00', to: '07:00' },
  logRetentionDays: 365,
  updateChannel: 'stable',
  autoUpdate: true,
  appearance: { theme: 'system', accent: '' },
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
const host = (s: string) => {
  if (!/^(\*\.)?[a-z0-9]([a-z0-9.-]{0,251}[a-z0-9])?(:\d{1,5})?$/i.test(s)) fail('defaultHosts', `"${s}" is not a host name (use example.com, *.example.com or example.com:8080)`);
  return s.toLowerCase();
};
const folder = (s: string) => {
  const clean = path.posix.normalize(s).replace(/\/+$/, '') || '/';
  if (!path.posix.isAbsolute(s) || s.split('/').includes('..') || clean === '/') fail('agentFolders', `"${s}" must be an absolute folder, not / or one with ..`);
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
