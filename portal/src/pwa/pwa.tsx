// GurtOS as an installable app: the service worker, the pairing copy it reads, and the Add to Home Screen guide.
// iPhones allow web push only for apps added to the Home Screen, and such an app has its own storage, separate from
// Safari. So on an iPhone the pairing code has to be typed in the installed app, not redeemed in Safari.
import { useEffect, useState } from 'preact/hooks';
import { changed } from '../live.ts';
import { Button, Icon } from '../kit/ui.tsx';
import { PRODUCT } from '../product.ts';

export const standalone = () => matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
export const ios = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
export const android = () => /Android/.test(navigator.userAgent);

/** The service worker needs a secure page (https, or the box's own 127.0.0.1). */
export function registerWorker() {
  if ('serviceWorker' in navigator && isSecureContext) navigator.serviceWorker.register('/sw.js').catch(() => {});
}

// Chrome on Android (and desktop) offers its own install prompt; hold it for our button.
let prompt: (Event & { prompt: () => Promise<void>; userChoice: Promise<unknown> }) | null = null;
addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  prompt = e as typeof prompt;
  changed();
});
addEventListener('appinstalled', () => ((prompt = null), changed()));

const code = (c: string) => c.toUpperCase().match(/.{1,4}/g)?.join('-') ?? c;

/** iPhone Safari opened a pairing link: add the app to the Home Screen first, then type the code there. */
export function AddToHomeScreen({ pairCode, box, onSafari }: { pairCode: string; box?: string; onSafari: () => void }) {
  return (
    <div class="gos-setup-layer">
      <section class="g-window gos-pair-first" aria-labelledby="a2hs-title">
        <div class="gos-pair">
          <img class="gos-a2hs-icon" src="/icon-180.png" alt="" width="64" height="64" />
          <h1 class="t-title2" id="a2hs-title">
            Install {PRODUCT} on this phone
          </h1>
          <p class="t-body t-secondary">
            To answer {box ?? 'your computer'} from this phone, add {PRODUCT} to your Home Screen, then open it from there. It pairs inside the app.
          </p>
          <ol class="gos-a2hs-steps">
            {[
              <>
                Tap <b>⋯</b> below, then <b>Share</b>
              </>,
              <>
                Tap <b>Add to Home Screen</b>
              </>,
              <>
                Leave <b>Open as Web App</b> on, then tap <b>Add</b>
              </>,
              <>
                Open <b>{PRODUCT}</b> from your Home Screen and type {box ? <>the address <b>{box}</b> and </> : ''}this code:
              </>,
            ].map((step, n) => (
              <li key={n}>
                <span class="gos-a2hs-n">{n + 1}</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
          <p class="gos-code t-mono" aria-label={`Pairing code ${pairCode.split('').join(' ')}`}>
            {code(pairCode)}
          </p>
          <p class="t-caption t-secondary">The code works for 5 minutes. If it runs out, the computer's screen shows a new one. Already have {PRODUCT}? Open it and choose Add a computer.</p>
          <Button kind="flat" onClick={onSafari}>
            Use it in Safari instead (no notifications)
          </Button>
        </div>
      </section>
    </div>
  );
}

/** After pairing in a browser tab: offer to install, with Chrome's prompt when there is one, else the steps. */
export function InstallCard() {
  const [hidden, setHidden] = useState(localStorage.getItem('gurtos.install-hidden') === '1');
  const [, render] = useState(0);
  useEffect(() => {
    const on = () => render((n) => n + 1);
    addEventListener('beforeinstallprompt', on);
    return () => removeEventListener('beforeinstallprompt', on);
  }, []);
  if (hidden || standalone() || !(prompt || android() || ios())) return null;
  const hide = () => (localStorage.setItem('gurtos.install-hidden', '1'), setHidden(true));
  return (
    <section class="g-banner g-banner-accent gos-install" aria-label={`Install ${PRODUCT}`}>
      <img src="/icon-180.png" alt="" width="40" height="40" />
      <div>
        <p class="t-body-strong">Install {PRODUCT}</p>
        <p class="t-caption">
          {prompt
            ? 'It opens like an app, and requests can reach you as notifications.'
            : ios()
              ? 'Tap Share, then Add to Home Screen. In the app, pair again with a new code: it keeps its own storage.'
              : "Open Chrome's menu, then Install app or Add to Home screen."}
        </p>
      </div>
      {prompt && (
        <Button kind="suggested" onClick={() => void prompt!.prompt().then(() => prompt!.userChoice).finally(() => ((prompt = null), changed()))}>
          Install
        </Button>
      )}
      <button type="button" class="g-icon-btn" aria-label="Not now" title="Not now" onClick={hide}>
        <Icon name="window-close" />
      </button>
    </section>
  );
}
