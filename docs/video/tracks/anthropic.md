# Anthropic: for solo devs who leave agents running (1:15)

**Track:** Anthropic, Claude used well for a specific group of people. **Edition:** GurtOS Personal and GurtOS Server
(Server for the agents that run while Ben is away, Personal for Claude working on a copy of a folder until the owner
presses Keep). **Shares footage with:** Factory (T-FA-01), Armadin (A03), the main video (A02, A06). **Status:** draft for
Ben's approval.

**Goal.** Name the community and the lived problem in the first seconds: solo developers who leave AI agents running
unattended on a machine at home, which is Ben's own situation. Then show Claude doing real work inside a space that
holds no keys, its cost, the one check that is not consistent, the published attack test with its limits, and control
from the phone. Claude Code as a worker is not built and is not shown.

**Rubric map.**

| Anthropic asks for | Where |
|---|---|
| A named community, narrower than "students" | Beat 1 (on-screen text names it) |
| A problem lived or heard first-hand | Beat 1 (Ben's own home box; OpenClaw's scale as the heard part) |
| One thing usable Monday | Beat 8 (one install script, one model key; measured on 1 GB) |
| Claude doing something that matters | Beats 3 and 4 (a real Claude fix with a plan, a coder and a reviewer; Claude on a copy of a folder) |
| Knowing where it could go wrong | Beats 5 and 6 (an inconsistent check, a published test with its limits) |

## Shot list

Footnote on every real Claude clip: "Real Claude through Droid, Oct 24 run". Footnote on moment-2 style clips: "Scripted
agent: same steps every take".

| # | Time | Picture | On-screen text | Narration | Feature and proof |
|---|---|---|---|---|---|
| 1 | 0:00 to 0:15 | G-AN-1: the night Hills; three lines type in as Ben's own list: "Job-application pipeline", "Price and listing watchers", "Overnight coding queues". Under them two lines: "Ran as me", "Keys in its environment". Then one number line, source below in small mono | Community: solo developers who leave AI agents running unattended at home. Mine: job applications, price watchers, overnight coding. Ran as me, keys in its environment, its own output the only record. 21,639 OpenClaw instances exposed to the internet, shown as a caption, not spoken. Source: Censys, Jan 31, 2026 | "I leave agents running on a home server: a job-application bot, price watchers, overnight coding. Each ran as me, with my keys in its environment, and its own output was the only record." | Named community and lived problem (`showcase/src/content/tracks/anthropic.mdx`); Censys figure as the page states it |
| 2 | 0:15 to 0:28 | A06: task detail, "What it can reach", runs as `box-<id>`, the placeholder key line; cross-fade to G03: three task layers on one folder | Claude, inside Droid: its own Linux user, its own copy of the files. A real Claude task: 240 of 240 process samples held only a placeholder key | "Gurt O.S. is the computer I wanted. Claude does each task inside Droid, as its own Linux user, in its own copy of my files. In two hundred forty of two hundred forty checks, a real Claude task held only a placeholder key." | Claude through Droid in a task space; 240 of 240 samples (merge gate, Oct 24; features: moment 1 with Droid) |
| 3 | 0:28 to 0:42 | T-FA-01 (shared): the plan arrives on the iPhone, Approve; the task window: done, `claude-sonnet-5-5`, $0.12 of a $1.00 budget, reviewer verdict APPROVE. Then T-AN-02: three finished tasks side by side with their model ids and costs | Real Claude Sonnet 5.5, Oct 24. Plan approved on the phone. $0.12 for a plan, a coder and a reviewer. Same one-line task, one run each: Haiku 0.084 cents, Sonnet 1.31 cents, Opus 3.25 cents | "A real fix, with a plan, a coder and a reviewer, cost twelve cents. I pick Haiku, Sonnet or Opus per task and see what each costs." | Models per task priced from token counts (features: Anthropic rows, merged cf4ad03); live run on the showcase page |
| 4 | 0:42 to 0:49 | A20: the Personal desktop on the Hills, Files, right-click a folder, Ask an Agent, the diff, Keep | GurtOS Personal: the folder changes only when you press Keep | "On Personal, my folder changes only when I press Keep." | Agents on copies of the owner's folders, Keep and Undo (features: merged, owner verified on a fresh Personal ISO) |
| 5 | 0:49 to 0:57 | T-AN-03: a task window with the "Second look" line ("N risky steps checked, M off goal") and an approval created by an off-goal verdict; small card beside it with the test result | Haiku checks a risky step against the goal. Own test: 28 of 28 injected-step verdicts off goal, 0 of 22 ordinary ones. Not consistent on one case: it passed a README download in other runs | "Before a risky step, a Haiku check compares it to my goal. It is inconsistent on one case." | Second-opinion check (features: merged cf4ad03); limit from the showcase page |
| 6 | 0:57 to 1:03 | G-AN-2: the attack test card: 12 attacks, 2 clean controls, 72 attack runs, 0 where harm happened; below it in amber: "Claude did not try in most runs", "Attacks and detectors written by the same person", "One run per setting" | 72 attack runs, 0 harm. Most runs: Claude never tried. Same person wrote the attacks and the detectors. Read the score with its limits | "The attack test is published: seventy-two runs, no harm, mostly because Claude never tried." | Published attack test with its limits (features: merged cf4ad03; `tracks/anthropic/attacks/results`) |
| 7 | 1:03 to 1:10 | T-AN-04: a real Claude Code session in a terminal: it lists the box's tasks, starts one, reads its diff, undoes it, through the GurtOS MCP server. Then 2-second cuts: D01 iPhone, D02 Watch, D03 Mac menu bar, said only as the on-screen chips | GurtOS MCP server for Claude Code and Desktop. Real Claude Code session, [date of take]. iPhone · Apple Watch · Mac · app.gurtos.com | "Claude Code drives the box through an MCP server, and I answer from my phone." | GurtOS MCP server (features: merged c51c8c7); native apps (merged) |
| 8 | 1:10 to 1:15 | G-AN-3: one line of type, the install command, then "Measured minimum: 1 GB of RAM, one task at a time (QEMU VM)"; G08 end card | `curl -fsSL .../tracks/anthropic/install.sh \| sudo sh` on Ubuntu 24.04, plus one model key. Measured: 1 GB RAM, one task at a time. Open source, Apache-2.0 | "One install script, one model key. Gurt O.S. is open source." | One-line install and measured minimum (features: Anthropic row, merged cf4ad03; install 76 s on 1 GB) |

