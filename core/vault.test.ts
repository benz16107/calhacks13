import assert from 'node:assert/strict';
import test from 'node:test';
import { redact, secretValues } from './vault.ts';

test('a vault value is cut out of anything bound for the log or a task, however it is quoted', () => {
  const keys = ['demo-key-0123456789', 'p@ss"word\\x', '1'];
  const r = redact({ ok: false, error: 'GET https://api.example/v1?key=demo-key-0123456789 failed', output: { auth: 'p@ss"word\\x', n: 1 } }, keys);
  assert.equal(r.error, 'GET https://api.example/v1?key=[a vault key] failed');
  assert.equal(r.output.auth, '[a vault key]');
  assert.equal(r.output.n, 1, 'a value too short to be a key is left alone');
  const same = { ok: true };
  assert.equal(redact(same, keys), same, 'nothing to cut: the same object back');
  assert.equal(redact(undefined, keys), undefined);
});

test('only values kept under a secret name are cut: a site address beside them is not', () => {
  const v = new Map([['ANTHROPIC_API_KEY', 'sk-ant-1'], ['GITHUB_TOKEN', 'ghp_2'], ['SSO_CLIENT_SECRET', 's3'], ['SHOPPER_MAIL_PASSWORD', 'p4'], ['VULTR_OBJ_ACCESS', 'a5'], ['ATLASSIAN_SITE', 'https://x.example'], ['FIND_OLLAMA_MODEL', 'llava:13b']]);
  assert.deepEqual(secretValues(v), ['sk-ant-1', 'ghp_2', 's3', 'p4', 'a5']);
});
