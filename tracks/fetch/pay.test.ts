// The Fetch wallet with no network: pay.py's offline ledger, and wallet.ts on top of it. Test FET only.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';
import type { Ctx } from '../../core/contract.ts';

const PAY = new URL('pay.py', import.meta.url).pathname;
const state = fs.mkdtempSync(path.join(os.tmpdir(), 'fetch-pay-'));
process.env.BOX_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'fetch-box-'));
process.env.BOX_DEMO = '1';
delete process.env.DEMO_LIVE;
const { boxWallet, payTool, verifyIncoming } = await import('./wallet.ts');
after(() => (fs.rmSync(state, { recursive: true, force: true }), fs.rmSync(process.env.BOX_HOME!, { recursive: true, force: true })));

const newKey = () => randomBytes(32).toString('hex');
const TO = `fetch1test${'q'.repeat(34)}`;
const OTHER = `fetch1test${'p'.repeat(34)}`;
const outputs: string[] = [];
/** Run pay.py offline. Returns the JSON line and the exit code. */
function py(key: string, ...args: string[]) {
  const env = { PATH: process.env.PATH, FETCH_LEDGER: 'offline', FETCH_STATE: state, FETCH_WALLET_KEY: key };
  try {
    const out = execFileSync('python3', ['-I', '-B', PAY, ...args], { env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    outputs.push(out);
    return { code: 0, ...JSON.parse(out) };
  } catch (e: any) {
    outputs.push(e.stdout, e.stderr);
    return { code: e.status, ...JSON.parse(e.stdout) };
  }
}

test('a send is found by verify, and every wrong detail fails', () => {
  const key = newKey();
  const sent = py(key, 'send', TO, '0.1', 'order-1');
  assert.equal(sent.code, 0);
  assert.equal(sent.simulated, true);
  assert.match(sent.tx, /^offline-[0-9a-f]{32}$/);
  assert.equal(sent.amount, '0.1');
  const ok = py(key, 'verify', sent.tx, TO, '0.1', 'order-1');
  assert.deepEqual([ok.code, ok.ok, ok.from, ok.to, ok.amount], [0, true, sent.from, TO, '0.1']);
  assert.equal(py(key, 'verify', sent.tx, TO, '0.05').ok, true, 'paying more than asked is fine');
  for (const bad of [
    ['verify', sent.tx, TO, '0.2', 'order-1'],
    ['verify', sent.tx, OTHER, '0.1', 'order-1'],
    ['verify', sent.tx, TO, '0.1', 'order-2'],
    ['verify', 'offline-00000000000000000000000000000000', TO, '0.1'],
  ]) {
    const r = py(key, ...bad);
    assert.deepEqual([r.code, r.ok], [1, false], bad.join(' '));
    assert.ok(r.error);
  }
});

test('send refuses a bad address, a bad amount and an empty wallet', () => {
  const key = newKey();
  assert.match(py(key, 'send', 'fetch1abc', '1', 'm').error, /not a Fetch address/);
  assert.match(py(key, 'send', TO, '0', 'm').error, /positive/);
  assert.match(py(key, 'send', TO, '0.0000000000000000001', 'm').error, /18 decimal/);
  assert.match(py(key, 'send', TO, '1000', 'm').error, /not enough test FET/);
});

test('find sees an earlier send from the same wallet only', () => {
  const [a, b] = [newKey(), newKey()];
  const sent = py(a, 'send', TO, '0.3', 'find-me');
  assert.equal(py(a, 'find', TO, '0.3', 'find-me').tx, sent.tx);
  assert.equal(py(a, 'find', TO, '0.3', 'other').found, false);
  assert.equal(py(b, 'find', TO, '0.3', 'find-me').found, false);
});

test('the address is stable, fake and offline, and the key is never printed', () => {
  const key = newKey();
  const a = py(key, 'address');
  assert.equal(a.address, py(key, 'address').address);
  assert.match(a.address, /^fetch1test[02-9ac-hj-np-z]{34}$/);
  py(key, 'balance');
  py('not-a-key', 'address');
  py(key.slice(0, 10), 'send', TO, '1', 'm');
  for (const k of [key, 'not-a-key', key.slice(0, 10)]) assert.ok(!outputs.some((o) => o?.includes(k)), 'a key was printed');
});

// ---------- wallet.ts ----------

const ctx = (key: string) => ({ key, log: () => {} }) as unknown as Ctx;
const pay = { to: TO, amount: '0.25', reference: 'invoice-7', why: 'a test payment' };

test('fetch.pay checks its input, prices it at $1 per FET, and names the payee', async () => {
  const run = (input: object) => payTool.run({ ...pay, ...input }, ctx('bad'));
  await assert.rejects(run({ to: 'fetch1short' }), /Fetch address/);
  await assert.rejects(run({ amount: '5.000000000000000001' }), /5 FET limit/);
  await assert.rejects(run({ amount: '6' }), /5 FET limit/);
  await assert.rejects(run({ amount: '0' }), /more than 0/);
  await assert.rejects(run({ amount: 1 }), /decimal string/);
  await assert.rejects(run({ reference: 'has space' }), /reference/);
  await assert.rejects(run({ why: 'x'.repeat(201) }), /why/);
  assert.equal(payTool.cost!({ ...pay, amount: '0.1' }), 10);
  assert.equal(payTool.cost!({ ...pay, amount: '5' }), 500);
  assert.equal(payTool.cost!({ ...pay, amount: 'nope' }), 0);
  assert.deepEqual(payTool.approval!(pay), { payee: TO, purpose: 'a test payment (test FET on Fetch testnet)' });
});

test('fetch.pay pays once per call key, even when the call runs again', async () => {
  const first = (await payTool.run(pay, ctx('k1'))) as any;
  assert.deepEqual([first.test, first.simulated, first.amount, first.to], [true, true, '0.25', TO]);
  assert.deepEqual(await payTool.run(pay, ctx('k1')), first);
  const second = (await payTool.run(pay, ctx('k2'))) as any;
  assert.notEqual(second.tx, first.tx);
  const ledger = JSON.parse(fs.readFileSync(path.join(process.env.BOX_HOME!, 'fetch', 'ledger.json'), 'utf8'));
  assert.equal(ledger.length, 2);
  assert.equal((await boxWallet()).balance, '99.5');
});

test('a call cut off after it paid finds its payment instead of paying again', async () => {
  const marks = path.join(process.env.BOX_HOME!, 'fetch', 'payments.jsonl');
  const sent = JSON.parse(execFileSync('python3', ['-I', '-B', PAY, 'send', TO, '0.25', 'cut-off'], { env: { PATH: process.env.PATH, FETCH_LEDGER: 'offline', FETCH_STATE: path.join(process.env.BOX_HOME!, 'fetch'), FETCH_WALLET_KEY: fs.readFileSync(path.join(process.env.BOX_HOME!, 'fetch', 'wallet'), 'utf8') }, encoding: 'utf8' }));
  fs.appendFileSync(marks, `${JSON.stringify({ key: 'k3', to: TO, amount: '0.25', reference: 'cut-off' })}\n`); // started, never finished
  const r = (await payTool.run({ ...pay, reference: 'cut-off' }, ctx('k3'))) as any;
  assert.equal(r.tx, sent.tx);
});

test('verifyIncoming accepts a payment to the box once, for its own reference', async () => {
  const { address, simulated, test: isTest } = await boxWallet();
  assert.deepEqual([simulated, isTest], [true, true]);
  const buyer = newKey();
  const env = { PATH: process.env.PATH, FETCH_LEDGER: 'offline', FETCH_STATE: path.join(process.env.BOX_HOME!, 'fetch'), FETCH_WALLET_KEY: buyer };
  const sent = JSON.parse(execFileSync('python3', ['-I', '-B', PAY, 'send', address, '0.5', 'req-1'], { env, encoding: 'utf8' }));
  assert.equal((await verifyIncoming(sent.tx, '0.5', 'req-1')).ok, true);
  assert.equal((await verifyIncoming(sent.tx, '0.5', 'req-1')).ok, true, 'asking again about the same request is fine');
  assert.match((await verifyIncoming(sent.tx, '0.5', 'req-2')).error!, /already used/);
  assert.equal((await verifyIncoming(sent.tx, '0.6', 'req-1')).ok, false);
  assert.equal((await verifyIncoming('offline-nope', '0.5', 'req-3')).ok, false);
  assert.equal((await verifyIncoming('bad tx!', '0.5', 'req-3')).ok, false);
});
