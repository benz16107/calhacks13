// Shared pieces of the wallet: the network, units, the host rule, the signer, the payment mark.
// Every other wallet file imports from here, so track.ts can import them without a cycle.
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createKeyPairSignerFromBytes, getBase58Encoder } from '@solana/kit';
import type { PaymentRequired, PaymentRequirements } from '@x402/core/types';
import { x402Client, x402HTTPClient } from '@x402/fetch';
import type { Ctx } from '../../core/contract.ts';

export const DEVNET = 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1';
export const USDC = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'; // Circle's devnet USDC mint
export const RPC = 'https://api.devnet.solana.com';
export const LABEL = 'Solana devnet USDC (test money)';
export const MAX_CONTENT = 20_000;
export const TIMEOUT_MS = 30_000;

/** USDC has 6 decimals, so 1 cent is 10,000 atomic units. */
export const atomic = (cents: number) => String(Math.round(cents * 10_000));

export const validCents = (c: unknown): c is number => typeof c === 'number' && Number.isFinite(c) && c > 0;

export const usdc = (amount: string) => (Number(amount) / 1e6).toString();

export const explorer = (kind: 'tx' | 'address', id: string) => `https://explorer.solana.com/${kind}/${id}?cluster=devnet`;

/** The same host rule as the task's network (core/net.ts), so the wallet reaches only the task's own hosts. */
export function allowedUrl(hosts: string[], raw: string): URL {
  const url = new URL(raw);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error(`only http and https URLs, not ${url.protocol}`);
  const port = url.port || (url.protocol === 'https:' ? '443' : '80');
  const host = url.hostname;
  const ok = hosts.some((h) => h === host || h === `${host}:${port}` || (h.startsWith('*.') && host.endsWith(h.slice(1))));
  if (!ok) throw new Error(`${url.host} is not one of this task's hosts`);
  return url;
}

/** The one offer the wallet will pay: exact, on Solana devnet, in devnet USDC. */
export function devnetOffer(accepts: PaymentRequirements[]): PaymentRequirements | undefined {
  return accepts.find((a) => a.scheme === 'exact' && a.network === DEVNET && a.asset === USDC);
}

export async function signer(ctx: Ctx) {
  return createKeyPairSignerFromBytes(getBase58Encoder().encode(ctx.secret('WALLET_SOLANA_KEY')));
}

/** Read a 402 answer's offers. x402 v2 puts them in a base64 PAYMENT-REQUIRED header. */
export async function paymentRequired(res: Response): Promise<PaymentRequired> {
  const body = await res.json().catch(() => undefined);
  return new x402HTTPClient(new x402Client()).getPaymentRequiredResponse((name) => res.headers.get(name), body);
}

/** The wallet's own files: payment marks and the ledger. Read at call time, since tests set BOX_HOME late. */
export function walletDir() {
  const dir = path.join(process.env.BOX_HOME ?? '/var/lib/box', 'wallet');
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  return dir;
}

/**
 * Mark a payment as started, durably, before any money moves. If the box dies mid-payment, the broker runs the
 * call again on resume; the mark makes that second run refuse instead of paying twice.
 */
export function claim(key: string) {
  const dir = walletDir();
  const file = path.join(dir, createHash('sha256').update(key).digest('hex').slice(0, 32));
  let fd: number;
  try {
    fd = fs.openSync(file, 'wx');
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e;
    throw new Error('this payment started before the box restarted and may have gone through; not paying twice. Check the wallet on the explorer.');
  }
  fs.fsyncSync(fd);
  fs.closeSync(fd);
  const d = fs.openSync(dir, 'r');
  fs.fsyncSync(d);
  fs.closeSync(d);
}

export async function balance(owner: string): Promise<number> {
  const r = await fetch(RPC, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getTokenAccountsByOwner', params: [owner, { mint: USDC }, { encoding: 'jsonParsed' }] }),
  });
  const { result, error } = await r.json();
  if (error) throw new Error(`devnet RPC: ${error.message}`);
  return result.value.reduce((sum: number, a: any) => sum + Number(a.account.data.parsed.info.tokenAmount.uiAmountString), 0);
}
