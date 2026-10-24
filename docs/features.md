# Feature ledger

Every approved feature, who owns it, and how far it got. The QA thread keeps it current until Sunday morning, so
that merging many threads' work drops nothing. Sources: `docs/story.md`, the track READMEs, the showcase and
Devpost text, and Ben's approved list.

**Status.**
- **planned**: promised, but no code on main or any branch yet.
- **building**: code exists on a branch or in a thread's worktree.
- **merged**: on main and its `./demo` step passes, but QA hasn't tried it by hand.
- **verified**: QA used it by hand on a fresh GurtOS install running main (date and time PT).
- **verified (ISO)**: QA used it on a release ISO with no code added.

**Demo step** names the check in `./demo` (`core/demo.ts` moments, or `tracks/<name>/demo.ts`). "none" means no
automated check yet.

Checked against main `60f5184`, Sat Oct 24 04:20 PT. `./demo` on that tree: 26 passed, 0 failed, 1 pending (real Droid, off by default).

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
| verified | 39 |
| merged | 37 |
| building | 28 |
| planned | 34 |
| **Total** | **141** |

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
| Waiting for me (phone and desktop) | business | verified Oct 24 03:27 (Business phone home with Waiting, Tasks, Audit, Settings; see P2 below) | 276bb32 | business edition | Hyphenate |
| My requests | business | merged (API `/api/approvals?for=me`; the screen not walked) | 276bb32 | business edition | Hyphenate |
| Audit with CSV export (who asked, approver, seat) | business | verified Oct 24 03:24 (API and CSV as the auditor; a requester gets 403; the Audit app screen not opened) | 276bb32 | business edition | Hyphenate, Microsoft |
| Kill switch: one switch, core's `settings.paused` | business, core | verified Oct 24 03:25 (`/api/pause` and Settings PATCH read and write one state; a running task freezes, a new one queues, release runs it; a requester and an approver get 403) | 276bb32 | business edition, moment 3 | Hyphenate |
| Kill switch card and the paused desktop for every edition | business, portal | planned | | | Hyphenate |
| Mana policy proposal hook | business, mana | planned | | | Mana, Hyphenate |
| Microsoft items: shadow mode and a pilot plan, Entra ID sign-in, a measured incident drill | business | planned | | | Microsoft |
| Jira-to-GurtOS people mapping | jira, business | planned | | | Atlassian, Hyphenate |

## Hyphenate (credit desk)

