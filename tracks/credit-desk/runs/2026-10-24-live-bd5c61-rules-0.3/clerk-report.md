# Collections Clerk Report
**Prepared by:** Collections clerk  
**As-of date:** 2026-10-23  
**Case:** fogline-2026-10 (12 trade accounts)

All ages and dates counted from 2026-10-23. "DPD" = days past due.

---

## 1. Problems Found and Flagged

Sixteen problems were recorded. Each is cited to the rule it breaks.

### 1.1 Invoice errors

| # | IDs | Problem | Rule(s) |
|---|-----|---------|---------|
| 1 | INV-24105 | Header total $4,862.40 does not match line items (sum = $4,286.40). Overbilled by **$576.00**. | COL-6, BK-1 |
| 2 | INV-24116 / INV-24117 | Exact duplicate invoices — same customer C-1008, date 2026-10-02, PO FFTC-0930, amount $1,486.40, identical lines. INV-24117 is the duplicate. | COL-6, COL-7, BK-1 |
| 3 | INV-24111 | Invoice dated **2025-09-29**, due 2025-10-29, in a sequence where every surrounding invoice is dated 2026. ID falls between INV-24110 (2026-09-29) and INV-24113 (2026-09-30). Likely a year-off data-entry error. As recorded: 359 DPD. If correctly 2026-09-29: not yet due. **Date must be confirmed before any demand action.** | COL-1, COL-6, ORD-1 |

### 1.2 Payment errors

| # | IDs | Problem | Rule(s) |
|---|-----|---------|---------|
| 4 | PMT-8781 / INV-24044 / INV-24047 | Remittance "INV-24044 + INV-24047" ($4,410 + $6,240 = $10,650 exactly). System applied full $10,650 to INV-24044 only, leaving INV-24047 showing open at $6,240. Books net correctly; invoice-level tracking only is wrong. | COL-10 |
| 5 | PMT-8806 / INV-24095 | C-1009 (Rockridge Ramen) deducted a 2% discount of $49.20. Invoice date 2026-09-08, payment received 2026-10-02 = **24 days** — outside the 10-day window. Discount not earned; $49.20 still owed. | COL-4, COL-1 |
| 6 | PMT-8812 / INV-24089 / INV-24098 | Payment from Golden Gate Bagel Co. (C-1001), remittance "INV-24098" (C-1001 invoice, $1,940), ACH ref "ACH 1009 GGB". System applied $1,940 to C-1004 / INV-24089 ($1,490). Bank confirms payer is Golden Gate Bagel Co. Cross-customer misapplication. | COL-10, BK-1 |
| 7 | PMT-8823 / INV-24091 | Dogpatch Deli Check 4471, received physically 2026-10-20, **check date 2026-11-06** (post-dated). Ledger booked it as cash on 2026-10-20. Bank confirms no deposit as of 2026-10-23. Per COL-5, not cash until check date; INV-24091 must remain open. | COL-5, ORD-3, BK-1 |

### 1.3 Customer record errors

| # | IDs | Problem | Rule(s) |
|---|-----|---------|---------|
| 8 | C-1007 / C-1011 | Same business: EIN 47-3318290 (= 473318290), same phone (415) 555-0147, same address 1825 Irving St SF 94122. Combined open balance $14,270.00 exceeds lower limit of $10,000 by $4,270. C-1011 was opened by Jae Park (sales) on 2026-09-28 without analyst review. | REL-1, COL-3, COL-7, SOD-6 |
| 9 | C-1005 | Open balance $18,240.60 exceeds $15,000 credit limit by **$3,240.60**. | COL-3 |
| 10 | C-1002 | Credit review overdue. Limit $30,000 requires 6-month review (REV-2). Last review: 2024-05-20. Review was due 2024-11-20. Overdue by **~23 months**. | REV-1, REV-2 |
| 11 | C-1003 | No email address on record. Cannot send COL-2 reminders. | COL-2 |
| 12 | C-1005 | No email address on record. | COL-2 |
| 13 | C-1009 | No email address on record. | COL-2 |
| 14 | C-1008 | City field reads "Oakalnd" (should be "Oakland"). | COL-2 |

