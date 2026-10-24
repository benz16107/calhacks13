# Credit desk

An AI agent that runs one corner of a small company's finance team. The company is Fogline Supply Co., a made-up
Oakland wholesaler of coffee and cafe supplies (`company/profile.md`).

**Seats:** a credit analyst agent checks new business customers and proposes terms; a collections clerk agent invoices,
applies payments and chases late ones; a human controller approves anything above the analyst's $10,000 authority and
every fraud referral.

This folder holds the data, the answer key, the input format and the draft rules. The agent comes next: another
thread adds `track.ts` and `demo.ts` here to wire it into the box. Until then the box and `./demo` skip this folder.

**The moment:** a new applicant whose numbers look clean, and whom a simple rule approves for $20,000, is a synthetic
identity. CRS's identity and fraud checks catch it before an $18,500 rush order ships to a freight forwarder.

## What is here

| Path | What it is |
|---|---|
| `company/profile.md` | The company: what it sells, size, people and seats, terms, current customers, policy in brief |
| `rules/credit-rules.draft.yaml` | Credit rules, **first draft**. Ben's Mana chats will replace it. Every rule has an id that decisions cite |
| `cases/fogline-2026-10/` | The planted case: 12 trade customers, 38 invoices, 15 payments, 6 open orders, 6 credit applications |
| `cases/fogline-2026-10/answer_key.json` | Every planted error, where it is, and what a correct desk concludes |
| `sandbox/crs.md`, `sandbox/crs-personas.json` | CRS: calls, request bodies, the 20 test people, the persona each applicant uses, keys |
| `sandbox/nessie.md` | Capital One Nessie: how the ledger maps onto the bank, limits in the API, keys |
| `check-case.ts` | Checks that a case folder follows the format below |

## The planted case

As of **2026-10-23**. Fourteen planted errors: eight for the collections clerk, six for the credit analyst. The answer key also holds the expected decision on
every application, the collection step for every customer, the release or hold for every order, and seven things that
look wrong but are fine (to catch false alarms).

| Id | Seat | Planted error | Where |
|---|---|---|---|
| E01 | clerk | The same customer exists twice, with two limits | `customers.csv` C-1007, C-1011 |
| E02 | clerk | Invoice header total does not match its lines | `invoices.csv` INV-24105 |
| E03 | clerk | Payment applied to the wrong customer's invoice | `payments.csv` PMT-8812 |
| E04 | clerk | The same order billed twice | `invoices.csv` INV-24116, INV-24117 |
| E05 | clerk | Post-dated check recorded as cash | `payments.csv` PMT-8823 |
| E06 | clerk | Early-payment discount taken after the window | `payments.csv` PMT-8806 |
| E07 | clerk | Invoice dated a year early, so it looks 359 days late | `invoices.csv` INV-24111 |
| E08 | analyst | Credit limit not reviewed for 29 months | `customers.csv` C-1002 |
| E09 | clerk | Customer over its limit but not on hold | `customers.csv` C-1005 |
| E10 | analyst | **Fake applicant (synthetic identity) that a simple rule approves** | `applications/APP-1043.json` |
| E11 | analyst | Stated revenue is 9 times what the bureau and bank show | `applications/APP-1046.json` |
| E12 | analyst | Application denies liens; public records show a lien and a judgment | `applications/APP-1044.json` |
| E13 | analyst | Applicant attached their own 18-month-old credit report | `applications/APP-1045.json` |
| E14 | analyst | The three credit bureaus disagree | `applications/APP-1045.json` |

The simple rule in the rules file approves all six applications for $153,000. Following the rules, the desk approves
$8,000 itself, sends $83,500 to the controller at reduced limits, and stops $20,000 as fraud.

Also messy on purpose, but not errors: customer names printed and remitted several ways ("Mission St. Taqueria",
"MISSION ST TAQ INC"), phone and EIN formats that vary, an "Oakalnd" typo, a customer with two ship-to addresses, and
discounts that were earned.

## Input format

A case is a folder under `cases/`. Only `case.json` is required. Leave out any file the case does not need: a case can
be a single credit application.

```
cases/<case-id>/
  case.json
  customers.csv  invoices.csv  invoice_lines.csv  payments.csv  orders.csv
  applications/<application-id>.json
  sources/business_credit.json  sources/bank_statements.csv
  answer_key.json
```

Conventions for every file:

- CSV: UTF-8, comma-separated, one header row. Quote a field that contains a comma: `"3150 Geary Blvd, San Francisco CA"`.
- Dates are `YYYY-MM-DD`; months are `YYYY-MM`. Money is a plain decimal (`4862.40`): no `$`, no thousands separators.
- A blank field means unknown or none. Extra columns are allowed and ignored by the checker.
- The data is the accounting system's view, mistakes included. Names may be misspelled or written several ways. That is
  the point.

### case.json

| Field | Required | Meaning |
|---|---|---|
| `case_id` | yes | Short id, usually the folder name |
| `as_of` | yes | The date the desk works on. All aging and freshness counts from it |
| `title`, `description` | no | For people |
| `currency` | no | `USD` |
| `company_profile` | no | Path to the company profile, relative to the case folder |
| `rules` | no | Path to the rules file, relative to the case folder |

