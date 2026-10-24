// Builds the portal into dist/, which the box serves: app.js, app.css, the fonts and index.html.
//   npm run build          once
//   npm run dev            rebuild on every change
// dist/ is committed, so a box or a test VM serves it with no build step.
import * as esbuild from 'esbuild';
import fs from 'node:fs';
import { sourceHash } from './source-hash.ts';

const dir = new URL('.', import.meta.url).pathname;
const watch = process.argv.includes('--watch');
fs.rmSync(`${dir}dist`, { recursive: true, force: true });
fs.mkdirSync(`${dir}dist`);
fs.copyFileSync(`${dir}src/index.html`, `${dir}dist/index.html`);
// The demo step compares this with the sources, so a dist/ built from older code (or older bindings) fails it.
fs.writeFileSync(`${dir}dist/source.txt`, sourceHash() + '\n');

const ctx = await esbuild.context({
  entryPoints: { app: `${dir}src/main.tsx` },
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
