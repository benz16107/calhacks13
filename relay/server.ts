// The GurtOS relay. One small service beside frps on the relay machine:
//   - names: a box enrolls a name (rosa -> rosa.box.gurtos.com) and gets a secret only it holds
//   - the frps plugin: frps asks it before a box logs in or opens a route, and it checks that box's secret
//   - the push gateway: a box hands it a push it already encrypted for the phone; the gateway signs it with the
//     app's VAPID key and forwards it to the phone's push service, or to APNs for the native Apple apps. It never
//     sees what the push says.
// It never terminates a box's TLS: frps routes those connections by SNI, as bytes.
//   node --experimental-strip-types relay/server.ts
// Env: RELAY_STATE (default /var/lib/gurtos-relay), RELAY_DOMAIN (default box.gurtos.com),
//      RELAY_PLUGIN_PORT (7400), RELAY_API_PORT (7401), RELAY_TUNNEL_PORT (7000, announced to boxes).
import { createHash, createHmac, generateKeyPairSync, createPrivateKey, randomBytes, sign, timingSafeEqual, type KeyObject } from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import http2 from 'node:http2';
import path from 'node:path';

export const DOMAIN = process.env.RELAY_DOMAIN ?? 'box.gurtos.com';
const STATE = process.env.RELAY_STATE ?? '/var/lib/gurtos-relay';
const TUNNEL_PORT = Number(process.env.RELAY_TUNNEL_PORT ?? 7000);
/** A name nobody has logged in with for this long is free again (a box that was wiped never released it). */
const EXPIRE_MS = 30 * 24 * 3600 * 1000;

// ---------- names ----------

/** Names a box may not take: our own services, and words that would make a box look official. */
export const RESERVED = new Set(
  ('www app api relay box boxes admin administrator root mail email smtp imap pop ftp ssh vpn dns ns ns1 ns2 mx ' +
    'calhacks docs doc help support status push tunnel gateway login signin signup auth oauth account accounts ' +
    'security secure billing pay payments wallet gurtos gurt official test demo localhost cdn static assets blog ' +
    'news dev staging prod beta alpha abuse postmaster hostmaster webmaster info autoconfig autodiscover wpad ' +
    'isatap server personal business portal update updates download downloads release releases owner').split(' '),
);

/** Why a name can't be used, or undefined when it is well formed. Taken or not is checked separately. */
export function nameProblem(name: unknown): string | undefined {
  if (typeof name !== 'string' || !name) return 'choose a name';
  if (name.length < 3) return 'use at least 3 characters';
  if (name.length > 30) return 'use at most 30 characters';
  if (!/^[a-z0-9-]+$/.test(name)) return 'use only lowercase letters, digits and hyphens';
  if (name.startsWith('-') || name.endsWith('-')) return "a name can't start or end with a hyphen";
  if (name.includes('--')) return "a name can't have two hyphens in a row"; // also blocks xn-- look-alike names
  if (RESERVED.has(name)) return 'that name is reserved';
  return undefined;
}

interface Entry { hash: string; createdAt: number; lastSeen: number }

export class Names {
  file: string;
  all: Record<string, Entry>;
  constructor(dir: string) {
    this.file = path.join(dir, 'names.json');
    this.all = fs.existsSync(this.file) ? JSON.parse(fs.readFileSync(this.file, 'utf8')) : {};
  }
  save() {
    const tmp = this.file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(this.all, null, 1), { mode: 0o600 });
    fs.renameSync(tmp, this.file);
  }
  /** Taken, and not expired. */
  taken(name: string, now = Date.now()) {
    const e = this.all[name];
    return !!e && now - e.lastSeen < EXPIRE_MS;
  }
  enroll(name: string, now = Date.now()) {
    const secret = randomBytes(32).toString('base64url');
    this.all[name] = { hash: sha256(secret), createdAt: now, lastSeen: now };
    this.save();
    return secret;
  }
  /** The secret is this name's. Constant-time. */
  check(name: unknown, secret: unknown): boolean {
    if (typeof name !== 'string' || typeof secret !== 'string' || !Object.hasOwn(this.all, name)) return false;
    const a = Buffer.from(this.all[name].hash, 'hex');
    const b = Buffer.from(sha256(secret), 'hex');
    return timingSafeEqual(a, b);
  }
  seen(name: string, now = Date.now()) {
    const e = this.all[name];
    if (e && now - e.lastSeen > 3600_000) (e.lastSeen = now), this.save(); // at most one write an hour per box
  }
  release(name: string) {
    delete this.all[name];
    this.save();
  }
}

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

