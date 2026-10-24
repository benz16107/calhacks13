---
title: Search your files with /find
description: Index the photos, text files and finished tasks on the box so you and your agents can find them by what they contain, not by file name.
---

The Find app keeps one index of every photo, text file and finished task on the box. A vision model you choose describes each photo once, when it arrives, so a search for "the whiteboard photo" finds `photos/IMG_2041.jpg`. Agents search the same index through a tool, with no network and no keys of their own. In this guide you connect the index, choose how photos are described, and run a search.

## Before you start

- A box with a root shell and the Find app installed (it ships with GurtOS, in `tracks/find/`).
- A Moss project, with its project id and key, for search by meaning. Without one, search falls back to matching words.
- At least one vision model the box can reach. See step 2.

## Steps

1. **Add the Moss keys to the vault.** See [Add a secret](/guides/add-a-secret/).

   ```ini
   MOSS_PROJECT_ID=your-project-id
   MOSS_PROJECT_KEY=your-project-key
   ```

   Restart the box service. Moss runs inside the box: it embeds documents and answers queries in the box's own memory, so a search never waits on the network. A Moss session is open only while someone searches, and closes after 2 quiet minutes, because Moss bills open sessions by the minute. Search never needs Moss's cloud. To keep a cloud copy too, set `FIND_CLOUD_SYNC=1` in the box service's environment: the box then pushes its index when a session closes, at most every 10 minutes and only when it changed. Only text goes there (descriptions, file text and task summaries), never a photo.

2. **Choose how photos are described.** A fresh box calls no model. Each one is used only when its key is set in the vault, in Settings or App Center. Until then photos wait, and the Find page says how many are not described yet.

   | Vault key | Model | Where the photo goes |
   |---|---|---|
   | `FIND_OLLAMA_URL` | `gemma4` in Ollama, at the address you give, such as `http://192.0.2.20:11434/v1` | Your own machine running Ollama. Nothing leaves your network |
   | `VULTR_INFERENCE_KEY` | `qwen3.8-27b` on Vultr Serverless Inference | Vultr's API |
   | `FACTORY_API_KEY`, on request | Claude, through one sandboxed Droid task | Factory |

   The box tries the models whose keys are set, in that order, and the first that answers wins. A model that fails is skipped for 5 minutes, so a dead one costs one timeout, not one per photo. Each photo's entry records which model described it.

   **Claude describes photos only when you ask.** It spends model money, so nothing starts it at boot or on a schedule. The Find page shows "N photos are not described yet" with a **Describe with Claude** button (`POST /t/find/describe`). That starts one Droid task per workspace, which has no network beyond Factory, no tools and no keys. So a photo leaves the box only if you set a hosted model's key or press that button.

3. **Add files.** The app makes a `photos` workspace on first start with four test images. Copy your own into any workspace:

   ```sh
   sudo cp ~/Pictures/*.jpg /var/lib/box/workspaces/photos/
   ```

   The box rescans at boot, after every task, and every minute for files copied straight into a workspace.

4. **Search** with the app's route:

   ```sh
   curl -s 'http://127.0.0.1:7700/t/find/search?q=whiteboard%20photo&kind=photo&k=3'
   ```

![A search panel over the desktop with results from tasks, the action log, files and photos.](../../../assets/screens/design-find.png)

*Find, from the current design. The data and photos are examples.*

:::caution[Planned]
A Find window in the portal is designed, as above, but not built in this release. Search with the route or, from a task, with `find.search`.
:::

## Check it worked

```sh
curl -s http://127.0.0.1:7700/t/find/status
```

It shows how many photos, files and tasks are indexed, and the models in the order the box tries them. Each search result says which index answered (`moss`, or `words` without Moss) and, for a photo, which model described it.

## What gets indexed

- **Photos** (`.jpg`, `.jpeg`, `.png`, `.webp`, `.gif`) in every workspace: the model's description.
- **Text files** up to 200 KB in every workspace: the path and the first 2,000 characters.
- **Tasks**, when they finish, fail or are undone: the title, the state, and Droid's final message or the prompt.

The app reads each workspace as it is now: the base files plus every done task's changes. Undo a task and its files leave the index. Folders starting with `.`, `node_modules` and symlinks are skipped, so a task cannot point the index at the vault.

## For agents: `find.search`

A task that lists `find.search` in its tools can call it through its broker:

```json
{ "query": "find the whiteboard photo", "kind": "photo", "topK": 3 }
```

It returns `{ query, index, ms, wallMs, results: [{ kind, workspace, path, task, state, model, score, text }] }`, best first. The task holds no Moss key: the tool runs inside the box service.

## Routes

All under `/t/find/` on the box's API.

| Route | Does |
|---|---|
| `GET /search?q=<words>&kind=photo\|file\|task&k=5` | The same as `find.search` |
| `GET /file?workspace=photos&path=IMG_2041.jpg` | The file a result points at. Only inside a workspace; symlinks are refused |
| `GET /status` | Counts, and the models in order |

Other apps can describe a photo with `box.job('find.describe', { file })`.

## Limits

- Photos go to the model at full size. Large phone photos are slow to describe.
- Only the first 2,000 characters of a text file are indexed.
- A photo handed to a Claude describe task is not handed out again, even after a restart, unless that task failed over an hour ago.
- Any task given `find.search` can search every workspace, not only its own.
- Search results are data. A photo with text in it can carry that text into an agent's context, so treat results like any other untrusted input.

## Related

- [Workspaces and layers](/concepts/workspaces-and-layers/)
- [The vault and the broker](/concepts/vault-and-broker/)
- [Apps and slots](/concepts/apps-and-slots/)
- [Included apps](/reference/apps/)
