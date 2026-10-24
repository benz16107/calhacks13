// Visa's Trusted Agent Protocol (github.com/visa/trusted-agent-protocol): the agent signs each request to a
// merchant with an RFC 9421 HTTP message signature, and the merchant checks it against the agent's public key
// before it does anything. Same header format as Visa's sample agent (label sig2, "; " between parameters,
// Ed25519). One addition: we also sign the body's Content-Digest (RFC 9530), so an order cannot be changed in transit.
import { createHash, createPrivateKey, createPublicKey, generateKeyPairSync, randomUUID, sign, verify } from 'node:crypto';

export const KEY_ID = 'box-shopper';
export const PAYER = 'agent-payer-auth'; // Visa's tag for a checkout
export const BROWSE = 'agent-browser-auth'; // and for looking at products
const COMPONENTS = '("@authority" "@path" "content-digest")';
const LIFETIME = 8 * 60; // seconds, as in Visa's sample agent

/** The agent's key as the vault holds it: an Ed25519 private key, PKCS#8 DER, base64. */
export function newAgentKey(): string {
  return generateKeyPairSync('ed25519').privateKey.export({ format: 'der', type: 'pkcs8' }).toString('base64');
}

/** The raw 32-byte public key, base64: the form TAP's agent registry serves. */
export function publicKeyOf(vaultKey: string): string {
  const der = createPublicKey(createPrivateKey({ key: Buffer.from(vaultKey, 'base64'), format: 'der', type: 'pkcs8' })).export({ format: 'der', type: 'spki' });
  return der.subarray(-32).toString('base64');
}

const privateKey = (vaultKey: string) => createPrivateKey({ key: Buffer.from(vaultKey, 'base64'), format: 'der', type: 'pkcs8' });
const rawPublic = (pub: string) => createPublicKey({ key: Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), Buffer.from(pub, 'base64')]), format: 'der', type: 'spki' });

/** Sign bytes with the agent key (the mandate uses this too). Base64. */
export const signBytes = (vaultKey: string, data: string) => sign(null, Buffer.from(data), privateKey(vaultKey)).toString('base64');
/** Check a signature against a raw 32-byte public key from the registry. */
export function verifyBytes(pub: string, data: string, sig: string) {
  try {
    return verify(null, Buffer.from(data), rawPublic(pub), Buffer.from(sig, 'base64'));
  } catch {
    return false;
  }
}

export const digest = (body: string) => `sha-256=:${createHash('sha256').update(body).digest('base64')}:`;

const base = (authority: string, path: string, contentDigest: string, params: string) =>
  [`"@authority": ${authority}`, `"@path": ${path}`, `"content-digest": ${contentDigest}`, `"@signature-params": ${params}`].join('\n');

/** Headers that sign a request to `url` with this body. */
export function signRequest(vaultKey: string, url: string, body: string, tag = PAYER, now = Date.now()) {
  const u = new URL(url);
  const created = Math.floor(now / 1000);
  const params = `${COMPONENTS}; created=${created}; expires=${created + LIFETIME}; keyId="${KEY_ID}"; alg="ed25519"; nonce="${randomUUID()}"; tag="${tag}"`;
  const contentDigest = digest(body);
  const sig = signBytes(vaultKey, base(u.host, u.pathname, contentDigest, params));
  return { 'content-digest': contentDigest, 'signature-input': `sig2=${params}`, signature: `sig2=:${sig}:` };
}

export type Verified = { keyId: string; tag: string; nonce: string; created: number };

/**
 * Check a signed request. Throws the reason it is refused. `lookup` returns the raw public key for a key id
 * (the registry), `seen` records a nonce and returns false if it was used before.
 */
export function verifyRequest(
  req: { authority: string; path: string; headers: Headers; body: string },
  lookup: (keyId: string) => string | undefined,
  seen: (nonce: string, expires: number) => boolean,
  now = Date.now(),
): Verified {
  const input = req.headers.get('signature-input') ?? '';
  const sigHeader = req.headers.get('signature') ?? '';
  if (!input || !sigHeader) throw new Error('unsigned request: this store takes orders only from agents that sign with Visa Trusted Agent Protocol');
  const m = input.match(/^sig2=(\([^)]*\);\s*.+)$/);
  const sig = sigHeader.match(/^sig2=:([A-Za-z0-9+/=]+):$/)?.[1];
  if (!m || !sig) throw new Error('malformed Signature-Input or Signature header');
  const params = m[1];
  if (!params.startsWith(COMPONENTS + ';')) throw new Error(`the signature must cover ${COMPONENTS}`);
  const attr = Object.fromEntries([...params.matchAll(/(\w+)=("[^"]*"|\d+)/g)].map(([, k, v]) => [k, v.replace(/"/g, '')]));
  const created = Number(attr.created);
  const expires = Number(attr.expires);
  const t = Math.floor(now / 1000);
  if (attr.alg !== 'ed25519') throw new Error(`unsupported algorithm ${attr.alg}`);
  if (!(created <= t + 60) || !(expires >= t) || expires - created > LIFETIME) throw new Error('the signature is expired or not yet valid');
  if (!attr.nonce) throw new Error('the signature has no nonce');
  const pub = lookup(attr.keyId);
  if (!pub) throw new Error(`unknown agent key ${attr.keyId}: not in the agent registry`);
  if (req.headers.get('content-digest') !== digest(req.body)) throw new Error('the body does not match its signed Content-Digest: the order was changed');
  if (!verifyBytes(pub, base(req.authority, req.path, req.headers.get('content-digest')!, params), sig)) throw new Error('the signature does not verify against the agent key');
  if (!seen(attr.nonce, expires)) throw new Error('replay: this signature was already used');
  return { keyId: attr.keyId, tag: attr.tag, nonce: attr.nonce, created };
}
