# Fogline Supply Co. — Collections Clerk Report
**Case:** fogline-2027-01  
**As of:** 2027-01-22  
**Prepared by:** Collections clerk  
**Follows:** fogline-2026-10

---

## Summary

Two ACH/check payments from Bright Harbor Catering Inc. (C-1013) were returned NSF by the bank. The accounting system and books incorrectly show the underlying invoices as paid. Correcting entries have been posted, the invoices reopened, a credit hold placed, and the pending order held. The controller must be told and must decide on the limit cut required by REV-6. An early credit review is also overdue.

Golden Gate Bagel Co. (C-1001) has no past-due balance in the current case. Two prior-case bank bill items require investigation with the October case records.

---

## Problems Found

### Problem 1 — Returned ACH: INV-24188 incorrectly marked paid
**IDs:** INV-24188, PMT-8933  
**Rules:** COL-8, BK-1

PMT-8933 ($7,420.00, ACH, received 2026-12-16) was returned by the bank on **2026-12-18** with code R01 (insufficient funds). The bank operating account shows: *"RETURNED ITEM PMT-8933 | ACH return R01: insufficient funds | exact 7420.00."* The accounting system records INV-24188 as "paid" with a $0 balance. The books recorded the receipt but never the return. Per COL-8 a returned payment was never received; INV-24188 reopens at its original due date of 2026-12-16.

**As of 2027-01-22:** INV-24188 is **37 days past due.**

### Problem 2 — Returned check: INV-24215 incorrectly marked paid
**IDs:** INV-24215, PMT-8967  
**Rules:** COL-8, BK-1

PMT-8967 (Check 1188, $11,250.00, received 2027-01-02) was returned by the bank on **2027-01-06** (insufficient funds). The bank operating account shows: *"RETURNED ITEM PMT-8967 | Check 1188 returned unpaid: insufficient funds | exact 11250.00."* The accounting system records INV-24215 as "paid" with a $0 balance. Per COL-8 the invoice reopens at its original due date of 2026-12-31.

**As of 2027-01-22:** INV-24215 is **22 days past due.**

### Problem 3 — Check accepted after COL-8 ACH/wire-only restriction
**IDs:** C-1013, PMT-8967  
**Rules:** COL-8

After PMT-8933 was returned on 2026-12-18, COL-8 requires that only ACH or wire be accepted from C-1013 for 6 months (i.e., through at least 2027-06-18). PMT-8967 was received on 2027-01-02 as a **paper check** — in violation of this restriction. The check subsequently bounced. The second return (2027-01-06) extends the ACH/wire-only requirement to **2027-07-06**.

### Problem 4 — Two returned payments within 90 days — REV-6 limit cut proposal required
**IDs:** C-1013  
**Rules:** REV-6, COL-8, SOD-2

PMT-8933 returned 2026-12-18 and PMT-8967 returned 2027-01-06: **19 days apart**, well within the 90-day window. REV-6 requires band C at most (Net 15, limit ≤ $7,500) until 6 months pass with no returned payment. C-1013's current limit of $40,000 was set by the controller in the October case and may only be changed by the controller (SOD-2). The analyst must propose the cut; the controller decides. Until the controller acts, the limit remains $40,000.

### Problem 5 — Early credit review overdue
**IDs:** C-1013  
**Rules:** REV-3, REV-5, REV-6

REV-3 requires an early review to start within 10 business days of a returned payment. The first return was 2026-12-18; the 10-business-day deadline fell on approximately **2027-01-03** (accounting for Christmas and New Year holidays). As of 2027-01-22 the review is at least **13 business days overdue**. The second return on 2027-01-06 would independently have required another 10-business-day window, also now elapsed. The early review must be started immediately. Given REV-6 applies, the controller will need to decide on the limit cut as part of the review outcome.

### Problem 6 — INV-24098 (C-1001): contradictory bank status
**IDs:** C-1001, INV-24098  
**Rules:** COL-6, COL-10

The bank bills for C-1001 show INV-24098 ("pending," $1,940.00, due 2026-10-12). However, the bank's operating account records a deposit of PMT-8812 on 2026-10-09: *"from Golden Gate Bagel Co | memo INV-24098 | exact 1940.00"* — matching amount and memo exactly. PMT-8812 is not in this case's payments.csv; it originates from the October case (fogline-2026-10). The bank bill status is contradictory. This is left for the analyst to resolve using October case records.

### Problem 7 — INV-24124 (C-1001): pending in bank bills, no deposit found
**IDs:** C-1001, INV-24124  
**Rules:** COL-6, COL-1

The bank bills for C-1001 show INV-24124 ("pending," $2,655.30, due 2026-11-07). No deposit matching this amount or invoice reference appears in the bank operating account. INV-24124 is not in this case's invoices.csv and is from the October case. If genuinely unpaid, it is 75 days past due as of 2027-01-22. This is left for the analyst to resolve using October case records. Do not chase until disposition is confirmed.

---

## Books Corrections Posted

### Entry 1 — Reverse PMT-8933 return (fixes PMT-8933)
**Posted date:** 2026-12-18 | **Rules:** COL-8, BK-1

```
2026-12-18 * "Bright Harbor Catering Inc." "Return of PMT-8933 — ACH R01 NSF — INV-24188 reopened"
  Assets:Receivable:C-1013   7,420.00 USD
  Assets:Bank:Operating     -7,420.00 USD
```

