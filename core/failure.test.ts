import assert from 'node:assert/strict';
import { test } from 'node:test';
import { failureText } from './system.ts';

test('a task failure is a sentence, and only a real agent\'s failure is blamed on Claude', () => {
  assert.equal(failureText('Error: fetch failed ECONNREFUSED', 1, 'anthropic', 'droid'), "Couldn't reach Claude. Check this computer's internet connection.");
  assert.equal(failureText('Error: 401 {"type":"error","error":{"type":"authentication_error"}}', 1, 'anthropic', 'droid'), 'Your Anthropic key was not accepted. Change it in Settings, Keys.');
  assert.equal(failureText('Error: wallet.pay: fetch failed ECONNREFUSED', 1, 'anthropic', 'fake'), 'wallet.pay: fetch failed ECONNREFUSED', "a scripted task's own tool failing is not Claude's");
  assert.equal(failureText(undefined, 1, undefined, 'fake'), 'The task stopped with an error (code 1).');
});
