# GurtOS screens, version 2 (checkpoint)

The first screens built with the GurtOS system (`../system.md`), for Ben's review before the rest. They are on the
page "GurtOS screens v2" of the [design file](https://www.figma.com/design/oppzH621OOOMA31rgLbxbM). Every screen is
1920 x 1080, the box's own screen, and is built only from the components on the page "GurtOS system".

| PNG | Node | What it shows |
|---|---|---|
| `1-setup-welcome.png` | `54:86` | Server setup, step 1 of 12: language, keyboard, accessibility, and "Set up from your phone" with a QR code. The step list on the left is the progress indicator. Back is disabled on the first step |
| `2-setup-apps.png` | `55:302` | Step 7: choose apps. Each app shows the hosts it can reach and the keys it needs before you turn it on. Shopper says test payments only. The footer counts what the next step will ask for |
| `3-settings-permissions.png` | `56:446` | The desktop with Settings open on Permissions: the default network policy, asking before a new host, the folders agents may use (with Add a folder), the approval threshold, the default budget, and quiet hours |
| `3-settings-permissions-dark.png` | `57:1122` | The same window in the Dark mode of the same variables, with no other change |
| `4-desktop-tasks.png` | `57:722` | The desktop with Tasks as a window in the manner of Activity Monitor: views in the header bar, one row per task with the user it runs as, its state, what it is doing now and its cost, and a summary strip |

System sheets: `system-foundations.png` (colors in both modes, type, spacing, radius, elevation, motion),
`system-icons.png` (the 51 Adwaita symbolic icons), `system-app-icons.png`, `system-controls.png` and
`system-lists-and-chrome.png`.

Example data: task IDs, costs, times and folder paths are made up for the mockup. The apps, hosts and key names on
the Apps step come from the tracks' code on main.
