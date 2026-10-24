import assert from 'node:assert/strict';
import { test } from 'node:test';
import { updateStateFrom } from './system.ts';

test('system update state comes from the slot, the trial file and the last line', () => {
  const cmd = 'BOOT_IMAGE=/vmlinuz root=LABEL=box-a ro box.slot=a quiet';
  assert.equal(updateStateFrom(cmd, '', '', false).state, 'unknown', 'not an image');
  assert.equal(updateStateFrom('BOOT_IMAGE=/vmlinuz', '', '', true).state, 'unknown', 'no slot on the command line');
  assert.equal(updateStateFrom(cmd, '', '', true).state, 'current');
  assert.equal(updateStateFrom(cmd, 'b 2026-10-24T20:00:00Z', '', true).state, 'ready', 'written to the other slot, starts next restart');
  assert.equal(updateStateFrom(cmd, 'a 2026-10-24T20:00:00Z', '', true).state, 'trial', 'running it, not confirmed yet');
  const back = updateStateFrom(cmd, '', '2026-10-24T21:00:00Z slot b, build x, was not healthy; rolled back to slot a', true);
  assert.equal(back.state, 'rolledBack');
  assert.equal(back.lastAt, '2026-10-24T21:00:00Z');
  assert.equal(updateStateFrom(cmd, '', '2026-10-24T21:00:00Z the update in slot b did not start; still on slot a', true).state, 'rolledBack');
  assert.equal(updateStateFrom(cmd, '', '2026-10-24T21:00:00Z slot a, build x, confirmed', true).state, 'current');
});
