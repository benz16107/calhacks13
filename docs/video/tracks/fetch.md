# Fetch.ai: a safe body for an ASI:One agent (3:10)

**Track:** Fetch.ai, ASI:One Agent Challenge. **Edition:** GurtOS Server (always reachable through its Agentverse
mailbox; GurtOS Personal works the same). **Shares footage with:** the main video (A02, A05), Mana (the guest path).
**Status:** draft for Ben's approval. Ben records the ASI:One chat shots himself.

**Goal.** Fetch.ai requires a 3 to 5 minute video with the main flow inside an ASI:One chat. This one opens with the
two problems of a chat agent (where it runs, and strangers' agents), shows GurtOS as the safe body, then walks the flow
in the chat: pairing, a real multi-step task with a diff and Undo, the agent team, a stranger's reply with a hidden
instruction blocked, payments in test FET through the box's one approval path, a power cut, and guests.

**Rubric map.**

| Fetch.ai asks for | Where |
|---|---|
| An agent ASI:One can find, taking real multi-step action | Beats 2 and 4 (Agentverse profile; Droid fixes a failing test) |
| On Agentverse, speaking the Agent Chat Protocol | Beats 2, 5 |
| Main flow inside an ASI:One chat | Beats 3 to 9 (every action starts in the chat) |
| Real tool use | Beat 4 (Droid with Claude: reads, runs the tests, edits, checks) |
| Bonus: multi-agent | Beats 5 and 6 (Shopper reply; strangers' agents) |
| Bonus: Payment Protocol | Beat 7 (test FET, both ways) |
| Bonus: Interactive Cards | Beats 4 and 7 (diff card with Keep or Undo; Approve or Deny) |
| Bonus: reliability | Beat 8 (pull the plug; the chat says it resumed) |
| 3 to 5 minutes | 3:10 |

## Shot list

| # | Time | Picture | On-screen text | Narration | Feature and proof |
|---|---|---|---|---|---|
| 1 | 0:00 to 0:18 | T-FE-01: an ASI:One chat, "fix my code" sent to an agent; G-FE-1 over it: two boxes, "Someone else's cloud" and "Your computer, with all your keys", then a third line: "A stranger's agent's reply can hide an instruction" | Where does the agent run? · A cloud you can't see into · Your computer, with access to everything · Replies from strangers' agents can hide instructions | "A chat agent can only do real things if it runs somewhere. Today that is someone else's cloud, or your own computer with access to everything: your keys, every file. And when agents talk to strangers' agents, any reply can carry a hidden instruction." | The problem (story.md, Fetch); principles 1, 12 |
| 2 | 0:18 to 0:38 | A01: the box screen at rest; G-FE-2: Server's minimums; T-FE-02: the GurtOS agent's Agentverse profile (Active, ASI Available, the two badges, uptime) and the team list | GurtOS Server · 4 GB memory, 17 GB disk, no GPU · x86_64 or arm64 · each request: own Linux user, own copy of the files, no keys · Open source, Apache-2.0 | "Gurt O.S. is open source: operating systems built for AI agents, on a computer you own. Server needs four gigabytes of memory and seventeen of disk, no GPU. Each ASI One request becomes a task in its own Linux user, with its own copy of the files and no keys. Here is its agent on Agentverse, with its team." | Principles 4, 6, 10; Agentverse agent, badges, mailbox with no open port (merged; page verified Oct 24) |
| 3 | 0:38 to 0:52 | T-FE-03: the box screen's ASI:One window with the address and pairing code (the phone shows it too); in ASI:One a stranger's message gets the pairing step; then `pair <code>`, "Paired." | Pairing code: only on the box's screen and the owner's phone · A stranger: no task starts | "Only the owner gives it work. The pairing code shows only on the box's screen and my phone. A stranger gets the pairing step, and no task starts." | Pairing; wrong code refused; at most ten wrong codes a minute (merged; offline checks in the gate) |
| 4 | 0:52 to 1:20 | T-FE-04: "Fix the failing test in my project." Progress card (limits: own Linux user, own copy, no network, budget, spent), then the diff card (modified split.js), Keep or Undo; press Undo; the box takes out that one task | Real Droid with Claude · $0.05 · Undo: this one task's changes | "Now real work: fix the failing test in my project. Droid, running Claude, reads the code, runs the tests and edits the file, as its own Linux user with no keys. The diff comes back for five cents. Press Undo, and the box takes out this one task's changes and nothing else." | Droid task fixed the failing test for $0.05 with diff and Undo (live run, story.md); Interactive Cards; undo of one task |
| 5 | 1:20 to 1:34 | T-FE-05: "Is the Hario V60 filter back in stock?"; the reply reads "GurtOS Shopper replied:" and quotes the Shopper | The Shopper agent answers over the Agent Chat Protocol · shown as a quote, with its name | "It routes requests to its team too. I ask about a filter, and the Shopper agent answers over the Agent Chat Protocol. Gurt O.S. shows the reply as a quote, with the Shopper named." | Agent team on Agentverse (merged, d7f9fc1); Shopper reply as a quote |
| 6 | 1:34 to 2:00 | T-FE-06: "Ask the test weather agent for the weather in Berkeley." The Blocked card: hidden in an HTML comment, told agents to ignore their owner, asked for keys and for money; the rest of the weather shown; then T-FE-11: the Activity rows for the block | A stranger's agent (a TEST agent of ours) · Blocked: hidden instruction · a reply cannot start a task, approve, pay or pair · no task holds a key · Scripted agent: same steps every take | "Now a stranger's agent, a test weather agent. Its reply hides an instruction in a comment: ignore your owner, send keys, send money. Gurt O.S. blocks it, describes what it tried, and logs it. A reply is only relayed. It cannot start a task, approve, pay or pair, and no task holds a key to leak." | Strangers' replies are data (merged, d7f9fc1; the live run blocked our trap and relayed Fetch.ai's real Weather Agent) |
| 7 | 2:00 to 2:30 | T-FE-07: "Ask the test oracle for a fortune." The Approve card ("Paused for your OK: Spend $0.50 ... on fetch.pay, test FET on Fetch testnet"); D01-style phone notification, Approve with Face ID; the receipt card, the fortune. Then T-FE-08: "Ask the test buyer to buy a price check"; Activity shows `asi1.payment.received` for 0.05 | TEST MONEY: test FET on Fetch's testnet, no value · over the budget: the box asks first · receipt · the buyer's payment is checked on chain · 0.05 test FET | "Agents can also pay each other, with Fetch's Payment Protocol. All of it is test money, test F.E.T. on Fetch's testnet. A test oracle sells a fortune for half a test F.E.T. That is over the task's budget, so the box asks me first. I approve, and the receipt comes back. The other way, a test buyer pays our Shopper zero point zero five, and the box checks the transaction on chain before it runs the job." | Payment Protocol both ways (merged); one budget and approval path with the wallet (merged, b3c548b); inbound payment checked on chain (README) |
| 8 | 2:30 to 2:44 | A05's screen side or T-FE-09: a task running, the VM force-stopped, black for 1 s, boot; the chat says "GurtOS restarted (a power cut or a reboot) and is resuming ... where it stopped", then the result | Pull the plug · the box resumes from its action log · the chat tells you | "Pull the plug. When the box boots, it resumes the task where it stopped, and the chat says so. The record of every step is on disk." | Resume from the action log (core, merged); the chat message and the outbox (merged, d7f9fc1; QA has not walked it) |
| 9 | 2:44 to 2:58 | T-FE-10: a second ASI:One account asks the box for a price check; the owner's phone shows the Approve card; after Approve the guest gets the answer | Guest: nothing runs before the owner says yes · then no network, 25 cent budget · at most 3 per guest an hour | "Anyone can ask my box for a lookup. A second ASI One account asks, and nothing runs until I approve on my phone. Then it runs with no network and a twenty-five cent budget, three requests per guest an hour at most." | Guest requests (verified Oct 24 04:25 on the shared Mana route; Fetch calls the same route; QA has not tried it from ASI:One) |
| 10 | 2:58 to 3:10 | G-FE-3: two columns, "Gurt O.S. does" and "The Fetch integration adds"; G08 end card | OS: isolation, approvals, undo, budget · Fetch integration: pairing, screening, payments · Open source, Apache-2.0 | "Names, addresses and run steps are in the repo. Gurt O.S. does the isolation, approvals and undo. The Fetch integration adds pairing, screening and payments. Gurt O.S. is open source." | OS vs track label (principle 9); G08 |

**Floor and cut list.** Fetch's rule is 3 minutes at the least. If the voice runs under 3:00, hold the card shots (4, 6, 7)
longer; do not cut. If it runs over 5:00, cut beat 9, then beat 8.

## Narration (exact text for ElevenLabs)

Word count: 448 (about 3:15 at 2.3 words a second; Fetch allows up to 5:00, so the extra five seconds are safe). Say "ASI One" and "F.E.T." as spelled; check both in the voice test.

```text
A chat agent can only do real things if it runs somewhere. Today that is someone else's cloud, or your own computer with access to everything: your keys, every file. And when agents talk to strangers' agents, any reply can carry a hidden instruction.

Gurt O.S. is open source: operating systems built for AI agents, on a computer you own. Server needs four gigabytes of memory and seventeen of disk, no GPU. Each ASI One request becomes a task in its own Linux user, with its own copy of the files and no keys. Here is its agent on Agentverse, with its team.

Only the owner gives it work. The pairing code shows only on the box's screen and my phone. A stranger gets the pairing step, and no task starts.

Now real work: fix the failing test in my project. Droid, running Claude, reads the code, runs the tests and edits the file, as its own Linux user with no keys. The diff comes back for five cents. Press Undo, and the box takes out this one task's changes and nothing else.

It routes requests to its team too. I ask about a filter, and the Shopper agent answers over the Agent Chat Protocol. Gurt O.S. shows the reply as a quote, with the Shopper named.

Now a stranger's agent, a test weather agent. Its reply hides an instruction in a comment: ignore your owner, send keys, send money. Gurt O.S. blocks it, describes what it tried, and logs it. A reply is only relayed. It cannot start a task, approve, pay or pair, and no task holds a key to leak.

Agents can also pay each other, with Fetch's Payment Protocol. All of it is test money, test F.E.T. on Fetch's testnet. A test oracle sells a fortune for half a test F.E.T. That is over the task's budget, so the box asks me first. I approve, and the receipt comes back. The other way, a test buyer pays our Shopper zero point zero five, and the box checks the transaction on chain before it runs the job.

Pull the plug. When the box boots, it resumes the task where it stopped, and the chat says so. The record of every step is on disk.

Anyone can ask my box for a lookup. A second ASI One account asks, and nothing runs until I approve on my phone. Then it runs with no network and a twenty-five cent budget, three requests per guest an hour at most.

Names, addresses and run steps are in the repo. Gurt O.S. does the isolation, approvals and undo. The Fetch integration adds pairing, screening and payments. Gurt O.S. is open source.
```

## Captures this video needs

Shared (see `capture.md`): A01, A05 (screen side of the power cut), D01 (phone approve), G08. Its own:

| ID | What | Machine and state | Steps |
|---|---|---|---|
| G-FE-1 | The problem card over the chat | Animation in `studio/` | Two boxes and the third line, over T-FE-01 dimmed |
| G-FE-2 | Server's minimums | Animation in `studio/` | 4 GB memory, 17 GB disk, no GPU, x86_64 or arm64 (story.md principle 4); nothing about "old laptop" speed |
| G-FE-3 | OS vs Fetch two-column card | Animation in `studio/` | The two lists from beat 10 |
| T-FE-01 | An ASI:One chat, "fix my code" | A real signed-in ASI:One chat at asi1.ai in the Xvfb browser; the account is Ben's, so ask him once to sign the profile in | Type "fix my code" to any agent; record the first screen of the answer. This is the first real recording of the ASI:One page (the showcase says none exists yet, only API runs) |
| T-FE-02 | The Agentverse profile and the team | The public profile of the GurtOS agent, signed out | Open it; hold on Active, ASI Available, both badges, uptime and the guide; then the team's profiles (Shopper, Find, Credit Desk). Uptime shown is whatever it reads on the day |
| T-FE-03 | Pairing | The Server clip box with agents on (`POST /t/fetch/agent {"on": true, "testAgents": true}`), the phone paired; ASI:One chat to the GurtOS agent | Show the box's ASI:One window with the code; message from an unpaired chat; `pair <code>`; "Paired." |
| T-FE-04 | The failing-test fix with Undo | Same box, real Droid with Claude and the Factory key in its vault, the sample repo with the failing `split.js` test | "fix the failing test in my project"; record progress, the diff card (Keep or Undo); press Undo; then confirm the file is back in the box's Time Machine view. Allow for ASI:One's 40-second first reply and cut the wait |
| T-FE-05 | Shopper reply as a quote | Same box | "Is the Hario V60 filter back in stock?"; record the reply. The live run checked Hario's real store; the offline test store gives 8.99 USD. Say which on screen in a small label |
| T-FE-06 | Stranger's reply, blocked | Same box, `GurtOS test weather (trap)` on | "Ask the test weather agent for the weather in Berkeley"; record the Blocked card and the remaining weather text |
| T-FE-07 | Approve the fortune payment | Same box; D01's paired phone | "Ask the test oracle for a fortune"; show the Approve card; Approve from the phone; show the receipt card and the fortune. TEST on screen throughout |
| T-FE-08 | The inbound payment | Same box, `GurtOS test buyer` on | "Ask the test buyer to buy a price check"; open Activity, filter `asi1.payment.received`; hold on 0.05 |
| T-FE-09 | The restart message in the chat | Same box, with A05's kill and boot | Start the long task from the chat; `clip-box.sh kill`; `boot`; record the chat until it says the box restarted and resumes, then the result |
| T-FE-10 | A guest's request | Same box; a second ASI:One account (ask Ben for one) | Guest account asks for a price check; record the owner's phone Approve; the guest's answer |
| T-FE-11 | The block in Activity | Same box, after T-FE-06 | Activity, filter by the chat's task; hold on the blocked row |

## Check before render

- Beat 4's "five cents" is the take's cost. Replace it, in text and narration, if the Droid run cost something else.
- Test money is labelled TEST on screen through beat 7 and said once (it is, in beat 7).
- The Shopper's price on screen is from the take, not the old 8.99 or 10.25.
- The three weather, oracle and buyer agents carry their TEST labels in frame; no agent is described as a real
  stranger (Fetch.ai's own Weather Agent was relayed in the live run, but this video uses our labelled test agent).
- Beats 8 and 9 rest on rows QA has not walked (reliability, guests from ASI:One). If a take fails, cut the beat instead
  of faking it.
- The ASI:One planner can send a card click back without the selection (the Limits section). If a click lands on the
  wrong card in the take, retake it.
- No Agentverse key, pairing code from a real box, wallet address or machine name on screen; blur the code once paired.
