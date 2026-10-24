# Three OS directions

Ben asked for screens that feel like an operating system, not a B2B dashboard. Each direction shows the same two
screens: the box's own full-screen home (1920 x 1080) and the phone as an approval arrives while tasks run
(390 x 844). They live on the "Directions" page of the
[design file](https://www.figma.com/design/oppzH621OOOMA31rgLbxbM). The research behind them is in `../refs/`.

| Direction | Box home | Phone | Figma node IDs (box, phone) |
|---|---|---|---|
| A. Home-server OS | `a-home-server-box.png` | `a-home-server-phone.png` | `16:20`, `17:25` |
| B. Across-the-room console | `b-console-box.png` | `b-console-phone.png` | `18:20`, `18:85` |
| C. Hardware OS | `c-hardware-box.png` | `c-hardware-phone.png` | `19:20`, `19:179` |

## How each direction maps our ideas onto an OS

| Our idea | A. Home-server OS | B. Across-the-room console | C. Hardware OS |
|---|---|---|---|
| A running task | A dot under its app in the dock, and a "running" widget with progress | A big tile in the "Running now" row; on the phone, the Dynamic Island | A row of dots that fill as it progresses |
| An approval | A notification banner with Approve and Deny on it | The hero card with a focus ring; the phone is the remote that answers | A red light, "NEED YOU 03" in dot-matrix numerals, and an ASK panel |
| The action log | The Activity app | The Activity tab | The LOG key with the event count |
| Undo one task | The Time Machine app and widget | Time Machine tab and the "undone today" tile | The UNDO key |
| Tracks | Apps in the grid: Credit desk, Shopper, Wallet, Find | Tabs along the bottom | Hardware-style keys |
| Resume after a power cut | Not on these two screens. It would arrive like a session restore: a banner, a hero card, or "RESUMED 02" | | |

## The look, and why

**A. Home-server OS.** Like umbrelOS and ZimaOS. Instrument Sans. A flat vector wallpaper (layered hills, no
gradient), light app tiles with one glyph each, and amber badges that count what needs you. The widgets and dock are
frosted glass because that is how this category looks (umbrelOS 01, 02), and the glass is 80% opaque so the text keeps
its contrast on any wallpaper. The banner is opaque and is the only element with a shadow, because it floats above
everything else.

**B. Across-the-room console.** Like SteamOS, tvOS and iPhone StandBy. Atkinson Hyperlegible Next, which the Braille
Institute designed for low vision, at 24 to 76 px. Dark, one amber focus ring on the thing that needs you, nothing else
colored. No glass, no glow.

**C. Hardware OS.** Like Nothing OS and Teenage Engineering. Doto, a dot-matrix face, for numbers and names;
Atkinson Hyperlegible Mono for the rest. Black, white, gray, and one red that only ever means "needs you". Dots carry
information (counts, progress, the money spent) and are never background decoration. Ben's own wallpaper is a
dot-matrix pattern.

## Contrast

All text passes WCAG AA (4.5:1). The lowest pairs: A's banner label 6.3:1, B's secondary text 7.6:1, C's red on black
6.1:1 and gray on black 6.3:1. C's dimmest gray (4.1:1) is used only for large numerals.
