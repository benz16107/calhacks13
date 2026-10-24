// Privacy scan of the built showcase (run after `npm run build`). Exit 1 on any hit.
// Public sponsor links (Jira site, Mana, Figma, Agentverse, Solana devnet) are allowed here; machine names,
// tailnet names, IP addresses, emails, keys and local paths are not. Images are checked by eye, not here.
// Usage: node scripts/privacy-check.mjs dist
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const root = process.argv[2] ?? 'dist';
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
const files = walk(root).filter((f) => /\.(html|txt|xml|json|svg|css|js|mjs|webmanifest)$/.test(f));

// Public, on purpose: the agent wallet, the test API's payee and Circle's devnet USDC mint.
const PUBLIC_BASE58 = new Set([
  '6PyiR71c9aw3e8bgnxmcLvJECL5zHE5jMSWqJoVjPTxU',
  '39w7W3SBxE62zsS7VQY5dgZQXGWko2EkBXMfHg2sLtKV',
  '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
]);
// Public on purpose: the release signing key's fingerprint, and the SHA-256 of each published disc (read from
// src/data/downloads.ts, so only the checksums the release thread filed in are allowed).
const SIGNING_FINGERPRINT = 'FWKFb1eAvEBmMhVJwMwTnLnhrmZ5yQZ5947pDvFKcpY';
const RELEASE_SHA256 = new Set(
  [...fs.readFileSync(path.join(path.dirname(new URL(import.meta.url).pathname), '../src/data/downloads.ts'), 'utf8').matchAll(/sha256: '([0-9a-f]{64})'/g)].map((m) => m[1]),
);
const before = (text, i, n = 60) => text.slice(Math.max(0, i - n), i);

const checks = [
  ['tailnet', /\.ts\.net\b|tailscale funnel/gi],
  ['jira site', /[a-z0-9-]+\.atlassian\.net/gi, (m) => /^(your-site|your-org|example)\.atlassian\.net$/i.test(m)],
  ['email', /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, (m) => /@example\.(com|org|net)$/.test(m) || /@\d+x\./.test(m) || /@(fontsource|astrojs)\//.test(m)],
  ['sslip or lima', /sslip\.io|lima\.internal|limactl|\.lima\b/gi],
  ['ipv4', /(?<![\d.\w])(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})(?![\d.])/g, (m) => m.split('.').some((o) => +o > 255) || /^(127\.0\.0\.1|0\.0\.0\.0|192\.0\.2\.\d+|198\.51\.100\.\d+|203\.0\.113\.\d+|1\.1\.1\.1)$/.test(m)],
  ['dashed ipv4', /\b\d{1,3}-\d{1,3}-\d{1,3}-\d{1,3}\b/g],
  ['local path', /\/home\/ben|\/Users\/[a-z]|\.config\/calhacks13|~\/\.config/gi],
  ['secret prefix', /sk_(live|test)_[A-Za-z0-9]{6,}|\bpi_[A-Za-z0-9]{12,}|\bre_[A-Za-z0-9]{12,}|AKIA[0-9A-Z]{12,}|ghp_[A-Za-z0-9]{10,}|xox[bp]-[A-Za-z0-9-]+|apify_api_[A-Za-z0-9]+|-----BEGIN [A-Z ]*PRIVATE/g],
  ['key assignment', /\b[A-Z][A-Z0-9_]*(KEY|TOKEN|SECRET|PASSWORD)=[^\s'"<]{6,}/g, (m) => /=(\.\.\.|<|sk_test_\.\.\.|apify_api_\.\.\.)/.test(m)],
  ['elastic or kibana host', /[a-z0-9-]+\.(es|kb)\.[a-z0-9.-]+\.(elastic-cloud\.com|elastic\.cloud|cloud\.es\.io)|elastic-cloud\.com/gi],
  ['base58 key', /\b[1-9A-HJ-NP-Za-km-z]{32,90}\b/g, (m, text, i) => !/[0-9]/.test(m) || /^[a-z]+$/i.test(m) || PUBLIC_BASE58.has(m) || m === SIGNING_FINGERPRINT || /explorer\.solana\.com\/(tx|address)\/$/.test(before(text, i, 40))],
  ['long hex', /\b[0-9a-f]{40,}\b/g, (m) => RELEASE_SHA256.has(m)],
  ['uuid', /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi],
];

// Machine names and other private words live outside git (the repo is public), one regex per line.
const privateFile = path.join(os.homedir(), '.config/calhacks13/private-names');
if (fs.existsSync(privateFile)) {
  const words = fs.readFileSync(privateFile, 'utf8').split('\n').filter((l) => l.trim() && !l.startsWith('#'));
  checks.push(['private name', new RegExp(words.join('|'), 'gi')]);
} else console.log(`warning: ${privateFile} not found, so machine names are not checked`);

let hits = 0;
for (const f of files) {
  const text = fs.readFileSync(f, 'utf8');
  for (const [label, re, allowed] of checks) {
    for (const m of text.matchAll(re)) {
      if (allowed?.(m[0], text, m.index)) continue;
      const at = text.slice(Math.max(0, m.index - 50), m.index + m[0].length + 30).replace(/\s+/g, ' ');
      console.log(`${label}: ${path.relative(root, f)}: ${m[0]}  ...${at}...`);
      hits++;
    }
  }
}
console.log(hits ? `${hits} hits` : 'privacy scan clean', `(${files.length} files)`);
process.exit(hits ? 1 : 0);
