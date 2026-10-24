# Showcase: calhacks.gurtos.com

The Cal Hacks 13.0 showcase for GurtOS: an overview page and one page per sponsor track. It is separate from the
product docs at gurtos.com (`site/`), which stay free of anything about the hackathon.

```sh
npm ci
npm run dev        # live preview
npm run build      # static site in dist/
npm run check      # after a build: privacy scan, then every internal link and anchor resolves
node scripts/link-check.mjs dist --external   # also fetches every outside link
```

## Where things are

| Path | What |
|---|---|
| `src/content/tracks/<slug>.mdx` | One page per track. Frontmatter: criteria, video, screenshots, live links, flow diagram, live or test. Body: free-form, composed from `src/components/kit/` (see Writing a track page) |
| `src/components/kit/`, `TrackNav.astro`, `RunsOn.astro` | The component kit, the sticky track bar and the "Runs on top of GurtOS" box |
| `src/content.config.ts` | The schema every track page follows |
| `src/pages/index.astro` | The overview: the four moments, editions, Cal Hacks prizes, the track list, the merge gate |
| `src/data/videos.ts` | Narrated YouTube ids. Empty means the page shows its silent evidence clip |
| `src/data/clips.json`, `public/clips/` | Silent screen recordings of the real app, recorded with Playwright (`scripts/clips/`) |
| `src/data/demo-latest.txt` | The latest full `./demo` output, with the test machine's address lines removed |
| `src/data/site.ts` | Links used on several pages |
| `src/assets/repo/` | Screenshots copied from the repo (`portal/`, `personal/`, `tracks/*/`, `docs/figma/`), checked by eye for private details |
| `src/assets/shots/` | Fresh screenshots of the app, taken for this site with `scripts/clips/` |
| `src/assets/track/<slug>/` | Screenshots made for one track page (Explorer, Agentverse, Mana, the credit desk run) |
| `scripts/clips/` | `clip-box.sh` starts a throwaway box on the test VM with a neutral name; `record.mjs` records the clips and stills with Playwright; `encode.sh` makes the MP4s |
| `public/devpost/` | The three images the Devpost page embeds and uploads |

**Privacy.** Nothing on the site may show a key, token, password, email, IP address or the name of one of Ben's
machines. `npm run check` scans the built text. Images cannot be scanned, so look at every new screenshot before
adding it. The pairing screenshots in `portal/screenshots/` show a private address and are not used.

## Writing a track page

Every track is told its own way for its own judges. A page opts in with `design: kit` in its frontmatter (the default,
`legacy`, is the old fixed template). A kit page renders only the header, a sticky bar and **your MDX body**; you compose
the body from the components below. They are available in every track's MDX without an import. Frontmatter (`criteria`,
`pitch`, `proof`, `status`, `shots`, `links`) is still required: `pitches.py` and `bible.py` read it, and legacy pages
render it. For a kit page, repeat what you want shown as components in the body.

What you get for free on every track page, kit or legacy:

- A sticky bar: back to Tracks, the track's number and name, previous and next track, and **On this page**, a list built
  from the page's `h2` headings (so use `##` or a component's title for every section you want in it).
- The **Runs on top of GurtOS** box, folded, at the end of a kit page (`src/components/RunsOn.astro`, one place for the
  minimum hardware and the OS claims). Do not edit it from a track page.
- Light and dark from the shared theme. Use the tokens (`var(--color-*)`, `var(--space-*)`), never hex colours.

| Component | Props (slot = the content between the tags) |
|---|---|
| `<Lead>` | slot: the 30-second version, 2 to 4 sentences. `proof` (HTML): one line of evidence. `kicker` (default "In 30 seconds") |
| `<Shot>` | `src` = path under `src/assets/` (`"repo/portal/x.png"` or `"portal/x.png"`) or an imported image; `dark` = the same screen in dark; `alt`; `caption` (HTML); `size` = `wide` (default), `narrow`, `phone`. Click enlarges (the dark image when the page is dark) |
| `<Clip>` | `name` = a clip from `src/data/clips.json`, or `src` (an mp4 under `public/` or a `.gif`) with `poster`, `alt`, `caption`. Muted, looping, pauses off screen, has a Pause button, and shows only the poster under reduced motion |
| `<Compare>` | `labels={['Before', 'After']}`; put one `<div slot="a">` and one `<div slot="b">` inside, each with markdown or a `<Shot>` (leave blank lines around the markdown). Stacks on phones |
| `<CriteriaMap>` | `sponsor`, `source` (where the criteria are quoted from, HTML), `items={[{ ask, status: 'met' \| 'partly' \| 'open', how, evidence: [{ label, href }] }]}`. Quote the sponsor's own words in `ask` |
| `<Details>` | `summary`; slot: technical depth, markdown. `open` to start open |
| `<OSvsTrack>` | `sponsor`, `rows={[{ what, why, os, track, status }]}`: one row per feature, saying what the OS provides and what the sponsor's product provides. `bible.py` reads these rows for `docs/story.md`, so this is where a feature's status ("Being built") lives |
| `<Steps>` | `title`, `time`; slot: a numbered markdown list (blank line after the opening tag) |
| `<Evidence>` | `title`, `run` (what was run, when), `numbers={[{ value, label }]}`, `sources={[{ label, href }]}`; slot: a code block or list of log lines |
| `<Limits>` | `title`; slot: a list of what is not covered. Say it plainly; judges trust it |
| `<Flow>`, `<Status>`, `<LinkList>`, `<Video>` | The older components, still available. `Flow` and `Status` read their data from frontmatter; `Video` shows the narrated video or a clip |

