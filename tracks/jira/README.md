# GurtOS for Jira and Confluence: the team's control room for its agents

Atlassian Agentic Workforce Challenge. This entry is for **both tracks**:

- **Track 2, security for agents acting for a user.** Atlassian's example is "audit and reversion: record every
  action with the inputs and reasoning behind it, so an admin can see exactly what happened the next morning and
  roll back only the changes that were wrong." GurtOS does that for every agent task, and Jira is where the team
  does it.
- **Track 1, agents that do the work.** Hand a Jira issue to the GurtOS agent, or let a Jira Automation rule do
  it, and an agent does the work in its own safe space. The result, the diff and any request for an OK come back
  on the issue.

**Best shown in GurtOS Business**, where one box is shared by a team: the team's agents are visible in the
team's Jira, and Jira's permissions and GurtOS's roles together decide who may approve. GurtOS Business is on
main. The live demo runs on a GurtOS Server box; the Business rules are checked in the merge gate.

## The problem

Agents now act for teams: Rovo, coding agents, scripts with an LLM inside. They can be tricked (a planted
instruction in an issue or a web page) or simply wrong (a rule misread at 2 AM). The systems they run on were
built for one person at a keyboard. The agent runs as that person, with their keys, on one shared set of
files. So the next morning there is no record you can trust of what it did and why, nothing kept it from
reaching what it shouldn't, and no way to undo only the bad actions without undoing everyone's work.

## So: GurtOS, plus a Forge app

GurtOS is an operating system for agent work. It gives every agent task an environment where it can do real
work safely. The Forge app turns Jira and Confluence into the control room for that environment.

| What | From | Why it matters here |
|---|---|---|
| Each task runs as its own Linux user, in its own copy-on-write copy of the files | GurtOS | Roll back can remove one task's changes and nobody else's, with no git and no backups |
| Agents never hold secrets: keys stay in a root-only vault, and tools that need them run in the core | GurtOS | A tricked agent has no key to leak |
| Each task reaches only the hosts it is allowed; every refusal is logged | GurtOS | A planted "send this to my server" fails, and the attempt is on record |
| An append-only action log of every step, tool call, cost, approval and refusal | GurtOS | The audit is the box's own record, not the agent's account of itself |
| A task can stop and ask for an OK (over budget, production, outside its folder) | GurtOS | Risky actions wait for a person |
| Each task as a Jira issue, the panel, the Rovo agent, bulk roll back, the gadget, JSM approvals, Confluence reports, starting agents from Jira | This app (`tracks/jira/`, box side, and `forge/`, the Forge app) | The team sees and controls its agents where it already works |

GurtOS is open source (Apache-2.0) and the Forge app is reusable: point `BOX_URL` at any GurtOS box.

## The seven parts, and why each is there

Atlassian judges the idea, usefulness to Atlassian users, and technical use of Forge. Each part says which.

