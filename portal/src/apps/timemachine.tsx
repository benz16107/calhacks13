// Time Machine (Figma 85:5256): each finished task is a layer over a workspace's base files, newest on top. Pick a
// layer to see what comes out with it and what stays, then take it out alone.
import type { JSX } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { api, undo, useBox, type Task } from '../live.ts';
import { Alert, Badge, Button, Icon, StatusPage } from '../kit/ui.tsx';
import { HeaderBar, useWin } from '../wm.tsx';
import { appOf, hhmm, plural } from '../util.ts';
import { undoCopy, type Diff } from './log.tsx';

const LIVE: Task['state'][] = ['running', 'waiting', 'queued'];
const wsIcon = (w: string) => (w.startsWith('owner-') ? 'user-home' : w === 'home' ? 'network-server' : 'folder');

export function TimeMachineApp() {
  const b = useBox();
  const win = useWin();
  const all = [...b.tasks.values()].sort((x, y) => y.updatedAt.localeCompare(x.updatedAt));
  const workspaces = [...new Set(all.filter((t) => t.state === 'done' || t.state === 'undone' || LIVE.includes(t.state)).map((t) => t.workspace))];
  const [picked, setWs] = useState<string>();
  const ws = picked && workspaces.includes(picked) ? picked : (workspaces.find((w) => all.some((t) => t.workspace === w && t.state === 'done')) ?? workspaces[0]);
  const here = all.filter((t) => t.workspace === ws);
  const layers = here.filter((t) => t.state === 'done');
  // Newest on top: what still runs here, then the finished layers. Undone tasks left no layer.
  const stack = [...here.filter((t) => LIVE.includes(t.state)), ...layers];
  const [sel, setSel] = useState<string>();
  const selected = layers.find((t) => t.id === sel) ?? layers[0];
  const [diffs, setDiffs] = useState(new Map<string, Diff>());
  const ids = layers.map((t) => t.id).join(',');
  useEffect(() => {
    // shortcut: fetches the newest 12 layers' diffs; paginate if a workspace ever has more.
    void Promise.all(layers.slice(0, 12).map((t) => api<Diff>('GET', `/tasks/${t.id}/diff`).then((d) => [t.id, d] as const).catch(() => undefined))).then((r) =>
      setDiffs(new Map(r.filter((x) => !!x))),
    );
  }, [ids]);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  const doUndo = async (t: Task) => {
    setBusy(true);
    try {
      await undo(t.id);
      setSel(undefined);
      win?.toast(`Took out ${t.title}. Every other task kept its changes.`);
    } catch (e) {
      win?.toast(`Could not undo: ${(e as Error).message}`);
    }
    setBusy(false);
    setConfirm(false);
  };
  const d = selected && diffs.get(selected.id);
  const blocked = selected ? b.events.filter((e) => e.task === selected.id && e.type === 'net.blocked').length : 0;
  const stays = stack.filter((t) => t !== selected);
  const copy = selected && undoCopy(selected, d?.changes.length);

  return (
    <div class="g-split gos-w-tm">
      <nav class="g-sidebar" aria-label="Workspaces">
        <HeaderBar title="Time Machine" controls={false} flat />
        <div class="g-sidebar-body">
          <p class="gos-w-label">Workspaces</p>
          {workspaces.map((w) => (
            <button type="button" class="g-sidebar-item" aria-current={w === ws ? 'page' : undefined} onClick={() => (setWs(w), setSel(undefined))} key={w}>
              <Icon name={wsIcon(w)} />
              <span>{w}</span>
            </button>
          ))}
          {!workspaces.length && <p class="gos-w-label">None yet</p>}
        </div>
      </nav>
      <div class="g-split-main">
        <HeaderBar title={ws ?? 'Time Machine'} sub={ws ? `${plural(layers.length, 'layer')}, one per finished task` : undefined} />
        {!stack.length ? (
          <div class="g-window-content">
            <StatusPage icon="document-open-recent" title={workspaces.length ? 'Nothing to take out here' : 'No finished tasks yet'}>
              {workspaces.length ? 'Every task in this workspace was undone. Its files are back to the base.' : 'Each finished task becomes a layer here that you can take out on its own.'}
            </StatusPage>
          </div>
        ) : (
          <div class="gos-w-tm-body">
            <div class="gos-w-stack" role="group" aria-label="Layers, newest on top">
              {stack.map((t, i) => {
                const below = stack.length - 1 - i; // 0 for the oldest, bottom layer
                const running = LIVE.includes(t.state);
                const files = diffs.get(t.id)?.changes.length;
                return (
                  <button
                    type="button"
                    class="gos-w-layer"
                    aria-pressed={t === selected}
                    disabled={running}
                    style={{ width: `${Math.max(264, 400 - below * 34)}px`, opacity: t === selected ? 1 : Math.max(0.52, 1 - below * 0.12) } as JSX.CSSProperties}
                    onClick={() => setSel(t.id)}
                    key={t.id}
                  >
                    <span class="t-body-strong">
                      {t.title}
                      {running && (t.state === 'waiting' ? ' (waiting for you)' : ' (running)')}
                    </span>
                    <span class="t-caption t-secondary">{running ? 'now' : `${hhmm(t.updatedAt)}${files !== undefined ? ` · ${plural(files, 'file')}` : ''}`}</span>
                  </button>
                );
              })}
              <div class="gos-w-base">Base files: no task ever writes here</div>
            </div>
            {selected ? (
              <section class="gos-w-preview" aria-label={`Undo ${selected.title}`}>
                <div>
                  <h3 class="t-title2">Undo {selected.title}</h3>
                  <p class="t-body t-secondary">
                    Finished {hhmm(selected.updatedAt)} · {appOf(selected).title}
                    {blocked ? ` · ${plural(blocked, 'attempt')} blocked` : ''}
                  </p>
                </div>
                <div class="gos-w-preview-cols">
                  <div class="gos-w-box">
                    <h4>
                      Comes out {d && <Badge kind="destructive">{d.changes.length}</Badge>}
                    </h4>
                    {d ? (
                      <ul>
                        {d.changes.map((c) => (
                          <li class="gos-w-out" title={c.path} key={c.path}>
                            {c.path}
                          </li>
                        ))}
                        {!d.changes.length && <li class="t-secondary">It changed no files.</li>}
                      </ul>
                    ) : (
                      <div class="gos-skeleton gos-skeleton-short" aria-busy="true" />
                    )}
                    <p>Only this layer's files.</p>
                  </div>
                  <div class="gos-w-box">
                    <h4>
                      Stays as it is <Badge kind="success">{stays.length + 1}</Badge>
                    </h4>
                    <ul>
                      {stays.map((t) => (
                        <li key={t.id}>
                          {t.title}
                          {LIVE.includes(t.state) ? ' (running)' : ''}
                        </li>
                      ))}
                      <li>The base files</li>
                    </ul>
                    <p>Every other layer keeps its changes.</p>
                  </div>
                </div>
                <div class="gos-w-actions">
                  <Button kind="destructive" large disabled={busy} onClick={() => setConfirm(true)}>
                    Undo this task
                  </Button>
                  <span class="t-caption t-secondary">The log keeps every step, and the task shows as undone.</span>
                </div>
              </section>
            ) : (
              <StatusPage icon="media-playback-start" title="Still running">
                Tasks here are still working. Each becomes a layer you can take out when it finishes.
              </StatusPage>
            )}
          </div>
        )}
      </div>
      {confirm && selected && copy && (
        <Alert title={`Undo ${selected.title}?`} body={copy.body} action={copy.action} destructive busy={busy} onConfirm={() => void doUndo(selected)} onCancel={() => setConfirm(false)} />
      )}
    </div>
  );
}
