// Check every internal link and anchor in the built site. Exit 1 on any broken one. Usage: node scripts/link-check.mjs dist
import fs from 'node:fs';
import path from 'node:path';
const root = process.argv[2];
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
const pages = walk(root).filter((f) => f.endsWith('.html'));
const ids = new Map();
for (const f of pages) ids.set(f, new Set([...fs.readFileSync(f, 'utf8').matchAll(/\sid="([^"]+)"/g)].map((m) => m[1])));
const bad = new Set();
for (const f of pages) {
  const html = fs.readFileSync(f, 'utf8');
  for (const [, href] of html.matchAll(/\shref="([^"]+)"/g)) {
    if (/^(https?:|mailto:|#$|data:)/.test(href) || href.startsWith('//')) continue;
    const [p, hash] = href.split('#');
    let target = p ? path.join(p.startsWith('/') ? root : path.dirname(f), p) : f;
    if (fs.existsSync(target) && fs.statSync(target).isDirectory()) target = path.join(target, 'index.html');
    if (!fs.existsSync(target)) { bad.add(`${path.relative(root, f)} -> ${href} (missing)`); continue; }
    if (hash && target.endsWith('.html') && !ids.get(target)?.has(decodeURIComponent(hash))) bad.add(`${path.relative(root, f)} -> ${href} (no anchor)`);
  }
}
console.log([...bad].join('\n') || 'all internal links resolve', `(${pages.length} pages)`);
process.exit(bad.size ? 1 : 0);
