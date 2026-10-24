# Agent wallet: agents that pay and earn, with two locks on the money

**Every payment here is test money: USDC on Solana devnet, which has no value.**

## The problem

Giving an AI agent money today means handing it your card or a wallet key, on a computer or a cloud where it
can reach everything. If a web page tricks it, it can drain the wallet, and you can't see it happen or stop it.
Ordinary operating systems have no layer for this, and the systems that do are heavy.

## What we built

GurtOS is an environment for agents: a small OS for a computer you own (an old laptop is enough). Every agent
task runs as its own Linux user, with no keys, and reaches only the hosts it was given. The wallet is one app
in that environment, and everything below runs on top of it:

- **The key never reaches the agent.** It sits in the box's vault, or with Coinbase (CDP Server Wallet). A task
  calls `wallet.pay` and gets the result, never the key.
- **Two locks on the money.** GurtOS checks every payment against the task's budget and asks you on your phone
  above it. Then Coinbase's policy engine checks it again: only listed payees, at most the cap, USDC only. Even
  a box that is taken over can't pay outside Coinbase's policy.
- **Everything is on the record.** Every payment and sale lands in the box's action log with amount, payee,
  task and transaction. Every payment carries its task id on chain. Once a day the log's fingerprint is
  written to Solana, so nobody can quietly edit it later.
- **It pays and it earns.** Agents buy paid APIs (x402), shop for them in Coinbase's Bazaar, and pay metered
  APIs with a hard cap. The box sells its own services over x402 too, so a box can pay another box.
- **Reuse it anywhere.** GurtOS is open source (Apache-2.0). One command installs the same wallet as an MCP
  server for Claude Code, Factory Droid or any MCP agent, with the same budget and approval rules.

**Who it's for.** GurtOS Server: people who leave agents running 24/7 on a home machine or a cloud VM, and
want them to buy what a job needs without handing over a card. GurtOS Business: company agents that spend
under company rules, where Coinbase's policy is the company's hard limit and the action log is the audit trail.

**Security is the headline.** The interesting part is not that an agent can pay. It is that a tricked agent
can't overspend, can't pay a stranger, can't read the key, and leaves a record you can check.

## The eight parts, and why each is there

Coinbase judges usefulness, technical design, ease of reuse and builder feedback. Each part names the ones it
serves.

| # | Part | What it does | Serves |
|---|---|---|---|
| 1 | **The box earns** | `/t/wallet/sell/*` sells three services over x402: the box's audit proof ($0.01), search of the owner's published files (metered, $0.002 a result, at most $0.02), and renting the box's agent ($0.25, runs only after the owner approves). Settled by Coinbase's CDP facilitator, declared for the x402 **Bazaar**. Daily sales cap. | usefulness, technical design |
| 2 | **Agents shop for APIs** | `wallet.discover` searches Coinbase's **x402 Bazaar**, ranks offers payable first and cheapest first, and drops anything above the agent's limit or the task's remaining budget. | usefulness, reuse |
| 3 | **Two locks** | With CDP keys the wallet is a **CDP Server Wallet**: Coinbase holds the key and its **policy engine** signs only for listed payees, under the cap, in USDC. GurtOS's budgets and phone approvals come first. Without CDP keys, the same list and cap are enforced by GurtOS alone, and the page says so. | technical design, usefulness |
| 4 | **Metered APIs** | `wallet.payMetered` pays x402 **upto** offers: the agent authorizes a cap, the seller charges for what it used. Budgets and approvals see the cap. | technical design |
| 5 | **Reuse in one command** | `install.sh` installs the wallet as an MCP server and skill for Claude Code, Droid or any MCP client. It runs the same code with a budget and an approval prompt (MCP elicitation). | ease of reuse |
| 6 | **Top up from the phone** | A Top up section opens a Coinbase **Onramp** session in sandbox mode for the wallet's address. | usefulness |
| 7 | **Solana** | USDC payments on devnet; a memo with the task id on every payment; a daily log fingerprint on chain; box-to-box payments. | technical design |
| 8 | **Builder feedback** | [FEEDBACK.md](FEEDBACK.md), kept as each Coinbase tool was used. | feedback |

## What the demo shows

`./demo` is everyone's merge gate, so this step is offline by default: no money moves. It shows that the
wallet refuses a URL outside the task's hosts, pays nothing when the owner says no or when a call names no
price, and that a stranger with no pairing token can read the box's price list but not its wallet or log.

`DEMO_LIVE=wallet ./demo` adds the real flow on Solana devnet through Coinbase's CDP facilitator, with a
scripted agent so it gives the same result each time. On 2026-10-24 on the test VM:

