// /find: search the box's photos, files and task history by meaning, for agents (find.search) and for people
// (GET /t/find/search). Moss is the index. See README.md.
import fs from 'node:fs';
import path from 'node:path';
import type { Box, Track } from '../../core/contract.ts';
import { HOME, MODELS, OFFLINE, PROMPT, cloudStatus, describeAny, docs, drop, forget, isUsageLimit, mossIndex, photoType, put, root, scan, use, wordIndex, type Index } from './find.ts';
import { addPreference, allowed, clean, isGuest, preferences, recall, remember, scope } from './memory.ts';
import { answerLocal, answerMoss, countMossAnswer, inferenceOn, setInference, type Engine } from './answer.ts';

const MOSS = ['MOSS_PROJECT_ID', 'MOSS_PROJECT_KEY'];
const KINDS = ['photo', 'file', 'task', 'memory'];
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

/** Ask the index. If Moss cannot answer (no network, usage limit), or `fast` and no session is open yet, answer from the same docs by words. */
async function query(secret: Secret, q: string, topK: number, kind?: string, fast = false) {
  const index = await open(secret);
  const byWords = async (why: string) => {
    // shortcut: tokenises every doc on each call; fine for hundreds of docs, keep one word index up to date past a few thousand.
    const words = wordIndex();
    await words.add([...docs.values()]);
    return { ...(await words.query(q, topK, kind)), used: `words (${why})` };
  };
  if (fast && index.warm && !index.ready?.()) {
    index.warm(); // the next call finds the session open
    return byWords('Moss is warming up');
  }
  try {
    return { ...(await index.query(q, topK, kind)), used: index.kind as string };
  } catch (e) {
    if (index.kind !== 'moss') throw e;
    return byWords(`Moss unavailable: ${(e as Error).message.slice(0, 120)}`);
  }
}

