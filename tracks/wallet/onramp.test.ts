// Onramp session request, with a stubbed fetch. node --experimental-strip-types --test tracks/wallet/onramp.test.ts
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { test } from 'node:test';
import { newKey } from './keygen.ts';
import { createTopup } from './onramp.ts';

const kp = generateKeyPairSync('ed25519');
// CDP's Ed25519 secret is base64 of the 32-byte seed followed by the 32-byte public key.
const edKey = Buffer.concat([kp.privateKey.export({ type: 'pkcs8', format: 'der' }).subarray(16), kp.publicKey.export({ type: 'spki', format: 'der' }).subarray(12)]).toString('base64');
const wallet = newKey().secret;
const ctx = { secret: (n: string) => ({ WALLET_SOLANA_KEY: wallet, CDP_API_KEY_ID: 'id', CDP_API_KEY_SECRET: edKey })[n]! } as any;

test('a session is always a sandbox order for the wallet address on Solana', async () => {
  let sent: any;
  const f = (async (_u: string, init: any) => ((sent = JSON.parse(init.body)), Response.json({ session: { onrampUrl: 'https://pay.coinbase.com/buy?sessionToken=x' } }, { status: 201 }))) as any;
  const r = await createTopup(ctx, 5, f);
  assert.equal(r.ok, true);
  assert.equal(sent.partnerUserRef.startsWith('sandbox-'), true);
  assert.equal(sent.destinationNetwork, 'solana');
  assert.equal(sent.paymentAmount, '5.00');
});

test('a refusal comes back as setup steps and the faucet steps', async () => {
  const f = (async () => Response.json({ errorMessage: 'failed to find app' }, { status: 404 })) as any;
  const r = await createTopup(ctx, 10, f);
  assert.equal(r.ok, false);
  if (!r.ok) assert.ok(r.setup.length && r.faucet.length && r.reason === 'failed to find app');
});

test('amounts outside 0 to 20 dollars are refused', async () => {
  await assert.rejects(createTopup(ctx, 500, (() => assert.fail()) as any), /between 0 and 20/);
  await assert.rejects(createTopup(ctx, Number.NaN, (() => assert.fail()) as any), /between/);
});
