// Payments for the shopper: one interface, four providers. Every payment here is a TEST payment: no real money moves.
//
//   visa intelligent commerce   Visa's agent platform (sandbox). Needs onboarding with a Visa representative. NEVER TESTED.
//   cybersource sandbox         Cybersource is a Visa company. Real sandbox calls, tested.
//   stripe test mode            Stripe test keys and Stripe's test cards.
//   simulated                   No network call. Used until a provider's keys are in the vault, and in offline demo runs.
//
// The box owner puts keys in the vault; `provider()` picks the first provider whose keys are all there. The card is
// in the vault too, so the caller never holds it. Refunds go back through the provider that took the charge.
import { constants, createCipheriv, createDecipheriv, createHash, createHmac, privateDecrypt, publicEncrypt, randomBytes, randomUUID } from 'node:crypto';

export type Provider = 'stripe test mode' | 'cybersource sandbox' | 'visa intelligent commerce' | 'simulated';
export type Payment = {
  test: true; provider: Provider; id: string; status: string; card: string; note?: string; refundedCents?: number;
  /** The charge amount, kept so a refund knows how much to give back (Cybersource needs it). */
  cents?: number; currency?: string;
};
export type PayInput =
  | { action: 'charge'; cents: number; currency: string; key: string; description: string }
  | { action: 'refund'; payment: Payment; key: string; cents?: number }; // cents: a partial refund (price protection); omitted = full
type Secret = (name: string) => string | undefined;

// Vault keys a provider needs. `provider()` picks it only when every one is set.
const NEEDS: Record<Exclude<Provider, 'simulated'>, string[]> = {
  'visa intelligent commerce': [
    'VISA_VIC_API_KEY', 'VISA_VIC_API_KEY_SS', 'VISA_MLE_SERVER_CERT', 'VISA_MLE_PRIVATE_KEY', 'VISA_KEY_ID',
    'VISA_EXTERNAL_CLIENT_ID', 'VISA_EXTERNAL_APP_ID', 'VISA_CONSUMER_ID', 'VISA_ENROLLMENT_REFERENCE_ID',
  ],
  'cybersource sandbox': ['CYBERSOURCE_MERCHANT_ID', 'CYBERSOURCE_KEY_ID', 'CYBERSOURCE_SECRET_KEY', 'CYBERSOURCE_TEST_CARD'],
  'stripe test mode': ['STRIPE_SECRET_KEY'],
};
/** Every vault key any provider reads. All are optional. */
export const SECRETS: string[] = [...Object.values(NEEDS).flat(), 'SHOPPER_CARD', 'VISA_AUTHORIZATION', 'VISA_RELATIONSHIP_ID'];

const reader = (secret: Secret) => (name: string) => {
  try {
    return secret(name)?.trim() || undefined;
  } catch {
    return undefined; // the box's secret() throws for a name that is not in the vault
  }
};
const OFFLINE_NOTE = 'offline demo run: no network call';

/** Which provider pay() will use with these secrets, and why, in plain words. */
export function provider(secret: Secret, offline: boolean): { id: Provider; why: string } {
  if (offline) return { id: 'simulated', why: OFFLINE_NOTE };
  const get = reader(secret);
  const half: string[] = [];
  for (const id of Object.keys(NEEDS) as (keyof typeof NEEDS)[]) {
    const missing = NEEDS[id].filter((n) => !get(n));
    if (!missing.length) return { id, why: `${id}: its keys are in the vault` };
    if (missing.length < NEEDS[id].length) half.push(`${id} is missing ${missing.join(', ')}`);
  }
  return { id: 'simulated', why: `simulated: no payment keys in the vault yet${half.length ? ` (${half.join('; ')})` : ''}` };
}

const simId = (prefix: string, key: string) => `${prefix}_sim_${createHash('sha256').update(key).digest('hex').slice(0, 16)}`;

/** One JSON call with a timeout. `open` turns the raw body into the real one (Visa encrypts its bodies). */
async function call(name: string, url: string, init: RequestInit, errorText: (body: any) => string | undefined, open = (b: any) => b) {
  const r = await fetch(url, { ...init, signal: AbortSignal.timeout(30_000) });
  const body = open(await r.json().catch(() => ({})));
  if (!r.ok) throw new Error(`${name} ${r.status}: ${errorText(body) ?? r.statusText}`);
  return body;
}