| # | Part | Why it's there | Criterion it serves |
|---|---|---|---|
| 1 | **A Rovo agent, "GurtOS"** (`rovo:agent` with three `action`s) | Ask in plain words: "what did agents change this week?", "what got blocked?", "roll back everything the shopper did yesterday", "pause all agents". Answers come from the box's log, and Rovo asks before it rolls back or pauses. | Usefulness (no new screen to learn) and technical use of Forge (Rovo agent and actions) |
| 2 | **Roll back several at once** (`jira:issueNavigatorAction` and a `jira:projectPage`) | Pick the wrong ones in an issue search or JQL filter, confirm, and get a report of what came back for each. This is Atlassian's "roll back only the changes that were wrong", for 200 issues as easily as for one. | Idea (selective undo, outside git) and usefulness |
| 3 | **Start agents from Jira** (a product `trigger`, and an `action` in `automation:actionProvider`) | Hand an issue to the GurtOS agent (the `gurtos-agent` label, or assigning it to the agent's account) or add "Run in GurtOS" to an Automation rule. The issue's text becomes a task in its own safe space: no network, no keys, a small budget. Results and the diff come back on the issue. | Track 1 (agents that do the work), usefulness |
| 4 | **Jira Service Management approvals** | Risky requests (production changes, spending over a limit, writes outside a task's folder) become JSM requests with approvers. The box waits for the JSM decision, then carries on or stops. On Business they map to routed approvals. | Usefulness to Atlassian users (approvals where IT already approves) |
| 5 | **Confluence reports** | A daily "What our agents did" page, and an incident page whenever something is blocked: what was tried, from where, and what GurtOS did. | Usefulness (the record outlives the box), idea |
| 6 | **A Jira dashboard gadget** (`jira:dashboardGadget`) | Agent tasks, blocked attempts and cost per project, on the team's dashboard. | Usefulness, technical use of Forge |
| 7 | **People mapping for Business** | A Jira user maps to a GurtOS person. Only someone with both the Jira permission (edit the issue; Jira admin to pause) and the GurtOS role, within their limit, can approve. Nobody approves their own request, and no agent approves an agent. The merge gate checks it on a Business box: an unlinked Jira user and a requester are refused, an approver over their limit is refused, an approval within it counts as that person, and someone who started a task from Jira can't approve it in JSM. | Track 2 (who may act for whom), technical use of Forge (identity from Forge's context, not the browser) |

Plus what was there before: each task's issue holds what it was asked, what it was allowed, its reasoning, its
approvals, its blocked attempts, the diff and its log; the **GurtOS agent task** panel approves and rolls back
one task; and JQL searches the task's state, cost and blocked attempts (`project = BOX AND boxBlocked > 0`).

## Screenshots

All from the live demo site and the always-on GurtOS box, on 2026-10-24.

**1. The Rovo agent** answers from the box's log:

![The GurtOS Rovo agent listing what got blocked and what changed](screenshots/rovo-activity.png)

"Roll back everything the shopper did today": it finds BOX-17 and BOX-18, asks to confirm, then reports what
came back for each.

![Rovo asking to confirm the roll back](screenshots/rovo-confirm.png) ![Rovo reporting the files restored](screenshots/rovo-rolled-back.png)

**2. Roll back several at once**, from an issue search: pick the issues, confirm, read the report.

![The bulk roll back dialog with two issues](screenshots/bulk-confirm.png)

![The report: both rolled back, with the files restored](screenshots/bulk-report.png)

**3. Started from a teammate's issue.** PLAT-33510 got the `gurtos-agent` label. A Droid task (Claude) did the
work in its own copy of the handbook and reported back on the issue, with the diff:

![The agent's report and diff on PLAT-33510](screenshots/started-from-issue.png)

**4. A production change waits for JSM.** The agent asked to push deploy settings to production. GurtOS opened
SECOPS-168 with its approvers; when it was approved there, the box logged "approved by jira:Ben Zhou via JSM
SECOPS-168" and the task carried on.

![The JSM request with Approve and Decline](screenshots/jsm-approval.png)

**5. Confluence.** The incident page for a blocked attempt:

![The Confluence incident page](screenshots/confluence-incident.png)

And the day's "What our agents did" page, rewritten every 15 minutes from the box's log:

![The Confluence daily page](screenshots/confluence-daily.png)

**6. The dashboard gadget**, agent activity per project:

![The GurtOS agent activity gadget](screenshots/gadget.png)

**The issue panel** on BOX-29: waiting for an OK, then rolled back.

![The GurtOS agent task panel waiting for an OK](screenshots/panel-waiting.png)

![The panel after the roll back](screenshots/panel-rolled-back.png)

## How it works

```
 box action log ─► jira track (log readers, timers) ─► Jira REST: issues, box.task property, status, comments
                                                    ─► JSM REST: requests with approvers, their decisions
                                                    ─► Confluence REST: incident and daily pages

 Forge app (Atlassian's cloud): issue panel, project page, bulk action, gadget, Rovo agent and actions,
 automation action, assignment trigger, JQL index
        │  every call: the shared secret (a Forge encrypted variable), the user's name and Atlassian accountId
        ▼
 Caddy, HTTPS, only /t/jira/* ─► the jira track's routes on the box ─► the box's own answer, undo and pause
```

**Into Jira.** `track.ts` has log readers. The box feeds them every event in its append-only log, in order, and
saves their place, so they survive restarts and power cuts.

- Each task gets one issue, in Atlassian Document Format. Agent output only ever goes into text nodes, so a task
  cannot inject markup, links or mentions into Jira. Status follows the task (queued is To Do, running In
  Progress, waiting for an OK In Review, done, failed or rolled back Done).
- A task started from a teammate's issue writes back to that issue in comments, and leaves its summary, text
  and status alone.
- The issue property `box.task` holds the task id and a few numbers. The Forge app finds its task through it,
  and indexes it for JQL.
- A risky approval (`jsm` in the config: words like "production", or spending over `minCents`) opens a JSM
  request on a request type with an approval step. A timer reads the decision every 10 seconds and answers the
  box. If someone answers in GurtOS first, the request is closed with a note, so nobody decides it twice.
- A blocked attempt writes a Confluence incident page. A timer rewrites today's "What our agents did" page every
  15 minutes, and yesterday's once more after midnight.
- Everything is safe to repeat: issues, requests and pages are found by label or title before anything new is made.

**Out of Jira.** Every Forge function runs in Atlassian's cloud and is the only place that holds the box's
shared secret. It never trusts the browser or the model for who is acting or which task an issue holds:

1. Who: the Atlassian `accountId` from Forge's own context (for a product event, the event's user).
2. Which task: the issue's `box.task` property, read as the signed-in user, so they must be able to see it.
3. May they: Jira's `mypermissions` (edit the issue for approve and roll back, Jira admin for pause). In bulk,
   issues the user can't edit are skipped and reported. Pausing every agent works from Jira; resuming does not,
   unless the box runs GurtOS Business and the user is linked to a Business admin. A stolen secret can at worst
   stop the box, and held work carries on only from the box's screen, the owner's phone or an admin.
4. Then it calls the box with the secret. The box checks it in constant time, checks the approval belongs to
   the task, and runs the same answer, undo and pause the portal and phone use (`box.answer`, `box.undo`,
   `box.createTask`; one path each). Its log records `jira:<name>`, where the box asked Atlassian for the name
   from the account id itself. A name in the request is ignored, and a request with no account is refused.

**On GurtOS Business** (part 7), the box adds a step: the Jira account must be linked to a GurtOS person in
`BOX_HOME/jira/people.json` (`{"<accountId>": "<person id>"}`), and the box acts as that person. Business then
decides by role, limit and who asked, exactly as for a phone: a requester can't approve, an approver can't go
over their limit, nobody approves their own request, and no agent approves an agent. The link file holds only
ids; people, roles and limits stay in Business. A JSM approver goes through the same check.

## Forge modules and APIs used

| Piece | What it does |
|---|---|
| `rovo:agent` "GurtOS" with `action`s `get-gurtos-activity` (GET), `rollback-gurtos-tasks` (DELETE, Rovo confirms), `pause-gurtos-agents` (UPDATE, Rovo confirms) | The Rovo agent |
| `jira:issueNavigatorAction` "Roll back with GurtOS" | Bulk roll back of the issues picked in a search (or the search's results) |
| `jira:projectPage` "GurtOS agent tasks" | Tasks for the project, filter, roll back selected, pause and resume |
| `jira:dashboardGadget` "GurtOS agent activity" | Tasks, blocked attempts and cost per project |
| `jira:issuePanel` "GurtOS agent task" | One task: approve, deny, roll back, audit trail, diff. Shown on issues with the `box.task` property (`entityPropertyExists`) |
| `trigger` on `avi:jira:assigned:issue` and `avi:jira:updated:issue` | Starts a task when an issue is handed to the agent |
| `action` "Run in GurtOS" in `automation:actionProvider` | A Jira Automation step that starts a task |
| `jira:entityProperty` | Indexes `box.task` for JQL: `boxState`, `boxCost`, `boxBlocked`, `boxPending`, `boxSource` |
| `api.asUser().requestJira` | Issue properties, permissions and names, with the user's own access |
| `fetch` from `@forge/api`, `permissions.external.fetch.backend` | The calls to the box, to the declared host |
| Variables `BOX_URL`, `BOX_SECRET` (encrypted), optional `GURTOS_AGENT_ACCOUNT` | Where the box is, the shared secret, the agent's Jira account |
| Scopes | `read:jira-work`, `read:jira-user`. The app never writes to Jira; the box does. |
| From the box: Jira REST v3, JSM `servicedeskapi`, Confluence REST v2 | Issues, comments, transitions, properties; requests and approvals; pages and spaces |

The box's routes, all behind the shared secret: `GET /task`, `POST /answer`, `POST /undo`, `POST /undo-many`,
`GET /activity`, `POST /pause`, `POST /start`, `POST /report`.

## What the demo shows

`./demo` is everyone's merge gate, so by default this step stays offline: a stand-in for Jira, JSM and
Confluence on the test machine takes the box's REST calls, and the step calls the same routes the Forge app does.

From the merge gate on 2026-10-24:

```
track jira
  ok    BOX-1: task A is an issue in Done, with its diff
  ok    BOX-2: task B waits for an OK, in In Review
  ok    BOX-2 holds B's prompt, steps and diff
  ok    BOX-2 has a comment for the blocked attempt on attacker.example
  ok    BOX-2 has a comment asking for the OK
  ok    without the shared secret the panel routes refuse to approve or roll back (401)
  ok    an approval can't be answered through another task's issue
  ok    approved from Jira, task B finished
  ok    rolled back from Jira: B's settings change is gone, A's fix stays
  ok    the panel's audit view shows the block, who approved, the roll back and the diff it undid
  ok    BOX-2 says who rolled it back, in a comment and the description
  ok    BOX-2 still shows the diff it undid, though the box deleted those files
  ok    no vault secret is in anything the box sent to Jira
  ok    B's production push opened Jira Service Management request SEC-1 for its approvers
  ok    C waited for SEC-2; approved in JSM, it shipped (jira:Approver via JSM SEC-2)
  ok    SEC-1 was closed with a note: B was already answered in GurtOS
  ok    Confluence incident page: "Blocked: Tidy the settings tried to reach attacker.example:443 (2026-10-24)"
  ok    Confluence daily page "What our agents did, 2026-10-24" lists the tasks and the blocked attempt
  ok    activity: 42 tasks, 6 blocked, by project BOX 3, Not in Jira 39
  ok    assigned OPS-1 to the GurtOS agent: the task ran, the diff came back as a comment, a second start did not run it twice
  ok    pause all from Jira held a new task in the queue; resume ran it
  ok    bulk roll back of BOX-1 and BOX-3: both came back (README.md, hotfix.txt), NOPE-1 was refused, the on-call notes stayed
  skip  a Jira user acting as their GurtOS Business person: needs GurtOS Business on main
```

`DEMO_LIVE=jira ./demo` runs the same steps against the real site (reports go to a scratch Confluence space), then
deletes what it made.

## Run it

On the box, as root:

1. Vault keys in `/etc/box/vault.env`: `ATLASSIAN_SITE`, `ATLASSIAN_EMAIL`, `ATLASSIAN_API_TOKEN` (a classic
   API token; it works for Jira, JSM and Confluence) and `JIRA_BOX_SECRET` (`openssl rand -hex 32`).
2. Turn it on for this box with `/var/lib/box/jira/config.json`. Without this file the track writes nothing,
   which keeps test runs out of Jira. Every part but `project` is optional:

   ```json
   {
     "project": "BOX",
     "skipSources": ["schedule", "shopper:check:"],
     "start": { "workspace": "handbook", "worker": "droid", "budgetCents": 25, "hosts": [] },
     "jsm": { "serviceDesk": "11", "requestType": "145", "match": ["production", "prod ", "outside"], "minCents": 1000 },
     "confluence": { "space": "AGENTS", "projects": { "PLAT": "PLATDOCS" } }
   }
   ```

   - `skipSources` leaves out tasks whose source starts with one of these, such as frequent checks.
   - `start` is what a task started from a Jira issue gets. The issue's text is untrusted, so keep it narrow.
   - `jsm` needs a request type whose issue type has an approval step (on Atlassian's IT templates, "Service
     request with approvals"). Approvers are the signed-in account unless `approvers` lists account ids.
   - `confluence.projects` sends a project's tasks to its own space; the rest go to `space`.
3. On GurtOS Business, link Jira accounts to people in `/var/lib/box/jira/people.json`.
4. Public HTTPS for the Forge app: a reverse proxy that serves only `/t/jira/*`. With Caddy:

   ```
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

The Forge app, from `forge/` with Node 22 and the Forge CLI 14:

```
npm install
forge variables set -e production BOX_URL https://box.example.com/t/jira
forge variables set --encrypt -e production BOX_SECRET <the same secret>
forge deploy --non-interactive -e production
forge install --non-interactive --site your-site.atlassian.net --product jira --environment production
```

Forge only lets the app call hosts named in `manifest.yml`, and that list is fixed when you deploy. So also set
`permissions.external.fetch.backend` to your box's host name, then deploy and run `forge install --upgrade`. The
committed manifest allows `*.sslip.io`, because the demo box has an sslip.io name; `BOX_URL` picks the exact box.

On the site:
- **Panel on every issue:** a Jira admin opens the panel once on any GurtOS issue and picks **Show for all work
  items** from its menu.
- **The gadget:** Dashboards, create or open one, Edit, Add gadget, search "GurtOS".
- **Rovo:** Ask Rovo, then type `@GurtOS` in the chat.
- **Start from Jira:** add the label `gurtos-agent` to an issue, or set the Forge variable `GURTOS_AGENT_ACCOUNT`
  to an account id and assign issues to it. For Automation, add the action **Run in GurtOS** with the issue key
  `{{issue.key}}`.

## The demo videos

Shot lists for both tracks (3 minutes or less each) are in [`docs/videos.md`](../../docs/videos.md).

## Limits

- Roll back undoes a task's **file changes** on the box. It cannot recall something already sent out through a
  tool, such as a payment or a message. Those show in the issue so a person can follow up, and the Rovo agent
  says so.
- One shared secret guards the box's Jira routes. Forge Remote's signed invocation tokens would let the box check
  each call came from this app and user; that is the next step.
- The box writes to Jira and Confluence with one account's API token, so its comments and pages show that account
  as the author.
- The JSM part relies on a request type with an approval step, and sets approvers through the site's "Approvers"
  field (`customfield_10003` on Atlassian's templates).
- The project page and the Rovo agent list only tasks whose issue the user can see. The gadget's totals count all
  tasks on the box.
- Issue descriptions keep the last 40 log entries and the first 8,000 characters of the diff. The panel and the
  box's log have the rest.
- Name lookups to an outside resolver (port 53) are refused like any other connection. They are counted apart
  from real attempts and don't get incident pages.