### customers.csv: the customer master

| Column | Required | Meaning |
|---|---|---|
| `customer_id` | yes, unique | Id used by every other file |
| `legal_name` | yes | Name on the customer record |
| `terms` | yes | `Net 30`, `Net 15`, `2/10 Net 30` or `cash in advance` |
| `credit_limit` | yes | Dollars |
| `ein`, `phone`, `email` | no | As entered; formats vary |
| `address_line1`, `address_line2`, `city`, `state`, `zip` | no | Billing address |
| `last_credit_review` | no | Date the limit was last reviewed |
| `on_credit_hold` | no | `yes` or `no` |
| `created_on`, `sales_rep`, `notes` | no | Record history |

### invoices.csv: one row per invoice

| Column | Required | Meaning |
|---|---|---|
| `invoice_id` | yes, unique | |
| `customer_id` | yes | Must exist in `customers.csv` |
| `invoice_date`, `due_date` | yes | As recorded |
| `terms` | yes | Terms printed on the invoice |
| `total` | yes | Header total as recorded |
| `bill_to_name`, `po_number`, `ship_to` | no | As printed |
| `amount_paid`, `discount_allowed`, `balance`, `status` | no | What the system shows after the payments it applied. `status` is `open`, `partial` or `paid` |

### invoice_lines.csv: one row per invoice line

| Column | Required | Meaning |
|---|---|---|
| `invoice_id` | yes | Must exist in `invoices.csv` |
| `qty`, `unit_price`, `line_total` | yes | |
| `line_no`, `sku`, `description`, `unit` | no | |

### payments.csv: one row per payment applied to one invoice

A check that pays two invoices is two rows with the same `reference`.

| Column | Required | Meaning |
|---|---|---|
| `payment_id` | yes, unique | |
| `received_date` | yes | When Fogline received it |
| `customer_id` | yes | The customer the system posted it to (may be wrong) |
| `amount` | yes | Cash applied, excluding any discount |
| `applied_invoice_id` | no | The invoice it was applied to. Blank means unapplied cash |
| `payment_date` | no | Date written on the check, or the ACH effective date |
| `payer_name`, `method`, `reference`, `remittance_memo` | no | As the payer wrote them |
| `discount_taken` | no | Early-payment discount the system allowed |

### orders.csv: open orders waiting for credit release

| Column | Required | Meaning |
|---|---|---|
| `order_id` | yes, unique | |
| `customer_id` | yes | Must exist in `customers.csv` |
| `order_date` | yes | |
| `amount` | yes | |
| `requested_ship_date`, `status`, `entered_by`, `notes` | no | |

### applications/APP-XXXX.json: one file per credit application

The file name must be the `application_id`. Required fields are marked; everything else is optional.

```jsonc
{
  "application_id": "APP-1041",                 // required, same as the file name
  "received_at": "2026-10-19T09:42:00-07:00",   // required
  "channel": "web form",
  "submitted_from_ip": "203.0.113.29",          // sent to CRS Fraud Finder
  "business": {
    "legal_name": "Kettle & Crumb LLC",         // required
    "dba": "...", "entity_type": "LLC", "state_of_formation": "CA", "ein": "82-4471093",
    "year_started": 2017,
    "years_in_business": 9,                     // required, number, as the applicant states it
    "annual_revenue": 620000,                   // required, number, as the applicant states it
    "employees": 11, "industry": "...",
    "billing_address": { "line1": "...", "line2": "...", "city": "...", "state": "CA", "zip": "94707" },
    "ship_to_address": { "line1": "...", "city": "...", "state": "...", "zip": "..." },
    "phone": "...", "email": "...", "website": "..."
  },
  "request": {
    "credit_limit": 8000,                       // required, number
    "terms": "Net 30", "first_order_amount": 2150, "first_order_ship_date": "2026-10-28", "reason": "..."
  },
  "guarantor": {                                // the owner who signs the personal guarantee; CRS is run on this person
    "first_name": "GRACE", "last_name": "NAKAMURA",        // required
    "ssn": "666701019",                                    // required, 9 digits
    "dob": "1976-09-16",                                   // required
    "home_address": { "line1": "1850 SOLANO AVE", "city": "BERKELEY", "state": "CA", "zip": "94707" },  // required
    "phone": "5550101019", "email": "grace.nakamura@example.com", "title": "Owner", "ownership_pct": 100
  },
  "declarations": { "bankruptcy_last_7_years": false, "open_liens_or_judgments": false,
                    "personal_guarantee_signed": true, "credit_check_authorized": true },
  "trade_references": [ { "name": "...", "contact": "...", "phone": "...", "customer_since": "2018", "high_credit": 6500, "terms": "Net 15" } ],
  "bank_reference": { "bank": "...", "account_opened": "2017-02-27", "letter_date": "2026-10-05" },
  "attachments": [ { "type": "credit report", "supplied_by": "applicant", "bureau": "TransUnion", "report_date": "2025-04-02", "score": 760 } ]
}
```

