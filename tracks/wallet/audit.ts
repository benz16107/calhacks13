// Tamper-evident audit: once a day, hash the box's action log and write the fingerprint to Solana devnet as a
// memo transaction. Anyone can later recompute the hash of the log and compare it with the chain.
// Memo text (other threads read this, do not change it): gurtos-audit v1 seq=<N> sha256=<hex> prev=<hex>
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  AccountRole, address, devnet, appendTransactionMessageInstruction, createSolanaRpc, createSolanaRpcSubscriptions, createTransactionMessage, getSignatureFromTransaction,
  pipe, sendAndConfirmTransactionFactory, setTransactionMessageFeePayerSigner, setTransactionMessageLifetimeUsingBlockhash, signTransactionMessageWithSigners,
} from '@solana/kit';
import { CdpClient } from '@coinbase/cdp-sdk';
import type { Box, Ctx, ModelJob, Route, Trigger } from '../../core/contract.ts';
import { RPC, explorer, signer, walletDir } from './lib.ts';

const MEMO = address('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');
const ZERO = '0'.repeat(64);
const MIN_LAMPORTS = 20_000n; // a memo transaction costs 5,000
const memoText = (r: { seq: number; sha256: string; prev: string }) => `gurtos-audit v1 seq=${r.seq} sha256=${r.sha256} prev=${r.prev}`;

export type AuditRecord = { date: string; seq: number; sha256: string; prev: string; tx?: string; explorer?: string };

const logFile = () => path.join(process.env.BOX_HOME ?? '/var/lib/box', 'log.jsonl');
const auditFile = () => path.join(walletDir(), 'audit.jsonl');

/** Raw bytes of each complete, parsable log line (with its newline). A torn last line is ignored. */
function lines(logPath: string): Buffer[] {
  if (!fs.existsSync(logPath)) return [];
  const buf = fs.readFileSync(logPath);
  const out: Buffer[] = [];
  for (let start = 0; start < buf.length; ) {
    const nl = buf.indexOf(10, start);
    if (nl < 0) break;
    const line = buf.subarray(start, nl + 1);
    try {
      JSON.parse(line.toString('utf8'));
    } catch {
      break; // a torn or edited-to-garbage line ends the readable log
    }
    out.push(line);
    start = nl + 1;
  }
  return out;
}

/** SHA-256 over the first n lines (all of them if n is left out), and how many lines that was. */
export function fingerprint(logPath: string, n = Infinity) {
  const hash = createHash('sha256');
  const all = lines(logPath).slice(0, n);
  for (const l of all) hash.update(l);
  return { seq: all.length, sha256: hash.digest('hex') };
}

/** Stored records, newest first. */
export async function audits(): Promise<AuditRecord[]> {
  const f = auditFile();
  const rows = fs.existsSync(f) ? fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l) as AuditRecord) : [];
  return rows.reverse();
}

export async function latestAudit(): Promise<AuditRecord | undefined> {
  return (await audits())[0];
}

