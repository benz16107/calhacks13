# Fogline Supply Co. — Collections Clerk Report
**Case:** fogline-2026-10 | **As of:** 2026-10-23 | **Prepared by:** Collections Clerk

---

## Summary

14 problems were found across customers, invoices, and payments. 7 records were corrected. 3 customers were placed on credit hold. 3 of 6 open orders were released; 3 were held.

---

## Problems Found

### P-1 — Duplicate customer records: C-1007 and C-1011 (REL-1, COL-7)

C-1007 (Sunset Noodle Bar LLC) and C-1011 (Sunset Noodle Bar) are the same business. Evidence: EIN 47-3318290 appears on both records (C-1011 omits the dash), the phone number (415) 555-0147 is identical, and both addresses resolve to 1825 Irving St, SF 94122. C-1011 was opened 2026-09-28 by J. Park at a food fair with no credit check.

Under REL-1, balances are combined and tested against the lower of the two limits ($10,000). Combined open balance is $14,270.00 — $4,270.00 over the shared limit. Both records are on credit hold. The analyst must merge the records (COL-7).

---

### P-2 — C-1002 credit review severely overdue (REV-1, REV-2)

C-1002 (Harborview Oyster House) has a $30,000 limit. REV-2 requires 6-month reviews for limits above $25,000. Last review was 2024-05-20 — **29 months ago**, more than four cycles overdue. No limit increase is permitted until the review completes. Flagged to the credit analyst.

---

### P-3 — INV-24105 total overstated by $576.00 (COL-6)

C-1012 (Piedmont Provisions Catering). Invoice shows $4,862.40; nine line items sum to $4,286.40.

| Line | SKU | Qty | Unit price | Line total |
|---|---|---|---|---|
| 1 | COF-HB5 | 16 bags | $52.50 | $840.00 |
| 2 | CUP-12H | 12 cases | $68.50 | $822.00 |
| 3 | LID-12H | 12 cases | $42.00 | $504.00 |
| 4 | CLM-9 | 16 cases | $54.75 | $876.00 |
| 5 | NAP-KR | 8 cases | $41.40 | $331.20 |
| 6 | GLV-NM | 6 cases | $64.00 | $384.00 |
| 7 | SAN-Q4 | 6 cases | $36.40 | $218.40 |
| 8 | BAG-KR | 5 cases | $46.20 | $231.00 |
| 9 | FRT | 1 | $79.80 | $79.80 |
| **Total** | | | | **$4,286.40** |

**Corrected:** INV-24105 total set to $4,286.40. Corrected invoice issued to C-1012.

---

### P-4 — INV-24111 invoice date appears wrong year (COL-6)

C-1012. The ledger shows invoice date 2025-09-29, due 2025-10-29 — which would make this invoice **359 days past due**. However, the surrounding invoices (INV-24110 dated 2026-09-29, INV-24113 dated 2026-09-30) are all from 2026, and C-1012 has paid every other invoice on time. No collections history exists for INV-24111. The date is almost certainly a data entry error; the correct year is 2026.

**Corrected:** Date changed to 2026-09-29, due date to 2026-10-29. If the 2025 date is somehow correct, this must be escalated immediately as a 359-DPD balance requiring final demand and controller action.

---

### P-5 — INV-24116 and INV-24117 are identical duplicate invoices (COL-6)

C-1008 (Fruitvale Food Truck Collective). Both invoices dated 2026-10-02, PO FFTC-0930, due 2026-10-17, total $1,486.40, with identical line items. The duplicate inflated C-1008's open balance to $2,972.80.

**Corrected:** INV-24117 cancelled. True open balance: $1,486.40.

---

### P-6 — PMT-8812 applied to wrong customer and wrong invoice (COL-10)

Bank deposit confirms: PMT-8812 (2026-10-09, $1,940.00 ACH) came from **Golden Gate Bagel Co (C-1001)** with memo **INV-24098**. INV-24098 is a C-1001 invoice for exactly $1,940.00. However, the ledger booked PMT-8812 under C-1004 (Greenleaf Juice Co) and applied it to INV-24089 ($1,490.00), creating a false −$450.00 balance on INV-24089 and leaving INV-24098 open.

**Corrected:** PMT-8812 reassigned to C-1001, applied to INV-24098 (now paid, balance $0). INV-24089 reopened at $1,490.00 for C-1004 (due 2026-10-03, 20 DPD → second notice issued).

---

### P-7 — PMT-8806: unearned early-payment discount on INV-24095 (COL-4)

C-1009 (Rockridge Ramen). INV-24095 was issued 2026-09-08 on 2/10 Net 30 terms. The 10-day discount window closed 2026-09-18. PMT-8806 was received 2026-10-02 — day 24 — well outside the window. Discount of $49.20 was not earned.

**Corrected:** $49.20 restored to INV-24095 balance. Due date 2026-10-08, now 15 DPD → second notice issued.

---

### P-8 — PMT-8823 is a post-dated check; INV-24091 was marked paid prematurely (COL-5, COL-8)

