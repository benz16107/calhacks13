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
