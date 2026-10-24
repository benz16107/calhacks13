import assert from 'node:assert/strict';
import test from 'node:test';
import { usageCents } from './pricing.ts';
import { MODELS, modelProblem, resolveModel } from './models.ts';

const M = { input: 1e6, output: 1e6, cacheWrite: 1e6, cacheRead: 1e6 };

test('prices tokens at the model list rate, sub-cent kept', () => {
  // 1M of each kind of token, at the Oct 2026 list prices: Sonnet 5.5 $2 + $10 + $2.50 + $0.10 = $14.60.
  assert.equal(Math.round(usageCents(MODELS.sonnet, M)), 1460);
  assert.equal(Math.round(usageCents(MODELS.opus, M)), 2920); // $4 + $20 + $5 + $0.20
  assert.ok(Math.abs(usageCents(MODELS.haiku, M) - 73.5) < 1e-9); // $0.10 + $0.50 + $0.125 + $0.01 = $0.735
  // Earlier models keep their own rates.
  assert.equal(usageCents('claude-sonnet-4-6', { input: 1e6, output: 1e6, cacheWrite: 0, cacheRead: 0 }), 1800);
  // Opus costs more than Sonnet, and Sonnet more than Haiku, for the same tokens.
  const t = { input: 1000, output: 1000, cacheWrite: 0, cacheRead: 0 };
  assert.ok(usageCents(MODELS.opus, t) > usageCents(MODELS.sonnet, t) && usageCents(MODELS.sonnet, t) > usageCents(MODELS.haiku, t));
  // A small task is a fraction of a cent, not rounded to zero.
  const small = usageCents(MODELS.haiku, { input: 200, output: 50, cacheWrite: 0, cacheRead: 0 });
  assert.ok(small > 0 && small < 1, `small task is sub-cent (${small})`);
  // An unknown model falls back to the default rate, never throws. The BYOK name carries a prefix.
  assert.ok(usageCents('mystery', t) > 0);
  assert.equal(usageCents(`custom:${MODELS.opus}`, t), usageCents(MODELS.opus, t));
});

test('a task names its model by alias or id; the box records the id', () => {
  assert.equal(resolveModel('haiku'), 'claude-haiku-5-5');
  assert.equal(resolveModel('opus'), 'claude-opus-5-5');
  assert.equal(resolveModel('claude-sonnet-4-6'), 'claude-sonnet-4-6');
  assert.equal(resolveModel(), 'claude-sonnet-5-5');
  assert.equal(modelProblem(undefined), undefined);
  assert.equal(modelProblem('haiku'), undefined);
  assert.ok(modelProblem('Bad Model; rm -rf'));
  assert.ok(modelProblem(5));
});
