# Fogline Supply Co. — Credit Analyst Report
**Case:** fogline-2026-10  
**As of:** 2026-10-23  
**Analyst:** credit analyst (agent)  
**Controller:** Rosa Delgado

---

## Summary table

| Application | Business | Outcome | Band | Limit | Terms | Authority |
|---|---|---|---|---|---|---|
| APP-1041 | Kettle & Crumb LLC | **Approved** | A | $8,000 | Net 30 | Analyst |
| APP-1042 | Bright Harbor Catering Inc. | **Approved** | A | $40,000 | Net 30 | Controller |
| APP-1043 | Pacific Crest Provisions LLC | **Fraud hold** | — | $0 | Cash in advance | Controller |
| APP-1044 | Saffron Table Catering LLC | **Approved** | C | $7,500 | Net 15 | Controller |
| APP-1045 | Panaderia Castellanos LLC | **Approved** | B | $15,000 | Net 30 | Controller |
| APP-1046 | Lakeshore Diner Inc. | **Approved** | A | $21,000 | Net 30 | Controller |

---

## APP-1041 — Kettle & Crumb LLC

**Outcome: Approved by analyst**  
Band A · Limit $8,000 · Net 30  
Rules: BND-1, BND-A, LIM-1, LIM-2, CHK-1, CHK-3, SOD-1

### Applicant
Guarantor: Grace Nakamura, Owner (100%).  
Business: Cafe and bakery, Berkeley CA, registered CA 2017-03-14 (active), 9 years in business as of 2026-10-23. Requested $8,000 / Net 30.

### CRS results
| Check | Result |
|---|---|
| Identity (TU) | Verified — no problems |
| Fraud Finder | Score 9 — clean |
| TransUnion | 770 — no derogatory, no public records |
| Equifax | 770 — no derogatory, no public records |
| Experian | 770 — no derogatory, no public records |
| Public records | None |

CRS request IDs: TU credit f51abbe1, EQ credit 516c562e, EX credit dac7d9b6, identity 0d12cfca, fraud 41f8276d, public records a6b8db8c.

### Revenue verification (LIM-2)
| Source | Figure |
|---|---|
| Stated | $620,000 |
| Business credit (BC-1041) | $590,000 |
| Bank deposits Apr–Sep 2026: avg $49,600/mo × 12 | $595,200 |
| **Verified (lowest)** | **$590,000** |

Stated revenue is 5.1% above the lowest verified figure — within the 25% tolerance.

### Limit sizing (LIM-1)
- 10% of verified revenue: $59,000  
- Band A maximum: $50,000  
- Requested: $8,000 ← binding constraint  
- **Approved limit: $8,000**

Within analyst authority ($10,000). No public records. No fraud signals.

### Problems flagged
None for this application.

---

## APP-1042 — Bright Harbor Catering Inc.

**Outcome: Approved by controller**  
Band A · Limit $40,000 · Net 30  
Rules: BND-1, BND-A, LIM-1, LIM-2, CHK-1, CHK-3, SOD-2

### Applicant
Guarantor: Margaret Okafor, President (80%).  
Business: Corporate catering, San Jose CA, registered CA 2012-06-01 (active), 14 years in business. Requested $40,000 / Net 30.

### CRS results
| Check | Result |
|---|---|
| Identity (TU) | Verified — no problems |
| Fraud Finder | Score 11 — clean |
| TransUnion | 790 — no derogatory, no public records |
| Equifax | 790 — no derogatory, no public records |
| Experian | 790 — no derogatory, no public records |
| Public records | None |

CRS request IDs: TU credit 5c76dd73, EQ credit 1e33036b, EX credit e5095171, identity 17c621c3, fraud b5dc64bd, public records 3847fadf.

### Revenue verification (LIM-2)
| Source | Figure |
|---|---|
| Stated | $2,300,000 |
| Business credit (BC-1042) | $2,150,000 |
| Bank deposits Apr–Sep 2026: avg $181,000/mo × 12 | $2,172,000 |
| **Verified (lowest)** | **$2,150,000** |

Stated revenue is 7.0% above the lowest verified figure — within the 25% tolerance.

### Limit sizing (LIM-1)
- 10% of verified revenue: $215,000  
- Band A maximum: $50,000  
- Requested: $40,000 ← binding constraint  
- **Approved limit: $40,000**

Limit exceeds analyst authority of $10,000. Proposed to controller per SOD-2. Controller approved.

### Problems flagged
None for this application.

---

