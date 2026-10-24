// The window manager. Every app is a window: it opens centered, comes to the front when you touch it, moves by its
// header bar, resizes from any edge, and minimizes, maximizes and closes from its controls. The layout is saved, so
// after a power cut the screen comes back with the same windows where they were.
import type { ComponentChildren } from 'preact';
import { createContext } from 'preact';
import { createPortal } from 'preact/compat';
import { useContext, useEffect, useRef, useState } from 'preact/hooks';
import { changed, useBox } from './live.ts';
import { Icon, Toast } from './kit/ui.tsx';

export interface Win {
  id: string;
  /** What the window shows: 'tasks', 'task/<id>', 'settings/permissions', 'app/<track>/<name>'. */
  route: string;
  x: number;
  y: number;
  w: number;
  h: number;
  z: number;
  min?: boolean;
  max?: boolean;
}
export interface AppSpec {
  title: (arg: string) => string;
  icon: string;
  /** Size from Figma at 1920 x 1080; smaller screens clamp it. */
  size: [number, number];
  render: (arg: string) => ComponentChildren;
  /** Routes that share one window: opening 'settings/devices' reuses the Settings window. */
  single?: boolean;
}

const KEY = 'gurtos.windows';
const TOPBAR = 32;
const DOCK = 99; // the dock's height and its 12 px float above the bottom edge, plus a little air

export const phone = () => matchMedia('(max-width: 699px)').matches;
export const wm = { wins: [] as Win[], z: 1, apps: {} as Record<string, AppSpec> };

const base = (route: string) => route.split('/')[0];
const specOf = (route: string) => wm.apps[base(route)];
const save = () => localStorage.setItem(KEY, JSON.stringify(wm.wins));
const commit = () => (save(), changed());

/** The focused window: the frontmost one that isn't minimized. */
export const focused = () => wm.wins.filter((w) => !w.min).sort((a, b) => b.z - a.z)[0];

function placement(spec: AppSpec): Pick<Win, 'x' | 'y' | 'w' | 'h'> {
  const areaW = innerWidth;
  const areaH = innerHeight - TOPBAR - DOCK;
  const w = Math.min(spec.size[0], areaW - 48);
  const h = Math.min(spec.size[1], areaH - 16);
  const n = wm.wins.filter((x) => !x.min).length;
  const x = Math.max(24, (areaW - w) / 2 + n * 28);
  const y = Math.max(TOPBAR + 8, TOPBAR + (areaH - h) / 2 + n * 24);
  return { x: Math.min(x, areaW - w - 8), y: Math.min(y, innerHeight - DOCK - h), w, h };
}

/** Open a window, or bring an open one to the front. */
export function open(route: string) {
  const spec = specOf(route);
  if (!spec) return;
  const same = wm.wins.find((w) => (spec.single ? base(w.route) === base(route) : w.route === route));
  if (same) {
    same.route = route;
    same.min = false;
    same.z = ++wm.z;
  } else {
    wm.wins.push({ id: Math.random().toString(36).slice(2, 9), route, z: ++wm.z, ...placement(spec) });
  }
  commit();
}
export function focus(id: string) {
  const w = wm.wins.find((x) => x.id === id);
  if (!w || (w.z === wm.z && !w.min)) return;
  w.z = ++wm.z;
  w.min = false;
  commit();
}
export function close(id: string) {
  wm.wins = wm.wins.filter((w) => w.id !== id);
  commit();
}
export function minimize(id: string) {
  const w = wm.wins.find((x) => x.id === id);
  if (w) (w.min = true), commit();
}
export function toggleMax(id: string) {
  const w = wm.wins.find((x) => x.id === id);
  if (w) (w.max = !w.max), (w.z = ++wm.z), commit();
}
/** Change what a window shows (a subpage) without moving it. */
export function navigate(id: string, route: string) {
  const w = wm.wins.find((x) => x.id === id);
  if (w && w.route !== route) (w.route = route), commit();
}

/** Bring back the last session's windows, clamped to this screen. */
export function restore() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? '[]') as Win[];
    wm.wins = saved.filter((w) => specOf(w.route));
    for (const w of wm.wins) {
      w.w = Math.min(w.w, innerWidth - 16);
      w.h = Math.min(w.h, innerHeight - TOPBAR - 16);
      w.x = Math.max(0, Math.min(w.x, innerWidth - 120));
      w.y = Math.max(TOPBAR, Math.min(w.y, innerHeight - 60));
    }
    wm.z = Math.max(1, ...wm.wins.map((w) => w.z));
  } catch {
    wm.wins = [];
  }
  return wm.wins.length > 0;
}

