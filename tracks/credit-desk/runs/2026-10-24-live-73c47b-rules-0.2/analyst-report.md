# Fogline Supply Co. — Credit Analyst Report
**Case:** fogline-2026-10 | **As of:** 2026-10-23 | **Analyst:** credit analyst (agent)

---

## Summary table

| App | Business | Outcome | Band | Limit | Terms | Authority |
|---|---|---|---|---|---|---|
| APP-1041 | Kettle & Crumb LLC | Approved | A | $8,000 | Net 30 | Analyst |
| APP-1042 | Bright Harbor Catering Inc. | Approved | A | $40,000 | Net 30 | Controller |
| APP-1043 | Pacific Crest Provisions LLC | Fraud hold | — | $0 | None | Controller |
| APP-1044 | Saffron Table Catering LLC | Approved | C | $7,500 | Net 15 | Controller |
| APP-1045 | Panaderia Castellanos LLC | Approved | B | $15,000 | Net 30 | Controller |
| APP-1046 | Lakeshore Diner Inc. | Approved | A | $21,000 | Net 30 | Controller |

---

## APP-1041 — Kettle & Crumb LLC

**Outcome:** Approved — Band A, $8,000, Net 30 (analyst authority)
**Received:** 2026-10-19 | **Guarantor:** Grace Nakamura | **CRS IDs:** see below

### Checks

| Check | Result |
|---|---|
| TransUnion identity | Verified (req eebd1494) |
| Fraud Finder | Score 9 — clean (req f4129c19) |
| Phone owner | GRACE NAKAMURA — matches |
| Public records | None (req 28c640cf) |
| Registration | Active since 2017-03-14 (9 yr 7 mo) |

### Credit scores

| Bureau | Score | Derogatory | CRS Request |
|---|---|---|---|
| TransUnion | 770 | 0 | 5897462f |
| Equifax | 770 | 0 | 8a41ada1 |
| Experian | 770 | 0 | b6af561c |

Lowest score: **770** → Band A (BND-A: ≥720, no derogatory, no public records).

### Revenue and limit

| Source | Amount |
|---|---|
| Stated revenue | $620,000 |
| Business credit estimate | $590,000 |
| Bank deposits (6 mo avg × 12) | $595,200 |
| **Verified revenue (lowest)** | **$590,000** |

Stated revenue is 5.1% above the lowest figure — within the 25% threshold; no LIM-2 notation required.

6-month bank deposits (Apr–Sep 2026): $47,900 / $50,300 / $51,200 / $48,800 / $49,100 / $50,300.
Average $49,600/month. Latest month ($50,300) is not more than twice the prior-month average ($49,460); all six months used (LIM-4).

LIM-1: min(requested $8,000 / band max $50,000 / 10% of $590,000 = $59,000) = **$8,000**.
Within analyst authority of $10,000 (SOD-1).

### Rules cited

BND-A, BND-1, LIM-1, LIM-2, LIM-4, TRM-1, SOD-1, CHK-1, CHK-3

### Problems flagged

None.

### Required follow-ups

| Rule | Action |
|---|---|
| REV-1 | Schedule 12-month review by 2027-10-23. Limit $8,000 is below $25,000, so annual cycle applies. |
| DCL-1 | Approved at requested terms — no adverse action notice required. |

---

## APP-1042 — Bright Harbor Catering Inc.

**Outcome:** Approved — Band A, $40,000, Net 30 (controller approved 2026-10-23)
**Received:** 2026-10-20 via sales rep M. Chen | **Guarantor:** Margaret Okafor

### Checks

| Check | Result |
|---|---|
| TransUnion identity | Verified (req f92e2630) |
| Fraud Finder | Score 11 — clean (req b55af44f) |
| Phone owner | MARGARET OKAFOR — matches |
| Public records | None (req 2b1ae288) |
| Registration | Active since 2012-06-01 (14 yr 4 mo) |

### Credit scores

