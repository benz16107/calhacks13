// GurtOS Business: sign in with a work account (OpenID Connect: Microsoft Entra ID, Google, any standard provider).
// The checks are pure functions here; core/box.ts keeps the state and serves /api/sso/*. Node's crypto verifies the
// RS256 signatures, so there is no new dependency.
import { createHash, createPublicKey, randomBytes, verify } from 'node:crypto';
import { ROLES, type Role } from './business.ts';

/** The role a group's members get, and for an approver what they approve for and up to how much. */
export interface GroupRole {
  role: Role;
  approvesFor?: string[];
  /** US cents. Required for an approver. */
  limitCents?: number | null;
}

export interface Sso {
  /** What the sign-in button names, like "Fogline (Microsoft Entra ID)". */
  name: string;
  /** Exactly the `issuer` of the provider's discovery document. For Entra: https://login.microsoftonline.com/<tenant id>/v2.0 */
  issuer: string;
  clientId: string;
  /** The vault key that holds the client secret (set it with PUT /api/vault/<key>). Starts with SSO_. */
  secretKey: string;
  /** Only addresses at this domain may sign in, like "fogline.example". */
  domain?: string;
  /** A group (Entra: the group's object id) to the role its members get. Someone in none of them is refused. */
  groups: Record<string, GroupRole>;
}

export type Claims = Record<string, unknown> & { iss: string; sub: string; aud: string | string[]; exp: number; nonce?: string };

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const loopback = /^http:\/\/(127\.0\.0\.1|localhost|\[::1\])(:\d+)?(\/|$)/;
/** https, or plain http only to this machine (a test provider). */
export const safeUrl = (u: unknown): u is string => typeof u === 'string' && u.length <= 500 && (/^https:\/\/[^\s/]+/.test(u) || loopback.test(u));

