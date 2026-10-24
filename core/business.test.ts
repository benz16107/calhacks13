import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { LogEvent, Task } from './contract.ts';
import { amountOf, auditRows, checkPerson, parsePolicy, refusal, route, toCsv, type Person } from './business.ts';

const POLICY = `# Fogline Supply
Fraud referrals go to the Controller.
Over $10,000 goes to the Controller.
Production changes go to IT.
Everything else goes to any approver.`;

const people: Person[] = [
  checkPerson({ id: 'rosa', name: 'Rosa Delgado', role: 'approver', title: 'Controller', limitCents: 5_000_000, approvesFor: ['Controller'] }, []),
  checkPerson({ id: 'sam', name: 'Sam Park', role: 'requester', title: 'Sales' }, []),
  checkPerson({ id: 'dana', name: 'Dana Brooks', role: 'admin', title: 'IT admin', approvesFor: ['IT'] }, []),
  checkPerson({ id: 'lee', name: 'Lee Morgan', role: 'auditor' }, []),
];
const rules = parsePolicy(POLICY);
const ask = (text: string, cents = amountOf(0, text)) => ({ text, amountCents: cents });

test('the policy reads plain lines, first match wins', () => {
  assert.equal(rules.length, 4);
  assert.deepEqual(rules[1], { line: 'Over $10,000 goes to the Controller.', to: 'the Controller', overCents: 1_000_000 });
  assert.equal(route(rules, ask('Credit desk: fraud referral. Put APP-1043 on hold? A simple rule would approve $20,000.'), people, 'sam').rule, 'Fraud referrals go to the Controller.');
  assert.equal(route(rules, ask('Approve APP-1042 for $40,000, Net 30?'), people, 'sam').rule, 'Over $10,000 goes to the Controller.');
  assert.equal(route(rules, ask('Production change: deploy the invoice export?'), people, 'sam').to, 'IT');
  assert.equal(route(rules, ask('Write off $2,400 on INV-24102?'), people, 'sam').to, 'any approver');
  assert.equal(parsePolicy('Payments over $500 go to Finance.')[0].phrase, 'payments');
  assert.equal(parsePolicy('Requests from the credit desk go to the Controller.')[0].app, 'credit desk');
  assert.throws(() => parsePolicy('Rosa approves big things'), /line 1: .* needs "goes to"/);
  assert.throws(() => parsePolicy('# only a comment'), /at least one rule/);
});

