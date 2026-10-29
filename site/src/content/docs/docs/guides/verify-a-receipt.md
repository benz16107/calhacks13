---
title: Verify a receipt
description: A GurtOS receipt is a signed record of one task. Check one in your browser at gurtos.com/verify, and see what a receipt proves and what it does not.
sidebar:
  badge:
    text: Preview
    variant: note
---

:::note[Optional app]
Receipts is an optional app. It is off on a new box and needs no account. Its Solana check runs on devnet, Solana's test network.
:::

When an agent finishes a task, GurtOS can make a signed receipt: what the task was, every step, who approved what,
what it cost, whether it was kept or undone, and the part of the action log it sits in.

## Check a receipt

1. Open **Receipts** in the app list, pick a task, and scan the QR code.
2. The code opens [gurtos.com/verify](/verify/), which checks the receipt in your browser. Nothing is uploaded.

You can also paste a receipt into that page or drop a receipt file on it. The box serves the same page itself at
`/t/receipts/verify`.

## What it checks

- **The signature.** The box signed exactly this receipt.
- **The key.** The key is the box's own, and its short name is in the box's log.
- **The chain.** Each log entry holds the fingerprint of the one before, and the page recomputes every one.
- **The anchor.** When the daily fingerprint written to Solana covers the task, the page checks that the chain reaches
  it, looking it up on a public Solana node. Until then it says "not anchored yet".

Elastic holds a copy of the log that the box cannot rewrite. When the box makes a receipt, it compares the task's
entries with that copy and signs what it found. See [Send the log to Elastic](/docs/guides/send-the-log-to-elastic/).

## Redacted receipts

Choose **Redacted** to leave out step text, file names and amounts. A redacted receipt still checks out.

## What a receipt does not prove

A receipt shows that the entries are the ones the box wrote and that they were not changed afterward. It does not show
that the agent was right, or that the box told the truth when it wrote them.

The Solana fingerprint is on devnet, Solana's test network.

## Related

- [The action log](/docs/concepts/action-log/)
- [Security model](/docs/security/model/)
- [Receipts README](https://github.com/benz16107/calhacks13/blob/main/tracks/receipts/README.md)
