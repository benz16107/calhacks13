// The Elastic track. Every line of the box's action log becomes one document in Elastic Serverless, written with a
// key that can only CREATE documents, so what Elastic holds is a copy the box (and anyone with root on it) cannot
// rewrite. On top of that copy an Elastic Agent Builder agent answers questions (agent.ts), the box checks its own
// log against it, and Elastic's agent and alert rules can ask the owner to undo a task. They ask; the box's one
// approval path decides. README.md says which part is the OS and which is Elastic.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import type { Box, LogEvent, Track } from '../../core/contract.ts';
import { compareChains, esql, first, hashesFromDocs, localChain, remoteHashes, type Verdict } from './chain.ts';
import { BOX, DIR, HOME, INDEX, inDemo, live, OUTBOX, REQUESTS, toDoc } from './docs.ts';
import { client, type Es } from './es.ts';

export { BOX, INDEX, MAPPING, OUTBOX, toDoc } from './docs.ts';
export { client } from './es.ts';

const SENT = path.join(DIR, 'sent'); // bytes of the outbox already in Elastic
const SECRETS = ['ELASTIC_URL', 'ELASTIC_BOX_KEY', 'ELASTIC_BOX_LABEL', 'ELASTIC_ASK_KEYS', 'KIBANA_URL'];
const AGENT_ID = 'gurtos-log';

type Change = { path: string; change: 'added' | 'modified' | 'deleted' };

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

/** The box's own Elasticsearch client, from the vault. Undefined on a box without the Elastic keys. */
function esFor(box: Box): Es | undefined {
  try {
    const [url, key] = [box.secret('ELASTIC_URL').trim(), box.secret('ELASTIC_BOX_KEY').trim()];
    return url && key ? client(url, key) : undefined;
  } catch {
    return undefined;
  }
}

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
        // shortcut: events from before the keys are added are never sent; delete cursors/elastic.chain to resend them.
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

// ---------- the box checks its own log against Elastic's copy ----------

