// Offline tests: node --experimental-strip-types --disable-warning=ExperimentalWarning --test tracks/shopper/payments.test.ts
// Every network call is a stub. The keys below are made up. Nothing here reaches Stripe, Cybersource or Visa.
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { afterEach, mock, test } from 'node:test';
import {
  cancelInstructionBody, CYBS_HOST, cybersourceCard, cybersourceHeaders, initiateInstructionBody, jweDecrypt, jweEncrypt, type Payment, pay, provider,
  SECRETS, xPayToken,
} from './payments.ts';

const vault = (v: Record<string, string>) => (name: string) => v[name];
const STRIPE = { STRIPE_SECRET_KEY: 'sk_test_fake', SHOPPER_CARD: 'pm_card_visa' };
const CYBS = {
  CYBERSOURCE_MERCHANT_ID: 'mymerchantid', CYBERSOURCE_KEY_ID: '123abcki-key1-key2-key3-keyid1234567',
  CYBERSOURCE_SECRET_KEY: Buffer.from(Array.from({ length: 32 }, (_, i) => i)).toString('base64'), CYBERSOURCE_TEST_CARD: '4111111111111111|12|2031',
};
const rsa = generateKeyPairSync('rsa', { modulusLength: 2048 });
const pubPem = rsa.publicKey.export({ type: 'spki', format: 'pem' }).toString();
const privPem = rsa.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
const VIC = {
  VISA_VIC_API_KEY: 'fake-api-key', VISA_VIC_API_KEY_SS: 'shared-secret', VISA_MLE_SERVER_CERT: pubPem.replace(/\n/g, '\\n'), VISA_MLE_PRIVATE_KEY: privPem.replace(/\n/g, '\\n'),
  VISA_KEY_ID: 'key-1', VISA_EXTERNAL_CLIENT_ID: 'client-1', VISA_EXTERNAL_APP_ID: 'app-1', VISA_CONSUMER_ID: 'consumer-1', VISA_ENROLLMENT_REFERENCE_ID: 'token-ref-1',
};
const charge = (key = 'order-1', cents = 1234) => ({ action: 'charge' as const, cents, currency: 'usd', key, description: '2 x filters' });

// A stub for fetch: replies come from a queue, and every call is recorded.
type Seen = { url: string; headers: Record<string, string>; body: string };
function stubFetch(...replies: { status?: number; json: unknown }[]) {
  const seen: Seen[] = [];
  mock.method(globalThis, 'fetch', async (url: string, init: RequestInit) => {
    seen.push({ url: String(url), headers: { ...(init.headers as Record<string, string>) }, body: String(init.body ?? '') });
    const r = replies.shift();
    if (!r) throw new Error('unexpected network call');
    return new Response(JSON.stringify(r.json), { status: r.status ?? 200 });
  });
  return seen;
}
afterEach(() => mock.restoreAll());

test('provider: Visa first, then Cybersource, then Stripe, then simulated', () => {
  assert.equal(provider(vault({ ...STRIPE, ...CYBS, ...VIC }), false).id, 'visa intelligent commerce');
  assert.equal(provider(vault({ ...STRIPE, ...CYBS }), false).id, 'cybersource sandbox');
  assert.equal(provider(vault(STRIPE), false).id, 'stripe test mode');
  const none = provider(vault({}), false);
  assert.equal(none.id, 'simulated');
  assert.equal(none.why, 'simulated: no payment keys in the vault yet');
});

test('provider: offline means simulated whatever the vault holds, and never touches the network', async () => {
  const p = provider(vault({ ...STRIPE, ...CYBS, ...VIC }), true);
  assert.deepEqual(p, { id: 'simulated', why: 'offline demo run: no network call' });
  const seen = stubFetch();
  const r = await pay(charge(), vault({ ...STRIPE, ...CYBS, ...VIC }), true);
  assert.equal(r.provider, 'simulated');
  assert.equal(r.note, 'offline demo run: no network call');
  assert.equal(seen.length, 0);
});

