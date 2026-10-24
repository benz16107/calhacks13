// A small software authenticator: a P-256 key that stands in for Face ID in the tests and the demo step.
// It is never used by the box itself.
import { createHash, generateKeyPairSync, randomBytes, sign, type KeyObject } from 'node:crypto';
import { isoCBOR } from '@simplewebauthn/server/helpers';

const b64 = (b: Uint8Array) => Buffer.from(b).toString('base64url');
const sha = (b: Uint8Array | string) => createHash('sha256').update(b).digest();
const u32 = (n: number) => { const b = Buffer.alloc(4); b.writeUInt32BE(n); return b; };

export class Authenticator {
  key: KeyObject; pub: KeyObject; id = randomBytes(16); counter: number; uv = true;
  constructor(counter = 0) {
    ({ privateKey: this.key, publicKey: this.pub } = generateKeyPairSync('ec', { namedCurve: 'P-256' }));
    this.counter = counter;
  }
  cose() {
    const j = this.pub.export({ format: 'jwk' });
    return isoCBOR.encode(new Map<number, number | Uint8Array>([[1, 2], [3, -7], [-1, 1], [-2, Buffer.from(j.x!, 'base64url')], [-3, Buffer.from(j.y!, 'base64url')]]));
  }
  flags(at = false) { return Buffer.from([0x01 | (this.uv ? 0x04 : 0) | (at ? 0x40 : 0)]); }
  create(opts: any, origin: string) {
    const clientDataJSON = Buffer.from(JSON.stringify({ type: 'webauthn.create', challenge: opts.challenge, origin, crossOrigin: false }));
    const authData = Buffer.concat([sha(opts.rp.id), this.flags(true), u32(this.counter), Buffer.alloc(16), Buffer.from([0, this.id.length]), this.id, this.cose()]);
    const attestationObject = isoCBOR.encode(new Map<string, unknown>([['fmt', 'none'], ['attStmt', new Map()], ['authData', authData]]) as any);
    return { id: b64(this.id), rawId: b64(this.id), type: 'public-key', clientExtensionResults: {}, response: { clientDataJSON: b64(clientDataJSON), attestationObject: b64(attestationObject), transports: ['internal'] } };
  }
  get(opts: any, origin: string, rpId = opts.rpId) {
    if (this.counter) this.counter++;
    const clientDataJSON = Buffer.from(JSON.stringify({ type: 'webauthn.get', challenge: opts.challenge, origin, crossOrigin: false }));
    const authData = Buffer.concat([sha(rpId), this.flags(), u32(this.counter)]);
    const signature = sign('sha256', Buffer.concat([authData, sha(clientDataJSON)]), this.key);
    return { id: b64(this.id), rawId: b64(this.id), type: 'public-key', clientExtensionResults: {}, response: { clientDataJSON: b64(clientDataJSON), authenticatorData: b64(authData), signature: b64(signature) } };
  }
}

