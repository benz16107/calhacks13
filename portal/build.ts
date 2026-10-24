// Builds the portal into dist/, which the box serves: app.js, app.css, the fonts and index.html, and the kit for
// track apps: kit/gurtos.css, kit/gurtos.js and the style guide kit/index.html (portal/KIT.md).
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
// The demo step compares this with the sources, so a dist/ built from older code (or older bindings) fails it.
fs.writeFileSync(`${dir}dist/source.txt`, sourceHash() + '\n');

const ctx = await esbuild.context({
  entryPoints: { app: `${dir}src/main.tsx`, 'kit/gurtos': `${dir}src/kit/gurtos.ts` },
  bundle: true,
  outdir: `${dir}dist`,
  assetNames: 'assets/[name]-[hash]',
  format: 'esm',
  // The kiosk is WebKitGTK on Ubuntu 24.04; phones are Safari and Chrome.
  target: ['es2022', 'safari16'],
  jsx: 'automatic',
  jsxImportSource: 'preact',
  loader: { '.woff2': 'file', '.svg': 'file' },
  minify: !watch,
  logLevel: 'info',
});
if (watch) await ctx.watch();
else {
  await ctx.rebuild();
  await ctx.dispose();
}
