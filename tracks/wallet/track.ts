// The agent wallet. The box holds a Solana key in its vault and pays HTTP APIs that answer 402 Payment
// Required, with x402, in USDC on Solana devnet (test money). Tasks call wallet.quote and wallet.pay through
// their broker; the key never leaves the core. The broker counts each payment toward the task's budget and
// asks for an OK above it.
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createKeyPairSignerFromBytes, getBase58Encoder } from '@solana/kit';
import type { PaymentRequired, PaymentRequirements } from '@x402/core/types';
import { decodePaymentResponseHeader, wrapFetchWithPayment, x402Client, x402HTTPClient } from '@x402/fetch';
import { ExactSvmScheme } from '@x402/svm/exact/client';
import type { Approval, Ctx, Track } from '../../core/contract.ts';

export const DEVNET = 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1';
export const USDC = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'; // Circle's devnet USDC mint
const RPC = 'https://api.devnet.solana.com';
const LABEL = 'Solana devnet USDC (test money)';
const MAX_CONTENT = 20_000;
const TIMEOUT_MS = 30_000;

/** USDC has 6 decimals, so 1 cent is 10,000 atomic units. */
export const atomic = (cents: number) => String(Math.round(cents * 10_000));
const validCents = (c: unknown): c is number => typeof c === 'number' && Number.isFinite(c) && c > 0;
const usdc = (amount: string) => (Number(amount) / 1e6).toString();
const explorer = (kind: 'tx' | 'address', id: string) => `https://explorer.solana.com/${kind}/${id}?cluster=devnet`;

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

/** The latest quoted devnet offer per URL. wallet.pay uses it when a call leaves out `cents`. */
const quoted = new Map<string, PaymentRequirements>();
/** The atomic price the budget check charged for one call. The broker hands the same input object to cost and run. */
const priced = new WeakMap<object, string>();
const href = (raw: unknown) => {
  try {
    return new URL(String(raw)).href;
  } catch {
    return undefined;
  }
};
const purposeFor = (url: string) => `${url} in devnet USDC (test money)`;

async function signer(ctx: Ctx) {
  return createKeyPairSignerFromBytes(getBase58Encoder().encode(ctx.secret('WALLET_SOLANA_KEY')));
}

/** Read a 402 answer's offers. x402 v2 puts them in a base64 PAYMENT-REQUIRED header. */
async function paymentRequired(res: Response): Promise<PaymentRequired> {
  const body = await res.json().catch(() => undefined);
  return new x402HTTPClient(new x402Client()).getPaymentRequiredResponse((name) => res.headers.get(name), body);
}

/** The wallet's own files: payment marks and the ledger. Read at call time, since tests set BOX_HOME late. */
function walletDir() {
  const dir = path.join(process.env.BOX_HOME ?? '/var/lib/box', 'wallet');
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  return dir;
}

type Payment = { at: string; task: string; usdc: string; payee: string; tx: string; explorer: string };

/** Settled payments, newest first. The log reader may write one twice after a crash, so keep the first per tx. */
export function payments(): Payment[] {
  const file = path.join(walletDir(), 'payments.jsonl');
  const lines = fs.existsSync(file) ? fs.readFileSync(file, 'utf8').split('\n').filter(Boolean) : [];
  const byTx = new Map<string, Payment>();
  for (const line of lines) {
    const p = JSON.parse(line) as Payment;
    if (!byTx.has(p.tx)) byTx.set(p.tx, p);
  }
  return [...byTx.values()].reverse();
}

