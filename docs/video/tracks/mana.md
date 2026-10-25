# Mana: plan in Mana, act safely in GurtOS (1:00)

**Track:** Mana, Building with Mana. **Edition:** GurtOS Personal (a guest's request answered by the owner on a
phone) and GurtOS Business (rules drafted in Mana become policy). **Status:** draft for Ben's approval.

## Creative brief

Two rooms and a doorbell. Mana is the planning room, GurtOS is where work runs, and a guest rings the bell from a Mana app so the owner's phone lights up. After the card, `project-page.png` (a real Mana page) whips right to `a03.mp4` from 8 at 1.3x, the real box blocking a bad page (paragraph 1). Paragraph 2 pins `chat-review.png` and `chat-gen3.png` to a board as notes at slight angles. Paragraph 3 circles the two $10,000 records in `mana-gap2.png`, rolls a counter to $20,000, then types REL-1 and SOD-5 in a header. Paragraph 4 is `2-rules.png` with kinetic type, "the owner approves the exact text". Paragraph 5 splits `mana-ask-top.png` from the owner's phone, a tilted 3D card with the watch shot as an inset, and counters read 25 cents and no network. Paragraph 6 shows both rooms side by side under the end card. Quick, bouncy cuts and whip pans between rooms. One zoom, on the "$20k" sentence. Music bed: social.

Footage: showcase/src/assets/track/mana/project-page.png, a03.mp4, showcase/src/assets/track/mana/chat-review.png, showcase/src/assets/track/mana/chat-gen3.png, mana-gap2.png, showcase/src/assets/repo/business/2-rules.png, mana-ask-top.png, showcase/src/assets/track/mana/iphone-guest.png, showcase/src/assets/track/mana/watch-guest.png

**Goal.** Mana is where we thought; GurtOS is where the work runs safely. A judge sees a public Mana chat, one moment
where Mana changed what we built (two $10,000 limits for one business, now rules REL-1 and SOD-5), the rules reaching
GurtOS Business only after an owner approves the exact text, and the project living inside Mana: a visitor's request
from a Mana app reaching the owner's phone.

**Rubric map.**

