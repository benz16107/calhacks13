// Puts each Figma frame beside the real app and marks where they differ.
//   node docs/figma/compare/compare.ts              every pair in pairs.json
//   node docs/figma/compare/compare.ts --only tasks one pair
//   node docs/figma/compare/compare.ts --self-check compares a frame with itself, which must score 0
// It drives headless Chrome directly (no npm packages): CHROME=/path/to/chrome to pick one.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const here = path.dirname(new URL(import.meta.url).pathname);
const root = path.resolve(here, '../../..');
const pairs: { section: string; name: string; figma: string; app: string }[] = JSON.parse(fs.readFileSync(path.join(here, 'pairs.json'), 'utf8'));
const scoresFile = path.join(here, 'scores.json');
const scores: Record<string, number> = fs.existsSync(scoresFile) ? JSON.parse(fs.readFileSync(scoresFile, 'utf8')) : {};
const arg = (name: string) => { const i = process.argv.indexOf(name); return i < 0 ? undefined : process.argv[i + 1] ?? ''; };

function findChrome(): string {
  const which = (b: string) => { try { return execFileSync('which', [b], { encoding: 'utf8' }).trim(); } catch { return ''; } };
  const cache = path.join(os.homedir(), '.cache/ms-playwright');
  const shells = fs.existsSync(cache) ? fs.readdirSync(cache).filter((d) => d.startsWith('chromium_headless_shell-')).sort().reverse()
    .map((d) => path.join(cache, d, 'chrome-headless-shell-linux64/chrome-headless-shell')) : [];
  const found = [process.env.CHROME ?? '', ...['google-chrome', 'chromium', 'chromium-browser'].map(which),
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', ...shells].find((p) => p && fs.existsSync(p));
  if (!found) throw new Error('no Chrome found: set CHROME=/path/to/chrome');
  return found;
}
const chrome = findChrome();
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'gurt-compare-'));

// The page loads both images, compares them at the Figma frame's shape, draws three panels and prints the result.
const page = (figma: string, app: string, title: string, labels: [string, string]) => `<!doctype html><body>
<img id="a" src="data:image/png;base64,${fs.readFileSync(figma).toString('base64')}">
<img id="b" src="data:image/png;base64,${fs.readFileSync(app).toString('base64')}">
<pre id="score"></pre><pre id="out"></pre>
<script>
const a = document.getElementById('a'), b = document.getElementById('b');
// The work runs synchronously in the load event: Chrome's --dump-dom doesn't wait for promises like img.decode().
addEventListener('load', () => {
  const W = Math.min(a.naturalWidth, 640), H = Math.round(W * a.naturalHeight / a.naturalWidth);
  const px = (img) => { const c = new OffscreenCanvas(W, H), x = c.getContext('2d'); x.drawImage(img, 0, 0, W, H); return x.getImageData(0, 0, W, H); };
  const A = px(a), B = px(b), D = new ImageData(W, H);
  let differ = 0;
  for (let i = 0; i < A.data.length; i += 4) {
    const d = Math.max(Math.abs(A.data[i] - B.data[i]), Math.abs(A.data[i + 1] - B.data[i + 1]), Math.abs(A.data[i + 2] - B.data[i + 2]));
    const grey = 255 - (255 - (B.data[i] * 0.3 + B.data[i + 1] * 0.59 + B.data[i + 2] * 0.11)) * 0.35;
    if (d > 32) { differ++; D.data.set([214, 40, 57, 255], i); } else D.data.set([grey, grey, grey, 255], i);
  }
  const score = differ / (W * H);
  const P = a.naturalHeight > a.naturalWidth ? 390 : 512, gap = 24, top = 72;
  const hOf = (img) => Math.round(P * img.naturalHeight / img.naturalWidth);
  const ph = Math.max(hOf(a), hOf(b), Math.round(P * H / W));
  const c = document.createElement('canvas'); c.width = 3 * P + 4 * gap; c.height = top + ph + gap;
  const x = c.getContext('2d');
  x.fillStyle = '#ECEAE6'; x.fillRect(0, 0, c.width, c.height);
  x.fillStyle = '#1D2127'; x.font = 'bold 22px sans-serif'; x.fillText(${JSON.stringify(title)} + '   ' + (score * 100).toFixed(1) + '% of pixels differ', gap, 32);
  x.font = '15px sans-serif';
  const dc = new OffscreenCanvas(W, H); dc.getContext('2d').putImageData(D, 0, 0);
  [[a, ${JSON.stringify(labels[0])}], [b, ${JSON.stringify(labels[1])}], [dc, 'Where they differ (red)']].forEach(([img, label], i) => {
    const left = gap + i * (P + gap), h = img === dc ? Math.round(P * H / W) : hOf(img);
    x.fillStyle = '#4A505A'; x.fillText(label, left, 58);
    x.drawImage(img, left, top, P, h);
  });
  document.getElementById('score').textContent = String(score);
  document.getElementById('out').textContent = c.toDataURL('image/png');
});
</script></body>`;

