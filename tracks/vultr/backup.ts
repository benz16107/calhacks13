// Encrypted backups of the box's state to Vultr Object Storage.
// The archive is a tar of BOX_HOME piped through `age` to the owner's public key. The box holds only the public
// half, so neither the box nor Vultr can read an archive; the owner's identity file (age-keygen) decrypts it.
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Box } from '../../core/contract.ts';
import { ensureBucket, list, putFile, remove, type S3Config } from './s3.ts';

export const HOME = process.env.BOX_HOME ?? '/var/lib/box';
const STATE = path.join(HOME, 'vultr');
export const KEEP = 14;

/** What stays out: the box's live socket and relay identity (a restored box makes its own), its CA key, and each
 * task's overlay mount points (their files are in `upper`). */
export const EXCLUDES = ['./api.sock', './api.port', './remote', './remote.json', './ca', './empty', './tasks/*/root', './tasks/*/work', './.before-restore-*'];

export const prefix = () => `backups/${process.env.BOX_ID ?? 'box'}/`;

export function s3Config(secret: (n: string) => string | undefined): S3Config {
  const need = (n: string) => secret(n) || (() => { throw new Error(`the vault has no ${n}`); })();
  return { host: secret('VULTR_OBJ_HOST') || 'sjc1.vultrobjects.com', bucket: secret('VULTR_OBJ_BUCKET') || 'gurtos-backups', access: need('VULTR_OBJ_ACCESS'), secret: need('VULTR_OBJ_SECRET') };
}

/** Task users' numeric ids, so a restore onto a fresh machine can give the same users the same ids and the
 * files in each task's folder stay theirs. */
function writeManifest() {
  fs.mkdirSync(STATE, { recursive: true });
  const users: Record<string, { uid: number; gid: number }> = {};
  const mine = new Set(fs.existsSync(path.join(HOME, 'tasks')) ? fs.readdirSync(path.join(HOME, 'tasks')) : []);
  for (const line of fs.readFileSync('/etc/passwd', 'utf8').split('\n')) {
    const [name, , uid, gid] = line.split(':');
    if (name?.startsWith('box-') && mine.has(name.slice(4)) && Number(uid) >= 30000 && Number(uid) < 40000) users[name] = { uid: Number(uid), gid: Number(gid) };
  }
  fs.writeFileSync(path.join(STATE, 'manifest.json'), JSON.stringify({ at: new Date().toISOString(), boxId: process.env.BOX_ID, users }, null, 2));
}

/** tar the box's state and encrypt it to `recipient`, into `out`. Resolves with the file's size. */
export function archive(recipient: string, out: string): Promise<number> {
  writeManifest();
  return new Promise((resolve, reject) => {
    const tar = spawn('tar', ['--numeric-owner', '--warning=no-file-changed', '--ignore-failed-read', ...EXCLUDES.map((e) => `--exclude=${e}`), '-C', HOME, '-cf', '-', '.'], { stdio: ['ignore', 'pipe', 'pipe'] });
    const age = spawn('age', ['-r', recipient, '-o', out], { stdio: ['pipe', 'ignore', 'pipe'] });
    tar.stdout.pipe(age.stdin);
    let err = '';
    for (const p of [tar, age]) p.stderr!.on('data', (d) => (err += d));
    let done = 0;
    let bad = '';
    const end = (who: string) => (code: number | null) => {
      // tar exits 1 when a file changed while it was read: the box is running, so that is expected.
      if (code !== 0 && !(who === 'tar' && code === 1)) bad ||= `${who} exited ${code}: ${err.slice(0, 300)}`;
      if (++done === 2) (bad ? reject(new Error(bad)) : resolve(fs.statSync(out).size));
    };
    tar.on('close', end('tar'));
    age.on('close', end('age'));
    tar.on('error', reject);
    age.on('error', (e) => reject(new Error(`age is not installed: ${e.message}`)));
  });
}

export interface Status {
  at: string;
  key: string;
  bytes: number;
  seconds: number;
}

/** One backup: archive, upload, keep the newest KEEP. */
export async function runBackup(box: Pick<Box, 'secret' | 'note'>): Promise<Status> {
  const cfg = s3Config((n) => { try { return box.secret(n); } catch { return undefined; } });
  const recipient = box.secret('BACKUP_AGE_RECIPIENT');
  if (!/^age1[a-z0-9]{50,}$/.test(recipient)) throw new Error('BACKUP_AGE_RECIPIENT is not an age public key (it starts with age1)');
  const t0 = Date.now();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gurt-backup-'));
  try {
    const file = path.join(dir, 'state.tar.age');
    const bytes = await archive(recipient, file);
    await ensureBucket(cfg);
    const key = `${prefix()}${new Date().toISOString().replace(/[-:]|\.\d{3}/g, '')}.tar.age`;
    await putFile(cfg, key, file);
    for (const old of (await list(cfg, prefix())).slice(0, -KEEP)) await remove(cfg, old.key);
    const status: Status = { at: new Date().toISOString(), key, bytes, seconds: Math.round((Date.now() - t0) / 100) / 10 };
    fs.writeFileSync(path.join(STATE, 'last.json'), JSON.stringify(status));
    box.note({ backup: { key, bytes } }); // sizes and a name, never contents
    return status;
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

export const lastBackup = (): Status | undefined => {
  try {
    return JSON.parse(fs.readFileSync(path.join(STATE, 'last.json'), 'utf8'));
  } catch {
    return undefined;
  }
};

export const haveAge = () => spawnSync('age', ['--version']).status === 0;
