// The agent wallet. The box holds a Solana key in its vault and pays HTTP APIs that answer 402 Payment
// Required, with x402, in USDC on Solana devnet (test money). Tasks call wallet.quote and wallet.pay through
// their broker; the key never leaves the core. The broker counts each payment toward the task's budget and
// asks for an OK above it.
import fs from 'node:fs';
import path from 'node:path';
import type { PaymentRequirements } from '@x402/core/types';
import { decodePaymentResponseHeader, wrapFetchWithPayment, x402Client } from '@x402/fetch';
import { ExactSvmScheme } from '@x402/svm/exact/client';
import type { Approval, Track } from '../../core/contract.ts';
import { CDP_SECRETS, checkLocalPolicy, localPolicy, policyRoutes, policySummary, walletSigner } from './cdp-wallet.ts';
import { auditJob, auditOptionalSecrets, auditRoutes, auditTrigger, latestAudit } from './audit.ts';
import { discover } from './bazaar.ts';
import { withTaskMemo } from './memo.ts';
import { payMetered } from './metered.ts';
import { onrampRoutes, topupSection } from './onramp.ts';
import { earnings, sellRoutes, type Sale } from './sell.ts';
import { DEVNET, LABEL, MAX_CONTENT, RPC, TIMEOUT_MS, allowedUrl, atomic, balance, claim, devnetOffer, explorer, paymentRequired, signer, usdc, validCents, walletDir } from './lib.ts';

export { DEVNET, USDC, allowedUrl, atomic, devnetOffer } from './lib.ts';

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

/** One settled payment. `amount` is shown as is: other payment routes (Fetch.ai's) use their own units. */
type Payment = { at: string; task: string; amount: string; network: string; payee: string; tx: string; explorer?: string };

/** Settled payments, newest first. The log reader may write one twice after a crash, so keep the first per tx. */
export function payments(): Payment[] {
  const file = path.join(walletDir(), 'payments.jsonl');
  const lines = fs.existsSync(file) ? fs.readFileSync(file, 'utf8').split('\n').filter(Boolean) : [];
  const byTx = new Map<string, Payment>();
  for (const line of lines) {
    const raw = JSON.parse(line);
    // Ledgers written before Fetch.ai payments had only x402 lines: { usdc } and no network.
    const p: Payment = { ...raw, amount: raw.amount ?? `$${raw.usdc}`, network: raw.network ?? 'solana-devnet' };
    if (!byTx.has(p.tx)) byTx.set(p.tx, p);
  }
  return [...byTx.values()].reverse();
}

