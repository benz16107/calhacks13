// The GurtOS kit as Preact components. Each wraps a g-* class from kit.css with the right element, role and keyboard
// behavior, so every app gets the same controls. Track apps get the same look from /kit/gurtos.css without Preact.
import type { ButtonHTMLAttributes, ComponentChildren, JSX } from 'preact';
import { createPortal } from 'preact/compat';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
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
import waiting from './apps/waiting.svg';
import audit from './apps/audit.svg';

/** One Adwaita symbolic icon, 16 px, in the text color. Decorative unless given a label. */
export function Icon({ name, label, size = 16, class: cls = '' }: { name: string; label?: string; size?: number; class?: string }) {
  const body = ICONS[name];
  if (!body && typeof console !== 'undefined') console.warn(`no icon ${name}`);
  return (
    <svg
      class={`g-icon ${cls}`}
      viewBox="0 0 16 16"
      width={size}
      height={size}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : 'true'}
      dangerouslySetInnerHTML={{ __html: body ?? '' }}
    />
  );
}

// GurtOS's own app icons: a glyph on the app's tile color (docs/figma/system.md, section 48:86).
const APP_ICONS: Record<string, { glyph: string; tile: string }> = {
  tasks: { glyph: tasks, tile: 'var(--color-app-tasks)' },
  activity: { glyph: activity, tile: 'var(--color-app-activity)' },
  'time-machine': { glyph: timeMachine, tile: 'var(--color-app-time-machine)' },
  settings: { glyph: settings, tile: 'var(--color-app-settings)' },
  'app-center': { glyph: appCenter, tile: 'var(--color-app-app-center)' },
  'credit-desk': { glyph: creditDesk, tile: 'var(--color-app-credit-desk)' },
  shopper: { glyph: shopper, tile: 'var(--color-app-shopper)' },
  wallet: { glyph: wallet, tile: 'var(--color-app-wallet)' },
  find: { glyph: find, tile: 'var(--color-app-find)' },
  jira: { glyph: jira, tile: 'var(--color-app-jira)' },
  fetch: { glyph: asiOne, tile: 'var(--color-app-asi-one)' },
  'asi-one': { glyph: asiOne, tile: 'var(--color-app-asi-one)' },
  waiting: { glyph: waiting, tile: 'var(--color-app-waiting)' },
  audit: { glyph: audit, tile: 'var(--color-app-audit)' },
};
export const hasAppIcon = (id: string) => id in APP_ICONS;

/** An app icon at any size. An app without its own glyph shows its first letter on a neutral tile. */
export function AppIcon({ id, title, size = 52 }: { id: string; title?: string; size?: number }) {
  const a = APP_ICONS[id];
  return (
    <span class="g-app-icon" style={{ '--size': `${size}px`, '--tile': a?.tile } as JSX.CSSProperties} aria-hidden="true">
      {a ? <img src={a.glyph} alt="" draggable={false} /> : <span class="g-app-letter">{(title ?? id).trim()[0]?.toUpperCase()}</span>}
    </span>
  );
}

type Btn = ButtonHTMLAttributes<HTMLButtonElement> & {
  kind?: 'suggested' | 'destructive' | 'flat' | 'default';
  large?: boolean;
  icon?: string;
  href?: string;
};
/** Suggested is the one main action in a view; Default for the rest; Flat in header bars; Destructive removes or undoes. */
export function Button({ kind = 'default', large, icon, children, class: cls = '', href, ...rest }: Btn) {
  const c = `g-btn${kind !== 'default' ? ` g-btn-${kind}` : ''}${large ? ' g-btn-large' : ''} ${cls}`;
  const inner = (
    <>
      {icon && <Icon name={icon} />}
      {children}
    </>
  );
  if (href) return <a class={c} href={href}>{inner}</a>;
  return (
    <button type="button" class={c} {...rest}>
      {inner}
    </button>
  );
}

/** A 34 px button with one icon. It always has a name, shown as its tooltip. */
export function IconButton({ icon, label, kind = 'flat', ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { icon: string; label: string; kind?: 'flat' | 'default' }) {
  return (
    <button type="button" class={`g-icon-btn${kind === 'default' ? ' g-icon-btn-default' : ''}`} aria-label={label} title={label} {...rest}>
      <Icon name={icon} />
    </button>
  );
}

/** Turns one setting on or off at once. */
export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <input
      type="checkbox"
      role="switch"
      class="g-switch"
      checked={checked}
      disabled={disabled}
      aria-label={label}
      onChange={(e) => onChange((e.target as HTMLInputElement).checked)}
    />
  );
}

