import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
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
