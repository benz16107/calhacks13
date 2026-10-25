# Armadin: attacks GurtOS stops (1:15)

**Track:** Armadin, Best Security Hack. **Edition:** all three (the controls are the same core in GurtOS Server, Personal
and Business; the clips come from a Server clip box, with the hijacked-payment case on the Business credit desk).
**Shares footage with:** the main video (A03, G05), Anthropic (A03). **Status:** draft for Ben's approval.

**Goal.** A security judge sees a real attack stopped at the operating system, step by step, and then sees the score
with its misses. The video says exactly what is built (a system-call filter and a CPU cap) and what is not (Landlock, a
per-task disk quota), because an honest scoreboard is the argument.

**Rubric map.** Armadin had not published criteria on Oct 23 (`showcase/src/content/tracks/armadin.mdx`), so the map
follows the questions a security judge asks.

| A security judge asks | Where |
|---|---|
| Is the attack real and sourced? | Beat 2 (CISA, Shai-Hulud, Sept 2025), beat 5 (FBI IC3, BEC) |
| Does the defence hold when the model does not? | Beat 1 (why an OS), beat 3 (a scripted agent that obeys every instruction) |
| What exactly stops each step? | Beat 3 (vault, proxy, firewall, refused self-approval) |
| Does a hunter for keys give itself away? | Beat 4 (tripwire keys) |
| What is built, and what is not? | Beat 6 (sandbox, with the two things not built) |
| Is the score honest? | Beat 7 (16 attacks, 14 caught, 2 published as not covered, two machines) |

## Shot list

Times are targets; the voice sets the final cut. Footnote on every clip with the scripted agent: "Scripted agent: same
steps every take".

| # | Time | Picture | On-screen text | Narration | Feature and proof |
|---|---|---|---|---|---|
| 1 | 0:00 to 0:12 | G-AR-1: the night Hills; two lines build. "An ordinary computer: the agent runs as you, with your keys." Then A06 (task detail: runs as `box-<id>`, the placeholder key line) with three chips: Server, Personal, Business | Agents get attacked through pages and packages. Ordinary OS: runs as you. GurtOS: each task is its own Linux user. Same core in all three editions | "Agents get attacked through the pages they read and the packages they install. An ordinary computer lets a fooled agent send out every key. On Gurt O.S. each task is its own Linux user, so attacks stop at the OS." | Principles 1, 2, 12; per-task users and the root-only vault (features: tasks, security) |
| 2 | 0:12 to 0:23 | G-AR-2: a source card, "Shai-Hulud, September 2025", the CISA sentence in two lines, link in small mono. Cut to T-AR-01: the task "Add a colour helper to the project", state Undone, red notice listing the npm registry, cloud metadata address, webhook.attacker.example, 1.1.1.1 | CISA, Sept 23, 2025: over 500 packages compromised; tokens and cloud keys sent to an endpoint the actor controlled. Ours: gurt-chalk-utils, a harmless imitation, real `npm install`. 10 of 11 steps blocked or contained | "CISA says a September twenty twenty-five worm compromised over five hundred npm packages. We ran a harmless copy: ten of eleven steps were blocked or contained." | Poisoned package (features: Armadin row, merged af40b1c; showcase Numbers 10/11); source `showcase/src/content/tracks/armadin.mdx` |
| 3 | 0:23 to 0:37 | A03: the road-bike task, Blocked banner, open the task. T-AR-02: Activity filtered to that task, rows appear one at a time, each with a red tag: vault read EACCES, `net.blocked` attacker.example, `net.blocked` 1.1.1.1:443, self-approval to the box's API refused. Undo, then "Undone" | Moment 2 · the booby-trapped page. Vault read: EACCES. attacker.example: proxy refused. 1.1.1.1: firewall refused. Self-approval: refused. Scripted agent: same steps every take | "Now the booby-trapped page. The scripted agent obeys its hidden orders. The vault read fails. The proxy and the firewall refuse the sends. Approving itself is refused." | Moment 2, verified Oct 24 00:54 (scripted agent); the refused self-approval is in the same 10 of 10 checks |
| 4 | 0:37 to 0:45 | T-AR-03: the iPhone lock screen banner "An agent tried to leak a key", then the app's Task page, Undone. Small footnote under it | Tripwire: a decoy AWS key in every task. Sent out, the task ends undone and the owner's phone is alerted. Looks in plain HTTP requests, tool inputs and the log, not HTTPS bodies. iOS simulator: this is the notice the box builds, not a push received over the air | "Every task holds decoy cloud keys. Send one out, and the task ends and your phone is alerted." | Tripwire keys (features: merged c51c8c7); limits on the showcase page |
| 5 | 0:45 to 0:54 | T-AR-04: the credit desk (Business) on the BEC case: the lookalike-sender invoice "we changed banks" refused with rule AP-4 before any approval is asked; the second bill, over the AP clerk's $5,000 limit, waits in Waiting for me, the controller taps No. Neither paid | Lookalike bank change: refused in code, AP-4. Over-limit bill: controller says no. Nothing paid. Test bank (Capital One Nessie), made-up company. FBI IC3, 2025: 24,768 BEC complaints, $3,046,598,558 lost | "A lookalike email says we changed banks. A rule refuses it. An over-limit bill waits for the controller, who says no. Test money." | Hijacked payment (features: Armadin row, merged af40b1c); the controller's refusal; IC3 source on the showcase page |
| 6 | 0:54 to 1:02 | T-AR-05: a terminal in the clip box VM beside a running task: `Seccomp: 2`, `cpu.max 200000 100000`, `MemoryMax 2G`, `MemorySwapMax 0`, `TasksMax 512`. Then G-AR-3: two amber lines, "Landlock" and "per-task disk quota", each marked Not built | Per-task sandbox: system-call filter, 2 CPU cores, 2 GB with no swap, 512 processes. Not built: Landlock. Not built: a per-task disk quota | "Each task has a system-call filter, a CPU cap, and memory with no swap. Not built: Landlock, and a disk quota." | The sandbox (features: merged c51c8c7); the limits are from the same row |
| 7 | 1:02 to 1:15 | G05: the scoreboard, 16 rows fill, 14 green "caught", 2 amber "not covered" (disk fill; data sent to a host the task may reach); lower third "Run on two machines, Oct 24". Then G08 end card | 16 OS-level attacks: 14 caught, 2 published as not covered. Laptop VM (no swap) and cloud box (8 GB swap): same score. GurtOS · open source, Apache-2.0 | "We publish the score: sixteen OS-level attacks, fourteen caught, two not covered, on two machines, in every edition. Gurt O.S. is open source." | Scoreboard (`tracks/armadin/SCOREBOARD.md`; showcase Numbers 14/16 and 2 of 2) |