| Bureau | Score | Derogatory | CRS Request |
|---|---|---|---|
| TransUnion | 790 | 0 | 8b9f69d2 |
| Equifax | 790 | 0 | bf9dd95d |
| Experian | 790 | 0 | 91a4dcba |

Lowest score: **790** → Band A.

### Revenue and limit

| Source | Amount |
|---|---|
| Stated revenue | $2,300,000 |
| Business credit estimate | $2,150,000 |
| Bank deposits (6 mo avg × 12) | $2,172,000 |
| **Verified revenue (lowest)** | **$2,150,000** |

Stated revenue is 7.0% above the lowest figure — within 25% threshold.

6-month deposits (Apr–Sep 2026): $172,400 / $184,900 / $176,300 / $188,200 / $179,600 / $184,600.
Average $181,000/month. Latest month not excluded (LIM-4).

LIM-1: min($40,000 / $50,000 / 10% of $2,150,000 = $215,000) = **$40,000**.
Limit $40,000 > $10,000 analyst authority → controller required (SOD-2). Controller approved 2026-10-23 (approval tlux7xh7ddd.mcp.ask.d5ff915cab72).

### Rules cited

BND-A, BND-1, LIM-1, LIM-2, LIM-4, TRM-1, SOD-2, CHK-1, CHK-3

### Problems flagged

None.

### Required follow-ups

| Rule | Action |
|---|---|
| REV-2 | Limit $40,000 > $25,000 — 6-month review cycle. Schedule review by 2027-04-23. |
| DCL-1 | Approved at requested terms — no adverse action notice required. |
| TRM-1 | 2/10 Net 30 upgrade requires 12 months of on-time payment plus controller approval; not yet eligible. |

---

## APP-1043 — Pacific Crest Provisions LLC

**Outcome:** Fraud hold — $0 limit, no terms, no shipments (controller confirmed 2026-10-23)
**Received:** 2026-10-21 | **Guarantor:** Kayla Brennan | **Referral due by:** 2026-10-24 (1 business day)

### Fraud stops

Four independent fraud stops were found. Any one of them alone requires a fraud hold (FRR-1).

**FRD-1 — Identity failure (CRS req 303ddb55)**
TransUnion returned code 2201 (SSN 666701013 not associated with name KAYLA BRENNAN) and code 2202 (DOB 1999-12-24 does not match the file). Address mismatch code 2101 was also returned.

**FRD-2 — Fraud Finder score 88 (CRS req 428f0f74)**
Risk score 88 exceeds the threshold of 70. Phone is VoIP and prepaid; phone owner does not match the guarantor name (FRD-6 signal). Email `kb.9921x@example.com` was first seen 2026-10-15 — only 6 days before the application was submitted. IP address is more than 1,000 miles from the billing address.

**FRD-3 — Registration age vs. claimed years in business**
Business credit file (BC-1043) shows filed_on 2026-09-01 — 52 days before as_of 2026-10-23. The application claims year_started 2022 and years_in_business 4. A business registered 52 days ago cannot have been in operation for 2 or more years.

**FRD-4 — Six compound fraud signals (threshold: two)**
1. Billing address `2390 Kettner Blvd Ste 114 #2207, San Diego` — the `#2207` identifies a private mailbox at a commercial mail receiving agency.
2. Ship-to `7801 NW 37th St Unit 4, Doral FL 33166` differs from billing and is located in the freight-forwarding district adjacent to Miami International Airport.
3. Both trade references share the same phone number: `(619) 555-0182`.
4. Bank account opened 2026-08-28 — 56 days before as_of, under the 90-day threshold.
5. First order of $18,500 = 92.5% of the $20,000 requested limit, with a rush delivery demand in the application.
6. Nine credit inquiries within 30 days (CRS); business credit file shows 6 inquiries in 30 days.

### Additional concerns (supporting context)

