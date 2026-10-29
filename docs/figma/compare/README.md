# The real app beside Figma

Each image here puts a Figma frame on the left, a screenshot of the real app in the middle, and a third panel that
marks in red every pixel where the two differ. They are made by `compare.ts` from the pairs in `pairs.json`.

## What the number means

Both pictures are scaled to the Figma frame's size, then compared pixel by pixel. A pixel counts as different when
any colour channel is more than 32 out of 255 apart. The number is the share of pixels that differ.

It is a quick way to spot a screen that drifted far from its design, or one that broke. It is not a grade. A high
number can be fine: the real app shows real data (other task names, other times, other amounts) where Figma shows
sample data, and a window that sits 10 pixels lower marks every edge in it. A low number does not prove the screen is
right either. Look at the image, not just the number.

Personal's screenshots are 1280 x 800 and its frames 1920 x 1080, so those are stretched to compare and score high.
"Not built yet" means the real screenshot is not in the repo yet: add it at the path in the table.

## Regenerate

```
node docs/figma/compare/compare.ts              # every pair
node docs/figma/compare/compare.ts --only tasks # one pair
node docs/figma/compare/compare.ts --self-check # a frame against itself must score 0
```

It needs Google Chrome or Chromium (`CHROME=/path/to/chrome` to pick one) and no npm packages. To compare a new
screen, add a line to `pairs.json`. When a design changes, export its frame over the PNG in `docs/figma/`; when the
app changes, retake its screenshot (below); then run the script again.

The real screenshots are taken by hand from a dev box: `portal/dev-box.sh` starts one on a test VM with scripted
tasks, and its screens are captured at 1920 x 1080 (desktop) and 390 x 844 at 2x (phone) into
`portal/screenshots/`. Personal's come from a GurtOS Personal test machine, into `personal/screenshots/`.

### GurtOS Server: the desktop

| Pair | Differ | Figma | The app |
|---|---|---|---|
| [desktop](desktop.png) | 6.2% | `docs/figma/os-v2/desktop/home-approval-banner.png` | `portal/screenshots/desktop.png` |
| [notification-center](notification-center.png) | 7.4% | `docs/figma/os-v2/desktop/notification-center.png` | `portal/screenshots/notification-center.png` |
| [control-center](control-center.png) | 5.7% | `docs/figma/os-v2/desktop/control-center.png` | `portal/screenshots/control-center.png` |
| [lock-screen](lock-screen.png) | 2.8% | `docs/figma/os-v2/desktop/lock-screen.png` | `portal/screenshots/lock.png` |
| [boot](boot.png) | 1.7% | `docs/figma/os-v2/desktop/boot-after-power-cut.png` | `portal/screenshots/boot.png` |
| [restored](restored.png) | 5.2% | `docs/figma/os-v2/desktop/restored-after-power-cut.png` | `portal/screenshots/restored.png` |
| [tasks](tasks.png) | 9% | `docs/figma/os-v2/windows/tasks.png` | `portal/screenshots/tasks.png` |
| [task-detail](task-detail.png) | 21% | `docs/figma/os-v2/windows/task-detail.png` | `portal/screenshots/task.png` |
| [task-undo-confirm](task-undo-confirm.png) | 26.9% | `docs/figma/os-v2/windows/task-detail-undo-confirm.png` | `portal/screenshots/task-undo.png` |
| [activity](activity.png) | 29.7% | `docs/figma/os-v2/windows/activity.png` | `portal/screenshots/activity.png` |
| [time-machine](time-machine.png) | 18.1% | `docs/figma/os-v2/windows/time-machine.png` | `portal/screenshots/time-machine.png` |
| [app-center](app-center.png) | 12.9% | `docs/figma/os-v2/windows/app-center.png` | `portal/screenshots/app-center.png` |
| [app-center-detail](app-center-detail.png) | 9.6% | `docs/figma/os-v2/windows/app-center-shopper-detail.png` | `portal/screenshots/app-center-detail.png` |

