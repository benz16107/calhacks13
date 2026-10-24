# GurtOS phone app: one app for every machine

One companion app for all three editions. You install it once from app.gurtos.com to the Home Screen, pair it with
each machine, and switch between machines the way you switch accounts in other apps. Every notification names the
machine it came from. iPhone, 390 x 844, in the approved GurtOS system (`../system.md`). The Figma page is "GurtOS
phone app" in the [design file](https://www.figma.com/design/oppzH621OOOMA31rgLbxbM).

`0-overview.png` (node `134:14809`) shows all twelve screens.

## Screens

| PNG | Node | What it shows |
|---|---|---|
| `1a-switch-machine.png` | `132:241` | The Machines sheet, opened from the machine name at the top of any home. Each machine shows its edition, online state ("Online", or "Asleep · seen 18:52"), what waits for you, and a check on the current one. For a GurtOS Business machine it also says who you are: "Signed in as Rosa Delgado, Controller". Then Add a machine |
| `1b-add-a-machine.png` | `132:362` | Add a machine: the in-app scanner, where to find the QR code on each edition, and Type the code instead |
| `2a-home-server.png` | `130:87` | Home, GurtOS Server ("Home box"): what needs you, what runs, and the kill switch (Pause all agents) |
| `2b-home-personal.png` | `130:174` | Home, GurtOS Personal ("Ben's laptop"): a finished folder task with what changed in the copy, Review changes, Undo and Keep changes; what runs; what was kept, with Put back |
| `2c-home-business-rosa.png` | `130:295` | Home, GurtOS Business ("Fogline Supply"), signed in as Rosa: Waiting for me, with the Business tabs (Waiting, Tasks, Audit, Settings) |
| `3a-lock-screen-notification.png` | `133:324` | The lock-screen notification. iOS shows the app (GurtOS); the title is the machine, "Fogline Supply", and the body is the question: "Approve a $40,000 credit line? Bright Harbor Catering, asked by Sam Ortiz. Over $10,000 goes to the Controller." |
| `3b-approval-from-notification.png` | `133:381` | What tapping it opens: the request on Fogline Supply, with a chip saying which machine and who you are, the agent's checks, and Deny and Approve $40,000 |
| `4a-install-scan.png` | `133:445` | Install, step 1: the Camera app reads the QR code on the machine's screen and offers app.gurtos.com |
| `4b-install-safari.png` | `133:469` | Step 2: app.gurtos.com in Safari explains the four steps and points at Safari's Page Menu button |
| `4c-install-add-to-home-screen.png` | `133:514` | Step 3: iOS's Add to Home Screen sheet, with Open as Web App on |
| `4d-install-allow-notifications.png` | `133:585` | Step 4: opened from the Home Screen, GurtOS asks for notifications after a tap on Turn on notifications |
| `4e-install-pair.png` | `133:627` | Step 5: pairing with Home box inside the installed app (the existing pairing screen, `91:6834`) |

## Why it works this way

- **Pairing happens inside the installed app, not in Safari.** A Home Screen web app keeps its own storage, separate
  from Safari, and only the Home Screen app can subscribe to push. So the Safari page (4b) only explains how to
  install, and the app pairs after it opens (4e). On iOS 26 the steps are: Page Menu (⋯), Share, Add to Home Screen,
  leave Open as Web App on, Add ([Apple Support](https://support.apple.com/guide/iphone/open-as-web-app-iphea86e5236/ios)).
- **Notifications are asked for after a tap.** iOS shows the permission prompt only after a user gesture in the
  installed app, so 4d has its own Turn on notifications button and a Not now.
- **The notification has no Approve button.** Sources disagree on whether iOS shows action buttons on web
  notifications, and approving spends money. So tapping opens the request (3b), on the right machine even if the app
  was showing another one. The title names the machine. The app name and icon come from iOS, so the text doesn't
  repeat them, per Apple's notification guidelines.
- **Switching is like switching accounts.** Each pairing keeps its machine's name, edition, connection, device token
  and, on Business, the person it belongs to. The machine name with its tile and a chevron is the title of every home;
  tapping it opens the Machines sheet. On Business you approve as yourself; on Server and Personal the phone answers
  for the owner.
- **The app icon is the GurtOS Tasks tile**, the same one GurtOS Personal uses in its dock.
- **The QR code in 1b and 4a is an example.** It encodes `https://app.gurtos.com/pair#example` and holds no real
  pairing code.

## What it needs from the box and app.gurtos.com

- Server: what needs you, what runs and the costs are in the existing API. The kill switch is `POST /api/pause` and
  `POST /api/resume` from the Business core (branch `business`); Server needs the same for its owner.
- Personal: a finished folder task's change summary, Keep and Undo, and Put back.
- Business: `GET /api/me` gives Waiting for me for the paired person.
- app.gurtos.com: the install page, the Home Screen manifest and icon, push, and a way to reach each paired machine.
  How it reaches a machine is up to the remote access work.
