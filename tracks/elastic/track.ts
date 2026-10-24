// The Elastic track: every line of the box's action log becomes one document in Elastic Serverless (index
// box-actions), and an Elastic Agent Builder agent (agent.ts) answers questions about it in plain words.
// The log reader turns each event into a document and appends it to an outbox file, fsynced. A flusher sends
// the outbox to Elastic in _bulk batches and remembers how far it got, so a hard kill or an Elastic outage loses
// nothing. Only the `elastic.bulk` job reads the Elastic key, inside the core.
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import type { Box, LogEvent, Task, Track } from '../../core/contract.ts';

export const INDEX = 'box-actions';
const HOME = path.resolve(process.env.BOX_HOME ?? '/var/lib/box');
const installed = HOME === '/var/lib/box';
// Two Lima VMs both call themselves lima-box, so the machine id is what keeps their documents apart.
const machine = (() => {
  try {
    return fs.readFileSync('/etc/machine-id', 'utf8').trim().slice(0, 12) || os.hostname();
  } catch {
    return os.hostname();
  }
})();
/** Which box and run a document came from. The installed box is run 'installed'; a ./demo run is its run id. */
export const BOX = { name: process.env.BOX_NAME ?? os.hostname(), machine, run: installed ? 'installed' : path.basename(HOME) };
export const OUTBOX = path.join(HOME, 'elastic', 'outbox.ndjson');
const SENT = path.join(HOME, 'elastic', 'sent'); // bytes of the outbox already in Elastic

// Only the installed box ships, and a ./demo run with DEMO_LIVE=elastic. Dev and test boxes with their own
// BOX_HOME stay out of the index. A demo (DEMO_LIVE set, maybe empty) keeps its whole outbox for the demo step.
const inDemo = process.env.DEMO_LIVE !== undefined;
const live = installed || (process.env.DEMO_LIVE ?? '').split(/[\s,]+/).includes('elastic');

const kw = { type: 'keyword' };
const text = { type: 'text' };
export const MAPPING = {
  dynamic: false, // anything not listed stays in _source only (event.original, for example)
  properties: {
    '@timestamp': { type: 'date' },
    message: text,
    app: kw,
    cost_cents: { type: 'double' },
    error: { type: 'keyword', ignore_above: 1024, fields: { text } },
    summary: text,
    event: { properties: { seq: { type: 'long' }, type: kw } },
    box: { properties: { name: kw, machine: kw, run: kw } },
    task: {
      properties: {
        id: kw, title: { type: 'keyword', fields: { text } }, source: kw, workspace: kw, worker: kw, state: kw,
        hosts: kw, tools: kw, budget_cents: { type: 'double' }, user: kw, prompt: text,
      },
    },
    step: { properties: { text } },
    tool: { properties: { name: kw, track: kw, key: kw, ok: { type: 'boolean' }, input: text, output: text, error: { type: 'keyword', ignore_above: 1024 } } },
    approval: { properties: { id: kw, question: text, cost_cents: { type: 'double' }, state: kw, approved: { type: 'boolean' }, by: kw } },
    cost: { properties: { what: kw, model: kw, tokens: { properties: { input: { type: 'long' }, output: { type: 'long' }, cache_write: { type: 'long' }, cache_read: { type: 'long' } } } } },
    net: { properties: { host: kw, domain: kw } },
    files: { properties: { added: kw, modified: kw, deleted: kw, count: { type: 'integer' } } },
    note: { properties: { track: kw, kind: kw, data: text } },
  },
};

type Change = { path: string; change: 'added' | 'modified' | 'deleted' };
const json = (v: unknown, max = 2000) => (v === undefined ? undefined : JSON.stringify(v).slice(0, max));
const usd = (cents: number) => `$${(cents / 100).toFixed(2)}`;

/**
 * One log event as one flat document. `t` is the task as the box knows it now; only its fixed fields
 * (title, source, workspace, worker, hosts, tools, budget) are copied, so every document says whose it is.
 */
