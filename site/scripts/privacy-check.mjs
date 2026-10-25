// Privacy scan of the built site (run after `npm run build`): every hit not on the allow-list of documentation
// examples. Exit 1 on any hit. Usage: node scripts/privacy-check.mjs dist
import fs from 'node:fs';
import path from 'node:path';
const root = process.argv[2];
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
const files = walk(root).filter((f) => /\.(html|txt|xml|json|svg|css|js|yaml)$/.test(f) && !f.includes('/pagefind/') && !/\/_astro\/.*\.js$/.test(f));
// Published release checksums and the release signing key's public fingerprint (the Download page): public on purpose.
const PUBLIC_SUMS = ['FWKFb1eAvEBmMhVJwMwTnLnhrmZ5yQZ5947pDvFKcpY', 'a0e679ad64e81fc20d2c8b6f106096d56f1a247f4591c811f14f58865ccfe69a', '02b91a1ebf75a57143bada5fd8de992cc1ede752438812f993789cafbcf39ef5', '677894c059475db164f33774ee2490bb48648fb1339eb171caab1db0024ccb6f', '4575187509be5c2d8e9cf770f05080764f9357de66a5f519056d70d99d6f8165', 'cef69ba2f14d5d0833ee6cf7349d412b730b80a284da5c9034159258d0228b3a', 'ef8a7e72441b10dc3d6bacd1308d670cb551ffd8644403429b57e1d733ae994b'];
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
  const text = fs.readFileSync(f, 'utf8').replace(/data:font\/woff2;base64,[A-Za-z0-9+\/=]+/g, 'data:font');
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
