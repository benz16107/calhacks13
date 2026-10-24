# Shopper: an agent that shops for you, and pays only after your tap

**Every payment here is a TEST payment.** Purchases go through Stripe test mode with a Visa test card. No real
money moves, nothing ships, and no real store accepts a test card. So checkout happens at the **GurtOS Test Store**,
a small store this track runs on the box. Where a payment is simulated instead (no Stripe key yet, or an offline
demo run), the app, the log and the order all say so.

The shopper is an app on the box (Visa track: Reimagining Shopping). It does three things:

1. **Restock and price watcher.** "Get me the Chemex filters when they're under $16." The box checks the store
   on a schedule. When the item is in stock at or under your price, your phone asks: *Buy 2 × Hario V60 02 paper
   filters, 100 count for $13.00? $6.50 each, down from $8.99, under your $7.00 limit. TEST PAYMENT.* Tap
   Approve and it pays. Best Buy Canada is checked live through the Apify track's `apify.checkPrice`.
2. **Household reorder.** Claude reads the receipts in the household's mailbox, works out what runs out this
   week (here: coffee filters and paper towels), and proposes one reorder for your OK. It sees the receipts,
   never the mailbox login and never your other email.
3. **Agents buying their own supplies.** An agent pays for an API it needs with the wallet track's x402
   payments, in USDC on Solana devnet, which is test money. A task asks the price with `wallet.quote`; then a
   second task pays exactly that with `wallet.pay`. Above your budget it waits for your OK first. Both reach only
   that API. We did not rebuild the wallet: see `tracks/wallet/README.md`.

Open it at `/t/shopper/` on the box. The store is at `/t/shopper/store`. Both are in the portal's app list.
Off the box (a paired phone or laptop), the page reads the pairing token the portal puts in its URL
(`?access_token=`) and sends it as `Authorization: Bearer` on every call, and on its link to the store.

## How a purchase is made safe

```
 you, in words ──► Droid (Claude) ──► shopper.watch          finds the product, sets the rule. Cannot buy.
                                         │
 schedule (20 s tick) ──► check task ──► apify.checkPrice / shopper.checkPrice   no network, no secrets
                                         │ result in the action log
 log reader, in code: in stock and price <= your limit?
                                         │ yes
 purchase task ──► "Buy …? TEST PAYMENT" ──► your phone or the portal ──► Approve
                                         │
 shopper.buy (in the core) ── vault: card + signing key ──► signs with Visa TAP ──► GurtOS Test Store
                                                                                    checks the signature,
                                                                                    the price, the stock,
                                                                                    then charges Stripe test mode
```

- **The model never holds a buy tool or a card.** Droid gets `shopper.watch` (set a rule) and `shopper.propose`
  (suggest a reorder). Only purchase tasks the box itself starts hold `shopper.buy`, and each one asks you first.
- **Prices come from the store, not the model.** `shopper.propose` takes SKUs and quantities. It looks up the
  prices itself, so a confused or hijacked model cannot make up a price.