async function ensureSol(ctx: Pick<Ctx, 'secret'>, rpc: any, addr: string) {
  const have = async () => (await rpc.getBalance(address(addr)).send()).value;
  if ((await have()) >= MIN_LAMPORTS) return;
  let how = 'airdrop';
  try {
    const cdp = new CdpClient({ apiKeyId: ctx.secret('CDP_API_KEY_ID'), apiKeySecret: ctx.secret('CDP_API_KEY_SECRET') });
    await cdp.solana.requestFaucet({ address: addr, token: 'sol' });
    how = 'Coinbase faucet';
  } catch {
    // no CDP keys, or the faucet refused: the public airdrop is often rate-limited
    await rpc.requestAirdrop(address(addr), 100_000_000n).send().catch((e: Error) => {
      throw new Error(`the wallet has no devnet SOL for the memo fee and ${how} failed (${e.message}). Fund ${addr} at faucet.solana.com`);
    });
  }
  for (let i = 0; i < 20; i++) {
    if ((await have()) >= MIN_LAMPORTS) return;
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error(`asked the ${how} for devnet SOL but none arrived yet; try again in a minute`);
}

/** Fingerprint the log now and write it to devnet. Nothing new since the last record returns that record. */
export async function writeAudit(secretCtx: Pick<Ctx, 'secret'>, logPath = logFile(), note?: (data: unknown) => void): Promise<AuditRecord> {
  const last = await latestAudit();
  const { seq, sha256 } = fingerprint(logPath);
  if (seq === 0) throw new Error('the action log is empty; nothing to fingerprint');
  if (last && last.seq === seq && last.sha256 === sha256) return last;
  const rec: AuditRecord = { date: new Date().toISOString(), seq, sha256, prev: last?.sha256 ?? ZERO };

  const payer = await signer(secretCtx as Ctx);
  const rpc = createSolanaRpc(devnet(RPC));
  await ensureSol(secretCtx, rpc, payer.address);
  const { value: blockhash } = await rpc.getLatestBlockhash().send();
  const message = pipe(
    createTransactionMessage({ version: 0 }),
    (m) => setTransactionMessageFeePayerSigner(payer, m),
    (m) => setTransactionMessageLifetimeUsingBlockhash(blockhash, m),
    // The wallet signs the memo too, so the chain shows which box wrote it.
    (m) => appendTransactionMessageInstruction({ programAddress: MEMO, accounts: [{ address: payer.address, role: AccountRole.READONLY_SIGNER, signer: payer }], data: new TextEncoder().encode(memoText(rec)) }, m),
  );
  const tx = await signTransactionMessageWithSigners(message);
  await sendAndConfirmTransactionFactory({ rpc, rpcSubscriptions: createSolanaRpcSubscriptions(RPC.replace('https', 'wss')) })(tx as any, { commitment: 'confirmed' });
  const sig = getSignatureFromTransaction(tx);
  const done = { ...rec, tx: sig, explorer: explorer('tx', sig) };
  fs.appendFileSync(auditFile(), JSON.stringify(done) + '\n');
  // The audit is itself in the action log: hash and transaction id (a devnet network fee, no owner money).
  note?.({ audit: { seq: done.seq, sha256: done.sha256, prev: done.prev, tx: sig, explorer: done.explorer, cluster: 'devnet' } });
  return done;
}

/** The memo text of a transaction, read back from devnet. */
async function chainMemo(sig: string): Promise<string | undefined> {
  const r = await fetch(RPC, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getTransaction', params: [sig, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0, commitment: 'confirmed' }] }),
  });
  const { result, error } = await r.json();
  if (error) throw new Error(`devnet RPC: ${error.message}`);
  const ix = result?.transaction?.message?.instructions?.find((i: any) => i.programId === MEMO);
  return typeof ix?.parsed === 'string' ? ix.parsed : undefined;
}

/** Recompute every stored record against the current log; compare the latest with its memo on chain. */
export async function verify(logPath = logFile(), checkChain = true) {
  const recs = (await audits()).reverse();
  const checks = recs.map((r, i) => {
    const now = fingerprint(logPath, r.seq);
    const chained = r.prev === (recs[i - 1]?.sha256 ?? ZERO);
    return { seq: r.seq, date: r.date, tx: r.tx, matches: now.seq === r.seq && now.sha256 === r.sha256 && chained };
  });
  const latest = recs.at(-1);
  let chain: { ok: boolean; memo?: string } | { error: string } | undefined;
  if (checkChain && latest?.tx) {
    chain = await chainMemo(latest.tx)
      .then((memo) => ({ ok: memo === memoText(latest), memo }))
      .catch((e: Error) => ({ error: e.message }));
  }
  return { ok: checks.length > 0 && checks.every((c) => c.matches) && (!chain || ('ok' in chain && chain.ok)), checks, chain };
}

const SECRETS = ['WALLET_SOLANA_KEY', 'CDP_API_KEY_ID', 'CDP_API_KEY_SECRET'];

export const auditJob: ModelJob = {
  name: 'wallet.audit',
  secrets: SECRETS,
  run: (_input, ctx) => writeAudit(ctx, undefined, (d) => ctx.box.note(d)),
};

/** Once a day at 03:00 (box local time). Returns the stop function. */
export const auditTrigger: Trigger = {
  name: 'wallet-audit',
  start(box: Box) {
    let timer: NodeJS.Timeout;
    let stopped = false;
    const arm = () => {
      const next = new Date();
      next.setHours(3, 0, 0, 0);
      if (next.getTime() <= Date.now()) next.setDate(next.getDate() + 1);
      timer = setTimeout(async () => {
        if (stopped) return;
        await writeAudit(box, undefined, (d) => box.note(d)).catch((e) => console.error('wallet audit failed:', e.message));
        arm();
      }, next.getTime() - Date.now());
      timer.unref();
    };
    arm();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  },
};

// Owner-only: leave these out of openRoutes. Secrets: SECRETS, all but WALLET_SOLANA_KEY optional.
export const auditRoutes: Record<string, Route> = {
  // Each record says what network it is on, so no screen shows a fingerprint as if it were mainnet.
  'GET /audit': async () => Response.json((await audits()).map((r) => ({ ...r, network: 'Solana devnet (test network)' }))),
  'GET /audit/verify': async () => Response.json(await verify()),
};
export const auditSecrets = SECRETS;
export const auditOptionalSecrets = ['CDP_API_KEY_ID', 'CDP_API_KEY_SECRET'];