- Only 1 month of bank deposits available (September 2026: $8,400, 3 items). Per GEN-2 and LIM-4, at least 3 months are required; without them the outcome is cash in advance at best — but the fraud hold supersedes this.
- Business account was registered 52 days ago, making it a NEW-1 business (NEW-1: filed within 24 months). Under NEW-2, a business filed less than 12 months ago would receive cash in advance unless the guarantor is band A or B; the guarantor's score of 640 is band C, so cash in advance would apply regardless — but again, the fraud hold is the controlling outcome.
- The registered agent is a commercial agent service ("Statewide Registered Agents Inc."), with no trade history on the business credit file.

### Rules cited

FRD-1, FRD-2, FRD-3, FRD-4, FRD-6, FRR-1, FRR-2, FRR-3, GEN-1, GEN-2, NEW-1, CHK-1, CHK-3

### Required follow-ups

| Rule | Action | Deadline |
|---|---|---|
| FRR-1 | Fraud hold is in effect. No terms, no limit, no shipments of any kind including cash in advance until the controller decides. | Immediate |
| FRR-2 | Send the controller a full fraud referral. Include: each rule hit with the exact CRS data and request IDs behind it; all checks that passed; all FRD-6 signals; a statement that no information from the applicant should speed up the decision. | By 2026-10-24 (1 business day) |
| FRR-3 | Tell sales: "on hold pending verification." Tell the applicant: "We need to verify some information before we can offer terms." Do not name the check, the rule, the data source, which detail failed, or the word fraud. | Immediate |
| FRR-5 | If the controller has not decided within 3 business days, re-send the referral. If undecided after 30 days (by 2026-11-20), close the application as incomplete and send the DCL-1 notice. | 3 business days / 30 days |
| DCL-1 | If declined or if the 30-day limit is reached: written notice, reason "unable to verify information." Do not name the specific check or data source. | Within 30 days of closure |

---

## APP-1044 — Saffron Table Catering LLC

**Outcome:** Approved — Band C, $7,500, Net 15 (controller approved 2026-10-23)
**Received:** 2026-10-21 | **Guarantor:** Priya Venkatesan

### Checks

| Check | Result |
|---|---|
| TransUnion identity | Verified (req 044321f0) |
| Fraud Finder | Score 10 — clean (req eaaf64f5) |
| Phone owner | PRIYA VENKATESAN — matches |
| Public records | Unsatisfied judgment $12,300 + unreleased tax lien $7,450 (req 84cfb9aa) |
| Registration | Active since 2015-04-20 (11 yr 6 mo) |

### Credit scores

| Bureau | Score | Derogatory | CRS Request |
|---|---|---|---|
| TransUnion | 690 | 0 | 8f71bee2 |
| Equifax | 690 | 0 | 4311f69f |
| Experian | 690 | 0 | 60b597ba |

Lowest score: **690** — falls in BND-B range (680–719), but PUB-1 forces **Band C** at most due to the open public records below.

### Public records (BND-C, PUB-1, PUB-2)

| Record | Amount | Status | Filed | Age |
|---|---|---|---|---|
| Civil judgment — LAKEVIEW CONTRACTORS INC | $12,300 | Unsatisfied | 2023-03-15 | 43 months |
| Tax lien — ILLINOIS DEPT. OF REVENUE | $7,450 | Unreleased | 2024-08-21 | 26 months |

Application declared `open_liens_or_judgments: false`. This directly contradicts the public record findings (PUB-2). Both records are open and current.

### Revenue and limit

| Source | Amount |
|---|---|
| Stated revenue | $980,000 |
| Business credit estimate | $940,000 |
| Bank deposits (6 mo avg × 12) | $954,000 |
| **Verified revenue (lowest)** | **$940,000** |

Stated revenue 4.3% above lowest figure — within 25% threshold.

6-month deposits (Apr–Sep 2026): $76,800 / $81,200 / $78,400 / $80,900 / $79,300 / $80,400.
Average $79,500/month. Latest month not excluded (LIM-4).

LIM-1: min(requested $15,000 / band C max $7,500 / 10% of $940,000 = $94,000) = **$7,500**.
Limit $7,500 is within analyst authority, but PUB-1 requires controller sign-off for any open terms. PUB-2 also sends the application to the controller. Controller approved 2026-10-23 (approval tlux7xh7ddd.mcp.ask.358c3cb42a62).