### 1.4 AP / bank errors

| # | IDs | Problem | Rule(s) |
|---|-----|---------|---------|
| 15 | B-3307 / B-3311 | Duplicate supplier bill: Bay Cup & Lid Co., invoice BCL-77120 = BCL77120 (same ignoring punctuation), amount $6,845.00, entered twice (Luis Romero 2026-10-01; Mia Ito 2026-10-03). B-3311 must be voided. Overstates Liabilities:Payable:SUP-202 by $6,845.00. | AP-3, BK-1 |
| 16 | B-3309 / B-3304 | Bank shows $3,960.00 (B-3309, Oak Hill Oat Co.) and $1,385.00 (B-3304, Coastal Freight Lines) paid on 2026-10-23, tagged "test payment / run bd5c61". No ledger payment entries exist for either. Dates are within AP-5's 7-day window, but AP-1 requires authorization separate from bill entry. May be Nessie sandbox artifacts — verify with IT. | BK-1, AP-1, AP-5 |

---

## 2. Correcting Entries Posted

Five entries were posted to books/ledger.beancount on 2026-10-23. All are new entries; no past entry was edited (BK-1).

| Entry | Fixes | Description | Debit | Credit |
|-------|-------|-------------|-------|--------|
| 1 | PMT-8806 | Reverse unearned 2% discount on INV-24095 | Assets:Receivable:C-1009 $49.20 | Income:Discounts $49.20 |
| 2 | PMT-8812 | Reverse misapplication from C-1004; close C-1001 INV-24098 | Assets:Receivable:C-1004 $1,940.00 | Assets:Receivable:C-1001 $1,940.00 |
| 3 | PMT-8823 | Reverse post-dated check (check date 2026-11-06); reopen INV-24091 | Assets:Receivable:C-1010 $2,036.75 | Assets:Bank:Operating $2,036.75 |
| 4 | INV-24105 | Correct overbilled invoice header ($4,862.40 → $4,286.40, −$576.00) | Income:Sales $576.00 | Assets:Receivable:C-1012 $576.00 |
| 5 | INV-24117 | Void duplicate invoice | Income:Sales $1,486.40 | Assets:Receivable:C-1008 $1,486.40 |

**Net effect of entries on AR:**

| Customer | Change |
|----------|--------|
| C-1001 | −$1,940.00 (INV-24098 closed) |
| C-1004 | +$1,940.00 (INV-24089 restored) |
| C-1008 | −$1,486.40 (INV-24117 voided) |
| C-1009 | +$49.20 (unearned discount restored) |
| C-1010 | +$2,036.75 (INV-24091 restored) |
| C-1012 | −$576.00 (INV-24105 corrected) |

---

## 3. Corrected Customer Balances (as of 2026-10-23)

Ages counted from due dates as of 2026-10-23.

### C-1001 Golden Gate Bagel Co. — Limit $20,000 | Terms Net 30

| Invoice | Date | Due | Status | Balance | DPD |
|---------|------|-----|--------|---------|-----|
| INV-24098 | 2026-09-12 | 2026-10-12 | **Paid** (PMT-8812 correction) | $0 | — |
| INV-24124 | 2026-10-08 | 2026-11-07 | Open | $2,655.30 | 0 |

**Corrected open balance: $2,655.30** | Oldest DPD: none

---

### C-1002 Harborview Oyster House — Limit $30,000 | Terms Net 30

Note: INV-24044 and INV-24047 were both paid by PMT-8781 (remittance covered both; books net correctly). Only invoice-level tracking needed correction — no beancount entry required.

| Invoice | Date | Due | Status | Balance | DPD |
|---------|------|-----|--------|---------|-----|
| INV-24044 | 2026-08-01 | 2026-08-31 | Paid (PMT-8781) | $0 | — |
| INV-24047 | 2026-08-04 | 2026-09-03 | Paid (PMT-8781) | $0 | — |
| INV-24062 | 2026-08-18 | 2026-09-17 | **Open** | $8,115.50 | **36** |
| INV-24094 | 2026-09-07 | 2026-10-07 | **Open** | $7,380.00 | **16** |
| INV-24119 | 2026-10-05 | 2026-11-04 | Open | $5,920.25 | 0 |

