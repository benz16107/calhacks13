# Feature ledger

Every approved feature, who owns it, and how far it got. The QA thread keeps it current until Sunday morning, so
that merging many threads' work drops nothing. Sources: `docs/story.md`, the track READMEs, the showcase and
Devpost text, and Ben's approved list.

**Status.**
- **not pursued**: Ben decided not to enter it; kept so nothing looks lost.
- **planned**: promised, but no code on main or any branch yet.
- **building**: code exists on a branch or in a thread's worktree.
- **merged**: on main and its `./demo` step passes, but QA hasn't tried it by hand.
- **verified**: QA used it by hand on a fresh GurtOS install running main (date and time PT).
- **verified (ISO)**: QA used it on a release ISO with no code added.

**Demo step** names the check in `./demo` (`core/demo.ts` moments, or `tracks/<name>/demo.ts`). "none" means no
automated check yet.

Checked against main `8a4cbf4`, Sat Oct 24 05:30 PT. `./demo` from a clean worktree on that tree: 29 passed, 0 failed, 1 pending.

## Freeze plan

- **Sat Oct 24, 9:00 PM PT:** no new features merge after this, only fixes. Anything still "building" then is cut
  from the release and from the Devpost and showcase text, not half-merged.
- **Overnight:** QA installs the final ISOs fresh and walks every row of this ledger.
- **Sun 6:00 AM PT:** the final release. **Sun 9:00 AM PT:** Devpost closes.
- **GurtOS Business:** merged (276bb32) and verified Oct 24 03:27 on the QA box. No clean cut needed. Open: the P2 below.
  the freeze, QA flags it for a clean cut: no Business rows on the showcase or Devpost, and no Business code on main.

## Summary

| Status | Count |
|---|---|
| verified (ISO) | 3 |
| verified | 54 |
| merged | 93 |
| building | 19 |
| planned | 20 |
| not pursued | 4 |
| **Total** | **193** |

**Collisions** (detail below): none open at 03:27. The three found at 02:25 are resolved and Business is on main. Still
watched: portal/dist rebuilt from merged sources (C-4).

## The four moments

| Feature | Owner | Status | Commit | Demo step | Tracks |
|---|---|---|---|---|---|
| 1. Undo one task, other tasks keep theirs | core, portal | verified Oct 23 23:15 (Time Machine on a phone and a laptop) | b53e1c7 | moment 1: undo one task | all |
| 2. The booby-trapped page: no key to steal, exfil blocked and logged, undo | core, portal | verified Oct 24 00:54 (scripted agent; real Droid at 23:37) | b53e1c7, bb0ccde, d64cb80 | moment 2: the booby-trapped page | Armadin, Anthropic, Factory |
| 3. A pause for your OK on the box screen and phone while other tasks run | core, portal | verified Oct 24 00:09 (two phones, offline phone, 7.5 min wait) | b53e1c7, 3b802b9 | moment 3: a pause for your OK | all |
| 4. Pull the plug: every task resumes after a hard power-off | core, image | verified Oct 23 23:21 (Vultr halt mid-task) | b53e1c7 | moment 4: pull the plug | all |
| One action log, cost per task | core | verified | b53e1c7 | action log: a live stream for Elastic and Jira | Elastic, Jira |

## Platform

| Feature | Owner | Status | Commit | Demo step | Tracks |
|---|---|---|---|---|---|
| Pairing a phone by QR, one-time code, tokens on every call | core, portal | verified Oct 24 00:53 | c6f747e, d64cb80 | pairing and more than one box; security | all |
| An outside caller needs a paired token; folders can't be the box | core | verified Oct 23 23:31 | c6f747e, bb0ccde | security: an outside caller gets nothing | Armadin |
| Vault: write-only API, keys never reach a task | core | verified Oct 23 23:00 | 4f5bfb3 | setup: the wizard, settings, the vault and apps | all |
| Setup wizard (first run) | portal, core | merged; not seen on a fresh ISO yet | 4f5bfb3, 3c47301 | setup: the wizard, settings, the vault and apps | all |
| Settings | portal | merged | 3b802b9 | setup step | all |
| App Center (apps on and off) | portal, core | merged | 4f5bfb3, 3b802b9 | setup step | all |
| One model key (Anthropic or Factory) | core, portal | merged | 0145b4b, 0f5fd1c | setup step | Anthropic, Factory |
| New task and "Ask the box" on the portal and phone | portal | verified Oct 24 00:10 | 3b802b9, d64cb80 | none | Hacker's Choice |
| Outage bar, double-tap guard, "Already approved on" | portal | verified Oct 24 00:29 | 3b802b9 | none | all |
| "Today" is the box's day on every screen | portal | verified Oct 24 00:37 | 465fa7a | none | all |
| Pause all agents (`settings.paused`) | core | merged | 197ebc2 | demo checks both directions | all, Personal |
| Track routes learn who is calling (`x-box-caller`) | core | merged | 737ba97 | security step | all |
| Wrong pairing codes limited to 10 a minute (then 429) | core | verified Oct 24 03:10 (11th and 12th tries got 429) | 80e660b | security step | Armadin |
| A page from another site is never the box's own screen | core | verified Oct 24 03:10 (Origin evil.example and app.gurtos.com get 401 even from loopback) | 0417e8c | security step | Armadin |
| The device list hides push subscriptions | core | verified Oct 24 03:10 (only `push: true/false`) | 7f784ff | none | all |
| A phone's task records the phone as its source | core | verified Oct 24 03:10 (`source: "jira:BOX-1"` from a phone became `phone:qa-script`) | | none | Business, Jira |
| Remote access at `<name>.box.gurtos.com` via the relay | remote access | merged (gate: "remote access and push", relay refuses other names and raw ports) | 6cdeb9a | remote access and push | all |
| app.gurtos.com companion app and hosted portal | portal, remote access | merged (hosted mode 7aae35d, installable d05efd8); multi-machine switcher and per-edition home: building | 7aae35d, d05efd8 | none | all |
| Web Push through the gateway, end-to-end encrypted payloads | remote access, portal | merged (gate: push decrypts only on its phone; gateway forwards ciphertext); phone side in `portal` branch | 6cdeb9a | remote access and push | all |
| Image: install, A/B updates with rollback, firewall, Pacific time | image | verified (ISO) Oct 24 00:02 (build 881318a on Vultr) | fd537ad, 881318a | image/test (not in ./demo) | Vultr |
| Signed release ISOs for four builds on GitHub and the Vultr mirror | release, image | building (`release` branch: notes; repo public bb4cc3e) | bb4cc3e | none | Vultr |
| Docs site gurtos.com | docs | verified Oct 24 01:00 (82+ pages, links, privacy scan) | 212c817 | site `npm run check` | all |
| Showcase calhacks.gurtos.com | submission | verified Oct 24 01:30 | 52fb7f7, 213622e | showcase link checker | all |