### Rules cited

BND-C, BND-1, PUB-1, PUB-2, LIM-1, LIM-2, LIM-4, TRM-1, SOD-1, SOD-2, CHK-1, CHK-3

### Problems flagged

| Finding ID | Problem | Rules |
|---|---|---|
| tlux7xh7ddd.mcp.credit-desk.flag.0b9e6fd8a48e.1 | Application declared no open liens or judgments; CRS found an unsatisfied judgment and an unreleased tax lien | PUB-1, PUB-2 |

### Required follow-ups

| Rule | Action | Deadline |
|---|---|---|
| DCL-1 | Written adverse action notice — approved at $7,500 Net 15 rather than $15,000 Net 30. Main reasons: open unsatisfied civil judgment ($12,300) and unreleased tax lien ($7,450) found by PitchPoint/CRS (req 84cfb9aa-04d7-4877-8885-e4b642d1c20f). State that PitchPoint did not make the decision. Advise guarantor of right to a free copy within 60 days and right to dispute. | By 2026-11-20 (30 days from 2026-10-21) |
| REV-2 | Band C — 6-month review cycle. Schedule review by 2027-04-23. At that review: if no invoice 15+ DPD and no returned payment, the account may move to normal rules and limit at most doubles. | By 2027-04-23 |
| REV-3 | Trigger early review if any new public record appears, registration status changes, or owner/EIN/bank account changes (REV-3). | Ongoing |

---

## APP-1045 — Panaderia Castellanos LLC

**Outcome:** Approved — Band B, $15,000, Net 30 (controller approved 2026-10-23)
**Received:** 2026-10-22 via email | **Guarantor:** Elena Castellanos

### Checks

| Check | Result |
|---|---|
| TransUnion identity | Verified (req 39efb65f) |
| Fraud Finder | Score 11 — clean (req 4aaad7a8) |
| Phone owner | ELENA CASTELLANOS — matches |
| Public records | None (req 36dcf866) |
| Registration | Active since 2019-02-11 (7 yr 8 mo) |

### Credit scores

| Bureau | Score | Derogatory | CRS Request |
|---|---|---|---|
| TransUnion | 760 | 0 | c45228cc |
| Equifax | No file | — | 9d9aa856 |
| Experian | 700 | 1 (collection) | ccd04ed1 |

Equifax returned `NoFileReturnedNoHit`. Per BND-1, a bureau with no file counts as **missing** — not clean.
Experian returned score 700 with one active collection: NATIONAL RECOVERY 1, $640, opened 2025-08-19.
Lowest returned score: **700**.

Three independent BND-B qualifiers: (1) lowest score 700 in the 680–719 range; (2) one bureau missing (Equifax); (3) one derogatory item (Experian collection). BND-5 (band C at best) requires two or more derogatory items — only one is present, so band B stands.

**Applicant-supplied report discarded.** APP-1045 attached an owner-supplied TransUnion report dated 2025-04-02, score 760. Per DOC-1, the desk pulls its own reports and never uses applicant-supplied copies. The attachment is not used and is 18 months stale; it predates the Experian collection by 16 months.

### Revenue and limit

| Source | Amount |
|---|---|
| Stated revenue | $720,000 |
| Business credit estimate | $700,000 |
| Bank deposits (6 mo avg × 12) | $708,000 |
| **Verified revenue (lowest)** | **$700,000** |

Stated revenue 2.9% above lowest — within 25% threshold.

6-month deposits (Apr–Sep 2026): $57,200 / $60,100 / $58,600 / $59,800 / $58,900 / $59,400.
Average $59,000/month. Latest month not excluded (LIM-4).

LIM-1: min(requested $25,000 / band B max $15,000 / 10% of $700,000 = $70,000) = **$15,000**.
Limit $15,000 > $10,000 analyst authority → controller required (SOD-2). Controller approved 2026-10-23 (approval tlux7xh7ddd.mcp.ask.b0e85124d4e1).

### Rules cited

