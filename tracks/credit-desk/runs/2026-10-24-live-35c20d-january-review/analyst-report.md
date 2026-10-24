# Analyst Report — Fogline Supply Co.

**Case:** fogline-2027-01  
**As of:** 2027-01-22  
**Analyst:** credit analyst (agent)  
**Follows:** fogline-2026-10

---

## C-1013 · Bright Harbor Catering Inc. — Credit Review

### Trigger

Two returned payments within 90 days triggered an early review under REV-3 and invoked the REV-6 penalty band.

| Payment | Method | Amount | Deposited | Returned | Reason |
|---|---|---|---|---|---|
| PMT-8933 | ACH | $7,420.00 | 2026-12-16 | 2026-12-18 | ACH return R01: insufficient funds |
| PMT-8967 | Check 1188 | $11,250.00 | 2027-01-02 | 2027-01-06 | Check returned unpaid: insufficient funds |

The two returns are 19 days apart — both within the 90-day window that activates REV-6.

REV-3 required an early review within 10 business days of each return: approximately by 2027-01-02 for the first and by 2027-01-21 for the second. As of 2027-01-22 the review was one day overdue on the second trigger.

### Prior decision (October 2026)

Approved 2026-10-24 (case fogline-2026-10, APP-1042) by controller Rosa Delgado.

| Field | Value |
|---|---|
| Band | A |
| Limit | $40,000 |
| Terms | Net 30 |
| Scores (TransUnion / Equifax / Experian) | 790 / 790 / 790 |
| Identity | Verified |
| Fraud score | 11 |
| Public records | None |
| Verified revenue | $2,150,000 (min of stated $2,300,000, biz estimate $2,150,000, annualized deposits $2,172,000) |
| Authority | SOD-2 — controller approved |

### Corrected ledger as of 2027-01-22

The ledger (invoices.csv) shows INV-24188 and INV-24215 as "paid." The bank shows both payments were returned. Under COL-8 a returned payment was never received; those invoices must reopen at their original due dates. The figures below reflect the bank.

| Invoice | Due | Days past due | Balance (corrected) | Ledger status |
|---|---|---|---|---|
| INV-24188 | 2026-12-16 | **37** | $7,420.00 | paid ← wrong |
| INV-24215 | 2026-12-31 | **22** | $11,250.00 | paid ← wrong |
| INV-24246 | 2027-01-14 | **8** | $8,960.00 | open |
| INV-24281 | 2027-02-04 | not yet due | $10,140.00 | open |
| **Total open** | | | **$37,770.00** | |

**Open order:** SO-6014, $6,800.00, entered 2027-01-20, "Corporate event, rush," status: awaiting credit release.

### Review outcome

**Outcome: Reduce — approved by Rosa Delgado, 2027-01-22**

| Field | Before | After |
|---|---|---|
| Band | A | **C** |
| Limit | $40,000 | **$7,500** |
| Terms | Net 30 | **Net 15** |

Rules cited: COL-8, REV-3, REV-5, REV-6.

**Reasoning.** Two returned payments within 90 days invoke REV-6, which caps the account at band C, Net 15, limit at most $7,500, until 6 months pass with no returned payment. The corrected open balance ($37,770) also exceeds the new limit ($7,500), placing the account on credit hold under COL-3. The $40,000 limit was controller-approved (Rosa Delgado, 2026-10-24); per REV-6, the analyst proposed and the controller decided. Existing open invoices (INV-24246 and INV-24281) keep their original Net 30 terms; the reduced limit applies to new orders only (REV-5).

The REV-6 restriction (band C, Net 15, limit ≤ $7,500) stays in place until at least 2027-07-06 — six months from the last returned payment on 2027-01-06.

### Problems flagged

**Finding tmarvrbadcb.mcp.credit-desk.flag.b4ccb7c81cc4.1 — Returned payments not corrected in ledger**  
Rules: COL-8  
Ledger shows INV-24188 ($7,420) and INV-24215 ($11,250) as paid. Bank shows PMT-8933 reversed 2026-12-18 and PMT-8967 reversed 2027-01-06, both NSF. Under COL-8, both payments were never received. Collections clerk must reverse PMT-8933 and PMT-8967 and reopen INV-24188 (37 DPD) and INV-24215 (22 DPD) at their original due dates.

