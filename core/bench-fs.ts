// Measures the Personal file path on a test VM: a task's copy of a real folder, reads and writes in it, many tasks
// at once, Keep, undoing a Keep, and Undo. Run as root on a test machine, never on your own: it creates users and
// mounts. It uses its own BOX_HOME and owner folder and removes them at the end.
//   BOX_HOME=/var/lib/box-bench node core/bench-fs.ts [owner folder]   (no folder: builds one, ~50k files, ~2.3 GB)
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import type { Task } from './contract.ts';
import * as sandbox from './sandbox.ts';

const sh = (cmd: string) => execFileSync('/bin/sh', ['-c', cmd], { encoding: 'utf8', maxBuffer: 1 << 26, env: { ...process.env, GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: 'safe.directory', GIT_CONFIG_VALUE_0: '*' } }).trim();
const time = <T>(fn: () => T): [T, number] => {
  const t0 = performance.now();
  const v = fn();
  return [v, Math.round(performance.now() - t0)];
};
const out: Record<string, string | number> = {};
const note = (k: string, v: string | number) => ((out[k] = v), console.log(`${k}: ${v}`));

const real = process.argv[2] ?? '/home/benchowner/home';
if (!process.argv[2] && !fs.existsSync(real)) {
  // A realistic home: a git repository with history, ~50k small files in nested folders, two 1 GB files.
  spawnSync('useradd', ['-m', 'benchowner']);
  fs.mkdirSync(real, { recursive: true });
  sh(`git clone -q https://github.com/expressjs/express ${real}/code/express`);
  for (let d = 0; d < 250; d++) {
    const dir = path.join(real, 'docs', `d${d % 25}`, `s${d}`);
    fs.mkdirSync(dir, { recursive: true });
    for (let f = 0; f < 200; f++) fs.writeFileSync(path.join(dir, `note${f}.md`), `# note ${d}.${f}\n${'text '.repeat(200)}\n`);
  }
  sh(`head -c 1G /dev/urandom > ${real}/video.mp4 && head -c 1G /dev/urandom > ${real}/backup.tar`);
  sh(`chown -R benchowner:benchowner /home/benchowner`);
}
note('folder', sh(`find ${real} -type f | wc -l`) + ' files, ' + sh(`du -sh ${real} | cut -f1`));

sandbox.linkBase('home', real);
const task = (n: number): Task => ({ id: `tbench${n}`, user: `box-tbench${n}`, workspace: 'home', layers: [], title: 'bench', prompt: '', worker: 'fake', tools: [], hosts: [], budgetCents: 0, source: 'bench', state: 'queued', costCents: 0, createdAt: '', updatedAt: '' }) as Task;

// One task: its copy, then first read and write inside it.
const t = task(0);
const t0 = performance.now();
await sandbox.prepare(t);
const prep = Math.round(performance.now() - t0);
const [, snap] = time(() => sandbox.snapshotBase(t));
note('workspace: prepare (copy, chown, chmod, mount) ms', prep);
note('workspace: snapshotBase (record every file) ms', snap);
const root = sandbox.dirs.root(t.id);
note('first read of a small file ms', time(() => fs.readFileSync(path.join(root, 'docs/d0/s0/note0.md')))[1]);
note('first write of a small file ms', time(() => fs.writeFileSync(path.join(root, 'docs/d0/s0/note0.md'), 'changed\n'))[1]);
note('git status inside the task ms', time(() => sh(`git --no-optional-locks -C ${root}/code/express status --porcelain | wc -l`))[1]);
note('git status outside (the real folder) ms', time(() => sh(`git --no-optional-locks -C ${real}/code/express status --porcelain | wc -l`))[1]);
note('disk per task (its copy and upper) MB', Number(sh(`du -smx ${sandbox.dirs.task(t.id)} | cut -f1`)));

// Keep: a few large and many small changed files.
for (let i = 0; i < 1000; i++) fs.writeFileSync(path.join(root, `docs/d${i % 25}/s${i % 250}/note${i % 200}.md`), `edited ${i}\n`);
fs.appendFileSync(path.join(root, 'video.mp4'), 'more');
const [kept, keepMs] = time(() => sandbox.keep(t));
note('Keep: 1,000 small and one 1 GB changed files ms', keepMs);
note('Keep result', kept.conflicts ? `conflicts ${kept.conflicts.length}` : `kept ${kept.kept?.length}`);
note('undo that Keep (Time Machine) ms', time(() => sandbox.unkeep(t))[1]);
note('Undo the task (unmount, remove its copy) ms', time(() => (sandbox.seal(t), sandbox.purge(t)))[1]);

// Ten tasks at once. prepare() is synchronous, so this is also how long the box's API is blocked.
const ten = Array.from({ length: 10 }, (_, i) => task(i + 1));
const t1 = performance.now();
let blocked = 0, last = performance.now();
const tick = setInterval(() => ((blocked = Math.max(blocked, performance.now() - last - 50)), (last = performance.now())), 50);
await Promise.all(ten.map(async (x) => (await sandbox.prepare(x), sandbox.snapshotBase(x))));
clearInterval(tick);
const tenMs = Math.round(performance.now() - t1);
note('10 tasks: all ten workspaces ready ms', tenMs);
note('10 tasks: longest the box could not answer ms', Math.round(blocked));
note('10 tasks: disk used GB', (Number(sh(`du -smx ${sandbox.HOME}/tasks | cut -f1`)) / 1024).toFixed(1));
note('peak memory of the box process MB', Math.round(process.resourceUsage().maxRSS / 1024));
for (const x of ten) (sandbox.seal(x), sandbox.purge(x));
for (const x of [t, ...ten]) spawnSync('userdel', [x.user]);
fs.writeFileSync(path.join(sandbox.HOME, 'bench.json'), JSON.stringify(out, null, 1));
