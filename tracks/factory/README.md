# Factory

Coding jobs for Factory's Droid on a GurtOS box. Droid plans first, and starts only after you approve the plan. A
coder droid makes the change, and a reviewer droid checks it before you decide. The box limits what Droid can touch,
and Droid never holds a key.

This app adds three things on top of the Droid worker that every GurtOS task already uses:

- It watches a GitHub repository for issues labelled `droid` and turns each one into a task that ends in a pull request.
- It runs `droid exec`-style jobs on the box from a script or a CI job (`gurtos-exec`).
- It shows each Droid task's Factory credits and your Factory plan's use.

## What it needs

| | |
|---|---|
| A model key | An Anthropic key or a Factory key in the vault. Droid runs every task, so GurtOS needs one of them whether or not this app is on. |
| For GitHub issues | `FACTORY_GITHUB_REPO` (`owner/name`, or a pasted `https://github.com/owner/name` link) and `GITHUB_TOKEN`. The token needs to read issues and, to open pull requests, write to the repository's contents and pull requests. A public repository can be read without a token. |
| For the plan meter | `FACTORY_API_KEY`. Without it the window shows no plan limits. |

None of the three is required to turn the app on. Add them in Settings, Accounts and keys. The app is off on a new
box; turn it on in the App Center.

## Droid on GitHub issues

Every 2 minutes the box checks the repository for open issues with the `droid` label. **Check now** in the window
checks at once. Only one check runs at a time. For each new issue the box:

1. clones the repository into a workspace and starts a Droid task with a plan first, medium autonomy and no network;
2. waits for your OK on the plan, on the screen or your phone;
3. lets the coder droid fix the issue and the reviewer droid check the diff;
4. opens a pull request through the box's own `factory.openPullRequest` tool, which pushes to `droid/issue-<n>-<task>`
   with your token and puts the reviewer's verdict in the pull request.

Droid has no token and no route to GitHub. If one issue fails to start, the window says which one and the others
carry on. The same issue is never started twice. A private repository works when the token can read it.

Git runs on the box, outside the task's sandbox, when it opens the pull request. So the task's `.git` folder is not
trusted. Hooks, configuration and links inside it are discarded, and only its objects and refs are used. The pull
request goes into the repository's default branch.

## Plan first, then approve

A task with `droid: {plan: true}` starts Droid in Factory's spec mode, which can read but not change anything. When
the plan is ready, the worker turns it into an approval (`core/workers/droid.ts`). Approve it and Droid carries on at the
task's autonomy level. Deny it and the task fails with "the owner turned down the plan", with nothing changed.

## A team of custom droids

`droids/` holds four Factory custom droids. The worker copies every app's `droids/*.md` into the task user's
`~/.factory/droids/`, so Droid can hand work to them.

| Droid | Tools | Limits |
|---|---|---|
| `coder` | Read, Grep, Glob, LS, Edit, Create, ApplyPatch, Execute | No box tools and no spending |
| `reviewer` | Read-only | Cannot edit, run commands, spend or ask |
| `credit-analyst` | Read, Grep, Glob, LS, and the task's box tools | Cannot change a case file; big decisions go to `box_ask` |
| `shopper` | Read, LS, and the task's box tools | Pays only through the broker, inside the task's budget |

Tasks from this app tell Droid to have the coder make the change and then give the reviewer the diff. The reviewer
answers `VERDICT: APPROVE` or `VERDICT: CHANGES`, and the verdict is in the log and on the task's card.

## Autonomy levels

`droid.autonomy` sets Factory's autonomy level for Droid. The box enforces a matching limit itself, in `createTask`:

| Level | Droid | GurtOS |
|---|---|---|
| `low` | File edits and read-only commands; asks before anything else | No network beyond the model; every spend needs an OK (budget 0) |
| `medium` | Also reversible commands; asks before the rest | The task's own hosts; a budget of at most $1 |
| `high` | Runs commands without asking | The task's own hosts and budget |

When Droid asks permission for a command, the worker turns it into a box approval ("Droid wants to run: ...").
If Droid ignored its level, the firewall rule and the budget would still hold.

Factory hooks in the task's home log every tool result as a step, and pause risky commands (`rm -rf`, `git push`,
`sudo`, `npm publish`, `curl ... | sh` and a few more) for your OK. Those hooks are a convenience for an honest agent.
They sit in the task user's home, so a hijacked Droid could delete them. The boundary is the operating system: the
task's own user, its own copy of the files, its firewall rule, its budget and the vault.

## Run `droid exec` on the box

Scripts and CI jobs can send a job to a GurtOS box instead of running Droid on a machine that holds their keys:

```sh
export GURTOS_BOX=https://mybox.example GURTOS_TOKEN=<a paired device's token>
tracks/factory/gurtos-exec.ts --repo https://github.com/you/project.git --auto medium --plan --team \
  "Add a --json flag to the CLI and a test for it"
```

It prints Droid's steps as they happen, and any approval it is waiting for. At the end it prints the diff, the cost and
the Factory credits. With `-o json` it prints one JSON object (`state`, `changes`, `diff`, `costCents`,
`factoryCredits`). The exit code is 0 when the job is done, 1 when it failed and 2 for bad arguments. A dropped
connection is retried for about 30 seconds, and the job keeps running on the box meanwhile.

The flags follow `droid exec`: `--auto low|medium|high`, `-o text|json`, plus `--host` to allow a host, and `--plan`
and `--team`. Behind it is `POST /t/factory/run {prompt, repo? or files?, autonomy?, plan?, team?, hosts?, budgetCents?}`.
`repo` must be an `https://` link to a public repository. The job runs as its own Linux user on its own copy, with the
network you allow, and nothing on your side changes: you take the diff if you want it.

## Usage

The window shows each Droid task's Factory credits, its cost at list price and its budget. It also shows the 5-hour
and weekly use of your Factory plan, read with `FACTORY_API_KEY` from Factory's billing API and cached for 30 seconds.
Only percentages leave the box's core (`GET /t/factory/usage`), never the key.

## Where the code is

- `core/workers/droid.ts` is the worker inside every task: the Factory SDK session, the box's tools and approvals, the
  permission handlers, hooks and droids.
- `track.ts` has the GitHub watcher, the pull request tool, the run route and the usage route. `github.ts` talks to GitHub.
- `app.html` is the window.

## Tests and demo

`npm test` runs `github.test.ts` and `factory.test.ts`: the pull request flow against a local repository, a hook or
config line planted in a task's `.git` that must not run, the token staying out of error messages, overlapping GitHub
checks, and the plan-limits cache.

`DEMO_ONLY=factory ./demo` runs the offline part of the app's step with the scripted worker: the autonomy limits hold,
`gurtos-exec` runs a job and gets its diff back, the job runs as its own user with no network, the four droids are
valid, and usage never contains the key. `DEMO_ONLY=factory ./demo --live-droid` adds a real Droid, which spends Factory
credit: it sends a plan, the demo approves it, the coder fixes `add.js`, the reviewer checks it and the hooks log each
result. `DEMO_LIVE=droid,github` also fixes an issue in a test repository and opens a pull request.