test('provider: half-set keys are not picked, and the reason says what is missing; blanks and a throwing vault count as unset', () => {
  const { CYBERSOURCE_TEST_CARD: _card, ...noCard } = CYBS;
  const p = provider(vault({ ...noCard, VISA_VIC_API_KEY: 'x' }), false);
  assert.equal(p.id, 'simulated');
  assert.match(p.why, /cybersource sandbox is missing CYBERSOURCE_TEST_CARD/);
  assert.match(p.why, /visa intelligent commerce is missing VISA_VIC_API_KEY_SS/);
  assert.equal(provider(vault({ STRIPE_SECRET_KEY: '   ' }), false).id, 'simulated');
  assert.equal(provider(() => { throw new Error('not in the vault'); }, false).id, 'simulated');
  assert.ok(SECRETS.includes('STRIPE_SECRET_KEY') && SECRETS.includes('CYBERSOURCE_SECRET_KEY') && SECRETS.includes('VISA_VIC_API_KEY') && SECRETS.includes('SHOPPER_CARD'));
});

test('simulated: ids are stable per key, differ across keys, and only Stripe test cards are accepted', async () => {
  const v = vault({ SHOPPER_CARD: 'pm_card_visa' });
  const a = await pay(charge('k1'), v, false);
  const b = await pay(charge('k1'), v, false);
  const c = await pay(charge('k2'), v, false);
  assert.match(a.id, /^pi_sim_[0-9a-f]{16}$/);
  assert.equal(a.id, b.id);
  assert.notEqual(a.id, c.id);
  assert.deepEqual([a.test, a.provider, a.status, a.card, a.cents, a.currency], [true, 'simulated', 'succeeded', 'Visa test card ending 4242', 1234, 'USD']);
  await assert.rejects(pay(charge(), vault({ SHOPPER_CARD: 'pm_card_mastercard' }), false), /test cards only/);
  await assert.rejects(pay(charge(), vault({}), false), /test cards only/);
  await assert.rejects(pay(charge(), vault({ SHOPPER_CARD: 'pm_card_chargeDeclined' }), false), /declined/);
  await assert.rejects(pay({ ...charge(), cents: 0 }, v, false), /positive whole number/);
  await assert.rejects(pay({ ...charge(), currency: 'dollars' }, v, false), /three letter/);
});

test('simulated refunds: stable id, full by default, partial reports refundedCents, never more than the charge', async () => {
  const v = vault({ SHOPPER_CARD: 'pm_card_visa' });
  const paid = await pay(charge('k1', 2000), v, false);
  const full = await pay({ action: 'refund', payment: paid, key: 'refund-k1' }, v, false);
  assert.match(full.id, /^re_sim_[0-9a-f]{16}$/);
  assert.equal(full.id, (await pay({ action: 'refund', payment: paid, key: 'refund-k1' }, v, false)).id);
  assert.deepEqual([full.status, full.refundedCents, full.card], ['refunded', 2000, paid.card]);
  const part = await pay({ action: 'refund', payment: paid, key: 'protect-k1', cents: 350 }, v, false);
  assert.equal(part.refundedCents, 350);
  await assert.rejects(pay({ action: 'refund', payment: paid, key: 'x', cents: 2001 }, v, false), /more than the payment/);
  await assert.rejects(pay({ action: 'refund', payment: paid, key: 'x', cents: 1.5 }, v, false), /positive whole number/);
  // A simulated payment refunds as simulated even after real keys arrive, with no network call.
  const seen = stubFetch();
  assert.equal((await pay({ action: 'refund', payment: paid, key: 'r2' }, vault({ ...STRIPE, ...CYBS }), false)).id.startsWith('re_sim_'), true);
  assert.equal(seen.length, 0);
  // A real payment cannot be refunded offline.
  await assert.rejects(pay({ action: 'refund', payment: { ...paid, provider: 'stripe test mode' }, key: 'r3' }, v, true), /offline demo run/);
});

test('Stripe: a live key is refused before any network call, and a non-test card is refused too', async () => {
  const seen = stubFetch();
  await assert.rejects(pay(charge(), vault({ ...STRIPE, STRIPE_SECRET_KEY: 'sk_live_fake' }), false), /test mode only/);
  await assert.rejects(pay(charge(), vault({ ...STRIPE, STRIPE_SECRET_KEY: 'pk_test_fake' }), false), /test mode only/);
  await assert.rejects(pay({ action: 'refund', payment: { test: true, provider: 'stripe test mode', id: 'pi_1', status: 'succeeded', card: 'x' }, key: 'r' }, vault({ ...STRIPE, STRIPE_SECRET_KEY: 'sk_live_fake' }), false), /test mode only/);
  await assert.rejects(pay(charge(), vault({ ...STRIPE, SHOPPER_CARD: '4242424242424242' }), false), /test cards only/);
  assert.equal(seen.length, 0);
});

