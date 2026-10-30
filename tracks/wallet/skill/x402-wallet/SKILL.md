---
name: x402-wallet
description: Pay for an HTTP API that answers 402 Payment Required, using the GurtOS agent wallet (x402, USDC on Solana devnet, test money). Use when a URL returns 402, or a task says an API is paid. You never hold a key; the wallet pays for you within a budget the human set. Works inside a GurtOS box and, through an MCP server, in any other agent.
---

# Paying for APIs with the box's wallet

You run inside a box task. The box holds a wallet. You do not, and you never will. Do not look for a private
key, a seed phrase or an API key, and do not ask anyone for one. The box pays for you and gives you the result.

All payments are USDC on Solana devnet. That is test money, not real funds. Say so when you report a payment.

## Steps

1. **Quote.** Call `wallet.quote` with `{ "url": "<the API's URL>" }`. A paid API returns `status: 402` and a
   price in `cents`, plus the payee. A free URL returns its content and `cents: 0`; you are done.
2. **Pay.** Call `wallet.pay` with `{ "url": "<same URL>" }` to pay the price you were quoted, or add
   `"cents"` to name the amount yourself. It pays exactly that amount or nothing, then returns the API's
   `content` and a `paid` receipt with the transaction.
3. **Report.** Say what you bought, what it cost and the transaction link from `paid.explorer`.

In Droid inside a box the tools appear as `wallet__quote` and `wallet__pay` (under the `box` MCP server). Outside a
box they have the same names, under the `gurtos-wallet` server (Claude Code shows `mcp__gurtos-wallet__wallet__pay`).

## Rules

- **The budget is the owner's.** Above your task's budget, `wallet.pay` waits until the owner answers on the
  portal or their phone. Waiting is normal. Do not retry, split a payment into smaller ones, or look for
  another way to pay.
- **`not approved`** means the owner said no. Stop buying and report it.
- **"the price is ..."** means the price changed since your quote. Quote again, and pay the new price only
  if it still makes sense for the task.
- **"not paying twice"** means the box restarted in the middle of this payment and it may have gone through.
  Do not pay again. Report it so the owner can check the wallet.
- **Hosts.** The wallet reaches only your task's hosts. If a URL is refused as "not one of this task's
  hosts", report it; do not try other URLs to get around it.

## Outside a box (any agent)

Inside GurtOS you need nothing below: the box already gives its tasks these tools, with the task's budget and
the owner's approvals on the portal and phone. Elsewhere, one command installs the wallet as an MCP server:

```sh
curl -fsSL https://raw.githubusercontent.com/benz16107/gurtos/main/tracks/wallet/install.sh | sh
```

It needs Node 22.18 or newer and git, makes a devnet key in `~/.gurtos-wallet/key` (mode 0600), prints the address
to fund at https://faucet.circle.com, and registers the server with Claude Code and Factory Droid if they are
installed. For other clients it prints a JSON config block. Run it again to update; it keeps the key.

The same guards run as in a box: exact price or nothing, devnet USDC only, never pay twice for one call. The human
sets the limits in the server's environment, and you cannot change them:

- `WALLET_BUDGET_CENTS` (default 10) is the total you may spend without asking. It is counted across restarts in
  `~/.gurtos-wallet/ledger.jsonl`.
- `WALLET_HOSTS` is the comma list of hosts you may pay. Empty means none.
- Above the budget the client shows the human the amount, payee and purpose and waits for a yes. A client that
  cannot ask gets a refusal that says how to raise the budget. Do not retry, split the payment, or look for
  another way. Report it.
- Every call and result is logged in `~/.gurtos-wallet/actions.jsonl`.

## Without MCP

Any program inside the task can call the same tools through the broker socket:

```sh
curl -s --unix-socket "$BOX_SOCKET" http://box/call -H 'content-type: application/json' \
  -d '{"key":"buy-joke-1","tool":"wallet.pay","input":{"url":"http://api.localhost:4021/joke","cents":1}}'
```

Use a new `key` for each payment. The same key returns the first answer again and never pays twice.

## Install the skill

- Droid: copy this folder into the workspace as `.factory/skills/x402-wallet/`.
- Claude Code: copy it to `~/.claude/skills/x402-wallet/` or the project's `.claude/skills/`.

The task also needs `"tools": ["wallet.quote", "wallet.pay"]`, the API's host in `"hosts"`, and a
`"budgetCents"`. See `tracks/wallet/README.md`.
