// The GurtOS relay. One small service beside frps on the relay machine:
//   - names: a box enrolls a name (rosa -> rosa.box.gurtos.com) and gets a secret only it holds
//   - the frps plugin: frps asks it before a box logs in or opens a route, and it checks that box's secret
//   - the push gateway: a box hands it a push it already encrypted for the phone; the gateway signs it with the
//     app's VAPID key and forwards it to the phone's push service. It never sees what the push says.
// It never terminates a box's TLS: frps routes those connections by SNI, as bytes.
//   node --experimental-strip-types relay/server.ts
// Env: RELAY_STATE (default /var/lib/gurtos-relay), RELAY_DOMAIN (default box.gurtos.com),
//      RELAY_PLUGIN_PORT (7400), RELAY_API_PORT (7401), RELAY_TUNNEL_PORT (7000, announced to boxes).
import { createHash, createHmac, generateKeyPairSync, createPrivateKey, randomBytes, sign, timingSafeEqual, type KeyObject } from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
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
  if (op === 'Ping') return { reject: false, unchange: true }; // the check above runs again: a released name is cut off
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

// ---------- the API ----------

export interface Relay {
  names: Names;
  vapid: Vapid;
  selfSecret: string;
  /** The PEM of the CA that signed the tunnel port's certificate. Boxes fetch it over HTTPS and pin it. */
  tunnelCa: string;
  /** Extra push hosts, for tests (a local fake push service). */
  testPushHosts?: RegExp[];
}

export function load(dir = STATE): Relay {
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const selfFile = path.join(dir, 'self.secret');
  if (!fs.existsSync(selfFile)) fs.writeFileSync(selfFile, randomBytes(32).toString('base64url'), { mode: 0o600 });
  const caFile = path.join(dir, 'tunnel-ca.pem');
  return { names: new Names(dir), vapid: loadVapid(dir), selfSecret: fs.readFileSync(selfFile, 'utf8').trim(), tunnelCa: fs.existsSync(caFile) ? fs.readFileSync(caFile, 'utf8') : '' };
}

const limits = { enroll: new Limit(5, 3600_000), enrollAll: new Limit(200, 3600_000), check: new Limit(60, 60_000), push: new Limit(600, 3600_000), bad: new Limit(20, 600_000), logins: new Limit(30, 60_000) };

type Answer = { status: number; body: unknown };

/** One API request. `ip` is the caller's address (Caddy on the relay puts it in X-Forwarded-For). */
export async function api(r: Relay, method: string, url: URL, body: any, auth: string | undefined, ip: string, send = fetch): Promise<Answer> {
  const ok = (b: unknown): Answer => ({ status: 200, body: b });
  const err = (status: number, error: string): Answer => ({ status, body: { error } });
  const p = url.pathname;
  const named = p.match(/^\/v1\/names\/([^/]+)$/)?.[1];

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

  if (method === 'GET' && p === '/') return { status: 200, body: PAGE };
  return err(404, 'not found');
}

const PAGE = `<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width"><title>GurtOS relay</title>
<body style="font:16px/1.5 system-ui;max-width:36rem;margin:3rem auto;padding:0 1rem">
<h1>GurtOS relay</h1>
<p>This relay gives GurtOS boxes an address like <code>rosa.${DOMAIN}</code>. It passes each connection to the box by name,
still encrypted: the box holds its own certificate and key, so the relay cannot read what goes through.</p>
<p>It also forwards push notifications to phones. The box encrypts each one for the phone before it gets here.</p>
<p><a href="https://gurtos.com/guides/reach-your-box-from-anywhere/">How it works</a></p></body>`;

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
