import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import test from 'node:test';
import type { Task } from './contract.ts';

const home = fs.mkdtempSync(path.join(os.tmpdir(), 'keep-'));
process.env.BOX_HOME = home; // sandbox.ts reads it when imported
const sb = await import('./sandbox.ts');

const modeOf = (f: string) => fs.statSync(f).mode & 0o7777;

test('Keep gives a kept file its old mode, a new file 0644, never the sealed layer\'s a+rwX', () => {
  const real = path.join(home, 'thesis');
  fs.mkdirSync(real);
  fs.chmodSync(real, 0o755); // a new folder takes its parent's mode
  fs.writeFileSync(path.join(real, 'a.md'), 'old\n');
  fs.chmodSync(path.join(real, 'a.md'), 0o640);
  sb.linkBase('ws', real);

  const task = { id: 't1', workspace: 'ws', layers: [] } as unknown as Task;
  fs.mkdirSync(sb.dirs.task('t1'), { recursive: true });
  fs.writeFileSync(path.join(sb.dirs.task('t1'), 'manifest.json'), JSON.stringify({ 'a.md': (sha(path.join(real, 'a.md'))) }));
  const upper = sb.dirs.upper('t1');
  fs.mkdirSync(path.join(upper, 'sub'), { recursive: true });
  fs.writeFileSync(path.join(upper, 'a.md'), 'new\n');
  fs.writeFileSync(path.join(upper, 'sub', 'b.md'), 'brand new\n');
  fs.chmodSync(path.join(upper, 'a.md'), 0o666); // what seal() does: chmod -R a+rwX
  fs.chmodSync(path.join(upper, 'sub', 'b.md'), 0o666);
  fs.chmodSync(path.join(upper, 'sub'), 0o777);

  const out = sb.keep(task);
  assert.ok(out.kept);
  assert.equal(fs.readFileSync(path.join(real, 'a.md'), 'utf8'), 'new\n');
  assert.equal(modeOf(path.join(real, 'a.md')), 0o640, 'kept file keeps its previous mode');
  assert.equal(modeOf(path.join(real, 'sub', 'b.md')), 0o644, 'new file is 0644, not the layer\'s 0666');
  assert.equal(modeOf(path.join(real, 'sub')) & 0o022, 0, 'new folder is not group- or world-writable');

  // Undo the Keep: the old file comes back with its content and mode, the added one goes.
  const back = sb.unkeep(task);
  assert.ok(back.reverted);
  assert.equal(fs.readFileSync(path.join(real, 'a.md'), 'utf8'), 'old\n');
  assert.equal(modeOf(path.join(real, 'a.md')), 0o640);
  assert.ok(!fs.existsSync(path.join(real, 'sub', 'b.md')));
});

test('undoing a Keep refuses when the owner edited the kept file since', () => {
  const real = path.join(home, 'essay');
  fs.mkdirSync(real);
  fs.writeFileSync(path.join(real, 'e.md'), 'v1\n');
  sb.linkBase('ws2', real);
  const task = { id: 't2', workspace: 'ws2', layers: [] } as unknown as Task;
  fs.mkdirSync(sb.dirs.task('t2'), { recursive: true });
  fs.writeFileSync(path.join(sb.dirs.task('t2'), 'manifest.json'), JSON.stringify({ 'e.md': sha(path.join(real, 'e.md')) }));
  fs.mkdirSync(sb.dirs.upper('t2'), { recursive: true });
  fs.writeFileSync(path.join(sb.dirs.upper('t2'), 'e.md'), 'v2\n');
  sb.keep(task);
  fs.writeFileSync(path.join(real, 'e.md'), 'v3 by the owner\n');
  const r = sb.unkeep(task);
  assert.deepEqual(r.conflicts, ['e.md']);
  assert.equal(fs.readFileSync(path.join(real, 'e.md'), 'utf8'), 'v3 by the owner\n'); // not overwritten
});

