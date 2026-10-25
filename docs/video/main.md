# Main video: GurtOS (2:55)

**For:** Devpost's video field (3 minutes or less) and the Overall, Most Technically Advanced, Most Creative, Best Solo
and Hacker's Choice judges. **Edition:** all three. **Voice:** Ben's clone. **Status:** draft for Ben's approval.

**Goal.** A judge who watches only this knows that GurtOS is operating systems built for AI agents, sees the four moments
work on the real product, and knows it is light, controlled live from the phone and open source. MLH's advice is a
demo-focused video, since the live demo at the table is the pitch, so 1:45 of the 2:55 is the product on screen.

**Story order (Ben's principles):** problem, why an OS, GurtOS and its three editions, the four moments, security,
light enough for old hardware, live control from phone and portal, a suite and open source.

**Rubric map.**

| Criterion (Cal Hacks judging) | Where |
|---|---|
| Application, usefulness | Beats 1 to 3 (a real problem with sourced numbers), the moments |
| Intentionality | Beat 3 (why an OS), every beat tied to a feature in `docs/features.md` |
| Functionality | Beats 6 to 9: the four moments on the real product, verified by QA |
| Creativity | Beats 4, 5 and 13: an entire OS and suite for agents |
| Technical complexity | Beats 4, 8, 9, 10: per-task Linux users, overlay layers, resume from the log, OS-level attack test |

## Shot list

Times are targets; the voice sets the final cut. Shot IDs point to `capture.md` (A = shared library, G = animation).

| # | Time | Picture | On-screen text | Narration | Feature and proof |
|---|---|---|---|---|---|
| 1 | 0:00 to 0:15 | G01: numbers count up on the night Hills, one per line, each with its source in small mono below | 392,891 GitHub stars. 21,639 open to the internet. 341 malicious skills. 1 click to steal its token. Sources: GitHub API, Oct 23 2026 · Censys, Jan 2026 · Koi Security · CVE-2026-25253 | "Almost four hundred thousand people starred OpenClaw, an AI agent that runs on your own computer. Then twenty-one thousand copies were found open to the internet, three hundred forty-one of its skills were malware, and one click could steal its token." | The problem, sourced (`docs/devpost.md`, summary) |
| 2 | 0:15 to 0:22 | G01 continued: a terminal-free diagram, one agent icon wired to "your keys", "your files", "your network" | Runs as you | "The agent runs as you: your keys, your files, your network." | Principle 12 |
| 3 | 0:22 to 0:38 | G02: the list builds line by line, each line crossed out amber as it is said | Built for one person at a keyboard. Permissions per user, not per task. Secrets any process can read. Network all or nothing. No approvals, no budgets, no record, no undo. | "The problem isn't the agent. Our operating systems were built for one person at a keyboard. Permissions are per user, not per task. Any process can read your secrets. The network is all or nothing. And there's no approval, no budget, no record and no undo." | Why an OS (principle 12) |
| 4 | 0:38 to 0:54 | A01 box screen at rest, push in; cut to G03: the overlay diagram, three task layers stacking on one folder, each labelled `box-<id>` | Title card: **GurtOS**, "Operating systems built for AI agents". Lower third: Each task: its own Linux user, its own copy-on-write copy, only the hosts it needs | "So I built Gurt O.S.: operating systems built for AI agents. Every task runs as its own Linux user, in its own copy-on-write copy of your files, and reaches only the sites it needs. Agents work side by side without colliding, and nothing is copied twice. Factory's Droid, running Claude, does the work." | The task space, overlayfs, Droid with Claude (moments 1 to 4 rows; Factory and Anthropic rows) |
| 5 | 0:54 to 1:08 | G04: three panes slide in, each a real capture: A01 Server box screen, A20 Personal desktop on the Hills with the native GurtOS app, A30 Business "Waiting for me" | GurtOS Server · GurtOS Personal · GurtOS Business (edition chips in their colours) | "It comes in three editions. Server is an always-on box with no human login. Personal is your own laptop, with agents built into the desktop. Business shares one box across a team, with roles, routed approvals and an audit trail." | Editions (features: Server, Personal, Business sections, verified) |
| 6 | 1:08 to 1:22 | **Moment 3.** A02 split screen: box screen left, iPhone right. The amber request lands on both; tap Approve; the task finishes | Lower third: Moment 3 · A pause for your OK | "A task wants to spend eight dollars on a five-dollar budget. It stops and asks, on the box and on my phone at once, while other tasks keep running. I approve, and it carries on." | Moment 3, verified Oct 24 00:09 |
| 7 | 1:22 to 1:35 | **Moment 2.** A03: the road-bike task; red Blocked banner; open the task, red rows for attacker.example and 1.1.1.1; press Undo | Lower third: Moment 2 · The booby-trapped page. Footnote: Scripted agent, same steps every take | "This agent reads a page with hidden instructions to steal my keys. The task has none to steal. It tries to send data out anyway, and the box blocks it, logs it, and undoes it." | Moment 2, verified Oct 24 00:54 |
| 8 | 1:35 to 1:45 | **Moment 1.** A04: Time Machine, two task layers on one workspace; select one; "What comes back" and "What stays"; Undo | Lower third: Moment 1 · Undo one task | "Two tasks changed the same folder. Undo takes out exactly one of them, and the other task's work stays. No git, no backups." | Moment 1, verified Oct 23 23:15 |
| 9 | 1:45 to 1:58 | **Moment 4.** A05: a long task running; cut to the VM window, force stop, black; start; boot splash; "Welcome back" with the task resuming | Lower third: Moment 4 · Pull the plug | "Now pull the plug. The box boots, rebuilds every task from its log, and picks up where it stopped. Nothing runs twice, and the approval is still waiting." | Moment 4, verified Oct 23 23:21 |
| 10 | 1:58 to 2:12 | G05: the attack scoreboard, 16 rows filling, 14 green "stopped", 2 amber "not covered", then A06 task detail "What it can reach" with the placeholder key | 16 OS-level attacks: 14 stopped, 2 not covered (published). A real Droid task: 240 of 240 samples held only a placeholder key | "Security comes from the OS, whatever the model does. We publish our attack test: sixteen attacks, fourteen stopped, and two we don't cover yet. A real agent held only a placeholder key in two hundred forty out of two hundred forty checks." | Armadin row; Anthropic and Factory demo proof |
| 11 | 2:12 to 2:25 | O01 timelapse: the Server disc boots in a VM, installs, first boot to the box screen; spec lines type in beside it | 1.37 GB disc · 40 Ubuntu packages, no desktop · 4 GB memory, 17 GB disk minimum · no GPU · x86_64 and arm64 | "And it's light. The Server disc is under one and a half gigabytes, with no desktop and no GPU. It runs on the old computer you already own, and it installed on a one-gigabyte cloud machine." | Principle 10 (`docs/story.md`); Vultr install on vc2-1c-1gb |
| 12 | 2:25 to 2:37 | Quick cuts, 2 s each: D01 iPhone Approve with Face ID, D02 Apple Watch approve on the wrist, D03 Mac menu bar, A07 app.gurtos.com on a laptop, D04 Android | app.gurtos.com · iPhone · Apple Watch · Mac · Android | "You watch and answer from anywhere: the portal at app dot gurtos dot com, and apps for iPhone, Apple Watch, Mac and Android." | Native apps rows (merged), remote access (merged) |
| 13 | 2:37 to 2:55 | G07 suite map: the OS core in the middle, editions, apps, remote access, the app platform with the sponsor apps around it; then G08 end card: logo performed in, gurtos.com, github link, Apache-2.0 | GurtOS · gurtos.com · github.com/benz16107/calhacks13 · Open source, Apache-2.0 | "It's a whole suite: the OS, the apps, remote access, and an app platform that Jira, ASI One, a shopper and a finance desk plug into. All of it is open source. Gurt O.S.: real access, never your keys." | Principle 13; repo public Oct 24 |

**Music.** A quiet low pulse under beats 1 to 3 (the old way), opening up at beat 4 when GurtOS appears, held under
the moments at about 0.14 under the voice, one rise into the end card. Effects only on visible actions: the tap on
Approve, the Blocked banner, the power-off cut, the end card.

**Cut list if the voice runs long:** beat 2 merges into beat 1; beat 12 drops Android and Mac; beat 11 drops its last
clause.

## Narration (exact text for ElevenLabs)

The spelling "Gurt O.S." is on purpose: it makes the clone say "Gurt O S" instead of "Girdos" (`narration.md`).
404 words, about 2,350 characters.

```text
Almost four hundred thousand people starred OpenClaw, an AI agent that runs on your own computer. Then twenty-one thousand copies were found open to the internet, three hundred forty-one of its skills were malware, and one click could steal its token.

The agent runs as you: your keys, your files, your network.

The problem isn't the agent. Our operating systems were built for one person at a keyboard. Permissions are per user, not per task. Any process can read your secrets. The network is all or nothing. And there's no approval, no budget, no record and no undo.

So I built Gurt O.S.: operating systems built for AI agents. Every task runs as its own Linux user, in its own copy-on-write copy of your files, and reaches only the sites it needs. Agents work side by side without colliding, and nothing is copied twice. Factory's Droid, running Claude, does the work.

It comes in three editions. Server is an always-on box with no human login. Personal is your own laptop, with agents built into the desktop. Business shares one box across a team, with roles, routed approvals and an audit trail.

A task wants to spend eight dollars on a five-dollar budget. It stops and asks, on the box and on my phone at once, while other tasks keep running. I approve, and it carries on.

This agent reads a page with hidden instructions to steal my keys. The task has none to steal. It tries to send data out anyway, and the box blocks it, logs it, and undoes it.

Two tasks changed the same folder. Undo takes out exactly one of them, and the other task's work stays. No git, no backups.

Now pull the plug. The box boots, rebuilds every task from its log, and picks up where it stopped. Nothing runs twice, and the approval is still waiting.

Security comes from the OS, whatever the model does. We publish our attack test: sixteen attacks, fourteen stopped, and two we don't cover yet. A real agent held only a placeholder key in two hundred forty out of two hundred forty checks.

And it's light. The Server disc is under one and a half gigabytes, with no desktop and no GPU. It runs on the old computer you already own, and it installed on a one-gigabyte cloud machine.

You watch and answer from anywhere: the portal at app dot gurtos dot com, and apps for iPhone, Apple Watch, Mac and Android.

It's a whole suite: the OS, the apps, remote access, and an app platform that Jira, ASI One, a shopper and a finance desk plug into. All of it is open source. Gurt O.S.: real access, never your keys.
```

## Check before render

- The OpenClaw numbers and their sources still match `docs/devpost.md`.
- The attack score (16, 14, 2) matches `tracks/armadin/` on the day of render.
- Moment 2's footage shows the scripted agent; the footnote must be on screen.
- The phone in beat 6 is paired from Settings first, so the log names it.
- Nothing private on screen (`../videos.md`, "Never on screen").

## Slots: standout features (use only once merged)

Ben approved five standout features on Oct 24. None was on main when this cut was made, so none is shown or said. Two
belong in the main video. Each slot **replaces** a paragraph instead of adding one, so the video stays under 3:00
when both are in. When one is ready: record its capture, add it to `docs/video/slots.json`, run
`narration/say.py main.md --slots`, then `node build.mjs main --render`. Later beats move by themselves.

| Slot id | Feature | Replaces | Picture | On-screen text | Seconds | What leaves |
|---|---|---|---|---|---|---|
| `attack-yourself` | Attack it yourself | Paragraph 10 (security) | The board, then T-MAIN-S1: someone pastes an injection into the live attack page and each defence lights up as it stops it (`cap:slot-attack-yourself.mp4`) | Attack it yourself · Paste an injection, watch each defence stop it | about 14, same as now | The "240 of 240 placeholder key" line (it stays in the Anthropic and Factory videos) |
| `try-live` | Try GurtOS live | Paragraph 13 (suite and end card) | Same suite map; the end card's first line becomes "Try GurtOS live: <live address>" | Try GurtOS live: <live address> | about 15, two more than now | Nothing; the end hold covers it |

`slots.json` entries: `"attack-yourself": { "media": "cap:slot-attack-yourself.mp4" }` and `"try-live": { "url": "<the public address>" }`.
The flight recorder, agent permissions and signed receipts belong in track videos (`tracks/*.md`, "Slots").

### Slot narration

#### attack-yourself

```text
Security comes from the OS, whatever the model does. We publish our attack test: sixteen attacks, fourteen stopped, and two we don't cover yet. And you can attack it yourself: paste an injection, and watch each defence stop it.
```

#### try-live

```text
It's a whole suite: the OS, the apps, remote access, and an app platform that Jira, ASI One, a shopper and a finance desk plug into. All of it is open source, and you can try it live at the link below. Gurt O.S.: real access, never your keys.
```
