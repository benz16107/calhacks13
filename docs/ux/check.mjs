// UX check for the GurtOS web surfaces (box screen, portal, phone, Business, setup, pairing).
// Walks every scene, screenshots it, and checks contrast and names (axe-core), text cut off or off screen,
// tap targets under 44 px on phone, spinners, em dashes, the word "box" in visible text, and console errors.
//   NODE_PATH=<dir with playwright> AXE=<path to axe.min.js> node docs/ux/check.mjs [--only <substring>] [--out <dir>]
//   SRV=http://127.0.0.1:7781 BIZ=http://127.0.0.1:7782   two dev boxes (portal/dev-box.sh; DEV_SEED=business for BIZ)
//   SETUP=1   also reopen setup on SRV and walk every step (it finishes setup again at the end)
// Writes <out>/<scene>.png and <out>/report.json, and prints one line per scene. Exit 1 if any P0 check fails.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const arg = (n) => { const i = process.argv.indexOf(n); return i < 0 ? undefined : process.argv[i + 1]; };
const out = arg('--out') ?? path.join(path.dirname(new URL(import.meta.url).pathname), 'shots/web');
const only = arg('--only');
const SRV = process.env.SRV ?? 'http://127.0.0.1:7781';
const BIZ = process.env.BIZ ?? 'http://127.0.0.1:7782';
const axePath = process.env.AXE ?? (() => { try { return require.resolve('axe-core/axe.min.js'); } catch { return ''; } })();
const axe = axePath && fs.existsSync(axePath) ? fs.readFileSync(axePath, 'utf8') : '';
fs.mkdirSync(out, { recursive: true });

const DESK = { width: 1920, height: 1080 }, KIOSK = { width: 1280, height: 800 }, PHONE = { width: 390, height: 844 };
const OFFBOX = { 'x-forwarded-for': '203.0.113.9' }; // what a phone's request through a proxy looks like

async function pairToken(base, person) {
  const start = await fetch(`${base}/api/${person ? `people/${person}/pair` : 'pair/start'}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: person ? '{}' : '{"owner":true}' }).then((r) => r.json());
  const p = await fetch(`${base}/api/pair`, { method: 'POST', headers: { 'content-type': 'application/json', ...OFFBOX }, body: JSON.stringify({ code: start.code, name: person ? `${person}'s iPhone` : 'Ben\'s iPhone' }) }).then((r) => r.json());
  if (!p.token) throw new Error(`pairing failed: ${JSON.stringify(p)}`);
  return p;
}
const firstTask = async (base, state) => (await fetch(`${base}/api/tasks`).then((r) => r.json())).find((t) => !state || t.state === state)?.id;
const click = (sel) => async (pg) => { await pg.locator(sel).first().click({ timeout: 4000 }); await pg.waitForTimeout(500); };

// One scene: where, how big, as whom, and what to do before the screenshot.
const scenes = [];
const S = (name, o) => scenes.push({ name, base: SRV, path: '/screen', vp: DESK, ...o });
// Server: the box screen
S('srv-desktop', {});
S('srv-desktop-dark', { dark: true });
S('srv-notifications', { act: click('[aria-label$="Notifications"]') });
S('srv-control-center', { act: click('[aria-label="System menu"]') });
S('srv-menu', { act: click('[aria-label="GurtOS menu"]') });
S('srv-show-apps', { act: click('[aria-label="Show apps"]') });
S('srv-lock', { act: async (pg) => { await click('[aria-label="System menu"]')(pg); await click('[aria-label="Lock screen"]')(pg); } });
for (const r of ['tasks', 'tasks/running', 'tasks/waiting', 'activity', 'time-machine', 'app-center'])
  S(`srv-${r.replace('/', '-')}`, { hash: r });
S('srv-app-live', { hash: 'app/spacetime/live' });
S('srv-app-find', { hash: 'app/find/find' });
S('srv-app-apify', { hash: 'app/apify/apify' });
S('srv-app-apify-dark', { hash: 'app/apify/apify', dark: true });
S('srv-app-factory', { hash: 'app/factory/factory' });
S('srv-tasks-dark', { hash: 'tasks', dark: true });
for (const st of ['running', 'waiting', 'done', 'failed', 'undone']) S(`srv-task-${st}`, { hash: async () => `task/${await firstTask(SRV, st)}` });
for (const p of ['general', 'agents', 'permissions', 'keys', 'apps', 'devices', 'remote', 'updates', 'privacy', 'appearance', 'about'])
  S(`srv-settings-${p}`, { hash: `settings/${p}` });