**Cut list if long:** beat 5's IC3 line (keep the refusal), beat 6's terminal (keep the amber lines), beat 4's footnote
(it must stay on screen even if the narration is cut).

## Narration (exact text for ElevenLabs)

Word count: 178 (target about 170 for 1:15).

```text
Agents get attacked through the pages they read and the packages they install. An ordinary computer lets a fooled agent send out every key. On Gurt O.S. each task is its own Linux user, so attacks stop at the OS.

CISA says a September twenty twenty-five worm compromised over five hundred npm packages. We ran a harmless copy: ten of eleven steps were blocked or contained.

Now the booby-trapped page. The scripted agent obeys its hidden orders. The vault read fails. The proxy and the firewall refuse the sends. Approving itself is refused.

Every task holds decoy cloud keys. Send one out, and the task ends and your phone is alerted.

A lookalike email says we changed banks. A rule refuses it. An over-limit bill waits for the controller, who says no. Test money.

Each task has a system-call filter, a CPU cap, and memory with no swap. Not built: Landlock, and a disk quota.

We publish the score: sixteen OS-level attacks, fourteen caught, two not covered, on two machines, in every edition. Gurt O.S. is open source.
```

## Captures this video needs

Shared (see `capture.md`): A03, A06, G05, G08. Its own animation cards: G-AR-1 (problem lines), G-AR-2 (the CISA
source card), G-AR-3 (the two "not built" lines). Its own captures:

| ID | What | Machine and state | Steps |
|---|---|---|---|
| T-AR-01 | The poisoned package, undone | Clip box (Server), `tracks/armadin/poisoned` installed by a task | Fire the task "Add a colour helper to the project" (real `npm install` of gurt-chalk-utils); record from submit until Undone; hold on the red notice 4 s |
| T-AR-02 | The booby-trapped page's log rows | Same clip box, after A03 | Activity filtered to the road-bike task; scroll so the four refusals (EACCES, attacker.example, 1.1.1.1:443, the refused self-approval) are in frame one at a time |
| T-AR-03 | Tripwire notice and the Undone task on an iPhone | the build Mac iOS simulator paired to the clip box (D01's pairing), after T-AR-01 | Show the tripwire notice built by the box's push code, then the app's Task page. The simulator cannot receive Apple pushes, so keep the footnote on screen |
| T-AR-04 | The hijacked payment | Clip box with Business on and the Fogline seed, `tracks/armadin/cases/bec` loaded, Nessie test bank | Credit desk window, run the BEC case; record the AP-4 refusal, then pick the controller (Rosa), open the over-limit bill in Waiting for me, tap No. Blur nothing real: all names are the seed's |
| T-AR-05 | The sandbox's own numbers | A terminal on the clip box VM (neutral prompt, no machine name) with one task running | Show the task unit's `Seccomp:` line in `/proc/<pid>/status` and `cpu.max`, plus `systemctl show` for `MemoryMax`, `MemorySwapMax` and `TasksMax`. Never show the host name or the vault path |

## Check before render

- The scoreboard still reads 16 attacks, 14 caught, 2 not covered, and `tracks/armadin/SCOREBOARD.md` still says "both
  machines" on the render day. `docs/features.md` still lists the older 15 and 13; the showcase page and SCOREBOARD.md
  say 16 and 14 (the memory-hog row was added Oct 24).
- Beat 2 says "ten of eleven": the poisoned package's own page says the 11th step read only decoy keys. Say nothing
  stronger than that.
- Beat 3 and beat 2 both show the scripted agent; the footnote is on screen the whole time. Real Claude refused the same
  page in the Oct 24 run, but it is not on screen here (the Anthropic video covers it).
- The tripwire clip carries the simulator footnote. Do not call it a push received on a phone.
- "Not built" lines match the showcase's sandbox note: no Landlock, no disk quota.
- The payment shown is the made-up Fogline company and the Nessie test bank, labelled test money.
- Nothing private on screen (`../capture.md`, "Never on screen"): no machine name in the terminal, no vault path.
