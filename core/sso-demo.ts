// GurtOS Business in ./demo: sign in with a work account. A small OpenID Connect provider runs here on loopback
// (discovery, keys, RS256 ID tokens, nonce, PKCE), standing in for Microsoft Entra ID, so the merge gate needs no
// internet. A scripted browser follows the redirects. It proves: a person in the Controllers group signs in as an
// approver with the mapped limit; someone in no mapped group is refused; forged tokens are refused; the signed-in
// browser is that person and answers what the policy sends them. Business goes on for this step and off again.
import { createHash, generateKeyPairSync, randomBytes, sign } from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import type { Approval, DemoKit, LogEvent, Task } from './contract.ts';
import { POLICY } from './business-demo.ts';

const CLIENT = 'gurtos-demo-app';
const SECRET = randomBytes(16).toString('hex');
const CONTROLLERS = '6f1c2a90-0000-4000-8000-00000000c001'; // group ids look like Entra's object ids
const IT = '6f1c2a90-0000-4000-8000-00000000c002';
const RELAYED = { 'x-forwarded-for': '203.0.113.9' }; // a laptop's request through a proxy: not the box's screen

type Forge = '' | 'key' | 'aud' | 'replay';

/** The test provider. `as` picks who signs in at its sign-in page; `forge` makes its next ID token wrong on purpose. */
async function testProvider() {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const stranger = generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey; // a key this provider never published
  const users: Record<string, { sub: string; name: string; email: string; groups: string[] }> = {
    mei: { sub: 'u-1001', name: 'Mei Tanaka', email: 'mei@fogline.example', groups: [CONTROLLERS] },
    dana: { sub: 'u-1002', name: 'Dana Reyes', email: 'dana@fogline.example', groups: ['6f1c2a90-0000-4000-8000-00000000c0ff'] },
  };
  const codes = new Map<string, { user: string; redirect: string; nonce: string; challenge: string }>();
  const idp = { url: '', as: 'mei', forge: '' as Forge, users, close: () => server.close() };
  const last: Record<string, string> = {}; // each user's last good token, for the replay
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', idp.url);
    const json = (status: number, o: unknown) => res.writeHead(status, { 'content-type': 'application/json' }).end(JSON.stringify(o));
    if (url.pathname === '/.well-known/openid-configuration')
      return json(200, { issuer: idp.url, authorization_endpoint: `${idp.url}/authorize`, token_endpoint: `${idp.url}/token`, jwks_uri: `${idp.url}/keys`, response_types_supported: ['code'], subject_types_supported: ['public'], id_token_signing_alg_values_supported: ['RS256'], code_challenge_methods_supported: ['S256'] });
    if (url.pathname === '/keys') return json(200, { keys: [{ ...publicKey.export({ format: 'jwk' }), kid: 'demo-1', use: 'sig', alg: 'RS256' }] });
    if (url.pathname === '/authorize') {
      const q = url.searchParams;
      if (q.get('response_type') !== 'code' || q.get('client_id') !== CLIENT || q.get('code_challenge_method') !== 'S256' || !q.get('nonce') || !q.get('state')) return json(400, { error: 'invalid_request' });
      const code = randomBytes(12).toString('hex');
      codes.set(code, { user: idp.as, redirect: q.get('redirect_uri')!, nonce: q.get('nonce')!, challenge: q.get('code_challenge')! });
      return res.writeHead(302, { location: `${q.get('redirect_uri')}?${new URLSearchParams({ code, state: q.get('state')! })}` }).end();
    }
    if (url.pathname === '/token' && req.method === 'POST') {
      let text = '';
      for await (const c of req) text += c;
      const f = new URLSearchParams(text);
      const entry = codes.get(f.get('code') ?? '');
      codes.delete(f.get('code') ?? '');
      const pkce = createHash('sha256').update(f.get('code_verifier') ?? '').digest('base64url');
      if (!entry || f.get('client_id') !== CLIENT || f.get('client_secret') !== SECRET || f.get('redirect_uri') !== entry.redirect || pkce !== entry.challenge) return json(400, { error: 'invalid_grant' });
      const u = users[entry.user];
      const now = Math.floor(Date.now() / 1000);
      const claims = { iss: idp.url, aud: idp.forge === 'aud' ? 'another-app' : CLIENT, sub: u.sub, iat: now, exp: now + 600, nonce: entry.nonce, name: u.name, email: u.email, groups: u.groups };
      const enc = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
      const data = `${enc({ alg: 'RS256', kid: 'demo-1', typ: 'JWT' })}.${enc(claims)}`;
      const token = `${data}.${sign('sha256', Buffer.from(data), idp.forge === 'key' ? stranger : privateKey).toString('base64url')}`;
      if (!idp.forge) last[entry.user] = token;
      return json(200, { id_token: idp.forge === 'replay' ? last[entry.user] : token, access_token: randomBytes(8).toString('hex'), token_type: 'Bearer', expires_in: 600 });
    }
    json(404, { error: 'not found' });
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  idp.url = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  return idp;
}

