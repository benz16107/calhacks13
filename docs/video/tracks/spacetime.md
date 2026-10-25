# SpacetimeDB: the live nervous system (1:10)

**Track:** SpacetimeDB, SpacetimeDB as the core real-time backend. **Edition:** all three, strongest in GurtOS Business. **Shares footage with:** main (A02, A30), Hyphenate (A30). **Status:** draft for Ben's approval.

**Goal.** A judge sees that SpacetimeDB is not a mirror bolted on the side. It is the box's live state, and the rules are in the database: agents claim shared work atomically, each person is sent only their own requests, the first answer wins, and the answer is recorded under a name the box vouched for. The problem comes first (the usual stack is heavy and fragile), then why an OS: the box is the one place that can vouch for who is asking.

**Rubric map.**

| SpacetimeDB asks for | Where |
|---|---|
| SpacetimeDB used meaningfully as the core real-time backend | Beats 2 to 6 (tasks, requests, claims, rows, reducers) |
| Rules in the database, not in glue code | Beats 3 to 5 (atomic claim, row-level visibility, first answer wins) |
| Real-time sync you can see | Beat 2 (box screen and phone, same request, same moment) |
| A fleet view that respects privacy | Beat 6 (Maincloud, off by default, counts only) |

## Shot list

| # | Time | Picture | On-screen text | Narration | Feature and proof |
|---|---|---|---|---|---|
| 1 | 0:00 to 0:09 | G-ST-1: on the Hills, four boxes appear in a row (database, websocket server, cache, sign-in glue), joined by thin lines, then collapse into one box, "one SpacetimeDB on the box" | Database + websocket server + cache + sign-in glue: heavy, and it breaks | "Live agent state usually needs a database, a websocket server, a cache and sign-in glue. That stack is heavy and breaks. An ordinary computer offers none of it." | The problem (`docs/story.md`, SpacetimeDB) |
| 2 | 0:09 to 0:19 | A02: moment 3. The box screen and the iPhone side by side; the request lands on both at once; Approve on the phone; the task finishes | GurtOS · one self-hosted SpacetimeDB on each box · from the OS: the box writes every change and vouches for each screen | "Gurt O.S. runs one self-hosted Spacetime D B on each box, and the rules live inside the database. Every screen sees the same request at the same moment." | Tasks and approvals mirrored live; phone answers through the vouched reducer (verified Oct 24 00:09, two phones) |
| 3 | 0:19 to 0:32 | T-ST-01: the Live window's Agents view, then the log of the queue check: three agents claim jobs at once; a counter climbs to 15 claims, 12 jobs, a row of 12 different job ids, no repeat | 3 agents · 15 claims · 12 jobs · 12 distinct · none twice. Scripted agents: same steps every take | "Agents claim shared work in one transaction. Three agents made fifteen claims on twelve jobs and got twelve different jobs. None twice." | `spacetime.claim` (claimJob in one transaction), merged ed88206; story proof: 3 agents, 15 claims, 12 jobs, 12 distinct |
| 4 | 0:32 to 0:44 | T-ST-02: Business. Three clients open on the same box (Rosa on her phone, Priya on hers, and a stranger's identity). A request routed to Rosa appears on her screen only; the other two show an empty list. Then A30 for one second | Rosa: sees her request · Priya: nothing · a stranger: nothing · GurtOS Business | "Each person is sent only their own requests. Rosa's phone gets what is routed to her. Priya's phone and a stranger's get nothing." | `my_requests` view and private tables; Business routing; merged ed88206 |
| 5 | 0:44 to 0:58 | T-ST-03: two screens answer the same request. The first shows "approved"; the late one shows "already approved by" and the name; "X is viewing" presence on the request clears when a client disconnects. Then a call from a stranger's identity to the answer reducer, refused; the log row shows the vouched name | First answer wins · "already approved by <name>" · a stranger's identity: refused · answered under the name the box vouched for | "The first answer wins. A late one is refused, naming who already approved. The answer is recorded under the name the box vouched for, and a stranger's identity is refused." | First-answer-wins reducer and presence, merged ed88206; the vouched reducer refusing anonymous calls, verified Oct 24 00:09; merge-gate moment 3 |
| 6 | 0:58 to 1:10 | G-ST-2: three short rows on the Hills, each a real capture crop: the reminder timer ("brings Priya in after 3 seconds"), the live meters beside the task list, the Computers tab with "Show this computer on your other computers" off; ends on G08 | A timer in the database · live meters match the task list · Maincloud fleet view: off by default, counts only, never a prompt, file or key · GurtOS · open source, Apache-2.0 | "A timer in the database can bring a second person in. Live meters match the task list. A Maincloud fleet view is off by default and shows counts only. Gurt O.S. is open source." | Scheduled reducer (module and demo; the Business policy line for it is not on main, so it is shown as the mechanism); live meters merged; Maincloud fleet view merged, three live checks passed on main 6091870 |

**From the OS vs from SpacetimeDB** (small caption in beat 2, held 3 s): the OS names each task and screen, so one agent cannot claim as another and no screen can pose as a person. SpacetimeDB holds the tables, reducers and subscriptions that enforce the rules.

**Cut list if long:** beat 6's meters and timer (keep the fleet line); beat 5's presence.

## Narration (exact text for ElevenLabs)

Word count: 165 (about 1:12).

```text
Live agent state usually needs a database, a websocket server, a cache and sign-in glue. That stack is heavy and breaks. An ordinary computer offers none of it.

Gurt O.S. runs one self-hosted Spacetime D B on each box, and the rules live inside the database. Every screen sees the same request at the same moment.

Agents claim shared work in one transaction. Three agents made fifteen claims on twelve jobs and got twelve different jobs. None twice.

Each person is sent only their own requests. Rosa's phone gets what is routed to her. Priya's phone and a stranger's get nothing.

The first answer wins. A late one is refused, naming who already approved. The answer is recorded under the name the box vouched for, and a stranger's identity is refused.

A timer in the database can bring a second person in. Live meters match the task list. A Maincloud fleet view is off by default and shows counts only.

Gurt O.S. is open source.
```

## Captures this video needs

Shared (see `capture.md`): A02, A30, A01 (optional, behind beat 6), G08. Animation cards: G-ST-1 (the heavy stack collapsing into one box), G-ST-2 (three proof rows from real captures). Its own:

| ID | What | Machine and state | Steps |
|---|---|---|---|
| T-ST-01 | The atomic claim check | Clip box with the spacetime track on; the Live window `/t/spacetime/` | Run the queue check (3 scripted agents, 12 jobs); record the Agents view and the result lines; keep "15 claims, 12 distinct" in frame |
| T-ST-02 | Row-level visibility | Clip box with Business on (Fogline people), three clients | Route a request to Rosa; show Rosa's phone, Priya's phone and a client with an unknown identity, side by side |
| T-ST-03 | First answer wins and the refused stranger | Same box | Two screens open on one request; answer on one, then the other; open the "viewing" presence and close a client; call the answer reducer from a stranger's identity and show the refusal and the log row |
| T-ST-04 | Fleet view and the Computers tab | Clip box with `DEMO_LIVE=spacetime` against Maincloud | Settings, Computers: the switch off by default; turn on, hold on the counts-only row, turn off, the row and grants are gone |
| T-ST-05 | Timer and meters crops | Same box | Reminder timer demo result line; the Live window's meters beside the task list |

## Check before render

- "3 agents, 15 claims, 12 jobs, 12 distinct" appears in the capture and matches `docs/story.md` (the 30-claims-on-10-jobs run is a second check; do not mix the two).
- Scripted agents carry the footnote "Scripted agent: same steps every take".
- Do not say a Business policy line sets the reminder delay. It is not on main.
- The fleet view shows the made-up "Demo box" only; no machine names or database credentials in frame.
- QA verified the vouched reducer (Oct 24 00:09) but has not hand-tried every feature; record each from the gate or the demo track so the take is repeatable.
