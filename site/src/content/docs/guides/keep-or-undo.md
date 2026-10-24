---
title: Give an agent a folder, then keep or undo
description: In GurtOS Personal, ask an agent to work on a copy of one of your folders, review what it changed, then Keep to apply it or Undo to discard it.
sidebar:
  badge:
    text: Preview
    variant: note
---

In GurtOS Personal, agents work beside you on your own computer. In this guide you hand an agent one of your
folders, let it work on a copy, and then decide what happens to its changes. **Keep** applies them to your real
folder. **Undo** throws them away. Your folder is not touched until you choose.

:::note[Preview]
The core supports this today through its API. The desktop pieces (**Ask an agent** in Files, notifications, and the
review window) are in development and not released, so their names may change. The steps below show both.
:::

## Before you start

- A computer with the GurtOS service installed and your account set as the owner (`BOX_OWNER=<your user name>` in
  the service's environment). See [Install GurtOS Personal](/get-started/install-personal/).
- `FACTORY_API_KEY` in the vault.
- A folder for the agent, for example `/home/you/Documents/receipts`.

## With the desktop (in development)

1. In Files, right-click the folder and choose **Ask an agent**.
2. Describe the work, for example "Rename the scanned receipts by date and vendor, and list any that are missing a
   total." Set a budget. Spending above it pauses the task until you approve it.
3. Start the task. The agent runs as its own Linux user, without `sudo`, on a copy of the folder. A top-bar
   indicator shows running tasks and how many need you. Requests for your OK arrive as notifications with
   **Approve** and **Deny**.
4. When the task finishes, the review window lists every file it added, changed or deleted, with the diff.
5. Choose **Keep** or **Undo**.

## With the API (works today)

1. **Start a task on the folder.** Pass `folder` instead of `workspace`:

   ```sh
   curl -s 127.0.0.1:7700/api/tasks -H 'content-type: application/json' -d '{
     "title": "Tidy the receipts",
     "prompt": "Rename each scanned receipt to YYYY-MM-DD-vendor.pdf and write missing.txt listing any without a total.",
     "folder": "/home/you/Documents/receipts",
     "budgetCents": 50
   }'
   ```

   The box links the folder as a workspace named `owner-receipts`, takes a snapshot copy of it for this task, and
   starts the agent on that copy. Edits you make to the folder while the task runs do not reach the task.

2. **Wait for it to finish,** then read what it changed:

   ```sh
   curl -s 127.0.0.1:7700/api/tasks/<task id>/diff
   ```

   The portal's task window shows the same list and diff, with a **Keep changes** button for these tasks.

3. **Keep** applies the changes to your real folder:

   ```sh
   curl -s -X POST 127.0.0.1:7700/api/tasks/<task id>/keep
   ```

   ```json
   {"kept":[{"path":"2026-10-21-hardware-store.pdf","change":"added"},{"path":"scan-0042.pdf","change":"deleted"}]}
   ```

   Each file is written atomically. Before it overwrites or deletes one of your files, the box saves a copy under
   `/var/lib/box/timemachine/<task id>/`.

   If you changed any of the same files after the task started, Keep applies nothing and lists them instead:

   ```json
   {"conflicts":["missing.txt"]}
   ```

   Resolve the conflict in your folder, or Undo the task and run it again.

4. **Or Undo** to discard the changes. Your folder never received them:

   ```sh
   curl -s -X POST 127.0.0.1:7700/api/tasks/<task id>/undo
   ```

## Check it worked

- After Keep, the folder shows the agent's changes, and the task's log has a step `kept N change(s) to <folder>`.
- After Undo, the folder is unchanged and the task's state is `undone`.
- On a conflict, the log has a step naming the files you both changed.

## Limits

- Only a task in the `done` state can be kept. A failed task's changes can only be undone.
- Keep needs the folder to be linked to the workspace the task ran on. Tasks on ordinary workspaces use Undo only.
- The task's snapshot copies the whole folder when it starts. That suits a folder of documents. A very large folder
  takes time and disk space.
- Restoring the saved copies after a Keep is a manual step for now. A Time Machine view for kept changes is in
  development.

## Related

- [Install GurtOS Personal](/get-started/install-personal/)
- [Workspaces and layers](/concepts/workspaces-and-layers/)
- [Agents as their own users](/concepts/agent-users/)
- [HTTP API](/reference/http-api/)
