# /find: the box remembers what is in your photos, files and past tasks

Say "find the whiteboard photo" and the box answers `photos/IMG_2041.jpg`, a photo whose name says nothing
about a whiteboard. It knows because a vision model looked at the photo when it arrived and wrote down what is
in it. Every photo, text file and finished task on the box goes into one index, and Moss searches it.

Agents use it too. A task asks `find.search` through the broker, with no network and no keys of its own, and
gets the same answers you get on the Find page. That is the box's memory: what an agent did last week, the
receipt it filed, the note it wrote, all findable by meaning.

## Moss's track

Moss asks for one of three things: a voice agent, a personal agent that remembers you, works across your apps
and handles everyday tasks on its own, or a social post. **This is the second.** The box is a personal agent
computer: agents do everyday work there (shopping, paperwork, code), and through Moss they remember. You find
things by asking, and so does every agent, across every app's files and every task's history.

How the box uses Moss:

- **Moss runs inside the box.** `@moss-js/moss` 1.21 opens a session index: it embeds documents and answers
  queries in the box's own memory with `moss-minilm`, so a search never waits on the network.
- **A session is open only while someone searches.** Moss bills an open session by the minute ("session
  minutes", $0.05 each past the free plan's $5 monthly credit), and an always-on box holding one open used up the
  project's credit on Oct 24. Now indexing only updates `docs.json` on the box. A search opens a session,
  restores the last one from disk (`loadFromDisk`) and embeds only the docs that changed since, so it answers in
  under a second; later searches take a few ms. After 2 quiet minutes the session saves itself (`saveToDisk`)
  and closes. A doc added while it is open goes straight in.
- **Moss's cloud can keep a copy, on one box only.** Search never needs the cloud. A box with
  `FIND_CLOUD_SYNC=1` in its environment pushes its index to the cloud index `find-<hostname>` when a session
  closes, at most every 10 minutes and only when the index changed (a hash of its contents, kept across
  restarts). It never opens a session just to push. Turn it on for one box per Moss project (a systemd drop-in,
  below). Only text goes there: descriptions, file text and task summaries, never a photo.
- **If Moss cannot answer** (no network, or the project is over its usage limit), the search is answered by
  matching words, and the result's `index` says so. After a usage-limit error the box does not call Moss for an
  hour and logs it once. `/t/find/status` and
  every search result also say `cloud copy paused: Moss usage limit` on the opt-in box.
- **Metadata filters** narrow a search to photos, files or tasks (`kind`).
- **Instant updates.** A task finishes, its files and its summary are searchable a moment later. Undo the task
  and its files leave the index.

## Latency

Measured on Oct 23 and 24 on two test VMs (an ARM64 Lima VM on a MacBook and an x86 VM with 6 cores), with
`DEMO_LIVE=find ./demo` and a direct test of the SDK.

| Step | Where | Time |
|---|---|---|
| A search through the box (`/t/find/search`), the demo box's whole index | ARM64 and x86 test VMs | median 3.1 ms wall time; under 1 ms inside Moss (it reports 0 ms) |
| The first search after 2 quiet minutes (opens a session, restores it from disk, embeds 1 changed doc) | x86 test VM | 0.7 s |
| The very first search on a box (no saved session yet: embeds every doc) | x86 VM; ARM64 VM | 9.7 s for 61 docs; 14.6 s for 100 docs |
| A Moss query, SDK alone, 5 docs | x86 test VM | 2 to 4 ms wall time |
| Add a document to the index | x86 test VM | 6 ms for one, 28 ms for four |
| Open a Moss session, first time on a machine (downloads the embedding model) | x86 test VM | 3.8 s, once |
| Push the index to Moss's cloud (opt-in box only) | x86 test VM | 1.6 s, as a session closes, at most every 10 minutes |
| Describe a photo: gemma4 in Ollama on the Mac hosting the VM | ARM64 test VM | 1.1 to 2.8 s with the model loaded; 6 to 7 s for the first photo after Ollama loads it |
| Describe photos: Claude (`claude-sonnet-4-6`) through one Droid task | x86 test VM | 34 to 36 s for all four, about 9 s a photo |

Describing is the slow part, and it happens once per photo. Searching is fast.

## Which model describes the photos

One function (`describe` in `find.ts`) sends the photo to any OpenAI-compatible chat API; the base URL and the
model name pick the model. The box tries them in order, and the first that answers wins. A model that fails is
skipped for 5 minutes, so a dead one costs one timeout, not one per photo. Each photo's entry
records which model described it and how long it took, and the action log gets a `note` for each one.

**A fresh box calls no model.** Each model is used only when its key is set in the vault (Settings, or App
Center). Until then photos wait, and the Find page says how many are not described yet.

| Vault key | Model | Where the photo goes |
|---|---|---|
| `FIND_OLLAMA_URL` | `gemma4` in Ollama, at the address you give, such as `http://192.168.1.20:11434/v1` or, from a Lima VM, `http://host.lima.internal:11434/v1` | Your own machine running Ollama. Nothing leaves your network |
| `VULTR_INFERENCE_KEY` | `qwen3.8-27b` on Vultr Serverless Inference | Vultr's API |
| `FACTORY_API_KEY`, on request | Claude, through a Droid task | Factory, from inside a sandboxed task |

**Claude describes photos only when you ask.** It spends model money, so nothing starts it at boot or on a
schedule. The Find page shows "N photos are not described yet" with a **Describe with Claude** button
(`POST /t/find/describe`). That starts one Droid task per workspace: "open each photo with your Read tool and
describe it", writing `.find/descriptions.json` in its own copy of the files. The task has no network beyond
Factory, no tools and no keys. A photo with hidden instructions in it can, at worst, spoil its own description.
The next scan reads the file. A photo handed to a task is not handed out again, even after a restart, unless that
task failed over an hour ago. These describe tasks are housekeeping: they are kept out of the search index.

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

Returns `{ query, index, ms, wallMs, cloud, results: [{ kind, workspace, path, task, state, model, score, text }] }`,
best first. `index` is `moss`, or `words` on an offline run or a box with no Moss keys.

A task lists `find.search` in its tools. It holds no Moss key: the tool runs in the core.

## The Find app (under `/t/find/`)

`/t/find/` is the Find window in the app grid: a search box, results grouped as tasks, files and photos, and which
index answered. It uses the GurtOS kit, so off the box's own screen its calls carry the paired device's token.

| Route | Does |
|---|---|
| `GET /search?q=<words>&kind=photo\|file\|task&k=5` | The same as `find.search` |
| `GET /file?workspace=photos&path=IMG_2041.jpg` | The file a result points at, to show it. Only inside a workspace; symlinks are refused |
| `GET /status` | How many photos, files and tasks are indexed, how many photos wait for a description (`undescribed`), each model and whether its key is set, and the cloud copy's state (`cloud`) |
| `POST /describe` | Ask Claude to describe the photos no other model could (needs `FACTORY_API_KEY`) |

Other tracks can describe a photo with `box.job('find.describe', { file })`.

## Setup

All optional. With none of them, search matches words and photos are found by their file names.

- **Moss:** `MOSS_PROJECT_ID` and `MOSS_PROJECT_KEY` in the vault. Without them, search matches words.
- **A photo model:** `FIND_OLLAMA_URL` or `VULTR_INFERENCE_KEY` (table above), or `FACTORY_API_KEY` to use the
  Describe with Claude button.
- **Moss cloud copy:** off unless the box's environment has `FIND_CLOUD_SYNC=1`, for example a drop-in that an
  update leaves alone: `/etc/systemd/system/box.service.d/find.conf` with `[Service]` and
  `Environment=FIND_CLOUD_SYNC=1`. Turn it on for one box only if several share a Moss project.

## The demo step

`./demo` runs `demo.ts` after the four moments. Offline by default: the photo descriptions are ones gemma4 wrote
earlier (`recorded.json`, made by `record.ts`) and a word-match index stands in for Moss, so the merge gate needs
no network and costs nothing. It shows:

1. With no model set, the box starts no describe task on its own. The four test photos described, and "find the whiteboard photo" returning `photos/IMG_2041.jpg`, with the
   model that described it.
2. The portal fetching that photo through `/t/find/file`.
3. An agent with no network asking `find.search` through the broker and getting the same photo.
4. A task writes a packing list. The file is found by a search moments later, and the task by its title.
5. A symlink to the vault, planted in a workspace, is neither indexed nor served.
6. Undo the task: its file leaves the index, the photos stay.

`DEMO_LIVE=find ./demo` describes the photos live with the models whose keys the test machine's vault has, and
searches with Moss. With no photo model set there, add `droid` (`DEMO_LIVE=find,droid`): the demo presses Describe
with Claude for you (a demo box refuses Droid tasks unless the run names `droid`; they spend Factory credit). It
prints each photo's model and time and Moss's query times.

## Limits

- **Vultr's vision model is untested.** It needs a Serverless Inference subscription, which we did not have.
- Photos go to the model at full size. A 3 MB phone photo spent 2.5 s on the prompt in spike 6; resize to about
  1024 px if real photos are slow.
- Only the first 2000 characters of a text file are indexed. Long files need chunking.
- Only photos inside a workspace go to a model; `find.describe` refuses any other path.
- Any task given `find.search` can search every workspace, not only its own. Search results are data: a
  description of a photo with text in it can carry that text into an agent's context.