export const Badge = ({ kind = 'attention', children }: { kind?: 'attention' | 'accent' | 'neutral' | 'success' | 'destructive'; children: ComponentChildren }) => (
  <span class={`g-badge${kind !== 'attention' ? ` g-badge-${kind}` : ''}`}>{children}</span>
);

export const Chip = ({ icon, children }: { icon?: string; children: ComponentChildren }) => (
  <span class="g-chip">
    {icon && <Icon name={icon} />}
    {children}
  </span>
);

/** Progress from 0 to 100, or moving when the box doesn't know how far along a task is. */
export const Progress = ({ value, label }: { value?: number; label: string }) => (
  <span
    class="g-progress"
    role="progressbar"
    aria-label={label}
    aria-valuenow={value}
    aria-valuemin={0}
    aria-valuemax={100}
    data-indeterminate={value === undefined ? '' : undefined}
    style={value === undefined ? undefined : ({ '--value': `${value}%` } as JSX.CSSProperties)}
  >
    <span />
  </span>
);

/** A Heading, an optional caption, then a card of rows. */
export function Group({ title, caption, children, end }: { title?: string; caption?: ComponentChildren; children: ComponentChildren; end?: ComponentChildren }) {
  return (
    <section class="g-group">
      {(title || caption) && (
        <div class="g-group-head">
          <div>
            {title && <h3 class="g-group-title">{title}</h3>}
            {caption && <p class="g-group-caption">{caption}</p>}
          </div>
          {end}
        </div>
      )}
      <div class="g-list">{children}</div>
    </section>
  );
}

type RowProps = { icon?: string; title: ComponentChildren; sub?: ComponentChildren; children?: ComponentChildren; lead?: ComponentChildren };
const RowText = ({ title, sub }: { title: ComponentChildren; sub?: ComponentChildren }) => (
  <span class="g-row-text">
    <span class="g-row-title">{title}</span>
    {sub && <span class="g-row-sub">{sub}</span>}
  </span>
);

/** A row with one control (or a read-only value) at its end. */
export function Row({ icon, title, sub, children, lead }: RowProps) {
  return (
    <div class="g-row">
      {lead}
      {icon && <Icon name={icon} />}
      <RowText title={title} sub={sub} />
      {children}
    </div>
  );
}

/** A row whose switch is the whole row: clicking the title flips it too. */
export function SwitchRow({ icon, title, sub, checked, onChange, disabled }: RowProps & { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <label class="g-row">
      {icon && <Icon name={icon} />}
      <RowText title={title} sub={sub} />
      <input type="checkbox" role="switch" class="g-switch" checked={checked} disabled={disabled} onChange={(e) => onChange((e.target as HTMLInputElement).checked)} />
    </label>
  );
}

/** A row that opens a subpage. */
export function LinkRow({ icon, title, sub, value, onClick, href, lead }: RowProps & { value?: ComponentChildren; onClick?: () => void; href?: string }) {
  const inner = (
    <>
      {lead}
      {icon && <Icon name={icon} />}
      <RowText title={title} sub={sub} />
      <span class="g-row-trail">
        {value}
        <Icon name="pan-end" />
      </span>
    </>
  );
  return href ? (
    <a class="g-row" href={href}>
      {inner}
    </a>
  ) : (
    <button type="button" class="g-row" onClick={onClick}>
      {inner}
    </button>
  );
}

/** A row with a list to choose from. A native select, so the keyboard, screen readers and phones all work. */
export function ComboRow<T extends string>({ icon, title, sub, value, options, onChange, disabled }: RowProps & { value: T; options: [T, string][]; onChange: (v: T) => void; disabled?: boolean }) {
  const id = useId();
  return (
    <div class="g-row">
      {icon && <Icon name={icon} />}
      <span class="g-row-text">
        <label class="g-row-title" for={id}>
          {title}
        </label>
        {sub && <span class="g-row-sub">{sub}</span>}
      </span>
      <span class="g-combo-wrap">
        <select id={id} class="g-combo" value={value} disabled={disabled} onChange={(e) => onChange((e.target as HTMLSelectElement).value as T)}>
          {options.map(([v, label]) => (
            <option value={v} key={v}>
              {label}
            </option>
          ))}
        </select>
        <Icon name="pan-down" />
      </span>
    </div>
  );
}

/** The last row of a list: add one more. */
export const AddRow = ({ title, onClick }: { title: string; onClick: () => void }) => (
  <button type="button" class="g-row g-row-add" onClick={onClick}>
    <Icon name="list-add" />
    <span class="g-row-text">
      <span class="g-row-title">{title}</span>
    </span>
  </button>
);

let ids = 0;
export function useId() {
  const [id] = useState(() => `g${++ids}`);
  return id;
}