export function toDoc(e: LogEvent, t?: Task, extra: { tool?: string; changes?: Change[] } = {}) {
  const title = t ? `"${t.title}"` : 'the box';
  const d: Record<string, any> = {
    '@timestamp': e.at,
    event: { seq: e.seq, type: e.type, original: json(e, 8000) },
    box: BOX,
    app: e.type === 'note' ? e.track : t?.source.split(':')[0],
  };
  if (t) {
    d.task = { id: t.id, title: t.title, source: t.source, workspace: t.workspace, worker: t.worker, hosts: t.hosts, tools: t.tools, budget_cents: t.budgetCents };
  }
  switch (e.type) {
    case 'task.created':
      Object.assign(d.task ?? (d.task = { id: e.task, title: e.spec.title, source: e.spec.source }), { user: e.user, prompt: e.spec.prompt.slice(0, 4000) });
      d.app ??= e.spec.source.split(':')[0];
      d.message = `Task ${title} was created by ${e.spec.source}: worker ${e.spec.worker}, hosts ${e.spec.hosts.join(', ') || 'none'}, budget ${usd(e.spec.budgetCents)}`;
      break;
    case 'task.state': {
      d.task = { ...d.task, state: e.state };
      d.error = e.error;
      d.summary = e.summary;
      const c = extra.changes ?? [];
      const by = (k: Change['change']) => c.filter((x) => x.change === k).map((x) => x.path).slice(0, 200);
      if (e.state === 'done') d.files = { added: by('added'), modified: by('modified'), deleted: by('deleted'), count: c.length };
      const changed = c.length ? `, changing ${c.length} file${c.length > 1 ? 's' : ''}: ${c.slice(0, 10).map((x) => `${x.path} (${x.change})`).join(', ')}` : '';
      const said: Record<string, string> = {
        queued: 'is queued', running: 'is running', waiting: 'is waiting for an OK', done: 'is done',
        undone: 'was undone: its file changes were removed', failed: `failed: ${e.error ?? 'no reason given'}; its file changes were not applied`,
      };
      d.message = `Task ${title} ${said[e.state]}${changed}${e.summary ? `. Summary: ${e.summary}` : ''}`;
      break;
    }
    case 'task.step':
      d.step = { text: e.text.slice(0, 4000) };
      d.message = `${title}: ${e.text.slice(0, 500)}`;
      break;
    case 'tool.call':
      d.tool = { name: e.tool, track: e.tool.split('.')[0], key: e.key, input: json(e.input) };
      d.message = `${title} called ${e.tool} with ${json(e.input, 300)}`;
      break;
    case 'tool.result': {
      const name = extra.tool;
      d.tool = { name, track: name?.split('.')[0], key: e.key, ok: e.ok, output: json(e.output), error: e.error };
      d.cost_cents = e.cents;
      d.message = `${name ?? 'A tool'} ${e.ok ? 'returned' : `failed (${e.error})`} for ${title}${e.cents ? `, spending ${usd(e.cents)}` : ''}`;
      break;
    }
    case 'approval.asked':
      d.approval = { id: e.approval.id, question: e.approval.question, cost_cents: e.approval.costCents, state: 'pending' };
      d.message = `${title} paused to ask: ${e.approval.question}`;
      break;
    case 'approval.answered':
      d.approval = { id: e.id, approved: e.approved, by: e.by, state: e.approved ? 'approved' : 'denied' };
      d.message = `${e.by} ${e.approved ? 'approved' : 'denied'} the request from ${title} (${e.id})`;
      break;
    case 'cost': {
      const k = e.tokens;
      d.cost_cents = e.cents;
      d.cost = { what: e.what, model: e.model, tokens: k && { input: k.input, output: k.output, cache_write: k.cacheWrite, cache_read: k.cacheRead } };
      d.message = `${title} spent ${usd(e.cents)} on ${e.what}${e.model ? ` (${e.model})` : ''}`;
      break;
    }
    case 'net.blocked':
      d.net = { host: e.host, domain: e.host.replace(/:\d+$/, '') };
      d.message = `The box blocked ${title} from reaching ${e.host}; it may reach only ${t?.hosts.join(', ') || 'no hosts'}`;
      break;
    case 'note': {
      const kind = (e.data as { kind?: unknown })?.kind;
      d.note = { track: e.track, kind: typeof kind === 'string' ? kind : undefined, data: json(e.data, 4000) };
      d.message = `${e.track} noted ${typeof kind === 'string' ? kind : 'something'}${t ? ` for ${title}` : ''}: ${json(e.data, 300)}`;
      break;
    }
  }
  return d;
}