// ---------- the entry point ----------

export async function pay(input: PayInput, secret: Secret, offline: boolean): Promise<Payment> {
  const get = reader(secret);
  if (input.action === 'charge') {
    if (!Number.isInteger(input.cents) || input.cents <= 0) throw new Error('a charge must be a positive whole number of cents');
    if (!/^[A-Za-z]{3}$/.test(input.currency)) throw new Error('the currency must be a three letter code such as USD');
    const p = provider(secret, offline);
    const sale = { cents: input.cents, currency: input.currency.toUpperCase() };
    if (p.id === 'stripe test mode') return { ...(await stripeCharge(input, get)), ...sale };
    if (p.id === 'cybersource sandbox') return { ...(await cybersourceCharge(input, get)), ...sale };
    if (p.id === 'visa intelligent commerce') return { ...(await vicCharge(input, vicConfig(get))), ...sale };
    return { ...simulatedCharge(input, get), ...sale, note: p.why };
  }
  const was = input.payment;
  if (input.cents !== undefined && (!Number.isInteger(input.cents) || input.cents <= 0)) throw new Error('a partial refund must be a positive whole number of cents');
  if (input.cents !== undefined && was.cents !== undefined && input.cents > was.cents) throw new Error('the refund is more than the payment');
  if (was.provider === 'simulated') {
    return { ...was, id: simId('re', input.key), status: 'refunded', refundedCents: input.cents ?? was.cents, note: offline ? OFFLINE_NOTE : 'simulated: this payment never reached a payment provider' };
  }
  if (offline) throw new Error(`offline demo run: it cannot refund a ${was.provider} payment`);
  if (was.provider === 'stripe test mode') return stripeRefund(input, was, get);
  if (was.provider === 'cybersource sandbox') return cybersourceRefund(input, was, get);
  return vicRefund(input, was, vicConfig(get));
}

// ---------- simulated ----------

// Stripe's test PaymentMethods. A simulated or Stripe charge accepts only these, so no real card is ever "charged" here.
const TEST_CARDS: Record<string, string> = {
  pm_card_visa: 'Visa test card ending 4242',
  pm_card_visa_debit: 'Visa debit test card ending 5556',
  pm_card_chargeDeclined: 'Visa test card ending 0002 (always declined)',
};
function stripeTestCard(get: (n: string) => string | undefined) {
  const card = get('SHOPPER_CARD') ?? '';
  if (!TEST_CARDS[card]) throw new Error('the vault card is not a Stripe test card; this store takes test cards only');
  return card;
}

function simulatedCharge(input: Extract<PayInput, { action: 'charge' }>, get: (n: string) => string | undefined): Payment {
  const card = stripeTestCard(get);
  if (card === 'pm_card_chargeDeclined') throw new Error('card declined (simulated)');
  return { test: true, provider: 'simulated', id: simId('pi', input.key), status: 'succeeded', card: TEST_CARDS[card] };
}

// ---------- Stripe test mode ----------

