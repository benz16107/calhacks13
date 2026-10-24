# GurtOS apps for iPhone, Apple Watch, Mac and Android

The GurtOS companion as installable apps. They call the same box API as the web app at app.gurtos.com, with a
pairing token of their own. The web app stays the option that needs no install.

| | What it is | Where it comes from |
|---|---|---|
| iPhone | Native SwiftUI app, iOS 26 | TestFlight (internal testing) |
| Apple Watch | Native watchOS app, inside the iPhone app | Installs with the iPhone app |
| Mac | Menu bar app with a Share extension, macOS 26 | Signed, notarized DMG on the GitHub release |
| Android | The web app as a Trusted Web Activity APK | `gurtos-android-0.1.0.apk` on the GitHub release |
| Windows | No app: install app.gurtos.com from Edge | gurtos.com Download page |

## iPhone

| Pairing | Home (Server) | A request | A task |
|---|---|---|---|
| ![](screenshots/iphone-pair-light.png) | ![](screenshots/iphone-home-light.png) | ![](screenshots/iphone-approval-light.png) | ![](screenshots/iphone-task-light.png) |

| Dark | Business, signed in as Rosa | Rosa's request | The notification and its buttons |
|---|---|---|---|
| ![](screenshots/iphone-home-dark.png) | ![](screenshots/iphone-biz-home-light.png) | ![](screenshots/iphone-biz-request-light.png) | ![](screenshots/iphone-notification-actions.png) |

- **Pair** by scanning the machine's QR code in the app (VisionKit), or by typing its address and code. Once
  app.gurtos.com serves its app-site association, the iPhone Camera opens the app straight from the QR code.
- **Computers**: the title menu and the tile at the top right switch between paired computers (Computers, Add a computer), like switching
  accounts. Every computer keeps its own token, edition and, on Business, the person you are.
- **Homes per edition**: Needs you, Running and the kill switch on Server; Ready for you with Keep changes and Undo
  on Personal; Waiting for me first on Business, with the rule that routed each request and who asked.
- **Approve and Deny** sit right in each row. Anything that spends money asks for Face ID first, and the answer
  tells the box how it was checked ("Ben's iPhone (Face ID)" in the log). A Shopper purchase opens the box's own
  passkey page, as on the web.