- **Two gates on money.** The approval you tap, then the task's budget (your limit times the quantity). A
  purchase above the budget stops and asks again (the core's budget pause, moment 3).
- **Secrets stay in the vault.** The card, the signing key, the mailbox password and the Stripe key are read
  only by tools in the core. The demo checks that none of them is anywhere in the action log.
- **Undo is a refund.** Undo a purchase task (moment 1) and the store refunds its order. The purchase step
  carries `data.undo` ("Undo refunds this $13.00 test payment.") for the portal's Undo button to show.
- **Power cuts don't pay twice.** Each checkout carries the broker's stable call key as its Idempotency-Key, at
  the store and at Stripe. A purchase cut off mid-way returns the same order when the task resumes (moment 4).
- **One proposal and one watch per agent task**, so a looping agent cannot flood your phone.
- **Test money only, enforced.** The store refuses a live Stripe key (`sk_live_`), and a simulated charge
  accepts only Stripe's test cards. Orders above $500 are refused.

## Visa Trusted Agent Protocol

[TAP](https://github.com/visa/trusted-agent-protocol) is Visa's open spec for a merchant to tell a trusted
shopping agent from a bot. The agent signs each request with an RFC 9421 HTTP message signature, and the
merchant checks it against the agent's public key in a registry. We follow Visa's sample agent: the `sig2`
label, Ed25519, `keyId`, `nonce`, `created`, `expires` (8 minutes), and the `agent-payer-auth` tag for checkout.

```
Signature-Input: sig2=("@authority" "@path" "content-digest"); created=1761271440; expires=1761271920;
                 keyId="box-shopper"; alg="ed25519"; nonce="…"; tag="agent-payer-auth"
Signature:       sig2=:…:
Content-Digest:  sha-256=:…:
```

One addition: Visa's sample signs only `@authority` and `@path`. We also sign `content-digest` (RFC 9530), so an
order cannot be changed in transit: a different item, quantity or price fails the check. Visa's sample verifier
only knows the first two components, so it would not accept our signatures as they are.

The GurtOS Test Store refuses, with the reason on its page:
- an unsigned order (any agent or script without the box's key),
- a signed order whose body changed,
- a signature used twice (replay), even when the first use bought nothing,
- an expired signature, an unknown key, or a signature made for another store.

The box publishes its public key at `GET /t/shopper/keys/box-shopper` in the shape of TAP's registry
(`{key_id, algorithm, public_key, is_active}`). In real use Visa runs that registry. Visa Intelligent Commerce
needs a Visa representative, so nothing here depends on it.

## The tools

| Tool | Who gets it | What it does |
|---|---|---|
| `shopper.buy` | Purchase tasks the box starts, after the owner's OK | Signs the order with TAP and pays the GurtOS Test Store with the vault's card. Cost = the order total |
| `shopper.checkPrice` | Check tasks, Droid | Price and stock at the GurtOS Test Store, in the same shape as `apify.checkPrice` |
| `shopper.watch` | Droid | Sets up a watch: store, SKU, price limit, quantity, price drop or restock |
| `shopper.receipts` | Droid | Reads the demo inbox over POP3 with the vault's password. Returns receipts only, how many other emails stayed behind, and when each regular item runs out |
| `shopper.propose` | Droid | Proposes a reorder at the store's prices. Starts a purchase task that asks the owner |

The date arithmetic (how often an item is bought, when it runs out) is code in `shopper.receipts`. Claude does
the judgment: which receipts matter, what to skip, how much to buy, and the one-line reason you read.

## Routes (under `/t/shopper/`)

| Route | Does |
|---|---|
| `GET /` | The app |
| `GET /state` | Watches, pending approvals, recent tasks, orders, and which secrets the vault has |
| `POST /watches {store, product, maxCents, qty?, when?, everyMinutes?}` | Watch a product. `store` is `test` or `bestbuy.ca`; `maxCents` is in that store's currency |
| `POST /watches/check {id}`, `POST /watches/cancel {id}` | Check now, stop watching |
| `POST /ask {text}` | Droid turns your words into a watch |
| `POST /reorder` | Droid reads the receipts and proposes a reorder |
| `POST /supplies {url, cents}` | An agent buys a supply from an x402 API through the wallet track: it asks the price, then pays exactly that, asking you first above `cents` |
| `GET /store`, `GET /store/products` | The GurtOS Test Store: products, orders, refused requests |
| `POST /store/checkout` | Checkout. TAP signature and Idempotency-Key required |
| `POST /store/admin {sku, priceCents?, inStock?}` | Demo controls: change a price or the stock |
| `GET /keys/box-shopper` | The agent registry entry |

## Setup

On each box or test VM, as root: `tracks/shopper/setup.sh`. It adds what is missing to `/etc/box/vault.env`:

| Key | Value |
|---|---|
| `SHOPPER_CARD` | `pm_card_visa`, Stripe's test PaymentMethod for the Visa test card 4242 4242 4242 4242 |
| `SHOPPER_AGENT_KEY` | A new Ed25519 private key (PKCS#8, base64). The box signs checkouts with it |
| `SHOPPER_MAIL_PASSWORD` | A new random password for the demo inbox |

Then add `STRIPE_SECRET_KEY=sk_test_...` by hand. Until it is there, payments are simulated and labeled so.
`STRIPE_PUBLISHABLE_KEY` is not needed: nothing here runs Stripe in a browser.

Live Best Buy checks need the Apify track's `APIFY_TOKEN`. x402 supplies need the wallet track's funded
`WALLET_SOLANA_KEY` and a seller: `node --experimental-strip-types tracks/wallet/seller.ts` serves a $0.03 report on port 4021.

## The demo step

`./demo` runs `demo.ts` offline in about 7 seconds:

- TAP at the checkout: the registry serves the public key; unsigned, changed and replayed orders are refused.
- Flow 1 on the GurtOS Test Store: a check sees the filters at $8.99, above the $7.00 limit. The store drops the
  price to $6.50, the next check asks "Buy 2 × … for $13.00? … TEST PAYMENT", the phone approves, and the task
  pays $13.00 within its $14.00 budget. The store verified the signature before charging.
- Flow 2: a scripted agent reads 10 receipts (2 other emails withheld), sees filters and paper towels run out
  this week, and proposes them. Approved, it pays $17.99; undone, the store refunds it.
- Flow 3: a supplies task asks a stand-in seller the price ($0.03, the same 402 answer as the wallet's test API).
  That is above its 2-cent budget, so the payment asks first; denied, the wallet never runs.
- No secret is anywhere in the action log.

Without the three shopper keys in the vault it prints `skip` and says to run `setup.sh`.

`DEMO_LIVE=shopper ./demo` (or `visa`) runs the same flows with real Stripe test-mode charges and refunds, and adds:
an agent paying $0.03 of devnet USDC for a report over x402 after your OK (its budget is 2 cents), Droid reading the receipts and proposing (denied, so
nothing is bought), a live Best Buy watch on Chemex filters (SKU 20220310) through Apify, bought at Best Buy's
live price, and Droid turning "Get me the Chemex coffee filters at Best Buy when they're under $14" into a watch.

It ran on Oct 23 on an x86 test VM: Stripe test mode charged the filters (`pi_3UTv9jA2XM7HasiU0WFlJgLU`) and
refunded the undone reorder (`re_3UTv9lA2XM7HasiU0SsOoCt1`); the agent paid $0.03 of devnet USDC for its
report ([transaction](https://explorer.solana.com/tx/5PCwxRVPZ7hzjHaXPLtpbYH2k3nEdkzwjUxZXaVYcm46TsnGqkvGYtbCctcgWdpnAMzgRQu76MKW2HfByAzkcFvB?cluster=devnet));
Droid proposed exactly the filters and paper towels; Apify read the Chemex filters at $15.36 CAD and the box
bought them at that price after the OK (`pi_3UTvAGA2XM7HasiU1M2tDyqT`); and Droid set "under $14" as a $13.99
limit.

Unit tests, offline: `node --experimental-strip-types --test tracks/shopper/shopper.test.ts`.

## What is real and what is simulated

| Part | Status |
|---|---|
| Best Buy Canada prices and stock | Live, through Apify's Playwright Scraper (the Apify track's `apify.checkPrice`) |
| Product matching from your words, reading receipts | Live: Droid with Claude |
| The GurtOS Test Store | Ours. It stands in for the merchant, because no real store takes a test card. A Best Buy deal is bought here at Best Buy's live price |
| Payments | Stripe test mode with a Visa test card once `STRIPE_SECRET_KEY` is in the vault; simulated before that, and in offline demo runs. Never real money |
| Visa Trusted Agent Protocol | Real signatures and checks, per Visa's open sample. The registry is the box's own route, not Visa's |
| The mailbox | A demo POP3 server on the box with sample receipts we wrote, standing in for Gmail (we could not make a Gmail account for the demo) |
| CAD prices against US-cent budgets | A fixed rate of 0.73 |
| x402 supplies | Real x402 payments by the wallet track, in USDC on Solana devnet (test money) |

Best Buy Canada does not sell Hario V60 filters, so the live example watches Chemex filters. The test store sells
the Hario filters from the design.

## Visa's criteria

- **Innovation in reimagining shopping (25%).** Shopping becomes standing instructions: "when it's under $16",
  "when it's back", "keep us stocked". An always-on box carries them out, and you only answer yes or no.
- **User experience (25%).** Say it in words, or fill four fields. The phone shows one card: what, how many, the
  price against your limit, TEST PAYMENT, Approve. Undo gives the money back.
- **Technical execution with AI (20%).** Claude (inside Factory's Droid) matches products and reads receipts.
  Code does the money: the price rule, the budget, the signature, idempotent charges that survive a power cut.
  Apify supplies live prices. Every check, approval and payment is a line in the action log.
- **Commerce impact (15%).** Merchants get agent orders they can verify (TAP) instead of blocking all bots, and
  sales at the price the buyer named. Households stop running out.
- **Trust and responsibility (15%).** The agent never sees the card or the mailbox login and cannot buy on its
  own. Every purchase needs your tap and stays within its budget. Signed orders cannot be changed or replayed.
  Test money only, enforced in code.

## Limits

- A watch closes after one purchase, or when you deny it. Watch again for another.
- The running-low estimate assumes each purchase lasts until the next, whatever the quantity.
- The test store keeps price and stock changes in memory; they reset when the box restarts. Orders are on disk.
- The store remembers used nonces in memory. After a restart a captured signature could be sent again within its
  8 minutes, but its Idempotency-Key still returns the first order instead of charging twice.
- Routes reach the vault through model jobs (`shopper.pay`, `shopper.agentKey`, `shopper.mailLogin`), because
  routes and triggers have no `secrets` slot. Any track's code could call those jobs.
