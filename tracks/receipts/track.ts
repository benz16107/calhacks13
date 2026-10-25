// Receipts anyone can check. When a task has finished, the owner can make a signed receipt of it: what it did, who
// approved what, what it cost, Keep or Undo, and the stretch of the hash-chained action log it sits in. The receipt is
// signed with the box's own key and tied to two copies the box cannot rewrite: Elastic's add-only copy and the daily
// Solana fingerprint. A public page (verify.html) checks it in the browser. See README.md for what it does and does not prove.
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Box, Track } from '../../core/contract.ts';
import { buildReceipt, fingerprint, newKey, type BoxKey, type Mode, type Receipt } from './receipt.ts';

const HOME = process.env.BOX_HOME ?? '/var/lib/box';
const DIR = path.join(HOME, 'receipts');
const read = (f: string) => fs.readFileSync(new URL(f, import.meta.url));

const machine = (() => {
  try {
    return fs.readFileSync('/etc/machine-id', 'utf8').trim().slice(0, 12);
  } catch {
    return path.basename(HOME);
  }
})();

/** The box's signing key, made once and kept in a root-only file. Its short name goes in the log, so it ships to Elastic and gets anchored. */
function boxKey(box: Box): BoxKey {
  const file = path.join(DIR, 'key.json');
  if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
  fs.mkdirSync(DIR, { recursive: true, mode: 0o700 });
  const key = newKey();
  fs.writeFileSync(file, JSON.stringify(key), { mode: 0o600 });
  box.note({ kind: 'receipts.key', fingerprint: fingerprint(key.publicJwk), algorithm: 'ECDSA P-256' });
  return key;
}

const logLines = () => {
  const f = path.join(HOME, 'log.jsonl');
  return fs.existsSync(f) ? fs.readFileSync(f, 'utf8').split('\n').filter(Boolean) : [];
};

/** The first daily Solana audit that covers entry `to` and carries the hash of its last line (the wallet app writes these). */
function solanaAnchor(to: number): NonNullable<Receipt['anchors']['solana']> | null {
  const f = path.join(HOME, 'wallet', 'audit.jsonl');
  if (!fs.existsSync(f)) return null;
  const rows = fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l) as { date: string; seq: number; sha256: string; prev: string; head?: string; tx?: string; explorer?: string });
  const a = rows.filter((r) => r.head && r.tx && r.seq >= to).sort((x, y) => x.seq - y.seq)[0];
  return a ? { seq: a.seq, head: a.head!, sha256: a.sha256, prev: a.prev, tx: a.tx!, explorer: a.explorer, date: a.date } : null;
}

