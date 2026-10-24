# /find: the box remembers what is in your photos, files and past tasks

Say "find the whiteboard photo" and the box answers `photos/IMG_2041.jpg`, a photo whose name says nothing
about a whiteboard. It knows because a vision model looked at the photo when it arrived and wrote down what is
in it. Every photo, text file and finished task on the box goes into one index, and Moss searches it.

Agents use it too. A task asks `find.search` through the broker, with no network and no keys of its own, and
gets the same answers Ben gets in the portal. That is the box's memory: what an agent did last week, the
receipt it filed, the note it wrote, all findable by meaning.

## Moss's track

Moss asks for one of three things: a voice agent, a personal agent that remembers you, works across your apps
and handles everyday tasks on its own, or a social post. **This is the second.** The box is a personal agent
computer: agents do everyday work there (shopping, paperwork, code), and through Moss they remember. Ben finds
things by asking, and so does every agent, across every app's files and every task's history.

How the box uses Moss:

- **Moss runs inside the box.** `@moss-js/moss` 1.21 opens a session index: it embeds documents and answers
  queries in the box's own memory with `moss-minilm`, so a search never waits on the network.
- **Moss's cloud keeps a copy.** A few seconds after the index changes, the session pushes it to the project's
  cloud index `find-<hostname>`. Only text goes there: descriptions, file text and task summaries,
  never a photo.
- **Metadata filters** narrow a search to photos, files or tasks (`kind`).
- **If Moss cannot open** (no network at boot), search falls back to matching words and the box tries Moss
  again every minute. Results say which index answered.
- **Instant updates.** A task finishes, its files and its summary are searchable a moment later. Undo the task
  and its files leave the index.

## Latency

Measured on the test VMs on Oct 23 with `DEMO_LIVE=find ./demo laptop` and `./demo linuxbox`, plus a direct test of the SDK.

| Step | Where | Time |
|---|---|---|
| A search through the box (`/t/find/search`), the demo box's whole index | laptop VM (ARM64) and linuxbox VM (x86) | median 3.1 ms wall time; under 1 ms inside Moss (it reports 0 ms) |
| A Moss query, SDK alone, 5 docs | linuxbox VM | 2 to 4 ms wall time |
| Add a document to the index | linuxbox VM | 6 ms for one, 28 ms for four |
| Open the Moss session (loads the embedding model) | linuxbox VM | 3.8 s, once at boot |
| Push the index to Moss's cloud | linuxbox VM | 1.6 s, in the background |
| Describe a photo: gemma4 in Ollama on Ben's Mac | laptop VM | 1.1 to 2.8 s with the model loaded; 6 to 7 s for the first photo after Ollama loads it |
| Describe photos: Claude (`claude-sonnet-4-6`) through one Droid task | linuxbox VM | 34 to 36 s for all four, about 9 s a photo |

Describing is the slow part, and it happens once per photo, when the photo arrives. Searching is fast.

## Which model describes the photos

One function (`describe` in `find.ts`) sends the photo to any OpenAI-compatible chat API; the base URL and the
model name pick the model. The box tries them in order, and the first that answers wins. A model that fails is
skipped for 5 minutes, so a dead one costs one timeout, not one per photo. Each photo's entry
records which model described it and how long it took, and the action log gets a `note` for each one.

| Box | Model | Where the photo goes |
|---|---|---|
| The laptop (demo box on Sunday) | `gemma4` in Ollama on Ben's Mac, at `host.lima.internal:11434` | Nowhere: the Mac's GPU, on the same laptop |
| Vultr (no GPU) | `qwen3.8-27b` on Vultr Serverless Inference | Vultr's API. Needs `VULTR_INFERENCE_KEY` in the vault (see Limits) |
| Either, as the backup | Claude, through a Droid task | Factory, inside a sandboxed task |

**The Claude backup is a box task.** When no model answers for a photo, the box starts one Droid task in that
photo's workspace: "open each photo with your Read tool and describe it", writing `.find/descriptions.json` in
its own copy of the files. The task has no network beyond Factory, no tools and no keys. A photo with hidden
instructions in it can, at worst, spoil its own description. The next scan reads the file. Factory blocks plain
API calls to its model endpoint from outside Droid, so a task is also the only sanctioned way to reach Claude
on these boxes.

The prompt asks the model to start with what kind of thing the photo shows (a whiteboard, a receipt, a product),
then the details and any readable text, then 8 keywords. Without that, gemma4 called the whiteboard "a
presentation slide".

