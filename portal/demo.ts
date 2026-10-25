// The portal's step in ./demo. The test VM has no browser, so this is a smoke test of what the browser needs: the box
// serves the built portal, its files and the kit for track apps, client routes load the app, every API the portal
// reads answers (including the live log stream), and the setup wizard's round trip works with keys kept write-only
// and changes kept to the owner. Screenshots of the real app running are in portal/README.md.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import type { DemoKit } from '../core/contract.ts';
import { sourceHash } from './source-hash.ts';
import { PRODUCT } from './src/product.ts';

export default async (d: DemoKit) => {
  const built = fs.readFileSync(new URL('./dist/source.txt', import.meta.url), 'utf8').trim();
  d.check(built === sourceHash(), 'portal/dist is built from the current portal/src and SpacetimeDB bindings (if not: cd portal && npm ci && npm run build)');

  // The kit's tokens are the Figma variables (docs/figma/tokens): a value changed on one side only fails here.
  const drift = spawnSync(process.execPath, [...process.execArgv, new URL('../docs/figma/tokens/sync.ts', import.meta.url).pathname, '--check'], { encoding: 'utf8' });
  d.check(drift.status === 0, `the kit's tokens match the Figma variables${drift.status ? `: ${drift.stdout.trim().split('\n').slice(1, -2).join('; ')}` : ''}`);

  // Quick Start: the phone opens what the new computer seals to it (core/quickstart.ts, once core has it).
  const quickstart = new URL('../core/quickstart.ts', import.meta.url);
  if (fs.existsSync(quickstart)) {
    const core = await import(quickstart.href);
    const { openSealed, phoneKey } = await import('./src/apps/qs-crypto.ts');
    const me = await phoneKey();
    const s = core.keyPair().pk.slice(0, 22); // any 128-bit base64url secret
    const sealed = core.seal(me.pk, s, { host: 'demo.box.gurtos.com', code: 'a2201f2f' });
    const got = await openSealed<{ host: string; code: string }>(me.privateKey, s, sealed);
    const wrong = await openSealed(me.privateKey, 'A'.repeat(22), sealed).then(() => false, () => true);
    d.check(got.host === 'demo.box.gurtos.com' && got.code === 'a2201f2f' && wrong, "Quick Start: the phone opens the new computer's sealed address and owner code with WebCrypto, and a wrong secret opens nothing");
  }

  const base = `http://127.0.0.1:${fs.readFileSync(path.join(d.home, 'api.port'), 'utf8').trim()}`;
  const get = (p: string, accept = '*/*') => fetch(base + p, { headers: { accept } });

  const page = await get('/', 'text/html');
  const html = await page.text();
  d.check(page.ok && html.includes('/app.js') && html.includes(`<title>${PRODUCT}</title>`), `the box serves ${PRODUCT} at / on the same address as its API`);
  const js = await get('/app.js');
  const size = (await js.text()).length;
  d.check(js.ok && js.headers.get('content-type')?.includes('javascript') && size > 50_000, `its script loads (${Math.round(size / 1024)} KB with the SpacetimeDB client)`);
  const css = await (await get('/app.css')).text();
  const files = [...new Set([...css.matchAll(/url\("?\.?\/?(assets\/[^)"]+)"?\)/g)].map((m) => m[1]))];
  const found = await Promise.all(files.map((f) => get('/' + f).then((r) => r.ok)));
  d.check(files.length >= 6 && found.every(Boolean), `its ${files.length} font and wallpaper files come from the box, so the screen needs no internet`);
  const kit = await Promise.all(['/kit/gurtos.css', '/kit/gurtos.js', '/kit/index.html'].map((p) => get(p)));
  const kitCss = await kit[0].text();
  d.check(
    kit.every((r) => r.ok) && kit[0].headers.get('content-type')?.includes('css') && kitCss.includes('--color-accent-bg') && kitCss.includes('.g-switch'),
    'the kit for track apps is served at /kit/gurtos.css and /kit/gurtos.js, with its style guide at /kit/index.html',
  );
  const manifest = await (await get('/manifest.webmanifest')).json().catch(() => ({}));
  const pwa = await Promise.all(['/sw.js', ...(manifest.icons ?? []).map((i: { src: string }) => i.src), '/icon-180.png'].map((p) => get(p).then((r) => r.ok)));
  d.check(manifest.name === PRODUCT && manifest.display === 'standalone' && manifest.icons?.length >= 3 && pwa.every(Boolean), `the box serves it as an installable app: manifest, ${manifest.icons?.length ?? 0} icons, an iOS icon and the service worker`);
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

  await setupFlow(d, base);
};

/** What the setup wizard and Settings do, through the same API calls, then back to how the box was. */
async function setupFlow(d: DemoKit, base: string) {
  const call = async (method: string, p: string, body?: unknown, token?: string) => {
    const r = await fetch(base + '/api' + p, {
      method,
      // The phone's calls come through a proxy, as from a phone on the tailnet: from the box itself, any call is the owner's.
      headers: { ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...(token ? { authorization: `Bearer ${token}`, 'x-forwarded-for': '192.0.2.10' } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: r.status, body: await r.json().catch(() => ({})) };
  };
  const before = (await call('GET', '/setup')).body;
  const settings = (await call('GET', '/settings')).body;
  d.check(typeof before.done === 'boolean' && Array.isArray(before.suggested) && typeof settings.approvalThresholdCents === 'number', 'GET /api/setup and /api/settings give the wizard its state');

  const reopened = (await call('POST', '/setup/reopen')).body;
  d.check(reopened.done === false, 'Run setup again: the box screen shows the wizard (setup is not done)');
  const step = (await call('POST', '/setup/step', { id: 'welcome', data: { language: 'en', keyboard: 'us' } })).body;
  d.check(step.steps?.welcome?.data?.language === 'en', 'a wizard step is recorded with its answers');
  const big = await call('POST', '/setup/step', { id: 'name', data: { note: 'x'.repeat(5000) } });
  d.check(big.status === 400, 'a step with more than 4 KB of answers is refused');

  const patched = (await call('PATCH', '/settings', { approvalThresholdCents: 2500, quietHours: { enabled: true, from: '22:00', to: '07:00' } })).body;
  d.check(patched.approvalThresholdCents === 2500 && patched.quietHours?.enabled === true && patched.quietHours.from === '22:00', 'the Permissions step changes settings with PATCH /api/settings');
  const bad = await call('PATCH', '/settings', { approvalThresholdCents: -5 });
  d.check(bad.status === 400 && /approvalThresholdCents/.test(bad.body.error ?? ''), 'a bad value is refused and the error names the field');
  await call('PATCH', '/settings', { approvalThresholdCents: settings.approvalThresholdCents, quietHours: settings.quietHours });

  const secret = `portal-demo-${Math.random().toString(36).slice(2)}`;
  const put = await call('PUT', '/vault/PORTAL_DEMO_KEY', { value: secret });
  const vault = await call('GET', '/vault');
  const apps = await call('GET', '/apps?all=1');
  d.check(
    put.status < 300 && JSON.stringify(vault.body).includes('PORTAL_DEMO_KEY') && !JSON.stringify([put.body, vault.body, apps.body]).includes(secret),
    'a key set in the Keys step is listed by name, and no answer ever carries its value',
  );
  d.check(Array.isArray(apps.body) && apps.body.every((a: { access?: { secrets?: unknown[] } }) => (a.access?.secrets ?? []).every((x) => ['name,set', 'name,optional,set'].includes(Object.keys(x as object).sort().join()) && (x as { optional?: unknown }).optional !== false)), 'App Center sees each key an app needs as a name, whether it is set, and whether it is optional');

  // A phone paired the ordinary way may answer requests, but not change setup, settings or keys.
  const code = (await call('POST', '/pair/start')).body.code;
  const phone = (await call('POST', '/pair', { code, name: 'demo phone' })).body;
  const tries = await Promise.all([
    call('PATCH', '/settings', { approvalThresholdCents: 1 }, phone.token),
    call('GET', '/vault', undefined, phone.token),
    call('PUT', '/vault/PORTAL_DEMO_KEY', { value: 'x' }, phone.token),
    call('POST', '/setup/finish', undefined, phone.token),
  ]);
  d.check(phone.token && tries.every((t) => t.status === 403), `a paired phone that is not the owner gets 403 for settings, keys and setup (${tries.map((t) => t.status).join(' ')})`);
  const gone = await call('DELETE', `/devices/${phone.device?.id}`);
  d.check(gone.status < 300, 'Settings, Devices: Revoke removes that phone');

  const done = (await call('POST', '/setup/finish')).body;
  d.check(done.done === true && done.steps?.welcome, `Start using ${PRODUCT}: setup is done and the desktop shows`);

  // The flight recorder: a finished task replays in order, with its block, its request and who answered, its spending
  // so far, and (where this computer records them) the files as they were at each point.
  const { replayPoints, nextInteresting, filesAt } = await import('./src/apps/replay-model.ts');
  const made = await call('POST', '/tasks', {
    title: 'Write the trip plan',
    worker: 'fake',
    source: 'portal-demo',
    tools: ['example.spend'],
    budgetCents: 500,
    prompt: ['write plan.md first draft', 'fetch https://blocked.example/upload out.txt', 'ask Publish the plan to the family calendar?', 'call example.spend {"cents":120,"on":"a test print"}', 'write plan.md final plan', 'say Wrote plan.md'].join('\n'),
  });
  let task: { state: string; costCents: number } | undefined;
  let events: any[] = [];
  for (let n = 0; n < 60 && !['done', 'failed'].includes(task?.state ?? ''); n++) {
    await new Promise((r) => setTimeout(r, 500));
    const got = (await call('GET', `/tasks/${made.body.id}`)).body;
    task = got.task;
    events = got.events ?? [];
    for (const a of got.approvals ?? []) if (a.state === 'pending') await call('POST', `/approvals/${encodeURIComponent(a.id)}`, { approved: true, by: 'portal demo' });
  }
  const points = replayPoints(events);
  const kinds = points.map((x) => x.kind);
  const ordered = points.every((x, j) => !j || points[j - 1].seq < x.seq);
  const costs = points.map((x) => x.costCents);
  const firstMatter = points[nextInteresting(points, 0)]?.kind;
  d.check(
    task?.state === 'done' && ordered && ['start', 'blocked', 'ask', 'approved', 'spend', 'done'].every((k) => kinds.includes(k as never)) && firstMatter === 'blocked' && costs.every((c, j) => !j || c >= costs[j - 1]) && costs.at(-1) === task.costCents,
    `Replay: a finished task plays back in order as ${points.length} points (${[...new Set(kinds)].join(', ')}); Next event jumps to the block first; spending so far climbs to the task's ${task?.costCents ?? 0} cents`,
  );
  const rec = await call('GET', `/tasks/${made.body.id}/replay`);
  if (rec.status === 200) {
    const firstWrite = points.find((x) => x.kind === 'step' && /first draft/.test((x.event as { text: string }).text));
    const at = firstWrite && filesAt(rec.body.points.map((x: { seq: number }) => x.seq), firstWrite.seq);
    const then = at === undefined ? undefined : (await call('GET', `/tasks/${made.body.id}/diff?at=${at}`)).body;
    const now = (await call('GET', `/tasks/${made.body.id}/diff`)).body;
    d.check(/first draft/.test(then?.diff ?? '') && !/final plan/.test(then?.diff ?? '') && /final plan/.test(now.diff), 'Replay: at the first write, plan.md reads "first draft"; at the end it reads "final plan"');
  }
  const appJs = await (await fetch(base + '/app.js')).text();
  d.check(appJs.includes('Replay: ') && appJs.includes('Next event'), 'The Replay window is in the app: a timeline, play, step and Next event, from the Task window and the Tasks menu');

  if (!before.done) await call('POST', '/setup/reopen'); // leave the box as it was
}