## GurtOS Server

| Feature | Owner | Status | Commit | Demo step | Tracks |
|---|---|---|---|---|---|
| Box screen kiosk (full-screen portal, no login) | image, portal | verified (ISO) Oct 24 00:02 | 110070f | image/test | Vultr |
| No human account, no sudo, no sshd on release builds | image | verified (ISO) Oct 23 22:34 | fd537ad | image/test | Armadin |

## GurtOS Personal (its own OS on GNOME)

| Feature | Owner | Status | Commit | Demo step | Tracks |
|---|---|---|---|---|---|
| Agents on copies of the owner's folders, Keep and Undo, Undo Keep | core, personal | merged (owner verified on a fresh Personal ISO) | f2d7af4, 17dedf5 | personal: an agent works on the owner's folder | Moss, Anthropic |
| One task's copy unreadable by other tasks | core | verified Oct 24 00:12 | bb0ccde | security step | Armadin |
| GurtOS theme | personal | merged | b0ab128 | personal/selftest.py | Figma |
| Shell extension and top bar indicator | personal | merged | d451f8d | personal/selftest.py | |
| Quick Settings Agents tile (pause switch) | personal | merged | d451f8d, 197ebc2 | none | |
| Activities search | personal | merged | a3b59e1 | none | Moss |
| Files emblem with Keep and Undo | personal | merged | a3b59e1 | none | |
| GurtOS Settings app (native) | personal | merged | a3b59e1, 1d64435 | none | |
| GDM and Plymouth branding | personal, image | merged (branding hooks) | d451f8d, b0ab128 | none | Figma |
| GurtOS Setup (first boot) | personal | merged | 96ce0cb | none | |
| Approvals as GNOME notifications, Ask an Agent in Files | personal | merged (owner verified) | 65679b2 | personal/demo.ts | |
| Reach this computer from anywhere (Settings) | personal, remote access | merged | 1d64435, 6cdeb9a | remote access and push | |
| Talk to your computer: Super+Alt+Space, answer as a notification and a local voice; voice approves only a request that spends nothing, signed `voice:<user>`; audio deleted after reading | personal | merged (selftest checks the safety rule; speech to text 1.1 s on CPU; QA has not heard it through a real microphone, and the model (about 600 MB) is not in the ISO: `box-voice.service` downloads it at first boot (image branch e19dddf, not on main yet), so check `systemctl status box-voice`, `/opt/box/voice-models/.ready` and `findmnt /opt/box/voice-models` a few minutes after the first boot; with no network the feature stays off) | e78480c | personal/selftest.py | Moss |

## GurtOS Business (preview)

On main since 276bb32. Off on a new box: turn it on with `PUT /api/business {on: true, company}`. The box's own screen
answers nothing until a person is picked from the top bar.

| Feature | Owner | Status | Commit | Demo step | Tracks |
|---|---|---|---|---|---|
| People and roles (owner, admin, approver with a limit, requester, auditor); a person signs in by pairing a phone | business | verified Oct 24 03:20 (four people, pairing codes, `/api/me` per person) | 276bb32 | business edition | Hyphenate, Microsoft, Atlassian |
| Plain-sentence rules that route approvals; a bad line is refused and named | business | verified Oct 24 03:20 | 276bb32 | business edition | Hyphenate, Microsoft |
| Rule tester ("Who would approve this?", GET /api/business/route) | business | verified Oct 24 03:20 (API; the Settings > Rules screen not opened) | 276bb32 | business edition | Hyphenate, Microsoft |
| Routed approvals (rule, who, people who could approve, why) | business | verified Oct 24 03:22 ($12,000 went to the Controller; Rosa saw it, Sam did not) | 276bb32 | business edition | Hyphenate, Microsoft |
| No self-approval; approver limit; only a person answers (agents, tools and an unsigned box screen get 403) | business | verified Oct 24 03:23 (Sam on his own request 403, auditor 403, $60,000 over Rosa's $50,000 limit 403, unsigned box screen 403, a body name ignored) | 276bb32 | business edition | Hyphenate, Armadin |
| Waiting for me (phone and desktop) | business | verified Oct 24 03:27; on first pairing the "Sign in" placeholder is gone and the phone lands on Waiting for me at about 2 s; the ordinary home still shows for about 1.3 s during the reload (P2-21, cosmetic remainder) | 276bb32 | business edition | Hyphenate |
| My requests | business | merged (API `/api/approvals?for=me`; the screen not walked) | 276bb32 | business edition | Hyphenate |
| Audit with CSV export (who asked, approver, seat) | business | verified Oct 24 03:24 (API and CSV as the auditor; a requester gets 403; the Audit app screen not opened) | 276bb32 | business edition | Hyphenate, Microsoft |
| Kill switch: one switch, core's `settings.paused` | business, core | verified Oct 24 03:25 (`/api/pause` and Settings PATCH read and write one state; a running task freezes, a new one queues, release runs it; a requester and an approver get 403) | 276bb32 | business edition, moment 3 | Hyphenate |
| Kill switch on every edition (core `settings.paused`; the owner as backstop; a frozen worker resumes on a fresh broker connection) | business, core | merged (QA verified the freeze and resume Oct 24 04:55; the card and desktop screens not walked) | aa91999, 6c85f6c | business edition | Hyphenate |
| Mana policy proposal hook (`box.policy`, `box.setPolicy`; only an owner or admin approving applies it) | business, mana | merged (not walked by QA) | aa91999, bc717b4 | tracks/mana/demo.ts | Mana, Hyphenate |
| Incident drill (`core/drill.ts`, `docs/drill.md`, `POST /api/drill` for an owner or admin; numbers kept in the log): on the Business thread's live run, 10 agents including 3 live Droid seats, pause returned in 137 ms, every unit frozen within 271 ms, 0 agent events in 10 s paused, the bad batch undone in 48 ms, the first step 48.8 s after resume | business | merged (QA ran the route on an idle box: it answers and writes a `kill-switch` note; the measured numbers are the Business thread's) | 827f144, 0c65072 | business edition ("stop mid-task in 193 ms") | Microsoft |
| Work-account sign-in (Entra and Google were not reached; see its README) | business | merged (partly: provider flows not reached) | 1389b9f | none | Microsoft |
| Shadow mode and a one-week pilot plan: a seat in shadow turns its decisions into ordinary approvals a person decides; a go-live threshold in the policy text; going live is one setting; `docs/pilot.md` | business | verified Oct 24 06:10 (seats defined with `PUT /api/business {seats}`; the Collections clerk's "release order" became an approval routed to any approver; the unsigned box screen was refused; Rosa's no was recorded as a disagreement, 0 percent, not ready; a requester cannot change the setting; the scripted clerk fails on a no, the real agent moves on) | 20dfcd5 | business edition | Microsoft |

