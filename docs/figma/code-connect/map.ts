// Reads the url/source/component header of every Code Connect template and writes map.json: Figma node id, the
// code component, its file and line, and the one-line usage example. The Figma-side step (component
// descriptions and links, apply-to-figma.js) reads map.json. Run: node docs/figma/code-connect/map.ts
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';

const here = new URL('./', import.meta.url).pathname;
const root = new URL('../../../', import.meta.url).pathname;
const REPO = 'https://github.com/benz16107/gurtos/blob/main/';

const walk = (d: string): string[] => readdirSync(d).flatMap((f) => (statSync(d + f).isDirectory() ? walk(d + f + '/') : f.endsWith('.figma.ts') ? [d + f] : []));
const lineOf = (file: string, name: string) => {
  const src = readFileSync(root + file, 'utf8').split('\n');
  const at = src.findIndex((l) => new RegExp(`(function|const|interface) ${name.replace('.', '\\.')}\\b|class="${name}`).test(l));
  return at < 0 ? 0 : at + 1;
};
const rows = walk(here + 'templates/').map((f) => {
  const t = readFileSync(f, 'utf8');
  const get = (k: string) => t.match(new RegExp(`^// ${k}=(.*)$`, 'm'))?.[1] ?? '';
  const node = get('url').split('node-id=')[1].replace('-', ':');
  const source = get('source'), component = get('component');
  const line = component.startsWith('g-') || component.includes('.') ? 0 : lineOf(source, component);
  const example = get('example') || (t.match(/figma\.tsx`([^`$\n]*)`/)?.[1] ?? '');
  return { node, component, source, link: REPO + source + (line ? `#L${line}` : ''), template: f.slice(here.length), example };
});
writeFileSync(here + 'map.json', JSON.stringify(rows, null, 1) + '\n');
const missing = rows.filter((r) => !r.link.includes('#L') && !r.component.startsWith('g-') && !r.component.includes('.'));
console.log(`${rows.length} mappings; ${missing.length} without a line: ${missing.map((r) => r.component).join(', ') || 'none'}`);
if (rows.some((r) => !/^\d+:\d+$/.test(r.node))) { console.error('a template has a bad url'); process.exit(1); }