### GurtOS Server: setup

| Pair | Differ | Figma | The app |
|---|---|---|---|
| [setup-01-welcome](setup-01-welcome.png) | 2.6% | `docs/figma/os-v2/setup/01-welcome.png` | `portal/screenshots/setup/01-welcome.png` |
| [setup-02-network](setup-02-network.png) | 1.4% | `docs/figma/os-v2/setup/02-network.png` | `portal/screenshots/setup/02-network.png` |
| [setup-03-name-and-time-zone](setup-03-name-and-time-zone.png) | 1% | `docs/figma/os-v2/setup/03-name-and-time-zone.png` | `portal/screenshots/setup/03-name-and-time-zone.png` |
| [setup-04-owner](setup-04-owner.png) | 2.1% | `docs/figma/os-v2/setup/04-owner.png` | `portal/screenshots/setup/04-owner.png` |
| [setup-05-ai-models](setup-05-ai-models.png) | 3.1% | `docs/figma/os-v2/setup/05-ai-models.png` | `portal/screenshots/setup/05-model-key.png` |
| [setup-06-permissions](setup-06-permissions.png) | 1.8% | `docs/figma/os-v2/setup/06-permissions.png` | `portal/screenshots/setup/06-permissions.png` |
| [setup-09-updates](setup-09-updates.png) | 1.4% | `docs/figma/os-v2/setup/09-updates.png` | `portal/screenshots/setup/07-updates.png` |
| [setup-12-done](setup-12-done.png) | 2.7% | `docs/figma/os-v2/setup/12-done.png` | `portal/screenshots/setup/08-done.png` |

### GurtOS Server: Settings

| Pair | Differ | Figma | The app |
|---|---|---|---|
| [settings-01-general](settings-01-general.png) | 5% | `docs/figma/os-v2/settings/01-general.png` | `portal/screenshots/settings/01-general.png` |
| [settings-02-agents-and-models](settings-02-agents-and-models.png) | 4.7% | `docs/figma/os-v2/settings/02-agents-and-models.png` | `portal/screenshots/settings/02-agents.png` |
| [settings-03-permissions](settings-03-permissions.png) | 5.4% | `docs/figma/os-v2/settings/03-permissions.png` | `portal/screenshots/settings/03-permissions.png` |
| [settings-03-permissions-dark](settings-03-permissions-dark.png) | 4.7% | `docs/figma/os-v2/settings/03-permissions-dark.png` | `portal/screenshots/settings/03-permissions-dark.png` |
| [settings-04-accounts-and-keys](settings-04-accounts-and-keys.png) | 5.2% | `docs/figma/os-v2/settings/04-accounts-and-keys.png` | `portal/screenshots/settings/04-keys.png` |
| [settings-04-accounts-and-keys-replace-sheet](settings-04-accounts-and-keys-replace-sheet.png) | 5.5% | `docs/figma/os-v2/settings/04-accounts-and-keys-replace-sheet.png` | `portal/screenshots/settings/04-keys-replace-sheet.png` |
| [settings-05-apps](settings-05-apps.png) | 5.9% | `docs/figma/os-v2/settings/05-apps.png` | `portal/screenshots/settings/05-apps.png` |
| [settings-06-devices](settings-06-devices.png) | 6.3% | `docs/figma/os-v2/settings/06-devices.png` | `portal/screenshots/settings/06-devices.png` |
| [settings-07-updates](settings-07-updates.png) | 4.7% | `docs/figma/os-v2/settings/07-updates.png` | `portal/screenshots/settings/07-updates.png` |
| [settings-08-privacy-and-logs](settings-08-privacy-and-logs.png) | 4.1% | `docs/figma/os-v2/settings/08-privacy-and-logs.png` | `portal/screenshots/settings/08-privacy.png` |
| [settings-09-appearance](settings-09-appearance.png) | 5.1% | `docs/figma/os-v2/settings/09-appearance.png` | `portal/screenshots/settings/09-appearance.png` |
| [settings-10-about](settings-10-about.png) | 4.5% | `docs/figma/os-v2/settings/10-about.png` | `portal/screenshots/settings/10-about.png` |

