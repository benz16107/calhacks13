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
7. **Name the edition that shows each track best.** GurtOS Business is on main (people and roles, routed approvals, audit, kill switch);
   sign-in with work accounts and shadow mode are not built. Say which part each Business-led page shows.
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

14. **Finance tracks (CRS, Hyphenate, Microsoft, Visa, Coinbase): the unexpected part is the OS.** We built
    an entire operating system, a whole ecosystem, for agents to do this work safely, where on an ordinary OS the agent
    holds the keys, can approve its own work and can pull any report. Each of these pages cites real attacks on financial
    companies, only with a source (name, date, link, what was taken, as the source states it), then says what GurtOS's
    controls do about that kind of attack and what they do not. Never invent or round up an incident.

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

**Best shown in:** GurtOS Business

**Pitch:** Teams already review work in Jira. With Business, every agent task is an issue a teammate can approve or roll back, and Jira's own permissions decide who may. Business is on main, but the Jira panel has not been tried against a Business box: today the Forge app drives a GurtOS Server box, and it already checks that the Jira user may edit the issue.

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

**Best shown in:** GurtOS Business

**Pitch:** A finance team needs roles, segregation of duties and an audit trail on every agent decision, which is what Business adds: who may approve what, up to how much. GurtOS Business is on main: people and roles, approvals routed by rules written in plain words, refusals for answering your own request or above your limit, a Waiting for me inbox, an audit with CSV export and a kill switch. Sign-in with work accounts and shadow mode are not built. The scored credit desk runs were on GurtOS Server; the Business screens are from a box seeded as the made-up Fogline Supply.

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
| Pause every agent at once | GurtOS (Personal's pause and Business's kill switch are one switch) | Shipped |
| People, roles, policy-routed approvals, a "Waiting for me" inbox, an Audit view with CSV export | GurtOS Business | Shipped, shown on a Business box seeded as Fogline Supply with scripted seats and sandbox data. The scored runs below were on GurtOS Server |
| A decision reopened from the log months later: two payments bounce in January, the analyst finds October's $40,000 decision in the log (what the task knew, the rules, who approved) and proposes a cut that goes back to the controller | A decision made in October is not final | GurtOS (the append-only log, approvals) and the desk (rule REV-6) | Shipped. Shown with scripted seats in a quick run |
| Ask why: "why did we decide this, and does it still hold?" answered from the log alone | An auditor can ask months later and get one answer | GurtOS (the log) and the desk (the why route) | Shipped |
| A third seat, the AP clerk, pays suppliers with its limits in code: no duplicate payment (AP-3), no paying a bill it entered itself without a second person (AP-1), the controller above 5,000 (AP-2), no payment to bank details changed by email without a confirming call (AP-4) | One more role done with the same depth, and an attack on it: a bank change from a lookalike email | The desk, enforced by tools on GurtOS seats | Shipped. The key plants a duplicate invoice and the lookalike bank change |
| Real books in Beancount: entries reach them only through the desk's books tool, rebuilt from the log; a fix is a new entry linked to what it corrects; undoing a task takes its entries out | A reversal and a repost, not an edit | GurtOS (the log, undo of one task) and the desk (the books tool) | Shipped. The ledger passes bean-check |
| A no carries a reason: Deny asks for one, and the seat revises instead of asking again | A system of work handles a rejection | The desk | Shipped |
| Bring your own: an application on one of CRS's 20 test people, or uploaded case files, checked first | A judge can try a case of their own | The desk | Shipped. The guarantor must be one of CRS's test people |
| A public benchmark slice: the 10 public DABstep dev questions run through GurtOS tasks, 7 of 10 correct, one attempt each with no network, about $3.22 of model use | Proof beyond our own planted case | The desk (`bench/`) on GurtOS tasks | Shipped. A slice, not a leaderboard entry |
| Credit rules, the planted case, the scorer, the Credit desk window | The desk | Shipped |

