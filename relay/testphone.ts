// A stand-in phone for tests: a real Web Push subscription at Mozilla's push service, made without a browser by
// speaking its WebSocket protocol (the one Firefox uses). It decrypts what arrives with its own keys, so a test can
// prove a push left the box, passed the relay's gateway and the push service, and only the phone could read it.
import { createDecipheriv, createECDH, createHmac, randomBytes, randomUUID } from 'node:crypto';

const PUSH = 'wss://push.services.mozilla.com/';

/** RFC 8291 decryption: what a browser does with an aes128gcm push. */
export function decrypt(body: Buffer, uaPrivate: Buffer, auth: Buffer): string {
  const ua = createECDH('prime256v1');
  ua.setPrivateKey(uaPrivate);
  const salt = body.subarray(0, 16);
  const idlen = body[20];
  const asPublic = body.subarray(21, 21 + idlen);
  const h = (k: Buffer, d: Buffer | string) => createHmac('sha256', k).update(d).digest();
  const prk = h(salt, h(h(auth, ua.computeSecret(asPublic)), Buffer.concat([Buffer.from('WebPush: info\0'), ua.getPublicKey(), asPublic, Buffer.from([1])])));
  const d = createDecipheriv('aes-128-gcm', h(prk, 'Content-Encoding: aes128gcm\0\x01').subarray(0, 16), h(prk, 'Content-Encoding: nonce\0\x01').subarray(0, 12));
  const sealed = body.subarray(21 + idlen);
  d.setAuthTag(sealed.subarray(-16));
  const plain = Buffer.concat([d.update(sealed.subarray(0, -16)), d.final()]);
  return plain.subarray(0, plain.lastIndexOf(2)).toString();
}

export interface TestPhone {
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } };
  /** The next push, decrypted. */
  next(ms?: number): Promise<string>;
  close(): void;
}

/** Subscribe at Mozilla's push service with the app's VAPID public key (base64url). */
export async function testPhone(vapidKey: string): Promise<TestPhone> {
  const keys = createECDH('prime256v1');
  keys.generateKeys();
  const auth = randomBytes(16);
  // No subprotocol: the service accepts the upgrade without echoing one, and a client that asked for one must refuse that.
  const ws = new WebSocket(PUSH);
  const inbox: string[] = [];
  const waiting: ((s: string) => void)[] = [];
  let registered: (endpoint: string) => void;
  let failed: (e: Error) => void;
  const endpoint = new Promise<string>((res, rej) => ((registered = res), (failed = rej)));
  const channelID = randomUUID();
  ws.onerror = () => failed(new Error(`can't reach ${PUSH}`));
  ws.onopen = () => ws.send(JSON.stringify({ messageType: 'hello', use_webpush: true, uaid: '' }));
  ws.onmessage = (ev) => {
    const m = JSON.parse(String(ev.data));
    if (m.messageType === 'hello') ws.send(JSON.stringify({ messageType: 'register', channelID, key: vapidKey }));
    else if (m.messageType === 'register') m.status === 200 ? registered(m.pushEndpoint) : failed(new Error(`push service: register ${m.status}`));
    else if (m.messageType === 'notification') {
      ws.send(JSON.stringify({ messageType: 'ack', updates: [{ channelID: m.channelID, version: m.version }] }));
      const text = decrypt(Buffer.from(m.data, 'base64url'), keys.getPrivateKey(), auth);
      const w = waiting.shift();
      w ? w(text) : inbox.push(text);
    } else if (m.messageType === 'ping') ws.send('{}');
  };
  const url = await Promise.race([endpoint, new Promise<never>((_, rej) => setTimeout(() => rej(new Error('push service: no answer in 15 s')), 15_000))]);
  return {
    subscription: { endpoint: url, keys: { p256dh: keys.getPublicKey().toString('base64url'), auth: auth.toString('base64url') } },
    next: (ms = 30_000) =>
      inbox.length
        ? Promise.resolve(inbox.shift()!)
        : new Promise<string>((resolve, reject) => {
            const take = (s: string) => (clearTimeout(timer), resolve(s));
            const timer = setTimeout(() => (waiting.splice(waiting.indexOf(take), 1), reject(new Error(`no push arrived in ${ms / 1000} s`))), ms);
            waiting.push(take); // a wait that timed out takes itself off the list, so it can't swallow a later push
          }),
    close: () => ws.close(),
  };
}
