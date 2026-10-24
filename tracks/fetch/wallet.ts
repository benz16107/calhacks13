// The box's wallet for Fetch's Agent Payment Protocol: testnet FET on Fetch's Dorado testnet. It is test money
// with no value. The key is 32 random bytes in BOX_HOME/fetch/wallet (root, 0600). Tasks never see it: they call
// fetch.pay through the broker, and pay.py signs in a child process that gets the key in its environment.
// In a demo run the ledger is a JSON file instead of the chain (see offline()).
import { execFile } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import type { Ctx, Tool } from '../../core/contract.ts';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const PAY = path.join(HERE, 'pay.py');
const VENV_PYTHON = '/opt/box-fetch/venv/bin/python'; // made by setup.sh; offline mode needs only python3
const NETWORK = 'Fetch Dorado testnet';
const MAX_FET = 5n * 10n ** 18n; // hard cap for one payment, in atestfet
const ADDRESS = /^fetch1[02-9ac-hj-np-z]{38}$/; // the shape only; pay.py and the chain check the rest
const AMOUNT = /^\d{1,6}(\.\d{1,18})?$/;
const REFERENCE = /^[\w.:-]{1,80}$/;
const TX = /^[\w-]{1,80}$/;

const dir = () => path.join(process.env.BOX_HOME ?? '/var/lib/box', 'fetch'); // read late: tests set BOX_HOME after import

/** Offline unless a live run was asked for. The core decides; a tool's input never does. */
const offline = () => process.env.BOX_DEMO === '1' && !(process.env.DEMO_LIVE ?? '').split(/[\s,]+/).includes('fetch');

/** The box's key, made on first use. Written whole and renamed, so a power cut never leaves a half key. */
function walletKey(): string {
  fs.mkdirSync(dir(), { recursive: true, mode: 0o711 }); // the agent passes through to its own folder; the key file is root only
  const file = path.join(dir(), 'wallet');
  if (!fs.existsSync(file)) {
    fs.writeFileSync(`${file}.tmp`, randomBytes(32).toString('hex'), { mode: 0o600 });
    fs.renameSync(`${file}.tmp`, file);
  }
  return fs.readFileSync(file, 'utf8').trim();
}

let venv: Promise<unknown> | undefined;
async function python() {
  if (offline()) return 'python3';
  venv ??= fs.existsSync(VENV_PYTHON) ? Promise.resolve() : promisify(execFile)(path.join(HERE, 'setup.sh'), { timeout: 600_000 }).catch(() => {});
  await venv;
  return fs.existsSync(VENV_PYTHON) ? VENV_PYTHON : 'python3';
}

/** Run pay.py. Returns its one JSON line, which holds `error` when it failed. The key goes in the environment only. */
async function pay(args: string[], timeout = 45_000): Promise<any> {
  const key = walletKey();
  const env = {
    PATH: process.env.PATH ?? '/usr/bin:/bin',
    PYTHONDONTWRITEBYTECODE: '1',
    FETCH_WALLET_KEY: key,
    FETCH_STATE: dir(),
    ...(offline() && { FETCH_LEDGER: 'offline' }),
  };
  let out: string;
  try {
    out = (await promisify(execFile)(await python(), ['-I', '-B', PAY, ...args], { env, timeout })).stdout;
  } catch (e: any) {
    out = e.stdout ?? '';
    if (!out.trim()) throw new Error(`the Fetch wallet did not run: ${String(e.stderr || e.message).replaceAll(key, '[key]').slice(0, 300)}`);
  }
  return JSON.parse(out.trim().split('\n').pop()!);
}

// ---------- fetch.pay ----------

type Payment = { to: string; amount: string; reference: string; why: string };

/** Throws on a bad input. The same check serves cost(), approval() and run(). */
function check(input: any): Payment {
  const { to, amount, reference, why } = input ?? {};
  if (typeof to !== 'string' || !ADDRESS.test(to)) throw new Error('to must be a Fetch address: "fetch1" and 38 more letters and digits');
  if (typeof amount !== 'string' || !AMOUNT.test(amount)) throw new Error('amount must be a decimal string of FET, such as "0.1", with at most 18 decimal places');
  const [whole, frac = ''] = amount.split('.');
  const atto = BigInt(whole) * 10n ** 18n + BigInt(frac.padEnd(18, '0'));
  if (atto <= 0n) throw new Error('amount must be more than 0');
  if (atto > MAX_FET) throw new Error('amount is above the 5 FET limit for one payment');
  if (typeof reference !== 'string' || !REFERENCE.test(reference)) throw new Error('reference must be 1 to 80 letters, digits, or . : _ -');
  if (typeof why !== 'string' || !why.trim() || why.length > 200) throw new Error('why must be 1 to 200 characters');
  return { to, amount, reference, why };
}

/** Append one JSON line and sync it, so a power cut keeps what was marked. */
function append(file: string, row: unknown) {
  const fd = fs.openSync(file, 'a', 0o600);
  fs.writeSync(fd, `${JSON.stringify(row)}\n`);
  fs.fsyncSync(fd);
  fs.closeSync(fd);
}
const rows = (file: string): any[] => (fs.existsSync(file) ? fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []);
const clean = ({ found, ...r }: any) => ({ ...r, test: true });

