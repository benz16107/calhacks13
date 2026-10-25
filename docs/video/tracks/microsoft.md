# Microsoft: could a company switch this on (1:20)

**Track:** Microsoft, Built for the Real World, and the Customer Impact Award. **Edition:** GurtOS Business (scored
runs on GurtOS Server; the Business screens from the box seeded as the made-up Fogline Supply, with scripted seats).
**Shares footage with:** Hyphenate (#1), CRS (#3). **Status:** draft for Ben's approval.

**Goal.** Answer one question for a judge: could a real company switch this on? Hyphenate is about decision quality;
this video is about the path to production. The customer is named, the pilot starts in shadow, approvals reach the
right person, work-account sign-in is ready (and honestly labelled as tested with a test provider), a bad hour is a
measured number, and each responsible-design claim points at a test or a file.

**Rubric map.**

| Microsoft asks for | Where |
|---|---|
| Customer understanding | Beat 1 (the controller; FBI IC3 figure), beat 2 |
| Measurable usefulness | Beat 7 ($20,000 held; 16 of 17; Impact view) |
| Path to production | Beat 4 (shadow, one-week pilot), beat 5 (routed approval, work-account sign-in), beat 6 (drill) |
| Responsible design | Beat 8 (six principles, protected-attribute test, decline letter) |
| End-to-end function | Beats 1, 5 and 7 (application in, CRS checks, controller's answer, the log, the score) |
| Principle 14: a sourced attack on a financial company | Beat 1 (business email compromise, FBI IC3 2025) |

## Shot list

| # | Time | Picture | On-screen text | Narration | Feature and proof |
|---|---|---|---|---|---|
| 1 | 0:00 to 0:09 | G-MS-1: the Hills; "Business email compromise, 2025" and the figure as two lines, source in small mono | 24,768 complaints. $3,046,598,558 in reported losses. Source: FBI IC3, 2025 Internet Crime Report | "The customer is a small business controller. The FBI logged over three billion dollars in reported losses to business email compromise in 2025." | Principle 14; customer fact in `showcase/src/content/tracks/microsoft.mdx` and `tracks/credit-desk/CUSTOMER.md` (reported complaints only) |
| 2 | 0:09 to 0:18 | G02 (shared): the outdated-OS list, crossed out line by line, only three lines: "agent holds your keys", "approves its own work", "no undo" | Ordinary computer: your keys · its own approvals · no undo | "Pilots stay pilots when an agent holds the owner's keys, approves its own work, and leaves no undo." | The problem (`docs/story.md`, Microsoft) |
| 3 | 0:18 to 0:27 | A31: Business Settings > People: four people with roles and limits, the agent seats; push in on a seat, "runs as box-…" | GurtOS Business · Fogline Supply (made up) · roles and limits · seats with no keys | "On Gurt O.S. Business, people have roles and limits, and each agent seat is its own Linux user." | People and roles (verified Oct 24 03:20); user per seat is the OS |
| 4 | 0:27 to 0:38 | T-MS-01: Settings > People: the Collections clerk in shadow, "5 of 6 agreed (83%)", not ready. Then the clerk's "release order" shown as an ordinary approval for a person; then docs/pilot.md's day list | One-week pilot · Shadow: it suggests, a person decides · 5 of 6 agreed, not ready · Seeded box, scripted seats | "A one-week pilot starts a seat in shadow. It suggests, a person decides, and the box counts agreement. The clerk is at five of six, not ready." | Shadow mode and pilot plan (verified Oct 24 06:10; the box never goes live by itself) |
| 5 | 0:38 to 0:50 | T-HY-02 (shared, second half): the analyst's $40,000 request in Waiting for me as the controller, with the rule sentence and reason. Then T-MS-02: the sign-in test output, "forged token refused", "Dana Reyes, in no mapped group, is refused", labelled Test provider | Over $10,000 goes to the Controller · Work-account sign-in (OpenID Connect, Entra-ready) · Tested with a standards test provider, not a real Entra tenant | "A forty-thousand-dollar credit line goes to the controller by a rule anyone can read. Work-account sign-in uses OpenID Connect for Entra, tested with a standards test provider, not a real tenant." | Routed approvals (verified Oct 24 03:22). Work-account sign-in merged (`core/sso-demo.ts`; provider flows against a real tenant not reached, say so) |
| 6 | 0:50 to 1:00 | A34: Pause all agents with 10 tasks running; the drill result in the log: "every agent frozen: 271 ms"; the bad batch undone: "48 ms" with other tasks keeping their work | Kill switch · 10 agents · frozen within 271 ms · bad batch undone in 48 ms · 3 Droid seats on Claude, 7 scripted | "In the drill, one switch froze ten agents within two hundred seventy-one milliseconds. A bad batch was undone in forty-eight." | Incident drill (`docs/drill.md`, `POST /api/drill`); numbers are the Business thread's live run |
| 7 | 1:00 to 1:10 | G11 (shared): the score card counts up; then T-MS-03a: the Impact view, "bad credit stopped $20,000"; then A33: Audit with Export CSV | Full live run: 16 of 17 planted errors caught · $20,000 fake applicant held · Audit, CSV export | "The desk held a twenty-thousand-dollar fake applicant that a simple rule approves, and caught sixteen of seventeen planted errors." | Impact view (verified Oct 24 05:27, bad credit stopped $20,000 on a quick run); full live run bd5c61; Audit CSV (verified Oct 24 03:24) |
| 8 | 1:10 to 1:20 | T-MS-03b: `fairness.test.ts` passing 4 of 4, RESPONSIBLE.md scrolling past the six principle headings; T-MS-04: the APP-1043 letter, "We need to verify some information"; G08 end card | Seats never see protected details · 6 principles mapped · A plain letter for every adverse decision · Open source, Apache-2.0 | "A test shows seats never see protected details. Each control maps to Microsoft's six Responsible AI principles, and a decline gets a plain letter. Gurt O.S. is open source." | Privacy test (verified Oct 24 05:28, 4 of 4); RESPONSIBLE.md; letters (verified Oct 24 05:27: APP-1043 and C-1013) |

**Cut list if long:** beat 2 (the problem is in beat 1 and 3); beat 4's pilot.md shot; beat 7's Audit shot.

## Narration (exact text for ElevenLabs)

Word count: 185 (about 1:20 at 2.3 words a second; cut beat 2 if the render runs over).

```text
The customer is a small business controller. The FBI logged over three billion dollars in reported losses to business email compromise in 2025.

Pilots stay pilots when an agent holds the owner's keys, approves its own work, and leaves no undo.

On Gurt O.S. Business, people have roles and limits, and each agent seat is its own Linux user.

A one-week pilot starts a seat in shadow. It suggests, a person decides, and the box counts agreement. The clerk is at five of six, not ready.

A forty-thousand-dollar credit line goes to the controller by a rule anyone can read. Work-account sign-in uses OpenID Connect for Entra, tested with a standards test provider, not a real tenant.

In the drill, one switch froze ten agents within two hundred seventy-one milliseconds. A bad batch was undone in forty-eight.

The desk held a twenty-thousand-dollar fake applicant that a simple rule approves, and caught sixteen of seventeen planted errors.

A test shows seats never see protected details. Each control maps to Microsoft's six Responsible AI principles, and a decline gets a plain letter. Gurt O.S. is open source.
```

## Captures this video needs

Shared (see `capture.md`): A31, A33, A34, G02, G08, G11, and the second half of T-HY-02. Its own:

| ID | What | Machine and state | Steps |
|---|---|---|---|
| G-MS-1 | The IC3 card (animation, no capture) | `studio/` | Two lines of type and the source in small mono, same style as G10 |
| T-MS-01 | Shadow mode and the pilot plan | Clip box (Business on, Fogline seed) with the Collections clerk defined as a seat in shadow (`PUT /api/business {seats}`) and 6 suggestions answered, 5 agreeing | Settings > People as the admin; hold on the clerk row "5 of 6 agreed"; open the clerk's "release order" suggestion in Waiting for me as Rosa; then show `docs/pilot.md` rendered (day 0, days 1 to 5, rollback) |
| T-MS-02 | Work-account sign-in, test provider | Any machine with Node 22.18+ (not the clip box) | Run the sign-in demo (`core/sso-demo.ts`), record its output: PKCE and nonce checks, the person in no mapped group refused, forged tokens refused. Put "Test provider, not a real Entra tenant" on screen |
| T-MS-03 | Impact view, then the protected-attribute test | Clip box after a Quick run; the repo checkout for the test | (a) Credit desk window > Impact view, hold on "bad credit stopped $20,000". (b) `node --test tracks/credit-desk/fairness.test.ts`, 4 of 4; then RESPONSIBLE.md scrolled past the six headings |
| T-MS-04 | The adverse-decision letter | Clip box after a Quick run | Open APP-1043's letter in the Credit desk window; hold on "We need to verify some information" (the letter names no check) |
| T-MS-S1 | One app's permissions: Allow, Deny, revoke (slot: only once agent permissions are merged) | Clip box (Business on, Fogline seed) on a build where agent permissions are merged | Open the app's permissions and hold on its manifest; Allow one permission, Deny one, revoke one; then trigger the revoked use and hold on the OS refusing it. Use only the labels the screen shows |
| T-MS-S2 | Flight recorder replay of one drill task (slot: only once the flight recorder is merged) | Same box as A34's drill, after it, on a build where the flight recorder is merged | Open the flight recorder on one task from the drill; step through it, hold on a step with a file and on an approval, then press Keep. Show only what the recorder lists Keep the "3 Droid seats on Claude, 7 scripted" note on screen |

## Check before render

- Sign-in is **not** tested against a real Entra tenant. Narration and the on-screen text both say so; do not drop
  either. Do not show an Entra logo or a Microsoft sign-in page.
- The drill numbers (271 ms, 48 ms, 10 agents, 3 Droid seats and 7 scripted) are the Business thread's live run, not
  the idle-box route QA ran. Keep the "3 Droid seats on Claude, 7 scripted" note on screen.
- The shadow screen is a seeded box with scripted seats, not a real week at a real company. Keep that line on screen.
- "16 of 17" is the full live run's score. Do not state a minutes-per-application figure: the page states none.
- "Decline letter": show APP-1043's letter (checked) and say "adverse decision"; the letters are model letters, not a
  claim of legal compliance.

## Slots: standout features (use only once merged)

These beats stay out of the video until the feature is merged on main and its check passes. When one is ready, record its capture, add its line to `docs/video/slots.json`, generate its narration with `narration/say.py <script> --slots`, and rebuild: later beats move by themselves.

| Slot id | Feature | Goes after beat | Picture (the capture to record) | On-screen text | Narration | Seconds | Rubric it serves | What to cut to stay in length |
|---|---|---|---|---|---|---|---|---|
| `permissions` | Agent permissions | Beat 3 (roles, limits, seats with no keys) | T-MS-S1: Business on the Fogline box, the permissions of one app. Allow one, Deny one, revoke one, then the OS refuses the revoked use | Agent permissions · the OS enforces each app's manifest · Allow · Deny · revoke · Fogline Supply (made up) | The OS also enforces each app's manifest. You can Allow, Deny or revoke, like phone app permissions. | 8.4 | Responsible design; path to production (a company decides what an app may do) | Beat 2 (9 s): drop "Pilots stay pilots when an agent holds the owner's keys, approves its own work, and leaves no undo." and G02. Beats 1 and 3 already carry the problem. This is the script's own first cut |
| `flight-recorder` | The flight recorder | Beat 6 (kill-switch drill, bad batch undone) | T-MS-S2: the flight recorder on one task from the drill. Step through it with its files and approvals, then Keep or Undo | Flight recorder · replay a task step by step · its files and approvals · then Keep or Undo · 3 Droid seats on Claude, 7 scripted | A person can replay a task step by step, with its files and approvals. Then Keep or Undo. | 8.8 | Responsible design and path to production: the morning after a bad batch | Beat 6's last sentence "A bad batch was undone in forty-eight." (about 3 s; the on-screen line keeps 48 ms) beat 7's A33 Audit shot (about 3 s, on the script's cut list), and beat 4's last sentence "The clerk is at five of six, not ready." (about 3 s; the on-screen text keeps "5 of 6 agreed, not ready") |

Length: target 1:20. Every slot in adds about 17.2 s and the cuts above take out about 18 s, so the video runs about 1:19. Cut sizes are estimates from each beat's window; the build's length check has the final say.

### Slot narration

#### permissions

```text
The OS also enforces each app's manifest. You can Allow, Deny or revoke, like phone app permissions.
```

#### flight-recorder

```text
A person can replay a task step by step, with its files and approvals. Then Keep or Undo.
```