// ---------- rate limits ----------

/** Sliding-window counter: at most `max` hits per `windowMs` for each key. */
export class Limit {
  hits = new Map<string, number[]>();
  max: number;
  windowMs: number;
  constructor(max: number, windowMs: number) {
    this.max = max;
    this.windowMs = windowMs;
  }
  ok(key: string, now = Date.now()) {
    const list = (this.hits.get(key) ?? []).filter((t) => now - t < this.windowMs);
    if (list.length >= this.max) return this.hits.set(key, list), false;
    list.push(now);
    this.hits.set(key, list);
    if (this.hits.size > 50_000) this.hits.clear(); // shortcut: a flood of distinct keys resets every window, fine for one small relay
    return true;
  }
}

// ---------- the frps plugin ----------

/** The relay's own frpc, which publishes this API at DOMAIN, logs in as this user with the secret in self.secret. */
export const SELF = 'relay';

type PluginAnswer = { reject: true; reject_reason: string } | { reject: false; unchange: true } | { reject: false; unchange: false; content: unknown };

/**
 * frps asks before a client logs in, opens a route, and on every heartbeat. A box may log in only as its own name
 * with its own secret, and may open only an https (SNI, passthrough) or http (for its certificate's HTTP-01
 * challenge) route for its own name. Nothing else: no TCP ports, no other domains.
 */
export function plugin(op: string, content: any, names: Names, selfSecret: string, logins = new Limit(30, 60_000)): PluginAnswer {
  const no = (why: string): PluginAnswer => ({ reject: true, reject_reason: why });
  const user = op === 'Login' ? content?.user : content?.user?.user;
  const secret = op === 'Login' ? content?.metas?.secret : content?.user?.metas?.secret;
  const self = user === SELF && typeof secret === 'string' && secret.length > 20 && safeEqual(secret, selfSecret);
  if (!self && !names.check(user, secret)) return no('unknown box or wrong secret');
  if (op === 'Login') {
    if (!logins.ok(String(user))) return no('too many logins; wait a minute');
    if (!self) names.seen(user);
    return { reject: false, unchange: true };
  }
  if (op === 'Ping') {
    // The check above runs again, so a released name is cut off. A heartbeat is use too: a box that stays connected
    // for a month never logs in again, and its name must not expire under it for someone else to claim.
    if (!self) names.seen(user);
    return { reject: false, unchange: true };
  }
  if (op === 'NewProxy') {
    const type = content.proxy_type;
    if (type !== 'https' && type !== 'http') return no('only https and http routes');
    const domains: string[] = content.custom_domains ?? [];
    if (self) {
      if (content.subdomain || domains.length !== 1 || domains[0] !== DOMAIN) return no(`the relay publishes only ${DOMAIN}`);
      return { reject: false, unchange: true };
    }
    if (content.subdomain || domains.length !== 1 || domains[0] !== `${user}.${DOMAIN}`) return no(`a box may only route ${user}.${DOMAIN}`);
    // The relay sets the bandwidth limit, not the box: 4 MB/s per route, enforced here on the relay.
    return { reject: false, unchange: false, content: { ...content, bandwidth_limit: '4MB', bandwidth_limit_mode: 'server' } };
  }
  return { reject: false, unchange: true };
}

const safeEqual = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

// ---------- the push gateway ----------

/** Push services a phone's subscription can point at. The gateway sends nowhere else. */
export const PUSH_HOSTS = [/^fcm\.googleapis\.com$/, /^([a-z0-9-]+\.)*push\.apple\.com$/, /^updates\.push\.services\.mozilla\.com$/, /^([a-z0-9-]+\.)*notify\.windows\.com$/];