- **Tasks** show their steps live (the box's log stream), what was blocked, Undo with its confirmation, and Keep.
- **Activity** is the action log in plain words. **Settings** has the machine, Machines, notifications and Forget.
- **Notifications** are end to end encrypted. The app makes its own push keys, and the box encrypts each push for
  them exactly as for the web app (RFC 8291). The relay sends Apple only the ciphertext. The notification service
  extension decrypts it, checks the box's signature with the key this phone gave that box alone, then shows the
  machine's name and the question. Approve and Deny work from the notification when nothing is spent and no
  Business rule routed it; otherwise the button is "Approve with Face ID" and opens the request.
- **Widget**: "2 need you · 3 running" on the Lock Screen and Home Screen. It shows counts only.
- Light and dark, Dynamic Type (Atkinson Hyperlegible Next scales with the text size), VoiceOver labels on every
  control. Liquid Glass comes from the system tab bar, toolbars and the floating Approve and Deny buttons.

Not built: a Live Activity. A pending request has no progress to follow, and keeping one correct with the app
closed needs push-to-update through the relay. The widget and the notification cover the same need.

## Apple Watch

| What waits | $8, approvable on the wrist | $42, only on the iPhone | Watch face complications |
|---|---|---|---|
| ![](screenshots/watch-list.png) | ![](screenshots/watch-small.png) | ![](screenshots/watch-big.png) | ![](screenshots/watch-complications.png) |

- The iPhone's notifications, with their Approve and Deny buttons, appear on the Watch through the same
  notification categories.
- The Watch app lists what waits. On one request's page, double tap approves (`handGestureShortcut(.primaryAction)`).
  The list sets no double-tap action, because the HIG reserves double tap there for scrolling.
- **The safety rule is the box's.** The iPhone asks each machine for a separate Watch token
  (`POST /api/devices/self/watch`). With that token the box approves only when the Watch says it is on the wrist and
  unlocked (watchOS's wrist-detection check), up to Settings `watchLimitCents` ($25 by default). It never approves a
  Business request, a fraud referral or a Shopper purchase that way. Anything else returns a 403 with
  `needs: "iphone"`, and the request keeps waiting for Face ID on the phone. Deny always works. Revoking the iPhone
  revokes its Watch.
- Complications and Smart Stack: circular, corner, rectangular and inline, with counts only, because the Always-On
  display is visible to others. The complication picture above is drawn by the app's debug gallery: the simulator
  can't put a complication on a watch face from a script.

## Mac

| The menu | Ask (⌥⌘G from anywhere) | Pair |
|---|---|---|
| ![](screenshots/mac-menu-light.png) | ![](screenshots/mac-ask-light.png) | ![](screenshots/mac-pair-dark.png) |

- A menu bar extra (a menu, not a popover, as the HIG asks) with the count that needs you, each request with
  Approve (Touch ID when money moves) and Deny, what runs, Machines, the kill switch, Settings and Quit. Settings
  can hide it from the menu bar. Opening the app again shows Settings, so it is never lost.
- ⌥⌘G anywhere opens "Ask your machine" for a new task. Carbon hot keys need no Accessibility permission.
- New requests become Mac notifications, made on the Mac from the live log. Nothing goes through a push service.
- Pairing: drop a screenshot of the QR code, paste its link, or type the address and code.
- **Send to GurtOS** in the Share menu sends up to 8 files (5 MB) to a new task. The box writes them into a
  workspace of their own (`POST /api/tasks {files}`), so the task's copy holds only those files and keeps the box's
  usual limits.
- The menu picture is drawn by the app's `--render-shots` mode from the same model: macOS blocks screen capture
  over ssh. The Ask and Pair pictures are the real views.

## Android

The polished web app as a Trusted Web Activity (Bubblewrap): full screen, the GurtOS icon and colours, and web push
through Chrome. That means notifications with no Google console and no FCM project. `native/android` is the
generated project; `twa-manifest.json` is its source. Once app.gurtos.com serves `/.well-known/assetlinks.json`, the
app opens with no browser bar.

```
cd native/android
BUBBLEWRAP_KEYSTORE_PASSWORD=... BUBBLEWRAP_KEY_PASSWORD=... npx @bubblewrap/cli build --skipPwaValidation
```

The signing key is outside git (the build machine's `~/.config/calhacks13/android/`; `signing/` here is a link to
it). Its SHA-256 is `EB:29:4F:A3:…:55:EF`, the value in assetlinks.json.

## Building and shipping (Apple)

One Xcode project from `native/apple/project.yml` (XcodeGen). Every target shares `GurtKit` (the API, pairing,
the machines list in a shared keychain group, push decryption) and `Shared/` (the look and the answers).

```
native/apple/scripts/build.sh test      # GurtKit's tests (swift test): RFC 8291 vector, a box-made push, pairing links
native/apple/scripts/build.sh sim       # the iPhone app for the simulator
native/apple/scripts/build.sh watch     # the Watch app
native/apple/scripts/build.sh mac       # the Mac app
native/apple/scripts/build.sh upload    # archive and upload to TestFlight
native/apple/scripts/build.sh dmg       # Developer ID, notarized and stapled DMG
native/apple/scripts/testflight.py group   # internal group "GurtOS team", Ben as tester, newest build
```

Signing uses the App Store Connect API key on the build Mac with Xcode's automatic signing. Two things only a
person can do were done once on the web: the App Store Connect app record and the Developer ID certificate. The
APNs key also comes from developer.apple.com, and lives on the relay. No key, profile or certificate is in git.

Simulator checks: `scripts/shots.sh` and `scripts/watch-shots.sh` take the screenshots above against a test box.
`UITests/NotificationTests` allows notifications, receives a push the box's own code encrypted
(`scripts/push.ts`), and opens its buttons. `simctl push` skips service extensions, so debug builds run the same
decrypt code (`Shared/PushContent.swift`) on that payload.

## The demo step

`native/demo.ts` runs in `./demo` (core/demo.ts loads it). It makes every call the apps make, as a paired iPhone
off the box: pair with a code, read every home, approve with Face ID recorded, the second answer losing, Undo, the
log stream, an APNs push subscription, the Watch token and its limits ($8 approved on the wrist, $40 refused and
still waiting, the iPhone approving it, Deny always allowed), shared files reaching a task and bad ones refused,
and Forget revoking the phone and its Watch. 25 checks.

## Limits

- TestFlight is internal only. There is no App Store submission and no external beta review.
- The Mac app has no TestFlight build: that would need a second App Store Connect record. The DMG is the Mac
  download.
- Native push needs the relay's APNs support (`relay/`, branch `relay-apns`) and Ben's APNs key on the relay.
  Until then the iPhone app is live while open, and the Mac app notifies from its live connection.
- The Watch shows what its iPhone last saw, and can deny through it, when a machine runs a core without Watch tokens.
