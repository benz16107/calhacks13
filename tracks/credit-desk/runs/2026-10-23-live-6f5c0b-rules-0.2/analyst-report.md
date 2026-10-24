# Fogline Supply Co. — Credit Analyst Report
**Case:** fogline-2026-10 | **As of:** 2026-10-23 | **Analyst:** credit-desk agent

---

## Summary of decisions

| App | Business | Outcome | Band | Limit | Terms | Authority |
|---|---|---|---|---|---|---|
| APP-1041 | Kettle & Crumb LLC | Approve | A | $8,000 | Net 30 | Analyst |
| APP-1042 | Bright Harbor Catering Inc. | Approve | A | $40,000 | Net 30 | Controller |
| APP-1043 | Pacific Crest Provisions LLC | **Fraud hold** | — | $0 | None | Controller |
| APP-1044 | Saffron Table Catering LLC | Approve | C | $7,500 | Net 15 | Controller |
| APP-1045 | Panaderia Castellanos LLC | Approve | B | $15,000 | Net 30 | Controller |
| APP-1046 | Lakeshore Diner Inc. | Approve | A | $21,000 | Net 30 | Controller |

---

## APP-1041 — Kettle & Crumb LLC

**Guarantor:** Grace Nakamura | **Received:** 2026-10-19 | **Requested:** $8,000, Net 30

### Checks
| Check | Result |
|---|---|
| TransUnion identity | Verified (RequestID 63db73c0) |
| Fraud Finder | Score 9 — clear (RequestID 1c15c44c) |
| TU score | 770 (RequestID a7dd56d8) |
| EQ score | 770 (RequestID 1b6a6d49) |
| EX score | 770 (RequestID 707e1e7a) |
| Public records | None (RequestID 13632a24) |
| Phone owner | GRACE NAKAMURA (RequestID de50ab59) |
| State registration | Active, CA, filed 2017-03-14 |

### Figures
| Item | Value |
|---|---|
| Stated revenue | $620,000 |
| Business-credit estimate | $590,000 |
| Bank deposits Apr–Sep 2026 | $47,900 / $50,300 / $51,200 / $48,800 / $49,100 / $50,300 |
| LIM-4 spike check (Sep vs 2× avg of prior 5) | $50,300 vs $98,920 — no spike |
| 12× average monthly deposits | $595,200 |
| **Verified revenue (lowest of three)** | **$590,000** |
| Stated revenue % above verified | 5.1% — within 25% threshold, no disclosure required |
| 10% revenue cap | $59,000 |
| Band A maximum | $50,000 |
| Requested limit | $8,000 |
| **Approved limit** | **$8,000** (binding: requested amount) |

### Decision
**Approve — $8,000, Net 30, Band A** (analyst authority, SOD-1)

Business registered 2017-03-14 (9.6 years, not a new business). Lowest score 770 → Band A (BND-A, BND-1). No derogatory items, no public records. Limit = min(requested $8,000, band max $50,000, revenue cap $59,000) = $8,000. Within analyst authority.

**Rules cited:** CHK-1, BND-1, BND-A, LIM-1, LIM-2, LIM-4, TRM-1, SOD-1

### Problems flagged
None.

---

## APP-1042 — Bright Harbor Catering Inc.

**Guarantor:** Margaret Okafor | **Received:** 2026-10-20 (via M. Chen) | **Requested:** $40,000, Net 30

### Checks
| Check | Result |
|---|---|
| TransUnion identity | Verified (RequestID a50d0204) |
| Fraud Finder | Score 11 — clear (RequestID 9e3c3072) |
| TU score | 790 (RequestID 1b2a4328) |
| EQ score | 790 (RequestID c035a272) |
| EX score | 790 (RequestID 18f4ed62) |
| Public records | None (RequestID 0db3a9d8) |
| Phone owner | MARGARET OKAFOR (RequestID 9c3b7797) |
| State registration | Active, CA, filed 2012-06-01 |

### Figures
| Item | Value |
|---|---|
| Stated revenue | $2,300,000 |
| Business-credit estimate | $2,150,000 |
| Bank deposits Apr–Sep 2026 | $172,400 / $184,900 / $176,300 / $188,200 / $179,600 / $184,600 |
| LIM-4 spike check (Sep vs 2× avg of prior 5) | $184,600 vs $360,560 — no spike |
| 12× average monthly deposits | $2,172,000 |
| **Verified revenue (lowest of three)** | **$2,150,000** |
| Stated revenue % above verified | 7.0% — within 25% threshold, no disclosure required |
| 10% revenue cap | $215,000 |
| Band A maximum | $50,000 |
| Requested limit | $40,000 |
| **Approved limit** | **$40,000** (binding: band maximum) |