export function pushTargetProblem(endpoint: unknown, extra: RegExp[] = []): string | undefined {
  let u: URL;
  try {
    u = new URL(String(endpoint));
  } catch {
    return 'endpoint: a push subscription endpoint URL';
  }
  const testHost = extra.some((r) => r.test(u.host));
  if (u.protocol !== 'https:' && !testHost) return 'endpoint: must be https';
  if (!testHost && !PUSH_HOSTS.some((r) => r.test(u.hostname))) return `endpoint: ${u.hostname} is not a known push service`;
  return undefined;
}

export interface Vapid { publicKey: string; privateKey: KeyObject }

/** The app's VAPID key pair: made once, kept in the state folder (root only). */
export function loadVapid(dir: string): Vapid {
  const file = path.join(dir, 'vapid.pem');
  if (!fs.existsSync(file)) {
    const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
    fs.writeFileSync(file, privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 });
  }
  const privateKey = createPrivateKey(fs.readFileSync(file));
  const jwk = privateKey.export({ format: 'jwk' }) as { x: string; y: string };
  const publicKey = Buffer.concat([Buffer.from([4]), Buffer.from(jwk.x, 'base64url'), Buffer.from(jwk.y, 'base64url')]).toString('base64url');
  return { publicKey, privateKey };
}

/** RFC 8292: a JWT for one push service (`aud`), signed ES256 with the app's key. */
export function vapidHeader(vapid: Vapid, endpoint: string, now = Date.now()) {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const unsigned = `${b64({ typ: 'JWT', alg: 'ES256' })}.${b64({ aud: new URL(endpoint).origin, exp: Math.floor(now / 1000) + 12 * 3600, sub: 'https://gurtos.com' })}`;
  const sig = sign('sha256', Buffer.from(unsigned), { key: vapid.privateKey, dsaEncoding: 'ieee-p1363' }).toString('base64url');
  return `vapid t=${unsigned}.${sig}, k=${vapid.publicKey}`;
}

/** Topic must be at most 32 URL-safe base64 characters. */
const topicOf = (t: unknown) => (typeof t === 'string' && t ? createHmac('sha256', 'topic').update(t).digest('base64url').slice(0, 32) : undefined);

// ---------- APNs, for the native apps ----------
// The native iPhone and Mac apps can't use web push, so they subscribe with an address on this relay:
// https://<DOMAIN>/v1/apns/<app>/<production|sandbox>/<device token>. The box encrypts for them exactly as for a
// browser (RFC 8291); the relay sends Apple only that ciphertext, in `e`, with a generic alert. The app's
// notification service extension decrypts it and checks the box's mac before showing anything.

/** The only apps the relay sends to: the GurtOS iPhone app and the Mac app. */
export const APNS_TOPICS = ['com.benzhou.gurtos', 'com.benzhou.gurtos.mac'];

export function apnsTarget(endpoint: unknown): { topic: string; sandbox: boolean; token: string } | undefined {
  let u: URL;
  try {
    u = new URL(String(endpoint));
  } catch {
    return undefined;
  }
  const m = u.protocol === 'https:' && u.hostname === DOMAIN && !u.port && !u.search ? u.pathname.match(/^\/v1\/apns\/([a-z0-9.]+)\/(production|sandbox)\/([0-9a-f]{64,200})$/) : null;
  return m && APNS_TOPICS.includes(m[1]) ? { topic: m[1], sandbox: m[2] === 'sandbox', token: m[3] } : undefined;
}

/** Ben's APNs key: `apns.p8` and `apns.json` ({keyId, teamId}) in the state folder, readable by the relay only. */
export interface Apns { keyId: string; teamId: string; key: KeyObject; jwt?: { token: string; at: number } }

export function loadApns(dir: string): Apns | undefined {
  const keyFile = path.join(dir, 'apns.p8');
  const idFile = path.join(dir, 'apns.json');
  if (!fs.existsSync(keyFile) || !fs.existsSync(idFile)) return undefined;
  try {
    const { keyId, teamId } = JSON.parse(fs.readFileSync(idFile, 'utf8'));
    if (typeof keyId !== 'string' || typeof teamId !== 'string') throw new Error('apns.json needs keyId and teamId');
    return { keyId, teamId, key: createPrivateKey(fs.readFileSync(keyFile)) };
  } catch (e) {
    console.error(`APNs is off: ${(e as Error).message}`); // a bad key file must not stop the tunnels and names
    return undefined;
  }
}

