import assert from 'node:assert/strict';
import test from 'node:test';
import { desired } from './firewall.ts';

test('rules come from the config and never open the box API or SpacetimeDB', () => {
  const rules = desired({ ssh: ['203.0.113.7'], public: [443] });
  assert.deepEqual(rules.map((r) => `${r.subnet}/${r.subnet_size}:${r.port}`), ['203.0.113.7/32:22', '0.0.0.0/0:443']);
  assert.throws(() => desired({ ssh: ['203.0.113.7'], public: [7700] }), /never/);
  assert.throws(() => desired({ ssh: ['203.0.113.7'], public: [3000] }), /never/);
});

test('a group that would lock out ssh, or open it to a huge range, is refused', () => {
  assert.throws(() => desired({ public: [443] }), /lock out ssh/);
  assert.throws(() => desired({ ssh: ['0.0.0.0/0'] }), /wider than/);
  assert.throws(() => desired({ ssh: ['not-an-ip'] }), /not an IPv4/);
  assert.equal(desired({ public: [443], allowNoSsh: true }).length, 1);
});