// ---------- the frame every app lives in ----------

interface WinApi {
  win: Win;
  focused: boolean;
  close: () => void;
  minimize: () => void;
  toggleMax: () => void;
  navigate: (route: string) => void;
  toast: (text: string, action?: string, onAction?: () => void) => void;
  host: HTMLElement | null;
}
const WinCtx = createContext<WinApi | null>(null);
export const useWin = () => useContext(WinCtx);

/** The window's own controls: minimize, maximize and close, as 24 px circles. */
export function WindowControls() {
  const w = useWin();
  if (!w) return null;
  if (phone())
    return (
      <div class="g-window-controls">
        <button type="button" class="g-window-control" onClick={w.close} aria-label="Close">
          <Icon name="window-close" />
        </button>
      </div>
    );
  return (
    <div class="g-window-controls">
      <button type="button" class="g-window-control" onClick={w.minimize} aria-label="Minimize" title="Minimize">
        <Icon name="window-minimize" />
      </button>
      <button type="button" class="g-window-control" onClick={w.toggleMax} aria-label={w.win.max ? 'Restore' : 'Maximize'} title={w.win.max ? 'Restore' : 'Maximize'}>
        <Icon name={w.win.max ? 'window-restore' : 'window-maximize'} />
      </button>
      <button type="button" class="g-window-control" onClick={w.close} aria-label="Close" title="Close">
        <Icon name="window-close" />
      </button>
    </div>
  );
}

/** A header bar: the main action or Back at the start, the title (or views) in the center, tools and controls at the end. */
export function HeaderBar({ start, title, sub, center, end, flat, controls = true }: { start?: ComponentChildren; title?: ComponentChildren; sub?: ComponentChildren; center?: ComponentChildren; end?: ComponentChildren; flat?: boolean; controls?: boolean }) {
  return (
    <header class={`g-headerbar${flat ? ' g-headerbar-flat' : ''}`}>
      <div class="g-headerbar-start">{start}</div>
      {center ?? (
        <h2 class="g-headerbar-title" data-window-title="">
          {title}
          {sub && <span class="g-headerbar-subtitle">{sub}</span>}
        </h2>
      )}
      <div class="g-headerbar-end">
        {end}
        {controls && <WindowControls />}
      </div>
    </header>
  );
}

/** A sheet portals into its window, so it dims that window only. */
export function InWindow({ children }: { children: ComponentChildren }) {
  const w = useWin();
  return w?.host ? createPortal(<>{children}</>, w.host) : <>{children}</>;
}

const EDGES = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'] as const;
const interactive = 'button, a, input, select, textarea, [role=radio], [role=tab], [contenteditable]';

