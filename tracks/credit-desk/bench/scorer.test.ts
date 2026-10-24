// DABstep's own scorer tests (dabstep_benchmark/tests/test_scorer.py, same revision as the scorer), then a comparison
// of this port with the original data/scorer.py on random inputs. Run: node --test tracks/credit-desk/bench/scorer.test.ts
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import test from 'node:test';
import { questionScorer } from './scorer.ts';

const upstream: [string, string, boolean][] = [
  ['42', '42', true], ['$42.00', '42', true], ['43', '42', false], ['10,765', '10765', true], ['22520', '22520', true],
  ['hello world', 'Hello World', true], [' sea  gull ', 'seagull', true], ['hello', 'world', false], ['Other', 'Other', true],
  ['', 'Inditex', false], [' ', 'Inditex', false], ['The average transaction amount is 91.85 EUR.', '91.852', true],
  ['The top 2 merchants account for approx 59.96% of all transactions.', '0.5996', false], ['Netherlands', 'NL', false], ['', '', true],
  ['1, 2, 3', '1,2,3', true], ['apple; banana; cherry', 'apple;banana;cherry', true], ['1, 2', '1, 2, 3', false],
  ['apple; banana', 'apple; banana; cherry', false], ['uber, spotify, nike, netflix, inditex', 'Nike, Netflix, Uber, Inditex, Spotify', true],
  ['a, b, c', "['a', 'b', 'c']", true],
  ['C: 69.36, F: 77.90, B: 86.22, A: 87.79, D: 94.34, G: 115.23', '[C: 69.36, F: 77.9, B: 86.22, A: 87.79, D: 94.34, G: 115.23]', true],
  ['[BE: 85.3, IT: 93.82, FR: 98.57, NL: 99.87, LU: 111.42, SE: 114.36, ES: 134.41, GR: 169.92, ]', 'BE: 85.3, IT: 93.82, FR: 98.57, NL: 99.87, LU: 111.42, SE: 114.36, ES: 134.41, GR: 169.92', true],
  ['42, hello', '42, hello', true], ['42, world', '42, hello', false], ['64', '64, 53, 454, 231, 473, 381', false],
  ['3.14', '3.1483', false], ['3.14', '3.20', false], ['1', '1.0', true], ['1.0', '1', true], ['0.731495413640441', '0.731495', true],
  ['C', 'C) both ip_address and email_address', true], ['0.36706256984345176', '0.3670625698434518', true], ['$0.10', '$0.10 per retry', true],
  ['D', 'D) Apples', true], ['D', 'A) Oranges', false], ['25.0', '0.250', false], ['5.760000', '5.715872', false], ['8.68000000000000', '8.66999999999916', false],
  ['73.15%', '73.1495', true], ['42%', '42', true], ['30%', '30.1', false], ['25', '25%', true], ['100%', '100', true], ['0.1%', '0.1', true],
  ['73%', '74', false], ['90%', '89.99971063977545', true], ['7.79%', '7.787407043027865', true],
];

test("DABstep's own scorer tests", () => {
  for (const [a, b, want] of upstream) assert.equal(questionScorer(a, b), want, JSON.stringify([a, b]));
});

test('agrees with the original scorer.py on random answers', { skip: !fs.existsSync(new URL('./data/scorer.py', import.meta.url)) && 'run fetch.sh first' }, () => {
  let seed = 7;
  const rnd = (n: number) => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff), seed % n);
  const pick = <T>(xs: T[]) => xs[rnd(xs.length)];
  const num = () => pick(['0.120132', '0.12', '12.5', '12.25', '12.2', '5', '5.0', '5.04', '22520', '22,520', '22,520.5', '$1,000', '45.5%', '0.0001', '0.00005', '1e5', '-0.948103', '0.94810300000017', '1234567.891', '2.675', '2.67', '0.5', '1.5', '2.5', '3.5']);
  const word = () => pick(['NL', 'BE', 'Not Applicable', 'yes', 'no', 'B. BE', 'E:13.57', 'Belles_cookbook_store', 'Crossfit_Hanna', 'Netherlands', 'été', 'ÀB', 'x']);
  const list = () => `${pick(['', '['])}${Array.from({ length: 1 + rnd(5) }, () => pick([num, word])()).join(pick([', ', ',', '; ']))}${pick(['', ']', ', '])}`;
  const long = () => Array.from({ length: 150 + rnd(200) }, () => pick(['a', 'b', 'c', 'dd', ' ', 'e', 'fg'])).join('');
  const any = () => pick([num, word, list, long, () => `The answer is ${num()} EUR.`, () => ` ${word()} `])();
  const pairs: [string, string][] = Array.from({ length: 4000 }, () => {
    const a = any();
    return [a, rnd(3) === 0 ? a.slice(rnd(4)).replace(/[aeiou]/, 'z') : any()];
  });
  const py = `
import importlib.util, json, sys
spec = importlib.util.spec_from_file_location('scorer', sys.argv[1]); m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
print(json.dumps([m.question_scorer(a, b) for a, b in json.load(sys.stdin)]))`;
  const want: boolean[] = JSON.parse(execFileSync('python3', ['-I', '-c', py, new URL('./data/scorer.py', import.meta.url).pathname], { input: JSON.stringify(pairs), maxBuffer: 1 << 26 }).toString());
  const bad = pairs.map((p, i) => [p, want[i], questionScorer(...p)] as const).filter(([, w, g]) => w !== g);
  assert.deepEqual(bad.slice(0, 5), []);
});
