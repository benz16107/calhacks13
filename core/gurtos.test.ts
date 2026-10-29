import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

const cli = new URL('./gurtos.ts', import.meta.url).pathname;
/** Run the command with its own home folder (where it keeps the setup token), and read its JSON answer. */
function gurtos(home: string, ...args: string[]): Promise<{ code: number | null; out: string; json: any }> {
  return new Promise((resolve) => {
    const child = execFile(process.execPath, ['--experimental-strip-types', '--disable-warning=ExperimentalWarning', cli, ...args], { env: { ...process.env, HOME: home }, encoding: 'utf8', timeout: 20000 }, (e, out) => {
      let json;
      try {
        json = JSON.parse(out);
      } catch {} // usage text, not JSON
      resolve({ code: e ? ((e as { code?: number }).code ?? 1) : 0, out, json });
    });
    child.stdin?.end();
  });
}
const connected = (url: string) => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'gurtos-'));
  fs.mkdirSync(path.join(home, '.config', 'gurtos'), { recursive: true });
  fs.writeFileSync(path.join(home, '.config', 'gurtos', 'setup.json'), JSON.stringify({ url, token: 't' }));
  return home;
};

test('gurtos with no command, or help, prints what it can do', async () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'gurtos-'));
  for (const args of [[], ['help'], ['--help']]) {
    const r = await gurtos(home, ...args);
    assert.match(r.out, /gurtos connect <url> <code>/, args.join(' ') || '(nothing)');
    assert.match(r.out, /gurtos key set <NAME>/);
  }
  assert.equal((await gurtos(home, 'help')).code, 0);
});

test('gurtos budget needs both amounts, and never sends a 0 it made up', async () => {
  let asked = 0;
  const server = http.createServer((_req, res) => (asked++, res.writeHead(200, { 'content-type': 'application/json' }).end('{}')));
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const home = connected(`http://127.0.0.1:${(server.address() as { port: number }).port}`);
  try {
    for (const args of [['budget'], ['budget', '5'], ['budget', '', '1'], ['budget', 'five', '1']]) {
      const r = await gurtos(home, ...args);
      assert.equal(r.code, 1, args.join(' '));
      assert.equal(r.json?.ok, false);
      assert.match(r.json?.error, /a dollar amount/);
    }
    assert.equal(asked, 0, 'nothing reached the computer');
  } finally {
    server.close();
  }
});

test('gurtos says plainly when the computer cannot be reached, the token has ended, or the settings are not JSON', async () => {
  const closed = http.createServer();
  await new Promise<void>((r) => closed.listen(0, '127.0.0.1', r));
  const port = (closed.address() as { port: number }).port;
  await new Promise((r) => closed.close(r)); // nothing listens there now
  const dead = await gurtos(connected(`http://127.0.0.1:${port}`), 'status');
  assert.equal(dead.json?.ok, false);
  assert.match(dead.json?.error, /^Couldn't reach http:\/\/127\.0\.0\.1:\d+ \(ECONNREFUSED\)/);
  const server = http.createServer((_req, res) => res.writeHead(401, { 'content-type': 'application/json' }).end(JSON.stringify({ error: 'pair this phone with this computer first' })));
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  try {
    const ended = await gurtos(connected(`http://127.0.0.1:${(server.address() as { port: number }).port}`), 'status');
    assert.match(ended.json?.error, /setup token no longer works/);
  } finally {
    server.close();
  }
  const bad = await gurtos(connected(`http://127.0.0.1:${port}`), 'settings', '{nope');
  assert.match(bad.json?.error, /^settings: give the changes as JSON/);
});