## Hyphenate (credit desk)

| Feature | Owner | Status | Commit | Demo step | Tracks |
|---|---|---|---|---|---|
| Credit analyst and collections clerk, CRS and Nessie live, fraud hold for the controller | credit desk | verified Oct 24 00:11 (Quick run on a phone) | 525f630, 7cdd64e | tracks/credit-desk/demo.ts | Hyphenate, CRS, Microsoft |
| Credit desk window | credit desk | verified Oct 24 00:10 | 7cdd64e | credit-desk demo | Hyphenate |
| Score against the answer key | credit desk | verified (2 of 14 with scripted seats, by design) | 525f630 | credit-desk demo | Hyphenate |
| Bring your own case (folder or POST /run) | credit desk | merged (not run by QA: needs real Droid, about $0.50) | 13b0ff5 | none | Hyphenate |
| Reopened decisions: "Quick run January" shows Then (2026-10-23, from the log) beside Now (2027-01-22), 2 returned payments, $37,770 open; the cut to $7,500 waits for Rosa | credit desk | verified Oct 24 05:25 (Quick run January: Then 2026-10-23 from the log beside Now 2027-01-22, 2 returned payments, $37,770 really open; the cut to $7,500 went to the controller) | 13b0ff5 | credit-desk demo | Hyphenate |
| Ask why: APP-1042 returns what the desk knew, the rules, who approved it and when, and "Does it still hold? No" after January | credit desk | verified Oct 24 05:25 (APP-1042 returns the rules, who approved it and when, and what happened later; works by application id, customer id and full name; "Bright Harbor" alone finds nothing) | 13b0ff5 | credit-desk demo | Hyphenate |
| Crash-proof handoff between seats | credit desk, core | merged (proven on a dev box by the credit desk thread; not in the gate; QA did not run it) | 13b0ff5 | none | Hyphenate |
| Beancount books: the clerk's correction "fixes PMT-8812" is in the Books view; undoing the Collections clerk task removes it and leaves the AP payment | credit desk | verified Oct 24 05:20 (the clerk's correction "fixes PMT-8812" is in the books; undoing the Collections clerk removed it and left the AP payment) | 13b0ff5 | books.test.ts | Hyphenate |
| Three seats: Quick run starts the Credit analyst, the Collections clerk and the AP clerk, all finishing after you approve | credit desk | verified Oct 24 05:15 (Quick run started the analyst, the clerk and the AP clerk; all finished after the two fraud referrals and the $40,000 were answered) | 13b0ff5 | credit-desk demo | Hyphenate |
| AP limits in code (Payables view): B-3315 refer as suspected fraud and never paid; B-3311 void as a duplicate; B-3304 paid (Nessie test money); B-3316 waits for a second person | credit desk | verified Oct 24 05:18 (B-3304 paid, B-3311 void, B-3315 refer as suspected fraud and not paid, B-3316 needs the controller) | 13b0ff5 | credit-desk demo | Hyphenate |
| Bring your own: pick a CRS test person (P12), Check it, then "Run it with Droid" (real Droid, about $0.50) | credit desk | building (pending: the credit desk thread sends the commit tonight; the Droid step needs Factory credit) | | none | Hyphenate, CRS |
| Benchmark slice | credit desk | building (worktree bench/; subagent) | | | Hyphenate |
| Deny with a reason: a reason box whose text reaches the seat (scripted seats end on a deny, so QA tests the box) | credit desk | merged (the reason box is in the window; QA did not click it) | 13b0ff5 | credit-desk demo | Hyphenate |
| Letters: APP-1043 says only "We need to verify some information"; APP-1044 lists reasons, bureaus and "within 60 days"; C-1013 in January lists the returned payments | credit desk | verified Oct 24 05:27 (APP-1043 says "We need to verify some information" and names no check; C-1013 in January says the limit is $7,500 and lists the returned payments; APP-1044 not decided by the scripted seats, so not checked) | 13b0ff5 | credit-desk demo | Hyphenate |
| Impact view: minutes per application, bad credit stopped ($20,000 on a quick run), supplier payments stopped ($25,785), model cost per application, by-hand and simple-rule rows | credit desk | verified Oct 24 05:27 (bad credit stopped $20,000 on a quick run; /t/credit-desk/impact answers; the by-hand and simple-rule rows not read) | 13b0ff5 | credit-desk demo | Hyphenate, Microsoft |
| On a Business box, signed in as Rosa on the box's screen, Approve and Deny in the desk window answer as her (`x-box-person`) | credit desk, business | verified Oct 24 05:30 on routing and refusal (fraud referrals reach Rosa with her route sentence; the unsigned box screen is refused with 403); answering as Rosa in the window not clicked | 13b0ff5 | business edition | Hyphenate, Microsoft |
| Privacy: an agent's copy of an application has no SSN, date of birth or guarantor name | credit desk | verified Oct 24 05:28 (node --test fairness.test.ts: 4 of 4) | 13b0ff5 | tracks/credit-desk/fairness.test.ts | Hyphenate, CRS |

**CRS push** (Business edition; branch `crs-push`, not merged; proven by the `track credit-desk` demo step against the CRS
sandbox with test personas; detail in `tracks/credit-desk/CRS.md`). Honestly not built: a payment gate for guests, the
controller's clear-the-flag path (FRR-5), an ASI:One chat intent for credit.

