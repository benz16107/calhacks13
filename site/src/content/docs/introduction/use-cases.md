---
title: Use cases by edition
description: Which GurtOS edition fits which job, from always-on coding and payment agents on GurtOS Server to agents on your own folders with GurtOS Personal.
---

Every edition runs the same core: each task as its own Linux user, in its own copy of the files, without your keys,
with a budget, an action log and an undo. The editions differ in whose machine it is and how you watch it. This page
lists the jobs each one fits. See [Editions](/introduction/editions/) for the full comparison.

Apps named below ship in the source and are off on a new box until you add their keys. Payments in them are test
money unless you change that yourself.

## GurtOS Server: agents that work while you are away

An always-on box at home or in the cloud, with no desktop and no human login. You watch it from the portal on its
screen, a laptop or your phone. [Install GurtOS Server](/get-started/install-server/).

| Job | How GurtOS Server does it |
|---|---|
| **Coding work with Droid** | Each task runs Factory's Droid with a Claude model in its own copy of a repository. You read its steps and its diff, then keep the change or undo that one task. See [Tasks](/concepts/tasks/) and [Undo a task](/guides/undo-a-task/). |
| **Agents that pay for APIs within a budget** | A task pays for an HTTP API that answers `402 Payment Required` with x402, in USDC on Solana's devnet (test money). The wallet's key stays in the vault. Spending above the task's budget waits for your OK. See [Let agents pay for APIs](/guides/agent-payments/) and [Approvals and budgets](/concepts/approvals-and-budgets/). |
| **An agent you can reach from chat at any hour** | The ASI:One app makes the box an agent on Agentverse. You pair once in an ASI:One chat, ask for work in plain words, and approve or undo from cards in the chat. See [Reach GurtOS from ASI:One](/guides/asi-one/). |
| **Watchers that never sleep** | Schedules, webhooks and new files start tasks with no one at the keyboard. The Shopper app checks prices on a schedule, including live prices through Apify. See [Triggers](/concepts/triggers/) and [Schedule a routine](/guides/schedule-a-routine/). |
| **A box in the cloud** | The same ISO installs on a cloud instance that boots custom ISOs, such as Vultr. Its firewall keeps the API off the public internet, and tasks resume after the instance restarts. See [Install GurtOS Server](/get-started/install-server/#install-on-a-cloud-instance) and [Resume after power loss](/concepts/resume-after-power-loss/). |

## GurtOS Personal: your own computer, with agents beside you

Ubuntu's GNOME desktop with your own account and `sudo`. Agents work as separate users without `sudo`, on copies of
your folders. [Install GurtOS Personal](/get-started/install-personal/).

| Job | How GurtOS Personal does it |
|---|---|
| **Your own AI computer, on hardware you control** | Install it on a spare x86_64 laptop or desktop with 4 GB of memory and 29 GB of disk. Your files and model key stay on that machine. Approvals arrive as desktop notifications. |
| **Agents on copies of your folders** | Right-click a folder in Files and choose **Ask an Agent**. The agent works on a copy. Your folder changes only when you choose **Keep**, and **Undo Keep** puts it back later. See [Give an agent a folder, then keep or undo](/guides/keep-or-undo/). |
| **Shopping that pays only after your tap** | The Shopper app watches prices and restocks and proposes reorders from receipts. Each purchase waits for your tap, and the agent never holds a buy tool or the card. Checkout is Stripe test mode with a Visa test card, at the store the app runs on the box, signed with Visa's Trusted Agent Protocol. See [Set up the shopping agent](/guides/shopping-agent/). |
| **Search your files and photos by meaning** | The Find app indexes the files and photos in GurtOS workspaces and your agents' task history, with Moss. A vision model describes each photo once, when it arrives. Agents search it too, with no keys of their own. See [Search your files with Find](/guides/find/). |
| **Everyday web errands** | A task reaches only the sites it is given. Web work can go through Apify Actors, which return clean data instead of pages to click through, with the Apify token kept in the vault. See [Network policy](/concepts/network-policy/). |

## GurtOS Business (planned): a company's agents

**Planned.** Nothing in this section is built as a product yet. It shows where the core is heading, and which parts
exist today.

| Job | Status |
|---|---|
| **Agents in seats with roles** | Planned: people and agent seats with roles that decide what each may start, approve and undo. Today a sample credit desk app runs two agent seats, a credit analyst and a collections clerk, as separate tasks with different tools. |
| **Approvals routed by role and amount** | Planned. Today every approval goes to the box's owner and paired phones, and a single spend above `approvalThresholdCents` always asks. |
| **Separation of duties for finance work** | Partly shown today: in the credit desk sample, only the analyst's task can record a credit decision and only the clerk's can record a collections action, enforced by which tools each task may call. A limit above the analyst's authority waits for a controller's OK. |
| **An audit trail in the tools you use** | Built as apps today: the Jira app writes every task to a Jira issue with its steps, approvals and diff, and the Elastic app streams the action log to Elasticsearch with an Agent Builder agent that answers questions about it. See [Connect Jira](/guides/connect-jira/) and [Send the log to Elastic](/guides/send-the-log-to-elastic/). |
| **Banking integrations** | Planned. The credit desk sample reads a sandbox bank (Capital One's Nessie API) and sandbox credit and identity checks (CRS), with their keys in the vault. No production banking integration exists. |

## Related

- [Editions](/introduction/editions/)
- [What is GurtOS?](/introduction/overview/)
- [Apps](/reference/apps/)
- [Roadmap](/project/roadmap/)
