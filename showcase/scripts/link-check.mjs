// Link check of the built showcase. Every internal link and anchor must resolve; with --external, every
// outside link is fetched too (a sign-in page counts as reachable). Usage: node scripts/link-check.mjs dist [--external]
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.argv[2] ?? 'dist';
const external = process.argv.includes('--external');
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
const pages = walk(root).filter((f) => f.endsWith('.html'));
const ids = new Map(pages.map((f) => [f, new Set([...fs.readFileSync(f, 'utf8').matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]))]));

const target = (from, href) => {
  const [p] = href.split('#');
  const abs = p.startsWith('/') ? path.join(root, p) : path.join(path.dirname(from), p);
  if (!p) return from;
  if (fs.existsSync(abs) && fs.statSync(abs).isFile()) return abs;
  const idx = path.join(abs, 'index.html');
  return fs.existsSync(idx) ? idx : null;
};

let bad = 0;
const outside = new Map();
for (const f of pages) {
  const html = fs.readFileSync(f, 'utf8');
  for (const [, href] of html.matchAll(/\s(?:href|src)="([^"]+)"/g)) {
    if (/^(mailto:|data:|javascript:)/.test(href)) continue;
    if (/^https?:\/\//.test(href)) {
      if (!outside.has(href)) outside.set(href, path.relative(root, f));
      continue;
    }
    const t = target(f, href);
    const hash = href.split('#')[1];
    if (!t) { console.log(`missing: ${path.relative(root, f)} -> ${href}`); bad++; }
    else if (hash && t.endsWith('.html') && !ids.get(t)?.has(decodeURIComponent(hash))) { console.log(`no anchor: ${path.relative(root, f)} -> ${href}`); bad++; }
  }
}

if (external) {
  // Links into this repo are checked against origin/main with git, so they pass while the repo is private.
  const REPO = /^https:\/\/github\.com\/benz16107\/calhacks13\/(?:blob|tree)\/main\/([^#?]+)/;
  for (const [u, page] of outside) {
    const m = u.match(REPO);
    if (!m) continue;
    try { execFileSync('git', ['cat-file', '-e', `origin/main:${decodeURIComponent(m[1]).replace(/\/$/, '')}`], { stdio: 'ignore' }); }
    catch { console.log(`not in the repo: ${u} (on ${page})`); bad++; }
  }
  const list = [...outside.keys()].filter((u) => !u.startsWith('https://calhacks.gurtos.com') && !REPO.test(u));
  await Promise.all(list.map(async (u) => {
    try {
      const r = await fetch(u, { redirect: 'follow', signal: AbortSignal.timeout(15000), headers: { 'user-agent': 'Mozilla/5.0 link-check' } });
      if (r.status >= 400 && ![401, 403, 429].includes(r.status)) { console.log(`external ${r.status}: ${u} (on ${outside.get(u)})`); bad++; }
    } catch (e) { console.log(`external error: ${u} (${e.message}) (on ${outside.get(u)})`); bad++; }
  }));
  console.log(`${list.length} outside links fetched`);
}
console.log(bad ? `${bad} broken links` : 'links ok', `(${pages.length} pages)`);
process.exit(bad ? 1 : 0);
