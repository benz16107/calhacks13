// The GurtOS kit for track apps, with no framework: the box serves it as /kit/gurtos.css and /kit/gurtos.js.
//   <link rel="stylesheet" href="/kit/gurtos.css"> <script type="module" src="/kit/gurtos.js"></script>
// Then use the g-* classes on plain HTML (portal/KIT.md) and these elements:
//   <g-icon name="system-search"></g-icon>          an Adwaita symbolic icon, 16 px, in the text color
//   <g-app-icon app="shopper" size="44"></g-app-icon>  a GurtOS app icon
//   gurtos.toast('Saved')                            a toast at the bottom of the page
// Inside a GurtOS window the page follows the desktop's light or dark style by itself, and off the box's own screen
// its fetches, log streams and links carry the device's pairing token (the box answers 401 without it).
import './kit.css';
import { ICONS } from './icons.ts';
import activity from './apps/activity.svg';
import appCenter from './apps/app-center.svg';
import asiOne from './apps/asi-one.svg';
import creditDesk from './apps/credit-desk.svg';
import find from './apps/find.svg';
import jira from './apps/jira.svg';
import settings from './apps/settings.svg';
import shopper from './apps/shopper.svg';
import tasks from './apps/tasks.svg';
import timeMachine from './apps/time-machine.svg';
import wallet from './apps/wallet.svg';

const GLYPHS: Record<string, string> = { tasks, activity, 'time-machine': timeMachine, settings, 'app-center': appCenter, 'credit-desk': creditDesk, shopper, wallet, find, jira, fetch: asiOne, 'asi-one': asiOne };

class GIcon extends HTMLElement {
  static observedAttributes = ['name', 'label', 'size'];
  connectedCallback() {
    this.render();
  }
  attributeChangedCallback() {
    this.render();
  }
  render() {
    const label = this.getAttribute('label');
    const size = this.getAttribute('size') ?? '16';
    this.style.display = 'inline-flex';
    this.innerHTML = `<svg class="g-icon" viewBox="0 0 16 16" width="${size}" height="${size}" style="width:${size}px;height:${size}px" ${label ? 'role="img"' : 'aria-hidden="true"'}>${ICONS[this.getAttribute('name') ?? ''] ?? ''}</svg>`;
    if (label) this.querySelector('svg')!.setAttribute('aria-label', label);
  }
}

class GAppIcon extends HTMLElement {
  static observedAttributes = ['app', 'size', 'title'];
  connectedCallback() {
    this.render();
  }
  attributeChangedCallback() {
    this.render();
  }
  render() {
    const app = this.getAttribute('app') ?? '';
    const size = this.getAttribute('size') ?? '52';
    const glyph = GLYPHS[app];
    const span = document.createElement('span');
    span.className = 'g-app-icon';
    span.setAttribute('aria-hidden', 'true');
    span.style.setProperty('--size', `${size}px`);
    span.style.setProperty('--tile', glyph ? `var(--color-app-${app === 'fetch' ? 'asi-one' : app})` : 'var(--color-app-other)');
    if (glyph) {
      const img = document.createElement('img');
      img.src = glyph;
      img.alt = '';
      span.append(img);
    } else {
      const letter = document.createElement('span');
      letter.className = 'g-app-letter';
      letter.textContent = (this.getAttribute('title') ?? app).trim()[0]?.toUpperCase() ?? '';
      span.append(letter);
    }
    this.replaceChildren(span);
    this.style.display = 'inline-flex';
  }
}

if (!customElements.get('g-icon')) customElements.define('g-icon', GIcon);
if (!customElements.get('g-app-icon')) customElements.define('g-app-icon', GAppIcon);

