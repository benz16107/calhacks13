import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { DEFAULT_SETTINGS, applyPatch, insideAny, loadSetup, recordStep } from './config.ts';

const dir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'cfg-'));

test('settings: valid changes apply, nested ones merge, bad ones name the field', () => {
  const s = applyPatch(DEFAULT_SETTINGS, { defaultBudgetCents: 250, quietHours: { enabled: true }, defaultHosts: ['Example.COM', 'example.com', '*.cdn.example.com:443'] });
  assert.equal(s.defaultBudgetCents, 250);
  assert.deepEqual(s.quietHours, { enabled: true, from: '22:00', to: '07:00' });
  assert.deepEqual(s.defaultHosts, ['example.com', '*.cdn.example.com:443']); // lower-cased, no duplicates
  assert.equal(DEFAULT_SETTINGS.defaultBudgetCents, 0, 'the defaults are not changed in place');
  for (const [bad, field] of [
    [{ approvalThresholdCents: 1.5 }, 'approvalThresholdCents'],
    [{ networkDefault: 'everything' }, 'networkDefault'],
    [{ quietHours: { from: '7pm' } }, 'quietHours.from'],
    [{ agentFolders: ['/home/a/../b'] }, 'agentFolders'],
    [{ agentFolders: ['/'] }, 'agentFolders'],
    [{ appearance: { accent: 'red' } }, 'appearance.accent'],
    [{ surprise: true }, 'surprise'],
  ] as const) assert.throws(() => applyPatch(DEFAULT_SETTINGS, bad), new RegExp(`settings\\.${field.replace('.', '\\.')}`));
});

test('folders agents may use: inside means the folder or below it, not a sibling with the same prefix', () => {
  assert.ok(insideAny('/home/a/docs', ['/home/a/docs']));
  assert.ok(insideAny('/home/a/docs/thesis', ['/home/a/docs']));
  assert.ok(!insideAny('/home/a/docs-old', ['/home/a/docs']));
});

test('setup: an existing box with history is already set up; a new one is not; steps are checked', () => {
  assert.equal(loadSetup(dir(), true).done, true);
  const fresh = loadSetup(dir(), false);
  assert.equal(fresh.done, false);
  recordStep(fresh, 'network', { wifi: 'home' });
  assert.ok(fresh.steps.network.at);
  assert.throws(() => recordStep(fresh, 'Bad Id', {}), /step/);
  assert.throws(() => recordStep(fresh, 'keys', { blob: 'x'.repeat(5000) }), /4 KB/);
});

test('the vault file: a key is set or replaced in place, the file stays 0600, and values with newlines are refused', async () => {
  const file = path.join(dir(), 'vault.env');
  fs.writeFileSync(file, 'A_KEY=one\nB_KEY=two\n', { mode: 0o600 });
  process.env.BOX_VAULT = file; // vault.ts reads it when imported
  const { writeVaultKey, loadVault } = await import('./vault.ts');
  writeVaultKey('B_KEY', 'three');
  writeVaultKey('C_KEY', 'four');
  assert.equal(fs.readFileSync(file, 'utf8'), 'A_KEY=one\nB_KEY=three\nC_KEY=four\n');
  assert.equal(fs.statSync(file).mode & 0o777, 0o600);
  assert.equal(loadVault().get('C_KEY'), 'four');
  assert.throws(() => writeVaultKey('D_KEY', 'a\nE_KEY=injected'), /one line/);
  assert.throws(() => writeVaultKey('lower', 'x'), /capital letters/);
});
