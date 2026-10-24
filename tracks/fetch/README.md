# Fetch.ai track: chat with your box in ASI:One

![tag:innovationlab](https://img.shields.io/badge/innovationlab-3D8BD3)
![tag:hackathon](https://img.shields.io/badge/hackathon-5F43F1)

The box is an always-on computer where AI agents work safely. This track makes the box an agent on
[Agentverse](https://agentverse.ai), so you can find it in [ASI:One](https://asi1.ai) and give it work from a
chat. You say "fix the failing test in my project" or "check if the Hario V60 filters are back in stock". The
box starts a task. Droid, Factory's coding agent running Claude, does the work inside the box's limits. The
chat gets the progress, an Approve or Deny card when the task wants to spend more than its budget, and the
result or the diff, with a card to undo it.

## The agents

| Name | Address | What it is |
|---|---|---|
| `box` | `agent1qvuk46tnt9lnscher0pawl7pr5y525mak66ptwsrvg4kff0pfy9m2sy0us6` | The box installed on our always-on test machine. This is the one to chat with. |
| `box-test` | `agent1qdcex5gzkjnl08fc6wswejxv9h7swvfnewk35fyntrklthx57sv3jkzxz3u` | A twin that the live demo step (`DEMO_LIVE=fetch ./demo`) starts and stops on a test machine. |

Both are mailbox agents with the Agent Chat Protocol. Every box is its own agent: its address comes from a seed
it makes the first time it starts, kept root-only in `/var/lib/box/fetch/seed`.

## A chat, start to finish

These replies are from a live run through ASI:One (shortened).

1. **Pair once.** The box's ASI:One page (`http://<box>:7700/t/fetch/`) shows a six-digit code. Send
   `pair 123456` with it. The box answers "Paired. This box now takes work from you here." Anyone else gets only the
   pairing step: they cannot start, approve or undo anything.
2. **Ask for work.** "Fix the failing test in my project." The box starts a Droid task in its own copy of the
   `project` workspace, a small sample repo whose bill-splitting function loses a cent. The task has no
   network of its own and a 25 cent budget.
3. **The result comes back to the chat:** "Done: Fix the failing test in my project. ($0.05)", Droid's summary,
   the changed files, the diff, and a card with **Keep** and **Undo**. Undo takes that one task's changes out,
   and other tasks keep theirs.
4. **A pause for your OK.** "Check if the Hario V60 paper filters (size 02, 100 count) are back in stock."
   Droid searches the web through the box's Apify tool. A search counts $0.50, more than the budget, so the
   task stops and the chat gets an Interactive Card: "Paused for your OK: Spend $0.50 on apify.run? Budget
   $0.25, spent $0.00." with **Approve** and **Deny**. The same request is on the box's portal and phone; the
   first answer wins. After Approve: "Done: Check if the Hario V60 paper filters... ($0.57). The size 02
   filters (100 count) are in stock on Hario's US store at $10.25..."
5. **Any time:** "status" lists your latest tasks with their state and cost. "undo" takes back the last one.

The whole flow happens in the ASI:One chat. The portal is not needed.

## How it works

```
ASI:One chat ──► Agentverse mailbox ◄── agent.py on the box (uAgents, Agent Chat Protocol)
                                            │
                                         brain.py ──► the box's API (127.0.0.1:7700)
                                                          │
                                                 task: Droid with Claude, its own Linux user,
                                                 its own copy of the files, no keys, no network
                                                          │
                                                 box tools in the core (Apify, with the vault's token)
```

- **`agent.py`** is the uAgent. It speaks the Agent Chat Protocol (`ChatMessage`, `ChatAcknowledgement`) and
  publishes its manifest. It takes messages from an Agentverse mailbox, so the box needs no open port. At
  start it connects the mailbox with `AGENTVERSE_API_KEY`, the same call the Agentverse inspector's Connect
  button makes. It sends cards as `MetadataContent` in the
  [ASI:One Interactive Cards](https://innovationlab.fetch.ai/resources/docs/interactive-cards/asi-interactive-cards)
  format (`card_kind: "review"`).
- **`brain.py`** decides what each message does. It uses only the box's HTTP API, the one the portal and the
  phone use, so the chat agent has no powers the portal does not. It follows each chat task through the
  box's action log and writes the replies.
- **ASI:One's own model** (`asi1-mini`) sorts each message: a check on earlier work ("Status check: how is the
  fix going?"), or new work. ASI:One's planner sends such checks while it waits, and they must not start new
  tasks. A keyword rule takes over if ASI:One does not answer.
- **`track.ts`** plugs into the box. At boot it makes the `project` workspace and starts the agent if it was
  on. It reads `AGENTVERSE_API_KEY` and `ASI_ONE_API_KEY` from the vault (the track's `secrets`) and starts
  `agent.py` with them, as the unprivileged user `nobody`, and restarts it if it stops.

### Talking to ASI:One's planner

ASI:One's planner sends the agent a message and uses its first reply. The box replies within 40 seconds with
the result, an approval card, or "still working" and the latest step. A later "status check" from the planner
gets the task's next news. A card click comes back as JSON in a direct chat, or in the planner's own words
("The user approved the card interaction..."). Then it applies to the last card shown in that chat session.
After a click, the task's next messages go to the chat the click came from.

### Reliability

- Replies wait in an outbox in `/var/lib/box/fetch/agent/state.json` until they are sent. A reply that fails to
  send is tried again. After a restart or a power cut, the agent picks up from the action log where it stopped.
- The box's tasks resume after a power cut too (moment 4), and the chat gets their results.
- If the agent process dies, the box starts it again within 5 seconds.

### Safety

- Only paired owners give work, and only they can answer cards. A code works once, and the box takes at most
  ten wrong codes a minute from everyone together.
- The agent runs as `nobody`. It can use the box's API, but cannot read the vault or the workspaces.
- Tasks hold no keys and have no network of their own. Web work goes through box tools that run in the core.
- Any spending above the task's 25 cent budget waits for the owner's OK.

## Real tool use

- **Droid with Claude** reads the repo, runs the tests (`node --test`), edits the code and checks the fix,
  as its own Linux user in its own copy of the workspace.
- **Apify:** the Actor [`apify/rag-web-browser`](https://apify.com/apify/rag-web-browser) searches the web and
  reads the pages, through the box's `apify.run` tool (see `tracks/apify`). The token stays in the vault.
- **The box itself:** approvals, undo, the action log and the cost of each task.

## Run it

You need a box: Ubuntu 24.04 with the core installed (`sudo core/install.sh`, see `core/README.md`). Put these
keys in `/etc/box/vault.env` (root only, `chmod 600`):

| Key | Where to get it | For |
|---|---|---|
| `AGENTVERSE_API_KEY` | [agentverse.ai](https://agentverse.ai), Profile, API Keys | the mailbox |
| `ASI_ONE_API_KEY` | [asi1.ai](https://asi1.ai), Developer, API Keys | sorting messages |
| `FACTORY_API_KEY` | [factory.ai](https://factory.ai) | Droid |
| `APIFY_TOKEN` | [apify.com](https://apify.com), Settings, API & Integrations | web work (optional) |

Then, on the box:

```sh
curl -X POST http://127.0.0.1:7700/t/fetch/agent -H 'content-type: application/json' -d '{"on": true}'
```

The first time, this installs uAgents into `/opt/box-fetch/venv` (`setup.sh`, about 30 seconds). The agent then
stays on across restarts. `{"on": false}` turns it off. Open `http://127.0.0.1:7700/t/fetch/` for the agent's
address and the pairing code. In ASI:One, find the agent by its address or by "box", open a chat, send
`pair <code>`, then ask for work.

## The demo step

`./demo` runs `demo.ts` offline in a few seconds. `brain.py` talks over stdin and stdout instead of Agentverse,
and the fake worker stands in for Droid. It checks that:

- the track made the `project` workspace with its failing test,
- a stranger gets only the pairing step, a wrong code is refused, and the right one pairs,
- a chat task has no network and a 25 cent budget, and spending $3.00 of test money (the example track's
  `example.spend`, no real payment) sends a review card with Approve and Deny,
- a stranger sending the same click approves nothing; the owner's click approves it, logged as `asi1`,
- the result carries the diff, and its Undo button undoes the task,
- killed while waiting, the chat agent restarts and still reports the OK from the phone and the result,
- a click relayed in the planner's words answers the chat's last card,
- "status" lists the tasks.

`DEMO_LIVE=fetch ./demo` also runs the real thing with the `box-test` agent: the Agentverse mailbox, ASI:One's
planner through its API (`planner_mode` with `agents: [address]`), pairing, a Droid task that fixes the test,
and the stock check with its card and an Approve. It takes about five minutes and costs about 15 cents of
model use. The box counts each Apify search at its $0.50 cap, the most it can cost.

## Live and simulated

- **Live:** the agents on Agentverse, the chat through ASI:One, Droid with Claude, the web search through Apify,
  and ASI:One's model sorting messages.
- **Simulated, offline step only:** ASI:One and Agentverse (stdin and stdout instead), the worker (the fake
  one), and the $3.00 spend, which is test money.

## Limits

- A card click through ASI:One's planner arrives in the planner's words, without the selection, so the box
  applies it to the last card in that chat session.
- Droid may search the web more than once, and each search above the budget asks again.
- To reply into a chat session from a timer, `agent.py` sets a private uAgents field (`ctx._session`).
  uAgents is pinned to 0.26.1 for that reason.
- The box's API does not decode ids in its paths, so an approval whose id has spaces (Droid's own questions)
  is answered through SpacetimeDB instead, the way the phone does.
- One agent per box. Two boxes with the same seed would split one mailbox.
- Strangers are refused. A guest mode, where the owner approves a stranger's request, is not built.

## Fetch.ai requirements

| Requirement | Where |
|---|---|
| An agent on Agentverse | `box` and `box-test`, above |
| Agent Chat Protocol | `agent.py` |
| The main flow inside an ASI:One chat | pairing, requests, approvals, results and undo, all in the chat |
| Real tool use | Droid edits and tests code; Apify searches the web |
| Public repo with run steps | "Run it", above |
| README with agent names, addresses and badges | this file and `agent.md`, the agent's Agentverse profile |
| 3 to 5 minute video | to come |
| ASI:One Interactive Cards (bonus) | review cards for approvals, and Keep or Undo for results |
| Reliability (bonus) | the outbox, restarts, status checks, and the keyword fallback |
| Multi-agent (bonus) | ASI:One's planner works with the box's agent, and each task on the box is its own Droid agent. The box does not message other Agentverse agents yet. |

The Payment Protocol is left out on purpose.
