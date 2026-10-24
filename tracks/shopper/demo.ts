// The shopper's demo step. Offline by default: the Box Test Store, the demo inbox and simulated test payments,
// with the fake worker playing the agent. DEMO_LIVE=shopper adds a live Best Buy watch through Apify, a Stripe
// test-mode charge (once STRIPE_SECRET_KEY is in the vault), and Droid reading the receipts and setting a watch.
import fs from 'node:fs';
import path from 'node:path';
import type { Approval, DemoKit, LogEvent, Task } from '../../core/contract.ts';
import { publicKeyOf, signRequest } from './tap.ts';

const LIVE = /\b(shopper|visa)\b/.test(process.env.DEMO_LIVE ?? '');

export default async function (d: DemoKit) {
  const { tools } = await d.api<{ tools: string[] }>('GET', '/health');
  d.check(['shopper.buy', 'shopper.checkPrice', 'shopper.receipts', 'shopper.propose', 'shopper.watch'].every((t) => tools.includes(t)), 'the box loaded the shopper tools');

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
  const secrets = [vault.SHOPPER_CARD, vault.SHOPPER_AGENT_KEY, vault.SHOPPER_MAIL_PASSWORD, vault.STRIPE_SECRET_KEY].filter(Boolean);
  const base = `http://127.0.0.1:${fs.readFileSync(path.join(d.home, 'api.port'), 'utf8').trim()}`;
  const watch = async (id: string, want: (w: any) => unknown, what: string, ms = 20_000) =>
    d.waitFor(what, async () => (await state()).watches.find((w: any) => w.id === id && want(w)), ms);
  const run = (id: string) => d.api<{ task: Task; approvals: Approval[]; events: LogEvent[] }>('GET', `/tasks/${id}`);
  const finish = (id: string, ms = 20_000) => d.waitFor(`task ${id} to finish`, async () => { const r = await run(id); return ['done', 'failed', 'undone'].includes(r.task.state) ? r : undefined; }, ms);
  const approve = (id: string, approved = true) => d.api('POST', `/approvals/${id}`, { approved, by: 'phone' });
  const order = async (task: string) => (await state()).orders.find((o: any) => o.task === task);

  // ---------- Visa Trusted Agent Protocol at the store's checkout ----------
  const reg = await d.api('GET', '/t/shopper/keys/box-shopper');
  d.check(reg.public_key === publicKeyOf(vault.SHOPPER_AGENT_KEY) && reg.algorithm === 'ed25519', "the agent registry serves the box's TAP public key, never the private one");
  const checkoutUrl = `${base}/t/shopper/store/checkout`;
  const post = (headers: Record<string, string>, body: string) => fetch(checkoutUrl, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body });
  const body = JSON.stringify({ currency: 'USD', card: 'pm_card_visa', items: [{ sku: 'HV60-DRIP', priceCents: 2700, qty: 1 }] });
  const unsigned = await post({ 'idempotency-key': 'demo-1' }, body);
  d.check(unsigned.status === 401 && /unsigned/.test((await unsigned.json()).error), 'the store refuses an unsigned order (an agent without the box\'s key)');
  const sig = signRequest(vault.SHOPPER_AGENT_KEY, checkoutUrl, body);
  const changed = await post({ 'idempotency-key': 'demo-2', ...sig }, body.replace('"qty":1', '"qty":5'));
  d.check(changed.status === 401 && /changed/.test((await changed.json()).error), 'a signed order changed in transit is refused: the signature covers the body');
  const once = await post({ 'idempotency-key': 'demo-3', ...sig }, body);
  const replay = await post({ 'idempotency-key': 'demo-4', ...sig }, body);
  d.check(once.status === 409 && replay.status === 401 && /replay/.test((await replay.json()).error), 'a captured signature cannot be used twice (the dripper is sold out, so nothing was charged)');

  // ---------- flow 1: watch a price, buy after the OK ----------
  await d.api('POST', '/t/shopper/store/admin', { sku: 'HV60-100', priceCents: 899, inStock: true });
  const w = await d.api('POST', '/t/shopper/watches', { store: 'test', product: 'HV60-100', maxCents: 700, qty: 2, when: 'price', everyMinutes: 60 });
  const first = await watch(w.id, (x) => x.last, 'the first scheduled check');
  d.check(first.last.priceCents === 899 && first.status === 'watching', `a check task (no network, no secrets) saw ${first.name} at $8.99: above the $7.00 limit, so it keeps watching`);
  await d.api('POST', '/t/shopper/store/admin', { sku: 'HV60-100', priceCents: 650 });
  await d.api('POST', '/t/shopper/watches/check', { id: w.id });
  const asking = await watch(w.id, (x) => x.approval, 'the price drop to ask for an OK');
  const ask = (await run(asking.buyTask)).approvals[0];
  d.check(/^Buy 2 × Hario V60 02 paper filters, 100 count for \$13\.00\? \$6\.50 each, down from \$8\.99/.test(ask.question) && /TEST PAYMENT/.test(ask.question),
    `it dropped to $6.50, and the buy waits for the owner: "${ask.question.slice(0, 70)}..."`);
  await approve(ask.id);
  const bought = await finish(asking.buyTask);
  const o1 = await order(asking.buyTask);
  d.check(bought.task.state === 'done' && bought.task.costCents === 1300 && o1?.totalCents === 1300, 'approved from the phone, it paid $13.00 within the $14.00 budget');
  d.check(o1.payment.test && o1.payment.card === 'Visa test card ending 4242' && o1.agent.keyId === 'box-shopper',
    `the store verified the TAP signature, then charged a TEST payment: ${o1.payment.card}, ${o1.payment.provider} ${o1.payment.id}`);
  const stripe = LIVE && !!vault.STRIPE_SECRET_KEY;
  if (stripe) d.check(o1.payment.provider === 'stripe test mode' && /^pi_/.test(o1.payment.id), `Stripe test mode took the charge (${o1.payment.id})`);
  else d.check(o1.payment.provider === 'simulated', `no Stripe call in this run: the payment is simulated and says so (${o1.payment.note})`);
  d.check((await watch(w.id, (x) => x.status === 'bought', 'the watch to close')).status === 'bought', 'the watch closed: one purchase, no repeats');

  // ---------- flow 2: receipts from the demo inbox, a proposal, the OK, then undo refunds it ----------
  d.workspace('shopper', {});
  const reader = await d.api<Task>('POST', '/tasks', {
    title: 'Household reorder (scripted agent)', workspace: 'shopper', worker: 'fake', source: 'demo', tools: ['shopper.receipts', 'shopper.propose'],
    prompt: ['call shopper.receipts {}', `call shopper.propose ${JSON.stringify({ items: [{ sku: 'HV60-100', qty: 1 }, { sku: 'PT-6', qty: 1 }], reason: 'Filters and paper towels run out within two days.' })}`].join('\n'),
  });
  const r = await finish(reader.id);
  const result = (tool: string) => (r.events.find((e) => e.type === 'tool.call' && e.tool === tool) as any)?.key;
  const out = (tool: string) => (r.events.find((e) => e.type === 'tool.result' && e.key === result(tool)) as any)?.output;
  const mail = out('shopper.receipts');
  d.check(r.task.state === 'done' && mail?.receipts.length === 10 && mail.withheld === 2, 'the agent got 10 receipts from the demo inbox; 2 other emails stayed in the mailbox');
  d.check(mail.estimates.filter((e: any) => e.runningLow).map((e: any) => e.sku).join() === 'HV60-100,PT-6', 'the receipts show filters and paper towels run out this week');
  d.check(!JSON.stringify(r).includes(vault.SHOPPER_MAIL_PASSWORD) && !JSON.stringify(r).includes('482913'), 'it never saw the mailbox login or the sign-in code email');
  const proposal = out('shopper.propose');
  const pending = await d.waitFor('the reorder to ask', async () => (await run(proposal.proposal)).approvals.find((a) => a.state === 'pending'));
  d.check(proposal.totalCents === 650 + 1149 && /Reorder for the household/.test(pending.question), `the proposal used the store's prices and waits for the owner: ${pending.question.slice(0, 60)}...`);
  await approve(pending.id);
  await finish(proposal.proposal);
  const o2 = await order(proposal.proposal);
  d.check(o2?.totalCents === 1799 && o2.payment.test, 'approved, the reorder was paid: $17.99 TEST payment');
  await d.api('POST', `/tasks/${proposal.proposal}/undo`);
  const refunded = await d.waitFor('the refund', async () => (await order(proposal.proposal))?.refund);
  d.check(refunded.status === 'refunded', `undo on the purchase task refunded the order (${refunded.id})`);
  if (stripe) d.check(/^re_/.test(refunded.id), 'Stripe test mode made the refund');

  // ---------- flow 3: an agent buys its own supplies with the wallet track's x402 payments ----------
  if (!tools.includes('wallet.pay')) console.log('  skip  supplies over x402: the wallet track is not on this box');
  else {
    // Port 9 answers nothing, so offline this task stops at its quote and pays nothing.
    const s = await d.api<Task>('POST', '/t/shopper/supplies', { url: 'http://api.localhost:9/report', cents: 3 });
    d.check(s.tools.join() === 'wallet.quote,wallet.pay' && s.hosts.join() === 'api.localhost:9' && s.budgetCents === 3,
      'supplies over x402: the task holds only the wallet tools, reaches only the seller, and may spend 3 cents');
    await finish(s.id);
  }

  const log = fs.readFileSync(path.join(d.home, 'log.jsonl'), 'utf8');
  d.check(!secrets.some((s) => log.includes(s)), 'no card, signing key, mailbox password or Stripe key anywhere in the action log');

  if (!LIVE) {
    console.log('  skip  live Best Buy watch, Stripe and Droid: run with DEMO_LIVE=shopper');
    return;
  }

  // ---------- live: x402 supplies on Solana devnet, Droid, then Best Buy Canada through Apify ----------
  if (tools.includes('wallet.pay') && vault.WALLET_SOLANA_KEY) {
    const { startSeller } = await import('../wallet/seller.ts');
    const seller = await startSeller();
    try {
      const t = await d.api<Task>('POST', '/t/shopper/supplies', { url: `http://api.localhost:${seller.port}/report`, cents: 3 });
      const r = await finish(t.id, 120_000);
      const paid = (r.events.findLast((e) => e.type === 'tool.result' && e.ok) as any)?.output?.paid;
      d.check(r.task.state === 'done' && r.task.costCents === 3 && paid?.tx, `the agent bought its own supply: a $0.03 report over x402, devnet USDC (test money): ${paid?.explorer}`);
    } finally {
      seller.close();
    }
  } else console.log('  skip  x402 supplies: no wallet track or no WALLET_SOLANA_KEY');
  const droid = vault.FACTORY_API_KEY && !process.env.DEMO_SKIP_DROID;
  if (!droid) console.log('  skip  Droid reorder and watch: no FACTORY_API_KEY, or --skip-droid');
  else {
    const reorder = await d.api<Task>('POST', '/t/shopper/reorder');
    const prop = await d.waitFor('Droid to propose a reorder', async () => (await d.api<Task[]>('GET', '/tasks')).find((t) => t.source === `shopper:propose:${reorder.id}`), 240_000);
    const a = await d.waitFor('its question', async () => (await run(prop.id)).approvals[0]);
    d.check(/Hario V60/.test(a.question) && /Paper towels/.test(a.question), `Droid read the receipts and proposed: ${a.question.slice(0, 90)}...`);
    await approve(a.id, false);
    d.check((await finish(prop.id)).task.state === 'failed' && !(await order(prop.id)), 'denied from the phone: nothing was bought');
  }
  if (!vault.APIFY_TOKEN) {
    console.log('  skip  live Best Buy watch: no APIFY_TOKEN');
    return;
  }
  // Chemex filters, SKU 20220310: Best Buy Canada does not sell Hario V60 filters.
  const lw = await d.api('POST', '/t/shopper/watches', { store: 'bestbuy.ca', product: '20220310', maxCents: 3000, qty: 1, when: 'price', everyMinutes: 60 });
  const seenLive = await watch(lw.id, (x) => x.approval || x.lastError, 'a live Best Buy check through Apify to find the filters under $30', 180_000);
  d.check(seenLive.approval, `Apify read Best Buy live: ${seenLive.last?.name?.slice(0, 40)} at $${(seenLive.last?.priceCents / 100).toFixed(2)} CAD${seenLive.lastError ? ` (${seenLive.lastError})` : ''}`);
  await approve(seenLive.approval);
  await finish(seenLive.buyTask, 60_000);
  const o3 = await order(seenLive.buyTask);
  d.check(o3?.items[0].from === 'bestbuy.ca' && o3.items[0].priceCents === seenLive.last.priceCents, `bought at Best Buy's live price, checkout at the test store: ${o3?.payment.provider} ${o3?.payment.id}`);
  if (droid) {
    const asked = await d.api<Task>('POST', '/t/shopper/ask', { text: "Get me the Chemex coffee filters at Best Buy when they're under $14" });
    const w2 = await d.waitFor('Droid to set up the watch', async () => (await state()).watches.find((x: any) => x.by === `task:${asked.id}`), 240_000);
    d.check(w2.store === 'bestbuy.ca' && w2.product === '20220310' && [1399, 1400].includes(w2.maxCents), `Droid turned the words into a watch: ${w2.name?.slice(0, 40)} under $${(w2.maxCents / 100).toFixed(2)} CAD`);
    await d.api('POST', '/t/shopper/watches/cancel', { id: w2.id });
  }
}
