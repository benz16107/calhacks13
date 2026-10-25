# GurtOS talking points for the judging table

**Run the table demo from [`table-demo.md`](table-demo.md):** the 3-minute script, the four commands to pre-stage, and
what to do if the Wi-Fi or the VM fails.

What to say when a judge stops at the table, Sunday 10:30 AM to 12:30 PM PT. The general version comes first, then
one section per track. Each track takes about 90 seconds to read. Every number comes from `docs/story.md`,
`docs/features.md`, `docs/devpost.md`, the track's showcase page or its README.

**Tracks:** [Hyphenate](#hyphenate) · [Microsoft](#microsoft) · [CRS](#crs) · [Atlassian](#atlassian) ·
[Armadin](#armadin) · [Anthropic](#anthropic) · [Factory](#factory) · [Elastic](#elastic) · [Visa](#visa) ·
[Moss](#moss) · [Apify](#apify) · [Mana](#mana) · [Figma](#figma) · [Fetch.ai](#fetchai) · [Coinbase](#coinbase) ·
[Solana](#solana) · [SpacetimeDB](#spacetimedb) · [Vultr](#vultr) · [Most Creative](#most-creative) ·
[Most Technically Complex](#most-technically-complex) · [People-First Social Impact](#best-people-first-social-impact) ·
[Best Solo Hack](#best-solo-hack)

**Was "(if ready)".** On Oct 25 at 6:10 to 6:30 AM PT, Try GurtOS live (try.gurtos.com), Attack it yourself,
Replay and a signed receipt checked on gurtos.com/verify were all tried by hand and worked. Agent permissions are on
main (Settings, Permissions) but were not tried by hand. Say any of them; still rehearse the table demo once.

**Model credit.** The real-Droid part of the merge gate was switched off on Oct 24 while Factory credit was short.
Prefer the scripted moments (Quick run, the booby-trapped page, the spend request) unless you have checked credit.

---

# The general version

## 30 seconds
"AI agents are starting to do real work on our computers: booking, buying, coding, filing. But today's operating systems were built for one person at a keyboard. An agent runs as *you*, with all your files, all your passwords, and nothing records or undoes what it did. One bad web page and it can steal your keys. GurtOS is an operating system built for AI agents. Every agent gets its own space, never holds your passwords, asks your phone before spending money, and anything it does can be undone. It runs on a computer you own, even an old one, and it's open source."

## How it works (about 1 minute)
**"Think of a hotel."**
- **Every agent gets its own room.** Each task runs as its own user, in its own copy of your files, a layer on top of the real ones. When it's done, you Keep the changes or Undo them. Undoing a whole batch took 48 milliseconds.
- **Agents never get the master key.** Passwords live in a vault; the OS makes calls for the agent, which only ever holds a placeholder.
- **Each room only opens certain doors.** Each task can reach only the websites it needs.
- **The front desk calls you.** Spending over a limit pauses and asks your phone or watch; approve with Face ID.
- **Cameras in the hallway.** Every action goes into one log that can't be quietly edited.
- **Pull the plug.** Cut the power and every task resumes. The kill switch stopped 10 agents in 137 ms.

## Why it's better
Normal OSes assume one human at a keyboard: permissions per person, not per task; passwords any program can read; no approval, budget or undo for agents. Proof: 16 attacks, 15 stopped, 1 published as not covered; a Server task ran in 1 GB of RAM; Personal uses 150 MB less memory than stock Ubuntu; three editions plus phone, watch and Mac apps; open source.

## Questions judges will ask
- "Why not Docker or a VM?" They isolate apps but know nothing about agents: no approvals, budgets, per-task undo, vault or phone control.
- "Can't the model just refuse?" Sometimes. GurtOS assumes the agent will be fooled and leaves it nothing to do; a fully hijacked agent got nothing in tests.
- "Who is it for?" Server, Personal, Business.
- "What's next?" The roadmap.

At the table, lead with one live moment, not features.

**Exact numbers if a judge presses.** In the incident drill, pause answered in 137 ms and every one of the 10 agents
was frozen within 271 ms. The 1 GB run was the box installed from source in a QEMU VM, one task at a time, not the
Server image. Personal idles at about 903 MB, about 150 MB below stock Ubuntu 24.04 Desktop. The merge gate on Oct 24
passed 24 sections and 266 checks with 0 failures.

---

# Sponsor tracks

## Hyphenate

**30 seconds.** "Companies want AI employees on the finance team, but an agent on a normal computer runs as you,
with your keys, can approve its own work, and leaves no record you can trust. So nobody lets one near real money.
GurtOS Business gives each finance seat its own space, routes approvals to the right person, and logs every call.
On top of it I built a credit desk for a made-up wholesaler, Fogline Supply, with an analyst, a collections clerk and
an AP clerk."

**How it works.**
- Each seat is its own Linux user with only its own tools. Only the analyst can record credit decisions, only the
  clerk can record collections.
- No seat sees a password. The core logs in to CRS and the bank and hands back a summary.
- A seat can't approve its own work. Above $10,000, and every fraud hold, goes to the controller.
- Every call, decision, rule id and approver goes into one append-only log. Think of a bank's paper trail, except
  the agent can't skip a page.

**Why it's better.** A normal setup is one login with every permission. Here separation of duties is enforced by the
OS, and the record answers "why" months later.
- Proof: the full live run with real Droid on all three seats caught 16 of 17 planted errors, 1 false alarm
  (precision 97%), and got all 6 credit decisions right, in 12 minutes for about $5.24.
- It held APP-1043, a synthetic identity that a simple rule approves for $20,000.
- The January review reopened an October decision and caught 2 of 2 bounced payments.
- Pull the plug while a request waits, and each bill is still paid once.
- On the public DABstep benchmark, 7 of the 10 public dev questions right, with no network, about $3.22.

**Edition:** GurtOS Business. **Live moment:** open Credit desk, press **Quick run** (about 10 seconds, live CRS and
Nessie sandboxes). APP-1043 turns amber. Answer as the controller on the phone. Then offer **Bring your own** for a
case the judge picks. Replay the analyst's task step by step in the flight recorder.

**Judges may ask.**
- "Can I run my own case?" Yes. Bring your own takes an application on one of CRS's 20 test people, or uploaded
  case files, and checks the case before it runs.
- "What about sources that disagree?" That was the one miss: E14, three bureaus disagreeing on Castellanos.
- "Can a seat approve itself?" No. The refusal is in code, and the log names who answered.
- "What doesn't it do yet?" The controller's yes in scored runs came from a script so runs could be scored
  unattended. Business credit is simulated because the CRS sandbox has no business route. The scored runs were on
  GurtOS Server; the Business screens come from a seeded box.

## Microsoft

Also the Customer Impact Award.

**30 seconds.** "Companies want agents doing finance work, but pilots never reach production, because a normal OS
gives the agent its owner's keys, no separation of duties, no record and no undo. GurtOS Business answers the
question a company asks first: could we switch this on safely? Each seat has its own user, approvals go to the right
person, a seat starts in shadow mode, and there's an audit and a kill switch, on a computer the company owns."

**How it works.**
- People and roles. Rules in plain words route each approval, like "Requests over $10,000 go to the Controller."
- Answers are refused for your own request, above your limit, or from anything that isn't a person.
- Shadow mode. A seat only suggests for a week, and a person decides. The box counts agreement and goes live only
  when an admin turns it on.
- Sign-in with a work account through Microsoft Entra ID, with roles from Entra groups.

**Why it's better.** Most agent pilots have no answer to "what if it goes wrong". Here the answer is a number.
- Proof: incident drill with 10 agents working (3 Droid seats on Claude, 7 scripted). Every agent frozen within
  271 ms, none took a step while paused, and a bad batch undone in 48 ms while every other task kept its work.
- The same credit desk caught 16 of 17 planted errors and held a $20,000 fake applicant.
- Each control is mapped to Microsoft's six Responsible AI principles, with a protected-attribute test and a plain
  letter for every adverse decision.

**Edition:** GurtOS Business. **Live moment:** Quick run, then answer the fraud referral as the controller, then try
to answer it as the requester and show the refusal. Open Audit as the auditor and export the CSV. Pull the kill switch.

**Judges may ask.**
- "Who's the customer?" A small company's finance team, like Fogline Supply: a controller, sales, an IT admin, an
  auditor and two agent seats. Customer facts with sources are in `CUSTOMER.md`.
- "What's the path to production?" The one-week pilot in `docs/pilot.md`: set up day 0, shadow days 1 to 5, a
  go-live check on day 5, one setting to roll back.
- "Do I need Microsoft products?" No Microsoft product is required for this track. Entra sign-in is there for
  companies that use it.
- "What doesn't it do yet?" Entra sign-in is tested with a standards test provider, not a real tenant. Shadow mode
  hasn't run a real week at a real company. The drill is one measurement on one test box.

## CRS

Overall, Best Financial AI Agent, Best Identity/Fraud and Most Unexpected.

**30 seconds.** "Credit bureaus and lenders are what attackers go after. Equifax lost Social Security numbers for
145.5 million people, and the FTC says admin credentials sat in a plain-text file. Put an agent on credit checks on a
normal OS and it holds the login, approves its own work and can pull any report. The unexpected part is that I built
a whole operating system so an agent can do credit and fraud checks safely, with CRS at the center."

**How it works.**
- The agent never holds the CRS login. The core logs in from the vault and returns a summary with each request id.
- The decision tool refuses to record anything until all seven CRS checks have run in that task.
- Every credit pull needs a stated reason, and each task has a pull limit.
- A fraud hold waits for a person. No agent approves an agent.
- A stranger's agent applying for someone goes through identity checks before the owner is even asked.

**Why it's better.** CRS's data is the core of every decision, not an add-on, and a hijacked agent can't download
reports or argue its way past a fraud stop.
- Proof: APP-1043 has a 640 score and the simple rule approves it for $20,000. Live CRS says identity fails with codes
  2201, 2202 and 2101, Fraud Finder scores it 88, nobody owns its phone, and 9 inquiries landed between Aug 19 and
  Sep 12. Fraud hold, confirmed by the controller.
- Every merge-gate run repeats this live against the sandbox.
- An application that tells the desk to ignore the identity codes is refused in code.

**Edition:** GurtOS Business. **Live moment:** Quick run, open the controller's request on the phone and read the CRS
evidence. Then **Bring your own** with P12 (identity mismatch), P14 (deceased SSN) or P16 (fraud alert).

**Judges may ask.**
- "Is CRS central?" The desk can't decide without the seven checks, and the fraud case page shows every CRS answer.
- "Did you use the MCP server?" Yes, behind the broker, started with the login from the vault and scoped per seat.
- "What doesn't it do yet?" No payment gate for guests, no path for the controller to clear a fraud flag, and no
  ASI:One chat intent for credit. The purpose rule is not FCRA compliance.

## Atlassian

Both tracks: Track 2 (security for agents acting for a user) and Track 1 (agents that do the work).

**30 seconds.** "When an agent acts for you overnight, nobody can see the next morning exactly what it did and why,
or roll back only the part that was wrong. Teams already live in Jira. GurtOS makes every agent task a Jira issue a
teammate can approve or roll back, and the roll back undoes just that task on the computer."

**How it works.**
- A Forge app. Every task is an issue with its prompt, permissions, reasoning, approvals, blocked attempts and diff.
  JQL fields hold state, cost and blocked attempts.
- The task panel has Approve, Deny and Roll back, checked as the signed-in Jira user. Roll back removes that task's
  file layer and every other task keeps its own.
- Track 1: label an issue `gurtos-agent`, assign it to the agent, or add Run in GurtOS to an Automation rule. The
  issue becomes a task with no network, no keys and a small budget.
- A Rovo agent answers what got blocked or changed, and asks before it rolls back or pauses.
- Risky actions go to Jira Service Management approvers. Confluence gets a daily page and an incident page.

**Why it's better.** Most agent tools give you an undo for everything or nothing. This rolls back one issue, or many
from a search, and Jira's permissions plus the company's roles decide who may approve.
- Proof: BOX-29, a scripted agent that misread a rule, changed three configs instead of one and tried to upload a
  file to a paste site. The upload was blocked, the push approved from Jira, then rolled back from Jira and its three
  configs came back.
- Every merge checks that the same roll back leaves another task's fix in place.

**Edition:** GurtOS Business. **Live moment:** open BOX-29 in Jira on the laptop. Show the blocked upload in the
issue, press **Roll back**, and show the configs restored. The demo Jira site isn't public, so this is the place
judges see it live.

**Judges may ask.**
- "What's the technical use of Forge?" Issue panel and resolver, issue-property index for JQL, Rovo agent with three
  actions, bulk action, dashboard gadget and Automation trigger.
- "Can Roll back undo a payment?" No. It undoes file changes. Anything already sent shows in the issue for a person.
- "What doesn't it do yet?" One shared secret guards the box's Jira routes; Forge Remote's signed tokens are next.
  The Jira-user-to-Business-person mapping is tested only against offline stand-ins.

## Armadin

Best Security Hack.

**30 seconds.** "Agents get attacked through the pages they read and the packages they install. On a normal OS a
fooled agent can read every key and send it anywhere. GurtOS stops it at the operating system level, whatever the
model does, and publishes the score, including the attacks it misses."

**How it works.**
- Keys sit in a root-only vault, never in a task's files or environment.
- Each task is its own Linux user in its own copy of the files and sees no process but its own.
- A per-task firewall rule and proxy allowlist, so stolen data has nowhere to go.
- Tripwire keys. Every task gets a decoy AWS key. If it shows up in a request, the box ends the task, undoes it and
  alerts the owner's phone.
- A seccomp filter, two CPU cores, 2 GB of memory and 512 processes per task.

**Why it's better.** Most agent security asks the model to behave. GurtOS assumes it will be fooled.
- Proof: 16 OS-level attacks, 15 caught, 1 published as not covered, run on two machines.
- A poisoned npm package imitating the September 2025 worm, run with a real `npm install`, fails.
- In every merge-gate run, a scripted agent obeys the hidden instructions step by step: the vault read fails, the
  send to attacker.example is refused, a raw connection to 1.1.1.1 is refused, and approving itself is refused.
- Mapped to the OWASP Top 10 for LLM Applications 2025 and Agentic Applications 2026, with a not-covered column.

**Edition:** all three. **Live moment:** start a task allowed only `example.com` that reads the booby-trapped page.
Show the red blocked notice and the log line, then press **Undo task** (command A in `table-demo.md`). Then let the
judge type their own attack in Attack it yourself on try.gurtos.com, from their phone.

**Judges may ask.**
- "What's the miss?" One: an allowed host gets whatever the task sends it, except the box's decoy key, which trips
  the wire. A disk fill used to be the second; now the box measures each task's own layer every 2 seconds and stops
  and undoes a task past its disk cap. It is a watcher, not a filesystem quota.
- "Does it stop prompt injection?" No. The model can still be fooled. GurtOS limits what a fooled agent can do.
- "What about root or the kernel?" Tasks share one kernel, so a kernel exploit escapes. Root can edit the log, but
  the hash chain and Elastic's add-only copy catch it. No disk encryption or verified boot yet, and no independent
  audit.

## Anthropic

**30 seconds.** "My community is solo developers who leave agents like Claude Code or OpenClaw running at home,
unattended. Today those agents run as you, with every key and file. OpenClaw had 21,639 instances anyone on the
internet could reach, per Censys. GurtOS turns a computer you own, even an old one, into one built for that. Each
Claude task runs as its own user in its own copy of your files, with no keys, and you approve, undo or pause it from
your phone."

**How it works.**
- Claude does every task, inside Factory's Droid, and the box picks the model per task (Haiku, Sonnet or Opus 5.5)
  and shows the cost.
- A Haiku second-opinion check looks at risky steps before they run: spending, deleting, using the network.
- A GurtOS MCP server lets Claude Code and Claude Desktop start and watch tasks on your box.
- One-line install on Ubuntu 24.04. It checks for 900 MB of memory and 4 GB of disk.

**Why it's better.** The usual choice is your own machine with full access, or a cloud you can't see into. This is
your machine with the separation built in, usable Monday.
- Proof: in every merge-gate run, a real Claude task held only a placeholder key in 240 of 240 process samples. Its
  changes were undone on their own, and its cost ($0.5378 on Oct 24) came from real token counts.
- The same run reads Claude a page with hidden instructions to steal keys. It refused, and nothing left the box.
- The install ran on a fresh 1 GB VM in 76 seconds.

**Edition:** GurtOS Personal and GurtOS Server. **Live moment:** start a task like "Fix the spelling in notes.md and
change nothing else", show Claude's steps and diff, press **Undo**. Then approve a spend from the phone. Show the
flight recorder or a throwaway box in Try GurtOS live.

**Judges may ask.**
- "Where can it go wrong?" A shared kernel. The model provider sees what the agent sees. An allowed host gets what
  the task sends it. Undo can't recall a payment that already left.
- "Is the Haiku check reliable?" Not fully. It's inconsistent on one case, and we publish that.
- "What doesn't it do yet?" Claude Code as a worker inside a task was cut. Not run: an Anthropic key without
  Factory, a real 1 GB cloud VM, and arm64 timings.

## Factory

Droid SDK.

**30 seconds.** "Coding agents need keys to work, and tools keep leaking them. In August 2025, malicious Nx packages
used AI command-line tools already on developers' machines to hunt for tokens. Droid does the work in GurtOS, and the
OS makes it safe. Each Droid task is its own Linux user with its own firewall rule and its own copy of the files, and
Droid never holds a key."

**How it works.**
- Droid is the worker in every task, started through the Droid SDK, running Claude.
- Plan first. Spec mode writes the plan, and Droid starts only after you approve it on your phone.
- A team of custom droids. A coder, a read-only reviewer that checks the diff, a credit analyst and a shopper.
- Autonomy levels the OS enforces. Low takes away the network and makes every spend ask. Medium caps the budget at
  $1. The firewall holds even if Droid ignores its level.
- Triggers you designed. A GitHub issue labelled `droid` becomes a plan-first task, and the pull request opens through
  the vault's token. `gurtos-exec` is a safe runner for `droid exec`.

**Why it's better.** A chatbot wrapper hides what the agent did. Here every plan, step and diff is visible and
undoable, and the limits sit in the OS, not in a prompt.
- Proof: in every merge-gate run, a Droid task edits a file as its own user while the box samples its processes. All
  240 samples held only a placeholder Factory key. Its cost, $0.5378 on Oct 24, comes from the token counts Droid
  reports.

**Edition:** GurtOS Server and GurtOS Personal. **Live moment:** open the Factory app, start a job with a plan,
approve the plan on the phone, show the reviewer's verdict and the diff, then **Keep** or **Undo**. This needs
Factory credit; if it's short, open a finished Droid task and show its steps and diff, or replay it.

**Judges may ask.**
- "Where does the README say how Droid is used?" `tracks/factory/README.md`.
- "Can Droid get around the hooks?" Yes, the hooks are a convenience in the task user's home. The OS limits are the
  boundary.
- "What doesn't it do yet?" Droid's cost is a display from its own token counts. The pull-request path ran live on
  one test box. The app mislabels a denied plan as "The plan you approved".

## Elastic

Agent Builder on Serverless.

**30 seconds.** "After a week of agents working, a normal OS can't tell you what they did. The logs are scattered,
and anyone with root can edit them. GurtOS keeps one action log, chains each entry to the one before, and Elastic
keeps a copy the box can't rewrite. An Agent Builder agent answers questions about it in plain words."

**How it works.**
- The log streams into a Serverless index, each event once, with a create-only key held by one core job.
- The agent, GurtOS log, has 14 ES|QL tools, a workflow tool and an index search tool.
- Like a receipt book with numbered carbon copies: change one entry and the chain breaks, and the copy at Elastic
  shows it.
- Four alert rules arrive as one approval on the owner's phone. The agent can ask to undo a task, and only ask.

**Why it's better.** Normal logs live on the machine they describe. This record lives outside the box, and Elastic
never gets the power to act.
- Proof: asked "Why did the job routine fail?", the agent found the failed task, read its timeline and named the
  cause. The routine could reach only boards.greenhouse.io, its plan needed www.linkedin.com, and the box blocked it.
- A live run shipped all 156 events of a demo run to Serverless, each exactly once.
- A signed receipt for a finished task, checked in the browser. It records what the box found when it compared the
  task's entries with Elastic's add-only copy.

**Edition:** GurtOS Business and GurtOS Server. **Live moment:** in the signed-in Kibana on the laptop, ask the agent
"Why did the job routine fail?" Or run `node tracks/elastic/agent.ts ask` with the same question.

**Judges may ask.**
- "Can root fake the log?" It's caught, not prevented. A change in the seconds before Elastic has the entry isn't
  caught, and a fully taken-over box can stop sending.
- "Can the agent stop a task?" Only undo is requestable. Pause and stop aren't.
- "What doesn't it do yet?" Person keys are made by hand. The Ask GurtOS page isn't in the merge gate. The Elastic
  trial ends about Oct 30.

## Visa

Reimagining Shopping.

**30 seconds.** "Shopping agents today need your card or your password, stores can't tell a good agent from a bot,
and you can't see or stop what they do. GurtOS Personal runs your shopping agent on your own computer. The agent never
sees your card, every purchase waits for your tap, every order is signed so the store can check it, and undo refunds
it."

**How it works.**
- The card and signing key stay in the root-only vault. Only the buy tool in the core reads them.
- Approve with Face ID. A passkey signs the exact question and amount, and a purchase approved without one is refused.
- Each checkout is signed with Visa's Trusted Agent Protocol, including the order body.
- A signed shopping mandate sets items, stores, price, quantity, total and an expiry of at most 30 days. The store
  enforces it.
- Standing instructions like "when it's under $16" or "keep us stocked", with live prices through Apify, and card-style
  rules: a monthly cap, caps per store, never-buy words.

**Why it's better.** Trust (15%) and UX (25%) usually pull against each other. Here one tap with Face ID is both.
- Proof: on Oct 23, Apify read Chemex filters at Best Buy Canada for $15.36 CAD, the box asked, and after the tap it
  bought them at that price with a Stripe test-mode charge on a Visa test card. Undo refunded it. All test money.
- The store refuses unsigned, changed and replayed orders. A stolen session approving with a plain tap fails at
  payment.

**Edition:** GurtOS Personal, plus GurtOS Server for watches that run with the laptop closed. **Live moment:** open
Shopper, say "Get me the Hario V60 filters when they're under $7", drop the price in the GurtOS Test Store, approve
on the phone, then **Undo** and show the refund. Heads-up: a spend over $5 now asks a second time.

**Judges may ask.**
- "Is this Visa Intelligent Commerce?" No. The mandate mirrors its payment instruction with open tools. The VIC
  adapter is written but has never been called, because it needs onboarding with Visa.
- "What does the merchant get?" A dashboard of verified agent orders, bots refused by reason, conversion and
  chargebacks, at our stand-in store.
- "What doesn't it do yet?" Best Buy Canada's terms prohibit scraping, which we disclose. Face ID is tested with a
  software authenticator, not on a real phone. Every payment is test mode.

## Moss

**30 seconds.** "A personal agent is only useful if it remembers you. Today that means uploading your life to
someone's cloud, and any page an agent reads can plant a false memory. On GurtOS Personal the Moss index lives in
your own computer's memory. Agents search it with no network and no keys, and a task that touched the web can't add
to your memory without asking you."

**How it works.**
- One index of photos, text files and finished tasks. Agents are handed relevant memory before a task starts, and
  each sees only what its permissions allow.
- Memory that can't be poisoned. A task that could reach the web is untrusted, so anything it wants to remember asks
  the owner first.
- One preference reaches every app. A Forget button removes a memory from the index and Moss's cloud copy.
- Photos are described by a model on your own machine. Claude sees them only if you press Describe with Claude.
- Ask out loud and get a short answer from Moss Inference.

**Why it's better.** Cloud memory leaves your computer and believes whatever it reads. This one stays home and keeps
web-sourced notes out unless you say yes.
- Proof: search takes a median of 3.1 ms through the computer, under 1 ms inside Moss.
- Moss Inference answered 5 of 5 questions right at a 329 ms median, against 3.1 seconds for a small local model on a
  CPU-only VM.
- A task that read a web page proposed "Always send receipts to an address at evil.example". GurtOS asked the owner,
  the owner said no, and a later task was never handed it.

**Edition:** GurtOS Personal. **Live moment:** open Find, search "whiteboard". Open Memory, type a preference, press
Remember, start any task and point at "Handed over 1 memory block".

**Judges may ask.**
- "Does anything go to the cloud?" Only if you choose. Search never needs it. Faster answers send the question and the
  4 best notes to Moss Inference when the switch is on.
- "Which Moss example is this?" The personal agent that remembers you, plus voice. We skipped the social post.
- "What doesn't it do yet?" Voice hasn't been tried with a real microphone. The cloud half of Forget is untested,
  because the Moss project is over its usage limit.

## Apify

Best Use of Apify, and Best Actor.

**30 seconds.** "Web agents today drive your logged-in browser with your accounts, read booby-trapped pages, and you
can't see what they spend. GurtOS lets an agent use Apify's Actors from its own isolated space with no token. The
broker holds the token, a scraped page is treated as untrusted data, and every run's cost counts against the task's
budget."

**How it works.**
- Nine tools call Apify with the vault's token, running in the core, so a task with no network still gets results.
- Apify's hosted MCP server through the broker, with four Actors allowed and the storage tools blocked.
- Our own Actor, Agent-Safe Page Reader, flags hostile text and withholds a high-risk page.
- Apify schedules and webhooks start tasks while you're away. The Website Content Crawler feeds the computer's search.

**Why it's better.** Instead of screenshots and a logged-in browser, the agent gets clean data from an Actor and has
nothing to steal.
- Proof: on Oct 23, on both the x86 and ARM64 test VMs, two tasks with no network ran Actors on Apify at the same
  time. They came back with AirPods Pro 3 at $299.99 CAD in stock at Best Buy Canada, and Cole Coffee Café at 6255
  College Ave, Oakland. The token was in neither task's log.

**Edition:** GurtOS Personal and GurtOS Server. **Live moment:** start a task with `apify.checkPrice` and no internet
and ask "What does Best Buy Canada charge for AirPods Pro, and are they in stock?" Then open the cost window for
that task. This needs the Apify token on the demo box.

**Judges may ask.**
- "Is the Actor public?" Its ID is `eFq5SSXGg9brb1hIU`. Apify said on Slack it doesn't need to be on the Store to
  qualify. It goes public once Ben accepts the Store terms in the Console.
- "How do you cap spending?" Twice: Apify's cap on each run, and the task budget, with a phone request above it
  naming Apify as the payee.
- "What doesn't it do yet?" The detector doesn't read stylesheets or run JavaScript. Counted cost is an estimate. The
  credit desk's Apify tool isn't on its analyst's tool list yet.

## Mana

**30 seconds.** "AI workspaces are great for thinking, but there's no safe place for an AI to act on your real
computer. Mana plans it, GurtOS does it safely in an isolated space, and you approve from your phone. Four public Mana
chats changed what I built, and a Mana app lets anyone ask a live GurtOS computer for something."

**How it works.**
- Ask GurtOS, a Mana app built by Mana's agent. A visitor asks for a web lookup or price check. It reaches the owner's
  iPhone and Watch, and nothing runs until the owner says yes. Then it runs with no network of its own and a 25 cent
  budget.
- Rules drafted in a Mana chat become GurtOS Business policy, only after an owner or admin approves the exact text.
- A GurtOS guide agent in Mana answers from gurtos.com with links.

**Why it's better.** Mana is where the design was argued out, and the chats name the code they changed.
- Proof: Mana's review found two customer records for one business, C-1007 and C-1011, each with a $10,000 limit:
  $20,000 of credit in two pieces, each inside the analyst's authority. Rules REL-1 and SOD-5 now treat them as one
  business, and the next live Droid runs cited both.
- 35 of Mana's 69 proposed rules are in the file the agents work from.

**Edition:** GurtOS Personal and GurtOS Business. **Live moment:** open the Ask GurtOS app on the judge's phone, send
a request, and show it arriving on Ben's iPhone for approval. Then open the first public chat next to
`credit-rules.yaml`.

**Judges may ask.**
- "Does the project live inside Mana?" The Ask GurtOS app and the guide agent both run in Mana.
- "Who wrote the chats?" Us, in Ben's voice. Mana's replies are its own and unedited.
- "What doesn't it do yet?" QA hasn't walked the rules sync or talked to the guide by hand; the merge gate covers both
  on a throwaway computer. A visitor watches in Mana but approves on the portal or phone.

## Figma

Best Workflow, Stage Log, Best Design and Most Creative.

**30 seconds.** "An OS for agents is a whole suite: a box screen, a portal, a Linux desktop, phone, watch and Mac apps.
That needs one design system, or every screen drifts. Everything in GurtOS comes from the same Figma variables, and a
check fails when the code drifts from the design."

**How it works.**
- FigJam for ideas and architecture, Figma Design for screens, Make for the first prototype, the MCP server to turn
  frames into code, Slides for the deck, Sites for the landing page.
- Every Figma variable is a CSS custom property of the same name. Figma's `accent/bg` is `--color-accent-bg` in the
  code, with the same two values.
- 95 Code Connect templates map Figma components to the code. An app-versus-frame comparison scores 77 frames.

**Why it's better.** Handoff usually loses the design. Here the drift check proves it didn't.
- Proof: 0 drifts across 82 Figma tokens on main.
- The portal the box runs today was generated from the v2 frames through Figma's MCP server.
- Stage log: 57 sessions, 755 minutes, each stage under the 200-word cap.

**Edition:** all three. **Live moment:** run `node docs/figma/tokens/sync.ts --check` and show 0 drifts. Then open
the design file next to the running portal.

**Judges may ask.**
- "Do the native apps use the tokens?" The colours are copied by hand into `Theme.swift`; the check covers the web kit.
- "Where's the stage log?" In the Figma Slides deck and `docs/stagelog.md`.
- "What doesn't it do yet?" Code Connect isn't published, because that needs an Organization plan. Weave art wasn't
  made. The Make files have no published URL.

## Fetch.ai

ASI:One Agent Challenge.

**30 seconds.** "A chat agent can only act if it runs somewhere: a cloud you can't see into, or your own computer with
full access. And agents that talk to strangers' agents can be fed hidden instructions. GurtOS gives an ASI:One agent a
safe body. Each chat request runs as its own sandboxed task with no keys, asks before it spends, and can be undone."

**How it works.**
- The box is an agent on Agentverse, using the Chat Protocol, with the whole flow in an ASI:One chat.
- Only the paired owner gives work. The pairing code shows only on the box's screen or the owner's phone.
- Over budget, an Interactive Card with Approve or Deny. The result comes back with its diff and Keep or Undo.
- A team of agents (Shopper, Find, Credit Desk) and strangers' replies treated as data. A hidden instruction is
  blocked and logged, never quoted.
- The Payment Protocol in test FET, through the box's one budget path.

**Why it's better.** The agent is reachable at 3 AM through its Agentverse mailbox with no open port, and a reply from
a stranger can't start a task, approve, pay or pair.
- Proof: in a live run through ASI:One, a Droid task fixed the failing test in a sample repo for $0.05 and sent back
  the diff with Undo.
- A stock check paused at a $0.50 web search over its $0.25 budget, sent a card, and after Approve answered "in stock
  on Hario's US store at $10.25".
- Three box agents shared one SpacetimeDB queue with real Droid, each job to exactly one, 3 of 3 finished.

**Edition:** GurtOS Server, and GurtOS Personal too. **Live moment:** open the ASI:One window on the box screen, send
`pair <code>` from ASI:One, then "fix the failing test in my project". Approve the card, then press **Undo**.

**Judges may ask.**
- "Is it on Agentverse?" Yes, with a public profile anyone can open signed out.
- "What stops a malicious agent?" Its reply is only ever relayed. Screening plus asi1-mini catch common shapes, and a
  novel one still can't make the box do anything.
- "What doesn't it do yet?" No screenshot of the ASI:One chat page; the runs went through ASI:One's API. A card click
  through the planner applies to the last card in that chat. Payments are test FET only.

## Coinbase

x402 Payment Agents.

**30 seconds.** "Giving an agent money means handing it your card or a private key. GurtOS makes an agent wallet safe.
The key never reaches the agent, each task has a budget, anything over it waits for your tap, and every payment is on
the record. Agents pay for APIs with x402, shop for them in the Bazaar, and the box earns too."

**How it works.**
- The wallet key is in a root-only file. Only `wallet.pay` inside the box opens it.
- Budgets are reserved before the call, so two payments at once can't both slip through.
- Approve from the iPhone with Face ID, the Mac with Touch ID, or the Watch up to $25.
- The box sells over x402: an audit proof for $0.01, metered search up to $0.02, and renting its agent for $0.25 after
  the owner approves. Its routes are listed in the x402 Bazaar.
- One command installs the same wallet for Claude Code or any MCP agent.

**Why it's better.** Most agent wallets trust the agent with the key. Here the agent only asks, and the OS pays.
- Proof: a real agent was told only "buy one joke and one report". It paid $0.01, waited for the OK on the $0.03
  report, then paid it. Both settled through Coinbase's CDP facilitator on Solana devnet, and neither key appears in
  the log.
- A metered search capped at $0.02 was charged $0.002.
- A real Claude Code session installed the wallet and paid $0.01 over MCP.

**Edition:** GurtOS Server, and GurtOS Business. **Live moment:** run
`curl -i https://gurt-cloud.box.gurtos.com/t/wallet/sell/audit` and show the `402 Payment Required`. Then
`/api/tasks` on the same box answers 401. Then a spend request on the phone.

**Judges may ask.**
- "Is it reusable?" `tracks/wallet/install.sh` installs it as an MCP server and skill. Apache-2.0.
- "Which Coinbase tools?" x402 v2 SDK, the CDP facilitator, Bazaar discovery, the upto scheme, Onramp in sandbox.
- "What doesn't it do yet?" Devnet only. The CDP Server Wallet policy lock is built and unit-tested but not run live.
  Onramp is a flow test. GET requests only.

## Solana

MLH: Best use of Solana.

**30 seconds.** "Giving an agent money means handing it a private key on a system with nothing built for that. An
always-on box you own holds the Solana wallet where agents can't read it, so agents pay for APIs at any hour without
ever seeing the key. Every payment is a devnet transaction anyone can check, with the task id written on chain."

**How it works.**
- USDC transfers on devnet, signed in the core. Tasks only get results.
- The facilitator pays every fee, so there's one balance to watch.
- Metered payments through a payment channel. The agent locks a cap, the seller takes what it used, and the rest
  comes back.
- A memo on every payment names the task. The box writes a fingerprint of its action log to Solana, so anyone can
  check the log wasn't changed after.

**Why it's better.** Solana here is the public record, not only the payment rail.
- Proof: on Oct 24, 109 finalized devnet transactions named the box's wallet, none failed. 70 fixed-price payments
  (1.32 devnet USDC), 13 metered payments, 11 log fingerprints.
- The wallet paid no payment fee, only for its own fingerprints.

**Edition:** GurtOS Server, and GurtOS Business. **Live moment:** open the wallet's history on Solana Explorer
(devnet) and click a payment. The fee payer isn't the wallet, 0.01 USDC moves, and the memo reads `gurtos task=...`.

**Judges may ask.**
- "Why devnet?" By design. Mainnet needs real USDC and a review.
- "What does the fingerprint prove?" It shows a change made after it was written, not one made before.
- "What doesn't it do yet?" No mainnet. After a power cut mid-payment the call fails instead of checking the chain.

## SpacetimeDB

**30 seconds.** "Live agent state usually needs a database, a websocket server, a cache and auth glue. That's heavy and
fragile, and a normal OS has nothing for it. GurtOS runs one self-hosted SpacetimeDB per box as its live state, with
the rules in the database. Agents claim shared work atomically, each person gets only their own requests, and the
first answer wins."

**How it works.**
- Tasks and approval requests are mirrored live. Only the box can write them, and screens answer through a reducer.
- A shared work queue with atomic claims and agent presence.
- Private tables and a per-connection view, so each person is sent only what's routed to them.
- A scheduled reducer brings a second person into a request still pending. Live meters for running, needs you, done,
  failed and spend.

**Why it's better.** SpacetimeDB is the core of the live system, not a side store, and two approvers can't both say yes.
- Proof: 3 agents made 15 claims on 12 jobs at once and got 12 distinct jobs, none twice.
- Used live by the Fetch.ai team (3 Droid agents) and the credit desk (two analyst agents).
- In every merge-gate run a request shows live while another task keeps running, a stranger's identity is refused,
  and the timer brought Priya in after 3 seconds.

**Edition:** all three, strongest in GurtOS Business. **Live moment:** open the Live board, start a task that spends
over budget, approve on one screen and watch the other clear at once, with "already approved by" and the name.

**Judges may ask.**
- "Why not Maincloud?" Each box runs its own. A fleet view on Maincloud is opt-in and sends counts only, never a
  prompt, file or key.
- "Is the action log in SpacetimeDB?" No, it stays on disk so undo and resume don't depend on it.
- "What doesn't it do yet?" Phones use the box's token-checked API, not SpacetimeDB, so they refresh every 2 seconds.
  SpacetimeDB has no login of its own, so it listens on the box only.

## Vultr

MLH: Best use of Vultr.

**30 seconds.** "An agent computer should be reachable around the clock without exposing everything on it. A normal
cloud VM runs every agent as one user holding every key. GurtOS Server runs wherever a VM does, and Vultr runs the
parts of GurtOS that must be public or big."

**How it works.**
- The always-on public box on Vultr answers Jira, Mana and x402 buyers, while the rest of its API stays closed.
- The relay that gives every box its own address runs on Vultr. TLS ends on the box, so the relay sees only encrypted
  traffic.
- Release discs are built on Vultr and mirrored on Object Storage with signed checksums.
- Encrypted backups to Object Storage, so Vultr holds only ciphertext. The cloud firewall is set from code and refuses
  unsafe rule sets.

**Why it's better.** The real OS disc boots on the smallest Vultr instance.
- Proof: the GurtOS Server release disc installed on a vc2-1c-1gb (1 vCPU, 1 GB) in about 5 minutes and booted from
  its own disk after the disc was detached.
- An encrypted backup restored onto a fresh instance in 2.8 seconds, with a waiting task still waiting.
- Three live tests cost under $0.20 in all.

**Edition:** GurtOS Server. **Live moment:** open `https://gurt-cloud.box.gurtos.com/t/mana/status` on the judge's
phone, then `/api/tasks` on the same box and show it answers 401.

**Judges may ask.**
- "Did you use Vultr Inference?" No, it needs a paid subscription. Nothing depends on it.
- "What doesn't it do yet?" First-boot setup was shown on Vultr, not clicked through. The restore ran from the debug
  build of the same image. One Object Storage key can write every bucket.

---

# Cal Hacks prizes

## Most Creative

**30 seconds.** "Everyone is building agents. I built the computer they live on. GurtOS is an operating system whose
main user is AI agents: OpenClaw-style power, with the safety parts OpenClaw lacks. And it's a whole suite, not one
app. Three editions, phone, watch and Mac apps, remote access, an app platform 18 sponsor integrations plug into, and
public docs."

**How it works.** The hotel from the general version. Each agent gets its own room (its own user and copy of the
files), never the master key, only certain doors, and the front desk calls your phone before it spends.

**Why it's better.** The usual answer to agent risk is a better prompt. This one changes the computer. Proof: the four
moments run live, and every sponsor feature runs on the same OS.

**Edition:** GurtOS Personal for the surprise of a normal desktop with agents beside you. **Live moment:** a task asks
for an OK, the judge sees it on the phone, approves, then presses Undo.

**Judges may ask.** "Isn't this just containers?" Containers know nothing about agents: no approvals, budgets,
per-task undo, vault or phone. "What doesn't it do yet?" It's a preview, built on Ubuntu 24.04, not a new kernel.

## Most Technically Complex

**30 seconds.** "GurtOS needs things only an operating system can do. Each task's private copy of files at the
filesystem level, a firewall per task, agents as separate users without sudo, a hard power cut that resumes every task,
and whole-system updates that roll back."

**How it works.**
- Each task gets an overlayfs copy-on-write layer. No copying, no locks, and undo removes one layer.
- Per-task nftables rules, a seccomp filter and memory and CPU caps through systemd.
- An fsynced, hash-chained action log. After a hard kill the box rebuilds every task from it, with no step done twice.
- A bootable Server image with A and B system slots, built from 40 named Ubuntu packages on a 1.37 GB disc.
- SpacetimeDB for live state with atomic claims, native apps on three Apple platforms plus Android.

**Why it's better.** Proof: the merge gate starts a fresh box on a VM and runs the four moments and every app. On
Oct 24 it passed 24 sections and 266 checks with 0 failures. Undo of a batch took 48 ms.

**Edition:** GurtOS Server. **Live moment:** pull the plug on a running task and show it resume after boot. Or replay a
task in the flight recorder.

**Judges may ask.** "What's the hardest part?" Resume after a hard kill without doing a step twice, including a bill
payment, when the bank takes no idempotency key. "What doesn't it do yet?" Tasks share one kernel. No disk encryption
or verified boot.

## Best People-First Social Impact

**30 seconds.** "AI agents are moving into people's lives with access to their money, files and identity, and the
person is the last to know what happened. GurtOS puts the person first. Nothing spends without your tap, anything can
be undone, your photos and memory stay on your own computer, and it runs on hardware you already own, for free."

**How it works.**
- The person decides. Spending, risky steps and anything a web page suggested to remember wait for your answer.
- It runs on a computer you own. GurtOS Server's minimum is 4 GB of memory and 17 GB of disk, no GPU.
- Open source under Apache-2.0, so anyone can check it, run it and change it.
- Fairness by construction in the credit desk. The seats never see protected attributes, and every adverse decision
  gets a plain letter with the main reasons.

**Why it's better.** Today's agents are risky for normal people. Per Censys, OpenClaw had 21,639 instances anyone on the
internet could reach, and Koi Security found 341 malicious skills out of 2,857 on ClawHub. Proof: 16 attacks, 15
stopped, 1 published as not covered.

**Edition:** GurtOS Personal. **Live moment:** the booby-trapped page fails, then Undo.

**Judges may ask.** "Who benefits first?" People running agents at home, and small businesses that can't afford an
IT team. "What doesn't it do yet?" It needs some setup, and the phone apps aren't in the App Store yet; the iPhone app
is in internal TestFlight.

## Best Solo Hack

**30 seconds.** "I built GurtOS alone this weekend: an operating system for AI agents in three editions, a web portal,
phone, watch and Mac apps, and 18 sponsor integrations, open source."

**How it works.** I worked like a lead engineer with a team of coding agents in parallel, one per area. One rule kept
it honest: nothing merged unless the merge gate passed. It boots a fresh Ubuntu VM and runs the four moments and every
app's demo.

**Why it's better.** The scope matches a team's, and the gate shows it works. Proof: on Oct 24 the gate passed 24
sections and 266 checks with 0 failures.

**Edition:** whichever the judge cares about. **Live moment:** the four moments on the demo box.

**Judges may ask.** "Did AI write it?" Coding agents wrote much of the code under my direction. I chose the design,
reviewed it, and the merge gate tested every change on a real VM. GurtOS is built for that same kind of agent work.
"What doesn't it do yet?" It's a preview. The roadmap is in the repo.
