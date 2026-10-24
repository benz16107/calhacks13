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
            Add {PRODUCT} to your Home Screen
          </h1>
          <p class="t-body t-secondary">So requests for your OK reach this iPhone as notifications. It takes three taps.</p>
          <ol class="gos-a2hs-steps">
            <li>
              <span class="gos-a2hs-n">1</span>
              <span>
                Tap <b>Share</b>{' '}
                <svg class="g-icon" viewBox="0 0 16 16" width="16" height="16" role="img" aria-label="the Share button">
                  <path d="M8 1 5 4l1 1 1.3-1.3V10h1.4V3.7L10 5l1-1zM3 6h3v1.4H4.4v6.2h7.2V7.4H10V6h3v9H3z" fill="currentColor" />
                </svg>{' '}
                in Safari's toolbar.
              </span>
            </li>
            <li>
              <span class="gos-a2hs-n">2</span>
              <span>
                Tap <b>Add to Home Screen</b>, then <b>Add</b>.
              </span>
            </li>
            <li>
              <span class="gos-a2hs-n">3</span>
              <span>
                Open <b>{PRODUCT}</b> from your Home Screen and type {box ? <>the box address <b>{box}</b> and </> : ''}this code:
              </span>
            </li>
          </ol>
          <p class="gos-code t-mono" aria-label={`Pairing code ${pairCode.split('').join(' ')}`}>
            {code(pairCode)}
          </p>
          <p class="t-caption t-secondary">The code works for 5 minutes. If it runs out, the box's screen shows a new one.</p>
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
            ? 'It opens like an app, and requests for your OK can reach you as notifications.'
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
