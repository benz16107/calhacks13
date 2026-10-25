# GurtOS videos

Everything needed to make the Cal Hacks 13 videos: the list, the scripts, the capture plan, the narration plan and a
HyperFrames project with GurtOS's look. **Status: Ben is editing the scripts.** No captures, narration or renders
until he hands back his edits.

**Ben's decisions (Oct 24):** the narration says "Gurt O.S."; the clone's pace stays as it is; Ben records the ASI:One
shots for the Fetch.ai video himself; he added ElevenLabs credits.

| File | What it is |
|---|---|
| `README.md` | This list: every video, its length, goal and the rubric it serves |
| `main.md` | The main Devpost video (2:55) |
| `tracks/<name>.md` | One script per track video |
| `capture/` | `x11rec.sh` (record any command's windows at 1920 x 1080, 60 fps), `shots.mjs` (the shared web shots against the clip box), `seed-business.ts` (Fogline Supply on the clip box) |
| `capture.md` | Every screen recording: machine, data, state and exact steps. Shots are shared across videos by ID |
| `narration.md`, `narration/say.py` | Ben's cloned voice on ElevenLabs: settings, pronunciation, credit budget; the script that makes each video's voice |
| `studio/` | The HyperFrames project: GurtOS look, title card, lower third, captions, the 10-second test render |
| `../videos.md` | The first shot notes, written before the build finished. These scripts replace them |

## Rules for every video

- Ben does not appear and does not film. Picture is screen recordings of the real product, plus animation for
  concepts that have no screen (the overlay filesystem, the attack scoreboard, the suite map).
- Narration is Ben's cloned voice ("Ben Zhou" on ElevenLabs). Burned-in captions on every video, because judges often
  watch muted.
- Only features that are **verified** or **merged** in `docs/features.md` appear. Every number on screen is one already
  published in `docs/story.md` or the showcase, with its source.
- Story order follows Ben's principles: problem first, then why an OS, then the track's part. Security is the headline.
  Each video names its edition and says what comes from the OS and what from the track.
- Test money is labelled TEST on screen, and said out loud once per video that shows a payment.
- Scripted agents are labelled on screen ("Scripted agent: same steps every take").
- Copy follows unslop and Ben's 30 tells: no em dashes, no slogans without facts, no three-card feature rows, no
  Inter/Geist, no purple, no sparkles. GurtOS's own type (Atkinson Hyperlegible Next) and colours only.
- 1920 x 1080, 30 fps delivery (captured at 60 fps for smooth speed-ups), H.264, loudness about -14 LUFS.
- Each finished video goes to YouTube as Unlisted; its id goes into `showcase/src/data/videos.ts` (see `../videos.md`,
  "After uploading").

## The video list

19 videos: the main one and 18 track videos. Four pairs of tracks share one video, or share most of their footage,
where the story is the same.

| # | Video | Length | Edition shown | Goal | Rubric it serves | Script |
|---|---|---|---|---|---|---|
| 0 | **Main: GurtOS** | 2:55 | All three | A judge who sees only this knows GurtOS is an OS for agents, sees the four moments work, and knows it is light, live on the phone and open source | Devpost (3 min max, MLH: demo-focused). Overall, Most Technically Advanced, Most Creative, Best Solo, Hacker's Choice | `main.md` |
| 1 | Hyphenate: the credit desk | 1:30 | Business | Opens on the APP-1043 moment, then seats, separation of duties and the scored proof | Hyphenate: open with your moment; seats in one line; messy data and planted errors; approvals, separation of duties, every call traceable; proof | `tracks/hyphenate.md` |
| 2 | Visa: shopping you approve | 1:25 | Personal, plus Server for routines | A standing instruction becomes a signed, approved, refundable test purchase; the agent never sees the card | Innovation 25, UX 25, Technical 20, Commerce impact 15, Trust 15 | `tracks/visa.md` |
| 3 | CRS: know who you lend to | 1:05 | Business | The same APP-1043 catch told as identity and fraud, with the OS keeping CRS keys and pulls under control | CRS central and live; Identity/Fraud; Most Unexpected (the OS is the unexpected part) | `tracks/crs.md` |
| 4 | Microsoft: could a company switch this on | 1:20 | Business | Path to production: shadow mode, routed approvals, kill-switch drill, audit, measured impact | Customer understanding, measurable usefulness, path to production, responsible design, end-to-end function | `tracks/microsoft.md` |
| 5 | Coinbase and Solana: an agent wallet you can trust | 1:30 | Server and Business | One video for both: x402 payments and Bazaar listing (Coinbase), devnet settlement and log fingerprints on chain (Solana) | Coinbase: usefulness, technical design, ease of reuse. Solana: real Solana use | `tracks/coinbase-solana.md` |
| 6 | Fetch.ai: a safe body for an ASI:One agent | 3:10 | Server | The main flow inside an ASI:One chat. **Fetch requires 3 to 5 minutes**, so this one is longer than the others | Agentverse, Chat Protocol, real multi-step action in ASI:One, Payment Protocol | `tracks/fetch.md` |
| 7 | Atlassian Track 2: undo only the wrong part | 1:30 | Business | Security for agents acting for a user: every task is a Jira issue, blocked attempts logged, roll back from Jira | Track 2 (injection defence, audit and reversion); idea, usefulness, technical use of Forge | `tracks/atlassian-t2.md` |
| 8 | Atlassian Track 1: hand an issue to an agent | 1:20 | Business | Agents doing the work from Jira, inside the box's limits; shares setup shots with #7 | Track 1 (agents that do the work); same rubric | `tracks/atlassian-t1.md` |
| 9 | Figma: one design system for a whole OS | 2:30 | All three | The stage log on screen: ideation, prototyping, handoff, code generation, with the drift check. Embedded in the Figma Slides deck | Best Workflow, Stage Log, Best Design, Most Creative (3 min max) | `tracks/figma.md` |
| 10 | SpacetimeDB: the live nervous system | 1:10 | All three, strongest Business | Live state with rules in the database: atomic claims, first answer wins, per-person rows | SpacetimeDB used meaningfully as the core real-time backend | `tracks/spacetime.md` |
| 11 | Factory: Droid, made safe | 1:15 | Server and Personal | Plan-first approval, a reviewer droid, autonomy enforced by the OS, Droid never holds a key | Droid SDK doing real work; triggers you designed; careful limits; visible plans, steps and diffs | `tracks/factory.md` |
| 12 | Apify: web robots with no keys | 1:05 | Personal and Server | Actors run from tasks with no network and no token; cost capped; the published Actor | Meaningful use of Apify; Best Actor | `tracks/apify.md` |
| 13 | Anthropic: for solo devs who leave agents running | 1:15 | Personal and Server | A named community, its lived problem, Claude doing the work safely, where it can go wrong | Named community; lived problem; usable Monday; Claude matters; failure modes named | `tracks/anthropic.md` |
| 14 | Armadin: attacks GurtOS stops | 1:15 | All three | The scoreboard with its misses, the poisoned package and the booby-trapped page stopped at the OS | Best Security Hack | `tracks/armadin.md` |
| 15 | Elastic: a record nobody can rewrite | 1:10 | Business and Server | Hash-chained log with an add-only Elastic copy; Agent Builder finds a root cause | Agent Builder on Serverless | `tracks/elastic.md` |
| 16 | Moss: memory that can't be poisoned | 1:05 | Personal | A planted memory refused; local search in 3.1 ms; Forget; talk to your computer | Moss: a personal agent that remembers you | `tracks/moss.md` |
| 17 | Mana: plan in Mana, act safely in GurtOS | 1:00 | Personal and Business | The moment Mana changed the build (C-1007 and C-1011), public chats, the Mana app | Meaningful use; public chats; one moment Mana changed what you built | `tracks/mana.md` |
| 18 | Vultr: the parts that must be public or big | 1:00 | Server | The real disc on a 1 vCPU, 1 GB instance; encrypted backup restore; the relay | MLH Best use of Vultr | `tracks/vultr.md` |

**Shared stories, said plainly.**
- **Coinbase and Solana are one video (#5).** The wallet is the same code and the same payments; Solana's on-chain
  fingerprints get their own beat.
- **Hyphenate, CRS and Microsoft share the credit desk footage.** Each has its own cut, because each rubric asks a
  different question: Hyphenate (the moment and the proof), CRS (identity and fraud, done right), Microsoft (could a
  real company switch this on).
- **Atlassian Track 1 and Track 2 are two videos from one shoot.** One Forge app is entered in both tracks; each video
  answers its own track's brief.
- **Armadin and Anthropic share the booby-trapped page footage** with the main video.

**Lengths.** Track videos are 60 to 90 seconds, except Fetch.ai (its rules require 3 to 5 minutes) and Figma (up to
3 minutes; the stage log needs the time). The main video is 2:55, under Devpost's 3-minute limit.

## The pipeline (`studio/`)

A HyperFrames project: HTML scenes rendered frame by frame to MP4 (`npx hyperframes render`, about 9 s for the
10-second test on the Linux build machine). Each video starts as a copy of `studio/index.html` and mounts its own scenes.

- **Look.** Atkinson Hyperlegible Next and Mono (GurtOS's only typeface), the night Hills wallpaper, the system's
  tokens: ground `#171e25`, text `#f2efe8`, secondary `#b9c0c8`, accent `#8db4dd`, amber `#f2b544` only for "needs
  you", blocked `#f0a493`. Root variables in `index.html`, so a video re-brands from Studio's Variables panel.
- **Editions.** The `edition` variable (server, personal, business) lights that edition's chip on the title card;
  chip colours follow gurtos.com (Server slate, Personal amber, Business blue). The lower third's rule takes the
  edition colour through `lt-accent`.
- **Pieces.** `compositions/title.html` (title card on the Hills), `footage.html` (a real capture in a window frame
  with a slow drift and a punch-in, plus a footnote line for "Scripted agent" or "TEST"), `lower-third.html` (from the
  registry's `lt-side-rule`, restyled), `captions.html` (one group at a time on a night pill, the spoken word in full
  ink; groups come from `npx hyperframes transcribe` word times).
- **Assets** are links to their one source in the repo (fonts from `site/`, logo, Hills, the showcase clip), so
  nothing is duplicated. Renders, raw captures and voice files are git-ignored.
- **The test.** `studio/renders/sample-10s.mp4` (not in git): title card, the real moment-3 clip with a punch-in on
  the approval, the lower third, captions and Ben's cloned voice. `npm run check` passes with one warning (the caption
  track holds four groups in one file, which is the intended layout).

## Order of work after approval

1. Capture the shared library first (`capture.md`, section A): the four moments, the box screen, the phone, the
   OS installs. Most videos use these.
2. Generate narration for approved scripts (`narration.md`); the voice sets each video's timing.
3. Track-specific captures (`capture.md`, section C), in the order of the list above.
4. Build each video in `studio/` from its script, check, snapshot review, render.
