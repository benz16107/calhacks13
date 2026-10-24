import assert from 'node:assert/strict';
import { test } from 'node:test';
import { decision, isRisky, openRequest, settle } from './jsm.ts';

const cfg = { serviceDesk: '1', requestType: '2', minCents: 1000 };

test('isRisky: cost over the limit, or a risky word', () => {
  assert.equal(isRisky(cfg, { question: 'buy a domain', costCents: 1001 }), true);
  assert.equal(isRisky(cfg, { question: 'buy a domain', costCents: 1000 }), false);
  assert.equal(isRisky({ ...cfg, minCents: undefined }, { question: 'Deploy to PRODUCTION', costCents: 0 }), true);
  assert.equal(isRisky(cfg, { question: 'write /etc/passwd outside the folder', costCents: 0 }), true);
  assert.equal(isRisky({ ...cfg, match: ['x'] }, { question: 'production', costCents: 0 }), false);
});

type Call = [string, string, any];
const fake = (answers: Record<string, any>) => {
  const calls: Call[] = [];
  const jira = async (m: string, p: string, b?: unknown) => {
    calls.push([m, p, b]);
    const hit = Object.entries(answers).find(([k]) => `${m} ${p}`.startsWith(k));
    return hit ? (typeof hit[1] === 'function' ? hit[1](b) : hit[1]) : undefined;
  };
  return { jira, calls };
};
const ask = { approvalId: 'a/1', task: 't1', title: 'Ship it', question: 'Deploy to production', costCents: 250 };

test('openRequest returns the request already labelled for this approval', async () => {
  const { jira, calls } = fake({ 'POST /rest/api/3/search/jql': { issues: [{ key: 'SEC-1' }] } });
  assert.deepEqual(await openRequest(jira, cfg, ask), { key: 'SEC-1' });
  assert.equal(calls.length, 1);
  assert.match(calls[0][2].jql, /gurtos-approval-a-1/);
});

test('openRequest creates a request in plain words, labels it and sets the approvers', async () => {
  const { jira, calls } = fake({
    'POST /rest/api/3/search/jql': { issues: [] },
    'POST /rest/servicedeskapi/request': { issueKey: 'SEC-2' },
    'GET /rest/api/3/issue/SEC-2': { fields: { customfield_10003: [{ accountId: 'me' }] } },
  });
  assert.deepEqual(await openRequest(jira, { ...cfg, approvers: ['me'] }, ask), { key: 'SEC-2' });
  const create = calls.find((c) => c[0] === 'POST' && c[1] === '/rest/servicedeskapi/request')![2];
  assert.equal(create.requestFieldValues.summary, 'Approval needed: Deploy to production');
  assert.match(create.requestFieldValues.description, /\$2\.50 \(test money\)/);
  assert.match(create.requestFieldValues.description, /Decide here\. The agent waits\./);
  assert.deepEqual(calls.find((c) => c[0] === 'PUT')![2], { fields: { labels: ['gurtos', 'gurtos-approval-a-1'] } });
});

test('decision: pending, approved with the approver, declined', async () => {
  const approval = (finalDecision: string, approverDecision = 'pending') => ({
    values: [{ finalDecision, approvers: [{ approverDecision, approver: { accountId: 'u1', displayName: 'Ben' } }] }],
  });
  const state = async (r: any) => decision(fake({ GET: r }).jira, 'SEC-1');
  assert.deepEqual(await state({ values: [] }), { state: 'pending' });
  assert.deepEqual(await state(approval('pending')), { state: 'pending' });
  assert.deepEqual(await state(approval('approved', 'approved')), { state: 'approved', by: { accountId: 'u1', name: 'Ben' } });
  assert.equal((await state(approval('declined', 'declined'))).state, 'declined');
});

test('settle comments, then moves to a done status', async () => {
  const { jira, calls } = fake({ 'GET /rest/api/3/issue/SEC-1/transitions': { transitions: [{ id: '5', to: { statusCategory: { key: 'done' } } }] } });
  await settle(jira, 'SEC-1', 'Answered in the portal.');
  assert.equal(calls[0][2].body, 'Answered in the portal.');
  assert.deepEqual(calls[2][2], { transition: { id: '5' } });
});
