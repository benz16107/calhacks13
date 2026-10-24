// /find's own logic, against a stub vision server and a scratch BOX_HOME. No Moss, no real model.
//   node --experimental-strip-types --test tracks/find/find.test.ts
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

const home = fs.mkdtempSync(path.join(os.tmpdir(), 'find-'));
process.env.BOX_HOME = home;
process.env.FIND_CLOUD_SYNC = '1';
const { describe, describeAny, wordIndex, use, scan, docs, put, syncCloud, cloudStatus } = await import('./find.ts');
const photo = new URL('./photos/IMG_2041.jpg', import.meta.url).pathname;

test('describe sends the photo to an OpenAI-style API and reads the reply', async () => {
  let seen: any;
  const server = http.createServer(async (req, res) => {
    let body = '';
    for await (const c of req) body += c;
    seen = { url: req.url, auth: req.headers.authorization, body: JSON.parse(body) };
    res.end(JSON.stringify({ choices: [{ message: { content: ' A whiteboard. ' } }] }));
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}/v1`;
  const d = await describe(photo, { model: 'vision-1', base }, 'k123');
  server.close();
  assert.equal(d.text, 'A whiteboard.');
  assert.equal(d.model, 'vision-1');
  assert.equal(seen.url, '/v1/chat/completions');
  assert.equal(seen.auth, 'Bearer k123');
  const [text, image] = seen.body.messages[0].content;
  assert.match(text.text, /search index/);
  assert.ok(image.image_url.url.startsWith('data:image/jpeg;base64,/9j/'), 'the photo goes as a data URL');
  await assert.rejects(describe(photo, { model: 'x', base: 'http://127.0.0.1:1/v1' }));
});

test('only photos inside the workspaces go to a model', async () => {
  await assert.rejects(describeAny(photo, () => ''), /only photos in a workspace/, 'a photo outside BOX_HOME');
  await assert.rejects(describe('/etc/hostname', { model: 'x', base: 'http://127.0.0.1:1/v1' }), /not a photo/);
});

test('the word index ranks by shared words and filters by kind', async () => {
  const i = wordIndex();
  await i.add([
    { id: 'a', text: 'A whiteboard diagram of a sprint plan', metadata: { kind: 'photo' } },
    { id: 'b', text: 'A photo of a store receipt', metadata: { kind: 'photo' } },
    { id: 'c', text: 'whiteboard cleaning notes', metadata: { kind: 'file' } },
  ]);
  assert.deepEqual((await i.query('find the whiteboard photo', 5)).hits.map((h) => h.id).slice(0, 1), ['a']);
  assert.deepEqual((await i.query('whiteboard', 5, 'file')).hits.map((h) => h.id), ['c']);
  await i.remove(['a']);
  assert.ok(!(await i.query('whiteboard', 5)).hits.some((h) => h.id === 'a'));
});

test('scan describes new photos once, reads text files, skips binaries and drops what is gone', async () => {
  const ws = path.join(home, 'workspaces', 'w');
  fs.mkdirSync(path.join(ws, '.hidden'), { recursive: true });
  fs.copyFileSync(photo, path.join(ws, 'board.jpg'));
  fs.writeFileSync(path.join(ws, 'notes.md'), 'packing list for Tahoe');
  fs.writeFileSync(path.join(ws, 'blob.bin'), Buffer.from([1, 0, 2]));
  fs.writeFileSync(path.join(ws, '.hidden', 'x.txt'), 'hidden');
  const index = await use(wordIndex());
  let calls = 0;
  const describePhoto = async () => (calls++, { text: 'a whiteboard', model: 'stub', ms: 5 });

  assert.deepEqual(await scan(describePhoto), []);
  assert.equal(calls, 1);
  assert.deepEqual([...docs.keys()].sort(), ['file:w/board.jpg', 'file:w/notes.md']);
  assert.equal(docs.get('file:w/board.jpg')!.metadata.model, 'stub', 'which model described it is kept');
  assert.equal((await index.query('tahoe', 5)).hits[0].metadata.path, 'notes.md');

  await scan(describePhoto);
  assert.equal(calls, 1, 'an unchanged photo is not described again');

  fs.rmSync(path.join(ws, 'notes.md'));
  fs.copyFileSync(photo, path.join(ws, 'other.jpg'));
  const failed = await scan(async () => {
    throw new Error('no model');
  });
  assert.deepEqual(failed.map((f) => f.path), ['other.jpg'], 'a photo no model could describe is reported');
  assert.ok(!docs.has('file:w/notes.md') && (await index.query('tahoe', 5)).hits.length === 0, 'a deleted file leaves the index');
  assert.ok(JSON.parse(fs.readFileSync(path.join(home, 'find', 'docs.json'), 'utf8')).length === 1, 'docs.json is saved');
});

test('the cloud copy: only when the index changed, at most every 10 minutes, and an hour off after a usage limit', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.now() });
  const min = 60_000;
  let pushes = 0;
  const push = async () => void pushes++;
  const limited = async () => {
    pushes++;
    throw new Error("The project's usage limit has been reached; billing must be updated before it can be used.");
  };
  await put({ id: 'task:a', text: 'Task "a" (done)', metadata: { kind: 'task' } });
  await syncCloud(push);
  assert.equal(pushes, 1);
  assert.match(cloudStatus(), /cloud copy on, last pushed/);
  await put({ id: 'task:b', text: 'Task "b" (done)', metadata: { kind: 'task' } });
  await syncCloud(push);
  assert.equal(pushes, 1, 'changed, but within 10 minutes of the last push');
  t.mock.timers.tick(11 * min);
  await syncCloud(push);
  assert.equal(pushes, 2);
  t.mock.timers.tick(11 * min);
  await syncCloud(push);
  assert.equal(pushes, 2, 'an unchanged index is not pushed again');

  await put({ id: 'task:c', text: 'Task "c" (done)', metadata: { kind: 'task' } });
  await syncCloud(limited);
  assert.equal(pushes, 3);
  assert.match(cloudStatus(), /cloud copy paused: Moss usage limit/);
  t.mock.timers.tick(30 * min);
  await syncCloud(push);
  assert.equal(pushes, 3, 'within the hour after a usage limit, Moss is not called');
  t.mock.timers.tick(31 * min);
  await syncCloud(push);
  assert.equal(pushes, 4);
  assert.match(cloudStatus(), /cloud copy on/);
});
