# Devpost submission, ready to paste

Everything for the Devpost page, field by field. The showcase site with one page per track is
https://calhacks.gurtos.com. Keep this file and the site in step: when a track changes, change both.

Placeholders still waiting on Ben are marked **TODO (Ben)** and listed at the end.

## Project name

GurtOS

## Elevator pitch (200 characters max)

An OS where AI agents do real work safely: each task runs as its own Linux user, in its own copy of your files, with no keys. Undo any task, approve spending from your phone.

## Video

**TODO (Ben):** the unlisted YouTube link of the main video (2 to 3 minutes; shot list in `docs/videos.md`).

## Image gallery (upload in this order)

1. `showcase/public/devpost/1-box-screen.png`: the box's own screen as an approval arrives.
2. `showcase/public/devpost/2-blocked.png`: the booby-trapped page, blocked and logged, with Undo.
3. `showcase/public/devpost/3-phone-and-jira.png`: the same approval on a phone, and the task as a Jira issue with Roll back.

The thumbnail is image 1.

## Try it out (links)

- https://calhacks.gurtos.com (the showcase: one page per sponsor track, with evidence)
- https://gurtos.com (the product docs)
- https://github.com/benz16107/calhacks13 (the code, Apache License 2.0; **TODO (Ben):** say go on making it public)
- https://www.figma.com/slides/SBrJtJiY20k88X3IGzKwZW (the pitch deck, Figma Slides)

## Built with

typescript, node.js, linux, ubuntu, systemd, overlayfs, nftables, spacetimedb, claude, factory-droid, preact, python,
gtk, libadwaita, gnome, astro, figma, figma-make, figjam, figma-slides, forge, jira, elasticsearch, kibana,
agent-builder, fetch.ai, uagents, asi-one, agentverse, apify, moss, x402, coinbase-cdp, solana, usdc, stripe,
visa-trusted-agent-protocol, crs-credit-api, capital-one-nessie, mana, vultr, godaddy, vercel, qemu, grub

## Prizes to select on the submission form

Overall, Most Technically Advanced, Most Creative, Best Solo Hack, Hacker's Choice, Anthropic, Atlassian (Track 2),
Hyphenate, Factory (Droid SDK), Armadin (Best Security Hack), Microsoft (Built for the Real World, and the Customer
Impact Award), Visa, Coinbase (Payment Agents), Fetch.ai, Spacetime, Elastic, Moss, Apify, CRS (Overall, Financial AI
Agent, Identity/Fraud, Unexpected), Capital One (Nessie), MLH Solana, MLH Vultr, MLH GoDaddy Registry, Figma (Best
Workflow, Stage Log, Best Design, Most Creative), Mana.

---

## About the project (paste from here to the end)

<!-- SUMMARY START -->

**GurtOS is an operating system where AI agents do real work safely: real access, never your keys.**

People already leave agents running at home. OpenClaw, an agent that runs on your own computer, has 392,891 GitHub
stars (GitHub API, Oct 23, 2026). It also had 21,639 instances anyone on the internet could reach (Censys, Jan 2026),
341 malicious skills out of 2,857 on ClawHub (Koi Security), and a one-click token theft (CVE-2026-25253). The agent
runs as you, with your keys and your files. GurtOS is the computer built for that work instead.

Every task runs as its own Linux user, in its own copy of your files, and its network reaches only the hosts it
needs. Tools that need a key run inside the core, so a task never holds one. One append-only log records everything
every agent did and what each task cost. Factory's Droid running Claude does the work.

