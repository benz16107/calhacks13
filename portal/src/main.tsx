// One web app, three places: the box's own full-screen display (/screen, in the kiosk), the portal in a laptop
// browser, and the phone. The box serves it on the same address as its API, so every call is same-origin.
import { render } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { Banners, Desktop, Dock, MenuBar, NotificationCenter, ui } from './home.tsx';
import { start, surface, useBox } from './live.ts';
import { Window } from './windows.tsx';
import './style.css';

/** The open window, from the address: #tasks, #task/<id>, #activity, #app/<track>/<name>, and /pair#<code>. */
const routeOf = () => (location.pathname === '/pair' ? `pair/${location.hash.slice(1)}` : location.hash.slice(1));

let opener: HTMLElement | null = null;
addEventListener('click', (e) => {
  const a = (e.target as HTMLElement).closest('a[href^="#"]');
  if (a) opener = a as HTMLElement; // focus goes back here when the window closes
});

function App() {
  useBox();
  const [route, setRoute] = useState(routeOf());
  useEffect(() => {
    const on = () => setRoute(routeOf());
    addEventListener('hashchange', on);
    addEventListener('popstate', on);
    return () => (removeEventListener('hashchange', on), removeEventListener('popstate', on));
  }, []);
  const close = () => {
    history.pushState(null, '', location.pathname === '/pair' ? '/' : location.pathname);
    setRoute('');
    requestAnimationFrame(() => opener?.focus());
  };
  useEffect(() => {
    if (!route) return;
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && !ui.notifications && close();
    addEventListener('keydown', esc);
    return () => removeEventListener('keydown', esc);
  }, [route]);
  return (
    <>
      <Banners />
      <MenuBar />
      <Desktop covered={!!route || ui.notifications} />
      <Dock />
      {route && <Window route={route} onClose={close} />}
      {ui.notifications && <NotificationCenter />}
    </>
  );
}

document.documentElement.dataset.surface = surface.replace(' ', '-');
// The box's screen stays on all day: move everything a few pixels every few minutes so nothing burns in.
if (surface === 'box screen') {
  setInterval(() => {
    const r = () => Math.round(Math.random() * 8 - 4);
    document.body.style.translate = `${r()}px ${r()}px`;
  }, 180_000);
}
render(<App />, document.getElementById('app')!);
void start();
