# Fogline Supply Co. — Collections Clerk Report
**As of: 2026-10-23**
Prepared by: Collections Clerk

---

## Part 1 — Problems Found

Twelve problems were flagged. Each cites the rule it breaks.

---

### Problem 1 · PMT-8812 applied to wrong customer and wrong invoice
**Rule:** COL-6
**IDs:** PMT-8812, INV-24089 (C-1004), INV-24098 (C-1001)

PMT-8812 ($1,940.00, received 2026-10-09) came from Golden Gate Bagel Co. (C-1001). The bank deposit confirms: payer "Golden Gate Bagel Co.", ACH reference "ACH 1009 GGB," remittance memo "INV-24098." INV-24098 is a C-1001 invoice for exactly $1,940.00.

The accounting system applied the payment to C-1004 (Greenleaf Juice Co.) on INV-24089 ($1,490.00), producing a false $450.00 credit on C-1004 and leaving C-1001's INV-24098 appearing unpaid.

**Correction recorded:** PMT-8812 reassigned to C-1001/INV-24098. INV-24089 reopened at $1,490.00.

---

### Problem 2 · INV-24095 — Unearned early-payment discount
**Rule:** COL-4
**IDs:** INV-24095, PMT-8806 (C-1009)

INV-24095 (Rockridge Ramen, 2/10 Net 30, invoice date 2026-09-08). PMT-8806 was received 2026-10-02 — 24 days after the invoice date, outside the 10-day discount window. A 2% discount of $49.20 was taken, leaving $2,410.80 paid against a $2,460.00 invoice. Bank deposit confirms $2,410.80 received.

The $49.20 discount was not earned and remains owed.

**Correction recorded:** INV-24095 reopened for $49.20 balance.

---

### Problem 3 · PMT-8823 — Post-dated check; INV-24091 falsely marked paid
**Rule:** COL-5
**IDs:** PMT-8823, INV-24091 (C-1010)

PMT-8823 is Check 4471 from Dogpatch Deli, physically received 2026-10-20 but check-dated 2026-11-06 — 17 days in the future. INV-24091 ($2,036.75, due 2026-10-04) was marked "paid" in the ledger on receipt of the physical check. The bank deposit list shows no funds received for PMT-8823 as of 2026-10-23. A post-dated check is not cash until its date.

**Correction recorded:** INV-24091 reopened ($2,036.75). May be closed on 2026-11-06 when the check clears.

---

### Problem 4 · INV-24105 — Header total does not match line items
**Rule:** COL-6
**IDs:** INV-24105 (C-1012)

INV-24105 (Piedmont Provisions Catering, 2026-09-22). Invoice header total: **$4,862.40**. Sum of all 9 line items:

| Line | Item | Qty | Unit price | Line total |
|---|---|---|---|---|
| 1 | COF-HB5 | 16 | $52.50 | $840.00 |
| 2 | CUP-12H | 12 | $68.50 | $822.00 |
| 3 | LID-12H | 12 | $42.00 | $504.00 |
| 4 | CLM-9 | 16 | $54.75 | $876.00 |
| 5 | NAP-KR | 8 | $41.40 | $331.20 |
| 6 | GLV-NM | 6 | $64.00 | $384.00 |
| 7 | SAN-Q4 | 6 | $36.40 | $218.40 |
| 8 | BAG-KR | 5 | $46.20 | $231.00 |
| 9 | FRT | 1 | $79.80 | $79.80 |
| **Total** | | | | **$4,286.40** |

Overcharge in header: **$576.00**.

**Correction recorded:** INV-24105 corrected to $4,286.40. Do not bill or chase the $4,862.40 figure.

---

### Problem 5 · INV-24111 — Invoice date is year 2025 in a 2026 sequence
**Rule:** COL-6
**IDs:** INV-24111 (C-1012)

INV-24111 (Piedmont Provisions) carries invoice_date 2025-09-29 and due_date 2025-10-29. Every other invoice in this case is dated in 2026. INV-24111 falls in numeric sequence between INV-24110 (2026-09-29) and INV-24113 (2026-09-30), strongly indicating the correct date is **2026-09-29** (due 2026-10-29). If taken at face value, the invoice is 358 days past due — an impossible gap given no prior collection history.

**Correction recorded:** Date corrected to 2026-09-29, due date to 2026-10-29. Confirm with accounting before chasing.

---

### Problem 6 · INV-24116 / INV-24117 — Duplicate invoice
**Rule:** COL-6
**IDs:** INV-24116, INV-24117 (C-1008)

Both invoices share the same date (2026-10-02), PO number (FFTC-0930), due date (2026-10-17), and total ($1,486.40). All six line items are identical. The bank shows both as pending for C-1008, doubling the amount owed. INV-24116 is the original.

**Correction recorded:** INV-24117 voided. C-1008 open balance corrected from $2,972.80 to $1,486.40.

---

