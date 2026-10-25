# Atlassian Track 2: undo only the wrong part (1:30)

**Track:** Atlassian Agentic Workforce Challenge, Track 2 (security for agents acting for a user). **Edition:** GurtOS
Business. The box in the footage ran as GurtOS Server (always on), and the Jira people mapping is the Business part,
so the script says so where it matters. **Shares footage with:** Atlassian Track 1 (#8), the same shoot.
**Status:** draft for Ben's approval.

## Creative brief

An incident review told at night. BOX-29 is the case file, and an evidence board pins the Jira issue, the Confluence page, the Service Management request and the log, joined by string that is the audit trail. After the card, full-bleed `t2-issue-ask.png` shows BOX-29 as the box wrote it, with hand-drawn underlines on the three config writes and the paste-site fetch as the voice says them (paragraph 1). Paragraph 2 strikes through "runs as you" in kinetic type, then `a06.mp4` from 4. Paragraph 3 stamps BLOCKED on `t2-issue-allowed.png`. Paragraph 4 builds the board, the string drawn as each page is named, and ends on the role check in `a31.mp4`. Paragraph 5 is the rollback. It shows `rollback-confirm.png`, a timeline of the night with only the 20:47:22 UTC refusal dated, the layer diagram, then a match cut from `t2-diff-rolled.png` to `t2-undone.png` and a ROLLED BACK stamp. Paragraphs 6 and 7 use `t2-rovo-confirm.png`, `bulk-report.png` and `gadget.png`. Slow reveals, one flash on the refusal. One zoom, on the refusal line in `t2-issue-ask.png`. Music bed: noir.

Footage: t2-issue-ask.png, a06.mp4, t2-issue-allowed.png, t2-wait-top.png, t2-incident-top.png, tracks/jira/screenshots/jsm-approval.png, t2-audit-approved.png, a31.mp4, tracks/jira/screenshots/rollback-confirm.png, t2-diff-rolled.png, t2-undone.png, t2-rovo-confirm.png, tracks/jira/screenshots/bulk-report.png, tracks/jira/screenshots/gadget.png

**Goal.** A judge sees one concrete failure, BOX-29: an agent that changed three configs instead of one and tried to
reach a paste site. The video shows the refusal, the audit record in Jira and Confluence, a risky push waiting in Jira
Service Management, and then Roll back from Jira taking out only that task's changes.

**Rubric map.**

| Atlassian asks for | Where |
|---|---|
| Track 2: injection defence | Beat 3 (the paste upload refused by the network rules) |
| Track 2: audit, the morning after | Beats 3, 4 (issue from the log, incident page, JSM request with who approved) |
| Track 2: reversion of only the wrong changes | Beats 5, 6 (Roll back, Rovo, bulk) |
| Idea | Beats 1 and 2 (the problem, then why an OS) |
| Usefulness to Atlassian users | Beat 6 (one JQL search; bulk roll back for the morning after), beat 7 (gadget) |
| Technical use of Forge | Beat 5 (resolver checks the signed-in user), beat 7 (what each part is) |
| 3 minutes at most | 1:30 |

## Shot list

| # | Time | Picture | On-screen text | Narration | Feature and proof |
|---|---|---|---|---|---|
| 1 | 0:00 to 0:14 | G-AT-1: the Hills; a card reads the BOX-29 story in three short lines | Last night: an agent misread a rule · changed 3 configs instead of 1 · tried to send a file to a paste site | "Last night an agent misread a rule. It changed three configs instead of one and tried to send a file to a paste site. What did it do, and how do you undo only that?" | Demo moment BOX-29 (story.md, Atlassian) |
| 2 | 0:14 to 0:34 | G03: task layers on one folder, one taken out; then A06: a task's "What it can reach", runs as `box-<id>`, no keys | Ordinary computer: runs as you, your keys, one shared set of files · GurtOS Business: own Linux user, own copy of the files, no keys | "On an ordinary computer the agent runs as you, with your keys, on shared files. Gurt O.S. Business gives each task its own Linux user, its own copy of the files, and no keys." | Principles 1, 2, 11, 12; OS part |
| 3 | 0:34 to 0:48 | T-AT-01: BOX-29 in Jira: the description from the log, the blocked attempt on paste.example.net, the diff of three configs, the GurtOS agent task panel waiting for an OK | BOX-29 · written from the box's own log · paste.example.net: refused · Scripted agent: same steps every take | "Every task becomes a Jira issue, written from the box's own log. The network rules refused the paste upload." | Every task a Jira issue (verified by the Jira thread through the real panel); blocked host refused by the OS |
| 4 | 0:48 to 1:00 | T-AT-02: the Confluence incident page for the blocked attempt; then T-AT-03: the JSM request, Approval needed, Approve; the log line "approved by jira:<user> via JSM"; A30's person picker for one second | Incident page: what was tried, what it was allowed · Push to production: JSM approval · Business: Jira permission and GurtOS role both required (merge gate, Jira stand-ins) | "A blocked attempt gets a Confluence incident page. The push to production became a Jira Service Management request, and the log names who approved. In Business, the company's role must allow it too." | Confluence incident page (merged, live); JSM approval (merged, live: SECOPS-168); people mapping (merged, gate only) |
| 5 | 1:00 to 1:12 | T-AT-04: the panel, Roll back this task, Confirm; the panel turns to Rolled back, the diff marked "no longer in the workspace", the audit trail naming who approved and who rolled back; a small G03 inset: one layer comes out, the other stays | Roll back: this task's changes only · 3 configs back · the merge gate checks another task's fix stays · Undoes file changes, not messages already sent | "Roll back this task. The Forge panel checks the user's permission, then the box takes out this task's layer. The three configs come back. Every other task keeps its work." | Roll back from Jira (merged); Forge resolver checks EDIT_ISSUES as the user; gate check on the other task's fix |
| 6 | 1:12 to 1:22 | T-AT-05: Rovo chat, "@GurtOS what got blocked this week?", then "Roll back everything the shopper did today", the Please review box, Confirm, the report; T-AT-06: the issue search `project = BOX AND boxBlocked > 0`, two issues ticked, Apps, Roll back with GurtOS, "2 of 2 rolled back" | Rovo asks before it acts · One search: boxBlocked > 0 · Bulk roll back: a report for each issue | "The Rovo agent answers from the log and asks before it rolls back. Any issue search can roll several issues back together." | Rovo agent (merged; live for "what got blocked" and the roll back); bulk roll back (merged; live on BOX-21 and BOX-22) |
| 7 | 1:22 to 1:30 | T-AT-07: the dashboard gadget; G-AT-2: two boxes, "GurtOS: isolates and records" and "Forge app: the team's control room"; G08 end card | OS: isolation, log, undo · Forge app: panel, Rovo, bulk action, gadget · Open source, Apache-2.0 | "A dashboard gadget keeps score. The OS isolates and records. The Forge app is the team's control room. Both are open source." | Dashboard gadget (merged, live: dashboard 10100); OS vs Forge label; G08 |

**Cut list if long:** beat 7's gadget shot (keep the two boxes); beat 4's person picker; the Rovo half of beat 6.

## Narration (exact text for ElevenLabs)

Word count: 208 (about 1:30 at 2.3 words a second).

```text
Last night an agent misread a rule. It changed three configs instead of one and tried to send a file to a paste site. What did it do, and how do you undo only that?

On an ordinary computer the agent runs as you, with your keys, on shared files. Gurt O.S. Business gives each task its own Linux user, its own copy of the files, and no keys.

Every task becomes a Jira issue, written from the box's own log. The network rules refused the paste upload.

A blocked attempt gets a Confluence incident page. The push to production became a Jira Service Management request, and the log names who approved. In Business, the company's role must allow it too.

Roll back this task. The Forge panel checks the user's permission, then the box takes out this task's layer. The three configs come back. Every other task keeps its work.

The Rovo agent answers from the log and asks before it rolls back. Any issue search can roll several issues back together.

A dashboard gadget keeps score. The OS isolates and records. The Forge app is the team's control room. Both are open source.
```

## Captures this video needs

Shared (see `capture.md`): A06, A30, G03, G08. Its own (the T-AT shots are one shoot for both Atlassian videos; Track 1
adds T-AT-08 to T-AT-13):

| ID | What | Machine and state | Steps |
|---|---|---|---|
| G-AT-1 | The BOX-29 story card | Animation in `studio/` | Three short lines on the Hills; text from the on-screen column |
| G-AT-2 | OS vs Forge two-box card | Animation in `studio/` | Two boxes, the lists from beat 7; shared with Track 1 |
| T-AT-01 | BOX-29: issue and waiting panel | The always-on Server box, Jira demo site, signed-in Atlassian browser profile (crop account menus and the site name with `media-treatment`) | If BOX-29 is already rolled back, fire a fresh scripted task (`worker: fake`, workspace `handbook`) that changes three configs and fetches the paste site, then ask to push to production; open its issue; scroll description, blocked attempt, diff; open the panel |
| T-AT-02 | Confluence incident page | Same, Confluence space AGENTS | Open the incident page written for that blocked attempt; hold on "what was tried" and "what it was allowed" |
| T-AT-03 | JSM approval | Same, Jira Service Management | Open the request (SECOPS-168 or the new one), Approve; return to the issue and show "approved by jira:<user> via JSM" in the log |
| T-AT-04 | Roll back from the panel | Same | In the panel, Roll back this task, Confirm; hold on Rolled back, the audit trail and the marked diff. Use a task whose rollback has not yet been run |
| T-AT-05 | Rovo: what got blocked, roll back | Same, Rovo chat | Ask "@GurtOS what got blocked this week?"; then "Roll back everything the shopper did today"; hold on the Please review box; Confirm; hold on the report. Needs two fresh `shopper` tasks (the old BOX-17 and BOX-18 are already rolled back) |
| T-AT-06 | JQL search and bulk roll back | Same, two fresh overnight tasks | Search `project = BOX AND boxBlocked > 0`; tick two issues; Apps, Roll back with GurtOS; hold on the "2 of 2 rolled back" report |
| T-AT-07 | The dashboard gadget | Same, Jira dashboard with the GurtOS agents gadget | Open the dashboard; hold on the totals and the latest blocked attempts |
| T-AT-S3 | Flight recorder replay of the BOX-29 task (slot: only once the flight recorder is merged) | Same shoot as T-AT-01 (scripted agent, `worker: fake`), on a build where the flight recorder is merged | Open the flight recorder on the BOX-29 task; step through it, hold on a step with a file and on an approval, then press Keep. Show only what the recorder lists Keep the scripted-agent footnote on screen |
| T-AT-S1 | The Atlassian track app's permissions: Allow, Deny, revoke (slot: only once agent permissions are merged) | The always-on Server box on a build where agent permissions are merged. Same take as Track 1's T-AT-S1: record once | Open the Atlassian track app's permissions and hold on its manifest; Allow one permission, Deny one, revoke one; then trigger the revoked use and hold on the OS refusing it. Use only the labels the screen shows |

## Check before render

- Every number shown (3 configs, 2 of 2) is from the take, not the old screenshots (the page's 17-result search and
  $3.90 gadget are from earlier days).
- "Worker fake" or the scripted footnote is on screen whenever BOX-29 or the shopper tasks show.
- Beat 4's people mapping is checked by the merge gate against offline Jira stand-ins, with no live run; the on-screen
  text says so and the person picker is a Business shot, not Jira's.
- No site name, account email, avatar or accountId on screen; the box's address does not appear.
- Roll back removes file changes only: the Limits line stays on screen in beat 5.

## Slots: standout features (use only once merged)

These beats stay out of the video until the feature is merged on main and its check passes. When one is ready, record its capture, add its line to `docs/video/slots.json`, generate its narration with `narration/say.py <script> --slots`, and rebuild: later beats move by themselves.

| Slot id | Feature | Goes after beat | Picture (the capture to record) | On-screen text | Narration | Seconds | Rubric it serves | What to cut to stay in length |
|---|---|---|---|---|---|---|---|---|
| `flight-recorder` | The flight recorder | Beat 3 (every task becomes a Jira issue, written from the box's own log) | T-AT-S3: the flight recorder on the BOX-29 scripted task. Step through the three config changes and the blocked paste attempt, with the files and the waiting approval, then Keep or Undo | Flight recorder · replay the task step by step · its files and approvals · then Keep or Undo · Scripted agent: same steps every take | You can replay that task step by step, with its files and approvals. Then Keep or Undo. | 8.4 | Track 2: audit, the morning after | Beat 2's sentence "Its record is its own story, and the only undo restores everyone's work." (about 5 s; the recorder now shows the record) and beat 7's "A dashboard gadget keeps score." with T-AT-07 (about 3 s, on the script's cut list) |
| `permissions` | Agent permissions | Beat 4 (JSM approval; in Business the company's role must allow it too) | T-AT-S1: the permissions of the Atlassian track's app on the Server box. Allow one, Deny one, revoke one, then the OS refuses the revoked use (shared with Atlassian Track 1) | Agent permissions · the OS enforces each app's manifest · Allow · Deny · revoke | The OS enforces each app's manifest. Like phone app permissions, you can Allow, Deny or revoke. | 8.0 | Track 2: injection defence and usefulness (what an app may do is set before the agent runs) | The Rovo half of beat 6: "The Rovo agent answers from the log and asks before it rolls back." with T-AT-05 (about 6 s, on the script's cut list), and beat 4's person-picker second (1 s). If the length check still fails, beat 6's "Any issue search can roll several issues back together." with T-AT-06 (about 5 s) |

Length: target 1:30. Every slot in adds about 16.4 s and the cuts above take out about 15 s, so the video runs about 1:31. Cut sizes are estimates from each beat's window; the build's length check has the final say.

### Slot narration

#### flight-recorder

```text
You can replay that task step by step, with its files and approvals. Then Keep or Undo.
```

#### permissions

```text
The OS enforces each app's manifest. Like phone app permissions, you can Allow, Deny or revoke.
```