BND-B, BND-1, BND-5, LIM-1, LIM-2, LIM-4, TRM-1, SOD-2, CHK-1, CHK-3, DOC-1

### Problems flagged

| Finding ID | Problem | Rules |
|---|---|---|
| tlux7xh7ddd.mcp.credit-desk.flag.dd368de3bf0c.1 | Applicant-supplied TransUnion report attached; discarded | DOC-1 |
| tlux7xh7ddd.mcp.credit-desk.flag.f20fdfb063e0.1 | Equifax no-file — missing bureau, band B at most | BND-1, BND-B |

### Required follow-ups

| Rule | Action | Deadline |
|---|---|---|
| DCL-1 | Written adverse action notice — approved at $15,000 rather than requested $25,000. Main reasons: (1) Experian score 700 with active collection account NATIONAL RECOVERY 1 (req ccd04ed1-2a03-4c37-9d73-ed617aa0c365); (2) Equifax returned no credit file (req 9d9aa856). State that Experian and Equifax did not make the decision. Advise guarantor of right to free copies within 60 days and right to dispute. | By 2026-11-21 (30 days from 2026-10-22) |
| REV-1 | Limit $15,000 < $25,000, no band C — annual review cycle. Schedule review by 2027-10-22. | By 2027-10-22 |

---

## APP-1046 — Lakeshore Diner Inc.

**Outcome:** Approved — Band A, $21,000, Net 30 (controller approved 2026-10-23)
**Received:** 2026-10-22 | **Guarantor:** Daniel Whitfield

### Checks

| Check | Result |
|---|---|
| TransUnion identity | Verified (req a5c23c5b) |
| Fraud Finder | Score 9 — clean (req 45af8d73) |
| Phone owner | DANIEL WHITFIELD — matches |
| Public records | None (req a25f9f58) |
| Registration | Active since 2009-05-18 (17 yr 5 mo) |

### Credit scores

| Bureau | Score | Derogatory | CRS Request |
|---|---|---|---|
| TransUnion | 815 | 0 | 552ec963 |
| Equifax | 815 | 0 | 62697472 |
| Experian | 815 | 0 | a088d7c3 |

Lowest score: **815** → Band A.

### Revenue and limit — LIM-2 discrepancy (required notation)

| Source | Amount |
|---|---|
| Stated revenue | $1,850,000 |
| Business credit estimate | $210,000 |
| Bank deposits (6 mo avg × 12) | $211,200 |
| **Verified revenue (lowest)** | **$210,000** |

**Stated revenue ($1,850,000) exceeds the lowest verified figure ($210,000) by 781% — far above the 25% threshold. This discrepancy is required to be noted in the decision by LIM-2.** The business credit file also reports 5 employees versus 22 claimed. Bank deposits and business credit are tightly aligned ($210,000–$211,200); the stated figure is unexplained. The applicant should be asked to explain the discrepancy before or at the 12-month review.

6-month deposits (Apr–Sep 2026): $16,900 / $18,200 / $17,400 / $17,900 / $17,300 / $17,900.
Average $17,600/month. Latest month not excluded (LIM-4).

LIM-1: min(requested $45,000 / band A max $50,000 / 10% of $210,000 = $21,000) = **$21,000**.
Limit $21,000 > $10,000 analyst authority → controller required (SOD-2). Controller approved 2026-10-23 (approval tlux7xh7ddd.mcp.ask.93385bd50c1b).

### Rules cited

BND-A, BND-1, LIM-1, LIM-2, LIM-4, TRM-1, SOD-2, CHK-1, CHK-3

### Problems flagged

| Finding ID | Problem | Rules |
|---|---|---|
| tlux7xh7ddd.mcp.credit-desk.flag.7f09f7284979.1 | Stated revenue $1,850,000 is 781% above verified figure of $210,000 | LIM-2, LIM-1 |

### Required follow-ups