S('srv-settings-permissions-dark', { hash: 'settings/permissions', dark: true });
S('kiosk-desktop', { vp: KIOSK });
S('kiosk-task', { vp: KIOSK, hash: async () => `task/${await firstTask(SRV, 'waiting')}` });
S('kiosk-settings-devices', { vp: KIOSK, hash: 'settings/devices' });
// The portal in a laptop browser, and the phone
S('portal-unpaired', { path: '/', headers: OFFBOX });
S('portal-paired', { path: '/', pair: 'owner', headers: OFFBOX });
S('phone-unpaired', { path: '/', vp: PHONE, headers: OFFBOX, mobile: true });
S('phone-home', { path: '/', vp: PHONE, pair: 'owner', headers: OFFBOX, mobile: true });
S('phone-home-dark', { path: '/', vp: PHONE, pair: 'owner', headers: OFFBOX, mobile: true, dark: true });
S('phone-tasks', { path: '/', vp: PHONE, pair: 'owner', headers: OFFBOX, mobile: true, hash: 'tasks' });
S('phone-task-waiting', { path: '/', vp: PHONE, pair: 'owner', headers: OFFBOX, mobile: true, hash: async () => `task/${await firstTask(SRV, 'waiting')}` });
S('phone-task-done', { path: '/', vp: PHONE, pair: 'owner', headers: OFFBOX, mobile: true, hash: async () => `task/${await firstTask(SRV, 'done')}` });
S('phone-activity', { path: '/', vp: PHONE, pair: 'owner', headers: OFFBOX, mobile: true, hash: 'activity' });
S('phone-settings', { path: '/', vp: PHONE, pair: 'owner', headers: OFFBOX, mobile: true, hash: 'settings' });
S('phone-settings-remote', { path: '/', vp: PHONE, pair: 'owner', headers: OFFBOX, mobile: true, hash: 'settings/remote' });
S('phone-machines', { path: '/', vp: PHONE, pair: 'owner', headers: OFFBOX, mobile: true, act: click('.gos-home-box') });
S('hosted-pair', { path: '/pair?hosted', vp: PHONE, headers: OFFBOX, mobile: true });
// Business: the box screen signed in as each person, and the phones
const B = (name, o) => S(name, { base: BIZ, ...o });
for (const who of ['rosa', 'sam', 'priya', 'owen']) B(`biz-desktop-${who}`, { person: who });
B('biz-waiting-rosa', { person: 'rosa', hash: 'waiting' });
B('biz-people-priya', { person: 'priya', hash: 'settings/people' });
B('biz-rules-priya', { person: 'priya', hash: 'settings/rules' });
B('biz-kill-switch-priya', { person: 'priya', hash: 'settings/kill-switch' });
B('biz-audit-owen', { person: 'owen', hash: 'audit' });
B('biz-audit-owen-dark', { person: 'owen', hash: 'audit', dark: true });
B('biz-phone-rosa', { path: '/', vp: PHONE, pair: 'rosa', headers: OFFBOX, mobile: true });
B('biz-phone-rosa-waiting', { path: '/', vp: PHONE, pair: 'rosa', headers: OFFBOX, mobile: true, hash: 'waiting' });
B('biz-phone-sam', { path: '/', vp: PHONE, pair: 'sam', headers: OFFBOX, mobile: true });
B('biz-phone-owen-audit', { path: '/', vp: PHONE, pair: 'owen', headers: OFFBOX, mobile: true, hash: 'audit' });
B('biz-phone-priya-kill', { path: '/', vp: PHONE, pair: 'priya', headers: OFFBOX, mobile: true, hash: 'settings/kill-switch' });

// The live hosted app and a live remote address (unpaired, read-only): LIVE=1
if (process.env.LIVE) {
  S('live-app-gurtos', { base: 'https://app.gurtos.com', path: '/', vp: PHONE, mobile: true });
  S('live-app-gurtos-desktop', { base: 'https://app.gurtos.com', path: '/', vp: DESK });
  S('live-remote-address', { base: 'https://gurt-cloud.box.gurtos.com', path: '/', vp: PHONE, mobile: true });
  S('live-remote-laptop', { base: 'https://gurt-laptop.box.gurtos.com', path: '/', vp: DESK });
}