**The guarantor block must be one of CRS's 20 test people, copied exactly** from `sandbox/crs-personas.json`
(upper case, same address). The CRS sandbox only returns results for those people. Everything else in the application
(the business, the request, the references) can be anything.

### sources/: other data the desk can check against

- `business_credit.json`: `{ "simulated": true, "reports": [ ... ] }`. One report per business: `report_id`,
  `application_id`, `legal_name`, `ein`, `report_date`, `registration` (`state`, `filed_on`, `status`,
  `registered_agent`), `estimated_annual_revenue` (null when the bureau has no figure), `estimated_employees`,
  `trade_lines`, `days_beyond_terms`, `inquiries_last_30_days`, `ucc_filings`, `business_liens_judgments`, `remarks`.
  **Simulated**: the CRS sandbox has no business credit route yet (see `sandbox/crs.md`).
- `bank_statements.csv`: monthly totals from each applicant's bank account. Columns `application_id` (required),
  `bank`, `account_opened`, `month` (required), `deposits_total` (required), `deposit_count`, `ending_balance`.
  For the live demo these are loaded into Nessie as deposits (see `sandbox/nessie.md`).

### answer_key.json (optional)

Only needed to score the desk. Each entry in `planted_errors` has `id`, `seat`, `category`, `title`, `where` (a list
of `{file, id}`, where `id` is the row's first column in a CSV or a string in a JSON file), `what_is_wrong`,
`correct_conclusion`, `if_missed` and the `rules` it rests on. Also `application_decisions`, `collections`,
`order_decisions`, `not_errors` and `totals`. Scoring: an error counts as caught when the desk's log names one of its
locations and reaches its conclusion. Flagging a `not_errors` item is a false alarm.

## Add your own case

1. Make a folder: `cases/my-case/` with a `case.json` (`case_id`, `as_of`, and the `rules` path
   `../../rules/credit-rules.draft.yaml`).
2. For a credit application: copy `cases/fogline-2026-10/applications/APP-1041.json` to
   `cases/my-case/applications/APP-2001.json`, set `application_id` to `APP-2001`, and paste a guarantor from
   `sandbox/crs-personas.json`. P05 (subprime), P12 (identity mismatch), P14 (deceased SSN) and P16 (fraud alert) are
   good ones to try. Change the business however you like.
3. For a ledger case: copy the CSVs from `cases/fogline-2026-10/` and edit them.
4. Check it:

   ```sh
   node tracks/credit-desk/check-case.ts tracks/credit-desk/cases/my-case
   ```

   The checker confirms required files, columns, dates, numbers and that ids point at rows that exist. It does not look
   for planted errors, so a case full of mistakes passes as long as its structure is right.

No code changes are needed: the desk reads whatever case folder it is pointed at. Tests for the checker:
`node --test tracks/credit-desk/check-case.test.ts` (Node 22 or newer).

## Keys

None are in the repo, and nothing here has called a sponsor API yet.

| Service | Key | How to get it |
|---|---|---|
| CRS Credit API sandbox | `CRS_USERNAME`, `CRS_PASSWORD` | Invite form at https://calhacks.crscreditapi.com; details in `sandbox/crs.md` |
| Capital One Nessie | `NESSIE_API_KEY` | GitHub login at https://nessieisreal.com, then Profile; details in `sandbox/nessie.md` |

## For the sponsor tracks

- **Hyphenate (Autonomous Systems for Finance).** Company: Fogline Supply Co. Seats: credit analyst and collections
  clerk, with a human controller. Messy data with 14 planted errors and an answer key; sources that disagree (three
  bureaus, the application against the bureau and the bank, the ledger against Nessie); time (aging, a post-dated check,
  a stale report, an overdue review); approvals and segregation of duties (rules SOD-1 to SOD-4); every decision cites
  a rule id and the CRS RequestID behind it. Judges can bring their own case in the format above.
- **CRS.** Identity verification, Fraud Finder, tri-bureau credit and PitchPoint sit at the center of every credit
  decision, all against sandbox test identities. The fake applicant is the Identity/Fraud moment. The desk pulls only
  what the decision needs (no criminal or eviction searches) and only with the guarantor's signed consent.
- **Capital One Nessie.** Nessie is Fogline's bank: customer payments arrive as deposits, invoices are bills, and the
  bank is the second source the clerk reconciles the ledger against.
- **Microsoft (Built for the Real World).** Measurable: "caught N of 14 planted errors" against the answer key, plus
  decisions matched on six applications, eleven customers and six orders. Responsible design: the agent cannot approve
  its own large proposals or clear a fraud flag.

## Rules are a draft

`rules/credit-rules.draft.yaml` is a first draft so the answer key has something to cite. Ben is planning the real
rules in Mana chats (the Mana track judges that Mana shaped the design). When that output lands, replace the file, keep
or remap the rule ids, and update `application_decisions` in the answer key if a decision changes.
