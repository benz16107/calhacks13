# Fogline Supply Co. — Collections Clerk Report
**Case:** fogline-2026-10  
**As of:** 2026-10-23  
**Prepared by:** Collections clerk (agent)

---

## 1. Problems Found and Flagged

### P-1 · PMT-8812 applied to wrong customer and invoice
**Records:** PMT-8812, INV-24089, INV-24098 | **Rules:** COL-10, COL-6

PMT-8812 ($1,940.00, received 2026-10-09) is posted as a C-1004 payment against INV-24089 ($1,490.00). The bank deposit shows the payer as "Golden Gate Bagel Co" and the memo as "INV-24098" — a C-1001 invoice for exactly $1,940.00. The misapplication overpaid INV-24089 by $450 (creating a -$450 balance) and left INV-24098 appearing unpaid.

**Correction recorded:** Re-apply PMT-8812 to C-1001/INV-24098. Reopen INV-24089 ($1,490.00) as unpaid on C-1004.

---

### P-2 · PMT-8823 is a post-dated check; INV-24091 incorrectly marked paid
**Records:** PMT-8823, INV-24091 | **Rules:** COL-5, COL-8

PMT-8823 (check #4471, C-1010 Dogpatch Deli, $2,036.75) carries payment_date 2026-11-06 — a future date. The bank has no deposit entry for this payment. INV-24091 (due 2026-10-04) was marked "paid" in the ledger but must remain open until the check clears.

**Correction recorded:** Reopen INV-24091 ($2,036.75). Mark PMT-8823 pending until 2026-11-06.

---

### P-3 · INV-24095 — unearned 2% early-payment discount taken
**Records:** INV-24095, PMT-8806 | **Rules:** COL-4

INV-24095 (C-1009 Rockridge Ramen, invoice date 2026-09-08, terms 2/10 Net 30). The 10-day discount window closed 2026-09-18. PMT-8806 was received 2026-10-02 (day 24) and took a $49.20 discount. The discount is not earned; $49.20 is still owed. As of 2026-10-23, this balance is 15 days past due.

**Correction recorded:** Reopen INV-24095 for $49.20.

---

### P-4 · INV-24105 — invoice header total overstates line items by $576.00
**Records:** INV-24105 | **Rules:** COL-6

INV-24105 (C-1012 Piedmont Provisions, dated 2026-09-22) shows a header total of $4,862.40. The nine line items sum to $4,286.40. There is no line supporting the $576.00 difference.

| Line | SKU | Qty | Unit price | Line total |
|---|---|---|---|---|
| 1 | COF-HB5 | 16 | 52.50 | 840.00 |
| 2 | CUP-12H | 12 | 68.50 | 822.00 |
| 3 | LID-12H | 12 | 42.00 | 504.00 |
| 4 | CLM-9 | 16 | 54.75 | 876.00 |
| 5 | NAP-KR | 8 | 41.40 | 331.20 |
| 6 | GLV-NM | 6 | 64.00 | 384.00 |
| 7 | SAN-Q4 | 6 | 36.40 | 218.40 |
| 8 | BAG-KR | 5 | 46.20 | 231.00 |
| 9 | FRT | 1 | 79.80 | 79.80 |
| **Total** | | | | **4,286.40** |

**Correction recorded:** Header corrected to $4,286.40. Do not collect $576.00 overcharge.

---

### P-5 · INV-24111 — invoice dated 2025, out of sequence with all 2026 invoices
**Records:** INV-24111 | **Rules:** COL-6

INV-24111 (C-1012 Piedmont Provisions) carries invoice_date 2025-09-29 and due_date 2025-10-29. Every adjacent invoice in the numbering sequence is dated 2026. If taken at face value this is 359 days past due, inconsistent with this account's payment history. Likely a data-entry year error.

**Correction recorded:** Date corrected to 2026-09-29 / due 2026-10-29 pending confirmation from C-1012. Do not chase until confirmed.

---

### P-6 · INV-24116 and INV-24117 — duplicate invoices for same PO
**Records:** INV-24116, INV-24117 | **Rules:** COL-6

Both invoices share every field: date 2026-10-02, PO FFTC-0930, Net 15 / due 2026-10-17, total $1,486.40, and all six identical line items. C-1008 (Fruitvale Food Truck Collective) was being billed $2,972.80 for one order.

**Correction recorded:** INV-24117 voided. Only INV-24116 ($1,486.40) survives.

---

### P-7 · C-1007 and C-1011 are the same legal entity (REL-1 match)
**Records:** C-1007, C-1011 | **Rules:** REL-1, COL-7, COL-3

C-1011 (Sunset Noodle Bar, created 2026-09-28) matches C-1007 (Sunset Noodle Bar LLC) on:
- **EIN:** 47-3318290 = 473318290 (same digits)
- **Name:** ignoring "LLC" the names are identical
- **Address:** 1825 Irving St / 1825 Irving Street Ste A, SF 94122
- **Phone:** (415) 555-0147 = 415-555-0147

Under REL-1, combined open balance until merged: **$14,270.00** (C-1007 $7,850.00 + C-1011 $6,420.00). Lower limit: **$10,000**. Over limit by $4,270.00 → COL-3 credit hold placed on both records.

---

### P-8 · C-1011 opened by Sales without credit approval
**Records:** C-1011 | **Rules:** SOD-6, TRM-1, SOD-1

Customer notes read: "New account opened by sales at the Outer Sunset food fair." SOD-6 bars Sales from changing customer records, limits, or terms. The $10,000 limit and Net 30 terms were never reviewed by the credit analyst. No credit application is on file.

**Action:** Controller should be informed of the SOD-6 breach. C-1011 referred to analyst for full credit review.

---

### P-9 · C-1005 open balance exceeds credit limit
**Records:** C-1005 | **Rules:** COL-3

C-1005 (Telegraph Ave Pizza LLC, limit $15,000) has four open invoices totalling **$18,240.60** — $3,240.60 over limit. Credit hold placed.

---

### P-10 · C-1002 credit review overdue by 23 months
**Records:** C-1002 | **Rules:** REV-1, REV-2

C-1002 (Harborview Oyster House, limit $30,000) last reviewed 2024-05-20. Limits above $25,000 require a 6-month review. The review is 23 months overdue. No limit increase is permitted until the review is complete.

---

### P-11 · C-1003 — no email address on record
**Records:** C-1003 | **Rules:** COL-2

Mission Street Taqueria Inc. has no email address. COL-2 requires reminders to go to the email on the customer record. No dunning notice can be sent until an email is added.

---

### P-12 · C-1005 — no email address on record
**Records:** C-1005 | **Rules:** COL-2

Telegraph Ave Pizza LLC has no email address. Reminders cannot be sent even once the credit hold is lifted.

---

### P-13 · C-1009 — no email address on record
**Records:** C-1009 | **Rules:** COL-2

Rockridge Ramen has no email address. The second notice for the $49.20 unearned discount cannot be sent by email until one is added.

---

### P-14 · C-1005 — early credit review required (REV-3 trigger)
**Records:** C-1005 | **Rules:** REV-3

Credit hold placed 2026-10-23. REV-3 requires an early review within 10 business days. **Due: 2026-11-06.** Assign to credit analyst.

---

### P-15 · C-1007 / C-1011 — early credit review required (REV-3 trigger)
**Records:** C-1007, C-1011 | **Rules:** REV-3

Credit hold placed 2026-10-23. REV-3 requires an early review within 10 business days. **Due: 2026-11-06.** Assign to credit analyst for the merged Sunset Noodle Bar entity.

---

### P-16 · C-1008 — city name misspelled
**Records:** C-1008 | **Rules:** COL-6

City field reads "Oakalnd." Corrected to "Oakland."

---

## 2. Corrected Balances and Aging (as of 2026-10-23)

All amounts reflect corrections applied in this review (PMT-8812 re-applied, INV-24091 reopened, INV-24095 reopened for $49.20, INV-24105 header corrected, INV-24111 date corrected, INV-24117 voided).

<table>
<thead>
<tr><th>Customer</th><th>Limit</th><th>Corrected balance</th><th>Current (not due)</th><th>1–14 DPD</th><th>15–29 DPD</th><th>30–59 DPD</th><th>Oldest DPD</th><th>Over limit?</th></tr>
</thead>
<tbody>
<tr><td>C-1001 Golden Gate Bagel Co.</td><td>20,000</td><td>2,655.30</td><td>2,655.30</td><td>—</td><td>—</td><td>—</td><td>0</td><td>No</td></tr>
<tr><td>C-1002 Harborview Oyster House</td><td>30,000</td><td>27,655.75</td><td>5,920.25</td><td>—</td><td>7,380.00</td><td>14,355.50</td><td>50 (INV-24047)</td><td>No</td></tr>
<tr><td>C-1003 Mission St. Taqueria</td><td>10,000</td><td>1,398.20</td><td>1,398.20</td><td>—</td><td>—</td><td>—</td><td>0</td><td>No</td></tr>
<tr><td>C-1004 Greenleaf Juice Co.</td><td>8,000</td><td>2,616.80</td><td>1,126.80</td><td>—</td><td>1,490.00</td><td>—</td><td>20 (INV-24089)</td><td>No</td></tr>
<tr><td>C-1005 Telegraph Ave Pizza</td><td>15,000</td><td>18,240.60</td><td>8,147.30</td><td>—</td><td>5,212.90</td><td>4,880.40</td><td>43 (INV-24054)</td><td>YES +3,240.60</td></tr>
<tr><td>C-1006 Bluebird Bakery &amp; Cafe</td><td>12,000</td><td>2,048.60</td><td>2,048.60</td><td>—</td><td>—</td><td>—</td><td>0</td><td>No</td></tr>
<tr><td>C-1007 Sunset Noodle Bar LLC</td><td>10,000</td><td>7,850.00</td><td>4,234.80</td><td>3,615.20</td><td>—</td><td>—</td><td>5 (INV-24102)</td><td>Combined over*</td></tr>
<tr><td>C-1008 Fruitvale Food Truck</td><td>5,000</td><td>1,486.40</td><td>—</td><td>1,486.40</td><td>—</td><td>—</td><td>6 (INV-24116)</td><td>No</td></tr>
<tr><td>C-1009 Rockridge Ramen</td><td>9,000</td><td>2,236.10</td><td>2,186.90</td><td>—</td><td>49.20</td><td>—</td><td>15 (INV-24095 $49.20)</td><td>No</td></tr>
<tr><td>C-1010 Dogpatch Deli</td><td>7,500</td><td>3,829.35</td><td>1,792.60</td><td>—</td><td>2,036.75</td><td>—</td><td>19 (INV-24091)</td><td>No</td></tr>
<tr><td>C-1011 Sunset Noodle Bar</td><td>10,000</td><td>6,420.00</td><td>6,420.00</td><td>—</td><td>—</td><td>—</td><td>0 (but on hold)</td><td>Combined over*</td></tr>
<tr><td>C-1012 Piedmont Provisions</td><td>25,000</td><td>8,192.00</td><td>3,905.60</td><td>4,286.40</td><td>—</td><td>—</td><td>1 (INV-24105 corr.)</td><td>No</td></tr>
</tbody>
</table>

\* C-1007 and C-1011 are the same business. Combined balance $14,270.00 exceeds the $10,000 lower limit (REL-1).

**INV-24107** (C-1005, $4,407.30) is due 2026-10-24 — one day away but not yet past due; included in "Current" above.

---

## 3. Actions Recorded

### Correct-record actions (7)

| Subject | What was corrected | Rules |
|---|---|---|
| PMT-8812 | Re-applied to C-1001/INV-24098; INV-24089 reopened at $1,490 on C-1004 | COL-10, COL-6 |
| INV-24091 | Reopened ($2,036.75); post-dated check (PMT-8823) marked pending until 2026-11-06 | COL-5, COL-8 |
| INV-24095 | Reopened for $49.20 unearned discount (PMT-8806 outside 10-day window) | COL-4 |
| INV-24105 | Header total corrected from $4,862.40 to $4,286.40 | COL-6 |
| INV-24111 | Date corrected 2025-09-29 → 2026-09-29 (due 2026-10-29); pending confirmation | COL-6 |
| INV-24117 | Voided (duplicate of INV-24116, same PO FFTC-0930, same lines) | COL-6 |
| C-1008 | City "Oakalnd" → "Oakland" | COL-6 |

### Credit holds placed (3)

| Customer | Reason | Balance | Limit | Rules |
|---|---|---|---|---|
| C-1005 Telegraph Ave Pizza | Balance over limit | 18,240.60 | 15,000 | COL-3 |
| C-1007 Sunset Noodle Bar LLC | Combined balance over lower limit (REL-1) | 14,270.00 combined | 10,000 | COL-3, REL-1 |
| C-1011 Sunset Noodle Bar | Combined balance over lower limit; SOD-6 breach | 14,270.00 combined | 10,000 | COL-3, REL-1, SOD-6 |

All three holds can only be released by the controller.

### Dunning actions (12 customers)

| Customer | Action | Oldest DPD | Past-due amount | Notes |
|---|---|---|---|---|
| C-1001 Golden Gate Bagel Co. | No action | 0 | — | Current after PMT-8812 correction |
| C-1002 Harborview Oyster House | **Phone call** | 50 (INV-24047) | 21,735.50 | COL-1; new orders held |
| C-1003 Mission St. Taqueria | No action | 0 | — | Current; add email before next cycle |
| C-1004 Greenleaf Juice Co. | **Second notice** | 20 (INV-24089) | 1,490.00 | After PMT-8812 correction; send to hello@greenleafjuice.example |
| C-1005 Telegraph Ave Pizza | **Credit hold** | 43 (INV-24054) | 10,093.30 | COL-3 over limit; no email on file |
| C-1006 Bluebird Bakery & Cafe | No action | 0 | — | Current; discounts properly earned |
| C-1007 Sunset Noodle Bar LLC | **Credit hold** | 5 (INV-24102) | 3,615.20 | COL-3 combined over limit (REL-1) |
| C-1008 Fruitvale Food Truck | **Friendly reminder** | 6 (INV-24116) | 1,486.40 | After voiding duplicate INV-24117 |
| C-1009 Rockridge Ramen | **Second notice** | 15 ($49.20 on INV-24095) | 49.20 | Unearned discount; no email on file — use phone |
| C-1010 Dogpatch Deli | **Second notice** | 19 (INV-24091) | 2,036.75 | Post-dated check; send to dogpatchdeli@example.com |
| C-1011 Sunset Noodle Bar | **Credit hold** | 0 (but over limit combined) | — | COL-3; SOD-6 breach; analyst review required |
| C-1012 Piedmont Provisions | **Friendly reminder** | 1 (INV-24105 corrected) | 4,286.40 | After correcting INV-24105 and INV-24111; send to billing@piedmontprovisions.example |

### Orders (6 orders)

| Order | Customer | Amount | Decision | Reason |
|---|---|---|---|---|
| SO-5519 | C-1003 Mission St. Taqueria | 1,420.00 | **Released** | Current, well within limit ($2,818 exposure vs $10,000) |
| SO-5521 | C-1005 Telegraph Ave Pizza | 2,400.00 | **Held** | Customer on credit hold (COL-3) |
| SO-5524 | C-1011 Sunset Noodle Bar | 1,850.00 | **Held** | Customer on credit hold (COL-3, REL-1) |
| SO-5527 | C-1002 Harborview Oyster House | 3,100.00 | **Held** | Oldest invoice 50 DPD (COL-1); order would also push balance to $30,756 over $30,000 limit (ORD-1) |
| SO-5528 | C-1012 Piedmont Provisions | 2,980.00 | **Held** | INV-24111 as recorded is 359 DPD (COL-6/ORD-1); hold pending date correction. Once corrected, balance + order ($11,172) is within $25,000 limit and nothing ≥30 DPD — release at that time |
| SO-5530 | C-1001 Golden Gate Bagel Co. | 1,760.00 | **Released** | Current after PMT-8812 correction; $4,415 exposure vs $20,000 limit |

---

## 4. Follow-up Required

| Priority | Action needed | Owner | Deadline |
|---|---|---|---|
| Immediate | Early credit review — C-1005 (credit hold placed) | Credit analyst | 2026-11-06 |
| Immediate | Early credit review — C-1007/C-1011 merged entity (credit hold placed) | Credit analyst | 2026-11-06 |
| Immediate | Controller to release credit holds on C-1005, C-1007, C-1011 (only if reviews pass) | Controller | — |
| Immediate | Analyst to merge C-1007 and C-1011; run full credit review on merged entity | Credit analyst | ASAP |
| Immediate | Controller informed of SOD-6 breach by Sales (J. Park, C-1011 opened without approval) | Controller | ASAP |
| Urgent | C-1002 credit review (overdue by 23 months; 6-month cycle required for $30,000 limit) | Credit analyst | ASAP |
| This week | Confirm INV-24111 intended date with C-1012; correct record; release SO-5528 | Collections clerk | ASAP |
| This week | Obtain email address for C-1003, C-1005, C-1009 | Collections clerk | Before next dunning cycle |
| On check date | Monitor PMT-8823 (check #4471, C-1010) — if it clears 2026-11-06, close INV-24091; if it bounces, apply COL-8 (reopen invoices at original due dates, accept only ACH/wire for 6 months, notify controller) | Collections clerk | 2026-11-06 |
| Watch | C-1002 INV-24047 will reach 60 DPD on 2026-11-02 — triggers credit hold (COL-1), controller notification, and REV-3 early review | Collections clerk | 2026-11-02 |

---

## 5. Ledger Errors Summary (quick reference)

| # | Error | Invoices / payments affected | Net effect on A/R |
|---|---|---|---|
| 1 | PMT-8812 misapplied to C-1004 | PMT-8812, INV-24089, INV-24098 | Move $1,940 from C-1004 to C-1001; C-1004 owes $1,490 more; C-1001 owes $1,940 less |
| 2 | Post-dated check booked as paid | PMT-8823, INV-24091 | C-1010 A/R increases $2,036.75 |
| 3 | Unearned discount accepted | INV-24095, PMT-8806 | C-1009 A/R increases $49.20 |
| 4 | Invoice header overstated | INV-24105 | C-1012 A/R decreases $576.00 |
| 5 | Invoice date wrong year | INV-24111 | Aging distorted; correct to 2026 |
| 6 | Duplicate invoice | INV-24116, INV-24117 | C-1008 A/R decreases $1,486.40 (void INV-24117) |
| 7 | Duplicate customer record | C-1007, C-1011 | Combine exposures; lower limit applies |

**Net A/R adjustment from errors 1–4 and 6:** +$3,099.55 (the corrected A/R balance is higher by this amount because cash was either wrongly credited, uncleared, or not owed).

---

*Report covers all 12 trade accounts in case fogline-2026-10. Every invoice line total was verified against the invoice header; all payments were cross-checked against bank deposits and remittance memos. Discount windows were calculated from invoice dates. Review dates were checked against REV-1 and REV-2 requirements. Orders were evaluated under ORD-1 and ORD-2 using corrected balances.*