function compare(figma: string, app: string, title: string, labels: [string, string]) {
  const html = path.join(profile, 'page.html');
  fs.writeFileSync(html, page(figma, app, title, labels));
  const dom = execFileSync(chrome, ['--headless', '--disable-gpu', '--no-first-run', '--no-default-browser-check', `--user-data-dir=${profile}`,
    '--virtual-time-budget=20000', '--dump-dom', `file://${html}`], { encoding: 'utf8', maxBuffer: 256 << 20, stdio: ['ignore', 'pipe', 'ignore'] });
  const score = Number(dom.match(/<pre id="score">([^<]*)</)?.[1]);
  const png = dom.match(/<pre id="out">data:image\/png;base64,([^<]*)</)?.[1];
  if (!png || Number.isNaN(score)) throw new Error(`Chrome returned no comparison for ${title}`);
  return { score, png: Buffer.from(png, 'base64') };
}

if (process.argv.includes('--self-check')) {
  const f = path.join(root, pairs[0].figma);
  const { score } = compare(f, f, 'self-check', ['Figma', 'Figma']);
  if (score !== 0) throw new Error(`a frame compared with itself scored ${score}, not 0`);
  console.log('self-check passed: a frame compared with itself scores 0');
  process.exit(0);
}

const only = arg('--only');
if (only !== undefined && !pairs.some((p) => p.name === only)) throw new Error(`no pair named "${only}" in pairs.json`);
for (const p of pairs) {
  if (only !== undefined && p.name !== only) continue;
  const out = path.join(here, `${p.name}.png`);
  if (!fs.existsSync(path.join(root, p.app))) { delete scores[p.name]; fs.rmSync(out, { force: true }); console.log(`${p.name}: not built yet`); continue; }
  const { score, png } = compare(path.join(root, p.figma), path.join(root, p.app), p.name, [`Figma: ${p.figma}`, `The app: ${p.app}`]);
  fs.writeFileSync(out, png);
  scores[p.name] = Math.round(score * 1000) / 10;
  console.log(`${p.name}: ${scores[p.name]}%`);
}
fs.writeFileSync(scoresFile, JSON.stringify(scores, null, 1) + '\n');
fs.rmSync(profile, { recursive: true, force: true });

// The README is regenerated from pairs.json and scores.json; edit the intro here, not in the README.
const rows: string[] = [];
let section = '';
for (const p of pairs) {
  if (p.section !== section) { section = p.section; rows.push('', `### ${section}`, '', '| Pair | Differ | Figma | The app |', '|---|---|---|---|'); }
  const built = p.name in scores;
  rows.push(`| ${built ? `[${p.name}](${p.name}.png)` : p.name} | ${built ? `${scores[p.name]}%` : 'not built yet'} | \`${p.figma}\` | \`${p.app}\` |`);
}
fs.writeFileSync(path.join(here, 'README.md'), `# The real app beside Figma

Each image here puts a Figma frame on the left, a screenshot of the real app in the middle, and a third panel that
marks in red every pixel where the two differ. They are made by \`compare.ts\` from the pairs in \`pairs.json\`.

## What the number means

Both pictures are scaled to the Figma frame's size, then compared pixel by pixel. A pixel counts as different when
any colour channel is more than 32 out of 255 apart. The number is the share of pixels that differ.

It is a quick way to spot a screen that drifted far from its design, or one that broke. It is not a grade. A high
number can be fine: the real app shows real data (other task names, other times, other amounts) where Figma shows
sample data, and a window that sits 10 pixels lower marks every edge in it. A low number does not prove the screen is
right either. Look at the image, not just the number.

Personal's screenshots are 1280 x 800 and its frames 1920 x 1080, so those are stretched to compare and score high.
"Not built yet" means the real screenshot is not in the repo yet: add it at the path in the table.

## Regenerate

\`\`\`
node docs/figma/compare/compare.ts              # every pair
node docs/figma/compare/compare.ts --only tasks # one pair
node docs/figma/compare/compare.ts --self-check # a frame against itself must score 0
\`\`\`

It needs Google Chrome or Chromium (\`CHROME=/path/to/chrome\` to pick one) and no npm packages. To compare a new
screen, add a line to \`pairs.json\`. When a design changes, export its frame over the PNG in \`docs/figma/\`; when the
app changes, retake its screenshot (below); then run the script again.

The real screenshots are taken by hand from a dev box: \`portal/dev-box.sh\` starts one on a test VM with scripted
tasks, and its screens are captured at 1920 x 1080 (desktop) and 390 x 844 at 2x (phone) into
\`portal/screenshots/\`. Personal's come from a GurtOS Personal test machine, into \`personal/screenshots/\`.
${rows.join('\n')}
`);