| Rule | Action | Deadline |
|---|---|---|
| DCL-1 | Written notice — approved at $21,000 rather than requested $45,000. Main reason: credit limit is set at 10% of verified annual revenue ($210,000); bank deposits and the business credit file align at $210,000–$211,200 annually. The consumer credit report (all three bureaus 815) was favorable and was not the limiting factor. Name all three CRS bureaus; state they did not make the decision. Advise right to free copies within 60 days. | By 2026-11-21 (30 days from 2026-10-22) |
| LIM-2 | Request written explanation from applicant for the discrepancy between stated revenue ($1,850,000) and verified revenue ($210,000). Retain explanation in the credit file. | At or before 12-month review |
| REV-1 | Annual review cycle (limit $21,000 < $25,000, Band A). Schedule review by 2027-10-22. Re-run CHK-1 and re-verify revenue at that review. | By 2027-10-22 |

---

## Existing customer ledger — Problems flagged

All 18 problems have been recorded in the system. The table below gives each flag ID, the affected records, the problem, and the required action.

### Application-level flags (recap)

| Flag ID | App | Problem | Rules |
|---|---|---|---|
| e662c9c36100 | APP-1043 | FRD-1: identity failure (2201+2202) | FRD-1, FRR-1 |
| 522d99364ee7 | APP-1043 | FRD-2: fraud score 88 | FRD-2, FRD-6, FRR-1 |
| ac3e2efba04d | APP-1043 | FRD-3: registered 52 days, claims 4 years | FRD-3, FRR-1 |
| 7e2f6bf6e58c | APP-1043 | FRD-4: six compound signals | FRD-4, FRR-1 |
| 0b9e6fd8a48e | APP-1044 | PUB-2: false declaration, open judgment + lien | PUB-1, PUB-2 |
| dd368de3bf0c | APP-1045 | DOC-1: applicant-supplied report discarded | DOC-1 |
| f20fdfb063e0 | APP-1045 | BND-1: Equifax no-file | BND-1, BND-B |
| 7f09f7284979 | APP-1046 | LIM-2: revenue 781% above verified | LIM-2, LIM-1 |

### Ledger flags — required collections actions

#### 1. C-1007 / C-1011 — Duplicate records (Sunset Noodle Bar) [Flag 784b33dc214f]

**Rules:** REL-1, COL-7, COL-3, ORD-1

C-1007 (EIN 47-3318290) and C-1011 (EIN 473318290) are the same business. Same address, same phone. C-1011 was opened by J. Park on 2026-09-28 at the Outer Sunset food fair.

Combined open balance: $7,850 (C-1007) + $6,420 (C-1011) = **$14,270** against the lower of the two limits (**$10,000**). Exceeds the limit by $4,270.

**Actions required:**
- Merge the two records (COL-7). Merged limit = $10,000 until next review (REL-1).
- Place on credit hold (COL-3): combined balance $14,270 > $10,000.
- Hold SO-5524 ($1,850, C-1011) per ORD-1 — credit hold blocks release.
- Only the controller releases the hold.

#### 2. PMT-8812 — Misapplied payment [Flag 8fad1f41742d]

**Rules:** COL-10, COL-6

Payment of $1,940 posted to C-1004 (Greenleaf Juice Co.) against INV-24089 ($1,490). Payer name is "Golden Gate Bagel Co." and remittance says "INV-24098." INV-24098 is a C-1001 (Golden Gate Bagel Co.) invoice for exactly $1,940.

Effect of error: C-1004 shows a –$450 overpayment; INV-24098 (C-1001, due 2026-10-12) shows $1,940 open and 11 days past due.

**Actions required:**
- Reverse application from INV-24089; apply $1,940 to C-1001 / INV-24098 per COL-10.
- Restore C-1004 balance to $1,490 (correct balance for INV-24089).
- Per COL-6, do not chase INV-24098 until corrected.
- Once corrected, INV-24098 is paid and SO-5530 (C-1001, $1,760) may be evaluated for release: exposure after correction = INV-24124 ($2,655.30) + SO-5530 ($1,760) = $4,415.30, well within the $20,000 limit, and no invoice 30+ DPD. Release per ORD-1 once error is fixed.