/** A small JSON client for Elasticsearch and Kibana. A string body goes as NDJSON (_bulk). Throws on any status but 2xx. */
export function client(base: string, apiKey: string) {
  return async <T = any>(method: string, p: string, body?: unknown): Promise<T> => {
    const ndjson = typeof body === 'string';
    const r = await fetch(base.replace(/\/$/, '') + p, {
      method,
      headers: { authorization: `ApiKey ${apiKey}`, 'content-type': ndjson ? 'application/x-ndjson' : 'application/json', 'kbn-xsrf': 'true' },
      body: body === undefined || ndjson ? (body as string | undefined) : JSON.stringify(body),
    });
    const reply = await r.text();
    if (!r.ok) throw Object.assign(new Error(`${method} ${p}: ${r.status} ${reply.slice(0, 500)}`), { status: r.status });
    return (reply ? JSON.parse(reply) : {}) as T;
  };
}

type Es = ReturnType<typeof client>;
/** Make the index with its mapping, or add new fields to an existing one. Safe to repeat. */
export async function ensureIndex(es: Es) {
  try {
    await es('PUT', `/${INDEX}`, { mappings: MAPPING });
  } catch (e) {
    if (!/resource_already_exists/.test((e as Error).message)) throw e;
    await es('PUT', `/${INDEX}/_mapping`, MAPPING);
  }
}

/** What a done task changed, from the box's own API. Connection errors throw so the reader retries. */
function changes(id: string): Promise<Change[]> {
  return new Promise((resolve, reject) => {
    http
      .get({ socketPath: path.join(HOME, 'api.sock'), path: `/tasks/${id}/diff` }, (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => {
          try {
            resolve(res.statusCode === 200 ? JSON.parse(body).changes : []);
          } catch (e) {
            reject(e);
          }
        });
      })
      .on('error', reject); // the API is not up yet at boot: the reader tries again in 5 s
  });
}

// shortcut: tool.result has no tool name, so it comes from the tool.call just before it, kept in memory. A restart
// between the two loses the name on that one result; the cost and the task are still right.
const toolOf = new Map<string, string>();

/** Send the outbox from where Elastic left off, 4 MB at a time. One runs at a time; a failure retries in 5 s. */
let flushing = false;
async function flush(box: Box) {
  if (flushing) return;
  flushing = true;
  try {
    for (;;) {
      const size = fs.statSync(OUTBOX).size;
      let sent = fs.existsSync(SENT) ? Number(fs.readFileSync(SENT, 'utf8')) : 0;
      if (!(sent <= size)) sent = 0; // a torn or stale offset: send it all again, the ids make that harmless
      const buf = Buffer.alloc(Math.min(size - sent, 4 << 20));
      const fd = fs.openSync(OUTBOX, 'r');
      fs.readSync(fd, buf, 0, buf.length, sent);
      fs.closeSync(fd);
      const end = buf.lastIndexOf(10) + 1; // whole lines only
      if (!end) return;
      const r = (await box.job('elastic.bulk', { lines: buf.subarray(0, end).toString() })) as { skipped?: string };
      if (r.skipped) {
        // No Elastic keys on this box: keep nothing, so the outbox cannot grow. A demo keeps it for its checks.
        // shortcut: events from before the keys are added are never sent; delete cursors/elastic.docs to backfill.
        if (!inDemo) fs.truncateSync(OUTBOX, 0), fs.writeFileSync(SENT, '0');
        return;
      }
      if (!inDemo && sent + end === fs.statSync(OUTBOX).size) {
        fs.writeFileSync(SENT, '0'); // all sent: start the outbox over. Offset first, so a crash here only resends.
        fs.truncateSync(OUTBOX, 0);
      } else fs.writeFileSync(SENT, String(sent + end));
    }
  } catch (e) {
    console.error(`elastic: shipping failed, retrying in 5 s: ${(e as Error).message}`);
    setTimeout(() => void flush(box), 5000).unref();
  } finally {
    flushing = false;
  }
}

