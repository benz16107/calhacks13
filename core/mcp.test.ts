import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';
import test from 'node:test';

test('the MCP relay lists broker tools and passes calls through with stable keys', async () => {
  const sock = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-')), 'broker.sock');
  const calls: any[] = [];
  const broker = http.createServer(async (req, res) => {
    let body = '';
    for await (const c of req) body += c;
    const out =
      req.url === '/tools'
        ? [{ name: 'shop.buy', description: 'Buy', input: { type: 'object' } }]
        : (calls.push(JSON.parse(body)), { ok: true, output: { paid: 1 } });
    res.end(JSON.stringify(out));
  });
  await new Promise<void>((r) => broker.listen(sock, r));

  const child = spawn(process.execPath, ['--experimental-strip-types', '--disable-warning=ExperimentalWarning', new URL('./workers/mcp.ts', import.meta.url).pathname], {
    env: { ...process.env, BOX_SOCKET: sock },
    stdio: ['pipe', 'pipe', 'inherit'],
  });
  const lines = readline.createInterface({ input: child.stdout! })[Symbol.asyncIterator]();
  const rpc = async (id: number, method: string, params?: object) => {
    child.stdin!.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
    return JSON.parse((await lines.next()).value).result;
  };

  assert.equal((await rpc(1, 'initialize', { protocolVersion: '2025-06-18' })).serverInfo.name, 'box');
  const { tools } = await rpc(2, 'tools/list');
  assert.deepEqual(tools.map((t: { name: string }) => t.name), ['box_ask', 'shop__buy']);
  const r = await rpc(3, 'tools/call', { name: 'shop__buy', arguments: { item: 'milk' } });
  assert.equal(r.content[0].text, '{"paid":1}');
  await rpc(4, 'tools/call', { name: 'shop__buy', arguments: { item: 'milk' } });
  assert.equal(calls[0].tool, 'shop.buy');
  assert.notEqual(calls[0].key, calls[1].key); // a second identical call is a new call

  child.kill();
  broker.close();
});
