// The native apps' step in ./demo: every box call the iPhone, Watch and Mac apps make (native/apple/GurtKit,
// BoxClient.swift), in the same shape, as a paired phone off the box. The VM has no Swift, so this checks the
// contract the apps rely on; the apps' own tests run on a Mac (native/apple/scripts/build.sh test).
import { createECDH, randomBytes } from 'node:crypto';
import type { DemoKit } from '../core/contract.ts';

export default async (d: DemoKit) => {
  // A phone through the relay arrives with X-Forwarded-For, so the box treats it as off-box: the token is required.
  const as = (token?: string) => async <T = any>(method: string, path: string, body?: unknown): Promise<{ status: number; json: T }> => {
    const r = await fetch(`${d.url}/api${path}`, {
      method,
      headers: { 'x-forwarded-for': '192.0.2.20', accept: 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}), ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: r.status, json: (await r.json().catch(() => null)) as T };
  };

  // Pairing: the box's screen makes a one-time code; the app redeems it as an iPhone.
  const start = await d.api<{ code: string; url: string }>('POST', '/api/pair/start');
  const paired = await as()<{ token: string; box: { id: string; name: string }; device: { id: string }; edition: string }>('POST', '/pair', { code: start.code, name: 'Demo iPhone', kind: 'iphone' });
  d.check(paired.status === 200 && /^[0-9a-f]{48}$/.test(paired.json.token) && paired.json.box.id && paired.json.edition, `the app pairs with a code from the box's QR (${start.url.replace(/#.*/, '#<code>')}) and gets its own token`);
  const again = await as()('POST', '/pair', { code: start.code, name: 'Second phone', kind: 'iphone' });
  d.check(again.status >= 400, 'the same code does not pair a second phone');
  const phone = as(paired.json.token);
  d.check((await as()('GET', '/tasks')).status === 401, 'off the box, a call without a token is refused');

  // The QR's other form, the computer's own page on the home network (`boxUrl`, http://<ip>:7700/pair#<code>): the app
  // reads the code from its fragment and calls this same API at that address, so the relay is never involved.
  const home = await d.api<{ code: string; boxUrl?: string }>('POST', '/api/pair/start');
  d.check(!home.boxUrl || new URL(home.boxUrl).hash === `#${home.code}` && new URL(home.boxUrl).pathname === '/pair', `a home-network pairing link carries the code in its fragment (${home.boxUrl ? home.boxUrl.replace(/#.*/, '#<code>') : 'this box has no BOX_URL, so none is offered'})`);
  // A code typed from the screen as "8120-D849" pairs: the computer ignores dashes, spaces and case, the app only trims.
  const typed = await as()<{ token: string }>('POST', '/pair', { code: `${home.code.slice(0, 4)}-${home.code.slice(4).toUpperCase()}`, name: 'Typed code', kind: 'iphone' });
  d.check(typed.status === 200 && !!typed.json.token, 'a code typed with a dash and capitals pairs');
  // A phone says whether it has the owner's controls, so the app hides the kill switch and Quick Start it can't use.
  const plainMe = await as(typed.json.token)<{ owner: boolean }>('GET', '/me');
  const refused = await as(typed.json.token)<{ error: string }>('POST', '/pause');
  d.check(plainMe.json.owner === false && refused.status === 403 && /\w{4}/.test(refused.json?.error ?? ''), `a phone paired without the owner's rights reads owner: false in /api/me, and the kill switch refuses it (${refused.status}: "${refused.json?.error}")`);
  const ownerCode = await d.api<{ code: string }>('POST', '/api/pair/start', { owner: true });
  const ownerPhone = as((await as()<{ token: string }>('POST', '/pair', { code: ownerCode.code, name: 'Owner phone', kind: 'iphone' })).json.token);
  d.check((await ownerPhone<{ owner: boolean }>('GET', '/me')).json.owner === true, 'a phone paired as the owner reads owner: true');
  await as(typed.json.token)('DELETE', '/pair/self');
  await ownerPhone('DELETE', '/pair/self');

  // What every home reads.
  const reads = await Promise.all(['/system', '/tasks', '/approvals?state=pending', '/pause', '/log?after=0', '/health'].map((p) => phone('GET', p)));
  d.check(reads.every((r) => r.status === 200), 'the app reads the system, tasks, pending requests, the kill switch, the log and health');
  const sys = reads[0].json as { edition: string; boxId: string; boxName: string };
  d.check(['server', 'personal', 'business'].includes(sys.edition) && sys.boxId === paired.json.box.id, `GET /api/system names the edition (${sys.edition}) and the same box the pairing named`);

  // A request, answered with the check this phone made (Face ID), and the log says which device answered.
  const t = await d.api<{ id: string }>('POST', '/api/tasks', { title: 'Native app: deploy', workspace: 'home', worker: 'fake', source: 'demo', prompt: 'ask Deploy build 7 now?\nwrite deployed.txt yes' });
  const ask = await d.waitFor('the request', async () => (await phone<any[]>('GET', '/approvals?state=pending')).json.find((a) => a.task === t.id));
  const detail = await phone<{ task: { id: string }; approvals: unknown[]; events: unknown[] }>('GET', `/tasks/${t.id}`);
  d.check(detail.status === 200 && detail.json.task.id === t.id && detail.json.approvals.length === 1, 'the request page reads the task, its approvals and its steps');
  const answer = await phone<{ state: string; by: string }>('POST', `/approvals/${encodeURIComponent(ask.id)}`, { approved: true, auth: 'face-id' });
  d.check(answer.status === 200 && answer.json.state === 'approved' && answer.json.by === 'Demo iPhone (Face ID, reported)', `Approve from the app: the box names the paired phone, whatever the body says, and keeps its check as reported ("${answer.json.by}")`);
  const late = await phone<{ state: string }>('POST', `/approvals/${encodeURIComponent(ask.id)}`, { approved: false, auth: 'none' });
  d.check(late.json?.state === 'approved', 'a second answer does not change the first: the app shows "Already approved on Demo iPhone (Face ID, reported)"');
  await d.settled([t.id]);

  // Undo one task.
  const undo = await phone<{ state: string }>('POST', `/tasks/${t.id}/undo`);
  d.check(undo.status === 200 && undo.json.state === 'undone', 'Undo from the app undoes that task');

  // The live log, as the app follows it (Server-Sent Events with the token in the header).
  const ac = new AbortController();
  const sse = await fetch(`${d.url}/api/log/stream?after=0`, { headers: { authorization: `Bearer ${paired.json.token}`, 'x-forwarded-for': '192.0.2.20', accept: 'text/event-stream' }, signal: ac.signal });
  const first = await sse.body!.getReader().read();
  ac.abort();
  d.check(sse.status === 200 && new TextDecoder().decode(first.value).includes('data: {'), 'the log stream opens for the app and sends events');

  // Push: an APNs endpoint on the relay, with keys the app made. The box encrypts for them (core/push.ts).
  const keys = createECDH('prime256v1');
  keys.generateKeys();
  const sub = { endpoint: `https://box.gurtos.com/v1/apns/com.benzhou.gurtos/sandbox/${'ab'.repeat(32)}`, keys: { p256dh: keys.getPublicKey().toString('base64url'), auth: randomBytes(16).toString('base64url') } };
  const put = await phone('PUT', '/push', { subscription: sub, key: randomBytes(32).toString('base64url') });
  const got = await phone<{ subscribed: boolean }>('GET', '/push');
  d.check(put.status === 200 && got.json.subscribed, "the box takes the app's APNs subscription as it takes a web one");
  await phone('DELETE', '/push');
  d.check((await phone<{ subscribed: boolean }>('GET', '/push')).json.subscribed === false, 'turning notifications off removes it');

  // The Apple Watch: a token of its own, through the iPhone, and limits the box enforces whatever the Watch sends.
  const web = await d.api<{ code: string }>('POST', '/api/pair/start');
  const browser = as((await as()<{ token: string }>('POST', '/pair', { code: web.code, name: 'Demo browser' })).json.token);
  d.check((await browser('POST', '/devices/self/watch', { name: 'x' })).status === 403, 'only the iPhone app can add a Watch, not a browser');
  const wt = await phone<{ token: string; device: { id: string } }>('POST', '/devices/self/watch', { name: "Demo iPhone's Watch" });
  d.check(wt.status === 200 && wt.json.token !== paired.json.token, 'the iPhone gets a separate token for its Watch');
  const watch = as(wt.json.token);
  const limit = (await d.api<{ watchLimitCents: number }>('GET', '/api/settings')).watchLimitCents;
  d.check(limit === 2500, 'a Watch may approve up to $25 by default (Settings watchLimitCents)');
  await d.api('POST', '/api/apps/example/enable');
  const ask2 = async (title: string, prompt: string) => {
    const t2 = await d.api<{ id: string }>('POST', '/api/tasks', { title, workspace: 'home', worker: 'fake', source: 'demo', tools: ['example.spend'], budgetCents: 0, prompt });
    return d.waitFor(title, async () => (await phone<any[]>('GET', '/approvals?state=pending')).json.find((a) => a.task === t2.id));
  };
  const small = await ask2('Watch: small', 'call example.spend {"cents":800,"on":"a GPU hour"}');
  const big = await ask2('Watch: big', 'call example.spend {"cents":4000,"on":"a bigger GPU"}');
  const noWrist = await watch<{ needs: string }>('POST', `/approvals/${encodeURIComponent(small.id)}`, { approved: true });
  d.check(noWrist.status === 403 && noWrist.json.needs === 'iphone', 'a Watch answer that does not say it is on the wrist is refused');
  const ok = await watch<{ state: string; by: string }>('POST', `/approvals/${encodeURIComponent(small.id)}`, { approved: true, auth: 'wrist' });
  d.check(ok.status === 200 && ok.json.state === 'approved', `the Watch approves $8.00 on the wrist (by ${ok.json.by})`);
  const over = await watch<{ needs: string; error: string }>('POST', `/approvals/${encodeURIComponent(big.id)}`, { approved: true, auth: 'wrist' });
  d.check(over.status === 403 && over.json.needs === 'iphone' && (await phone<any[]>('GET', '/approvals?state=pending')).json.some((a) => a.id === big.id), `$40.00 from the Watch is refused and still waits: "${over.json.error}"`);
  const viaPhone = await phone<{ state: string; by: string }>('POST', `/approvals/${encodeURIComponent(big.id)}`, { approved: true, auth: 'face-id' });
  d.check(viaPhone.json.state === 'approved', 'the iPhone approves it with Face ID');
  const third = await ask2('Watch: deny', 'call example.spend {"cents":9000,"on":"a third GPU"}');
  const deny = await watch<{ state: string }>('POST', `/approvals/${encodeURIComponent(third.id)}`, { approved: false, auth: 'wrist' });
  d.check(deny.json.state === 'denied', 'the Watch may always deny, whatever the amount');
  await browser('DELETE', '/pair/self');

  // Forget: the token stops working at once, and the Watch's with it.
  const forget = await phone('DELETE', '/pair/self');
  d.check(forget.status === 200 && (await phone('GET', '/tasks')).status === 401, "Forget this machine revokes the app's token on the box");
  d.check((await watch('GET', '/tasks')).status === 401, "and the Watch's token stops working with it");
};