Rules that hold on every page (see `docs/story.md`): claim nothing the code does not do; label test money and what is
simulated; only sourced incidents on the finance pages; no em dashes; no private details in screenshots (check each image
by eye, `npm run check` cannot). Section order, how many sections and which components to use are your call.

A small page, to copy:

```mdx
---
design: kit
order: 5
sponsor: Armadin
prize: Best Security Hack
title: The booby-trapped page that steals nothing
editions: All three
pitch: 'Agents get attacked through the pages they read.'
summary: 'One-paragraph summary.'
proof: 'What the merge gate shows.'
criteriaSource: 'Armadin brief'
criteria:
  - ask: 'Show a real attack stopped'
    how: 'The vault read fails and the send is refused.'
---

<Lead proof="Merge gate: <code>175 checks</code>, 0 failed.">
An agent reads a page with hidden instructions and finds nothing to steal.
</Lead>

<Clip name="moment-2-blocked" />

## Why an operating system

On an ordinary OS the agent can read every key. On GurtOS the vault is root only.

<Shot src="portal/live-agents.png" alt="The Live board" caption="The Live board. Demo data." />

<Steps time="About two minutes.">

1. Open the box screen.
2. Start the task.

</Steps>

<Limits>

- Two attacks are published as not covered.

</Limits>
```

Build and look before you push: `npm run build && npm run check`, then open the page in `npm run dev` in light and dark and
on a phone width. Only edit your own `src/content/tracks/<track>.mdx`; anything else in `showcase/` is the submission thread's.

## Update a video

Videos are produced by the team after the build. Upload each as Unlisted on YouTube, put the id into
`src/data/videos.ts`, then build, check and deploy.

## Update the merge gate output

```sh
./demo <test VM> > /tmp/demo.txt 2>&1     # from the repo root; the x86 test VM gave the published run
grep -v '^demo: /\|^added \|^$' /tmp/demo.txt > showcase/src/data/demo-latest.txt
```

The overview counts the `ok` lines itself.

## Theme

The header, footer, colours, fonts and the light and dark toggle are the shared GurtOS web theme in `../site/src/theme/`,
imported by `src/layouts/Base.astro` and `src/styles/global.css`. Do not copy it. Astro needs `site/` to resolve
`astro`, so before the first build run `ln -s ../showcase/node_modules ../site/node_modules` (git ignores it). Terms and
Privacy redirect to gurtos.com.

## Deploy

Static files on Vercel, project `gurtos-calhacks`, domain `calhacks.gurtos.com` (a CNAME at GoDaddy). Build here, then
deploy the built folder from a machine signed in to Vercel (`$VERCEL_HOST`), outside any git checkout so Vercel does
not connect the repository:

```sh
npm run build && npm run check
rm -rf /tmp/gurtos-calhacks && cp -r dist /tmp/gurtos-calhacks && cp vercel.json /tmp/gurtos-calhacks/
rsync -a --delete --exclude .vercel --exclude .vercelignore /tmp/gurtos-calhacks/ "$VERCEL_HOST:/tmp/gurtos-calhacks/"
ssh "$VERCEL_HOST" 'cd /tmp/gurtos-calhacks && rm -f .env.local .gitignore && vercel deploy --prod --yes'
```

The first deploy ran `vercel link --yes --project gurtos-calhacks` there, which also wrote a `.env.local`; the
`.vercelignore` in that folder keeps `.env*` out of every upload. To roll back, promote the previous deployment: `vercel rollback` in that folder, or in the Vercel dashboard.
