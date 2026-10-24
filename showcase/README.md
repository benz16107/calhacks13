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
| `src/content/tracks/<slug>.mdx` | One page per track. Frontmatter: criteria, video, screenshots, live links, flow diagram, live or test. Body: evidence, how it works, try it, limits |
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

## Update a video

Upload as Unlisted on YouTube, put the id into `src/data/videos.ts`, then build, check and deploy.

## Update the merge gate output

```sh
./demo linuxbox > /tmp/demo.txt 2>&1      # from the repo root
grep -v '^demo: /\|^added \|^$' /tmp/demo.txt > showcase/src/data/demo-latest.txt
```

The overview counts the `ok` lines itself.

## Deploy

Static files on Vercel, project `gurtos-calhacks`, domain `calhacks.gurtos.com` (a CNAME at GoDaddy). Vercel's CLI is
signed in on the laptop, so build here, then deploy from there with the built folder, outside any git checkout so
Vercel does not connect the repository:

```sh
npm run build && npm run check
rm -rf /tmp/gurtos-calhacks && cp -r dist /tmp/gurtos-calhacks && cp vercel.json /tmp/gurtos-calhacks/
rsync -a --delete --exclude .vercel --exclude .vercelignore /tmp/gurtos-calhacks/ benmac:/tmp/gurtos-calhacks/
ssh benmac 'cd /tmp/gurtos-calhacks && rm -f .env.local .gitignore && vercel deploy --prod --yes'
```

The first deploy ran `vercel link --yes --project gurtos-calhacks` there, which also wrote a `.env.local`; the
`.vercelignore` in that folder keeps `.env*` out of every upload. To roll back, promote the previous deployment: `vercel rollback` in that folder, or in the Vercel dashboard.