test('Stripe: charge uses the key as the idempotency key, and a partial refund sends the amount', async () => {
  const seen = stubFetch(
    { json: { id: 'pi_1', status: 'succeeded', latest_charge: { payment_method_details: { card: { brand: 'visa', last4: '4242' } } } } },
    { json: { id: 're_1', status: 'succeeded', amount: 300 } },
  );
  const v = vault(STRIPE);
  const paid = await pay(charge('order-9'), v, false);
  assert.deepEqual([paid.provider, paid.id, paid.card, paid.cents], ['stripe test mode', 'pi_1', 'Visa test card ending 4242', 1234]);
  assert.equal(seen[0].headers['idempotency-key'], 'order-9');
  assert.equal(seen[0].headers.authorization, 'Bearer sk_test_fake');
  const form = new URLSearchParams(seen[0].body);
  assert.deepEqual([form.get('amount'), form.get('currency'), form.get('payment_method'), form.get('description')], ['1234', 'usd', 'pm_card_visa', 'TEST: 2 x filters']);
  const refund = await pay({ action: 'refund', payment: paid, key: 'refund-order-9', cents: 300 }, v, false);
  const rf = new URLSearchParams(seen[1].body);
  assert.deepEqual([seen[1].url, rf.get('payment_intent'), rf.get('amount'), seen[1].headers['idempotency-key']], ['https://api.stripe.com/v1/refunds', 'pi_1', '300', 'refund-order-9']);
  assert.deepEqual([refund.id, refund.status, refund.refundedCents], ['re_1', 'refunded', 300]);
});

test('Cybersource: the signature matches an independent HMAC (openssl) for fixed inputs', () => {
  const body = '{"clientReferenceInformation":{"code":"TC50171_3"}}';
  const h = cybersourceHeaders({
    host: CYBS_HOST, path: '/pts/v2/payments', body, date: 'Thu, 18 Jul 2019 00:18:03 GMT',
    merchantId: CYBS.CYBERSOURCE_MERCHANT_ID, keyId: CYBS.CYBERSOURCE_KEY_ID, secretKey: CYBS.CYBERSOURCE_SECRET_KEY,
  });
  // Computed outside this code: sha256 of the body in base64, then HMAC-SHA256 of the signing string
  //   host: apitest.cybersource.com\ndate: Thu, 18 Jul 2019 00:18:03 GMT\nrequest-target: post /pts/v2/payments\ndigest: SHA-256=<digest>\nv-c-merchant-id: mymerchantid
  // keyed with the bytes 0x00 to 0x1f.
  assert.equal(h.digest, 'SHA-256=8/r3xgd0zzJf7lzdmDJ0phW/UOyPt23n++R+PbYNQeU=');
  assert.equal(
    h.signature,
    'keyid="123abcki-key1-key2-key3-keyid1234567", algorithm="HmacSHA256", headers="host date request-target digest v-c-merchant-id", signature="F64ZnzaP5PS9fn1q8ePnPtpUs1Hv0Lec7MTWaebtDZw="',
  );
  assert.deepEqual([h['v-c-merchant-id'], h.date, h.host], ['mymerchantid', 'Thu, 18 Jul 2019 00:18:03 GMT', 'apitest.cybersource.com']);
});

test('Cybersource: the production host and real card numbers are refused', async () => {
  const args = { path: '/pts/v2/payments', body: '{}', date: 'x', merchantId: 'm', keyId: 'k', secretKey: CYBS.CYBERSOURCE_SECRET_KEY };
  assert.throws(() => cybersourceHeaders({ ...args, host: 'api.cybersource.com' }), /sandbox/);
  assert.throws(() => cybersourceCard('4242424242424242|12|2031'), /published Visa test cards/);
  assert.throws(() => cybersourceCard(undefined), /published Visa test cards/);
  assert.throws(() => cybersourceCard('4111111111111111|13|2031'), /number\|MM\|YYYY/);
  assert.throws(() => cybersourceCard('4111111111111111|12|31'), /number\|MM\|YYYY/);
  assert.deepEqual(cybersourceCard('4622943127013705|01|2030'), { number: '4622943127013705', expirationMonth: '01', expirationYear: '2030' });
  const seen = stubFetch();
  await assert.rejects(pay(charge(), vault({ ...CYBS, CYBERSOURCE_TEST_CARD: '5555555555554444|12|2031' }), false), /published Visa test cards/);
  assert.equal(seen.length, 0);
});