| Feature | Owner | Status | Commit | Demo step | Tracks |
|---|---|---|---|---|---|
| Credit analyst and collections clerk, CRS and Nessie live, fraud hold for the controller | credit desk | verified Oct 24 00:11 (Quick run on a phone) | 525f630, 7cdd64e | tracks/credit-desk/demo.ts | Hyphenate, CRS, Microsoft |
| Credit desk window | credit desk | verified Oct 24 00:10 | 7cdd64e | credit-desk demo | Hyphenate |
| Score against the answer key | credit desk | verified (2 of 14 with scripted seats, by design) | 525f630 | credit-desk demo | Hyphenate |
| Bring your own case (folder or POST /run) | credit desk | merged | 7cdd64e | none | Hyphenate |
| Reopened decisions: "Quick run January" shows Then (2026-10-23, from the log) beside Now (2027-01-22), 2 returned payments, $37,770 open; the cut to $7,500 waits for Rosa | credit desk | building (pending: the credit desk thread sends the commit tonight) | | credit-desk demo | Hyphenate |
| Ask why: APP-1042 returns what the desk knew, the rules, who approved it and when, and "Does it still hold? No" after January | credit desk | building (pending: the credit desk thread sends the commit tonight) | | credit-desk demo | Hyphenate |
| Crash-proof handoff between seats | credit desk, core | building (proven on a dev box, runs/2026-10-24-crash-handoff-853015; not in the gate until core adds a restart to DemoKit) | | none | Hyphenate |
| Beancount books: the clerk's correction "fixes PMT-8812" is in the Books view; undoing the Collections clerk task removes it and leaves the AP payment | credit desk | building (`credit-desk-data` 9c20d6c, books.test.ts; Books view pending: the credit desk thread sends the commit tonight) | 9c20d6c | books.test.ts | Hyphenate |
| Three seats: Quick run starts the Credit analyst, the Collections clerk and the AP clerk, all finishing after you approve | credit desk | building (pending: the credit desk thread sends the commit tonight) | | credit-desk demo | Hyphenate |
| AP limits in code (Payables view): B-3315 refer as suspected fraud and never paid; B-3311 void as a duplicate; B-3304 paid (Nessie test money); B-3316 waits for a second person | credit desk | building (pending: the credit desk thread sends the commit tonight) | | credit-desk demo | Hyphenate |
| Bring your own: pick a CRS test person (P12), Check it, then "Run it with Droid" (real Droid, about $0.50) | credit desk | building (pending: the credit desk thread sends the commit tonight; the Droid step needs Factory credit) | | none | Hyphenate, CRS |
| Benchmark slice | credit desk | building (worktree bench/; subagent) | | | Hyphenate |
| Deny with a reason: a reason box whose text reaches the seat (scripted seats end on a deny, so QA tests the box) | credit desk | building (pending: the credit desk thread sends the commit tonight) | | credit-desk demo | Hyphenate |
| Letters: APP-1043 says only "We need to verify some information"; APP-1044 lists reasons, bureaus and "within 60 days"; C-1013 in January lists the returned payments | credit desk | building (pending: the credit desk thread sends the commit tonight) | | credit-desk demo | Hyphenate |
| Impact view: minutes per application, bad credit stopped ($20,000 on a quick run), supplier payments stopped ($25,785), model cost per application, by-hand and simple-rule rows | credit desk | building (pending: the credit desk thread sends the commit tonight) | | credit-desk demo | Hyphenate, Microsoft |
| On a Business box, signed in as Rosa on the box's screen, Approve and Deny in the desk window answer as her (`x-box-person`) | credit desk, business | building (pending: the credit desk thread sends the commit tonight) | | business edition | Hyphenate, Microsoft |
| Privacy: an agent's copy of an application has no SSN, date of birth or guarantor name | credit desk | building (pending: the credit desk thread sends the commit tonight; fairness.test.ts) | | fairness.test.ts | Hyphenate, CRS |

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
| An agent team on Agentverse | fetch | planned (subagent researching) | | | Fetch.ai |
| Safe calls to strangers' agents, a blocked hidden instruction | fetch | planned | | | Fetch.ai |
| Payment Protocol | fetch | building (worktree pay.py, testnet FET subagent) | | | Fetch.ai |
| Rich cards | fetch | merged (Interactive Cards for approve and undo) | 2b013a3 | fetch demo | Fetch.ai |
| Reliability shown in chat | fetch | planned | | | Fetch.ai |
| Picking a machine from chat | fetch | planned | | | Fetch.ai |
| Guest requests (one guest path shared with Mana) | fetch, mana | planned (showcase says "not built") | | | Fetch.ai, Mana |

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

Owner: the Jira thread.

| Feature | Owner | Status | Commit | Demo step | Tracks |
|---|---|---|---|---|---|
| Every task a Jira issue, Forge panel with Approve and Roll back, JQL fields | jira | merged (QA checked the public routes Oct 24 00:45; panel tested by the Jira thread) | c24a516, c82fcdb | tracks/jira/demo.ts | Atlassian Track 2 |
| A Rovo agent with actions | jira | building (uncommitted in the Jira worktree, forge and track.ts) | | | Atlassian Track 1 and 2 |
| Bulk roll back | jira | building (uncommitted in the Jira worktree) | | | Atlassian Track 2 |
| Start agents from a Jira assignment or an Automation action | jira | building (uncommitted in the Jira worktree) | | | Atlassian Track 1 |
| JSM approvals for risky actions | jira | planned | | | Atlassian Track 2 |
| Confluence daily and incident reports | jira | building (uncommitted: confluence.ts, confluence.test.ts) | | confluence.test.ts in worktree | Atlassian Track 1 and 2 |
| Jira dashboard gadget | jira | building (uncommitted in the Jira worktree) | | | Atlassian Track 2 |

## Mana

Owner: the Mana thread.

| Feature | Owner | Status | Commit | Demo step | Tracks |
|---|---|---|---|---|---|
| Rules planning chat, project page, the GurtOS status app | mana | verified Oct 23 23:37 (app live, signed out) | 525f630, 4631f73 | tracks/mana/demo.ts | Mana, Hyphenate |
| Guest requests to GurtOS from inside the Mana app, with the owner's approval (same guest path as Fetch's) | mana, fetch | planned | | | Mana, Fetch.ai |
| Mana-drafted Business rules synced into the box's policy | mana, business | planned (Business policy is on main; Mana's proposal hook not built) | | | Mana, Hyphenate |
| Public Mana planning chats for Visa mandates and the Fetch agent team | mana | planned | | | Mana, Visa, Fetch.ai |
| A GurtOS guide agent in Mana | mana | planned | | | Mana |
| A public Mana home page for the entry | mana | planned | | | Mana |

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

## Other tracks, as they exist