// Checks that run in the page. Each returns a list of short problems with an example.
function pageChecks({ phoneVp }) {
  const vis = (e) => { const r = e.getBoundingClientRect(), s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && +s.opacity !== 0; };
  const label = (e) => (e.getAttribute('aria-label') || e.textContent || e.getAttribute('title') || '').trim().replace(/\s+/g, ' ').slice(0, 50);
  const res = { emDash: [], boxWord: [], tap: [], clipped: [], offscreen: [], spinner: [], hscroll: false };
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n; (n = walker.nextNode()); ) {
    const t = n.textContent.trim(), el = n.parentElement;
    if (!t || !el || !vis(el) || el.closest('script,style,code,pre,[aria-hidden="true"]')) continue;
    if (/[—–]/.test(t)) res.emDash.push(t.slice(0, 70));
    if (/\bbox(es)?\b/i.test(t) && !/\bdev box\b/i.test(t)) res.boxWord.push(t.slice(0, 70));
  }
  for (const e of document.querySelectorAll('[aria-label],[title],[placeholder]')) {
    const t = [e.getAttribute('aria-label'), e.getAttribute('title'), e.getAttribute('placeholder')].join(' ');
    if (/\bbox(es)?\b/i.test(t) && !/\bdev box\b/i.test(t)) res.boxWord.push(`[label] ${t.trim().slice(0, 70)}`);
    if (/[—–]/.test(t)) res.emDash.push(`[label] ${t.trim().slice(0, 70)}`);
  }
  for (const e of document.querySelectorAll('button,a[href],input,select,textarea,[role=button],[role=tab],[role=switch],[role=menuitem]')) {
    if (!vis(e)) continue;
    const r = e.getBoundingClientRect();
    if (phoneVp && (r.width < 44 || r.height < 44) && !(e.tagName === 'A' && e.closest('p,li'))) res.tap.push(`${Math.round(r.width)}x${Math.round(r.height)} ${label(e)}`);
  }
  for (const e of document.querySelectorAll('body *')) {
    if (!vis(e) || !e.childNodes.length) continue;
    const s = getComputedStyle(e), r = e.getBoundingClientRect();
    const hasText = [...e.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim());
    if (hasText && (s.overflowX === 'hidden' || s.overflow === 'hidden') && e.scrollWidth > e.clientWidth + 1 && s.textOverflow !== 'ellipsis') res.clipped.push(label(e));
    if (hasText && (r.right > innerWidth + 1 || r.left < -1) && !e.closest('[aria-hidden="true"],.g-sr-only')) res.offscreen.push(label(e));
    if (/spin|rotate/i.test(s.animationName) || /\bspinner\b|\bloader\b/i.test(e.className?.baseVal ?? e.className)) res.spinner.push(e.className?.baseVal ?? e.className);
  }
  res.hscroll = document.scrollingElement.scrollWidth > innerWidth + 1;
  for (const k of Object.keys(res)) if (Array.isArray(res[k])) res[k] = [...new Set(res[k])].slice(0, 12);
  return res;
}

