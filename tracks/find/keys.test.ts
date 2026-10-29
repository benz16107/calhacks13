// Find works on this computer with no account (the word index searches files, tasks and notes), so no key it can
// read may be marked as required: Settings would show "Needs a key" for an app that is working.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import track from './track.ts';

test('every key Find or one of its tools reads is optional', () => {
  const declared = new Set([...(track.secrets ?? []), ...(track.tools ?? []).flatMap((t) => t.secrets ?? []), ...(track.modelJobs ?? []).flatMap((j) => j.secrets ?? [])]);
  assert.ok(declared.size >= 8);
  assert.deepEqual([...declared].filter((k) => !track.optionalSecrets?.includes(k)), []);
});
