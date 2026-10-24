# Agent wallet: x402 payments in USDC on Solana devnet

**Every payment here is test money: USDC on Solana devnet, which has no value.**

## Summary

**Who it's for.** People who leave AI agents running unattended on a home machine and want them to buy what
a job needs, such as an API call, without handing an agent a private key or a card.

**What it does.** Agents on the box pay for HTTP APIs that answer `402 Payment Required`, using x402. The box
holds the wallet in its vault. A task only ever sees results. Each task has a budget: a payment that fits
goes through, and one above it pauses the task until the owner approves it on the portal or phone. Other
tasks keep running meanwhile. Every payment goes into the box's action log with its amount, payee, task and
Solana transaction, and counts toward the task's cost.

**Coinbase tools.**
- The x402 v2 TypeScript SDK: `@x402/fetch` and `@x402/core` to pay, `@x402/svm` for Solana payments,
  `@x402/express` for the test API that charges.
- The x402.org facilitator, which Coinbase runs. It checks each payment, submits it to Solana and pays the
  network fee.
- Not yet: Coinbase's CDP facilitator and CDP wallets. They need CDP API keys, which this box does not have
  yet (see "Next" below).

**Solana.** Payments are USDC on Solana devnet (Circle's devnet mint
`4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`). The box signs an SPL `TransferChecked` from its wallet, the
facilitator pays the fee and submits it, and the demo checks each transaction is confirmed on chain. Every
receipt links to the Solana Explorer.

## What the demo shows

`./demo` is everyone's merge gate, so by default this step stays offline: no network and no money. It shows
two refusals. A task cannot point the wallet at the box's own API, and when the owner denies an
over-budget payment, the wallet never runs.

`DEMO_LIVE=wallet ./demo` adds the real flow on Solana devnet, with a scripted agent so it gives the same
result each time. Run it before merging a change to this folder. It passed on 2026-10-23 on the linuxbox VM
(x86) and the laptop VM (ARM64):

```
track wallet
  ok    the box loaded wallet.quote and wallet.pay
  ok    the wallet refused a URL outside the task's hosts: "127.0.0.1:7700 is not one of this task's hosts"
  ok    the owner said no to "Spend $0.03 on wallet.pay? Budget $0.02, spent $0.00.", so the wallet never ran and nothing was spent
  ok    DEMO_LIVE=wallet: WALLET_SOLANA_KEY is in /etc/box/vault.env on this test machine
  ok    the box's agent wallet 6PyiR71c9aw3e8bgnxmcLvJECL5zHE5jMSWqJoVjPTxU holds 19.83 USDC on Solana devnet (test money)
  ok    GET /joke answered 402 Payment Required: $0.01 devnet USDC to 39w7W3SB...
  ok    the wallet paid $0.01 and got the joke: An agent walks into a bar. The bar answers 402.
  ok    the $0.03 report is over the $0.02 budget, so the task waits: "Spend $0.03 on wallet.pay? Budget $0.02, spent $0.01."
  ok    approved, it paid $0.03 and got the report
  ok    both payments count toward the task's cost: $0.04
  ok    the log has each payment with its amount, payee, task and transaction, labeled devnet test money
  ok    both transactions are confirmed on Solana devnet: https://explorer.solana.com/tx/27YsyeSK...?cluster=devnet
  ok    the wallet's key is nowhere in the task's log
```

The same flow also ran with a real agent, Factory's Droid with Claude Sonnet 4.6, given only "buy one joke and
one report, then write both into answers.md". It quoted both URLs, paid $0.01, waited for the OK on the $0.03
report, paid it once approved, and wrote the file. The task's cost was 6 cents: 4 for the two payments and 2
for the model.

## Try it

You need a box (see `core/README.md`; any Ubuntu 24.04 test VM with `core/setup.sh` run on it).

1. **Make a wallet.** This prints the vault line, and the address on stderr:
   ```sh
   node --experimental-strip-types tracks/wallet/keygen.ts | sudo sh -c 'cat >> /etc/box/vault.env; chmod 600 /etc/box/vault.env'
   ```
2. **Fund it with devnet USDC.** Open https://faucet.circle.com, keep **USDC**, set **Network** to
   **Solana Devnet**, paste the address, and press **Send 20 USDC**. The faucet gives 20 USDC per address
   every 2 hours. The wallet needs no SOL, because the facilitator pays the fees.
3. **A payee.** The test API pays `39w7W3SBxE62zsS7VQY5dgZQXGWko2EkBXMfHg2sLtKV`, which already has a devnet
   USDC account. To use your own payee, run the faucet once for that address too: x402 cannot pay an
   address that has no USDC account yet.
4. **Run the demo:** `DEMO_LIVE=wallet ./demo` from the repo root. It ships the checkout to the test VM and
   runs every step, with real devnet payments for this track.
