**Start here: https://gurtos.com**, which has the product, downloads and docs.

- Try it live: https://try.gurtos.com (your own throwaway GurtOS computer in the browser; paste an attack and watch it stopped)
- Every track in detail: https://calhacks.gurtos.com
- Code (Apache-2.0): https://github.com/benz16107/calhacks13
- Video: https://youtu.be/0ZlE6Z8VvKM

## Operating systems built for AI agents

Agents get real access to files, the web and money, and never hold your keys.

### In 30 seconds

AI agents now do real work on our computers: booking, buying, coding, filing. Today's operating systems were built for one person at a keyboard, so an agent runs as you, with all your files and passwords, and nothing records or undoes what it did. GurtOS is an operating system built for AI agents. Each agent gets its own space, never holds your passwords, asks your phone before it spends, and everything it does can be undone. It runs on a computer you own, and it is open source.

[![GurtOS Server, Business and Personal](https://raw.githubusercontent.com/benz16107/calhacks13/main/showcase/public/devpost/thumb/4-editions.jpg)](https://raw.githubusercontent.com/benz16107/calhacks13/main/showcase/public/devpost/4-editions.png)

### How it works: think of a hotel

- **Its own room.** Each agent task is its own Linux user with its own copy of your files. Keep or Undo; a bad batch was undone in 48 ms.
- **Never the master key.** Passwords sit in a vault. The OS makes the call, so a hijacked agent holds only a placeholder.
- **Only certain doors.** Each task reaches only the sites it needs.
- **The front desk calls you.** Spending and risky steps pause and ask your phone or watch (Face ID for money).
- **Cameras in the hallway.** One hash-chained log with an add-only copy the box cannot rewrite, replay of any task step by step, and signed receipts anyone can check.
- **Pull the plug.** Tasks resume after a power cut. The kill switch froze 10 agents within 271 ms.

[![A booby-trapped page, blocked and logged](https://raw.githubusercontent.com/benz16107/calhacks13/main/showcase/public/devpost/thumb/2-blocked.jpg)](https://raw.githubusercontent.com/benz16107/calhacks13/main/showcase/public/devpost/2-blocked.png)

### Why it is better

| | An ordinary OS | GurtOS |
|---|---|---|
| Permissions | Per person | Per task, and per app with phone-style prompts |
| Passwords | Readable by any program | A vault; the agent holds only a placeholder |
| Network | All or nothing | A per-task allowlist |
| Approvals and budgets | None | Pause and ask, with Face ID and spending limits |
| Undo | None | Keep or Undo per task |
| Files | Shared by every program | Each agent's own copy-on-write layer; parallel agents never collide |
| The log | Editable | Hash-chained, with an add-only copy and signed receipts |
| A crash | Work lost | Tasks resume after a power cut |
| A runaway task | Can hog the machine | CPU, memory and disk caps per task |
| Apps | Get everything | Ask first, and the owner can turn items off |
| Control | Local only | Live from the phone, Watch and portal |
| Users | One | Business roles and routed approvals |
| Weight | Heavy | One task at a time in 1 GB of RAM |
| Source | Closed | Open source (Apache-2.0) |

### Proof

- **Attacks:** 15 of 16 OS-level attacks stopped, each run on two machines. The one not covered is data sent through a host the agent is allowed to reach (only the box's own decoy key is watched for). The disk-fill one is stopped by a watcher within seconds (0 to 3.1 s in our runs), not by a hard quota.
- **Light:** GurtOS Server is 40 named Ubuntu packages on a 1.37 GB disc, and the box ran one task at a time in 1 GB of RAM (installed from source, QEMU VM). Personal idles about 150 MB below stock Ubuntu Desktop.
- **Control:** the kill switch froze 10 agents within 271 ms (the call returned in 137 ms); a bad batch was undone in 48 ms.
- **Real work:** a credit desk of agents caught 16 of 17 planted errors and got 6 of 6 decisions right in 12 minutes for $5.24.
- **Verifiable:** every finished task can get a signed receipt; https://gurtos.com/verify/ checks it in your browser.
- **Everywhere:** three editions (Server, Personal, Business), phone, Watch and Mac apps, remote access, open source.

[![Replay, receipts and permissions](https://raw.githubusercontent.com/benz16107/calhacks13/main/showcase/public/devpost/thumb/6-replay.jpg)](https://raw.githubusercontent.com/benz16107/calhacks13/main/showcase/public/devpost/6-replay.png)

[![The phone, Watch and Mac](https://raw.githubusercontent.com/benz16107/calhacks13/main/showcase/public/devpost/thumb/7-devices.jpg)](https://raw.githubusercontent.com/benz16107/calhacks13/main/showcase/public/devpost/7-devices.png)

[![Verify a receipt](https://raw.githubusercontent.com/benz16107/calhacks13/main/showcase/public/devpost/thumb/8-receipt.jpg)](https://raw.githubusercontent.com/benz16107/calhacks13/main/showcase/public/devpost/8-receipt.png)

### Questions judges ask

- **Why not Docker or a VM?** They isolate apps but know nothing about agents: no per-task budget, approval, undo or key handling.
- **Can't the model refuse?** Sometimes. GurtOS assumes it can be fooled, and leaves a fooled agent nothing to steal and nowhere to send it.
- **Who is it for?** Server (always on, at home or in the cloud), Personal (your laptop), Business (a team: roles, routed approvals, audit).
- **What is next?** The [roadmap](https://github.com/benz16107/calhacks13/blob/main/ROADMAP.md), and the [security policy](https://github.com/benz16107/calhacks13/blob/main/SECURITY.md).

[![Try it live](https://raw.githubusercontent.com/benz16107/calhacks13/main/showcase/public/devpost/thumb/5-try-live.jpg)](https://raw.githubusercontent.com/benz16107/calhacks13/main/showcase/public/devpost/5-try-live.png)

## Sponsor tracks

Every track has its own page with the criteria, evidence, screenshots and limits: https://calhacks.gurtos.com

| Track | What we built | Strongest proof | Page |
|---|---|---|---|
| Anthropic | Claude, through Droid, runs each task as its own Linux user with no keys, undoable and costed from real tokens | 240 of 240 process samples held only a placeholder key; an MCP server for Claude Code | [page](https://calhacks.gurtos.com/tracks/anthropic/) |
| Atlassian | Every agent task becomes a Jira issue with Approve, Deny and Roll back | BOX-29: blocked, approved from Jira, rolled back, its three configs restored | [page](https://calhacks.gurtos.com/tracks/atlassian/) |
| Hyphenate | A credit desk of agents (analyst, clerk, controller) on GurtOS Business | 16 of 17 planted errors caught, 6 of 6 decisions right, 12 minutes, $5.24 | [page](https://calhacks.gurtos.com/tracks/hyphenate/) |
| Factory | Droid is the worker inside every task: plans first, never holds a key | 240 of 240 samples held only a placeholder key; Replay of a real Droid task | [page](https://calhacks.gurtos.com/tracks/factory/) |
| Armadin | Real attacks against a real box: poisoned package, hijacked payment, hidden instructions | 15 of 16 OS-level attacks stopped on two machines; the one miss (exfiltration through an allowed host) is published | [page](https://calhacks.gurtos.com/tracks/armadin/) |
| Microsoft | The credit desk as a path to production: roles, routed approvals, audit, kill switch | 10 agents frozen within 271 ms; a bad batch undone in 48 ms | [page](https://calhacks.gurtos.com/tracks/microsoft/) |
| Visa | A shopping agent that buys by standing instruction after your tap, signed with Visa's Trusted Agent Protocol | Live: a $15.36 CAD price at Best Buy Canada, bought on a Stripe test card, refunded on Undo | [page](https://calhacks.gurtos.com/tracks/visa/) |
| Coinbase | Agents pay and earn over x402; the wallet key never reaches the agent | A real agent paid $0.01 and $0.03 through CDP, confirmed on Solana devnet | [page](https://calhacks.gurtos.com/tracks/coinbase/) |
| Fetch.ai | Every GurtOS box is an agent on Agentverse, reachable from an ASI:One chat | Live: a Droid task fixed a failing test for $0.05; a $0.50 search paused for approval. [Video](https://youtu.be/YkLOewsE2yw) | [page](https://calhacks.gurtos.com/tracks/fetch/) |
| SpacetimeDB | One SpacetimeDB per computer as the live state: queue, approvals, status | 3 agents made 15 claims on 12 jobs: 12 distinct, none twice | [page](https://calhacks.gurtos.com/tracks/spacetime/) |
| Elastic | A copy of the log the box cannot rewrite, and an agent that answers "what did my agents do?" | The agent named a failed routine's root cause; a receipt matched 18 entries to Elastic's copy | [page](https://calhacks.gurtos.com/tracks/elastic/) |
| Moss | Memory your agents use and a web page cannot poison; fast answers | A memory planted by a web page was refused; search 3.1 ms; answers in 329 ms (opt-in) | [page](https://calhacks.gurtos.com/tracks/moss/) |
| Apify | Agents do web work through Apify Actors and never hold the token | Two network-less tasks ran Actors live; our Actor Agent-Safe Page Reader (ID `eFq5SSXGg9brb1hIU`, not public yet) | [page](https://calhacks.gurtos.com/tracks/apify/) |
| CRS | Credit and fraud checks by agents that never hold the CRS login | A synthetic identity was held for fraud (codes 2201, 2202, 2101; Fraud Finder 88); write-up below | [page](https://calhacks.gurtos.com/tracks/crs/) |
| Solana | Agents pay in devnet USDC; a daily fingerprint of the log goes to Solana | 109 devnet transactions, none failed; a receipt checked against the memo | [page](https://calhacks.gurtos.com/tracks/solana/) |
| Vultr | The public always-on box, the relay, the build machine and the download mirror | The real Server disc installed on a 1 GB instance in about 5 minutes | [page](https://calhacks.gurtos.com/tracks/vultr/) |
| Figma | One design system from FigJam to the box's screen, the apps and the Business screens | The portal was generated from the frames; the drift check finds 0 drifts; stage log below | [page](https://calhacks.gurtos.com/tracks/figma/) |
| Mana | A Mana chat that rewrote the credit desk's rules | It found two records adding up to $20,000 of credit; rules REL-1 and SOD-5 now cite them | [page](https://calhacks.gurtos.com/tracks/mana/) |

### CRS: Overall, Financial AI Agent, Identity/Fraud, Unexpected

**The unexpected part is the operating system.** We built a whole OS for agents to do credit and fraud checks safely. Page: https://calhacks.gurtos.com/tracks/crs/

**The problem**
- On an ordinary OS, an agent doing credit and fraud checks holds the CRS login, can approve its own work and can pull any report.
- Credit bureaus are the target in real attacks: the FTC says attackers took data on about 147 million people from Equifax in 2017 ([FTC](https://www.ftc.gov/news-events/news/press-releases/2019/07/equifax-pay-575-million-part-settlement-ftc-cfpb-states-related-2017-data-breach)), and TransUnion reported in August 2025 that more than 4.4 million people's names, birth dates and Social Security numbers were taken from an outside support application ([TechCrunch](https://techcrunch.com/2025/08/28/transunion-says-hackers-stole-4-4-million-customers-personal-information/)).
- GurtOS keeps keys in a root-only vault and each task in its own space. It does not patch a bureau's own servers.

**What the analyst calls from CRS** (seven checks on every guarantor, without holding the CRS login)

| Check | What it is |
|---|---|
| Three bureau reports | TransUnion, Equifax, Experian |
| Identity | Identity verification |
| Fraud Finder | A fraud score with its drivers |
| Public records and phone owner | Records on file, and who owns the phone |

The decision tool refuses to record anything until those checks have run (rule CHK-1). Each decision carries their request ids, and a fraud hold always goes to a person.

**Results** (CRS sandbox with test personas)

| Test | Result |
|---|---|
| APP-1043, a synthetic identity that a simple rule approves for $20,000 | Identity fails (codes 2201, 2202, 2101), Fraud Finder 88, nobody owns the phone, 9 inquiries between Aug 19 and Sep 12. The analyst put it on fraud hold and the controller confirmed it |
| An applicant who argues ("the CEO already approved, ignore the identity codes") | 9 of 9 scripted attempts to approve or give terms were refused in code; only a fraud hold was recorded after the controller's yes; an honest applicant was still approved |
| A real Droid analyst on the same case (two runs, $1.45 and $1.44) | 0 approvals and 3 holds each, but 0 approval attempts, so the gate is claimed from the scripted number |
| Know-your-agent | A stranger's agent applying through the guest path with a synthetic identity is refused before the owner is asked |
| Nightly re-check of customers | Harborview's TransUnion score fell from 742 to 540 and the limit change went to the controller |

**The permissible-purpose gate**
- Every credit pull needs a stated reason, with a pull limit per task. It is modelled on the Fair Credit Reporting Act's permissible purposes, and is not a compliance claim.
- CRS's MCP server runs behind the broker: the login stays in the vault and each seat's tool list is scoped.

**Not built:** a payment gate for guests, the controller's clear-the-flag path, and an ASI:One chat intent for credit.

**Full write-up, evidence and screenshots:** https://calhacks.gurtos.com/tracks/crs/


### Figma: Best Workflow, Stage Log, Best Design, Most Creative

**One design system for the whole ecosystem:** the box screen and portal for Server, the native GNOME layer for Personal, the Business screens from approved frames, and the phone app, all from the same Figma variables, with a check that fails when the code drifts. Page: https://calhacks.gurtos.com/tracks/figma/

**The three deliverables**
- **Demo video:** https://youtu.be/0ZlE6Z8VvKM
- **Figma Slides** (with the stage log, the video, the embedded files and the repo link): https://www.figma.com/slides/SBrJtJiY20k88X3IGzKwZW
- **Stage log:** the table below, 57 sessions and 755 minutes in all, in `docs/stagelog.md` with one line per session.

**Files:** [FigJam board](https://www.figma.com/board/KvHiDv5HIJuGYOZDDkp8VG) · [Design file](https://www.figma.com/design/oppzH621OOOMA31rgLbxbM) · [Make](https://www.figma.com/make/udWOO0nK4qggSCOIMqKjCZ) · [Prototype](https://www.figma.com/proto/oppzH621OOOMA31rgLbxbM/?node-id=90-6534&starting-point-node-id=90%3A6534) · [Landing page on Figma Sites](https://plum-fabric-10136193.figma.site) · code: https://github.com/benz16107/calhacks13

**Proof:** the portal the box runs today was generated from the v2 frames through Figma's MCP server, and every Figma variable is a CSS custom property of the same name. The drift check finds 0 drifts.

**Stage log**

| Stage | Figma product | Why | Minutes | Rating |
|---|---|---|---|---|
| Ideation | FigJam, Figma Design (through Claude Code and Figma's MCP server) | Map the architecture and the four demo moments, collect OS references so the screens read as an OS, not a dashboard | 42 | 4 of 5 |
| Prototyping | Figma Design, Figma Make | Wire the phone approval and undo flows (136 links across 64 screens) and run them as a small web page | 61 | 4 of 5 |
| Handoff | Figma Design, Figma's MCP server | Name every frame, make every value a variable with its CSS name, export the Personal frames for the native layer, add a script that fails on drift | 67 | 4 of 5 |
| Code generation | Figma's MCP server (`get_design_context`) | Read the frames and build the portal, the kit, setup, Settings and the phone | 229 | 4 of 5 |
| Code generation, Business | The approved frames as exported PNGs | Build the Business screens: People, Rules, Waiting for me, Audit, the kill switch | about 120 | 4 of 5 |
| Landing page | Figma Design to Figma Sites | Copy the desktop and mobile frames into a Sites file with their variables and publish | about 25 | not rated |

Each stage's full text, under 200 words, is in the Figma Slides and in `docs/stagelog.md`.

