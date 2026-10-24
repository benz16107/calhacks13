# The story bible

How every track is told, in one place. The showcase (`showcase/`) and the Devpost text (`docs/devpost.md`) follow
this file; when a principle changes, it changes for every track. Generated from the track pages and their pitches
(see the end), then reviewed by hand. Tracks marked **to review with Ben** follow the principles but their story
has not been signed off yet.

## Principles for every track

1. **Problem first, then why an OS.** Traditional systems and clouds weren't built for agents: they are heavy, with
   no separation, no safe key handling, no record and no undo.
2. **GurtOS is the environment.** Each agent works in its own separate space (its own Linux user and its own copy
   of the files, like a worktree per task). Every feature runs on top of the OS. Emphasise the OS.
3. **Security is the headline.**
4. **It runs on a computer you own, even an old one, because it's light.** GurtOS Server: 4 GB of memory and 17 GB
   of disk on any x86_64 or arm64 machine, no GPU. GurtOS Personal: 4 GB and 29 GB, x86_64. Instead of a cloud you
   can't see into.
5. **The portal and phone app give live visibility and control** on any of your machines.
6. **Open source (Apache-2.0):** anyone can run it, customise it and reuse it.
7. **Name the edition that shows each track best.** GurtOS Business is a preview until it merges; Business-led
   tracks say so and show today's demo on GurtOS Server.
8. **Every feature says why it is there and which criterion it serves.**
9. **Label what comes from the OS and what from the track.**
10. **Lightweight, and it solves security problems existing systems can't.** The box service is one Node process
    on Ubuntu 24.04; no GPU, no cloud account.
11. **A better filesystem for agents.** Each task gets an instant copy-on-write copy of its files (an overlayfs
    layer). Agents work in parallel without colliding, nothing is duplicated (a layer holds only what a task
    changed), and undo is cheap and exact (take one layer out). That makes agent work faster: no copying a
    folder before a task, no locks between tasks, no merge step, and a bad task costs one click.
12. **Existing OSes are outdated for agents**, consumer and enterprise: built for one human at a keyboard;
    permissions per user, not per task; secrets in environment variables and files any process can read; the
    network all-or-nothing; no approval, budget or spending limit; no trustworthy record and no rollback of what
    an agent did. For enterprises: no separation of duties, no routed approvals, no fleet-wide audit.
13. **GurtOS is a suite, not one system:** the OS in three editions, the portal and phone companion app
    (app.gurtos.com), remote access (`<name>.box.gurtos.com` with push to the phone), the app platform that
    integrations plug into, the public docs (gurtos.com), and the open-source code.

Where they show up on the site: the overview opens with 12, 11, 10 and 13; principles 2 to 6 and 10 to 13 are the
"Runs on top of GurtOS" box on every track page; 7 is the "Best shown in" band; 1, 8 and 9 are the page summary
and its "Why" table.

## Videos and the freeze

Ben does not film. The videos are produced by the team after the build is done: screen recordings of the real app,
animation, and possibly narration in Ben's own cloned voice. Until then every page shows a silent screen recording.
The build freezes Sat Oct 24, 9 PM PT; after that, fixes only.

## Status

| Track | Edition | Story |
|---|---|---|
| Anthropic | GurtOS Personal and GurtOS Server | decided |
| Atlassian | GurtOS Business (preview) | to review with Ben |
| Hyphenate | GurtOS Business (preview) | decided |
| Factory | GurtOS Server and GurtOS Personal | to review with Ben |
| Armadin | All three editions | to review with Ben |
| Microsoft | GurtOS Business (preview) | to review with Ben |
| Visa | GurtOS Personal, plus GurtOS Server for routines that keep running when you close your laptop | decided |
| Coinbase | GurtOS Server, and GurtOS Business | decided |
| Fetch.ai | GurtOS Server (always reachable), and GurtOS Personal too | decided |
| SpacetimeDB | All three editions, strongest in GurtOS Business | to review with Ben |
| Elastic | GurtOS Business (preview) and GurtOS Server | to review with Ben |
| Moss | GurtOS Personal | to review with Ben |
| Apify | GurtOS Personal and GurtOS Server | decided |
| CRS | GurtOS Business (preview) | to review with Ben |
| Capital One | GurtOS Business (preview), then GurtOS Personal | to review with Ben |
| Solana | GurtOS Server, and GurtOS Business | decided |
| Vultr | GurtOS Server | to review with Ben |
| GoDaddy Registry | All three editions | to review with Ben |
| Figma | All three editions | to review with Ben |
| Mana | GurtOS Personal | to review with Ben |

## Anthropic: Claude used well for a specific group of people

**Status:** decided. **Page:** https://calhacks.gurtos.com/tracks/anthropic/

**Best shown in:** GurtOS Personal and GurtOS Server

**Pitch:** GurtOS turns a computer you own, even an old one, into one built for agents: each Claude task runs as its own Linux user in its own copy-on-write copy of your files, with no keys, and you approve, undo or pause it from the portal or your phone. It is light and open source. Next, a GurtOS MCP server (being built) lets Claude Desktop and Claude Code drive your box.

**The problem:** Solo developers already leave agents (Claude Code, OpenClaw) running at home as themselves, with every key and file. An ordinary OS can't separate them, record them or undo them, and the alternative is renting a cloud you can't see into.