#### 3. INV-24116 / INV-24117 — Duplicate invoices for C-1008 [Flag 2b8a2ed951da]

**Rule:** COL-6

INV-24116 and INV-24117 are byte-for-byte identical: C-1008 (Fruitvale Food Truck Collective), invoice date 2026-10-02, PO FFTC-0930, due 2026-10-17, amount $1,486.40, identical nine line items. Both are open at $1,486.40. As of 2026-10-23, each is 6 days past due.

**Actions required:**
- Identify the original invoice (check order record for FFTC-0930) and void the duplicate.
- Per COL-6, do not chase either invoice until the duplicate is resolved.
- After voiding, apply COL-1 aging from 2026-10-17 (6 DPD → friendly reminder).

#### 4. INV-24111 — C-1012, 359 days past due [Flag 3b62cb117844]

**Rules:** COL-1, ORD-1, REV-3

INV-24111 (C-1012 Piedmont Provisions Catering): invoice date 2025-09-29, due 2025-10-29, balance $3,905.60. As of 2026-10-23 this is **359 days past due** with no payment or collections action recorded. COL-1 required escalation through five stages; the final stage (90+ DPD: final demand, controller decides on agency or write-off) should have been reached by approximately 2026-01-27.

**Actions required:**
- Escalate to controller immediately for write-off or collection agency decision (COL-1).
- Hold SO-5528 ($2,980, C-1012, ship 2026-10-27) per ORD-1 — the 359-DPD invoice blocks release.
- Note: INV-24105 (also C-1012, see flag 9 below) has a separate line-total error that must be resolved before chasing.
- Trigger early review for C-1012 per REV-3 (invoice 60+ DPD).

#### 5. PMT-8823 — Post-dated check applied before check date [Flag 68984fa091f6]

**Rules:** COL-5, COL-6

PMT-8823 (C-1010 Dogpatch Deli, $2,036.75): received in hand 2026-10-20, but the check is dated **2026-11-06** — 17 days in the future. INV-24091 (due 2026-10-04, $2,036.75) was marked paid. Per COL-5, a post-dated check is not cash until its date; the invoice stays open.

**Actions required:**
- Reopen INV-24091 ($2,036.75). It will be paid only when the check clears on 2026-11-06.
- Per COL-6, do not send reminders for INV-24091 while this error exists (known payment situation).
- Monitor on 2026-11-06. If the check clears, mark paid. If it bounces, COL-8 applies (NSF: invoices reopen at original due dates; accept only ACH or wire for 6 months; controller notified).
- As of 2026-10-23, INV-24091 would be 19 days past due from its original due date; if the check clears 2026-11-06, aging runs from 2026-10-04.

#### 6. INV-24095 / PMT-8806 — Unearned early-payment discount, C-1009 [Flag de68d163247d]

**Rule:** COL-4

INV-24095 (C-1009 Rockridge Ramen, invoice date 2026-09-08, 2/10 Net 30). PMT-8806 received 2026-10-02 — 24 days after invoice date. The 2% early-payment discount window closes 10 days after the invoice date (2026-09-18). Payment arrived 6 days after the window; $49.20 discount was not earned.

**Actions required:**
- Reopen INV-24095 for $49.20.
- Aging on the $49.20 runs from original due date 2026-10-08. As of 2026-10-23 it is 15 days past due → COL-1 second notice (15–29 DPD). Send second notice to C-1009 for $49.20.

#### 7. C-1005 Telegraph Ave Pizza — Open balance exceeds credit limit [Flag 64eff58b5c16]

**Rules:** COL-3, COL-1, ORD-1

Open balance as of 2026-10-23:

| Invoice | Due | DPD | Balance |
|---|---|---|---|
| INV-24054 | 2026-09-10 | 43 | $4,880.40 |
| INV-24077 | 2026-09-28 | 25 | $5,212.90 |
| INV-24107 | 2026-10-24 | 0 | $4,407.30 |
| INV-24127 | 2026-11-09 | — | $3,740.00 |
| **Total** | | | **$18,240.60** |

