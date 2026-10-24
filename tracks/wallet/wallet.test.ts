// The wallet's guards, with no money moving: which URLs it reaches, cents to USDC units, refusing a price
// other than the agreed one, and refusing to pay twice for one call. Needs the internet (the test API asks
// x402.org which networks it settles).
//   node --experimental-strip-types --test tracks/wallet/wallet.test.ts
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';
import type { Ctx, Tool } from '../../core/contract.ts';
import { newKey } from './keygen.ts';
import { startSeller } from './seller.ts';
import wallet, { allowedUrl, atomic } from './track.ts';

process.env.BOX_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'wallet-test-'));
const tool = (name: string) => wallet.tools.find((t) => t.name === name) as Tool;
// A fresh key with no funds: every case here must stop before signing.
const key = newKey().secret;
const ctx = (hosts: string[], callKey: string) =>
  ({ key: callKey, task: { hosts }, secret: () => key, log: () => {}, cost: () => {} }) as unknown as Ctx;

const seller = await startSeller();
const host = `api.localhost:${seller.port}`;
after(() => (seller.close(), fs.rmSync(process.env.BOX_HOME!, { recursive: true, force: true })));

test('the wallet reaches only the task hosts, with the same rule as the task network', () => {
  assert.equal(allowedUrl(['api.localhost:4021'], 'http://api.localhost:4021/joke').pathname, '/joke');
  assert.throws(() => allowedUrl(['api.localhost:4021'], 'http://api.localhost:7700/approvals'), /not one of this task's hosts/);
  assert.throws(() => allowedUrl(['api.localhost:4021'], 'http://evil.example/'), /not one of/);
  assert.ok(allowedUrl(['*.example.com'], 'https://a.example.com/x'));
  assert.throws(() => allowedUrl(['example.com'], 'file:///etc/box/vault.env'), /only http and https/);
});

test('cents become USDC atomic units (6 decimals)', () => {
  assert.equal(atomic(1), '10000');
  assert.equal(atomic(3), '30000');
  assert.equal(atomic(0.1), '1000');
});

test('a quote reads the 402 price without paying', async () => {
  const q: any = await tool('wallet.quote').run({ url: `http://${host}/joke` }, ctx([host], 'q1'));
  assert.equal(q.status, 402);
  assert.equal(q.cents, 1);
  assert.equal(q.test, true);
});

test('it pays exactly the agreed price or nothing, and never twice for one call', async () => {
  const pay = tool('wallet.pay');
  await assert.rejects(pay.run({ url: `http://${host}/joke`, cents: 2 }, ctx([host], 'p1')), /the price is \$0\.01/);
  await assert.rejects(pay.run({ url: `http://${host}/joke`, cents: 1 }, ctx([host], 'p1')), /not paying twice/);
  await assert.rejects(pay.run({ url: `http://${host}/joke`, cents: 1 }, ctx(['other.localhost'], 'p2')), /not one of this task's hosts/);
  await assert.rejects(pay.run({ url: `http://${host}/joke`, cents: 0 }, ctx([host], 'p3')), /positive/);
  await assert.rejects(pay.run({ url: `http://${host}/joke`, cents: '1' }, ctx([host], 'p4')), /positive/);
  assert.equal(pay.cost!({ cents: '1' }), 0); // a string must not reach the task's cost total
  assert.equal(pay.cost!({ cents: -5 }), 0);
  assert.equal(pay.cost!({ cents: 3 }), 3);
});

test('the status page labels the wallet as devnet test money, and says how to set it up without a key', async () => {
  const fakeBox = { job: async () => ({ wallet: 'W1', usdc: 19.95, explorer: 'https://explorer.solana.com/address/W1?cluster=devnet' }) } as any;
  const page = await (await wallet.routes['GET /'](new Request('http://box/t/wallet/'), fakeBox)).text();
  assert.match(page, /19\.95 USDC on Solana devnet\. Test money/);
  const noKey = { secret: () => { throw new Error('the vault has no WALLET_SOLANA_KEY'); } } as unknown as Ctx;
  const status: any = await wallet.modelJobs[0].run({}, noKey);
  assert.equal(status.wallet, null);
  assert.match(status.setup, /WALLET_SOLANA_KEY/);
});