/** The settings, checked. */
export function checkSso(v: unknown): Sso {
  const example = 'send sso: {name, issuer, clientId, secretKey, domain?, groups: {"<group id>": {role, approvesFor?, limitCents?}}}';
  if (!isObj(v)) throw new Error(example);
  const known = ['name', 'issuer', 'clientId', 'secretKey', 'domain', 'groups'];
  const unknown = Object.keys(v).filter((k) => !known.includes(k));
  if (unknown.length) throw new Error(`sso: unknown field ${unknown.join(', ')} (known: ${known.join(', ')})`);
  if (typeof v.name !== 'string' || !v.name.trim() || v.name.length > 60) throw new Error('sso.name: what the button says, 1 to 60 characters, like "Fogline (Microsoft Entra ID)"');
  if (!safeUrl(v.issuer)) throw new Error('sso.issuer: the provider\'s https address, exactly as its discovery document says, like https://login.microsoftonline.com/<tenant id>/v2.0');
  if (typeof v.clientId !== 'string' || !/^[\w.@:/-]{1,200}$/.test(v.clientId)) throw new Error('sso.clientId: the app\'s client (application) id');
  // Only SSO_ keys: the box sends this secret to the provider, so it must never be able to name another key in the vault.
  if (typeof v.secretKey !== 'string' || !/^SSO_[A-Z0-9_]{1,60}$/.test(v.secretKey)) throw new Error('sso.secretKey: the name of the vault key that holds the client secret, starting with SSO_, like SSO_CLIENT_SECRET');
  if (v.domain !== undefined && (typeof v.domain !== 'string' || !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(v.domain))) throw new Error('sso.domain: an email domain, like fogline.example');
  if (!isObj(v.groups) || !Object.keys(v.groups).length || Object.keys(v.groups).length > 50) throw new Error('sso.groups: 1 to 50 groups, like {"<group object id>": {"role": "approver", "approvesFor": ["Controller"], "limitCents": 5000000}}');
  const groups: Sso['groups'] = {};
  for (const [id, g] of Object.entries(v.groups)) {
    const at = `sso.groups["${id.slice(0, 40)}"]`;
    if (!/^[\w .@:-]{1,120}$/.test(id)) throw new Error(`${at}: a group id or name`);
    if (!isObj(g) || Object.keys(g).some((k) => !['role', 'approvesFor', 'limitCents'].includes(k))) throw new Error(`${at}: {role, approvesFor?, limitCents?}`);
    if (!ROLES.includes(g.role as Role)) throw new Error(`${at}.role: one of ${ROLES.join(', ')}`);
    if (g.limitCents !== undefined && g.limitCents !== null && (!Number.isInteger(g.limitCents) || (g.limitCents as number) < 0 || (g.limitCents as number) > 1e12)) throw new Error(`${at}.limitCents: a whole number of cents`);
    if (g.role === 'approver' && typeof g.limitCents !== 'number') throw new Error(`${at}.limitCents: an approver needs a spending limit, in US cents ($50,000 is 5000000)`);
    if (g.approvesFor !== undefined && (!Array.isArray(g.approvesFor) || g.approvesFor.length > 10 || g.approvesFor.some((n) => typeof n !== 'string' || !/^[\w &.'-]{1,40}$/.test(n)))) throw new Error(`${at}.approvesFor: up to 10 names from the policy, like ["Controller"]`);
    groups[id] = { role: g.role as Role, ...(g.approvesFor ? { approvesFor: g.approvesFor as string[] } : {}), ...(g.limitCents !== undefined ? { limitCents: g.limitCents as number | null } : {}) };
  }
  return { name: v.name.trim(), issuer: v.issuer, clientId: v.clientId, secretKey: v.secretKey, ...(v.domain ? { domain: (v.domain as string).toLowerCase() } : {}), groups };
}

/**
 * The role for someone in these groups: the strongest role among the groups that map (owner, then admin, approver,
 * requester, auditor), what all of them approve for, and the highest limit among that role's groups. Undefined when no group maps: refused.
 * A group grants owner only when the mapping says owner.
 */
export function roleFor(groups: unknown, map: Sso['groups']): Required<GroupRole> | undefined {
  const mine = new Set((Array.isArray(groups) ? groups : []).filter((g) => typeof g === 'string').map((g) => g.toLowerCase()));
  const hits = Object.entries(map).filter(([id]) => mine.has(id.toLowerCase())).map(([, g]) => g);
  if (!hits.length) return undefined;
  const role = ROLES.find((r) => hits.some((g) => g.role === r))!;
  const limits = hits.filter((g) => g.role === role).map((g) => g.limitCents).filter((l) => l !== undefined);
  return {
    role,
    approvesFor: [...new Set(hits.flatMap((g) => g.approvesFor ?? []))],
    limitCents: limits.includes(null) || !limits.length ? null : Math.max(...(limits as number[])),
  };
}

/** A person's id from the provider and the subject: stable across sign-ins, and the same subject at another provider is someone else. */
export const personId = (issuer: string, sub: string) => `sso-${createHash('sha256').update(`${issuer} ${sub}`).digest('hex').slice(0, 12)}`;

/** Name and email from the claims, and whether the domain allows them. */
export function whoIs(c: Claims, domain?: string): { name: string; email?: string } {
  const email = [c.email, c.preferred_username, c.upn].find((e): e is string => typeof e === 'string' && /^[^\s@]+@[^\s@]+$/.test(e));
  if (domain && (!email || !email.toLowerCase().endsWith(`@${domain}`) || c.email_verified === false)) throw new Error(`Only accounts at ${domain} can sign in here.`);
  const full = typeof c.name === 'string' && c.name.trim() ? c.name : [c.given_name, c.family_name].filter((x) => typeof x === 'string').join(' ');
  const name = (full.trim() || email?.split('@')[0] || 'Someone').slice(0, 60);
  return { name, ...(email ? { email: email.slice(0, 120) } : {}) };
}

/** Why someone in no mapped group is refused, in plain words. */
export function noGroup(c: Claims): string {
  const names = c._claim_names;
  if (isObj(names) && 'groups' in names) return 'Your account is in too many groups for the sign-in to list them. Ask your admin to send only the groups assigned to this app.';
  return 'Your work account is not in a group that may use this box. Ask your admin to add you to one.';
}

const b64json = (s: string) => {
  try {
    return JSON.parse(Buffer.from(s, 'base64url').toString('utf8'));
  } catch {
    throw new Error('the ID token is not readable');
  }
};

/** Check an ID token: RS256, signed by one of the provider's keys, for this app, from this issuer, not expired, made for this sign-in. */
export function verifyIdToken(jwt: unknown, o: { keys: JsonWebKey[]; issuer: string; clientId: string; nonce: string; now?: number }): Claims {
  const parts = typeof jwt === 'string' ? jwt.split('.') : [];
  if (parts.length !== 3) throw new Error('the provider sent no signed ID token');
  const [h, p, s] = parts;
  const header = b64json(h);
  if (header?.alg !== 'RS256') throw new Error(`the ID token is signed with ${String(header?.alg).slice(0, 10)}; only RS256 is accepted`);
  const keys = o.keys.filter((k) => k.kty === 'RSA' && (!header.kid || (k as { kid?: string }).kid === header.kid) && (!k.use || k.use === 'sig'));
  if (!keys.length) throw Object.assign(new Error('no key from the provider matches the ID token'), { unknownKey: true });
  const signed = keys.some((k) => {
    try {
      return verify('sha256', Buffer.from(`${h}.${p}`), createPublicKey({ key: { kty: 'RSA', n: k.n, e: k.e }, format: 'jwk' }), Buffer.from(s, 'base64url'));
    } catch {
      return false;
    }
  });
  if (!signed) throw new Error("the ID token's signature does not match the provider's keys");
  const c = b64json(p) as Claims;
  if (c.iss !== o.issuer) throw new Error('the ID token is from another issuer');
  const aud = Array.isArray(c.aud) ? c.aud : [c.aud];
  if (!aud.includes(o.clientId) || (aud.length > 1 && c.azp !== o.clientId)) throw new Error('the ID token is for another app');
  const now = (o.now ?? Date.now()) / 1000;
  if (typeof c.exp !== 'number' || c.exp < now - 60) throw new Error('the ID token has expired');
  if (typeof c.nbf === 'number' && c.nbf > now + 60) throw new Error('the ID token is not valid yet');
  if (!o.nonce || c.nonce !== o.nonce) throw new Error('the ID token was not made for this sign-in');
  if (typeof c.sub !== 'string' || !c.sub) throw new Error('the ID token names nobody');
  return c;
}

export const random = (bytes = 24) => randomBytes(bytes).toString('base64url');
export const challenge = (verifier: string) => createHash('sha256').update(verifier).digest('base64url');

/** The provider's endpoints and keys, from its discovery document, kept for an hour. */
export interface Provider {
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
  keys: JsonWebKey[];
  at: number;
}
const providers = new Map<string, Provider>();
const getJson = async (url: string) => {
  const r = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!r.ok) throw new Error(`the sign-in provider answered ${r.status} at ${new URL(url).host}`);
  return r.json();
};

export async function provider(issuer: string, fresh = false): Promise<Provider> {
  const had = providers.get(issuer);
  if (had && !fresh && Date.now() - had.at < 3_600_000) return had;
  const doc = await getJson(`${issuer.replace(/\/$/, '')}/.well-known/openid-configuration`);
  if (doc.issuer !== issuer) throw new Error(`the provider's discovery document names another issuer (${String(doc.issuer).slice(0, 100)})`);
  for (const k of ['authorization_endpoint', 'token_endpoint', 'jwks_uri']) if (!safeUrl(doc[k])) throw new Error(`the provider's ${k} is not an https address`);
  const { keys } = await getJson(doc.jwks_uri);
  const p = { authorization_endpoint: doc.authorization_endpoint, token_endpoint: doc.token_endpoint, jwks_uri: doc.jwks_uri, keys: Array.isArray(keys) ? keys : [], at: Date.now() };
  providers.set(issuer, p);
  return p;
}
