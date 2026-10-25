// Quick Start's phone side of core/quickstart.ts: a one-time X25519 key, and opening what the new computer sealed to it
// (X25519, then HKDF-SHA256 with the QR's secret as salt, then AES-256-GCM with the tag at the end). WebCrypto only,
// so the same file runs in the browser and in portal/demo.ts.
const INFO = new TextEncoder().encode('gurtos quickstart v1');

export const b64u = (b: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
export const unb64u = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4)), (c) => c.charCodeAt(0));

/** This phone's one-time key pair; `pk` is the raw public key in base64url (43 characters), as core expects. */
export async function phoneKey() {
  const k = (await crypto.subtle.generateKey({ name: 'X25519' }, true, ['deriveBits'])) as CryptoKeyPair;
  return { privateKey: k.privateKey, pk: b64u(await crypto.subtle.exportKey('raw', k.publicKey)) };
}

export interface Sealed {
  v: number;
  eph: string;
  iv: string;
  ct: string;
}

/** Open the new computer's answer with this phone's private key and the QR's secret. Throws if anything was changed. */
export async function openSealed<T>(privateKey: CryptoKey, s: string, b: Sealed): Promise<T> {
  if (b?.v !== 1) throw new Error('That was not a Quick Start answer.');
  const eph = await crypto.subtle.importKey('raw', unb64u(b.eph), { name: 'X25519' }, false, []);
  const shared = await crypto.subtle.deriveBits({ name: 'X25519', public: eph } as EcdhKeyDeriveParams, privateKey, 256);
  const hkdf = await crypto.subtle.importKey('raw', shared, 'HKDF', false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt: unb64u(s), info: INFO }, hkdf, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64u(b.iv) }, key, unb64u(b.ct));
  return JSON.parse(new TextDecoder().decode(plain)) as T;
}
