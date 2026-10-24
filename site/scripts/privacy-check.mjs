// Privacy scan of the built site (run after `npm run build`): every hit not on the allow-list of documentation
// examples. Exit 1 on any hit. Usage: node scripts/privacy-check.mjs dist
import fs from 'node:fs';
import path from 'node:path';
const root = process.argv[2];
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
const files = walk(root).filter((f) => /\.(html|txt|xml|json|svg|css|js|yaml)$/.test(f) && !f.includes('/pagefind/') && !/\/_astro\/.*\.js$/.test(f));
// Published release checksums and the release signing key's public fingerprint (the Download page): public on purpose.
const PUBLIC_SUMS = ['FWKFb1eAvEBmMhVJwMwTnLnhrmZ5yQZ5947pDvFKcpY', '1676fa7183f35b3ab7b5a9c695adb6d795efc0925aef32c314c884ba42d08c0a', '07e3daca006faf892b9a3c2574536303888f36dbf29f38c8651f6a195b712377', '0ba7ff5caa1bcc73073c94435131b48434a2128a46576320878ea77b2616bca3', '4d78deb9c879b9cc5325208d2e9e18c1d63e0620a7ebbbd2a559449ba8e7bbce', 'cef69ba2f14d5d0833ee6cf7349d412b730b80a284da5c9034159258d0228b3a'];
const checks = [
  ['machine name', /linuxbox|macserver|benmac|vultrbox|gx10|dellserver|estella/gi],
  ['tailnet', /tailb51682|\.ts\.net\b/gi],
  ['personal name', /\bBen\b|Ben Zhou|benz16107(?!\/calhacks13)|benzhou|thebenzhou/g],
  ['email', /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, (m) => /@example\.(com|org|net)$/.test(m)],
  ['jira site', /[a-z0-9-]+\.atlassian\.net/gi, (m) => /^(your-site|your-org|example)\.atlassian\.net$/i.test(m)],
  ['lima/sslip', /[\w.*-]*sslip\.io|lima\.internal|limactl/gi, (m) => m === '*.sslip.io'],
  ['ipv4', /(?<![\d.])(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})(?![\d.])/g, (m) => m.split('.').some((o) => +o > 255 || (o.length > 1 && o[0] === '0')) || /^(127\.0\.0\.1|0\.0\.0\.0|192\.0\.2\.\d+|198\.51\.100\.\d+|203\.0\.113\.\d+|1\.1\.1\.1|8\.8\.8\.8|10\.0\.0\.0|172\.16\.0\.0|192\.168\.0\.0|100\.64\.0\.0|169\.254\.0\.0)$/.test(m)],
  ['agentverse address', /agent1q[0-9a-z]{20,}/g],
  ['base58 key or address', /\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/g, (m) => !/[0-9]/.test(m) || /^[a-z]+$/i.test(m) || PUBLIC_SUMS.includes(m)],
  ['secret prefix', /sk_(live|test)_[A-Za-z0-9]{6,}|\bpi_[A-Za-z0-9]{12,}|\bre_[A-Za-z0-9]{12,}|AKIA[0-9A-Z]{12,}|ghp_[A-Za-z0-9]{10,}|xox[bp]-[A-Za-z0-9-]+|-----BEGIN [A-Z ]*PRIVATE/g],
  ['long hex', /\b[0-9a-f]{32,}\b/g, (m) => /^(0123456789abcdef)+$/.test(m) || PUBLIC_SUMS.includes(m)],
  ['uuid', /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi],
  ['event word', /hackathon|cal ?hacks|sponsor|devpost|demo moment/gi, (m, at) => /benz16107\/calhacks13|calhacks\.gurtos\.com/.test(at)],
  ['private link', /mana\.space|figma\.com|docs\.google|one-atlas/gi],
];
let hits = 0;
for (const f of files) {
  const text = fs.readFileSync(f, 'utf8');
  for (const [label, re, allowed] of checks) {
    for (const m of text.matchAll(re)) {
      const at = text.slice(Math.max(0, m.index - 50), m.index + m[0].length + 30).replace(/\s+/g, ' ');
      if (allowed?.(m[0], at)) continue;
      console.log(`${label}: ${path.relative(root, f)}: ${m[0]}  …${at}…`);
      hits++;
    }
  }
}
console.log(hits ? `${hits} hits` : 'privacy scan clean', `(${files.length} files)`);
process.exit(hits ? 1 : 0);