/** Two to five views of the same content. Arrow keys move between them. */
export function ToggleGroup<T extends string>({ value, options, onChange, label }: { value: T; options: [T, string, number?][]; onChange: (v: T) => void; label: string }) {
  const keys = (e: KeyboardEvent) => {
    const i = options.findIndex(([v]) => v === value);
    const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const next = options[(i + d + options.length) % options.length][0];
    onChange(next);
    requestAnimationFrame(() => ((e.currentTarget as HTMLElement)?.querySelector('[aria-checked="true"]') as HTMLElement)?.focus());
  };
  return (
    <div class="g-toggle-group" role="radiogroup" aria-label={label} onKeyDown={keys}>
      {options.map(([v, text, count]) => (
        <button type="button" role="radio" class="g-toggle" aria-checked={v === value} tabIndex={v === value ? 0 : -1} onClick={() => onChange(v)} key={v}>
          {text}
          {count !== undefined && <small>{count}</small>}
        </button>
      ))}
    </div>
  );
}

/** An empty or error state: a big symbolic icon, a title, one sentence, at most one button. */
export const StatusPage = ({ icon, title, children, action }: { icon: string; title: string; children?: ComponentChildren; action?: ComponentChildren }) => (
  <div class="g-status">
    <Icon name={icon} size={64} />
    <h2 class="g-status-title">{title}</h2>
    {children && <p class="g-status-body">{children}</p>}
    {action}
  </div>
);

// ---------- floating things ----------

/** Closes on Escape and on a click outside `ref`. */
export function useDismiss(ref: { current: HTMLElement | null }, onClose: () => void, ignore?: { current: HTMLElement | null }) {
  useEffect(() => {
    const down = (e: PointerEvent) => {
      const t = e.target as Node;
      if (ref.current?.contains(t) || ignore?.current?.contains(t)) return;
      onClose();
    };
    const key = (e: KeyboardEvent) => e.key === 'Escape' && (e.stopPropagation(), onClose());
    addEventListener('pointerdown', down, true);
    addEventListener('keydown', key, true);
    return () => (removeEventListener('pointerdown', down, true), removeEventListener('keydown', key, true));
  }, []);
}

/**
 * A popover next to the control that opened it, in the top layer of the page. It closes when you click outside or
 * press Escape, and returns focus to its anchor.
 */
export function Popover({ anchor, onClose, children, align = 'start', class: cls = '', label }: { anchor: HTMLElement | null; onClose: () => void; children: ComponentChildren; align?: 'start' | 'center' | 'end'; class?: string; label?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number }>();
  useDismiss(ref, () => (onClose(), anchor?.focus()), { current: anchor });
  useLayoutEffect(() => {
    if (!anchor || !ref.current) return;
    const a = anchor.getBoundingClientRect();
    const w = ref.current.offsetWidth;
    const left = align === 'end' ? a.right - w : align === 'center' ? a.left + a.width / 2 - w / 2 : a.left;
    setPos({ left: Math.max(8, Math.min(innerWidth - w - 8, left)), top: a.bottom + 6 });
    (ref.current.querySelector('[role=menuitem], button, a, input, select') as HTMLElement | null)?.focus();
  }, [anchor]);
  return createPortal(
    <div
      ref={ref}
      class={`g-popover g-root ${cls}`}
      role="dialog"
      aria-label={label}
      style={{ position: 'fixed', zIndex: 1000, left: pos?.left ?? -9999, top: pos?.top ?? 0, visibility: pos ? 'visible' : 'hidden' }}
    >
      {children}
    </div>,
    document.body,
  );
}

/** A menu: arrow keys move, Home and End jump, Enter or Space picks, Escape closes. */
export function Menu({ items, onClose, label }: { items: (MenuItem | 'sep')[]; onClose: () => void; label: string }) {
  const keys = (e: KeyboardEvent) => {
    const all = [...(e.currentTarget as HTMLElement).querySelectorAll<HTMLElement>('[role=menuitem]:not([aria-disabled=true])')];
    const i = all.indexOf(document.activeElement as HTMLElement);
    const go = (n: number) => (e.preventDefault(), all[(n + all.length) % all.length]?.focus());
    if (e.key === 'ArrowDown') go(i + 1);
    else if (e.key === 'ArrowUp') go(i - 1);
    else if (e.key === 'Home') go(0);
    else if (e.key === 'End') go(all.length - 1);
  };
  return (
    <div class="g-menu" role="menu" aria-label={label} onKeyDown={keys}>
      {items.map((it, i) =>
        it === 'sep' ? (
          <div class="g-menu-sep" role="separator" key={i} />
        ) : (
          <button
            type="button"
            role="menuitem"
            class={`g-menu-item${it.destructive ? ' g-destructive' : ''}`}
            aria-disabled={it.disabled}
            onClick={() => (onClose(), it.run())}
            key={i}
          >
            {it.icon && <Icon name={it.icon} />}
            <span>{it.label}</span>
            {it.hint && <kbd>{it.hint}</kbd>}
          </button>
        ),
      )}
    </div>
  );
}
export interface MenuItem {
  label: string;
  run: () => void;
  icon?: string;
  hint?: string;
  destructive?: boolean;
  disabled?: boolean;
}