/** Apple's provider token: ES256 over {iss: team, iat}, reused for 50 minutes (Apple refuses one older than an hour). */
export function apnsJwt(a: Apns, now = Date.now()): string {
  if (a.jwt && now - a.jwt.at < 50 * 60_000) return a.jwt.token;
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const unsigned = `${b64({ alg: 'ES256', kid: a.keyId })}.${b64({ iss: a.teamId, iat: Math.floor(now / 1000) })}`;
  const token = `${unsigned}.${sign('sha256', Buffer.from(unsigned), { key: a.key, dsaEncoding: 'ieee-p1363' }).toString('base64url')}`;
  a.jwt = { token, at: now };
  return token;
}

export type ApnsSend = (host: string, path: string, headers: Record<string, string>, body: string) => Promise<{ status: number; body: string }>;

/** One request to APNs over HTTP/2. */
export const apnsHttp2: ApnsSend = (host, p, headers, body) =>
  new Promise((resolve, reject) => {
    const c = http2.connect(`https://${host}`);
    c.on('error', reject);
    const req = c.request({ ':method': 'POST', ':path': p, ...headers });
    let status = 0;
    let out = '';
    req.setTimeout(15_000, () => req.close(http2.constants.NGHTTP2_CANCEL));
    req.on('response', (h) => (status = Number(h[':status'])));
    req.on('data', (d) => (out += d));
    req.on('end', () => (c.close(), resolve({ status, body: out })));
    req.on('error', (e) => (c.close(), reject(e)));
    req.end(body);
  });

// ---------- the API ----------

export interface Relay {
  names: Names;
  vapid: Vapid;
  selfSecret: string;
  /** The PEM of the CA that signed the tunnel port's certificate. Boxes fetch it over HTTPS and pin it. */
  tunnelCa: string;
  /** Extra push hosts, for tests (a local fake push service). */
  testPushHosts?: RegExp[];
  /** Absent until Ben's APNs key is installed: then APNs addresses get a 503. */
  apns?: Apns;
  /** How APNs is called; tests swap in a fake. */
  apnsSend?: ApnsSend;
  rv?: Rendezvous;
}

export function load(dir = STATE): Relay {
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const selfFile = path.join(dir, 'self.secret');
  if (!fs.existsSync(selfFile)) fs.writeFileSync(selfFile, randomBytes(32).toString('base64url'), { mode: 0o600 });
  const caFile = path.join(dir, 'tunnel-ca.pem');
  return { names: new Names(dir), vapid: loadVapid(dir), selfSecret: fs.readFileSync(selfFile, 'utf8').trim(), tunnelCa: fs.existsSync(caFile) ? fs.readFileSync(caFile, 'utf8') : '', apns: loadApns(dir) };
}

// ---------- rendezvous ----------
// A short-lived drop box two devices use to find each other across networks before either can reach the other:
// a phone pairing with a box that has no address yet, or a new computer being set up from one you own. The id is a
// random capability shown only on the box's screen (in its QR code). Each slot is written once and lives 10 minutes.
// The relay never sees a pairing code: codes stay in the URL fragment, and anything secret is encrypted by the
// devices themselves. The `host` slot can only be written by the enrolled box whose address it names.

interface Drop { at: number; slots: Map<string, unknown>; waiting: Map<string, ((v: unknown) => void)[]> }
const RV_TTL = 10 * 60_000;

