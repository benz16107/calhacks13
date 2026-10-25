# Figma: one design system for a whole OS (2:30)

**Track:** Figma, Best Workflow, Stage Log, Best Design and Most Creative. **Edition:** all three (Server, Personal, Business) and the phone app. **Shares footage with:** main (A01, A20, A30, D01 shown as the output of the design). **Status:** draft for Ben's approval.

**Goal.** Figma requires a demo video of 3 minutes at most, embedded in the required Figma Slides deck, plus a stage log. The stage log is the spine: each of the four stages (ideation, prototyping, handoff, code generation) gets a lower third with its tool, minutes and rating, taken from `docs/stagelog.md`. The argument is that an ecosystem needs one design system, and the code is not lost between the design and the product: every Figma variable is a CSS custom property of the same name, and a check fails when they drift. The video says plainly what was not done (Code Connect is written but unpublished; Weave and Buzz were not used).

**Rubric map.**

| Figma asks for | Where |
|---|---|
| Best Workflow: idea to demo with Figma | Beats 2 to 5 (one stage each), beat 7 (the other Figma products) |
| Stage Log: tool, minutes, 1 to 5 for ideation, prototyping, handoff and code generation | Lower thirds in beats 2 to 5; the summary card in beat 8 |
| Best Design | Beats 1 and 6 (one system across editions, frame beside running app) |
| Most Creative | Beat 1 (an OS, not a dashboard), beat 7 (Sites, Community playbook) |
| Figma Slides deck (required) | Beat 7; this video is embedded in the deck's video slide |
| Demo video of 3 minutes at most | 2:30 total |

## Shot list

