# The story bible

How every track is told, in one place. The showcase (`showcase/`) and the Devpost text (`docs/devpost.md`) follow
this file; when a principle changes, it changes for every track. Generated from the track pages and their pitches
(see the end), then reviewed by hand. Tracks marked **to review with Ben** follow the principles but their story
has not been signed off yet.

**The headline everywhere (Ben, Oct 24):** "Operating systems built for AI agents" (plural, for the three editions), with the line
 under it "Agents get real access to files, the web and money, and never hold your keys." It replaces "An operating system where
 AI agents work safely" on gurtos.com, the showcase and the Devpost tagline.

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
7. **Name the edition that shows each track best.** GurtOS Business is on main (people and roles, routed approvals, audit, kill switch);
   sign-in with a work account (Entra ID) is Entra-ready and tested with a standards test provider; shadow mode is built. Say which part each Business-led page shows.
8. **Every feature says why it is there and which criterion it serves.**
9. **Label what comes from the OS and what from the track.**
10. **Lightweight, and it solves security problems existing systems can't.** The box service is one Node process
    on Ubuntu 24.04; no GPU, no cloud account. GurtOS Server is 40 named Ubuntu packages (440 with dependencies), no
    desktop, snapd, cloud-init, sudo or apt, on a 1.37 GB disc; say "no desktop", not "no browser" (its screen is one
    full-screen WebKit view). Measured: the box installed from source ran one task at a time in 1 GB of RAM in a QEMU VM
    (not the Server image, on a fast host, so never "any old laptop"). Personal idles at about 903 MB, about 150 MB
    less than stock Ubuntu 24.04 Desktop.
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

14. **Finance tracks (CRS, Hyphenate, Microsoft, Visa, Coinbase): the unexpected part is the OS.** We built
    an entire operating system, a whole ecosystem, for agents to do this work safely, where on an ordinary OS the agent
    holds the keys, can approve its own work and can pull any report. Each of these pages cites real attacks on financial
    companies, only with a source (name, date, link, what was taken, as the source states it), then says what GurtOS's
    controls do about that kind of attack and what they do not. Never invent or round up an incident.

Where they show up on the site: the evidence page (/evidence/) carries 12, 11, 10 and 13, and the product itself is on gurtos.com; principles 2 to 6 and 10 to 13 are the
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
| Atlassian | GurtOS Business | to review with Ben |
| Hyphenate | GurtOS Business | decided |
| Factory | GurtOS Server and GurtOS Personal | to review with Ben |
| Armadin | All three editions | decided |
| Microsoft | GurtOS Business | decided |
| Visa | GurtOS Personal, plus GurtOS Server for routines that keep running when you close your laptop | decided |
| Coinbase | GurtOS Server, and GurtOS Business | decided |
| Fetch.ai | GurtOS Server (always reachable), and GurtOS Personal too | decided |
| SpacetimeDB | All three editions, strongest in GurtOS Business | to review with Ben |
| Elastic | GurtOS Business and GurtOS Server | decided |
| Moss | GurtOS Personal | decided |
| Apify | GurtOS Personal and GurtOS Server | decided |
| CRS | GurtOS Business | decided |
| Solana | GurtOS Server, and GurtOS Business | decided |
| Vultr | GurtOS Server | to review with Ben |
| Figma | All three editions | to review with Ben |
| Mana | GurtOS Personal and GurtOS Business | to review with Ben |

## Anthropic: Claude used well for a specific group of people

**Status:** decided. **Page:** https://calhacks.gurtos.com/tracks/anthropic/

**Best shown in:** GurtOS Personal and GurtOS Server

**Pitch:** GurtOS turns a computer you own, even an old one, into one built for agents: each Claude task runs as its own Linux user in its own copy-on-write copy of your files, with no keys, and you approve, undo or pause it from the portal or your phone. It is light and open source. Models are chosen per task with their cost, a Haiku check looks at risky steps, and the attack test is published with its limits. A GurtOS MCP server lets Claude Desktop and Claude Code drive your box.

**The problem:** Solo developers already leave agents (Claude Code, OpenClaw) running at home as themselves, with every key and file. An ordinary OS can't separate them, record them or undo them, and the alternative is renting a cloud you can't see into.

