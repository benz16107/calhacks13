# Factory: Droid, made safe (1:15)

**Track:** Factory, Droid SDK. **Edition:** GurtOS Server (an always-on box where triggers start Droid while you are
away) and GurtOS Personal (Droid works on a copy of your folder until you press Keep). **Shares footage with:** Anthropic
(T-FA-01), the main video (A03). **Status:** draft for Ben's approval.

**Goal.** Droid does real work through the Droid SDK, and a judge can see every plan, step and diff. The OS, not Droid's
good behaviour, sets the limits: its own Linux user, no key, a plan approved on the phone, a read-only reviewer, and an
autonomy level the firewall and budget hold even if Droid ignores it. Not a chatbot wrapper: nothing here is a chat box.

**Rubric map.**

| Factory asks for | Where |
|---|---|
| The Droid SDK doing real work | Beats 2, 4, 5 (a real Droid task with Claude, started through `@factory/droid-sdk`) |
| The README says where and how | Beat 2 on-screen line (`core/workers/droid.ts`, about 70 lines) and the closing chip |
| Triggers you designed | Beat 3 (schedule, new file, webhook, ASI:One, Jira; plus a GitHub issue label) |
| Careful limits on what Droid can touch | Beats 2 and 6 (own user, no key, autonomy levels, hooks) |
| Visible plans, steps and diffs | Beats 4 and 5 (the plan on the phone, the steps, the reviewer's verdict and diff) |
| Scores badly: chatbot wrappers, invisible actions | Beat 5 (no chat box; every tool call is a log step) |

## Shot list

Times are targets; the voice sets the final cut. Footnote on real Droid clips: "Real Droid with Claude Sonnet 5.5, Oct 24
run".

| # | Time | Picture | On-screen text | Narration | Feature and proof |
|---|---|---|---|---|---|
| 1 | 0:00 to 0:12 | G-FA-1: a source card on the night Hills. "Nx packages, August 2025". Three short lines: the AI tools were started with permission-skipping flags; told to search the disk for wallets, SSH keys, .env files, tokens; credentials posted to GitHub repositories. Links in small mono | Nx, August 2025: malicious packages started AI command-line tools already on developers' machines, with permission-skipping flags, to search for keys and tokens. Wiz: the AI activity succeeded in hundreds of cases; the providers' guardrails sometimes blocked it. Sources: Wiz, Aug 27, 2025 · Nx advisory | "In August twenty twenty-five, malicious Nx packages started the AI tools already on developers' machines, with permission-skipping flags, and told them to hunt for keys. Wiz says it worked in hundreds of cases." | Sourced incident, as the Factory page states it (`showcase/src/content/tracks/factory.mdx`) |
| 2 | 0:12 to 0:26 | A06: task detail, runs as `box-<id>`, "What it can reach", the placeholder key line. Then G-FA-2: three lines of the real merge-gate output, typed in: "Droid, running Claude as its own Linux user, edited the file in its own copy", "all 240 process samples held only a placeholder key" | From the OS: own Linux user, own copy of the files, the proxy adds the Factory key outside the task. From Factory: Droid and its SDK. 240 of 240 samples held only a placeholder key (merge gate, Oct 24) | "On Gurt O.S., Droid is its own Linux user, in its own copy of the files, and the proxy adds the key outside the task. In a real run, two hundred forty of two hundred forty samples held only a placeholder." | Droid with Claude as the worker; 240 of 240 samples (features: Factory rows; moment 1 with Droid) |
| 3 | 0:26 to 0:36 | G-FA-3: five trigger lines appear, one per second, each ending in "starts a Droid task": schedule, new file, webhook, ASI:One chat, Jira label `gurtos-agent`. Then T-FA-03: a file dropped into a watched folder, a task appears on the box screen | Triggers we designed: a schedule · a new file · a webhook · an ASI:One chat · a Jira label. Also: a GitHub issue labelled droid, and gurtos-exec | "Tasks start from a schedule, a new file, a webhook, an ASI:One chat or a Jira label." | Triggers (features: Droid worker row, verified Oct 24 00:10 for schedule, webhook and file; Jira label merged, live; ASI:One and GitHub rows merged) |
| 4 | 0:36 to 0:47 | T-FA-01: the Factory app: a job, a repository, switches Plan first and Coder and reviewer on, Start. The plan lands on the iPhone as a notification: Approve. The task starts only after the tap | Plan first: spec mode writes the plan, it is an approval on your phone. Nothing runs until Approve. Real Droid plan. iOS simulator: the notice the box builds, not a push received over the air | "Droid plans first, and the plan lands on my phone. Nothing runs until I approve." | Plan-first approval (features: merged da08615; live "Droid planned first in spec mode") |
| 5 | 0:47 to 0:58 | T-FA-01 continued: the finished task window: steps from the log, the diff of one file, the reviewer's line "VERDICT: APPROVE", done, $0.12 of a $1.00 budget, 47,742 Factory credits. Then T-FA-02: the Factory app's two cards, approved (done) and denied (failed, nothing changed) | A coder droid with edit tools made the change; a reviewer droid with read-only tools checked the diff. Every tool call is a log step. $0.12, priced from the token counts Droid reports. Denied plan: nothing changed | "Then a coder makes the change, and a read-only reviewer droid checks the diff. Every step is in the log, and the cost comes from Droid's own token counts." | Custom droids and the reviewer (features: merged da08615; "the reviewer can only read"); cost priced from tokens (`$0.5378` in the Oct 24 merge-gate run, `$0.12` in this run) |
| 6 | 0:58 to 1:08 | T-FA-04: the Factory app's Limits menu, low then medium; the task window "What it can reach" for a low task: no sites. Then the log with a Droid hook entry: a risky command (`git push`) paused as an approval on the phone. Card beside: "Hooks are a convenience; the OS limits are the boundary" | Autonomy low: the OS takes away the network and every spend asks. Medium: budget at most $1. Hooks log each tool result and pause rm -rf, git push, sudo, npm publish, curl to sh. A hijacked Droid could edit its hooks file; the OS limits still hold | "The OS enforces the autonomy level. Low takes the network away. Hooks log each step and pause risky commands." | Autonomy levels the OS enforces and Droid hooks (features: merged da08615; `core/hook.test.ts`); the limit is stated on the showcase page |
| 7 | 1:08 to 1:15 | A20 for one second (Personal: Keep), then G08 end card with the chips Server and Personal | GurtOS Server: Droid works while you are away. GurtOS Personal: a copy of your folder until you press Keep. Open source, Apache-2.0 | "Server keeps Droid working while I am away. Personal changes my folder only on Keep. Gurt O.S. is open source." | Editions; repo public Oct 24 |

**Cut list if long:** beat 3's T-FA-03 clip (keep the card), beat 5's second card, beat 7's A20.

## Narration (exact text for ElevenLabs)

Word count: 174 (target about 170 for 1:15).

```text
In August twenty twenty-five, malicious Nx packages started the AI tools already on developers' machines, with permission-skipping flags, and told them to hunt for keys. Wiz says it worked in hundreds of cases.

On Gurt O.S., Droid is its own Linux user, in its own copy of the files, and the proxy adds the key outside the task. In a real run, two hundred forty of two hundred forty samples held only a placeholder.

Tasks start from a schedule, a new file, a webhook, an ASI:One chat or a Jira label.

Droid plans first, and the plan lands on my phone. Nothing runs until I approve.

Then a coder makes the change, and a read-only reviewer droid checks the diff. Every step is in the log, and the cost comes from Droid's own token counts.

The OS enforces the autonomy level. Low takes the network away. Hooks log each step and pause risky commands.

Server keeps Droid working while I am away. Personal changes my folder only on Keep. Gurt O.S. is open source.
```

## Captures this video needs

Shared (see `capture.md`): A06, A20, G08. Its own animation cards: G-FA-1 (the Nx source card), G-FA-2 (the merge-gate
lines), G-FA-3 (the five triggers). Its own captures (T-FA-01 is also used by the Anthropic video):

| ID | What | Machine and state | Steps |
|---|---|---|---|
| T-FA-01 | The live path: start, plan on the phone, approve, coder and reviewer, the finished task | Clip box (Server) with a Factory key in the vault; the build Mac iOS simulator paired to it | Factory app: job "Fix add() so its test passes" (the `add(a, b) = a - b` repo), Plan first and Coder and reviewer on, Start. Record the plan notification on the iPhone, tap Approve, then the task window to Done. One take, note the date and the model id |
| T-FA-02 | The approved and the denied card | Same box | Run the job twice, deny the plan the second time; capture the Factory app's task list. The denied card is labelled "The plan you approved" by mistake (a known bug in the Limits list): crop it or fix the label first |
| T-FA-03 | A new file starts a Droid task | Same box, a watched folder set through `core/triggers.ts` | Drop a file into the folder; capture the task appearing on the box screen with Droid as its agent |
| T-FA-04 | Autonomy low and a hook pause | Same box, real Droid | Start one task at low autonomy and show What it can reach (no sites). Start another and give it a prompt that makes it run `git push` in a scratch repo; capture the paused approval on the phone and its log line. If the pause cannot be provoked in a take, show `core/hook.test.ts` passing and drop the phone shot |
| T-FA-S1 | Flight recorder replay of the T-FA-01 Droid task (slot: only once the flight recorder is merged) | Same box as T-FA-01 (Server, Factory key), on a build where the flight recorder is merged | After T-FA-01's task is done, open the flight recorder on it; step through it, hold on the plan approval and on a changed file, then press Keep. One take, note the date and the model id. Show only what the recorder lists |
| T-FA-S2 | The public link opening a throwaway GurtOS (slot: only once Try GurtOS live is merged) | A clean browser profile on any laptop, no sign-in, recorded only after Ben OKs the public address | Same take as T-AN-S3 in the Anthropic video: record once, use in both. The on-screen address stays `<live address>` until Ben OKs the real one |

## Check before render

- The incident wording follows the Factory page: Wiz (Aug 27, 2025) for the AI tools and the flags, the Nx advisory for the
  credentials posted to GitHub. Nothing stronger than "Wiz says it worked in hundreds of cases".
- Cost: $0.12 (47,742 credits) is this Oct 24 live run; the merge gate's $0.5378 is the $0.50 test spend plus the model.
  Say twelve cents in the voice. If $0.5378 is shown, label it "merge gate, Oct 24, includes $0.50 test spend".
- The hooks are a convenience; the on-screen card says so. Do not call them a security boundary.
- Triggers: say only what the ledger shows. Schedule, webhook and file are verified Oct 24; the Jira label ran live; ASI:One
  and the GitHub issue label are merged. The GitHub pull request path is not set up on every box, so no PR clip.
- The phone notification is a simulator image, footnoted. The Watch is not used here.
- The reviewer is read-only by tool list, not by trust; do not say it "cannot be fooled".

## Slots: standout features (use only once merged)

These beats stay out of the video until the feature is merged on main and its check passes. When one is ready, record its capture, add its line to `docs/video/slots.json`, generate its narration with `narration/say.py <script> --slots`, and rebuild: later beats move by themselves.

| Slot id | Feature | Goes after beat | Picture (the capture to record) | On-screen text | Narration | Seconds | Rubric it serves | What to cut to stay in length |
|---|---|---|---|---|---|---|---|---|
| `flight-recorder` | The flight recorder | Beat 5 (coder, read-only reviewer, every step in the log) | T-FA-S1: the flight recorder on T-FA-01's finished Droid task. Step through it, hold on the plan approval and a changed file, press Keep | Flight recorder: a Droid task, step by step · its files · its approvals · then Keep or Undo | You can replay a Droid task step by step, with its files and approvals. Then Keep or Undo. | 8.8 | Visible plans, steps and diffs; invisible actions score badly (beats 4 and 5) | Beat 5's last sentence "Every step is in the log, and the cost comes from Droid's own token counts." (about 6 s; the recorder shows the steps and the on-screen line keeps $0.12), and beat 7's "Personal changes my folder only on Keep." (about 3 s; the slot says Keep) |
| `try-live` | Try GurtOS live | Beat 6 (autonomy levels and hooks), just before beat 7's end card | T-FA-S2: a clean browser opens the public link and a throwaway Gurt O.S. loads; hold on its first screen (the same take as T-AN-S3) | Try it now: `<live address>` · a throwaway GurtOS in your browser | You can try a throwaway Gurt O.S. in your browser, at the link below. | 7.5 | Not a chatbot wrapper: a judge opens the real OS. Claim nothing about Droid inside the throwaway unless the take shows it | Beat 3's T-FA-03 clip (about 5 s; the five-trigger card already outlasts the one-sentence voice) and beat 7's A20 second (1 s) |

Length: target 1:15. Every slot in adds about 16.3 s and the cuts above take out about 15 s, so the video runs about 1:16. Cut sizes are estimates from each beat's window; the build's length check has the final say.

### Slot narration

#### flight-recorder

```text
You can replay a Droid task step by step, with its files and approvals. Then Keep or Undo.
```

#### try-live

```text
You can try a throwaway Gurt O.S. in your browser, at the link below.
```
