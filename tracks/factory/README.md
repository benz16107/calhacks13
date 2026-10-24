# Factory

Droid works on a GurtOS box as a team of custom droids. It plans first and starts only after you approve the plan.
It works inside limits the operating system enforces, and it hands its work back as a diff or a pull request for
you to review. Droid never holds a key.

## The problem

Coding agents usually run as you. They can read every file you can, including the `.env` files and tokens on your
disk. They can reach any host, and nobody can easily see or undo what they did. In August 2025, malicious versions of
the Nx build tool used AI CLIs already installed on developers' machines (Claude, Gemini and Q, started with flags
that skip permission prompts) to search the disk for GitHub and npm tokens, SSH keys and wallets, then published what
they found to public repositories ([Wiz](https://www.wiz.io/blog/s1ngularity-supply-chain-attack),
[Nx advisory](https://github.com/nrwl/nx/security/advisories/GHSA-cxm3-wv7p-598c)).

## What GurtOS adds, and what is Factory's

| | The OS (GurtOS core) | The Factory integration (this app and the Droid worker) |
|---|---|---|
| Who Droid runs as | Its own Linux user per task, no sudo, a hardened systemd unit | |
| Files | Its own copy-on-write copy; Undo removes one task's changes; Keep applies them | Droid edits its copy with its own tools |
| Keys | The vault keeps them; the proxy adds the Factory or Anthropic key outside the task | The PR tool pushes with the vault's GitHub token, outside the task |
| Network | A firewall rule per task: only the hosts the task names | Autonomy levels choose the hosts (below) |
| Plans | Approvals on the portal and phone, kept in the log | Factory's spec mode writes the plan; ExitSpecMode becomes the approval |
| Seeing it | One append-only action log of every step, call and cost | Factory hooks log every tool call's result; risky commands pause |

## The seven parts

Each part names the criterion it serves. The criteria are "Droid does real work, and the README says where and how",
"triggers you designed", "careful limits on what Droid can touch" and "visible plans, steps and diffs".

### 1. Plan first, then approve
*Visible plans; careful limits.* A task with `droid: {plan: true}` starts Droid in Factory's **spec mode**
(`interactionMode: Spec` in the SDK). Spec mode can read but not change anything. When Droid finishes its plan, it
calls `ExitSpecMode`. The worker's permission handler logs the plan as a step and asks the box for an approval whose
question is the plan. The approval reaches the portal's inbox, the phone (a push) and this app's window. Approve it
and Droid carries on in the same turn at the task's autonomy level. Deny it and the task fails with "the owner turned
down the plan", and nothing changed. Code: `core/workers/droid.ts`, `permissionHandler`.

### 2. A team of custom droids
*Droid does real work; careful limits.* `droids/` holds four Factory custom droids (subagents). The worker copies
every app's `droids/*.md` into the task user's `~/.factory/droids/`, so Droid can delegate to them with its Task tool.

| Droid | Tools | Limits |
|---|---|---|
| `coder` | Read, Grep, Glob, LS, Edit, Create, ApplyPatch, Execute | No MCP servers, so no box tools and no spending |
| `reviewer` | `read-only` | Cannot edit, run commands, spend or ask |
| `credit-analyst` | Read, Grep, Glob, LS, and the task's box tools | Cannot change a case file; decisions above its authority go to `box_ask` |
| `shopper` | Read, LS, and the task's box tools | Pays only through the broker, inside the task's budget |

Factory tasks (GitHub issues, `gurtos-exec --team`, the Start form) tell Droid to have the coder make the change and
then give the reviewer the diff. The reviewer answers `VERDICT: APPROVE` or `VERDICT: CHANGES`. That verdict is in the
log and on the task's card here before you choose Keep on a real folder, and in the pull request body.

### 3. Autonomy levels the OS enforces
*Careful limits.* `droid.autonomy` sets Factory's autonomy level for Droid, and the box enforces it too, in
`createTask` (core):

| Level | Droid (Factory) | GurtOS |
|---|---|---|
| `low` | File edits and read-only commands; asks before anything else | No network beyond the model; every spend needs an OK (budget 0) |
| `medium` | Also reversible commands; asks before the rest | The task's own hosts; a budget of at most $1 |
| `high` | Runs commands without asking | The task's own hosts and budget |

When Droid asks permission for a command (at low or medium), the worker makes it a box approval:
"Droid wants to run: ... (its risk reason)". So even if Droid were tricked into ignoring its level, the firewall rule
and the budget still hold.

### 4. Droid hooks report to GurtOS
*Visible steps; careful limits.* The worker writes Factory hooks into the task user's `~/.factory/hooks.json`.
`core/workers/hook.ts` runs inside the task, holds no secrets, and talks only to the task's broker socket.
- **PostToolUse**, on every tool: logs what came back as a step, so each call and its result are in the action log.
  A Task call names the droid that ran (`coder finished: ...`).
- **PreToolUse**, on Execute: a risky command (`rm -rf`, `git push`, `git reset --hard`, `sudo`, `npm publish`,
  `curl ... | sh` and a few more, listed in `RISKY`) waits for your OK. Denied, Droid is told "The box owner turned
  this command down." Everyday commands such as `npm test` pass straight through.

### 5. Droid on GitHub repos
*Triggers you designed; Droid does real work.* Put `FACTORY_GITHUB_REPO` (like `you/project`) and `GITHUB_TOKEN` in
the vault. Every 2 minutes the box checks the repo for open issues labelled `droid` (and **Check now** checks at
once). For each new one, the core clones the repo into a workspace and starts a Droid task: plan first, medium
autonomy, no network, and one tool, `factory.openPullRequest`. You approve the plan from the phone, the coder fixes
the issue, and the reviewer checks it. Droid then calls the tool, and the core copies the task's files, commits them to
`droid/issue-<n>-<task>` and pushes with the token in a one-time header. It opens the pull request, which you review
from GitHub on your phone. Droid has no token and no route to GitHub. The test repo is
[benz16107/gurtos-droid-demo](https://github.com/benz16107/gurtos-droid-demo).

### 6. A safe runner for `droid exec`
*Droid does real work; careful limits.* Teams that run `droid exec` in CI or scripts can point it at a GurtOS box
instead of a runner that holds their keys:

```sh
export GURTOS_BOX=https://mybox.box.gurtos.com GURTOS_TOKEN=<a paired device's token>
tracks/factory/gurtos-exec.ts --repo https://github.com/you/project.git --auto medium --plan --team \
  "Add a --json flag to the CLI and a test for it"
```

It prints Droid's steps as they happen, and any approval it is waiting for. At the end it prints the unified diff,
the cost and the Factory credits. With `-o json` it prints one JSON object instead (`state`, `changes`, `diff`,
`costCents`, `factoryCredits`). The exit code is 0 when the job is done and 1 when it failed. The flags follow
`droid exec`: `--auto low|medium|high`, `-o text|json`, plus `--host` to allow a host and `--plan` and `--team`.
Behind it is `POST /t/factory/run {prompt, repo? or files?, autonomy?, plan?, team?, hosts?, budgetCents?}`. The job runs
as its own Linux user, on its own copy, keyless, with the network you allow, and every step is in the log. Nothing on
your side changes; take the diff if you want it.

### 7. Factory usage in the portal
*Visible results.* This app's window shows each Droid task's Factory credits (from the `factoryCredits` Droid reports
for each turn), its cost at list price and its budget. It also shows the 5-hour and weekly use of your Factory plan,
read from `https://api.factory.ai/api/billing/limits` with the vault's `FACTORY_API_KEY`. The key is used in the
core and only percentages leave it (`GET /t/factory/usage`).

## Where Droid runs, and how

- `core/workers/droid.ts` is the worker inside every task: `@factory/droid-sdk` `createSession` (or `resumeSession`
  after a power cut), a box MCP server for tools and approvals, the permission and AskUser handlers, hooks and droids.
- `tracks/factory/track.ts` has the GitHub watcher, the PR tool, the runner route and the usage route.
- `tracks/factory/app.html` is the window: plan approvals with Approve and Deny, the reviewer's verdict, the pull
  request link, steps, credits and the plan's limits.

## Demo

`./demo` checks the offline parts with the scripted worker. The autonomy levels hold in the box. `gurtos-exec` runs a
job and gets its diff back, the job runs as its own user with no network, the four droids are valid, and usage never
contains the key. `./demo --live-droid` adds a real Droid. It sends a plan, the demo approves it, the coder fixes
`add.js`, the reviewer checks it, and the hooks log each result. `DEMO_LIVE=droid,github` also fixes the test repo's
issue and opens a pull request (with `GITHUB_TOKEN` and `FACTORY_GITHUB_REPO` in `/root/factory-github.env` on the
test machine, kept out of the shared vault).
