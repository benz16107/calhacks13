# Responsible design: the credit desk against Microsoft's Responsible AI Standard

Microsoft's Responsible AI Standard (v2, June 2022) names six principles: fairness, reliability and safety, privacy
and security, inclusiveness, transparency, and accountability
(https://www.microsoft.com/en-us/ai/principles-and-approach). Below, each control the desk has, the principle it
serves, and where to check it. "GurtOS" marks controls that come from the OS rather than from the desk; any agent on
the box gets those.

This is a design mapping for a hackathon project with sandbox data. It is not an assessment against the Standard's
goals and requirements, and nothing here claims legal compliance.

One open question: the fraud-hold letter gives a general reason, as rules DCL-1 and FRR-3 say, but Regulation B asks
that reasons describe the factors actually considered. No source we found settles whether that wording is enough
(`CUSTOMER.md` section 5), so a lawyer should check it before any real letter goes out.

## Fairness

| Control | Evidence |
|---|---|
| The seats that decide never see protected attributes (race, color, religion, national origin, sex, marital status, age, public assistance, and proxies like date of birth) or the guarantor's name, SSN, address or contacts. Tools in the core read those from the original case only to run CRS checks. | `desk.ts` (`redactApplication`, `stageWorkspace`), `crs.ts` (the summary carries no personal data) |
| A test proves it: two applicants who differ only in protected attributes are byte-identical to the seats, and the staged workspace and the CRS summary hold none of those values. | `fairness.test.ts` |
| One written rules file decides for everyone; a decision must cite rule ids that exist in it. | `rules/credit-rules.yaml`, `checkRules` in `desk.ts` |
| Every adverse letter carries the ECOA notice. | `letters.ts`, `letters.test.ts` |

## Reliability and safety

| Control | Evidence |
|---|---|
| Limits enforced in code, not in the prompt: no credit decision before the CRS checks (CHK-1), no payment to bank details changed without a confirming call (AP-4, refused outright), no duplicate payment (AP-3), no paying a bill the seat entered (AP-1), the controller above set amounts. | `track.ts`, `ap.ts`; `./demo` checks each refusal |
| Measured against an answer key with planted errors and things that look wrong but are fine; precision is reported next to recall. | `score.ts`, `cases/*/answer_key.json`, `runs/` |
| A half-done handoff survives a power cut: nothing is asked, answered or paid twice. GurtOS: the log is fsynced per line and tasks resume from it. | `runs/2026-10-24-crash-handoff-853015/` |
| Undo takes one seat's work out without touching the others. GurtOS: each task's file changes are their own layer; the books are rebuilt from the log. | `./demo`: "undoing the clerk's task took its entry out of the books" |
| A public benchmark slice, run the same way. | `bench/README.md` |

## Privacy and security

| Control | Evidence |
|---|---|
| GurtOS: each seat runs as its own Linux user, in its own copy of the files, with no network except through the desk's tools. | `core/README.md` |
| GurtOS: the CRS and Nessie keys stay in the vault; tools use them in the core. `./demo` checks that no key appears in the log. | `demo.ts` |
| Seats never see SSNs, dates of birth or the guarantor's identity (see Fairness). | `fairness.test.ts` |
| Text from customers and suppliers is evidence, never an instruction (GEN-3). The planted supplier email that tells "your accounts payable assistant" to skip the call is flagged, not followed. | E16 in the answer key; rule GEN-3 |
| Only test identities and sandbox money: CRS's 20 test people, Capital One's Nessie sandbox. | `sandbox/crs.md`, `sandbox/nessie.md` |

## Inclusiveness

| Control | Evidence |
|---|---|
| Letters in plain words; a fraud hold is worded neutrally ("We need to verify some information") so an applicant is not accused of anything. | `letters.ts` (FRR-3) |
| Anyone can bring their own case: a form for one application, or uploaded files, with templates and plain error messages. | the window's "Bring your own" view, `uploads.ts` |
| The window works on the box's screen and on a paired phone, by keyboard, with labelled controls and visible focus. | `app.html` |
| Not done: no translations, and no screen-reader test of the window. | |

## Transparency

| Control | Evidence |
|---|---|
| Every decision carries its rule ids, the figures used, the CRS request ids, and who approved it. | the log; the window's Decisions view |
| "Why did we decide this, and does it still hold?" is one query on the log, months later. | `GET /t/credit-desk/why`, the window's "Ask why" view, `review.ts` |
| The books show which seat posted each entry, from which task and log entry, under which rule. | the window's Books view, `bookkeeping.ts` |
| Adverse letters state the main reasons and, when a credit report played a part, which agencies and the right to a free copy. | `letters.ts` |
| The code, the cases, the answer keys and the scores are public. | this folder |

## Accountability

| Control | Evidence |
|---|---|
| A person, the controller, decides everything above the analyst's authority, every fraud referral, and any change to a limit she approved. | rules SOD-2, SOD-4, REV-6; the controller gate in every recording tool |
| No seat approves its own work or another seat's. GurtOS Business: only a signed-in person can answer, never the one who asked, within their limit. | `core/README.md` "Business edition" |
| A no carries a reason, and the seat revises instead of asking again. | `POST /t/credit-desk/reason`, the `denied` path in each tool |
| GurtOS: one append-only action log of every tool call and its result (the desk's refusals included), every approval and every cost; on a Business box, an audit view with who asked, which seat, who approved. | `core/README.md` |