![The box's own screen as a task asks for an OK](https://calhacks.gurtos.com/devpost/1-box-screen.png)

**The four moments** (each runs live at the table, and each is a section of the merge gate every change must pass):

1. **Undo one task.** Undo takes out one task's changes and leaves every other task's work in place, outside git.
2. **The booby-trapped page.** An agent reads a page with hidden instructions to steal keys. There are none to
   steal, the task's network reaches only its allowed host, and the attempt is logged and undone.
3. **A pause for your OK.** A task that wants to spend over budget stops and asks. The request reaches the box screen
   and your phone live while other tasks keep running.
4. **Pull the plug.** Hard-kill the box. It boots, rebuilds every task from its log, and resumes each one where it
   stopped, with no step done twice.

![The booby-trapped page, blocked and logged](https://calhacks.gurtos.com/devpost/2-blocked.png)

**Three editions.** **GurtOS Server** is an always-on box with its own screen, no human login, and a bootable ISO
that updates as a whole and rolls back by itself (built). **GurtOS Personal** is your own Ubuntu laptop, where agents
work beside you on copies of your folders, with approvals as GNOME notifications and Keep or Undo (built).
**GurtOS Business** shares one box across a team with roles and routed approvals (planned).

**Proof.** The merge gate, `./demo`, starts a fresh box on a test VM and runs the four moments and every app: on Oct 24
it passed all 22 sections, 175 checks, 0 failed. The credit desk caught 14 of 14 planted finance errors with 0 false
alarms. A running Droid task held only a placeholder key in 240 of 240 process samples.

![The same approval on a phone, and the task as a Jira issue](https://calhacks.gurtos.com/devpost/3-phone-and-jira.png)

**Every sponsor track has its own page, with the criteria, video, screenshots, live links and evidence:
https://calhacks.gurtos.com**

Built solo by Ben Zhou. Open source under the Apache License 2.0. All payments are test money: Stripe test mode with a Visa test card, or USDC on Solana devnet.

<!-- SUMMARY END -->

## Sponsor tracks

<!-- SPONSORS START -->

### Anthropic: Claude used well for a specific group of people

For solo developers who leave AI agents running unattended on a machine at home. GurtOS runs each Claude task (inside Factory's Droid) as its own Linux user, in its own copy of the files, with keys held in a vault the agent cannot read. It asks before money moves, and you can undo any one task.

**Proof:** in every merge-gate run, a real Claude task held only a placeholder key across 240 samples of its processes, undo removed its changes and nothing else, and its cost ($0.5378) was priced from real token counts. Given a web page with hidden instructions to steal keys, Claude refused and nothing left the box.

Community: solo developers running unattended agents at home. Lived problem: Ben's own always-on agents (a job-application pipeline, watchers, overnight queues) ran as him, with his keys. Usable Monday: `sudo core/install.sh` on Ubuntu 24.04. Where it could go wrong: injected pages, wrong edits and spending each have a tested control; the remaining limits are listed in the threat model.

[Full write-up, video and evidence →](https://calhacks.gurtos.com/tracks/anthropic/)

### Atlassian: Agentic Workforce Challenge, Track 2 (security for agents acting for a user)

Every task an agent runs on GurtOS becomes a Jira issue holding what it was asked, what it was allowed to use, its reasoning in its own words, its approvals, every blocked attempt, its diff and its action log. A Forge app adds a panel with Approve, Deny and **Roll back**, which removes only that task's file changes on the box, and indexes each task's state, cost and blocked attempts for JQL (`project = BOX AND boxBlocked > 0`).

**Proof:** BOX-2: a scripted agent misread a rule, changed three configs instead of one and tried to send the repo to a paste site. The box blocked it, it was approved from Jira, then rolled back from Jira: its configs came back and another task's README fix stayed. `DEMO_LIVE=jira ./demo` passes all 12 checks against the real Jira site.

Forge app: `jira:issuePanel` (UI Kit), a resolver that reads the task as the signed-in user and checks `EDIT_ISSUES` before acting, `jira:entityProperty` for the JQL fields, and an encrypted variable for the box's secret; read-only scopes. Repo: `tracks/jira/` and `tracks/jira/forge/`. Demo video (3 minutes or less): **TODO (Ben)**.

[Full write-up, video and evidence →](https://calhacks.gurtos.com/tracks/atlassian/)

### Hyphenate: Autonomous Systems for Finance

An autonomous credit desk for Fogline Supply Co., a made-up Oakland wholesaler of cafe supplies. It checks new business customers through CRS, sets terms, and collects against the bank (Capital One's Nessie). Each seat runs on GurtOS as its own Linux user, with no keys and only its job's tools, and the tools enforce segregation of duties.

**Proof:** Live Droid run 73c47b, scored from the action log against the answer key: 14 of 14 planted errors caught, 0 false alarms, 6 of 6 credit decisions right. It held APP-1043, a synthetic identity a simple rule approves for $20,000.

One line on the seats: a credit analyst agent and a collections clerk agent at a small wholesaler, with a human controller who signs off above $10,000 and on every fraud referral. Answer key: `tracks/credit-desk/cases/fogline-2026-10/answer_key.json` (14 planted errors, 7 false-alarm traps). Bring your own case: `POST /t/credit-desk/run {"dir": ...}`. The video opens on the APP-1043 moment.

[Full write-up, video and evidence →](https://calhacks.gurtos.com/tracks/hyphenate/)

### Factory: Droid SDK

Droid, through the TypeScript Droid SDK (`@factory/droid-sdk` 0.10.0) and running Claude, is the worker inside every GurtOS task. The box limits what each Droid can touch: its own user, an overlay copy of the files, only its task's hosts and tools. Every Droid tool call is a step in the action log, shown with the diff in the portal, Jira and ASI:One. After a power cut, the box resumes the same Droid session.

**Proof:** 240 of 240 process samples of a live Droid task held only a placeholder Factory key; the box's proxy adds the real key on the way to Factory. The cost ($0.5378) was priced from Droid's token counts.

Where and how: `core/workers/droid.ts` (createSession or resumeSession, the box MCP relay, questions turned into approvals) and `core/workers/mcp.ts`. Triggers: ASI:One chat, the box API, the credit desk route, "Ask an Agent" in Files, the shopper, new photos, and schedule, webhook and new-file triggers.

[Full write-up, video and evidence →](https://calhacks.gurtos.com/tracks/factory/)

### Armadin: Best Security Hack

The booby-trapped page: an agent reads a web page that tells it to steal every API key and send them to an attacker. On GurtOS it has nothing to send and nowhere to send it. The vault is root only, each task is its own Linux user with hardened systemd isolation, and nftables plus a proxy allowlist let it reach only its one host. Every attempt is logged, and the task is undone.

**Proof:** every merge run, a scripted hijacked agent is stopped at each step. The vault read fails with EACCES, attacker.example is refused by the proxy, a raw IP is refused by the firewall, and it cannot reach SpacetimeDB or the API to approve itself. Real Claude then refused the same page, and no vault secret appeared in its files, environment or log.

Armadin published no criteria; the page lists every control, its test, and the limits (shared kernel, a local API with no login, no independent audit).

[Full write-up, video and evidence →](https://calhacks.gurtos.com/tracks/armadin/)

### Microsoft: Built for the Real World (and Customer Impact Award)

A production-minded finance agent: two agent seats run a small wholesaler's credit and collections, and a human controller approves anything large or suspicious on a phone. GurtOS is the path to production: separate Linux users, a root-only vault, an append-only log, approvals, resume after a power cut, and updates that roll back.

**Proof:** Three live runs caught 13, 13 and 14 of 14 planted errors and decided all six applications right. A simple rule on the same data approves all six for $153,000, including $20,000 to a fake applicant.

[Full write-up, video and evidence →](https://calhacks.gurtos.com/tracks/microsoft/)

### Visa: Reimagining Shopping

You give the box standing instructions ("the Chemex filters when they're under $16", "keep the house stocked"). It checks real stores and your receipts around the clock. It buys only after one tap on your phone, and every checkout is signed with Visa's Trusted Agent Protocol. The model never holds the card or a buy tool.

**Proof:** In the Oct 23 live run, Apify read Chemex filters at Best Buy Canada for $15.36 CAD. After the tap, the box bought them at that price as a Stripe test-mode charge on a Visa test card, and undoing a reorder refunded it. All test money.

Video: **TODO (Ben)**. All payments are test payments: Stripe test mode, Visa test card 4242. The Box Test Store is our own stand-in merchant. The household mailbox is a demo POP3 inbox, not Gmail.

[Full write-up, video and evidence →](https://calhacks.gurtos.com/tracks/visa/)

### Coinbase: x402 Payment Agents

Agents on a GurtOS box pay for 402-gated APIs with the x402 SDK. Payments settle through Coinbase's CDP facilitator, and the wallet key stays in the box's root-only vault. A payment over the task's budget waits for your OK on the portal or phone.

**Proof:** Told only "buy one joke and one report", a Droid agent with Claude paid $0.01, waited for approval, then paid $0.03. Both payments settled via CDP and are confirmed on Solana devnet, and neither key appears in the task's log.

**Summary:** For people who leave agents running unattended at home. Agents buy API calls within a per-task budget, never holding a key. Coinbase tools: `@x402/fetch`, `@x402/core`, `@x402/svm`, `@x402/express`; the CDP facilitator through `createCdpFacilitatorClient` in `@coinbase/cdp-sdk/x402`; x402.org as the fallback.

**Working example:** `keygen.ts`, fund at faucet.circle.com, add CDP keys, then `DEMO_LIVE=wallet ./demo`.

**Architecture:** seven controls (key in the core, exact price, devnet USDC only, task hosts only, budget then the owner, never twice, everything in the log). Known limits: devnet only, `GET` only, the box holds the key.

**Builder feedback:** what worked, plus 10 friction points, in `tracks/wallet/FEEDBACK.md`. Payments are real devnet transactions in test USDC; nothing is simulated except our own test API.

[Full write-up, video and evidence →](https://calhacks.gurtos.com/tracks/coinbase/)

### Fetch.ai: ASI:One Agent Challenge

Every GurtOS box is an agent on Agentverse. From an ASI:One chat you give it real work, such as "fix the failing test in my project". Droid with Claude does the work inside the box's limits, and the chat gets progress, an Interactive Card to approve spending, and the diff with Keep or Undo.

**Proof:** In a live ASI:One run, a Droid task fixed the failing test for $0.05 and returned the diff with Undo. A stock check paused at a $0.50 Apify search over its $0.25 budget, sent an Approve/Deny card, and after Approve reported the filters in stock at $10.25.

Agents:

- `box`: `agent1qvuk46tnt9lnscher0pawl7pr5y525mak66ptwsrvg4kff0pfy9m2sy0us6`
- `box-test`: `agent1qdcex5gzkjnl08fc6wswejxv9h7swvfnewk35fyntrklthx57sv3jkzxz3u`

Badges: ![tag:innovationlab](https://img.shields.io/badge/innovationlab-3D8BD3) ![tag:hackathon](https://img.shields.io/badge/hackathon-5F43F1). Uses the Agent Chat Protocol (uAgents, Agentverse mailbox). The main flow runs inside the ASI:One chat. Real tool use: Droid edits and tests code; Apify `rag-web-browser` searches the web. Run steps are in `tracks/fetch/README.md`. Video (3 to 5 min): **TODO (Ben)**. Also submitted through the ASI:One Submission Agent: **TODO (Ben)**.

[Full write-up, video and evidence →](https://calhacks.gurtos.com/tracks/fetch/)

### SpacetimeDB: core real-time backend

Each box self-hosts SpacetimeDB with a TypeScript module the box publishes at boot. Its `task` and `approval` tables are the live state of every agent. The box screen, the portal and phones subscribe to them, and a phone answers an agent's request through the `answer` reducer; the first answer wins. Only the box can write tasks and approvals, and the action log on disk stays the truth.

**Proof:** in every merge run, a task stops over budget, SpacetimeDB shows the request live with its amount, payee and purpose, another task keeps running, the phone's OK comes back through the reducer into the log, and the task finishes. After a hard power cut, the waiting approval is still live in SpacetimeDB.

[Full write-up, video and evidence →](https://calhacks.gurtos.com/tracks/spacetime/)

### Elastic: Agent Builder on Serverless

Every action an agent takes on a GurtOS box streams into an Elasticsearch Serverless project. An Agent Builder agent, "Box log", built from code in the repo with six ES|QL tools and one index search tool, answers what changed, what it cost, why something failed and what got blocked.

**Proof:** asked "Why did the job routine fail?", where the box had logged only "worker exited with 1", the agent found the cause in the timeline itself: LinkedIn was blocked because the task could reach only boards.greenhouse.io. All 156 events of the run arrived in Serverless, each exactly once.

Agent: `box-log`, 7 tools, created through the Agent Builder API (`tracks/elastic/agent.ts`), on a Serverless project in GCP us-east4.

[Full write-up, video and evidence →](https://calhacks.gurtos.com/tracks/elastic/)

### Moss: a personal agent that remembers you

/find: say "find the whiteboard photo" and the box answers `photos/IMG_2041.jpg`, from a vision model's description, not the file name. Moss indexes photos, text files and the history of every task inside the box's own memory, with a text-only copy in Moss's cloud. Agents search it through a box tool, with no network or key of their own.

**Proof:** a search through the box has a median of 3.1 ms on both the ARM64 and x86 test VMs, under 1 ms of it inside Moss. In every merge run, an agent with no network finds the same photo through the broker, and undoing a task removes its files from the index.

Fits Moss's second example: a personal agent that remembers you and works across your apps.

[Full write-up, video and evidence →](https://calhacks.gurtos.com/tracks/moss/)

### Apify: Best Use of Apify

Apify is how every agent on the box reaches the web: `apify.checkPrice` (Playwright Scraper on Best Buy Canada), `apify.findPlaces` (Google Maps Scraper) and `apify.run` (any Store Actor). Tools run in the box's core with the token from the vault. The agent's task has no network and no secrets.

**Proof:** On Oct 23 two network-less tasks ran Actors live in parallel on both test VMs and got AirPods Pro 3 at $299.99 CAD, in stock, and Cole Coffee Café at 6255 College Ave, Oakland. The token was in neither task's log.

Also used live by the Visa shopping agent (Chemex filters at $15.36 CAD) and by the ASI:One chat agent (web search). Spending is capped by `maxTotalChargeUsd` and by the box's budget approval.

[Full write-up, video and evidence →](https://calhacks.gurtos.com/tracks/apify/)

### CRS: Overall, Financial AI Agent, Identity/Fraud, Unexpected

The analyst agent runs seven CRS checks on every guarantor: three bureau reports, identity, Fraud Finder, public records and phone owner. The decision tool refuses to record anything until those checks run (rule CHK-1), and each decision carries their request ids. The CRS login stays in the box's vault.

**Proof:** Live, every merge: APP-1043's identity fails (2201, 2202, 2101) and Fraud Finder scores it 88. The desk holds it, where the simple rule approves $20,000. Test identities only.

[Full write-up, video and evidence →](https://calhacks.gurtos.com/tracks/crs/)

### Capital One: Best use of Nessie

Nessie is Fogline's bank: 12 trade customers and accounts, 38 bills, 14 payment deposits with memos, and 31 applicant deposits, loaded by a seed script that is safe to rerun. The clerk agent reconciles the ledger against Nessie, and the analyst checks stated revenue against deposits.

**Proof:** Nessie shows PMT-8812's memo naming INV-24098 while the ledger applied it elsewhere, and no deposit for a post-dated check the ledger marked paid. The merge gate checks both live on every merge.

[Full write-up, video and evidence →](https://calhacks.gurtos.com/tracks/nessie/)

### Solana: MLH Best use of Solana

Each GurtOS box has an agent wallet on Solana. Agents' x402 payments are SPL `TransferChecked` transfers of devnet USDC, signed in the box's core. A facilitator pays the fee, so the wallet holds no SOL, and the box checks each transfer is confirmed on chain before logging it.

**Proof:** The wallet's public history: one 20 USDC faucet deposit, then 29 agent payments of $0.01 or $0.03, 0.59 USDC in all, every one finalized, none paying its own fee. Wallet: https://explorer.solana.com/address/6PyiR71c9aw3e8bgnxmcLvJECL5zHE5jMSWqJoVjPTxU/tokens?cluster=devnet. Example: https://explorer.solana.com/tx/Urd99HESxbkSQ4ppVCfQtJXhKNo7TteQUe1ErfnGduJRyp7dnoK6mTJfk9kGDPJKwo3QwmkonFJGBLiKaL3T2CK?cluster=devnet

Devnet USDC only: test money with no value.

[Full write-up, video and evidence →](https://calhacks.gurtos.com/tracks/solana/)

### Vultr: MLH Best use of Vultr

A Vultr Cloud Compute VM in San Jose is the GurtOS box the internet can reach: Jira's Forge app approves and rolls back agent tasks on it, and a public Mana app reads its status live. Everything else on its API answers 404. The same VM builds the bootable GurtOS Server and Personal discs and runs the full merge gate. A second Vultr VM runs GurtOS Personal on GNOME for the desktop layer's tests.

**Proof:** `./demo vultr` on Oct 24: all 22 sections, 175 checks, 0 failed in 105 s on the Vultr VM, including a real Droid task running Claude and a hard power cut the box came back from. The Jira issues BOX-1 to BOX-5 are tasks that ran on it.

[Full write-up, video and evidence →](https://calhacks.gurtos.com/tracks/vultr/)

### GoDaddy Registry: MLH Best domain name

**gurtos.com.** *Gurt* is German for seatbelt, and GurtOS is a seatbelt for AI agents: real access, but each agent is strapped in (its own Linux user, its own copy of the files, no keys, undo). The name is the domain, the boot-screen wordmark, slide 1 of the deck, the docs, and what the OS calls itself (`NAME="GurtOS"`, hostname `gurt-<id>`).

**Proof:** Registered at GoDaddy.com, LLC on Fri Oct 23 at 9:29 PM PT, during the rename, and live that night on GoDaddy DNS: gurtos.com serves the product docs, calhacks.gurtos.com this write-up.

[Full write-up, video and evidence →](https://calhacks.gurtos.com/tracks/godaddy/)

### Figma: Best Workflow, Stage Log, Best Design, Most Creative

Figma ran every stage: a FigJam board for the architecture and the four demo moments, two rounds of OS research, three directions, a design system with every token as a variable, two prototype flows, and a handoff through Figma's MCP server that became the real portal and the GNOME desktop layer. 21 sessions, 212 minutes, all logged.

**Proof:** the shipped portal CSS keeps Figma's variable names (`var(--color-state-waiting-fg)` in both), and the page shows each design next to the running app.

**Figma Slides deck:** https://www.figma.com/slides/SBrJtJiY20k88X3IGzKwZW

**Prototype (embedded on the page):** https://www.figma.com/proto/oppzH621OOOMA31rgLbxbM/?node-id=23-304&starting-point-node-id=23%3A304

**Files:** [FigJam board](https://www.figma.com/board/KvHiDv5HIJuGYOZDDkp8VG) · [Design file](https://www.figma.com/design/oppzH621OOOMA31rgLbxbM) · [Make](https://www.figma.com/make/PuKKW48akjbEKogpI59pdL), all shared with Anyone.

**Stage log:**

**Ideation (FigJam and Figma Design, 32 minutes, 4 of 5).** Claude Code built the FigJam board through Figma's MCP server: the architecture and the four demo moments with `generate_diagram`, and the 25 sponsor tracks grouped by the slot each plugs into. When the first screens looked like a B2B dashboard, it collected 15 OS references from official pages into a moodboard on the same board, then drew three OS directions (home-server OS, across-the-room console, hardware OS) on the box screen and the phone. Ben picked the home-server OS. Output reached the project as `docs/figma/refs/` and `docs/figma/directions/`. When the built screens still read as a SaaS product, a second round collected 15 references from GNOME, elementary OS, macOS, Windows 11, Ubuntu, Synology DSM, umbrelOS and iOS, each with one rule to take from it, into `docs/figma/refs/os-system/` and a new section of the board. Those rules became the GurtOS design system in `docs/figma/system.md`.

**Prototyping (Figma Design and Figma Make, 6 minutes, 4 of 5).** Two flows wired between the real screens with prototype reactions: an approval arriving on the phone, Approve, the task running again; and undo one task on the box, with a confirm step. The same flows went into a Figma Make file as a small web page in the design's tokens, tested in a browser first. Links are in `docs/figma.md`.

**Handoff (Figma's MCP server and exported frames, 19 minutes, 4 of 5).** Every color and size is a variable with CSS code syntax, every screen and component is named, and `docs/figma.md` lists each screen's node ID and the API data behind it. The portal thread reads them with `get_design_context`. The GNOME frames for GurtOS Personal went the other way: native GTK and libadwaita widgets have no web code, so the desktop layer was built from the exported frames and their notes. The indicator took the frames' "Needs you" and "Running" sections, the notification its "Approve $8.00" button, and the review its Undo and Keep.

**Code generation (Figma's MCP server, 67 minutes, 4 of 5).** Claude Code read the screens with `get_design_context` (box home, phone home, Notification Center, the task window) and adapted the React and Tailwind reference into the portal's own Preact components and CSS, keeping Figma's variable names as CSS custom properties so every token stays traceable. Assets came from the same responses: both wallpapers, and the glyphs, which collapsed from 33 exports into one path set because Figma draws every size with the same 3 px stroke. Every mockup value the box can't back up changed: progress bars became "working" bars, the daily limit became "on tools and models", and Activity's spend bars are computed from the real log. The result reached the project as `portal/`: one web app the box serves as its own kiosk screen, as the portal, and on a phone, checked against the PNGs in `docs/figma/os/`. The Shopper app came first, from the approval card on screen g and the Paper tokens. Two Figma frames have no web equivalent: Live Activities and the Dynamic Island.

[Full write-up, video and evidence →](https://calhacks.gurtos.com/tracks/figma/)

### Mana: Building with Mana

A public Mana chat reviewed the credit desk's 32 draft rules. Mana proposed 69 rules, 35 were adopted, and the desk's agents now follow them. A Box status app hosted in Mana shows a live GurtOS box.

**Proof:** Mana found two customer records for one business, each with a $10,000 limit. Rules REL-1 and SOD-5 now treat them as one, and the next live Droid runs cited both. GEN-3 makes applicant text evidence, never an instruction.

Public links: chat https://www.mana.space/shared-chats/x5CqxyjcOgVCAyrvUBqK2LNRcMJ2/001792810018092cc50381027f1410c8fcb · project page https://www.mana.space/home/x5CqxyjcOgVCAyrvUBqK2LNRcMJ2/documents/cal-hacks-13-a-computer-where-ai-agents-work-safely · app (+10, lives in Mana) https://www.mana.space/home/x5CqxyjcOgVCAyrvUBqK2LNRcMJ2/apps/box-status

[Full write-up, video and evidence →](https://calhacks.gurtos.com/tracks/mana/)

<!-- SPONSORS END -->

---

## Placeholders waiting on Ben

<!-- TODO START -->

1. **Six videos.** Record and upload as Unlisted on YouTube (shot lists in `docs/videos.md`): main, Fetch.ai, Atlassian,
   Figma, Hyphenate, Visa. Put each id in `showcase/src/data/videos.ts` and redeploy; paste the main video's link in
   Devpost's video field. Until then every page shows a silent screen recording of the real app.
2. **Say go on making the repo public** (Apache-2.0, full history; the release thread does it). The site and this
   text link to files in it, and judges get a 404 until then. The link checker verifies those paths against main.
3. **Root `README.md`** still says "Working name"; the release thread owns it. Factory ("the README says where and
   how"), Fetch.ai (agent names, addresses and badges) and Coinbase (setup steps) read it, so it should point to the
   track READMEs and to https://calhacks.gurtos.com.
4. **Jira.** The demo site is not public, so the showcase shows the BOX issues as screenshots and links no Jira
   URLs. The Atlassian video is where judges see Jira live.
5. **Figma Make.** The file opens signed out but its preview says "Couldn't load Make". Open it, check the preview
   runs, then Publish. The board, the design file, the deck and both prototypes open signed out.
6. **Fetch.ai.** Submit through the ASI:One Submission Agent and share the ASI:One chat link.
7. **Anthropic.** The prize is not on Devpost yet; ask a director how to enter.
8. **GoDaddy.** Confirm whether gurtos.com was registered with the MLH GoDaddy Registry code (and that a .com
   counts). If yes, change the "through GoDaddy Registry" row in `showcase/src/content/tracks/godaddy.mdx` to `met`.
9. **Coinbase.** Their track asks for a verified Coinbase account. Confirm it is verified.
10. **Devpost link.** Once the project page exists, set `LINKS.devpost` in `showcase/src/data/site.ts`.
11. **Stage log totals.** `docs/stagelog.md`'s "For Devpost" section undercounts (Ideation 18, Handoff 4 and Code
    generation 57 minutes; its own table sums to 32, 19 and 67). The Figma section above uses the table's numbers.

<!-- TODO END -->
