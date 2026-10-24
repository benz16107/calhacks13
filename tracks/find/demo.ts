// The /find demo step: "find the whiteboard photo", from the portal and from an agent, plus a file and a task
// found by meaning, and undo taking a file back out of the index.
// Offline by default: the photos' descriptions are ones gemma4 wrote earlier (recorded.json) and the index matches
// words. DEMO_LIVE=find ./demo describes them live (Ollama on the laptop box, else Claude through a Droid task)
// and searches with Moss, and prints the latency numbers.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import type { DemoKit, LogEvent, Task } from '../../core/contract.ts';

type Result = { kind: string; workspace: string; path?: string; task?: string; state?: string; model?: string; ms?: string; score: number; text: string };
type Search = { query: string; index: string; ms: number; wallMs: number; results: Result[] };

export default async function (d: DemoKit) {
  const live = (process.env.DEMO_LIVE ?? '').split(/[\s,]+/).includes('find');
  const { tools } = await d.api<{ tools: string[] }>('GET', '/health');
  d.check(tools.includes('find.search'), 'the box loaded the find.search tool');
  const tests = spawnSync(process.execPath, [...process.execArgv, '--test', path.join(import.meta.dirname, 'find.test.ts')], { encoding: 'utf8' });
  d.check(tests.status === 0, `the unit tests pass against a stub vision model${tests.status ? `:\n${tests.stdout}${tests.stderr}` : ''}`);

  const search = (q: string, kind = '', k = 5) => d.api<Search>('GET', `/t/find/search?q=${encodeURIComponent(q)}&kind=${kind}&k=${k}`);
  const status = await d.waitFor(
    'the four test photos to be described',
    async () => {
      const s = await d.api<{ docs: Record<string, number> }>('GET', '/t/find/status');
      return (s.docs.photo ?? 0) >= 4 ? s : undefined;
    },
    live ? 300_000 : 20_000, // live, Claude through a Droid task can take a few minutes
  );
  d.check(status, 'the box described the four test photos in the photos workspace');

  // Ben, from the portal.
  const r = await search('find the whiteboard photo', 'photo');
  const top = r.results[0];
  d.check(
    top?.workspace === 'photos' && top.path === 'IMG_2041.jpg',
    `"find the whiteboard photo" -> photos/${top?.path}, described by ${top?.model}: "${top?.text.split(': ').slice(1).join(': ').slice(0, 70)}..."`,
  );
  d.check(r.index === (live ? 'moss' : 'words'), live ? `Moss answered in ${r.ms < 1 ? 'under 1' : r.ms} ms (${r.wallMs} ms with the box's own code)` : 'offline run: the word index stood in for Moss');

  const port = fs.readFileSync(path.join(d.home, 'api.port'), 'utf8').trim();
  const get = (q: string) => fetch(`http://127.0.0.1:${port}/t/find/file?${q}`);
  const img = await get('workspace=photos&path=IMG_2041.jpg');
  const same = Buffer.from(await img.arrayBuffer()).equals(fs.readFileSync(path.join(import.meta.dirname, 'photos', 'IMG_2041.jpg')));
  d.check(img.headers.get('content-type') === 'image/jpeg' && same, 'the portal can show the photo it found (GET /t/find/file)');

  // An agent, through the broker: a task with no network and no secrets uses find.search.
  const a = await d.api<Task>('POST', '/tasks', {
    title: 'Where is the whiteboard photo?',
    workspace: 'home',
    worker: 'fake',
    source: 'demo',
    tools: ['find.search'],
    prompt: 'call find.search {"query":"find the whiteboard photo","kind":"photo","topK":1}',
  });
  await d.settled([a.id]);
  const events = (await d.api<{ events: LogEvent[] }>('GET', `/tasks/${a.id}`)).events;
  const out = (events.find((e) => e.type === 'tool.result') as Extract<LogEvent, { type: 'tool.result' }>)?.output as Search | undefined;
  d.check(out?.results[0]?.path === 'IMG_2041.jpg', 'an agent asked find.search and got the same photo, through the broker');

  // A file and the task that wrote it, found by meaning. Undo the task and the file leaves the index.
  d.workspace('find-notes', {});
  const vault = path.join(d.home, 'vault.env');
  fs.symlinkSync(vault, path.join(d.home, 'workspaces', 'find-notes', 'leak.txt')); // as a hostile task might
  const w = await d.api<Task>('POST', '/tasks', {
    title: 'Plan the Tahoe weekend',
    workspace: 'find-notes',
    worker: 'fake',
    source: 'demo',
    prompt: 'write tahoe.md Packing list for the Tahoe ski trip: goggles, gloves, wax, chains for the car.',
  });
  await d.settled([w.id]);
  // The word index needs shared words; Moss matches the meaning.
  const pack = live ? 'what to pack for skiing' : 'Tahoe packing list';
  const file = await d.waitFor('the new note to be indexed', async () =>
    (await search(pack, 'file')).results.find((x) => x.workspace === 'find-notes' && x.path === 'tahoe.md'),
  );
  d.check(file, `"${pack}" -> find-notes/tahoe.md, the file a task just wrote`);
  const task = (await search('Tahoe weekend', 'task')).results.find((x) => x.task === w.id);
  d.check(task?.state === 'done', `"Tahoe weekend" -> task ${w.id}, "${task?.text.slice(0, 50)}...": task history is searchable`);
  const secret = fs.readFileSync(vault, 'utf8').split('\n').map((l) => l.split('=').slice(1).join('=')).filter((v) => v.length > 8);
  const all = JSON.stringify(await search('key token secret password', '', 20));
  d.check(
    (await get('workspace=find-notes&path=leak.txt')).status === 404 && (await get('workspace=..&path=log.jsonl')).status === 404 && !secret.some((v) => all.includes(v)),
    'a symlink to the vault is neither indexed nor served, and no path leaves the workspaces',
  );

  await d.api('POST', `/tasks/${w.id}/undo`);
  await d.waitFor('the undone note to leave the index', async () =>
    (await search(pack, 'file')).results.some((x) => x.path === 'tahoe.md') ? undefined : true,
  );
  const after = await d.api<{ docs: Record<string, number> }>('GET', '/t/find/status');
  d.check(after.docs.photo === 4, 'undo took the task\'s note back out of /find; the photos stayed');

  if (!live) {
    console.log('  skip  live descriptions and Moss: DEMO_LIVE=find ./demo runs them');
    return;
  }
  const photos = (await search('photo', 'photo', 10)).results;
  for (const p of photos) console.log(`  info  ${p.path}: ${p.model}, ${p.ms} ms`);
  const runs: Search[] = [];
  for (const q of ['find the whiteboard photo', 'grocery receipt', 'batteries', 'sign-up chart', 'what to pack for skiing']) runs.push(await search(q));
  const median = (xs: number[]) => xs.sort((x, y) => x - y)[xs.length >> 1];
  console.log(`  info  Moss, ${runs.length} queries: median ${median(runs.map((x) => x.ms)) || 'under 1'} ms in Moss, ${median(runs.map((x) => x.wallMs))} ms wall`);
}
