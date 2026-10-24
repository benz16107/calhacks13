// The wallet's guards, with no money moving: which URLs it reaches, cents to USDC units, refusing a price
// other than the agreed one, and refusing to pay twice for one call. Needs the internet (the test API asks
// x402.org which networks it settles).
//   node --experimental-strip-types --test tracks/wallet/wallet.test.ts
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';
import type { Approval, Ctx, LogEvent, Tool } from '../../core/contract.ts';
import { newKey } from './keygen.ts';
import { PAYEE, cdpKeys, startSeller } from './seller.ts';
import wallet, { allowedUrl, atomic, payments } from './track.ts';

process.env.BOX_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'wallet-test-'));
const tool = (name: string) => wallet.tools.find((t) => t.name === name) as Tool;
// A fresh key with no funds: every case here must stop before signing.
const key = newKey().secret;
const ctx = (hosts: string[], callKey: string, approvals: Partial<Approval>[] = []) =>
  ({ key: callKey, task: { id: 't1', hosts }, box: { approvals: () => approvals }, secret: (n: string) => { if (n !== 'WALLET_SOLANA_KEY') throw new Error(`the vault has no ${n}`); return key; }, log: () => {}, cost: () => {} }) as unknown as Ctx;

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

test('without cents it pays only the quoted price, which the budget check and the approval see', async () => {
  const pay = tool('wallet.pay');
  const report = { url: `http://${host}/report` }; // never quoted
  assert.equal(pay.cost!(report), 0);
  await assert.rejects(pay.run(report, ctx([host], 'n1')), /call wallet\.quote first/);

  const joke = { url: `http://${host}/joke` }; // quoted at $0.01 by the earlier test
  assert.equal(pay.cost!(joke), 1);
  assert.deepEqual(pay.approval!(joke), { payee: PAYEE, purpose: `${joke.url} in devnet USDC (test money)` });
  const approvedAt3 = [{ task: 't1', state: 'approved', purpose: `${joke.url} in devnet USDC (test money)`, costCents: 3 }] as Approval[];
  await assert.rejects(pay.run(joke, ctx([host], 'n2', approvedAt3)), /price changed since the owner approved/);
  await assert.rejects(pay.run({ url: joke.url }, ctx([host], 'n3')), /call wallet\.quote first/); // not the object cost() priced
});

test('the ledger keeps each settled payment once, and the page shows it as test money', async () => {
  const paid = { usdc: '0.03', cents: 3, payee: PAYEE, network: 'solana-devnet', test: true, tx: 'TX1abcdefghijk', explorer: 'https://explorer.solana.com/tx/TX1abcdefghijk?cluster=devnet' };
  const result = { seq: 1, at: '2026-10-24T17:00:00.000Z', type: 'tool.result', task: 't1', key: 'k', ok: true, output: { paid } } as LogEvent;
  const reader = wallet.logReaders[0];
  for (const e of [result, result, { ...result, output: { status: 200 } }, { ...result, ok: false }] as LogEvent[]) await reader.read(e, {} as any);
  assert.deepEqual(payments().map((p) => p.tx), ['TX1abcdefghijk']);
  const fet = { ...result, output: { paid: { amount: '0.5 testnet FET', payee: 'fetch1agent', network: 'fetch-dorado', test: true, tx: 'FETTX1' } } } as LogEvent;
  await reader.read(fet, {} as any);
  assert.deepEqual(payments().map((p) => [p.tx, p.amount, p.network]), [['FETTX1', '0.5 testnet FET', 'fetch-dorado'], ['TX1abcdefghijk', '$0.03', 'solana-devnet']]);

  const fakeBox = { job: async () => ({ wallet: 'W1', usdc: 19.95 }), task: () => ({ title: 'Buy a <b>report</b>' }) } as any;
  const page = await (await wallet.routes['GET /'](new Request('http://box/t/wallet/'), fakeBox)).text();
  assert.match(page, /TEST MONEY/);
  assert.match(page, /19\.95 USDC/);
  assert.match(page, /\$0\.03/);
  assert.match(page, /TX1a…hijk/);
  assert.match(page, /0\.5 testnet FET/); // another payment route's receipt shows too, unlinked
  assert.match(page, /Buy a &#60;b&#62;report/); // a task title is the owner's text: escaped
});

test('the status page says how to set it up without a key', async () => {
  const noKey = { secret: () => { throw new Error('the vault has no WALLET_SOLANA_KEY'); } } as unknown as Ctx;
  const status: any = await wallet.modelJobs[0].run({}, noKey);
  assert.equal(status.wallet, null);
  assert.match(status.setup, /WALLET_SOLANA_KEY/);
});

test('CDP keys come from the vault only when both are there', () => {
  assert.deepEqual(cdpKeys('A=1\nCDP_API_KEY_ID = id-1\nCDP_API_KEY_SECRET=c2Vj+ZXQ/==\n'), { apiKeyId: 'id-1', apiKeySecret: 'c2Vj+ZXQ/==' });
  assert.equal(cdpKeys('CDP_API_KEY_ID=id-1\n'), undefined);
  assert.equal(cdpKeys(''), undefined);
});