**Finding tmarvrbadcb.mcp.credit-desk.flag.772ff6aa7562.1 — Mandatory credit hold not set; check accepted after first return**  
Rules: COL-8, ORD-1  
COL-8 requires credit hold and controller notification when two payments are returned in 12 months. As of 2027-01-22, customers.csv shows on_credit_hold = no. Additionally, after PMT-8933 returned on 2026-12-18, COL-8 required accepting only ACH or wire for 6 months; Fogline accepted Check 1188 (PMT-8967) on 2027-01-02 — 15 days later — when checks were no longer acceptable. (The check also returned NSF.) Collections clerk must place C-1013 on credit hold immediately and notify the controller. SO-6014 must remain held per COL-8 and ORD-1 until replacement funds clear, at which point only the controller may release it.

### Follow-ups

| Action | Owner | Rule | Deadline |
|---|---|---|---|
| Reverse PMT-8933 and PMT-8967 in ledger; reopen INV-24188 and INV-24215 | Collections clerk | COL-8 | Immediate |
| Place C-1013 on credit hold; notify controller | Collections clerk | COL-8, COL-3 | Immediate |
| Accept only ACH or wire from C-1013 | Collections clerk | COL-8 | Through 2027-07-06 |
| Dunning on INV-24188 (37 DPD): phone call and hold new orders | Collections clerk | COL-1 | Immediate |
| Second notice on INV-24215 (22 DPD) | Collections clerk | COL-1 | Immediate |
| Friendly reminder on INV-24246 (8 DPD) | Collections clerk | COL-1 | Immediate |
| Release SO-6014 only after replacement funds clear | Controller | COL-8, ORD-1 | When funds clear |
| Next REV-2 review (band C, 6-month cycle) | Analyst | REV-2 | 2027-04-26 |

---

## C-1001 · Golden Gate Bagel Co. — Review Assessment

No review was taken. Reasoning below.

### Customer status as of 2027-01-22

| Field | Value |
|---|---|
| Created | 2019-04-02 (business age ≈ 7 years 9 months) |
| Limit | $20,000 |
| Terms | Net 30 |
| Last credit review | 2026-02-11 (345 days ago) |
| On credit hold | No |
| Prior decision in box log | None — predates the desk's log |

**Open invoices:**

| Invoice | Due | Days past due | Balance |
|---|---|---|---|
| INV-24301 | 2027-02-11 | not yet due (20 days) | $2,180.00 |

INV-24262 ($2,410, due 2027-01-19) was paid 2027-01-14 — five days early, by ACH. No collection issues.

### Review triggers checked

| Rule | Trigger condition | Result |
|---|---|---|
| REV-1 | Annual review every 12 months | Next due 2027-02-11; not yet overdue. No action now. |
| REV-2 | Band C, new business, or limit above $25,000 | Limit $20,000 < $25,000; not a new business; no band C history. Not applicable. |
| REV-3 | Invoice 60+ DPD; returned payment; credit hold; 3+ disputes in 90 days; owner/EIN/bank change; new public record; limit increase request | None of these are present. |
| REV-6 | Two or more returned payments within 90 days | No returned payments in bank records. |

**Conclusion:** No review is required at this time. The annual review falls due on 2027-02-11, 20 days from as_of. The box holds no prior credit decision for this customer (it predates the desk); the collections clerk should ensure a fresh CHK-1 run is completed for the 2027-02-11 review so the guarantor's consent status is confirmed before credit reports are re-pulled (REV-5).

---

## Summary

| Customer | Action | Outcome | Limit | Terms | Band | Rules |
|---|---|---|---|---|---|---|
| C-1013 Bright Harbor Catering | Review — reduce | Approved (controller) | $40,000 → $7,500 | Net 30 → Net 15 | A → C | COL-8, REV-3, REV-5, REV-6 |
| C-1001 Golden Gate Bagel Co. | Assessment — no review | N/A | $20,000 (unchanged) | Net 30 (unchanged) | — | REV-1 (due 2027-02-11) |

**Flags recorded:** 2 (finding IDs: tmarvrbadcb.mcp.credit-desk.flag.b4ccb7c81cc4.1 and tmarvrbadcb.mcp.credit-desk.flag.772ff6aa7562.1)