/** `fast`: never wait for Moss to open. For a voice assistant: call warm() when the person starts talking. */
async function search(secret: Secret, input: { query?: unknown; kind?: unknown; topK?: unknown; fast?: unknown }) {
  const q = String(input.query ?? '').trim();
  if (!q) throw new Error('query is required');
  const kind = input.kind ? String(input.kind) : undefined;
  if (kind && !KINDS.includes(kind)) throw new Error(`kind must be one of ${KINDS.join(', ')}`);
  const t0 = performance.now();
  const { hits, ms, used } = await query(secret, q, Math.min(Math.max(Number(input.topK) || 5, 1), 20), kind, input.fast === true || input.fast === 'true' || input.fast === '1');
  return {
    query: q,
    index: used,
    ms: round(ms),
    wallMs: round(performance.now() - t0),
    cloud: cloudStatus(),
    results: hits.map((h) => ({ id: h.id, ...h.metadata, score: round(h.score), text: h.text.slice(0, 400) })),
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

/** Start Claude describe tasks for these photos. Only when the person asks on the Find page: it spends model money. */
export function askClaude(box: Box, failed: { workspace: string; path: string }[]) {
  if (!maybe(box.secret, 'FACTORY_API_KEY')) throw new Error('Describing with Claude needs a model key. Add one in Settings.');
  const fresh = failed.filter((f) => !handed.has(`${f.workspace}/${f.path}`) && !covered(box, f.workspace, f.path));
  if (!fresh.length) return [];
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
  return fresh;
}

const owner = (req: Request) => ['screen', 'owner'].includes(req.headers.get('x-box-caller') ?? '');
const denied = () => Response.json({ error: 'Only the owner can do this.' }, { status: 403 });

/** Where a photo goes to be described, in words the Find page shows. It must match the code in find.ts. */
function privacy(secret: Secret) {
  const url = maybe(secret, 'FIND_OLLAMA_URL');
  const host = url ? new URL(url).hostname : '';
  const here = ['127.0.0.1', 'localhost', '::1', 'host.lima.internal'].includes(host);
  const parts = [
    url ? (here ? 'Photos are described by a model on this computer.' : `Photos are described by a model on ${host}.`) : 'No local photo model is set, so photos are found by file name until you set one.',
    ...(maybe(secret, 'VULTR_INFERENCE_KEY') ? ["If that model does not answer, a photo is sent to Vultr's hosted model."] : []),
    'Claude sees a photo only when you press Describe with Claude.',
    ...(mossToken(secret) ? [inferenceOn() ? 'Faster answers are on: each question you ask, with the few notes that match it, is sent to Moss to write the answer. Nothing else leaves.' : 'Faster answers with Moss are available but off.'] : []),
  ];
  return parts.join(' ');
}

/** The Moss Inference key, if the owner added one. A whole `id:key` token, or a key for this project. */
const mossToken = (secret: Secret) => {
  const key = maybe(secret, 'MOSS_INFERENCE_API_KEY');
  return key && (key.includes(':') ? key : `${maybe(secret, 'MOSS_PROJECT_ID')}:${key}`);
};
const mossAnswering = (secret: Secret) => !!mossToken(secret) && inferenceOn();

/**
 * Find the notes that match, then write an answer from them. `engine` local is the default and sends nothing anywhere.
 * `moss` needs the owner's key and switch (otherwise it refuses); `auto` is moss when that is on, else local.
 * `spec` limits memory and task notes to what a task's permissions allow; the owner (no spec) sees everything.
 */
async function answer(secret: Secret, input: { query?: unknown; engine?: unknown; fast?: unknown }, spec?: { workspace?: string; tools?: string[]; hosts?: string[] }) {
  const q = String(input.query ?? '').trim();
  if (!q) throw new Error('query is required');
  const asked = String(input.engine ?? 'local');
  const engine: Engine = asked === 'auto' ? (mossAnswering(secret) ? 'moss' : 'local') : asked === 'moss' ? 'moss' : 'local';
  if (engine === 'moss' && !mossAnswering(secret)) throw new Error(mossToken(secret) ? 'Moss Inference is off. Turn it on in Find first.' : 'No Moss Inference key is set.');
  const t0 = performance.now();
  const found = await query(secret, q, 8, undefined, input.fast === true || input.fast === 'true' || input.fast === '1');
  const notes = found.hits
    .filter((h) => !spec || !['memory', 'task'].includes(h.metadata.kind) || allowed(h.metadata, { title: '', prompt: q, ...spec }))
    .slice(0, 4)
    .map((h) => ({ id: h.id, text: h.text }));
  const t1 = performance.now();
  const url = maybe(secret, 'FIND_OLLAMA_URL');
  let r: Awaited<ReturnType<typeof answerLocal>> & { usage?: { prompt_tokens?: number; completion_tokens?: number } };
  if (engine === 'moss') {
    countMossAnswer();
    r = await answerMoss(q, notes, mossToken(secret)!, maybe(secret, 'MOSS_INFERENCE_URL'));
  } else {
    r = await answerLocal(q, notes, url ? { base: url.replace(/\/+$/, ''), model: maybe(secret, 'FIND_OLLAMA_MODEL') || MODELS[0].model } : undefined);
  }
  const t2 = performance.now();
  return {
    question: q,
    answer: r.answer,
    engine,
    via: r.via,
    sources: notes.map((n) => n.id),
    ms: { search: round(t1 - t0), answer: round(t2 - t1), total: round(t2 - t0) },
    leaves: engine === 'moss' ? `The question and ${notes.length} matching note${notes.length === 1 ? '' : 's'} went to Moss to write the answer.` : url && notes.length ? 'Nothing left this computer except to your own Ollama.' : 'Nothing left this computer.',
    ...(r.usage ? { usage: r.usage } : {}),
  };
}

let undescribed: { workspace: string; path: string }[] = []; // from the last scan: photos no model could describe

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
    undescribed = failed;
    return { docs: docs.size, failed };
  })().finally(() => (busy = undefined));
  return busy;
}

const summaries = new Map<string, string>(); // task id -> Droid's final message

