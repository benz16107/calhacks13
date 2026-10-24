// /find: search the box's photos, files and task history by meaning, for agents (find.search) and for Ben
// (GET /t/find/search). Moss is the index. See README.md.
import fs from 'node:fs';
import path from 'node:path';
import type { Box, Track } from '../../core/contract.ts';
import { HOME, MODELS, OFFLINE, PROMPT, cloudStatus, describeAny, docs, drop, isUsageLimit, mossIndex, photoType, put, root, scan, use, wordIndex, type Index } from './find.ts';

const MOSS = ['MOSS_PROJECT_ID', 'MOSS_PROJECT_KEY'];
const KINDS = ['photo', 'file', 'task'];
type Secret = (name: string) => string;
const round = (n: number) => Math.round(n * 100) / 100;
const maybe = (secret: Secret, name: string) => {
  try {
    return secret(name);
  } catch {
    return undefined;
  }
};

let opening: Promise<Index> | undefined;
/** Moss when the vault has its keys and this is not an offline demo run. Otherwise the word index. */
function open(secret: Secret) {
  opening ??= (async () => {
    const [id, key] = MOSS.map((n) => maybe(secret, n));
    if (OFFLINE || !id || !key) return use(wordIndex());
    try {
      return await use(await mossIndex(id, key));
    } catch (e) {
      // No network at boot, or Moss is down: search by words meanwhile. Try Moss again in a minute, or in an
      // hour when the project is over its usage limit, so a limited project is not called every minute.
      console.error(`find: Moss did not open, using the word index for now: ${(e as Error).message}`);
      setTimeout(() => (opening = undefined), isUsageLimit(e) ? 3600_000 : 60_000).unref();
      return use(wordIndex());
    }
  })();
  return opening;
}

async function search(secret: Secret, input: { query?: unknown; kind?: unknown; topK?: unknown }) {
  const query = String(input.query ?? '').trim();
  if (!query) throw new Error('query is required');
  const kind = input.kind ? String(input.kind) : undefined;
  if (kind && !KINDS.includes(kind)) throw new Error(`kind must be one of ${KINDS.join(', ')}`);
  const index = await open(secret);
  const topK = Math.min(Math.max(Number(input.topK) || 5, 1), 20);
  const t0 = performance.now();
  let used: string = index.kind;
  let found: Awaited<ReturnType<Index['query']>>;
  try {
    found = await index.query(query, topK, kind);
  } catch (e) {
    if (index.kind !== 'moss') throw e;
    // Moss could not open a session (no network, usage limit): answer from the same docs by words.
    const words = wordIndex();
    await words.add([...docs.values()]);
    found = await words.query(query, topK, kind);
    used = `words (Moss unavailable: ${(e as Error).message.slice(0, 120)})`;
  }
  const { hits, ms } = found;
  return {
    query,
    index: used,
    ms: round(ms),
    wallMs: round(performance.now() - t0),
    cloud: cloudStatus(),
    results: hits.map((h) => ({ ...h.metadata, score: round(h.score), text: h.text.slice(0, 400) })),
  };
}

// ---------- Claude as the backup describer: a Droid task in the photos' workspace ----------
// No network, no tools, no secrets. It writes .find/descriptions.json in its own copy; the next scan reads it.

const handed = new Set<string>(); // photos given to a Droid task since boot
/** A describe task already has this photo, unless it failed over an hour ago: a restart does not start it again. */
const covered = (box: Box, ws: string, file: string) =>
  box.tasks().some(
    (t) => t.source === 'find' && t.workspace === ws && t.prompt.split('\n').includes(file) && (t.state !== 'failed' || Date.now() - Date.parse(t.updatedAt) < 3600_000),
  );
const droidModel = new Map<string, string>(); // task id -> the model Droid reported in its cost events