**Demo moment and proof:** Live Droid run 73c47b, scored from the action log against the answer key: every planted error of the original 14-error case caught, 0 false alarms, 6 of 6 credit decisions right (the answer key has since grown to 19 planted errors; tonight's live run on it is being scored) (outcome, band, limit and terms). It held APP-1043, a synthetic identity that a simple rule approves for $20,000.

**Still to do:**

- A video that opens with your "moment". (partly)

## Factory: Droid SDK track

**Status:** to review with Ben. **Page:** https://calhacks.gurtos.com/tracks/factory/

**Best shown in:** GurtOS Server and GurtOS Personal

**Pitch:** Droid does the work and GurtOS makes it safe. Droid never holds a key: the vault keeps it and the box's proxy swaps it in outside the task. Each task is its own Linux user with its own firewall rule and its own copy of the files, on a locked-down Linux base where task users have no sudo, and every change is reviewable in the log and undoable. Keys kept where agents can reach them keep leaking: OpenCode Console exposed users' provider API keys on Oct 17, 2026, OpenClaw stores tokens and API keys in plaintext in ~/.openclaw/openclaw.json, and CVE-2026-25253 let one crafted link make OpenClaw send its token to an attacker.

**The problem:** Draft: coding agents need keys to work, and tools keep leaking them (the OpenCode Console breach, OpenClaw's plaintext key file, CVE-2026-25253). Today the agent runs as you, on your files, with your keys in its environment.

**Features, by the sponsor's criteria** (no OS-vs-track table yet; to write when reviewed):

- *Droid SDK (TypeScript or Python) does real work.* (met): Droid, through @factory/droid-sdk 0.10.0, is the default worker for every task. It fixes code and runs the tests (from an ASI:One chat), works a credit desk with live CRS and bank data (two seats, every planted error of the original 14-error case caught in the best run; the key has since grown and a new run is being scored), reads receipts and proposes a reorder, describes photos for search, and edits a folder on GurtOS Personal.
- *The README says where and how.* (met): The worker is core/workers/droid.ts, about 70 lines: createSession or resumeSession, a box MCP server for tools, and handlers that turn Droid's questions into box approvals. core/README.md covers tasks, the broker and the key swap, and this page lays out the whole path.
- *Triggers you designed.* (met): Droid tasks start from an ASI:One chat, the box's API (the portal and the Personal desktop use it), the credit desk's run route (two seats at once), "Ask an Agent" on a folder in Files, the shopper's "watch this for me" and reorder, and the box itself when no vision model answers for a new photo. core/triggers.ts adds generic schedule, webhook and new-file triggers. A Droid task's tool call can start another task (the reorder proposal starts a purchase task that waits for your OK).
- *Careful limits on what Droid can touch.* (met): Each Droid runs as its own Linux user with no sudo, in an overlay copy of its workspace, as a hardened systemd unit (private /tmp, read-only system, no D-Bus, 2 GB of memory). An nftables rule sends its traffic only to the box's proxy, which allows only the task's hosts. It sees only the box tools its task lists, through an MCP relay that holds no secrets. Spending above its budget waits for a person.
- *Visible plans, steps and diffs.* (met): Every Droid tool call becomes a task.step in the append-only log, and Droid's final message is saved as its summary. The portal's task window shows the steps and the unified diff, and the same appear in the Jira issue and the ASI:One chat.
- *Scores badly: chatbot wrappers, actions you can't see.* (met): There is no chat box around Droid. Droid works on files and tools with nobody watching, and every action it takes is a log line a person can read, search in Elastic, or undo.

**Demo moment and proof:** In every merge-gate run, a Droid task (Claude) edits a file as its own Linux user while the box samples its processes: all 240 samples held only a placeholder Factory key, because the box's proxy adds the real key on the way to Factory. Its cost, $0.5378 in the Oct 24 run, is priced from the token counts Droid reports.

**Still to do:**

- Review the story with Ben: problem, features with their why, OS vs track

## Armadin: Best Security Hack

**Status:** decided. **Page:** https://calhacks.gurtos.com/tracks/armadin/

**Best shown in:** All three editions

**Pitch:** Agents get attacked through the pages they read and the packages they install, and on an ordinary OS a fooled agent can read every key and send it anywhere. GurtOS stops it at the OS, whatever the model does, in every edition, and publishes the test for each control. Next (being built): a poisoned npm package, tripwire keys, a deeper per-task sandbox, a scoreboard of about 15 OS-level attacks with its misses, a hijacked payment and an OWASP mapping.

**The problem:** Agents get attacked through the pages they read and the packages they install, and on an ordinary OS a fooled agent can read every key and send it anywhere.

**Features** (from the page's table):

| Feature | Which attack it answers | From | Today |
|---|---|---|---|
| Keys in a root-only vault, never in a task's files or environment | A hijacked agent reads every key | GurtOS (vault, broker) | Shipped. The merge gate samples every process of a real Claude task 240 times and finds only a placeholder key |
| Each task is its own Linux user in its own copy of the files, seeing no process but its own | A task reads another task's files or the box's | GurtOS | Shipped |
| A per-task network rule and a proxy allowlist | The stolen data has nowhere to go | GurtOS | Shipped. A send to attacker.example is refused and logged, and a raw connection to an IP is refused by the firewall |
| Approvals and an append-only log, and undo of the task | A fooled agent cannot approve its own action, and the damage is removable | GurtOS | Shipped. The task cannot reach SpacetimeDB or the API to approve itself |
| The poisoned npm package: a package whose install script hunts for keys and sends them out, run inside a task | The September 2025 npm worm, which stole tokens and cloud keys from developer machines | GurtOS (task user, vault, network rule) and the Armadin test | Being built; not on main yet |
| Tripwire keys: fake keys planted where an attacker looks, so a read is logged and alerts you | A hijacked agent that hunts for keys gives itself away | GurtOS (the vault and the log) | Being built; not on main yet |
| A deeper per-task sandbox: seccomp filters, Landlock file rules and cgroup caps | A task that tries to widen its own reach inside the kernel | GurtOS (core) | Being built; not on main yet |
| A scoreboard of about 15 OS-level attacks, with the ones it misses | A score you can check, not a claim | GurtOS and the Armadin tests | Being built; not on main yet |
| The hijacked payment: a business email compromise that tries to change who gets paid | Fraud by fooling an agent or a person about where money goes | GurtOS (approvals) and the credit desk (its refusal of changed bank details) | Being built; not on main yet |
| A mapping of the controls to the OWASP list for agents | A shared checklist a security reviewer already knows | The Armadin page | Being built; not on main yet |

**Demo moment and proof:** In every merge-gate run, a scripted agent obeys the hidden instructions step by step and is stopped at each one: the vault read fails (EACCES), the send to attacker.example is refused by the proxy, a raw connection to 1.1.1.1 is refused by the firewall, and reaching SpacetimeDB or the box's API to approve itself is refused. Then real Claude reads the same page: it refused, and no vault secret appeared in its files, environment or log.

**Still to do:**

- The poisoned npm package: a package whose install script hunts for keys and sends them out, run inside a task
- Tripwire keys: fake keys planted where an attacker looks, so a read is logged and alerts you
- A deeper per-task sandbox: seccomp filters, Landlock file rules and cgroup caps
- A scoreboard of about 15 OS-level attacks, with the ones it misses
- The hijacked payment: a business email compromise that tries to change who gets paid
- A mapping of the controls to the OWASP list for agents

## Microsoft: Built for the Real World, and the Customer Impact Award

**Status:** decided. **Page:** https://calhacks.gurtos.com/tracks/microsoft/

**Best shown in:** GurtOS Business

**Pitch:** Companies want agents on finance work, but an ordinary OS gives an agent its owner's keys, no separation of duties, no record and no undo, so pilots stay pilots. GurtOS Business gives each seat its own user, routes approvals to the right person, keeps a full audit and a kill switch, on a box the company owns. Next (being built): shadow mode, Entra ID sign-in, measured impact, a Responsible AI mapping, sourced facts and an incident drill. GurtOS Business is on main: people and roles, approvals routed by rules written in plain words, refusals for answering your own request or above your limit, a Waiting for me inbox, an audit with CSV export and a kill switch. Sign-in with work accounts and shadow mode are not built. The scored credit desk runs were on GurtOS Server; the Business screens are from a box seeded as the made-up Fogline Supply.

**The problem:** Companies want agents doing finance work, but an ordinary OS gives an agent its owner's keys, no separation of duties, no record and no undo, so pilots never reach production.

**Features** (from the page's table):

| Feature | Why it is there | Microsoft criterion | From | Today |
|---|---|---|---|---|
| Each seat is its own Linux user with its own copy of the files; keys stay in a root-only vault | A finance agent holds nothing it could leak or misuse | Path to production, Responsible design | GurtOS | Shipped. The merge gate checks no key appears in the log |
| A seat cannot approve its own large proposal; fraud holds always go to a person, on the portal or a phone | Separation of duties for an agent | Responsible design | GurtOS (the approval pause) and the desk (where the line is) | Shipped. Above $10,000 the controller answers; the log names who |
| One append-only record of every call, decision, rule id and approver | Something an auditor can read | Path to production | GurtOS (the log) and the desk (rule ids, CRS request ids) | Shipped |
| Undo one seat's file changes; resume after a power cut with nothing paid twice; whole-system updates that roll back | A bad hour is recoverable | Path to production | GurtOS | Shipped |
| People with roles (owner, admin, approver, requester, auditor) and agent seats, each phone paired as its person | A company has its own people, not one login | Path to production | GurtOS Business | Shipped. The merge gate's business step makes four people with paired phones and refuses a requester who tries to read the policy |
| Rules in plain words route each approval to the right person, and answers are refused for your own request, above your limit, or by anything that is not a person | Separation of duties that a team can read and change | Responsible design | GurtOS Business | Shipped. The gate checks seven refused answers and that all five requests still wait afterwards |
| Waiting for me and My requests on phone and desktop | Each person sees only what is theirs to answer | Path to production | GurtOS Business | Shipped. Rosa sees three requests, Sam none and his own four, Priya none |
| An audit with filters by person, agent seat and date, and CSV export, read-only for an auditor | Something an auditor can read without asking IT | Path to production | GurtOS Business | Shipped. The gate checks the filters, the CSV header and that an auditor can change nothing |
| One kill switch pauses every agent at once from any admin's phone or the box; requests waiting for an OK stay open | The first thing a company asks about is how to stop it | Path to production | GurtOS Business (shared with Personal's pause) | Shipped. The gate checks six tasks stopped where they were, every screen says who pulled it, and both pulls are in the log |
| Shadow mode and a one-week pilot plan: the desk runs beside the people, changes nothing, and is compared with what they did | A company starts with a pilot it can switch off | Path to production | GurtOS Business (shadow mode) and the desk (the plan) | Being built; not on main yet |
| Sign-in with Entra ID work accounts, roles taken from groups | Nobody makes new passwords or a second list of who may approve | Path to production | GurtOS Business | Being built; not on main yet |
| Measured impact: human minutes saved, dollars stopped and cost per application | A controller can say what the desk is worth | Measurable usefulness | The desk | Being built; not on main yet |
| A mapping to Microsoft's Responsible AI Standard, a protected-attribute test and a plain decline letter | An applicant gets an honest reason and the desk can show it does not use what it must not | Responsible design | The desk | Being built; not on main yet |
| Sourced customer facts: each fact in a decision carries where it came from | A decision can be checked, not just trusted | Customer understanding | The desk | Being built; not on main yet |
| A measured incident drill: pull the kill switch, undo a seat, resume, and time each | The answer to "what if it goes wrong" is a number | Path to production | GurtOS Business (kill switch, undo, resume) | Being built; not on main yet |

**Demo moment and proof:** Scored from the action log against an answer key, the latest live run caught every planted error of the original 14-error case with 0 false alarms (the answer key has since grown to 19; tonight's live run on it is being scored) and decided all 6 credit applications as the key does. A simple rule on the same CRS data approves all six for $153,000, including $20,000 to a fake applicant whose $18,500 rush order would have shipped to a freight forwarder.

**Still to do:**

- Shadow mode and a one-week pilot plan: the desk runs beside the people, changes nothing, and is compared with what they did
- Sign-in with Entra ID work accounts, roles taken from groups
- Measured impact: human minutes saved, dollars stopped and cost per application
- A mapping to Microsoft's Responsible AI Standard, a protected-attribute test and a plain decline letter
- Sourced customer facts: each fact in a decision carries where it came from
- A measured incident drill: pull the kill switch, undo a seat, resume, and time each

## Visa: Reimagining Shopping

**Status:** decided. **Page:** https://calhacks.gurtos.com/tracks/visa/

**Best shown in:** GurtOS Personal, plus GurtOS Server for routines that keep running when you close your laptop

**Pitch:** GurtOS Personal runs your shopping agents on a computer you own, even an old one: the agent never sees your card, every purchase waits for your tap, every order is signed so the store can verify it, and undo refunds it. A Server box keeps a watch running while the laptop is closed.

**The problem:** Shopping agents need your card or your password, stores can't tell a good agent from a bot, you can't see or stop what they do, and cloud agents run on computers you don't control.

**Features** (from the page's table):

| Feature | Why it is there | Visa criterion | From | Today |
|---|---|---|---|---|
| The agent never sees your card: the card and the signing key stay in the root-only vault, and only the buy tool in the core reads them | A prompt injection or a bad model cannot leak what it never had | Trust (15) | GurtOS (vault and broker) | Shipped. The merge gate checks no card, key or password is anywhere in the log |
| Every purchase waits for your tap, with the price against your limit | You stay the one who spends; the agent only proposes | Trust (15), UX (25) | GurtOS (the approval pause) | Shipped. The tap is Approve on the phone or portal, or Face ID once a passkey is set up (next rows) |
| Each checkout is signed with Visa's Trusted Agent Protocol, including the order body | The store can verify a real, unchanged agent order instead of blocking every bot | Commerce impact (15), Technical (20) | The Shopper app | Shipped. The store refuses unsigned, changed and replayed orders |
| Undo refunds the order | A purchase you regret is one tap to reverse | UX (25), Trust (15) | GurtOS (undo) and the store (refund) | Shipped |
| Standing instructions: "when it's under $16", "keep us stocked" | Shopping becomes a rule you set once, not a session you sit through | Innovation (25) | The Shopper app, with Claude in Droid | Shipped |
| Live store prices through Apify, prices from the store not the model | A confused or hijacked model cannot invent a price | Technical (20), Trust (15) | The Shopper app and the Apify app | Shipped |
| Each agent is its own Linux user with its own budget and network rule | One shopping agent cannot touch another task's files or spend another's money | Trust (15) | GurtOS | Shipped |
| Live view of every agent on the portal and the phone, and Pause all agents | You can see and stop what your agents are doing | UX (25), Trust (15) | GurtOS | Shipped |
| Approve with Face ID: a WebAuthn passkey signs the exact question and amount, the box verifies the signature, and once a passkey is set up the buy tool refuses a purchase approved without one | A stolen pairing token can press Approve and nothing is paid | Trust (15), UX (25) | GurtOS (the approval pause, the box verifying) and the Shopper app (the passkey) | Shipped. The demo uses a software authenticator; a passkey belongs to the https address it was made on, and there is no remove button yet |
| A signed shopping mandate: the item words, the stores, the price per item, the quantity, the total and an expiry of at most 30 days, signed by the box's agent key and enforced by the store | The store refuses another item, a higher price, another store, more items, a later date or an edited mandate | Innovation (25), Trust (15) | The Shopper app, with the box's signing key in the vault | Shipped. Mirrors the payment instruction in Visa Intelligent Commerce with open tools; it is not a Visa product |
| The store's merchant dashboard: verified agent orders, unknown bots refused by reason, conversion from agent shoppers, and chargebacks | A merchant sees why trusting verified agents costs nothing | Commerce impact (15) | The Shopper app (the GurtOS Test Store) | Shipped. Zero chargebacks, because every order carried a valid signature, a mandate it fits and a person's approval |
| Comparison across Best Buy Canada and Gold Roast through Apify: the best total with shipping wins, with the reason | Real prices from two real stores, ranked in one sentence | Technical (20), UX (25) | The Shopper app and the Apify app | Shipped. Best Buy Canada's Conditions of Use prohibit scraping; see Limits |
| Price protection for 30 days after a purchase, and unused subscriptions found and cancelled with your OK | Saving money after the sale is part of shopping | Innovation (25) | The Shopper app | Shipped at the GurtOS Test Store, which knows its own price; the subscriptions are three samples in a demo mailbox |
| Spending rules like a card app: a monthly cap, a cap per store and per category, and never-buy words, checked before asking and again before paying; saving them needs Face ID | The box enforces your limits, not the prompt | Trust (15), UX (25) | The Shopper app, on the box's approval pause | Shipped |
| Payments behind one interface: Stripe test mode, the Cybersource sandbox and a Visa Intelligent Commerce adapter | The agent never learns which processor pays | Technical (20) | The Shopper app | Shipped for Stripe test mode and Cybersource, tested live on Oct 24 against Cybersource's public sandbox (a charge, a partial refund, a full refund). The Visa Intelligent Commerce adapter has never been called, because it needs onboarding with Visa |

**Demo moment and proof:** In the live run on Oct 23, Apify read Chemex filters at Best Buy Canada for $15.36 CAD, the box asked, and after the tap it bought them at that price with a Stripe test-mode charge on a Visa test card. Undoing the household reorder refunded it in Stripe test mode. Every payment was test money.

**Still to do:**

- Visa Intelligent Commerce (not built)

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

**Pitch:** Live shared state is what each edition's screen reads: the box screen on Server, the desktop on Personal. It matters most in Business, where several people see the same approvals at once and the first answer wins.

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

**Status:** decided. **Page:** https://calhacks.gurtos.com/tracks/elastic/

**Best shown in:** GurtOS Business and GurtOS Server

**Pitch:** After a week of agents working, an ordinary OS cannot tell you what they did, and anyone with root can edit its logs. GurtOS keeps one action log of every action and Elastic keeps a copy the box cannot rewrite; its agent answers and investigates, and acting still needs your OK. Business is on main, but the agent has only been run against GurtOS Server boxes and demo runs. Next (being built): a tamper-evident log with a verify tool, detection rules with phone alerts, pause, undo and stop through approvals, a fleet view, semantic search, and asking from the portal and phone.

**The problem:** After a week of agents working, an ordinary OS cannot tell you what they did: its logs are scattered and anyone with root can edit them.

**Features** (from the page's table):

| Feature | Why it is there | Elastic criterion | From | Today |
|---|---|---|---|---|
| One append-only action log of every step, tool call, cost, approval, block, undo and failure | One place to ask, not scattered files | Real data used for something that matters | GurtOS (the log) | Shipped |
| The log streams into a Serverless index, each event once, with the Elastic key held only by one core job | The record lives outside the box and no task can reach the key | On a Serverless instance | GurtOS (vault, core job) and Elastic (the index) | Shipped. A live run shipped all 156 events of a demo run, each exactly once |
| An Agent Builder agent, GurtOS log, with six query tools and one index search tool, as code in the repo | Plain-words answers to what changed, what it cost, why it failed, what got blocked | An Agent Builder agent | Elastic (agent, tools) | Shipped |
| Anything that acts waits for your OK on the portal or phone | An investigator that can also act would be a new thing to trust | Real data used for something that matters | GurtOS (the approval pause) | Shipped for tasks; the agent has no action tools yet |
| A hash-chained log with an add-only copy in Elastic and a verify tool | Removes the limit that root can edit the log: a changed line breaks the chain and the copy shows it | Real data used for something that matters | GurtOS (the chain, the verify tool) and Elastic (the add-only copy) | Being built; not on main yet. The "root can edit the log" limit stays listed until it merges |
| Detection rules with alerts to the phone | The morning after becomes the minute it happens | Real data used for something that matters | Elastic (rules) and GurtOS (the phone alert) | Being built; not on main yet |
| Agent tools that request pause, undo or stop through GurtOS approvals | The investigator can act, but only with your yes | An Agent Builder agent | Elastic (tools) and GurtOS (approvals) | Being built; not on main yet |
| A fleet view and a who-approved-what view, with role-scoped access | A team sees every box, and each person sees only what their role allows | Real data used for something that matters | Elastic (the views) and GurtOS Business (roles) | Being built; not on main yet |
| Semantic search over what agents did | Find "the task that tried to send the repo out" without knowing its words | An Agent Builder agent | Elastic | Being built; not on main yet |
| Ask from the portal and phone, plus a Kibana dashboard | The answer is where you already look | An Agent Builder agent | GurtOS (portal, phone) and Elastic (Kibana) | Being built; not on main yet |

**Demo moment and proof:** Asked "Why did the job routine fail? Look at demo run a18523.", the agent found the failed task with box.failures, read its timeline and named the root cause itself: the routine was allowed to reach only boards.greenhouse.io, its plan needed www.linkedin.com, the box blocked it, and the task failed right after. A live run shipped all 156 events of a demo run to Serverless, each exactly once.

**Still to do:**

- A hash-chained log with an add-only copy in Elastic and a verify tool
- Detection rules with alerts to the phone
- Agent tools that request pause, undo or stop through GurtOS approvals
- A fleet view and a who-approved-what view, with role-scoped access
- Semantic search over what agents did
- Ask from the portal and phone, plus a Kibana dashboard

## Moss: A personal agent that remembers you

**Status:** decided. **Page:** https://calhacks.gurtos.com/tracks/moss/

**Best shown in:** GurtOS Personal

**Pitch:** A personal agent is only useful if it remembers you, and today that means uploading your life to someone's cloud. On GurtOS the index lives in your own computer's memory, agents search it with no network and no keys, and undoing a task takes its files out. Only text goes to Moss's cloud copy, including what a vision model wrote about your photos. Next (being built): talking to your computer, memory that cannot be poisoned, one preference honoured across apps, photos described by a local model only, and a forget button.

**The problem:** A personal agent is only useful if it remembers you, and today that means uploading your life to someone's cloud, and any web page an agent reads can plant false memories.

**Features** (from the page's table):

| Feature | Why it is there | Moss criterion | From | Today |
|---|---|---|---|---|
| One index of photos, text files and finished tasks, in the box's memory, searched in about 3 ms | The agent remembers you, fast enough to use | A personal agent that remembers you | Moss (the index) and the Find app | Shipped. Median 3.1 ms through the box on both test VMs, under 1 ms inside Moss |
| An agent searches through the broker with no network and no Moss key | An agent that reads a hostile page cannot send your memory anywhere | Works across your apps | GurtOS (the broker, the network rule) | Shipped. The merge gate checks it every run |
| Undo a task and its files leave the index while the photos stay | Remembering must not be permanent against your wishes | A personal agent that remembers you | GurtOS (undo of one task) | Shipped |
| A symlink to the vault is neither indexed nor served, and no path leaves the workspaces | The index cannot become a way to read your secrets | A personal agent that remembers you | GurtOS (the vault) and the Find app | Shipped |
| Photos described by a vision model when they arrive: gemma4 in Ollama on the laptop, or Claude in a Droid task as the backup | A photo's name says nothing, its description does | A personal agent that remembers you | The Find app | Shipped. The Claude backup sends the photo to Anthropic |
| Talk to your computer: Moss's voice-agent example | Asking out loud is how people expect to use memory | A voice agent | The Find app and Moss | Being built; not on main yet |
| Agent memory that cannot be poisoned: what an agent reads from a web page or photo is labelled untrusted and cannot overwrite what you told it | A planted false memory would steer every later task | A personal agent that remembers you | GurtOS (per-task scope, untrusted data) and the Find app | Being built; not on main yet |
| One preference honoured across apps: say it once and every app's agent follows it | Works across your apps | Works across your apps | The Find app and GurtOS (the shared index) | Being built; not on main yet |
| Photos described by a local model only, with Claude used only if the owner opts in | Your photos stay on your computer unless you decide otherwise | A personal agent that remembers you | The Find app and GurtOS (the network rule) | Being built; not on main yet |
| A forget button: remove one memory, or everything, from the index and the cloud copy | You decide what is remembered | A personal agent that remembers you | The Find app and GurtOS | Being built; not on main yet |

**Demo moment and proof:** A search through the box takes a median of 3.1 ms on both test VMs (ARM64 and x86), under 1 ms of it inside Moss, because Moss runs in the box's own memory. In every merge-gate run, an agent with no network asks find.search through the broker and gets the same whiteboard photo; undo a task and its files leave the index while the photos stay.

**Still to do:**

- Vultr's hosted vision model (not built)
- Talk to your computer: Moss's voice-agent example
- Agent memory that cannot be poisoned: what an agent reads from a web page or photo is labelled untrusted and cannot overwrite what you told it
- One preference honoured across apps: say it once and every app's agent follows it
- Photos described by a local model only, with Claude used only if the owner opts in
- A forget button: remove one memory, or everything, from the index and the cloud copy

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

**Status:** decided. **Page:** https://calhacks.gurtos.com/tracks/crs/

**Best shown in:** GurtOS Business

**Pitch:** The unexpected part is the OS: we built a whole operating system for agents to do credit and fraud checks safely, where on an ordinary one the agent holds the keys, approves its own work and can pull any report. Each seat is its own user without the CRS login, a person approves what the rules send them, and every pull keeps its request id. GurtOS Business is on main: people and roles, approvals routed by rules written in plain words, refusals for answering your own request or above your limit, a Waiting for me inbox, an audit with CSV export and a kill switch. Sign-in with work accounts and shadow mode are not built. The scored credit desk runs were on GurtOS Server; the Business screens are from a box seeded as the made-up Fogline Supply. Next (being built): know-your-agent, permissible purpose with a pull limit, CRS's MCP server behind the broker, nightly re-checks, a fraud case file on the phone and a fraudster who argues, measured.

**The problem:** Credit bureaus and lenders are what attackers go after, and on an ordinary OS an agent doing identity and fraud checks holds the keys, can approve its own work and can pull any report.

**Features** (from the page's table):

| Feature | Why it is there | CRS criterion | From | Today |
|---|---|---|---|---|
| The agent never holds the CRS login: the core logs in from a root-only vault and returns a summary with each request id | A hijacked agent has nothing to steal | Most Unexpected, Creative | GurtOS (vault, broker) and the track (the CRS client) | Shipped. The merge gate checks no key appears in the log |
| The decision tool refuses to record anything until the seven checks have run in the same task | CRS is central, not bolted on | Overall, Best Financial AI Agent | The track, enforced in the core | Shipped |
| A seat holds only the tools its task lists, so it cannot pull reports it was not asked to | An agent cannot widen its own access | Best Identity/Fraud | GurtOS (task tools) and the track | Shipped |
| A fraud hold, or anything above the analyst's limit, waits for a person; nobody approves their own request and no agent approves an agent | Separation of duties for credit decisions | Best Identity/Fraud, Useful | GurtOS Business (routed approvals) and the track (where the line is) | Shipped. The merge gate checks seven refused answers |
| An audit with CSV export and one kill switch | A lender can show what each pull was and stop it | Useful | GurtOS Business | Shipped |
| Know-your-agent: CRS verifies the human behind a stranger's agent before credit or payment | An agent that applies on someone's behalf can be a fraudster's agent | Best Identity/Fraud, Most Unexpected | The track (CRS identity checks) and GurtOS (the stranger's request waits for a person) | Being built; not on main yet |
| Permissible purpose and a pull limit recorded for every credit pull | A credit pull needs a stated reason and a cap on how many | Useful, Best Financial AI Agent | The track (purpose) and GurtOS (the limit, counted in the core) | Being built; not on main yet |
| CRS's MCP server behind the broker, scoped per seat | The agent speaks CRS's own tools without holding its login | Overall, Creative | GurtOS (broker, per-seat scope) and CRS (the MCP server) | Being built; not on main yet |
| Nightly re-checks of existing customers | Fraud shows up after the first approval | Useful, Overall | The track (the re-checks) and GurtOS (schedules) | Being built; not on main yet |
| A fraud case file on the phone | The controller decides with the evidence in hand | Best Identity/Fraud, Useful | GurtOS (the phone app) and the track (the case file) | Being built; not on main yet |
| A fraudster who argues, measured | We test the desk against someone who talks back, and publish the score | Best Identity/Fraud, Most Unexpected | The track | Being built; not on main yet |

**Demo moment and proof:** APP-1043 has clean-looking numbers and a 640 score, and the simple rule approves it for $20,000. CRS, live: identity fails with codes 2201, 2202 and 2101, Fraud Finder scores it 88, nobody owns its phone, and 9 credit inquiries landed between Aug 19 and Sep 12. The analyst put it on fraud hold and the controller confirmed it. Every merge-gate run repeats this live.

**Still to do:**

- Know-your-agent: CRS verifies the human behind a stranger's agent before credit or payment
- Permissible purpose and a pull limit recorded for every credit pull
- CRS's MCP server behind the broker, scoped per seat
- Nightly re-checks of existing customers
- A fraud case file on the phone
- A fraudster who argues, measured

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

## Not entered

**Capital One (Nessie).** Ben decided on Oct 24 not to enter it. Its showcase page and Devpost section are removed and
`/tracks/nessie/` redirects to the Hyphenate page. Nessie stays in the product as the credit desk's test bank, so the
credit desk, Hyphenate and Microsoft pages still name it. No new Nessie features.

## How this file is made

The pitches live in `showcase/scripts/story/pitches.py`, which writes them into each page's frontmatter and each
Devpost section (`python3 showcase/scripts/story/pitches.py .`). This file is rebuilt from the pages
(`python3 showcase/scripts/story/bible.py .`), so it never disagrees with the site. Edit a page or a pitch,
rebuild both, and re-read the track here.
