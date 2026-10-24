// Run: node --test tracks/credit-desk/score.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import type { LogEvent, Task } from '../../core/contract.ts';
import { scoreRun } from './score.ts';

const caseDir = path.join(import.meta.dirname, 'cases', 'fogline-2026-10');
const info = { run: 'r1', caseId: 'fogline-2026-10', caseDir, rulesFile: '', workspace: 'w', nessie: true };
let seq = 0;
const events: LogEvent[] = [];
function use(tool: string, input: object, output: object) {
  const key = `k${++seq}`;
  events.push({ seq, at: '', type: 'tool.call', task: 't1', key, tool, input } as LogEvent);
  events.push({ seq: ++seq, at: '', type: 'tool.result', task: 't1', key, ok: true, output } as LogEvent);
}
const flag = (ids: string[], problem: string, detail: string, rules: string[]) =>
  use('credit-desk.flag', { ids, problem, detail, conclusion: '', rules }, { status: 'recorded' });

flag(['INV-24105'], 'Invoice total does not match its lines', 'Header 4,862.40, lines add up to 4,286.40.', ['COL-6']);
flag(['APP-1045'], 'Bureaus disagree', 'TransUnion 760, Equifax no file, Experian 700 with a collection. Use the lowest score: band B.', ['BND-1']);
flag(['APP-1045'], 'Stale applicant-supplied credit report', 'The attached TransUnion report is dated 2025-04-02 and came from the applicant.', ['DOC-1']);
flag(['C-1008'], 'City misspelled', 'Address says Oakalnd.', ['COL-7']);
use('credit-desk.crs', { application_id: 'APP-1043' }, { credit: { transunion: { score: 640 } } });
use('credit-desk.credit_decision', { application_id: 'APP-1043' }, { status: 'recorded', decision: { outcome: 'fraud hold', limit: 0, terms: 'cash in advance', band: 'none', approval: { by: 'phone' }, decided_by: 'controller (phone)' } });
use('credit-desk.credit_decision', { application_id: 'APP-1041' }, { status: 'recorded', decision: { outcome: 'approve', limit: 8000, terms: 'Net 30', band: 'A', approval: null, decided_by: 'credit analyst' } });
use('credit-desk.collections_action', {}, { status: 'recorded', action: { subject: 'SO-5528', action: 'release order' } });
use('credit-desk.collections_action', {}, { status: 'recorded', action: { subject: 'C-1001', action: 'no action' } });

const s = scoreRun(info, events, [{ id: 't1', source: 'credit-desk:r1' } as Task]);

test('findings land on the right planted errors, even two on one application', () => {
  assert.deepEqual(s.errors.filter((e: { caught: boolean }) => e.caught).map((e: { id: string }) => e.id), ['E02', 'E13', 'E14']);
  assert.equal(s.caught, 3);
});

test('flagging something the key calls fine is a false alarm', () => {
  assert.deepEqual(s.false_alarms.map((f: { ids: string[] }) => f.ids), [['C-1008']]);
});

test('decisions are compared with the answer key', () => {
  const byId = Object.fromEntries(s.decisions.applications.map((a: { application_id: string; match: boolean }) => [a.application_id, a.match]));
  assert.equal(byId['APP-1041'], true);
  assert.equal(byId['APP-1043'], true);
  assert.equal(byId['APP-1042'], false);
  assert.equal(s.decisions.orders.find((o: { order_id: string }) => o.order_id === 'SO-5528')?.match, true);
  assert.equal(s.decisions.collections.find((c: { customer_id: string }) => c.customer_id === 'C-1001')?.match, true);
});

test('the simple rule approves the fake applicant that the desk held', () => {
  assert.deepEqual(s.moment, [{ application_id: 'APP-1043', simple_rule: 'approve $20,000', desk: 'fraud hold', decided_by: 'controller (phone)' }]);
});
