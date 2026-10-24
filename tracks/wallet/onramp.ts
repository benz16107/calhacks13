// Top up from the phone: a Coinbase Onramp session that buys USDC for the box wallet's address.
// SANDBOX ONLY. A devnet address is the same key on mainnet, so a real purchase would send real money to it.
// Coinbase's rule: a partnerUserRef starting with "sandbox-" makes the order succeed with no card charge and no
// transfer. We always send that prefix and never offer a live mode. The devnet test USDC comes from Circle's faucet.
import { generateJwt } from '@coinbase/cdp-sdk/auth';
import type { Ctx, Route } from '../../core/contract.ts';
import { signer } from './lib.ts';

const HOST = 'api.cdp.coinbase.com';
const PATH = '/platform/v2/onramp/sessions';
const MAX_USD = 20;

export const FAUCET = [
  'Open https://faucet.circle.com and choose USDC on Solana Devnet.',
  'Paste the wallet address shown on this page and send the request (20 test USDC per request, a few times an hour).',
  'The balance above updates in under a minute.',
];

export const SETUP = [
  'Open the CDP Portal (portal.cdp.coinbase.com) for the project this API key belongs to.',
  'Open Onramp and create an Onramp app (accept the terms and add the domain you serve the wallet page from).',
  'Run the top-up again. Sandbox orders need no approval and never charge a card.',
];

export type Topup =
  | { ok: true; sandbox: true; url: string; quote?: unknown; note: string }
  | { ok: false; status: number; reason: string; setup: string[]; faucet: string[]; address: string };

/** Ask Coinbase for a sandbox Onramp session for the wallet. `fetchImpl` is injectable for tests. */
export async function createTopup(
  ctx: Pick<Ctx, 'secret'>,
  usd = 10,
  fetchImpl: typeof fetch = fetch,
): Promise<Topup> {
  if (!(usd > 0 && usd <= MAX_USD)) throw new Error(`the amount must be between 0 and ${MAX_USD} dollars`);
  const addr = (await signer(ctx as Ctx)).address;
  const jwt = await generateJwt({ apiKeyId: ctx.secret('CDP_API_KEY_ID'), apiKeySecret: ctx.secret('CDP_API_KEY_SECRET'), requestMethod: 'POST', requestHost: HOST, requestPath: PATH, expiresIn: 120 });
  const res = await fetchImpl(`https://${HOST}${PATH}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${jwt}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      purchaseCurrency: 'USDC', destinationNetwork: 'solana', destinationAddress: addr,
      paymentAmount: usd.toFixed(2), paymentCurrency: 'USD', paymentMethod: 'CARD', country: 'US', subdivision: 'CA',
      partnerUserRef: 'sandbox-gurtos-owner', // never change: this is what keeps the order from moving real money
    }),
    signal: AbortSignal.timeout(30_000),
  });
  const body: any = await res.json().catch(() => ({}));
  const url: string | undefined = body?.session?.onrampUrl;
  if (res.ok && url) return { ok: true, sandbox: true, url, quote: body.quote, note: 'Sandbox order: no card is charged and no USDC arrives. It tests the flow only.' };
  return { ok: false, status: res.status, reason: String(body?.errorMessage ?? body?.message ?? `HTTP ${res.status}`), setup: SETUP, faucet: FAUCET, address: addr };
}

const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** A phone-friendly "Top up" section for the wallet page. Its button calls the owner-only POST topup route. */
export function topupSection(address: string) {
  return `<section aria-labelledby="top-h">
  <h2 id="top-h">Top up</h2>
  <p class="test"><b>TEST MONEY.</b> Get devnet USDC from <a href="https://faucet.circle.com">Circle's faucet</a>: pick USDC on Solana Devnet and paste
  <span class="mono addr">${esc(address)}</span>. Coinbase Onramp below runs in sandbox mode only: it charges no card and sends no USDC.</p>
  <button type="button" id="topup" style="min-height:44px;padding:0 16px;font:inherit">Try the Coinbase Onramp sandbox</button>
  <div id="topup-out" class="small" role="status"></div>
  <script>
  document.getElementById('topup').onclick = async () => {
    const out = document.getElementById('topup-out'); out.textContent = 'Asking Coinbase...';
    try {
      const r = await (await fetch('topup', { method: 'POST' })).json();
      out.textContent = '';
      if (r.ok) { const a = document.createElement('a'); a.href = r.url; a.textContent = 'Open the sandbox checkout'; out.append(a, ' ' + r.note); }
      else out.textContent = r.reason + '. To turn it on: ' + r.setup.join(' ');
    } catch (e) { out.textContent = 'Top up failed: ' + e.message; }
  };
  </script>
</section>`;
}

/** Owner-only: leave 'POST /topup' out of openRoutes. Secrets: WALLET_SOLANA_KEY, CDP_API_KEY_ID, CDP_API_KEY_SECRET. */
export const onrampRoutes: Record<string, Route> = {
  'POST /topup': async (req, box) => {
    const asked = Number(((await req.json().catch(() => ({}))) as { usd?: unknown }).usd ?? 10);
    try {
      return Response.json(await createTopup(box, asked));
    } catch (e) {
      return Response.json({ ok: false, reason: (e as Error).message }, { status: 400 });
    }
  },
};