### GurtOS Server: the phone

| Pair | Differ | Figma | The app |
|---|---|---|---|
| [phone-home](phone-home.png) | 26.4% | `docs/figma/os-v2/phone/1-home.png` | `portal/screenshots/phone-home.png` |
| [phone-tasks](phone-tasks.png) | 21.5% | `docs/figma/os-v2/phone/4-tasks.png` | `portal/screenshots/phone-tasks.png` |
| [phone-task-detail](phone-task-detail.png) | 18.4% | `docs/figma/os-v2/phone/5-task-detail.png` | `portal/screenshots/phone-task.png` |
| [phone-setup](phone-setup.png) | 25.3% | `docs/figma/os-v2/phone/7-setup-step-5.png` | `portal/screenshots/setup/phone.png` |

### Track apps

| Pair | Differ | Figma | The app |
|---|---|---|---|
| [credit-desk](credit-desk.png) | 73.7% | `docs/figma/os-v2/tracks/credit-desk.png` | `tracks/credit-desk/window.png` |
| [elastic](elastic.png) | 49.5% | `docs/figma/os-v2/tracks/elastic-insights.png` | `tracks/elastic/screenshots/1-changes.png` |

### GurtOS Personal: the OS

| Pair | Differ | Figma | The app |
|---|---|---|---|
| [personal-desktop](personal-desktop.png) | 4.2% | `docs/figma/personal-os/1-desktop-at-rest.png` | `personal/screenshots/os/01-desktop.png` |
| [personal-popover](personal-popover.png) | 48.4% | `docs/figma/personal-os/2-agents-popover-approval.png` | `personal/screenshots/os/03-popover.png` |
| [personal-quick-settings](personal-quick-settings.png) | 22.7% | `docs/figma/personal-os/3-quick-settings-agents.png` | `personal/screenshots/os/06-agents-tile.png` |
| [personal-notification](personal-notification.png) | 31.6% | `docs/figma/personal-os/5-approval-notification.png` | `personal/screenshots/os/02-approval.png` |
| [personal-lock-screen](personal-lock-screen.png) | 97.4% | `docs/figma/personal-os/6-lock-screen-approval.png` | `personal/screenshots/os/07-lock.png` |
| [personal-search](personal-search.png) | 7.9% | `docs/figma/personal-os/7-activities-search.png` | `personal/screenshots/os/11-search.png` |
| [personal-files-emblem](personal-files-emblem.png) | 10.6% | `docs/figma/personal-os/8b-files-changed-by-an-agent.png` | `personal/screenshots/os/13-files-emblem.png` |
| [personal-settings](personal-settings.png) | 24.2% | `docs/figma/personal-os/9-gurtos-settings.png` | `personal/screenshots/os/09-settings.png` |

### GurtOS Personal: setup and the GNOME layer

