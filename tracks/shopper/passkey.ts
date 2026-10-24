// Approve with Face ID: the owner's phone signs an approval with a WebAuthn passkey, and the box checks the
// signature before it pays. A stolen pairing token can ask, but cannot sign. The challenge the phone signs is
// bound to exactly what is being approved, so a signature for "$13.00" never passes for "$130.00".
// passkeys.json holds public keys only.
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type RegistrationResponseJSON,
} from '@simplewebauthn/server';

export type Stored = { id: string; publicKey: string /* base64url COSE */; counter: number; rpId: string; device: string; createdAt: string; transports?: string[] };

const TTL_MS = 5 * 60_000;
const MAX_PENDING = 200; // a paired phone asking for options in a loop cannot grow memory without limit
const OWNER = new TextEncoder().encode('gurtos-owner'); // one user handle: the box has one owner
const ENROLL = 'enroll';

/** JSON with object keys sorted at every level, so the same payload always hashes the same. */
export function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map((x) => canonical(x ?? null)).join(',')}]`;
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o).filter((k) => o[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${canonical(o[k])}`).join(',')}}`;
  }
  return JSON.stringify(v) ?? 'null';
}

const digest = (purpose: string, subject: string, payload: unknown) => createHash('sha256').update(canonical({ purpose, subject, payload })).digest();
const same = (a: Buffer, b: Buffer) => a.length === b.length && timingSafeEqual(a, b);
const matches = (want: Buffer) => (got: string) => same(Buffer.from(got, 'base64url'), want);
const deviceName = (d: unknown) => String(d ?? '').replace(/\s+/g, ' ').trim().slice(0, 60) || 'This device';

/** A passkey works on https, or on plain http at localhost (a secure context). Never on an IP address: it cannot be a WebAuthn RP ID. */
export function usable(origin: string | null): boolean {
  if (!origin) return false;
  try {
    const u = new URL(origin);
    if (u.origin !== origin) return false; // a bare origin, no path
    if (/^\d+\.\d+\.\d+\.\d+$/.test(u.hostname) || u.hostname.startsWith('[')) return false;
    return u.protocol === 'https:' || (u.protocol === 'http:' && (u.hostname === 'localhost' || u.hostname.endsWith('.localhost')));
  } catch {
    return false;
  }
}

function rpOf(origin: string | null): string {
  if (!usable(origin)) throw new Error("Face ID works only on the box's HTTPS address or on localhost. Approve with a tap here.");
  return new URL(origin!).hostname;
}

/** Plain words for the library's errors. */
function why(e: unknown): Error {
  const m = (e as Error)?.message ?? String(e);
  if (/challenge/i.test(m)) return new Error('The signature is for a different request than this one. Nothing was approved.');
  if (/counter/i.test(m)) return new Error('This passkey looks like a copy (its counter went backwards). Nothing was approved.');
  if (/user verif/i.test(m)) return new Error('Face ID, Touch ID or a PIN is needed, and the device did not check it.');
  if (/origin|rp ?id/i.test(m)) return new Error('The signature was made on a different address than this one.');
  return new Error(`The passkey check failed: ${m}`);
}

type Pending = { challenge: Buffer; origin: string; expires: number; proved?: boolean };

export function passkeys(dir: string) {
  const file = path.join(dir, 'passkeys.json');
  const pending = new Map<string, Pending>();

  const list = (): Stored[] => {
    try {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw e;
    }
  };
  const save = (all: Stored[]) => {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    const tmp = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(all, null, 2), { mode: 0o600 });
    fs.renameSync(tmp, file);
  };

  const hold = (key: string, p: Omit<Pending, 'expires'>) => {
    const now = Date.now();
    for (const [k, v] of pending) if (v.expires < now) pending.delete(k);
    pending.delete(key); // one pending challenge per key: a new request replaces the old one
    while (pending.size >= MAX_PENDING) pending.delete(pending.keys().next().value!);
    pending.set(key, { ...p, expires: now + TTL_MS });
  };
  /** Single use: the challenge is gone once anyone tries it, pass or fail. */
  const take = (key: string, origin: string) => {
    const p = pending.get(key);
    pending.delete(key);
    if (!p || p.expires < Date.now()) throw new Error('This request expired or was already used. Try again.');
    if (p.origin !== origin) throw new Error('The signature was made on a different address than this one.');
    return p;
  };
  const sigKey = (purpose: string, subject: string) => `sig\0${purpose}\0${subject}`;

  async function verify(origin: string, purpose: string, subject: string, payload: unknown, response: unknown) {
    const rpId = rpOf(origin);
    const p = take(sigKey(purpose, subject), origin);
    // The challenge is rebuilt from the payload as it is now, so a changed amount or another approval fails.
    const want = Buffer.concat([p.challenge.subarray(0, 16), digest(purpose, subject, payload)]);
    const r = response as AuthenticationResponseJSON;
    if (!r || typeof r !== 'object' || typeof r.id !== 'string') throw new Error('No passkey signature was sent.');
    const cred = list().find((c) => c.id === r.id);
    if (!cred) throw new Error('This passkey is not set up on this box.');
    if (cred.rpId !== rpId) throw new Error('This passkey was set up on a different address than this one.');
    let v;
    try {
      v = await verifyAuthenticationResponse({
        response: r, expectedChallenge: matches(want), expectedOrigin: origin, expectedRPID: rpId, requireUserVerification: true,
        credential: { id: cred.id, publicKey: Buffer.from(cred.publicKey, 'base64url'), counter: cred.counter, transports: cred.transports },
      });
    } catch (e) {
      throw why(e);
    }
    if (!v.verified) throw new Error('The passkey signature did not check out. Nothing was approved.');
    const { newCounter, userVerified } = v.authenticationInfo;
    save(list().map((c) => (c.id === cred.id ? { ...c, counter: newCounter } : c))); // no await between read and write
    return { credentialId: cred.id, device: cred.device, rpId, userVerified };
  }

  return {
    list,
    usable,

    /** Start enrolling this device. Once any passkey exists (any address), another needs `proof`: a signature from an existing passkey for purpose 'enroll', subject = device, payload { device }. */
    async registerOptions(origin: string, device: string, proof?: unknown) {
      const rpId = rpOf(origin);
      const name = deviceName(device);
      const all = list();
      if (all.length) {
        if (!all.some((c) => c.rpId === rpId)) throw new Error('A passkey is already set up on another address. Add new ones from there.');
        if (!proof) throw new Error('A passkey is already set up. Confirm with it first to add another.');
        await verify(origin, ENROLL, name, { device: name }, proof);
      }
      const opts = await generateRegistrationOptions({
        rpName: 'GurtOS', rpID: rpId, userName: 'owner', userDisplayName: 'GurtOS owner', userID: OWNER, attestationType: 'none',
        excludeCredentials: all.filter((c) => c.rpId === rpId).map((c) => ({ id: c.id, transports: c.transports })),
        authenticatorSelection: { residentKey: 'preferred', userVerification: 'required' },
      });
      hold(`reg\0${name}`, { challenge: Buffer.from(opts.challenge, 'base64url'), origin, proved: all.length > 0 });
      return opts;
    },

    async register(origin: string, response: unknown, device: string): Promise<Stored> {
      const rpId = rpOf(origin);
      const name = deviceName(device);
      const p = take(`reg\0${name}`, origin);
      // Two first enrollments raced: only the first may skip the proof.
      if (list().length && !p.proved) throw new Error('Another passkey was set up first. Confirm with it to add this one.');
      let v;
      try {
        v = await verifyRegistrationResponse({
          response: response as RegistrationResponseJSON, expectedChallenge: matches(p.challenge), expectedOrigin: origin, expectedRPID: rpId,
          requireUserVerification: true,
        });
      } catch (e) {
        throw why(e);
      }
      if (!v.verified) throw new Error('The new passkey did not check out.');
      const { credential } = v.registrationInfo;
      const all = list();
      if (all.some((c) => c.id === credential.id)) throw new Error('This passkey is already set up.');
      const transports = credential.transports ?? (response as RegistrationResponseJSON).response?.transports;
      const stored: Stored = {
        id: credential.id, publicKey: Buffer.from(credential.publicKey).toString('base64url'), counter: credential.counter, rpId,
        device: name, createdAt: new Date().toISOString(), ...(transports?.length && { transports }),
      };
      save([...all, stored]);
      return stored;
    },

    /**
     * Options for signing purpose + subject + payload. One pending challenge per (purpose, subject), 5 minutes, single use.
     * For purpose 'enroll' the subject is the new device's name and this module sets the payload itself.
     */
    async options(origin: string, purpose: string, subject: string, payload: unknown) {
      const rpId = rpOf(origin);
      if (purpose === ENROLL) [subject, payload] = [deviceName(subject), { device: deviceName(subject) }];
      const mine = list().filter((c) => c.rpId === rpId);
      if (!mine.length) throw new Error('Face ID is not set up for this address yet.');
      const challenge = Buffer.concat([randomBytes(16), digest(purpose, subject, payload)]);
      hold(sigKey(purpose, subject), { challenge, origin });
      return generateAuthenticationOptions({
        rpID: rpId, challenge, userVerification: 'required', allowCredentials: mine.map((c) => ({ id: c.id, transports: c.transports })),
      });
    },

    verify,
  };
}