## What gets indexed

- **Photos** (`.jpg`, `.jpeg`, `.png`, `.webp`, `.gif`) in every workspace: the description.
- **Text files** in every workspace up to 200 KB: the path and the first 2000 characters.
- **Tasks**, when they finish, fail or are undone: the title, the state and Droid's final message (or the
  prompt).

It reads each workspace as it is now: the base files plus every done task's changes. Folders starting with `.`
and `node_modules` are skipped, and so are symlinks, so a task cannot point /find at the vault. A file is read
again only when its size or time changes. `BOX_HOME/find/docs.json` holds every entry, so a restart rebuilds the
index in milliseconds without describing anything again. A rescan runs at boot, after every task, and every
minute for files copied straight into a workspace.

The track makes a `photos` workspace on first boot with four test photos we rendered ourselves
(`make-photos.sh`): a whiteboard sketch, a grocery receipt, a battery pack and a printed bar chart. None are real
personal photos. Their names are camera-style (`IMG_2041.jpg`) so a search has to match what is in them.

## For agents: `find.search`

```json
{ "query": "find the whiteboard photo", "kind": "photo", "topK": 3 }
```

Returns `{ query, index, ms, wallMs, results: [{ kind, workspace, path, task, state, model, score, text }] }`,
best first. `index` is `moss`, or `words` on an offline run or a box with no Moss keys.

A task lists `find.search` in its tools. It holds no Moss key: the tool runs in the core.

## For Ben and the portal (under `/t/find/`)

| Route | Does |
|---|---|
| `GET /search?q=<words>&kind=photo\|file\|task&k=5` | The same as `find.search` |
| `GET /file?workspace=photos&path=IMG_2041.jpg` | The file a result points at, to show it. Only inside a workspace; symlinks are refused |
| `GET /status` | How many photos, files and tasks are indexed, and the models in order |

Other tracks can describe a photo with `box.job('find.describe', { file })`.

## Setup

- **Moss:** `MOSS_PROJECT_ID` and `MOSS_PROJECT_KEY` in `/etc/box/vault.env`. All three test VMs have them.
- **Ollama:** nothing on the box. The laptop's Ollama listens on the Mac's localhost and Lima forwards
  `host.lima.internal` to it (spike 6). The Mac must be awake.
- **Vultr:** `VULTR_INFERENCE_KEY`, a Serverless Inference key. Not set anywhere yet.
- **Claude:** `FACTORY_API_KEY`, which the box already has for Droid.

## The demo step

`./demo` runs `demo.ts` after the four moments. Offline by default: the photo descriptions are ones gemma4 wrote
earlier (`recorded.json`, made by `record.ts`) and a word-match index stands in for Moss, so the merge gate needs
no network and costs nothing. It shows:

1. The four test photos described, and "find the whiteboard photo" returning `photos/IMG_2041.jpg`, with the
   model that described it.
2. The portal fetching that photo through `/t/find/file`.
3. An agent with no network asking `find.search` through the broker and getting the same photo.
4. A task writes a packing list. The file is found by a search moments later, and the task by its title.
5. A symlink to the vault, planted in a workspace, is neither indexed nor served.
6. Undo the task: its file leaves the index, the photos stay.

`DEMO_LIVE=find ./demo laptop` describes the photos live with gemma4 and searches with Moss.
`DEMO_LIVE=find ./demo linuxbox` does the same with the Claude backup, since that VM has no Ollama. Both print
each photo's model and time and Moss's query times.

## Limits

- **Vultr's vision model is untested.** The `VULTR_API_KEY` we have is an account key; the account has no
  Serverless Inference subscription, and inference calls return "Invalid API key". Starting a subscription is a
  paid signup, so it waits for Ben. Until then the Vultr box describes photos with the Claude backup.
- Photos go to the model at full size. A 3 MB phone photo spent 2.5 s on the prompt in spike 6; resize to about
  1024 px if real photos are slow.
- Only the first 2000 characters of a text file are indexed. Long files need chunking.
- A failed Claude task is not retried until the box restarts, so a broken backup cannot start tasks in a loop.
- Only photos inside a workspace go to a model; `find.describe` refuses any other path.
- Any task given `find.search` can search every workspace, not only its own. Search results are data: a
  description of a photo with text in it can carry that text into an agent's context.