test('a route names who can approve, or why nobody can', () => {
  const big = route(rules, ask('Approve APP-1042 for $40,000?'), people, 'sam');
  assert.deepEqual(big.people, [{ id: 'rosa', name: 'Rosa Delgado' }]);
  assert.match(big.why, /Rosa Delgado can approve it/);
  assert.match(route(rules, ask('Approve APP-1047 for $75,000?'), people, 'sam').why, /above Rosa Delgado's \$50,000 limit/);
  assert.match(route(rules, ask('Approve a $12,000 limit?'), people, 'rosa').why, /the only person who approves for the Controller asked for it/);
  assert.equal(route(parsePolicy('Fraud referrals go to Legal.'), ask('anything'), people).to, 'the owner');
});

test('nobody approves their own request, above their limit, or for a name they do not hold; agents never answer', () => {
  const [rosa, sam, dana, lee] = people;
  const over10k = { to: 'the Controller', amountCents: 4_000_000, askedBy: 'sam' };
  assert.equal(refusal(rosa, over10k, true), undefined);
  assert.match(refusal(undefined, over10k, true)!, /Only a person can answer/);
  assert.match(refusal(sam, over10k, true)!, /You asked for this/);
  assert.match(refusal(rosa, { ...over10k, askedBy: 'rosa' }, true)!, /You asked for this/);
  assert.match(refusal(lee, over10k, true)!, /auditor can't answer/);
  assert.match(refusal(dana, over10k, true)!, /goes to the Controller. You approve for IT/);
  assert.match(refusal(rosa, { ...over10k, amountCents: 7_500_000 }, true)!, /\$75,000, above your \$50,000 limit/);
  assert.equal(refusal(rosa, { ...over10k, amountCents: 7_500_000 }, false), undefined, 'denying above a limit is allowed');
});

test('people are checked', () => {
  assert.throws(() => checkPerson({ name: 'Ann', role: 'approver' }, []), /approver needs a spending limit/);
  assert.throws(() => checkPerson({ name: 'Ann', role: 'boss' }, []), /role: one of/);
  assert.throws(() => checkPerson({ name: 'Ann', role: 'requester', token: 'x' }, []), /unknown field: token/);
  assert.equal(checkPerson({ name: 'Rosa Q', role: 'requester' }, people).id, 'rosa-2');
  assert.equal(checkPerson({ id: 'rosa', limitCents: 100 }, people).name, 'Rosa Delgado', 'an update keeps the fields it does not name');
});

test('audit rows say who asked, which seat, who approved, and export safely', () => {
  const task = { id: 't1', title: 'Credit analyst: APP-1042', source: 'credit-desk:abc', seat: 'Credit analyst', requestedBy: 'sam' } as Task;
  const at = '2026-10-24T10:00:00.000Z';
  const events = [
    { seq: 1, at, type: 'task.created', task: 't1', spec: { title: task.title } },
    { seq: 2, at, type: 'approval.answered', task: 't1', id: 't1.a', approved: true, by: 'Rosa Delgado', person: 'rosa' },
    { seq: 3, at, type: 'task.step', task: 't1', text: '=HYPERLINK("http://x")' },
    { seq: 4, at, type: 'note', track: 'kill-switch', data: { paused: true, by: 'dana' }, who: { by: 'dana' } },
  ] as LogEvent[];
  const ctx = { name: (id: string) => people.find((p) => p.id === id)?.name ?? id, app: () => 'credit-desk' };
  const rows = auditRows(events, new Map([['t1', task]]), ctx);
  assert.deepEqual(rows.map((r) => [r.asked, r.seat, r.approver, r.by]), [['Sam Park', 'Credit analyst', '', ''], ['Sam Park', 'Credit analyst', 'Rosa Delgado', ''], ['Sam Park', 'Credit analyst', 'Rosa Delgado', ''], ['', '', '', 'Dana Brooks']]);
  assert.deepEqual(auditRows(events, new Map([['t1', task]]), ctx, { person: 'dana' }).map((r) => r.seq), [4]);
  assert.deepEqual(auditRows(events, new Map([['t1', task]]), ctx, { seat: 'credit analyst', to: '2026-10-23' }), []);
  const csv = toCsv(rows);
  assert.match(csv, /^seq,at,event,task,title,app,seat,asked,approver,by,what\r\n/);
  assert.match(csv, /"'=HYPERLINK\(""http:\/\/x""\)"/, 'a formula is written as text');
});

test('the approved designs\' wording: "for approval", and a ceiling that applies wherever it is', () => {
  const r = parsePolicy(`Requests over $10,000 go to the Controller for approval.
Requests over $50,000 can't be approved in GurtOS.
Everything else goes to any approver.`);
  assert.equal(r[0].to, 'the Controller');
  assert.equal(r[1].blocked, true);
  const big = route(r, ask('Approve APP-1047 for $75,000?'), people, 'sam');
  assert.equal(big.rule, "Requests over $50,000 can't be approved in GurtOS.");
  assert.deepEqual(big.people, []);
  const req = { to: big.to, amountCents: big.amountCents, askedBy: 'sam', rule: big.rule };
  assert.match(refusal(people[0], req, true)!, /above your \$50,000 limit/, 'an approver over their limit hears about their limit first');
  assert.match(refusal(checkPerson({ id: 'o', name: 'Owner', role: 'owner' }, []), req, true)!, /Nobody can approve this in GurtOS/);
  assert.equal(refusal(people[0], req, false), undefined, 'it can still be denied');
  assert.equal(route(r, ask('Approve APP-1042 for $40,000?'), people, 'sam').rule, 'Requests over $10,000 go to the Controller for approval.');
});

test("Mana's review: the largest figure is the amount, and the owner backs up a name nobody can answer for", () => {
  assert.equal(amountOf(0, 'Raise Bright Harbor from $5,000 to $60,000?'), 6_000_000);
  assert.equal(amountOf(80_000, 'Spend $500?'), 80_000);
  const owner = checkPerson({ id: 'martin', name: 'Martin Hale', role: 'owner' }, []);
  const withOwner = [...people, owner];
  const own = route(rules, ask('Approve a $12,000 limit?'), withOwner, 'rosa');
  assert.deepEqual(own.people.map((p) => p.id), ['martin'], "Rosa asked, so it falls to the owner");
  assert.match(own.why, /so it goes to the owner: Martin Hale/);
  const normal = route(rules, ask('Approve APP-1042 for $40,000?'), withOwner, 'sam');
  assert.deepEqual(normal.people.map((p) => p.id), ['rosa'], 'the owner is not sent what the Controller can answer');
  assert.equal(refusal(owner, { to: 'the Controller', amountCents: 4_000_000, askedBy: 'sam' }, true), undefined, 'but may answer it');
  assert.match(route(parsePolicy('Production goes to IT.'), ask('Deploy the new invoice export to production?'), people).to, /IT/);
});