test('Cybersource: a charge captures, sends a decimal amount; a partial refund goes to the payment\'s refunds path', async () => {
  const seen = stubFetch(
    { status: 201, json: { id: '7000000000000000000001', status: 'AUTHORIZED' } },
    { status: 201, json: { id: '7000000000000000000002', status: 'PENDING' } },
  );
  const v = vault({ ...CYBS, ...STRIPE });
  const paid = await pay(charge('order-5', 1234), v, false);
  assert.deepEqual([paid.provider, paid.id, paid.status, paid.card, paid.cents, paid.currency], ['cybersource sandbox', '7000000000000000000001', 'succeeded', 'Visa test card ending 1111', 1234, 'USD']);
  assert.equal(seen[0].url, 'https://apitest.cybersource.com/pts/v2/payments');
  const sent = JSON.parse(seen[0].body);
  assert.equal(sent.clientReferenceInformation.code, 'order-5');
  assert.equal(sent.processingInformation.capture, true);
  assert.deepEqual(sent.paymentInformation.card, { number: '4111111111111111', expirationMonth: '12', expirationYear: '2031' });
  assert.deepEqual(sent.orderInformation.amountDetails, { totalAmount: '12.34', currency: 'USD' });
  assert.match(seen[0].headers.signature, /^keyid="123abcki-key1-key2-key3-keyid1234567", algorithm="HmacSHA256", headers="host date request-target digest v-c-merchant-id", signature="[A-Za-z0-9+/]{43}="$/);
  assert.ok(!seen[0].body.includes(CYBS.CYBERSOURCE_SECRET_KEY));
  const refund = await pay({ action: 'refund', payment: paid, key: 'refund-order-5', cents: 500 }, v, false);
  assert.equal(seen[1].url, 'https://apitest.cybersource.com/pts/v2/payments/7000000000000000000001/refunds');
  assert.deepEqual(JSON.parse(seen[1].body).orderInformation.amountDetails, { totalAmount: '5.00', currency: 'USD' });
  assert.deepEqual([refund.id, refund.status, refund.refundedCents], ['7000000000000000000002', 'refunded', 500]);
});

test('Cybersource: a decline throws, and a full refund needs the recorded amount', async () => {
  stubFetch({ status: 201, json: { id: '1', status: 'DECLINED', errorInformation: { reason: 'PROCESSOR_DECLINED', message: 'Decline - General decline of the card' } } });
  await assert.rejects(pay(charge(), vault(CYBS), false), /payment declined: Decline - General decline/);
  mock.restoreAll();
  const seen = stubFetch();
  const noAmount: Payment = { test: true, provider: 'cybersource sandbox', id: '1', status: 'succeeded', card: 'x' };
  await assert.rejects(pay({ action: 'refund', payment: noAmount, key: 'r' }, vault(CYBS), false), /needs the amount/);
  assert.equal(seen.length, 0);
});

test('Cybersource: a long order key is shortened to the 50 character reference limit', async () => {
  const seen = stubFetch({ status: 201, json: { id: '1', status: 'AUTHORIZED' } });
  await pay(charge('o'.repeat(80)), vault(CYBS), false);
  assert.equal(JSON.parse(seen[0].body).clientReferenceInformation.code.length, 50);
});

test('Visa Intelligent Commerce: x-pay-token matches an independent HMAC, and the JWE round-trips', () => {
  // HMAC-SHA256 hex of "1700000000v1/instructionsapikey=KEY{\"encData\":\"x\"}" keyed "shared-secret", computed with openssl.
  assert.equal(xPayToken('shared-secret', '/vacp/v1/instructions', 'apikey=KEY', '{"encData":"x"}', 1_700_000_000_000), 'xv2:1700000000:6469e13b30dbb1a1661327f58ee0486725d670d80699bce53217d253ff00dbe7');
  const jwe = jweEncrypt('{"hello":"world"}', pubPem, 'key-1', 1_700_000_000_000);
  const parts = jwe.split('.');
  assert.equal(parts.length, 5);
  assert.deepEqual(JSON.parse(Buffer.from(parts[0], 'base64url').toString()), { alg: 'RSA-OAEP-256', enc: 'A128GCM', kid: 'key-1', iat: 1_700_000_000_000 });
  assert.equal(jweDecrypt(jwe, privPem), '{"hello":"world"}');
  assert.throws(() => jweDecrypt(`${parts[0]}.${parts[1]}.${parts[2]}.${parts[3]}.${Buffer.alloc(16).toString('base64url')}`, privPem));
});