let ready: Promise<void> | undefined;

export default {
  name: 'elastic',

  logReaders: [
    {
      name: 'docs', // was 'ship': the new name gets a fresh cursor, so each box sends its whole log once with the new ids
      async read(e: LogEvent, box: Box) {
        if (!live && !inDemo) return; // a dev box: nothing to keep
        const t = e.task ? box.task(e.task) : undefined;
        const key = e.type === 'tool.call' || e.type === 'tool.result' ? `${e.task}.${e.key}` : '';
        if (e.type === 'tool.call') toolOf.set(key, e.tool);
        const extra = {
          tool: toolOf.get(key),
          changes: e.type === 'task.state' && e.state === 'done' ? await changes(e.task) : undefined,
        };
        if (e.type === 'tool.result') toolOf.delete(key);
        // The same event twice gets the same id, so a resend overwrites itself: no duplicates.
        const line = JSON.stringify({ _id: `${BOX.machine}:${BOX.run}:${e.seq}`, ...toDoc(e, t, extra) }) + '\n';
        fs.mkdirSync(path.dirname(OUTBOX), { recursive: true });
        const fd = fs.openSync(OUTBOX, 'a');
        fs.writeSync(fd, line);
        fs.fsyncSync(fd);
        fs.closeSync(fd);
        if (live) void flush(box);
      },
    },
  ],

  // A job, not a reader, holds the key: jobs run in the core with vault access, and readers have none.
  modelJobs: [
    {
      name: 'elastic.bulk',
      secrets: ['ELASTIC_URL', 'ELASTIC_API_KEY'],
      async run(input: { lines: string }, ctx) {
        let url: string, key: string;
        try {
          [url, key] = [ctx.secret('ELASTIC_URL'), ctx.secret('ELASTIC_API_KEY')];
        } catch {
          url = key = '';
        }
        if (!url.trim() || !key.trim()) return { skipped: 'the vault has no ELASTIC_URL or ELASTIC_API_KEY' };
        const es = client(url, key);
        ready ??= ensureIndex(es).catch((e) => ((ready = undefined), Promise.reject(e)));
        await ready;
        if (installed && /"event":\{"seq":1,/.test(input.lines)) {
          // Sending from seq 1 again (a new box, or the upgrade to machine ids): drop this box's documents from the
          // first version, whose ids had no machine, so nothing is counted twice.
          const old = [{ term: { 'box.name': os.hostname() } }, { term: { 'box.run': 'installed' } }];
          await es('POST', `/${INDEX}/_delete_by_query`, { query: { bool: { filter: old, must_not: [{ exists: { field: 'box.machine' } }] } } });
        }
        const body = input.lines.split('\n').filter(Boolean).flatMap((l) => {
          const { _id, ...doc } = JSON.parse(l);
          return [JSON.stringify({ index: { _index: INDEX, _id } }), JSON.stringify(doc)];
        });
        const r = await es<{ errors: boolean; items: { index: { _id: string; status: number; error?: { reason?: string } } }[] }>('POST', '/_bulk', body.join('\n') + '\n');
        const bad = r.items.filter((i) => i.index.error);
        if (bad.some((i) => i.index.status === 429 || i.index.status >= 500)) throw new Error(`Elastic is busy: ${bad[0].index.status}`);
        // A document Elastic refuses for good (a 4xx) would block every one after it, so log it and go on.
        for (const i of bad) console.error(`elastic: refused ${i.index._id}: ${i.index.error?.reason}`);
        return { indexed: r.items.length - bad.length };
      },
    },
  ],
} satisfies Track;
