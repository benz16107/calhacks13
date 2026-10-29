// Builds the portal into dist/, which the box serves: app.js, app.css, the fonts and index.html, the kit for
// track apps (kit/gurtos.css, kit/gurtos.js and the style guide kit/index.html, see portal/KIT.md), and what makes it
// an installable app: manifest.webmanifest, its icons and the service worker sw.js.
//   npm run build          once
//   npm run dev            rebuild on every change
// dist/ is committed, so a box or a test VM serves it with no build step.
import * as esbuild from 'esbuild';
import fs from 'node:fs';
import { sourceHash } from './source-hash.ts';
import { PRODUCT } from './src/product.ts';

const dir = new URL('.', import.meta.url).pathname;
const watch = process.argv.includes('--watch');
fs.rmSync(`${dir}dist`, { recursive: true, force: true });
fs.mkdirSync(`${dir}dist`);
fs.writeFileSync(`${dir}dist/index.html`, fs.readFileSync(`${dir}src/index.html`, 'utf8').replaceAll('%PRODUCT%', PRODUCT));
fs.mkdirSync(`${dir}dist/kit`);
fs.writeFileSync(`${dir}dist/kit/index.html`, fs.readFileSync(`${dir}src/kit/index.html`, 'utf8').replaceAll('%PRODUCT%', PRODUCT));
// The installable app: name, colors and icons. The icons are drawn in src/pwa/icon.svg (node src/pwa/icons.mjs).
for (const size of [180, 192, 512]) fs.copyFileSync(`${dir}src/pwa/icon-${size}.png`, `${dir}dist/icon-${size}.png`);
fs.writeFileSync(
  `${dir}dist/manifest.webmanifest`,
  JSON.stringify(
    {
      name: PRODUCT,
      short_name: PRODUCT,
      description: 'Approve what your AI agents ask, follow their tasks and undo any one.',
      id: '/',
      start_url: '/',
      scope: '/',
      display: 'standalone',
      background_color: '#27313f', // the desktop's night sky, for the splash screen
      theme_color: '#f6f5f2', // the window background in Light; index.html has the Dark one
      icons: [
        { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
        { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    null,
    2,
  ) + '\n',
);
// The demo step compares this with the sources, so a dist/ built from older code (or older bindings) fails it.
fs.writeFileSync(`${dir}dist/source.txt`, sourceHash() + '\n');

const ctx = await esbuild.context({
  entryPoints: { app: `${dir}src/main.tsx`, 'kit/gurtos': `${dir}src/kit/gurtos.ts` },
  bundle: true,
  outdir: `${dir}dist`,
  assetNames: 'assets/[name]-[hash]',
  // Absolute asset URLs: the kit's script runs on track pages under /t/<track>/, where a relative path would miss.
  publicPath: '/',
  format: 'esm',
  // The kiosk is WebKitGTK on Ubuntu 24.04; phones are Safari and Chrome.
  target: ['es2022', 'safari16'],
  jsx: 'automatic',
  jsxImportSource: 'preact',
  loader: { '.woff2': 'file', '.svg': 'file' },
  minify: !watch,
  logLevel: 'info',
});
// The service worker is a classic script at the site root, so its scope is the whole app.
const sw = await esbuild.context({ entryPoints: { sw: `${dir}src/pwa/sw.ts` }, bundle: true, outdir: `${dir}dist`, format: 'iife', target: ['es2022', 'safari16'], minify: !watch, logLevel: 'info' });
if (watch) await Promise.all([ctx.watch(), sw.watch()]);
else {
  await Promise.all([ctx.rebuild(), sw.rebuild()]);
  await Promise.all([ctx.dispose(), sw.dispose()]);
}
