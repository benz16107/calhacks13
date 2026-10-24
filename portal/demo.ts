// The portal's step in ./demo. The test VM has no browser, so this is a smoke test of what the browser needs: the box
// serves the built portal and its files, client routes load the app, and every API the portal reads answers,
// including the live log stream. Screenshots of the real app running are in portal/README.md.
import fs from 'node:fs';
import path from 'node:path';
import type { DemoKit } from '../core/contract.ts';
import { sourceHash } from './source-hash.ts';
import { PRODUCT } from './src/product.ts';

export default async (d: DemoKit) => {
  const built = fs.readFileSync(new URL('./dist/source.txt', import.meta.url), 'utf8').trim();
  d.check(built === sourceHash(), 'portal/dist is built from the current portal/src and SpacetimeDB bindings (if not: cd portal && npm ci && npm run build)');

  const base = `http://127.0.0.1:${fs.readFileSync(path.join(d.home, 'api.port'), 'utf8').trim()}`;
  const get = (p: string, accept = '*/*') => fetch(base + p, { headers: { accept } });

  const page = await get('/', 'text/html');
  const html = await page.text();
  d.check(page.ok && html.includes('/app.js') && html.includes(`<title>${PRODUCT}</title>`), `the box serves ${PRODUCT} at / on the same address as its API`);
  const js = await get('/app.js');
  const size = (await js.text()).length;
  d.check(js.ok && js.headers.get('content-type')?.includes('javascript') && size > 50_000, `its script loads (${Math.round(size / 1024)} KB with the SpacetimeDB client)`);
  const css = await (await get('/app.css')).text();
  const files = [...css.matchAll(/url\("?\.?\/?(assets\/[^)"]+)"?\)/g)].map((m) => m[1]);
  const found = await Promise.all(files.map((f) => get('/' + f).then((r) => r.ok)));
  d.check(files.length >= 6 && found.every(Boolean), `its ${files.length} fonts and wallpapers come from the box, so the screen needs no internet`);
  for (const [route, what] of [['/screen', "the box's own screen (the kiosk)"], ['/pair?code=TEST', 'where a phone lands after scanning']]) {
    const r = await get(route, 'text/html');
    d.check(r.ok && (await r.text()).includes('/app.js'), `${route}, ${what}, loads the app too`);
  }

  const health = await (await get('/api/health')).json();
  d.check(health.ok && health.spacetime?.database, `GET /api/health names the SpacetimeDB database the page subscribes to (${health.spacetime?.database})`);
  const lists = await Promise.all(['/api/tasks', '/api/approvals', '/api/apps'].map(async (p) => Array.isArray(await (await get(p)).json())));
  d.check(lists.every(Boolean), 'tasks, approvals and apps answer as lists');
  const [t] = await (await get('/api/tasks')).json();
  if (t) {
    const [detail, diff] = await Promise.all([get(`/api/tasks/${t.id}`), get(`/api/tasks/${t.id}/diff`)].map(async (r) => (await r).json()));
    d.check(detail.task?.id === t.id && Array.isArray(detail.events) && Array.isArray(diff.changes), 'a task window has its steps and its diff');
  }

  // The Activity app and the home screen follow the log over Server-Sent Events.
  const ac = new AbortController();
  const stream = await fetch(`${base}/api/log/stream?after=0`, { signal: ac.signal });
  const reader = stream.body!.getReader();
  const first = new TextDecoder().decode((await reader.read()).value);
  ac.abort();
  d.check(stream.headers.get('content-type')?.includes('text/event-stream') && /^id: \d+\ndata: \{/m.test(first), 'the action log streams over SSE, with each line\'s seq as its id');
};
