// The MCP server end to end over stdio, with a fake client and a local test seller. No money moves: the key is
// fresh and unfunded, so every payment that gets past the guards fails at signing and must leave the ledger at 0.
// Needs the internet (the test API asks x402.org which networks it settles).
//   node --experimental-strip-types --test tracks/wallet/mcp.test.ts
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';
import { after, test } from 'node:test';
import { newKey } from './keygen.ts';
import { startSeller } from './seller.ts';

const seller = await startSeller();
const host = `api.localhost:${seller.port}`;
const joke = `http://${host}/joke`;
const dirs: string[] = [];
after(() => (seller.close(), dirs.forEach((d) => fs.rmSync(d, { recursive: true, force: true }))));

/** Start the server like a client would. `onRequest` answers the server's own requests (elicitation). */
function client(env: Record<string, string>, capabilities: object, onRequest?: (m: any) => object) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'wallet-mcp-'));
  dirs.push(home);
  const p = spawn('node', ['--experimental-strip-types', '--disable-warning=ExperimentalWarning', path.join(import.meta.dirname, 'mcp.ts')], {
    env: { ...process.env, WALLET_HOME: home, WALLET_SOLANA_KEY: newKey().secret, WALLET_HOSTS: host, ...env }, stdio: ['pipe', 'pipe', 'ignore'],
  });
  const pending = new Map<number, (m: any) => void>();
  const asked: any[] = [];
  readline.createInterface({ input: p.stdout }).on('line', (l) => {
    const m = JSON.parse(l);
    if (m.method) {
      asked.push(m);
      p.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: m.id, result: onRequest!(m) }) + '\n');
    } else pending.get(m.id)?.(m);
  });
  let id = 0;
  const rpc = (method: string, params?: object) => new Promise<any>((res) => (pending.set(++id, res), p.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n')));
  const callTool = async (name: string, args: object) => {
    const r = (await rpc('tools/call', { name, arguments: args })).result;
    return { isError: !!r.isError, text: r.content[0].text as string };
  };
  const ready = rpc('initialize', { protocolVersion: '2025-06-18', capabilities, clientInfo: { name: 'test', version: '0' } });
  const ledger = () => (fs.existsSync(path.join(home, 'ledger.jsonl')) ? fs.readFileSync(path.join(home, 'ledger.jsonl'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []);
  return { rpc, callTool, ready, asked, home, ledger, close: () => p.kill() };
}

test('it lists the wallet tools and quotes a price without paying', async () => {
  const c = client({}, {});
  after(c.close);
  const init = (await c.ready).result;
  assert.equal(init.serverInfo.name, 'gurtos-wallet');
  const names = (await c.rpc('tools/list')).result.tools.map((t: any) => t.name);
  assert.ok(names.includes('wallet__quote') && names.includes('wallet__pay'));
  const q = await c.callTool('wallet__quote', { url: joke });
  assert.equal(q.isError, false);
  assert.equal(JSON.parse(q.text).cents, 1);
  assert.deepEqual(c.ledger(), []);
});

test('hosts outside WALLET_HOSTS are refused', async () => {
  const c = client({ WALLET_HOSTS: 'other.example' }, {});
  after(c.close);
  await c.ready;
  const r = await c.callTool('wallet__quote', { url: joke });
  assert.equal(r.isError, true);
  assert.match(r.text, /not one of this task's hosts/);
});

test('over budget with a client that cannot ask: refused, and the message says how to raise the budget', async () => {
  const c = client({ WALLET_BUDGET_CENTS: '0' }, {});
  after(c.close);
  await c.ready;
  await c.callTool('wallet__quote', { url: joke });
  const r = await c.callTool('wallet__pay', { url: joke });
  assert.equal(r.isError, true);
  assert.match(r.text, /WALLET_BUDGET_CENTS/);
  assert.deepEqual(c.ledger(), []);
  assert.ok(fs.readFileSync(path.join(c.home, 'actions.jsonl'), 'utf8').includes('"type":"result"'));
});

test('over budget with elicitation: the human sees amount, payee and test money; no means no', async () => {
  const c = client({ WALLET_BUDGET_CENTS: '0' }, { elicitation: {} }, () => ({ action: 'decline' }));
  after(c.close);
  await c.ready;
  await c.callTool('wallet__quote', { url: joke });
  const r = await c.callTool('wallet__pay', { url: joke });
  assert.equal(r.isError, true);
  assert.match(r.text, /not approved/);
  assert.equal(c.asked.length, 1);
  assert.equal(c.asked[0].method, 'elicitation/create');
  assert.match(c.asked[0].params.message, /1 cents \(test money/);
  assert.match(c.asked[0].params.message, /To: 39w7W3SB/);
  assert.deepEqual(c.ledger(), []);
});

test('an approved payment runs the real guards; a failure gives the reservation back', async () => {
  const c = client({ WALLET_BUDGET_CENTS: '0' }, { elicitation: {} }, () => ({ action: 'accept', content: { approve: true } }));
  after(c.close);
  await c.ready;
  await c.callTool('wallet__quote', { url: joke });
  const r = await c.callTool('wallet__pay', { url: joke }); // the key has no funds, so signing fails
  assert.equal(r.isError, true);
  assert.equal(c.asked.length, 1);
  const rows = c.ledger();
  assert.equal(rows.length, 2);
  assert.equal(rows.reduce((s, x) => s + x.cents, 0), 0);
});

test('within budget it does not ask, and a price other than the agreed one is refused', async () => {
  const c = client({ WALLET_BUDGET_CENTS: '5' }, { elicitation: {} }, () => ({ action: 'decline' }));
  after(c.close);
  await c.ready;
  const r = await c.callTool('wallet__pay', { url: joke, cents: 2 });
  assert.equal(r.isError, true);
  assert.match(r.text, /the price is \$0\.01/);
  assert.equal(c.asked.length, 0);
  assert.equal(c.ledger().reduce((s, x) => s + x.cents, 0), 0);
});

test('a key file readable by others is refused', async () => {
  const c = client({ WALLET_SOLANA_KEY: '' }, {});
  after(c.close);
  await c.ready;
  fs.writeFileSync(path.join(c.home, 'key'), newKey().secret);
  fs.chmodSync(path.join(c.home, 'key'), 0o644);
  const r = await c.callTool('wallet__quote', { url: joke });
  assert.equal(r.isError, false); // quote needs no key
  const p = await c.callTool('wallet__pay', { url: joke, cents: 1 });
  assert.match(p.text, /chmod 600/);
});
