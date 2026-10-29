import assert from 'node:assert/strict';
import test from 'node:test';
import { appUndoRefusal, runsCommands } from './permissions.ts';

test('a task that names no worker runs Droid, so the shell permission is checked for it too', () => {
  assert.ok(runsCommands({}), 'no worker: Droid, the default');
  assert.ok(runsCommands({ worker: 'droid' }));
  assert.ok(!runsCommands({ worker: 'fake' }));
});

test("an app may undo a task, but not one whose changes the owner kept in their folder", () => {
  assert.equal(appUndoRefusal({ review: 'pending' }), undefined);
  assert.equal(appUndoRefusal({}), undefined);
  assert.match(appUndoRefusal({ review: 'kept' }) ?? '', /only the owner can undo it/);
});