function sha(file: string) {
  return createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

// A task controls every name in its own layer. The box reads that layer as root, so a link there must never lead it
// to a file the task could not read itself, and a pipe must never hang it.
test('a link in a task\'s layer is shown and kept as a link, never followed as root', () => {
  const secret = path.join(home, 'vault.env');
  fs.writeFileSync(secret, 'ANTHROPIC_API_KEY=sk-real-key\n');
  const real = path.join(home, 'links');
  fs.mkdirSync(real);
  sb.linkBase('ws3', real);
  const task = { id: 't3', workspace: 'ws3', layers: [] } as unknown as Task;
  fs.mkdirSync(sb.dirs.task('t3'), { recursive: true });
  fs.writeFileSync(path.join(sb.dirs.task('t3'), 'manifest.json'), '{}');
  const upper = sb.dirs.upper('t3');
  fs.mkdirSync(upper, { recursive: true });
  fs.symlinkSync(secret, path.join(upper, 'notes.txt'));
  fs.writeFileSync(path.join(upper, 'plain.txt'), 'hello\n');

  const d = sb.diff(task);
  assert.deepEqual(d.changes.map((c) => c.path).sort(), ['notes.txt', 'plain.txt']);
  assert.ok(!d.diff.includes('sk-real-key'), 'the diff must not show what the link points at');
  assert.match(d.diff, /notes\.txt[\s\S]*link to .*vault\.env/);
  assert.match(d.diff, /\+hello/);

  assert.ok(sb.keep(task).kept);
  assert.ok(fs.lstatSync(path.join(real, 'notes.txt')).isSymbolicLink(), 'kept as a link');
  assert.equal(fs.readlinkSync(path.join(real, 'notes.txt')), secret);
  assert.equal(fs.readFileSync(path.join(real, 'plain.txt'), 'utf8'), 'hello\n');
  fs.rmSync(secret); // a link to nowhere still undoes cleanly
  assert.ok(sb.unkeep(task).reverted);
  assert.deepEqual(fs.readdirSync(real), []);
});

test('Keep never writes through a link in the real folder to somewhere outside it', () => {
  const outside = path.join(home, 'outside');
  fs.mkdirSync(outside);
  const real = path.join(home, 'project');
  fs.mkdirSync(real);
  fs.symlinkSync(outside, path.join(real, 'conf')); // the owner's own link, out of the folder
  sb.linkBase('ws4', real);
  const task = { id: 't4', workspace: 'ws4', layers: [] } as unknown as Task;
  fs.mkdirSync(sb.dirs.task('t4'), { recursive: true });
  fs.writeFileSync(path.join(sb.dirs.task('t4'), 'manifest.json'), '{}');
  const upper = sb.dirs.upper('t4');
  fs.mkdirSync(path.join(upper, 'conf'), { recursive: true }); // the task replaced the link with a folder of its own
  fs.writeFileSync(path.join(upper, 'conf', 'job'), '* * * * * root evil\n');
  const out = sb.keep(task);
  assert.deepEqual(out.conflicts, ['conf/job']);
  assert.deepEqual(fs.readdirSync(outside), [], 'nothing written outside the folder');
});

test('a pipe in a task\'s layer is not a change, so nothing reads it', () => {
  const task = { id: 't5', workspace: 'ws5', layers: [] } as unknown as Task;
  fs.mkdirSync(sb.dirs.workspace('ws5'), { recursive: true });
  const upper = sb.dirs.upper('t5');
  fs.mkdirSync(upper, { recursive: true });
  execFileSync('mkfifo', [path.join(upper, 'pipe')]);
  fs.writeFileSync(path.join(upper, 'a.txt'), 'a\n');
  const d = sb.diff(task); // would block forever reading the pipe
  assert.deepEqual(d.changes, [{ path: 'a.txt', change: 'added' }]);
});

test('a layer file is opened only where it really is: never through a link on the way', () => {
  // The diff and the flight recorder run while a task can still swap a folder for a link, so they open each file
  // themselves and check where it landed, instead of trusting the name they listed a moment before.
  const secret = path.join(home, 'secret2');
  fs.writeFileSync(secret, 'TOP-SECRET\n');
  const root = path.join(home, 'layer7');
  fs.mkdirSync(path.join(root, 'ok'), { recursive: true });
  fs.writeFileSync(path.join(root, 'ok', 'f'), 'fine\n');
  fs.symlinkSync(home, path.join(root, 'd'));
  fs.symlinkSync(secret, path.join(root, 'l'));
  execFileSync('mkfifo', [path.join(root, 'p')]);
  const fd = sb.openPlain(root, 'ok/f');
  assert.ok(fd !== undefined);
  fs.closeSync(fd!);
  assert.equal(sb.openPlain(root, 'd/secret2'), undefined, 'a link on the way');
  assert.equal(sb.openPlain(root, 'l'), undefined, 'a link at the end');
  assert.equal(sb.openPlain(root, 'p'), undefined, 'a pipe, without waiting for a writer');
  assert.equal(sb.openPlain(root, 'missing'), undefined);
});

