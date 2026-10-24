// The backup round trip against a local Object Storage stand-in: encrypted on the way up, unreadable without the
// owner's identity, readable with it, and old backups pruned.
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fakeS3 } from './fakes3.ts';
import { getFile, list } from './s3.ts';

const home = fs.mkdtempSync(path.join(os.tmpdir(), 'vultr-test-'));
process.env.BOX_HOME = home;
process.env.BOX_ID = 'testbox';
const { runBackup, s3Config, prefix, KEEP } = await import('./backup.ts');
const haveAge = spawnSync('age-keygen', ['--version']).status === 0;

test('backup is encrypted to the owner, restorable, and pruned', { skip: !haveAge && 'age is not installed' }, async () => {
  const idFile = path.join(home, 'identity.key');
  const keygen = spawnSync('age-keygen', ['-o', idFile], { encoding: 'utf8' });
  const recipient = keygen.stderr.match(/(age1\w+)/)![1];
  fs.writeFileSync(path.join(home, 'log.jsonl'), '{"type":"canary","text":"SECRET-TASK-TEXT"}\n');
  fs.mkdirSync(path.join(home, 'workspaces/home'), { recursive: true });
  fs.writeFileSync(path.join(home, 'workspaces/home/notes.txt'), 'workspace file');
  fs.mkdirSync(path.join(home, 'remote'));
  fs.writeFileSync(path.join(home, 'remote.json'), 'RELAY-IDENTITY');

  const s3 = await fakeS3('AKTEST');
  const vault: Record<string, string> = { VULTR_OBJ_ACCESS: 'AKTEST', VULTR_OBJ_SECRET: 'shh', VULTR_OBJ_HOST: s3.url, BACKUP_AGE_RECIPIENT: recipient };
  const box = { secret: (n: string) => { if (!(n in vault)) throw new Error('no ' + n); return vault[n]; }, note: () => {} };
  try {
    const status = await runBackup(box);
    const [stored] = [...s3.objects.values()];
    assert.ok(stored.length > 100 && status.bytes === stored.length);
    assert.ok(!stored.includes('SECRET-TASK-TEXT') && !stored.includes('workspace file'), 'the stored object is ciphertext');

    // Without the identity nothing opens it; with it the files come back and the relay identity stays out.
    const cfg = s3Config((n) => vault[n]);
    const [{ key }] = await list(cfg, prefix());
    const file = path.join(home, 'down.age');
    await getFile(cfg, key, file);
    const wrong = path.join(home, 'wrong.key');
    spawnSync('age-keygen', ['-o', wrong]);
    assert.notEqual(spawnSync('age', ['-d', '-i', wrong, file]).status, 0, 'another key cannot decrypt it');
    const names = execFileSync('bash', ['-c', `age -d -i ${idFile} ${file} | tar -t`], { encoding: 'utf8' });
    assert.match(names, /log\.jsonl/);
    assert.match(names, /workspaces\/home\/notes\.txt/);
    assert.doesNotMatch(names, /remote\.json|remote\//);

    for (let i = 0; i < KEEP + 2; i++) s3.objects.set(`gurtos-backups/${prefix()}2026010${String(i).padStart(2, '0')}T000000Z.tar.age`.replace('0100', '01'), Buffer.from('x'));
    await runBackup(box);
    assert.equal((await list(cfg, prefix())).length, KEEP, `only the newest ${KEEP} stay`);
  } finally {
    s3.close();
    fs.rmSync(home, { recursive: true, force: true });
  }
});
