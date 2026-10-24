// Prints every track page's frontmatter as JSON (bible.py reads it). Usage: node frontmatter.mjs <repo root>
import fs from 'node:fs'; import { createRequire } from 'node:module';
const root = (await import('node:path')).resolve(process.argv[2]);
const require = createRequire(root + '/showcase/package.json'); const YAML = require('yaml');
const dir = root + '/showcase/src/content/tracks'; const out = {};
for (const f of fs.readdirSync(dir)) { const s = fs.readFileSync(`${dir}/${f}`, 'utf8'); out[f.replace('.mdx','')] = YAML.parse(s.split('---')[1]); }
process.stdout.write(JSON.stringify(out));