## APP-1043 — Pacific Crest Provisions LLC

**Outcome: Fraud hold — referred to and confirmed by controller**  
Band none · Limit $0 · Cash in advance  
Rules: FRD-1, FRD-2, FRD-3, FRD-4, SOD-4, CHK-1, CHK-3

### Applicant
Guarantor: Kayla Brennan, Managing Member (100%).  
Business: Office coffee service and corporate catering, San Diego CA (billed), ship-to in Doral FL. Requested $20,000 / Net 30.

### CRS results
| Check | Result |
|---|---|
| Identity (TU) | **FAIL** — code 2201 (SSN not associated with name) and code 2202 (DOB does not match file) |
| Fraud Finder | **Score 88** — above threshold of 70 |
| TransUnion | 640 — 9 inquiries |
| Equifax | 640 — 9 inquiries |
| Experian | 640 — 9 inquiries |
| Public records | None |
| Phone | VoIP, prepaid; owner does not match name |

CRS request IDs: TU credit 25d5c227, EQ credit 4b822008, EX credit be2b3b7e, identity be3fe2f5, fraud 30f80c77, public records 39ff4776.

### Fraud analysis

**FRD-1 (hard stop):** Identity verification failed on two independent codes:
- 2201: SSN is not associated with the name Kayla Brennan.
- 2202: Date of birth does not match the bureau file.
Either code alone requires an immediate fraud hold.

**FRD-2:** Fraud Finder score 88 exceeds the threshold of 70.

**FRD-3:** Business credit (BC-1043) shows Pacific Crest Provisions LLC was registered in CA on 2026-09-01 — 52 days before the application date. The application claims 4 years in business (year started 2022). A business registered less than 12 months ago cannot have been operating for 4 years.

