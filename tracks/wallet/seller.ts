// A tiny x402-protected test API: GET /joke costs $0.01 and GET /report $0.03, in devnet USDC (test money).
// The demo starts it; for a live demo run it by hand:
//   node --experimental-strip-types tracks/wallet/seller.ts      (port 4021, or PORT)
// Given CDP keys, it settles through Coinbase's CDP facilitator; without them, through the public testnet
// facilitator at x402.org. Run by hand, it takes the keys from CDP_API_KEY_ID and CDP_API_KEY_SECRET, else
// from /etc/box/vault.env if it can read it.
import fs from 'node:fs';
import type { AddressInfo } from 'node:net';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { HTTPFacilitatorClient } from '@x402/core/server';
import { paymentMiddleware, x402ResourceServer } from '@x402/express';
import { ExactSvmScheme } from '@x402/svm/exact/server';

const DEVNET = 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1';
/** The test API's devnet address. Circle's faucet created its USDC account, which x402 needs to pay it. */
export const PAYEE = '39w7W3SBxE62zsS7VQY5dgZQXGWko2EkBXMfHg2sLtKV';

type CdpKeys = { apiKeyId: string; apiKeySecret: string };

/** The CDP keys in a KEY=value vault file, if it has both. */
export function cdpKeys(vault: string): CdpKeys | undefined {
  const get = (name: string) => vault.match(new RegExp(`^\\s*${name}\\s*=\\s*(.+)$`, 'm'))?.[1].trim();
  const [apiKeyId, apiKeySecret] = [get('CDP_API_KEY_ID'), get('CDP_API_KEY_SECRET')];
  return apiKeyId && apiKeySecret ? { apiKeyId, apiKeySecret } : undefined;
}

export async function startSeller(opts: { port?: number; payTo?: string; cdp?: CdpKeys } = {}) {
  const facilitator = opts.cdp
    ? (await import('@coinbase/cdp-sdk/x402')).createCdpFacilitatorClient(opts.cdp)
    : new HTTPFacilitatorClient({ url: 'https://x402.org/facilitator' });
  const settledBy = opts.cdp ? "Coinbase's CDP facilitator" : 'the x402.org testnet facilitator';
  const offer = (price: string) => ({ scheme: 'exact', price, network: DEVNET, payTo: opts.payTo ?? PAYEE }) as const;
  const app = express();
  app.use(
    paymentMiddleware(
      {
        'GET /joke': { accepts: [offer('$0.01')], description: 'One joke (devnet test money)', mimeType: 'application/json' },
        'GET /report': { accepts: [offer('$0.03')], description: 'A market report (devnet test money)', mimeType: 'application/json' },
      },
      new x402ResourceServer(facilitator).register(DEVNET, new ExactSvmScheme()),
    ),
  );
  app.get('/joke', (_req, res) => void res.json({ joke: 'An agent walks into a bar. The bar answers 402.' }));
  app.get('/report', (_req, res) => void res.json({ report: 'Road bikes in Berkeley: 14 listed, median $310, two under $200.' }));
  const server = app.listen(opts.port ?? 0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  return { port: (server.address() as AddressInfo).port, settledBy, close: () => server.close() };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { CDP_API_KEY_ID: apiKeyId, CDP_API_KEY_SECRET: apiKeySecret } = process.env;
  let vault = '';
  try {
    vault = fs.readFileSync('/etc/box/vault.env', 'utf8');
  } catch {} // not on a box, or not root
  const cdp = apiKeyId && apiKeySecret ? { apiKeyId, apiKeySecret } : cdpKeys(vault);
  const s = await startSeller({ port: Number(process.env.PORT ?? 4021), cdp });
  console.log(`test API on http://127.0.0.1:${s.port}: /joke $0.01, /report $0.03, in devnet USDC (test money), settled by ${s.settledBy}`);
}