export const payTool: Tool = {
  name: 'fetch.pay',
  description:
    'Pay another agent in test FET on Fetch\'s Dorado testnet, with the Agent Payment Protocol. It is test money with no value. ' +
    'Input: { to: the agent\'s fetch1... address, amount: FET as a string such as "0.1" (at most 5), reference: the payment reference from its request, why: what the payment is for }. ' +
    'Returns the transaction hash. The payer\'s balance and key stay in the box.',
  input: {
    type: 'object',
    properties: {
      to: { type: 'string', description: 'Fetch address, fetch1...' },
      amount: { type: 'string', description: 'FET, a decimal string, at most 5' },
      reference: { type: 'string', description: 'Payment reference, 1 to 80 characters of letters, digits, . : _ -' },
      why: { type: 'string', description: 'What the payment is for, up to 200 characters' },
    },
    required: ['to', 'amount', 'reference', 'why'],
  },
  hosts: ['grpc-dorado.fetch.ai', 'faucet-dorado.fetch.ai', 'rest-dorado.fetch.ai'],
  // Test FET counts at $1 each for budgets, so a task's budget limits how much it can send.
  cost(input) {
    try {
      return Math.max(1, Math.round(Number(check(input).amount) * 100));
    } catch {
      return 0; // run() refuses the same input
    }
  },
  approval(input) {
    return { payee: String(input?.to ?? ''), purpose: `${String(input?.why ?? '').slice(0, 200)} (test FET on Fetch testnet, test money)` };
  },
  async run(input, ctx: Ctx) {
    const p = check(input);
    const marks = path.join(dir(), 'payments.jsonl');
    fs.mkdirSync(dir(), { recursive: true, mode: 0o711 });
    // A resumed call (same key) returns what it paid, so a power cut never pays twice.
    const prior = rows(marks).filter((r) => r.key === ctx.key);
    const done = prior.find((r) => r.result);
    if (done) return done.result;
    // Marked as started but not finished: the send may have landed. Look for it on the chain before sending again.
    const found = prior.length ? await pay(['find', p.to, p.amount, p.reference]) : undefined;
    if (found?.error) throw new Error(`could not check whether the earlier payment went through (${found.error}); not paying twice`);
    let result = found?.found ? clean(found) : undefined;
    if (!result) {
      append(marks, { key: ctx.key, to: p.to, amount: p.amount, reference: p.reference, at: new Date().toISOString() });
      if (!offline()) await pay(['fund'], 120_000); // test FET from the faucet when the wallet is low; a failure shows up as "not enough"
      const sent = await pay(['send', p.to, p.amount, p.reference], 90_000);
      if (sent.error) throw new Error(sent.error);
      result = clean(sent);
    }
    // The receipt every payment rail on the box reports, so the Agent wallet page lists it beside x402 payments.
    result.paid ??= { amount: `${p.amount} FET`, payee: p.to, network: result.simulated ? 'offline simulation' : 'fetch-dorado-testnet', test: true, tx: result.tx, ...(result.link && { explorer: result.link }) };
    append(marks, { key: ctx.key, result });
    ctx.log(`paid ${p.amount} test FET to ${p.to} on ${result.network}: ${result.tx}`);
    return result;
  },
};

// ---------- the box's own wallet, for routes ----------

const addresses = new Map<string, string>();
async function ownAddress() {
  const id = `${offline()}|${dir()}`;
  if (!addresses.has(id)) {
    const r = await pay(['address']);
    if (r.error) throw new Error(r.error);
    addresses.set(id, r.address);
  }
  return addresses.get(id)!;
}

/** The box's wallet address and balance in FET. The balance is left out when the chain cannot be reached. */
export async function boxWallet(): Promise<{ address: string; balance?: string; network: string; test: true; simulated?: true }> {
  const r = await pay(['balance']).catch(() => ({ error: 'unreachable' }) as any);
  const address = r.address ?? (await ownAddress());
  return { address, ...(r.balance && { balance: r.balance }), network: r.network ?? (offline() ? 'offline simulation' : NETWORK), test: true, ...(offline() && { simulated: true as const }) };
}

/**
 * Did `tx` pay the box at least `amount` FET with `memo` as its memo? The memo is the reference the box gave in
 * its payment request. One transaction answers one memo: reusing it for another request is refused.
 */
export async function verifyIncoming(tx: string, amount: string, memo: string): Promise<{ ok: boolean; error?: string; [k: string]: unknown }> {
  if (!TX.test(tx) || !AMOUNT.test(amount) || !REFERENCE.test(memo)) return { ok: false, error: 'the transaction, amount or reference is not in a valid form' };
  fs.mkdirSync(dir(), { recursive: true, mode: 0o711 });
  const used = path.join(dir(), 'received.jsonl');
  const id = tx.toUpperCase();
  const prior = rows(used).find((r) => r.tx === id);
  if (prior && prior.memo !== memo) return { ok: false, error: 'this transaction was already used for a different payment' };
  const r = await pay(['verify', tx, await ownAddress(), amount, memo]);
  if (r.ok && !prior) append(used, { tx: id, memo, at: new Date().toISOString() });
  return r.ok ? { ...r, test: true } : { ok: false, error: r.error ?? 'could not verify the payment' };
}
