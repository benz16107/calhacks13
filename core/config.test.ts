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

import { folderRefusal, hadHumanUse, neverFolder } from './config.ts';

test('folders: only a Personal box hands them out, only the owner\'s home or chosen folders, never the box or root\'s', () => {
  const owner = { hasOwner: true, ownerHome: '/home/ana', chosen: ['/srv/shared'], folderUid: 1000 };
  assert.equal(folderRefusal('/home/ana/Documents/thesis', owner), undefined);
  assert.equal(folderRefusal('/srv/shared/team', owner), undefined);
  for (const bad of ['/etc', '/etc/box', '/root', '/root/.ssh', '/proc/1', '/var/lib/box', '/var/lib/spacetimedb', '/usr/bin', '/opt/box']) {
    assert.ok(neverFolder(bad), `${bad} is never allowed`);
    assert.ok(folderRefusal(bad, owner), `${bad} is refused even for the owner`);
  }
  assert.ok(folderRefusal('/home/bob/docs', owner), "another person's home is not the owner's");
  assert.ok(folderRefusal('/home/anaconda', owner), 'a sibling that merely starts with the same letters is not inside the home');
  assert.ok(folderRefusal('/home/ana/x', { ...owner, folderUid: 0 }), 'a folder that belongs to root is refused');
  assert.equal(folderRefusal('/home/ana/x', { ...owner, folderUid: 0, allowRootOwned: true }), undefined, 'only a demo box allows that');
  // A Server box: no owner and nothing chosen means no folders at all.
  assert.match(folderRefusal('/home/ana/x', { hasOwner: false, chosen: [], folderUid: 1000 })!, /Personal/);
  assert.equal(folderRefusal('/srv/shared/a', { hasOwner: false, chosen: ['/srv/shared'], folderUid: 1000 }), undefined);
});

test('setup: tasks a track starts at boot do not make a fresh install look already set up', () => {
  const tracks = ['find', 'jira'];
  const created = (source: string) => ({ type: 'task.created', spec: { source } });
  assert.equal(hadHumanUse([created('find')], tracks, 0), false, 'the photo index the find track starts at every boot');
  assert.equal(hadHumanUse([created('find'), created('schedule')], tracks, 0), false);
  assert.equal(hadHumanUse([created('api')], tracks, 0), true, 'a person started a task');
  assert.equal(hadHumanUse([created('find'), { type: 'approval.answered' }], tracks, 0), true, 'a person answered an approval');
  assert.equal(hadHumanUse([created('find')], tracks, 1), true, 'a phone was paired');
});