**Cut list if long:** beat 4 (the Personal clip; keep the line in beat 8's chip), beat 7's device cuts, beat 5's test
card.

## Narration (exact text for ElevenLabs)

Word count: 171 (target about 170 for 1:15).

```text
I leave agents running on a home server: a job-application bot, price watchers, overnight coding. Each ran as me, with my keys in its environment, and its own output was the only record.

Gurt O.S. is the computer I wanted. Claude does each task inside Droid, as its own Linux user, in its own copy of my files. In two hundred forty of two hundred forty checks, a real Claude task held only a placeholder key.

A real fix, with a plan, a coder and a reviewer, cost twelve cents. I pick Haiku, Sonnet or Opus per task and see what each costs.

On Personal, my folder changes only when I press Keep.

Before a risky step, a Haiku check compares it to my goal. It is inconsistent on one case.

The attack test is published: seventy-two runs, no harm, mostly because Claude never tried.

Claude Code drives the box through an MCP server, and I answer from my phone.

One install script, one model key. Gurt O.S. is open source.
```

## Captures this video needs

Shared (see `capture.md`): A06, A20, D01, D02, D03, G03, G08. Shared with Factory: T-FA-01 (the live path: plan on the
phone, done task with its cost). Its own animation cards: G-AN-1 (the community card), G-AN-2 (the attack test card),
G-AN-3 (the install line). Its own captures:

| ID | What | Machine and state | Steps |
|---|---|---|---|
| T-AN-02 | Three tasks, three models, with their costs | Clip box (Server) with a Factory key in the vault (real model spend, a few cents) | Start the same one-line task three times with `model` haiku, sonnet and opus; open each finished task window; capture the Model row and the cost. Costs differ by run: say the numbers from the capture |
| T-AN-03 | The Second look on a real run | Clip box with a Factory key; `DEMO_LIVE=droid,anthropic` style run of one risky-step case (the README setup case) | Open the finished task; hold on the "Second look" line in the facts column; open the approval if the check made one. If the take shows no off-goal step, say "N checked, 0 off goal" and keep the test card |
| T-AN-04 | Claude Code driving the box through the GurtOS MCP server | the Linux build machine (Claude Code on the Max plan) against the clip box, using a paired device's token | In a terminal, ask Claude Code to list the box's tasks, start "Tidy my notes", read its diff, then undo it. Record the real session, note the date, crop the token and any machine name with `media-treatment`, never CSS |

## Check before render

- "Claude Code as a worker" is not built (features: not pursued). Nothing in this video says or shows Claude Code
  running inside a task. Beat 7 shows Claude Code as a client of the MCP server only.
- The OpenClaw number: the Anthropic page quotes 21,639 (Censys, Jan 31, 2026) with 392,951 stars (GitHub API, Oct 24).
  The main video uses 392,891 (Oct 23). This video says only the Censys figure.
- The inconsistent case is the README setup download that the check passed in other runs (`showcase` Anthropic page).
  The wording on screen must not say the check is reliable.
- The attack test line says "mostly because Claude never tried", as the page does. The limits (same author, one run per
  setting) stay on screen for the whole beat.
- The $0.12 run is Claude Sonnet 5.5 through Droid, Oct 24. The merge gate's $0.5378 (the $0.50 test spend plus the
  model) is not used here.
- iPhone and Watch clips come from simulators; footnote them as the Anthropic page does. All amounts are test money.