**Features** (from the page's table):

| Feature | Why it is there | Anthropic criterion | From | Today |
|---|---|---|---|---|
| Claude does every task, inside Droid, as its own Linux user in its own copy-on-write copy of the files | Real work (code, receipts, a credit desk) with no way to touch another task's files | Claude doing something that matters | GurtOS (worker, task space) | Shipped. Model cost is priced from real token counts |
| Keys never reach the agent: a placeholder key in the task, the real one swapped in by the proxy | A hijacked or confused Claude has no key to leak | Knowing where it could go wrong | GurtOS (vault, proxy) | Shipped. 240 of 240 process samples held only the placeholder |
| A page with hidden instructions fails: the task reaches only its allowed hosts | Prompt injection cannot send anything out | Knowing where it could go wrong | GurtOS (network rule) | Shipped. Claude refused the page and the box blocked the attempt |
| Spending waits for your OK, and any one task can be undone | A wrong edit or a wrong purchase costs one tap | Knowing where it could go wrong | GurtOS (approval, undo) | Shipped |
| Live view and control from the portal and phone | You can watch an unattended agent | Usable Monday | GurtOS | Shipped |
| `sudo core/install.sh` on Ubuntu 24.04, or an install ISO; one model key (Anthropic or Factory) | Something that works the day you try it | Usable Monday | GurtOS | Shipped. Documented minimum: 4 GB of memory and 17 GB of disk |
| A GurtOS MCP server, so Claude Code and Claude Desktop can drive your box | The tools you already use start and watch tasks safely | Usable Monday, Claude doing something that matters | GurtOS (core) | Being built; not on main yet |
| Claude Code as a worker, with full isolation | Run Claude Code itself in a task's own space, with no keys | Claude doing something that matters | GurtOS (core) | Being built; not on main yet |
| Current Claude models chosen per task, with their cost | Use the right model for each job and see what it costs | Claude doing something that matters | GurtOS (core) | Being built; not on main yet |
| A Haiku second-opinion check before risky steps | A cheap second look before a step that spends or deletes | Knowing where it could go wrong | GurtOS (core) | Being built; not on main yet |
| A published attack-test score, including the misses | Honest evidence of where it holds and where it does not | Knowing where it could go wrong | GurtOS | Being built; not on main yet |
| Measured minimum hardware and a one-line install | The old-computer claim backed by numbers, and a faster first run | Usable Monday | GurtOS | Being built; not on main yet |

**Demo moment and proof:** In every merge-gate run, a real Claude task works as its own Linux user: 240 samples of its processes held only a placeholder key, its changes were undone on their own, and its cost ($0.5378 in the Oct 24 run) was priced from real token counts. The same run reads Claude a web page with hidden instructions to steal keys; it refused, and nothing left the box.

**Still to do:**

- A GurtOS MCP server, so Claude Code and Claude Desktop can drive your box
- Claude Code as a worker, with full isolation
- Current Claude models chosen per task, with their cost
- A Haiku second-opinion check before risky steps
- A published attack-test score, including the misses
- Measured minimum hardware and a one-line install
- How to enter: pending; Ben will ask a director (the prize is not on Devpost yet)

## Atlassian: Agentic Workforce Challenge, Track 2 (security for agents acting for a user)

**Status:** to review with Ben. **Page:** https://calhacks.gurtos.com/tracks/atlassian/

**Best shown in:** GurtOS Business (preview)

**Pitch:** Teams already review work in Jira. With Business, every agent task is an issue a teammate can approve or roll back, and Jira's own permissions decide who may. Business is not built yet: today the Forge app drives a GurtOS Server box, and it already checks that the Jira user may edit the issue.

**The problem:** Draft: when an agent acts for you overnight, nobody can see the next morning exactly what it did and why, or roll back only the wrong part.

**Features, by the sponsor's criteria** (no OS-vs-track table yet; to write when reviewed):

- *Audit and reversion: record every action with the inputs and reasoning behind it, so an admin can see exactly what happened the next morning and roll back only the changes that were wrong.* (met): Each issue holds the prompt, the tools and hosts the task was allowed, the agent's reasoning in its own words, approvals and who gave them, blocked attempts, the diff and the last 40 log entries. Roll back this task takes out that task's layer of file changes on the box. Every other task keeps its own.
- *A Forge app for Jira or Confluence.* (met): A Jira issue panel (UI Kit, native render) with a resolver in Atlassian's cloud, plus a jira:entityProperty index so state, cost, blocked attempts and pending approvals are searchable in JQL. Installed on the demo site in production.
- *Technical use of Forge.* (met): The resolver reads the issue property as the signed-in user, checks EDIT_ISSUES before any action, and is the only place that holds the box's shared secret (a Forge encrypted variable). It calls one declared external host. Scopes are read-only: the app never writes to Jira; the box does.
- *Usefulness to Atlassian users.* (met): The morning-after question is one JQL search: project = BOX AND boxBlocked > 0. Agent work moves across a normal board (To Do, In Progress, In Review, Done), so a team reviews agents the way it reviews people.
- *Demo video, 3 minutes at most.* (partly): The narrated video is produced after the build and will be embedded above; until then the clip above shows the real app.
- *Repo link.* (met): The track lives in tracks/jira/ (box side) and tracks/jira/forge/ (the Forge app).

**Demo moment and proof:** BOX-2, a scripted agent that misread a rule, changed three configs instead of one and tried to send the repo to a paste site. It was blocked, approved from Jira, then rolled back from Jira: its configs came back and the README fix another task made a minute earlier stayed.

**Still to do:**

- Review the story with Ben: problem, features with their why, OS vs track
- Demo video, 3 minutes at most. (partly)

## Hyphenate: Autonomous Systems for Finance

**Status:** decided. **Page:** https://calhacks.gurtos.com/tracks/hyphenate/

**Best shown in:** GurtOS Business (preview)

**Pitch:** A finance team needs roles, segregation of duties and an audit trail on every agent decision, which is what Business adds: who may approve what, up to how much. GurtOS Business is not built yet. Today's demo runs on GurtOS Server, with the credit desk's human controller seat approving from a phone.

**The problem:** Companies want AI employees, but today's computers and clouds weren't built for them. An agent runs as you, with your keys, on one shared filesystem, with no separation of duties, no record you can trust and no undo, so nobody lets one do real finance work.

**Features** (from the page's table):

| Capability | From | Today |
|---|---|---|
| Each seat works in its own space: its own Linux user and its own copy of the files, like a worktree per task | GurtOS | Shipped. The two seats run side by side without touching each other's files |
| No seat ever sees a password: CRS and Nessie keys stay in the root-only vault, and tools that need them run in the core | GurtOS | Shipped. The merge gate checks no key appears anywhere in the log |
| A seat cannot approve its own work: a decision above its authority waits for a person's OK on the portal or phone | GurtOS (the approval pause) and the desk (where the line is) | Shipped. The analyst's limit is $10,000; fraud holds always go to the controller |
| Segregation of duties by tool access: only the analyst can record credit decisions, only the clerk collections actions | The desk, on GurtOS task specs | Shipped |
| Everything is visible to the company, live, on the portal and the phone | GurtOS | Shipped |
| One append-only record of every call, decision, rule id and approver | GurtOS (the action log) and the desk (rule ids, CRS request ids) | Shipped |
| Undo one seat's file changes without touching the other's | GurtOS | Shipped. The log keeps the record either way |
| A crash mid-run resumes where it was, with nothing paid or recorded twice | GurtOS | Shipped for tasks and approvals (moment 4) |
| Pause every agent at once | GurtOS | Shipped as a setting (`paused`); the Business kill switch builds on it |
| People, roles, policy-routed approvals, a "Waiting for me" inbox, an Audit view with CSV export | GurtOS Business | Being built; not on main yet |
| Credit rules, the planted case, the scorer, the Credit desk window | The desk | Shipped |

**Demo moment and proof:** Live Droid run 73c47b, scored from the action log against the answer key: 14 of 14 planted errors caught, 0 false alarms, 6 of 6 credit decisions right (outcome, band, limit and terms). It held APP-1043, a synthetic identity that a simple rule approves for $20,000.

**Still to do:**

- A video that opens with your "moment". (partly)
- People, roles, policy-routed approvals, a "Waiting for me" inbox, an Audit view with CSV export

## Factory: Droid SDK track

**Status:** to review with Ben. **Page:** https://calhacks.gurtos.com/tracks/factory/

**Best shown in:** GurtOS Server and GurtOS Personal

**Pitch:** Droid does the work and GurtOS makes it safe. Droid never holds a key: the vault keeps it and the box's proxy swaps it in outside the task. Each task is its own Linux user with its own firewall rule and its own copy of the files, on a locked-down Linux base where task users have no sudo, and every change is reviewable in the log and undoable. Keys kept where agents can reach them keep leaking: OpenCode Console exposed users' provider API keys on Oct 17, 2026, OpenClaw stores tokens and API keys in plaintext in ~/.openclaw/openclaw.json, and CVE-2026-25253 let one crafted link make OpenClaw send its token to an attacker.

**The problem:** Draft: coding agents need keys to work, and tools keep leaking them (the OpenCode Console breach, OpenClaw's plaintext key file, CVE-2026-25253). Today the agent runs as you, on your files, with your keys in its environment.

**Features, by the sponsor's criteria** (no OS-vs-track table yet; to write when reviewed):

- *Droid SDK (TypeScript or Python) does real work.* (met): Droid, through @factory/droid-sdk 0.10.0, is the default worker for every task. It fixes code and runs the tests (from an ASI:One chat), works a credit desk with live CRS and bank data (two seats, 14 of 14 planted errors caught in the best run), reads receipts and proposes a reorder, describes photos for search, and edits a folder on GurtOS Personal.
- *The README says where and how.* (met): The worker is core/workers/droid.ts, about 70 lines: createSession or resumeSession, a box MCP server for tools, and handlers that turn Droid's questions into box approvals. core/README.md covers tasks, the broker and the key swap, and this page lays out the whole path.
- *Triggers you designed.* (met): Droid tasks start from an ASI:One chat, the box's API (the portal and the Personal desktop use it), the credit desk's run route (two seats at once), "Ask an Agent" on a folder in Files, the shopper's "watch this for me" and reorder, and the box itself when no vision model answers for a new photo. core/triggers.ts adds generic schedule, webhook and new-file triggers. A Droid task's tool call can start another task (the reorder proposal starts a purchase task that waits for your OK).
- *Careful limits on what Droid can touch.* (met): Each Droid runs as its own Linux user with no sudo, in an overlay copy of its workspace, as a hardened systemd unit (private /tmp, read-only system, no D-Bus, 2 GB of memory). An nftables rule sends its traffic only to the box's proxy, which allows only the task's hosts. It sees only the box tools its task lists, through an MCP relay that holds no secrets. Spending above its budget waits for a person.
- *Visible plans, steps and diffs.* (met): Every Droid tool call becomes a task.step in the append-only log, and Droid's final message is saved as its summary. The portal's task window shows the steps and the unified diff, and the same appear in the Jira issue and the ASI:One chat.
- *Scores badly: chatbot wrappers, actions you can't see.* (met): There is no chat box around Droid. Droid works on files and tools with nobody watching, and every action it takes is a log line a person can read, search in Elastic, or undo.

**Demo moment and proof:** In every merge-gate run, a Droid task (Claude) edits a file as its own Linux user while the box samples its processes: all 240 samples held only a placeholder Factory key, because the box's proxy adds the real key on the way to Factory. Its cost, $0.5378 in the Oct 24 run, is priced from the token counts Droid reports.

**Still to do:**

- Review the story with Ben: problem, features with their why, OS vs track

## Armadin: Best Security Hack

**Status:** to review with Ben. **Page:** https://calhacks.gurtos.com/tracks/armadin/

**Best shown in:** All three editions

**Pitch:** The protections live in the core every edition shares: separate users, the vault and broker, per-task network rules, approvals and the log. A booby-trapped page fails the same way on Server, Personal and Business.

**The problem:** Draft: a web page can carry hidden instructions, and an agent that obeys them can read every key on the machine and send it anywhere, because nothing in a normal OS stands between the agent and your secrets.

**Features, by the sponsor's criteria** (no OS-vs-track table yet; to write when reviewed):

- *Best security project.* (met): A real attack on AI agents, prompt injection that steals keys, stopped by the operating system instead of by the model behaving. Six separate controls (vault, separate users, process isolation, per-task network rule, proxy allowlist, approvals), each checked by an automated test on every merge, against both a hijacked scripted agent and a real Claude agent. The page lists what the box does not defend against.

**Demo moment and proof:** In every merge-gate run, a scripted agent obeys the hidden instructions step by step and is stopped at each one: the vault read fails (EACCES), the send to attacker.example is refused by the proxy, a raw connection to 1.1.1.1 is refused by the firewall, and reaching SpacetimeDB or the box's API to approve itself is refused. Then real Claude reads the same page: it refused, and no vault secret appeared in its files, environment or log.

**Still to do:**

- Review the story with Ben: problem, features with their why, OS vs track

## Microsoft: Built for the Real World, and the Customer Impact Award

**Status:** to review with Ben. **Page:** https://calhacks.gurtos.com/tracks/microsoft/

**Best shown in:** GurtOS Business (preview)

**Pitch:** Agents today run as you, with your keys and no separation of duties, so no company lets one near the books. In a company, production for an agent means roles, approvals routed to the right person, budgets and an audit trail. GurtOS already separates users, keys, approvals and the log; Business adds the people. GurtOS Business is not built yet. Today's demo runs on GurtOS Server, with the credit desk's human controller seat approving from a phone.

**The problem:** Draft: companies want production AI agents for real finance work, but there is no environment that gives an agent separation of duties, approvals, an audit trail and undo, so pilots never reach production.

**Features, by the sponsor's criteria** (no OS-vs-track table yet; to write when reviewed):

- *A production-minded AI agent for finance, productivity, healthcare or similar.* (met): Finance: trade credit and collections at Fogline Supply Co., a made-up Oakland wholesaler with 26 employees, about $8.1M revenue and 38 accounts on trade credit. Two agent seats (Droid running Claude) and a human controller.
- *Customer understanding.* (met): A small wholesaler's credit desk is one or two people doing credit checks and collections by hand, where one fake customer or one misapplied payment costs real money. The case is built from those everyday failures: a synthetic identity, a payment applied to the wrong customer, a post-dated check booked as cash, an invoice billed twice, a limit nobody reviewed in 29 months.
- *Measurable usefulness.* (met): Every run is scored from its log: planted errors caught out of 14, false alarms, and decisions matched on 6 applications, 11 customers and 6 orders. Three live Droid runs caught 13, 13 and 14 of 14 and decided all six applications right. The simple rule is the baseline on the same data.
- *Path to production.* (met): It runs on GurtOS: each seat is its own Linux user with its own copy of the files, keys stay in a root-only vault, every action is in an append-only log, approvals reach a phone, the box resumes after a power cut, and the OS updates as a whole and rolls itself back. The rules are a file, so the controller changes policy without code.
- *Responsible design.* (met): The agent cannot approve its own large proposals, clear a fraud flag, or decide before the checks run. It never sees the answer key. Every decision names the rule and the data behind it. It pulls only what trade credit needs (no criminal or eviction searches) and never tells an applicant which check failed.
- *End-to-end function.* (met): Application in, seven CRS checks, a decision by rule, the controller's approval on a phone, the decision in the log, the run scored. The merge gate runs this path on every merge, live against CRS and Nessie.
- *Customer Impact Award.* (met): The customer is the controller at a small business: the desk does the checking and the paperwork, stops the one application that would have cost $20,000 of credit, and brings only the decisions that need a person to their phone, with the reason and the data attached.

**Demo moment and proof:** Scored from the action log against an answer key, the latest live run caught 14 of 14 planted errors with 0 false alarms and decided all 6 credit applications as the key does. A simple rule on the same CRS data approves all six for $153,000, including $20,000 to a fake applicant whose $18,500 rush order would have shipped to a freight forwarder.

**Still to do:**

- Review the story with Ben: problem, features with their why, OS vs track

## Visa: Reimagining Shopping

**Status:** decided. **Page:** https://calhacks.gurtos.com/tracks/visa/

**Best shown in:** GurtOS Personal, plus GurtOS Server for routines that keep running when you close your laptop

**Pitch:** GurtOS Personal runs your shopping agents on a computer you own, even an old one: the agent never sees your card, every purchase waits for your tap, every order is signed so the store can verify it, and undo refunds it. A Server box keeps a watch running while the laptop is closed.

**The problem:** Shopping agents need your card or your password, stores can't tell a good agent from a bot, you can't see or stop what they do, and cloud agents run on computers you don't control.

**Features** (from the page's table):

| Feature | Why it is there | Visa criterion | From | Today |
|---|---|---|---|---|
| The agent never sees your card: the card and the signing key stay in the root-only vault, and only the buy tool in the core reads them | A prompt injection or a bad model cannot leak what it never had | Trust (15) | GurtOS (vault and broker) | Shipped. The merge gate checks no card, key or password is anywhere in the log |
| Every purchase waits for your tap, with the price against your limit | You stay the one who spends; the agent only proposes | Trust (15), UX (25) | GurtOS (the approval pause) | Shipped. The tap is Approve on the phone or portal; a Face ID (passkey) tap is being built |
| Each checkout is signed with Visa's Trusted Agent Protocol, including the order body | The store can verify a real, unchanged agent order instead of blocking every bot | Commerce impact (15), Technical (20) | The Shopper app | Shipped. The store refuses unsigned, changed and replayed orders |
| Undo refunds the order | A purchase you regret is one tap to reverse | UX (25), Trust (15) | GurtOS (undo) and the store (refund) | Shipped |
| Standing instructions: "when it's under $16", "keep us stocked" | Shopping becomes a rule you set once, not a session you sit through | Innovation (25) | The Shopper app, with Claude in Droid | Shipped |
| Live store prices through Apify, prices from the store not the model | A confused or hijacked model cannot invent a price | Technical (20), Trust (15) | The Shopper app and the Apify app | Shipped |
| Each agent is its own Linux user with its own budget and network rule | One shopping agent cannot touch another task's files or spend another's money | Trust (15) | GurtOS | Shipped |
| Live view of every agent on the portal and the phone, and Pause all agents | You can see and stop what your agents are doing | UX (25), Trust (15) | GurtOS | Shipped |
| Signed shopping mandates the store verifies, a merchant dashboard (verified agents, conversion, chargebacks), comparison across stores, savings after purchase, card-style spending rules | Next steps for each criterion; this page adds each one with its reason when it ships | All five | The Shopper app | Being built; not on main yet |

**Demo moment and proof:** In the live run on Oct 23, Apify read Chemex filters at Best Buy Canada for $15.36 CAD, the box asked, and after the tap it bought them at that price with a Stripe test-mode charge on a Visa test card. Undoing the household reorder refunded it in Stripe test mode. Every payment was test money.

**Still to do:**

- Visa Intelligent Commerce (not built)
- Signed shopping mandates the store verifies, a merchant dashboard (verified agents, conversion, chargebacks), comparison across stores, savings after purchase, card-style spending rules

## Coinbase: x402 Payment Agents

**Status:** decided. **Page:** https://calhacks.gurtos.com/tracks/coinbase/

**Best shown in:** GurtOS Server, and GurtOS Business

**Pitch:** GurtOS is the environment that makes an agent wallet safe: the key never reaches the agent, each task has a budget on top of the x402 client's own payment policy, anything over it waits for your tap on the phone, and every payment is on the record. It all runs on top of the OS, on an always-on box you own, and because GurtOS is open source (Apache-2.0), anyone can run it, customise it and reuse the wallet in their own agents.

**The problem:** Giving an agent money means handing it your card or a private key, on a heavy system or a cloud with no layer built for this: no separation, no safe key handling, no record and no undo.

**Features** (from the page's table):

| Feature | Why it is there | Coinbase criterion | From | Today |
|---|---|---|---|---|
| The key never reaches the agent: it lives in the root-only vault, and only `wallet.pay` in the core reads it | A prompt injection or a bad model cannot leak or spend a key it never had | Technical design | GurtOS (vault and broker) | Shipped. The merge gate checks neither the wallet key nor the CDP secret is anywhere in the log |
| Per-task budget on top of the x402 client's own payment policy (exact price, devnet USDC only, $1 cap per payment) | Two independent limits on what an agent can spend | Technical design, usefulness | GurtOS (budget) and Coinbase's x402 SDK (policy) | Shipped |
| Over budget, the task pauses until you approve on the portal or phone; denied means nothing is paid | You stay the one who decides on money | Usefulness | GurtOS (the approval pause) | Shipped |
| Every payment in the append-only log with amount, payee, task and transaction | A record you can audit, matched to the chain | Technical design | GurtOS (the log) and the app (the receipt) | Shipped |
| Settlement through Coinbase's CDP facilitator, which pays the network fee | The wallet needs no SOL, and Coinbase verifies each payment | Usefulness | The wallet app, on Coinbase CDP | Shipped |
| An installable skill (`skill/x402-wallet/SKILL.md`) and two box tools any agent can call | Any agent on any box can pay without new code | Ease of reuse | The wallet app | Shipped |
| Open source, Apache-2.0 | Anyone can run GurtOS, customise it, and reuse the wallet | Ease of reuse | GurtOS | Shipped |
| The box earning over x402 and listed in the Bazaar, agents shopping for APIs, CDP Server Wallets with Coinbase policies, metered "upto" payments, one-command reuse, Onramp top-up, a tamper-evident Solana log fingerprint | Next steps for each criterion; this page adds each one with its reason when it ships | All four | The wallet app | Being built; not on main yet |

**Demo moment and proof:** A real agent (Droid with Claude) was told only "buy one joke and one report". It quoted both, paid $0.01, waited for the OK on the $0.03 report, then paid it. Both payments settled through Coinbase's CDP facilitator and are confirmed on Solana devnet, and neither the wallet key nor the CDP secret appears anywhere in the task's log.

**Still to do:**

- Verified Coinbase account. (partly)
- CDP wallets (not built)
- The box earning over x402 and listed in the Bazaar, agents shopping for APIs, CDP Server Wallets with Coinbase policies, metered "upto" payments, one-command reuse, Onramp top-up, a tamper-evident Solana log fingerprint

## Fetch.ai: ASI:One Agent Challenge

**Status:** decided. **Page:** https://calhacks.gurtos.com/tracks/fetch/

**Best shown in:** GurtOS Server (always reachable), and GurtOS Personal too

**Pitch:** GurtOS gives ASI:One a safe body on a computer you own, even an old one: each request runs as its own sandboxed task with no keys, asks before it spends, and can be undone, and the portal and phone show it live. A Server box answers at 3 AM through its Agentverse mailbox with no open port.

**The problem:** A chat agent can only act if it runs somewhere: a cloud you can't see into, or your own computer with full access. Agents that talk to strangers' agents can be fed hidden instructions.

**Features** (from the page's table):

| Feature | Why it is there | Fetch.ai requirement or bonus | From | Today |
|---|---|---|---|---|
| The box is an agent on Agentverse, speaking the Agent Chat Protocol | So ASI:One can find it and hand it work | Required: agent on Agentverse, Agent Chat Protocol | The Fetch.ai app | Shipped |
| The whole flow happens in the ASI:One chat: pairing, requests, approvals, results, undo | You never need to leave the chat | Required: main flow inside an ASI:One chat | The Fetch.ai app | Shipped |
| Each chat request is its own task: its own Linux user, its own copy of the files, no keys, no network of its own | Work a stranger's message starts cannot reach your files or keys | Required: real tool use, done safely | GurtOS | Shipped |
| Spending above the task's budget pauses for an Approve or Deny card in the chat (and on the portal and phone) | An agent never spends your money on its own | Bonus: ASI:One Interactive Cards | GurtOS (the approval pause) and the app (the card) | Shipped |
| The result comes back with its diff and a Keep or Undo card | You see exactly what changed and can take it back | Bonus: Interactive Cards | GurtOS (undo) and the app (the card) | Shipped |
| Only the paired owner gives work; strangers get the pairing step | Nobody else can start, approve or undo anything | Required: real multi-step action, safely | The Fetch.ai app | Shipped |
| Replies wait in an outbox, the agent restarts within 5 seconds, and tasks resume after a power cut | A chat never loses its answer | Bonus: reliability | GurtOS (resume) and the app (outbox) | Shipped |
| Live view and control on the portal and phone | You can watch and stop chat work from anywhere | Required: real action you can see | GurtOS | Shipped |
| A team of agents on Agentverse, safe calls to strangers' agents with their replies treated as untrusted (a blocked hidden instruction), the Payment Protocol, richer cards, picking your machine from chat, guest requests the owner approves | Next steps for the bonus criteria; this page adds each one with its reason when it ships | Bonus: multi-agent, Payment Protocol, cards, reliability | The Fetch.ai app | Being built; not on main yet |

**Demo moment and proof:** In a live run through ASI:One, the box's agent paired with the chat, a Droid task fixed the failing test in a sample repo for $0.05 and sent back the diff with Undo, and a stock check paused at a $0.50 web search over its $0.25 budget, sent an Interactive Card, and finished after Approve: "in stock on Hario's US store at $10.25".

**Still to do:**

- Public repo with run steps. (partly)
- 3 to 5 minute video. (partly)
- Also submit through the ASI:One Submission Agent. (open)
- Bonus: ASI:One Interactive Cards, reliability, multi-agent. (partly)
- Payment Protocol (not built)
- A team of agents on Agentverse, safe calls to strangers' agents with their replies treated as untrusted (a blocked hidden instruction), the Payment Protocol, richer cards, picking your machine from chat, guest requests the owner approves

## SpacetimeDB: SpacetimeDB as the core real-time backend

**Status:** to review with Ben. **Page:** https://calhacks.gurtos.com/tracks/spacetime/

**Best shown in:** All three editions, strongest in GurtOS Business

**Pitch:** Live shared state is what each edition's screen reads: the box screen on Server, the desktop on Personal. It matters most in Business (preview, not built), where several people see the same approvals at once and the first answer wins.

**The problem:** Draft: when agents run unattended, the people responsible need to see every request live, on every screen at once, and answer from wherever they are.

**Features, by the sponsor's criteria** (no OS-vs-track table yet; to write when reviewed):

- *SpacetimeDB as the core real-time backend.* (met): SpacetimeDB is the box screen's live view of the box. The screen reads the task and approval tables and answers through the answer reducer. The box writes through putTask and putApproval, which refuse anyone but the box, and vouches for the screen and paired phones with registerDevice.
- *Used meaningfully, not on the side: live shared state.* (met): One shared state for every person and every task on the box: what each task is doing now (step), its cost against its budget, and every pending approval with its question, amount, payee and purpose.
- *Instant sync.* (met): An approval appears on the box screen the moment the box writes it. Approve there and the box picks up the answer from its subscription and writes it to its log within milliseconds; a phone that approved first through the API clears the screen's banner the same way.
- *Agents coordinating.* (partly): Agents and people meet in the approval table: a paused agent's request is a row, and whoever answers first, from any screen or a chat, lets it carry on. The credit desk's two agent seats run side by side and both stop there for the controller. Agents do not message each other through SpacetimeDB yet.

**Demo moment and proof:** In every merge-gate run, a task stops over its budget and SpacetimeDB shows the request live with its amount, payee and purpose. Another task keeps running and finishes meanwhile. The OK goes through SpacetimeDB's answer reducer into the box's log under the name the box vouched for, a stranger's identity is refused, and the task spends its $8.00 of test money and finishes, and SpacetimeDB shows it done with its cost.

**Still to do:**

- Review the story with Ben: problem, features with their why, OS vs track
- Agents coordinating. (partly)

## Elastic: Best use of Elastic Agent Builder on Serverless

**Status:** to review with Ben. **Page:** https://calhacks.gurtos.com/tracks/elastic/

**Best shown in:** GurtOS Business (preview) and GurtOS Server

**Pitch:** "What did every agent do this week?" is an audit question. A Server owner asks it the morning after; a Business team would ask it across everyone's tasks. Business is not built yet, so today the agent answers for GurtOS Server boxes.

**The problem:** Draft: after a week of agents working, nobody can answer "what did they change, what did it cost, why did that fail" without digging through raw logs.

**Features, by the sponsor's criteria** (no OS-vs-track table yet; to write when reviewed):

- *An Elastic Agent Builder agent.* (met): A custom agent, gurtos-log (shown as GurtOS log), with seven custom tools: six parameterized ES|QL tools and one index search tool. The agent, its instructions and its tools are code in tracks/elastic/agent.ts, created or updated with one command through the Agent Builder API, and asked through Kibana's chat and the converse API.
- *On a Serverless instance.* (met): An Elasticsearch Serverless project on GCP us-east4. The box-actions index, the data and the agent all live there.
- *Real data, used for something that matters.* (met): Every document comes from a box's own action log: the installed GurtOS boxes, and DEMO_LIVE=elastic demo runs with Droid tasks running Claude, the credit desk and the four demo moments. Dev boxes stay out of the index. The questions are the ones an owner asks the morning after: what changed, what it cost, why something failed, and what got blocked.

**Demo moment and proof:** Asked "Why did the job routine fail? Look at demo run a18523.", the agent found the failed task with box.failures, read its timeline and named the root cause itself: the routine was allowed to reach only boards.greenhouse.io, its plan needed www.linkedin.com, the box blocked it, and the task failed right after. A live run shipped all 156 events of a demo run to Serverless, each exactly once.

**Still to do:**

- Review the story with Ben: problem, features with their why, OS vs track

## Moss: A personal agent that remembers you

**Status:** to review with Ben. **Page:** https://calhacks.gurtos.com/tracks/moss/

**Best shown in:** GurtOS Personal

**Pitch:** Your photos, files and task history are personal. /find keeps its index on your own machine, and only text, never a photo, goes to Moss's cloud copy.

**The problem:** Draft: a personal agent is only useful if it remembers your photos, files and past work, and today that memory means uploading your life to someone's cloud.

**Features, by the sponsor's criteria** (no OS-vs-track table yet; to write when reviewed):

- *Fit one of their three examples.* (met): The second: a personal agent that remembers you, works across your apps and handles everyday tasks on its own. GurtOS is a computer where agents do everyday work (shopping, paperwork, code), and through Moss the owner and every agent can find what any of them did, filed or wrote, by meaning.
- *A voice agent, a personal agent that works across your apps, or a social post.* (met): One index across every app's workspace: photos (described by a vision model), text files, and the history of every task the box ran. The owner searches through the box's API (GET /t/find/search, with a paired token from off the box); agents search with the find.search tool.

**Demo moment and proof:** A search through the box takes a median of 3.1 ms on both test VMs (ARM64 and x86), under 1 ms of it inside Moss, because Moss runs in the box's own memory. In every merge-gate run, an agent with no network asks find.search through the broker and gets the same whiteboard photo; undo a task and its files leave the index while the photos stay.

**Still to do:**

- Review the story with Ben: problem, features with their why, OS vs track
- Vultr's hosted vision model (not built)

## Apify: Best Use of Apify (top 5)

**Status:** decided. **Page:** https://calhacks.gurtos.com/tracks/apify/

**Best shown in:** GurtOS Personal and GurtOS Server

**Pitch:** GurtOS lets your agents use Apify's web robots from their own isolated space, with no keys: the broker holds the token, a scraped page is treated as untrusted data, and every run's cost is capped by the task budget and shown in the portal. On a Server box, schedules and webhooks start those tasks while you're away. It is light and open source.

**The problem:** Web agents today drive your logged-in browser with your accounts, read booby-trapped pages, and you can't see what they spend.

**Features** (from the page's table):

| Feature | Why it is there | Apify criterion | From | Today |
|---|---|---|---|---|
| The agent runs Apify Actors from its own space: its own Linux user, no network, and the tool runs in the core | The agent gets the web without a browser or your logins | Meaningful use | GurtOS (task space, broker) and the app (the tools) | Shipped. Two network-less tasks ran Actors live on Oct 23 |
| The token stays in the root-only vault; a result that contains it is refused; an Actor never gets it | An injected page or a hostile Actor cannot take the token | Overall quality | GurtOS (vault) and the app | Shipped. The live run checked the token is in neither task's log |
| A scraped page is data: the task has no network and no secrets to act on a hidden instruction | A booby-trapped page can spoil its own result, nothing more | Overall quality | GurtOS (network rule, no keys) | Shipped |
| Spending is capped twice: Apify's `maxTotalChargeUsd` and the box's task budget, with a pause for your OK above it | You decide what a web job may spend | Overall quality | GurtOS (budget and approval) and Apify (the cap) | Shipped. The box counts the cap or the Actor's list price, an estimate |
| Live view and control on the portal and phone | You can see and stop what a web agent is doing | Overall quality | GurtOS | Shipped |
| Agent-Safe Page Reader, our own published Actor: reads a page and flags hidden instructions in it | The agent gets the text with the risky parts marked, instead of raw page text | Best Actor | The track (the Actor), with GurtOS treating the result as untrusted | Being built; not on main yet |
| Apify's MCP server through the broker: an agent finds and runs any Store Actor | Apify's hosted MCP asks the agent to hold the token; through the broker it never does | Meaningful use | GurtOS (broker) and Apify | Being built; not on main yet |
| Schedules and webhooks that start Apify tasks while you are away | Web jobs, like a price check or a nightly crawl, run with the laptop closed (Server) | Meaningful use | GurtOS (triggers) | Being built; not on main yet |
| Apify's Crawler into /find | The pages you care about become searchable by meaning, on your own box | Meaningful use | The track and /find (Moss) | Being built; not on main yet |
| A web source for the credit desk | The credit desk can check an application against the web, not only its own data | Meaningful use | The track and the credit desk | Being built; not on main yet |
| The real Apify cost of a run counts against the task budget | The budget reflects what Apify charged, not an estimate | Overall quality | GurtOS (budget) and the app | Being built; not on main yet |

**Demo moment and proof:** The live run on Oct 23, on both the x86 and the ARM64 test VMs, started two tasks with no network at all. Both Actors ran on Apify at the same time and came back with AirPods Pro 3 at $299.99 CAD, in stock, at Best Buy Canada, and Cole Coffee Café at 6255 College Ave, Oakland. The token was nowhere in either task's log.

**Still to do:**

- Best Actor: our own published Actor. (open)
- Agent-Safe Page Reader, our own published Actor: reads a page and flags hidden instructions in it
- Apify's MCP server through the broker: an agent finds and runs any Store Actor
- Schedules and webhooks that start Apify tasks while you are away
- Apify's Crawler into /find
- A web source for the credit desk
- The real Apify cost of a run counts against the task budget

## CRS: Overall, Best Financial AI Agent, Best Identity/Fraud, and Most Unexpected

**Status:** to review with Ben. **Page:** https://calhacks.gurtos.com/tracks/crs/

**Best shown in:** GurtOS Business (preview)

**Pitch:** Agents today run as you, with your keys and no separation of duties, so no company lets one near the books. Identity and fraud checks are team work: an analyst agent runs them, a controller signs off, and every decision keeps its CRS request ids for the audit. GurtOS Business is not built yet. Today's demo runs on GurtOS Server, with the credit desk's human controller seat approving from a phone.

**The problem:** Draft: identity and fraud checks are exactly where a fooled or hijacked agent costs real money, and today the agent that runs them holds the keys and can approve its own work.

**Features, by the sponsor's criteria** (no OS-vs-track table yet; to write when reviewed):

- *CRS central, not bolted on.* (met): CRS is the analyst's main source. Rule CHK-1 says no terms before the CRS checks, and the credit-desk.credit_decision tool enforces it: it refuses a decision on an application whose seven checks have not run in the same task. Bands come from the lowest bureau score, fraud stops from identity codes and the Fraud Finder score.
- *Live against the sandbox.* (met): Every ./demo run calls the CRS sandbox live. On Oct 23 all six applicants were checked live (42 calls) and every answer matched its CRS persona. Recorded answers are used only if CRS cannot be reached, and the result says which source answered.
- *Useful.* (met): Three of the case's 14 planted errors rest on CRS answers: the synthetic identity (APP-1043), a lien and a judgment the applicant denied (APP-1044), and three bureaus that disagree (APP-1045). The live Droid run 73c47b caught all three, and the bureau scores set the band and limit on every application.
- *Creative.* (met): CRS runs as a tool inside an operating system for agents. The agent asks the box; the core logs in to CRS with keys from a root-only vault, makes the calls and returns a summary with each request id. A hijacked or confused agent cannot pull reports it was not asked to, or see the login.
- *Test identities only.* (met): Every applicant's guarantor is copied from one of CRS's 20 sandbox personas (sandbox/crs-personas.json). The businesses around them are made up.
- *Best Financial AI Agent.* (met): The analyst is an agent that does the work: runs the checks, compares them with the application, the business credit file and the bank, sets band, limit and terms by rule, and routes what it may not decide alone to the controller.
- *Best Identity/Fraud.* (met): Fraud stops are rules the tools hold the agent to: identity codes 2201, 2202 and 2301 (FRD-1), Fraud Finder 70 or more (FRD-2), and compound signals (FRD-4). A fraud hold stops every shipment and always goes to a person.
- *Most Unexpected.* (met): Credit data as a guard for agents: the same box that stops a booby-trapped web page from stealing keys uses CRS to stop a fake customer from talking an AI desk into $20,000 of credit.

**Demo moment and proof:** APP-1043 has clean-looking numbers and a 640 score, and the simple rule approves it for $20,000. CRS, live: identity fails with codes 2201, 2202 and 2101, Fraud Finder scores it 88, nobody owns its phone, and 9 credit inquiries landed between Aug 19 and Sep 12. The analyst put it on fraud hold and the controller confirmed it. Every merge-gate run repeats this live.

**Still to do:**

- Review the story with Ben: problem, features with their why, OS vs track

## Capital One: Best use of the Nessie banking API

**Status:** to review with Ben. **Page:** https://calhacks.gurtos.com/tracks/nessie/

**Best shown in:** GurtOS Business (preview), then GurtOS Personal

**Pitch:** Agents today run as you, with your keys and no separation of duties, so no company lets one near the books. A collections clerk agent reconciles the ledger against the bank for a finance team, and only a controller releases a hold. On Personal the same pattern becomes a bill-paying agent for your own accounts that asks before it pays (not built). GurtOS Business is not built yet. Today's demo runs on GurtOS Server, with the credit desk's human controller seat approving from a phone.

**The problem:** Draft: an agent that reconciles a company's bank against its books needs bank access, and today that means handing it the key and trusting whatever it changes.

**Features, by the sponsor's criteria** (no OS-vs-track table yet; to write when reviewed):

- *Best use of the Nessie banking API.* (met): Nessie is the bank behind a finance agent's daily work, not a balance display. Both seats read it through credit-desk.bank, a tool that runs in the box's core with the Nessie key from a root-only vault. The agents never hold the key.
- *Completeness.* (met): nessie-seed.ts loads the case: 1 Fogline customer and operating account, 12 trade customers and accounts, 38 bills, 14 payment deposits, and 6 applicants with 31 monthly deposits. It looks everything up before creating it, so running it again creates nothing, and it writes an id map back.
- *Creativity.* (met): The bank is the second source that disagrees with the books, which is where real collections work happens: a payment memo that names a different invoice, a check that never cleared, an applicant whose deposits are a tenth of the revenue they claim.
- *Complexity.* (met): The ledger maps onto customers, accounts, bills and deposits with each deposit carrying payer, reference, memo and exact amount. Live behavior that differs from the spec, found while loading, is handled and written down: deposits drop cents, a bill without recurring_date breaks every bill list on its account, and balances do not move on deposits.

**Demo moment and proof:** Nessie shows Golden Gate Bagel's $1,940 deposit with the memo INV-24098, while the ledger applied that payment to another customer's invoice, and it shows no deposit at all for a check dated after the case date that the ledger marked paid. The clerk caught both in the live run, and the merge gate checks them in Nessie on every merge.

**Still to do:**

- Review the story with Ben: problem, features with their why, OS vs track
- Writing back to the bank (not built)

## Solana: MLH: Best use of Solana

**Status:** decided. **Page:** https://calhacks.gurtos.com/tracks/solana/

**Best shown in:** GurtOS Server, and GurtOS Business

**Pitch:** An always-on box you own holds the Solana wallet in its root-only vault, so agents can pay for APIs at any hour without ever seeing the key. Every payment is a devnet transaction anyone can check, recorded in the box's log with the task that made it. GurtOS is open source (Apache-2.0), so the same wallet works in anyone's agents.

**The problem:** Giving an agent money means handing it a private key on a system with no layer built for it.

**Features** (from the page's table):

| Feature | Why it is there | What it shows for Solana | From | Today |
|---|---|---|---|---|
| SPL `TransferChecked` of devnet USDC, signed in the core | Real on-chain payments an agent can make without holding the key | Use of Solana | The wallet app | Shipped. 36 payments, every one finalized |
| The wallet holds no SOL; a facilitator pays each fee | An agent wallet needs only the asset it spends | Use of Solana | The wallet app, on Coinbase CDP | Shipped |
| Each transfer confirmed on chain before the receipt is logged | The log never claims a payment the chain does not have | Best use of Solana | The wallet app and GurtOS's log | Shipped |
| Key in the root-only vault, per-task budget, approval on the phone | Spending is safe enough to leave running | Best use of Solana | GurtOS | Shipped |
| A tamper-evident fingerprint of the box's log on Solana | Anyone could check the record was not rewritten | Best use of Solana | The wallet app | Being built; not on main yet |

**Demo moment and proof:** The wallet's whole history is public on Solana Explorer: one 20 USDC faucet deposit, then 36 x402 payments of $0.01 or $0.03 made by agents on the box, 0.76 USDC in all, every one a finalized SPL TransferChecked whose fee was paid by the facilitator, never by the wallet.

**Still to do:**

- Mainnet (not built)
- A tamper-evident fingerprint of the box's log on Solana

## Vultr: MLH: Best use of Vultr

**Status:** to review with Ben. **Page:** https://calhacks.gurtos.com/tracks/vultr/

**Best shown in:** GurtOS Server

**Pitch:** GurtOS Server runs wherever a VM does. On Vultr it is the public, always-on box: Jira and Mana reach it, and the rest of its API stays closed.

**The problem:** Draft: an agent box should be reachable around the clock without exposing everything on it to the internet.

**Features, by the sponsor's criteria** (no OS-vs-track table yet; to write when reviewed):

- *Best use of Vultr cloud.* (met): Vultr does four jobs no other machine does: the always-on public box (the only GurtOS box with a public HTTPS address), the build machine for the bootable discs, a test machine for the merge gate on x86, and the GNOME desktop where GurtOS Personal is tested. Agents on the public box run with every safety part on, and its whole API stays closed to the internet except two paths.
- *Use Vultr in the project.* (met): The Jira issues BOX-1 to BOX-5 are tasks that ran on the Vultr box. The Mana app at the link below reads the Vultr box every 5 seconds. ./demo vultr, ./deploy vultr and image/build all target it.

**Demo moment and proof:** ./demo vultr on Oct 24: all 22 sections, 175 checks, 0 failed in 105 seconds on the Vultr VM, including a real Droid task running Claude and a hard power cut the box came back from. The GurtOS Server and Personal install discs were built on the same VM that night.

**Still to do:**

- Review the story with Ben: problem, features with their why, OS vs track
- Vultr Serverless Inference for /find (not built)
- Booting a GurtOS disc on a Vultr instance (not built)
- Switching to the Vultr box from another box's portal (not built)

## GoDaddy Registry: MLH: Best domain name from GoDaddy Registry

**Status:** to review with Ben. **Page:** https://calhacks.gurtos.com/tracks/godaddy/

**Best shown in:** All three editions

**Pitch:** One name for every edition, GurtOS Server, GurtOS Personal and GurtOS Business, all at gurtos.com.

**The problem:** Draft: the product needs one name a person can remember for every edition, the domain and the OS itself.

**Features, by the sponsor's criteria** (no OS-vs-track table yet; to write when reviewed):

- *Best domain name.* (met): One word that says what the product does. A Gurt is a seatbelt: you still drive anywhere, and a crash does not throw you out. GurtOS gives agents real access (files, the web, money) and keeps each one strapped in: its own Linux user, its own copy of the files, no keys, and an undo. Short, spellable after hearing it once, and the same string in every place the product shows its name.
- *Register a domain through GoDaddy Registry (MLH code).* (partly): gurtos.com is registered at GoDaddy (registrar GoDaddy.com, LLC, IANA id 146) and uses GoDaddy's DNS (ns69 and ns70.domaincontrol.com). Its records are added through GoDaddy's API.

**Demo moment and proof:** Registered at GoDaddy.com, LLC on Fri Oct 23 at 9:29 PM PT, minutes after the rename, and live the same night: gurtos.com serves the product docs and calhacks.gurtos.com serves this site, both answered by GoDaddy's nameservers.

**Still to do:**

- Review the story with Ben: problem, features with their why, OS vs track
- Register a domain through GoDaddy Registry (MLH code). (partly)

## Figma: Best Workflow, Stage Log, Best Design and Most Creative

**Status:** to review with Ben. **Page:** https://calhacks.gurtos.com/tracks/figma/

**Best shown in:** All three editions

**Pitch:** One design system for every edition: the box screen and phone for Server, the GNOME layer for Personal, and room in the same tokens for Business.

**The problem:** Draft: an OS for agents has to feel like an OS people trust, not another dashboard, and the design has to reach the code without drift.

**Features, by the sponsor's criteria** (no OS-vs-track table yet; to write when reviewed):

- *Going from idea to demo with Figma.* (met): Every stage is in Figma and lands in the repo: FigJam for ideation and architecture, Figma Design for tokens, components and screens, prototype reactions and Figma Make for the flows, Figma Slides for the deck, and Figma's MCP server for the handoff that generated portal/. The path is the flow diagram below.
- *A stage log (up to 200 words each for ideation, prototyping, handoff, code generation: tool, minutes, 1 to 5 rating).* (met): In full on this page, under Stage log: four stages, each with its tools, minutes and rating, each under 200 words. Every session is also a line in docs/stagelog.md, with how its output reached the project.
- *Figma Slides (required).* (met): The pitch deck is a 16-slide Figma Slides file in the GurtOS system, with v2 screens in its 16 image slots, a setup-wizard slide and a design-system slide. It opens signed out.
- *An embedded Make or prototype.* (met): The v2 Figma Design prototype is embedded on this page: approve a spend on the phone, and undo one task on the box. Four flows are wired in all (setup, phone, undo, desktop and Settings). A Figma Make file holds two of them as a small working web page in the v2 system.
- *Files shared with 'Anyone'.* (met): The FigJam board, the design file, the deck and both prototype flows open in a signed-out browser (checked Oct 24). The Make file opens too; its preview inside Figma was not verified by the import.
- *Demo video, 3 minutes at most.* (partly): The narrated video is produced after the build and will go at the top of this page; until then the clip shows the real app.

**Demo moment and proof:** The portal the box runs today was generated from the v2 frames through Figma's MCP server, and every Figma variable is a CSS custom property of the same name: Figma's accent/bg (#2F64A6 Light, #78A9E6 Dark) is --color-accent-bg in the shipped kit, with the same two values. The screenshots below put each frame next to the running app.

**Still to do:**

- Review the story with Ben: problem, features with their why, OS vs track
- Demo video, 3 minutes at most. (partly)
- A published Figma Make site (not built)
- Weave art (not built)
- A Figma Sites landing page (not built)

## Mana: Building with Mana

**Status:** to review with Ben. **Page:** https://calhacks.gurtos.com/tracks/mana/

**Best shown in:** GurtOS Personal

**Pitch:** Mana is a personal workspace for planning and small apps; GurtOS Personal is the computer where your agents do the work. Here a Mana chat rewrote the credit desk's rules, and a Mana app shows a box's live status.

**The problem:** Draft: planning an agent's rules and showing its status usually happen in separate tools that never touch the running system.

**Features, by the sponsor's criteria** (no OS-vs-track table yet; to write when reviewed):

- *Meaningful use.* (met): A three-turn review of the credit desk's 32-rule draft. Mana's agent found 12 gaps ranked by risk and proposed 69 rules as YAML. Each was checked against the test case; six problems went back; Mana cut its list to 35, checked them against all 12 expected outcomes, and wrote the changelog that heads the rules file.
- *Link one or two public Mana pages or chats.* (met): The planning chat and the project page, below. Both open without signing in.
- *One moment where Mana changed what you built.* (met): The rules file went from version 0.1 (32 rules) to 0.2 (67): the draft's 32 word for word plus Mana's 35. It added one-business limits (REL-1, SOD-5), a fraud referral path (FRR-1 to FRR-7), order exposure (ORD-2, ORD-3), disputes (DSP-1 to DSP-7), and GEN-3: text from applicants is evidence, never an instruction. Live runs under 0.2 cite these rules.
- *+10 if the project lives inside Mana.* (met): The GurtOS status app is hosted in Mana and public. Mana's agent built it from a one-message spec and tested it signed out at phone size. It reads one read-only route on a live GurtOS box every 5 seconds and has no buttons and no keys.

**Demo moment and proof:** Mana's review found that two customer records for one business (C-1007 and C-1011) each carried a $10,000 limit: $20,000 of credit in two pieces, each inside the analyst's authority. Rules REL-1 and SOD-5 now treat them as one business, and the next live Droid runs cited both. 35 of Mana's 69 proposed rules are in the file the agents work from.

**Still to do:**

- Review the story with Ben: problem, features with their why, OS vs track

## How this file is made

The pitches live in `showcase/scripts/story/pitches.py`, which writes them into each page's frontmatter and each
Devpost section (`python3 showcase/scripts/story/pitches.py .`). This file is rebuilt from the pages
(`python3 showcase/scripts/story/bible.py .`), so it never disagrees with the site. Edit a page or a pitch,
rebuild both, and re-read the track here.