C-1010 (Dogpatch Deli). PMT-8823 (Check 4471, $2,036.75) has a received date of 2026-10-20 but a check date of **2026-11-06** — 14 days in the future. The bank deposit ledger contains no entry for this payment, confirming funds have not cleared. The ledger marked INV-24091 as paid, which is incorrect.

**Corrected:** INV-24091 reopened at $2,036.75 (due 2026-10-04, 19 DPD). Payment will be applied when the check clears on 2026-11-06.

---

### P-9 — C-1005 open balance exceeds credit limit (COL-3)

C-1005 (Telegraph Ave Pizza LLC) has four open invoices totalling $18,240.60 against a $15,000 limit — $3,240.60 over limit. Credit hold placed.

---

### P-10 — C-1007 + C-1011 combined balance exceeds shared limit (COL-3, REL-1)

As the same business (P-1), combined open balance of $14,270.00 exceeds the $10,000 shared limit by $4,270.00. Credit hold placed on both records.

---

### P-11 — C-1003 has no email address on record (COL-2)

C-1003 (Mission Street Taqueria Inc.) has a blank email field. Reminders must go to the email on the customer record per COL-2. No past-due invoices at this time, but the email must be obtained before any future notice can be sent electronically. Phone (415-555-0139) or mail available in the interim.

---

### P-12 — C-1005 has no email address on record (COL-2)

C-1005 (Telegraph Ave Pizza LLC) has a blank email field. Account is on credit hold; notices must be sent by phone (510-555-0155) or mail.

---

### P-13 — C-1009 has no email address on record (COL-2)

C-1009 (Rockridge Ramen) has a blank email field. A second notice for the $49.20 unearned discount on INV-24095 must be sent by phone (510-555-0178) or mail.

---

### P-14 — C-1008 city field contains a typo (COL-2)

C-1008 (Fruitvale Food Truck Collective) city was recorded as "Oakalnd." **Corrected** to "Oakland."

---

## Corrected Balances — as of 2026-10-23

All figures below reflect the corrections above. "Oldest DPD" counts from the due date to 2026-10-23.

| Customer | Corrected balance | Limit | Oldest past-due invoice | Oldest DPD | Status |
|---|---|---|---|---|---|
| C-1001 Golden Gate Bagel Co. | $2,655.30 | $20,000 | — | 0 | Current |
| C-1002 Harborview Oyster House | $27,655.75 | $30,000 | INV-24047 | 50 | Past due |
| C-1003 Mission St. Taqueria | $1,398.20 | $10,000 | — | 0 | Current |
| C-1004 Greenleaf Juice Co. | $2,616.80 | $8,000 | INV-24089 | 20 | Past due |
| C-1005 Telegraph Ave Pizza | $18,240.60 | $15,000 | INV-24054 | 43 | **Over limit / Credit hold** |
| C-1006 Bluebird Bakery & Cafe | $2,048.60 | $12,000 | — | 0 | Current |
| C-1007 Sunset Noodle Bar LLC | $7,850.00 ¹ | $10,000 ¹ | INV-24102 | 5 | **Over combined limit / Credit hold** |
| C-1008 Fruitvale FTC | $1,486.40 | $5,000 | INV-24116 | 6 | Past due |
| C-1009 Rockridge Ramen | $2,236.10 | $9,000 | INV-24095 | 15 | Past due |
| C-1010 Dogpatch Deli | $3,829.35 | $7,500 | INV-24091 | 19 | Past due |
| C-1011 Sunset Noodle Bar | $6,420.00 ¹ | $10,000 ¹ | — | 0 | **Over combined limit / Credit hold** |
| C-1012 Piedmont Provisions | $8,192.00 | $25,000 | INV-24105 | 1 | Past due |

¹ C-1007 and C-1011 are the same business. Combined balance $14,270.00 tested against the lower limit of $10,000.

### C-1002 open invoice aging detail

| Invoice | Amount | Due date | DPD |
|---|---|---|---|
| INV-24047 | $6,240.00 | 2026-09-03 | 50 |
| INV-24062 | $8,115.50 | 2026-09-17 | 36 |
| INV-24094 | $7,380.00 | 2026-10-07 | 16 |
| INV-24119 | $5,920.25 | 2026-11-04 | 0 (not due) |
| **Total** | **$27,655.75** | | |

### C-1005 open invoice aging detail

| Invoice | Amount | Due date | DPD |
|---|---|---|---|
| INV-24054 | $4,880.40 | 2026-09-10 | 43 |
| INV-24077 | $5,212.90 | 2026-09-28 | 25 |
| INV-24107 | $4,407.30 | 2026-10-24 | 0 (not due) |
| INV-24127 | $3,740.00 | 2026-11-09 | 0 (not due) |
| **Total** | **$18,240.60** | | |

---

## Actions Taken

### Record corrections (7)

