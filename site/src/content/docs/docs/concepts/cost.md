---
title: Cost
description: GurtOS counts what every task spends, both paid tool calls and model tokens priced at list rates, so you can see the cost of each piece of agent work.
---

Every task in GurtOS has a running cost, `costCents`, in US cents. It is the sum of two kinds of spending: paid tool calls and the model. The portal shows it against the task's budget, as in `$0.03 of $0.50`.

## Tool spending

A tool declares what each call costs with `cost(input)`, in cents. The broker counts it when the call succeeds. The amount goes on the same log line as the result, a `tool.result` event with `cents`, so it is counted exactly once, even if the log is replayed after a power cut.

Some examples from the apps that ship with GurtOS. Apify, the wallet and the shopping agent are optional and need that service's account.

| Tool | Cost it declares |
|---|---|
| `example.spend` | Whatever the input says (test money) |
| `apify.run` | The spending cap the call sets with `maxUsd`, $0.10 by default |
| `apify.checkPrice` | 1 cent |
| `wallet.pay` | The `cents` in the input, or the price of the last quote for that URL (test money on Solana devnet) |
| `shopper.buy` | The order total (Stripe test mode) |

A tool that can cost a variable amount declares its maximum, so the budget check is on the worst case. A metered tool can report `spentCents` in its output, from 0 up to that maximum, and the box counts that instead. Paid tool calls are also what [budget approvals](/docs/concepts/approvals-and-budgets/) are about: a call that would take the task over its budget asks first.

A tool can also record spending while it runs with `ctx.cost(cents, what)`. That writes a separate `cost` event.

## Model cost

Droid reports its token usage when it finishes a turn: input, output, cache writes and cache reads, and the model id. The core prices them at the model's public list price and writes a `cost` event with the model and a `tokens` breakdown. The worker's second look at risky steps, a check by Haiku, is priced the same way and logged as a `cost` event with `"what":"review"`.

```json
{"seq":231,"at":"2026-10-24T19:03:40.221Z","type":"cost","task":"tk3m9qz1a2f","cents":3.189,"what":"model","model":"claude-sonnet-5-5","tokens":{"input":5120,"output":980,"cacheWrite":3100,"cacheRead":41000}}
```

The prices, in US dollars per million tokens:

| Model | Input | Output | Cache write | Cache read |
|---|---|---|---|---|
| Opus 5.5 (`claude-opus-5-5`) | 4 | 20 | 5 | 0.20 |
| Sonnet 5.5 (`claude-sonnet-5-5`) | 2 | 10 | 2.50 | 0.10 |
| Haiku 5.5 (`claude-haiku-5-5`) | 0.10 | 0.50 | 0.125 | 0.01 |

An earlier model whose id contains `opus`, `sonnet` or `haiku`, such as `claude-sonnet-4-6`, is priced at the earlier list prices: Opus 15, 75, 18.75 and 1.50, Sonnet 3, 15, 3.75 and 0.30, Haiku 1, 5, 1.25 and 0.10. Any other id is priced as Sonnet 5.5, the default model. Costs are not rounded, so a task that costs a fraction of a cent still shows it.

:::note
Factory bills Droid usage in its own credits. The figure GurtOS shows is the underlying model's list price for the same tokens. It tells you what each task used, and lets you compare tasks, but it may not match your Factory invoice. With your own Anthropic key the spend is on your Anthropic account, and the figure is still the list price.
:::

Model cost never pauses a task by itself: the budget check runs only before a paid tool call. But model cost is part of what the task has spent, so it uses up budget. After a lot of model use, the next paid call is more likely to ask.

## Seeing cost

- Each task: `costCents` and `budgetCents` in `GET /api/tasks`, and every cost event in `GET /api/tasks/<id>`.
- Live: the SpacetimeDB `task` table has `costCents`, rounded to whole cents.
- The portal's home screen shows money spent today across all tasks, and Activity lists each cost and each paid tool call as it happens.
- The Elastic app answers "what did it cost this week, by task and by app?" from the log. See [send the log to Elastic](/docs/guides/send-the-log-to-elastic/).

## Test money

Two optional apps move money, and both use test money only. The wallet pays for APIs with USDC on Solana devnet, and the shopping agent pays a test store through Stripe test mode. Each refuses live money in code. Their spending counts toward a task's cost like any other, and the portal, the log and the approval say TEST in words. See [let agents pay for APIs](/docs/guides/agent-payments/) and [set up the shopping agent](/docs/guides/shopping-agent/).

## Limits

- The price table is fixed in the core (`core/pricing.ts`). A price change needs an update.
- A worker other than Droid reports spending with `POST /cost` on its broker. The core trusts the amount it reports, as long as it is 0 or more.
- Haiku 5.5 charges more for a prompt over 100,000 tokens. A task reports one total for all its turns, so GurtOS does not apply that surcharge.
- Model cost is reported when Droid finishes a turn. A turn cut off by a power cut may not be counted.

## Related

- [Approvals and budgets](/docs/concepts/approvals-and-budgets/)
- [The action log](/docs/concepts/action-log/)
- [Log events](/docs/reference/log-events/)
