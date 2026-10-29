// Public-readiness scan of the committed tree: private details that should not be in main's files, plus a
// gitleaks pass for secrets. Exit 1 on any hit.   node release/check.ts [--list]
// --list prints only the count per file. History is not scanned here; release/audit.md covers it.
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';

const DOC_IPS = /^(127\.\d+\.\d+\.\d+|0\.0\.0\.0|1\.1\.1\.1|127\.0\.0\.53|8\.8\.8\.8|169\.254\.169\.254|192\.0\.2\.\d+|198\.51\.100\.\d+|203\.0\.113\.\d+|(10|192\.168|172\.(1[6-9]|2\d|3[01]))\.[\d.]+)$/;
const checks: [string, RegExp, ((m: string) => boolean)?][] = [
  ['machine name', /\b(linuxbox|macserver|benmac|vultrbox|personalbox|dellserver|gx10-\w+)\b/gi],
  ['tailnet', /tailb51682|\b[\w-]+\.ts\.net\b/gi],
  ['public tunnel host', /[\w-]+\.sslip\.io/gi],
  ['jira site', /\b[a-z0-9-]+\.atlassian\.net\b/gi, (m) => /^(your-site|your-org|example|api|x)\.atlassian\.net$/i.test(m)],
  ['email', /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, (m) => /@(([\w-]+\.)*example\.(com|org|net)|[\w.-]+\.(example|exam|test|invalid)|users\.noreply\.github\.com|anthropic\.com|gurtos\.dev|ubuntu\.com|evil\.com)$/i.test(m) || /@[\w.-]+\.(service|target|socket|slice|mount)$/.test(m) || /^(git|noreply)@/.test(m) || /\.(png|svg|jpg|webp|js|ts)$/.test(m)],
  ['home folder', /\/home\/ben\b|\/Users\/ben\w*/g],
  ['ipv4', /(?<![\d.])\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(?![\d./])/g, (m) => m.split('.').some((o) => +o > 255) || DOC_IPS.test(m) || /^(24\.04|1\.5\.75)\./.test(m)],
  ['cgnat or tailnet ip', /(?<![\d.])100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.\d{1,3}\.\d{1,3}(?![\d./])/g],
  // A uuid on a line about a cloud instance or ISO; other uuids (record ids in sample data) are fine.
  ['cloud instance id', /^.*(instance|vultr|\biso\b).*$/gim, (m) => !/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i.test(m)],
  ['private key', /-----BEGIN [A-Z ]*PRIVATE KEY-----/g],
];
// Files that hold these patterns on purpose, or ids that are public by design.
const skip = (f: string) =>
  f === 'release/check.ts' || f === 'package-lock.json' || f.endsWith('/package-lock.json') ||
  /(^|\/)scripts\/privacy-check\.mjs$/.test(f) || f.startsWith('portal/dist/') && f.endsWith('.map');
const allowUuidIn = /^(tracks\/jira\/forge\/manifest\.yml|core\/spacetime\/)/;

const files = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter((f) => f && !skip(f) && fs.existsSync(f));
const perFile = new Map<string, number>();
let hits = 0;
for (const f of files) {
  const buf = fs.readFileSync(f);
  if (buf.includes(0)) continue; // binary
  const text = buf.toString('utf8');
  for (const [label, re, allowed] of checks) {
    if (label === 'cloud instance id' && allowUuidIn.test(f)) continue;
    for (const m of text.matchAll(re)) {
      if (allowed?.(m[0])) continue;
      hits++;
      perFile.set(f, (perFile.get(f) ?? 0) + 1);
      if (!process.argv.includes('--list')) {
        const line = text.slice(0, m.index).split('\n').length;
        console.log(`${f}:${line}: ${label}: ${m[0]}`);
      }
    }
  }
}
if (process.argv.includes('--list')) for (const [f, n] of [...perFile].sort((a, b) => b[1] - a[1])) console.log(`${String(n).padStart(4)}  ${f}`);

// Secrets in the tree. gitleaks is optional here; release/audit.md records the full-history run.
const gl = spawnSync('gitleaks', ['dir', '.', '--no-banner', '--redact', '--exit-code', '3', '-l', 'error'], { stdio: 'inherit' });
const leaks = gl.status === 3;
if (gl.error) console.log('gitleaks not installed: secrets not scanned');

console.log(hits || leaks ? `${hits} private details in ${perFile.size} files${leaks ? ', and gitleaks found secrets' : ''}` : `clean (${files.length} files)`);
process.exit(hits || leaks ? 1 : 0);
