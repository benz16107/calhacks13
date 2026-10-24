// Is the box's log still the log Elastic holds? The core chains every entry to the one before it, and each entry's
// hash is shipped with a key that can only create documents, so Elastic's copy cannot change. A root user can rewrite
// the local file and recompute every hash after the edit, which the local chain cannot see. This can.
import fs from 'node:fs';
import { INDEX, sha256 } from './docs.ts';

export interface Verdict {
  ok: boolean;
  /** Entries of the box's log that were compared with Elastic's copy. */
  checked: number;
  /** Entries in the box's log with no copy in Elastic yet: still on their way. Not a problem. */
  pending: number;
  /** The last entry Elastic holds. */
  throughSeq: number;
  /** Entries whose content differs from Elastic's copy, including every entry after a rewritten chain. */
  edited: number[];
  /** Entries Elastic holds that the box's log no longer has. */
  missing: number[];
  /** Entries that are in the box's log, unchanged, but at a different place. */
  reordered: number[];
  /** Entries whose own `prev` does not match the line before them: an edit the box's own chain can see. */
  localBreaks: number[];
}

/** The SHA-256 of every line of a log file, in order, and the seqs of entries whose `prev` does not match the line before. */
export function localChain(file: string): { hashes: string[]; breaks: number[] } {
  const lines = fs.existsSync(file) ? fs.readFileSync(file, 'utf8').split('\n').filter(Boolean) : [];
  const hashes = lines.map(sha256);
  const breaks: number[] = [];
  let chained = false; // lines before the chain began have no prev; after that, every line must
  lines.forEach((line, i) => {
    let prev: unknown;
    try {
      prev = JSON.parse(line).prev;
    } catch {
      return breaks.push(i + 1); // a line that is not JSON anymore
    }
    if (prev === undefined && !chained) return;
    chained = true;
    if (prev !== (i ? hashes[i - 1] : '0'.repeat(64))) breaks.push(i + 1);
  });
  return { hashes, breaks };
}

/**
 * Compare the box's log with Elastic's copy. `local` is the hash of each line by position; `remote` maps a seq to the
 * hash Elastic stored for it. An entry with no hash in Elastic (shipped before hashes existed) is not compared.
 */
export function compareChains(local: string[], remote: Map<number, string>, localBreaks: number[] = []): Verdict {
  const bySeq = new Map<string, number>();
  for (const [seq, h] of remote) bySeq.set(h, seq);
  const throughSeq = Math.max(0, ...remote.keys());
  const v: Verdict = { ok: true, checked: 0, pending: Math.max(0, local.length - throughSeq), throughSeq, edited: [], missing: [], reordered: [], localBreaks };
  for (const [seq, h] of remote) {
    const mine = local[seq - 1];
    v.checked++;
    if (mine === undefined) v.missing.push(seq);
    else if (mine !== h) (bySeq.has(mine) && bySeq.get(mine) !== seq ? v.reordered : v.edited).push(seq);
  }
  for (const k of ['edited', 'missing', 'reordered'] as const) v[k].sort((a, b) => a - b);
  v.ok = !v.edited.length && !v.missing.length && !v.reordered.length && !localBreaks.length;
  return v;
}

/** The first few seqs of a list, for a sentence. */
export const first = (seqs: number[], n = 5) => (seqs.length > n ? `${seqs.slice(0, n).join(', ')} and ${seqs.length - n} more` : seqs.join(', '));

type Es = <T = any>(method: string, path: string, body?: unknown) => Promise<T>;

/** Run an ES|QL query and return its rows as objects. */
export async function esql(es: Es, query: string, params: Record<string, unknown>[] = []): Promise<Record<string, any>[]> {
  const r = await es<{ columns: { name: string }[]; values: unknown[][] }>('POST', '/_query', { query, params });
  return r.values.map((row) => Object.fromEntries(r.columns.map((c, i) => [c.name, row[i]])));
}

/** What Elastic holds for one box and run: seq to hash, a page of 10,000 at a time. */
export async function remoteHashes(es: Es, machine: string, run: string): Promise<Map<number, string>> {
  const out = new Map<number, string>();
  for (let after = 0; ; ) {
    const rows = await esql(es, `FROM ${INDEX} | WHERE box.machine == ?m AND box.run == ?r AND event.seq > ?after AND event.hash IS NOT NULL | SORT event.seq ASC | KEEP event.seq, event.hash | LIMIT 10000`, [{ m: machine }, { r: run }, { after }]);
    for (const row of rows) out.set(row['event.seq'], row['event.hash']);
    if (rows.length < 10000) return out;
    after = rows[rows.length - 1]['event.seq'];
  }
}

/** The same, from documents already in hand (the demo's outbox, standing in for Elastic). */
export function hashesFromDocs(docs: { box: { machine: string; run: string }; event: { seq: number; hash?: string } }[], machine: string, run: string) {
  return new Map(docs.filter((d) => d.box.machine === machine && d.box.run === run && d.event.hash).map((d) => [d.event.seq, d.event.hash!] as [number, string]));
}
