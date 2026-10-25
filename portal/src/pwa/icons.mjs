// Renders icon.svg to the PNGs the manifest and iOS need, with headless Chromium. Run once after changing the SVG:
//   node portal/src/pwa/icons.mjs
// PLAYWRIGHT_CORE: the path to playwright-core's index.mjs if it is not installed where node can find it.
const { chromium } = await import(process.env.PLAYWRIGHT_CORE ?? 'playwright-core');
import fs from 'node:fs';
const dir = new URL('.', import.meta.url).pathname;
const svg = fs.readFileSync(dir + 'icon.svg', 'utf8');
const browser = await chromium.launch({ executablePath: process.env.CHROME ?? `${process.env.HOME}/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome` });
for (const size of [180, 192, 512]) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(`<body style="margin:0">${svg.replace('width="512" height="512"', `width="${size}" height="${size}"`)}</body>`);
  await page.screenshot({ path: `${dir}icon-${size}.png` });
}
await browser.close();
