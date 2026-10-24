// The shopper's demo step. Offline by default: the GurtOS Test Store, the demo inbox and simulated test payments,
// with the fake worker playing the agent and a software authenticator standing in for Face ID. It shows, in order:
// a signed shopping mandate and a purchase, Face ID, a stolen session that cannot buy, the store refusing orders
// outside the mandate, spending rules, price protection, a cancelled subscription, and the merchant's dashboard.
// DEMO_LIVE=shopper adds real test-mode payments, a real comparison of Best Buy Canada and Gold Roast through Apify,
// and x402 on Solana devnet. DEMO_LIVE=droid adds Droid with Claude reading the receipts.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import type { Approval, DemoKit, LogEvent, Task } from '../../core/contract.ts';
import { Authenticator } from './softauth.ts';
import { publicKeyOf, signRequest } from './tap.ts';

const LIVE = /\b(shopper|visa)\b/.test(process.env.DEMO_LIVE ?? '');

export default async function (d: DemoKit) {
  const { tools } = await d.api<{ tools: string[] }>('GET', '/health');
  d.check(['shopper.buy', 'shopper.sign', 'shopper.checkPrice', 'shopper.receipts', 'shopper.propose', 'shopper.watch', 'shopper.priceAdjust', 'shopper.cancel'].every((t) => tools.includes(t)), 'the box loaded the shopper tools');

  const vault = Object.fromEntries(
    fs.readFileSync(path.join(d.home, 'vault.env'), 'utf8').split('\n').map((l) => l.match(/^([A-Z0-9_]+)=(.*)$/)).filter((m) => m).map((m) => [m![1], m![2].trim()]),
  );
  const missing = ['SHOPPER_CARD', 'SHOPPER_AGENT_KEY', 'SHOPPER_MAIL_PASSWORD'].filter((k) => !vault[k]);
  const state = () => d.api('GET', '/t/shopper/state');
  if (missing.length) {
    const s = await state();
    d.check(!s.setup.card || !s.setup.agentKey || !s.setup.inbox, `the app reports what the vault lacks (${missing.join(', ')})`);
    console.log(`  skip  purchases: the vault has no ${missing.join(', ')}. Run sudo tracks/shopper/setup.sh on this test machine.`);
    return;
  }
  const secrets = Object.entries(vault).filter(([k, v]) => /^(SHOPPER_|STRIPE_SECRET|CYBERSOURCE_|VISA_)/.test(k) && v.length > 8).map(([, v]) => v);
  const port = fs.readFileSync(path.join(d.home, 'api.port'), 'utf8').trim();
  const base = `http://127.0.0.1:${port}`;
  // The box's own screen, as a browser sees it: a passkey needs a name, not an IP address.
  const ORIGIN = `http://localhost:${port}`;
  const page = async (p: string, b: unknown) => {
    const r = await fetch(`${base}${p}`, { method: 'POST', headers: { 'content-type': 'application/json', origin: ORIGIN }, body: JSON.stringify(b) });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
    return j;
  };
  const watch = async (id: string, want: (w: any) => unknown, what: string, ms = 20_000) =>
    d.waitFor(what, async () => (await state()).watches.find((w: any) => w.id === id && want(w)), ms);
  const run = (id: string) => d.api<{ task: Task; approvals: Approval[]; events: LogEvent[] }>('GET', `/tasks/${id}`);
  const finish = (id: string, ms = 20_000) => d.waitFor(`task ${id} to finish`, async () => { const r = await run(id); return ['done', 'failed', 'undone'].includes(r.task.state) ? r : undefined; }, ms);
  const pending = (task: string) => d.waitFor(`task ${task} to ask`, async () => (await run(task)).approvals.find((a) => a.state === 'pending'));
  const tap = (id: string, approved = true) => d.api('POST', `/approvals/${id}`, { approved, by: 'phone' });
  const order = async (task: string) => (await state()).orders.find((o: any) => o.task === task);
  const admin = (sku: string, change: object) => d.api('POST', '/t/shopper/store/admin', { sku, ...change });
  const script = (title: string, toolsUsed: string[], lines: string[]) =>
    d.api<Task>('POST', '/tasks', { title, workspace: 'shopper', worker: 'fake', source: 'demo', tools: toolsUsed, prompt: lines.join('\n') });
  const resultOf = (r: { events: LogEvent[] }, tool: string) => {
    const call = r.events.find((e) => e.type === 'tool.call' && e.tool === tool) as any;
    return r.events.find((e) => e.type === 'tool.result' && e.key === call?.key) as any;
  };
  d.workspace('shopper', {});

  // ---------- Visa Trusted Agent Protocol at the store's checkout ----------
  const reg = await d.api('GET', '/t/shopper/keys/box-shopper');
  d.check(reg.public_key === publicKeyOf(vault.SHOPPER_AGENT_KEY) && reg.algorithm === 'ed25519', "the agent registry serves the box's TAP public key, never the private one");
  const checkoutUrl = `${base}/t/shopper/store/checkout`;
  const post = (headers: Record<string, string>, body: string) => fetch(checkoutUrl, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body });
  const body = JSON.stringify({ currency: 'USD', items: [{ sku: 'HV60-DRIP', priceCents: 2700, qty: 1 }] });
  const unsigned = await post({ 'idempotency-key': 'demo-1' }, body);
  d.check(unsigned.status === 401 && /unsigned/.test((await unsigned.json()).error), "the store refuses an unsigned order: an unknown bot without the box's key");
  const sig = signRequest(vault.SHOPPER_AGENT_KEY, checkoutUrl, body);
  const changed = await post({ 'idempotency-key': 'demo-2', ...sig }, body.replace('"qty":1', '"qty":5'));
  d.check(changed.status === 401 && /changed/.test((await changed.json()).error), 'a signed order changed in transit is refused: the signature covers the body');
  const once = await post({ 'idempotency-key': 'demo-3', ...sig }, body);
  const replay = await post({ 'idempotency-key': 'demo-4', ...sig }, body);
  d.check(once.status === 409 && replay.status === 401 && /replay/.test((await replay.json()).error), 'a captured signature cannot be used twice (the dripper is sold out, so nothing was charged)');

  // ---------- off the box: a paired phone opens the app with its token ----------
  const code = await d.api<{ code: string }>('POST', '/api/pair/start', {});
  const phone = await d.api<{ token: string }>('POST', '/api/pair', { code: code.code, name: 'Shopper demo phone' });
  const away = (p: string, h: Record<string, string> = {}) => fetch(`${base}${p}`, { headers: { 'x-forwarded-for': '203.0.113.7', ...h } }); // not from the box's own screen
  const [bare, app, st, shop] = await Promise.all([
    away('/t/shopper/state'), away(`/t/shopper/?access_token=${phone.token}`), away('/t/shopper/state', { authorization: `Bearer ${phone.token}` }), away(`/t/shopper/store/stats?access_token=${phone.token}`),
  ]);
  d.check(bare.status === 401 && app.status === 200 && st.status === 200 && shop.status === 200, 'off the box, a paired phone gets the app, its live state and the store with its token, and 401 without it');

  // ---------- a signed shopping mandate, then a purchase inside it ----------
  await admin('HV60-100', { priceCents: 899, inStock: true });
  const w = await d.api('POST', '/t/shopper/watches', { store: 'test', product: 'HV60-100', maxCents: 700, qty: 2, when: 'price', everyMinutes: 60, days: 5 });
  const asked = await watch(w.id, (x) => x.approval, 'the mandate to ask');
  const mq = (await run(asked.mandateTask)).approvals[0].question;
  d.check(/^Let the box shop for you\? Hario V60 02 paper filters, 100 count \(only HV60-100 at GurtOS Test Store, coffee\): up to \$7\.00 each, at most 2 and \$14\.00 in all, from GurtOS Test Store, until /.test(mq) && /refuses anything outside/.test(mq),
    `the watch starts as a mandate you approve: "${mq.slice(0, 96)}..."`);
  await tap(asked.approval);
  const first = await watch(w.id, (x) => x.mandate && x.compared, 'the signed mandate and the first check');
  d.check(first.mandate.mandate.approvedBy.method === 'tap' && first.mandate.sig && first.status === 'watching',
    'approved with a tap (no passkey yet), the box signed the mandate and started watching');
  d.check(!first.compared.best && first.compared.rows[0] && !first.compared.rows[0].ok, `a check saw $8.99, above the $7.00 limit, so it keeps watching (${first.compared.rows[0]?.why})`);
  await admin('HV60-100', { priceCents: 650 });
  await d.api('POST', '/t/shopper/watches/check', { id: w.id });
  const asking = await watch(w.id, (x) => x.approval && x.buyTask, 'the price drop to ask for an OK');
  const ask = (await run(asking.buyTask)).approvals[0];
  d.check(/^Buy 2 × Hario V60 02 paper filters, 100 count from GurtOS Test Store for \$13\.00\? \$6\.50 each, down from \$8\.99, inside your mandate/.test(ask.question) && /TEST PAYMENT/.test(ask.question),
    `it dropped to $6.50 and the buy waits for you: "${ask.question.slice(0, 80)}..."`);
  await tap(ask.id);
  const bought = await finish(asking.buyTask);
  const o1 = await order(asking.buyTask);
  d.check(bought.task.state === 'done' && o1?.totalCents === 1300 && o1.mandate.id === w.id && o1.payment.test,
    `paid $13.00 as a TEST payment (${o1?.payment.card}, ${o1?.payment.provider}); the store checked the TAP signature and mandate ${o1?.mandate.id}`);
  const stripe = LIVE && !!vault.STRIPE_SECRET_KEY && !vault.CYBERSOURCE_MERCHANT_ID;
  if (stripe) d.check(o1.payment.provider === 'stripe test mode' && /^pi_/.test(o1.payment.id), `Stripe test mode took the charge (${o1.payment.id})`);
  else if (!LIVE) d.check(o1.payment.provider === 'simulated', `no payment network in this run: the payment is simulated and says so (${o1.payment.note})`);
  const note = (bought.events.findLast((e) => e.type === 'task.step' && (e.data as any)?.undo) as any)?.data.undo;
  d.check(note === 'Undo refunds this $13.00 test payment.', `the purchase tells the portal's Undo button what undo does: "${note}"`);

  // ---------- Face ID: a passkey, and a stolen session that cannot buy ----------
  const face = new Authenticator(); // stands in for Face ID: a P-256 key, like a phone's passkey
  const notOwner = await fetch(`${base}/t/shopper/passkey/register/options`, {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.7', authorization: `Bearer ${phone.token}`, origin: 'https://demo.box.gurtos.com' },
    body: JSON.stringify({ device: 'Not the owner' }),
  });
  d.check(notOwner.status === 400 && /Only the box's own screen or the owner's phone/.test((await notOwner.json()).error), "a paired phone that is not the owner's cannot set up the first Face ID");
  const opts = await page('/t/shopper/passkey/register/options', { device: 'Demo phone' });
  await page('/t/shopper/passkey/register', { device: 'Demo phone', response: face.create(opts, ORIGIN) });
  const status = await (await fetch(`${base}/t/shopper/passkey/status?origin=${encodeURIComponent(ORIGIN)}`)).json();
  const second = await page('/t/shopper/passkey/register/options', { device: 'Stolen laptop' }).then(() => 'allowed', (e: Error) => e.message);
  d.check(status.enrolled && status.usable && status.here && /already set up/.test(second), `Face ID set up on "Demo phone"; adding another passkey needs this one first (${second})`);
  const withFace = async (approval: string) => {
    const o = await page('/t/shopper/passkey/options', { purpose: 'approval', subject: approval });
    const assertion = face.get(o, ORIGIN);
    return { answer: await page('/t/shopper/passkey/approve', { approval, assertion }), assertion };
  };

  // A reorder from the receipts. The plain Approve button (what a stolen pairing token can press) is not enough.
  const reorder = (n: number) => script(`Household reorder ${n} (scripted agent)`, ['shopper.receipts', 'shopper.propose'], [
    'call shopper.receipts {}', `call shopper.propose ${JSON.stringify({ items: [{ sku: 'HV60-100', qty: 1 }, { sku: 'PT-6', qty: 1 }], reason: 'Filters and paper towels run out within two days.' })}`,
  ]);
  const r1 = await finish((await reorder(1)).id);
  const mail = resultOf(r1, 'shopper.receipts')?.output;
  d.check(mail?.receipts.length === 10 && mail.withheld === 2 && mail.estimates.filter((e: any) => e.runningLow).map((e: any) => e.sku).join() === 'HV60-100,PT-6',
    'the agent read 10 receipts from the demo inbox (2 other emails stayed behind): filters and paper towels run out this week');
  d.check(!JSON.stringify(r1).includes(vault.SHOPPER_MAIL_PASSWORD) && !JSON.stringify(r1).includes('482913'), 'it never saw the mailbox login or the sign-in code email');
  const p1 = resultOf(r1, 'shopper.propose').output.proposal;
  await tap((await pending(p1)).id);
  const stolen = await finish(p1);
  d.check(stolen.task.state === 'failed' && /approved without Face ID/.test(stolen.task.error ?? '') && !(await order(p1)),
    `a plain tap with a pairing token approved it, but the box refused to pay: "${stolen.task.error?.slice(0, 90)}..."`);
  const r2 = await finish((await reorder(2)).id);
  const p2 = resultOf(r2, 'shopper.propose').output.proposal;
  const a2 = await pending(p2);
  const { answer, assertion } = await withFace(a2.id);
  const replayed = await page('/t/shopper/passkey/approve', { approval: a2.id, assertion }).then(() => 'accepted', (e: Error) => e.message);
  await finish(p2);
  const o2 = await order(p2);
  d.check(answer.by === 'Face ID on Demo phone' && o2?.mandate.approvedBy.method === 'passkey' && o2.totalCents === 650 + 1149,
    `approved with Face ID, the box checked the signature and paid $17.99 (TEST); the order carries "approved with Face ID on ${o2?.mandate.approvedBy.by}"`);
  d.check(/no such pending/.test(replayed), 'the same Face ID signature cannot be used again');
  await d.api('POST', `/tasks/${p2}/undo`);
  const refunded = await d.waitFor('the refund', async () => (await order(p2))?.refund);
  d.check(refunded.status === 'refunded', `undo on the purchase task refunded the order (${refunded.id})`);

  // ---------- the store refuses anything outside the mandate ----------
  const signedMandate = (await state()).watches.find((x: any) => x.id === w.id).mandate;
  const tryOrder = async (lines: object[], key: string, m = signedMandate) => {
    const b = JSON.stringify({ currency: 'USD', items: lines, mandate: m });
    const r = await post({ 'idempotency-key': key, ...signRequest(vault.SHOPPER_AGENT_KEY, checkoutUrl, b) }, b);
    return { status: r.status, error: (await r.json()).error as string };
  };
  await admin('HV60-100', { priceCents: 800 });
  const pricey = await tryOrder([{ sku: 'HV60-100', priceCents: 800, qty: 1 }], 'demo-m1');
  const other = await tryOrder([{ sku: 'DS-750', priceCents: 399, qty: 1 }], 'demo-m2');
  await admin('HV60-100', { priceCents: 650 });
  const many = await tryOrder([{ sku: 'HV60-100', priceCents: 650, qty: 3 }], 'demo-m3');
  const forged = await tryOrder([{ sku: 'HV60-100', priceCents: 650, qty: 1 }], 'demo-m4', { ...signedMandate, mandate: { ...signedMandate.mandate, maxItemCents: 50_000 } });
  d.check([pricey, other, many].every((x) => x.status === 403) && /over the mandate's \$7\.00/.test(pricey.error) && /not what the mandate is for/.test(other.error) && /more than the mandate's 2/.test(many.error),
    'with a valid TAP signature but outside the mandate, the store refused: a higher price, another item, more items');
  d.check(forged.status === 403 && /does not verify/.test(forged.error), 'a mandate with its limit edited no longer verifies, so the store refused it too');

  // ---------- spending rules, signed with Face ID, checked before any payment ----------
  const rules = { monthlyCents: 10_000, perStore: { 'bestbuy.ca': 3000 }, perCategory: { electronics: 0 }, never: ['gift card'] };
  const plain = await page('/t/shopper/rules', { rules }).then(() => 'saved', (e: Error) => e.message);
  const ro = await page('/t/shopper/passkey/options', { purpose: 'rules', subject: 'rules', payload: rules });
  const saved = await page('/t/shopper/rules', { rules, assertion: face.get(ro, ORIGIN) });
  d.check(/needs Face ID/.test(plain) && saved.method === 'passkey', 'changing the spending rules needs Face ID; saved with it: a $100 monthly cap, $30 at Best Buy, no electronics, never gift cards');
  const cable = await finish((await script('Buy a cable (scripted agent)', ['shopper.propose'], [`call shopper.propose ${JSON.stringify({ items: [{ sku: 'USBC-1M', qty: 1 }], reason: 'A spare cable.' })}`])).id);
  d.check(cable.task.state === 'failed' && /your rule blocks the electronics category/.test(cable.task.error ?? ''), `the box would not even ask: "${cable.task.error}"`);

  // ---------- saving after you buy: price protection and an unused subscription ----------
  await admin('HV60-100', { priceCents: 575 });
  await d.api('POST', '/t/shopper/savings/check', {});
  const back = await d.waitFor('price protection to ask for the difference', async () => (await state()).saved.find((s: any) => s.cents === 150), 30_000);
  const adj = (await state()).orders.find((o: any) => o.id === o1.id)?.adjustments?.[0];
  d.check(back && adj?.refundCents === 150 && adj.payment.test, `the price fell to $5.75 inside the 30 days, so the box asked and the store refunded $1.50 (TEST): "${back.text.slice(0, 70)}..."`);
  await admin('HV60-100', { priceCents: 899 });
  const subs = await finish((await script('Find unused subscriptions (scripted agent)', ['shopper.receipts', 'shopper.proposeCancel'], [
    'call shopper.receipts {}', `call shopper.proposeCancel ${JSON.stringify({ id: 'SUB-STREAM', reason: 'Streaming Plus costs $191.88 a year and nobody has watched it in 74 days.' })}`,
  ])).id);
  const unused = resultOf(subs, 'shopper.receipts').output.subscriptions.filter((s: any) => s.unused).map((s: any) => `${s.name} (${s.unusedDays} days)`);
  const cancelTask = resultOf(subs, 'shopper.proposeCancel').output.proposal;
  const ca = await pending(cancelTask);
  await withFace(ca.id);
  await finish(cancelTask);
  const stream = (await state()).subscriptions.find((s: any) => s.id === 'SUB-STREAM');
  d.check(unused.join() === 'Streaming Plus (74 days)' && stream.status === 'cancelled' && /Cancel Streaming Plus, \$15\.99 a month/.test(ca.question),
    `the receipts showed one unused subscription, ${unused[0]}; approved with Face ID, a signed request cancelled it (TEST)`);

  // ---------- the store's side ----------
  const s = await d.api('GET', '/t/shopper/store/stats');
  d.check(s.orders.count >= 2 && s.orders.withPasskey >= 1 && s.refused.byCode['unsigned (unknown bot)'] >= 1 && s.refused.byCode['over price'] === 1 && s.refused.byCode['wrong item'] === 1 && s.chargebacks === 0,
    `the merchant's dashboard: ${s.orders.count} verified agent orders (${s.orders.withPasskey} with Face ID), ${s.refused.count} refused requests (${Object.entries(s.refused.byCode).map(([k, v]) => `${v} ${k}`).join(', ')}), 0 chargebacks`);
  d.check(s.conversion.sessions >= 1 && s.visits.verified >= 2 && s.evidence.every((e: any) => e.mandate.id && e.agent === 'box-shopper'),
    `conversion from agent shoppers: ${s.conversion.ordered} of ${s.conversion.sessions} shopping sessions ordered; every order keeps its mandate and approval as evidence`);

  // ---------- an agent buys its own supplies with the wallet track's x402 payments ----------
  if (!tools.includes('wallet.pay')) console.log('  skip  supplies over x402: the wallet track is not on this box');
  else {
    // Offline, a stand-in seller gives the same 402 answer as the wallet's test API ($0.03 in devnet USDC). The owner
    // denies the payment, so the wallet never runs and no network or money is needed.
    const offer = { scheme: 'exact', network: 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1', amount: '30000', asset: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU', payTo: '39w7W3SBxE62zsS7VQY5dgZQXGWko2EkBXMfHg2sLtKV', maxTimeoutSeconds: 300 };
    const seller = http.createServer((req, res) => {
      const pr = { x402Version: 2, error: 'Payment required', resource: { url: `http://${req.headers.host}${req.url}`, description: 'A market report (devnet test money)', mimeType: 'application/json' }, accepts: [offer] };
      res.writeHead(402, { 'content-type': 'application/json', 'payment-required': Buffer.from(JSON.stringify(pr)).toString('base64') }).end('{}');
    });
    await new Promise<void>((r) => seller.listen(0, '127.0.0.1', r));
    const host = `api.localhost:${(seller.address() as { port: number }).port}`;
    try {
      const q = await d.api<Task>('POST', '/t/shopper/supplies', { url: `http://${host}/report`, cents: 2 });
      const pay = await d.waitFor('the payment to ask', async () => {
        const p = (await d.api<Task[]>('GET', '/tasks')).find((t) => t.source === `shopper:supplies:pay:${q.id}`);
        const a = p && (await run(p.id)).approvals.find((x) => x.state === 'pending');
        return a && { p, a };
      });
      d.check(q.tools.join() === 'wallet.quote' && pay.p.tools.join() === 'wallet.pay' && pay.a.costCents === 3, `supplies over x402: it asked the price ($0.03), above its 2 cent budget, so it asks first: "${pay.a.question}"`);
      await tap(pay.a.id, false);
      const r = await finish(pay.p.id);
      d.check(r.task.state === 'failed' && r.task.costCents === 0 && !r.events.some((e) => e.type === 'tool.call'), 'denied: the wallet never ran and nothing was spent');
    } finally {
      seller.close();
    }
  }

  const log = fs.readFileSync(path.join(d.home, 'log.jsonl'), 'utf8');
  d.check(!secrets.some((x) => log.includes(x)), 'no card, signing key, mailbox password or payment key anywhere in the action log');

  if (!LIVE) {
    console.log('  skip  real test-mode payments, the Best Buy and Gold Roast comparison, and x402: DEMO_LIVE=shopper ./demo runs them');
    return;
  }

  // ---------- live: x402 on Solana devnet, a real comparison of two stores, then Droid ----------
  if (tools.includes('wallet.pay') && vault.WALLET_SOLANA_KEY) {
    const { startSeller } = await import('../wallet/seller.ts');
    const seller = await startSeller();
    try {
      const t = await d.api<Task>('POST', '/t/shopper/supplies', { url: `http://api.localhost:${seller.port}/report`, cents: 2 });
      const p = await d.waitFor('the live payment to ask', async () => (await d.api<Task[]>('GET', '/tasks')).find((x) => x.source === `shopper:supplies:pay:${t.id}`), 60_000);
      await tap((await pending(p.id)).id);
      const r = await finish(p.id, 120_000);
      const paid = (r.events.findLast((e) => e.type === 'tool.result' && e.ok) as any)?.output?.paid;
      d.check(r.task.state === 'done' && r.task.costCents === 3 && paid?.tx, `approved over its 2 cent budget, the agent bought its supply: a $0.03 report over x402, devnet USDC (test money): ${paid?.explorer}`);
    } finally {
      seller.close();
    }
  } else console.log('  skip  x402 supplies: no wallet track or no WALLET_SOLANA_KEY');

  if (!vault.APIFY_TOKEN) console.log('  skip  live comparison: no APIFY_TOKEN');
  else {
    // The rules allow $30 a month at Best Buy; the filters are about $11 in US dollars, so they fit.
    const lw = await d.api('POST', '/t/shopper/watches', {
      text: 'Chemex filters', offers: [{ store: 'bestbuy.ca', product: '20220310' }, { store: 'goldroast.ca', product: 'chemex filter' }],
      maxCents: 3000, qty: 1, category: 'coffee', days: 6,
    });
    const m = await watch(lw.id, (x) => x.approval, 'the live mandate to ask');
    await withFace(m.approval);
    const c = await watch(lw.id, (x) => x.compared, 'a live check of Best Buy Canada and Gold Roast through Apify', 240_000);
    const rows = c.compared.rows.map((r: any) => `${r.offer.store} $${(r.offer.priceCents / 100).toFixed(2)}`).join(', ');
    d.check(c.compared.rows.length >= 2 && c.compared.best, `Apify read both stores live (${rows}); the box chose ${c.compared.best?.store}: "${c.compared.explanation.slice(0, 140)}"`);
    const buy = await watch(lw.id, (x) => x.approval && x.buyTask, 'the best offer to ask', 30_000);
    await withFace(buy.approval);
    await finish(buy.buyTask, 60_000);
    const o3 = await order(buy.buyTask);
    d.check(o3?.items[0].from === c.compared.best.store && o3.mandate.approvedBy.method === 'passkey', `bought at ${o3?.items[0].from}'s live price with Face ID; checkout at the test store: ${o3?.payment.provider} ${o3?.payment.id}`);
    await d.api('POST', '/t/shopper/watches/cancel', { id: lw.id });
  }

  const droid = vault.FACTORY_API_KEY && /\bdroid\b/.test(process.env.DEMO_LIVE ?? ''); // real Droid spends Factory credit: DEMO_LIVE=droid
  if (!droid) {
    console.log('  skip  Droid with Claude: real Droid is off: DEMO_LIVE=droid ./demo runs it');
    return;
  }
  const subsTask = await d.api<Task>('POST', '/t/shopper/savings/subscriptions');
  const r = await finish(subsTask.id, 240_000);
  d.check(r.task.state === 'done', `Droid read the receipts for unused subscriptions (${r.task.summary?.slice(0, 80) ?? 'done'})`);
  const reorderTask = await d.api<Task>('POST', '/t/shopper/reorder');
  const prop = await d.waitFor('Droid to propose a reorder', async () => (await d.api<Task[]>('GET', '/tasks')).find((t) => t.source === `shopper:propose:${reorderTask.id}`), 240_000);
  const q = (await pending(prop.id)).question;
  d.check(/Hario V60/.test(q) && /Paper towels/.test(q), `Droid read the receipts and proposed: ${q.slice(0, 90)}...`);
  await tap((await pending(prop.id)).id, false);
}
