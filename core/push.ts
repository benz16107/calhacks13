// Push notifications for approvals, to the GurtOS app on a phone.
// The app subscribes once (one origin, app.gurtos.com, one VAPID key that the relay's push gateway holds) and
// gives each box it pairs with that subscription plus a key of its own for this box. The box encrypts every push
// for the phone itself (RFC 8291), so the gateway signs and forwards bytes it cannot read. The box also signs the
// message with its key for that phone (`mac`), so another box sharing the subscription can't pass as this one.
import { createCipheriv, createECDH, createHmac, randomBytes } from 'node:crypto';
import type { Approval } from './contract.ts';

/** What a phone gave this box: its push subscription, and the key it made for this box. */
export interface PushSub {
  endpoint: string;
  p256dh: string;
  auth: string;
  key: string;
  at: string;
}

/** Check a subscription from `PUT /api/push`. Throws a message that names the field. */
export function parseSub(body: any): PushSub {
  const s = body?.subscription;
  const b = (v: unknown) => (typeof v === 'string' && /^[A-Za-z0-9_-]+={0,2}$/.test(v) ? Buffer.from(v, 'base64url') : Buffer.alloc(0));
  let url: URL | undefined;
  try {
    url = new URL(s?.endpoint);
  } catch {}
  if (!url || url.protocol !== 'https:' || String(s.endpoint).length > 1024) throw new Error('subscription.endpoint: the https URL from pushManager.subscribe()');
  const p = b(s.keys?.p256dh);
  if (p.length !== 65 || p[0] !== 4) throw new Error('subscription.keys.p256dh: the subscription\'s P-256 key, base64url');
  if (b(s.keys?.auth).length !== 16) throw new Error('subscription.keys.auth: the subscription\'s 16-byte auth secret, base64url');
  if (b(body.key).length !== 32) throw new Error('key: 32 random bytes, base64url, made by the app for this box');
  return { endpoint: s.endpoint, p256dh: s.keys.p256dh, auth: s.keys.auth, key: body.key, at: new Date().toISOString() };
}

const hmac = (key: Buffer, data: Buffer | string) => createHmac('sha256', key).update(data).digest();

/**
 * RFC 8291 "aes128gcm" Web Push encryption: one record, for one subscription. `test` fixes the box's ephemeral key
 * and the salt, only to check against the RFC's own example.
 */
export function encrypt(p256dh: string, auth: string, plaintext: Buffer, test?: { asPrivate: string; salt: string }): Buffer {
  const ua = Buffer.from(p256dh, 'base64url');
  const secret = Buffer.from(auth, 'base64url');
  const ecdh = createECDH('prime256v1');
  if (test) ecdh.setPrivateKey(Buffer.from(test.asPrivate, 'base64url'));
  else ecdh.generateKeys();
  const asPublic = ecdh.getPublicKey();
  const salt = test ? Buffer.from(test.salt, 'base64url') : randomBytes(16);
  const prkKey = hmac(secret, ecdh.computeSecret(ua));
  const ikm = hmac(prkKey, Buffer.concat([Buffer.from('WebPush: info\0'), ua, asPublic, Buffer.from([1])]));
  const prk = hmac(salt, ikm);
  const cek = hmac(prk, Buffer.from('Content-Encoding: aes128gcm\0\x01')).subarray(0, 16);
  const nonce = hmac(prk, Buffer.from('Content-Encoding: nonce\0\x01')).subarray(0, 12);
  const c = createCipheriv('aes-128-gcm', cek, nonce);
  const sealed = Buffer.concat([c.update(Buffer.concat([plaintext, Buffer.from([2])])), c.final(), c.getAuthTag()]); // 2: the last record, no padding
  const header = Buffer.alloc(21);
  salt.copy(header);
  header.writeUInt32BE(4096, 16);
  header[20] = asPublic.length;
  return Buffer.concat([header, asPublic, sealed]);
}

/** The JSON the phone's service worker gets: the fields, plus `mac` over them (keys sorted) with this box's key. */
export function message(fields: Record<string, string | number>, key: string): string {
  const sorted = Object.fromEntries(Object.entries(fields).sort(([a], [b]) => (a < b ? -1 : 1)));
  const mac = hmac(Buffer.from(key, 'base64url'), JSON.stringify(sorted)).toString('base64url');
  return JSON.stringify({ ...sorted, mac });
}

interface PushDevice { id: string; owner?: boolean; person?: string; revoked?: boolean; push?: PushSub }

/**
 * Who hears about an approval: on GurtOS Business, the people its route names (never the person who asked);
 * on Server and Personal, the owner's phones. Only phones that turned notifications on.
 */
export function recipients<D extends PushDevice>(a: Approval & { route?: { people?: { id: string }[] }; askedBy?: string }, devices: D[]): D[] {
  const people = a.route?.people?.map((p) => p.id);
  return devices.filter((d) => d.push && !d.revoked && (people ? !!d.person && people.includes(d.person) && d.person !== a.askedBy : d.owner));
}

/** Inside the owner's quiet hours, in the box's time zone. `from` 22:00 and `to` 07:00 spans midnight. */
export function quiet(q: { enabled: boolean; from: string; to: string } | undefined, timeZone: string, now = new Date()): boolean {
  if (!q?.enabled) return false;
  const hm = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone }).format(now);
  return q.from <= q.to ? hm >= q.from && hm < q.to : hm >= q.from || hm < q.to;
}

/** Send one push through the relay's gateway. Resolves `{gone: true}` when the phone dropped the subscription. */
export async function send(gateway: string, name: string, secret: string, sub: PushSub, fields: Record<string, string | number>, topic: string): Promise<{ status: number; gone: boolean }> {
  const payload = encrypt(sub.p256dh, sub.auth, Buffer.from(message(fields, sub.key)));
  const r = await fetch(`${gateway}/v1/push`, {
    method: 'POST',
    headers: { authorization: `Bearer ${name}.${secret}`, 'content-type': 'application/json' },
    body: JSON.stringify({ endpoint: sub.endpoint, payload: payload.toString('base64url'), ttl: 12 * 3600, urgency: 'high', topic }),
    signal: AbortSignal.timeout(20_000),
  });
  const out = (await r.json().catch(() => ({}))) as { status?: number; gone?: boolean; error?: string };
  if (!r.ok) throw new Error(`push gateway: ${out.error ?? r.status}`);
  if (out.status && out.status >= 300 && !out.gone) throw new Error(`push service answered ${out.status}: ${out.error ?? ''}`);
  return { status: out.status ?? 0, gone: !!out.gone };
}

/** One line for the notification: the amount and who gets it when it is money, else the agent's question. */
export function approvalText(a: Approval, taskTitle: string): { title: string; body: string } {
  const money = a.costCents > 0 ? `$${(a.costCents / 100).toFixed(2)}${a.payee ? ` to ${a.payee}` : ''}` : '';
  return { title: (money ? `Approve ${money}?` : taskTitle || 'A task needs your OK').slice(0, 80), body: (money ? `${taskTitle}: ${a.purpose ?? a.question}` : a.question).slice(0, 200) };
}
