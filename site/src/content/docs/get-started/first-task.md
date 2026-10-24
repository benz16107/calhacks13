---
title: Your first task
description: A tutorial. Give an agent a small job, watch its steps, read its diff, undo it, then see a blocked connection and a pause for your OK.
---

In this tutorial you give an agent a small job on a file, follow what it does, and take its work back. Then you
watch GurtOS stop a connection the task was not allowed to make, and approve a test payment. It takes about
15 minutes.

You need a running box with a model key in its vault: `ANTHROPIC_API_KEY` or `FACTORY_API_KEY`. If you do not have one yet, follow
[Install on Ubuntu](/get-started/install-on-ubuntu/). Run the commands on the box itself, or through an SSH
session with the box's port forwarded.

## 1. Put a file in a workspace

Every task works on a workspace, a folder in `/var/lib/box/workspaces`. The box always has one called `home`.
Add a short note with a few spelling mistakes:

```sh
sudo tee /var/lib/box/workspaces/home/notes.md >/dev/null <<'EOF'
# Weekend plan

- Pick up the groceries on Saturday morining.
- Call the plumer about the kitchen tap.
- Finish the garden fence befor it rains.
EOF
sudo chmod a+rw /var/lib/box/workspaces/home/notes.md
```

Task users must be able to read and change files through their own copies, which is why the file is made
writable by all. Only root can open the `workspaces` folder itself, so no task can reach this file directly.

## 2. Start a task

Ask the box's API for a task. Give it a title, a prompt in plain words, and a budget in US cents:

```sh
curl -s 127.0.0.1:7700/api/tasks -H 'content-type: application/json' -d '{
  "title": "Fix the spelling in notes.md",
  "prompt": "Fix the spelling mistakes in notes.md. Change nothing else.",
  "budgetCents": 25
}'
```

The answer is the new task. Copy its `id`:

```json
{"title":"Fix the spelling in notes.md","workspace":"home","worker":"droid","tools":[],"hosts":[],
 "budgetCents":25,"source":"api","id":"t3k9x2a1b2","state":"running","user":"box-t3k9x2a1b2", "...": "..."}
```

```sh
id=t3k9x2a1b2   # use your own task's id
```

GurtOS has created a Linux user, `box-t3k9x2a1b2`, and a copy of the `home` workspace that only that user can open.
Droid is working in that copy. The task has no tools and no hosts, so it can reach nothing but its model.

## 3. Watch it work

Follow the task's action log as it happens:

```sh
curl -sN "127.0.0.1:7700/api/log/stream?task=$id"
```

Each event arrives as an `id:` line with its sequence number and a `data:` line of JSON: the task starting, each
step Droid reports, the model's cost. Press `Ctrl+C` when you see a `task.state` event with `"state":"done"`.

You can also open the portal at `http://127.0.0.1:7700/` and choose **Tasks**. The task shows what it is doing
now and its cost against its budget.

## 4. Read what it changed

```sh
curl -s 127.0.0.1:7700/api/tasks/$id/diff
```

```json
{"changes":[{"path":"notes.md","change":"modified"}],
 "diff":"--- a/notes.md\n+++ b/notes.md\n@@ -1,5 +1,5 @@\n # Weekend plan\n \n-- Pick up the groceries on Saturday morining.\n+- Pick up the groceries on Saturday morning.\n..."}
```

The task's change is now part of the workspace's view, the read-only folder that shows the base files plus every
finished task:

```sh
sudo cat /var/lib/box/views/home/notes.md       # fixed
sudo cat /var/lib/box/workspaces/home/notes.md  # still has the mistakes: base files are never written
```

## 5. Undo it

```sh
curl -s -X POST 127.0.0.1:7700/api/tasks/$id/undo
sudo cat /var/lib/box/views/home/notes.md       # the mistakes are back
```

The task is now `undone`. GurtOS took its layer out of the workspace. If other tasks had changed other files in
`home` in the meantime, their changes would still be there. In the portal, **Time Machine** shows the same thing
as a stack of layers. See [Workspaces and layers](/concepts/workspaces-and-layers/).

## 6. See a connection blocked

Start a task that needs a website it has not been given:

```sh
curl -s 127.0.0.1:7700/api/tasks -H 'content-type: application/json' -d '{
  "title": "Save the title of example.com",
  "prompt": "Fetch https://example.com and write its page title to title.txt."
}'
```

The task's `hosts` list is empty, so the box's proxy refuses the connection. Droid reports that it could not
reach the site. The refusal is in the log:

```sh
curl -s "127.0.0.1:7700/api/log?task=<the new id>" | grep -o '"type":"net.blocked"[^}]*'
```

```text
"type":"net.blocked","task":"t3k9x2c7d8","host":"example.com:443"
```

Run it again with `"hosts": ["example.com"]` and it succeeds. See [Network policy](/concepts/network-policy/).

## 7. Approve a payment

Tools can cost money, and a task that would go over its budget waits for you. The `example` app that ships with
GurtOS has a tool, `example.spend`, that spends **test money**: it records a payment and moves nothing.

```sh
curl -s 127.0.0.1:7700/api/tasks -H 'content-type: application/json' -d '{
  "title": "Buy a test item",
  "prompt": "Use the example.spend tool to spend 300 cents on a test item, then write the receipt to receipt.txt.",
  "tools": ["example.spend"],
  "budgetCents": 100
}'
```

The tool costs 300 cents and the budget is 100, so the task stops in the `waiting` state. Find the request:

```sh
curl -s "127.0.0.1:7700/api/approvals?state=pending"
```

```json
[{"id":"t3k9x2e5f6.budget.example.spend:1f0c...","task":"t3k9x2e5f6",
  "question":"Spend $3.00 to Test Vendor on example.spend (test spend on a test item)? Budget $1.00, spent $0.00.",
  "costCents":300,"payee":"Test Vendor","purpose":"test spend on a test item","state":"pending"}]
```

Approve it. Quote the id, because it can contain characters your shell treats specially:

```sh
curl -s -X POST "127.0.0.1:7700/api/approvals/<the approval id>" \
  -H 'content-type: application/json' -d '{"approved": true, "by": "tutorial"}'
```

The task runs again, the tool runs once, and the receipt lands in the task's copy. Its cost is now $3.00 plus
the model's cost. The first answer wins: if your phone had answered first, this call would have changed nothing.
See [Approvals and budgets](/concepts/approvals-and-budgets/).

:::tip[No model key yet?]
You can try steps 2 to 5 without a model key. Add `"worker": "fake"` to the task. The test worker reads its
prompt as a script, one command per line, for example `write hello.txt hi`. It exists for tests and makes no
model calls.
:::

## What you did

- Ran an agent as its own Linux user, in its own copy of a workspace.
- Followed its action log live, and read its diff.
- Undid one task without touching the base files.
- Watched the proxy refuse a host the task was not given.
- Approved a spend over budget, with test money.

## Next

- [Approve from your phone](/guides/approve-from-your-phone/)
- [Schedule a routine](/guides/schedule-a-routine/)
- [Tasks](/concepts/tasks/)
- [HTTP API](/reference/http-api/)
