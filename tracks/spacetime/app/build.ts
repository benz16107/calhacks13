// Build the Live window into live.js (committed, so the box needs no build step):
//   node tracks/spacetime/app/build.ts
// It runs esbuild from npx, so the box's own install never pulls a bundler.
import { execFileSync } from 'node:child_process';

const here = new URL('.', import.meta.url).pathname;
execFileSync('npx', ['--yes', 'esbuild@0.28.2', `${here}main.ts`, '--bundle', '--format=esm', '--minify', '--target=es2022', `--outfile=${here}live.js`, '--legal-comments=none'], { stdio: 'inherit' });