Restores INV-24188 receivable and reduces bank balance to match bank reality.

### Entry 2 — Reverse PMT-8967 return (fixes PMT-8967)
**Posted date:** 2027-01-06 | **Rules:** COL-8, BK-1

```
2027-01-06 * "Bright Harbor Catering Inc." "Return of PMT-8967 — Check 1188 NSF — INV-24215 reopened"
  Assets:Receivable:C-1013  11,250.00 USD
  Assets:Bank:Operating    -11,250.00 USD
```

Restores INV-24215 receivable and reduces bank balance to match bank reality.

---

## Corrected Customer Balances

### C-1013 — Bright Harbor Catering Inc.
**Terms:** Net 30 | **Limit:** $40,000 | **Last review:** 2026-10-26

| Invoice | Invoice date | Due date | Days past due | Balance |
|---|---|---|---|---|
| INV-24188 | 2026-11-16 | 2026-12-16 | **37** (reopened, PMT-8933 returned) | $7,420.00 |
| INV-24215 | 2026-12-01 | 2026-12-31 | **22** (reopened, PMT-8967 returned) | $11,250.00 |
| INV-24246 | 2026-12-15 | 2027-01-14 | **8** | $8,960.00 |
| INV-24281 | 2027-01-05 | 2027-02-04 | not due | $10,140.00 |
| **Total open** | | | **Oldest: 37 days** | **$37,770.00** |

**Oldest past-due invoice:** INV-24188, 37 days past due.  
**COL-1 step by oldest:** 30–59 days = phone call and hold orders — superseded by COL-8 credit hold.  
**COL-3 status:** Balance $37,770 is under limit $40,000, so COL-3 (balance exceeds limit) does not independently trigger. With SO-6014 included the exposure is $44,570, which exceeds the limit (ORD-1/ORD-2).  
**Action taken:** Credit hold placed; SO-6014 held; see below.

### C-1001 — Golden Gate Bagel Co.
**Terms:** Net 30 | **Limit:** $20,000 | **Last review:** 2026-02-11

| Invoice | Invoice date | Due date | Days past due | Balance |
|---|---|---|---|---|
| INV-24262 | 2026-12-20 | 2027-01-19 | 0 — paid 2027-01-14 | $0.00 |
| INV-24301 | 2027-01-12 | 2027-02-11 | not due | $2,180.00 |
| **Total open** | | | **None past due** | **$2,180.00** |

**Note on prior-case bank bills:** The bank shows INV-24098 and INV-24124 as pending (Problems 6–7 above). Both require investigation with October case records before any action.

---

## Actions Taken

### C-1013 — Credit hold (COL-8 + COL-1)
Two returned payments in 12 months (PMT-8933 returned 2026-12-18 and PMT-8967 returned 2027-01-06). COL-8 mandates credit hold and controller notification. Oldest past-due invoice (INV-24188) is 37 days past due; COL-1 alone would require a phone call, but COL-8 supersedes. Credit hold placed 2027-01-22. Only the controller (Rosa Delgado) may release this hold.

### SO-6014 — Order held (ORD-1, ORD-2, COL-8)
SO-6014 (C-1013, $6,800, requested ship 2027-01-23, Sam Chen) held because:
- C-1013 is on credit hold.
- INV-24188 is 37 days past due (ORD-1 requires nothing ≥ 30 days past due).
- Exposure with the order: $37,770 + $6,800 = **$44,570**, exceeding the $40,000 limit (ORD-2).
- COL-8: new orders wait for the controller until replacement funds clear.

The order note ("corporate event, rush") does not override credit rules. Only the controller can release SO-6014 per ORD-1.

### INV-24188 — Record corrected (COL-8, COL-6, BK-1)
Invoice status changed from "paid" to "open," balance restored to $7,420.00. Journal entry posted.

### INV-24215 — Record corrected (COL-8, COL-6, BK-1)
Invoice status changed from "paid" to "open," balance restored to $11,250.00. Journal entry posted.

### C-1001 — No action (COL-1)
No past-due balance in current-case records. Prior-case bank bill items (Problems 6–7) are flagged but not chased pending investigation.

---

## Follow-up Required

| Who | What | Rule | Deadline |
|---|---|---|---|
| Controller (Rosa Delgado) | Notified of C-1013 credit hold (two returned payments) | COL-8 | Immediate |
| Controller (Rosa Delgado) | Decide on REV-6 limit cut proposal: reduce C-1013 to Net 15, limit ≤ $7,500 (two returns within 90 days) | REV-6, SOD-2 | Prompt |
| Controller (Rosa Delgado) | Decide whether to release SO-6014 once replacement funds clear | ORD-1, COL-8 | When replacement funds received |
| Credit analyst | Start early credit review for C-1013 immediately — REV-3 deadline already elapsed (~2027-01-03) | REV-3, REV-5 | Immediate (overdue) |
| Credit analyst | Investigate INV-24098 and INV-24124 status using October case (fogline-2026-10) records | COL-6 | Prompt |
| Collections desk | Accept only ACH or wire from C-1013 through 2027-07-06 | COL-8 | Through 2027-07-06 |
| Collections desk | Notify C-1013 of credit hold and ACH/wire-only requirement at the email on record | COL-2, COL-8 | Immediate |
| Collections desk | C-1001 annual limit review due 2027-02-11 (12 months from 2026-02-11) | REV-1 | 2027-02-11 |

---

*End of clerk report — fogline-2027-01, 2027-01-22.*