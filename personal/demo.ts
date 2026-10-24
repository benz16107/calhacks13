// GurtOS Personal's step in ./demo. The test VM has no desktop, so this runs the desktop layer's own Python
// (personal/selftest.py) headless against the demo box: the calls the notification service, the top bar and the
// Ask an Agent dialog make, and the service's choices about which notifications to post and close.
// Screenshots of the layer on a real GNOME desktop are in personal/README.md.
import { spawn } from 'node:child_process';
import type { DemoKit } from '../core/contract.ts';

export default async (d: DemoKit) => {
  d.workspace('personal', { 'notes.md': '# Notes\n' });
  const child = spawn('/usr/bin/python3', [new URL('./selftest.py', import.meta.url).pathname], {
    env: { ...process.env, BOX_URL: d.url, PERSONAL_WORKSPACE: 'personal' },
  });
  let out = '';
  let err = '';
  child.stdout.on('data', (b) => (out += b));
  child.stderr.on('data', (b) => (err += b));
  const code = await new Promise<number>((resolve) => child.on('close', (c) => resolve(c ?? 1)));
  for (const line of out.split('\n').filter(Boolean)) {
    const c = JSON.parse(line) as { ok: boolean; what: string };
    d.check(c.ok, c.what);
  }
  d.check(code === 0, code ? `selftest.py stopped: ${err.trim().split('\n').pop()}` : 'the desktop layer\'s self-test ran to the end');
};