type Res = { status: number; body: any; text: string };

export default async function (d: DemoKit) {
  const base = () => `http://127.0.0.1:${fs.readFileSync(path.join(d.home, 'api.port'), 'utf8').trim()}`;
  const send = async (headers: Record<string, string>, method: string, p: string, body?: unknown): Promise<Res> => {
    const r = await fetch(base() + p, { method, headers: { 'content-type': 'application/json', ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
    const text = await r.text();
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {}
    return { status: r.status, body: json, text };
  };
  const screen = (m: string, p: string, b?: unknown) => send({}, m, p, b);
  const idp = await testProvider();
  try {
    await steps(d, idp, base, send, screen);
  } finally {
    idp.close();
    await screen('PUT', '/api/business', { on: false, sso: null });
  }
}

async function steps(d: DemoKit, idp: Awaited<ReturnType<typeof testProvider>>, base: () => string, send: (h: Record<string, string>, m: string, p: string, b?: unknown) => Promise<Res>, screen: (m: string, p: string, b?: unknown) => Promise<Res>) {
  const ok = (r: Res, what: string) => {
    if (r.status !== 200) throw new Error(`${what}: HTTP ${r.status} ${r.text.slice(0, 200)}`);
    return r.body;
  };
  const location = (r: Response, what: string) => {
    const to = r.headers.get('location');
    if (r.status !== 302 || !to) throw new Error(`${what}: expected a redirect, got HTTP ${r.status}`);
    return to;
  };
  /** A browser signing in: the box sends it to the provider, the provider back to the box, the box to the portal with a one-time code. */
  const browse = async (user: string, forge: Forge = '', opts: { cookie?: boolean } = {}) => {
    Object.assign(idp, { as: user, forge });
    const start = await fetch(`${base()}/api/sso/start?device=Laptop`, { redirect: 'manual', headers: RELAYED });
    const cookie = (start.headers.get('set-cookie') ?? '').split(';')[0];
    const atProvider = location(start, 'start');
    const callback = location(await fetch(atProvider, { redirect: 'manual' }), 'the provider');
    const back = location(await fetch(callback, { redirect: 'manual', headers: { ...RELAYED, ...(opts.cookie === false ? {} : { cookie }) } }), 'the callback');
    const code = back.match(/^\/#sso\/([\w-]+)$/)?.[1];
    if (!code) throw new Error(`the box sent the browser to ${back.slice(0, 80)}, not /#sso/<code>`);
    const redeemed = await send(RELAYED, 'POST', '/api/sso/redeem', { code });
    return { redeemed, atProvider, callback, cookie, back };
  };

  // ---------- the owner sets it up ----------
  ok(await screen('PUT', '/api/vault/SSO_DEMO_SECRET', { value: SECRET }), 'the client secret into the vault');
  const sso = {
    name: 'Fogline (test sign-in)',
    issuer: idp.url,
    clientId: CLIENT,
    secretKey: 'SSO_DEMO_SECRET',
    domain: 'fogline.example',
    groups: { [CONTROLLERS]: { role: 'approver', approvesFor: ['Controller'], limitCents: 5_000_000 }, [IT]: { role: 'admin', approvesFor: ['IT'] } },
  };
  ok(await screen('PUT', '/api/business', { on: true, company: 'Fogline Supply', policy: POLICY, sso }), 'turn Business on with work-account sign-in');
  ok(await screen('POST', '/api/people', { id: 'sam', name: 'Sam Chen', role: 'requester', title: 'Sales' }), 'add Sam');
  ok(await screen('POST', '/api/people', { id: 'priya', name: 'Priya Nair', role: 'admin', title: 'IT admin', approvesFor: ['IT'] }), 'add Priya');
  const { code: pc } = ok(await screen('POST', '/api/people/priya/pair'), 'a code for Priya');
  const priya = ok(await send(RELAYED, 'POST', '/api/pair', { code: pc }), "pair Priya's phone").token as string;
  const ownerByAdmin = await send({ ...RELAYED, authorization: `Bearer ${priya}` }, 'PUT', '/api/business', { sso: { ...sso, groups: { ...sso.groups, [IT]: { role: 'owner' } } } });
  const anyKey = await screen('PUT', '/api/business', { sso: { ...sso, secretKey: 'ANTHROPIC_API_KEY' } });
  d.check(ownerByAdmin.status === 403 && anyKey.status === 400, 'only the owner can map a group to the owner role (an admin gets 403), and the client secret can only be an SSO_ key in the vault');
  const open = await send(RELAYED, 'GET', '/api/sso');
  d.check(open.status === 200 && JSON.stringify(open.body) === JSON.stringify({ on: true, name: sso.name }), `an unpaired laptop asks GET /api/sso and learns only that sign-in is on and the provider's name: ${open.text}`);

  // ---------- Mei, in the Controllers group, signs in ----------
  const devicesBefore = (ok(await screen('GET', '/api/devices'), 'devices') as unknown[]).length;
  const mei = await browse('mei');
  const auth = new URL(mei.atProvider).searchParams;
  d.check(auth.get('code_challenge_method') === 'S256' && auth.get('nonce') && auth.get('state') && !mei.callback.includes('token') && /^gurtos_sso=/.test(mei.cookie), 'the box sends the browser to the provider with state, a nonce and a PKCE challenge, bound to that browser by a cookie; no token ever travels in an address');
  const meiToken = ok(mei.redeemed, 'Mei redeems her sign-in').token as string;
  const meiCalls = (m: string, p: string, b?: unknown) => send({ ...RELAYED, authorization: `Bearer ${meiToken}` }, m, p, b);
  const me = ok(await meiCalls('GET', '/api/me'), "Mei's /api/me").person;
  d.check(me?.name === 'Mei Tanaka' && me.role === 'approver' && me.limitCents === 5_000_000 && me.approvesFor.join() === 'Controller' && /^sso-[0-9a-f]{12}$/.test(me.id) && mei.redeemed.body.device.person === me.id,
    `Mei Tanaka (Fogline Controllers) signs in as an approver for the Controller, up to $50,000; her laptop is paired as her (person ${me.id})`);

  // ---------- refused ----------
  const dana = await browse('dana');
  d.check(dana.redeemed.status === 403 && /not in a group/.test(dana.redeemed.body.error), `Dana Reyes, in no mapped group, is refused: "${dana.redeemed.body.error}"`);
  const forged: [Forge, RegExp, string][] = [
    ['key', /signature does not match/, 'signed with a key the provider never published'],
    ['aud', /for another app/, 'made for another app'],
    ['replay', /not made for this sign-in/, "Mei's earlier token replayed into a new sign-in"],
  ];
  const refusals: string[] = [];
  for (const [forge, why, what] of forged) {
    const r = (await browse('mei', forge)).redeemed;
    if (r.status !== 403 || !why.test(r.body.error)) throw new Error(`a token ${what} was not refused: HTTP ${r.status} ${r.text.slice(0, 200)}`);
    refusals.push(`${what}: "${r.body.error}"`);
  }
  const again = await fetch(mei.callback, { redirect: 'manual', headers: { ...RELAYED, cookie: mei.cookie } });
  const againCode = location(again, 'the callback again').split('#sso/')[1];
  const againRedeem = await send(RELAYED, 'POST', '/api/sso/redeem', { code: againCode });
  const elsewhere = await browse('mei', '', { cookie: false });
  d.check(/already used/.test(againRedeem.body.error) && /another browser/.test(elsewhere.redeemed.body.error), `forged ID tokens are refused: ${refusals.join('; ')}. The same callback used twice, or finished in another browser, is refused too`);
  const devicesAfter = (ok(await screen('GET', '/api/devices'), 'devices') as unknown[]).length;
  d.check(devicesAfter === devicesBefore + 1, `only Mei's one good sign-in made a device (${devicesBefore} before, ${devicesAfter} after seven tries)`);

  // ---------- Mei answers a request the policy sends to the Controller ----------
  d.workspace('fogline-sso', { 'README.md': 'Fogline Supply Co., credit desk' });
  const asSam = { 'x-box-person': 'sam' }; // the box's screen, with Sam signed in on it
  const task = ok(await send(asSam, 'POST', '/api/tasks', { title: 'Credit analyst: APP-1050', seat: 'Credit analyst', worker: 'fake', workspace: 'fogline-sso', prompt: 'ask Credit desk: approve Harbor Lights Bakery (APP-1050) for $40,000, Net 30?\nwrite APP-1050.txt approved, $40,000 Net 30' }), 'Sam starts a task') as Task;
  const asked = await d.waitFor('the $40,000 request', async () => (ok(await screen('GET', '/api/approvals?state=pending'), 'approvals') as Approval[]).find((a) => a.task === task.id));
  const waiting = ok(await meiCalls('GET', '/api/me'), 'me').waiting as Approval[];
  d.check(asked.route?.people.some((p) => p.id === me.id) && waiting.some((a) => a.id === asked.id), `the policy sends Sam's $40,000 request to the Controller, and it waits for Mei on her laptop: "${asked.route?.why}"`);
  const answered = ok(await meiCalls('POST', `/api/approvals/${encodeURIComponent(asked.id)}`, { approved: true, by: 'laptop' }), 'Mei approves');
  await d.settled([task.id]);
  d.check(answered.state === 'approved' && answered.person === me.id && answered.by === 'Mei Tanaka' && d.view('fogline-sso', 'APP-1050.txt') === 'approved, $40,000 Net 30', 'Mei approves it from the browser she signed in with; the log names her, and the seat finishes');

  // ---------- the log ----------
  const log = ok(await screen('GET', '/api/log'), 'log') as LogEvent[];
  const notes = log.flatMap((e) => (e.type === 'note' && e.track === 'business' && (e.data as { sso?: string }).sso ? [e.data as { sso: string; person?: string; idp?: string; role?: string }] : []));
  const signedIn = notes.find((n) => n.sso === 'signed in' && n.person === me.id);
  const text = JSON.stringify(log);
  d.check(signedIn?.idp === sso.name && signedIn.role === 'approver' && notes.filter((n) => n.sso === 'refused').length >= 6 && !text.includes('@fogline.example') && !text.includes(meiToken) && !text.includes(SECRET),
    `the log has each sign-in (who, which provider, which role) and each refusal, and never an address, a token or the secret`);

  // ---------- Mei leaves the Controllers group ----------
  idp.users.mei.groups = [];
  const left = await browse('mei');
  const oldToken = await meiCalls('GET', '/api/me');
  const people = ok(await screen('GET', '/api/people'), 'people') as { id: string }[];
  d.check(left.redeemed.status === 403 && oldToken.status === 401 && !people.some((p) => p.id === me.id), 'out of the group, Mei is refused at her next sign-in, removed from the people, and her laptop gets 401');

  // ---------- off again ----------
  ok(await screen('PUT', '/api/business', { on: false, sso: null }), 'turn Business off');
  const off = await send(RELAYED, 'GET', '/api/sso');
  const start = await fetch(`${base()}/api/sso/start`, { redirect: 'manual', headers: RELAYED });
  const offCode = location(start, 'start when off').split('#sso/')[1];
  const offRedeem = await send(RELAYED, 'POST', '/api/sso/redeem', { code: offCode });
  d.check(off.body?.on === false && /not set up/.test(offRedeem.body?.error ?? ''), 'Business off: GET /api/sso says off and a sign-in goes nowhere');
}