| Feature | Owner | Status | Commit | Demo step | Tracks |
|---|---|---|---|---|---|
| Know your agent: a stranger's agent asks for credit through the guest path (`POST /t/mana/guest {kind:'credit'}`); CRS identity, Fraud Finder and phone owner run before the owner is asked; fraud persona P13 gets a plain-words 403 with no task and no approval; an honest persona reaches the owner with no SSN in the question or the log | credit desk, mana | building (branch `crs-push`; shares Mana's guest path) | | demo-crs.ts on branch | CRS, Hyphenate, Fetch.ai |
| A stated reason for every CRS pull (credit application or account review), with the application or customer; a pull for a decided or stale application asks the controller first; a per-task pull limit | credit desk | building (branch) | | demo-crs.ts on branch | CRS, Microsoft |
| CRS MCP behind the broker (`credit-desk.crs_docs`, `credit-desk.crs_lookup`); login stays in the vault; the clerk can read docs only; SSN and date of birth redacted | credit desk | building (branch) | | demo-crs.ts on branch | CRS |
| Nightly re-check routine at 02:00 (off by default; `/t/credit-desk/recheck`); a score drop sends the limit change to the controller | credit desk | building (branch) | | demo-crs.ts on branch | CRS, Hyphenate |
| Fraud case file (`GET /t/credit-desk/case?application=`, HTML or JSON) and the same facts as task steps in the Business request screen | credit desk, business | building (branch) | | demo-crs.ts on branch | CRS, Hyphenate |
| A fraudster who argues: 9 of 9 attempts to approve or give terms are refused by `credit_decision`; only a fraud hold is recorded, after the controller says yes | credit desk | building (branch) | | demo-crs.ts on branch | CRS, Armadin |

## Visa (Shopper)

| Feature | Owner | Status | Commit | Demo step | Tracks |
|---|---|---|---|---|---|
| Restock and price watcher, buy after your tap, test store with Stripe test mode | Visa | verified Oct 23 23:23, Oct 24 00:13 | b546d34, b842425 | tracks/shopper/demo.ts | Visa |
| Visa Trusted Agent Protocol signature on checkout | Visa | verified (store verified the signature) | b546d34 | shopper demo | Visa |
| Undo refunds the order | Visa, portal | verified Oct 24 00:14 | b842425, 717bc3f | shopper demo | Visa |
| Household reorder from receipts | Visa | merged | b546d34 | shopper demo | Visa |
| Agents buying their own supplies (x402) | Visa, wallet | verified Oct 24 00:11 | b842425 | shopper demo (DEMO_LIVE) | Visa, Coinbase |
| Passkey (Face ID) approvals | Visa | building (track-shopper worktree: passkey.ts) | | passkey.test.ts in worktree | Visa |
| Signed mandates verified via TAP | Visa | building (worktree: mandate.ts) | | | Visa |
| Merchant dashboard | Visa | planned | | | Visa |
| Multi-store comparison | Visa | building (subagent "Second store + comparison") | | | Visa |
| Post-purchase savings and subscription cleanup | Visa | planned | | | Visa |
| Card-style spending rules | Visa | planned | | | Visa |
| VIC and Cybersource adapters | Visa | building (subagent "Payment adapters") | | | Visa |

## Fetch.ai

