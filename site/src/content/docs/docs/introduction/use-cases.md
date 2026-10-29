---
title: Use cases by edition
description: Which GurtOS edition fits which job, from always-on coding and payment agents on GurtOS Server to agents on your own folders with GurtOS Personal.
---

Every edition runs the same core: each task as its own Linux user, in its own copy of the files, without your keys,
with a budget, an action log and an undo. The editions differ in whose machine it is and how you watch it. This page
lists the jobs each one fits. See [Editions](/docs/introduction/editions/) for the full comparison.

Rows marked **Optional app** use an app that ships in the source. On a new box only the model app is on. Turn on any
other app in App Center, and add the keys it lists. Each needs that service's account, so you never need one to start.
Payments in these apps are test money.

## GurtOS Server: agents that work while you are away

An always-on box at home or in the cloud, with no desktop and no human login. You watch it from the portal on its
screen, a laptop or your phone. [Install GurtOS Server](/docs/get-started/install-server/).

| Job | How GurtOS Server does it |
|---|---|
| **Coding work with Droid** | Each task runs Factory's Droid with a Claude model in its own copy of a repository. You read its steps and its diff, then keep the change or undo that one task. See [Tasks](/docs/concepts/tasks/) and [Undo a task](/docs/guides/undo-a-task/). |
| **Watchers that never sleep** | Schedules, webhooks and new files start tasks with no one at the keyboard. See [Triggers](/docs/concepts/triggers/) and [Schedule a routine](/docs/guides/schedule-a-routine/). |
| **A box in the cloud** | The same ISO installs on a cloud instance that boots custom ISOs, such as Vultr. Its firewall keeps the API off the public internet, and tasks resume after the instance restarts. See [Install GurtOS Server](/docs/get-started/install-server/#install-on-a-cloud-instance) and [Resume after power loss](/docs/concepts/resume-after-power-loss/). |
| **Agents that pay for APIs within a budget** (Optional app: Wallet) | A task pays for an HTTP API that answers `402 Payment Required` with x402, in USDC on Solana's devnet (test money). The wallet's key stays in the vault. Spending above the task's budget waits for your OK. See [Let agents pay for APIs](/docs/guides/agent-payments/) and [Approvals and budgets](/docs/concepts/approvals-and-budgets/). |
| **An agent you can reach from chat at any hour** (Optional app: ASI:One) | The ASI:One app makes the box an agent on Agentverse, which needs an ASI:One account. You pair once in an ASI:One chat, ask for work in plain words, and approve or undo from cards in the chat. See [Reach GurtOS from ASI:One](/docs/guides/asi-one/). |
| **Price and restock watchers** (Optional app: Shopper) | The Shopper app checks prices on a schedule, including live prices through Apify. Its checkout is Stripe test mode. See [Set up the shopping agent](/docs/guides/shopping-agent/). |

## GurtOS Personal: your own computer, with agents beside you

Ubuntu's GNOME desktop with your own account and `sudo`. Agents work as separate users without `sudo`, on copies of
your folders. [Install GurtOS Personal](/docs/get-started/install-personal/).

| Job | How GurtOS Personal does it |
|---|---|
| **Your own AI computer, on hardware you control** | Install it on a spare x86_64 laptop or desktop with 4 GB of memory and 29 GB of disk. Your files and model key stay on that machine. Approvals arrive as desktop notifications. |
| **Agents on copies of your folders** | Right-click a folder in Files and choose **New Agent Task…**. The agent works on a copy. Your folder changes only when you choose **Keep**, and **Undo task** puts it back later. See [Give an agent a folder, then keep or undo](/docs/guides/keep-or-undo/). |
| **Search your files and photos** | The Find app indexes the files and photos in GurtOS workspaces and your agents' task history. It matches words with no account, and searches by meaning once you add a Moss project's keys. A vision model you choose describes each photo once, on your own machine if you run Ollama there. Agents search it too, with no keys of their own. See [Search your files with Find](/docs/guides/find/). |
| **Everyday web errands** | A task reaches only the sites it is given. With the optional Apify app, web work can go through Apify Actors, which return clean data instead of pages to click through, with the Apify token kept in the vault. See [Network policy](/docs/concepts/network-policy/). |
| **Shopping that pays only after your tap** (Optional app: Shopper) | The Shopper app watches prices and restocks and proposes reorders from receipts. Each purchase waits for your tap, and the agent never holds a buy tool or the card. Checkout is Stripe test mode with a Visa test card, at the store the app runs on the box, signed with Visa's Trusted Agent Protocol. See [Set up the shopping agent](/docs/guides/shopping-agent/). |

## GurtOS Business (preview): a company's agents

**Preview.** Business is turned on from a GurtOS Server or Personal box (see
[Turn on GurtOS Business](/docs/guides/turn-on-business/)). Roles, routed approvals and the audit work on one box with
sandbox data. Fleet management and production banking integrations are planned.

| Job | Status |
|---|---|
| **Agents in seats with roles** | Preview: people with roles that decide what each may start, approve and undo. A sample credit desk app runs two agent seats, a credit analyst and a collections clerk, as separate tasks with different tools. |
| **Approvals routed by role and amount** | Preview: a policy in plain words, such as "Over $10,000 goes to the Controller", sends each approval to the person who may answer it. |
| **Separation of duties for finance work** | Partly shown today: in the credit desk sample, only the analyst's task can record a credit decision and only the clerk's can record a collections action, enforced by which tools each task may call. A limit above the analyst's authority waits for a controller's OK. |
| **An audit trail in the tools you use** | Built as apps today: the Jira app writes every task to a Jira issue with its steps, approvals and diff, and the Elastic app streams the action log to Elasticsearch with an Agent Builder agent that answers questions about it. See [Connect Jira](/docs/guides/connect-jira/) and [Send the log to Elastic](/docs/guides/send-the-log-to-elastic/). |
| **Banking integrations** | Planned. The credit desk sample reads a sandbox bank (Capital One's Nessie API) and sandbox credit and identity checks (CRS), with their keys in the vault. No production banking integration exists. |

## Related

- [Editions](/docs/introduction/editions/)
- [What is GurtOS?](/docs/introduction/overview/)
- [Apps](/docs/reference/apps/)
- [Roadmap](/docs/project/roadmap/)
