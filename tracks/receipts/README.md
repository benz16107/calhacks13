# Receipts anyone can check

When an agent finishes a task, GurtOS can hand you a **signed receipt**: what the task was, every step it took,
who approved what, what it cost, whether it was kept or undone, and the stretch of the box's action log it sits in.
Give the receipt to a customer, an auditor or a judge, and they check it in their own browser. Nothing is uploaded,
and they do not have to trust the box, GurtOS or you.

Open **Receipts** in the app list (portal, Personal or phone), pick a finished task, and choose **Receipt** or
**Redacted**. The page shows a QR code. Scanning it opens the public check page, `gurtos.com/verify`.

## What a receipt proves

| It proves | How |
|---|---|
| The box signed exactly this receipt, and nothing in it changed afterward. | An ECDSA P-256 signature over the whole receipt, made with a key that never leaves the box. One changed byte fails it. |
| The entries are the ones the box wrote, in order, with nothing taken out of the middle. | The core chains every log entry to the one before (`prev`, `core/log.ts`). The receipt carries every link from the task's first entry on, and the page recomputes each line's SHA-256 and each link. |
| The key belongs to this box. | The key's short name was written into the box's own log when the key was made. That log reaches Elastic's add-only copy and the daily Solana fingerprint. |
| The log was not rewritten after the fact. | Elastic holds a copy written with a key that can only create documents. The daily Solana fingerprint holds the hash of the log, and the receipt's chain must reach it. |

It does **not** prove that the agent was right, or that the box told the truth when it wrote the entry. It shows the
record is the record.

## Which part is the OS, which is Elastic, which is Solana

| Part | From |
|---|---|
| The signed receipt, the key, the chain of entry hashes, the QR code, the public check page | The OS (`tracks/receipts`, and the hash chain in `core/log.ts`) |
| The add-only copy of every log entry. When the receipt is made, the box compares the task's entries with that copy and signs what it found (`anchors.elastic`). | Elastic (`tracks/elastic`, Serverless, a create-only key) |
| The daily fingerprint of the whole log, written as a memo on Solana devnet. The receipt carries the chain up to that fingerprint and the page looks the memo up on a public Solana node. | Solana, written by the wallet app (`tracks/wallet`, `audit.ts`) |
| Who approved, from which phone, under which Business rule | The OS: Business approvals record the person and where the answer came from |

The Elastic line on the page says what the box found when it made the receipt. The page cannot ask Elastic, because
that needs a key. To check the receipt against Elastic yourself, ask the GurtOS log agent: `box.verify_log`.

## What is shown, and what the owner chooses

- **Receipt** (full) holds each entry's own text: the question asked, the tool call, the cost, the step. It also holds
  the exact log line, so the page can hash it.
- **Redacted** holds the shape only: that a step happened, who approved, that money was spent, and every entry's
  fingerprint. It leaves out the text of steps and questions, tool inputs, file names and every amount. It still
  checks out, because the chain holds the fingerprint of each hidden entry.
- A receipt is stored under a random 128-bit address. Whoever has the link can read it, so share it as you would a
  document. The owner, or the person who asked for the task on a Business box, can make one.

## Try it

```sh
# on a box, as the owner (the box's own screen or a paired owner phone)
curl --unix-socket /var/lib/box/api.sock -d '{"task":"<task id>","mode":"full"}' -H 'content-type: application/json' http://box/t/receipts/share
```

It returns a link for the QR code. Open it, or drop the receipt's JSON on `gurtos.com/verify`. Then change one
character of the JSON and check again: the signature fails and the page says so. To see the chain fail, edit a line
of `/var/lib/box/log.jsonl` on a scratch box and make a new receipt: the page names the entry.

`./demo` does the same: it finishes a task that needs an OK, makes a receipt, checks it with the code the public
page runs, flips one byte and watches it fail, then edits the real log and watches the chain fail.

## Files

| File | What |
|---|---|
| `receipt.ts` | Builds and signs a receipt from the log (Node, `node:crypto`) |
| `verify.html` | The public check page. One file, no build. The checker inside it is what the tests and the demo run |
| `track.ts` | The box's routes: make a receipt, serve it, serve the page |
| `app.html` | The Receipts app: finished tasks and the QR code |
| `qrcode.js` | The MIT-licensed QR generator by Kazuhiko Arase, unchanged |
| `receipts.test.ts`, `demo.ts` | The tests and the demo step |

## Limits

- The Solana anchor appears once the daily audit has run after the task. Until then the page says "not anchored yet".
- A box that is fully taken over can sign a false receipt over a false log. It cannot rewrite what Elastic and Solana
  already hold, so the receipt then disagrees with them.
- Solana is devnet, so the fingerprint is test-network money and not a legal record.
- The page checks Solana only when the browser can reach a public Solana node. If it cannot, it says "not checked".
- A receipt covers the log from the task's first entry to the entry the daily audit anchored, up to 20,000 lines.
