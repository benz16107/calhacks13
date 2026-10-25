# Coinbase and Solana: an agent wallet you can trust (1:30)

**Track:** Coinbase, x402 Payment Agents, and MLH Best use of Solana. One video for both. **Edition:** GurtOS Server
(the wallet, the payments, the Solana checks), plus GurtOS Business for the last beat. **Status:** draft for Ben's
approval.

## Creative brief

A ledger that builds on screen, one row for each payment the narration names, with an amount and a state (paid, waiting for Face ID, charged). After the card, full-bleed `cb-shopper-rows.png` shows the box's real x402 rows while the first ledger row, the FBI's Bybit figure, types in salmon (paragraph 1). Paragraph 2 holds `a06.mp4` from 4 for the task with no key. Paragraph 3 adds the one-cent joke, then match cuts from the three-cent report row to the same $0.03 on `watch-wallet.png`, beside `iphone-wallet-faceid.png`, both tilted 3D cards under a TEST MONEY stamp. Paragraph 4 adds the earned rows. Paragraph 5 types the one-line install in a terminal and rolls the 28 counter. In paragraph 6, `explorer-urd99.png` becomes a tilted 3D card, counters roll to 109 with 0 failed, and a callout circles the fee payer. Paragraph 7 is `a30.mp4`, labelled a credit request. Upward wipes as rows land; an even, metronome pace. One zoom, on the memo line. Music bed: ledger.

Footage: cb-shopper-rows.png, a06.mp4, a30.mp4, native/screenshots/iphone-wallet-faceid.png, showcase/src/assets/track/coinbase/watch-wallet.png, showcase/src/assets/track/solana/explorer-urd99.png

**Goal.** Giving an agent money usually means handing it the key. This video shows a real agent buying with x402
without ever seeing the key, waiting for a Face ID tap when a price is over its budget, earning from the x402 Bazaar,
and installing the same wallet in one command for Claude Code. Then Solana gets its own beat: anyone can check the
payments, the task named in each one, and a fingerprint of the action log, on Solana Explorer.
Every payment is devnet USDC, labelled TEST and said once out loud.

**Rubric map.**

| Criterion | Where |
|---|---|
| Coinbase: usefulness | Beat 3 (a real agent buys), beat 4 (the box earns, Bazaar, metered) |
| Coinbase: technical design | Beat 2 (key in the OS, budget, log), beat 3 (pause over budget), beat 4 (upto scheme) |
| Coinbase: ease of reuse | Beat 5 (one command, Claude Code or any MCP agent; Apache-2.0) |
| Coinbase: builder feedback | Beat 5 (28 points, with times) |
| Solana: real use of Solana | Beat 6 (109 finalized devnet transactions, memos, log fingerprints) |
| Principle 14: a sourced attack on a financial company | Beat 1 (Bybit, FBI) |

## Shot list