| Mana asks for | Where |
|---|---|
| Meaningful use | Beat 2 (a three-turn review: 12 gaps ranked, 69 rules proposed), beat 4 (rules sync into Business) |
| Link public Mana pages or chats | Beat 2 and beat 6 (on-screen address; links in the Devpost text) |
| One moment Mana changed what you built | Beat 3 (C-1007 and C-1011 to REL-1 and SOD-5) |
| +10 if the project lives inside Mana | Beat 5 (Ask GurtOS, a Mana app; the request reaches the owner's phone) |

## Shot list

| # | Time | Picture | On-screen text | Narration | Feature and proof |
|---|---|---|---|---|---|
| 1 | 0:00 to 0:07 | G-MA-1: the Hills; one line appears, then the two words "Mana" and "GurtOS" side by side | AI workspaces are good for thinking. There is no safe place for an AI to act on your real computer. | "AI workspaces are good for thinking, but there is no safe place for an AI to act on your real computer." | The problem (`docs/story.md`, Mana) |
| 2 | 0:07 to 0:16 | T-MA-01: the public Mana chat "Credit Desk Hackathon Agents Review", opened signed out: turn one and Mana's answer "Gaps, ranked by risk to Fogline", scrolling to the list of 12 gaps | Public Mana chat · 32 draft rules in, 12 gaps ranked, 69 rules proposed | "A public Mana chat reviewed our draft credit rules, found twelve gaps and proposed sixty-nine." | Public planning chat (`tracks/mana/README.md`; answers 200 signed out, QA checked) |
| 3 | 0:16 to 0:30 | T-MA-02: Mana's answer on the C-1007 and C-1011 gap; cut to the rules file header (v0.2, the changelog naming the chat) with REL-1 and SOD-5 highlighted; cut to a live run's report citing REL-1 | Mana found it: two records, one business, $10,000 each = $20,000 · REL-1 and SOD-5 now treat them as one · 35 of Mana's 69 rules are in the file the agents use | "One finding changed the build. Two customer records for one business each held a ten-thousand-dollar limit. That is twenty thousand dollars, each piece inside the analyst's authority. Rules R E L one and S O D five now treat them as one business, and live runs cite both." | The moment (`showcase/src/content/tracks/mana.mdx`); live Droid runs cite REL-1 and SOD-5 (`runs/` folder) |
| 4 | 0:30 to 0:38 | T-MA-03: GurtOS Business, signed in as the owner: a rules proposal from Mana waiting, the exact text shown, Approve; then Settings > Rules showing the new rule applied | Business · rules drafted in Mana · applied only after an owner approves the exact text | "Gurt O.S. Business applies rules drafted in Mana only after an owner approves the exact text." | Mana policy proposal hook (`box.policy`, `box.setPolicy`, hash check; merged, merge gate runs it, QA has not walked it) |
| 5 | 0:38 to 0:54 | T-MA-04: the Ask GurtOS app inside Mana at phone size, signed out: the visitor types "What is the price of a Chemex 6-cup?"; cut to the owner's iPhone request "Guest asks: a price", Approve; cut to the task detail (A06 style): the empty guest workspace, no network, 25 cent budget; back in Mana, "Done." | Ask GurtOS, an app inside Mana · the owner approves on the phone · empty workspace, no network, 25 cent budget · Test computer | "A visitor asks our Mana app for a price check. The request reaches the owner's phone. After approval it runs in an empty workspace, with no network and a twenty-five cent budget." | Guest requests (verified Oct 24 04:25: one approval, no network, deny by default, 3 per guest and 10 an hour); iPhone captured in the simulator against a test computer |
| 6 | 0:54 to 1:00 | G08: end card, with the chips "Personal" and "Business" and the Mana home page title "GurtOS: built with Mana" | Plan in Mana, act safely in GurtOS · Public Mana links on the Devpost page · open source, Apache-2.0 | "Plan in Mana. Act safely in Gurt O.S. Open source." | Home page answers 200 signed out (`docs/features.md`, Mana) |

**Cut list if long:** beat 4 (rules sync), keeping the Mana line in beat 3; or beat 2's scroll to the 12 gaps.

## Narration (exact text for ElevenLabs)

Word count: 142 (about 1:00 at 2.3 words a second; cut beat 4 if it runs over).

```text
AI workspaces are good for thinking, but there is no safe place for an AI to act on your real computer.

A public Mana chat reviewed our draft credit rules, found twelve gaps and proposed sixty-nine.

One finding changed the build. Two customer records for one business each held a ten-thousand-dollar limit. That is twenty thousand dollars, each piece inside the analyst's authority. Rules R E L one and S O D five now treat them as one business, and live runs cite both.

Gurt O.S. Business applies rules drafted in Mana only after an owner approves the exact text.

A visitor asks our Mana app for a price check. The request reaches the owner's phone. After approval it runs in an empty workspace, with no network and a twenty-five cent budget.

Plan in Mana. Act safely in Gurt O.S. Open source.
```

## Captures this video needs

Shared (see `capture.md`): A06 (task detail), D01 (the iPhone simulator paired to the clip box), A30 (the owner's
person picker), G08. Its own:

| ID | What | Machine and state | Steps |
|---|---|---|---|
| G-MA-1 | The problem card (animation, no capture) | `studio/` | One line of type, then "Mana" and "GurtOS" in the GurtOS look |
| T-MA-01 | The public planning chat | Chromium in Xvfb on the Linux build machine, signed out, desktop 1920 x 1080 | Open the credit rules chat link (memory `mana-track`; sharing is a snapshot, so reopen Share chat if the turns are stale); scroll turn one and the 12 gaps; blur account menus in the edit, never CSS |
| T-MA-02 | The moment, and the rules it became | Same browser; the repo checkout for the rules file and a run report | (a) the chat's answer on the C-1007 / C-1011 gap; (b) `tracks/credit-desk/rules/` header (v0.2, the changelog); (c) a live run report under `tracks/credit-desk/runs/` that cites REL-1 |
| T-MA-03 | A Mana rules proposal approved on Business | Clip box (Business on, Mana track on) | `POST /t/mana/policy` with a one-rule change (the track's demo does this); sign in as the owner; open the waiting proposal; Approve; open Settings > Rules |
| T-MA-04 | Ask GurtOS from Mana to the phone | Mana app in Chromium at 390 x 844 (3x), signed out; the box is a test computer, not the installed one; iPhone simulator on the build Mac paired to it | Ask the Chemex price question in the Mana app; on the iPhone, open the request and Approve; open the guest task's detail (empty workspace, no network, 25 cent budget); the app answers "Done." |

## Check before render

- Rules sync (beat 4) is merged and the merge gate runs it, but QA has not walked it. Rehearse T-MA-03 once before
  recording. If it does not run cleanly, cut beat 4 and the narration line.
- The guide agent (also inside Mana) was not talked to by QA; this video does not show it.
- The public links answer 200 signed out as of QA's check. The guide app's backend link expires about Nov 23.
- Say "later live runs cite both" only if the run report on screen does; the page says live runs cite REL-1 and SOD-5.
- Edition chips: Personal on beat 5 (the owner answering on a phone; the box in the demo is a test computer),
  Business on beat 4.