```
track wallet
  ok    the box loaded wallet.quote and wallet.pay
  ok    the wallet refused a URL outside the task's hosts: "127.0.0.1:7700 is not one of this task's hosts"
  ok    the owner said no to "Spend $0.03 to api.localhost:4021 on wallet.pay (http://api.localhost:4021/report in devnet USDC (test money))? Budget $0.02, spent $0.00.", so the wallet never ran and nothing was spent
  ok    with no amount and no quote, it paid nothing: "no quoted price for this URL: call wallet.quote first, or pass cents"
  ok    a stranger sees the box's price list (audit proof, metered search, rent the agent) but not its audit log or wallet
  ok    DEMO_LIVE=wallet: WALLET_SOLANA_KEY is in /etc/box/vault.env on this test machine
  ok    the box's agent wallet 6PyiR71c9aw3e8bgnxmcLvJECL5zHE5jMSWqJoVjPTxU holds 20.146 USDC on Solana devnet (test money)
  note  the test API settles through Coinbase's CDP facilitator
  ok    GET /joke answered 402 Payment Required: $0.01 devnet USDC to 39w7W3SB...
  ok    the wallet paid $0.01 and got the joke: An agent walks into a bar. The bar answers 402.
  ok    the report named no amount, so the wallet took its quoted $0.03. That is over the $0.02 budget, so the task waits: "Spend $0.03 to 39w7W3SBxE62zsS7VQY5dgZQXGWko2EkBXMfHg2sLtKV on wallet.pay (...)? Budget $0.02, spent $0.01."
  ok    approved, it paid $0.03 and got the report
  ok    both payments count toward the task's cost: $0.04
  ok    the log has each payment with its amount, payee, task and transaction, labeled devnet test money
  ok    the Agent wallet page lists both payments: time, amount, payee, task and transaction, as test money
  ok    both transactions, settled by Coinbase's CDP facilitator, are confirmed on Solana devnet
  ok    neither the wallet's key nor the CDP secret is anywhere in the task's log
  ok    box to box: this box's agent paid the other box $0.01 and got its audit proof
  ok    metered: the search was capped at $0.02 and charged $0.002 for what it returned
  ok    the task's cost counts both: $0.03
  ok    the payment carries its task id on chain, as a memo: https://explorer.solana.com/tx/43qZ2RkkxDzL79BSSGYGa7XgUo4vQSfPBpmyJS6uTZt2qxp2Z7DzbcMqbPoeJyGpypkji4BotEMdNeHTd3rCdo61?cluster=devnet
  ok    the action log's fingerprint (seq 595) is on Solana devnet and still matches the log: https://explorer.solana.com/tx/ucAykCvhTuYH6DYzyaJPNCpp83QDK67mXrVgbnXZWoYpZnbtQyg2hhPUTjVLdBsFk91VFe57p8ZHwUMmjgWij5c?cluster=devnet
```

The "other box" in the box-to-box step is a second shop served in the same run with its own wallet, because
Coinbase's facilitator refuses a wallet paying itself (`self_send_not_allowed`).

A real agent did the same: Factory's Droid with Claude, told only "buy one joke and one report, then write
both into answers.md", quoted both, paid $0.01, waited for the OK on the $0.03 report, paid it once approved,
and wrote the file. And a real Claude Code session, with the wallet installed by the one-command installer,
quoted and paid $0.01 for a joke over MCP.

## Try it on a box

You need a GurtOS box (a release image, or any Ubuntu 24.04 VM with `core/setup.sh` run on it).

1. **Make a wallet.** This prints the vault line, and the address on stderr:
   ```sh
   node --experimental-strip-types tracks/wallet/keygen.ts | sudo sh -c 'cat >> /etc/box/vault.env; chmod 600 /etc/box/vault.env'
   ```
2. **Fund it with devnet USDC.** Open https://faucet.circle.com, keep **USDC**, set **Network** to
   **Solana Devnet**, paste the address, and press **Send 20 USDC** (20 per address every 2 hours). The
   wallet needs no SOL for payments: the facilitator pays the fees. The daily log fingerprint needs a little
   devnet SOL, which the box gets from Coinbase's faucet when it has CDP keys.
3. **CDP keys** (recommended). In the CDP Portal (portal.cdp.coinbase.com) create a Secret API Key and add
   `CDP_API_KEY_ID=...` and `CDP_API_KEY_SECRET=...` to the vault. Payments and sales then settle through
   Coinbase's CDP facilitator, which also lists the box's services in the Bazaar. Without them they settle
   through x402.org and everything else works the same.
