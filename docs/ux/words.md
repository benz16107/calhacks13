# Words GurtOS uses

One word for each thing, on every screen: the box screen, the portal, the phone app, GurtOS Personal, the docs and
the API messages people read. Code names stay as they are (`box.service`, `BOX_*`, `/api/approvals`). When a word
here and a screen disagree, the screen changes.

| Thing | Say | Don't say |
|---|---|---|
| The product | **GurtOS** | the box, the system, the OS (in sentences) |
| The editions | **GurtOS Server**, **GurtOS Personal**, **GurtOS Business** | Server edition, the server box |
| The machine GurtOS runs on | its name ("Home box", "Fogline Supply", "Ben's laptop"), otherwise **this computer** / **a computer** | box, machine, device, host |
| Several of them, in the phone app | **Computers**, **Add a computer**, **Switch computer** | Machines, boxes |
| The phone or laptop that pairs with it | **phone**, or **device** when it may be a laptop | client, token |
| A piece of agent work | **task** | job, run, request, work item |
| What starts one | **New task** (button), "Start" (in the dialog) | Ask the box, Ask an Agent, Run |
| The thing that waits for a person | **request** ("Deploy build 214?") | approval (as a noun), prompt, ask |
| Where requests wait | **Needs you** ("1 needs you", "3 need you") | Needs your OK, pending, waiting for approval |
| Answering one | **Approve** / **Deny** (with the amount when there is one: "Approve $40")| Allow, OK, Accept, Reject |
| A finished Personal task's changes | **Keep** ("Keep changes", then "Kept") | Apply, Accept, Merge, Save |
| Reversing a task, before or after Keep | **Undo** ("Undo task", then "Undone"). After Keep it puts the files back | Put back, Roll back, Revert, Go back, Take out |
| Every task's record | **Activity** (the app), **the action log** (in sentences) | events, journal, audit trail (outside Business) |
| Business's record | **Audit** | |
| Stopping every agent | **Pause all agents** (button), **Kill switch** (its name in Business) | Stop, Halt, Panic |
| What an agent is | **agent** | worker, droid (outside model settings), bot |
| The model | **Claude** ("Agents use Claude") | Droid with Claude, the worker, the LLM |
| A secret | **key** ("Anthropic API key"); the variable name only as a small caption | token, secret, credential; `ANTHROPIC_API_KEY` as a title |
| Where keys live | "GurtOS keeps keys where agents can't read them. You can replace a key but never see it." | the vault, root-only file |
| Something an agent was stopped from doing | **blocked** ("2 attempts blocked") | denied, refused, prevented |
| Test money | **test money** on every amount that isn't real | sandbox funds, devnet funds (alone) |

## Writing rules

- Plain words and short sentences. No em dashes.
- Say what happened, then what to do: "Anthropic didn't accept this key. Check it and try again."
- Never show raw JSON, hashes, ids, Linux user names or `worker exited with 1: Error:` on a main screen. Put them
  behind "Technical details".
- Counts agree everywhere: the top bar, the badge, the popover and the list count the same things.
- Times in the person's time zone, as on the clock.
- Don't say a feature is "not built yet". Hide it until it works.
