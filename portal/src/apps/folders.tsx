// GurtOS Personal on the phone (docs/figma/phone-app, 2b): an agent's work on one of the owner's folders waits in a
// copy until the owner keeps it. Ready for you: what changed, Review, Undo and Keep. Kept recently: Put back.
import { useState } from 'preact/hooks';
import { api, box, undo, useBox, type Task } from '../live.ts';
import { Button, Icon } from '../kit/ui.tsx';
import { open } from '../wm.tsx';
import { ago, hhmm } from '../util.ts';

/** "~/Documents/Invoices" as "Documents › Invoices". */
const where = (t: Task) => (t.folders?.length ? t.folders : t.folder ? [t.folder] : []).map((f) => f.replace(/^\/home\/[^/]+\/?/, '').split('/').filter(Boolean).join(' › ') || 'Home').join(', ');
const byNewest = (a: Task, b: Task) => b.updatedAt.localeCompare(a.updatedAt);

function Ready({ t }: { t: Task }) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const keep = () => {
    setBusy(true);
    api<{ kept?: unknown[]; conflicts?: string[] }>('POST', `/tasks/${t.id}/keep`)
      .then((r) => setNote(r.conflicts ? `Not kept: you changed ${r.conflicts.join(', ')} too. Nothing was written.` : 'Kept: the changes are in your folder.'))
      .catch((e) => setNote(`Could not keep: ${(e as Error).message}`))
      .finally(() => setBusy(false));
  };
  return (
    <div class="gos-folder">
      <div class="gos-folder-head">
        <Icon name="folder" size={28} />
        <span class="gos-two">
          <span class="t-body-strong">{t.title}</span>
          <span class="t-caption t-secondary">
            {where(t)} · finished at {hhmm(t.updatedAt)}
          </span>
        </span>
      </div>
      {t.summary && <p class="t-body">In a copy of {where(t).split(' › ').at(-1)}: {t.summary}</p>}
      <button type="button" class="gos-link" onClick={() => open(`task/${t.id}`)}>
        Review changes
      </button>
      <div class="gos-actions gos-home-buttons">
        <Button large onClick={() => void undo(t.id)} disabled={busy || box.down}>
          Undo
        </Button>
        <Button large kind="suggested" onClick={keep} disabled={busy || box.down || !box.owner}>
          Keep changes
        </Button>
      </div>
      <p class="t-caption t-secondary" role={note ? 'status' : undefined}>
        {note || (box.owner ? 'Your folder stays as it was until you choose Keep.' : "Only the owner's phone can keep changes.")}
      </p>
    </div>
  );
}

/** The Personal home's folder sections. Nothing on a Server box, which hands out no folders. */
export function FolderReview() {
  const b = useBox();
  const all = [...b.tasks.values()];
  const ready = all.filter((t) => t.state === 'done' && t.review === 'pending').sort(byNewest);
  const kept = all.filter((t) => t.review === 'kept').sort(byNewest).slice(0, 3);
  const [error, setError] = useState('');
  if (!ready.length && !kept.length) return null;
  const putBack = (t: Task) => api('POST', `/tasks/${t.id}/unkeep`).catch((e) => setError(`Could not put it back: ${(e as Error).message}`));
  return (
    <>
      {ready.length > 0 && (
        <section class="g-group" aria-label="Ready for you">
          <div class="g-group-head">
            <h2 class="g-group-title">Ready for you</h2>
          </div>
          <div class="g-list">
            {ready.map((t) => (
              <Ready t={t} key={t.id} />
            ))}
          </div>
        </section>
      )}
      {kept.length > 0 && (
        <section class="g-group" aria-label="Kept recently">
          <div class="g-group-head">
            <h2 class="g-group-title">Kept recently</h2>
          </div>
          <div class="g-list">
            {kept.map((t) => (
              <div class="g-row" key={t.id}>
                <Icon name="folder" />
                <span class="g-row-text">
                  <span class="g-row-title">{t.title}</span>
                  <span class="g-row-sub">
                    Kept {ago(t.updatedAt)} · {where(t)}
                  </span>
                </span>
                <Button onClick={() => void putBack(t)} disabled={!b.owner || b.down}>
                  Put back
                </Button>
              </div>
            ))}
          </div>
          {error && (
            <p class="gos-error" role="alert">
              {error}
            </p>
          )}
        </section>
      )}
    </>
  );
}