export class Rendezvous {
  drops = new Map<string, Drop>();
  get(id: string, now = Date.now()) {
    for (const [k, d] of this.drops) if (now - d.at > RV_TTL) this.drops.delete(k); // shortcut: a sweep per call, fine at hackathon volume
    let d = this.drops.get(id);
    if (!d && this.drops.size < 10_000) this.drops.set(id, (d = { at: now, slots: new Map(), waiting: new Map() }));
    return d;
  }
  /** Write once. False if the slot already holds something. */
  put(id: string, slot: string, value: unknown) {
    const d = this.get(id);
    if (!d || d.slots.has(slot)) return false;
    d.slots.set(slot, value);
    for (const w of d.waiting.get(slot) ?? []) w(value);
    d.waiting.delete(slot);
    return true;
  }
  /** The slot's value, waiting up to `ms` for it to be written. */
  read(id: string, slot: string, ms: number): Promise<unknown> {
    const d = this.get(id);
    if (!d || d.slots.has(slot) || ms <= 0) return Promise.resolve(d?.slots.get(slot));
    return new Promise((resolve) => {
      const list = d.waiting.get(slot) ?? [];
      const done = (v: unknown) => (clearTimeout(t), resolve(v));
      const t = setTimeout(() => (list.splice(list.indexOf(done), 1), resolve(undefined)), ms);
      list.push(done);
      d.waiting.set(slot, list);
    });
  }
}

const limits = { rvPut: new Limit(30, 60_000), rvGet: new Limit(240, 60_000), enroll: new Limit(20, 3600_000), enrollAll: new Limit(200, 3600_000), check: new Limit(60, 60_000), push: new Limit(600, 3600_000), bad: new Limit(20, 600_000), logins: new Limit(30, 60_000) };

type Answer = { status: number; body: unknown };

/** One API request. `ip` is the caller's address (Caddy on the relay puts it in X-Forwarded-For). */
export async function api(r: Relay, method: string, url: URL, body: any, auth: string | undefined, ip: string, send = fetch): Promise<Answer> {
  const ok = (b: unknown): Answer => ({ status: 200, body: b });
  const err = (status: number, error: string): Answer => ({ status, body: { error } });
  const p = url.pathname;
  const named = p.match(/^\/v1\/names\/([^/]+)$/)?.[1];
  const drop = p.match(/^\/v1\/rv\/([A-Za-z0-9_-]{22,64})\/([a-z0-9-]{1,32})$/);

  if (method === 'GET' && p === '/v1/tunnel') return ok({ host: DOMAIN, port: TUNNEL_PORT, serverName: DOMAIN, ca: r.tunnelCa });
  if (method === 'GET' && p === '/v1/push/key') return ok({ publicKey: r.vapid.publicKey });
  if (method === 'GET' && p === '/v1/status') return ok({ ok: true, domain: DOMAIN, boxes: Object.keys(r.names.all).length });

  if (method === 'GET' && named) {
    if (!limits.check.ok(ip)) return err(429, 'too many checks; wait a minute');
    const problem = nameProblem(named);
    return ok({ name: named, available: !problem && !r.names.taken(named), ...(problem ? { reason: problem } : r.names.taken(named) ? { reason: 'that name is taken' } : {}) });
  }

  if (method === 'POST' && p === '/v1/names') {
    const name = body?.name;
    const problem = nameProblem(name);
    if (problem) return err(400, `name: ${problem}`);
    if (r.names.taken(name)) return err(409, 'name: that name is taken');
    if (!limits.enroll.ok(ip) || !limits.enrollAll.ok('all')) return err(429, 'too many new names from here; try again in an hour');
    const secret = r.names.enroll(name);
    return ok({ name, host: `${name}.${DOMAIN}`, secret, tunnel: { host: DOMAIN, port: TUNNEL_PORT, serverName: DOMAIN, ca: r.tunnelCa } });
  }

  // Everything below is a box acting with its secret: `Authorization: Bearer <name>.<secret>`.
  const [who, secret] = (auth ?? '').replace(/^Bearer /i, '').split('.', 2);
  const isBox = () => r.names.check(who, secret);

  if (method === 'DELETE' && named) {
    if (!limits.bad.ok(ip) && !isBox()) return err(429, 'too many tries');
    if (who !== named || !isBox()) return err(403, 'only the box that holds this name can release it');
    r.names.release(named);
    return ok({ name: named, released: true });
  }

  if (method === 'POST' && p === '/v1/push') {
    if (!isBox()) return limits.bad.ok(ip), err(403, 'a push needs the box name and its secret');
    if (!limits.push.ok(who)) return err(429, 'too many pushes from this box this hour');
    const apple = apnsTarget(body?.endpoint);
    if (apple) return apnsPush(r, apple, body);
    const problem = pushTargetProblem(body?.endpoint, r.testPushHosts);
    if (problem) return err(400, problem);
    const payload = typeof body.payload === 'string' ? Buffer.from(body.payload, 'base64url') : undefined;
    if (!payload || payload.length < 86 || payload.length > 4096) return err(400, 'payload: the encrypted push body (aes128gcm), base64url, at most 4096 bytes');
    const ttl = Math.max(0, Math.min(Number(body.ttl ?? 86400) | 0, 7 * 86400));
    const urgency = ['very-low', 'low', 'normal', 'high'].includes(body.urgency) ? body.urgency : 'normal';
    const topic = topicOf(body.topic);
    const res = await send(body.endpoint, {
      method: 'POST',
      headers: { authorization: vapidHeader(r.vapid, body.endpoint), 'content-encoding': 'aes128gcm', 'content-type': 'application/octet-stream', ttl: String(ttl), urgency, ...(topic ? { topic } : {}) },
      body: payload,
      signal: AbortSignal.timeout(15_000),
    });
    // 404 and 410 mean the phone dropped the subscription: the box should forget it.
    return ok({ status: res.status, gone: res.status === 404 || res.status === 410, ...(res.ok ? {} : { error: (await res.text()).slice(0, 300) }) });
  }

  if (drop) {
    const rv = (r.rv ??= new Rendezvous());
    const [, id, slot] = drop;
    if (method === 'GET') {
      if (!limits.rvGet.ok(ip)) return err(429, 'too many reads; wait a minute');
      const v = await rv.read(id, slot, Math.min(Number(url.searchParams.get('wait') ?? 0) || 0, 25) * 1000);
      return v === undefined ? err(404, 'nothing there yet') : ok(v);
    }
    if (method === 'PUT') {
      if (!limits.rvPut.ok(ip)) return err(429, 'too many writes; wait a minute');
      if (JSON.stringify(body ?? null).length > 8192) return err(413, 'at most 8 KB');
      if (slot === 'host') {
        // Only the box that holds the name may say where it is, so nobody else can point a phone at another box.
        const [who, secret] = (auth ?? '').replace(/^Bearer /i, '').split('.', 2);
        if (!r.names.check(who, secret) || body?.host !== `${who}.${DOMAIN}`) return err(403, 'only the box that holds this address can write it');
      }
      return rv.put(id, slot, body) ? ok({ ok: true }) : err(409, 'already written');
    }
  }

  if (method === 'GET' && p === '/') return { status: 200, body: PAGE };
  return err(404, 'not found');
}

