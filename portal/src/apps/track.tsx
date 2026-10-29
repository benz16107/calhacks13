// A track's own app (GET /api/apps) in a GurtOS window. The page lives under /t/<track>/ and is owned by its track;
// it can link /kit/gurtos.css and /kit/gurtos.js to look like the rest of the OS. The window keeps it in the
// desktop's light or dark style.
import { useEffect, useRef, useState } from 'preact/hooks';
import { api, applyTheme, base, box, signedIn, tokenQuery, useBox } from '../live.ts';
import { Button, IconButton, StatusPage } from '../kit/ui.tsx';
import { HeaderBar, open } from '../wm.tsx';
import { useToggleApp } from './settings.tsx';

export const trackEntry = (arg: string) => box.apps.find((x) => `${x.track}/${x.name}` === arg);
/** The installed app behind a window, on or off. */
const installed = (arg: string) => box.allApps.find((x) => x.id === arg.split('/')[0]);
/** A window's title: the app's own name, also while the app is off ("Factory", never "factory/factory"). */
export const trackTitle = (arg: string) => {
  const i = installed(arg);
  return (trackEntry(arg)?.title ?? i?.ui.find((u) => u.name === arg.split('/')[1])?.title ?? i?.title ?? arg).replace(/\s*\(.*\)$/, '');
};

export function TrackApp({ arg }: { arg: string }) {
  const b = useBox();
  const toggle = useToggleApp();
  const a = trackEntry(arg);
  const off = !a && installed(arg);
  const frame = useRef<HTMLIFrameElement>(null);
  const src = a ? `${base()}/t/${a.track}${a.href}` : '';
  // The page runs sandboxed, with no origin of its own, so it never holds this device's token or acts as the box's
  // screen: the box gives each window a token of its own, for that app's routes only (core/box.ts, windowGate). The
  // URL carries it and /kit/gurtos.js carries it on. A box too old to give one gets the old way: the pairing token.
  const [win, setWin] = useState<string | undefined>();
  useEffect(() => {
    setWin(undefined);
    if (a) api<{ token: string }>('POST', `/apps/${encodeURIComponent(a.track)}/window`).then((r) => setWin(r.token), () => setWin(''));
  }, [a?.track]);
  const sep = src.includes('?') ? '&' : '?';
  const old = () => src + tokenQuery(sep) + (signedIn() ? `${src.includes('?') || tokenQuery() ? '&' : '?'}person=${encodeURIComponent(signedIn()!)}` : '');
  const load = src && win !== undefined ? (win ? `${src}${sep}access_token=${encodeURIComponent(win)}` : old()) : '';
  // A request the page may not answer (another app's), it asks GurtOS to open here, where the person answers it.
  useEffect(() => {
    const hear = (e: MessageEvent) => {
      const m = e.data as { gurtos?: string; route?: string };
      if (e.source === frame.current?.contentWindow && m?.gurtos === 'open' && /^task\/[\w.-]{1,80}$/.test(m.route ?? '')) open(m.route!);
    };
    addEventListener('message', hear);
    return () => removeEventListener('message', hear);
  }, []);
  return (
    <>
      <HeaderBar
        title={trackTitle(arg)}
        start={a && <IconButton icon="view-refresh" label="Reload" onClick={() => frame.current?.contentWindow?.location.reload()} />}
        end={
          a && (
            <a class="g-icon-btn" href={load} target="_blank" rel="noopener" aria-label="Open in a browser tab" title="Open in a browser tab">
              <svg class="g-icon" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
                <path d="M9 1h6v6h-2V4.4L8.7 8.7 7.3 7.3 11.6 3H9zM2 3h5v2H3v8h8V9h2v6H1V3z" fill="currentColor" />
              </svg>
            </a>
          )
        }
      />
      <div class="g-window-content gos-track">
        {a && !load ? null : a ? (
          <iframe ref={frame} class="gos-track-frame" title={a.title} src={load} onLoad={applyTheme} allow="publickey-credentials-get; publickey-credentials-create" />
        ) : (
          <StatusPage
            icon="preferences-desktop-apps"
            title={off ? `${trackTitle(arg)} is off` : 'This app is not installed'}
            action={off && b.owner ? <Button kind="suggested" onClick={() => void toggle(off, true)}>Turn on</Button> : undefined}
          >
            {off ? (b.owner ? 'Turn it on to open it here.' : 'The owner can turn it on in App Center.') : 'App Center lists the apps on this computer.'}
          </StatusPage>
        )}
      </div>
    </>
  );
}