### Problem 7 · C-1007 / C-1011 — Duplicate customer record
**Rule:** COL-7
**IDs:** C-1007, C-1011

| Field | C-1007 | C-1011 |
|---|---|---|
| Name | Sunset Noodle Bar LLC | Sunset Noodle Bar |
| EIN | 47-3318290 | 473318290 (same digits) |
| Address | 1825 Irving St, SF | 1825 Irving Street Ste A, SF |
| Phone | 415-555-0147 | 415-555-0147 |
| Created | 2020-08-19 | 2026-09-28 |
| Created by | M. Chen | J. Park (sales, food fair) |

These are the same legal entity. C-1011 was opened by a sales rep (no credit decision authority) without a credit application. Per COL-7, one business gets one record and shares one limit.

**Correction recorded:** C-1011 closed; INV-24110, INV-24136, and SO-5524 reassigned to C-1007. Combined open balance $14,270 exceeds the shared $10,000 limit.

---

### Problem 8 · C-1002 — Credit review overdue
**Rule:** REV-1
**IDs:** C-1002

Harborview Oyster House last_credit_review: **2024-05-20** — 887 days ago, over two years past the 12-month review requirement. The $30,000 limit (above the analyst's $10,000 authority) cannot be increased until a review is completed. No limit increase may be granted.

**Action:** Flagged to the credit analyst for immediate review.

---

### Problem 9 · C-1005 — Open balance exceeds credit limit
**Rule:** COL-3
**IDs:** C-1005

Telegraph Ave Pizza LLC has open balance **$18,240.60** against a **$15,000** limit — over by $3,240.60. All invoice line totals were verified correct. Credit hold placed.

---

### Problem 10 · C-1007 + C-1011 — Combined balance exceeds shared limit
**Rules:** COL-3, COL-7
**IDs:** C-1007, C-1011

After merging the duplicate records, combined open balance is **$14,270.00** against the **$10,000** shared limit — over by $4,270.00. Credit hold placed on C-1007.

---

### Problem 11 · C-1008 — City misspelled in customer record
**Rule:** COL-6
**IDs:** C-1008

City recorded as "Oakalnd" instead of "Oakland."

**Correction recorded.**

---

### Problem 12 · Missing email addresses — dunning reminders cannot be sent
**Rule:** COL-2
**IDs:** C-1003, C-1005, C-1008, C-1009

Four customers have no email on file. COL-2 requires reminders go to the email on the customer record. C-1008 and C-1009 need reminders dispatched today; C-1005 needs a phone call (email not critical for that step). Obtain emails through sales reps before dispatching electronic notices.

> **Correction note:** The missing-email flag was initially listed as covering C-1004, but C-1004 does have an email on file (hello@greenleafjuice.example). The flag covers C-1003, C-1005, C-1008, and C-1009 only.

---

## Part 2 — Corrected Balances

All figures below reflect corrections recorded above. The as-of date is **2026-10-23**.

| Customer | Limit | Corrected Open Balance | Oldest Past-Due Invoice | Days Past Due | Status |
|---|---|---|---|---|---|
| C-1001 Golden Gate Bagel | $20,000 | $2,655.30 | — | 0 | Current |
| C-1002 Harborview Oyster House | $30,000 | $27,655.75 | INV-24047 | **50** | Past due |
| C-1003 Mission St. Taqueria | $10,000 | $1,398.20 | — | 0 | Current |
| C-1004 Greenleaf Juice | $8,000 | $2,616.80 | INV-24089 | **20** | Past due |
| C-1005 Telegraph Ave Pizza | $15,000 | $18,240.60 | INV-24054 | **43** | **OVER LIMIT / CREDIT HOLD** |
| C-1006 Bluebird Bakery | $12,000 | $2,048.60 | — | 0 | Current |
| C-1007 Sunset Noodle Bar (combined) | $10,000 | $14,270.00 | INV-24102 | **5** | **OVER LIMIT / CREDIT HOLD** |
| C-1008 Fruitvale Food Truck | $5,000 | $1,486.40 | INV-24116 | **6** | Past due |
| C-1009 Rockridge Ramen | $9,000 | $2,236.10 | INV-24095 ($49.20) | **15** | Past due |
| C-1010 Dogpatch Deli | $7,500 | $3,829.35 | INV-24091 | **19** | Past due |
| C-1011 Sunset Noodle Bar | merged into C-1007 | — | — | — | — |
| C-1012 Piedmont Provisions | $25,000 | $8,192.00 | INV-24105 | **1** | Past due |

**C-1007 detail (post-merge):**
| Invoice | Due | Balance | Days past due |
|---|---|---|---|
| INV-24102 | 2026-10-18 | $3,615.20 | 5 |
| INV-24122 | 2026-11-06 | $4,234.80 | not yet due |
| INV-24110 (was C-1011) | 2026-10-29 | $3,180.00 | not yet due |
| INV-24136 (was C-1011) | 2026-11-19 | $3,240.00 | not yet due |

**C-1012 detail (corrected):**
| Invoice | Original total | Corrected total | Due | Days past due |
|---|---|---|---|---|
| INV-24105 | $4,862.40 | $4,286.40 | 2026-10-22 | 1 |
| INV-24111 | $3,905.60 | $3,905.60 | 2026-10-29 (corrected from 2025) | not yet due |

---

## Part 3 — Dunning Actions

One action per active customer, based on corrected balances and oldest past-due invoice.

| Customer | Action | Oldest past-due | Days | Rule |
|---|---|---|---|---|
| C-1001 Golden Gate Bagel | **No action** | — | 0 | COL-1 |
| C-1002 Harborview Oyster House | **Phone call** | INV-24047 | 50 | COL-1 |
| C-1003 Mission St. Taqueria | **No action** | — | 0 | COL-1 |
| C-1004 Greenleaf Juice | **Second notice** | INV-24089 | 20 | COL-1 |
| C-1005 Telegraph Ave Pizza | **Credit hold** | INV-24054 | 43 | COL-3 (over limit) |
| C-1006 Bluebird Bakery | **No action** | — | 0 | COL-1 |
| C-1007 Sunset Noodle Bar | **Credit hold** | INV-24102 | 5 | COL-3 (over shared limit) |
| C-1008 Fruitvale Food Truck | **Friendly reminder** | INV-24116 | 6 | COL-1 ⚠ no email |
| C-1009 Rockridge Ramen | **Second notice** | INV-24095 ($49.20) | 15 | COL-1, COL-4 ⚠ no email |
| C-1010 Dogpatch Deli | **Second notice** | INV-24091 | 19 | COL-1, COL-5 |
| C-1011 Sunset Noodle Bar | merged into C-1007 | — | — | COL-7 |
| C-1012 Piedmont Provisions | **Friendly reminder** | INV-24105 | 1 | COL-1 |

**⚠ Reminders for C-1008 and C-1009 are blocked until email addresses are obtained (COL-2).**

**Credit holds (C-1005 and C-1007) may only be released by the controller, Rosa Delgado.**

---

## Part 4 — Open Orders

| Order | Customer | Amount | Decision | Reason |
|---|---|---|---|---|
| SO-5519 | C-1003 Mission St. Taqueria | $1,420.00 | **Released** | No past-due, balance $2,818.20 after release (within $10k limit) |
| SO-5521 | C-1005 Telegraph Ave Pizza | $2,400.00 | **Held** | Customer on credit hold |
| SO-5524 | C-1011 → C-1007 Sunset Noodle Bar | $1,850.00 | **Held** | C-1007 on credit hold (merged entity) |
| SO-5527 | C-1002 Harborview Oyster House | $3,100.00 | **Held** | 50 days past due (ORD-1); release would push balance to $30,755 exceeding $30k limit |
| SO-5528 | C-1012 Piedmont Provisions | $2,980.00 | **Released** | After corrections: nothing 30+ days past due, balance $11,172 after release (within $25k limit) |
| SO-5530 | C-1001 Golden Gate Bagel | $1,760.00 | **Released** | After PMT-8812 correction: no past-due, balance $4,415.30 (within $20k limit) |

---

## Part 5 — Items for the Controller (Rosa Delgado)

1. **C-1005 credit hold** — Telegraph Ave Pizza is on hold. Balance $18,240.60 vs $15,000 limit. Oldest past-due 43 days. Release only when balance comes within limit.

2. **C-1007 credit hold** — Sunset Noodle Bar LLC (combined with former C-1011 duplicate). Balance $14,270.00 vs $10,000 shared limit. Oldest past-due 5 days. Release only when balance comes within limit.

3. **C-1002 overdue credit review** — Harborview Oyster House's last review was 2024-05-20 (887 days ago). Flagged to the credit analyst. No limit increase may be granted until a new review is completed.

---

## Part 6 — Record Corrections Summary

| Subject | Correction | Rule |
|---|---|---|
| PMT-8812 | Reapplied from C-1004/INV-24089 to C-1001/INV-24098 | COL-6 |
| INV-24089 | Reopened; balance restored to $1,490.00 (C-1004) | COL-6 |
| INV-24095 | Reopened for $49.20 unearned discount (C-1009) | COL-4 |
| INV-24091 | Reopened; post-dated check (C-1010) — cash on 2026-11-06 | COL-5 |
| INV-24105 | Header total corrected from $4,862.40 to $4,286.40 (C-1012) | COL-6 |
| INV-24111 | Invoice date corrected from 2025-09-29 to 2026-09-29 (C-1012) | COL-6 |
| INV-24117 | Voided as duplicate of INV-24116 (C-1008) | COL-6 |
| C-1011 | Closed; merged into C-1007; INV-24110, INV-24136, SO-5524 reassigned | COL-7 |
| C-1008 | City corrected from "Oakalnd" to "Oakland" | COL-6 |