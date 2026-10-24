// /find: what is in every photo, text file and past task on the box, searchable by meaning through Moss.
// A vision model turns each photo into a plain-text description; the description, not the photo, is indexed.
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const HOME = process.env.BOX_HOME ?? '/var/lib/box';
const DIR = path.join(HOME, 'find');
const DEMO = HOME.startsWith('/var/lib/box-demo/');
/** The merge gate makes no Moss or model calls unless DEMO_LIVE names this track. */
export const OFFLINE = DEMO && !(process.env.DEMO_LIVE ?? '').split(/[\s,]+/).includes('find');
/** One Moss index per box, so the laptop and the Vultr box keep their own. */
export const INDEX = `${DEMO ? 'find-demo' : 'find'}-${os.hostname().toLowerCase().replace(/[^a-z0-9-]/g, '-')}`;

export type Doc = { id: string; text: string; metadata: Record<string, string> };
export type Hit = Doc & { score: number };
/** A doc plus the file's size and mtime, so a file is read or described again only when it changes. */
type Entry = Doc & { sig?: string };

// ---------- describing a photo ----------

/** A vision model behind an OpenAI-compatible chat API. `key` names a vault secret. */
export type Model = { model: string; base: string; key?: string };

/** Tried in order; the first that answers describes the photo. */
export const MODELS: Model[] = [
  // Ollama on Ben's Mac, which the laptop box reaches through Lima. The photo never leaves the laptop.
  { model: 'gemma4', base: 'http://host.lima.internal:11434/v1' },
  // Vultr's hosted model, for the Vultr box (no GPU). Needs a Serverless Inference key in its vault.
  { model: 'qwen3.8-27b', base: 'https://api.vultrinference.com/v1', key: 'VULTR_INFERENCE_KEY' },
];
// Claude is the backup when none answers: a Droid task looks at the photos (track.ts).

export const PROMPT =
  'Describe this photo for a search index in two sentences. Start with what kind of thing it is (for example a ' +
  'whiteboard, receipt, product, document, screenshot, person or place), then the main details and any readable ' +
  'text. Then list 8 search keywords.';

const TYPES: Record<string, string> = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif' };
export const photoType = (file: string): string | undefined => TYPES[path.extname(file).toLowerCase()];

