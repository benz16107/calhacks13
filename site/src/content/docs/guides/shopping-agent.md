---
title: Set up the shopping agent
description: Set up the Shopper app so an agent compares stores, watches prices, and pays only after you approve a signed mandate and each purchase, with Face ID and test payments.
---

The Shopper app turns shopping into standing instructions. "Get me the coffee filters when they're under $7." You first approve a **shopping mandate**: the items, the stores, the most you will pay and when it expires. The box signs it, then checks the stores on a schedule. When an item is in stock at or under your price, it asks for your OK on that one purchase, and pays only after you approve. It can also read household receipts, propose a reorder, and find savings after you buy. In this guide you set up the app and run one watch from start to purchase.

:::caution[Test payments only]
Every payment here is a test payment: Stripe test mode or the Cybersource sandbox with a Visa test card, or a simulated charge. No real money moves and nothing ships. Checkout happens at the **GurtOS Test Store**, a small store the app runs on the box, because no real store accepts a test card. Where a payment is simulated instead, the app, the log and the order say so.
:::

## Before you start

- A box installed on Ubuntu, with a root shell and a source checkout. See [Install on Ubuntu](/get-started/install-on-ubuntu/).
- A model key in the vault (`ANTHROPIC_API_KEY` or `FACTORY_API_KEY`), so Droid can turn your words into a watch and read receipts.
- Optional: a Stripe account in test mode, or a free Cybersource sandbox account, for test-mode charges instead of simulated ones.
- Optional: `APIFY_TOKEN` in the vault, for live price checks at Best Buy Canada and Gold Roast (goldroast.ca).
- Optional: for Face ID, the box's https address (see [Reach your box from anywhere](/guides/reach-your-box-from-anywhere/)), or `http://localhost:7700` on the box itself. Browsers never make a passkey for a plain IP address.

## Steps

1. **Add the app's keys to the vault.** From the checkout, as root:

   ```sh
   sudo tracks/shopper/setup.sh
   ```

   It adds what is missing and leaves existing values alone:

   | Key | Value |
   |---|---|
   | `SHOPPER_CARD` | `pm_card_visa`, Stripe's test PaymentMethod for the Visa test card |
   | `SHOPPER_AGENT_KEY` | A new Ed25519 private key the box signs checkouts with |
   | `SHOPPER_MAIL_PASSWORD` | A new random password for the sample inbox |

2. **Optional: add a payment key.** Add one by hand. The app picks the provider from the keys in the vault, and refuses a live key.

   ```ini
   STRIPE_SECRET_KEY=sk_test_your-test-key
   ```

   Or, for the Cybersource sandbox, `CYBERSOURCE_MERCHANT_ID`, `CYBERSOURCE_KEY_ID`, `CYBERSOURCE_SECRET_KEY` and `CYBERSOURCE_TEST_CARD` (`number|MM|YYYY`, a Cybersource test card). Until a key is there, payments are simulated and labelled so.

3. **Restart the box service** so it reads the vault.

   ```sh
   sudo systemctl restart box.service
   ```

4. **Open the app.** In the portal, open **Shopper (test payments)**, or browse to `/t/shopper/` on the box. The store is at `/t/shopper/store`. Open it on the box's own screen, or through an SSH tunnel to the box. From another device the box asks every request for a paired device's token, and the app's pages do not send one yet.

5. **Make a watch.** Type what you want in words, or fill in the stores, product, price limit and quantity. For example: "Two packs of the V60 paper filters when they're under $7 each." Droid finds the product and proposes a **mandate** with the `shopper.watch` tool. It cannot buy anything itself.

   **Approve the mandate first.** Nothing is checked until you do. The approval shows every limit: the items or exact product codes, the stores, the price per item, the quantity, the total, the category and the expiry (at most 30 days). The box then signs exactly those terms. The store refuses anything outside them for the mandate's whole lifetime: another item, a higher price, another store, more items, an expired mandate, or one edited after signing.

   With the API instead:

   ```sh
   curl -s http://127.0.0.1:7700/t/shopper/watches -H 'content-type: application/json' -d '{
     "text": "Hario V60 paper filters",
     "offers": [{"store": "test", "product": "HV60-100"}],
     "maxCents": 700, "qty": 2, "category": "household", "days": 7, "when": "price", "everyMinutes": 60
   }'
   ```

   - `offers` lists 1 to 4 stores, each once. All must use one currency: Best Buy Canada and Gold Roast are in CAD, the GurtOS Test Store is in USD.
   - `store` is `test` (the GurtOS Test Store), `bestbuy.ca` or `goldroast.ca`. `product` is a product code or search words.
   - `category` is `coffee`, `household`, `electronics` or `other`, and spending rules use it.
   - `expires` (a date) or `days` (1 to 30, default 7) sets how long the mandate lasts. `when` is `price` or `restock`.
   - The older form `{store, product, maxCents, qty}` still works and means one store.

   `HV60-100` is the test store's Hario V60 filters.