| Feature | Owner | Status | Commit | Demo step | Tracks |
|---|---|---|---|---|---|
| The box as an ASI:One agent: pairing, tasks, approvals, results, undo in chat | fetch | merged (page verified Oct 24 00:45; chat not paired, needs Ben) | 2b013a3, 5dfd3f7 | tracks/fetch/demo.ts | Fetch.ai |
| Chat limited to its own tasks, fixed tools and budget | fetch | merged | 5dfd3f7 | fetch demo offline check | Fetch.ai, Armadin |
| An agent team on Agentverse | fetch | merged (on main; QA has not walked it) | d7f9fc1 |  | Fetch.ai |
| Safe calls to strangers' agents, a blocked hidden instruction | fetch | merged (on main; QA has not walked it; the stranger's reply is treated as untrusted) | d7f9fc1 |  | Fetch.ai |
| Payment Protocol | fetch | merged (on main; QA has not walked it) | d7f9fc1 |  | Fetch.ai |
| Rich cards | fetch | merged (Interactive Cards for approve and undo; richer cards in d7f9fc1) | 2b013a3, d7f9fc1 | fetch demo | Fetch.ai |
| Reliability shown in chat | fetch | planned | | | Fetch.ai |
| Picking a machine from chat | fetch | planned | | | Fetch.ai |
| Guest requests (one guest path shared with Mana: a gate task for the owner's OK, then a run in the empty guest workspace) | fetch, mana | verified Oct 24 04:25 on the Mana route (Fetch calls the same route; QA has not tried it from ASI:One) | 03bade4, 804e8d0 | tracks/mana/demo.ts | Fetch.ai, Mana |

## Coinbase and Solana (wallet)

| Feature | Owner | Status | Commit | Demo step | Tracks |
|---|---|---|---|---|---|
| x402 payments in devnet USDC, key in the vault, CDP facilitator | wallet | verified Oct 23 23:35, Oct 24 01:00 | 0446d0f, fb51e47 | tracks/wallet/demo.ts (DEMO_LIVE=wallet) | Coinbase, Solana |
| Over-budget pause naming payee and URL; payments page | wallet | verified Oct 24 01:00 | fb51e47 | wallet demo | Coinbase |
| Installable x402 skill | wallet | merged | 0446d0f | none | Coinbase |
| Earning over x402, Bazaar listing | wallet | planned | | | Coinbase |
| Agents shopping for APIs | wallet | planned | | | Coinbase |
| CDP Server Wallets with policies | wallet | planned | | | Coinbase |
| The "upto" scheme | wallet | planned | | | Coinbase |
| One-command reuse (MCP or skill) | wallet | planned (skill exists) | | | Coinbase |
| Onramp top-up | wallet | planned | | | Coinbase |
| Daily Solana log fingerprint | wallet | planned | | | Solana |
| Payment memos | wallet | planned | | | Solana |
| Box-to-box payments | wallet | planned | | | Solana, Coinbase |
| One shared budget and approval layer with Fetch | wallet, fetch | planned | | | Coinbase, Fetch.ai |

## Atlassian (Jira, both tracks)

Owner: the Jira thread. On main as 21dad13, then c2249ad to 7cf9701; deployed to the Vultr box; Forge app redeployed.
Gate: 22 Jira checks against offline stand-ins for Jira, JSM and Confluence. Live checks below are the Jira thread's
(on the real site through Caddy); QA confirmed from outside only that Vultr's public routes still answer correctly
(Oct 24 04:45: `/t/jira/task` 401 without the secret, `/t/mana/status` 200, everything else 404).

| Feature | Owner | Status | Commit | Demo step | Tracks |
|---|---|---|---|---|---|
| Every task a Jira issue, Forge panel with Approve and Roll back, JQL fields | jira | verified Oct 24 00:45 (public routes) and by the Jira thread through the real panel | c24a516, c82fcdb | tracks/jira/demo.ts | Atlassian Track 2 |
| A Rovo agent "GurtOS" with actions (asks what got blocked, rolls back by description after a confirmation, pauses) | jira | merged (live by the Jira thread: "what got blocked", "roll back everything the shopper did today" rolled back BOX-17 and BOX-18; the pause action checked by the gate only) | 21dad13, 7cf9701 | tracks/jira/demo.ts | Atlassian Track 1 and 2 |
| Bulk roll back (Apps > "Roll back with GurtOS" on an issue search; a per-issue report) | jira | merged (live by the Jira thread: BOX-21 and BOX-22) | 21dad13, 7cf9701 | tracks/jira/demo.ts | Atlassian Track 2 |
| Start agents from a Jira assignment, a label (`gurtos-agent`) or an Automation action | jira | merged (live: the label started a Droid task, with the result and diff as comments; the Automation action "Run in GurtOS" is deployed but not exercised live) | 21dad13, 7cf9701 | tracks/jira/demo.ts | Atlassian Track 1 |
| JSM approvals for risky actions (SECOPS ticket; the box logs "approved by jira:<user> via JSM") | jira | merged (live: SECOPS-168 approved in JSM) | 21dad13, 7cf9701 | tracks/jira/demo.ts | Atlassian Track 2 |
| Confluence daily and incident reports (space AGENTS: an incident page per blocked attempt, "What our agents did, <date>") | jira | merged (live by the Jira thread) | 21dad13, 7cf9701 | tracks/jira/demo.ts | Atlassian Track 1 and 2 |
| Jira dashboard gadget ("GurtOS agents") | jira | merged (live: dashboard 10100) | 21dad13, 7cf9701 | tracks/jira/demo.ts | Atlassian Track 2 |
| Jira-to-GurtOS people mapping in Business (accountId to a person, acting through `x-box-person`) | jira, business | merged (the gate checks it against offline Jira stand-ins: an unlinked user 403, a requester 403, $60,000 over a $50,000 limit 403, an approver counts as her, the starter can't approve their own task; no live run, the real Jira site has no accounts for these people) | b380c61 | tracks/jira/demo.ts | Atlassian, Hyphenate |

## Armadin (Best Security Hack)

Owner: the Armadin thread. Merged to main as af40b1c (the `fake.ts` line is in; the Armadin thread's full `./demo` on the merged commit: 30 passed, 0
failed, 1 pending). QA has not walked these by hand.

| Feature | Owner | Status | Commit | Demo step | Tracks |
|---|---|---|---|---|---|
| The poisoned package: a harmless imitation of the Shai-Hulud npm worm run by a real `npm install` in a task; its postinstall's 10 attempts (env, dotfiles, vault, cloud metadata, exfil, raw connect, publish, other tasks' files, persistence) are blocked or contained; undo removes it; no canary secret in the log | armadin | merged (af40b1c) | af40b1c | tracks/armadin/demo.ts | Armadin |
| Attack scoreboard: 15 OS-level attacks, 13 caught, 2 published as not covered (no per-task disk quota; an allowed host's payload isn't inspected, reported to core) | armadin | merged (af40b1c) | af40b1c | tracks/armadin/demo.ts | Armadin |
| Hijacked payment: a lookalike-sender bank-change invoice refused in code (AP-4) before anyone is asked; a second over-limit bill pauses for the controller, who says no | armadin, credit desk | merged (af40b1c) | af40b1c | tracks/armadin/demo.ts | Armadin, Hyphenate |
| OWASP mapping (LLM Top 10 2025 and Agentic Top 10 2026, with a not-covered column) | armadin | merged (af40b1c) | af40b1c | none | Armadin |

## Mana

Owner: the Mana thread.

| Feature | Owner | Status | Commit | Demo step | Tracks |
|---|---|---|---|---|---|
| Rules planning chat, project page, the GurtOS status app | mana | verified Oct 23 23:37 (app live, signed out) | 525f630, 4631f73 | tracks/mana/demo.ts | Mana, Hyphenate |
| Mana: guest requests (one path with Fetch): a gate task for the owner's OK, then a run in the empty `guest` workspace; deny by default, 3 per guest and 10 an hour, 30-minute expiry | mana, fetch | verified Oct 24 04:25 (one approval, no second question; no network; refusals; Deny; public status hides the words). 804e8d0 (owner's wording, price steered to checkPrice) not yet verified | 03bade4, 804e8d0 | tracks/mana/demo.ts | Mana, Fetch.ai |
| Mana: rules from a Mana chat sync into Business policy (`POST/GET /t/mana/policy`; only an owner or admin approving applies it) | mana, business | merged (not walked by QA yet) | bc717b4 | tracks/mana/demo.ts | Mana, Hyphenate |
| Mana: four planning chats (credit, Business, Visa, Fetch) | mana | building | | none | Mana, Visa, Fetch.ai |
| Mana: GurtOS guide agent | mana | building (lands within the hour of 04:35 PT) | | none | Mana |
| Mana: public home page | mana | building (lands within the hour of 04:35 PT) | | none | Mana |

## Apify (GurtOS Personal and Server)

Owner: the Apify thread. All six merged as 60f5184 (default `./demo` 26 passed; `DEMO_LIVE=apify ./demo` for the live steps).