const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const short = (id: string) => (id.length > 12 ? `${id.slice(0, 4)}…${id.slice(-4)}` : id);
const when = (at: string) => new Date(at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

/** The Agent wallet window. Rendered here, so it makes no fetches and needs no token off the box. */
export function page(s: any, list: Payment[], titleOf: (task: string) => string | undefined) {
  const rows = list
    .slice(0, 50)
    .map(
      (p) => `<tr><td>${esc(when(p.at))}</td><td class="mono">$${esc(p.usdc)}</td>
<td class="mono"><a href="${esc(explorer('address', p.payee))}" title="${esc(p.payee)}">${esc(short(p.payee))}</a></td>
<td>${esc(titleOf(p.task) ?? 'a task')}<div class="small mono">${esc(p.task)}</div></td>
<td class="mono"><a href="${esc(p.explorer)}" title="${esc(p.tx)}">${esc(short(p.tx))}</a></td></tr>`,
    )
    .join('\n');
  const wallet = s.wallet
    ? `<p class="amount">${esc(s.usdc ?? '?')} USDC</p>
<p class="small">Balance on Solana devnet${s.error ? ` (could not reach Solana devnet: ${esc(s.error)})` : ''}. Wallet
<a class="mono addr" href="${esc(explorer('address', s.wallet))}">${esc(s.wallet)}</a>. Agents never see its key.</p>`
    : `<p>Not set up yet: ${esc(s.setup ?? s.error)}</p>`;
  return `<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Agent wallet</title>
<style>
  :root { --bg: #F3F1EA; --surface: #FBFAF6; --sunken: #E6E7E1; --border: #D3D6CF; --strong: #6B726C; --text: #1C201D; --text2: #535A54; --focus: #2D5784; }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--text); font: 16px/24px "IBM Plex Sans", system-ui, sans-serif; }
  main { max-width: 1040px; margin: 0 auto; padding: 24px 16px 64px; }
  h1 { font-size: 40px; line-height: 48px; font-weight: 600; letter-spacing: -0.5px; margin: 0 0 8px; }
  h2 { font-size: 17px; line-height: 24px; font-weight: 600; margin: 32px 0 12px; }
  a { color: var(--focus); }
  a:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
  .mono { font-family: "IBM Plex Mono", ui-monospace, monospace; font-size: 14px; line-height: 20px; }
  td.mono { white-space: nowrap; }
  .addr { overflow-wrap: anywhere; }
  .small { font-size: 13px; line-height: 18px; color: var(--text2); }
  .test { background: var(--sunken); border: 1px solid var(--strong); border-radius: 4px; padding: 8px 12px; }
  .amount { font-size: 40px; line-height: 48px; font-weight: 600; letter-spacing: -0.5px; margin: 16px 0 4px; }
  section { overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; background: var(--surface); border: 1px solid var(--border); border-radius: 6px; }
  th, td { text-align: left; vertical-align: top; padding: 10px 12px; border-top: 1px solid var(--border); }
  th { border-top: 0; font-size: 12px; line-height: 16px; font-weight: 500; letter-spacing: 0.4px; text-transform: uppercase; color: var(--text2); }
</style>
<main>
  <h1>Agent wallet</h1>
  <p class="test"><b>TEST MONEY.</b> Every payment here is USDC on Solana devnet, which has no value. Agents pay APIs that
  answer 402 Payment Required with x402; Coinbase's facilitator settles them.</p>
  ${wallet}
  <section aria-labelledby="pay-h">
    <h2 id="pay-h">Payments</h2>
    ${rows ? `<table><thead><tr><th scope="col">Time</th><th scope="col">Amount</th><th scope="col">Paid to</th><th scope="col">Task</th><th scope="col">Transaction</th></tr></thead>
<tbody>${rows}</tbody></table>` : '<p class="small">No payments yet.</p>'}
  </section>
</main>
`;
}

/**
 * Mark a payment as started, durably, before any money moves. If the box dies mid-payment, the broker runs the
 * call again on resume; the mark makes that second run refuse instead of paying twice.
 */
function claim(key: string) {
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

async function balance(owner: string): Promise<number> {
  const r = await fetch(RPC, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getTokenAccountsByOwner', params: [owner, { mint: USDC }, { encoding: 'jsonParsed' }] }),
  });
  const { result, error } = await r.json();
  if (error) throw new Error(`devnet RPC: ${error.message}`);
  return result.value.reduce((sum: number, a: any) => sum + Number(a.account.data.parsed.info.tokenAmount.uiAmountString), 0);
}

export default {
  name: 'wallet',

  tools: [
    {
      name: 'wallet.quote',
      description:
        `Ask what an HTTP API costs before paying. GETs the URL with no payment. A paid API answers 402; this returns its price in US cents and the payee. ` +
        `A free URL returns its content. Payments are in ${LABEL}. Input: { url }.`,
      input: { type: 'object', properties: { url: { type: 'string' } }, required: ['url'] },
      async run(input: { url: string }, ctx) {
        const url = allowedUrl(ctx.task?.hosts ?? [], input.url);
        const res = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(TIMEOUT_MS) });
        if (res.status !== 402) return { url: url.href, status: res.status, cents: 0, content: (await res.text()).slice(0, MAX_CONTENT) };
        const pr = await paymentRequired(res);
        const offer = devnetOffer(pr.accepts);
        if (!offer) throw new Error(`this API takes no ${LABEL}; it offers ${pr.accepts.map((a) => `${a.scheme} on ${a.network}`).join(', ')}`);
        quoted.set(url.href, offer);
        const cents = Number(offer.amount) / 10_000;
        ctx.log(`${url.href} costs $${usdc(offer.amount)} in ${LABEL}, paid to ${offer.payTo}`);
        return { url: url.href, status: 402, cents, usdc: usdc(offer.amount), payee: offer.payTo, network: 'solana-devnet', test: true, description: pr.resource?.description };
      },
    },
    {
      name: 'wallet.pay',
      description:
        `Pay for an HTTP API that answers 402, then return its content. Pays exactly { cents } in ${LABEL}, or nothing. ` +
        `Leave out cents to pay the price wallet.quote last saw for this URL. Above the task's budget it waits for the owner's OK. ` +
        `You never see the wallet's key. Input: { url, cents? }.`,
      input: { type: 'object', properties: { url: { type: 'string' }, cents: { type: 'number' } }, required: ['url'] },
      secrets: ['WALLET_SOLANA_KEY'],
      hosts: ['api.devnet.solana.com'],
      // The agent's input is untrusted: a bad `cents`, or no `cents` and no quote, costs nothing here, and run refuses it.
      cost: (input: { url?: unknown; cents?: unknown }) => {
        if (input?.cents !== undefined) return validCents(input.cents) ? input.cents : 0;
        const offer = quoted.get(href(input?.url) ?? '');
        if (!offer) return 0;
        priced.set(input, offer.amount);
        return Number(offer.amount) / 10_000;
      },
      // What the owner's phone shows for a payment over budget.
      approval: (input: { url?: unknown }) => {
        const url = href(input?.url);
        return url ? { payee: quoted.get(url)?.payTo ?? new URL(url).host, purpose: purposeFor(url) } : {};
      },
      async run(input: { url: string; cents?: number }, ctx) {
        const url = allowedUrl(ctx.task?.hosts ?? [], input.url);
        const fromQuote = input.cents === undefined;
        const want = fromQuote ? priced.get(input) : validCents(input.cents) ? atomic(input.cents) : undefined;
        if (!want) throw new Error(fromQuote ? 'no quoted price for this URL: call wallet.quote first, or pass cents' : 'cents must be a positive number');
        // The broker reuses an approval when the same call repeats. Never pay a quoted price the owner did not approve.
        const approvedOther = (a: Approval) => a.task === ctx.task?.id && a.state === 'approved' && a.purpose === purposeFor(url.href) && atomic(a.costCents) !== want;
        if (fromQuote && ctx.box.approvals().some(approvedOther)) throw new Error('the price changed since the owner approved this payment; quote it again and pass cents');
        let offer: PaymentRequirements | undefined;
        // Pay only the devnet USDC offer at exactly the agreed price. The x402 client's own default also
        // refuses any single payment over $1.
        const client = new x402Client().register(DEVNET, new ExactSvmScheme(await signer(ctx), { rpcUrl: RPC })).registerPolicy((_v, accepts) => {
          offer = devnetOffer(accepts);
          if (!offer || offer.amount !== want) {
            throw new Error(`no ${LABEL} offer at exactly $${usdc(want)}${offer ? `; the price is $${usdc(offer.amount)}` : ''}. Quote it again.`);
          }
          return [offer];
        });
        claim(ctx.key);
        const res = await wrapFetchWithPayment(fetch, client)(url, { redirect: 'error', signal: AbortSignal.timeout(TIMEOUT_MS) });
        if (!offer) throw new Error(`${url.href} did not ask for payment (HTTP ${res.status}); read it with wallet.quote instead`);
        if (res.status === 402) throw new Error(`payment refused: ${(await paymentRequired(res)).error ?? 'no reason given'}`);
        const header = res.headers.get('payment-response');
        const receipt = header ? decodePaymentResponseHeader(header) : undefined;
        if (!receipt?.success) throw new Error(`HTTP ${res.status} with no settled payment`);
        const paid = { usdc: usdc(offer.amount), cents: Number(want) / 10_000, payee: offer.payTo, network: 'solana-devnet', test: true, tx: receipt.transaction, explorer: explorer('tx', receipt.transaction) };
        ctx.log(`Paid $${paid.usdc} in ${LABEL} to ${paid.payee} for ${url.href}`, { payment: paid });
        return { status: res.status, content: (await res.text()).slice(0, MAX_CONTENT), paid };
      },
    },
  ],

  // Every settled payment, from the start of the log, into the wallet's ledger for the app page.
  logReaders: [
    {
      name: 'payments',
      read(e) {
        if (e.type !== 'tool.result' || !e.ok) return;
        const paid = (e.output as { paid?: any } | undefined)?.paid;
        if (paid?.network !== 'solana-devnet' || !paid.tx) return;
        const p: Payment = { at: e.at, task: e.task, usdc: paid.usdc, payee: paid.payee, tx: paid.tx, explorer: paid.explorer };
        fs.appendFileSync(path.join(walletDir(), 'payments.jsonl'), JSON.stringify(p) + '\n');
      },
    },
  ],

  // The wallet's public side, for the app page and the demo.
  modelJobs: [
    {
      name: 'wallet.status',
      secrets: ['WALLET_SOLANA_KEY'],
      async run(_input, ctx) {
        let address: string;
        try {
          address = (await signer(ctx)).address;
        } catch {
          return { wallet: null, label: LABEL, setup: 'the vault has no usable WALLET_SOLANA_KEY; see tracks/wallet/README.md' };
        }
        // A devnet RPC hiccup must not hide the wallet: report the balance as unknown instead.
        const usdc = await balance(address).catch((e: Error) => e);
        return {
          wallet: address, network: 'solana-devnet', test: true, label: LABEL, explorer: explorer('address', address),
          usdc: typeof usdc === 'number' ? usdc : undefined, error: usdc instanceof Error ? usdc.message : undefined,
        };
      },
    },
  ],

  routes: {
    'GET /status': async (_req, box) => Response.json(await box.job('wallet.status', {})),
    'GET /': async (_req, box) => {
      const s = await box.job('wallet.status', {}).catch((e: Error) => ({ error: e.message }));
      return new Response(page(s, payments(), (id) => box.task(id)?.title), { headers: { 'content-type': 'text/html; charset=utf-8' } });
    },
  },

  apps: [{ name: 'wallet', title: 'Agent wallet (Solana devnet, test money)', href: '/' }],
} satisfies Track;
