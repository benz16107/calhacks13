import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { test } from 'node:test';
import { checkSso, noGroup, personId, roleFor, verifyIdToken, whoIs, type Claims } from './sso.ts';

const issuer = 'https://login.example/tenant-1/v2.0';
const clientId = 'app-1';
const pair = () => generateKeyPairSync('rsa', { modulusLength: 2048 });
const idp = pair();
const keys = [{ ...idp.publicKey.export({ format: 'jwk' }), kid: 'k1', use: 'sig' }];
const now = Date.now();
const claims = { iss: issuer, aud: clientId, sub: 'user-1', exp: now / 1000 + 600, iat: now / 1000, nonce: 'n1', name: 'Mei Tanaka', email: 'mei@fogline.example', groups: ['g-controllers'] };

function jwt(c: Record<string, unknown>, key = idp.privateKey, header: Record<string, unknown> = { alg: 'RS256', kid: 'k1', typ: 'JWT' }) {
  const enc = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const data = `${enc(header)}.${enc(c)}`;
  return `${data}.${header.alg === 'none' ? '' : sign('sha256', Buffer.from(data), key).toString('base64url')}`;
}
const check = (token: string, nonce = 'n1') => verifyIdToken(token, { keys, issuer, clientId, nonce, now });

test('a good ID token passes and gives its claims', () => {
  assert.equal(check(jwt(claims)).sub, 'user-1');
  assert.equal(check(jwt({ ...claims, aud: [clientId, 'other'], azp: clientId })).sub, 'user-1');
});

test('forged or wrong ID tokens are refused', () => {
  assert.throws(() => check(jwt(claims, pair().privateKey)), /signature does not match/);
  assert.throws(() => check(jwt({ ...claims, aud: 'another-app' })), /for another app/);
  assert.throws(() => check(jwt({ ...claims, aud: [clientId, 'other'] })), /for another app/); // several audiences need azp
  assert.throws(() => check(jwt({ ...claims, iss: 'https://evil.example/v2.0' })), /another issuer/);
  assert.throws(() => check(jwt({ ...claims, exp: now / 1000 - 3600 })), /expired/);
  assert.throws(() => check(jwt(claims), 'n2'), /not made for this sign-in/); // a token replayed into another sign-in
  assert.throws(() => check(jwt({ ...claims, nonce: undefined }), ''), /not made for this sign-in/);
  assert.throws(() => check(jwt(claims, undefined, { alg: 'none' })), /only RS256/);
  assert.throws(() => check(jwt(claims, undefined, { alg: 'HS256', kid: 'k1' })), /only RS256/);
  assert.throws(() => check(jwt(claims, undefined, { alg: 'RS256', kid: 'k9' })), (e: Error & { unknownKey?: boolean }) => !!e.unknownKey);
  assert.throws(() => check('not.a.token'), /not readable/);
  assert.throws(() => check(''), /no signed ID token/);
  const tampered = jwt(claims).split('.');
  tampered[1] = Buffer.from(JSON.stringify({ ...claims, groups: ['g-owners'] })).toString('base64url');
  assert.throws(() => check(tampered.join('.')), /signature does not match/);
});

const groups = {
  'g-controllers': { role: 'approver' as const, approvesFor: ['Controller'], limitCents: 5_000_000 },
  'g-it': { role: 'admin' as const, approvesFor: ['IT'] },
  'g-sales': { role: 'requester' as const },
  'g-small': { role: 'approver' as const, approvesFor: ['Fraud reviewer'], limitCents: 100_000 },
};

test('groups map to the strongest role, every name they approve for, and that role\'s highest limit', () => {
  assert.deepEqual(roleFor(['g-controllers'], groups), { role: 'approver', approvesFor: ['Controller'], limitCents: 5_000_000 });
  assert.deepEqual(roleFor(['G-CONTROLLERS', 'g-small', 'g-sales'], groups), { role: 'approver', approvesFor: ['Controller', 'Fraud reviewer'], limitCents: 5_000_000 });
  assert.deepEqual(roleFor(['g-it', 'g-controllers'], groups), { role: 'admin', approvesFor: ['Controller', 'IT'], limitCents: null });
  assert.equal(roleFor(['g-unknown'], groups), undefined);
  assert.equal(roleFor(undefined, groups), undefined);
  assert.equal(roleFor('g-it', groups), undefined); // a claim that is not a list maps nothing
});

test('no group grants owner unless the mapping says owner', () => {
  const all = Object.keys(groups);
  assert.notEqual(roleFor(all, groups)?.role, 'owner');
  assert.equal(roleFor(['g-boss'], { ...groups, 'g-boss': { role: 'owner' } })?.role, 'owner');
});

test('the settings are checked', () => {
  const ok = { name: 'Fogline (Microsoft Entra ID)', issuer, clientId, secretKey: 'SSO_CLIENT_SECRET', groups };
  assert.equal(checkSso(ok).groups['g-it'].role, 'admin');
  assert.equal(checkSso({ ...ok, issuer: 'http://127.0.0.1:9999' }).issuer, 'http://127.0.0.1:9999'); // a test provider on this machine
  assert.throws(() => checkSso({ ...ok, issuer: 'http://login.example' }), /issuer/);
  assert.throws(() => checkSso({ ...ok, secretKey: 'ANTHROPIC_API_KEY' }), /starting with SSO_/); // never another key in the vault
  assert.throws(() => checkSso({ ...ok, groups: { g: { role: 'approver' } } }), /needs a spending limit/);
  assert.throws(() => checkSso({ ...ok, groups: { g: { role: 'boss' } } }), /role: one of/);
  assert.throws(() => checkSso({ ...ok, groups: {} }), /1 to 50 groups/);
  assert.throws(() => checkSso({ ...ok, secret: 'x' }), /unknown field secret/);
});

test('names, addresses, the domain, and a stable id per provider and subject', () => {
  assert.deepEqual(whoIs(claims as Claims), { name: 'Mei Tanaka', email: 'mei@fogline.example' });
  assert.deepEqual(whoIs({ ...claims, name: undefined, email: undefined, preferred_username: 'dana@fogline.example' } as Claims, 'fogline.example'), { name: 'dana', email: 'dana@fogline.example' });
  assert.throws(() => whoIs(claims as Claims, 'other.example'), /Only accounts at other.example/);
  assert.throws(() => whoIs({ ...claims, email_verified: false } as Claims, 'fogline.example'), /Only accounts/);
  assert.equal(personId(issuer, 'user-1'), personId(issuer, 'user-1'));
  assert.notEqual(personId(issuer, 'user-1'), personId('https://other.example', 'user-1'));
  assert.match(personId(issuer, 'user-1'), /^sso-[0-9a-f]{12}$/);
  assert.match(noGroup({ ...claims, _claim_names: { groups: 'src1' } } as unknown as Claims), /too many groups/);
  assert.match(noGroup(claims as Claims), /not in a group/);
});