const PAGE = `<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width"><title>GurtOS relay</title>
<body style="font:16px/1.5 system-ui;max-width:36rem;margin:3rem auto;padding:0 1rem">
<h1>GurtOS relay</h1>
<p>This relay gives GurtOS boxes an address like <code>rosa.${DOMAIN}</code>. It passes each connection to the box by name,
still encrypted: the box holds its own certificate and key, so the relay cannot read what goes through.</p>
<p>It also forwards push notifications to phones. The box encrypts each one for the phone before it gets here.</p>
<p><a href="https://gurtos.com/docs/guides/reach-your-box-from-anywhere/">How it works</a></p></body>`;

// ---------- serving ----------

async function readJson(req: http.IncomingMessage) {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const c of req) {
    size += (c as Buffer).length;
    if (size > 64 * 1024) throw Object.assign(new Error('request too large'), { status: 413 });
    chunks.push(c as Buffer);
  }
  const text = Buffer.concat(chunks).toString();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    throw Object.assign(new Error("the request body isn't valid JSON"), { status: 400 });
  }
}

/** A push to a native app: the ciphertext only, under a generic alert the app replaces once it has checked it. */
async function apnsPush(r: Relay, t: { topic: string; sandbox: boolean; token: string }, body: any): Promise<Answer> {
  if (!r.apns) return { status: 503, body: { error: 'APNs is not set up on this relay' } };
  const payload = typeof body.payload === 'string' && /^[A-Za-z0-9_-]+$/.test(body.payload) ? body.payload : '';
  // APNs allows 4 KB in all, so the base64 ciphertext gets about 3.7 KB.
  if (payload.length < 115 || payload.length > 3700) return { status: 400, body: { error: 'payload: the encrypted push body (aes128gcm), base64url, at most 2.7 KB for an Apple device' } };
  const ttl = Math.max(0, Math.min(Number(body.ttl ?? 86400) | 0, 7 * 86400));
  const topic = topicOf(body.topic);
  const res = await (r.apnsSend ?? apnsHttp2)(t.sandbox ? 'api.sandbox.push.apple.com' : 'api.push.apple.com', `/3/device/${t.token}`, {
    authorization: `bearer ${apnsJwt(r.apns)}`,
    'apns-topic': t.topic,
    'apns-push-type': 'alert',
    'apns-priority': body.urgency === 'high' ? '10' : '5',
    'apns-expiration': String(Math.floor(Date.now() / 1000) + ttl),
    ...(topic ? { 'apns-collapse-id': topic } : {}),
  }, JSON.stringify({ aps: { alert: { title: 'GurtOS', body: 'A request needs you' }, 'mutable-content': 1, category: 'APPROVAL', sound: 'default' }, e: payload }));
  const reason = (() => {
    try {
      return String(JSON.parse(res.body).reason ?? '');
    } catch {
      return '';
    }
  })();
  // 410, or a token Apple doesn't know for this app: the box should forget the subscription.
  const gone = res.status === 410 || ['BadDeviceToken', 'DeviceTokenNotForTopic', 'Unregistered'].includes(reason);
  return { status: 200, body: { status: res.status, gone, ...(res.status === 200 ? {} : { error: reason || res.body.slice(0, 300) }) } };
}

