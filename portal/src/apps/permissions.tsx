// App permissions, like a phone's (core/permissions.ts): what each app may do. The owner is asked once, when an app
// is turned on, and can change any answer in Settings, Permissions. GurtOS enforces each one and logs every refusal.
import { useEffect, useState } from 'preact/hooks';
import { api, box, changed, useBox } from '../live.ts';
import { Group, LinkRow, Row, Sheet, SwitchRow, ToggleGroup } from '../kit/ui.tsx';
import { InWindow } from '../wm.tsx';
import { dollars, keyLabel, sentence } from '../util.ts';

export interface PermItem {
  id: string;
  kind: 'key' | 'money' | 'strangers' | 'shell' | 'host' | 'folders';
  /** The sentence to show, from core. */
  text: string;
  /** GurtOS saw the app do this. */
  seen?: boolean;
  allowed: boolean;
}
export interface AppPerms {
  app: string;
  title: string;
  answered: boolean;
  perDayCents: number | null;
  items: PermItem[];
}

/** The app's name as App Center shows it ("Agent wallet"); core's title falls back to the app's id. */
const appName = (a: AppPerms) => box.allApps.find((x) => x.id === a.app)?.title.replace(/\s*\(.*\)$/, '') ?? a.title;
/** A key item reads by its name for people ("Use your Apify token"), with the variable underneath, as words.md asks. */
const title = (i: PermItem) => (i.kind === 'key' ? `Use your ${keyLabel(i.id.slice(4))}` : i.text);
const sub = (i: PermItem) => [i.kind === 'key' ? `${i.id.slice(4)} · through GurtOS; the app never sees it` : '', i.seen ? 'GurtOS saw it do this' : ''].filter(Boolean).join(' · ') || undefined;
const WORD: Record<PermItem['kind'], string> = { key: 'keys', money: 'money', strangers: 'people outside', shell: 'a command line', host: 'sites', folders: 'your folders' };

// The one question on screen, from whichever window turned the app on.
const prompt = { app: undefined as AppPerms | undefined };

/** After an app is turned on: ask the owner what it may do, once. For anyone but the owner, GET answers 403: nothing shows. */
export async function askPermissions(id: string) {
  const all = await api<AppPerms[]>('GET', '/permissions').catch(() => []);
  const a = all.find((x) => x.app === id);
  if (a && !a.answered && a.items.length) (prompt.app = a), changed();
}

/** One app's permissions: Allow or Don't Allow for each, and a daily limit when it can spend money. */
function PermSheet({ a, ask, onClose, onSaved }: { a: AppPerms; ask: boolean; onClose: () => void; onSaved?: () => void }) {
  // A first question starts from Allow, the way a phone asks; Settings starts from what is saved.
  const [allow, setAllow] = useState<Record<string, boolean>>(() => Object.fromEntries(a.items.map((i) => [i.id, ask || i.allowed])));
  const [limit, setLimit] = useState(a.perDayCents == null ? '' : String(a.perDayCents / 100));
  const [error, setError] = useState('');
  const money = a.items.find((i) => i.kind === 'money');
  const cents = limit.trim() === '' ? null : Math.round(Number(limit.replace(/^\$/, '')) * 100);
  const bad = cents !== null && !(Number.isFinite(cents) && cents >= 0);
  const save = () =>
    api('PUT', `/permissions/${a.app}`, { deny: a.items.filter((i) => !allow[i.id]).map((i) => i.id), perDayCents: money && allow[money.id] ? cents : null }).then(
      () => (onSaved?.(), onClose()),
      (e) => setError(sentence((e as Error).message)),
    );
  return (
    <Sheet title={ask ? `${appName(a)} wants to:` : `What ${appName(a)} may do`} onCancel={onClose} onDone={() => void save()} done="Save" doneDisabled={bad}>
      <div class="g-list">
        {a.items.map((i) =>
          ask ? (
            <Row title={title(i)} sub={sub(i)} key={i.id}>
              <ToggleGroup
                label={title(i)}
                value={allow[i.id] ? 'allow' : 'deny'}
                options={[
                  ['allow', 'Allow'],
                  ['deny', "Don't Allow"],
                ]}
                onChange={(v) => setAllow({ ...allow, [i.id]: v === 'allow' })}
              />
            </Row>
          ) : (
            <SwitchRow title={title(i)} sub={sub(i)} checked={allow[i.id]} onChange={(v) => setAllow({ ...allow, [i.id]: v })} key={i.id} />
          ),
        )}
      </div>
      {money && allow[money.id] && (
        <label class="gos-field gos-perm-limit">
          <span class="t-body-strong">Up to, each day (optional)</span>
          <input class="g-field" inputMode="decimal" value={limit} placeholder="No daily limit" aria-invalid={bad} onInput={(e) => setLimit((e.target as HTMLInputElement).value)} />
          <span class={`t-caption ${bad ? 't-destructive' : 't-secondary'}`}>{bad ? 'Type an amount in dollars, like 5 or 12.50.' : 'Above it, a spend asks you first. Test money stays test money.'}</span>
        </label>
      )}
      <p class="t-caption t-secondary">You can change these any time in Settings, Permissions. GurtOS logs every refusal in Activity.</p>
      {error && (
        <p class="gos-error" role="alert">
          {error}
        </p>
      )}
    </Sheet>
  );
}

/** The question after an app is turned on, over everything (the desktop, a phone, or setup). */
export function PermissionPrompt() {
  useBox();
  const a = prompt.app;
  if (!a) return null;
  return (
    <div class="gos-perm-layer">
      <PermSheet a={a} ask onClose={() => ((prompt.app = undefined), changed())} />
    </div>
  );
}

/** Settings, Permissions: each app and what it may do. The owner only. */
export function AppPermissions() {
  const b = useBox();
  const [all, setAll] = useState<AppPerms[]>();
  const [open, setOpen] = useState<AppPerms>();
  const load = () => api<AppPerms[]>('GET', '/permissions').then(setAll, () => setAll([]));
  useEffect(() => void (b.owner && load()), [b.owner]);
  const apps = (all ?? []).filter((a) => a.items.length).sort((x, y) => appName(x).localeCompare(appName(y)));
  if (!b.owner || !apps.length) return null;
  return (
    <Group title="What each app may do" caption="Like a phone's permissions. A change takes effect at once, and GurtOS logs every refusal in Activity.">
      {apps.map((a) => {
        const off = a.items.filter((i) => !i.allowed).length;
        return (
          <LinkRow
            title={appName(a)}
            sub={[...new Set(a.items.map((i) => WORD[i.kind]))].join(', ') + (a.perDayCents != null ? ` · up to ${dollars(a.perDayCents)} a day` : '')}
            value={off ? `${off} off` : a.answered ? 'All allowed' : 'Not asked yet'}
            onClick={() => setOpen(a)}
            key={a.app}
          />
        );
      })}
      {open && (
        <InWindow>
          <PermSheet a={open} ask={false} onClose={() => setOpen(undefined)} onSaved={() => void load()} />
        </InWindow>
      )}
    </Group>
  );
}
