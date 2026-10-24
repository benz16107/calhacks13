---
title: Tasks
description: A task is one piece of agent work with its own prompt, files, tools, network hosts and budget. Learn its fields, its states and how it ends.
---

A task is one piece of agent work. Everything GurtOS does for an agent happens inside a task, and everything a task does is in the action log.

## What a task is made of

You start a task with a spec. Every field except the title and the prompt has a safe default.

| Field | What it means | Default |
|---|---|---|
| `title` | A short name for the portal and the log | Required |
| `prompt` | What the worker should do | Required |
| `workspace` | The folder the task works on. It gets its own copy. | `home` |
| `worker` | `droid` (Factory's Droid with Claude) or `fake` (scripted, for tests) | `droid` |
| `tools` | Tool names the task may call through its broker | None |
| `hosts` | Host names the task's network may reach | None |
| `budgetCents` | Spending above this, in US cents, pauses the task for an OK | `0` |
| `source` | Who started it, such as `portal`, `schedule` or `jira:BOX-12` | `api` |

The defaults are deliberate. A task with no `tools`, no `hosts` and a budget of zero can read and change its own copy of the files and nothing else. Every extra power is something you list.

On GurtOS Personal, `POST /api/tasks` also takes `folder`, an absolute path to one of your own folders, instead of `workspace`. See [give an agent a folder](/guides/keep-or-undo/).

```json
{
  "title": "Fix the failing test",
  "prompt": "Run the tests in this repo and fix the one that fails.",
  "workspace": "project",
  "hosts": ["registry.npmjs.org"],
  "budgetCents": 25
}
```

The core checks the spec before it starts anything. An unknown workspace, an unknown worker or a tool that no app provides is an error, and no task is created.

## What the box adds

When the task starts, the core fills in the rest:

- `id`, a short id made from the time and four random hex digits, such as `tk3m9qz1a2f`.
- `user`, the Linux user the task runs as: `box-<id>`.
- `layers`, the finished tasks whose changes this task saw when it started, newest first.
- `costCents`, everything the task has spent so far: tool spending plus model cost.
- `step`, the latest thing the worker reported, for a one-line "doing now".
- `error`, set when the task fails. Droid's final message is not a field: it is the task's last step in the log.

## States

A task is always in one of six states.

| State | Meaning |
|---|---|
| `queued` | Created, not started yet |
| `running` | The worker is working |
| `waiting` | Paused until someone answers an approval |
| `done` | Finished. Its file changes are part of the workspace. |
| `failed` | Stopped with an error. Its file changes are not applied. |
| `undone` | Removed. Its file changes are gone, and other tasks keep theirs. |

Only these moves are allowed:

```text
queued  -> running, failed, undone
running -> waiting, done, failed, undone
waiting -> running, done, failed, undone
done    -> undone
failed  -> undone
undone  -> (nothing)
```

Anything that is not already undone can be undone. Undo is final: an undone task cannot come back.

## How a task ends

The worker is a process. When it exits with code 0, the task is `done`. Any other exit makes it `failed`, with the error `worker exited with <code>`. If the core cannot start the worker at all, for example because the vault has no `FACTORY_API_KEY` for a Droid task, the task fails with that reason.

When a task ends in any way, the core does the same cleanup:

1. It closes any approval still pending for the task, as denied, so nothing waits on a task that has stopped.
2. It closes the task's broker socket.
3. It stops every process the task's user still runs and unmounts the task's copy.
4. It removes the task's Linux user.
5. If the task is done or undone, it rebuilds the workspace's view.

A failed task's changes stay in its own layer, out of the workspace. You can read them with `GET /api/tasks/<id>/diff`, but no later task sees them.

## What you can see

Every task has the same three views, which the portal shows as its task window:

- `GET /api/tasks/<id>` returns the task, its approvals and its whole action log: every step, tool call, result, cost and blocked connection, in order.
- `GET /api/tasks/<id>/diff` returns what the task added, modified or deleted, and a unified diff.
- `POST /api/tasks/<id>/undo` undoes it.

![A task window with its steps from the action log, the files it changed, and an Undo button](../../../assets/screens/box-task-detail.png)

*A task window, from the portal's design. The task tried four things it was not allowed to do, and each is a red line in its log. Names and times are examples.*

## Who starts tasks

Anything that can reach the API can start a task with `POST /api/tasks`. Apps can also start tasks from inside the core with `box.createTask()`: on a schedule, from a webhook, when a file arrives, or from a chat. The task's `source` records which. See [triggers](/concepts/triggers/).

Tasks run side by side. One task waiting for an OK, failing or being undone does not stop any other.

## Related

- [Agents as their own users](/concepts/agent-users/)
- [Workspaces and layers](/concepts/workspaces-and-layers/)
- [Your first task](/get-started/first-task/)
- [HTTP API](/reference/http-api/)