test('Visa Intelligent Commerce: a charge asks for an instruction then credentials, all encrypted, and keeps no credential', async () => {
  const reply = (obj: object) => ({ json: { encData: jweEncrypt(JSON.stringify(obj), pubPem, 'key-1') } });
  const seen = stubFetch(
    reply({ clientReferenceId: 'c', instructionId: 'instr-1', status: 'ACTIVE' }),
    reply({ instructionId: 'instr-1', transactionCredentials: { cardNumber: '4000000000000000', expirationDate: '12/30', securityCode: '123' } }),
  );
  const v = vault(VIC);
  const paid = await pay(charge('order-7', 1234), v, false);
  assert.deepEqual([paid.provider, paid.id, paid.status, paid.cents, paid.test], ['visa intelligent commerce', 'instr-1', 'credentials issued', 1234, true]);
  assert.ok(!JSON.stringify(paid).includes('4000000000000000'));
  assert.match(seen[0].url, /^https:\/\/sandbox\.api\.visa\.com\/vacp\/v1\/instructions\?apikey=fake-api-key$/);
  assert.match(seen[1].url, /^https:\/\/sandbox\.api\.visa\.com\/vacp\/v1\/instructions\/instr-1\/credentials\?apikey=fake-api-key$/);
  assert.equal(seen[0].headers.keyId, 'key-1');
  assert.match(seen[0].headers['x-pay-token'], /^xv2:\d+:[0-9a-f]{64}$/);
  const first = JSON.parse(jweDecrypt(JSON.parse(seen[0].body).encData, privPem));
  assert.deepEqual([first.consumerId, first.tokenId, first.mandates[0].declineThreshold], ['consumer-1', 'token-ref-1', { amount: '12.34', currencyCode: 'USD' }]);
  assert.ok(!seen[0].body.includes('token-ref-1'), 'the body is encrypted');
  const second = JSON.parse(jweDecrypt(JSON.parse(seen[1].body).encData, privPem));
  assert.deepEqual([second.instructionId, second.transactionData[0].transactionAmount], ['instr-1', { transactionCurrencyCode: 'USD', transactionAmount: '12.34' }]);
  // Refund cancels the instruction. A partial refund is refused.
  await assert.rejects(pay({ action: 'refund', payment: paid, key: 'r', cents: 100 }, v, false), /whole instruction/);
  seen.length = 0;
  mock.restoreAll();
  const seen2 = stubFetch(reply({ instructionId: 'instr-1', status: 'CANCELLED' }));
  const back = await pay({ action: 'refund', payment: paid, key: 'refund-order-7' }, v, false);
  assert.equal(seen2[0].url, 'https://sandbox.api.visa.com/vacp/v1/instructions/instr-1/cancel?apikey=fake-api-key');
  assert.deepEqual([back.status, back.refundedCents], ['refunded', 1234]);
});

test('Visa Intelligent Commerce: ids derived from the key are stable, and an error body is decrypted', async () => {
  const cfg = {
    apiKey: 'a', sharedSecret: 's', serverCert: pubPem, privateKey: privPem, keyId: 'key-1', consumerId: 'consumer-1', tokenId: 'token-ref-1', client: { externalClientId: 'c', externalAppId: 'a' },
  };
  const a = initiateInstructionBody(cfg, 'order-1', 100, 'USD', 'x');
  assert.equal(a.clientReferenceId, initiateInstructionBody(cfg, 'order-1', 100, 'USD', 'x').clientReferenceId);
  assert.match(a.clientReferenceId, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  assert.equal(cancelInstructionBody(cfg, 'k', 'i').instructionId, 'i');
  stubFetch({ status: 400, json: { encData: jweEncrypt(JSON.stringify({ responseStatus: { message: 'mandate too large' } }), pubPem, 'key-1') } });
  await assert.rejects(pay(charge(), vault(VIC), false), /Visa Intelligent Commerce 400: mandate too large/);
});
