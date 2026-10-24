// Where a phone lands after scanning the box's QR code: /#pair/<code>. It names itself and gets a device token.
import { useState } from 'preact/hooks';
import { api, pairing, type Pairing } from '../live.ts';
import { Button, Icon } from '../kit/ui.tsx';
import { HeaderBar } from '../wm.tsx';
import { PRODUCT } from '../product.ts';
import { selfBox } from '../util.ts';

export const formatCode = (c: string) => c.toUpperCase().match(/.{1,4}/g)?.join('-') ?? c;

export function PairApp({ code }: { code: string }) {
  const guess = /iPhone/.test(navigator.userAgent) ? 'iPhone' : /Android/.test(navigator.userAgent) ? 'Android phone' : 'Phone';
  const [name, setName] = useState(guess);
  const [state, setState] = useState<'ask' | 'busy' | Pairing | string>(pairing() ?? 'ask');
  const go = (e: Event) => {
    e.preventDefault();
    setState('busy');
    api<Pairing>('POST', '/pair', { code, name: name.trim() || guess })
      .then((p) => (localStorage.setItem('pairing', JSON.stringify(p)), setState(p)))
      .catch((err) => setState((err as Error).message));
  };
  return (
    <>
      <HeaderBar title="Pair this phone" sub={`with ${PRODUCT} on ${selfBox().name}`} />
      <div class="g-window-content gos-scroll">
        <div class="gos-pair">
          <span class="gos-pair-icon">
            <Icon name="phone" size={32} />
          </span>
          {typeof state === 'object' ? (
            <>
              <h3 class="t-title2">Paired as {state.device.name}</h3>
              <p class="t-body t-secondary">
                When a task on {state.box.name} asks for your OK, it shows here, and your answer goes in the log under this name. This phone never holds a key: it can only answer.
              </p>
              <div class="gos-actions">
                <Button kind="suggested" large href="/">
                  Open {PRODUCT}
                </Button>
                <Button large onClick={() => (localStorage.removeItem('pairing'), setState('ask'))}>
                  Pair again
                </Button>
              </div>
            </>
          ) : (
            <form onSubmit={go} class="gos-pair-form">
              <h3 class="t-title2">Check the code</h3>
              <p class="t-body t-secondary">The box's screen shows the same code.</p>
              <p class="gos-code t-mono">{code ? formatCode(code) : 'No code in the link'}</p>
              <label class="gos-field">
                <span class="t-body-strong">Name this phone</span>
                <input class="g-field" value={name} onInput={(e) => setName((e.target as HTMLInputElement).value)} maxLength={40} autoComplete="off" />
              </label>
              <div class="gos-actions">
                <button type="submit" class="g-btn g-btn-suggested g-btn-large" disabled={!code || state === 'busy'}>
                  Pair this phone
                </button>
                <Button large href="/">
                  Not now
                </Button>
              </div>
              {state !== 'ask' && state !== 'busy' && (
                <p class="gos-error" role="alert">
                  Could not pair: {state}. Ask the box's screen for a new code.
                </p>
              )}
            </form>
          )}
        </div>
      </div>
    </>
  );
}
