// The wallet's demo step. Offline by default, since ./demo is everyone's merge gate: the wallet refuses a
// host outside the task's list, and an over-budget payment that the owner denies pays nothing.
// DEMO_LIVE=wallet ./demo also runs the real flow on Solana devnet with test money: a task asks a paid API for
// a joke (402), pays $0.01 within its $0.02 budget and gets the joke. Then a $0.03 report is over budget, so
// it waits for an OK, and goes through once approved. Both payments are checked on chain. The test API settles
// through Coinbase's CDP facilitator when the vault has CDP keys, else through x402.org.
import fs from 'node:fs';
import path from 'node:path';
import type { Approval, DemoKit, LogEvent, Task } from '../../core/contract.ts';
import { PAYEE, cdpKeys, startSeller } from './seller.ts';

type Detail = { task: Task; events: LogEvent[] };

export default async function (d: DemoKit) {
  const health = await d.api('GET', '/health');
  d.check(health.tools.includes('wallet.quote') && health.tools.includes('wallet.pay'), 'the box loaded wallet.quote and wallet.pay');

  // ---------- offline: three refusals, no network and no money ----------
  d.workspace('wallet', {});
  const spec = { workspace: 'wallet', worker: 'fake', source: 'demo', tools: ['wallet.pay'], hosts: ['api.localhost:4021'] };
  const [A, B, C] = await Promise.all([
    d.api<Task>('POST', '/tasks', { ...spec, title: 'Pay the box itself', budgetCents: 5, prompt: 'call wallet.pay {"url":"http://127.0.0.1:7700/approvals","cents":1}' }),
    d.api<Task>('POST', '/tasks', { ...spec, title: 'Buy a report', budgetCents: 2, prompt: 'call wallet.pay {"url":"http://api.localhost:4021/report","cents":3}' }),
    d.api<Task>('POST', '/tasks', { ...spec, title: 'Pay with no price', budgetCents: 5, prompt: 'call wallet.pay {"url":"http://api.localhost:4021/report"}' }),
  ]);
  const ask = await d.waitFor('the over-budget payment to ask', async () =>
    (await d.api<Approval[]>('GET', '/approvals')).find((a) => a.task === B.id && a.state === 'pending'),
  );
  await d.api('POST', `/approvals/${ask.id}`, { approved: false, by: 'demo' });
  const failed = (t: Task) => d.waitFor(`${t.title} to stop`, async () => {
    const r = await d.api<Detail>('GET', `/tasks/${t.id}`);
    return r.task.state === 'failed' ? r : undefined;
  });
  const [a, b, c] = await Promise.all([failed(A), failed(B), failed(C)]);
  const resultOf = (r: Detail) => r.events.findLast((e) => e.type === 'tool.result') as Extract<LogEvent, { type: 'tool.result' }> | undefined;
  d.check(resultOf(a)?.error?.includes("not one of this task's hosts"), `the wallet refused a URL outside the task's hosts: "${resultOf(a)?.error}"`);
  d.check(
    resultOf(b)?.error === 'not approved' && !b.events.some((e) => e.type === 'tool.call') && b.task.costCents === 0,
    `the owner said no to "${ask.question}", so the wallet never ran and nothing was spent`,
  );
  d.check(resultOf(c)?.error?.includes('call wallet.quote first') && c.task.costCents === 0, `with no amount and no quote, it paid nothing: "${resultOf(c)?.error}"`);

  const live = (process.env.DEMO_LIVE ?? '').split(/[\s,]+/).includes('wallet');
  if (!live) {
    console.log('  skip  real payments on Solana devnet: DEMO_LIVE=wallet ./demo runs them');
    return;
  }

  // ---------- live: real payments on Solana devnet, test money ----------
  const status = await d.api('GET', '/t/wallet/status');
  d.check(status.wallet, 'DEMO_LIVE=wallet: WALLET_SOLANA_KEY is in /etc/box/vault.env on this test machine');
  d.check(status.usdc >= 0.04, `the box's agent wallet ${status.wallet} holds ${status.usdc} USDC on Solana devnet (test money)`);

  const vault = fs.readFileSync(path.join(d.home, 'vault.env'), 'utf8');
  const cdp = cdpKeys(vault);
  const seller = await startSeller({ cdp });
  console.log(`  note  the test API settles through ${seller.settledBy}`);
  try {
    const host = `api.localhost:${seller.port}`;
    const api = `http://${host}`;
    const T = await d.api<Task>('POST', '/tasks', {
      ...spec,
      title: 'Buy a joke and a report (devnet USDC, test money)',
      tools: ['wallet.quote', 'wallet.pay'],
      hosts: [host],
      budgetCents: 2,
      prompt: [
        `call wallet.quote {"url":"${api}/joke"}`,
        `call wallet.pay {"url":"${api}/joke","cents":1}`,
        `call wallet.quote {"url":"${api}/report"}`,
        `call wallet.pay {"url":"${api}/report"}`,
        'write done.txt yes',
      ].join('\n'),
    });

    const ask = await d.waitFor('the over-budget payment to ask', async () =>
      (await d.api<Approval[]>('GET', '/approvals')).find((a) => a.task === T.id && a.state === 'pending'),
    );
    const before = await d.api<Detail>('GET', `/tasks/${T.id}`);
    const [quote, joke] = before.events.flatMap((e) => (e.type === 'tool.result' && e.ok ? [e.output as any] : []));
    d.check(quote?.status === 402 && quote.cents === 1 && quote.payee === PAYEE, `GET /joke answered 402 Payment Required: $${quote?.usdc} devnet USDC to ${PAYEE.slice(0, 8)}...`);
    d.check(joke?.status === 200 && joke.content.includes('joke') && joke.paid.tx, `the wallet paid $0.01 and got the joke: ${JSON.parse(joke?.content ?? '{}').joke}`);
    d.check(
      before.task.state === 'waiting' && ask.costCents === 3 && ask.payee === PAYEE,
      `the report named no amount, so the wallet took its quoted $0.03. That is over the $0.02 budget, so the task waits: "${ask.question}"`,
    );

    await d.api('POST', `/approvals/${ask.id}`, { approved: true, by: 'demo' });
    const [done] = await d.settled([T.id]);
    const { events } = await d.api<Detail>('GET', `/tasks/${T.id}`);
    const paid = events.flatMap((e) => (e.type === 'tool.result' && e.ok && (e.output as any).paid ? [(e.output as any).paid] : []));
    const report = events.findLast((e) => e.type === 'tool.result') as any;
    d.check(report.ok && report.output.content.includes('report'), 'approved, it paid $0.03 and got the report');
    d.check(done.costCents === 4, `both payments count toward the task's cost: $${(done.costCents / 100).toFixed(2)}`);
    const steps = events.filter((e) => e.type === 'task.step' && e.text.startsWith('Paid $'));
    d.check(
      paid.length === 2 && steps.length === 2 && paid.every((p) => p.payee === PAYEE && p.network === 'solana-devnet' && p.test),
      'the log has each payment with its amount, payee, task and transaction, labeled devnet test money',
    );
    const html = await d.waitFor('both payments on the wallet page', async () => {
      const page = await (await fetch(`${d.url}/t/wallet/`)).text();
      return paid.every((p) => page.includes(p.tx)) ? page : undefined;
    });
    d.check(html.includes('TEST MONEY') && html.includes(T.title), 'the Agent wallet page lists both payments: time, amount, payee, task and transaction, as test money');

    const r = await fetch('https://api.devnet.solana.com', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getSignatureStatuses', params: [paid.map((p) => p.tx), { searchTransactionHistory: true }] }),
    });
    const onChain = (await r.json()).result.value;
    d.check(
      onChain.every((s: any) => s && !s.err && ['confirmed', 'finalized'].includes(s.confirmationStatus)),
      `both transactions, settled by ${seller.settledBy}, are confirmed on Solana devnet: ${paid[1].explorer}`,
    );

    const key = vault.match(/^WALLET_SOLANA_KEY=(.+)$/m)?.[1];
    const log = JSON.stringify(events);
    d.check(key && !log.includes(key) && !(cdp && log.includes(cdp.apiKeySecret)), "neither the wallet's key nor the CDP secret is anywhere in the task's log");
  } finally {
    seller.close();
  }
}
