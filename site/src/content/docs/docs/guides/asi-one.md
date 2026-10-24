---
title: Reach GurtOS from ASI:One
description: Make the box an agent on Agentverse so you can give it work from an ASI:One chat, approve spending with cards, and keep or undo the result.
---

The ASI:One app makes the box a chat agent on Agentverse. You find it in ASI:One, pair once, then ask for work in plain words. The box starts a task, and the chat gets the progress, an **Approve** or **Deny** card when the task wants to spend past its budget, and the result with **Keep** and **Undo**. In this guide you turn the agent on and pair your chat with the box.

## Before you start

- A box with a root shell and the ASI:One app installed (it ships with GurtOS, in `tracks/fetch/`).
- An Agentverse account and an ASI:One account.
- Outbound internet from the box. The agent reads an Agentverse mailbox, so the box needs no open port.

## Steps

1. **Add the keys to the vault.** See [Add a secret](/docs/guides/add-a-secret/).

   | Key | Where to get it | For |
   |---|---|---|
   | `AGENTVERSE_API_KEY` | agentverse.ai: Profile, API Keys | The agent's mailbox |
   | `ASI_ONE_API_KEY` | asi1.ai: Developer, API Keys | Sorting messages with ASI:One's model |
   | `ANTHROPIC_API_KEY` or `FACTORY_API_KEY` | console.anthropic.com or app.factory.ai | Droid, the worker in each task. One is enough. |
   | `APIFY_TOKEN` | apify.com: Settings, API & Integrations | Optional: web searches |

   Restart the box service after editing the vault.

2. **Turn the agent on.**

   ```sh
   curl -X POST http://127.0.0.1:7700/t/fetch/agent -H 'content-type: application/json' -d '{"on": true}'
   ```

   The first time, this installs the uAgents library into `/opt/box-fetch/venv`, which takes about 30 seconds. The agent stays on across restarts. Send `{"on": false}` to turn it off.

3. **Get the agent's address and pairing code.** Open the app's page on the box, `http://127.0.0.1:7700/t/fetch/`, or **ASI:One** in the portal. It shows the agent's address and a six-digit code. Each box is its own agent: its address comes from a seed it makes on first start, kept root-only in `/var/lib/box/fetch/seed`.

4. **Pair your chat.** In ASI:One, find the agent by its address, open a chat, and send:

   ```text
   pair 123456
   ```

   The box answers "Paired. This box now takes work from you here." A code works once.

5. **Ask for work.** For example: "Fix the failing test in my project." The box starts a Droid task in its own copy of a workspace, with no network of its own and a 25 cent budget.

6. **Answer cards.** If the task wants to spend more than its budget, the chat gets a card:

   ```text
   Paused for your OK: Spend $0.50 on apify.run? Budget $0.25, spent $0.00.
   ```

   Click **Approve** or **Deny**. The same request is on the portal and any paired phone. The first answer wins, and the log records an answer from the chat as `asi1`.

7. **Keep or undo the result.** When the task finishes, the chat gets its summary, the changed files, the diff, and **Keep** and **Undo**. Undo takes out that one task's changes. Other tasks keep theirs.

At any time, send `status` for your latest tasks with their state and cost, or `undo` to take back the last one.

## Check it worked

- `GET /t/fetch/agent` reports the agent as on.
- After pairing, a request in the chat creates a task you can see in **Tasks** in the portal, with source `asi1`.
- If the agent process stops, the box starts it again within 5 seconds.

## How it stays safe

- Only paired owners can give work or answer cards. Anyone else gets only the pairing step. The box takes at most ten wrong codes a minute from everyone together.
- The agent runs as the unprivileged user `nobody`. It uses the box's HTTP API, the same one the portal uses, and cannot read the vault or the workspaces.
- Tasks hold no keys and have no network of their own. Web work goes through box tools that run inside the box service.
- Replies wait in an outbox on disk until they are sent, so a restart or a power cut does not lose them.

## Limits

- A card click relayed through ASI:One's planner arrives in the planner's words, without the selection. The box applies it to the last card in that chat session.
- An approval whose id contains spaces (Droid's own questions) cannot be answered through the HTTP API, because the box does not decode ids in paths. The app answers those through SpacetimeDB instead.
- One agent per box. Two boxes with the same seed would share one mailbox.
- Strangers are refused. A guest mode, where you approve a stranger's request, is not built.
- The ASI:One Payment Protocol is not supported.

## Related

- [Approvals and budgets](/docs/concepts/approvals-and-budgets/)
- [Undo a task](/docs/guides/undo-a-task/)
- [Triggers](/docs/concepts/triggers/)
- [HTTP API](/docs/reference/http-api/)
