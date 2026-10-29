# Example

A small app for people who write their own apps for GurtOS. Copy this folder, rename it and delete what you
do not need. It is not part of the GurtOS images and is never turned on by default, because it does nothing useful.

It shows one of every slot an app can use. The slots are listed in [core/README.md](../../core/README.md#writing-a-track).

| Slot | What the example does |
|---|---|
| `tools` | `example.spend` spends test money (no real payment) through the broker. It shows a cost, an approval with a payee, and a metered charge that is lower than the cap. |
| `secrets` | `DEMO_SECRET` is read by the tool and by a route. Neither returns it. |
| `routes` | `GET /t/example/` is a page, `GET /t/example/whoami` shows who the box says is calling, `GET /t/example/secret-check` reads a vault key and returns a fact about it, and `POST /t/example/start` starts a task. |
| `triggers` | A webhook (`POST /hook/example/start`), a watched folder (`inbox/example` in the box's data folder) and an hourly schedule each start a task. |
| `logReaders` | `count` sees every finished task, in order, and resumes where it stopped after a restart. |
| `modelJobs` | `example.echo` returns its input. |
| `apps` | One window in the portal's app list. |

## Try it

On a test box (not your own computer: running the box needs root), turn the app on in the App Center, then:

```sh
curl -X POST http://127.0.0.1:7700/t/example/start -H 'content-type: application/json' -d '{"prompt":"write hello.txt hi"}'
```

The tasks use the scripted `fake` worker, so no model key is needed.

`demo.ts` is the app's step in the merge gate. Run it alone with `DEMO_ONLY=example ./demo`.

## Rules the example follows

- It imports only types from `core/contract.ts`.
- Its tool is named `<app>.<verb>`.
- A route answers a bad request with a 400 and a reason, and a missing vault key with a 404, instead of failing.
- Keys stay in the vault. A route may read one with `box.secret(name)` but never returns it.