const outboxDocs = () => (fs.existsSync(OUTBOX) ? fs.readFileSync(OUTBOX, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []);

/** Compare the log file as it is now with what Elastic holds (in an offline demo, with the outbox standing in for it). */
export async function verifyNow(box: Box): Promise<Verdict & { source: 'elastic' | 'outbox' }> {
  const { hashes, breaks } = localChain(path.join(HOME, 'log.jsonl'));
  const es = live ? esFor(box) : undefined;
  if (live && !es) throw new Error('this box has no Elastic keys');
  const remote = es ? await remoteHashes(es, BOX.machine, BOX.run) : hashesFromDocs(outboxDocs(), BOX.machine, BOX.run);
  return { ...compareChains(hashes, remote, breaks), source: es ? 'elastic' : 'outbox' };
}

let lastNote = { sig: '', at: 0 };
/** Check, and write the answer into the log (so it ships to Elastic too) when it changed or an hour has passed. */
async function checkAndRecord(box: Box) {
  const v = await verifyNow(box);
  const sig = JSON.stringify([v.ok, v.edited, v.missing, v.reordered, v.localBreaks]);
  if (sig !== lastNote.sig || Date.now() - lastNote.at > 3600_000) {
    box.note({ kind: 'integrity', ok: v.ok, checked: v.checked, throughSeq: v.throughSeq, pending: v.pending, edited: v.edited.slice(0, 200), missing: v.missing.slice(0, 200), reordered: v.reordered.slice(0, 200), localBreaks: v.localBreaks.slice(0, 200) });
    lastNote = { sig, at: Date.now() };
  }
  return v;
}

// ---------- requests from Elastic: the box asks, the owner answers ----------

interface Request { _id: string; '@timestamp': string; action: string; task?: string; rule?: string; reason?: string }
const STATE = path.join(DIR, 'requests.json');
const readState = (): { since: string; done: string[] } => {
  try {
    return JSON.parse(fs.readFileSync(STATE, 'utf8'));
  } catch {
    return { since: new Date(Date.now() - 60_000).toISOString(), done: [] };
  }
};
const oneLine = (s: unknown, n: number) => String(s ?? '').replace(/\s+/g, ' ').replace(/"/g, "'").slice(0, n);

/**
 * Turn one request into a task whose only step is to ask. It goes through the box's approval path, so the policy
 * routes it, the phones get the push, and the answer is logged with who gave it. Nothing happens until someone approves.
 */
async function ask(box: Box, r: Request) {
  const target = r.task ? box.task(r.task) : undefined;
  const by = r.action === 'alert' ? `Elastic alert "${oneLine(r.rule, 60)}"` : "Elastic's agent";
  const why = oneLine(r.reason, 200) || 'no reason given';
  if (r.action === 'undo' || (r.action === 'alert' && target)) {
    if (!target || target.state === 'undone') return; // nothing to undo
    const source = `elastic:undo:${target.id}`;
    if (box.tasks().some((t) => t.source === source && ['queued', 'running', 'waiting'].includes(t.state))) return; // already asking
    box.workspace('elastic');
    await box.createTask({ title: `${by} asks to undo "${oneLine(target.title, 80)}"`, prompt: `ask ${by} asks to undo the task "${oneLine(target.title, 80)}". Why: ${why}. Undo it and remove its changes?`, workspace: 'elastic', worker: 'fake', source });
  } else if (r.action === 'alert') {
    box.workspace('elastic');
    await box.createTask({ title: `${by}: ${oneLine(why, 60)}`, prompt: `ask ${by}: ${why}. Acknowledge?`, workspace: 'elastic', worker: 'fake', source: `elastic:alert:${oneLine(r.rule, 40)}` });
  }
}

async function poll(box: Box) {
  const es = esFor(box);
  if (!es) return;
  const st = readState();
  const rows = (await esql(es, `FROM ${REQUESTS} METADATA _id | WHERE box.machine == ?m AND @timestamp > TO_DATETIME(?since) | SORT @timestamp ASC | LIMIT 50`, [{ m: BOX.machine }, { since: st.since }])) as Request[];
  for (const r of rows) {
    // One alert request per task: three rules can fire on the same attack, and a denied request is not asked again.
    const dedupe = r.action === 'alert' && r.task ? `alert:${r.task}` : r._id;
    if (st.done.includes(r._id) || st.done.includes(dedupe)) continue;
    // A request is only a question for the owner. A bad one (an unknown action or task) is dropped, not answered.
    await ask(box, r).catch((e) => console.error(`elastic: request ${r._id} failed: ${(e as Error).message}`));
    st.done = [...st.done.slice(-498), r._id, dedupe];
    st.since = new Date(Date.parse(r['@timestamp']) - 1000).toISOString();
    fs.mkdirSync(DIR, { recursive: true });
    fs.writeFileSync(STATE, JSON.stringify(st));
  }
}

// ---------- the Ask page and route ----------

/** Ask the agent as one person. Their key sees only what their role allows, so the answer cannot say more. */
async function askAgent(box: Box, person: string, question: string, conversation?: string) {
  const keys = JSON.parse(box.secret('ELASTIC_ASK_KEYS') || '{}') as Record<string, string>;
  const key = keys[person];
  if (!key) throw Object.assign(new Error(`${person === 'owner' ? 'The owner' : person} has no Elastic seat yet`), { status: 403 });
  const r = await client(box.secret('KIBANA_URL'), key)<{ conversation_id?: string; response: { message: string }; steps?: { tool_id?: string }[] }>('POST', '/api/agent_builder/converse', { agent_id: AGENT_ID, input: question, ...(conversation ? { conversation_id: conversation } : {}) });
  return { answer: r.response.message, conversation: r.conversation_id, tools: (r.steps ?? []).flatMap((s) => (s.tool_id ? [s.tool_id] : [])) };
}

let labelled = false;

export default {
  name: 'elastic',
  description: 'Streams every action to Elastic in a copy the box cannot rewrite, and lets an Elastic agent answer questions about it and ask you to undo a task.',
  secrets: SECRETS,

  logReaders: [
    {
      name: 'chain', // was 'ship', then 'docs': a new name gives each box a fresh cursor, so it sends its whole log once with hashes
      async read(e: LogEvent, box: Box) {
        if (!live && !inDemo) return; // a dev box: nothing to keep
        if (!labelled) {
          labelled = true;
          try {
            BOX.name = box.secret('ELASTIC_BOX_LABEL').trim() || BOX.name;
          } catch {} // no label in the vault: the host name stands
        }
        const t = e.task ? box.task(e.task) : undefined;
        const key = e.type === 'tool.call' || e.type === 'tool.result' ? `${e.task}.${e.key}` : '';
        if (e.type === 'tool.call') toolOf.set(key, e.tool);
        const extra = {
          tool: toolOf.get(key),
          changes: e.type === 'task.state' && e.state === 'done' ? await changes(e.task) : undefined,
        };
        if (e.type === 'tool.result') toolOf.delete(key);
        // The same event twice gets the same id; Elastic refuses the second (create-only), which counts as sent.
        const line = JSON.stringify({ _id: `${BOX.machine}:${BOX.run}:${e.seq}`, ...toDoc(e, t, extra) }) + '\n';
        fs.mkdirSync(path.dirname(OUTBOX), { recursive: true });
        const fd = fs.openSync(OUTBOX, 'a');
        fs.writeSync(fd, line);
        fs.fsyncSync(fd);
        fs.closeSync(fd);
        if (live) void flush(box);
      },
    },
    {
      // The owner's answer to a request from Elastic does the thing. Cursored, so an approval given while the box
      // was down still acts at the next boot. Undoing an undone task is a no-op.
      name: 'act',
      async read(e: LogEvent, box: Box) {
        if (e.type !== 'approval.answered' || !e.approved) return;
        const source = box.task(e.task)?.source ?? '';
        const target = source.match(/^elastic:undo:(.+)$/)?.[1];
        if (!target || box.task(target)?.state === 'undone' || !box.task(target)) return;
        await box.undo(target);
        box.note({ kind: 'elastic.undo', target, answeredBy: e.by }, target);
      },
    },
  ],

  // A job, not a reader, holds the key: jobs run in the core with vault access, and readers have none.
  modelJobs: [
    {
      name: 'elastic.bulk',
      secrets: ['ELASTIC_URL', 'ELASTIC_BOX_KEY'],
      async run(input: { lines: string }, ctx) {
        let url: string, key: string;
        try {
          [url, key] = [ctx.secret('ELASTIC_URL').trim(), ctx.secret('ELASTIC_BOX_KEY').trim()];
        } catch {
          url = key = '';
        }
        if (!url || !key) return { skipped: 'the vault has no ELASTIC_URL or ELASTIC_BOX_KEY' };
        const es = client(url, key);
        // `create`, never `index`: the key may only add documents, so a repeat is refused with 409, which means "already there".
        const body = input.lines.split('\n').filter(Boolean).flatMap((l) => {
          const { _id, ...doc } = JSON.parse(l);
          return [JSON.stringify({ create: { _index: INDEX, _id } }), JSON.stringify(doc)];
        });
        const r = await es<{ items: { create: { _id: string; status: number; error?: { reason?: string } } }[] }>('POST', '/_bulk', body.join('\n') + '\n');
        const bad = r.items.filter((i) => i.create.error && i.create.status !== 409);
        // 400 is a document Elastic will never take: log it and go on. Anything else (no index yet, a busy cluster, a bad key) retries.
        for (const i of bad.filter((x) => x.create.status === 400)) console.error(`elastic: refused ${i.create._id}: ${i.create.error?.reason}`);
        if (bad.some((i) => i.create.status !== 400)) throw new Error(`Elastic said ${bad.find((i) => i.create.status !== 400)!.create.status}: ${bad[0].create.error?.reason}`);
        return { indexed: r.items.length - bad.length };
      },
    },
  ],

  triggers: [
    {
      name: 'integrity',
      start(box: Box) {
        if (!live) return;
        const every = Number(process.env.ELASTIC_VERIFY_MS) || 600_000;
        const run = () => void checkAndRecord(box).catch((e) => console.error(`elastic: integrity check failed: ${(e as Error).message}`));
        const soon = setTimeout(run, 30_000);
        const timer = setInterval(run, every);
        return () => (clearTimeout(soon), clearInterval(timer));
      },
    },
    {
      name: 'requests',
      start(box: Box) {
        if (!live) return;
        const timer = setInterval(() => void poll(box).catch((e) => console.error(`elastic: reading requests failed: ${(e as Error).message}`)), Number(process.env.ELASTIC_REQUESTS_MS) || 5000);
        return () => clearInterval(timer);
      },
    },
  ],

  apps: [{ name: 'ask', title: 'Ask GurtOS', href: '/' }],

  routes: {
    'GET /': () => new Response(fs.readFileSync(new URL('./app.html', import.meta.url)), { headers: { 'content-type': 'text/html; charset=utf-8' } }),
    // Has the box's log changed since Elastic stored its copy? Anyone paired may ask; the answer names only entry numbers.
    'GET /verify': async (_req, box) => {
      try {
        const v = await checkAndRecord(box);
        const cap = (n: number[]) => n.slice(0, 50);
        const bad = [...v.edited, ...v.missing, ...v.reordered, ...v.localBreaks].length;
        return Response.json({
          ...v, edited: cap(v.edited), missing: cap(v.missing), reordered: cap(v.reordered), localBreaks: cap(v.localBreaks),
          summary: v.ok ? `All ${v.checked} entries match Elastic's copy${v.pending ? `; ${v.pending} not shipped yet` : ''}.` : `${bad} entries do not match: edited ${first(v.edited) || 'none'}, missing ${first(v.missing) || 'none'}, reordered ${first(v.reordered) || 'none'}, broken links ${first(v.localBreaks) || 'none'}. Trust Elastic's copy.`,
        });
      } catch (e) {
        return Response.json({ error: (e as Error).message }, { status: 503 });
      }
    },
    'POST /ask': async (req, box) => {
      try {
        const { question, conversation } = (await req.json()) as { question?: string; conversation?: string };
        if (!question?.trim() || question.length > 1000) return Response.json({ error: 'ask a question of up to 1000 characters' }, { status: 400 });
        // The box says who is calling (x-box-caller, and x-box-person on a Business box); the page cannot choose.
        const person = req.headers.get('x-box-person') || (['screen', 'owner'].includes(req.headers.get('x-box-caller') ?? '') ? 'owner' : '');
        if (!person) return Response.json({ error: 'the box does not know who is asking' }, { status: 403 });
        return Response.json(await askAgent(box, person, question.trim(), conversation));
      } catch (e) {
        return Response.json({ error: (e as Error).message }, { status: (e as { status?: number }).status ?? 502 });
      }
    },
  },
} satisfies Track;
