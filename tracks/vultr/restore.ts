#!/usr/bin/env -S node --experimental-strip-types --disable-warning=ExperimentalWarning
// Restore a backup onto a fresh box and let its tasks resume. Run as root on the new machine, with the box
// installed (a GurtOS disc, or core/install.sh).
//   vultr-restore --identity ~/gurtos-backup.key --box-id <old box id> [--object backups/<id>/<time>.tar.age]
// Reads VULTR_OBJ_ACCESS, VULTR_OBJ_SECRET and optionally VULTR_OBJ_HOST and VULTR_OBJ_BUCKET from the environment.
// The identity file never leaves the owner's hands: this decrypts on the new box, in a pipe, and writes only the tar's contents.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { getFile, list } from './s3.ts';

const { values: a } = parseArgs({ options: { identity: { type: 'string' }, 'box-id': { type: 'string' }, object: { type: 'string' }, 'no-service': { type: 'boolean' } } });
const HOME = process.env.BOX_HOME ?? '/var/lib/box';
const sh = (cmd: string, ...args: string[]) => {
  const r = spawnSync(cmd, args, { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(' ')}: ${r.stderr.trim() || r.status}`);
  return r.stdout.trim();
};

if (!a.identity || (!a['box-id'] && !a.object)) {
  console.error('usage: vultr-restore --identity <age identity file> (--box-id <id> | --object <key>) [--no-service]');
  process.exit(2);
}
const cfg = {
  host: process.env.VULTR_OBJ_HOST || 'sjc1.vultrobjects.com',
  bucket: process.env.VULTR_OBJ_BUCKET || 'gurtos-backups',
  access: process.env.VULTR_OBJ_ACCESS ?? '',
  secret: process.env.VULTR_OBJ_SECRET ?? '',
};
if (!cfg.access || !cfg.secret) throw new Error('set VULTR_OBJ_ACCESS and VULTR_OBJ_SECRET');

const t0 = Date.now();
const key = a.object ?? (await list(cfg, `backups/${a['box-id']}/`)).at(-1)?.key;
if (!key) throw new Error(`no backups for box ${a['box-id']}`);
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gurt-restore-'));
const file = path.join(dir, 'state.tar.age');
try {
  await getFile(cfg, key, file);
  console.log(`downloaded ${key} (${fs.statSync(file).size} bytes)`);

  // --no-service: restore into BOX_HOME only, and leave starting a box on it to the caller (tests, a second box).
  const hasUnit = !a['no-service'] && spawnSync('systemctl', ['cat', 'box.service']).status === 0;
  if (hasUnit) sh('systemctl', 'stop', 'box.service');
  // Overlay mounts under the old folder would make the move fail or follow into live data.
  spawnSync('bash', ['-c', `findmnt -rn -o TARGET | grep '^${HOME}/' | sort -r | xargs -r -n1 umount -l`]);
  // The old state moves into a folder inside BOX_HOME, not beside it: on an installed box BOX_HOME is a mount point.
  const aside = path.join(HOME, `.before-restore-${new Date().toISOString().replace(/[-:]|\.\d{3}/g, '')}`);
  fs.mkdirSync(aside, { recursive: true, mode: 0o700 });
  fs.chmodSync(HOME, 0o711);
  for (const e of fs.readdirSync(HOME)) if (!e.startsWith('.before-restore-')) fs.renameSync(path.join(HOME, e), path.join(aside, e));
  sh('bash', '-c', `age -d -i '${a.identity}' '${file}' | tar --numeric-owner -xpf - -C '${HOME}'`);

  // Task users get their old ids back, so each task's files are still theirs.
  const manifest = JSON.parse(fs.readFileSync(path.join(HOME, 'vultr', 'manifest.json'), 'utf8')) as { users: Record<string, { uid: number; gid: number }> };
  for (const [name, { uid, gid }] of Object.entries(manifest.users)) {
    if (spawnSync('id', [name]).status === 0) continue;
    spawnSync('groupadd', ['-g', String(gid), name]);
    sh('useradd', '--system', '-u', String(uid), '-g', String(gid), '--no-create-home', '--home-dir', path.join(HOME, 'tasks', name.slice(4), 'home'), '--shell', '/usr/sbin/nologin', name);
  }
  console.log(`restored ${Object.keys(manifest.users).length} task users; the old folder is kept at ${aside}`);
  if (hasUnit) sh('systemctl', 'start', 'box.service');

  if (a['no-service']) process.exit(0);
  // The box answers when the tasks it resumed are back in its list.
  for (let i = 0; i < 60; i++) {
    const port = fs.existsSync(path.join(HOME, 'api.port')) ? fs.readFileSync(path.join(HOME, 'api.port'), 'utf8').trim() : '7700';
    const h = await fetch(`http://127.0.0.1:${port}/api/health`).then((r) => r.json()).catch(() => undefined);
    if (h?.ok) {
      console.log(`box is up in ${Math.round((Date.now() - t0) / 100) / 10} s: ${h.tasks} tasks, resumed ${h.resumed?.length ?? 0}`);
      process.exit(0);
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error('the box did not come back; the old folder is at ' + aside);
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