export default {
  name: 'find',
  title: 'Find',
  description: 'Search your photos, files and past tasks by what is in them, like "the whiteboard photo".',
  // FACTORY_API_KEY: only checked for presence before starting a Claude describe task; its value is never read here.
  secrets: [...MOSS, 'FIND_OLLAMA_URL', 'FIND_OLLAMA_MODEL', 'VULTR_INFERENCE_KEY', 'FACTORY_API_KEY', 'MOSS_INFERENCE_API_KEY', 'MOSS_INFERENCE_URL'],

  // Before every task starts, the core asks for what we remember: the owner's preferences, and the few notes from
  // earlier tasks that match its prompt and that this task's permissions allow.
  async taskContext(spec, box) {
    const { text, ids } = await recall(spec, async (q, topK, kind) => {
      const r = await query(box.secret, q, topK, kind);
      return r.hits.filter((h) => h.score >= (r.used === 'moss' ? 0.3 : 0.05)).map((h) => ({ score: h.score, doc: h }));
    });
    if (ids.length) box.note({ memory: 'handed', ids });
    return text;
  },
  triggers: [
    {
      name: 'index',
      start(box) {
        box.workspace('photos', new URL('./photos/', import.meta.url).pathname); // the test photos, the first time only
        // Earlier versions indexed the box's own describe tasks; they are housekeeping, not history.
        void drop([...docs.values()].filter((d) => d.metadata.kind === 'task' && (d.metadata.source === 'find' || /^guest(-run)?:/.test(d.metadata.source ?? '') || d.metadata.workspace === 'guest')).map((d) => d.id));
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
        if (t.source !== 'find' && !isGuest(t)) {
          await put({
            id: `task:${t.id}`,
            text: `Task "${t.title}" (${e.state}): ${what.slice(0, 1500)}`,
            // A task that could reach the outside is untrusted: its note is for the owner to read, never handed to an agent.
            metadata: { kind: 'task', memkind: 'lesson', trust: clean(t) ? 'task' : 'untrusted', task: t.id, title: t.title, state: e.state, source: t.source, ...scope(t) },
          });
        }
        if (e.state !== 'failed') void indexNow(box).catch(() => {}); // a failed task's files are not applied
      },
    },
  ],

  modelJobs: [
    /** The owner's standing preferences, as plain sentences, for an app's own code to check ("never buy from X"). */
    { name: 'find.preferences', run: async () => preferences().map((p) => p.text) },
    /** Describe one photo, for any track: { file } -> { text, model, ms }. */
    { name: 'find.describe', secrets: ['FIND_OLLAMA_URL', 'VULTR_INFERENCE_KEY'], run: (input: { file: string }, ctx) => describeAny(input.file, ctx.secret) },
  ],

  tools: [
    remember,
    {
      name: 'find.answer',
      description: 'Ask a question and get a one or two sentence answer from the notes GurtOS has: files, photo descriptions and notes you may know about. Nothing leaves this computer.',
      input: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
      secrets: [...MOSS, 'FIND_OLLAMA_URL', 'FIND_OLLAMA_MODEL'],
      async run(input: { query?: string }, ctx) {
        if (ctx.task && isGuest(ctx.task)) throw new Error('a guest task cannot ask the owner\'s notes');
        return answer(ctx.secret, { query: input.query, engine: 'local' }, ctx.task);
      },
    },
    {
      name: 'find.answerFast',
      description: 'Like find.answer, but Moss Inference writes the answer, which is faster. Only works when the owner has turned Moss Inference on. The question and the few matching notes go to Moss. It costs a fraction of a cent.',
      input: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
      secrets: [...MOSS, 'MOSS_INFERENCE_API_KEY', 'MOSS_INFERENCE_URL'],
      // List price: about 0.04 cents of tokens plus 0.05 cents for the search it does not do here; 0.15 covers the larger answers.
      cost: () => 0.15,
      async run(input: { query?: string }, ctx) {
        if (ctx.task && isGuest(ctx.task)) throw new Error('a guest task cannot ask the owner\'s notes');
        return answer(ctx.secret, { query: input.query, engine: 'moss' }, ctx.task);
      },
    },
    {
      name: 'find.recall',
      description: 'Look up what GurtOS remembers: the owner\'s preferences and notes from earlier tasks you may know about. Returns the best matches.',
      input: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
      secrets: MOSS,
      async run(input: { query?: string }, ctx) {
        const spec = { title: ctx.task?.title ?? '', prompt: String(input.query ?? ''), source: ctx.task?.source, workspace: ctx.task?.workspace, tools: ctx.task?.tools, hosts: ctx.task?.hosts };
        const { text } = await recall(spec, async (q, topK, kind) => (await query(ctx.secret, q, topK, kind)).hits.map((h) => ({ score: h.score, doc: h })));
        return { memory: text ?? 'Nothing relevant is remembered.' };
      },
    },
    {
      name: 'find.search',
      description:
        'Search everything on this computer by meaning: photos (by what is in them), text files, and past tasks. ' +
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
        return Response.json(await search(box.secret, { query: u.searchParams.get('q'), kind: u.searchParams.get('kind'), topK: u.searchParams.get('k'), fast: u.searchParams.get('mode') === 'fast' }));
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
    // Open a Moss session now, so the next /search?mode=fast answers from Moss. A voice assistant calls this as the person starts talking.
    'POST /warm': async (_req, box) => {
      (await open(box.secret)).warm?.();
      return Response.json({ ok: true });
    },
    // The Find page's button: the owner asks Claude to describe the photos no other model could. It spends model money.
    'POST /describe': (req, box) => {
      if (!owner(req)) return denied();
      try {
        const started = askClaude(box, undescribed);
        return Response.json({ started: started.length });
      } catch (e) {
        return Response.json({ error: (e as Error).message }, { status: 400 });
      }
    },
    // Memory, for the owner: what GurtOS remembers, and the ways to add, trust and forget.
    'GET /memory': (req) => {
      if (!owner(req)) return denied();
      const items = [...docs.values()].filter((d) => d.metadata.kind === 'memory' || (d.metadata.kind === 'task' && d.metadata.source !== 'find'));
      return Response.json({ items: items.map((d) => ({ id: d.id, text: d.text.slice(0, 400), ...d.metadata })) });
    },
    'POST /memory': async (req, box) => {
      if (!owner(req)) return denied();
      try {
        const doc = await addPreference(String((await req.json().catch(() => ({}))).text ?? ''));
        box.note({ memory: 'preference added', id: doc.id });
        return Response.json({ id: doc.id });
      } catch (e) {
        return Response.json({ error: (e as Error).message }, { status: 400 });
      }
    },
    // The owner's OK for a note from a task that reached the outside: from then on agents may be handed it.
    'POST /trust': async (req, box) => {
      if (!owner(req)) return denied();
      const id = String((await req.json().catch(() => ({}))).id ?? '');
      const d = docs.get(id);
      if (!d || d.metadata.kind !== 'task') return Response.json({ error: 'no such task note' }, { status: 404 });
      await put({ ...d, metadata: { ...d.metadata, trust: 'approved' } });
      box.note({ memory: 'trusted by the owner', id });
      return Response.json({ id, trust: 'approved' });
    },
    // Forget one memory, task note, photo or file: out of the local index and the Moss cloud copy, with a log entry (no content).
    'POST /forget': async (req, box) => {
      if (!owner(req)) return denied();
      const id = String((await req.json().catch(() => ({}))).id ?? '');
      const r = await forget(id);
      if (!r) return Response.json({ error: 'nothing is remembered under that id' }, { status: 404 });
      box.note({ forgot: id, kind: r.kind, cloud: r.cloud });
      return Response.json({ id, ...r, message: `Forgotten. ${r.cloud[0].toUpperCase()}${r.cloud.slice(1)}.${id.startsWith('file:') ? ' The file itself is untouched; it will not be described again.' : ''}` });
    },
    // GET /t/find/answer?q=<question>&engine=local|moss|auto&fast=1 : the notes that match, and an answer written from them.
    'GET /answer': async (req, box) => {
      const u = new URL(req.url);
      const engine = u.searchParams.get('engine') ?? 'local';
      if ((engine === 'moss' || (engine === 'auto' && mossAnswering(box.secret))) && !owner(req)) return denied(); // Moss answers cost credit: only the owner's screen or device
      try {
        return Response.json(await answer(box.secret, { query: u.searchParams.get('q'), engine, fast: u.searchParams.get('fast') }));
      } catch (e) {
        return Response.json({ error: (e as Error).message }, { status: 400 });
      }
    },
    // The owner's switch for Moss Inference. It only does anything once a Moss Inference key is in the vault.
    'POST /inference': async (req, box) => {
      if (!owner(req)) return denied();
      const on = (await req.json().catch(() => ({}))).on === true;
      if (on && !mossToken(box.secret)) return Response.json({ error: 'Add a Moss Inference key in Settings first.' }, { status: 400 });
      setInference(on);
      box.note({ inference: on ? 'on' : 'off' });
      return Response.json({ on, privacy: privacy(box.secret) });
    },
    'GET /status': (_req, box) => {
      const count: Record<string, number> = {};
      for (const d of docs.values()) count[d.metadata.kind] = (count[d.metadata.kind] ?? 0) + 1;
      return Response.json({
        offline: OFFLINE,
        cloud: cloudStatus(),
        docs: count,
        undescribed: undescribed.length,
        privacy: privacy(box.secret),
        inference: { key: !!mossToken(box.secret), on: mossAnswering(box.secret) },
        preferences: preferences().length,
        models: MODELS.map((m) => `${m.model}: ${maybe(box.secret, m.needs) ? 'on' : `off until ${m.needs} is set`}`).concat(
          `Claude via a Droid task: ${maybe(box.secret, 'FACTORY_API_KEY') ? 'on request' : 'needs FACTORY_API_KEY'}`,
        ),
      });
    },
  },
} satisfies Track;
