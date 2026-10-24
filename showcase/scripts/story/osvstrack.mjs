// Prints { slug: [rows] } for every track page that uses <OSvsTrack rows={[...]} />, so bible.py can write the
// "what comes from the OS and what from the sponsor" table for pages that no longer have a markdown table.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = join(process.argv[2] ?? '.', 'showcase/src/content/tracks');
const out = {};
for (const f of readdirSync(dir).filter((x) => x.endsWith('.mdx'))) {
  const src = readFileSync(join(dir, f), 'utf8');
  const at = src.indexOf('<OSvsTrack');
  if (at < 0) continue;
  const start = src.indexOf('rows={', at);
  if (start < 0) continue;
  let i = src.indexOf('[', start);
  const from = i;
  let depth = 0;
  let quote = '';
  for (; i < src.length; i++) {
    const c = src[i];
    if (quote) {
      if (c === '\\') i++;
      else if (c === quote) quote = '';
    } else if (c === "'" || c === '"' || c === '`') quote = c;
    else if (c === '[') depth++;
    else if (c === ']' && --depth === 0) break;
  }
  out[f.replace(/\.mdx$/, '')] = new Function(`return ${src.slice(from, i + 1)}`)();
}
console.log(JSON.stringify(out));
