// A receipt: what one finished task did, signed by the box, checkable by anyone from the receipt alone.
// Pure apart from node:crypto. track.ts supplies the log lines, the task, and what Elastic and Solana said.
// verify.html holds the matching check (it runs in the browser); the demo runs both over the same receipts.
import { createHash, createPrivateKey, createPublicKey, generateKeyPairSync, sign, type JsonWebKey } from 'node:crypto';

export const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

/** JSON with sorted keys and no spaces. The signature covers this, so the browser must rebuild it byte for byte. */
export function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
  if (v && typeof v === 'object') {
    return `{${Object.keys(v).filter((k) => (v as any)[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${canonical((v as any)[k])}`).join(',')}}`;
  }
  return JSON.stringify(v) ?? 'null';
}

export interface BoxKey { privateJwk: JsonWebKey; publicJwk: JsonWebKey }
export const newKey = (): BoxKey => {
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  return { privateJwk: privateKey.export({ format: 'jwk' }), publicJwk: publicKey.export({ format: 'jwk' }) };
};
/** A short name for a public key: the first 16 hex of the SHA-256 of its canonical form. Written in the box's log too. */
export const fingerprint = (jwk: JsonWebKey) => sha256(canonical({ crv: jwk.crv, kty: jwk.kty, x: jwk.x, y: jwk.y })).slice(0, 16);

export type Mode = 'full' | 'redacted';
export interface Entry { seq: number; at: string; type: string; text: string; who?: string; hash: string; line?: string }
export interface Receipt {
  v: 1;
  id: string;
  issuedAt: string;
  mode: Mode;
  box: { name: string; machine: string; key: JsonWebKey; keyFingerprint: string };
  task: { id: string; title: string; source: string; seat?: string; requestedBy?: string; state: string; costCents: number | null; createdAt: string; endedAt: string };
  chain: { from: number; to: number; through: number; lines: [number, string | null, string][] };
  entries: Entry[];
  anchors: {
    elastic: { checked: number; matched: boolean; at: string } | null;
    solana: { seq: number; head: string; sha256: string; prev: string; tx: string; explorer?: string; date: string } | null;
  };
  sig?: string;
}

const usd = (c: number) => `$${(c / 100).toFixed(2)}`;
/** One plain sentence per log event. The redacted version leaves out text, amounts and file names. */
function say(e: any, redacted: boolean): { text: string; who?: string } {
  const who = e.who?.approver ?? e.who?.asked;
  switch (e.type) {
    case 'task.created': return { text: redacted ? 'The task was created' : `The task was created by ${e.spec?.source}: ${String(e.spec?.prompt ?? '').slice(0, 300)}`, who: e.who?.asked };
    case 'task.state': return { text: `The task is ${e.state}${!redacted && e.error ? `: ${e.error}` : ''}` };
    case 'task.step': return { text: redacted ? 'The agent took a step' : String(e.text).slice(0, 400) };
    case 'tool.call': return { text: redacted ? `The agent called ${e.tool}` : `The agent called ${e.tool} with ${JSON.stringify(e.input).slice(0, 300)}` };
    case 'tool.result': return { text: redacted ? `${e.ok ? 'The call succeeded' : 'The call failed'}` : `${e.ok ? 'The call returned' : `The call failed: ${e.error}`}${e.cents ? `, spending ${usd(e.cents)}` : ''}` };
    case 'approval.asked': return { text: redacted ? 'The agent asked for an OK' : `The agent asked: ${e.approval?.question}` };
    case 'approval.answered': return { text: `${e.approved ? 'Approved' : 'Denied'} by ${e.by}${e.via ? ` from ${e.via}` : ''}`, who: e.person ?? e.by };
    case 'cost': return { text: redacted ? 'The task spent money' : `The task spent ${usd(e.cents)} on ${e.what}` };
    case 'net.blocked': return { text: `The box blocked a connection to ${e.host}` };
    case 'keep': return { text: `Keep: ${e.result}` };
    case 'note': return { text: redacted ? `A note from ${e.track}` : `${e.track} noted ${e.data?.kind ?? 'something'}` };
    default: return { text: e.type };
  }
}

const MAX_LINES = 20000;

/**
 * Build a receipt for one task from the log (every line as written, no newline). `anchor` is the first Solana audit that
 * covers the task, with the hash of its last line, and extends the chain to it. Throws if the task is not in the log or
 * the range is too long to carry.
 */
export function buildReceipt(opts: {
  lines: string[]; taskId: string; mode: Mode; box: { name: string; machine: string }; key: BoxKey; now?: Date;
  anchors?: Partial<Receipt['anchors']>; id: string;
}): Receipt {
  const { lines, taskId, mode } = opts;
  const mine: { seq: number; e: any; line: string }[] = [];
  lines.forEach((line, i) => {
    let e: any;
    try { e = JSON.parse(line); } catch { return; }
    if (e.task === taskId) mine.push({ seq: i + 1, e, line });
  });
  if (!mine.length) throw Object.assign(new Error(`no task ${taskId} in the log`), { status: 404 });
  const from = mine[0].seq, to = mine.at(-1)!.seq;
  const through = Math.max(to, opts.anchors?.solana?.seq ?? to);
  if (through - from + 1 > MAX_LINES) throw Object.assign(new Error('this task spans too much of the log for one receipt'), { status: 413 });

  const hashes = lines.slice(from - 1, through).map(sha256);
  const chain = { from, to, through, lines: hashes.map((h, i) => [from + i, JSON.parse(lines[from - 1 + i]).prev ?? null, h] as [number, string | null, string]) };
  const created = mine.find((m) => m.e.type === 'task.created')?.e;
  const states = mine.filter((m) => m.e.type === 'task.state');
  const last = states.at(-1)?.e.state ?? 'unknown';
  const cents = mine.reduce((n, m) => n + (m.e.type === 'cost' ? m.e.cents : m.e.type === 'tool.result' ? (m.e.cents ?? 0) : 0), 0);
  const redacted = mode === 'redacted';
  const entries: Entry[] = mine.map(({ seq, e, line }) => ({ seq, at: e.at, type: e.type, ...say(e, redacted), hash: hashes[seq - from], ...(redacted ? {} : { line }) }));
  const spec = created?.spec ?? {};
  const body: Receipt = {
    v: 1, id: opts.id, issuedAt: (opts.now ?? new Date()).toISOString(), mode,
    box: { name: opts.box.name, machine: opts.box.machine, key: opts.key.publicJwk, keyFingerprint: fingerprint(opts.key.publicJwk) },
    task: { id: taskId, title: spec.title ?? taskId, source: spec.source ?? '', seat: spec.seat, requestedBy: created?.requestedBy, state: last, costCents: redacted ? null : cents, createdAt: mine[0].e.at, endedAt: mine.at(-1)!.e.at },
    chain, entries, anchors: { elastic: opts.anchors?.elastic ?? null, solana: opts.anchors?.solana ?? null },
  };
  const key = createPrivateKey({ key: opts.key.privateJwk, format: 'jwk' });
  return { ...body, sig: sign('sha256', Buffer.from(canonical(body)), { key, dsaEncoding: 'ieee-p1363' }).toString('base64') };
}

export { createPublicKey };
