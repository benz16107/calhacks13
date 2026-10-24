// The service worker (dist/sw.js, scope /). It keeps the app opening offline, so a phone with no signal still shows
// GurtOS and says the box is out of reach, and it turns pushes into notifications you can answer from.
// It never caches /api/ or /t/: live state and track pages always come from the box.
/// <reference lib="webworker" />
declare const self: ServiceWorkerGlobalScope;
export {};

const SHELL = 'gurtos-shell';
/** The page keeps the pairing in this cache for us: a service worker can't read localStorage. See pwa.ts. */
const PAIRING = 'gurtos-pairing';

/** A push, decrypted by the browser. `mac` proves it came from the machine it names (see trusted()). */
interface Push {
  v?: number;
  type: 'approval' | 'test' | 'answered';
  machine?: string;
  box?: string;
  url?: string;
  id?: string;
  task?: string;
  title?: string;
  body?: string;
  costCents?: number;
  mac?: string;
}
/** A paired machine, as the page keeps it (live.ts Machine). */
interface Machine {
  url: string;
  token: string;
  box: { id: string; name: string };
  pushKey?: string;
}
const machines = async (): Promise<Machine[]> => (await (await (await caches.open(PAIRING)).match('/machines'))?.json()) ?? [];

const b64 = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
/**
 * One push subscription serves every paired machine, so any of them could send "box B: approve?". A push counts as
 * machine B's only if its mac is HMAC-SHA256, keyed with the push key this device gave B alone, over the JSON of every
 * other field with the keys sorted. Anything else is not acted on.
 */
async function trusted(p: Push): Promise<Machine | undefined> {
  const m = (await machines()).find((x) => x.box.id === p.machine);
  if (!m?.pushKey || !p.mac) return undefined;
  const { mac, ...rest } = p;
  const json = JSON.stringify(Object.fromEntries(Object.entries(rest).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))));
  const key = await crypto.subtle.importKey('raw', b64(m.pushKey), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  return (await crypto.subtle.verify('HMAC', key, b64(mac), new TextEncoder().encode(json))) ? m : undefined;
}
// The app's own page for one machine's approval: that machine selected, its task window open.
const page = (p: Push) => `/?machine=${encodeURIComponent(p.machine ?? '')}${p.task ? `#task/${p.task}` : ''}`;

const live = (u: URL) => u.pathname.startsWith('/api/') || u.pathname.startsWith('/t/');

self.addEventListener('install', (e) => {
  e.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL);
      await cache.addAll(['/index.html', '/app.js', '/app.css', '/manifest.webmanifest', '/icon-192.png']);
      // The fonts and the wallpaper, so the offline screen looks the same.
      const css = await (await cache.match('/app.css'))?.text();
      const assets = [...new Set([...(css ?? '').matchAll(/url\("?\.?\/?(assets\/[^)"]+)"?\)/g)].map((m) => '/' + m[1]))];
      await cache.addAll(assets).catch(() => {});
      await self.skipWaiting();
    })(),
  );
});
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

// Network first, so a new build shows at once; the cache only answers when the box can't.
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin || live(u)) return;
  e.respondWith(
    (async () => {
      try {
        const r = await fetch(e.request);
        if (r.ok && !u.searchParams.has('access_token')) {
          const copy = r.clone();
          void caches.open(SHELL).then((c) => c.put(e.request.mode === 'navigate' ? '/index.html' : e.request, copy));
        }
        return r;
      } catch (err) {
        const hit = await caches.match(e.request.mode === 'navigate' ? '/index.html' : e.request);
        if (hit) return hit;
        throw err;
      }
    })(),
  );
});

self.addEventListener('push', (e) => {
  let p: Push;
  try {
    p = e.data?.json() as Push;
  } catch {
    p = { type: 'test' };
  }
  e.waitUntil(
    (async () => {
      const m = await trusted(p).catch(() => undefined);
      // A browser must show something for every push, so one that fails the check says only that it was ignored.
      if (!m) return self.registration.showNotification('GurtOS', { body: 'A message that could not be checked was ignored.', tag: 'unchecked', icon: '/icon-192.png' });
      const options: NotificationOptions & { actions?: { action: string; title: string }[] } = {
        body: `${p.box ?? m.box.name}: ${p.body ?? ''}`.trim(),
        tag: p.id ?? `${p.machine}-${p.type}`,
        data: p,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
      };
      // Android shows these buttons; iOS ignores them and opens the app on a tap.
      if (p.type === 'approval') options.actions = [{ action: 'approve', title: 'Approve' }, { action: 'deny', title: 'Deny' }];
      await self.registration.showNotification(p.title ?? 'GurtOS', options);
    })(),
  );
});

self.addEventListener('notificationclick', (e) => {
  const p = (e.notification.data ?? {}) as Push;
  e.notification.close();
  if (p.type === 'approval' && p.id && (e.action === 'approve' || e.action === 'deny')) e.waitUntil(answer(p, e.action === 'approve'));
  else e.waitUntil(openApp(page(p)));
});

/** Answer on the machine that asked, with this device's token for it, then say what happened. */
async function answer(p: Push, approved: boolean) {
  let title: string;
  const m = (await machines()).find((x) => x.box.id === p.machine);
  try {
    if (!m) throw Object.assign(new Error(), { unpaired: true });
    const r = await fetch(`${m.url}/api/approvals/${encodeURIComponent(p.id!)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${m.token}` },
      body: JSON.stringify({ approved }),
    });
    const out = (await r.json().catch(() => ({}))) as { error?: string; state?: string; by?: string };
    if (r.status === 401) title = 'This device is not paired with that box any more. Your answer did not go through.';
    else if (!r.ok) title = `Not answered: ${out.error ?? `the box said ${r.status}`}`;
    else if (out.state && out.state !== (approved ? 'approved' : 'denied')) title = `Already ${out.state}${out.by ? ` on ${out.by}` : ''}`;
    else title = approved ? 'Approved' : 'Denied';
  } catch (err) {
    title = (err as { unpaired?: boolean }).unpaired ? 'This device is not paired with that box any more.' : 'The box is out of reach. Your answer did not go through.';
  }
  await self.registration.showNotification(title, { body: `${p.box ?? m?.box.name ?? ''}: ${p.title ?? ''}`, tag: p.id, data: { ...p, type: 'answered' }, icon: '/icon-192.png' });
}

/** Bring an open GurtOS window to the front on that page, or open one. */
async function openApp(url: string) {
  const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  const w = all.find((c) => new URL(c.url).origin === location.origin) as WindowClient | undefined;
  if (w) {
    await w.focus();
    await w.navigate(url).catch(() => {});
    return;
  }
  await self.clients.openWindow(url);
}