| Subject | Correction | Rule |
|---|---|---|
| PMT-8812 | Reassigned to C-1001; applied to INV-24098 ($1,940.00 paid). INV-24089 (C-1004) reopened at $1,490.00. | COL-10 |
| PMT-8823 | Marked post-dated (check date 2026-11-06); INV-24091 (C-1010) reopened at $2,036.75. | COL-5, COL-8 |
| INV-24095 | $49.20 unearned discount restored to balance; INV-24095 balance $49.20 open. | COL-4 |
| INV-24105 | Total corrected from $4,862.40 to $4,286.40; corrected invoice issued to C-1012. | COL-6 |
| INV-24111 | Date corrected from 2025-09-29 to 2026-09-29; due date 2026-10-29 (not yet due). | COL-6 |
| INV-24117 | Cancelled as duplicate of INV-24116 (same PO FFTC-0930, same date, same lines). | COL-6 |
| C-1008 | City corrected from "Oakalnd" to "Oakland." | COL-2 |

### Dunning actions (12 — one per customer)

| Customer | Action | Oldest DPD | Reason |
|---|---|---|---|
| C-1001 | No action | 0 | All invoices current after PMT-8812 correction |
| C-1002 | **Phone call** | 50 | COL-1: 30–59 DPD; new orders held |
| C-1003 | No action | 0 | No past-due invoices |
| C-1004 | **Second notice** | 20 | COL-1: 15–29 DPD; INV-24089 $1,490.00 |
| C-1005 | **Credit hold** | 43 | COL-3: balance $18,240.60 > $15,000 limit |
| C-1006 | No action | 0 | No past-due invoices |
| C-1007 | **Credit hold** | 5 | COL-3 via REL-1: combined balance $14,270 > $10,000 limit |
| C-1008 | **Friendly reminder** | 6 | COL-1: 1–14 DPD; INV-24116 $1,486.40 |
| C-1009 | **Second notice** | 15 | COL-1: 15–29 DPD; INV-24095 $49.20 unearned discount |
| C-1010 | **Second notice** | 19 | COL-1: 15–29 DPD; INV-24091 $2,036.75 (post-dated check not cleared) |
| C-1011 | **Credit hold** | 0 | COL-3 via REL-1: duplicate of C-1007; combined balance over limit |
| C-1012 | **Friendly reminder** | 1 | COL-1: 1–14 DPD; INV-24105 $4,286.40 (after correction) |

> C-1002: reminder email to accounts@harborviewoysters.example  
> C-1004: second notice to hello@greenleafjuice.example  
> C-1008: no email on file — use phone 510-555-0170 or mail  
> C-1009: no email on file — use phone 510-555-0178 or mail  
> C-1010: second notice to dogpatchdeli@example.com  
> C-1012: friendly reminder to billing@piedmontprovisions.example (after INV-24105 correction delivered)

### Order decisions (6)

| Order | Customer | Amount | Decision | Reason |
|---|---|---|---|---|
| SO-5519 | C-1003 | $1,420.00 | **Released** | No past due; exposure $2,818.20 < $10,000 limit |
| SO-5521 | C-1005 | $2,400.00 | **Held** | C-1005 on credit hold; over limit |
| SO-5524 | C-1011 | $1,850.00 | **Held** | C-1011 on credit hold; combined balance over limit |
| SO-5527 | C-1002 | $3,100.00 | **Held** | 50 DPD (COL-1); order would push exposure to $30,755.75 > $30,000 limit |
| SO-5528 | C-1012 | $2,980.00 | **Released** | After corrections: nothing ≥30 DPD; exposure $11,172.00 < $25,000 limit |
| SO-5530 | C-1001 | $1,760.00 | **Released** | After PMT-8812 correction: no past due; exposure $4,415.30 < $20,000 limit |

---

## Items Requiring Controller Action

The following items cannot be resolved by the clerk and are referred to the controller (Rosa Delgado):

1. **Credit hold release — C-1005**: Balance over the $15,000 limit. Clerk placed the hold; only the controller may release (COL-3).
2. **Credit hold release — C-1007 / C-1011**: Combined balance over the $10,000 shared limit. Analyst must also merge the records (COL-7).
3. **Order SO-5521 release** (C-1005): Held due to credit hold. Controller decides.
4. **Order SO-5524 release** (C-1011): Held due to credit hold. Controller decides.
5. **Order SO-5527 release** (C-1002): Held because 50 DPD and order would exceed limit. Controller decides.
6. **C-1002 review**: 29-month overdue 6-month review. Flagged to the credit analyst; limit frozen per REV-1.

---

## Verified Payments

All 14 cleared payments in the bank statement were matched to ledger records. No unmatched bank deposits. PMT-8823 (Dogpatch Deli check $2,036.75) is absent from bank deposits, confirming it has not cleared.

Discount windows verified on all 2/10 Net 30 invoices:
- INV-24083 (C-1006): paid day 9 — discount of $44.28 **earned** ✓
- INV-24074 (C-1009): paid day 29 — no discount taken ✓
- INV-24095 (C-1009): paid day 24 — discount of $49.20 **not earned** → P-7 above
- INV-24121 (C-1006): paid day 8 — discount of $37.50 **earned** ✓

All other invoice line totals verified; all matched except INV-24105 (P-3 above).