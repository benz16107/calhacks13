import assert from 'node:assert/strict';
import { test } from 'node:test';
import { failureText, startFailureText } from './system.ts';

test('a task failure is a sentence, and only a real agent\'s failure is blamed on Claude', () => {
  assert.equal(failureText('Error: fetch failed ECONNREFUSED', 1, 'anthropic', 'droid'), "Couldn't reach Claude. Check this computer's internet connection.");
  assert.equal(failureText('Error: 401 {"type":"error","error":{"type":"authentication_error"}}', 1, 'anthropic', 'droid'), 'Your Anthropic key was not accepted. Change it in Settings, Accounts & Keys.');
  assert.equal(failureText('Error: wallet.pay: fetch failed ECONNREFUSED', 1, 'anthropic', 'fake'), 'wallet.pay: fetch failed ECONNREFUSED', "a scripted task's own tool failing is not Claude's");
  assert.equal(failureText(undefined, 1, undefined, 'fake'), 'The task stopped with an error (code 1).');
});

test("systemd's own exit codes (it could not set the sandbox up) and a full disk are named, not shown as a number", () => {
  assert.equal(failureText(undefined, 200, 'factory', 'droid'), "GurtOS could not start this task's sandbox (systemd code 200). Try the task again; if it keeps failing, restart this computer.");
  assert.equal(failureText(undefined, 217, undefined, 'fake'), "GurtOS could not start this task's sandbox (systemd code 217). Try the task again; if it keeps failing, restart this computer.");
  assert.equal(failureText('Error: ENOSPC: no space left on device, write', 1, 'factory', 'droid'), "This computer's disk is full. Free some space, then run the task again.");
  assert.equal(failureText('ENOSPC: no space left on device', 1, undefined, 'fake'), "This computer's disk is full. Free some space, then run the task again.");
});

test('a task that could not start says why in words, never the command line', () => {
  assert.equal(startFailureText("ENOSPC: no space left on device, mkdir '/var/lib/box/tasks/t1/upper'"), "This computer's disk is full. Free some space, then run the task again.");
  assert.equal(startFailureText('Command failed: mount -t overlay overlay -o lowerdir=/var/lib/box/workspaces/home,upperdir=/x /y\nmount: wrong fs type'), 'GurtOS could not set this task up (mount failed). Try the task again; if it keeps failing, restart this computer.');
  assert.equal(startFailureText('No model key yet. Add an Anthropic or Factory API key in Settings, Accounts & Keys, then start the task again.'), 'No model key yet. Add an Anthropic or Factory API key in Settings, Accounts & Keys, then start the task again.');
});