| # | Time | Picture | On-screen text | Narration | Feature and proof |
|---|---|---|---|---|---|
| 1 | 0:00 to 0:11 | G-CB-1: the Hills; "Bybit, February 2025" and the facts as two lines, source in small mono | Bybit, Feb 21, 2025: about $1.5 billion in virtual assets stolen (FBI attributes it to North Korean actors). Source: FBI PSA, Feb 26, 2025 | "In February 2025, the FBI says, North Korean actors stole about one point five billion dollars from the Bybit exchange. Giving an agent money usually means giving it the key." | Principle 14; source in `showcase/src/content/tracks/coinbase.mdx` ("Real attacks on financial companies"). The notice does not say how the wallet was breached |
| 2 | 0:11 to 0:22 | A06: a finished purchase task, "runs as box-…", cost against budget; then T-CB-01: the wallet payments page with the wallet's budget line and the log row for a payment | GurtOS Server · From GurtOS: the key sits in a root-only file, opened only by the box's payment tool · From Coinbase: x402 | "On Gurt O.S. the wallet belongs to the operating system. The box checks the budget, signs and logs. The agent never sees the key." | Key never reaches the agent; the live run checks neither the wallet key nor the CDP secret is in the log (`docs/features.md`, wallet, verified Oct 23 to 24) |
| 3 | 0:22 to 0:40 | T-CB-02: the task "buy one joke and one report": the joke quoted at $0.01 and paid; the report quoted at $0.03, over the $0.02 budget, the task pauses. Then D01-style T-CB-03: the iPhone request "Spend $0.03 ... in devnet USDC (test money)", Face ID, Approve; the log row "Approved by iPhone (Face ID, reported)" | TEST MONEY · devnet USDC · Real agent: Droid with Claude · Over budget: waits for Face ID | "An agent on Claude was told, buy one joke and one report. It paid one cent. The three-cent report was over budget, so it waited for my Face ID. These are test payments in devnet USDC." | Over-budget pause naming payee and URL (verified Oct 24 01:00); iPhone approval; real Droid run (`coinbase.mdx` proof) |
| 4 | 0:40 to 0:52 | T-CB-04: a terminal on the Hills: `curl -i` on the box's `/t/wallet/sell/audit` answers 402 Payment Required, $0.01 on Solana devnet; then the Bazaar lookup by pay-to address returning both paid routes; then the payments page row for the metered search: cap $0.02, charged $0.002 | The box earns: $0.01 audit proof, search capped at $0.02 · Listed in the x402 Bazaar (lookup by pay-to address) · Metered: capped $0.02, charged $0.002 | "The box earns too, with paid routes listed in the x402 Bazaar. A metered search capped at two cents was charged two tenths of a cent." | Earning, Bazaar listing, `upto` scheme (`docs/features.md`, merged; Bazaar lookup run Oct 24 1:30 PM PT; free-text search did not find the listing, so the shot shows the lookup) |
| 5 | 0:52 to 1:02 | T-CB-05: a clean Linux user in a terminal: the one `curl ... install.sh | sh` line; then a Claude Code session calling the wallet, "Spend $0.01?" prompt, the joke returned. Then the FEEDBACK.md page scrolling (28 points, with times) | One command · Claude Code or any MCP agent · same budget and approval prompt · Builder feedback: 28 points · Open source, Apache-2.0 | "Reuse is one command. It installs the wallet for Claude Code or any MCP agent, with the same budget and approvals. We kept twenty-eight points of builder feedback." | One-command reuse (merged; a real Claude Code session installed it and paid $0.01 over MCP); `tracks/wallet/FEEDBACK.md` |
| 6 | 1:02 to 1:22 | T-CB-06: Solana Explorer, devnet. The wallet's history, every row Finalized; open one payment (fee payer is the facilitator, 0.03 USDC moves, memo `gurtos task=...`); open a log fingerprint (memo `gurtos-audit v1 seq=595 sha256=...`) | Solana devnet · 109 finalized transactions naming the wallet on Oct 24, 0 failed · includes 70 fixed-price payments, 13 metered payments, 11 log fingerprints · Memo names the task · A fingerprint shows a later edit, not an earlier one | "Solana makes it checkable. On October twenty-fourth, one hundred nine finalized devnet transactions named the wallet, and none failed. Each memo names its task, and the facilitator paid every fee. Eleven carry a fingerprint of the action log, so a later edit shows." | Solana page numbers (`showcase/src/content/tracks/solana.mdx`); memos and fingerprint (merged, shipped); checkable by anyone on Explorer |
| 7 | 1:22 to 1:30 | A30: Business, the controller's Waiting for me with the rule and "who could approve"; G08 end card | GurtOS Business · a request over a limit goes to the person the rules name · GurtOS · open source | "On Business, any request over a limit goes to the person the rules name. Gurt O.S. is open source." | Routed approvals (verified Oct 24 03:22: $12,000 went to the Controller). The shot shows the general routing, not a wallet payment |

**Cut list if long:** beat 7's A30 shot (keep the end card line); beat 5's FEEDBACK.md scroll; beat 4's metered row.

## Narration (exact text for ElevenLabs)

Word count: 206 (about 1:30 at 2.3 words a second).

```text
In February 2025, the FBI says, North Korean actors stole about one point five billion dollars from the Bybit exchange. Giving an agent money usually means giving it the key.

On Gurt O.S. the wallet belongs to the operating system. The box checks the budget, signs and logs. The agent never sees the key.

An agent on Claude was told, buy one joke and one report. It paid one cent. The three-cent report was over budget, so it waited for my Face ID. These are test payments in devnet USDC.

The box earns too, with paid routes listed in the x402 Bazaar. A metered search capped at two cents was charged two tenths of a cent.

Reuse is one command. It installs the wallet for Claude Code or any MCP agent, with the same budget and approvals. We kept twenty-eight points of builder feedback.

Solana makes it checkable. On October twenty-fourth, one hundred nine finalized devnet transactions named the wallet, and none failed. Each memo names its task, and the facilitator paid every fee. Eleven carry a fingerprint of the action log, so a later edit shows.

On Business, any request over a limit goes to the person the rules name. Gurt O.S. is open source.
```

## Captures this video needs

Shared (see `capture.md`): A06, A30, D01 (the iPhone simulator paired to the clip box), G08. Its own:

| ID | What | Machine and state | Steps |
|---|---|---|---|
| G-CB-1 | The Bybit card (animation, no capture) | `studio/` | Two lines of type and the source in small mono, same style as G10 |
| T-CB-01 | The wallet payments page | Clip box (Server) with the wallet track on and a funded devnet wallet (Circle faucet) | Open the wallet's payments page; hold on a payment row with amount, payee, task and transaction; hold on the budget line |
| T-CB-02 | The buying run | Same box; **real Droid with Claude** (costs model credit; wallet demo `DEMO_LIVE=wallet`) | Start the task "buy one joke and one report, then write both into answers.md" against the box's own paid test API; record until the report quote pauses over the $0.02 budget |
| T-CB-03 | The Face ID approval | Same box, iPhone simulator on the build Mac paired to it (D01's pairing), Face ID set to Matching Face | In T-CB-02's pause, open the request on the phone ("Spend $0.03 ... devnet USDC (test money)"), Approve with Face ID; then open Activity and hold on "Approved by iPhone (Face ID, reported)" |
| T-CB-04 | Earn, Bazaar, metered | Terminal on a test machine against the public Vultr box | `curl -i` the audit route (402, $0.01); run `listX402DiscoveryMerchant({ payTo })` for the box's pay-to address and hold on both routes; then a metered search task's payments row (cap $0.02, charged $0.002) |
| T-CB-05 | One-command reuse | A clean Linux user or throwaway VM, not a real Claude config | Run the install line from `tracks/wallet/README.md`; start Claude Code; ask it to buy a joke; hold on the "Spend $0.01?" prompt and the answer; then open `tracks/wallet/FEEDBACK.md` on GitHub and scroll |
| T-CB-06 | Solana Explorer | Chromium in Xvfb on the Linux build machine, public pages, no sign-in | Open the wallet address page (devnet) and scroll; open one payment (`.../tx/Urd99...` has the fee payer and memo); open the fingerprint (`.../tx/ucAyk...`, memo `gurtos-audit v1 seq=595`); links are in `solana.mdx` |
| T-CB-S1 | A signed receipt: scan, verify, tamper, fail (slot: only once signed receipts are merged) | Server clip box with the wallet track on, on a build where signed receipts are merged; a phone or the simulator's camera for the scan | Open one receipt and hold on its QR code; scan it and hold on the public verify page; change the receipt and run the check again; hold on the failure. Label TEST MONEY if it is a devnet payment's. Use only the labels the page shows |

## Check before render

- Test money: TEST MONEY on screen in beats 3 and 6, and the narration says "test payments" once (beat 3). Devnet only;
  mainnet is not built.
- If T-CB-02 is not recorded with the real agent, change beat 3's first sentence to "A scripted agent was told to buy
  one joke and one report" and keep the on-screen "Scripted agent: same steps every take". Do not say "on Claude" for a
  scripted take.
- The Bazaar shot is the lookup by pay-to address. Do not show or claim a free-text search result.
- The metered number is $0.002 charged on a $0.02 cap (the page says the task's cost still counts the cap until the
  core reads the settled amount); show the payments row, not a budget line, for that beat.
- The fingerprint check shows a change made after the fingerprint, not one made before. Keep that line on screen.
- The 109 figure is the Solana page's count of finalized transactions naming the wallet on Oct 24. The table beside
  it lists 70 fixed-price payments, 13 metered payments, 11 fingerprints and 2 funding transfers, which is 96, so the
  other 13 are most likely the metered payments' second (channel) transaction. Re-count on Explorer at capture; if
  the number moved, show the page's count at that moment and update the narration. Never say the three groups add
  up to 109.
- Beat 7 shows general routing, not a wallet payment. If a wallet payment over a person's limit on Business is not
  verified by capture time, cut beat 7's first sentence.

## Slots: standout features (use only once merged)

These beats stay out of the video until the feature is merged on main and its check passes. When one is ready, record its capture, add its line to `docs/video/slots.json`, generate its narration with `narration/say.py <script> --slots`, and rebuild: later beats move by themselves.

| Slot id | Feature | Goes after beat | Picture (the capture to record) | On-screen text | Narration | Seconds | Rubric it serves | What to cut to stay in length |
|---|---|---|---|---|---|---|---|---|
| `receipts` | Signed receipts | Beat 6 (Solana makes it checkable; a log fingerprint on Explorer) | T-CB-S1: a signed receipt from the clip box with its QR code (for a devnet payment if the build offers one); a phone scans it and the public verify page says it checks out; then the receipt is tampered with and the same check fails | Signed receipt · QR code · public verify page · log and Solana anchored · tampered: fails · TEST MONEY if the receipt is for a payment | Each signed receipt has a QR code. A public page verifies it against the log and Solana, and a tampered receipt fails. | 10.6 | Solana: real use of Solana (beat 6); Coinbase: technical design (payments anyone can check) | Beat 7's first sentence "On Business, any request over a limit goes to the person the rules name." with the A30 shot (about 5 s), beat 5's "We kept twenty-eight points of builder feedback." with the FEEDBACK.md scroll (about 4 s), and beat 4's metered row (about 2 s), all on the script's cut list |

Length: target 1:30. Every slot in adds about 10.6 s and the cuts above take out about 11 s, so the video runs about 1:30. Cut sizes are estimates from each beat's window; the build's length check has the final say.

### Slot narration

#### receipts

```text
Each signed receipt has a QR code. A public page verifies it against the log and Solana, and a tampered receipt fails.
```
