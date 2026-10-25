# Visa: shopping you approve (1:25)

**Track:** Visa, Reimagining Shopping. **Edition:** GurtOS Personal, plus GurtOS Server for watches that keep running
when the laptop is closed. **Status:** draft for Ben's approval.

**Goal.** A standing instruction becomes a signed, approved, refundable purchase, while the agent never sees the card.
Every payment on screen is test money, labelled and said once.

**Rubric map.**

| Visa criterion | Weight | Where |
|---|---|---|
| Innovation in reimagining shopping | 25 | Beat 3 (standing instruction), beat 5 (signed mandate) |
| User experience | 25 | Beats 3 and 4 (one sentence, one Face ID tap), beat 7 (undo is a refund) |
| Technical execution | 20 | Beat 3 (live price through Apify), beat 5 (Trusted Agent Protocol) |
| Commerce impact | 15 | Beat 6 (the merchant's side) |
| Trust and responsibility | 15 | Beats 2, 4, 5, 7 and 8 |

## Shot list

| # | Time | Picture | On-screen text | Narration | Feature and proof |
|---|---|---|---|---|---|
| 1 | 0:00 to 0:09 | G12: the Hills; three short lines appear | Agents need your card. Stores can't tell them from bots. You can't see what they do. | "Shopping agents need your card or your password. Stores can't tell them from bots, and you can't see what they do." | The problem (`docs/story.md`, Visa) |
| 2 | 0:09 to 0:19 | A20: the Personal desktop on the Hills; the native GurtOS app opens to Apps > Shopper | GurtOS Personal · the card stays in the vault | "Gurt O.S. Personal runs your shopping agent on a computer you own. The card stays in a vault only the operating system can read. The agent never sees it." | Card in the root-only vault; the merge gate checks no card is in the log |
| 3 | 0:19 to 0:32 | T-VI-01: type "Get me Chemex filters when they're under $16"; the watch appears with Best Buy Canada's live price read through Apify, $15.36 CAD | Standing instruction · live price from the store, not the model (Apify) | "I say what I want once. The box keeps watching, and reads the live price from the store through Apify, not from the model. Chemex filters, fifteen thirty-six." | Standing instructions; live prices through Apify (live run Oct 23) |
| 4 | 0:32 to 0:44 | D01: the iPhone notification, "Buy Chemex filters for $15.36 CAD? TEST PAYMENT"; Approve with Face ID | TEST PAYMENT · Approve with Face ID | "When it's under my limit, my phone asks once. I approve with Face ID. This is a test payment." | Passkey approval (merged; software authenticator in the demo) |
| 5 | 0:44 to 0:57 | T-VI-02: the store's order page, "Trusted Agent Protocol signature verified", then three refusals in its log: unsigned, changed order, replayed signature; the mandate card (item, store, price, expiry) | Signed with Visa's Trusted Agent Protocol · unsigned: refused · changed: refused · replayed: refused | "The box signs the order with Visa's Trusted Agent Protocol, and the store checks it before it charges. An unsigned order fails. So does a changed one, or a replay." | TAP signing; signed mandate enforced by the store |
| 6 | 0:57 to 1:06 | T-VI-03: the GurtOS Test Store merchant dashboard: verified agent orders, bots refused by reason, conversion, 0 chargebacks | Our stand-in store, test payments · verified agent orders · bots refused · 0 chargebacks | "The store sees which orders came from a trusted agent, and turns the bots away." | Merchant dashboard (built, at our stand-in store) |
| 7 | 1:06 to 1:16 | T-VI-04: the purchase task's Undo; Stripe test-mode refund; then the stolen-session case: a plain tap without Face ID, "approved without Face ID", nothing paid | Undo = refund (Stripe test mode) · a stolen session can't buy | "Undo the task, and the order is refunded. And a stolen session can't buy: without Face ID, the box refuses to pay." | Undo refunds; stolen-session refusal (`showcase/src/content/tracks/visa.mdx`) |
| 8 | 1:16 to 1:25 | G13: "Equifax, 2017: 209,000 payment card numbers", FTC source; end card with the edition chip | Equifax, 2017: 209,000 card numbers taken. Source: FTC, July 2019 · GurtOS · open source | "In 2017 attackers took two hundred nine thousand card numbers from Equifax. Here, the agent never holds one. Gurt O.S. is open source." | Principle 14 (sourced attack) |

**Cut list if long:** beat 6.

## Narration (exact text for ElevenLabs)

```text
Shopping agents need your card or your password. Stores can't tell them from bots, and you can't see what they do.

Gurt O.S. Personal runs your shopping agent on a computer you own. The card stays in a vault only the operating system can read. The agent never sees it.

I say what I want once. The box keeps watching, and reads the live price from the store through Apify, not from the model. Chemex filters, fifteen thirty-six.

When it's under my limit, my phone asks once. I approve with Face ID. This is a test payment.

The box signs the order with Visa's Trusted Agent Protocol, and the store checks it before it charges. An unsigned order fails. So does a changed one, or a replay.

The store sees which orders came from a trusted agent, and turns the bots away.

Undo the task, and the order is refunded. And a stolen session can't buy: without Face ID, the box refuses to pay.

In 2017 attackers took two hundred nine thousand card numbers from Equifax. Here, the agent never holds one. Gurt O.S. is open source.
```

## Captures this video needs

Shared (see `capture.md`): A20, D01, G12, G13. Its own:

| ID | What | Machine and state | Steps |
|---|---|---|---|
| T-VI-01 | The Shopper watch with a live Apify price | Personal VM on the laptop (final Personal disc), Shopper and Apify on, Apify token and Stripe test key in the vault | Apps > Shopper, type the instruction, wait for the Best Buy Canada price |
| T-VI-02 | Signed order, three refusals, the mandate | GurtOS Test Store page in the Personal VM's browser | Open the order; run the store's demo refusals (unsigned, changed, replayed) |
| T-VI-03 | Merchant dashboard | Same store | Open the merchant view after two verified orders |
| T-VI-04 | Undo refund; stolen session | Personal VM and Stripe test dashboard (test mode only; crop the account name) | Undo the purchase task; show the refund line. Then approve a reorder with a plain tap and show the "approved without Face ID" failure |
| T-VI-S1 | The Shopper app's permissions: Allow, Deny, revoke (slot: only once agent permissions are merged) | Personal VM on the laptop (final Personal disc) on a build where agent permissions are merged | Open the Shopper app's permissions and hold on its manifest; Allow one permission, Deny one, revoke one; then trigger the revoked use and hold on the OS refusing it. Use only the labels the screen shows |

## Check before render

- The price on screen is the one Apify returns on the day; say the number from the capture, not $15.36, if it moved.
- Face ID on the simulator is the software authenticator; the on-screen text must not claim a real device.
- Best Buy Canada's terms prohibit scraping (noted on the showcase); keep the shot to one read, as in the live run.

## Slots: standout features (use only once merged)

These beats stay out of the video until the feature is merged on main and its check passes. When one is ready, record its capture, add its line to `docs/video/slots.json`, generate its narration with `narration/say.py <script> --slots`, and rebuild: later beats move by themselves.

| Slot id | Feature | Goes after beat | Picture (the capture to record) | On-screen text | Narration | Seconds | Rubric it serves | What to cut to stay in length |
|---|---|---|---|---|---|---|---|---|
| `permissions` | Agent permissions | Beat 2 (Personal runs your shopping agent; the card stays in the vault) | T-VI-S1: the Shopper app's permissions in the Personal VM. Allow one, Deny one, revoke one, then the OS refuses the revoked use | Agent permissions · the OS enforces the Shopper app's manifest · Allow · Deny · revoke | The OS enforces the Shopper app's manifest. Like phone app permissions, you can Allow, Deny or revoke. | 8.4 | Trust and responsibility (15) and User experience (25): you stay in control of what the agent may do | Beat 6 (9 s, on the script's cut list): drop "The store sees which orders came from a trusted agent, and turns the bots away." and T-VI-03 |

Length: target 1:25. Every slot in adds about 8.4 s and the cuts above take out about 9 s, so the video runs about 1:24. Cut sizes are estimates from each beat's window; the build's length check has the final say.

### Slot narration

#### permissions

```text
The OS enforces the Shopper app's manifest. Like phone app permissions, you can Allow, Deny or revoke.
```