/** Describe one photo with one model. Ollama, Vultr and any OpenAI-compatible server take the same call. */
export async function describe(file: string, m: Model, key?: string) {
  if (!photoType(file)) throw new Error(`not a photo: ${path.basename(file)}`); // never send another kind of file to a model
  const t0 = Date.now();
  // shortcut: photos go at full size; a 3 MB photo spent 2.5 s on the prompt in spike 6. Resize to ~1024 px if real photos are slow.
  const url = `data:${photoType(file)};base64,${fs.readFileSync(file).toString('base64')}`;
  const r = await fetch(`${m.base}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(key ? { authorization: `Bearer ${key}` } : {}) },
    body: JSON.stringify({
      model: m.model,
      max_tokens: 300,
      reasoning_effort: 'none', // thinking made gemma4 6 times slower (spike 6)
      messages: [{ role: 'user', content: [{ type: 'text', text: PROMPT }, { type: 'image_url', image_url: { url } }] }],
    }),
    signal: AbortSignal.timeout(60_000), // a cold Ollama loads the model first: about 7 s
  });
  const body = await r.json().catch(() => ({}));
  const text: string | undefined = body.choices?.[0]?.message?.content?.trim();
  if (!r.ok || !text) throw new Error(`${m.model}: ${r.status} ${JSON.stringify(body.error ?? body).slice(0, 200)}`);
  return { text, model: m.model, ms: Date.now() - t0 };
}

export const sha256 = (file: string) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
/** Descriptions a live model wrote for the test photos (record.ts), so the offline demo needs no model. */
const recorded: Record<string, { text: string; model: string; ms: number }> = JSON.parse(
  fs.readFileSync(new URL('./recorded.json', import.meta.url), 'utf8'),
);

const down = new Map<string, number>(); // model -> when to try it again
const inside = (dir: string, file: string) => file.startsWith(dir + path.sep);

/** Try each model in turn. Offline, use the recorded description. Only photos in the box's workspaces. */
export async function describeAny(file: string, secret: (name: string) => string) {
  const real = fs.realpathSync(file);
  if (!['views', 'workspaces'].some((d) => inside(path.join(HOME, d), real))) throw new Error('only photos in a workspace');
  if (OFFLINE) {
    const r = recorded[sha256(file)];
    if (!r) throw new Error('offline demo run: no recorded description for this photo');
    return { ...r, model: `${r.model} (recorded)` };
  }
  const errors: string[] = [];
  for (const m of MODELS) {
    if ((down.get(m.model) ?? 0) > Date.now()) {
      errors.push(`${m.model}: failed in the last 5 minutes`);
      continue;
    }
    try {
      return await describe(real, m, m.key ? secret(m.key) : undefined);
    } catch (e) {
      errors.push((e as Error).message);
      down.set(m.model, Date.now() + 5 * 60_000);
    }
  }
  throw new Error(`no vision model answered: ${errors.join('; ')}`);
}

// ---------- the index ----------

export interface Index {
  kind: 'moss' | 'words';
  add(docs: Doc[]): Promise<unknown>;
  remove(ids: string[]): Promise<unknown>;
  /** `ms` is the time inside the index. */
  query(q: string, topK: number, kind?: string): Promise<{ hits: Hit[]; ms: number }>;
}

/** Moss, run inside the box: it embeds and searches in memory, and keeps a copy of the index in Moss's cloud. */
export async function mossIndex(projectId: string, projectKey: string, name = INDEX): Promise<Index> {
  const { MossClient } = await import('@moss-js/moss'); // loaded only when used, so the offline demo never needs it
  // Moss's own cache (~/.moss, ~/.cache/moss) keeps one device id and one model download per machine, across demo runs.
  const client = new MossClient(projectId, projectKey);
  const session = await client.session(name);
  let timer: NodeJS.Timeout | undefined;
  // Push to the cloud a few seconds after the last change. Only text goes: descriptions, never photos.
  const push = () => {
    clearTimeout(timer);
    timer = setTimeout(() => session.pushIndex().catch((e: Error) => console.error(`find: Moss push failed: ${e.message}`)), 5000);
  };
  return {
    kind: 'moss',
    add: async (docs) => (await session.addDocs(docs), push()),
    remove: async (ids) => (await session.deleteDocs(ids), push()),
    async query(q, topK, kind) {
      const r = await session.query(q, { topK, ...(kind && { filter: { field: 'kind', condition: { $eq: kind } } }) });
      return { hits: r.docs.map((d) => ({ id: d.id, text: d.text, metadata: d.metadata ?? {}, score: d.score })), ms: r.timeTakenInMs ?? 0 };
    },
  };
}

/** For offline demo runs and a box with no Moss keys: rank by how many of the query's words a doc has. */
export function wordIndex(): Index {
  const docs = new Map<string, Doc & { words: Set<string> }>();
  const words = (s: string) => new Set(s.toLowerCase().match(/[a-z0-9]{3,}/g));
  return {
    kind: 'words',
    add: async (list) => list.forEach((d) => docs.set(d.id, { ...d, words: words(d.text) })),
    remove: async (ids) => ids.forEach((id) => docs.delete(id)),
    async query(q, topK, kind) {
      const t0 = performance.now();
      const want = [...words(q)];
      const hits = [...docs.values()]
        .filter((d) => !kind || d.metadata.kind === kind)
        .map(({ words: have, ...d }) => ({ ...d, score: want.filter((w) => have.has(w)).length / (want.length || 1) }))
        .filter((h) => h.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, topK);
      return { hits, ms: performance.now() - t0 };
    },
  };
}

// ---------- what is indexed: docs.json is the truth, the index is rebuilt from it at boot ----------

const DOCS = path.join(DIR, 'docs.json');
export const docs = new Map<string, Entry>(
  fs.existsSync(DOCS) ? JSON.parse(fs.readFileSync(DOCS, 'utf8')).map((d: Entry) => [d.id, d]) : [],
);
let index: Index | undefined;
const plain = ({ id, text, metadata }: Entry): Doc => ({ id, text, metadata });

function save() {
  fs.mkdirSync(DIR, { recursive: true, mode: 0o700 });
  fs.writeFileSync(DOCS + '.tmp', JSON.stringify([...docs.values()]));
  fs.renameSync(DOCS + '.tmp', DOCS); // a power cut leaves the old file or the new one, never half of one
}

/** Add or replace a doc. `persist: false` leaves saving to the caller, for many docs at once. */
export async function put(doc: Entry, persist = true) {
  docs.set(doc.id, doc);
  if (persist) save();
  await index?.add([plain(doc)]);
}

async function drop(ids: string[]) {
  ids.forEach((id) => docs.delete(id));
  save();
  await index?.remove(ids);
}

/** Use this index from now on, starting with everything already described. */
export async function use(i: Index) {
  index = i; // first, so a doc put during the add below still reaches it
  await i.add([...docs.values()].map(plain));
  return i;
}

// ---------- scanning the workspaces ----------

/** A workspace as it is now (base plus done tasks). A workspace made since boot has no view yet; its base is the same. */
export function root(ws: string) {
  const view = path.join(HOME, 'views', ws);
  const mounts = fs.existsSync('/proc/self/mountinfo') ? fs.readFileSync('/proc/self/mountinfo', 'utf8') : '';
  return mounts.includes(` ${view} `) ? view : path.join(HOME, 'workspaces', ws);
}

function* walk(dir: string, rel = ''): Generator<string> {
  for (const e of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) {
    if (e.name.startsWith('.') || e.name === 'node_modules') continue;
    const r = path.join(rel, e.name);
    if (e.isDirectory()) yield* walk(dir, r);
    else if (e.isFile()) yield r;
  }
}

/** The start of a text file, or undefined for a binary or large one. */
function readText(file: string, size: number) {
  if (size > 200_000) return undefined;
  const buf = fs.readFileSync(file);
  if (buf.subarray(0, 8000).includes(0)) return undefined;
  // shortcut: only the first 2000 characters are indexed; split long files into chunks if search misses their ends.
  return buf.toString('utf8', 0, 8000).slice(0, 2000);
}

type Described = { text: string; model: string; ms: number };

/**
 * Index every workspace's photos and text files that are new or changed, and drop the ones that are gone.
 * Returns the photos no model could describe.
 */
export async function scan(describePhoto: (file: string, ws: string, rel: string) => Promise<Described>, onDescribed?: (d: Doc) => void) {
  const seen = new Set<string>();
  const failed: { workspace: string; path: string; error: string }[] = [];
  let changed = false;

  async function workspace(ws: string) {
    const dir = root(ws);
    for (const rel of walk(dir)) {
      const id = `file:${ws}/${rel}`;
      const file = path.join(dir, rel);
      const st = fs.statSync(file);
      const sig = `${st.size}:${st.mtimeMs}`;
      seen.add(id);
      if (docs.get(id)?.sig === sig) continue;
      const metadata: Record<string, string> = { kind: photoType(rel) ? 'photo' : 'file', workspace: ws, path: rel };
      let text: string | undefined;
      if (photoType(rel)) {
        try {
          const d = await describePhoto(file, ws, rel);
          [text, metadata.model, metadata.ms] = [d.text, d.model, String(d.ms)];
        } catch (e) {
          failed.push({ workspace: ws, path: rel, error: (e as Error).message });
          continue; // keeps any older description, tries again next scan
        }
      } else {
        text = readText(file, st.size);
        if (text === undefined) continue;
      }
      const doc = { id, text: `${ws}/${rel}: ${text}`, metadata, sig };
      await put(doc, metadata.kind === 'photo'); // a photo is saved at once: describing it again is slow
      changed = true;
      if (metadata.kind === 'photo') onDescribed?.(doc);
    }
  }

  for (const ws of fs.readdirSync(path.join(HOME, 'workspaces'))) {
    try {
      await workspace(ws);
    } catch (e) {
      // It changed under the scan, for example an undo remounting its view: keep what it had, read it next time.
      console.error(`find: could not read workspace ${ws}: ${(e as Error).message}`);
      for (const id of docs.keys()) if (id.startsWith(`file:${ws}/`)) seen.add(id);
    }
  }
  if (changed) save();
  const gone = [...docs.keys()].filter((id) => id.startsWith('file:') && !seen.has(id));
  if (gone.length) await drop(gone);
  return failed;
}
