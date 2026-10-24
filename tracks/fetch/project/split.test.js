import assert from 'node:assert/strict';
import test from 'node:test';
import { split } from './split.js';

test('no share is more than a cent off the others', () => {
  const shares = split(1000, 3);
  assert.ok(Math.max(...shares) - Math.min(...shares) <= 1);
});

test('the shares add up to the bill', () => {
  assert.equal(split(1000, 3).reduce((a, b) => a + b, 0), 1000);
});