### Decision
**Approve — $40,000, Net 30, Band A** (controller approved, SOD-2)

Business registered 2012-06-01 (14.4 years, not new). Lowest score 790 → Band A (BND-A, BND-1). No derogatory items, no public records. Limit = min(requested $40,000, band max $50,000, revenue cap $215,000) = $40,000. Exceeds analyst authority of $10,000; controller approved.

**Rules cited:** CHK-1, BND-1, BND-A, LIM-1, LIM-2, LIM-4, TRM-1, SOD-2

### Problems flagged
None.

---

## APP-1043 — Pacific Crest Provisions LLC

**Guarantor:** Kayla Brennan | **Received:** 2026-10-21 | **Requested:** $20,000, Net 30

### Checks
| Check | Result |
|---|---|
| TransUnion identity | **FAILED — codes 2201, 2202, 2101** (RequestID 381262e3) |
| Fraud Finder | **Score 88 — above 70 hard stop** (RequestID 4df7e649) |
| TU score | 640 (RequestID fe87e957) |
| EQ score | 640 (RequestID f679c0a8) |
| EX score | 640 (RequestID 941025c1) |
| Public records | None (RequestID 118a77f4) |
| Phone owner | **No owner found** — prepaid VoIP (RequestID acfe73f5) |
| State registration | Active, CA, filed **2026-09-01** (52 days ago) |

### Fraud stops triggered
**FRD-1 — Identity failure.** TransUnion returned code 2201 (SSN not associated with name) and code 2202 (DOB does not match file) for guarantor KAYLA BRENNAN (SSN 666701013, DOB 1999-12-24). Both are hard stops. A third code 2101 (address mismatch) also returned; alone it is a step-up, but is moot here.

**FRD-2 — Fraud Finder score 88.** Threshold is 70. Email kb.9921x@example.com first seen 2026-10-15 (8 days before the application). Phone is prepaid VoIP; no owner found. IP is more than 1,000 miles from the billing address.

**FRD-3 — Registration age vs. claimed years.** Business registered 2026-09-01 (52 days before as_of). Application claims year_started: 2022 (4 years in business). Rule FRD-3 triggers when registration is less than 12 months old and the application claims 2 or more years.