function Frame({ win, isTop }: { win: Win; isTop: boolean }) {
  const spec = specOf(win.route)!;
  const arg = win.route.split('/').slice(1).join('/');
  const ref = useRef<HTMLElement>(null);
  const host = useRef<HTMLDivElement>(null);
  const [toast, setToast] = useState<{ text: string; action?: string; onAction?: () => void }>();
  const [, rerender] = useState(0);
  const mobile = phone();
  useEffect(() => {
    rerender(1); // the sheet host exists now
    (ref.current?.querySelector('[data-autofocus]') as HTMLElement | null)?.focus() ?? ref.current?.focus();
  }, []);

  // Move and resize by writing the style straight to the element, and save once at the end of the gesture.
  const gesture = (e: PointerEvent, edge?: (typeof EDGES)[number]) => {
    if (mobile || e.button !== 0) return;
    const el = ref.current!;
    const start = { x: e.clientX, y: e.clientY, ...(win.max ? { x0: 0, y0: TOPBAR } : {}) };
    const r0 = win.max ? { x: 0, y: TOPBAR, w: innerWidth, h: innerHeight - TOPBAR - DOCK } : { x: win.x, y: win.y, w: win.w, h: win.h };
    let r = { ...r0 };
    let moved = false;
    const move = (m: PointerEvent) => {
      const dx = m.clientX - start.x;
      const dy = m.clientY - start.y;
      if (!moved && Math.abs(dx) + Math.abs(dy) < 4) return;
      moved = true;
      if (!edge) {
        if (win.max) {
          // Dragging a maximized window restores it under the pointer, as on GNOME and macOS.
          win.max = false;
          r0.w = Math.min(win.w, innerWidth - 48);
          r0.h = win.h;
          r0.x = start.x - r0.w * (start.x / innerWidth);
          el.style.width = `${r0.w}px`;
          el.style.height = `${r0.h}px`;
          el.classList.remove('is-max');
        }
        r = { ...r0, x: Math.max(80 - r0.w, Math.min(innerWidth - 80, r0.x + dx)), y: Math.max(TOPBAR, Math.min(innerHeight - 48, r0.y + dy)) };
      } else {
        const minW = 360;
        const minH = 240;
        r = { ...r0 };
        if (edge.includes('e')) r.w = Math.max(minW, r0.w + dx);
        if (edge.includes('s')) r.h = Math.max(minH, r0.h + dy);
        if (edge.includes('w')) (r.w = Math.max(minW, r0.w - dx)), (r.x = r0.x + r0.w - r.w);
        if (edge.includes('n')) (r.h = Math.max(minH, r0.h - dy)), (r.y = Math.max(TOPBAR, r0.y + r0.h - r.h)), (r.h = r0.y + r0.h - r.y);
      }
      Object.assign(el.style, { left: `${r.x}px`, top: `${r.y}px`, width: `${r.w}px`, height: `${r.h}px` });
    };
    const up = () => {
      removeEventListener('pointermove', move);
      removeEventListener('pointerup', up);
      document.documentElement.classList.remove('is-dragging');
      if (!moved) return;
      Object.assign(win, { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.w), h: Math.round(r.h) });
      commit();
    };
    e.preventDefault();
    document.documentElement.classList.add('is-dragging');
    addEventListener('pointermove', move);
    addEventListener('pointerup', up);
  };

  const down = (e: PointerEvent) => {
    focus(win.id);
    const t = e.target as HTMLElement;
    if (t.closest('.g-headerbar') && !t.closest(interactive)) gesture(e);
  };
  const dbl = (e: MouseEvent) => {
    const t = e.target as HTMLElement;
    if (!mobile && t.closest('.g-headerbar') && !t.closest(interactive)) toggleMax(win.id);
  };

  const api: WinApi = {
    win,
    focused: isTop,
    close: () => close(win.id),
    minimize: () => minimize(win.id),
    toggleMax: () => toggleMax(win.id),
    navigate: (route) => navigate(win.id, route),
    toast: (text, action, onAction) => setToast({ text, action, onAction }),
    host: host.current,
  };
  const geo = mobile || win.max ? {} : { left: `${win.x}px`, top: `${win.y}px`, width: `${win.w}px`, height: `${win.h}px` };
  return (
    <section
      ref={ref}
      class={`g-window gos-win${isTop ? ' is-focused' : ' is-backdrop'}${win.max || mobile ? ' is-max' : ''}`}
      style={{ ...geo, zIndex: win.z, display: win.min ? 'none' : undefined }}
      aria-label={spec.title(arg)}
      tabIndex={-1}
      onPointerDown={down}
      onDblClick={dbl}
    >
      <WinCtx.Provider value={api}>{spec.render(arg)}</WinCtx.Provider>
      <div ref={host} class="gos-win-host" />
      {toast && <Toast text={toast.text} action={toast.action} onAction={toast.onAction} onDone={() => setToast(undefined)} />}
      {!mobile && !win.max && EDGES.map((d) => <div class={`gos-edge gos-edge-${d}`} onPointerDown={(e) => (e.stopPropagation(), focus(win.id), gesture(e, d))} key={d} />)}
    </section>
  );
}

/** Every open window, in one layer above the desktop and below the top bar's menus. */
export function Windows() {
  useBox();
  const top = focused();
  // Keep the address bar in step with the focused window, so a link or a reload opens the same thing.
  useEffect(() => {
    const want = top ? `#${top.route}` : '';
    if (location.hash !== want) history.replaceState(null, '', want || location.pathname);
  }, [top?.route]);
  return (
    <div class="gos-windows">
      {wm.wins.map((w) => (
        <Frame win={w} isTop={w === top} key={w.id} />
      ))}
    </div>
  );
}
