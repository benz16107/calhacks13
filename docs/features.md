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

Checked against main `7f784ff`, Sat Oct 24 03:10 PT. `./demo` on that commit: 25 passed, 0 failed, 1 pending (real Droid, off by default).

## Freeze plan

- **Sat Oct 24, 9:00 PM PT:** no new features merge after this, only fixes. Anything still "building" then is cut
  from the release and from the Devpost and showcase text, not half-merged.
- **Overnight:** QA installs the final ISOs fresh and walks every row of this ledger.
- **Sun 6:00 AM PT:** the final release. **Sun 9:00 AM PT:** Devpost closes.
- **GurtOS Business:** on the `business` branch, not merged at 03:05 Sat; the Business thread expects to merge within the hour. Off on a new box: turn it on with `PUT /api/business {on: true, company}` from the box screen. If it isn't merged and verified by
  the freeze, QA flags it for a clean cut: no Business rows on the showcase or Devpost, and no Business code on main.

## Summary

| Status | Count |
|---|---|
| verified (ISO) | 3 |
| verified | 31 |
| merged | 28 |
| building | 23 |
| planned | 33 |
| **Total** | **118** |

**Collisions** (detail below): none open at 02:40. The three found at 02:25 were resolved on the `business` branch
(rebased, kill switch on core's `settings.paused`). Still watched: portal/dist rebuilt from merged sources (C-4).

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

## GurtOS Business (preview)

| Feature | Owner | Status | Commit | Demo step | Tracks |
|---|---|---|---|---|---|
| People and roles | business | building (`business` 9886d27, rebased on main, merges clean) | 9886d27 | core/business-demo.ts on branch | Hyphenate, Microsoft, Atlassian |
| Plain-sentence rules, with a rule tester ("Who would approve this?", GET /api/business/route) | business | building (tester added after 9886d27; merge expected within the hour of 03:05 PT) | | business-demo on branch | Hyphenate, Microsoft |
| Routed approvals | business | building | | business-demo on branch | Hyphenate, Microsoft |
| No self-approval, no agent approving an agent | business | building | | business-demo on branch | Hyphenate, Armadin |
| Waiting for me | business | building | | | Hyphenate |
| My requests | business | building | | | Hyphenate |
| Audit with CSV export | business | building | | | Hyphenate, Microsoft |
| Kill switch | business | building (9886d27 now sets core's `settings.paused`) | 9886d27 | business-demo on branch | Hyphenate |

## Hyphenate (credit desk)

| Feature | Owner | Status | Commit | Demo step | Tracks |
|---|---|---|---|---|---|
| Credit analyst and collections clerk, CRS and Nessie live, fraud hold for the controller | credit desk | verified Oct 24 00:11 (Quick run on a phone) | 525f630, 7cdd64e | tracks/credit-desk/demo.ts | Hyphenate, CRS, Nessie, Microsoft |
| Credit desk window | credit desk | verified Oct 24 00:10 | 7cdd64e | credit-desk demo | Hyphenate |
| Score against the answer key | credit desk | verified (2 of 14 with scripted seats, by design) | 525f630 | credit-desk demo | Hyphenate |
| Bring your own case (folder or POST /run) | credit desk | merged | 7cdd64e | none | Hyphenate |
| Reopened decisions | credit desk | planned | | | Hyphenate |
| Defending decisions from the log | credit desk | building (worktree: history.ts, review.ts) | | | Hyphenate |
| Crash-proof handoff between seats | credit desk | planned | | | Hyphenate |
| Beancount books | credit desk | building (`credit-desk-data` branch 9c20d6c) | 9c20d6c | books.test.ts on branch | Hyphenate |
| AP clerk with vendor-fraud catches | credit desk | building (branch data; worktree ap.ts) | 9c20d6c | | Hyphenate |
| Bring-your-own-scenario upload | credit desk | planned | | | Hyphenate |
| Benchmark slice | credit desk | building (worktree bench/; subagent) | | | Hyphenate |

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
| Jira-to-GurtOS people mapping in Business | jira, business | planned | | | Atlassian, Hyphenate |

## Mana

Owner: the Mana thread.

| Feature | Owner | Status | Commit | Demo step | Tracks |
|---|---|---|---|---|---|
| Rules planning chat, project page, the GurtOS status app | mana | verified Oct 23 23:37 (app live, signed out) | 525f630, 4631f73 | tracks/mana/demo.ts | Mana, Hyphenate |
| Guest requests to GurtOS from inside the Mana app, with the owner's approval (same guest path as Fetch's) | mana, fetch | planned | | | Mana, Fetch.ai |
| Mana-drafted Business rules synced into the box's policy | mana, business | planned (needs the Business policy, `business` branch) | | | Mana, Hyphenate |
| Public Mana planning chats for Visa mandates and the Fetch agent team | mana | planned | | | Mana, Visa, Fetch.ai |
| A GurtOS guide agent in Mana | mana | planned | | | Mana |
| A public Mana home page for the entry | mana | planned | | | Mana |

## Other tracks, as they exist

| Feature | Owner | Status | Commit | Demo step | Tracks |
|---|---|---|---|---|---|
| Elastic: log in Serverless, GurtOS log agent | elastic | verified Oct 24 00:48 (index and agent via API) | 70f3673, ca03219 | tracks/elastic/demo.ts | Elastic |
| /find: search page, photos described on request, Moss local index | find | verified Oct 24 00:33 (search on a phone) | a0d6dbd, 4351905 | tracks/find/demo.ts | Moss |
| Apify: run any Actor, Best Buy price check, places | apify | verified Oct 23 23:40 (live Best Buy price) | 97694e0 | tracks/apify/demo.ts | Apify |

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

## Collisions

Found by trial merges and by comparing what each branch edits. Each is sent to every owner involved.

| # | What | Threads | Found | State |
|---|---|---|---|---|
| C-1 | Two "stop every agent" switches: core's `settings.paused` (main 197ebc2, used by Personal's Quick Settings tile) and Business's `paused.json` with `POST /api/pause` (`business` branch). Merged as is, they hold different states. | core, business, personal | Oct 24 02:25 | Resolved on the branch (9886d27: /api/pause sets `settings.paused`). Re-check both switches after it merges |
| C-2 | `business` (forked at 89f59d3) conflicts with main in core/box.ts, portal/src/shell.tsx, shell.css, dev-box.sh and the built portal/dist | business, portal, core | Oct 24 02:25 | Resolved: rebased on 6cdeb9a, trial merge clean at 02:40 |
| C-3 | core/box.ts edited at once by core (uncommitted in the main checkout), `business` and `remote-access`. Business and remote access both add fields to `interface Device` at the same lines | core, business, remote access | Oct 24 02:25 | Remote access merged (6cdeb9a); Business rebased on it, clean |
| C-4 | portal/dist is a built file that both `business` and `portal` commit. A merge can keep one side's bundle and silently drop the other's screens | business, portal | Oct 24 02:25 | Watch: QA checks dist/source.txt against sources after each merge |

## Fresh-install checks

| When (PT) | Build | What was checked |
|---|---|---|
| Oct 23 22:29 to 22:38 | release ISO 21:34 build | install, first boot, power cut, every app |
| Oct 23 22:55 to Oct 24 01:30 | debug ISO 22:16 build, then main on top after each merge | the four moments, security, phones, every app |
| Oct 24 00:02 | release ISO 20261024-0644-881318a | install, GurtOS screen, Pacific time, firewall |
| next | the signed release ISOs | planned twice more before Sun 8:00 AM |