export function serve(r: Relay, pluginPort = Number(process.env.RELAY_PLUGIN_PORT ?? 7400), apiPort = Number(process.env.RELAY_API_PORT ?? 7401)) {
  // frps calls this on loopback only.
  const pluginServer = http.createServer(async (req, res) => {
    try {
      const body = await readJson(req);
      const answer = plugin(String(new URL(req.url ?? '/', 'http://x').searchParams.get('op') ?? body.op), body.content, r.names, r.selfSecret, limits.logins);
      if (answer.reject) console.log(`refused ${body.op} for ${JSON.stringify(body.content?.user?.user ?? body.content?.user)}: ${answer.reject_reason}`);
      res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(answer));
    } catch (e) {
      res.writeHead(400).end(String((e as Error).message));
    }
  });
  // Caddy on the relay serves this at https://DOMAIN, with the caller's address in X-Forwarded-For.
  const apiServer = http.createServer(async (req, res) => {
    // The GurtOS app reads and writes rendezvous slots from the browser.
    if (req.method === 'OPTIONS') return void res.writeHead(204, { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, PUT', 'access-control-allow-headers': 'content-type, authorization', 'access-control-max-age': '600' }).end();
    const ip = String(req.headers['x-forwarded-for'] ?? req.socket.remoteAddress ?? '').split(',').pop()!.trim();
    let a: Answer;
    try {
      a = await api(r, req.method ?? 'GET', new URL(req.url ?? '/', 'http://x'), req.method === 'GET' ? {} : await readJson(req), req.headers.authorization, ip);
    } catch (e) {
      a = { status: (e as { status?: number }).status ?? 502, body: { error: (e as Error).message } };
    }
    const html = typeof a.body === 'string';
    res.writeHead(a.status, { 'content-type': html ? 'text/html; charset=utf-8' : 'application/json', 'cache-control': 'no-store', 'access-control-allow-origin': '*' }).end(html ? a.body : JSON.stringify(a.body));
  });
  pluginServer.listen(pluginPort, '127.0.0.1');
  apiServer.listen(apiPort, '127.0.0.1');
  return { pluginServer, apiServer };
}

if (import.meta.main) {
  const r = load();
  serve(r);
  console.log(`relay for *.${DOMAIN}: ${Object.keys(r.names.all).length} names, push key ${r.vapid.publicKey.slice(0, 12)}...`);
}