**Corrected open balance: $21,415.75** | Oldest DPD: INV-24062 (36 days)

---

### C-1003 Mission Street Taqueria — Limit $10,000 | Terms Net 30

| Invoice | Date | Due | Status | Balance | DPD |
|---------|------|-----|--------|---------|-----|
| INV-24129 | 2026-10-12 | 2026-11-11 | Open | $1,398.20 | 0 |

**Open balance: $1,398.20** | Oldest DPD: none

---

### C-1004 Greenleaf Juice Co. — Limit $8,000 | Terms Net 30

(INV-24089 restored after PMT-8812 correction.)

| Invoice | Date | Due | Status | Balance | DPD |
|---------|------|-----|--------|---------|-----|
| INV-24089 | 2026-09-03 | 2026-10-03 | **Open** (restored) | $1,490.00 | **20** |
| INV-24113 | 2026-09-30 | 2026-10-30 | Open | $1,126.80 | 0 |

**Corrected open balance: $2,616.80** | Oldest DPD: INV-24089 (20 days)

---

### C-1005 Telegraph Ave Pizza — Limit $15,000 | Terms Net 30

| Invoice | Date | Due | Status | Balance | DPD |
|---------|------|-----|--------|---------|-----|
| INV-24054 | 2026-08-11 | 2026-09-10 | **Open** | $4,880.40 | **43** |
| INV-24077 | 2026-08-29 | 2026-09-28 | **Open** | $5,212.90 | **25** |
| INV-24107 | 2026-09-24 | 2026-10-24 | Open | $4,407.30 | 0 |
| INV-24127 | 2026-10-10 | 2026-11-09 | Open | $3,740.00 | 0 |

**Open balance: $18,240.60 — OVER LIMIT by $3,240.60** | Oldest DPD: INV-24054 (43 days)

---

### C-1006 Bluebird Bakery & Cafe — Limit $12,000 | Terms 2/10 Net 30

| Invoice | Date | Due | Status | Balance | DPD |
|---------|------|-----|--------|---------|-----|
| INV-24134 | 2026-10-19 | 2026-11-18 | Open | $2,048.60 | 0 |

**Open balance: $2,048.60** | Oldest DPD: none  
Note: Both recent discounts (INV-24083, INV-24121) were earned and correctly applied.

---

### C-1007 Sunset Noodle Bar LLC / C-1011 Sunset Noodle Bar — **SAME BUSINESS**
Combined limit: $10,000 (lower of the two) | Terms Net 30

| Invoice | Customer | Date | Due | Balance | DPD |
|---------|----------|------|-----|---------|-----|
| INV-24102 | C-1007 | 2026-09-18 | 2026-10-18 | $3,615.20 | **5** |
| INV-24122 | C-1007 | 2026-10-07 | 2026-11-06 | $4,234.80 | 0 |
| INV-24110 | C-1011 | 2026-09-29 | 2026-10-29 | $3,180.00 | 0 |
| INV-24136 | C-1011 | 2026-10-20 | 2026-11-19 | $3,240.00 | 0 |

**Combined open balance: $14,270.00 — OVER LIMIT by $4,270.00** | Oldest DPD: INV-24102 (5 days)

---

### C-1008 Fruitvale Food Truck Collective — Limit $5,000 | Terms Net 15

(INV-24117 voided; only INV-24116 stands.)

| Invoice | Date | Due | Status | Balance | DPD |
|---------|------|-----|--------|---------|-----|
| INV-24116 | 2026-10-02 | 2026-10-17 | **Open** | $1,486.40 | **6** |
| INV-24117 | — | — | Voided | $0 | — |

**Open balance: $1,486.40** | Oldest DPD: INV-24116 (6 days)

---

### C-1009 Rockridge Ramen — Limit $9,000 | Terms 2/10 Net 30

(INV-24095 has $49.20 restored from unearned discount.)

| Invoice | Date | Due | Status | Balance | DPD |
|---------|------|-----|--------|---------|-----|
| INV-24095 | 2026-09-08 | 2026-10-08 | Open ($49.20 restored) | $49.20 | **15** |
| INV-24131 | 2026-10-14 | 2026-11-13 | Open | $2,186.90 | 0 |

