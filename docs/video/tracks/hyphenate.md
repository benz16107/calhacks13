# Hyphenate: the credit desk (1:30)

**Track:** Hyphenate, Autonomous Systems for Finance. **Edition:** GurtOS Business (scored runs on GurtOS Server; the
Business screens from the box seeded as the made-up Fogline Supply). **Shares footage with:** CRS (#3), Microsoft (#4).
**Status:** draft for Ben's approval.

**Goal.** Hyphenate asks for a video that opens with your moment. In the first 14 seconds a judge sees the desk catch a
fake applicant that a simple rule would approve, then learns the seats in one line, sees separation of duties enforced
by the OS, and ends on the scored proof against the answer key.

**Rubric map.**

| Hyphenate asks for | Where |
|---|---|
| A video that opens with your moment | Beat 1 (APP-1043) |
| A company and a few seats, in one line | Beat 3 |
| Messy data with planted errors and an answer key | Beat 5 |
| Approvals and segregation of duties | Beat 4 |
| Every call traceable | Beat 6 |
| Proof; a judge may run their own case | Beat 7 (score, Bring your own) |
| Principle 14: a sourced attack on a financial company | Beat 2 (Equifax, FTC) |

## Shot list

| # | Time | Picture | On-screen text | Narration | Feature and proof |
|---|---|---|---|---|---|
| 1 | 0:00 to 0:14 | T-HY-01: the Credit desk window, Quick run on. APP-1043's application (clean numbers, score 640, "Simple rule: approve $20,000"); the CRS results land row by row: identity codes 2201, 2202, 2101, Fraud Finder 88, 9 inquiries Aug 19 to Sep 12; status turns to Fraud hold. Cut to A30: the controller's phone, Waiting for me, Confirm | APP-1043 · Simple rule: approve $20,000 · CRS, live: identity fails, fraud score 88, 9 inquiries in 3 weeks · Fraud hold, confirmed by the controller | "This applicant has clean numbers and a credit score of six-forty. A simple rule approves twenty thousand dollars. Our analyst agent checked it live with CRS: the identity fails, the fraud score is eighty-eight, and nine credit checks landed in three weeks. It put the account on fraud hold, and the controller confirmed it." | CRS demo moment; merge gate repeats it live every run |
| 2 | 0:14 to 0:27 | G10: the Hills, a short line of type: "Equifax, 2017", then the FTC's findings as two lines; source link in small mono | Equifax, 2017: admin credentials in a plain-text file, no segmentation. 145.5 million Social Security numbers. Source: FTC, July 2019 | "On an ordinary computer, a finance agent runs as you, holds your keys and can approve its own work. At Equifax, the FTC says, admin credentials sat in a plain-text file." | Principle 14; source in `showcase/src/content/tracks/hyphenate.mdx` |
| 3 | 0:27 to 0:40 | A31: Business Settings > People: the three seats and the controller with their roles and limits; push in on one seat's task, "runs as box-…", no keys | Fogline Supply (made up) · Credit analyst · Collections clerk · Payables clerk · Controller (human), above $10,000 and every fraud hold | "Gurt O.S. is an operating system for AI employees. At Fogline Supply, a made-up wholesaler, three agent seats work beside a human controller. Each seat is its own Linux user, with its own files and no passwords." | Seats in their own space; root-only vault |
| 4 | 0:40 to 0:54 | T-HY-02: two refusals in the desk's log: the clerk tries to release a credit hold (refused: not its tool); the analyst's $40,000 decision goes to the controller with the rule and the reason. A32: Business refusing a person who answers their own request (403) | Clerk: no credit tools · Analyst: up to $10,000 alone · Nobody approves their own request | "The clerk has no credit tools. The analyst can't approve forty thousand dollars alone, so it goes to the controller with the rule and the reason. Nobody approves their own request." | Separation of duties: per-task tool lists, routed approvals, the Business refusals (verified Oct 24 03:23) |
| 5 | 0:54 to 1:05 | T-HY-03: the case folder, the answer key file scrolling (planted errors and traps marked), then the Nessie deposits against the ledger with PMT-8812 on the wrong invoice | 17 planted errors · traps that look wrong but aren't · bank: Capital One Nessie (test) | "The data is messy on purpose, with planted errors and traps. The clerk checks the ledger against the bank and finds a payment on the wrong invoice." | Planted case and answer key (`tracks/credit-desk/cases/fogline-2026-10/answer_key.json`) |
| 6 | 1:05 to 1:16 | T-HY-04: one decision in the Activity log expanded: rule ids, the 7 CRS request ids, who approved. Then A33: Audit with Export CSV | Every decision: its rules, its data, who approved · Audit, CSV export | "Every decision keeps its rules, its data and its approver in one append-only log, ready for an auditor." | The action log; Audit with CSV (verified Oct 24 03:24); Ask why |
| 7 | 1:16 to 1:30 | G11: the score card counts up; then T-HY-05: the Bring your own tab; end card | Full live run, real Droid on all three seats: 16 of 17 planted errors caught · 1 false alarm · 6 of 6 credit decisions right · 12 minutes · about $5.24 · Bring your own case · Open source, Apache-2.0 | "In a full live run with Droid on Claude, the desk caught sixteen of seventeen planted errors, with one false alarm, and got all six credit decisions right. Bring your own case. Gurt O.S. is open source." | Hyphenate demo proof (`docs/story.md`) |

**Cut list if long:** beat 5's Nessie shot; beat 6's last sentence.

## Narration (exact text for ElevenLabs)

```text
This applicant has clean numbers and a credit score of six-forty. A simple rule approves twenty thousand dollars. Our analyst agent checked it live with CRS: the identity fails, the fraud score is eighty-eight, and nine credit checks landed in three weeks. It put the account on fraud hold, and the controller confirmed it.

At Equifax, the FTC says, admin credentials sat in a plain-text file.

Gurt O.S. is an operating system for AI employees. At Fogline Supply, a made-up wholesaler, three agent seats work beside a human controller. Each seat is its own Linux user, with its own files and no passwords.

The clerk has no credit tools. The analyst can't approve forty thousand dollars alone, so it goes to the controller with the rule and the reason. Nobody approves their own request.

Every decision keeps its rules, its data and its approver in one append-only log, ready for an auditor.

In a full live run with Droid on Claude, the desk caught sixteen of seventeen planted errors, with one false alarm, and got all six credit decisions right. Bring your own case. Gurt O.S. is open source.
```

## Captures this video needs

Shared (see `capture.md`): A30, A31, A32, A33, G10, G11. Its own:

| ID | What | Machine and state | Steps |
|---|---|---|---|
| T-HY-01 | Quick run stopping on APP-1043 | Clip box (Business on, Fogline seed) with the CRS and Nessie keys in its vault | Credit desk window, Quick run; record until the fraud hold; keep the CRS rows in frame |
| T-HY-02 | The two refusals | Same box, after the quick run | Activity, filter by the clerk's task; then the analyst's $40,000 request in Waiting for me as the controller |
| T-HY-03 | Answer key and the Nessie mismatch | Same box | Open the case folder in the Credit desk window; scroll the answer key; open the ledger view at PMT-8812 |
| T-HY-04 | One decision, expanded | Same box | Activity, the APP-1043 decision row, expand |
| T-HY-05 | Bring your own | Same box | Credit desk window, Bring your own tab, pick one of CRS's test people |
| T-HY-S1 | Credit desk app permissions: Allow, Deny, revoke (slot: only once agent permissions are merged) | Clip box (Business on, Fogline seed) on a build where agent permissions are merged | Open the credit desk app's permissions and hold on its manifest; Allow one permission, Deny one, revoke one; then trigger the revoked use and hold on the OS refusing it. Use only the labels the screen shows |
| T-HY-S2 | Flight recorder replay of the APP-1043 analyst task (slot: only once the flight recorder is merged) | Same box as T-HY-01, after the Quick run, on a build where the flight recorder is merged | Open the flight recorder on the analyst's APP-1043 task; step through it, hold on a step with a file and on an approval, then press Keep. Show only what the recorder lists The controller's phone is a paired Business person, so the approval names them |

## Check before render

- The score is the full live run's (16 of 17, 1 false alarm, 6 of 6, 12 min, $5.24), not the older 14-of-14 run.
- "17 planted errors" matches the answer key at render time.
- The controller's phone is a paired Business person, so the log names them.

## Slots: standout features (use only once merged)

These beats stay out of the video until the feature is merged on main and its check passes. When one is ready, record its capture, add its line to `docs/video/slots.json`, generate its narration with `narration/say.py <script> --slots`, and rebuild: later beats move by themselves.

| Slot id | Feature | Goes after beat | Picture (the capture to record) | On-screen text | Narration | Seconds | Rubric it serves | What to cut to stay in length |
|---|---|---|---|---|---|---|---|---|
| `permissions` | Agent permissions | Beat 4 (the clerk has no credit tools; nobody approves their own request) | T-HY-S1: the credit desk app's permissions on the Fogline box. Allow one, Deny one, revoke one, then the OS refuses the revoked use | Agent permissions · the OS enforces the credit desk's manifest · Allow · Deny · revoke | The OS enforces the credit desk's manifest. Like phone app permissions, you can Allow, Deny or revoke. | 8.4 | Approvals and segregation of duties (beat 4) | Beat 5's second sentence "The clerk checks the ledger against the bank and finds a payment on the wrong invoice." and the Nessie shot (about 6 s) |
| `flight-recorder` | The flight recorder | Beat 6 (every decision in one append-only log) | T-HY-S2: the flight recorder on the Quick run's analyst task for APP-1043. Step through the CRS results, the fraud hold and the controller's confirmation, with the files; end on Keep | Flight recorder · replay the analyst's task step by step · its files and approvals · then Keep or Undo | Replay the analyst's task step by step, with its files and approvals. Then Keep or Undo. | 8.0 | Every call traceable; proof (beat 6) | Beat 6's A33 Audit and Export CSV shot (about 4 s) and, with permissions also in, the rest of beat 5 (about 5 s), so beat 5 goes whole (beat 7 still says "planted errors"). If the length check still fails, beat 4's A32 403 clip (about 3 s) |

Length: target 1:30. Every slot in adds about 16.4 s and the cuts above take out about 15 s, so the video runs about 1:31. Cut sizes are estimates from each beat's window; the build's length check has the final say.

### Slot narration

#### permissions

```text
The OS enforces the credit desk's manifest. Like phone app permissions, you can Allow, Deny or revoke.
```

#### flight-recorder

```text
Replay the analyst's task step by step, with its files and approvals. Then Keep or Undo.
```
