// The service worker (dist/sw.js, scope /). It keeps the app opening offline, so a phone with no signal still shows
// GurtOS and says the box is out of reach, and it turns pushes into notifications you can answer from.
// It never caches /api/ or /t/: live state and track pages always come from the box.
/// <reference lib="webworker" />
declare const self: ServiceWorkerGlobalScope;
export {};

const SHELL = 'gurtos-shell';
/** The page keeps the pairing in this cache for us: a service worker can't read localStorage. See pwa.ts. */
const PAIRING = 'gurtos-pairing';

interface Push {
  type: 'approval' | 'test' | 'answered';
  id?: string;
  task?: string;
  title?: string;
  body?: string;
  box?: string;
  costCents?: number;
  url?: string;
}

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
    p = { type: 'test', title: 'GurtOS', body: e.data?.text() };
  }
  const options: NotificationOptions & { actions?: { action: string; title: string }[] } = {
    body: p.body,
    tag: p.id ?? p.type,
    data: p,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
  };
  // Android shows these buttons; iOS ignores them and opens the app on a tap.
  if (p.type === 'approval') options.actions = [{ action: 'approve', title: 'Approve' }, { action: 'deny', title: 'Deny' }];
  e.waitUntil(self.registration.showNotification(p.title ?? 'GurtOS', options));
});

self.addEventListener('notificationclick', (e) => {
  const p = (e.notification.data ?? {}) as Push;
  e.notification.close();
  if (p.type === 'approval' && p.id && (e.action === 'approve' || e.action === 'deny')) e.waitUntil(answer(p, e.action === 'approve'));
  else e.waitUntil(openApp(p.url ?? (p.task ? `/#task/${p.task}` : '/')));
});

/** Answer from the notification with this phone's own token, then say what happened. */
async function answer(p: Push, approved: boolean) {
  let title: string;
  try {
    const token = (await (await (await caches.open(PAIRING)).match('/pairing'))?.json())?.token as string | undefined;
    const r = await fetch(`/api/approvals/${encodeURIComponent(p.id!)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ approved }),
    });
    const out = (await r.json().catch(() => ({}))) as { error?: string; state?: string; by?: string };
    if (r.status === 401) title = 'This phone is not paired any more. Your answer did not go through.';
    else if (!r.ok) title = `Not answered: ${out.error ?? `the box said ${r.status}`}`;
    else if (out.state && out.state !== (approved ? 'approved' : 'denied')) title = `Already ${out.state}${out.by ? ` on ${out.by}` : ''}`;
    else title = approved ? 'Approved' : 'Denied';
  } catch {
    title = 'The box is out of reach. Your answer did not go through.';
  }
  await self.registration.showNotification(title, { body: p.title, tag: p.id, data: { ...p, type: 'answered' }, icon: '/icon-192.png' });
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