**Corrected open balance: $2,236.10** | Oldest DPD: INV-24095 (15 days, $49.20)

---

### C-1010 Dogpatch Deli — Limit $7,500 | Terms Net 30

(INV-24091 restored after reversing post-dated check PMT-8823.)

| Invoice | Date | Due | Status | Balance | DPD |
|---------|------|-----|--------|---------|-----|
| INV-24091 | 2026-09-04 | 2026-10-04 | **Open** (restored) | $2,036.75 | **19** |
| INV-24132 | 2026-10-16 | 2026-11-15 | Open | $1,792.60 | 0 |

**Corrected open balance: $3,829.35** | Oldest DPD: INV-24091 (19 days)  
Note: Post-dated check (Check 4471, $2,036.75, date 2026-11-06) is in hand. Book only after it clears on or after 2026-11-06.

---

### C-1012 Piedmont Provisions Catering — Limit $25,000 | Terms Net 30

| Invoice | Date | Due | Status | Balance | DPD |
|---------|------|-----|--------|---------|-----|
| INV-24111 | **2025-09-29** ⚠ | **2025-10-29** | Open | $3,905.60 | **359 per records — date anomaly, see flag** |
| INV-24105 | 2026-09-22 | 2026-10-22 | Open (corrected to $4,286.40) | $4,286.40 | 1 |

**Corrected open balance: $8,192.00** | Oldest DPD: INV-24111 (359 per records, date unconfirmed)

---

## 4. Dunning Actions Recorded

| Customer | Action | Oldest DPD | Basis |
|----------|--------|-----------|-------|
| C-1001 Golden Gate Bagel Co. | **No action** | None | COL-1 |
| C-1002 Harborview Oyster House | **Phone call** | 36 days (INV-24062) | COL-1 (30–59 DPD) |
| C-1003 Mission St. Taqueria | **No action** | None | COL-1 |
| C-1004 Greenleaf Juice Co. | **Second notice** | 20 days (INV-24089, $1,490) | COL-1 (15–29 DPD) |
| C-1005 Telegraph Ave Pizza | **Credit hold** | 43 days + over limit | COL-3 + COL-1, GEN-1 |
| C-1006 Bluebird Bakery & Cafe | **No action** | None | COL-1 |
| C-1007 Sunset Noodle Bar LLC | **Credit hold** | 5 days + combined over limit | COL-3, REL-1 |
| C-1008 Fruitvale FTC | **Friendly reminder** | 6 days (INV-24116) | COL-1 (1–14 DPD) |
| C-1009 Rockridge Ramen | **Second notice** | 15 days (INV-24095, $49.20) | COL-1 (15–29 DPD) |
| C-1010 Dogpatch Deli | **Second notice** | 19 days (INV-24091, $2,036.75) | COL-1 (15–29 DPD) |
| C-1011 Sunset Noodle Bar | **Credit hold** | Same business as C-1007, combined over limit | COL-3, REL-1 |
| C-1012 Piedmont Provisions | **Correct record** | INV-24111 date unconfirmed; INV-24105 pending corrected invoice | COL-6 |

**Reminder method notes:** C-1003, C-1005, C-1009 have no email on record (COL-2). Reminders for these accounts must be by phone until an email address is confirmed. C-1008 also has no email confirmed on the record (city typo flagged).

---

## 5. Order Decisions

| Order | Customer | Amount | Decision | Reason |
|-------|----------|--------|----------|--------|
| SO-5519 | C-1003 Mission St. Taqueria | $1,420 | **Release** | Not on hold; no past-due; exposure $2,818.20 < $10,000 limit |
| SO-5521 | C-1005 Telegraph Ave Pizza | $2,400 | **Hold** | Credit hold; over limit; 43 DPD |
| SO-5524 | C-1011 Sunset Noodle Bar | $1,850 | **Hold** | Credit hold; combined balance over $10,000 limit |
| SO-5527 | C-1002 Harborview Oyster House | $3,100 | **Hold** | INV-24062 is 36 DPD (≥30 days; COL-1 + ORD-1) |
| SO-5528 | C-1012 Piedmont Provisions | $2,980 | **Hold** | INV-24111 shows 359 DPD per records; ORD-1 requires hold until date confirmed |
| SO-5530 | C-1001 Golden Gate Bagel Co. | $1,760 | **Release** | Not on hold; no past-due; exposure $4,415.30 < $20,000 limit |