4. **The second lock** (optional). In the CDP Portal, under Server Wallet, generate a Wallet Secret and add
   `CDP_WALLET_SECRET=...`. The wallet becomes a CDP Server Wallet named `gurtos-agent-wallet`. Set its policy
   from your phone or the box's screen: `POST /t/wallet/policy {"payees": ["<address>", ...],
   "maxCentsPerPayment": 5}`. Then, in the portal, remove the `policies#manage` scope from the box's API key,
   so the box itself can no longer loosen the policy.
5. **Run the demo:** `DEMO_LIVE=wallet ./demo` from the repo root.
6. **Or by hand**, on the box:
   ```sh
   sudo node --experimental-strip-types tracks/wallet/seller.ts &  # a test API on port 4021
   curl -s 127.0.0.1:7700/tasks -H 'content-type: application/json' -d '{
     "title": "Buy a joke (devnet test money)", "worker": "droid",
     "tools": ["wallet.quote", "wallet.pay"], "hosts": ["api.localhost:4021"], "budgetCents": 2,
     "prompt": "http://api.localhost:4021/joke is a paid API. Buy one joke with the box wallet and write it to joke.md."}'
   curl -s 127.0.0.1:7700/approvals                                # anything waiting for your OK
   ```
   The Agent wallet window (in the portal, or `/t/wallet/` on the box) shows the balance, the two locks,
   every payment and every sale, and the Top up section.

## Use the wallet in your own agent

GurtOS is open source (Apache-2.0), so the wallet is not tied to a box. One command installs it as an MCP
server for Claude Code, Factory Droid or any MCP client (needs Node 22.18+ and git):

```sh
curl -fsSL https://raw.githubusercontent.com/benz16107/calhacks13/main/tracks/wallet/install.sh | sh
```

It makes a Solana devnet key (mode 0600, in `~/.gurtos-wallet`), prints the address to fund with Circle's
faucet, and registers the server with Claude Code (`claude mcp add`) and Droid (`droid mcp add`) when they are
installed, or prints the JSON block for any other client. The agent gets the same tools a box task gets
(`wallet__quote`, `wallet__pay`, `wallet__discover`, `wallet__payMetered`), running the same code: exact price
or nothing, devnet USDC only, a host allowlist, never pay twice.

You set the limits, not the agent: `WALLET_BUDGET_CENTS` (default 10) and `WALLET_HOSTS`. Above the budget,
your client asks you to approve the amount, payee and purpose (MCP elicitation); a client that can't ask gets
a refusal. Every call is logged in `~/.gurtos-wallet/actions.jsonl`. Re-running the installer is safe and keeps
your key. Inside GurtOS none of this is needed: the box applies its own budgets and phone approvals.

The skill in `skill/x402-wallet/SKILL.md` teaches any agent how to pay: quote, pay the exact price, wait when
over budget, never look for a key. Copy it to `.factory/skills/x402-wallet/` for Droid or
`~/.claude/skills/x402-wallet/` for Claude Code.

## How it works

```
  task (its own Linux user, no key)        the box's core (root)                            outside
  agent ── wallet.pay {url} ──► broker: over budget? ask the owner's phone, wait for OK
                                wallet.pay: exact price? payee and cap allowed by the owner's policy?
                                signer: CDP Server Wallet (Coinbase signs inside its policy)
                                        or the vault key (fallback)
                                memo: "gurtos task=<id> n=<nonce>"
                                GET url + PAYMENT-SIGNATURE ─────────────────────►  seller ──► CDP facilitator
                                                                                              verify, pay fee,
                                                                                              submit to Solana
                                ◄── 200 + content + PAYMENT-RESPONSE (tx)
        ◄── { content, paid }   log: tool.call, "Paid $0.01 ... to <payee>", tool.result with cents

  a stranger's agent ── GET /t/wallet/sell/audit ──► 402 (price, payTo = the box wallet, Bazaar metadata)
                     ── + PAYMENT-SIGNATURE ───────► verify, serve, settle through CDP, log the sale
```

| File | What it is |
|---|---|
| `track.ts` | The app: tools, routes, the ledger reader and the Agent wallet window. |
| `lib.ts` | Shared pieces: the network, units, the host rule, the payment mark. |
| `cdp-wallet.ts` | CDP Server Wallet signer, the Coinbase policy, the owner's `GET/POST /policy`, the local fallback check. |
| `sell.ts` | The box's paid services, the Bazaar declarations, daily caps, the earnings ledger. |
| `bazaar.ts` | `wallet.discover`. |
| `metered.ts` | `wallet.payMetered` (x402 `upto`). |
| `memo.ts` | The task id memo on every payment. |
| `audit.ts` | The daily log fingerprint on Solana, `GET /audit` and `GET /audit/verify`. |
| `onramp.ts` | The sandbox Onramp top-up. |
| `mcp.ts`, `install.sh`, `skill/` | The wallet outside a box. |
| `seller.ts`, `keygen.ts` | A test API and a key maker. |
| `demo.ts`, `*.test.ts`, `*.live.ts` | The demo step, the unit tests (no money moves), live scripts. |