**Features** (from the page's table):

| Feature | Serves | From GurtOS (the OS) | From Anthropic | Status |
|---|---|---|---|---|
| Claude does every task, inside Droid, as its own Linux user in its own copy-on-write copy of the files | Real work with no way to touch another task's files | The worker, the task space, the log and the cost | Claude, through Droid and Factory's SDK | Shipped |
| Keys never reach the agent: a placeholder in the task, the real key swapped in by the proxy | A hijacked or confused Claude has no key to leak | The vault and proxy | Nothing | Shipped |
| A page with hidden instructions fails: the task reaches only its allowed hosts | Prompt injection cannot send anything out | The network rule | Nothing | Shipped |
| Spending waits for your OK, and any one task can be undone | A wrong edit or purchase costs one tap | Approvals and undo | Nothing | Shipped |
| Live view and control from the portal, the phone, the Watch and the Mac menu bar, with the box deciding which device may approve what | You can watch and answer an unattended agent from wherever you are | The portal, the native iPhone, Watch and Mac apps, and the box rule: the Watch approves up to $25, on the wrist, and never a Business request or a Shopper purchase | Nothing | Shipped. iPhone in internal TestFlight, Mac a notarized download |
| A GurtOS MCP server for Claude Code and Claude Desktop | The tools you already use start and watch tasks safely | core/claude-mcp.ts, using a paired device's token | Claude Code and Desktop are the clients | Shipped |
| Current Claude models chosen per task, with their cost | Use the right model for each job and see what it costs | core/models.ts, core/pricing.ts | Haiku, Sonnet and Opus 5.5 | Shipped |
| A Haiku second-opinion check before risky steps | A cheap second look before a step that spends, deletes or uses the network | The approval path | Haiku 5.5 as the checker | Shipped, inconsistent on one case |
| A published attack test with its limits | Honest evidence of where it holds and where it does not | Controls under test | Real Claude tasks as the targets | Shipped |
| Claude Code as a worker, with full isolation | Run Claude Code itself in a task's own space | Would be core's worker | Claude Code | Not built. Cut: every task's worker is Droid running Claude |

**Demo moment and proof:** In every merge-gate run, a real Claude task works as its own Linux user: 240 samples of its processes held only a placeholder key, its changes were undone on their own, and its cost ($0.5378 in the Oct 24 run) was priced from real token counts. The same run reads Claude a web page with hidden instructions to steal keys; it refused, and nothing left the box.

**Still to do:**

- How to enter: pending; Ben will ask a director (the prize is not on Devpost yet)

## Atlassian: Agentic Workforce Challenge, Track 2 (security for agents acting for a user) and Track 1 (agents that do the work)

**Status:** to review with Ben. **Page:** https://calhacks.gurtos.com/tracks/atlassian/

**Best shown in:** GurtOS Business

**Pitch:** Teams already work in Jira and Confluence. GurtOS makes every agent task an issue a teammate can approve or roll back, answers from the log through a Rovo agent, starts agents from an issue, sends risky actions to Jira Service Management approvers and writes the record to Confluence. Business is on main; everything here ran against a GurtOS Server box, except the Jira-user-to-Business-person mapping, which the merge gate checks against offline Jira stand-ins.

**The problem:** Draft: when an agent acts for you overnight, nobody can see the next morning exactly what it did and why, or roll back only the wrong part.

**Features** (from the page's table):

| Feature | Serves | From GurtOS (the OS) | From Atlassian | Status |
|---|---|---|---|---|
| Every task is a Jira issue with its prompt, permissions, reasoning, approvals, blocked attempts, diff and log, and JQL fields for state, cost and blocked attempts | The morning-after question is one search (Track 2: audit and reversion) | The action log and the diff | The Forge app and the issue-property index | Built |
| The task panel: Approve, Deny and Roll back, checked as the signed-in Jira user | Roll back takes out one task's layer and every other task keeps its own (Track 2, technical use of Forge) | Undo of one task | The Forge panel and resolver | Built |
| A Rovo agent, GurtOS, with three actions: ask what got blocked or changed, roll back the shopper's tasks, pause all agents | Ask in plain words with no new screen to learn; Rovo asks before it rolls back or pauses | The log | The Rovo agent and its actions | Built |
| Roll back several issues at once from an issue search | Atlassian's roll back only the changes that were wrong, for 200 issues as easily as for one | Undo | The bulk action | Built |
| Start an agent from Jira: label an issue gurtos-agent, assign it to the agent, or add Run in GurtOS to an Automation rule | The issue's text becomes a task in its own safe space with no network, no keys and a small budget (Track 1) | The task space | The triggers | Built |
| Jira Service Management approvals for risky actions | A production push waits for the people who already approve changes in IT | The approval pause | The JSM request and its approvers | Built |
| Confluence reports: a daily page of what the agents did and an incident page whenever something is blocked | The record outlives the computer | The log | The Confluence writer | Built |
| A dashboard gadget with tasks, blocked attempts and cost per project | The team sees its agents on the dashboard it already uses | None | The gadget | Built |
| A Jira user acts as their GurtOS Business person: only someone with both the Jira permission and the GurtOS role, within their limit, can approve | Jira's permissions and the company's roles together decide who may (Track 2: who may act for whom) | GurtOS Business roles and limits | The Forge resolver | Built |
| Agent permissions: the Jira app's list is its four Atlassian and Jira keys plus taking requests from people and agents not paired with this computer, and the owner can turn any of them off | A team sees and limits what the Jira app may use | The manifest, enforced at the vault, in tools and at the app's public routes | The keys the Jira app declares and its public routes for the Forge panel | Built |

**Demo moment and proof:** BOX-29, a scripted agent that misread a rule, changed three configs instead of one and tried to send a file to a paste site. The upload was blocked, the push was approved from Jira, then the task was rolled back from Jira and its three configs came back. On every merge the gate checks the same roll back leaves another task's fix in place.

**Still to do:**

- Review the story with Ben: problem, features with their why, OS vs track
- Demo video, 3 minutes at most. (partly)

## Hyphenate: Autonomous Systems for Finance

**Status:** decided. **Page:** https://calhacks.gurtos.com/tracks/hyphenate/

**Best shown in:** GurtOS Business

**Pitch:** A finance team needs roles, segregation of duties and an audit trail on every agent decision, which is what GurtOS Business adds: people with roles, approvals routed by rules in plain words, refusals for answering your own request or going above your limit, an Audit view with CSV export and a kill switch. The scored credit desk runs were on GurtOS Server; the Business screens come from a box seeded as the made-up Fogline Supply, with scripted seats and test data. Sign-in with a work account (Microsoft Entra ID) is Entra-ready and tested with a standards test provider, not a real tenant.

**The problem:** Companies want AI employees, but today's computers and clouds weren't built for them. An agent runs as you, with your keys, on one shared filesystem, with no separation of duties, no record you can trust and no undo, so nobody lets one do real finance work.

**Features** (from the page's table):

| Feature | Serves | From GurtOS (the OS) | From Hyphenate | Status |
|---|---|---|---|---|
| Each seat in its own space: its own Linux user and its own copy of the files | Seats cannot touch each other's work | Separate users and a copy-on-write layer per task | Three seat definitions with different tools | Built |
| No seat sees a password | A hijacked seat has nothing to steal | The root-only vault and the core, which makes each call | The CRS and Nessie clients | Built |
| A seat cannot approve its own work | Separation of duties | The approval pause, the routing rules and the refusals on Business | Where the line is: $10,000 for the analyst and every fraud hold | Built |
| Only the analyst records credit decisions and only the clerk collections actions | Separation of duties by tool access | Per-task tool lists | The tool set and rules SOD-1 to SOD-3 | Built |
| One append-only record of every call, decision, rule id and approver | Every call traceable | The action log | Rule ids and CRS request ids on each decision | Built |
| People, roles, rules that route approvals, a Waiting for me inbox, an Audit view with CSV export and a kill switch | A finance team has people with limits, not one login | GurtOS Business | None | Built |
| A decision reopened months later: two payments bounce in January and the analyst proposes a cut to October's $40,000 decision | A decision made in October is not final | The append-only log and the approvals | Rule REV-6 and the review route | Built |
| Ask why: why was this decided and does it still hold | An auditor can ask months later and get one answer from the log alone | The log | The why route | Built |
| A third seat, the AP clerk, with its limits in code: no duplicate payment, no paying a bill it entered itself without a second person, the controller above $5,000, no payment to bank details changed by email without a confirming call | One more role at the same depth, plus an attack on it: a bank change from a lookalike email | Tool-enforced seats | Rules AP-1 to AP-4 and the tools | Built |
| Real books in Beancount, entries only through the desk's books tool, a fix is a new entry linked to what it corrects | A reversal and a repost, not an edit | The log and undo of one task, which takes its entries out | The books tool | Built |
| A no carries a reason: Deny asks for one and the seat revises instead of asking again | A system of work handles a rejection | The approval pause | The revise step | Built |
| Pull the plug while a request waits: each request is asked once, answered once and each bill paid once | A crash must not double-pay | The fsynced log and resume from it | pay_bill checks the bank first, since Nessie takes no idempotency key | Built |
| Fairness by construction: the seats never see protected attributes or the guarantor's name, SSN, date of birth or address | Responsible design | None | The desk's redaction and fairness.test.ts | Built |
| A plain letter for every adverse decision, with the main reasons | An applicant gets a reason in words | None | letters.ts | Built |
| Two analysts that split the work from one shared queue | Several agents can share one case without colliding | The SpacetimeDB queue and its atomic claim | The opt-in Coordinate option | Built |
| Bring your own: an application on one of CRS's 20 test people, or uploaded case files, checked first | A judge can try a case of their own | None | The Bring your own tab and check-case | Built |
| A public benchmark slice: the 10 public DABstep dev questions through GurtOS tasks, 7 right, no network, about $3.22 of model use | Proof beyond our own planted case | Tasks with no network | bench/ | Built |
| Agent permissions: the owner sees what the desk may use (the CRS and Nessie keys and money) and can turn any of it off, or set money per day | The owner controls the desk's keys, money and hosts; the seats and Business routing separate the duties | The manifest, enforced at the vault, in tools and in the broker, with every refusal logged | The keys and spending tools the desk declares | Built |

**Demo moment and proof:** The full live run with real Droid on all three seats, scored from the action log against the answer key: 16 of 17 planted errors caught, 1 false alarm (precision 97%), all 6 credit decisions right (outcome, band, limit and terms), in 12 minutes for about $5.24. It held APP-1043, a synthetic identity that a simple rule approves for $20,000. The January review caught 2 of 2.

**Still to do:**

- A video that opens with your "moment". (partly)

## Factory: Droid SDK track

**Status:** to review with Ben. **Page:** https://calhacks.gurtos.com/tracks/factory/

**Best shown in:** GurtOS Server and GurtOS Personal

**Pitch:** Droid does the work and GurtOS makes it safe. Each Droid task is its own Linux user with its own firewall rule and its own copy of the files, and Droid never holds a key: the vault keeps it and the box's proxy swaps it in outside the task. Droid plans first and starts only after you approve the plan on your phone, a read-only reviewer droid checks the coder's diff, and every change is reviewable in the log and undoable. In August 2025 malicious Nx packages used AI CLIs already on developers' machines, started with permission-skipping flags, to hunt for tokens and keys. A Droid on GurtOS has none to find.

**The problem:** Draft: coding agents need keys to work, and tools keep leaking them (the OpenCode Console breach, OpenClaw's plaintext key file, CVE-2026-25253). Today the agent runs as you, on your files, with your keys in its environment.

**Features** (from the page's table):

| Feature | Serves | From GurtOS (the OS) | From Factory | Status |
|---|---|---|---|---|
| Droid is the worker in every task, started through the Droid SDK with Claude | Droid SDK does real work | Creates the task user, copy and unit, resumes the session after a power cut, prices the usage | Droid, spec mode, custom droids, Factory's SDK and billing endpoint | Shipped |
| Plan first, then approve | Visible plans | The approval on the portal and phone, kept in the log | Spec mode writes the plan, ExitSpecMode asks | Shipped |
| A team of custom droids: coder, reviewer (read-only), credit analyst, shopper | Careful limits on what each droid touches | The task's tools and hosts bound every droid | The droid definitions and the Task tool | Shipped |
| Autonomy levels the OS enforces: low takes away the network and makes every spend ask, medium caps the budget at $1 | Careful limits | createTask sets hosts and budget, so the firewall and budget hold even if Droid ignores its level | Factory's autonomy levels | Shipped |
| Droid hooks report to GurtOS: each tool result is logged, and risky commands (rm -rf, git push, sudo, npm publish, curl to sh) pause for an OK | Visible steps | The log and the approval | Factory's PreToolUse and PostToolUse hooks | Shipped, as a convenience (see limits) |
| Droid on GitHub: an issue labelled droid becomes a plan-first task on its own clone, and a pull request opens through the vault's token | Triggers you designed | The vault holds the token and the core pushes, so the task never has it | The issue watcher and the pull-request tool | Shipped |
| gurtos-exec, a safe runner for droid exec | Triggers you designed | Runs the job as its own user, keyless, and returns steps, diff, cost | droid exec's flags and output | Shipped |
| Factory usage in the portal: credits per task and the plan's 5-hour and weekly use | Visible results | The key stays in the core | Factory's billing endpoint | Shipped |

**Demo moment and proof:** In every merge-gate run, a Droid task (Claude) edits a file as its own Linux user while the box samples its processes: all 240 samples held only a placeholder Factory key, because the box's proxy adds the real key on the way to Factory. Its cost, $0.5378 in the Oct 24 run, is priced from the token counts Droid reports.

**Still to do:**

- Review the story with Ben: problem, features with their why, OS vs track

## Armadin: Best Security Hack

**Status:** decided. **Page:** https://calhacks.gurtos.com/tracks/armadin/

**Best shown in:** All three editions

**Pitch:** Agents get attacked through the pages they read and the packages they install, and on an ordinary OS a fooled agent can read every key and send it anywhere. GurtOS stops it at the OS, whatever the model does, in every edition, and publishes the score: of 16 OS-level attacks, 14 caught and 2 published as not covered, on two machines. A poisoned package imitating the 2025 npm worm and a hijacked payment both fail. Tripwire keys and a seccomp-filtered, CPU-capped sandbox are built.

**The problem:** Agents get attacked through the pages they read and the packages they install, and on an ordinary OS a fooled agent can read every key and send it anywhere.

**Features** (from the page's table):

| Feature | Serves | From GurtOS (the OS) | From Armadin | Status |
|---|---|---|---|---|
| Keys in a root-only vault, never in a task's files or environment | A hijacked agent reads every key | The vault and the broker. The proxy swaps in the one key every task needs, the model key | Nothing; this is the OS | Shipped |
| Each task is its own Linux user in its own copy of the files, seeing no process but its own | A task reads another task's files or the box's | Users, systemd hardening, overlayfs | Nothing; this is the OS | Shipped |
| A per-task network rule and a proxy allowlist | Stolen data has nowhere to go | nftables on task users, the proxy | Nothing; this is the OS | Shipped |
| Approvals, an append-only log and undo of one task | A fooled agent cannot approve its own action, and the damage is removable | The approval path and the log | Nothing; this is the OS | Shipped |
| The poisoned npm package, run with a real npm install | The September 2025 worm | Task user, vault, network rule, undo | The harmless imitation package and its test | Shipped |
| Tripwire keys: a decoy AWS key pair in every task, derived per task and never logged | A hijacked agent that hunts for keys gives itself away | The proxy looks for the decoy, ends the task undone, writes a security note and alerts the owner's phones | Nothing | Shipped, with limits |
| A deeper per-task sandbox: a seccomp filter, kernel protections, two CPU cores, 2 GB of memory with no swap, 512 processes | A task that tries to widen its own reach in the kernel | The sandbox settings in core | The tests that check it on every merge | Shipped |
| The 16-attack scoreboard with the misses published | A score you can check, not a claim | Controls under test | The attacks, the runs on two machines, SCOREBOARD.md | Shipped |
| The hijacked payment: a lookalike-sender bank change and an over-limit bill | Fraud by fooling an agent or a person about where money goes | Approvals | The credit desk's AP clerk rules (AP-4, AP-2) | Shipped |
| OWASP Top 10 mapping for LLM Applications 2025 and Agentic Applications 2026, with a not-covered column | A checklist a security reviewer already knows | Nothing | OWASP.md | Shipped |

**Demo moment and proof:** In every merge-gate run, a scripted agent obeys the hidden instructions step by step and is stopped at each one: the vault read fails (EACCES), the send to attacker.example is refused by the proxy, a raw connection to 1.1.1.1 is refused by the firewall, and reaching SpacetimeDB or the box's API to approve itself is refused. Then real Claude reads the same page: it refused, and no vault secret appeared in its files, environment or log.

**Still to do:**

- Nothing open.

## Microsoft: Built for the Real World, and the Customer Impact Award

**Status:** decided. **Page:** https://calhacks.gurtos.com/tracks/microsoft/

**Best shown in:** GurtOS Business

**Pitch:** Companies want agents on finance work, but an ordinary OS gives an agent its owner's keys, no separation of duties, no record and no undo, so pilots stay pilots. GurtOS Business gives each seat its own user, routes approvals to the right person, runs a seat in shadow mode until it has earned trust, keeps an audit and a kill switch, on a computer the company owns. Measured incident drill: 10 agents frozen within 271 ms, a bad batch undone in 48 ms. Business is on main; the scored credit desk runs were on GurtOS Server, and the Business screens come from a box seeded as the made-up Fogline Supply. Sign-in with a work account (Microsoft Entra ID) is Entra-ready and tested with a standards test provider, not a real tenant.

**The problem:** Companies want agents doing finance work, but an ordinary OS gives an agent its owner's keys, no separation of duties, no record and no undo, so pilots never reach production.

**Features** (from the page's table):

| Feature | Serves | From GurtOS (the OS) | From Microsoft | Status |
|---|---|---|---|---|
| Each seat is its own Linux user with its own copy of the files, and keys stay in a root-only vault | A finance agent holds nothing it could leak or misuse | Separate users, a copy-on-write layer per task, the vault | None | Built |
| A seat cannot approve its own large proposal, and fraud holds always go to a person | Separation of duties for an agent | The approval pause and routing | Where the line is: above $10,000 and every fraud hold | Built |
| Undo one seat's work, resume after a power cut with nothing paid twice, and whole-system updates that roll back | A bad hour is recoverable | Per-task undo, the fsynced log, update slots | pay_bill checks the bank first | Built |
| People with roles and agent seats, each phone paired as its person | A company has its own people, not one login | GurtOS Business | None | Built |
| Rules in plain words route each approval, and answers are refused for your own request, above your limit, or by anything that is not a person | Separation of duties a team can read and change | GurtOS Business | None | Built |
| Waiting for me and My requests on phone and desktop | Each person sees only what is theirs to answer | GurtOS Business | None | Built |
| An audit with filters by person, seat and date, CSV export, read-only for an auditor | Something an auditor can read without asking IT | GurtOS Business | None | Built |
| One kill switch pauses every agent, on every edition | The first thing a company asks is how to stop it | GurtOS Business, shared with Personal's pause | None | Built |
| Shadow mode and a one-week pilot plan with a go-live bar | A company starts with a pilot it can switch off | GurtOS Business | None | Built |
| Sign-in with a work account (OpenID Connect, Microsoft Entra ID), roles from Entra groups | Joining and leaving happen in one place | GurtOS Business | None | Built |
| Measured impact per run beside the simple rule | A controller can say what the desk is worth | The action log | impact.ts, the Impact view | Built |
| Each control mapped to the six Responsible AI principles, a protected-attribute test and a plain letter for every adverse decision | A judge can check each claim | The vault, the log and the approvals | RESPONSIBLE.md, fairness.test.ts, letters.ts | Built |
| Published, cited facts about the customer, with their scope | The case rests on real failures | None | CUSTOMER.md | Built |
| A measured incident drill: kill switch, undo, resume, each timed | The answer to what if it goes wrong is a number | The kill switch, undo and resume | None | Built |
| Agent permissions: each app's list of what it may use, and the owner turns any item off or sets money per day | Least privilege for every app, with every refusal on the record | The manifest: keys at the vault and in tools, money in the broker (over the daily limit becomes a request), shell, hosts and folders when a task starts, strangers at public routes | The keys and tools the desk declares | Built |

**Demo moment and proof:** Measured on a live credit desk run with 10 agents working (3 Droid seats on Claude, 7 scripted): the kill switch froze every agent within 271 ms, none took a step while paused, and a bad batch was undone in 48 ms with every other task keeping its work. Scored against the answer key, the full live run caught 16 of 17 planted errors and held a $20,000 fake applicant a simple rule approves.

**Still to do:**

- Nothing open.

## Visa: Reimagining Shopping

**Status:** decided. **Page:** https://calhacks.gurtos.com/tracks/visa/

**Best shown in:** GurtOS Personal, plus GurtOS Server for routines that keep running when you close your laptop

**Pitch:** GurtOS Personal runs your shopping agents on a computer you own, even an old one: the agent never sees your card, every purchase waits for your tap, every order is signed so the store can verify it, and undo refunds it. A Server box keeps a watch running while the laptop is closed.

**The problem:** Shopping agents need your card or your password, stores can't tell a good agent from a bot, you can't see or stop what they do, and cloud agents run on computers you don't control.

**Features** (from the page's table):

| Feature | Serves | From GurtOS (the OS) | From Visa | Status |
|---|---|---|---|---|
| The agent never sees your card: the card and the signing key stay in the root-only vault, and only the buy tool in the core reads them | Trust (15) | The vault and the broker | The buy tool that reads the card | Built. The merge gate checks no card, key or password is anywhere in the log |
| Every purchase waits for your tap, with the price against your limit | Trust (15), UX (25) | The approval pause and the task budget | The question text and the price rule | Built |
| Approve with Face ID: a WebAuthn passkey signs the exact question and amount, and a purchase approved without one is refused | Trust (15), UX (25) | The approval pause, the box verifying the signature, and the rule that an Apple Watch never approves a Shopper purchase | The passkey flow in the Shopper app | Built. The demo uses a software authenticator; QA has not tried it on a real phone; a passkey belongs to the https address it was made on, and there is no remove button yet |
| Per-app permissions: the owner sets how much the Shopper may spend per day, and a spend over it becomes an approval question | Trust (15) | Each app's manifest (the keys it declares, money because a tool spends, and what it was seen using), enforced by the OS: money in the broker, keys at the vault and in tools; every refusal logged in plain words | The Shopper's tools that spend and the keys it declares | Built (core 4b473ea). It adds to the per-purchase tap, it does not replace it. The Settings screen is still landing, so today the owner sets it through the API |
| Each checkout is signed with Visa's Trusted Agent Protocol, including the order body | Commerce impact (15), Technical (20) | The signing key in the vault | The signer and the store that verifies it | Built. The store refuses unsigned, changed and replayed orders |
| A signed shopping mandate: item words, stores, price per item, quantity, total and an expiry of at most 30 days, enforced by the store | Innovation (25), Trust (15) | The box's agent key in the vault | The mandate and the store's checks | Built. It mirrors the payment instruction in Visa Intelligent Commerce with open tools; it is not a Visa product |
| Undo refunds the order | UX (25), Trust (15) | Undo of one task | The refund at the store | Built |
| Standing instructions: "when it's under $16", "keep us stocked" | Innovation (25) | Scheduled and triggered tasks | The Shopper app, with Claude in Droid | Built |
| Live prices through Apify, from the store and not the model | Technical (20), Trust (15) | The broker, so a task with no network gets a price | The Shopper app and the Apify app | Built. Best Buy Canada's Conditions of Use prohibit scraping; see the limits |
| Comparison across Best Buy Canada and Gold Roast: the best total with shipping wins, with the reason | Technical (20), UX (25) | The same broker path | The comparison | Built |
| Card-style spending rules: a monthly cap, a cap per store and category, and never-buy words, checked before asking and again before paying | Trust (15), UX (25) | The approval pause | The rules | Built. Saving them needs Face ID |
| The merchant dashboard: verified agent orders, bots refused by reason, conversion and chargebacks | Commerce impact (15) | The action log it reads | The GurtOS Test Store | Built. At our stand-in store, with test payments |
| Price protection for 30 days and unused subscriptions found and cancelled with your OK | Innovation (25) | The approval pause | The Shopper app | Built at the GurtOS Test Store, which knows its own price; the subscriptions are three samples in a demo mailbox |
| Payments behind one interface: Stripe test mode, the Cybersource sandbox and a Visa Intelligent Commerce adapter | Technical (20) | The vault holds each processor's keys | The adapters | Built for Stripe test mode and Cybersource (a charge, a partial refund and a full refund tested live on Oct 24). The Visa Intelligent Commerce adapter has never been called, because it needs onboarding with Visa |

**Demo moment and proof:** In the live run on Oct 23, Apify read Chemex filters at Best Buy Canada for $15.36 CAD, the box asked, and after the tap it bought them at that price with a Stripe test-mode charge on a Visa test card. Undoing the household reorder refunded it in Stripe test mode. Every payment was test money.

**Still to do:**

- Visa Intelligent Commerce (not built)

## Coinbase: x402 Payment Agents

**Status:** decided. **Page:** https://calhacks.gurtos.com/tracks/coinbase/

**Best shown in:** GurtOS Server, and GurtOS Business

**Pitch:** GurtOS is the environment that makes an agent wallet safe: the key never reaches the agent, each task has a budget, anything over it waits for your tap on the phone, and every payment is on the record. Agents pay for APIs with x402, shop for them in the x402 Bazaar and pay metered APIs with a hard cap, and the box earns too: its own paid routes are listed in the Bazaar. GurtOS is open source (Apache-2.0), and one command installs the same wallet for Claude Code or any MCP agent.

**The problem:** Giving an agent money means handing it your card or a private key, on a heavy system or a cloud with no layer built for this: no separation, no safe key handling, no record and no undo.

**Features** (from the page's table):

| Feature | Serves | From GurtOS (the OS) | From Coinbase | Status |
|---|---|---|---|---|
| The key never reaches the agent | Technical design | A root-only key file, opened only by wallet.pay inside the box; each task is its own Linux user | None | Shipped. The live run checks neither the wallet key nor the CDP secret is in the log |
| Pay for APIs with x402 | Usefulness | The box fetches the URL, only from the task's hosts, no redirects | x402 v2 SDK, exact scheme; settled by the CDP facilitator, which pays the fee | Shipped. 70 fixed-price payments on devnet |
| Budget, then the owner's OK on the phone | Usefulness, technical design | Budgets reserved before the call, so two payments at once cannot both slip through; the pause names the amount, payee and URL | The x402 client policy: exact price, devnet USDC only, at most $1 a payment | Shipped |
| Approve from the iPhone with Face ID, the Mac with Touch ID, or the Watch up to $25 | Usefulness, technical design | The box decides what each device may approve and logs how it was checked: "Approved by iPhone (Face ID, reported)" | None | Shipped. The iPhone and Watch apps are in internal TestFlight testing |
| Every payment on the record | Technical design | The append-only action log: amount, payee, task, transaction | The settlement receipt | Shipped |
| The box earns over x402: audit proof $0.01, metered search up to $0.02, renting its agent $0.25 after the owner approves | Usefulness | Only these routes open to strangers; renting starts a task only after the owner says yes | @x402/express sellers, CDP facilitator, Bazaar metadata | Shipped. Live at gurt-cloud.box.gurtos.com |
| Listed in the x402 Bazaar | Usefulness, reuse | A public HTTPS address for the box (remote access) | Bazaar cataloging on the first settled payment | Shipped. A lookup by pay-to address returns both paid routes; free-text search did not find them on Oct 24 |
| Agents shop for APIs: wallet.discover | Usefulness, reuse | Drops any offer above the task's remaining budget | Bazaar discovery search | Shipped |
| Metered APIs: wallet.payMetered | Technical design | The cap counts against the budget | The upto scheme | Shipped. A search capped at $0.02 was charged $0.002. Until the core reads the settled amount, the task's cost counts the cap |
| Two locks: a CDP Server Wallet whose policy signs only for listed payees, under the cap, in USDC | Technical design | Budgets and phone approvals come first | CDP Server Wallets and the policy engine | Built and unit-tested, not run live: it needs a CDP Wallet Secret. Live runs use the root-only key with the payee list and cap checked by GurtOS |
| Reuse in one command: install.sh for Claude Code, Droid or any MCP client | Ease of reuse | The same budget and approval rules, as an MCP prompt | x402 SDK | Shipped. A real Claude Code session installed it and paid $0.01 over MCP |
| Top up from the phone | Usefulness | The wallet page on the portal and phone | Coinbase Onramp | Sandbox only, and only the session step is verified: a $5 USDC quote on Solana on Oct 24. The checkout was not opened, and the link it returns points at Coinbase's live host, so treat the button as a flow test, not a purchase. Test money comes from Circle's faucet |
| Open source, Apache-2.0 | Ease of reuse | The whole OS and the wallet | None | Shipped |

**Demo moment and proof:** A real agent (Droid with Claude) was told only "buy one joke and one report". It quoted both, paid $0.01, waited for the OK on the $0.03 report, then paid it. Both payments settled through Coinbase's CDP facilitator and are confirmed on Solana devnet, and neither the wallet key nor the CDP secret appears anywhere in the task's log. The box's own paid routes are listed in Coinbase's x402 Bazaar.

**Still to do:**

- Verified Coinbase account. (partly)
- CDP Server Wallet run live (not built)

## Fetch.ai: ASI:One Agent Challenge

**Status:** decided. **Page:** https://calhacks.gurtos.com/tracks/fetch/

**Best shown in:** GurtOS Server (always reachable), and GurtOS Personal too

**Pitch:** GurtOS gives an ASI:One agent a safe body on a computer you own, even an old one: each chat request runs as its own sandboxed task with no keys, asks before it spends, and can be undone, and the portal and phone show it live. A team of agents on Agentverse fronts the box, strangers' agents' replies are treated as data (a hidden instruction is blocked and logged), and payments run in test FET through the box's one budget path. A Server box answers at 3 AM through its Agentverse mailbox with no open port.

**The problem:** A chat agent can only act if it runs somewhere: a cloud you can't see into, or your own computer with full access. Agents that talk to strangers' agents can be fed hidden instructions.

**Features** (from the page's table):

| Feature | Serves | From GurtOS (the OS) | From Fetch.ai | Status |
|---|---|---|---|---|
| Each chat request is its own task: own Linux user, own copy of the files, no keys, no network of its own | Real tool use, done safely | Task users, copy-on-write files, the key file, per-task network | The request arrives over the Agent Chat Protocol | Shipped |
| The box as an agent on Agentverse, with its whole flow in the ASI:One chat | Required | The same HTTP API as the portal and phone | uAgents, the Agentverse mailbox, the Chat Protocol, ASI:One planner mode | Shipped |
| Only the paired owner gives work; the pairing code shows only on the box's screen or the owner's phone | Real action, safely | Pairing; at most ten wrong codes a minute | Chat sessions | Shipped |
| Over budget, an Approve or Deny card; the result with its diff and Keep or Undo | Interactive Cards bonus | The approval pause and undo | ASI:One Interactive Cards | Shipped |
| A team of agents: Shopper, Find and Credit Desk | Multi-agent bonus | Each app on the box stays its own task with its own limits | The Chat Protocol between agents | Shipped. Find and Credit Desk answer only their own box |
| Strangers' replies are data: a hidden instruction is blocked, described and logged, never quoted | Real tool use, safely | A reply cannot start a task, approve, pay or pair, and no task holds a key | The screening in guard.py, with asi1-mini as a second opinion | Shipped. The live run blocked our trap and relayed Fetch.ai's real Weather Agent |
| The Payment Protocol in test FET, both ways | Payment Protocol bonus | The one budget and approval path; the wallet key stays in the core | RequestPayment, CommitPayment, CompletePayment on Fetch's testnet | Shipped as test money |
| A team of box agents on one SpacetimeDB queue | Multi-agent bonus | The shared queue with atomic claims | The request arrives from the chat | Shipped. Live with real Droid: 3 agents, each job to exactly one, 3 of 3 finished |
| Reliability: outbox, restart within 5 seconds, resume after a power cut | Reliability bonus | Resume from the action log | The outbox and the chat message saying so | Shipped |
| Pick your machine from the chat | Multi-agent bonus | Each machine named by its GurtOS edition | Link another box with a code and an HMAC proof | Shipped. A linked machine only answers, never gives orders |
| Guest requests from strangers | Real action, safely | One guest path shared with Mana: nothing runs before the owner says yes; then no network and a 25 cent budget | The chat | Shipped. At most 3 per guest an hour and 10 from all guests |

**Demo moment and proof:** In a live run through ASI:One, the box's agent paired with the chat, a Droid task fixed the failing test in a sample repo for $0.05 and sent back the diff with Undo, and a stock check paused at a $0.50 web search over its $0.25 budget, sent an Interactive Card, and finished after Approve: "in stock on Hario's US store at $10.25".

**Still to do:**

- 3 to 5 minute video. (partly)
- Also submit through the ASI:One Submission Agent. (open)

## SpacetimeDB: SpacetimeDB as the core real-time backend

**Status:** to review with Ben. **Page:** https://calhacks.gurtos.com/tracks/spacetime/

**Best shown in:** All three editions, strongest in GurtOS Business

**Pitch:** The usual stack for live agent state, a database, a websocket server, a cache and auth glue, is heavy and fragile. GurtOS runs one self-hosted SpacetimeDB per box as its live nervous system, with the rules enforced in the database: agents claim shared work atomically, each person is sent only their own requests, and the first answer to a request wins. It is light, open source and part of the GurtOS suite. The fleet view runs on SpacetimeDB Maincloud, is off by default on a new box, and reports counts only, never a prompt, a file or a key.

**The problem:** Live agent state usually needs a database, a websocket server, a cache and auth glue, which is heavy and fragile, and an ordinary OS has nothing for it.

**Features** (from the page's table):

| Feature | Serves | From GurtOS (the OS) | From SpacetimeDB | Status |
|---|---|---|---|---|
| Tasks and requests mirrored live; the box screens answer through the answer reducer | Live shared state, instant sync | The box writes every change through putTask and putApproval, which refuse anyone but the box, and vouches for screens with registerDevice | Tables, reducers, subscriptions | Shipped |
| A shared work queue with atomic claims and agent presence | Agents coordinating | Four broker tools (spacetime.claim, finish, post, team); the box names the task, so one agent cannot claim as another; a task that ends holding a job gives it back | The claimJob procedure in one transaction; the agent table | Shipped. 15 claims on 12 jobs gave 12 distinct jobs. Used live by Fetch.ai (3 Droid agents) and the credit desk (two analyst agents) |
| Each person is sent only their own requests | Meaningful use, security | GurtOS Business routes each request to the people who may answer it | Private request and routed_to tables and a per-connection my_requests view | Shipped. Rosa's client gets what is routed to her; Priya's and a stranger's get nothing |
| No double approvals, with who is viewing | Instant sync | Every surface answers into the same row | The first answer wins in the reducer; the later one is refused with "already approved by" and the name; presence per connection | Shipped |
| Timers in the database | Meaningful use | Phone pushes still come from the core | A scheduled reducer brings a second person into a request still pending | Shipped as the mechanism: the demo brought Priya in after 3 seconds. The Business policy has no reminder line yet |
| Live meters: running, needs you, done, failed, spend, activity per minute | Instant sync | None | Kept by the reducers as tasks change; no screen adds anything up | Shipped. The demo checks the meter against the box's own task list |
| One live view across machines on Maincloud, counts only | Meaningful use | Opt-in from the Computers tab | Maincloud and a per-viewer my_machines view | Built. Runs on SpacetimeDB Maincloud (database gurtos-fleet), off by default on a new box. Three live checks passed on main: the box reports to Maincloud when the owner turns it on, a viewer the box granted sees it live while a stranger is sent nothing, and turning it off removes the computer and every grant |

**Demo moment and proof:** In every merge-gate run, a task stops over its budget and SpacetimeDB shows the request live with its amount, payee and purpose while another task keeps running. The OK goes through the answer reducer under the name the box vouched for, a stranger's identity is refused, and the task finishes. In the queue check, 3 agents made 15 claims on 12 jobs at once and got 12 distinct jobs, none twice.

**Still to do:**

- Review the story with Ben: problem, features with their why, OS vs track

## Elastic: Best use of Elastic Agent Builder on Serverless

**Status:** decided. **Page:** https://calhacks.gurtos.com/tracks/elastic/

**Best shown in:** GurtOS Business and GurtOS Server

**Pitch:** After a week of agents working, an ordinary OS cannot tell you what they did, and anyone with root can edit its logs. GurtOS keeps one action log of every action and chains each entry to the one before, and Elastic keeps a copy the box cannot rewrite, so a changed entry is caught. Elastic's agent answers and investigates, and its alert rules and the agent can only leave a request: the box turns it into one approval on your phone.

**The problem:** After a week of agents working, an ordinary OS cannot tell you what they did: its logs are scattered and anyone with root can edit them.

**Features** (from the page's table):

| Feature | Serves | From GurtOS (the OS) | From Elastic | Status |
|---|---|---|---|---|
| One append-only action log of every step, tool call, cost, approval, block, undo and failure | One place to ask, not scattered files | The log | Nothing | Shipped |
| The log streams into a Serverless index, each event once, with the Elastic key held by one core job | The record lives outside the box and no task can reach the key | The vault, the core job, the outbox | The Serverless index and the create-only key | Shipped |
| An Agent Builder agent, GurtOS log, with 14 ES/QL tools, a workflow tool and an index search tool | Plain-words answers to what changed, what it cost, why it failed | The data it reads | Agent Builder, ES/QL, the agent as code in agent.ts | Shipped |
| A record root cannot rewrite without being caught | A changed, removed or reordered entry breaks the chain, and a full rehash is still caught | The hash chain in core/log.ts and the box's own ten-minute check | The create-only copy and the box.verify_log tool | Shipped, with limits (see above) |
| Four alert rules that arrive as one approval on the owner's phone | The morning after becomes the minute it happens | The approval and the phone push | Kibana alerting rules in ES/QL | Shipped |
| The agent can ask to undo a task, and only ask | Elastic never holds the power to act | Policy routing, the phone, the undo | The workflow tool | Shipped for undo only |
| A fleet and who-approved-what view: every installed box ships to one index, each Business person has a key that copies their role | A team sees every box, and each person sees only what their role allows | Business roles and who on every entry | Document-level security and tools by person, seat and approver | Shipped. Person keys are made by hand today |
| Search by meaning: a plain sentence per entry in a semantic_text field | Find a step without knowing what it was called | The sentences | ELSER and ES/QL MATCH, the box.search_meaning tool | Shipped |
| Ask GurtOS, an app in the portal and on the phone, and a Kibana dashboard | A person asks in plain words, as themselves, and no key sits in the page | The app and the vault | The converse API and the dashboard | Shipped. The Ask page itself is not in the merge gate and is not shown here |

**Demo moment and proof:** Asked "Why did the job routine fail? Look at demo run a18523.", the agent found the failed task with box.failures, read its timeline and named the root cause itself: the routine was allowed to reach only boards.greenhouse.io, its plan needed www.linkedin.com, the box blocked it, and the task failed right after. A live run shipped all 156 events of a demo run to Serverless, each exactly once.

**Still to do:**

- Nothing open.

## Moss: A personal agent that remembers you

**Status:** decided. **Page:** https://calhacks.gurtos.com/tracks/moss/

**Best shown in:** GurtOS Personal

**Pitch:** A personal agent is only useful if it remembers you, and today that means uploading your life to someone's cloud, while any page an agent reads can plant a false memory. On GurtOS Personal the index lives in your own computer's memory, agents search it with no network and no keys, a task that reached the web cannot add to your memory without your answer, one preference reaches every app, a Forget button removes what you choose, and you can ask out loud. Ask a question and get a short answer in about 0.3 seconds from Moss Inference, or on your own machine; the search never leaves the computer. A fresh computer calls no model, and Claude describes photos only when you press a button, which sends them to Factory.

**The problem:** A personal agent is only useful if it remembers you, and today that means uploading your life to someone's cloud, and any web page an agent reads can plant false memories.

**Features** (from the page's table):

| Feature | Serves | From GurtOS (the OS) | From Moss | Status |
|---|---|---|---|---|
| One index of photos, text files and finished tasks, searched in about 3 ms | A personal agent that remembers you | The task history and the workspaces the index reads | Moss's index running in the computer's own memory, and the Find app | Built. Median 3.1 ms through the computer on both test VMs, under 1 ms inside Moss |
| An agent searches with no network and no Moss key | Works across your apps | The broker and the network rule: the tool runs in the core | The find.search tool | Built. The merge gate checks it every run |
| Agents are handed relevant memory before a task starts, and each sees only what its permissions allow | A personal agent that remembers you | Per-task permissions, and a core hook that adds memory to a task's prompt | Moss finds the relevant notes by meaning | Built. A step in the task log reads Handed over N memory blocks |
| Agent memory that cannot be poisoned: a task that could reach the web is untrusted and cannot add to memory without the owner's answer | A personal agent that remembers you | The approval path, the untrusted tag and the log | The memory store and the Find page's red badge | Built. The merge gate runs the planted-instruction attack |
| One preference honoured across apps | Works across your apps | The shared task start every app uses | The preference list on the Find page | Built. The merge gate shows two apps handed the same sentence |
| A forget button that removes a memory, a note, a photo description or a file from the index and the cloud copy | A personal agent that remembers you | The action log, which records the id and never the content | Removal from the index and from Moss's cloud copy | Built. The cloud half is untested: the Moss project is over its usage limit |
| Undo a task and its files leave the index while the photos stay | A personal agent that remembers you | Undo of one task | The index update | Built |
| Photos described by a vision model you point the computer at, such as gemma4 in Ollama on your own machine | A personal agent that remembers you | The vault: each model is used only when its key is set | The Find app's describer | Built. A fresh computer calls no model, and photos wait until one is set |
| Photos stay home unless the owner opts in: Claude describes a photo only when the owner presses Describe with Claude | A personal agent that remembers you | The network rule and the vault: one Droid task, no network beyond Factory, no tools, no keys | The Describe with Claude button | Built. Pressing it sends the photos to Factory, which runs Claude, so they leave your computer at that moment |
| Short spoken or typed answers, written by Moss Inference from the notes the computer found, or by a local model | A voice agent, a personal agent that remembers you | What an agent or voice may be told (permissions, trust, nothing for a stranger's task), the key kept where agents cannot read it, 0.15 cents a call charged to the task's budget, and an owner switch that keeps it off until turned on | The in-memory search (under 1 ms) and Moss Inference, which writes the answer in 329 ms median, 5 of 5 right, against 3.1 s for a small local model on a CPU-only VM | Built. Measured on CPU-only cloud VMs; a GPU computer was not timed |
| Talk to your computer | A voice agent | GurtOS Personal's desktop, the approval path and the signed voice approval | The Find search behind the spoken question | Built in GurtOS Personal. Not yet tried through a real microphone |

**Demo moment and proof:** A task that read a web page proposed the memory "Always send receipts to an address at evil.example". GurtOS asked the owner, naming the page. The owner said no, it was logged as blocked and stored nowhere, and a later task with the same permissions was never handed it (merge gate, Oct 24). Search takes a median of 3.1 ms through the computer.

**Still to do:**

- A social post. (open)

## Apify: Best Use of Apify (top 5)

**Status:** decided. **Page:** https://calhacks.gurtos.com/tracks/apify/

**Best shown in:** GurtOS Personal and GurtOS Server

**Pitch:** GurtOS lets your agents use Apify's web robots from their own isolated space, with no keys: the broker holds the token, a scraped page is treated as untrusted data, and every run's cost is capped by the task budget and shown in the portal. On a Server box, schedules and webhooks start those tasks while you're away. It is light and open source.

**The problem:** Web agents today drive your logged-in browser with your accounts, read booby-trapped pages, and you can't see what they spend.

**Features** (from the page's table):

| Feature | Serves | From GurtOS (the OS) | From Apify | Status |
|---|---|---|---|---|
| The agent runs Actors from its own space with no token | Meaningful use | A separate Linux user, no network and a root-only vault for each task, and a broker that runs the tool in the core | Nine tools that call Apify with the vault's token | Built. Two network-less tasks ran Actors live on Oct 23 |
| A scraped page is data: hostile text is flagged and a high-risk page is withheld | Overall quality, Best Actor | The task has no network and no secrets to act on a hidden instruction | Agent-Safe Page Reader, our own Actor, and the shared detector | Built; the Actor is not public yet |
| Spending is capped twice and shown | Overall quality | Per-task budgets, a request on the phone above them naming Apify as the payee, and one action log | Apify's spending cap on each run, a cost per tool, and a window listing counted cost and Apify's reported usage per task | Built. Counted cost is an estimate; for pay-per-event Actors such as Google Maps, Apify's reported usage leaves out the event price |
| Per-app permissions: the owner can turn off Apify's key, its spending or the requests strangers send to its webhook route | Overall quality | Apify's manifest (its three keys, money, and requests from strangers at its open route), enforced by the OS: the key at the vault and in tools, money in the broker, strangers at the open route; every refusal logged in plain words | The keys and tools Apify declares | Built (core 4b473ea). Apify's tasks reach no sites themselves, because its tools run in the core, so its manifest lists no hosts. The Settings screen is still landing; the API works today |
| Apify's MCP server through the broker | Meaningful use | The broker, so the agent never holds the token | Apify's hosted MCP tools, four Actors allowed and the storage tools that read other runs' data not allowed | Built and tested live. It cannot cap a call's spend on Apify's side, so the estimate and a 45-second wait bound it |
| Schedules and webhooks start tasks while you are away | Meaningful use | Triggers that start a task, and a route that checks its own secret | An Apify schedule checks a product and calls the computer when its run finishes | Built. Set-up and teardown were tested live; delivery was tested only with Apify's payload shape, and needs the computer reachable and its webhook keys in the vault |
| The Website Content Crawler feeds search | Meaningful use | Search (Moss) over the computer's files, rescanned every minute | Crawled pages written where search looks | Built. A live run wrote the pages; the search answer step runs in the live demo |
| A web source for the credit desk: an applicant's site and Google Maps listing set against what they claimed | Meaningful use | The credit desk's seats and rules | A tool that finds disagreements and screens reviews before the credit agent sees them | Built as a tool. The credit desk has not added it to its analyst's tool list, so no scored run uses it |

**Demo moment and proof:** The live run on Oct 23, on both the x86 and the ARM64 test VMs, started two tasks with no network at all. Both Actors ran on Apify at the same time and came back with AirPods Pro 3 at $299.99 CAD, in stock, at Best Buy Canada, and Cole Coffee Café at 6255 College Ave, Oakland. The token was nowhere in either task's log.

**Still to do:**

- Best Actor: our own published Actor. (partly)

## CRS: Overall, Best Financial AI Agent, Best Identity/Fraud, and Most Unexpected

**Status:** decided. **Page:** https://calhacks.gurtos.com/tracks/crs/

**Best shown in:** GurtOS Business

**Pitch:** The unexpected part is the OS: we built a whole operating system for agents to do credit and fraud checks safely, where on an ordinary one the agent holds the keys, approves its own work and can pull any report. Each seat is its own user without the CRS login, every pull needs a stated reason, a person approves what the rules send them, and a fraudster who argues with the desk is refused in code. Business is on main; the scored runs were on GurtOS Server, and the Business screens come from a box seeded as the made-up Fogline Supply. Not built: a payment gate for guests, the controller's clear-the-flag path and an ASI:One chat intent for credit.

**The problem:** Credit bureaus and lenders are what attackers go after, and on an ordinary OS an agent doing identity and fraud checks holds the keys, can approve its own work and can pull any report.

**Features** (from the page's table):

| Feature | Serves | From GurtOS (the OS) | From CRS | Status |
|---|---|---|---|---|
| The agent never holds the CRS login: the core logs in from a root-only vault and returns a summary with each request id | A hijacked agent has nothing to steal | The vault and the broker | The CRS client | Built |
| The decision tool refuses to record anything until the seven checks have run in the same task | CRS is central, not bolted on | Tool calls run in the core | The check that enforces CHK-1 | Built |
| A seat holds only the tools its task lists | An agent cannot widen its own access | Per-task tool lists | The tool set | Built |
| A fraud hold, or anything above the analyst's limit, waits for a person; nobody approves their own request and no agent approves an agent | Separation of duties for credit decisions | GurtOS Business routed approvals | Where the line is | Built |
| An audit with CSV export and one kill switch | A lender can show what each pull was and stop it | GurtOS Business | None | Built |
| Know-your-agent: a stranger's agent asks through one guest path, and CRS identity checks run before the owner is asked | An agent that applies on someone's behalf can be a fraudster's agent | The guest path, the owner's ordinary approval, no SSN in the log | CRS identity verification, Fraud Finder and phone owner | Built |
| A stated reason for every credit pull, and a pull limit per task, with a pull outside a live application asking the controller | A hijacked agent can download every report it can name | The broker refuses a pull with no purpose or over the limit and logs each purpose | The CRS reports | Built |
| CRS's MCP server behind the broker, scoped per seat | An MCP server given to the agent would hand it the login and a lookup of any request id | The core starts it with the login from the vault | CRS's MCP server | Built |
| Nightly re-checks of existing customers at 02:00, off until switched on because a night run costs model credit | A customer's limit can go 29 months without a look | The Server routine, the same pull rules | Fresh CRS reports | Built |
| A fraud case for the controller: identity codes, what drove the Fraud Finder score, inquiry dates, phone owner and request ids on one page | A controller needs the evidence, not the agent's summary | The Business request screen and the log | The CRS answers | Built |
| A fraudster who argues: an application says to ignore the identity codes, and the desk is tested against it | An agent that reads that text may do as it says | Only a person can answer the controller's question | credit_decision refuses an approval or cash-in-advance terms while the fraud stops apply | Built |
| Agent permissions: the CRS login is in the credit desk's permissions list only, and the owner can turn it off | One switch takes CRS away from the desk; the refusal is logged | The manifest, enforced at the vault and in the desk's tools | The CRS keys the desk declares | Built |

**Demo moment and proof:** APP-1043 has clean-looking numbers and a 640 score, and the simple rule approves it for $20,000. CRS, live: identity fails with codes 2201, 2202 and 2101, Fraud Finder scores it 88, nobody owns its phone, and 9 credit inquiries landed between Aug 19 and Sep 12. The analyst put it on fraud hold and the controller confirmed it. Every merge-gate run repeats this live.

**Still to do:**

- Nothing open.

## Solana: MLH: Best use of Solana

**Status:** decided. **Page:** https://calhacks.gurtos.com/tracks/solana/

**Best shown in:** GurtOS Server, and GurtOS Business

**Pitch:** An always-on box you own holds the Solana wallet where agents cannot read it, so agents pay for APIs at any hour without ever seeing the key. Every payment is a devnet transaction anyone can check, with the task that made it written on chain, and the box writes a fingerprint of its own action log to Solana so anyone can check the log was not changed. GurtOS is open source (Apache-2.0), so the same wallet works in anyone's agents.

**The problem:** Giving an agent money means handing it a private key on a system with no layer built for it.

**Features** (from the page's table):

| Feature | Serves | From GurtOS (the OS) | From Solana | Status |
|---|---|---|---|---|
| SPL TransferChecked of devnet USDC, signed in the core | Use of Solana | The key in a root-only file; tasks get only results | Real on-chain payments, confirmed before the receipt is written | Shipped. 70 fixed-price payments on Oct 24, all finalized |
| The facilitator pays every payment fee | Use of Solana | One balance to watch, in dollars, on a box nobody tends | Solana's separate fee payer, used by x402's exact scheme | Shipped. The wallet paid no payment fee |
| Metered payments through a payment channel | Best use of Solana | The cap counts against the task budget | x402's upto scheme: the agent locks a cap, the seller takes what it used, the rest comes back | Shipped. 13 opened; 12 settled at $0.002 or $0.01 and returned the rest; 1 returned in full |
| The task id in a memo on every payment | Best use of Solana | Each task has an id in the action log | SPL Memo | Shipped |
| A fingerprint of the action log written to Solana, and a check that the log still matches | Best use of Solana | The append-only action log | A memo transaction with the entry count and the hash of the log | Shipped. 11 written on Oct 24 by demo runs. It shows a change made after the fingerprint, not one made before |
| Budget, then the owner's OK on the phone | Safe to leave running | Budgets, approvals and the action log | None | Shipped |
| Box-to-box payments | Best use of Solana | Both sides log the payment | Devnet USDC between two wallets | Shipped. In the demo the other box is a second shop with its own wallet |
| Mainnet | Real money | Same budgets and approvals | Mainnet USDC | Not built. Devnet only, by design |

**Demo moment and proof:** On Oct 24, 109 finalized devnet transactions named the box's wallet, none failed: 70 fixed-price x402 payments (1.32 devnet USDC), 13 metered payments through a payment channel, and 11 fingerprints of the action log. The facilitator paid the fee on every payment; the wallet paid only for its own fingerprints.

**Still to do:**

- Mainnet (not built)

## Vultr: MLH: Best use of Vultr

**Status:** to review with Ben. **Page:** https://calhacks.gurtos.com/tracks/vultr/

**Best shown in:** GurtOS Server

**Pitch:** GurtOS Server runs wherever a VM does, and Vultr runs the parts of GurtOS that must be public or big. The cloud box at gurt-cloud.box.gurtos.com answers Jira, Mana and x402 buyers while the rest of its API stays closed. The relay that gives every box its own address runs on a Vultr instance, the release discs are built on Vultr and mirrored on Vultr Object Storage, the real disc installs on a 1 vCPU, 1 GB instance, state backs up encrypted to Object Storage, and the cloud firewall is set from code.

**The problem:** An agent computer should be reachable around the clock without exposing everything on it, and an ordinary cloud VM runs every agent as one user that holds every key.

**Features** (from the page's table):

| Feature | Serves | From GurtOS (the OS) | From Vultr | Status |
|---|---|---|---|---|
| The always-on public box, gurt-cloud.box.gurtos.com | Best use of Vultr cloud | Every task its own Linux user with no keys; only routes an app opens answer without a paired phone | Cloud Compute in San Jose with a public address | Live. Jira issues BOX-1 to BOX-5 ran here; the Mana app and x402 buyers reach it |
| The relay for every box address, name.box.gurtos.com | Use Vultr in the project | TLS ends on the box itself, so the relay sees only encrypted traffic | A 1 vCPU, 1 GB Cloud Compute instance | Live |
| The release build machine | Use Vultr in the project | image/build makes the discs and signs the update image | A fresh vc2-4c-8gb per release | Shipped. v0.1.0-preview x86_64 discs built here |
| The download mirror | Use Vultr in the project | Signed checksums; a swapped file shows | Object Storage, public-read | Live. All four discs, SHA256SUMS and its signature |
| Boot the real GurtOS disc on Vultr from a script | Boot the real OS | The installer, A and B system slots, first-boot setup | Custom ISO by URL, Cloud Compute | Shipped. Installed in about 5 minutes on vc2-1c-1gb |
| Encrypted backups to Object Storage | Use Vultr well | The box tars its state and encrypts it to the owner key with age, so Vultr holds only ciphertext | Object Storage | Shipped. Restored onto a fresh instance in 2.8 s |
| The Vultr cloud firewall set from code | Use Vultr well | Refuses a rule set with no ssh source, one wider than a /8, or one that opens 7700 or 3000 | Firewall groups | Shipped. Enforced on a live instance |
| Test machines: the merge gate on x86, fresh installs, the GNOME desktop for GurtOS Personal | Use Vultr in the project | ./demo vultr runs a throwaway box beside the installed one | Cloud Compute | Live |
| Vultr Serverless Inference | None | None | None | Not pursued: it needs a paid subscription. Nothing here depends on it |

**Demo moment and proof:** The real GurtOS Server release disc installed on a Vultr vc2-1c-1gb (1 vCPU, 1 GB) in about 5 minutes and came back from its own disk after the disc was detached. An encrypted backup in Vultr Object Storage restored onto a fresh instance in 2.8 s with a waiting task still waiting. Three live tests cost under $0.20 in all.

**Still to do:**

- Review the story with Ben: problem, features with their why, OS vs track

## Figma: Best Workflow, Stage Log, Best Design and Most Creative

**Status:** to review with Ben. **Page:** https://calhacks.gurtos.com/tracks/figma/

**Best shown in:** All three editions

**Pitch:** One design system for the whole ecosystem: the box screen and portal for Server, the native GNOME layer for Personal, the Business screens from approved frames, and the phone app, all from the same Figma variables, with a check that fails when the code drifts.

**The problem:** Draft: an OS for agents has to feel like an OS people trust, not another dashboard, and the design has to reach the code without drift.

**Features** (from the page's table):

| Feature | Serves | From GurtOS (the OS) | From Figma | Status |
|---|---|---|---|---|
| One design system for every edition | Best Design, Most Creative | The portal and its kit (Preact and CSS tokens) that every edition and every track app uses | The variables, components and screens in Figma, with a CSS name on every variable | Built. 0 drifts across 82 tokens |
| The portal generated from the design | Best Workflow | The portal the computer serves, on live data | Figma Design, and the MCP server that turns frames into reference code | Built |
| The native iPhone, Apple Watch and Mac apps built against the Figma phone-app frames | Best Design | The computer's API, and the Watch and Face ID limits it enforces | The phone-app frames and the GurtOS colour values and typeface | Built. The colour values are copied by hand into the apps' Theme.swift; the drift check covers the web kit only |
| The native desktop layer for Personal | Best Design | GTK 4 and libadwaita windows in the GurtOS theme | The Personal frames, exported as PNGs with notes, not as web code | Built |
| Code Connect templates and Dev Mode code for every component | Best Workflow | The kit components the templates map to | 95 parserless templates and a Dev Mode description for each component | Built. Publishing to Figma needs an Organization plan, so not published |
| A drift check and an app-versus-frame comparison | Best Workflow, Best Design | The kit and the running app that are checked | Figma variables exported through the MCP, and the frames compared against screenshots | Built. 77 frames compared, with a score |
| A Community playbook and a Figma Sites landing page | Most Creative | The docs site the landing page points to | Both designed in Figma | The Sites landing page is published (https://plum-fabric-10136193.figma.site); the Community playbook file is linked from it, and Figma blocks automated checks of that page, so it was not verified here |
| Weave art for the wallpaper and boot art | Most Creative | The wallpaper and boot screen | Weave | Being built. Weave refused because the Figma account is not linked to it, so the art is flat vector layers |

**Demo moment and proof:** The portal the box runs today was generated from the v2 frames through Figma's MCP server, and every Figma variable is a CSS custom property of the same name: Figma's accent/bg (#2F64A6 Light, #78A9E6 Dark) is --color-accent-bg in the shipped kit, with the same two values. The drift check on today's main finds 0 drifts across 82 Figma tokens.

**Still to do:**

- Review the story with Ben: problem, features with their why, OS vs track
- A demo video of 3 minutes at most. (partly)
- A published Figma Make site (not built)
- Weave art (not built)
- Weave art for the wallpaper and boot art

## Mana: Building with Mana

**Status:** to review with Ben. **Page:** https://calhacks.gurtos.com/tracks/mana/

**Best shown in:** GurtOS Personal and GurtOS Business

**Pitch:** AI workspaces are great for thinking, but there is no safe place for an AI to act on your real computer. Mana plans it, GurtOS does it safely in an isolated space, and you approve from your phone. Four public Mana chats shaped the credit desk rules, Business approval rules, Visa mandates and the Fetch agent team, each with what it changed in code.

**The problem:** AI workspaces are great for thinking, but there is no safe place for an AI to act on your real computer.

**Features** (from the page's table):

| Feature | Serves | From GurtOS (the OS) | From Mana | Status |
|---|---|---|---|---|
| Ask GurtOS: a visitor asks a live computer for a web lookup or a price check | Meaningful use, +10 for living inside Mana | The approval on the owner's phone, a task with its own user, an empty workspace, no network of its own and a 25 cent budget, the limits, and undo | The app a visitor uses, built by Mana's agent | Built. Live round trips on Oct 24; a second, on the latest build, found no second question |
| A guest's request reaches the owner's iPhone and Apple Watch | Meaningful use, +10 for living inside Mana | The request, push to the owner's devices, and the Watch limit of $25 the computer enforces | The guest's words, from the Mana app | Built. Captured in the iOS simulator against a test computer; the iPhone app is on TestFlight for internal testers |
| Rules drafted in a Mana chat become GurtOS Business policy, but only after an owner or admin approves the exact text | Meaningful use, originality | Business's policy engine and routing, who may approve, and the hash check in the core | Drafting the rules and sending them to the box | Built. The merge gate runs the round trip on a throwaway computer; QA has not walked it |
| Four public planning chats, each ending in a code change | One moment where Mana changed what you built | The code that changed (the credit desk, Business, the Shopper track, the Fetch track) | The reviews and the findings | Built. Each chat names the code it changed |
| The GurtOS guide answers from gurtos.com with links | Meaningful use, usefulness | The docs it reads | The agent, its search and its model | Built. The page answers 200 signed out; QA has not talked to it |

**Demo moment and proof:** Mana's review found that two customer records for one business (C-1007 and C-1011) each carried a $10,000 limit: $20,000 of credit in two pieces, each inside the analyst's authority. Rules REL-1 and SOD-5 now treat them as one business, and the next live Droid runs cited both. 35 of Mana's 69 proposed rules are in the file the agents work from.

**Still to do:**

- Review the story with Ben: problem, features with their why, OS vs track

## Standout features (Ben, Oct 24): where each is shown

Show each one everywhere it belongs, as it lands on main and is verified. Claim only what works: a feature stays "building"
here, and off every page, until its code is merged and its check passes. Batch the deploys (Vercel's daily cap).

| Feature | Owner | On main | Where it belongs | Shown yet |
|---|---|---|---|---|
| Try GurtOS live (a throwaway computer in the browser, public address once Ben OKs it) | mcp:6032eb14-4718-4a33-9d29-2a6983bbbce4 | building | Devpost main text and Try it out first; showcase home; Anthropic, Armadin, Factory | no |
| Attack it yourself (paste an injection or pick an attack, watch each defence stop it) | to be named | building | Devpost; showcase home; Armadin, Anthropic | no |
| The flight recorder (replay a task step by step, with files and approvals, then Keep or Undo) | portal | merged 220ac4d (QA has not run it by hand); files per step not recorded yet, shows the final changes | Devpost (done); Anthropic, Factory; Hyphenate, Microsoft, CRS, Atlassian (writers asked) | Devpost only |
| Agent permissions (the OS enforces each app's manifest; allow, deny, revoke) | core | merged 4b473ea (gate 39/0); Settings screens still landing | Devpost; Hyphenate, Microsoft, CRS, Atlassian; Visa, Apify | Devpost, Hyphenate, Microsoft, CRS, Atlassian (Visa, Apify asked) |
| Signed receipts with a QR code and a public verify page (log and Solana anchored) | Elastic and wallet threads | building | Devpost; Elastic, Coinbase, Solana | no |

## Not entered

**MLH GoDaddy Registry domain.** Ben decided on Oct 24 not to enter it. Its showcase page and Devpost section are removed and
`/tracks/godaddy/` redirects to the tracks list. gurtos.com and the per-box `<name>.box.gurtos.com` addresses stay as they are; there is no gurtos.co.

**Capital One (Nessie).** Ben decided on Oct 24 not to enter it. Its showcase page and Devpost section are removed and
`/tracks/nessie/` redirects to the Hyphenate page. Nessie stays in the product as the credit desk's test bank, so the
credit desk, Hyphenate and Microsoft pages still name it. No new Nessie features.

## How this file is made

The pitches live in `showcase/scripts/story/pitches.py`, which writes them into each page's frontmatter and each
Devpost section (`python3 showcase/scripts/story/pitches.py .`). This file is rebuilt from the pages
(`python3 showcase/scripts/story/bible.py .`), so it never disagrees with the site. Edit a page or a pitch,
rebuild both, and re-read the track here.
