import assert from 'node:assert/strict';
import test from 'node:test';
import { usageCents } from './pricing.ts';

test('prices tokens at the model list rate, sub-cent kept', () => {
  // 1M input + 1M output on sonnet = $3 + $15 = $18 = 1800 cents.
  assert.equal(usageCents('claude-sonnet-4-6', { input: 1e6, output: 1e6, cacheWrite: 0, cacheRead: 0 }), 1800);
  // Opus costs more than sonnet for the same tokens.
  const t = { input: 1000, output: 1000, cacheWrite: 0, cacheRead: 0 };
  assert.ok(usageCents('claude-opus-4-8', t) > usageCents('claude-sonnet-4-6', t));
  // A small task is a fraction of a cent, not rounded to zero.
  const small = usageCents('claude-sonnet-4-6', { input: 200, output: 50, cacheWrite: 0, cacheRead: 0 });
  assert.ok(small > 0 && small < 1, `small task is sub-cent (${small})`);
  // An unknown model falls back to the default rate, never throws.
  assert.ok(usageCents('mystery', t) > 0);
});
