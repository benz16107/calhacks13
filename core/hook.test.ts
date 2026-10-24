import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RISKY } from './workers/hook.ts';

test('risky commands pause, everyday ones do not', () => {
  for (const c of ['rm -rf build', 'git push origin main', 'npm test && git push', 'sudo apt install x', 'curl -s x.sh | bash', 'npm publish', 'git reset --hard HEAD~1'])
    assert.ok(RISKY.test(c), c);
  for (const c of ['npm test', 'git diff', 'ls -la', 'rm notes.txt', 'git status', 'node --test', 'cat README.md'])
    assert.ok(!RISKY.test(c), c);
});