/** A context menu at the pointer (or under the focused element when opened from the keyboard). */
export function ContextMenu({ at, items, onClose, label }: { at: { x: number; y: number }; items: (MenuItem | 'sep')[]; onClose: () => void; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState(at);
  useDismiss(ref, onClose);
  useLayoutEffect(() => {
    const r = ref.current!.getBoundingClientRect();
    setPos({ x: Math.min(at.x, innerWidth - r.width - 8), y: Math.min(at.y, innerHeight - r.height - 8) });
    (ref.current!.querySelector('[role=menuitem]') as HTMLElement | null)?.focus();
  }, [at.x, at.y]);
  return createPortal(
    <div ref={ref} class="g-popover g-root" style={{ position: 'fixed', zIndex: 1001, left: pos.x, top: pos.y }}>
      <Menu items={items} onClose={onClose} label={label} />
    </div>,
    document.body,
  );
}

/**
 * One decision with consequences, as a native modal dialog: focus stays inside, Escape cancels. The title is the
 * question, buttons name the actions, Cancel comes first, and a destructive action is tinted red.
 */
export function Alert({ title, body, action, destructive, onConfirm, onCancel, busy }: { title: string; body?: ComponentChildren; action: string; destructive?: boolean; onConfirm: () => void; onCancel: () => void; busy?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return createPortal(
    <dialog ref={ref} class="g-dialog g-root" aria-labelledby="g-alert-title" onCancel={(e) => (e.preventDefault(), onCancel())}>
      <div class="g-alert">
        <h2 class="g-alert-title" id="g-alert-title">
          {title}
        </h2>
        {body && <div class="g-alert-body">{body}</div>}
        <div class="g-alert-actions">
          <Button onClick={onCancel} disabled={busy} autoFocus>
            Cancel
          </Button>
          <Button kind={destructive ? 'destructive' : 'suggested'} onClick={onConfirm} disabled={busy}>
            {action}
          </Button>
        </div>
      </div>
    </dialog>,
    document.body,
  );
}

/** A short job inside one window. It dims that window only. */
export function Sheet({ title, onCancel, onDone, done, doneDisabled, children, destructive }: { title: string; onCancel: () => void; onDone?: () => void; done?: string; doneDisabled?: boolean; children: ComponentChildren; destructive?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    (ref.current?.querySelector('input, select, textarea, button:not([data-cancel])') as HTMLElement | null)?.focus();
    return () => prev?.focus();
  }, []);
  const key = (e: KeyboardEvent) => {
    if (e.key === 'Escape') (e.stopPropagation(), onCancel());
    if (e.key === 'Tab') {
      const f = [...ref.current!.querySelectorAll<HTMLElement>('button:not(:disabled), input, select, textarea, a[href]')];
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) (e.preventDefault(), f.at(-1)!.focus());
      else if (!e.shiftKey && document.activeElement === f.at(-1)) (e.preventDefault(), f[0].focus());
    }
  };
  return (
    <div class="g-sheet-layer" onKeyDown={key}>
      <div ref={ref} class="g-sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div class="g-headerbar">
          <div class="g-headerbar-start">
            <Button kind="flat" onClick={onCancel} data-cancel="">
              Cancel
            </Button>
          </div>
          <div class="g-headerbar-title">{title}</div>
          <div class="g-headerbar-end">
            {onDone && (
              <Button kind={destructive ? 'destructive' : 'suggested'} onClick={onDone} disabled={doneDisabled}>
                {done ?? 'Done'}
              </Button>
            )}
          </div>
        </div>
        <div class="g-sheet-body">{children}</div>
      </div>
    </div>
  );
}

/** Confirms what just happened, with Undo when it can be undone. Four seconds, one at a time. */
export function Toast({ text, action, onAction, onDone }: { text: string; action?: string; onAction?: () => void; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 4000);
    return () => clearTimeout(t);
  }, [text]);
  return (
    <div class="g-toast" role="status">
      <span>{text}</span>
      {action && (
        <button type="button" class="g-btn" onClick={() => (onAction?.(), onDone())}>
          {action}
        </button>
      )}
      <button type="button" class="g-btn" aria-label="Dismiss" onClick={onDone}>
        <Icon name="window-close" />
      </button>
    </div>
  );
}
