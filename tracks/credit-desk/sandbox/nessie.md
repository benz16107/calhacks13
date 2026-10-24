# Capital One Nessie: the credit desk's bank

Loaded on 2026-10-23 from `cases/fogline-2026-10` with `nessie-seed.ts`, and read back. Sources: https://nessieisreal.com
(Getting Started and Documentation) and its OpenAPI 3.0.3 spec at https://nessieisreal.com/nessie-openapi-spec.yaml.
Where the live API and the spec disagree, this file says what the live API did.

## Key

`NESSIE_API_KEY` is in the box vault, `/etc/box/vault.env`, on both test VMs. It goes on every request as a query
parameter, `?key=...`. Both test VMs share the key, so they see the same Nessie data. Use HTTPS:
`https://api.nessieisreal.com` and `https://prod-api.nessieisreal.com` both answer; plain HTTP does not connect.

Customer endpoints (no `/enterprise`) create, change and delete data the key owns. Enterprise endpoints are read-only.
The desk only needs customer endpoints.

## What is loaded

| Credit desk | Nessie | Count |
|---|---|---|
| Fogline Supply Co. | Customer `Fogline` / `Supply Co.`, Checking account `Fogline Operating` | 1 |
| Each row of `customers.csv` | Customer with `first_name` = legal name and `last_name` = customer id (`C-1001`), Checking account `<legal name> checking` | 12 |
| Each row of `invoices.csv` | Bill on that customer's account: `payee` "Fogline Supply Co.", `nickname` = invoice id, `payment_amount` = total, `payment_date` = due date, `status` `completed` if the ledger says paid, else `pending` | 38 |
| Each payment the bank could have cleared | Deposit into `Fogline Operating` on the received date. The description holds the payment id, payer, reference, remittance memo and exact amount, e.g. `PMT-8812 from Golden Gate Bagel Co \| ACH 1009 GGB \| memo INV-24098 \| exact 1940.00` | 14 |
| Each applicant in `sources/bank_statements.csv` | Customer (`last_name` = application id) and Checking account, one deposit per month dated the 28th | 6 applicants, 31 deposits |

The ledger CSVs are Fogline's accounting system. Nessie is the bank: it shows what money arrived, and from whom. So it
disagrees with the ledger in the planted places:

- PMT-8812's deposit says it came from Golden Gate Bagel with memo INV-24098, while the ledger applied it to
  Greenleaf's INV-24089 (E03).
- There is no deposit for Dogpatch Deli's check: it is dated 2026-11-06, after the case date, so the seed skips any
  payment whose `payment_date` is later than `as_of`. The ledger still marks INV-24091 paid (E05).
- Lakeshore Diner's deposits average 17,600 a month against a claimed 1.85M a year (E11). Pacific Crest has one month
  of deposits in an account opened in August (E10).

## Load it again

On a test VM, as root so the script can read the vault, from a copy of `tracks/credit-desk`:

```sh
sudo node sandbox/nessie-seed.ts cases/fogline-2026-10 /tmp/nessie-ids.json
```

It looks up every customer, account, bill and deposit before creating it, so running it again creates nothing. Every
run rewrites the id map (case id to Nessie id), which is how to get the ids back after a restart.

## How the live API behaves

- **Create calls return the new object**: `{"code": 201, "message": "...", "objectCreated": {..., "_id": "..."}}`.
  The spec says they return only a string.
- **Deposits drop cents silently.** A deposit of 2169.72 is stored as 2169. The seed rounds to whole dollars itself and
  keeps the exact amount in the description. Bills keep cents.
- **A bill created without `recurring_date` breaks every bill list on its account.** It is stored, but
  `GET /accounts/{id}/bills`, `GET /customers/{id}/bills` and `GET /bills/{id}` then fail with HTTP 400 ("field
  required: recurring_date, upcoming_payment_date"). Updating the bill afterwards does not fix it; only deleting it
  does. Creating it with `recurring_date` (the seed uses the day of the due date) makes Nessie fill in
  `upcoming_payment_date`, and the bill reads fine. `upcoming_payment_date` cannot be sent.
- **Account balances do not move** when a completed deposit is added. Use the deposits, not `balance`.
- Customers cannot be deleted (no route). Accounts, bills and deposits can.
- Addresses need `street_number` and `street_name` as separate fields, plus `city`, `state` and a 5-digit `zip`.
- Account `type` is `Credit Card`, `Savings` or `Checking`. Bill `status` is `pending`, `cancelled`, `completed` or
  `recurring`.
- Transfers have no create route, so payments are deposits.

## Questions for Capital One

1. Bills without `recurring_date` make the bill lists fail with HTTP 400. Known bug? Is `recurring_date` meant to be required?
2. Can a customer be deleted, so a reseed can start clean?
3. Should account `balance` change when a deposit completes?