**FRD-4 — Six of six fraud-pattern signals met.** FRD-4 requires two or more; all six are present:
1. Billing address (Ste 114 #2207, Kettner Blvd) contains a private-mailbox suite marker.
2. Ship-to (7801 NW 37th St, Doral FL 33166 — near MIA freight-forward zone) differs from the billing address.
3. Both trade references list the same phone number: (619) 555-0182.
4. Bank account opened 2026-08-28 — 56 days before the application, within the 90-day window.
5. First order ($18,500) is 92.5% of the requested limit ($20,000) and the application requests rush shipment ("shipped tomorrow").
6. Business credit file shows 6 inquiries in the last 30 days; CRS consumer file shows 9 inquiries since 2026-08-19.

### Decision
**Fraud hold — $0, no terms** (FRR-1, controller confirmed)

All four stops independently require fraud hold. No terms, no limit, no shipments of any kind — including cash in advance — until the controller closes the referral (FRR-1). DCL-1 adverse-action notice to applicant: "We need to verify some information before we can offer terms."

Additional note: Even absent fraud, this application could not be approved. Only one month of bank deposits (Sep 2026, $8,400) fails the LIM-4 minimum of three months, requiring cash in advance under GEN-2. The registration age of 52 days (< 12 months, NEW-2) with a Band C guarantor score (640) produces cash in advance regardless of the fraud stops.

**Rules cited:** FRD-1, FRD-2, FRD-3, FRD-4, FRR-1, FRR-2, SOD-4

### Problems flagged
1. **Identity failure (FRD-1)** — SSN/name mismatch (2201) and DOB mismatch (2202). Rules: FRD-1, FRR-1, FRR-2.
2. **Fraud Finder score 88 (FRD-2)** — prepaid VoIP phone, 8-day-old email, IP >1,000 miles from address. Rules: FRD-2, FRR-1, FRR-2.
3. **Registration 52 days old vs. claimed 4 years (FRD-3)**. Rules: FRD-3, FRR-1, FRR-2.
4. **All six FRD-4 signals present**. Rules: FRD-4, FRR-1, FRR-2.

---

## APP-1044 — Saffron Table Catering LLC

**Guarantor:** Priya Venkatesan | **Received:** 2026-10-21 | **Requested:** $15,000, Net 30

### Checks
| Check | Result |
|---|---|
| TransUnion identity | Verified (RequestID 2a2e38b8) |
| Fraud Finder | Score 10 — clear (RequestID 46a55b99) |
| TU score | 690 (RequestID e4e4e97f) |
| EQ score | 690 (RequestID eb553b41) |
| EX score | 690 (RequestID e8452b5c) |
| Public records | **Open judgment $12,300 + unreleased lien $7,450** (RequestID 86c5608b) |
| Phone owner | PRIYA VENKATESAN (RequestID 75aab611) |
| State registration | Active, IL, filed 2015-04-20 |

### Public records detail
- Civil judgment — Lakeview Contractors Inc., $12,300, filed 2023-03-15, status: **Unsatisfied**
- Tax lien — Illinois Department of Revenue, $7,450, filed 2024-08-21, status: **Unreleased**

### Figures
| Item | Value |
|---|---|
| Stated revenue | $980,000 |
| Business-credit estimate | $940,000 |
| Bank deposits Apr–Sep 2026 | $76,800 / $81,200 / $78,400 / $80,900 / $79,300 / $80,400 |
| LIM-4 spike check (Sep vs 2× avg of prior 5) | $80,400 vs $158,640 — no spike |
| 12× average monthly deposits | $954,000 |
| **Verified revenue (lowest of three)** | **$940,000** |
| Stated revenue % above verified | 4.3% — within 25% threshold |
| 10% revenue cap | $94,000 |
| Band C maximum | $7,500 |
| Requested limit | $15,000 |
| **Approved limit** | **$7,500** (binding: band C cap) |

### Decision
**Approve — $7,500, Net 15, Band C** (controller approved; PUB-1 and PUB-2 require controller sign-off)

Business registered 2015-04-20 (11.5 years, not new). Lowest score 690 would yield Band B (680–719), but the open unsatisfied judgment and unreleased tax lien each independently cap the band at C under BND-C and PUB-1, and require controller approval for any open terms. The application falsely declared open_liens_or_judgments = false (PUB-2 contradiction), which also goes to the controller. Limit = min(requested $15,000, band-C max $7,500, cap $94,000) = $7,500. DCL-1 notice required because terms are worse than requested; the notice must name the bureaus and the applicant's right to a free copy within 60 days.

**Rules cited:** CHK-1, BND-1, BND-B, BND-C, PUB-1, PUB-2, LIM-1, LIM-2, LIM-4, TRM-1, SOD-1

### Problems flagged
1. **PUB-2 — False declaration**: Application states no open liens or judgments; CRS public records show an unsatisfied civil judgment ($12,300) and an unreleased state tax lien ($7,450). Rules: PUB-1, PUB-2, BND-C.

---

## APP-1045 — Panaderia Castellanos LLC

**Guarantor:** Elena Castellanos | **Received:** 2026-10-22 | **Requested:** $25,000, Net 30

### Checks
| Check | Result |
|---|---|
| TransUnion identity | Verified (RequestID 5e740de2) |
| Fraud Finder | Score 11 — clear (RequestID e6804c4f) |
| TU score | 760 (RequestID f5d92429) |
| EQ file | **No file returned** (RequestID bccf1a6f) |
| EX score | 700 — one collection on file (RequestID 5a44f144) |
| Public records | None (RequestID 9437bcf5) |
| Phone owner | ELENA CASTELLANOS (RequestID ddf10558) |
| State registration | Active, TX, filed 2019-02-11 |
| Applicant-supplied report | **Disregarded per DOC-1** (owner's TU copy, score 760, dated 2025-04-02) |

### Experian derogatory item
- Collection — NATIONAL RECOVERY 1, $640 past due, opened 2025-08-19

### Banding
- Lowest returned score: Experian 700 (680–719 range) → Band B
- Equifax returned no file: counts as missing bureau → Band B (BND-B)
- One derogatory item (Experian collection) → Band B (BND-B)
- BND-5 (two or more derogatory items → Band C) does not apply — only one collection.
- **Final band: B**

### Figures
| Item | Value |
|---|---|
| Stated revenue | $720,000 |
| Business-credit estimate | $700,000 |
| Bank deposits Apr–Sep 2026 | $57,200 / $60,100 / $58,600 / $59,800 / $58,900 / $59,400 |
| LIM-4 spike check (Sep vs 2× avg of prior 5) | $59,400 vs $117,840 — no spike |
| 12× average monthly deposits | $708,000 |
| **Verified revenue (lowest of three)** | **$700,000** |
| Stated revenue % above verified | 2.9% — within 25% threshold |
| 10% revenue cap | $70,000 |
| Band B maximum | $15,000 |
| Requested limit | $25,000 |
| **Approved limit** | **$15,000** (binding: band B cap) |

### Decision
**Approve — $15,000, Net 30, Band B** (controller approved, SOD-2)

Business registered 2019-02-11 (7.7 years, not new). Equifax no-file counts as one missing bureau (BND-1); Experian shows one collection. Both conditions independently place the guarantor in Band B. Verified revenue $700,000; limit = min(requested $25,000, band-B max $15,000, cap $70,000) = $15,000. Exceeds analyst authority; controller approved. DCL-1 notice required (worse than requested limit; Experian collection played a part — name bureau, confirm bureau did not make the decision, advise free copy within 60 days).

**Rules cited:** CHK-1, BND-1, BND-B, DOC-1, LIM-1, LIM-2, LIM-4, TRM-1, SOD-2

### Problems flagged
1. **DOC-1 violation** — Applicant attached an owner-supplied TransUnion credit report (score 760, dated 2025-04-02). Reports supplied by the applicant are never used; decision is based solely on the CRS pull. Rules: DOC-1.

---

## APP-1046 — Lakeshore Diner Inc.

**Guarantor:** Daniel Whitfield | **Received:** 2026-10-22 | **Requested:** $45,000, Net 30

### Checks
| Check | Result |
|---|---|
| TransUnion identity | Verified (RequestID 3e5126ba) |
| Fraud Finder | Score 9 — clear (RequestID 42f18da8) |
| TU score | 815 (RequestID f8c91de6) |
| EQ score | 815 (RequestID 7f7322e4) |
| EX score | 815 (RequestID 2885e92b) |
| Public records | None (RequestID 84ed4b46) |
| Phone owner | DANIEL WHITFIELD (RequestID cedc80b2) |
| State registration | Active, TX, filed 2009-05-18 |

### Figures
| Item | Value |
|---|---|
| Stated revenue | $1,850,000 |
| Business-credit estimate | $210,000 |
| Bank deposits Apr–Sep 2026 | $16,900 / $18,200 / $17,400 / $17,900 / $17,300 / $17,900 |
| LIM-4 spike check (Sep vs 2× avg of prior 5) | $17,900 vs $35,080 — no spike |
| 12× average monthly deposits | $211,200 |
| **Verified revenue (lowest of three)** | **$210,000** |
| Stated revenue vs verified | $1,850,000 stated is **780% above** $210,000 verified — LIM-2 disclosure required |
| 10% revenue cap | $21,000 |
| Band A maximum | $50,000 |
| Requested limit | $45,000 |
| **Approved limit** | **$21,000** (binding: 10% revenue cap) |

### Decision
**Approve — $21,000, Net 30, Band A** (controller approved, SOD-2)

Business registered 2009-05-18 (17.4 years, not new). Lowest score 815 → Band A. No derogatory items, no public records. The binding constraint is the 10% revenue cap: business-credit estimate ($210,000) and 12× average monthly deposits ($211,200) are tightly consistent at about $210,000 and are far below the stated revenue of $1,850,000. Per LIM-2, the stated figure is 780% above the lowest verified figure, which is noted explicitly here. Verified revenue = $210,000; cap = $21,000. Limit = min(requested $45,000, band-A max $50,000, revenue cap $21,000) = $21,000. Exceeds analyst authority; controller approved.

**Rules cited:** CHK-1, BND-1, BND-A, LIM-1, LIM-2, LIM-4, TRM-1, SOD-2

### Problems flagged
1. **LIM-2 — Revenue discrepancy**: Stated revenue ($1,850,000) is 780% above the lowest verified figure ($210,000 from business-credit / bank deposits). Limit is capped at $21,000 (10% of $210,000). Rules: LIM-2, LIM-4.

---

## Ledger problems flagged

The following issues were found in the existing trade-customer ledger during this review. They are for the collections clerk and controller to resolve.

### 1. Misapplied payment — PMT-8812 (C-1001 / C-1004)
PMT-8812 ($1,940.00, 2026-10-09, payer "Golden Gate Bagel Co", ACH 1009 GGB) was posted to C-1004 (Greenleaf Juice Co) against INV-24089 ($1,490.00). The remittance memo cites INV-24098, which is a C-1001 (Golden Gate Bagel Co) invoice for exactly $1,940.00 still open. Result: INV-24089 is overpaid by $450 (balance −$450); INV-24098 remains unpaid. Unapply PMT-8812 from INV-24089, reapply to INV-24098 on C-1001, and reverse the C-1004 credit balance. Do not chase either invoice until corrected (COL-6).
**Rules:** COL-10, COL-6

### 2. Duplicate invoices — INV-24116 and INV-24117 (C-1008)
INV-24116 and INV-24117 are identical in every field: C-1008, date 2026-10-02, PO FFTC-0930, terms Net 15 (due 2026-10-17), amount $1,486.40. One must be voided. Do not send reminders on the duplicate amount (COL-6). As of 2026-10-23, the single valid invoice is 6 days past due — first-notice stage under COL-1.
**Rules:** COL-6, DSP-1

### 3. Duplicate customer records — C-1007 and C-1011 (Sunset Noodle Bar)
C-1007 (Sunset Noodle Bar LLC, EIN 47-3318290) and C-1011 (Sunset Noodle Bar, EIN 473318290 — same digits, no hyphen) share the same address (1825 Irving St, SF 94122) and phone (415-555-0147). They are one business under REL-1 and COL-7. C-1011 was opened by J. Park on 2026-09-28 at the Outer Sunset food fair. Combined open balance: C-1007 ($3,615.20 + $4,234.80 = $7,850) + C-1011 ($3,180 + $3,240 = $6,420) = $14,270, against the lower limit of $10,000. Combined balance exceeds the limit by $4,270 — credit hold required under COL-3. Merge C-1011 into C-1007, place on credit hold, notify controller.
**Rules:** REL-1, COL-7, COL-3, SOD-5

### 4. Credit review overdue — C-1002 (Harborview Oyster House)
C-1002 has a limit of $30,000. REV-2 requires a 6-month review for limits above $25,000. Last review: 2024-05-20 — now 17 months ago, 11 months overdue. Additionally, INV-24047 (due 2026-09-03, 50 DPD) and INV-24062 (due 2026-09-17, 36 DPD) are both in the 30–59 DPD stage, requiring a phone call and hold on new orders (COL-1). INV-24119 was invoiced on 2026-10-05 when INV-24047 was already 32 DPD; that order should not have been released (ORD-1). Trigger review immediately, hold new orders, notify controller.
**Rules:** REV-1, REV-2, COL-1, ORD-1

### 5. Extreme overdue invoice — INV-24111 (C-1012)
INV-24111 (Piedmont Provisions Catering, $3,905.60) is dated 2025-09-29 with Net 30 terms (due 2025-10-29). As of 2026-10-23, it is 358 days past due. COL-1 requires a final demand and controller decision on agency referral or write-off for invoices 90+ DPD. No collection action is visible in the ledger. The invoice date is one year before the rest of the case data, suggesting it may have been entered with the wrong year. Collections clerk must escalate to the controller immediately.
**Rules:** COL-1

### 6. Open balance exceeds limit — C-1005 (Telegraph Ave Pizza LLC)
C-1005 (limit $15,000) has four open invoices totalling $18,240.60: INV-24054 ($4,880.40), INV-24077 ($5,212.90), INV-24107 ($4,407.30), INV-24127 ($3,740.00). The open balance exceeds the limit by $3,240.60. COL-3 requires an automatic credit hold when the open balance is above the limit. INV-24054 is also 43 DPD (30–59 DPD stage under COL-1). Customer is not listed as on credit hold. Place on credit hold immediately, notify controller.
**Rules:** COL-3, COL-1, ORD-1

---

*Report generated 2026-10-23. All CRS checks are live sandbox pulls dated today. All figures are in USD.*