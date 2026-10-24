---
title: Send the log to Elastic
description: Stream the box's action log into Elasticsearch Serverless and ask an Agent Builder agent what your agents changed, spent and were blocked from.
---

The Elastic app streams every event in the box's action log into an Elasticsearch Serverless index, `box-actions`. It also installs an Elastic Agent Builder agent, **Box log**, that answers questions about that index in plain words. In this guide you connect a box to Elastic, install the agent and ask it a question.

## Before you start

- A box with a root shell and the Elastic app installed (it ships with GurtOS, in `tracks/elastic/`).
- An Elasticsearch Serverless project, with its Elasticsearch URL and Kibana URL.
- An Elastic API key that can write to the `box-actions` index and manage Agent Builder tools and agents.
- Node 22 or newer on the machine you install the agent from. That can be the box or your own computer.

## Steps

1. **Add the keys to the box's vault.** See [Add a secret](/guides/add-a-secret/).

   ```ini
   ELASTIC_URL=https://your-project.es.example.elastic.cloud
   KIBANA_URL=https://your-project.kb.example.elastic.cloud
   ELASTIC_API_KEY=your-elastic-api-key
   ```

   Restart the box service. The app starts sending at once. On its first run it sends the whole log from the start.

2. **Install the agent and its tools.** From a checkout, with the same three values in your environment:

   ```sh
   export ELASTIC_URL=https://your-project.es.example.elastic.cloud
   export KIBANA_URL=https://your-project.kb.example.elastic.cloud
   export ELASTIC_API_KEY=your-elastic-api-key
   node tracks/elastic/agent.ts install
   ```

   This creates or updates the seven tools and the agent through Kibana's Agent Builder API. It is safe to run again: the agent in Kibana always matches the code.

3. **Ask a question.** In Kibana, open **Agents > Box log**. Or from the command line:

   ```sh
   node tracks/elastic/agent.ts ask "What got blocked this week, and from where?"
   ```

   The answer ends with the tools the agent called.

## Check it worked

- In Kibana, `box-actions` has one document per log event. The count matches the box's log.
- The agent answers "What did my agents change this week?" with the files each done task changed, and lists undone and failed tasks apart.

The box's test suite checks this app offline. `DEMO_LIVE=elastic ./demo` also ships a run to Elastic and asks four questions.

## How it works

1. A log reader gets every event in order, from the start, and resumes after a restart. It turns each event into one flat document and appends it to an outbox file, `/var/lib/box/elastic/outbox.ndjson`, synced to disk.
2. A flusher sends the outbox to Elastic with `_bulk`, up to 4 MB per request, and remembers how far it got. If Elastic is down, it retries every 5 seconds from where it stopped.
3. Each document's id is built from the box, the run and the event's line number, so a resend overwrites itself and nothing is counted twice.
4. Only the `elastic.bulk` model job reads `ELASTIC_URL` and `ELASTIC_API_KEY`, inside the box service. Tasks never see the key. The log reader has no vault access at all.

With no Elastic keys in the vault, the outbox keeps everything until you add them.

## What a document holds

Each document stands on its own, so a question needs no joins.

| Field | Holds |
|---|---|
| `@timestamp`, `event.seq`, `event.type` | When, the line number in the log, and the kind of event |
| `message` | One plain sentence about the event |
| `task.id`, `task.title`, `task.source`, `task.hosts`, `task.budget_cents` | Copied onto every event of a task |
| `app` | The app that started the task |
| `task.state`, `error`, `summary` | On state changes |
| `files.added`, `files.modified`, `files.deleted` | On done events, from the box's diff |
| `cost_cents`, `cost.model`, `cost.tokens.*` | What the event spent: model tokens or a paid tool call |
| `tool.name`, `tool.ok`, `tool.error` | Tool calls and their results |
| `approval.question`, `approval.state`, `approval.by` | Requests for an OK and who answered |
| `net.host` | A connection the box refused |
| `box.name`, `box.run` | Which box the event came from |

## The agent's tools

| Tool | Answers |
|---|---|
| `box.changes` | Tasks done, undone or failed, with the files each done task changed |
| `box.costs_by_app` | Dollars per app: total, model, tools, number of tasks |
| `box.costs_by_task` | Dollars per task, with the paid tools it used |
| `box.failures` | Failed tasks and the error the box recorded |
| `box.task_timeline` | Everything one task did, in order |
| `box.blocked` | Refused hosts by task and app, with counts and allowed hosts |
| `box.search` | Free text over the log |

The first six are ES|QL tools. Those that take `days` default to 7. `box.search` is an index search tool.

## Limits

- The box records a failed task's error as "worker exited with N". The agent reads the task's timeline to find the cause, which usually works but is not exact.
- `tool.result` events carry no tool name, so the reader takes it from the `tool.call` before it. A restart between the two loses the name on that one result. The cost and the task are still right.

## Related

- [The action log](/concepts/action-log/)
- [Log events](/reference/log-events/)
- [Cost](/concepts/cost/)
- [Live updates](/reference/live-updates/)
