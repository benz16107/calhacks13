---
name: x402-wallet
description: Pay for an HTTP API that answers 402 Payment Required, using the box's agent wallet (x402, USDC on Solana devnet, test money). Use when a URL returns 402, or a task says an API is paid. You never hold a key; the box pays for you within your task's budget.
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

In Droid the tools appear as `wallet__quote` and `wallet__pay` (under the `box` MCP server).

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

## Without MCP

Any program inside the task can call the same tools through the broker socket:

```sh
curl -s --unix-socket "$BOX_SOCKET" http://box/call -H 'content-type: application/json' \
  -d '{"key":"buy-joke-1","tool":"wallet.pay","input":{"url":"http://api.localhost:4021/joke","cents":1}}'
```

Use a new `key` for each payment. The same key returns the first answer again and never pays twice.

## Install

- Droid: copy this folder into the workspace as `.factory/skills/x402-wallet/`.
- Claude Code: copy it to `~/.claude/skills/x402-wallet/` or the project's `.claude/skills/`.

The task also needs `"tools": ["wallet.quote", "wallet.pay"]`, the API's host in `"hosts"`, and a
`"budgetCents"`. See `tracks/wallet/README.md`.