const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const short = (id: string) => (id.length > 12 ? `${id.slice(0, 4)}…${id.slice(-4)}` : id);
const when = (at: string) => new Date(at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

/** The two locks: GurtOS's budget and OK, then the payee list and cap, held by Coinbase in cdp mode. */
function locks(p: any = {}) {
  const payees = (p.payees ?? []).map((a: string) => `<li class="mono"><a href="${esc(explorer('address', a))}">${esc(a)}</a></li>`).join('');
  return `<section aria-labelledby="lock-h">
    <h2 id="lock-h">Two locks on the money</h2>
    <p>1. GurtOS: each task's budget, and your OK on the phone above it. 2. ${p.mode === 'cdp' ? "Coinbase's policy engine" : 'The owner policy below'}: ${esc(p.label ?? p.error ?? '')}</p>
    <p class="small">Mode <b>${esc(p.mode ?? '?')}</b>${p.account ? `, Coinbase account <span class="mono addr">${esc(p.account)}</span>` : ''}${p.policyId ? `, policy <span class="mono">${esc(p.policyId)}</span>` : ''}.
    Cap per payment: ${p.maxCentsPerPayment ? `$${(p.maxCentsPerPayment / 100).toFixed(2)}` : 'none set'}. Payees allowed: ${payees ? '' : 'any (none listed)'}</p>
    ${payees ? `<ul>${payees}</ul>` : ''}
    <p class="small">Set them from your phone or this screen: POST /t/wallet/policy {payees, maxCentsPerPayment}. Agents cannot.</p>
  </section>`;
}

/** The Agent wallet window. Rendered here, so it makes no fetches and needs no token off the box. */
export function page(s: any, list: Payment[], titleOf: (task: string) => string | undefined, sales: Sale[] = []) {
  const rows = list
    .slice(0, 50)
    .map(
      (p) => `<tr><td>${esc(when(p.at))}</td><td class="mono">${esc(p.amount)}<div class="small">${esc(p.network)}</div></td>
<td class="mono">${p.network === 'solana-devnet' ? `<a href="${esc(explorer('address', p.payee))}" title="${esc(p.payee)}">${esc(short(p.payee))}</a>` : `<span title="${esc(p.payee)}">${esc(short(p.payee))}</span>`}</td>
<td>${esc(titleOf(p.task) ?? 'a task')}<div class="small mono">${esc(p.task)}</div></td>
<td class="mono">${/^https:\/\//.test(p.explorer ?? '') ? `<a href="${esc(p.explorer)}" title="${esc(p.tx)}">${esc(short(p.tx))}</a>` : esc(short(p.tx))}</td></tr>`,
    )
    .join('\n');
  const sold = sales
    .slice(0, 50)
    .map((x) => `<tr><td>${esc(when(x.at))}</td><td class="mono">$${esc((x.cents / 100).toFixed(3))}</td><td>${esc(x.product)}</td>
<td class="mono">${esc(short(x.payer))}</td><td class="mono"><a href="${esc(explorer('tx', x.tx))}" title="${esc(x.tx)}">${esc(short(x.tx))}</a></td></tr>`)
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
  <section aria-labelledby="earn-h">
    <h2 id="earn-h">Earned</h2>
    <p class="small">This box sells its own services over x402 (audit proof, search, renting its agent). Price list: <a href="sell">/t/wallet/sell</a>.</p>
    ${sold ? `<table><thead><tr><th scope="col">Time</th><th scope="col">Amount</th><th scope="col">Product</th><th scope="col">Paid by</th><th scope="col">Transaction</th></tr></thead>
<tbody>${sold}</tbody></table>` : '<p class="small">No sales yet.</p>'}
  </section>
  ${s.wallet ? locks(s.policy) : ''}
  ${s.wallet ? topupSection(s.wallet) : ''}
</main>
`;
}

const sell = sellRoutes({ latestAudit, publicUrl: process.env.BOX_PUBLIC_URL });

export default {
  name: 'wallet',
  title: 'Wallet (test money)',
  description: 'Lets agents pay with test money (USDC on Solana devnet, which has no value), within a limit you set, and asks you above it. Needs a devnet wallet key; Coinbase keys are optional.',

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
      secrets: ['WALLET_SOLANA_KEY', ...CDP_SECRETS],
      hosts: ['api.devnet.solana.com', 'api.cdp.coinbase.com'],
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
        // cdp mode: Coinbase holds the key and signs only inside its policy. vault-key mode: the box signs.
        const w = await walletSigner(ctx);
        const client = new x402Client().register(DEVNET, withTaskMemo(new ExactSvmScheme(w.signer, { rpcUrl: RPC }), ctx.task?.id ?? 'box')).registerPolicy((_v, accepts) => {
          offer = devnetOffer(accepts);
          if (!offer || offer.amount !== want) {
            throw new Error(`no ${LABEL} offer at exactly $${usdc(want)}${offer ? `; the price is $${usdc(offer.amount)}` : ''}. Quote it again.`);
          }
          checkLocalPolicy(localPolicy(), offer); // the owner's payee list and cap; in cdp mode Coinbase checks them again
          return [offer];
        });
        claim(ctx.key);
        const res = await wrapFetchWithPayment(fetch, client)(url, { redirect: 'error', signal: AbortSignal.timeout(TIMEOUT_MS) });
        if (!offer) throw new Error(`${url.href} did not ask for payment (HTTP ${res.status}); read it with wallet.quote instead`);
        if (res.status === 402) throw new Error(`payment refused: ${(await paymentRequired(res)).error ?? 'no reason given'}`);
        const header = res.headers.get('payment-response');
        const receipt = header ? decodePaymentResponseHeader(header) : undefined;
        if (!receipt?.success) throw new Error(`HTTP ${res.status} with no settled payment`);
        const paid = { usdc: usdc(offer.amount), cents: Number(want) / 10_000, payee: offer.payTo, network: 'solana-devnet', test: true, tx: receipt.transaction, explorer: explorer('tx', receipt.transaction), mode: w.mode };
        ctx.log(`Paid $${paid.usdc} in ${LABEL} to ${paid.payee} for ${url.href}`, { payment: paid });
        return { status: res.status, content: (await res.text()).slice(0, MAX_CONTENT), paid };
      },
    },
    discover,
    payMetered,
  ],

  // Every settled payment, from the start of the log, into the wallet's ledger for the app page.
  logReaders: [
    {
      name: 'payments',
      read(e) {
        if (e.type !== 'tool.result' || !e.ok) return;
        const paid = (e.output as { paid?: any } | undefined)?.paid;
        // Any payment route that reports a `paid` receipt in this shape shows here (x402 and Fetch.ai's protocol).
        if (typeof paid?.tx !== 'string' || typeof paid.network !== 'string' || typeof paid.payee !== 'string') return;
        const amount = paid.usdc !== undefined ? `$${paid.usdc}` : String(paid.amount ?? '?');
        const p: Payment = { at: e.at, task: e.task, amount, network: paid.network, payee: paid.payee, tx: paid.tx, explorer: paid.explorer };
        fs.appendFileSync(path.join(walletDir(), 'payments.jsonl'), JSON.stringify(p) + '\n');
      },
    },
    ...sell.logReaders,
  ],

  triggers: [auditTrigger],

  // The wallet's public side, for the app page and the demo.
  modelJobs: [
    {
      name: 'wallet.status',
      secrets: ['WALLET_SOLANA_KEY', ...CDP_SECRETS],
      async run(_input, ctx) {
        let address: string;
        try {
          address = (await walletSigner(ctx)).address;
        } catch {
          return { wallet: null, label: LABEL, setup: 'the vault has no usable WALLET_SOLANA_KEY; see tracks/wallet/README.md' };
        }
        // A devnet RPC hiccup must not hide the wallet: report the balance as unknown instead.
        const usdc = await balance(address).catch((e: Error) => e);
        return {
          wallet: address, network: 'solana-devnet', test: true, label: LABEL, explorer: explorer('address', address),
          usdc: typeof usdc === 'number' ? usdc : undefined, error: usdc instanceof Error ? usdc.message : undefined,
          policy: await policySummary(ctx).catch((e: Error) => ({ error: e.message })),
        };
      },
    },
    auditJob,
  ],

  routes: {
    'GET /status': async (_req, box) => Response.json(await box.job('wallet.status', {})),
    'GET /': async (_req, box) => {
      const s = await box.job('wallet.status', {}).catch((e: Error) => ({ error: e.message }));
      return new Response(page(s, payments(), (id) => box.task(id)?.title, earnings()), { headers: { 'content-type': 'text/html; charset=utf-8' } });
    },
    ...policyRoutes,
    ...auditRoutes,
    // Owner-only: write a fingerprint now instead of waiting for 03:00.
    'POST /audit': async (_req, box) => Response.json(await box.job('wallet.audit', {})),
    ...onrampRoutes,
    ...sell.routes,
  },
  // The paid x402 routes: strangers pay for them, so the payment is the credential. Nothing else is open.
  openRoutes: sell.openRoutes,
  // Routes read the wallet key (to be paid) and the CDP keys (to settle through Coinbase, else x402.org).
  secrets: ['WALLET_SOLANA_KEY', ...CDP_SECRETS],
  optionalSecrets: [...new Set([...auditOptionalSecrets, ...CDP_SECRETS])],

  apps: [{ name: 'wallet', title: 'Agent wallet (Solana devnet, test money)', href: '/' }],
} satisfies Track;