6. **Wait for the price.** The box checks the store on a schedule. Each check is a task with no network and no secrets, and its result goes into the action log. To try it now, drop the test store's price:

   ```sh
   curl -s http://127.0.0.1:7700/t/shopper/store/admin -H 'content-type: application/json' \
     -d '{"sku": "HV60-100", "priceCents": 650}'
   ```

7. **Approve the purchase.** When an item is in stock at or under your limit, the box compares the in-stock offers by total for the quantity, with shipping, and explains its choice. If you set spending rules, it checks them before it asks. Then it starts a purchase task and asks:

   ```text
   Buy 2 × Hario V60 02 paper filters, 100 count for $13.00? $6.50 each, down from $8.99, under your $7.00 limit. TEST PAYMENT.
   ```

   Tap **Approve** on the phone or in the portal. Only then does `shopper.buy` sign the order, with the mandate attached, and pay the GurtOS Test Store.

![The Shopper app: a test payments notice, a watch list with a request to approve a $13.00 test payment, and recent orders paid with a Visa test card.](../../../assets/screens/design-shopper.png)

*Shopper, from the current design. Every payment is test money.*

## Approve with Face ID

Once you set up a passkey, a purchase can be approved only with Face ID (or Touch ID, or the device's PIN). On the box's own screen or an owner phone, open the app and choose **Set up Face ID**. The box builds what is signed from its own records, the approval's exact question and amount, so a signature for "$13.00" cannot approve "$130.00" or be used twice. After that, `shopper.buy` refuses a purchase approved with a plain tap: "approved without Face ID". So a stolen pairing token can press Approve, and nothing is paid. Changing your spending rules needs Face ID too, and adding a second passkey needs a signature from the first.

A passkey belongs to the address it was made on, and there is no remove button yet. On an address with no HTTPS, the app says so and approvals fall back to a plain tap. This is our own implementation with open tools, not Visa's payment passkey service.

## Spending rules

Set rules like the controls in a card app: a monthly cap, a cap per store, a cap per category (0 blocks it), and "never buy" words matched as whole words. The box checks them before it asks you about a deal, so it never asks for something your rules forbid, and again inside `shopper.buy` right before paying.

```sh
curl -s http://127.0.0.1:7700/t/shopper/rules
```

`GET /rules` returns the rules and what has been spent. `POST /rules {rules}` saves them, and with a passkey set up it needs a Face ID assertion. Amounts are in US dollars; Canadian prices count at a fixed 0.73.

## Savings after you buy

- **Price protection.** For 30 days after a purchase at the GurtOS Test Store, the box re-checks the price. If it drops, it sends a signed request and the store refunds the difference as a partial test refund. No approval is needed, since money only comes back. Run a check now with `POST /t/shopper/savings/check`.
- **Unused subscriptions.** `POST /t/shopper/savings/subscriptions` finds subscriptions in the sample inbox that nobody has used. Droid proposes cancelling them, you approve (with Face ID once set up), and a signed request cancels each at the store.

## Reorder from receipts

Under **Household reorder** in the app, click **Check the receipts**, or call `POST /t/shopper/reorder`. Droid reads the receipts in the sample inbox with `shopper.receipts`, works out what runs out this week, and proposes one reorder with `shopper.propose`. You approve or deny it the same way.

`shopper.receipts` returns receipts only, and says how many other emails it left behind. The agent never sees the mailbox password or your other mail. `shopper.propose` takes product codes and quantities, and looks up the prices itself, so a confused or hijacked model cannot make up a price.

## Check it worked

- The order shows in the app and at `/t/shopper/store`, marked as a test payment.
- `GET /t/shopper/state` lists watches, pending approvals, recent tasks and orders.
- The purchase task's log has the approval, the checkout and its cost. No secret appears in the log.
- Undo the purchase task. The store refunds its order.

## How a purchase is made safe

- **The model never holds a buy tool or a card.** Only purchase tasks the box starts hold `shopper.buy`, and each one asks you first.
- **Two gates on money.** Your tap, then the task's budget: your limit times the quantity. A purchase above the budget stops and asks again.
- **Signed mandate, signed orders.** Each order carries the signed mandate, and the store checks the mandate as well as the request. The box signs each checkout with an HTTP message signature in the style of Visa's Trusted Agent Protocol (Ed25519, with a nonce and an 8-minute expiry). It also signs a digest of the body. The store refuses unsigned orders, changed orders, replayed signatures, expired signatures and unknown keys. The box publishes its public key at `/t/shopper/keys/box-shopper`.
- **Power cuts don't pay twice.** Each checkout carries the call's stable key as its idempotency key, at the store and at Stripe.
- **Test money only, enforced.** The store refuses a live Stripe key, a simulated charge accepts only Stripe's test cards, and orders above $500 are refused.
- **One proposal and one watch per agent task,** so a looping agent cannot flood your phone.

## The store's side

The GurtOS Test Store is also a merchant's dashboard at `/t/shopper/store`. It counts the requests it sees: verified agent orders and how many were approved with Face ID; unknown bots it refused, by reason (unsigned, bad signature, replayed, changed in transit, unknown agent) and the mandate refusals (over price, wrong item, wrong store); conversion from agent shoppers; price adjustments and cancellations; and zero chargebacks, with the reason: every order had a valid signature, a signed mandate it fits and a person's approval. `GET /store/stats` returns the same counts.

## Routes

All under `/t/shopper/` on the box's API.

| Route | Does |
|---|---|
| `GET /` | The app |
| `GET /state` | Watches, pending approvals, recent tasks, orders, and which keys the vault has |
| `POST /watches {text, offers: [{store, product}], maxCents, qty?, category?, expires? or days?, when?, everyMinutes?}` | Propose a mandate for 1 to 4 stores. The old `{store, product, maxCents, qty?, when?, everyMinutes?}` form still works. |
| `POST /watches/check {id}`, `POST /watches/cancel {id}` | Check now, or stop watching |
| `POST /ask {text}` | Droid turns your words into a proposed mandate |
| `GET /rules`, `POST /rules {rules, assertion?}` | Your spending rules and what has been spent; save them (needs Face ID once a passkey exists) |
| `POST /savings/check`, `POST /savings/subscriptions` | Check price protection now; look for unused subscriptions |
| `GET /passkey/status`, `GET /passkey.js` and the `/passkey/...` routes | Face ID set-up and approval, used by the app's page |
| `POST /reorder` | Droid reads the receipts and proposes a reorder |
| `POST /supplies {url, cents}` | An agent buys a supply from an x402 API through the wallet app: it asks the price first, then pays exactly that, and asks you first when the price is above `cents`. Test money. |
| `GET /store`, `GET /store/stats`, `GET /store/products` | The GurtOS Test Store and its merchant dashboard |
| `POST /store/checkout` | Checkout. A signature and an idempotency key are required |
| `POST /store/admin {sku, priceCents?, inStock?}` | Test controls: change a price or the stock |
| `GET /keys/box-shopper` | The box's public signing key |

## Limits

- A watch closes after one purchase, when its mandate expires, or when you deny it. Watch again for another.
- The running-low estimate assumes each purchase lasts until the next, whatever the quantity.
- The test store keeps price and stock changes in memory. They reset when the box restarts. Orders are on disk.
- The store remembers used nonces in memory. After a restart, a captured signature could be sent again within its 8 minutes, but its idempotency key still returns the first order instead of charging twice.
- The inbox is a sample mailbox on the box with receipts written for testing. Connecting a real mailbox is not built.
- Best Buy Canada and Gold Roast prices are in Canadian dollars, converted at a fixed rate against budgets in US cents. A mandate covers stores in one currency.
- Best Buy Canada's Conditions of Use prohibit scraping. The Apify app reads its public product data, and the app says so. Gold Roast's robots.txt and terms do not prohibit it.
- The test store stands in for every merchant, so it trusts the store label on a line. Shipping and tax are compared but not charged.
- Visa Intelligent Commerce has an adapter but has never been called: it needs onboarding with Visa.

## Related

- [Let agents pay for APIs](/guides/agent-payments/)
- [Approve from your phone](/guides/approve-from-your-phone/)
- [Undo a task](/guides/undo-a-task/)
- [Approvals and budgets](/concepts/approvals-and-budgets/)