---

## 6. Follow-ups Required by Rule

The following items require action by the controller or analyst and cannot be completed by the clerk.

### For the controller (Rosa Delgado)

1. **C-1005 credit hold release** — Balance over limit ($18,240.60 > $15,000). Controller must review before releasing hold or SO-5521. (COL-3)

2. **C-1007 / C-1011 credit hold release and record merge** — Combined balance $14,270.00 exceeds $10,000 combined limit. Controller must release hold. Analyst must merge records, cap limit at $10,000, and review C-1011 account (opened by sales without credit approval — SOD-6 violation). (COL-3, COL-7, REL-1)

3. **INV-24111 date verification for C-1012** — As recorded the invoice is 359 DPD and would require final demand + agency/write-off decision. If the date should be 2026-09-29, it is not yet due. Controller should confirm date before any demand action; COL-1 (90+ days) and COL-6 (don't chase a known error) are in tension until the date is resolved. SO-5528 is held in the interim.

4. **SO-5527 release decision for C-1002** — 36 DPD; clerk cannot release, ORD-1. Controller decides.

5. **SO-5524 release decision for C-1011 / C-1007 combined** — Contingent on credit hold decision above.

### For the analyst

6. **C-1002 overdue review** — $30,000 limit requires 6-month review; last review 2024-05-20; overdue ~23 months. No limit increase until reviewed (REV-1). Early review also triggered by the 36-DPD invoice (REV-3).

7. **C-1011 credit check** — Account opened by Jae Park (sales) without analyst review. Analyst must run CHK-1 checks and decide whether terms can stand. If C-1011 merges with C-1007, the combined limit ($10,000) stays until next review.

### For AP clerk

8. **B-3311 duplicate bill** — Void B-3311 (Bay Cup & Lid Co., $6,845.00) and post a reversing entry. Only B-3307 (due 2026-10-29) is payable. (AP-3)

9. **B-3309 and B-3304 unbooked bank payments** — Bank shows both paid on 2026-10-23. AP clerk must post payment entries and confirm proper authorization per AP-1. Verify with IT whether these are real or Nessie sandbox test artifacts.

### Reminder method gaps (clerk to resolve before next cycle)

- Obtain email for C-1003, C-1005, and C-1009 via phone. Until confirmed, all COL-1 notices must be by phone (COL-2).
- Correct C-1008 city field ("Oakalnd" → "Oakland") in accounting system.

---

## 7. Summary of Corrected AR Balances

| Customer | Corrected Balance | Over Limit? | On Hold? |
|----------|-------------------|-------------|----------|
| C-1001 Golden Gate Bagel Co. | $2,655.30 | No | No |
| C-1002 Harborview Oyster House | $21,415.75 | No | No (36 DPD holds orders) |
| C-1003 Mission St. Taqueria | $1,398.20 | No | No |
| C-1004 Greenleaf Juice Co. | $2,616.80 | No | No |
| C-1005 Telegraph Ave Pizza | $18,240.60 | **+$3,240.60** | **Yes (COL-3)** |
| C-1006 Bluebird Bakery & Cafe | $2,048.60 | No | No |
| C-1007 + C-1011 Sunset Noodle Bar (combined) | $14,270.00 | **+$4,270.00** | **Yes (COL-3)** |
| C-1008 Fruitvale FTC | $1,486.40 | No | No |
| C-1009 Rockridge Ramen | $2,236.10 | No | No |
| C-1010 Dogpatch Deli | $3,829.35 | No | No |
| C-1012 Piedmont Provisions | $8,192.00 ¹ | No | No (orders held pending INV-24111) |
| **Total** | **$78,388.10** | | |

¹ INV-24111 date unconfirmed; balance may change once date is resolved.

---

*End of report. All flags, entries and actions have been recorded in the credit desk log.*