Limit: $15,000. Balance exceeds limit by $3,240.60.

**Actions required:**
- Place C-1005 on credit hold (COL-3). Only the controller releases it.
- Hold SO-5521 ($2,400) per ORD-1: 30+ DPD (INV-24054 at 43 DPD) and over-limit.
- Make phone call per COL-1 (INV-24054 at 43 DPD, 30–59 DPD stage).

#### 8. C-1002 Harborview Oyster House — Credit review 29 months overdue [Flag e9240ad1cd70]

**Rules:** REV-1, REV-2

Limit $30,000 > $25,000 requires a 6-month review cycle. Last review: 2024-05-20. As of 2026-10-23 this is **29 months** without a review — approximately 4.8 cycles overdue.

**Actions required:**
- Schedule an immediate review. No limit increases permitted until the review is complete (REV-1).
- Review must re-run CHK-1 under REV-5. Pull guarantor's consumer credit only if the signed consent covers reviews; otherwise use business file and ledger.

#### 9. SO-5527 / C-1002 — New order must be held [Flag fc38cd117fb9]

**Rules:** COL-1, ORD-1

Open balance: INV-24047 ($6,240, **50 DPD**) + INV-24062 ($8,115.50, 36 DPD) + INV-24094 ($7,380, 16 DPD) + INV-24119 ($5,920.25, not due) = **$27,655.75**.

SO-5527 requests $3,100. Adding it gives $30,755.75, above the $30,000 limit. INV-24047 at 50 DPD is in the COL-1 30–59 day stage (hold new orders and phone call).

**Actions required:**
- Hold SO-5527 per ORD-1: oldest invoice is 30+ DPD and adding the order would push exposure above the limit.
- Make phone call to C-1002 per COL-1 (30–59 DPD stage).
- Only the controller may release a held order.

#### 10. INV-24105 / C-1012 — Invoice total does not match line items [Flag b96906975e23]

**Rule:** COL-6

INV-24105 (C-1012, invoice date 2026-09-22, due 2026-10-22): header total is $4,862.40. The nine line items in invoice_lines sum to **$4,286.40** — a discrepancy of **$576.00**. Either a line item is missing from the export or the header total was entered incorrectly. (For comparison, INV-24100 and INV-24111 for the same customer cross-check correctly.)

**Actions required:**
- Do not chase INV-24105 until the error is resolved (COL-6).
- Determine whether a missing line exists (compare against the original order) or whether the header total is wrong.
- Issue a corrected invoice or credit memo as appropriate.
- INV-24105 became due 2026-10-22; COL-1 aging begins from the due date of the corrected invoice.

---

### Order release summary (as of 2026-10-23)

| Order | Customer | Amount | Disposition | Reason |
|---|---|---|---|---|
| SO-5519 | C-1003 Mission St. Taqueria | $1,420 | **Release** | INV-24129 not yet due; exposure $2,818.20 < $10,000 limit; no 30+ DPD invoices |
| SO-5521 | C-1005 Telegraph Ave Pizza | $2,400 | **Hold** | Credit hold (COL-3, over limit); 43 DPD (ORD-1) |
| SO-5524 | C-1011 Sunset Noodle Bar | $1,850 | **Hold** | Credit hold (COL-3, REL-1 combined balance $14,270 > $10,000) |
| SO-5527 | C-1002 Harborview Oyster House | $3,100 | **Hold** | 50 DPD (COL-1 ORD-1); exposure would exceed $30,000 limit |
| SO-5528 | C-1012 Piedmont Provisions | $2,980 | **Hold** | INV-24111 is 359 DPD (ORD-1) |
| SO-5530 | C-1001 Golden Gate Bagel Co. | $1,760 | **Hold pending correction** | PMT-8812 must be re-applied first (COL-6). After correction: INV-24098 is paid, exposure $4,415.30 < $20,000 limit, no 30+ DPD — release per ORD-1. |

---

*End of report. All flags and decisions have been recorded in the system. Prepared 2026-10-23.*