| Feature | Owner | Status | Commit | Demo step | Tracks |
|---|---|---|---|---|---|
| Run any Actor, Best Buy price check, places, through the broker with no token in the task; default cap now $0.10 | apify | verified Oct 23 23:40 (live Best Buy price) | 97694e0, 60f5184 | tracks/apify/demo.ts | Apify |
| Our own Actor "Agent-Safe Page Reader" (trap page: risk 100, withheld; example.com: none), build 1.0.2 in Ben's account | apify | merged; **not public**: Ben must switch the account's public profile on in the Apify Console (Settings, Account), then one curl in tracks/apify/README.md "Publishing the Actor" | 60f5184 | DEMO_LIVE=apify | Apify |
| Apify's MCP server as the agents' web toolkit, through the broker (`apify.mcp`) | apify | merged (live) | 60f5184 | apify demo | Apify |
| An Apify schedule or webhook starts a GurtOS task (`apify.watch`, `POST /t/apify/watch`) | apify | merged (set-up and teardown live; delivery tested only with Apify's payload shape: needs the box reachable and APIFY_WEBHOOK_URL and APIFY_WEBHOOK_SECRET in the vault) | 60f5184 | apify demo | Apify |
| The Website Content Crawler feeds /find (`apify.indexSite`) | apify, find | merged (live: file written; the /find answer step is in DEMO_LIVE=apify) | 60f5184 | DEMO_LIVE=apify | Apify, Moss |
| A web source for the credit desk (`apify.webSource`, finds disagreements) | apify, credit desk | merged; the credit desk must add the tool to its analyst's list | 60f5184 | apify demo | Apify, Hyphenate |
| Apify run cost in task budgets; approvals say "to Apify (run X)"; an "Apify spend" app lists counted cents and Apify's usage per task | apify, core, portal | merged | 60f5184 | apify demo | Apify |

## Anthropic (GurtOS Personal and Server)

Owner: the Anthropic thread (`anthropic-push`). The GurtOS MCP server and Claude Code as a second worker are the core thread's rows. Numbers and every miss: `tracks/anthropic/README.md`. All four merged as cf4ad03 (default `./demo` 30 passed; `./demo --live-droid` 31 passed before the last rebase). QA has not tried these by hand.

| Feature | Owner | Status | Commit | Demo step | Tracks |
|---|---|---|---|---|---|
| Current Claude models chosen per task (`model`: haiku, sonnet, opus; default `claude-sonnet-5-5`), at Anthropic's list rates; the task window shows the model | anthropic, core, portal | merged | cf4ad03 | tracks/anthropic/demo.ts (a bad model is refused; live: one task per model, `DEMO_LIVE=droid,anthropic-models`) | Anthropic |
| Claude as a second pair of eyes: a Haiku 5.5 check before a risky step; an off-goal verdict becomes an approval and is logged | anthropic, core | merged | cf4ad03 | `core/workers/review.test.ts`; live in the attack run; `core/workers/review.eval.ts` | Anthropic |
| A measured attack test: 12 attacks and 2 controls against real Claude tasks, 0 harm in 48 runs, mostly because Claude did not try; every limit published | anthropic | merged | cf4ad03 | `DEMO_LIVE=droid,anthropic ./demo` (about 6 min, 35 cents) | Anthropic |
| The old-computer proof and a one-line install: measured on 1 vCPU with 1 GB (works, one or two tasks) and 512 MB (installs, a task is killed); Vultr had no credit, so QEMU stood in | anthropic | merged | cf4ad03 | `tracks/anthropic/install.sh` (run on a fresh 1 GB VM, 76 s) | Anthropic |

## Other tracks, as they exist

| Feature | Owner | Status | Commit | Demo step | Tracks |
|---|---|---|---|---|---|
| Elastic: log in Serverless, GurtOS log agent | elastic | verified Oct 24 00:48 (index and agent via API) | 70f3673, ca03219 | tracks/elastic/demo.ts | Elastic |
| /find: search page, photos described on request, Moss local index | find | verified Oct 24 00:33 (search on a phone) | a0d6dbd, 4351905 | tracks/find/demo.ts | Moss |


**Moss push** (memory for agents; on main as 932ec53 with core's two hooks, `Track.taskContext` and `Ctx.ask`, after core's five fixes; the Find thread's gate 30 of 30 on the laptop VM; QA is checking the guest and poisoning cases).

| Feature | Owner | Status | Commit | Demo step | Tracks |
|---|---|---|---|---|---|
| Agents are handed relevant memory before a task starts (a step "Handed over N memory blocks") | find, core | merged (932ec53) | 932ec53 | tracks/find/demo.ts | Moss |
| Each agent sees only what its permissions allow (a note goes only to a task whose workspace, tools and hosts cover it) | find | merged (932ec53) | 932ec53 | find.test.ts | Moss, Armadin |
| A planted instruction cannot become a lasting memory (the owner is asked, naming the page; a no is logged and never stored) | find, core | merged (932ec53) | 932ec53 | tracks/find/demo.ts | Moss, Armadin |
| A task that reached the web is untrusted: its note carries a red badge and no agent is handed it | find | merged (932ec53) | 932ec53 | tracks/find/demo.ts | Moss, Armadin |
| A stranger's task gets no memory and leaves none | find | merged (932ec53) | 932ec53 | find.test.ts | Moss, Fetch.ai |
| One preference works across apps | find | merged (932ec53) | 932ec53 | tracks/find/demo.ts | Moss |
| Forget removes it from the index and the Moss cloud copy, logged without the content (the cloud half untested: the Moss cloud is over its limit) | find | merged (932ec53) | 932ec53 | tracks/find/demo.ts | Moss |
| Photos stay home unless the owner opts in (no model runs without its key) | find | merged (the Find page's privacy line; the docs guide and the showcase still say Claude is an automatic backup, which is wrong) | 4351905 | tracks/find/demo.ts | Moss |
| A small local vision model on CPU (qwen3-vl 2b: 22 to 37 s warm, minutes for a new photo) | find | merged (measured by the Find thread; README on main) | | none | Moss |


**Elastic push** (on main: the track as 2762cce, the core change as 26e914b; deployed to the three installed boxes; gate
29 passed offline and the live `DEMO_LIVE=elastic` run passed every Elastic check; QA has not tried them by hand).

| Feature | Owner | Status | Commit | Demo step | Tracks |
|---|---|---|---|---|---|
| A log that can't be rewritten: each entry carries the SHA-256 of the one before; Elastic keeps a create-only copy; an edited, missing or reordered entry is named | core, elastic | merged | 26e914b, 2762cce | core/log.test.ts; tracks/elastic/demo.ts | Elastic, Armadin, Microsoft |
| `box.verify_log` and `GET /t/elastic/verify` | elastic | merged | 2762cce | tracks/elastic/demo.ts | Elastic |
| Alert rules on attacks (secret theft, a page that sent a task elsewhere, a spending spike, a new destination), arriving as one approval on the owner's phone | elastic | merged | 2762cce | tracks/elastic/demo.ts (live) | Elastic, Armadin |
| The agent can ask (`box.request_undo`): the box asks its owner and acts only if they approve | elastic | merged | 2762cce | tracks/elastic/demo.ts (live) | Elastic |
| A fleet view and who-approved-what: all three installed boxes ship; per-person Elastic keys copy the Business roles | elastic | merged | 2762cce | tracks/elastic/demo.ts (live) | Elastic, Microsoft |
| Search by meaning (`box.search_meaning`, semantic_text) | elastic | merged | 2762cce | tracks/elastic/demo.ts (live) | Elastic |
| Ask GurtOS (portal and phone app) and a Kibana dashboard | elastic | merged (the Ask page itself is not in the gate) | 2762cce | tracks/elastic/demo.ts covers the agent and keys | Elastic |

## Figma

Owner: the Figma thread. `docs/figma-products.md` is not on main yet; its items get added when it lands.

| Feature | Owner | Status | Commit | Demo step | Tracks |
|---|---|---|---|---|---|
| Design system and screens, Make prototype, Slides deck, stage log | figma | merged (stage log totals checked Oct 24 01:20) | many | none | Figma |
| Code Connect (Figma components mapped to portal code) | figma, portal | planned | | | Figma |
| Token sync with a drift check | figma, portal | planned | | | Figma |
| A Community playbook | figma | planned | | | Figma |
| App-vs-Figma comparisons (the built screen next to its frame) | figma, portal | planned | | | Figma |
| A Figma Sites landing page | figma | planned (named on the showcase's Figma page) | | | Figma, GoDaddy |

## Vultr

Owner: the Vultr thread, branch `vultr-godaddy-push` (merging after a full `./demo`). Live results are the Vultr thread's
(Oct 24, all test resources destroyed, under $0.20). **The Vultr account still has $0 credit** (raised Oct 24 04:00 PT);
QA cannot create instances.

| Feature | Owner | Status | Commit | Demo step | Tracks |
|---|---|---|---|---|---|
| Boot the real GurtOS disc on Vultr from a script (`tracks/vultr/up.ts`): release ISO 20261024-0644-881318a on vc2-1c-1gb; installed in about 5 minutes; came back from its own disk after the disc was detached; the first-boot wizard shows | vultr | building (branch; proven live by the Vultr thread; QA also installed the disc by hand twice, Oct 23 22:29 and Oct 24 00:02) | | tracks/vultr on branch | Vultr |
| Encrypted backup to Object Storage (age; the owner holds the key) and a restore onto a fresh Vultr box in 2.8 s: a finished task stayed done, a waiting task came back waiting and finished after an OK | vultr | building (branch; proven live; the image has no `age` binary yet, it was added by hand, and the release disc has no shell) | | tracks/vultr on branch | Vultr |
| Vultr firewall managed from the box: a group attached to a live instance blocked ssh from a wrong address and allowed the right one (a rule can take up to about 3 minutes to apply) | vultr | building (branch; the box's own `PUT /t/vultr/firewall` route only tested against stubs) | | tracks/vultr on branch | Vultr |
| Vultr Serverless Inference as a hosted model for /find | vultr, find | not pursued (needs a paid subscription; Ben's call, Oct 24) | | | Vultr, Moss |
| gurtos.co short pairing links (the code stays in the URL fragment) | vultr | not pursued (Ben is not entering the MLH GoDaddy prize, Oct 24; the redirect code was removed from the branch) | | | GoDaddy |
| Domain story text for the showcase | vultr, submission | not pursued as a prize entry (GoDaddy); the showcase page for it should go (submission thread) | | none | GoDaddy |
| Capital One (Nessie) prize track | credit desk | not pursued (Ben is not entering it, Oct 24); Nessie stays as the credit desk's bank, and its rows are checked with the credit desk | | | Nessie |


## Factory (Droid SDK)

Owner: the Factory thread. All seven on main as da08615 (gate 28 of 28, 1 pending; a live `DEMO_LIVE=droid,github` run on
the Vultr test box passed every Factory check). QA has not walked them by hand yet.

| Feature | Owner | Status | Commit | Demo step | Tracks |
|---|---|---|---|---|---|
| Droid as the worker in every task with Claude, scheduled, webhook and file triggers, plan and diff visible | core, factory | verified Oct 24 00:10 (real Droid started from a phone; moment 2 with real Droid at 23:37) | b53e1c7 | moment 1 with Droid (live) | Factory |
| Plan first, then approve: Droid's spec-mode plan becomes an approval; work starts only after Approve, Deny fails the task with nothing changed | factory, core | merged | da08615 | "Droid planned first in spec mode, and the plan became an approval" (live) | Factory |
| A team of custom droids: coder, reviewer (read-only), credit-analyst, shopper in tracks/factory/droids; the reviewer checks the coder's diff before Keep or the PR | factory | merged | da08615 | "the coder droid made the change and the reviewer droid checked it" (live); "the reviewer can only read" | Factory |
| Autonomy levels the OS enforces (`TaskSpec.droid.autonomy`): low = no network and every spend asks; medium = budget at most $1; Droid's permission requests become approvals | core, factory | merged | da08615 | "low autonomy: ..." and "medium autonomy: ..." | Factory |
| Droid hooks report to GurtOS: PostToolUse logs each tool result; PreToolUse pauses risky commands (rm -rf, git push, sudo, npm publish, curl or sh) for an OK | core | merged | da08615 | "Droid's hooks logged each tool call's result" (live); core/hook.test.ts | Factory |
| Droid on GitHub: the box watches `FACTORY_GITHUB_REPO` for issues labelled droid; each becomes a plan-first task on its own clone; `factory.openPullRequest` pushes with the vault's `GITHUB_TOKEN`, never in the task | factory | merged (a real PR exists; not set up on the QA box: no GITHUB_TOKEN in its vault) | da08615 | "Droid opened a pull request through the vault's token" (DEMO_LIVE=droid,github) | Factory |
| `gurtos-exec`: a safe runner for `droid exec`; submit a job to a box, get back steps, the diff, the cost and credits (text or `-o json`) | factory | merged | da08615 | "gurtos-exec ran a job on the box and got back its diff and cost" | Factory |
| Factory usage in the portal: per-task Factory credits, and the plan's 5-hour and weekly use through the vault key, which is never shown | factory, core | merged | da08615 | "usage reads Factory's limits without showing the key" | Factory |

## SpacetimeDB

Owner: the Spacetime thread. Merged as ed88206. `portal/dist` matches its sources after the merge (QA checked the source hash, 07:40 PT). QA has not tried the features by hand.

| Feature | Owner | Status | Commit | Demo step | Tracks |
|---|---|---|---|---|---|
| SpacetimeDB holds live task status and approvals; a paired phone answers through the vouched reducer | core | verified Oct 24 00:09 (two phones, the reducer refusing anonymous calls) | 6879fb9 | moment 3; security | SpacetimeDB |
| Shared work queue with atomic claims (`spacetime.claim`, `finish`, `post`, `team`): 15 claims by 3 agents on 12 jobs, none twice; 30 simultaneous claims on 10 jobs; jobs return when a task ends holding them | spacetime | merged (ed88206) | ed88206 | tracks/spacetime/demo.ts | SpacetimeDB |
| Live agent presence and status (agent table, the Live window's Agents view) | spacetime | merged (ed88206) | ed88206 | tracks/spacetime/demo.ts | SpacetimeDB |
| Each person is sent only their own requests (Business `my_requests` view, private tables) | spacetime, business | merged (ed88206) | ed88206 | tracks/spacetime/demo.ts | SpacetimeDB, Hyphenate |
| No double approvals: the first answer wins in the reducer, the late one gets "already approved by X" | spacetime, core | merged (ed88206) | ed88206 | tracks/spacetime/demo.ts | SpacetimeDB |
| "X is viewing" presence on a request (clears when the connection drops) | spacetime | merged (ed88206) | ed88206 | tracks/spacetime/demo.ts | SpacetimeDB |
| A reminder timer in the database ("brings Priya in after N seconds"); the Business policy line that sets the delay is not on main | spacetime, business | merged (ed88206; module and demo only) | ed88206 | tracks/spacetime/demo.ts | SpacetimeDB |
| Live meters (`meter`, `activity`) matching the box's task list | spacetime | merged (ed88206) | ed88206 | tracks/spacetime/demo.ts | SpacetimeDB |
| Paired devices reach SpacetimeDB at `/stdb/<token>/` (identity and subscription only; wrong token 401; SQL 404) | spacetime, core | merged (ed88206; touches the token gate, so QA tests it) | ed88206 | tracks/spacetime/demo.ts | SpacetimeDB, Armadin |
| Live window `/t/spacetime/` | spacetime | merged (ed88206) | ed88206 | tracks/spacetime/demo.ts | SpacetimeDB |
| Maincloud fleet view (opt-in, counts only, per-viewer visibility) | spacetime | merged (module and offline demo; the live check waits on Ben signing in to SpacetimeDB once: `DEMO_LIVE=spacetime ./demo`) | | DEMO_LIVE=spacetime | SpacetimeDB |

## Not pursued

- **MLH GoDaddy Registry prize and Vultr Serverless Inference** (Oct 24). Their rows are in the Vultr section, marked "not pursued".
- **Capital One (Nessie) prize track.** Ben is not entering it (Oct 24). No ledger row was only for it. Nessie stays as
  the credit desk's bank (payments, bills, AP payments in test money), so its rows are checked as part of the credit
  desk. The showcase still has a Nessie page and `docs/tracks.md` still lists the track; both are for the owners of
  those files to update.

## Gate stability

At 06:53 ET (03:53 PT) the shared test VM's load average was 31 and the host's 52, with several `tsc` runs, dev boxes
and a `./demo` at once. Moments then fail on timeouts, not on code. Until core adds a lock to `./demo`, run one gate
at a time and only when the load is under 8. QA's fresh-install passes run on separate Vultr VMs, not the shared one.

## Gate on main

| When (PT) | Main | Result |
|---|---|---|
| Sat 00:27 | c359ed6 | 25 passed, 0 failed, 1 pending |
| Sat 03:12 | 276bb32 (Business) | 26 passed, 0 failed, 1 pending |
| Sat 04:20 | 984f4b1 | 21 passed, 5 failed: QA changed its checkout during the run (a missing wallet file), not main |
| Sat 04:40 | 3799b74, clean worktree, load about 9 | 26 passed, 1 failed, 1 pending. The failure is Fetch's "restarted, the chat agent picked up where it was". Sent to the Fetch thread |
| Sat 05:00 | 8a4cbf4, clean worktree (after a symlink of mine broke the first start) | **29 passed, 0 failed, 1 pending**. Fetch's wait fix (5f099f1) works |
| Sat 06:40 | d7f9fc1 (Fetch agent team) | 29 passed, 0 failed, 1 pending |
| Sat 07:10 | 4b075fa (Anthropic, Armadin, Elastic merged) | **31 passed, 0 failed, 1 pending** |


## Collisions

Found by trial merges and by comparing what each branch edits. Each is sent to every owner involved.

| # | What | Threads | Found | State |
|---|---|---|---|---|
| C-1 | Two "stop every agent" switches: core's `settings.paused` (main 197ebc2, used by Personal's Quick Settings tile) and Business's `paused.json` with `POST /api/pause` (`business` branch). Merged as is, they hold different states. | core, business, personal | Oct 24 02:25 | Resolved and verified Oct 24 03:25 on 276bb32: one state, both entry points |
| C-2 | `business` (forked at 89f59d3) conflicts with main in core/box.ts, portal/src/shell.tsx, shell.css, dev-box.sh and the built portal/dist | business, portal, core | Oct 24 02:25 | Resolved: Business merged as 276bb32; gate 26 passed, 0 failed |
| C-3 | core/box.ts edited at once by core (uncommitted in the main checkout), `business` and `remote-access`. Business and remote access both add fields to `interface Device` at the same lines | core, business, remote access | Oct 24 02:25 | Resolved: remote access (6cdeb9a) and Business (276bb32) are both on main; both gate sections pass |
| C-5 | `spacetime` after `find-memory`: a trial merge conflicts in portal/dist/source.txt (the built bundle) | spacetime, find, portal | Oct 24 06:20 | Resolved: both merged (932ec53, ed88206); the bundle's source hash matches its sources at 07:40 |
| C-4 | portal/dist is a built file that both `business` and `portal` commit. A merge can keep one side's bundle and silently drop the other's screens | business, portal | Oct 24 02:25 | Watch: after 276bb32 the QA box serves the Business phone home and the Server home from one bundle; QA checks dist/source.txt after each merge |

## Fresh-install checks

| When (PT) | Build | What was checked |
|---|---|---|
| Oct 23 22:29 to 22:38 | release ISO 21:34 build | install, first boot, power cut, every app |
| Oct 23 22:55 to Oct 24 01:30 | debug ISO 22:16 build, then main on top after each merge | the four moments, security, phones, every app |
| Oct 24 00:02 | release ISO 20261024-0644-881318a | install, GurtOS screen, Pacific time, firewall |
| next | the signed release ISOs | planned twice more before Sun 8:00 AM |
