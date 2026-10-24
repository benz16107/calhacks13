# Showcase redesign: three options

Ben picks one; the submission thread builds it in `showcase/`. Design only, no code.
Figma page "Showcase options" in the [design file](https://www.figma.com/design/oppzH621OOOMA31rgLbxbM).
Each option has the home (desktop 1440 and mobile 390) and the Armadin track page. The text is the real copy from
`docs/story.md` and `showcase/src/content/tracks/armadin.mdx`; the images are real screenshots from `portal/screenshots/`,
`personal/screenshots/os/` and the Armadin page. All colours, type, icons and edition modes are the GurtOS system.

| Option | One line | Home, desktop | Home, mobile | Armadin page | Figma nodes (home, mobile, track) |
|---|---|---|---|---|---|
| **A. A GurtOS desktop** | The site is the OS: each sponsor is an app, each page a window | `a-1-home-desktop.png` | `a-2-home-mobile.png` | `a-3-track-armadin.png` | `156:209`, `156:487`, `156:886` |
| **B. An editorial case file** | Quiet paper, big type and ruled ledgers; the OS is the frame and the plates | `b-1-home-desktop.png` | `b-2-home-mobile.png` | `b-3-track-armadin.png` | `157:447`, `157:707`, `157:885` |
| **C. Calm product docs** | A docs site under a daytime Hills hero, with an edition switcher | `c-1-home-desktop.png` | `c-2-home-mobile.png` | `c-3-track-armadin.png` | `158:509`, `158:671`, `158:828` |

## Good and bad

- **A** is the most recognisably GurtOS and the best demo of "it is an OS". It is the heaviest to build (windows, a dock, a wallpaper
  that must scale) and the riskiest on small screens and for long pages, where a window with its own scroll is awkward.
- **B** is the most readable for judges who skim: one column, numbered sections, a ledger of all 18 tracks, the OS only as a frame.
  It is the cheapest to build and the least "OS", and it looks closest to a normal article site.
- **C** is the most familiar and the easiest to extend (sidebar, On this page, an edition switcher bound to the Edition variables).
  It is calm and safe, and the least distinctive: with the Hills hero removed it reads as any docs site.

## Checked against the 30 tells (`~/.claude/rules/design-tells.md`)

Clean on all three: no fake testimonials, no invented demos (real screenshots only), no glow orbs, neon, sparkles, dot grids, bento
grids, rainbow colouring, purple and black, harsh gradients, Lucide icons, emojis, em dashes, checkmark bullets, coloured left
stripes, terminal-window mockups (the evidence is a plain log list) or three-card feature rows (editions are tabs or ruled rows).
Type is Atkinson Hyperlegible, not Inter, Geist or Space Grotesk. The background is the OS's warm paper, not pure white.

Partial, to watch in the build:
- **A** uses translucent dark widgets (the OS's own) but no frosted blur; keep it that way. Its tiles are coloured, but only with the OS app palette.
- **A and C** have corner radii of 10 to 14 px on windows and callouts; B uses 8 and ledger rules. Do not round everything.
- **All**: a screenshot of the OS inside the OS (A's Tasks window) is on purpose. No hover or entry animation on every element: motion only where the OS has it (the Motion sheet).
- **Trust gaps for the real site**: it still needs terms and a privacy page (the footer has no link yet) and loading skeletons, not spinners, for the video.

## Option B2: Ben's picks, revised (Sat Oct 24)

Ben chose B. `b2-1-home-desktop.png` (`162:546`), `b2-2-home-mobile.png` (`162:807`) and `b2-3-track-armadin.png` (`162:979`) replace B.
Changes: "case files" are now "tracks"; the title block and "What was checked" are gone; the page opens with the GurtOS
ecosystem (one core, three editions, then the portal, phone app, remote access and open source); each edition has a real
screenshot; the ruled track list, one readable column and numbered sections stay; the footer links Terms and Privacy.

Screenshots in B2, all real (swapped in as the other threads delivered them):
- **Server:** `portal/screenshots/kiosk.png`, the box's own screen.
- **Personal:** `personal/screenshots/os/everyday.png` (light): mail, a browser, Files with agent emblems, the native GurtOS app,
  the top-bar pill and an approval banner. `everyday-dark.png` exists but shows two Failed rows from setting up the shot.
- **Business:** `portal/screenshots/business-desktop.png` (the portal) beside `business-phone.png` (the phone app), both Rosa
  Delgado on Bright Harbor Catering's $40,000 request, from a dev box seeded as Fogline Supply with scripted seats and sandbox data.

The Terms and Privacy pages do not exist yet; the footer links need targets before the site ships.