5. **Or by hand**, on the box:
   ```sh
   node --experimental-strip-types tracks/wallet/seller.ts &       # the test API on port 4021
   curl -s 127.0.0.1:7700/tasks -H 'content-type: application/json' -d '{
     "title": "Buy a joke (devnet test money)", "worker": "droid",
     "tools": ["wallet.quote", "wallet.pay"], "hosts": ["api.localhost:4021"], "budgetCents": 2,
     "prompt": "http://api.localhost:4021/joke is a paid API. Buy one joke with the box wallet and write it to joke.md."}'
   curl -s 127.0.0.1:7700/approvals                                # anything waiting for your OK
   curl -s 127.0.0.1:7700/t/wallet/                                # the wallet's address and devnet balance
   ```

Tests for the wallet's guards (no money moves): `node --experimental-strip-types --test tracks/wallet/wallet.test.ts`.

## How it works

```
  task (its own Linux user, no key)          the box's core (root)                       outside
  ─────────────────────────────────          ─────────────────────                       ───────
  agent ── wallet.quote {url} ──► broker ──► GET url ───────────────────────────────►  test API
                                                     ◄── 402 + PAYMENT-REQUIRED (price, payee)
        ◄── { cents, payee } ────
  agent ── wallet.pay {url, cents} ► broker: over budget? ask the owner, wait for OK
                                     wallet.pay: read WALLET_SOLANA_KEY from the vault,
                                     check the offer, sign a USDC transfer
                                     GET url + PAYMENT-SIGNATURE ─────────────────►  test API ──► facilitator
                                                                                                  (verify, pay fee,
                                                                                                   submit to Solana)
                                                     ◄── 200 + content + PAYMENT-RESPONSE (tx)
        ◄── { content, paid } ───    log: tool.call, "Paid $0.01 ... to <payee>", tool.result with cents
```

- `track.ts`: the two tools, `wallet.quote` and `wallet.pay`, plus the `/t/wallet/` page.
- `seller.ts`: the test API. `GET /joke` costs $0.01 and `GET /report` $0.03.
- `demo.ts`: the demo step. `wallet.test.ts`: the guard tests. `keygen.ts`: makes a wallet.
- `skill/x402-wallet/SKILL.md`: tells any agent in a box task how to pay (below).

### Controls

- **The key stays in the core.** It lives in `/etc/box/vault.env` (root only). Only `wallet.pay` can read it,
  inside the box's own process. A task runs as its own Linux user with no way to read the vault, and only
  gets results back. The demo checks the key is nowhere in the task's log.
- **Budget, then the owner.** The broker counts each payment toward the task's budget. Above it, the task
  waits until someone answers on the portal or phone. Denied means nothing is paid.
- **Exactly the agreed price.** `wallet.pay` names the amount, which is what the budget check and the owner
  saw. If the API asks for anything else, it pays nothing.
- **Only devnet USDC.** It pays only the `exact` scheme on Solana devnet in devnet USDC. The x402 client also
  refuses any single payment over $1, its default.
- **Only the task's hosts.** The wallet reaches only hosts in the task's `hosts`, by the same rule as the
  task's network, and refuses redirects. So a task cannot use it to reach the box's own API or anywhere else.
- **Never twice.** Before paying, the wallet writes a durable mark for that call. If the box loses power in
  the middle of a payment, the resumed call refuses to pay again instead of guessing.
- **Everything in the log.** Each quote and payment is a step in the task's log, labeled as devnet test money,
  with the amount, payee, task and transaction. The cost sits on the result line, so it counts once.

### Known limits

- Devnet only, by design. Mainnet needs a different network and asset in `track.ts`, real USDC and a review.
- The approval question comes from the core: "Spend $0.03 on wallet.pay? Budget $0.02, spent $0.01." It does
  not name the payee or URL yet. The quote step just before it, in the same task's log, does.
- Two payments made at the same moment can together go over the budget, because the broker checks each call
  against what is already spent, not what is in flight. Droid does make parallel calls.
- `GET` only. APIs that want a `POST` body are not supported yet.
- After a power cut in the middle of a payment, the call fails rather than checking the chain for whether the
  payment went through. The owner checks the wallet on the explorer.
- The box holds the wallet's key itself. A CDP wallet would keep the key with Coinbase (see "Next").
- API responses are cut at 20 KB.
- Each live demo run spends 4 cents of devnet USDC. 20 USDC from the faucet covers about 500 runs.

### Next

- **CDP facilitator.** With CDP keys, swap the facilitator in `seller.ts` for `createCdpFacilitatorClient()`
  from `@coinbase/cdp-sdk/x402`. It reads `CDP_API_KEY_ID` and `CDP_API_KEY_SECRET` and supports Solana
  devnet.
- **CDP wallet.** With a CDP wallet secret as well (`CDP_WALLET_SECRET`), the box could hold only CDP
  credentials and let Coinbase sign, so no private key would be on the box at all.

## The skill

`skill/x402-wallet/SKILL.md` teaches any agent in a box task to pay: quote, pay the exact price, wait when over
budget, never look for a key. It also shows how a program without MCP calls the same tools through the
task's broker socket. Install it for Droid by copying the folder into the workspace as
`.factory/skills/x402-wallet/`, or for Claude Code into `~/.claude/skills/x402-wallet/`.

## Builder feedback

See [FEEDBACK.md](FEEDBACK.md): what worked, and eight points of friction with the x402 SDK and CDP.
