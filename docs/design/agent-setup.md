# Command setup: design (Option A, chosen Oct 25)

How an agent on another computer sets up a new GurtOS computer, beside the setup screen and Quick Start. The how-to
for agents is `AGENT-SETUP.md`.

## One setup path

The setup screen, Quick Start and command setup all set a computer up through the same core functions: `setOwner`,
`putKey`, `changeSettings`, `enableApp` / `disableApp`, `remote.enable`, `setupStep`. The routes check who may, then
call them. So the checks and the log are the same whichever way was used.

## The flow

1. The owner, at the new computer's screen, chooses "Set up from another computer". The screen calls
   `POST /api/setup/code` (only allowed from the computer itself) and shows the code and the setup addresses.
2. That opens the setup channel: a listener on port 7701 (`BOX_SETUP_PORT`) that forwards to the API, marking every
   request as coming from the network.
3. The agent trades the code for a setup token: `POST /api/pair {code, kind: 'setup'}`. It's an owner device of kind
   `setup`. Only a setup code pairs as `setup`, and a setup code pairs only as `setup`.
4. The agent drives the setup API through `gurtos` (`core/gurtos.ts`) or the MCP server's setup mode
   (`core/claude-mcp.ts` with `BOX_SETUP_CODE`). Both use `core/setup-client.ts`.
5. `GET /api/setup/doctor` says what is missing (model key, owner on Personal, a paired phone).
6. `POST /api/setup/finish` ends every setup token and closes the channel. So do `POST /api/setup/stop` (the screen's
   Stop) and a two-hour timeout.

## Security

- The code is the root of trust: only the screen can make one, it works once, for 30 minutes, and wrong codes are
  limited to 10 a minute.
- The setup token ends at finish, at Stop, or two hours after it was made, whichever is first.
- The channel never gives the screen's own rights: requests through it carry `x-forwarded-for`, so `isLocal()` is
  false and every call needs the token.
- Keys are write-only: `putKey` tries a model key first, never returns a value, and logs the name only.
- Every step is in the action log, under the agent's device name. `GET /api/setup` shows the channel and who is
  connected, so the screen can show it.

## Option B, not chosen

A temporary `gurtos-setup` ssh account whose forced command was the `gurtos` command, deleted at finish. Not chosen:
GurtOS Server promises no shell, and HTTPS and MCP reach the same setup API without one. On GurtOS Personal the owner
can still turn on ordinary ssh in Settings, Sharing.
