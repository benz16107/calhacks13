// GurtOS: one web app in three places. The box's own full-screen display (/screen, in the kiosk), the portal in a
// laptop browser, and the phone. The box serves it on the same address as its API, so every call is same-origin.
import { render } from 'preact';
import { useEffect } from 'preact/hooks';
import './kit/kit.css';
import './shell.css';
import './apps/index.tsx';
import { changed, start, surface, useBox } from './live.ts';
import { Banners, BootScreen, DesktopHome, Dock, Launcher, LockScreen, OutageBar, PairFirst, PhoneHome, TabBar, TopBar, access, shell, useIdleLock } from './shell.tsx';
import { Windows, open, phone, restore, wm } from './wm.tsx';
import { SetupWizard } from './setup.tsx';
import { StatusPage } from './kit/ui.tsx';
import { PRODUCT } from './product.ts';
import { registerWorker } from './pwa/pwa.tsx';

/** The route in the address: #tasks, #task/<id>, #settings/devices, #app/<track>/<name>, and /pair#<code>. */
const routeOf = () => (location.pathname === '/pair' ? `pair/${location.hash.slice(1)}` : decodeURIComponent(location.hash.slice(1)));

function App() {
  const b = useBox();
  if (b.down) html.dataset.down = '';
  else delete html.dataset.down;
  useIdleLock(surface === 'box screen');
  useEffect(() => {
    const on = () => routeOf() && open(routeOf());
    const resize = () => changed();
    addEventListener('hashchange', on);
    addEventListener('resize', resize);
    return () => (removeEventListener('hashchange', on), removeEventListener('resize', resize));
  }, []);
  useEffect(() => {
    const w = wm.wins.find((x) => !x.min && x.z === Math.max(...wm.wins.filter((y) => !y.min).map((y) => y.z)));
    document.title = w ? `${wm.apps[w.route.split('/')[0]]?.title(w.route.split('/').slice(1).join('/'))} · ${PRODUCT}` : PRODUCT;
  });

  // Off the box's own screen the box answers only paired devices.
  if (b.unpaired) return <PairFirst />;
  // On the box's own screen, the box out of reach means its service is starting: show the boot screen.
  if (b.down && surface === 'box screen') return <BootScreen />;
  // First run: the wizard on the box's screen (or the owner's phone) until setup is done. Nothing else shows.
  const setupOpen = b.setup && !b.setup.done;
  if (setupOpen && (surface === 'box screen' || b.owner)) return <SetupWizard />;
  if (setupOpen)
    return (
      <div class="gos-setup-layer">
        <section class="g-window gos-setup-wait">
          <StatusPage icon="emblem-system" title={`${PRODUCT} is being set up`}>
            Finish setup on the box's own screen, or scan its QR code with the owner's phone. This page opens the desktop when setup is done.
          </StatusPage>
        </section>
      </div>
    );

  const mobile = phone();
  return (
    <>
      {mobile ? <PhoneHome /> : <DesktopHome />}
      <TopBar />
      <OutageBar />
      <Windows />
      {mobile ? <TabBar /> : <Dock />}
      {shell.open === 'apps' && <Launcher />}
      <Banners />
      {shell.locked && <LockScreen />}
    </>
  );
}

const html = document.documentElement;
html.dataset.surface = surface.replace(' ', '-');
html.classList.add('g-root');
access.apply();
// Session restore: the windows from before a power cut come back where they were. A link to one app opens it on top.
// With none, the desktop shows what the box is doing.
const route = routeOf();
if (!phone()) restore();
if (route) open(route);
// The box's screen stays on all day: move everything a few pixels every few minutes so nothing burns in.
if (surface === 'box screen') {
  setInterval(() => {
    const r = () => Math.round(Math.random() * 6 - 3);
    document.body.style.translate = `${r()}px ${r()}px`;
  }, 180_000);
}
render(<App />, document.getElementById('app')!);
// The installable app: open offline, and notifications. The box's own screen (the kiosk) stays a plain page.
if (surface !== 'box screen') registerWorker();
void start();
