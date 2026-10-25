# Elastic: a record nobody can rewrite (1:10)

**Track:** Elastic, Best use of Elastic Agent Builder on Serverless. **Edition:** GurtOS Business and GurtOS Server
(the boxes shipping to Elastic are Server boxes; the routed approval at the end is the Business screen).
**Shares footage with:** Armadin (#14) for the hash chain, Hyphenate and Microsoft (#1, #4) for the Audit shot.
**Status:** draft for Ben's approval.

## Creative brief

A question-and-answer film, like a data dashboard. Each beat types a plain question as a header, then the real answer fills in. After the card, full-bleed `a08.mp4` from 4.6 scrolls the real action log under the header "What did the agents do this week?" (paragraph 1). Paragraph 2 types three chained hash lines in a terminal, then breaks the third with a flash. Paragraph 3 shows `el-dash.png` with the three 403 lines typed beside it, each stamped in salmon. Paragraph 4 is a split screen, the clean chain on the left and `el-tamper.png` on the right, where hand-drawn underlines land on 466 and 474 as the voice says them and a counter rolls between. A picture-in-picture inset enlarges the entry numbers. Paragraph 5 asks "Why did the job routine fail?", then reveals `el-routine-a.png` and underlines the blocked site. Paragraph 6 is `a30.mp4` from 12.2. A short pause after every question, then a downward wipe as the answer drops. No zoom. Music bed: data.

Footage: a08.mp4, el-dash.png, el-tamper.png, el-routine-q.png, el-routine-a.png, a30.mp4

**Goal.** Remove the limit every log has, "anyone with root can edit it". The video shows the OS writing one
hash-chained log, Elastic keeping a copy the box cannot rewrite, a planted edit named by entry number even after every
hash was rewritten, an Agent Builder agent finding a root cause, and an alert that reaches the owner as one approval.

**Rubric map.** Elastic had not published judging criteria when the page was built (Oct 23); the track asks for an
Agent Builder agent on a Serverless instance, with real data used for something that matters.

| Elastic asks for | Where |
|---|---|
| An Agent Builder agent | Beats 4 and 5 (`gurtos-log` in Kibana) |
| On a Serverless instance | Beat 3 (the `box-actions` index), beat 4 |
| Real data, used for something that matters | Beats 2 to 5 (a box's own action log; the question is "did anyone change the record") |
| Principle 9: what is from the OS and what is from Elastic | Beat 6 |

## Shot list

| # | Time | Picture | On-screen text | Narration | Feature and proof |
|---|---|---|---|---|---|
| 1 | 0:00 to 0:10 | G-EL-1: the Hills; three log files side by side, one line edited by a cursor, no trace | Logs in many files · root can edit any of them | "After a week of agents working, an ordinary computer cannot say what they did. Logs are scattered, and root can edit them." | Problem (principle 1, 12); story.md Elastic problem |
| 2 | 0:10 to 0:24 | A08: Activity scrolls (steps, costs, approvals, blocks); then G-EL-2: three entries, each carrying "prev: hash of the entry above"; one edited, the chain after it turns red | One action log · each entry holds the SHA-256 of the one before | "On Gurt O.S., every step, cost, approval and block goes into one log. Each entry holds the previous entry's hash, so an edit breaks the chain." | The log and hash chain in `core/log.ts` (merged, 26e914b); OS part |
| 3 | 0:24 to 0:38 | T-EL-01: Kibana, the `box-actions` index filling with the box's events; then T-EL-02: three attempts to overwrite, update and delete a document with the box's key, each answered 403 (fresh terminal titled `box`, key never shown) | Elastic Serverless · create-only key · overwrite, update, delete: 403 | "Root can rewrite a whole chain, so each entry also goes to Elastic Serverless with a key that only creates documents. Overwrite, update and delete return four oh three." | Add-only copy; 403 on all three (showcase, README); Elastic part |
| 4 | 0:38 to 0:50 | T-EL-03: the Agent Builder chat, "Was any log tampered with?"; the answer names the box's failed checks and entries 466 to 474 | Edit planted as root would, every later hash rewritten · box's own chain looked clean · Elastic named entries 466 to 474 · Demo run | "A planted edit, with every later hash rewritten, left the box's own chain looking clean. Elastic's copy still named entries four sixty-six to four seventy-four." | `box.verify_log` tool; showcase "Ask it" proof (466 to 474) |
| 5 | 0:50 to 1:00 | T-EL-04: the chat, "Why did the job routine fail? Look at demo run a18523."; three tool calls run; the answer names the blocked www.linkedin.com | Agent Builder agent `gurtos-log` · found it with `box.failures` · allowed: boards.greenhouse.io · needed: www.linkedin.com · blocked | "The Agent Builder agent investigates too. Why did the job routine fail? The box blocked a site the routine was never allowed to reach." | Demo moment: root cause named by the agent itself (story.md) |
| 6 | 1:00 to 1:10 | T-EL-05: an alert rule's row in `box-requests`; cut to the phone, a Waiting for me approval with its reason (A30's routed approval for the Business version); G08 end card | Alert rule or agent leaves a request · the box turns it into one approval · OS: log, approval, undo · Elastic: copy, agent, rules · Open source, Apache-2.0 | "Alert rules and the agent can only leave a request, which the box turns into one phone approval. The OS keeps the log and the power to act. Elastic keeps the copy. Gurt O.S. is open source." | Four alert rules to one approval; `box.request_undo`, request only (merged, 2762cce); G08 |

Footnote on beats 4 and 5: "Demo runs on a Serverless project, answers are the agent's own, Oct 24 capture". Footnote on beat 6: "Caught, not
prevented: an entry changed in the seconds before Elastic has it is not caught. The alert rules are Kibana alerting
rules."

**Cut list if long:** beat 5 (keep the tamper answer); the second half of beat 3's 403 shot.

## Narration (exact text for ElevenLabs)

Word count: 163 (about 1:11 at 2.3 words a second).

```text
After a week of agents working, an ordinary computer cannot say what they did. Logs are scattered, and root can edit them.

On Gurt O.S., every step, cost, approval and block goes into one log. Each entry holds the previous entry's hash, so an edit breaks the chain.

Root can rewrite a whole chain, so each entry also goes to Elastic Serverless with a key that only creates documents. Overwrite, update and delete return four oh three.

A planted edit, with every later hash rewritten, left the box's own chain looking clean. Elastic's copy still named entries four sixty-six to four seventy-four.

The Agent Builder agent investigates too. Why did the job routine fail? The box blocked a site the routine was never allowed to reach.

Alert rules and the agent can only leave a request, which the box turns into one phone approval. The OS keeps the log and the power to act. Elastic keeps the copy. Gurt O.S. is open source.
```

## Captures this video needs

Shared (see `capture.md`): A08, A30, G08. Its own:

| ID | What | Machine and state | Steps |
|---|---|---|---|
| G-EL-1 | Three log files, one line edited | Animation in `studio/` | Built from the Hills card style; no real log content on screen |
| G-EL-2 | The chain: entries each holding the hash above, one edit turning the rest red | Animation in `studio/` | Draw from `core/log.ts`'s fields (`prev`, `hash`); no invented fields |
| G-EL-3 | (optional, only if beat 6 needs a diagram) OS vs Elastic two-column card | Animation in `studio/` | Two columns, the lists in beat 6's on-screen text |
| T-EL-01 | Kibana, `box-actions` filling | Signed-in Kibana on the Serverless project (Elastic trial ends about Oct 30; record before then), a box shipping live | Open Discover on `box-actions`, run one clip-box task, show the new documents appear. Crop the account menu and the machine id with `media-treatment` |
| T-EL-02 | Overwrite, update, delete refused with 403 | Fresh terminal window titled `box`, plain prompt, on the machine that holds the project's test key (the key itself never on screen) | Three requests against one document with the box's create-only key; hold on the three 403 lines. Use the commands in `tracks/elastic/README.md`; if none exist, ask the Elastic thread for the exact curl lines |
| T-EL-03 | The tamper answer | Kibana Agent Builder chat, agent `gurtos-log`; demo run that planted the edit (`DEMO_LIVE=elastic ./demo`) | Ask "Was any log tampered with?", record until the answer names entries 466 to 474. If the new run's entry numbers differ, say the new numbers in the narration and on screen |
| T-EL-04 | The root-cause question | Same chat | Ask "Why did the job routine fail? Look at demo run a18523.", record the three tool calls and the answer |
| T-EL-05 | A request becomes an approval | Server clip box with the Elastic track on; the iPhone simulator paired (D01 setup) | Trigger one alert rule (a task that read a page then tried another host), show the `box-requests` row, then the phone's approval and its reason. For the Business version, pick the approver in A30 |
| T-EL-S1 | A signed receipt: scan, verify, tamper, fail (slot: only once signed receipts are merged) | Server clip box with the Elastic track on, on a build where signed receipts are merged; a phone or the simulator's camera for the scan | Open one receipt and hold on its QR code; scan it and hold on the public verify page; change the receipt and run the check again; hold on the failure. Use only the labels the page shows |

## Check before render

- The entry numbers on screen and in the narration match the capture (466 to 474 is the Oct 24 run).
- The Kibana shots hold no account menu, project name or machine id. Elastic's project ends about Oct 30, so this is the last chance to record it.
- The limit footnote ("caught, not prevented") stays on screen for beat 6; it comes from the showcase's Limits.
- "Four oh three" is read as a number in the voice test; if it sounds odd, swap to "a four-zero-three error".

## Slots: standout features (use only once merged)

These beats stay out of the video until the feature is merged on main and its check passes. When one is ready, record its capture, add its line to `docs/video/slots.json`, generate its narration with `narration/say.py <script> --slots`, and rebuild: later beats move by themselves.

| Slot id | Feature | Goes after beat | Picture (the capture to record) | On-screen text | Narration | Seconds | Rubric it serves | What to cut to stay in length |
|---|---|---|---|---|---|---|---|---|
| `receipts` | Signed receipts | Beat 4 (a planted edit; Elastic's copy still named the entries) | T-EL-S1: a signed receipt from the clip box with its QR code; a phone scans it and the public verify page says it checks out; then the receipt is tampered with and the same check fails | Signed receipt · QR code · public verify page · checked against the log · tampered: fails | Each signed receipt has a QR code. A public page verifies it against the log, and a tampered receipt fails. | 9.7 | Real data, used for something that matters (beats 2 to 5): anyone can check a record without trusting the box | Beat 5 (10 s, first on the script's cut list): drop "The Agent Builder agent investigates too. Why did the job routine fail? The box blocked a site the routine was never allowed to reach." and T-EL-04. Beat 4 keeps the Agent Builder item |

Length: target 1:10. Every slot in adds about 9.7 s and the cuts above take out about 10 s, so the video runs about 1:10. Cut sizes are estimates from each beat's window; the build's length check has the final say.

### Slot narration

#### receipts

```text
Each signed receipt has a QR code. A public page verifies it against the log, and a tampered receipt fails.
```