// CHROME picks a browser; else the newest Playwright headless shell in the cache, whatever this Playwright expects.
const cache = path.join(process.env.HOME, '.cache/ms-playwright');
const shell = fs.existsSync(cache) ? fs.readdirSync(cache).filter((d) => d.startsWith('chromium_headless_shell-')).sort().reverse().map((d) => path.join(cache, d, 'chrome-headless-shell-linux64/chrome-headless-shell')).find((f) => fs.existsSync(f)) : undefined;
const browser = await chromium.launch({ executablePath: process.env.CHROME ?? shell });
const report = [];
let p0 = 0;
if (process.env.SETUP) await walkSetup();
for (const sc of scenes) {
  if (only && !sc.name.includes(only)) continue;
  const ctx = await browser.newContext({ bypassCSP: true, viewport: sc.vp, deviceScaleFactor: 1, colorScheme: sc.dark ? 'dark' : 'light', hasTouch: !!sc.mobile, isMobile: !!sc.mobile, extraHTTPHeaders: sc.headers ?? {} });
  const pg = await ctx.newPage();
  const errors = [];
  // SpacetimeDB's port is not forwarded from the test VM (on linuxbox 3000 is another service): ignore that socket.
  pg.on('console', (m) => m.type() === 'error' && !/WebSocket connection to 'ws:\/\/127\.0\.0\.1:3000/.test(m.text()) && errors.push(m.text().slice(0, 120)));
  pg.on('pageerror', (e) => errors.push(`pageerror: ${e.message.slice(0, 120)}`));
  pg.on('requestfailed', (r) => errors.push(`failed: ${r.url().replace(sc.base, '')}`));
  try {
    let init = '';
    if (sc.pair) { const p = await pairToken(sc.base, sc.pair === 'owner' ? undefined : sc.pair); init += `localStorage.setItem('pairing', ${JSON.stringify(JSON.stringify({ token: p.token, device: p.device, box: p.box }))});`; }
    if (sc.person) init += `localStorage.setItem('gurtos.person', '${sc.person}');`;
    if (init) await pg.addInitScript(`if (!sessionStorage.getItem('ux-init')) { sessionStorage.setItem('ux-init', 1); ${init} }`);
    const hash = typeof sc.hash === 'function' ? await sc.hash() : sc.hash;
    await pg.goto(`${sc.base}${sc.path}${hash ? `#${hash}` : ''}`, { waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
    await pg.waitForTimeout(1500);
    if (sc.act) await sc.act(pg).catch((e) => errors.push(`act: ${e.message.split('\n')[0].slice(0, 100)}`));
    await pg.screenshot({ path: path.join(out, `${sc.name}.png`) });
    const own = await pg.evaluate(pageChecks, { phoneVp: sc.vp.width < 700 });
    let a11y = [];
    if (axe) {
      await pg.addScriptTag({ content: axe });
      a11y = await pg.evaluate(async () => ((r) => [...r.violations, ...r.incomplete.filter((v) => v.id === 'color-contrast').map((v) => ({ ...v, id: 'contrast-unsure' }))])(await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa'] })).map((v) => ({ id: v.id, n: v.nodes.length, ex: v.nodes.slice(0, 3).map((n) => n.target.join(' ').slice(0, 60) + (n.any[0]?.data?.contrastRatio ? ` ${n.any[0].data.contrastRatio}:1 ${n.any[0].data.fgColor}/${n.any[0].data.bgColor}` : '')) })));
    }
    const contrast = await measureContrast(pg);
    const r = { scene: sc.name, errors: [...new Set(errors)].slice(0, 8), ...own, contrast, a11y: a11y.filter((v) => v.id !== 'contrast-unsure') };
    const bad = r.hscroll || r.offscreen.length || r.errors.some((e) => e.startsWith('pageerror'));
    if (bad) p0++;
    report.push(r);
    console.log(`${bad ? 'FAIL' : 'ok  '} ${sc.name.padEnd(30)} lowcontrast:${contrast.length} a11y:${r.a11y.map((v) => `${v.id}(${v.n})`).join(',') || '-'} tap:${own.tap.length} clip:${own.clipped.length} off:${own.offscreen.length} spin:${own.spinner.length} emdash:${own.emDash.length} box:${own.boxWord.length} err:${r.errors.length}`);
  } catch (e) {
    console.log(`ERR  ${sc.name}: ${e.message.split('\n')[0]}`);
    report.push({ scene: sc.name, crash: e.message.split('\n')[0] });
  }
  await ctx.close();
}
fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 1));
await browser.close();
process.exit(p0 ? 1 : 0);

// Contrast measured on pixels, because axe can't see through glass and blur: screenshot the page with all text
// hidden, read the background under each text run there, and compare with the text's own color (WCAG 2 ratio).
async function measureContrast(pg) {
  const runs = await pg.evaluate(() => {
    const out = [];
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n; (n = w.nextNode()); ) {
      const el = n.parentElement, t = n.textContent.trim();
      if (!t || !el || el.closest('[aria-hidden="true"],svg,canvas,img')) continue;
      const s = getComputedStyle(el);
      if (s.visibility === 'hidden' || +s.opacity === 0) continue;
      const rg = document.createRange(); rg.selectNodeContents(n);
      const r = rg.getBoundingClientRect();
      if (r.width < 2 || r.height < 2 || r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) continue;
      // Only text that is on top where it is drawn: not under a window, a sheet or the lock screen.
      const hit = document.elementFromPoint(Math.min(innerWidth - 1, r.left + r.width / 2), Math.min(innerHeight - 1, r.top + r.height / 2));
      if (!hit || !(hit === el || el.contains(hit) || hit.contains(el))) continue;
      const big = parseFloat(s.fontSize) >= 24 || (parseFloat(s.fontSize) >= 18.66 && +s.fontWeight >= 700);
      out.push({ t: t.slice(0, 40), color: s.color, op: [...function* () { for (let e = el; e; e = e.parentElement) yield +getComputedStyle(e).opacity; }()].reduce((a, b) => a * b, 1), big, r: [r.left, r.top, r.width, r.height], dis: !!el.closest(':disabled,[aria-disabled="true"]') });
    }
    return out;
  });
  if (!runs.length) return [];
  await pg.addStyleTag({ content: '*,*::before,*::after{color:transparent!important;text-shadow:none!important;caret-color:transparent!important;-webkit-text-fill-color:transparent!important}', }).then((h) => pg.evaluate((e) => (e.id = 'ux-hide'), h));
  await pg.waitForTimeout(150);
  const png = (await pg.screenshot()).toString('base64');
  await pg.evaluate(() => document.getElementById('ux-hide')?.remove());
  return pg.evaluate(async ({ png, runs }) => {
    const img = new Image(); img.src = `data:image/png;base64,${png}`; await img.decode();
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const g = c.getContext('2d'); g.drawImage(img, 0, 0);
    const lin = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    const L = ([r, gg, b]) => 0.2126 * lin(r) + 0.7152 * lin(gg) + 0.0722 * lin(b);
    const bad = [];
    for (const u of runs) {
      if (u.dis) continue;
      const [x, y, w, h] = u.r, px = [];
      for (let i = 1; i < 6; i++) for (let j = 1; j < 4; j++) {
        const X = Math.min(c.width - 1, Math.max(0, Math.round(x + (w * i) / 6))), Y = Math.min(c.height - 1, Math.max(0, Math.round(y + (h * j) / 4)));
        px.push([...g.getImageData(X, Y, 1, 1).data].slice(0, 3));
      }
      px.sort((a, b) => L(a) - L(b));
      const m = u.color.match(/[\d.]+/g).map(Number), a = (m[3] ?? 1) * u.op;
      // The worst background under the run: the lightest pixel for dark text, the darkest for light text.
      let worst = 99, wbg;
      for (const bg of [px[0], px[px.length - 1]]) {
        const fg = [0, 1, 2].map((k) => m[k] * a + bg[k] * (1 - a));
        const [hi, lo] = [L(fg), L(bg)].sort((p, q) => q - p);
        const ratio = (hi + 0.05) / (lo + 0.05);
        if (ratio < worst) (worst = ratio), (wbg = bg);
      }
      const need = u.big ? 3 : 4.5;
      if (worst < need) bad.push(`${worst.toFixed(2)}:1 (needs ${need}) "${u.t}" ${u.color} on rgb(${wbg.join(',')})`);
    }
    return [...new Set(bad)].slice(0, 15);
  }, { png, runs });
}

// Setup: reopen it on SRV, then screenshot every step with Next, and Finish at the end.
async function walkSetup() {
  await fetch(`${SRV}/api/setup/reopen`, { method: 'POST' });
  for (const [vp, tag] of [[DESK, 'setup'], [KIOSK, 'setup-kiosk']]) {
    const ctx = await browser.newContext({ viewport: vp });
    const pg = await ctx.newPage();
    await pg.goto(`${SRV}/screen`, { waitUntil: 'networkidle' });
    await pg.waitForTimeout(1500);
    for (let i = 1; i <= 14; i++) {
      await pg.screenshot({ path: path.join(out, `${tag}-${String(i).padStart(2, '0')}.png`) });
      const own = await pg.evaluate(pageChecks, { phoneVp: false });
      report.push({ scene: `${tag}-${i}`, ...own });
      console.log(`${tag}-${i}: emdash:${own.emDash.length} box:${own.boxWord.length} clip:${own.clipped.length} off:${own.offscreen.length} ${own.boxWord.slice(0, 2).join(' | ')}`);
      const next = pg.getByRole('button', { name: /^(Next|Skip|Continue)$/ }).last();
      if (!(await next.count()) || i === 14) break;
      await next.click().catch(() => {});
      await pg.waitForTimeout(900);
    }
    await ctx.close();
  }
  await fetch(`${SRV}/api/setup/finish`, { method: 'POST' });
}