/** Ask Elastic (with this box's own key) for the hashes of entries from..to, and compare them with the log. */
async function elasticCheck(box: Box, lines: [number, string | null, string][], from: number, to: number) {
  try {
    const [url, key] = [box.secret('ELASTIC_URL').trim(), box.secret('ELASTIC_BOX_KEY').trim()];
    if (!url || !key || HOME !== '/var/lib/box') return null;
    const r = await fetch(`${url.replace(/\/$/, '')}/_query`, {
      method: 'POST',
      headers: { authorization: `ApiKey ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({ query: 'FROM box-actions | WHERE box.machine == ?m AND box.run == "installed" AND event.seq >= ?a AND event.seq <= ?b | KEEP event.seq, event.hash | LIMIT 10000', params: [{ m: machine }, { a: from }, { b: to }] }),
    });
    if (!r.ok) return null;
    const j = (await r.json()) as { values: [number, string][] };
    const theirs = new Map(j.values.map(([s, h]) => [s, h]));
    const mine = lines.filter((l) => l[0] >= from && l[0] <= to);
    // The box's log hash is the hash of the line; Elastic stores the hash of the same line from its own copy.
    const bad = mine.filter((l) => theirs.has(l[0]) && theirs.get(l[0]) !== l[2]).length;
    return { checked: theirs.size, matched: bad === 0 && theirs.size > 0, at: new Date().toISOString() };
  } catch {
    return null;
  }
}

/** Who may share a receipt: the owner at the box, or the person who asked for the task. */
function mayShare(req: Request, box: Box, taskId: string) {
  const caller = req.headers.get('x-box-caller') ?? '';
  if (caller === 'screen' || caller === 'owner') return true;
  const person = req.headers.get('x-box-person');
  return !!person && box.task(taskId)?.requestedBy === person;
}

const cors = { 'access-control-allow-origin': '*', 'cache-control': 'no-store' };
const json = (v: unknown, status = 200, extra: Record<string, string> = {}) => Response.json(v, { status, headers: extra });

export default {
  name: 'receipts',
  description: 'A signed receipt for a finished task that anyone can check in a browser, tied to the box\'s add-only copy in Elastic and the daily Solana fingerprint.',
  secrets: ['ELASTIC_URL', 'ELASTIC_BOX_KEY'],
  optionalSecrets: ['ELASTIC_URL', 'ELASTIC_BOX_KEY'],
  apps: [{ name: 'receipts', title: 'Receipts', href: '/' }],
  openRoutes: ['GET /r', 'GET /verify', 'GET /qrcode.js', 'OPTIONS /r'],

  routes: {
    'GET /': () => new Response(read('./app.html'), { headers: { 'content-type': 'text/html; charset=utf-8' } }),
    'GET /qrcode.js': () => new Response(read('./qrcode.js'), { headers: { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'public, max-age=86400' } }),
    // The same file gurtos.com/verify serves. It holds its own checker and sends nothing anywhere.
    'GET /verify': () => new Response(read('./verify.html'), { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } }),

    // Finished tasks that can have a receipt.
    'GET /tasks': (req, box) => {
      const caller = req.headers.get('x-box-caller') ?? '';
      const person = req.headers.get('x-box-person');
      const mine = box.tasks().filter((t) => ['done', 'failed', 'undone'].includes(t.state) && (caller === 'screen' || caller === 'owner' || (!!person && t.requestedBy === person)));
      return json(mine.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 60).map((t) => ({ id: t.id, title: t.title, state: t.state, source: t.source, costCents: t.costCents, endedAt: t.updatedAt })));
    },

    // Make a receipt and share it: it is stored under a random address anyone holding the link can read.
    'POST /share': async (req, box) => {
      const { task, mode = 'full' } = (await req.json().catch(() => ({}))) as { task?: string; mode?: Mode };
      if (!task || !/^[\w.-]+$/.test(task) || !['full', 'redacted'].includes(mode)) return json({ error: 'give a task id and a mode, full or redacted' }, 400);
      if (!box.task(task)) return json({ error: `no task ${task}` }, 404);
      if (!['done', 'failed', 'undone'].includes(box.task(task)!.state)) return json({ error: 'the task has not finished' }, 409);
      if (!mayShare(req, box, task)) return json({ error: 'only the owner, or the person who asked for the task, can make a receipt' }, 403);
      try {
        const key = boxKey(box);
        const lines = logLines();
        // The anchor first, so the receipt's chain can run on to it; then Elastic's view of the same entries.
        const mine = lines.map((l, i) => [i + 1, l] as const).filter(([, l]) => { try { return JSON.parse(l).task === task; } catch { return false; } });
        const to = mine.at(-1)![0];
        const solana = solanaAnchor(to);
        const probe = buildReceipt({ lines, taskId: task, mode, box: { name: boxName(box), machine }, key, id: 'probe', anchors: { solana } });
        const elastic = await elasticCheck(box, probe.chain.lines, probe.chain.from, probe.chain.to);
        const id = randomBytes(16).toString('hex');
        const receipt = buildReceipt({ lines, taskId: task, mode, box: { name: boxName(box), machine }, key, id, anchors: { solana, elastic } });
        fs.mkdirSync(DIR, { recursive: true, mode: 0o700 });
        fs.writeFileSync(path.join(DIR, `${id}.json`), JSON.stringify(receipt), { mode: 0o600 });
        // Not tagged with the task: a note on the task would extend the next receipt's range past the Solana audit that covers it.
        box.note({ kind: 'receipts.share', task, id, mode, entries: receipt.entries.length, fingerprint: receipt.box.keyFingerprint });
        const origin = originOf(req);
        const address = `${origin}/t/receipts/r?id=${id}`;
        return json({ id, mode, entries: receipt.entries.length, chainLines: receipt.chain.lines.length, anchors: { solana: !!solana, elastic: !!elastic }, address, verifyUrl: `${origin}/t/receipts/verify#r=${encodeURIComponent(address)}`, publicVerifyUrl: `https://gurtos.com/verify#r=${encodeURIComponent(address)}` });
      } catch (e) {
        return json({ error: (e as Error).message }, (e as { status?: number }).status ?? 500);
      }
    },

    // The receipt itself. Whoever holds the address can read it, so the address is a random 128-bit id.
    'GET /r': (req) => {
      const id = new URL(req.url).searchParams.get('id') ?? '';
      const f = path.join(DIR, `${id}.json`);
      if (!/^[0-9a-f]{32}$/.test(id) || !fs.existsSync(f)) return json({ error: 'no such receipt' }, 404, cors);
      return new Response(fs.readFileSync(f), { headers: { ...cors, 'content-type': 'application/json' } });
    },
    'OPTIONS /r': () => new Response(null, { status: 204, headers: { ...cors, 'access-control-allow-methods': 'GET', 'access-control-allow-headers': 'content-type' } }),
  },
} satisfies Track;

/** The address the caller used to reach the box, so the link works from wherever they opened it. */
function originOf(req: Request) {
  const h = req.headers;
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost';
  const proto = h.get('x-forwarded-proto') ?? (/^(127\.|localhost|\[::1\])/.test(host) ? 'http' : 'https');
  return `${proto}://${host}`;
}

const boxName = (_box: Box) => process.env.BOX_NAME ?? os.hostname();