/** A toast at the bottom of the page for four seconds: what just happened, with one action if it can be undone. */
function toast(text: string, action?: { label: string; run: () => void }) {
  document.querySelector('.g-toast[data-gurtos]')?.remove();
  const t = document.createElement('div');
  t.className = 'g-toast g-root';
  t.dataset.gurtos = '';
  t.setAttribute('role', 'status');
  t.style.position = 'fixed';
  const span = document.createElement('span');
  span.textContent = text;
  t.append(span);
  if (action) {
    const b = document.createElement('button');
    b.className = 'g-btn';
    b.textContent = action.label;
    b.onclick = () => (action.run(), t.remove());
    t.append(b);
  }
  document.body.append(t);
  setTimeout(() => t.remove(), 4000);
}

// Inside a GurtOS window (same origin), follow the desktop's light or dark style as it changes.
function followTheme() {
  try {
    if (parent === window) return;
    const top = parent.document.documentElement;
    const copy = () => {
      if (top.dataset.theme) document.documentElement.dataset.theme = top.dataset.theme;
      for (const k of ['contrast', 'largerText', 'reduceMotion'] as const) {
        if (k in top.dataset) document.documentElement.dataset[k] = top.dataset[k];
        else delete document.documentElement.dataset[k];
      }
    };
    copy();
    new MutationObserver(copy).observe(top, { attributes: true, attributeFilter: ['data-theme', 'data-contrast', 'data-larger-text', 'data-reduce-motion'] });
  } catch {} // another origin: the page follows the system's style through the CSS
}
followTheme();

// GurtOS Business, on the box's own screen: the person picked in the top bar answers, so this page's own calls say who
// (x-box-person). The box honours it only from its own screen; a phone is named by its token instead.
function carryPerson() {
  let person: string | null = null;
  try {
    person = parent.localStorage.getItem('gurtos.person');
  } catch {} // another origin
  if (!person) return;
  const real = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const url = input instanceof Request ? input.url : String(input);
    if (new URL(url, location.href).origin !== location.origin) return real(input, init);
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
    if (!headers.has('x-box-person')) headers.set('x-box-person', person!);
    return real(input, { ...init, headers });
  };
}

// Off the box's own screen every call needs the device's pairing token. The window passes it as ?access_token=;
// carry it on this page's own fetches, log streams and links, so a track page works on a phone unchanged.
function carryToken() {
  let token = new URLSearchParams(location.search).get('access_token');
  try {
    token ??= JSON.parse(parent.localStorage.getItem('pairing') ?? 'null')?.token ?? null;
  } catch {} // another origin
  if (!token) return carryPerson();
  const mine = (u: string | URL) => new URL(u, location.href).origin === location.origin;
  const withQuery = (u: string | URL) => {
    const url = new URL(u, location.href);
    if (!url.searchParams.has('access_token')) url.searchParams.set('access_token', token!);
    return url.href;
  };
  const real = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const url = input instanceof Request ? input.url : String(input);
    if (!mine(url)) return real(input, init);
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
    if (!headers.has('authorization')) headers.set('authorization', `Bearer ${token}`);
    return real(input, { ...init, headers });
  };
  const RealES = window.EventSource;
  window.EventSource = class extends RealES {
    constructor(url: string | URL, init?: EventSourceInit) {
      super(mine(url) ? withQuery(url) : url, init);
    }
  } as typeof EventSource;
  addEventListener('click', (e) => {
    const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
    if (a && mine(a.href) && !a.href.includes('#') && a.target !== '_blank') a.href = withQuery(a.href);
  }, true);
  addEventListener('submit', (e) => {
    const f = e.target as HTMLFormElement;
    if (!mine(f.action)) return;
    if (f.method.toLowerCase() !== 'get') f.action = withQuery(f.action);
    else if (!f.elements.namedItem('access_token')) f.append(Object.assign(document.createElement('input'), { type: 'hidden', name: 'access_token', value: token }));
  }, true);
}
carryToken();

const gurtos = { toast, icons: Object.keys(ICONS) };
(globalThis as unknown as { gurtos: typeof gurtos }).gurtos = gurtos;
export { toast };
