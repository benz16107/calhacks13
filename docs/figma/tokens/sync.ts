// Keeps the kit's CSS tokens (portal/src/kit/kit.css) in step with the Figma variables (figma-variables.json).
//   node docs/figma/tokens/sync.ts --check      prints the drift and exits 1 when code differs from Figma
//   node docs/figma/tokens/sync.ts --css        writes docs/figma/tokens/tokens.css from Figma
//   node docs/figma/tokens/sync.ts --self-test  checks the colour parsing and comparison
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const here = import.meta.dirname;
const KIT = join(here, '../../../portal/src/kit/kit.css');
type Mode = 'Light' | 'Dark';
type Tok = { name: string; css: string; light: string | number; dark: string | number };

// shortcut: one Figma name the kit spells differently; add a line here if the portal renames another.
const CODE_NAME: Record<string, string> = { 'button/hover': '--color-button-bg-hover' };

/** `window/bg` -> `--color-window-bg`; `space/xs` -> `--space-xs`; `motion/duration-fast` -> `--duration-fast`. */
export function cssName(collection: string, name: string): string {
  if (CODE_NAME[name]) return CODE_NAME[name];
  const n = name.replace(/^motion\//, '').replaceAll('/', '-');
  return collection === 'GurtOS Color' ? `--color-${n}` : `--${n}`;
}

const unit = (name: string, v: string | number) =>
  typeof v !== 'number' ? v : /^motion\//.test(name) ? `${v}ms` : `${v}px`;

/** The GurtOS collections only: Color, Primitives and Size are the retired direction A. */
export function figmaTokens(json: any): Tok[] {
  const out: Tok[] = [];
  for (const [col, c] of Object.entries<any>(json.collections)) {
    if (!col.startsWith('GurtOS ')) continue;
    for (const [name, v] of Object.entries<any>(c.variables)) {
      const val = (m: string) => { const x = v.values[m] ?? v.values.Value; return x && typeof x === 'object' ? x.value : x; };
      out.push({ name, css: cssName(col, name), light: unit(name, val('Light')), dark: unit(name, val('Dark')) });
    }
  }
  return out;
}

/** Declarations in the first block that starts with `selector {`. Token blocks have no nested braces. */
export function block(css: string, selector: string): Record<string, string> {
  const at = css.indexOf(selector + ' {');
  if (at < 0) throw new Error(`kit.css has no "${selector} {" block`);
  const body = css.slice(at, css.indexOf('}', at));
  return Object.fromEntries([...body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
}

/** Any CSS colour we use, as [r, g, b, a] with a in 0..255; null when it isn't a colour. */
export function rgba(s: string): number[] | null {
  s = s.trim().toLowerCase();
  let m = s.match(/^#([0-9a-f]{3,8})$/);
  if (m) {
    let h = m[1];
    if (h.length <= 4) h = [...h].map((c) => c + c).join('');
    if (h.length === 6) h += 'ff';
    return h.length === 8 ? [0, 2, 4, 6].map((i) => parseInt(h.slice(i, i + 2), 16)) : null;
  }
  m = s.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/);
  if (!m) return null;
  const a = m[4] === undefined ? 1 : m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
  return [+m[1], +m[2], +m[3], Math.round(a * 255)];
}

/** Same token value: colours within 1 per channel (Figma rounds), numbers by value, other text by its words. */
export function same(figma: string | number, code: string): boolean {
  const a = rgba(String(figma)), b = rgba(code);
  if (a && b) return a.every((x, i) => Math.abs(x - b[i]) <= 1);
  if (typeof figma === 'number' || /^-?[\d.]+(px|ms)$/.test(String(figma))) return parseFloat(String(figma)) === parseFloat(code);
  return String(figma).replace(/\s+/g, ' ') === code.replace(/\s+/g, ' ');
}

const hex = (s: string | number) => { const c = rgba(String(s)); return c ? '#' + c.map((x, i) => (i === 3 && x === 255 ? '' : x.toString(16).padStart(2, '0'))).join('') : String(s); };

function check(toks: Tok[], css: string): number {
  const light = block(css, ':root'), dark = { ...light, ...block(css, "[data-theme='dark']") };
  const rows: string[][] = [];
  for (const t of toks) {
    for (const [mode, code, fig] of [['Light', light, t.light], ['Dark', dark, t.dark]] as [Mode, Record<string, string>, string | number][]) {
      if (mode === 'Dark' && t.light === t.dark && code[t.css] === light[t.css]) continue; // one row when both modes agree
      const label = t.light === t.dark ? 'both' : mode;
      if (code[t.css] === undefined) rows.push([t.css, label, hex(fig), '', 'missing in code']);
      else if (!same(fig, code[t.css])) rows.push([t.css, label, hex(fig), code[t.css], 'differs']);
    }
  }
  const known = new Set(toks.map((t) => t.css));
  const codeOnly = Object.keys(light).filter((k) => !known.has(k) && /^--(color|space|radius|size|duration|ease)/.test(k));
  const w = [0, 1, 2, 3, 4].map((i) => Math.max(...[['token', 'mode', 'Figma', 'code', ''], ...rows].map((r) => r[i].length)));
  for (const r of [['token', 'mode', 'Figma', 'code', 'drift'], ...rows]) console.log(r.map((c, i) => c.padEnd(w[i])).join('  '));
  console.log(`\n${rows.length} drift${rows.length === 1 ? '' : 's'} across ${toks.length} Figma tokens.`);
  if (codeOnly.length) console.log(`Code only (not in Figma, not a failure): ${codeOnly.join(' ')}`);
  return rows.length ? 1 : 0;
}

function writeCss(toks: Tok[]) {
  const decl = (pick: (t: Tok) => string | number, list: Tok[]) => list.map((t) => `  ${t.css}: ${hex(pick(t))};`).join('\n');
  const darkOnes = toks.filter((t) => t.light !== t.dark);
  const out = `/* Generated from Figma by docs/figma/tokens/sync.ts --css. Change the variable in Figma, export, regenerate. */
:root {
${decl((t) => t.light, toks)}
}
[data-theme='dark'] {
${decl((t) => t.dark, darkOnes)}
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme]) {
${decl((t) => t.dark, darkOnes).replaceAll('\n  ', '\n    ').replace(/^ {2}/, '    ')}
  }
}
`;
  writeFileSync(join(here, 'tokens.css'), out);
  console.log(`wrote docs/figma/tokens/tokens.css: ${toks.length} tokens, ${darkOnes.length} with a Dark value`);
}

function selfTest() {
  const eq = (a: unknown, b: unknown, what: string) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${what}: ${JSON.stringify(a)} != ${JSON.stringify(b)}`); };
  eq(rgba('#ABC'), [170, 187, 204, 255], '#RGB');
  eq(rgba('#F2EFE81F'), rgba('rgb(242 239 232 / 0.12)'), 'hex alpha vs rgb() alpha');
  eq(rgba('rgba(0, 0, 0, 55%)'), [0, 0, 0, 140], 'rgba() with a percent');
  eq(rgba('8px'), null, 'not a colour');
  eq(same('#FFFFFF', '#fff'), true, 'case and short hex');
  eq(same('#D9D6CF', '#d9d5ce'), true, 'within 1 of rounding');
  eq(same('#2F64A6', '#2f64a7') && !same('#2F64A6', '#2f64a9'), true, 'tolerance stops at 1');
  eq(same('6px', '6px') && !same('6px', '8px'), true, 'numbers');
  eq([cssName('GurtOS Color', 'window/bg'), cssName('GurtOS Size', 'space/xs'), cssName('GurtOS Size', 'motion/duration-fast')], ['--color-window-bg', '--space-xs', '--duration-fast'], 'names');
  eq(block(':root { --a: #fff; --b: 1px; }', ':root'), { '--a': '#fff', '--b': '1px' }, 'block');
  console.log('self-test passed');
}

const arg = process.argv[2];
if (arg === '--self-test') selfTest();
else {
  const toks = figmaTokens(JSON.parse(readFileSync(join(here, 'figma-variables.json'), 'utf8')));
  if (arg === '--css') writeCss(toks);
  else if (arg === '--check') process.exitCode = check(toks, readFileSync(KIT, 'utf8'));
  else console.log('usage: node docs/figma/tokens/sync.ts --check | --css | --self-test');
}
