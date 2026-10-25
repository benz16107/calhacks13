**Try it live: https://try.gurtos.com**

- Try it live: https://try.gurtos.com (your own throwaway GurtOS computer in the browser; paste an attack and watch it stopped)
- Product, download and docs: https://gurtos.com
- Every track in detail: https://calhacks.gurtos.com
- Code (Apache-2.0): https://github.com/benz16107/calhacks13
- Video: https://youtu.be/GMR41DPjbpw

## Operating systems built for AI agents

Agents get real access to files, the web and money, and never hold your keys.

### In 30 seconds

AI agents now do real work on our computers: booking, buying, coding, filing. Today's operating systems were built for one person at a keyboard, so an agent runs as you, with all your files and passwords, and nothing records or undoes what it did. GurtOS is an operating system built for AI agents. Each agent gets its own space, never holds your passwords, asks your phone before it spends, and everything it does can be undone. It runs on a computer you own, and it is open source.

![GurtOS Server, Business and Personal](https://raw.githubusercontent.com/benz16107/calhacks13/main/showcase/public/devpost/4-editions.png)

### How it works: think of a hotel

- **Its own room.** Each agent task is its own Linux user with its own copy of your files. Keep or Undo; a bad batch was undone in 48 ms.
- **Never the master key.** Passwords sit in a vault. The OS makes the call, so a hijacked agent holds only a placeholder.
- **Only certain doors.** Each task reaches only the sites it needs.
- **The front desk calls you.** Spending and risky steps pause and ask your phone or watch (Face ID for money).
- **Cameras in the hallway.** One hash-chained log with an add-only copy the box cannot rewrite, replay of any task step by step, and signed receipts anyone can check.
- **Pull the plug.** Tasks resume after a power cut. The kill switch froze 10 agents within 271 ms.

![A booby-trapped page, blocked and logged](https://raw.githubusercontent.com/benz16107/calhacks13/main/showcase/public/devpost/2-blocked.png)

### Why it is better

| | An ordinary OS | GurtOS |
|---|---|---|
| Permissions | Per person | Per task, and per app manifest |
| Passwords | Files and variables any program can read | A vault the agent never reaches |
| Approval, budget, undo | None for agents | Built in: your phone asks, daily limits, Undo |
| Record | Whatever the agent logs | One hash-chained log, replay, signed receipts |

### Proof

- **Attacks:** 15 of 16 OS-level attacks stopped, each run on two machines. The one not covered is data sent through a host the agent is allowed to reach (only the box's own decoy key is watched for). The disk-fill one is stopped by a watcher within seconds (0 to 3.1 s in our runs), not by a hard quota.
- **Light:** GurtOS Server is 40 named Ubuntu packages on a 1.37 GB disc, and the box ran one task at a time in 1 GB of RAM (installed from source, QEMU VM). Personal idles about 150 MB below stock Ubuntu Desktop.
- **Control:** the kill switch froze 10 agents within 271 ms (the call returned in 137 ms); a bad batch was undone in 48 ms.
- **Real work:** a credit desk of agents caught 16 of 17 planted errors and got 6 of 6 decisions right in 12 minutes for $5.24.
- **Verifiable:** every finished task can get a signed receipt; https://gurtos.com/verify/ checks it in your browser.
- **Everywhere:** three editions (Server, Personal, Business), phone, Watch and Mac apps, remote access, open source.

![Replay, receipts and permissions](https://raw.githubusercontent.com/benz16107/calhacks13/main/showcase/public/devpost/6-replay.png)

![The phone, Watch and Mac](https://raw.githubusercontent.com/benz16107/calhacks13/main/showcase/public/devpost/7-devices.png)

![Verify a receipt](https://raw.githubusercontent.com/benz16107/calhacks13/main/showcase/public/devpost/8-receipt.png)

### Questions judges ask

- **Why not Docker or a VM?** They isolate apps but know nothing about agents: no per-task budget, approval, undo or key handling.
- **Can't the model refuse?** Sometimes. GurtOS assumes it can be fooled, and leaves a fooled agent nothing to steal and nowhere to send it.
- **Who is it for?** Server (always on, at home or in the cloud), Personal (your laptop), Business (a team: roles, routed approvals, audit).
- **What is next?** The [roadmap](https://github.com/benz16107/calhacks13/blob/main/ROADMAP.md), and the [security policy](https://github.com/benz16107/calhacks13/blob/main/SECURITY.md).

![Try it live](https://raw.githubusercontent.com/benz16107/calhacks13/main/showcase/public/devpost/5-try-live.png)

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
| Fetch.ai | Every GurtOS box is an agent on Agentverse, reachable from an ASI:One chat | Live: a Droid task fixed a failing test for $0.05; a $0.50 search paused for approval | [page](https://calhacks.gurtos.com/tracks/fetch/) |
| SpacetimeDB | One SpacetimeDB per computer as the live state: queue, approvals, status | 3 agents made 15 claims on 12 jobs: 12 distinct, none twice | [page](https://calhacks.gurtos.com/tracks/spacetime/) |
| Elastic | A copy of the log the box cannot rewrite, and an agent that answers "what did my agents do?" | The agent named a failed routine's root cause; a receipt matched 18 entries to Elastic's copy | [page](https://calhacks.gurtos.com/tracks/elastic/) |
| Moss | Memory your agents use and a web page cannot poison; fast answers | A memory planted by a web page was refused; search 3.1 ms; answers in 329 ms (opt-in) | [page](https://calhacks.gurtos.com/tracks/moss/) |
| Apify | Agents do web work through Apify Actors and never hold the token | Two network-less tasks ran Actors live; our Actor Agent-Safe Page Reader (ID `eFq5SSXGg9brb1hIU`, not public yet) | [page](https://calhacks.gurtos.com/tracks/apify/) |
| CRS | Credit and fraud checks by agents that never hold the CRS login | A synthetic identity was held for fraud (codes 2201, 2202, 2101; Fraud Finder 88); write-up below | [page](https://calhacks.gurtos.com/tracks/crs/) |
| Solana | Agents pay in devnet USDC; a daily fingerprint of the log goes to Solana | 109 devnet transactions, none failed; a receipt checked against the memo | [page](https://calhacks.gurtos.com/tracks/solana/) |
| Vultr | The public always-on box, the relay, the build machine and the download mirror | The real Server disc installed on a 1 GB instance in about 5 minutes | [page](https://calhacks.gurtos.com/tracks/vultr/) |
| Figma | One design system from FigJam to the box's screen, the apps and the Business screens | The portal was generated from the frames; the drift check finds 0 drifts; stage log below | [page](https://calhacks.gurtos.com/tracks/figma/) |
| Mana | A Mana chat that rewrote the credit desk's rules | It found two records adding up to $20,000 of credit; rules REL-1 and SOD-5 now cite them | [page](https://calhacks.gurtos.com/tracks/mana/) |

{{CRS}}

{{FIGMA}}
