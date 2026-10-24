// Run: node --test tracks/credit-desk/letters.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { letter } from './letters.ts';

const base = { to: 'Applicant', date: '2026-10-23', kind: 'decision' as const, asked: { limit: 20000, terms: 'Net 30' }, usedCreditReport: true };

test('a fraud hold gives the general reason and never which check failed', () => {
  const l = letter({ ...base, outcome: 'fraud hold', limit: 0, terms: 'cash in advance', rules: ['FRD-1', 'FRD-2', 'FRR-1'] })!;
  assert.match(l, /We need to verify some information before we can offer terms/);
  for (const w of [/fraud/i, /identity/i, /score/i, /SSN/, /TransUnion/, /Fraud Finder/i, /FRD-/, /date of birth/i, /phone/i]) assert.doesNotMatch(l, w);
});

test('reduced terms name the reasons, the credit bureaus and the right to a free copy', () => {
  const l = letter({ ...base, asked: { limit: 15000, terms: 'Net 30' }, outcome: 'approve', limit: 7500, terms: 'Net 15', rules: ['PUB-1', 'PUB-2', 'BND-C', 'LIM-1'] })!;
  assert.match(l, /\$7,500 on Net 15, rather than the \$15,000 on Net 30/);
  assert.match(l, /open lien or an unpaid judgment/);
  assert.match(l, /TransUnion, Equifax and Experian/);
  assert.match(l, /within 60 days/);
  assert.match(l, /Equal Credit Opportunity Act/);
});

test('a cut after returned payments says so; approved as asked needs no letter', () => {
  assert.match(letter({ ...base, kind: 'review', outcome: 'reduce', limit: 7500, terms: 'Net 15', rules: ['REV-3', 'REV-6'], usedCreditReport: false })!, /returned unpaid/);
  assert.equal(letter({ ...base, asked: { limit: 8000, terms: 'Net 30' }, outcome: 'approve', limit: 8000, terms: 'Net 30', rules: ['BND-A', 'LIM-1'] }), null);
});
