# Atlassian Track 1: hand an issue to an agent (1:20)

**Track:** Atlassian Agentic Workforce Challenge, Track 1 (agents that do the work). **Edition:** GurtOS Business. The
box in the footage ran as GurtOS Server (always on). **Shares footage with:** Atlassian Track 2 (#7), the same shoot.
**Status:** draft for Ben's approval.

**Goal.** A teammate's ordinary Jira issue becomes work an agent does, inside limits the OS enforces. The video shows
three ways to start it, the result with its diff on the issue, a request for an OK in Jira or Jira Service Management,
and the team's questions answered by Rovo and Confluence.

**Rubric map.**

| Atlassian asks for | Where |
|---|---|
| Track 1: agents that do the work | Beats 2 to 4 (start from an issue, result and diff on the issue) |
| Idea | Beat 1 (an issue's text can come from anyone) and beat 3 (why the task is boxed in) |
| Usefulness to Atlassian users | Beats 2, 5, 6 (a label or a rule, an approval in the tool the team already uses, a daily page) |
| Technical use of Forge | Beat 5 (panel and resolver, JSM request), beat 6 (Rovo agent; what is Forge and what is the OS) |
| 3 minutes at most | 1:20 |

## Shot list

| # | Time | Picture | On-screen text | Narration | Feature and proof |
|---|---|---|---|---|---|
| 1 | 0:00 to 0:12 | G-AT-3: the Hills; PLAT-33510's title appears as a normal issue line, then a second line: "Text from anyone" | A teammate files an issue · its text can come from anyone | "A teammate files an issue for an agent to do. But an issue's text can come from anyone, and an agent that runs as you obeys it as you." | Problem (principles 1, 12) |
| 2 | 0:12 to 0:26 | T-AT-08: PLAT-33510, "Document how to change a service config"; the label `gurtos-agent` is added; then T-AT-09: the Automation rule editor with the Run in GurtOS action (the rule screen only) | Three ways to start: label · assignment · Automation: Run in GurtOS | "Handing it over is a label, an assignment, or a Run in Gurt O.S. step in an Automation rule. This one gets a label." | Start from Jira (merged; live: the label started a Droid task; the Automation action is deployed but not run live) |
| 3 | 0:26 to 0:42 | T-AT-08 continued: the first comment on the issue, "GurtOS started task ... no hosts, budget $0.25"; A06: that task's "What it can reach", runs as `box-<id>`, no keys | Own Linux user · own copy of the files · no keys · no network · budget $0.25 | "Gurt O.S. Business starts a task from the issue as its own Linux user, with its own copy of the files, no keys, no network and twenty-five cents." | OS part: task space; budget; story.md "no network, no keys and a small budget" |
| 4 | 0:42 to 0:56 | T-AT-10: the result comment: what the agent says it did, the files changed, the exact diff; "spent $0.03 of $0.25"; the issue moves to Done | Droid with Claude · changed 1 file · spent $0.03 of $0.25 · a second start did not run it twice | "Droid, running Claude, does the work and reports on the issue with the exact diff. It changed one file and spent three cents. Starting it twice does not run it twice." | Result and diff as comments (merged); one file changed, no duplicate run (showcase) |
| 5 | 0:56 to 1:08 | T-AT-10 continued: the panel, Roll back this task; then T-AT-11: BOX-30 in the panel, "spend $3.00 of test money on a $1.00 budget", Approve; then the JSM request, Approve | Roll back: this task only · TEST MONEY · over budget or a production push: waits for an OK in Jira or JSM · Scripted agent: same steps every take | "If the work is wrong, Roll back removes only this task's changes. A risky step, like spending test money over budget or pushing to production, stops and asks in Jira or Service Management." | Roll back (merged); Approve from Jira, BOX-30 (merged); JSM approvals (merged, live: SECOPS-168) |
| 6 | 1:08 to 1:20 | T-AT-12: Rovo, "@GurtOS what did agents change this week?" and the answer; T-AT-13: Confluence "What our agents did" for today; G-AT-2: two boxes, OS and Forge; G08 end card | Rovo answers from the box's log · A daily Confluence page · OS: isolation, budget, undo · Forge app: panel, Rovo, triggers · Open source, Apache-2.0 | "Ask Rovo what the agents changed this week, and it answers from the log. Confluence gets a daily page. The OS isolates and undoes. The Forge app is the team's control room. Both are open source." | Rovo agent (merged); Confluence daily page (merged, live); OS vs Forge label; G08 |

**Cut list if long:** the Automation rule shot in beat 2; the JSM half of beat 5.

## Narration (exact text for ElevenLabs)

Word count: 181 (about 1:19 at 2.3 words a second).

```text
A teammate files an issue for an agent to do. But an issue's text can come from anyone, and an agent that runs as you obeys it as you.

Handing it over is a label, an assignment, or a Run in Gurt O.S. step in an Automation rule. This one gets a label.

Gurt O.S. Business starts a task from the issue as its own Linux user, with its own copy of the files, no keys, no network and twenty-five cents.

Droid, running Claude, does the work and reports on the issue with the exact diff. It changed one file and spent three cents. Starting it twice does not run it twice.

If the work is wrong, Roll back removes only this task's changes. A risky step, like spending test money over budget or pushing to production, stops and asks in Jira or Service Management.

Ask Rovo what the agents changed this week, and it answers from the log. Confluence gets a daily page. The OS isolates and undoes. The Forge app is the team's control room. Both are open source.
```

## Captures this video needs

Shared (see `capture.md`): A06, G08. From Track 2's shoot: T-AT-04 (the Roll back panel), T-AT-05's Rovo setup, G-AT-2.
Its own:

| ID | What | Machine and state | Steps |
|---|---|---|---|
| G-AT-3 | The problem card | Animation in `studio/` | Issue line, then "Text from anyone"; no real person's text |
| T-AT-08 | Start from a label; the first comment | The always-on Server box, Jira demo site, signed-in Atlassian browser profile (crop account menus and the site name) | Open a fresh teammate issue in PLAT (like PLAT-33510, "Document how to change a service config"); add the label `gurtos-agent`; wait for the first comment ("GurtOS started task ...") |
| T-AT-09 | The Automation rule with Run in GurtOS | Same, Jira Automation | Open the rule editor with the Run in GurtOS action and hold on it. This is the editor only: the action is deployed, and the story says it was not run live |
| T-AT-10 | Result comment with diff, then Roll back | Same | Wait for the result comment (real Droid with Claude, not scripted); scroll the diff; show the cost line; open the panel and Roll back this task. Do not roll back on camera until the result has held 4 s |
| T-AT-11 | An approval from Jira: BOX-30 | Same, scripted agent (`worker: fake`) | Fire a scripted task that asks to spend $3.00 of test money on a $1.00 budget; open the panel; Approve; then show the JSM request for a production push and Approve. Label TEST on screen |
| T-AT-12 | Rovo: what did agents change this week | Same, Rovo chat | Ask "@GurtOS what did agents change this week?"; hold on the answer |
| T-AT-13 | The Confluence daily page | Same, Confluence space AGENTS | Open "What our agents did, <date>" for today; the page rewrites every 15 minutes, so record after a run |

## Check before render

- The $0.03 and "one file" are the take's own numbers; replace them in text and narration if the take differs.
- Test money is labelled TEST on screen in beat 5 and said once in the narration (it is: "test money").
- The Automation shot is the editor only, and nothing in the narration claims a live Automation run.
- The panel's buttons on the take: the page lists Approve, Deny and Roll back. If a Keep button exists in the build,
  say so; the script does not claim one.
- No site name, email, accountId or box address on screen.