**FRD-4 — multiple indicators present (6 of the enumerated signals):**
1. Billing address (2390 Kettner Blvd, Ste 114 #2207, San Diego CA) contains a private mailbox indicator ("#2207" appended after a suite number).
2. Ship-to address (7801 NW 37th St, Doral FL 33166) is in a known freight-forwarding zone near Miami International Airport, more than 1,000 miles from the billing address.
3. Both trade references (Coastal Foodservice Partners and Westline Paper & Packaging) share the same phone number: (619) 555-0182.
4. Business bank account opened 2026-08-28 — 56 days before the application, within the 90-day window.
5. First order ($18,500) is 92.5% of the requested limit ($20,000), above the 50% threshold, with explicit rush shipping ("ship tomorrow").
6. Personal credit shows 9 inquiries in approximately 24 days; business credit shows 6 inquiries in the last 30 days — both exceed the 5-inquiry threshold.

Additional signals (corroborating but not rule-enumerated): email address first seen 2026-10-15, eight days before the application; IP address more than 1,000 miles from the stated business address; phone number is VoIP/prepaid and owner does not match the guarantor name; guarantor's home address is in Knoxville TN while the business address is San Diego CA.

### Problems flagged
- **APP-1043 — Fraud hold** (finding 99325f63be07): all fraud signals above. Rules: FRD-1, FRD-2, FRD-3, FRD-4, SOD-4.

---

## APP-1044 — Saffron Table Catering LLC

**Outcome: Approved by controller**  
Band C · Limit $7,500 · Net 15  
Rules: BND-1, BND-C, PUB-1, PUB-2, LIM-1, LIM-2, CHK-1, CHK-3, SOD-2

### Applicant
Guarantor: Priya Venkatesan, Owner (100%).  
Business: Event catering, Chicago IL, registered IL 2015-04-20 (active), 11 years in business. Requested $15,000 / Net 30.

### CRS results
| Check | Result |
|---|---|
| Identity (TU) | Verified — no problems |
| Fraud Finder | Score 10 — clean |
| TransUnion | 690 — no derogatory |
| Equifax | 690 — no derogatory |
| Experian | 690 — no derogatory |
| Public records | **Unsatisfied judgment $12,300 (Lakeview Contractors Inc., 2023-03-15); Unreleased IL Dept of Revenue tax lien $7,450 (2024-08-21)** |

CRS request IDs: TU credit b61cff5f, EQ credit 62d7deec, EX credit 11740a77, identity 060c8bdd, fraud 73c30e1d, public records e0f80e37.

### Public records and band adjustment
All three bureaus return 690, which would ordinarily place the applicant in Band B (680–719). However, PUB-1 requires that an open tax lien or unpaid judgment puts the applicant in Band C at best. Two open public records are present: an unsatisfied civil judgment and an unreleased state tax lien. Band C applies.

The application declared no open liens or judgments. This directly contradicts the public record and is flagged under PUB-2. Controller notified of the contradiction.

### Revenue verification (LIM-2)
| Source | Figure |
|---|---|
| Stated | $980,000 |
| Business credit (BC-1044) | $940,000 |
| Bank deposits Apr–Sep 2026: avg $79,500/mo × 12 | $954,000 |
| **Verified (lowest)** | **$940,000** |

Stated revenue is 4.3% above the lowest verified figure — within the 25% tolerance.

### Limit sizing (LIM-1)
- 10% of verified revenue: $94,000  
- Band C maximum: $7,500 ← binding constraint  
- Requested: $15,000  
- **Approved limit: $7,500**

Limit is within analyst authority ($7,500 ≤ $10,000), but PUB-1 requires controller sign-off for open terms when public records are present. Controller approved.

### Problems flagged
- **APP-1044 — False declaration** (finding ca114a5caeec): application declared no open liens or judgments; CRS shows unsatisfied judgment $12,300 and unreleased tax lien $7,450. Rules: PUB-2, PUB-1.

---

## APP-1045 — Panaderia Castellanos LLC

**Outcome: Approved by controller**  
Band B · Limit $15,000 · Net 30  
Rules: BND-1, BND-B, LIM-1, LIM-2, DOC-1, CHK-1, CHK-3, SOD-2

### Applicant
Guarantor: Elena Castellanos, Owner (100%).  
Business: Bakery (retail and wholesale), Dallas TX, registered TX 2019-02-11 (active), 7 years in business. Requested $25,000 / Net 30.

The application arrived with an applicant-supplied TransUnion report (dated 2025-04-02, score 760). This document was discarded per DOC-1. Only CRS results are used.

### CRS results
| Check | Result |
|---|---|
| Identity (TU) | Verified — no problems |
| Fraud Finder | Score 11 — clean |
| TransUnion | 760 — no derogatory, no public records |
| Equifax | **No file returned (no hit)** |
| Experian | 700 — **1 collection: NATIONAL RECOVERY 1, $640 past due, opened 2025-08-19** |
| Public records | None |

CRS request IDs: TU credit 28999a74, EQ credit d4ae29be, EX credit 7a695f43, identity df65b7d4, fraud 72e03971, public records 79ffaf65.

### Banding (BND-1, BND-B)
Per BND-1, the lowest score from any bureau that returned a file is used. TransUnion returned 760; Experian returned 700; Equifax returned no file (treated as missing, not clean). The lowest score is 700. Band B applies on three independent grounds:
1. Lowest score 700 falls in the 680–719 range (BND-B).
2. One derogatory item at Experian (open collection, BND-B).
3. One bureau missing (BND-B).

### Revenue verification (LIM-2)
| Source | Figure |
|---|---|
| Stated | $720,000 |
| Business credit (BC-1045) | $700,000 |
| Bank deposits Apr–Sep 2026: avg $59,000/mo × 12 | $708,000 |
| **Verified (lowest)** | **$700,000** |

Stated revenue is 2.9% above the lowest verified figure — within the 25% tolerance.

### Limit sizing (LIM-1)
- 10% of verified revenue: $70,000  
- Band B maximum: $15,000 ← binding constraint  
- Requested: $25,000  
- **Approved limit: $15,000**

Limit exceeds analyst authority of $10,000. Proposed to controller per SOD-2. Controller approved.

### Problems flagged
- **APP-1045 — Applicant-supplied credit report** (finding 7793219e15e6): attached owner's TU report (2025-04-02, score 760) must not be used; CRS pull is the authoritative source. Rules: DOC-1.

---

## APP-1046 — Lakeshore Diner Inc.

**Outcome: Approved by controller**  
Band A · Limit $21,000 · Net 30  
Rules: BND-1, BND-A, LIM-1, LIM-2, CHK-1, CHK-3, SOD-2

### Applicant
Guarantor: Daniel Whitfield, Owner (100%).  
Business: Full-service diner, Austin TX, registered TX 2009-05-18 (active), 17 years in business. Requested $45,000 / Net 30.

### CRS results
| Check | Result |
|---|---|
| Identity (TU) | Verified — no problems |
| Fraud Finder | Score 9 — clean |
| TransUnion | 815 — no derogatory, no public records |
| Equifax | 815 — no derogatory, no public records |
| Experian | 815 — no derogatory, no public records |
| Public records | None |

CRS request IDs: TU credit 8e0894ed, EQ credit beefb4fc, EX credit ad2cd05a, identity e429ef24, fraud 1d2c8feb, public records 21e0e523.

### Revenue verification — material discrepancy (LIM-2)
| Source | Figure |
|---|---|
| Stated | $1,850,000 |
| Business credit (BC-1046) | $210,000 |
| Bank deposits Apr–Sep 2026: avg $17,600/mo × 12 | $211,200 |
| **Verified (lowest)** | **$210,000** |

**The stated revenue of $1,850,000 is 781% above the verified figure of $210,000, far exceeding the 25% materiality threshold in LIM-2.** This discrepancy is flagged separately (finding 3b3bf6ef48e6). The revenue figure used for limit sizing is $210,000. The controller was informed of the discrepancy.

### Limit sizing (LIM-1)
- 10% of verified revenue: $21,000 ← binding constraint  
- Band A maximum: $50,000  
- Requested: $45,000  
- **Approved limit: $21,000**

Limit exceeds analyst authority of $10,000. Proposed to controller per SOD-2. Controller approved.

### Problems flagged
- **APP-1046 — Stated revenue grossly overstated** (finding 3b3bf6ef48e6): stated $1,850,000 vs verified $210,000, a 781% discrepancy. Rules: LIM-2.

---

## Ledger and accounts-receivable findings

The following problems were found in the existing customer ledger while reviewing applicant data. Each has been recorded as a separate flag.

### 1. Misapplied payment — PMT-8812 (finding 5709c25cb4c9)
**Rules: COL-6**  
PMT-8812 ($1,940.00, received 2026-10-09) belongs to C-1001 (Golden Gate Bagel Co.): the payer name is "Golden Gate Bagel Co." and the remittance memo reads "INV-24098," which is a C-1001 invoice for exactly $1,940. The payment was posted to C-1004 (Greenleaf Juice) against INV-24089, overpaying that invoice by $450 and leaving a –$450 credit balance. INV-24098 shows as open and 11 days past due as a result.  
**Action:** Reverse PMT-8812 from INV-24089/C-1004, apply to INV-24098/C-1001. Clear the –$450 credit on INV-24089. Do not chase INV-24098 until corrected. Review SO-5530 (C-1001, $1,760) for release once the correction is in.

### 2. Duplicate invoices — INV-24116 / INV-24117 (finding 3722b3e6e552)
**Rules: COL-6**  
Two identical invoices for C-1008 (Fruitvale Food Truck Collective): same date (2026-10-02), same PO (FFTC-0930), same amount ($1,486.40), same due date (2026-10-17). Both are open and 6 days past due as of 2026-10-23.  
**Action:** Void one duplicate, confirm correct balance is $1,486.40, then send a first reminder (1–14 days past due per COL-1).

### 3. Invoice date likely wrong year — INV-24111 / C-1012 (finding 5f37b52b7f4c)
**Rules: COL-6, COL-1**  
INV-24111 (C-1012 Piedmont Provisions Catering, $3,905.60) is dated 2025-09-29 with due date 2025-10-29, making it 359 days past due as of 2026-10-23. C-1012 has paid every other invoice on time; there is no escalation record for a balance that has been in final-demand territory for over nine months. The date is almost certainly a keying error ("2025" instead of "2026").  
**Action:** Confirm with C-1012 whether the correct date is 2026-09-29 (due 2026-10-29, not yet past due). Correct if it is a keying error before any dunning action. If the 2025 date is intentional, escalate immediately to the controller (90+ days, COL-1). Also review SO-5528 (C-1012, $2,980) — its release depends on resolution of this invoice.

### 4. Duplicate customer records — C-1007 / C-1011 (finding c92ef269d223)
**Rules: COL-7, COL-3**  
C-1007 ("Sunset Noodle Bar LLC," EIN 47-3318290, 1825 Irving St, SF) and C-1011 ("Sunset Noodle Bar," EIN 473318290, 1825 Irving Street Ste A, SF) are the same legal entity. The EINs are identical (C-1011 omits the hyphen). C-1011 was opened 2026-09-28 by J. Park at a food fair without detecting the existing record. Combined open balances: C-1007 $7,850 (INV-24102 + INV-24122) and C-1011 $6,420 (INV-24110 + INV-24136) = **$14,270 against a single shared limit of $10,000**. The merged account is $4,270 over limit.  
**Action:** Merge C-1011 into C-1007 per COL-7. Apply the $10,000 shared limit to the combined $14,270 balance — COL-3 requires an immediate credit hold on the merged record; only the controller releases it. Hold SO-5524 (C-1011 order, $1,850) pending the controller's release.

### 5. Credit review overdue — C-1002 (finding f7b35ef18527)
**Rules: REV-1**  
C-1002 (Harborview Oyster House, limit $30,000) was last reviewed 2024-05-20 — 17 months ago. The 12-month review cycle expired in May 2025.  
**Action:** Schedule an immediate limit review. No limit increase may be granted while the review is overdue.

### 6. Open balance exceeds credit limit — C-1005 / SO-5521 (finding 71e2c1467988)
**Rules: COL-3, COL-1, ORD-1**  
C-1005 (Telegraph Ave Pizza, limit $15,000) has four open invoices totalling $18,240.60:

| Invoice | Due | Days past due | Balance |
|---|---|---|---|
| INV-24054 | 2026-09-10 | 43 | $4,880.40 |
| INV-24077 | 2026-09-28 | 25 | $5,212.90 |
| INV-24107 | 2026-10-24 | — (tomorrow) | $4,407.30 |
| INV-24127 | 2026-11-09 | — | $3,740.00 |

Open balance $18,240.60 already exceeds the $15,000 limit by $3,240.60 without any new order. INV-24054 is 43 days past due (30–59 day range).  
**Action:** Place C-1005 on credit hold per COL-3; only the controller releases it. Hold SO-5521 ($2,400). Initiate phone call on INV-24054 per COL-1 (30–59 days). Escalate to controller.

### 7. Post-dated check — PMT-8823 / INV-24091 (finding 8291074fedb7)
**Rules: COL-5**  
PMT-8823 (C-1010 Dogpatch Deli, $2,036.75, applied to INV-24091) was received 2026-10-16 but bears check date 2026-11-06. INV-24091 has been closed as paid; per COL-5 it should remain open until the check date.  
**Action:** Reopen INV-24091 as open, value date 2026-11-06. Do not deposit the check before its date. No dunning action needed; the payment is in hand.

### 8. Pending order SO-5527 cannot release — C-1002 (finding 90d77b79eabb)
**Rules: ORD-1, COL-1, COL-3**  
C-1002 has open invoices totalling $27,655.75 against a $30,000 limit. Order SO-5527 ($3,100) would push the balance to $30,755.75, above the limit. Additionally INV-24047 is 53 days past due (30–59 day range), which independently requires holding new orders.

| Invoice | Due | Days past due | Balance |
|---|---|---|---|
| INV-24047 | 2026-08-31 | 53 | $6,240.00 |
| INV-24062 | 2026-09-17 | 36 | $8,115.50 |
| INV-24094 | 2026-10-07 | 16 | $7,380.00 |
| INV-24119 | 2026-11-04 | — | $5,920.25 |

**Action:** Do not release SO-5527. Call C-1002 on INV-24047 (53 days, COL-1). Only the controller may release SO-5527.

---

## Pending orders — status summary

| Order | Customer | Amount | Status | Reason |
|---|---|---|---|---|
| SO-5519 | C-1003 Mission St. Taqueria | $1,420 | **Can release** | No past-due balance; balance + order ($2,818) well within $10,000 limit. Awaiting confirmation that PMT-8812 correction does not affect C-1003. |
| SO-5521 | C-1005 Telegraph Ave Pizza | $2,400 | **Hold — controller** | Open balance $18,240 already exceeds $15,000 limit; 43-day-past-due invoice. |
| SO-5524 | C-1011 Sunset Noodle Bar | $1,850 | **Hold — controller** | Duplicate record (C-1007/C-1011); merged balance $14,270 over $10,000 limit. |
| SO-5527 | C-1002 Harborview Oyster House | $3,100 | **Hold — controller** | Would push balance to $30,755 (over $30,000 limit); INV-24047 is 53 days past due. |
| SO-5528 | C-1012 Piedmont Provisions | $2,980 | **Pending INV-24111 resolution** | INV-24111 date error must be resolved first; release if date corrects to 2026 and no other hold condition. |
| SO-5530 | C-1001 Golden Gate Bagel Co. | $1,760 | **Pending PMT-8812 correction** | Once PMT-8812 is re-applied to INV-24098, C-1001 has no past-due balance and the order can release. |

---

*Report prepared 2026-10-23. All decisions are traceable to CRS request IDs logged above. All flags are recorded in the credit desk system.*