/** Claude's description of a photo, if a finished Droid task wrote one into the workspace after the photo changed. */
function fromClaude(box: Box, ws: string, rel: string) {
  const dir = root(ws);
  const file = path.join(dir, '.find', 'descriptions.json');
  try {
    // A task could leave a symlink here, or make .find one, pointing at a root-only file.
    if (!fs.realpathSync(file).startsWith(fs.realpathSync(dir) + path.sep) || !fs.lstatSync(file).isFile()) return undefined;
    if (fs.statSync(file).mtimeMs < fs.statSync(path.join(dir, rel)).mtimeMs) return undefined; // written before the photo changed
    const text = JSON.parse(fs.readFileSync(file, 'utf8'))[rel];
    if (typeof text !== 'string' || !text.trim()) return undefined;
    const t = box.tasks().findLast((x) => x.source === 'find' && x.workspace === ws && x.state === 'done');
    return { text: text.trim().slice(0, 2000), model: `${(t && droidModel.get(t.id)) ?? 'Claude'} via Droid task ${t?.id}`, ms: t ? Date.parse(t.updatedAt) - Date.parse(t.createdAt) : 0 };
  } catch {
    return undefined; // never pass the parse error on: it quotes the file
  }
}

export function askClaude(box: Box, failed: { workspace: string; path: string }[]) {
  // Droid needs the vault's Factory key. Without it, start nothing; a later scan tries again once the key is set.
  if (!maybe(box.secret, 'FACTORY_API_KEY')) return;
  const fresh = failed.filter((f) => !handed.has(`${f.workspace}/${f.path}`) && !covered(box, f.workspace, f.path));
  for (const workspace of new Set(fresh.map((f) => f.workspace))) {
    const list = fresh.filter((f) => f.workspace === workspace);
    list.forEach((f) => handed.add(`${f.workspace}/${f.path}`));
    const prompt =
      `Open each photo listed below with your Read tool and look at it. ${PROMPT.replace('this photo', 'each photo')}\n` +
      'Write the results to .find/descriptions.json as one JSON object that maps each file path, exactly as listed, ' +
      'to its description and keywords as one string. Change no other file.\n\n' +
      list.map((f) => f.path).join('\n');
    box
      .createTask({ title: `Describe ${list.length} photo${list.length > 1 ? 's' : ''} for /find`, workspace, worker: 'droid', prompt })
      .catch((e) => console.error(`find: could not start the Claude task: ${e.message}`));
  }
}

// ---------- indexing, one pass at a time ----------

let busy: Promise<unknown> | undefined;
let again = false;
function indexNow(box: Box) {
  if (busy) return (again = true), busy;
  busy = (async () => {
    await open(box.secret);
    let failed: Awaited<ReturnType<typeof scan>>;
    do {
      again = false;
      failed = await scan(
        async (file, ws, rel) => {
          try {
            return await describeAny(file, box.secret);
          } catch (e) {
            const c = fromClaude(box, ws, rel);
            if (c) return c;
            throw e;
          }
        },
        (doc) => box.note({ described: `${doc.metadata.workspace}/${doc.metadata.path}`, model: doc.metadata.model, ms: Number(doc.metadata.ms) }),
      );
    } while (again);
    if (failed.length && !OFFLINE) askClaude(box, failed);
    return { docs: docs.size, failed };
  })().finally(() => (busy = undefined));
  return busy;
}

const summaries = new Map<string, string>(); // task id -> Droid's final message

