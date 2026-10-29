import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { droidState, updateFacts, updateStateFrom } from './system.ts';

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

test('where Droid stands: ready when it is there, what the image says while it downloads, a sentence when it is missing', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'droid-'));
  const bin = path.join(dir, 'droid');
  const status = path.join(dir, 'status');
  const none = droidState(status, bin);
  assert.equal(none.state, 'missing', 'stock Ubuntu with no Droid and no image status');
  assert.match(none.message, /setup\.sh droid/);
  fs.writeFileSync(status, 'state=downloading\nmessage=Droid, the agent worker, is downloading. Agent tasks can start once it is here.\nat=2026-10-29T16:00:00Z\n');
  assert.deepEqual(droidState(status, bin), { state: 'downloading', message: 'Droid, the agent worker, is downloading. Agent tasks can start once it is here.', at: '2026-10-29T16:00:00Z' });
  fs.writeFileSync(status, 'state=retrying\n'); // no message: still a sentence
  assert.equal(droidState(status, bin).state, 'retrying');
  assert.ok(droidState(status, bin).message.length > 10);
  fs.writeFileSync(bin, '');
  assert.equal(droidState(status, bin).state, 'ready', 'the binary is the truth once it is there');
});

test('update facts: A/B slots only on an installed image, nothing about slots on a checkout or the install disc', () => {
  const cmd = 'BOOT_IMAGE=/vmlinuz root=LABEL=box-a ro box.slot=a quiet';
  const grubenv = '# GRUB Environment Block\nsaved_entry=a\n' + '#'.repeat(900);
  assert.deepEqual(updateFacts('BOOT_IMAGE=/vmlinuz root=/dev/sda2', { image: false }), { install: 'checkout', slots: false, automatic: false });
  assert.deepEqual(updateFacts('BOOT_IMAGE=/live/vmlinuz boot=boxlive', { image: true }), { install: 'disc', slots: false, automatic: false });
  assert.deepEqual(updateFacts(cmd, { image: true, grubenv }), { install: 'image', slots: true, automatic: false, default: 'a', other: { slot: 'b' } });
  assert.deepEqual((updateFacts(cmd, { image: true, grubenv, writing: 'b\n' }) as { other?: unknown }).other, { slot: 'b', unfinished: true }, 'a write to the other slot that did not finish: it cannot start');
  assert.equal((updateFacts(cmd, { image: true, grubenv, trial: 'a 2026-10-29T12:00:00Z' }) as { trial?: string }).trial, 'a');
});