async function stripe(key: string, route: string, form: Record<string, string>, idempotencyKey: string) {
  return call('Stripe', `https://api.stripe.com/v1/${route}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/x-www-form-urlencoded', 'idempotency-key': idempotencyKey },
    body: new URLSearchParams(form),
  }, (b) => b?.error?.message);
}
function stripeKey(get: (n: string) => string | undefined) {
  const key = get('STRIPE_SECRET_KEY') ?? '';
  if (!/^(sk|rk)_test_/.test(key)) throw new Error('this store runs in Stripe test mode only, and the vault holds a live key, so it refuses to charge');
  return key;
}

async function stripeCharge(input: Extract<PayInput, { action: 'charge' }>, get: (n: string) => string | undefined): Promise<Payment> {
  const key = stripeKey(get);
  const card = stripeTestCard(get);
  const pi = await stripe(key, 'payment_intents', {
    amount: String(input.cents),
    currency: input.currency.toLowerCase(),
    payment_method: card,
    'payment_method_types[]': 'card',
    confirm: 'true',
    description: `TEST: ${input.description}`.slice(0, 300),
    'metadata[box_order]': input.key,
    'expand[]': 'latest_charge',
  }, input.key);
  if (pi.status !== 'succeeded') throw new Error(`payment ${pi.status}`);
  const c = pi.latest_charge?.payment_method_details?.card;
  return { test: true, provider: 'stripe test mode', id: pi.id, status: pi.status, card: c ? `${c.brand === 'visa' ? 'Visa' : c.brand} test card ending ${c.last4}` : TEST_CARDS[card] };
}

async function stripeRefund(input: Extract<PayInput, { action: 'refund' }>, was: Payment, get: (n: string) => string | undefined): Promise<Payment> {
  const form: Record<string, string> = { payment_intent: was.id };
  if (input.cents !== undefined) form.amount = String(input.cents);
  const r = await stripe(stripeKey(get), 'refunds', form, input.key);
  return { ...was, id: r.id, status: r.status === 'succeeded' ? 'refunded' : r.status, refundedCents: r.amount ?? input.cents };
}

// ---------- Cybersource sandbox ----------
// Docs: https://developer.cybersource.com/docs/cybs/en-us/payments/developer/all/rest/payments.html (Payments API),
// https://developer.cybersource.com/hello-world/testing-guide.html (test cards). Signing follows Cybersource's own Node SDK:
// https://github.com/CyberSource/cybersource-rest-client-node (src/authentication/http/*.js). Tested against the sandbox.
// Cybersource marks HTTP Signature as deprecating in favour of JWT with the same shared secret. It still works in the sandbox.
// Cybersource has no idempotency header. `clientReferenceInformation.code` is only a reference, so the caller must not
// retry a charge with the same key and expect no second charge (the store looks the order up by key before it charges).

export const CYBS_HOST = 'apitest.cybersource.com';
// The Visa numbers from the testing guide. Anything else is refused, so a real card number can never be sent here.
const CYBS_TEST_CARDS = ['4111111111111111', '4622943127013705', '4622943127013713', '4622943127013721', '4622943127013739', '4622943127013747'];

/** The headers for a signed POST. Refuses any host but the sandbox. */
export function cybersourceHeaders(a: { host: string; path: string; body: string; date: string; merchantId: string; keyId: string; secretKey: string }) {
  if (a.host !== CYBS_HOST) throw new Error(`this store signs requests for the Cybersource sandbox (${CYBS_HOST}) only, not ${a.host}`);
  const digest = `SHA-256=${createHash('sha256').update(a.body).digest('base64')}`;
  // One line per signed header, joined by newlines. "request-target" has no parentheses (Cybersource's SDK and its 2023 notice).
  const signed = [`host: ${a.host}`, `date: ${a.date}`, `request-target: post ${a.path}`, `digest: ${digest}`, `v-c-merchant-id: ${a.merchantId}`].join('\n');
  const signature = createHmac('sha256', Buffer.from(a.secretKey, 'base64')).update(signed).digest('base64');
  return {
    'content-type': 'application/json',
    'v-c-merchant-id': a.merchantId,
    date: a.date,
    host: a.host,
    digest,
    signature: `keyid="${a.keyId}", algorithm="HmacSHA256", headers="host date request-target digest v-c-merchant-id", signature="${signature}"`,
  };
}

function cybersourceConfig(get: (n: string) => string | undefined) {
  const merchantId = get('CYBERSOURCE_MERCHANT_ID');
  const keyId = get('CYBERSOURCE_KEY_ID');
  const secretKey = get('CYBERSOURCE_SECRET_KEY');
  if (!merchantId || !keyId || !secretKey) throw new Error('the Cybersource keys are not all in the vault');
  return { merchantId, keyId, secretKey };
}

async function cybersource(c: ReturnType<typeof cybersourceConfig>, path: string, payload: object) {
  const body = JSON.stringify(payload);
  const headers = cybersourceHeaders({ host: CYBS_HOST, path, body, date: new Date().toUTCString(), ...c });
  return call('Cybersource', `https://${CYBS_HOST}${path}`, { method: 'POST', headers, body }, (b) => (b?.message ?? b?.reason) && `${b.message ?? b.reason}${b.details?.length ? ` (${b.details.map((d: any) => d.field).join(', ')})` : ''}`);
}

// shortcut: two-decimal currencies only (USD, CAD), which are the only ones the store sells in. Add a table for yen or dinar.
const decimal = (cents: number) => (cents / 100).toFixed(2);
// Cybersource limits the reference code to 50 characters.
const reference = (key: string) => (key.length <= 50 ? key : createHash('sha256').update(key).digest('hex').slice(0, 50));

// The sandbox rejects a sale without a billing address. This is a made-up one; no person's details go to Cybersource.
const CYBS_BILL_TO = { firstName: 'Test', lastName: 'Shopper', address1: '1 Test Street', locality: 'Toronto', administrativeArea: 'ON', postalCode: 'M5V 2T6', country: 'CA', email: 'test@example.com' };

/** "number|MM|YYYY" from the vault, refused unless the number is one of Cybersource's published Visa test cards. */
export function cybersourceCard(raw: string | undefined) {
  const [number = '', month = '', year = ''] = (raw ?? '').split('|').map((s) => s.trim());
  if (!CYBS_TEST_CARDS.includes(number)) throw new Error('the vault card is not one of Cybersource\'s published Visa test cards; this store takes test cards only');
  if (!/^(0[1-9]|1[0-2])$/.test(month) || !/^\d{4}$/.test(year)) throw new Error('CYBERSOURCE_TEST_CARD must look like number|MM|YYYY');
  return { number, expirationMonth: month, expirationYear: year };
}

async function cybersourceCharge(input: Extract<PayInput, { action: 'charge' }>, get: (n: string) => string | undefined): Promise<Payment> {
  const c = cybersourceConfig(get);
  const card = cybersourceCard(get('CYBERSOURCE_TEST_CARD'));
  const r = await cybersource(c, '/pts/v2/payments', {
    clientReferenceInformation: { code: reference(input.key), comments: `TEST: ${input.description}`.slice(0, 250) },
    processingInformation: { capture: true },
    paymentInformation: { card },
    orderInformation: { amountDetails: { totalAmount: decimal(input.cents), currency: input.currency.toUpperCase() }, billTo: CYBS_BILL_TO },
  });
  // With capture on, an approved sale comes back as AUTHORIZED and settles in Cybersource's next batch.
  if (r.status !== 'AUTHORIZED') throw new Error(`payment ${String(r.status).toLowerCase()}${r.errorInformation?.message ? `: ${r.errorInformation.message}` : ''}`);
  return { test: true, provider: 'cybersource sandbox', id: r.id, status: 'succeeded', card: `Visa test card ending ${card.number.slice(-4)}`, note: `Cybersource sandbox status ${r.status}` };
}

async function cybersourceRefund(input: Extract<PayInput, { action: 'refund' }>, was: Payment, get: (n: string) => string | undefined): Promise<Payment> {
  const cents = input.cents ?? was.cents;
  if (cents === undefined || !was.currency) throw new Error('Cybersource needs the amount to refund, and this payment did not record one');
  const r = await cybersource(cybersourceConfig(get), `/pts/v2/payments/${encodeURIComponent(was.id)}/refunds`, {
    clientReferenceInformation: { code: reference(input.key) },
    orderInformation: { amountDetails: { totalAmount: decimal(cents), currency: was.currency } },
  });
  if (r.status !== 'PENDING') throw new Error(`refund ${String(r.status).toLowerCase()}${r.errorInformation?.message ? `: ${r.errorInformation.message}` : ''}`);
  return { ...was, id: r.id, status: 'refunded', refundedCents: cents, note: `Cybersource sandbox refund status ${r.status}` };
}

// ---------- Visa Intelligent Commerce (VIC) ----------
// NEVER TESTED. We have no VIC keys: access needs onboarding with a Visa representative. The request shapes below come from
// Visa's own MIT-licensed toolkit, https://github.com/visa/mcp (packages/api-client/src and apps/shared-utils/payload-builders),
// which targets the Visa Developer Platform (VDP) sandbox. Product pages: https://developer.visa.com/capabilities/visa-intelligent-commerce
// and https://developer.visa.com/use-cases/visa-intelligent-commerce-for-agents. Auth guides:
// https://developer.visa.com/pages/working-with-visa-apis/x-pay-token and https://developer.visa.com/pages/encryption_guide
//
// DOCUMENTED (in Visa's toolkit): the host, the four paths, the apikey query parameter, the x-pay-token recipe, the keyId header,
// message level encryption as a compact JWE (RSA-OAEP-256 plus A128GCM) in {"encData": "..."}, the payload field names, and
// the response fields instructionId and status.
// GUESSED: how much of this sandbox accepts our values. The device and assurance data below are the toolkit's fixed sample values.
// A real purchase must send what the cardholder's Passkey step-up produced. The merchant category values are our guess. The
// amounts are decimal strings in major units, as in the mandate sample. Whether the credentials call needs more fields for a
// real token is unknown. Card enrollment (enrollCardBody) needs a human step-up and a VTS token reference, so pay() never calls it.
//
// What VIC does: it moves no money. It checks a payment instruction (a mandate with a ceiling) and then hands the agent a
// tokenized credential for one purchase. The merchant's own processor has to use that credential. This test store has no
// processor, so a VIC "charge" ends when the credential is issued, and the credential is never stored or returned.
//
// Visa also documents a second route on the Visa Acceptance platform, with paths under /acp/v1 on apitest.visaacceptance.com,
// signed like Cybersource: https://developer.visaacceptance.com/docs/vas/en-us/intelligent-commerce/developer/all/rest/intelligent-commerce.html
// It needs a token requester ID and a relationship ID from an account manager. Not implemented here.

const VIC_HOST = 'https://sandbox.api.visa.com'; // sandbox only; Visa's production host is api.visa.com and this store never calls it
export type VicConfig = {
  apiKey: string; sharedSecret: string; serverCert: string; privateKey: string; keyId: string; consumerId: string; tokenId: string;
  client: { externalClientId: string; externalAppId: string; authorization?: string; relationshipId?: string };
};

function vicConfig(get: (n: string) => string | undefined): VicConfig {
  const need = (n: string) => {
    const v = get(n);
    if (!v) throw new Error(`${n} is not in the vault`);
    return v;
  };
  const pem = (n: string) => need(n).replace(/\\n/g, '\n'); // a vault line cannot hold newlines, so PEM uses a literal \n
  return {
    apiKey: need('VISA_VIC_API_KEY'), sharedSecret: need('VISA_VIC_API_KEY_SS'), serverCert: pem('VISA_MLE_SERVER_CERT'), privateKey: pem('VISA_MLE_PRIVATE_KEY'),
    keyId: need('VISA_KEY_ID'), consumerId: need('VISA_CONSUMER_ID'), tokenId: need('VISA_ENROLLMENT_REFERENCE_ID'),
    client: {
      externalClientId: need('VISA_EXTERNAL_CLIENT_ID'), externalAppId: need('VISA_EXTERNAL_APP_ID'),
      ...(get('VISA_AUTHORIZATION') ? { authorization: get('VISA_AUTHORIZATION') } : {}), ...(get('VISA_RELATIONSHIP_ID') ? { relationshipId: get('VISA_RELATIONSHIP_ID') } : {}),
    },
  };
}

/** "xv2:<unix seconds>:<hex HMAC-SHA256>" over seconds + resource path + query + body. VIC drops the /vacp/ prefix from the path. */
export function xPayToken(sharedSecret: string, path: string, query: string, body: string, nowMs = Date.now()) {
  const seconds = Math.floor(nowMs / 1000);
  const resource = path.replace(/^\/vacp\//, '').replace(/^\//, '');
  return `xv2:${seconds}:${createHmac('sha256', sharedSecret).update(`${seconds}${resource}${query}${body}`).digest('hex')}`;
}

const b64u = (b: Buffer | string) => Buffer.from(b).toString('base64url');
/** Message level encryption: a compact JWE, RSA-OAEP-256 key wrap and A128GCM content. `cert` is Visa's MLE certificate or public key (PEM). */
export function jweEncrypt(plain: string, cert: string, keyId: string, nowMs = Date.now()) {
  const header = b64u(JSON.stringify({ alg: 'RSA-OAEP-256', enc: 'A128GCM', kid: keyId, iat: nowMs }));
  const cek = randomBytes(16);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-128-gcm', cek, iv);
  cipher.setAAD(Buffer.from(header, 'ascii'));
  const text = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const wrapped = publicEncrypt({ key: cert, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' }, cek);
  return [header, b64u(wrapped), b64u(iv), b64u(text), b64u(cipher.getAuthTag())].join('.');
}
export function jweDecrypt(compact: string, privateKey: string) {
  const [header = '', wrapped = '', iv = '', text = '', tag = ''] = compact.split('.');
  const cek = privateDecrypt({ key: privateKey, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' }, Buffer.from(wrapped, 'base64url'));
  const decipher = createDecipheriv('aes-128-gcm', cek, Buffer.from(iv, 'base64url'));
  decipher.setAAD(Buffer.from(header, 'ascii'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(text, 'base64url')), decipher.final()]).toString('utf8');
}

async function vic(v: VicConfig, method: 'POST' | 'PUT', path: string, payload: object) {
  const query = `apikey=${encodeURIComponent(v.apiKey)}`;
  const body = JSON.stringify({ encData: jweEncrypt(JSON.stringify(payload), v.serverCert, v.keyId) });
  const headers = { 'content-type': 'application/json', 'x-pay-token': xPayToken(v.sharedSecret, path, query, body), 'x-request-id': randomUUID(), keyId: v.keyId };
  const open = (b: any) => (typeof b?.encData === 'string' ? JSON.parse(jweDecrypt(b.encData, v.privateKey)) : b);
  return call('Visa Intelligent Commerce', `${VIC_HOST}${path}?${query}`, { method, headers, body }, (b) => b?.responseStatus?.message ?? b?.message, open);
}

// Same input, same id, so a retried charge correlates. Visa's samples use random UUIDs; whether a derived one is accepted is a guess.
const uuidFrom = (text: string) => createHash('sha256').update(text).digest('hex').replace(/^(.{8})(.{4})(.{4})(.{4})(.{12}).*$/, '$1-$2-$3-$4-$5');
const now = () => String(Math.floor(Date.now() / 1000));
const appInstance = (v: VicConfig) => ({
  userAgent: 'Mozilla', applicationName: 'GurtOS Shopper (test)', countryCode: 'US', ipAddress: '127.0.0.1',
  deviceData: { type: 'Server', manufacturer: 'GurtOS', brand: 'GurtOS', model: 'box' }, clientDeviceId: uuidFrom(`device:${v.consumerId}`),
});
// GUESS: the toolkit's fixed sample. Real values describe how the cardholder was verified with their Passkey.
const assuranceData = () => [{ verificationType: 'DEVICE', verificationEntity: '10', verificationEvents: ['01', '02'], verificationMethod: '02', verificationResults: '01', verificationTimestamp: now() }];

/** POST /vacp/v1/cards. One-time, with a human step-up and a token reference from Visa Token Service (VTS). pay() does not call it. */
export function enrollCardBody(v: VicConfig, key: string, identity: { value: string; providerUrl: string }) {
  return {
    clientReferenceId: uuidFrom(key),
    consumer: {
      consumerId: v.consumerId, nationalIdentifier: `US-ID-${uuidFrom(v.consumerId).slice(0, 6)}`, countryCode: 'US', languageCode: 'en',
      consumerIdentity: { identityType: 'EMAIL_ADDRESS', identityValue: identity.value, identityProvider: 'PARTNER', identityProviderUrl: identity.providerUrl },
    },
    appInstance: appInstance(v),
    enrollmentReferenceData: { enrollmentReferenceId: v.tokenId, enrollmentReferenceType: 'TOKEN_REFERENCE_ID', enrollmentReferenceProvider: 'VTS' },
    consentData: [{ id: uuidFrom(`consent:${key}`), type: 'PERSONALIZATION', source: 'CLIENT', acceptedTime: now(), effectiveUntil: String(Math.floor(Date.now() / 1000) + 365 * 86400) }],
    client: v.client,
  };
}

/** POST /vacp/v1/instructions. The mandate is the ceiling the cardholder agreed to. */
export function initiateInstructionBody(v: VicConfig, key: string, cents: number, currency: string, description: string) {
  return {
    clientReferenceId: uuidFrom(key), appInstance: appInstance(v), consumerId: v.consumerId, tokenId: v.tokenId, assuranceData: assuranceData(),
    mandates: [{
      mandateId: uuidFrom(`mandate:${key}`), preferredMerchantName: 'GurtOS Test Store', merchantCategory: 'Grocery', merchantCategoryCode: '5411',
      declineThreshold: { amount: decimal(cents), currencyCode: currency }, effectiveUntilTime: String(Math.floor(Date.now() / 1000) + 86400),
      quantity: '1', description: `TEST: ${description}`.slice(0, 100),
    }],
    consumerPrompt: 'Test purchase at the GurtOS Test Store', client: v.client,
  };
}

/** POST /vacp/v1/instructions/{id}/credentials. Returns a tokenized credential for one purchase. */
export function retrieveCredentialsBody(v: VicConfig, key: string, instructionId: string, cents: number, currency: string) {
  return {
    clientReferenceId: uuidFrom(key), instructionId, tokenId: v.tokenId,
    // The toolkit's sample also sends a shippingAddress. Left out: the store ships nothing. Unknown whether Visa requires it.
    transactionData: [{
      transactionType: 'PURCHASE', transactionReferenceId: uuidFrom(`transaction:${key}`), transactionAmount: { transactionCurrencyCode: currency, transactionAmount: decimal(cents) },
      merchantName: 'GurtOS Test Store', merchantCountryCode: 'US', merchantUrl: 'https://example.com',
    }],
    client: v.client,
  };
}

/** POST /vacp/v1/instructions/{id}/confirmations. Tells Visa the merchant's processor approved or declined. Only valid once a processor has answered, so pay() does not call it. */
export function confirmEventsBody(v: VicConfig, key: string, instructionId: string, cents: number, currency: string, approval: { authorizationCode: string; responseCode: string }) {
  return {
    clientReferenceId: uuidFrom(key), instructionId, client: v.client,
    confirmationData: [{
      transactionReferenceId: uuidFrom(`transaction:${key}`),
      paymentConfirmationData: {
        transactionType: 'PURCHASE', transactionStatus: 'APPROVED', transactionTimestamp: now(), responseCode: approval.responseCode,
        authorizationCode: approval.authorizationCode, cardEntryMode: 'ECOMMERCE', transactionAmount: { transactionAmount: decimal(cents), transactionCurrencyCode: currency },
      },
    }],
  };
}

/** PUT /vacp/v1/instructions/{id}/cancel. */
export function cancelInstructionBody(v: VicConfig, key: string, instructionId: string) {
  return { clientReferenceId: uuidFrom(key), instructionId, appInstance: appInstance(v), assuranceData: assuranceData(), client: v.client };
}

async function vicCharge(input: Extract<PayInput, { action: 'charge' }>, v: VicConfig): Promise<Payment> {
  const currency = input.currency.toUpperCase();
  const made = await vic(v, 'POST', '/vacp/v1/instructions', initiateInstructionBody(v, input.key, input.cents, currency, input.description));
  if (typeof made.instructionId !== 'string') throw new Error('Visa Intelligent Commerce did not return an instructionId');
  await vic(v, 'POST', `/vacp/v1/instructions/${encodeURIComponent(made.instructionId)}/credentials`, retrieveCredentialsBody(v, input.key, made.instructionId, input.cents, currency));
  return {
    test: true, provider: 'visa intelligent commerce', id: made.instructionId, status: 'credentials issued', card: 'Visa token for this purchase (Visa sandbox)',
    note: 'TEST: Visa approved the payment instruction and issued a token. Visa moves no money and this store has no card processor, so nothing was charged.',
  };
}

async function vicRefund(input: Extract<PayInput, { action: 'refund' }>, was: Payment, v: VicConfig): Promise<Payment> {
  // Nothing was charged, so the only undo Visa documents is cancelling the instruction. It cannot return part of an amount.
  if (input.cents !== undefined && input.cents !== was.cents) throw new Error('Visa Intelligent Commerce can only cancel a whole instruction, not refund part of one');
  await vic(v, 'PUT', `/vacp/v1/instructions/${encodeURIComponent(was.id)}/cancel`, cancelInstructionBody(v, input.key, was.id));
  return { ...was, status: 'refunded', refundedCents: was.cents, note: 'TEST: the Visa payment instruction was cancelled. No money had moved.' };
}
