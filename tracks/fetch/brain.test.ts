// brain.py's message rules, which decide what a chat message does. Runs python3 on the module's pure functions.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import test from 'node:test';

const py = (code: string) =>
  JSON.parse(execFileSync('python3', ['-B', '-c', `import sys, json; sys.path.insert(0, '${new URL('.', import.meta.url).pathname}'); import brain\n${code}`], { encoding: 'utf8' }));

test('a click or answer reads as what the person meant', () => {
  const said = {
    'Yes, no problem, go ahead': 'approve',
    'The user approved the card interaction you requested': 'approve',
    'The user did not approve the card': 'deny',
    'No': 'deny',
    'The user chose to keep the changes': 'keep',
    'The user clicked Undo': 'undo',
    'check if the filters are back in stock': null,
  };
  assert.deepEqual(py(`print(json.dumps({t: brain.verdict(t) for t in ${JSON.stringify(Object.keys(said))}}))`), said);
});

test('Droid steps become short lines for the chat', () => {
  const steps = ['box___apify__run {"actor":"apify/rag-web-browser","input":{"query":"Hario V60 filters"}}', 'Execute {"command":"node --test"}'];
  assert.deepEqual(py(`print(json.dumps([brain.step_text(s) for s in ${JSON.stringify(steps)}]))`), ['apify.run Hario V60 filters', 'Execute node --test']);
});

// A stub of the box's API: /health says the box started again and resumed one task.
const RESTART = `
import http.server, threading, tempfile, os, json
started = {'at': '2026-10-24T10:00:00Z'}
class H(http.server.BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def do_GET(self):
        body = {'startedAt': started['at'], 'resumed': ['t1']} if self.path == '/health' else []
        self.send_response(200); self.end_headers(); self.wfile.write(json.dumps(body).encode())
    do_POST = do_GET
s = http.server.HTTPServer(('127.0.0.1', 0), H)
threading.Thread(target=s.serve_forever, daemon=True).start()
brain.API = f'http://127.0.0.1:{s.server_port}'
b = brain.Brain(tempfile.mkdtemp())
b.s['chats']['t1'] = {'to': 'agent1qowner', 'session': 's1', 'title': 'Long job', 'seq': 0, 'at': 0, 'wait': None}
b.check_restart()                 # first sight of the box: nothing to say
quiet = list(b.outbox)
started['at'] = '2026-10-24T10:05:00Z'; b.last_health = 0
b.check_restart()                 # the box came back after a power cut
print(json.dumps({'quiet': quiet, 'said': [m['text'] for m in b.outbox]}))
`;

test('after a power cut, each chat hears that its task is resuming', () => {
  const r = py(RESTART);
  assert.deepEqual(r.quiet, []);
  assert.equal(r.said.length, 1);
  assert.match(r.said[0], /^GurtOS restarted \(a power cut or a reboot\) and is resuming Long job \(t1\) where it stopped/);
});

test('a payment amount must be plain test FET', () => {
  assert.deepEqual(py(`print(json.dumps([str(brain.fet(x)) if brain.fet(x) is not None else None for x in ['0.5', '5', '0', '-1', '1e3', 'NaN', '0.1234567890123456789', 3]]))`),
    ['0.5', '5', null, null, null, null, null, null]);
});

test('linking another box needs proof of its code', () => {
  const r = py(`print(json.dumps([brain.pair_proof('123456', 'n1', 'a', 'b'), brain.pair_proof('123457', 'n1', 'a', 'b'), brain.pair_proof('123456', 'n2', 'a', 'b')]))`);
  assert.equal(new Set(r).size, 3);
  assert.match(r[0], /^[0-9a-f]{32}$/);
});

test("ASI:One's @mention is not part of the message, and only words of a check make a status check", () => {
  const r = py(`print(json.dumps([brain.AT_ME.sub('', t).strip() for t in ['@agent1qvuk46tnt9lnscher0pawl7pr5y525mak66ptwsrvg4kff0pfy9m2sy0us6 Is the Hario V60 filter back in stock?', '@gurtos {"action": "approve"}', 'email me@example.com']]))`);
  assert.deepEqual(r, ['Is the Hario V60 filter back in stock?', '{"action": "approve"}', 'email me@example.com']);
  const s = py(`print(json.dumps([brain.STATUS.search(t.lower()) is not None for t in ['Is the Hario V60 filter back in stock?', 'Status check: how is the fix going?', 'Follow up: has the test fix completed?']]))`);
  assert.deepEqual(s, [false, true, true]);
});