### Listed in Coinbase's x402 Bazaar

The demo box's `/sell/*` routes are public at `https://gurt-cloud.box.gurtos.com/t/wallet/sell/...` (GurtOS's
remote access: the box ends the TLS connection itself, and only routes the wallet lists in `openRoutes` answer
without a paired phone; everything else is 401). The first settled payment through the public address, made
from a second wallet, got both paid routes cataloged by Coinbase's CDP facilitator within a second. To check:

```ts
import { listX402DiscoveryMerchant } from '@coinbase/cdp-sdk';
const r = await listX402DiscoveryMerchant({ payTo: '6PyiR71c9aw3e8bgnxmcLvJECL5zHE5jMSWqJoVjPTxU' });
// r.resources: /sell/audit (exact, $0.01) and /sell/search (upto, cap $0.02), network Solana devnet
```

On 2026-10-24 that returned both resources, each with `resource` set to the public URL and Bazaar metadata
(input schema, output example, description). Free-text search did not find them yet, only the lookup by
pay-to address did. To list your own box: make `/t/wallet/sell/*` reachable over HTTPS, then pay each route
once from a different wallet (a wallet can't pay itself).

### Controls

- **The key never reaches a task.** In vault-key mode it lives in `/etc/box/vault.env` (root only), read only by
  the wallet's tools inside the box's own process. In cdp mode it never touches the box: Coinbase holds it. A
  task runs as its own Linux user, gets only results, and the demo checks no key is in the log.
- **Budget, then the owner, then the policy.** The core counts each payment toward the task's budget (with
  in-flight reservations, so two payments at once can't both slip through). Above it, or above the owner's
  threshold, the task waits for an OK on the phone, which shows the payee and the URL. Then the owner's payee
  list and cap apply: checked by GurtOS, and in cdp mode signed only inside Coinbase's policy.
- **Exactly the agreed price.** The budget check, the owner's OK and the payment use one amount. If the API
  asks for anything else, the wallet pays nothing. It never pays a quoted price that differs from one the owner
  approved. Metered payments are capped: an offer whose ceiling is above the agent's cap is refused.
- **Only devnet USDC, only the task's hosts.** It pays only Solana devnet USDC, only to hosts in the task's
  `hosts` (the same rule as the task's network), with redirects refused.
- **Never twice.** Before paying, the wallet writes a durable mark for the call. After a power cut, the resumed
  call refuses to pay again instead of guessing.
- **Selling is fenced.** Only `/sell/*` is open to strangers, and the payment is the credential. Input is
  checked before payment; there is a daily cap on sales and on open orders. Search reads only regular files the
  owner put in `BOX_HOME/public`. A rented task runs only after the owner approves, with no tools, no hosts and
  no budget.
- **On the record, on chain.** Every payment and sale is in the action log and on the wallet page, and each audit fingerprint writes a note (hash and transaction id) to the log too. Every payment
  carries `gurtos task=<id>` as a Solana memo. A daily SHA-256 fingerprint of the log, chained day to day, is
  written to Solana; `GET /audit/verify` recomputes it and compares it with the chain.

### Known limits

- Devnet only, by design. Mainnet needs a different network and asset, real USDC and a review.
- **The Coinbase lock is only as strong as the box's API key.** A box whose CDP key can manage policies could
  loosen its own policy. Set the policy, then remove that scope from the box's key (step 4 above).
- **CDP Server Wallet mode is built and unit-tested but not yet run live**: it needs a CDP Wallet Secret in the
  vault, which is pending. Live runs so far use vault-key mode, with the owner policy enforced by GurtOS.
- **Onramp is sandbox only.** Sandbox orders move no money, and Onramp can't deliver devnet USDC, so test
  money comes from Circle's faucet. Onramp also needs an app set up in the CDP Portal.
- No refunds: if the owner declines a paid "rent the agent" request, the buyer keeps nothing back.
- Metered payments are counted at their cap in the task's cost until the core reads the settled amount.
- `GET` only for paid APIs; responses are cut at 20 KB. Quoted prices are kept in memory.
- The standalone MCP server assumes one process per `~/.gurtos-wallet`.

## Builder feedback

See [FEEDBACK.md](FEEDBACK.md): what worked and every point of friction (27 so far), per Coinbase tool.