| Pair | Differ | Figma | The app |
|---|---|---|---|
| [personal-setup-welcome](personal-setup-welcome.png) | 57.1% | `docs/figma/os-v2/personal/setup-1-welcome.png` | `personal/screenshots/setup/00-first-login.png` |
| [personal-setup-models](personal-setup-models.png) | 57.2% | `docs/figma/os-v2/personal/setup-2-ai-models.png` | `personal/screenshots/setup/02-models.png` |
| [personal-setup-folders](personal-setup-folders.png) | 57.1% | `docs/figma/os-v2/personal/setup-3-folders.png` | `personal/screenshots/setup/03-folders.png` |
| [personal-setup-permissions](personal-setup-permissions.png) | 56.8% | `docs/figma/os-v2/personal/setup-4-permissions.png` | `personal/screenshots/setup/04-permissions.png` |
| [personal-setup-apps](personal-setup-apps.png) | 61.3% | `docs/figma/os-v2/personal/setup-5-apps.png` | `personal/screenshots/setup/05-apps.png` |
| [personal-setup-phone](personal-setup-phone.png) | 57.5% | `docs/figma/os-v2/personal/setup-6-pair-a-phone.png` | `personal/screenshots/setup/06-phone.png` |
| [personal-setup-done](personal-setup-done.png) | 57.2% | `docs/figma/os-v2/personal/setup-7-done.png` | `personal/screenshots/setup/07-done.png` |
| [personal-ask](personal-ask.png) | 78.2% | `docs/figma/os-v2/personal/ask-an-agent-dialog.png` | `personal/screenshots/setup/11-ask.png` |
| [personal-approval](personal-approval.png) | 88.2% | `docs/figma/os-v2/personal/approval-notification.png` | `personal/screenshots/setup/12-approval.png` |
| [personal-indicator](personal-indicator.png) | 84.6% | `docs/figma/os-v2/personal/indicator-menu.png` | `personal/screenshots/setup/13-indicator.png` |
| [personal-review](personal-review.png) | 67.1% | `docs/figma/os-v2/personal/review-keep-or-undo.png` | `personal/screenshots/setup/14-review.png` |

### GurtOS Business

| Pair | Differ | Figma | The app |
|---|---|---|---|
| business-1a-people | not built yet | `docs/figma/business/1a-people.png` | `portal/screenshots/business/1a-people.png` |
| business-1b-add-a-person | not built yet | `docs/figma/business/1b-add-a-person.png` | `portal/screenshots/business/1b-add-a-person.png` |
| business-2-rules | not built yet | `docs/figma/business/2-rules.png` | `portal/screenshots/business/2-rules.png` |
| business-4-audit | not built yet | `docs/figma/business/4-audit.png` | `portal/screenshots/business/4-audit.png` |
| business-5a-kill-switch-box | not built yet | `docs/figma/business/5a-kill-switch-box.png` | `portal/screenshots/business/5a-kill-switch-box.png` |
| business-5c-all-agents-paused | not built yet | `docs/figma/business/5c-all-agents-paused.png` | `portal/screenshots/business/5c-all-agents-paused.png` |

### The phone app

| Pair | Differ | Figma | The app |
|---|---|---|---|
| phone-app-1a-switch-machine | not built yet | `docs/figma/phone-app/1a-switch-machine.png` | `portal/screenshots/phone-app/1a-switch-machine.png` |
| phone-app-1b-add-a-machine | not built yet | `docs/figma/phone-app/1b-add-a-machine.png` | `portal/screenshots/phone-app/1b-add-a-machine.png` |
| phone-app-2a-home-server | not built yet | `docs/figma/phone-app/2a-home-server.png` | `portal/screenshots/phone-app/2a-home-server.png` |
| phone-app-2b-home-personal | not built yet | `docs/figma/phone-app/2b-home-personal.png` | `portal/screenshots/phone-app/2b-home-personal.png` |
| phone-app-2c-home-business-rosa | not built yet | `docs/figma/phone-app/2c-home-business-rosa.png` | `portal/screenshots/phone-app/2c-home-business-rosa.png` |
| phone-app-3b-approval-from-notification | not built yet | `docs/figma/phone-app/3b-approval-from-notification.png` | `portal/screenshots/phone-app/3b-approval-from-notification.png` |
| phone-app-4b-install-safari | not built yet | `docs/figma/phone-app/4b-install-safari.png` | `portal/screenshots/phone-app/4b-install-safari.png` |
| phone-app-4d-install-allow-notifications | not built yet | `docs/figma/phone-app/4d-install-allow-notifications.png` | `portal/screenshots/phone-app/4d-install-allow-notifications.png` |
| phone-app-4e-install-pair | not built yet | `docs/figma/phone-app/4e-install-pair.png` | `portal/screenshots/phone-app/4e-install-pair.png` |