export default {
  name: 'find',
  // FACTORY_API_KEY: only checked for presence before starting a Claude describe task; its value is never read here.
  secrets: [...MOSS, 'VULTR_INFERENCE_KEY', 'FACTORY_API_KEY'],

  triggers: [
    {
      name: 'index',
      start(box) {
        box.workspace('photos', new URL('./photos/', import.meta.url).pathname); // the test photos, the first time only
        // Earlier versions indexed the box's own describe tasks; they are housekeeping, not history.
        void drop([...docs.values()].filter((d) => d.metadata.kind === 'task' && d.metadata.source === 'find').map((d) => d.id));
        const tick = () => indexNow(box).catch((e) => console.error(`find: indexing failed: ${e.message}`));
        void tick();
        setInterval(tick, 60_000).unref(); // also catches files copied straight into a workspace
      },
    },
  ],

  // Task history: each finished task becomes a doc. Its files changed the workspace, so index again.
  logReaders: [
    {
      name: 'tasks',
      async read(e, box) {
        if (e.type === 'task.step' && (e.data as { summary?: boolean } | undefined)?.summary) summaries.set(e.task, e.text);
        if (e.type === 'cost' && e.task && e.model) droidModel.set(e.task, e.model);
        if (e.type !== 'task.state' || !['done', 'failed', 'undone'].includes(e.state)) return;
        const t = box.task(e.task);
        if (!t) return;
        const what = summaries.get(t.id) ?? t.summary ?? e.error ?? t.prompt;
        summaries.delete(t.id);
        // The box's own describe tasks are housekeeping, not history: their result shows up as photo descriptions.
        if (t.source !== 'find') {
          await put({
            id: `task:${t.id}`,
            text: `Task "${t.title}" (${e.state}): ${what.slice(0, 1500)}`,
            metadata: { kind: 'task', task: t.id, title: t.title, workspace: t.workspace, state: e.state, source: t.source },
          });
        }
        if (e.state !== 'failed') void indexNow(box).catch(() => {}); // a failed task's files are not applied
      },
    },
  ],

  modelJobs: [
    /** Describe one photo, for any track: { file } -> { text, model, ms }. */
    { name: 'find.describe', secrets: ['VULTR_INFERENCE_KEY'], run: (input: { file: string }, ctx) => describeAny(input.file, ctx.secret) },
  ],

  tools: [
    {
      name: 'find.search',
      description:
        'Search everything on this box by meaning: photos (by what is in them), text files, and past tasks. ' +
        'Returns the best matches with their workspace and path, best first.',
      input: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'What to look for, in plain words, e.g. "the whiteboard photo"' },
          kind: { type: 'string', enum: KINDS, description: 'Only this kind of result' },
          topK: { type: 'number', description: 'How many results, 1 to 20. Default 5.' },
        },
        required: ['query'],
      },
      secrets: MOSS,
      run: (input, ctx) => search(ctx.secret, input),
    },
  ],

  apps: [{ name: 'find', title: 'Find', href: '/' }],

  routes: {
    'GET /': () => new Response(fs.readFileSync(new URL('./app.html', import.meta.url)), { headers: { 'content-type': 'text/html; charset=utf-8' } }),
    // GET /t/find/search?q=whiteboard%20photo&kind=photo&k=5
    'GET /search': async (req, box) => {
      const u = new URL(req.url);
      try {
        return Response.json(await search(box.secret, { query: u.searchParams.get('q'), kind: u.searchParams.get('kind'), topK: u.searchParams.get('k') }));
      } catch (e) {
        return Response.json({ error: (e as Error).message }, { status: 400 });
      }
    },
    // GET /t/find/file?workspace=photos&path=IMG_2041.jpg: the file a result points at, for the portal to show.
    'GET /file': (req) => {
      const u = new URL(req.url);
      const ws = u.searchParams.get('workspace') ?? '';
      if (!fs.readdirSync(path.join(HOME, 'workspaces')).includes(ws)) return new Response('no such workspace', { status: 404 });
      const dir = fs.realpathSync(root(ws));
      let file: string;
      try {
        file = fs.realpathSync(path.resolve(dir, u.searchParams.get('path') ?? '')); // follows symlinks, then checks where they lead
      } catch {
        return new Response('not found', { status: 404 });
      }
      if (!file.startsWith(dir + path.sep) || !fs.statSync(file).isFile()) return new Response('not found', { status: 404 });
      return new Response(fs.readFileSync(file), { headers: { 'content-type': photoType(file) ?? 'text/plain; charset=utf-8' } });
    },
    'GET /status': () => {
      const count: Record<string, number> = {};
      for (const d of docs.values()) count[d.metadata.kind] = (count[d.metadata.kind] ?? 0) + 1;
      return Response.json({ offline: OFFLINE, cloud: cloudStatus(), docs: count, models: MODELS.map((m) => `${m.model} at ${m.base}`).concat('Claude via a Droid task') });
    },
  },
} satisfies Track;