| Feature | Owner | Status | Commit | Demo step | Tracks |
|---|---|---|---|---|---|
| Elastic: log in Serverless, GurtOS log agent | elastic | verified Oct 24 00:48 (index and agent via API) | 70f3673, ca03219 | tracks/elastic/demo.ts | Elastic |
| /find: search page, photos described on request, Moss local index | find | verified Oct 24 00:33 (search on a phone) | a0d6dbd, 4351905 | tracks/find/demo.ts | Moss |

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

## Vultr and GoDaddy

Owner: the Vultr/GoDaddy thread, branch `vultr-godaddy-push` (not merged at 04:00 PT). **The Vultr account has $0 credit
and refuses new instances** ("does not have any additional credit"), and holds its two-ISO maximum. That blocks the
live runs below; it also blocks QA's overnight fresh installs on new instances, so QA reinstalls the existing debug
instance through the disc menu instead.

| Feature | Owner | Status | Commit | Demo step | Tracks |
|---|---|---|---|---|---|
| Boot the real GurtOS disc on Vultr from a script (`tracks/vultr/up.ts`) | vultr | building (script written, **blocked**: no Vultr credit; QA installed the disc by hand twice, Oct 23 22:29 and Oct 24 00:02) | | none | Vultr |
| Encrypted backup to Object Storage (age; the owner holds the key) | vultr | building (code, unit test, demo step on the branch; live restore **blocked** by the credit error) | | demo step on branch | Vultr |
| Vultr firewall managed from the box | vultr | building (group create, add, remove and delete proven against the real API; attaching to an instance **blocked**) | | | Vultr |
| Vultr Serverless Inference as a hosted model for /find | vultr, find | planned (no subscription; a paid one is the conductor's call) | | | Vultr, Moss |
| gurtos.co short pairing links (the code stays in the URL fragment) | vultr | building (redirect rules, test, go-live script; domain **not registered**, the conductor registers it) | | test on branch | GoDaddy |
| Domain story text for the showcase | vultr, submission | merged into the submission's text | | none | GoDaddy |

## Not pursued

- **Capital One (Nessie) prize track.** Ben is not entering it (Oct 24). No ledger row was only for it. Nessie stays as
  the credit desk's bank (payments, bills, AP payments in test money), so its rows are checked as part of the credit
  desk. The showcase still has a Nessie page and `docs/tracks.md` still lists the track; both are for the owners of
  those files to update.

## Gate stability

At 06:53 ET (03:53 PT) the shared test VM's load average was 31 and the host's 52, with several `tsc` runs, dev boxes
and a `./demo` at once. Moments then fail on timeouts, not on code. Until core adds a lock to `./demo`, run one gate
at a time and only when the load is under 8. QA's fresh-install passes run on separate Vultr VMs, not the shared one.

## Collisions

Found by trial merges and by comparing what each branch edits. Each is sent to every owner involved.

| # | What | Threads | Found | State |
|---|---|---|---|---|
| C-1 | Two "stop every agent" switches: core's `settings.paused` (main 197ebc2, used by Personal's Quick Settings tile) and Business's `paused.json` with `POST /api/pause` (`business` branch). Merged as is, they hold different states. | core, business, personal | Oct 24 02:25 | Resolved and verified Oct 24 03:25 on 276bb32: one state, both entry points |
| C-2 | `business` (forked at 89f59d3) conflicts with main in core/box.ts, portal/src/shell.tsx, shell.css, dev-box.sh and the built portal/dist | business, portal, core | Oct 24 02:25 | Resolved: Business merged as 276bb32; gate 26 passed, 0 failed |
| C-3 | core/box.ts edited at once by core (uncommitted in the main checkout), `business` and `remote-access`. Business and remote access both add fields to `interface Device` at the same lines | core, business, remote access | Oct 24 02:25 | Resolved: remote access (6cdeb9a) and Business (276bb32) are both on main; both gate sections pass |
| C-4 | portal/dist is a built file that both `business` and `portal` commit. A merge can keep one side's bundle and silently drop the other's screens | business, portal | Oct 24 02:25 | Watch: after 276bb32 the QA box serves the Business phone home and the Server home from one bundle; QA checks dist/source.txt after each merge |

## Fresh-install checks

| When (PT) | Build | What was checked |
|---|---|---|
| Oct 23 22:29 to 22:38 | release ISO 21:34 build | install, first boot, power cut, every app |
| Oct 23 22:55 to Oct 24 01:30 | debug ISO 22:16 build, then main on top after each merge | the four moments, security, phones, every app |
| Oct 24 00:02 | release ISO 20261024-0644-881318a | install, GurtOS screen, Pacific time, firewall |
| next | the signed release ISOs | planned twice more before Sun 8:00 AM |
