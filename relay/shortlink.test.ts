// gurtos.co/p/<box>#<code> must reach the pairing page with the box named and the code untouched. The code is in
// the URL fragment, which browsers never send, so no server or log here ever holds it. These rules are what Vercel runs.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { nameProblem } from './server.ts';

const rules = JSON.parse(fs.readFileSync(new URL('./app/vercel.json', import.meta.url), 'utf8')).redirects as { source: string; destination: string; has: { value: string }[] }[];
const pair = rules[0];

test('the pairing redirect takes only a valid box name and always lands on the app', () => {
  const name = new RegExp('^' + pair.source.match(/:box\((.*)\)$/)![1] + '$');
  for (const ok of ['rosa', 'gurt-cloud', 'a1b']) assert.ok(name.test(ok) && !nameProblem(ok), ok);
  for (const bad of ['ro', 'a/b', 'a.b', 'a?b', 'a#b', 'x'.repeat(31), 'UP']) assert.ok(!name.test(bad), bad);
  assert.equal(pair.destination, 'https://app.gurtos.com/pair?box=:box.box.gurtos.com', 'the host is fixed, so it cannot be turned into an open redirect');
  assert.ok(!pair.destination.includes('#'), 'no code in the redirect: the browser carries the fragment itself');
  assert.equal(pair.has[0].value, 'gurtos.co');
});

test('everything else on gurtos.co goes to gurtos.com', () => {
  assert.equal(rules[1].destination, 'https://gurtos.com/:path*');
  assert.ok(new RegExp('^' + rules[1].has[0].value + '$').test('www.gurtos.co'));
});