Lower thirds read: `Stage · Tool · minutes · rating`. Hold each for at least 3 seconds. Minutes and ratings are from `docs/stagelog.md` (stage sums, same as the showcase's stage-log table).

| # | Time | Picture | On-screen text | Narration | Feature and proof |
|---|---|---|---|---|---|
| 1 | 0:00 to 0:14 | G-FI-1: the Hills; four cards appear, "Server box screen", "Personal desktop", "Business approvals", "Phone app", with a line under them that closes up into one row labelled "one set of Figma variables". Under it the FigJam ecosystem map (T-FI-01) fades in | One OS · three editions · portal · phone app · native desktop · one design system | "Designing one screen is easy. Gurt O.S. is an ecosystem: three editions, a box screen, a portal, a phone app and a native desktop. Give each its own colors and type, and they drift apart. So everything starts from one design system, and the code is never lost." | The ecosystem map (`docs/figma/ecosystem-map.png`, FigJam, 2 min in the log); principle 13 |
| 2 | 0:14 to 0:34 | T-FI-01: the FigJam board, pan from the architecture diagram to the four moments to the 25 track stickies; T-FI-02: the moodboard and the three directions (A home-server OS, B console, C hardware OS), the pick highlighted | Lower third: Stage 1 · Ideation · FigJam + Figma MCP server · 42 min · 4 of 5. Two rounds of 15 references · 3 directions | "Stage one, ideation, in FigJam. Claude Code drew the architecture and the four demo moments through Figma's M C P server. It then gathered two rounds of fifteen references from real operating systems, and drew three directions. I picked one. Forty-two minutes. Four out of five." | Stage log ideation rows (3 + 8 + 7 + 14 + 8 + 2 = 42 min); `docs/figma/refs/`, `docs/figma/directions/` |
| 3 | 0:34 to 0:54 | T-FI-03: the Figma prototype playing, the phone approval flow (lock-screen banner arrives, Approve, task runs); cut to the Edition variable switching Server, Personal, Business on the phone app page (T-FI-04); a quick flash of the Make phone-app prototype | Lower third: Stage 2 · Prototyping · Figma Design + Figma Make · 61 min · 4 of 5. 4 flows · 136 links · Edition variable: Server, Personal, Business | "Stage two, prototyping, in Figma Design and Figma Make. Four flows across the new screens, with one hundred thirty-six links. All twelve setup steps. Approving a spend on the phone. Undoing one task. A variable switches the edition. Sixty-one minutes. Four out of five." | Stage log prototyping rows (6 + 3 + 17 + 32 + 3 = 61 min); 136 links on "GurtOS screens v2"; the Edition collection with three modes |
| 4 | 0:54 to 1:18 | T-FI-05: Figma's Variables panel on `accent/bg`, Light and Dark values, the code syntax `--color-accent-bg`; G-FI-2 pairs it with the shipped kit's CSS (same name, same two values); then T-FI-06: the terminal runs `node docs/figma/tokens/sync.ts --check` and prints 0 drifts across 82 tokens; a text card shows "first run: 18 drifts" | Lower third: Stage 3 · Handoff · Figma Design + Figma MCP server · 67 min · 4 of 5. accent/bg · Light #2F64A6 · Dark #78A9E6 = --color-accent-bg · 82 tokens · 0 drifts (first run: 18) | "Stage three, handoff. Every Figma variable carries its CSS name, so the code reads the same names. The accent blue has two values, one for Light and one for Dark, and the code uses the same name and the same two values. A script exports all eighty-two tokens and fails on drift. Its first run found eighteen. Today it finds none. Sixty-seven minutes. Four out of five." | Stage log handoff rows (4 + 15 + 23 + 25 = 67 min); `docs/figma/tokens/` (`sync.ts --check`; 18 drifts on the first run; 0 across 82 on today's main, re-run at render) |
| 5 | 1:18 to 1:44 | T-FI-07: a Claude Code session calling Figma's MCP `get_design_context` on a frame (the box home, `16:20`), the reference code returned; cut to the same screen in the running portal (A01); then a Personal GNOME frame beside A20; then a Business frame (People or Waiting for me) beside A30 | Lower third: Stage 4 · Code generation · Figma MCP server (get_design_context) · 349 min · 4 of 5 (229 portal and Personal, about 120 Business). Output: portal/, personal/ | "Stage four, code generation. Claude Code read the frames with get design context and built the portal this computer serves today. Business came from approved frames too, and Personal became native libadwaita windows. Three hundred forty-nine minutes. Four out of five." | Stage log code-generation rows (10 + 32 + 25 + 70 + 25 + 40 + 27 + 120 = 349 min); `portal/`, `personal/`; shipped output is real (A01, A20, A30) |
| 6 | 1:44 to 2:04 | T-FI-08: the compare page, a Figma frame beside the running app's screenshot with its difference score, three or four pairs; then A01, A20 and A30 side by side in three panes with edition chips | Server and Business: one web kit · Personal: native GTK, same colors and type · 77 frames compared with a score | "Server and Business share one web kit. Personal is native, built from its own frames in the same colors and type. A script sets seventy-seven frames beside the running app and scores the difference." | `docs/figma/compare/` (77 pairs; `compare.ts`); the drift check covers the web kit only, so Personal's tokens are not claimed as checked |
| 7 | 2:04 to 2:22 | T-FI-09: the Figma Slides deck flipping (slides 14 and 15: the design system and the stage log); T-FI-10: the published Figma Sites landing page scrolling; T-FI-11: Dev Mode on one component, the kit code in its description; the Community playbook page; a text strip for Code Connect | 16-slide Figma Slides deck · landing page on Figma Sites · Community playbook · Dev Mode code on 95 components · Code Connect: 95 templates written, not published (needs an Organization plan) · rated 3 | "Around that sit a sixteen-slide Figma Slides deck, a landing page published on Figma Sites, a Community playbook, and Dev Mode code on ninety-five components. Code Connect templates are written but unpublished, because publishing needs an Organization plan. We rated that one three." | Features: Sites landing page, Community playbook, Code Connect all merged (Code Connect unpublished, stated); stage log Handoff row for Code Connect (rating 3) |
| 8 | 2:22 to 2:30 | G-FI-3: the stage log card, four rows (Ideation 42 · Prototyping 61 · Handoff 67 · Code generation 349, each 4 of 5) with "All logged in docs/stagelog.md"; then G08, the end card | Ideation 42 min · Prototyping 61 · Handoff 67 · Code generation 349 · all rated 4 of 5, misses logged · GurtOS · open source, Apache-2.0 | "Every stage is logged, with the misses. Gurt O.S. is open source." | The stage log; Apache-2.0 |

**Cut list if long:** beat 7's Dev Mode and Community strips (keep the deck and Sites); beat 6's second sentence; beat 2's "I picked one."

## Narration (exact text for ElevenLabs)

Word count: 335 (about 2:25 at the clone's pace; the shots hold the last 5 seconds for the end card).

```text
Designing one screen is easy. Gurt O.S. is an ecosystem: three editions, a box screen, a portal, a phone app and a native desktop. Give each its own colors and type, and they drift apart. So everything starts from one design system, and the code is never lost.

Stage one, ideation, in FigJam. Claude Code drew the architecture and the four demo moments through Figma's M C P server. It then gathered two rounds of fifteen references from real operating systems, and drew three directions. I picked one. Forty-two minutes. Four out of five.

Stage two, prototyping, in Figma Design and Figma Make. Four flows across the new screens, with one hundred thirty-six links. All twelve setup steps. Approving a spend on the phone. Undoing one task. A variable switches the edition. Sixty-one minutes. Four out of five.

Stage three, handoff. Every Figma variable carries its CSS name, so the code reads the same names. The accent blue has two values, one for Light and one for Dark, and the code uses the same name and the same two values. A script exports all eighty-two tokens and fails on drift. Its first run found eighteen. Today it finds none. Sixty-seven minutes. Four out of five.

Stage four, code generation. Claude Code read the frames with get design context and built the portal this computer serves today. Business came from approved frames too, and Personal became native libadwaita windows. Three hundred forty-nine minutes. Four out of five.

Server and Business share one web kit. Personal is native, built from its own frames in the same colors and type. A script sets seventy-seven frames beside the running app and scores the difference.

Around that sit a sixteen-slide Figma Slides deck, a landing page published on Figma Sites, a Community playbook, and Dev Mode code on ninety-five components. Code Connect templates are written but unpublished, because publishing needs an Organization plan. We rated that one three.

Every stage is logged, with the misses. Gurt O.S. is open source.
```

## Captures this video needs

Shared (see `capture.md`): A01 (box screen), A20 (Personal desktop), A30 (Business), D01 (phone approval, optional in beat 5), G08. Animation cards (built in `studio/`, no capture): G-FI-1 (four surfaces closing into one row of variables), G-FI-2 (the token pair, Figma on the left, CSS on the right, same name, same two values), G-FI-3 (the stage log summary card). Its own:

| ID | What | Machine and state | Steps |
|---|---|---|---|
| T-FI-01 | The FigJam ideation board and the ecosystem map | the Linux build machine recorder, a signed-out browser (the board is shared with Anyone) | Open the board; pan the architecture, the four moments and the 25 stickies; hold on the ecosystem map |
| T-FI-02 | The moodboard and the three directions | Same | The moodboard section, then the Directions page of the design file with A, B and C and the pick |
| T-FI-03 | The approval prototype playing | Signed-out browser on the design file's prototype link | Present mode, flow "approve a spend on the phone": the banner arrives at 1.2 s, Approve, done |
| T-FI-04 | The Edition variable switching modes | Signed-in Figma on the phone app page (Ben's account, nothing private in frame) | Present mode; use the Machines switcher; show Server, Personal, Business homes. Flash the phone-app Make file |
| T-FI-05 | The variable and its CSS name | Signed-in Figma, Variables panel | Open the GurtOS system collection, select `accent/bg`, Light then Dark, show code syntax `--color-accent-bg`; then the shipped kit CSS with the same name |
| T-FI-06 | The drift check | the Linux build machine checkout of main, terminal | Run `node docs/figma/tokens/sync.ts --check`, keep the "0 drifts, 82 tokens" line in frame. Re-run on the final commit |
| T-FI-07 | `get_design_context` on a frame | A Claude Code session with the Figma connector, on a scratch checkout | Call it on the box home frame (`16:20`); show the returned React and Tailwind reference; no account menu in frame |
| T-FI-08 | The app-versus-frame comparison | the Linux build machine, `node docs/figma/compare/compare.ts`, then the generated page in Chromium | Open the page; scroll four pairs with their scores |
| T-FI-09 | The Slides deck | Signed-out browser on the deck link | Present mode through slides 14 and 15 (the design system, the stage log), then slide 6 |
| T-FI-10 | The Figma Sites landing page | Signed-out browser on the published site | Scroll desktop width (1440), hold on the three editions |
| T-FI-11 | Dev Mode and the playbook | Signed-in Figma, Dev Mode | Select one component, show its description with the kit code and source link; open the Playbook page |

## Check before render

- The four stage figures (42, 61, 67, 349 min; 4 of 5 each) still match `docs/stagelog.md` and the showcase's stage-log table. Stage totals are sums of rows, so re-add them if a row was added.
- Re-run `sync.ts --check` on the final commit. If it does not print 0 drifts across 82 tokens, change beat 4.
- The accent values (#2F64A6 Light, #78A9E6 Dark) and `--color-accent-bg` are read on screen from the live files, not typed in.
- The "136 links" and "77 frames" counts match `docs/figma.md` and `docs/figma/compare/` at render time.
- Files used on camera open for Anyone (the showcase checked this on Oct 24). Hide the account menu and any Figma notification.
- Say nothing about Weave, Buzz, webhooks, a published Make file or published Code Connect. None is verified or merged.
- No Co-Authored-By or "Generated with" text anywhere in the frame.
