// The two locks, live on Solana devnet with test money. Needs CDP_API_KEY_ID, CDP_API_KEY_SECRET and
// CDP_WALLET_SECRET in the environment, and an API key with the scope policies#manage.
//   set -a; . ~/.config/calhacks13/env; set +a
//   BOX_HOME=$(mktemp -d) node --experimental-strip-types tracks/wallet/cdp-wallet.live.ts
// It gets or creates the CDP account gurtos-agent-wallet, tops it up to 0.10 devnet USDC from Coinbase's faucet,
// attaches a policy (only the test payee, 5 cents a payment), then:
//   (a) pays the test seller $0.01 over x402 through Coinbase's facilitator: settles;
//   (b) asks Coinbase to sign a payment to a different payee: refused by the policy;
//   (c) asks Coinbase to sign a $0.06 payment to the test payee: refused by the cap;
//   (d) asks the policy engine about a plain SOL transfer (simulated, nothing signed): rejected.
// (b) and (c) skip GurtOS's own check on purpose, to show the Coinbase lock alone.
import {
  AccountRole, appendTransactionMessageInstruction, compileTransaction, createSolanaRpc, createTransactionMessage,
  getBase64EncodedWireTransaction, pipe, setTransactionMessageFeePayer, setTransactionMessageLifetimeUsingBlockhash,
  type Address,
} from '@solana/kit';
import { decodePaymentResponseHeader, wrapFetchWithPayment, x402Client } from '@x402/fetch';
import { ExactSvmScheme } from '@x402/svm/exact/client';
import { cdpAccount, ensurePolicy, fundCdpAccount, policySummary, walletSigner } from './cdp-wallet.ts';
import { DEVNET, RPC, balance, explorer, paymentRequired } from './lib.ts';
import { PAYEE, startSeller } from './seller.ts';

const OTHER = '6PyiR71c9aw3e8bgnxmcLvJECL5zHE5jMSWqJoVjPTxU'; // the vault-key test wallet: has a USDC account, not on the list
const env = process.env as Record<string, string | undefined>;
const ctx = { secret: (n: string) => env[n] ?? '' };
if (!env.CDP_WALLET_SECRET) {
  console.log('No CDP_WALLET_SECRET yet: make one in the CDP portal (Server Wallet), add it to the env file, run again.');
  process.exit(2);
}

const w = await walletSigner(ctx);
if (w.mode !== 'cdp') throw new Error('not in cdp mode');
console.log(`CDP account ${w.address}  ${explorer('address', w.address)}`);
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
if ((await balance(w.address).catch(() => 0)) < 0.1) {
  console.log(`faucet: ${explorer('tx', await fundCdpAccount(ctx))}`);
  for (let i = 0; i < 30 && (await balance(w.address).catch(() => 0)) < 0.1; i++) await wait(2000);
}
console.log(`balance ${await balance(w.address)} devnet USDC (test money)`);

console.log(`policy ${await ensurePolicy(ctx, { payees: [PAYEE], maxCentsPerPayment: 5 })}`);
console.log('read back from Coinbase:', JSON.stringify(await policySummary(ctx)));

const seller = await startSeller({ cdp: { apiKeyId: env.CDP_API_KEY_ID!, apiKeySecret: env.CDP_API_KEY_SECRET! } });
const url = `http://127.0.0.1:${seller.port}/joke`;
try {
  // (a)
  const client = new x402Client().register(DEVNET, new ExactSvmScheme(w.signer, { rpcUrl: RPC }));
  const res = await wrapFetchWithPayment(fetch, client)(url);
  const receipt = decodePaymentResponseHeader(res.headers.get('payment-response') ?? '');
  console.log(`(a) $0.01 to the test payee: HTTP ${res.status}, ${await res.text()}, ${explorer('tx', receipt.transaction)}`);

  // (b) and (c): the seller's real offer, with the payee or the amount changed, signed straight by Coinbase.
  const offer = (await paymentRequired(await fetch(url))).accepts[0];
  const scheme = new ExactSvmScheme(w.signer, { rpcUrl: RPC });
  for (const [name, changed] of [['(b) $0.01 to a payee not on the list', { ...offer, payTo: OTHER }], ['(c) $0.06 to the test payee', { ...offer, amount: '60000' }]] as const) {
    try {
      await scheme.createPaymentPayload(2, changed);
      console.log(`${name}: SIGNED. The policy did not stop it.`);
      process.exitCode = 1;
    } catch (e: any) {
      console.log(`${name}: refused by Coinbase: ${e.statusCode ?? ''} ${e.errorType ?? ''} ${e.message}`);
    }
  }

  // (d) a plain SOL transfer, evaluated by the policy engine without signing.
  const { cdp } = await cdpAccount(ctx);
  const { value: blockhash } = await createSolanaRpc(RPC).getLatestBlockhash().send();
  const data = new Uint8Array(12);
  new DataView(data.buffer).setUint32(0, 2, true); // System Program: Transfer
  new DataView(data.buffer).setBigUint64(4, 1000n, true);
  const sol = pipe(
    createTransactionMessage({ version: 0 }),
    (m) => setTransactionMessageFeePayer(w.address as Address, m),
    (m) => setTransactionMessageLifetimeUsingBlockhash(blockhash, m),
    (m) => appendTransactionMessageInstruction({ programAddress: '11111111111111111111111111111111' as Address, accounts: [{ address: w.address as Address, role: AccountRole.WRITABLE_SIGNER }, { address: PAYEE as Address, role: AccountRole.WRITABLE }], data }, m),
  );
  const sim = await cdp.policies.simulate({ operation: 'signSolTransaction', address: w.address, transaction: getBase64EncodedWireTransaction(compileTransaction(sol)) } as any);
  console.log(`(d) plain SOL transfer to the test payee: ${sim.action} (${sim.reason})`);
  if (sim.action !== 'reject') process.exitCode = 1;
} finally {
  seller.close();
}
