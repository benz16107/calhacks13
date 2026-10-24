---
title: Connect Jira
description: Turn every agent task into a Jira issue with its prompt, steps, approvals and diff, and approve, deny or roll back a task from a panel in Jira.
---

The Jira app writes each task on the box to a Jira issue, and keeps it up to date as the task runs. A Forge app adds a **Box agent task** panel to those issues, where people who may edit the issue can approve, deny or roll back the task. In this guide you connect a box to a Jira Cloud site and install the panel.

The panel reaches the box through a reverse proxy. The box asks every request from off the machine for a paired
device's token, except routes an app marks as open. The Jira app marks its three panel routes open, because each one
checks the app's shared secret itself.

## Before you start

- A box with a root shell and the Jira app installed (it ships with GurtOS, in `tracks/jira/`).
- A Jira Cloud site, for example `your-site.atlassian.net`, and a project for agent tasks. This guide uses the key `BOX`.
- A classic Atlassian API token for the account the box writes as.
- A public HTTPS name for the box, for example `box.example.com`, with ports 80 and 443 open to it. The panel runs in Atlassian's cloud and calls the box from there.
- Node 22 and the Forge CLI on the machine you deploy the Forge app from.

## Steps

1. **Add the keys to the vault.** See [Add a secret](/guides/add-a-secret/).

   ```ini
   ATLASSIAN_SITE=your-site.atlassian.net
   ATLASSIAN_EMAIL=you@example.com
   ATLASSIAN_API_TOKEN=your-api-token
   JIRA_BOX_SECRET=a-long-random-value
   ```

   Make the shared secret with `openssl rand -hex 32`. The box refuses a secret shorter than 32 characters. Restart the box service after editing the vault.

2. **Turn syncing on for this box.** Without this file the app writes nothing to Jira, which keeps test boxes out of it.

   ```sh
   sudo mkdir -p /var/lib/box/jira
   echo '{"project":"BOX","skipSources":["schedule"]}' | sudo tee /var/lib/box/jira/config.json
   ```

   `skipSources` leaves out tasks whose source starts with any of the listed values, such as frequent scheduled checks.

3. **Expose only the Jira routes over HTTPS.** Put a reverse proxy in front of the box that serves `/t/jira/*` and nothing else. With Caddy:

   ```text
   box.example.com {
   	handle /t/jira/* {
   		request_body {
   			max_size 64KB
   		}
   		reverse_proxy 127.0.0.1:7700
   	}
   	handle {
   		respond 404
   	}
   }
   ```

   The rest of the box's API stays unreachable from the internet.

4. **Point the Forge app at your box.** In `tracks/jira/forge/manifest.yml`, set the external fetch address to your box's name (`box.example.com`). Set the plain Forge variable `BOX_URL` to the box's Jira routes, `https://box.example.com/t/jira`.

5. **Deploy and install the Forge app.** From `tracks/jira/forge/`:

   ```sh
   npm install
   forge variables set -e production BOX_URL https://box.example.com/t/jira
   forge variables set --encrypt -e production BOX_SECRET <the same value as JIRA_BOX_SECRET>
   forge deploy --non-interactive -e production
   forge install --non-interactive --site your-site.atlassian.net --product jira --environment production
   ```

6. **Show the panel on every issue.** As a Jira admin, open any `BOX` issue, open the **Box agent task** panel's menu and pick **Show for all work items**.

## Check it worked

1. Start a task on the box. A new issue appears in the `BOX` project within seconds.
2. The issue's status follows the task: queued is To Do, running is In Progress, waiting for an OK is In Review, and done, failed or rolled back is Done. Labels keep the exact state, such as `box-waiting` or `box-undone`.
3. Open the issue. The description has the prompt, the hosts and tools the task was allowed, its reasoning, approvals, blocked attempts, changed files with a diff, its cost and its log.
4. When the task asks for an OK, a comment appears and the panel shows **Approve** and **Deny**. The box's log records the answer as `jira:<name>`.
5. **Roll back** in the panel undoes only that task's file changes on the box.

The box's test suite has an offline check for this app. `DEMO_LIVE=jira ./demo` runs the same checks against a real site and deletes the issues it made.

## Search with JQL

The Forge app indexes the task's numbers for JQL:

| Field | Holds |
|---|---|
| `boxState` | The task's state |
| `boxCost` | What the task spent |
| `boxBlocked` | How many connections the box blocked |
| `boxPending` | Approvals still waiting |
| `boxSource` | What started the task |

For example, every task that tried to reach a host it was not allowed:

```text
project = BOX AND boxBlocked > 0
```

## How it stays safe

- Agent output only ever goes into text nodes in the issue. A task cannot inject links, markup or mentions into Jira.
- The Forge resolver holds the shared secret. It reads the task id from the issue **as the signed-in user**, never from the browser, and checks that the user may edit the issue before it approves, denies or rolls back.
- The box checks the secret in constant time and checks that the approval belongs to that task. With no secret in the vault, every call is refused.
- The Forge app has read scopes only. The box does all writing to Jira.

## Limits

- Roll back undoes the task's file changes on the box. It cannot recall something the task already sent out through a tool, such as a payment. Those show in the issue for a person to follow up.
- The panel polls the box every 4 seconds while it is open.
- One shared secret guards the box's three Jira routes. Checking Forge's signed invocation tokens per call is not built.
- The box writes with one person's API token, so its comments show that person as the author.
- Issue descriptions keep the last 40 log entries and the first 8,000 characters of the diff. The panel and the box's log have the rest.

## Related

- [Undo a task](/guides/undo-a-task/)
- [The action log](/concepts/action-log/)
- [Approvals and budgets](/concepts/approvals-and-budgets/)
- [Included apps](/reference/apps/)
