// The Vultr track's demo step. Object Storage is a local stand-in (fakes3.ts) and no Vultr API call is made:
// 1. A backup is encrypted to the owner's key: the stored object holds no task text, and only the owner's identity opens it.
// 2. It holds what a restore needs (the log, the workspaces, the task users' ids) and leaves out the relay identity.
// 3. The firewall route refuses an unsafe rule before it asks for any key.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { DemoKit, Task } from '../../core/contract.ts';
import { fakeS3 } from './fakes3.ts';

export default async function (d: DemoKit) {
  if (spawnSync('age', ['--version']).status !== 0) spawnSync('apt-get', ['install', '-y', 'age'], { stdio: 'ignore' });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vultr-demo-'));
  const identity = path.join(dir, 'owner.key');
  const recipient = spawnSync('age-keygen', ['-o', identity], { encoding: 'utf8' }).stderr.match(/(age1\w+)/)?.[1];
  d.check(recipient, 'the owner makes an age key pair; the box is given only the public half');
  const s3 = await fakeS3('AKDEMO');
  try {
    for (const [k, value] of Object.entries({ VULTR_OBJ_ACCESS: 'AKDEMO', VULTR_OBJ_SECRET: 'demo-secret', VULTR_OBJ_HOST: s3.url, BACKUP_AGE_RECIPIENT: recipient })) await d.api('PUT', `/vault/${k}`, { value });
    await d.api('POST', '/apps/vultr/enable');

    d.workspace('vultr', {});
    const t = await d.api<Task>('POST', '/tasks', { title: 'Write a note', workspace: 'vultr', worker: 'fake', prompt: 'write plan.txt TOP-SECRET-PLAN-TEXT' });
    await d.settled([t.id]);

    const done = await d.api('POST', '/t/vultr/backup');
    const stored = [...s3.objects.entries()];
    d.check(stored.length === 1 && stored[0][0].startsWith('gurtos-backups/backups/demo-box/') && done.bytes === stored[0][1].length, `a backup of ${done.bytes} bytes went to the bucket under the box's own prefix`);
    d.check(!stored[0][1].includes('TOP-SECRET-PLAN-TEXT') && !stored[0][1].includes('Write a note'), 'the stored object is ciphertext: no task text or title in it');

    const file = path.join(dir, 'b.age');
    fs.writeFileSync(file, stored[0][1]);
    const other = path.join(dir, 'other.key');
    spawnSync('age-keygen', ['-o', other]);
    d.check(spawnSync('age', ['-d', '-i', other, file]).status !== 0, 'a different key cannot open it');
    const names = spawnSync('bash', ['-c', `age -d -i ${identity} ${file} | tar -t`], { encoding: 'utf8', maxBuffer: 1 << 28 }).stdout;
    d.check(/log\.jsonl/.test(names) && /workspaces\/vultr\//.test(names) && /vultr\/manifest\.json/.test(names), "the owner's key opens it: the log, the workspaces and the task users are in it");
    d.check(!/(^|\n)\.\/(remote|remote\.json|ca)(\/|\n)/.test(names), "the box's relay identity and CA key are left out");

    const st = await d.api('GET', '/t/vultr/status');
    d.check(st.backup?.key === done.key && st.backupConfigured, 'GET /t/vultr/status reports the last backup');

    const put = (body: unknown) => fetch(`${d.url}/t/vultr/firewall`, { method: 'PUT', body: JSON.stringify(body) });
    const unsafe = await put({ ssh: ['203.0.113.7'], public: [7700] });
    const lockout = await put({ public: [443] });
    d.check(unsafe.status === 400 && (await unsafe.text()).includes('never') && lockout.status === 400, 'the firewall route refuses to open 7700 to the internet, or to lock out ssh, before any call to Vultr');
  } finally {
    s3.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
