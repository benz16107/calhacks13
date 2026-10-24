# Capital One Nessie: the credit desk's bank

Read on 2026-10-23 from https://nessieisreal.com (Getting Started and Documentation pages) and its OpenAPI 3.0.3 spec
at https://nessieisreal.com/nessie-openapi-spec.yaml. **Nothing was called with a key.** No key exists yet.

## Key Ben needs

| What | Where to get it | Store as |
|---|---|---|
| One Nessie API key | Log in with GitHub at https://nessieisreal.com, then open Profile | `NESSIE_API_KEY` in a git-ignored `.env` on the test VM |

The key goes on every request as a query parameter: `?key=...`. One key is enough. It owns its own customers.

## Base URL: check on the first call

- Getting Started says `api.nessieisreal.com` (for example `api.nessieisreal.com/customers?key=...`).
- The spec's production server is `https://prod-api.nessieisreal.com`.
- Without a key, `https://api.nessieisreal.com` answers with AWS API Gateway errors, so it is live. Plain HTTP does
  not connect. Use HTTPS, and try `prod-api` if `api` fails.

## Two kinds of endpoint

- **Customer endpoints** (no `/enterprise`): you act as a bank customer and can create, change and delete data you own.
- **Enterprise endpoints** (`/enterprise/...`): read-only, everything in the system, as a Capital One analyst.

The desk only needs customer endpoints.

## How the case maps onto Nessie

The ledger CSVs are Fogline's accounting system. Nessie is the bank: it shows what money really arrived. Seeding both
from the case gives the desk two sources that disagree in the planted places, which is what Hyphenate asks for.

| Credit desk | Nessie | Notes |
|---|---|---|
| Fogline Supply Co. | Customer `Fogline` / `Supply Co.`, one Checking account nicknamed `Fogline Operating` | Receives every customer payment |
| Each row of `customers.csv` | Customer with `first_name` = legal name, `last_name` = customer id (`C-1001`), one Checking account | The id in `last_name` makes the join easy |
| Each row of `invoices.csv` | Bill on that customer's account: `payee` "Fogline Supply Co.", `nickname` = invoice id, `payment_amount` = total, `payment_date` = due date, `status` `pending` (open) or `completed` (paid) | Mirrors the ledger as recorded, errors included |
| Each row of `payments.csv` | Deposit into `Fogline Operating`: `medium` "balance", `transaction_date` = received date, `amount`, `status` "completed", `description` = payment id, payer and remittance memo | Mirrors the money. **Skip PMT-8823**: the post-dated check cannot be deposited before 2026-11-06 |
| Each applicant in `sources/bank_statements.csv` | Customer and Checking account per applicant, one deposit per month | The applicant shares this account so the desk can check stated revenue |

What the bank then shows against the ledger:

- PMT-8812's deposit says "Golden Gate Bagel Co, INV-24098" while the ledger applied it to Greenleaf's INV-24089 (E03).
- No deposit exists for Dogpatch Deli's check, yet the ledger marks INV-24091 paid (E05).
- Lakeshore Diner's deposits average 17,600 a month against a claimed 1.85M a year (E11).

## Limits in the spec

- **Deposit `amount` is an integer**, and so is account `balance`. Payments have cents (2,169.72). Until a keyed call
  shows decimals are accepted, round to whole dollars in Nessie and keep the exact amount in the deposit
  `description`. The ledger CSVs stay the record of exact amounts.
- Bill `payment_amount` is a number, so cents are fine there.
- **Create calls return a string** ("Customer created", "Bill created"), not the new object. To get the new `_id`, list
  afterwards (`GET /customers`, `GET /customers/{id}/accounts`, `GET /accounts/{id}/bills`) and match on name or nickname.
- Addresses need `street_number` and `street_name` as separate fields, plus `city`, `state`, `zip`.
- Account `type` is one of `Credit Card`, `Savings`, `Checking`. Bill `status` is one of `pending`, `cancelled`,
  `completed`, `recurring`.
- Transfers have no create endpoint in this spec (only get, update and delete by id), so payments are deposits.

## Seed order (for the thread that wires this in)

1. `POST /customers` for Fogline, then `POST /customers/{id}/accounts` for `Fogline Operating`.
2. For each customer row: `POST /customers`, then a Checking account.
3. For each invoice: `POST /accounts/{customer account}/bills`.
4. For each payment except PMT-8823: `POST /accounts/{Fogline Operating}/deposits`.
5. For each applicant: customer, Checking account, then one deposit per month from `bank_statements.csv`.
6. Write the Nessie ids next to the case ids in a git-ignored file on the VM, so a reseed is not needed after a restart.

## Questions worth asking Capital One

1. Does a deposit accept a decimal `amount`, or only whole dollars?
2. Is there a way to get the new object's id from a create call, or is listing the only way?
3. Is `api.nessieisreal.com` or `prod-api.nessieisreal.com` the right base for the hackathon?
4. Does deleting a customer remove its accounts, bills and deposits, so a reseed starts clean?
