# Notes in docs/

This folder holds two kinds of notes. Product notes describe how GurtOS works and how it is designed, and they are
kept current. Hackathon records were written during Cal Hacks 13.0 (Oct 24 and 25, 2026) for judges and for the
weekend's own work. They are kept as history: their status lines, deadlines and claims describe that weekend, not
`main` today.

The docs people read are at [gurtos.com/docs](https://gurtos.com/docs/) (source in `site/`), and each folder in the
repository has its own README. Start with the top-level [README](../README.md) and [core/README.md](../core/README.md).

## Product notes

| Note | What |
|---|---|
| [self-host.md](self-host.md) | Run your own relay, push gateway and web app, and point boxes at them |
| [design/agent-setup.md](design/agent-setup.md) | Why setup from another computer works the way it does. The how-to is [AGENT-SETUP.md](../AGENT-SETUP.md) |
| [perf/filesystem.md](perf/filesystem.md) | The file path for agents on GurtOS Personal, measured, with the options for making it faster |
| [ux/words.md](ux/words.md) | One word for each thing, on every screen. When a screen and this list disagree, the screen changes |
| [figma/system.md](figma/system.md) | The design system every screen is built from: the box's screen, the portal, the phone and Personal |
| [figma/compare/](figma/compare/README.md) | Each Figma frame beside a screenshot of the real app, with the pixels that differ |
| [figma/playbook.md](figma/playbook.md) | How GurtOS was designed with an agent driving Figma, step by step |
| [drill.md](drill.md) | GurtOS Business: stop every agent, undo the damage and carry on, with measured times |
| [pilot.md](pilot.md) | GurtOS Business: a one-week pilot plan using shadow mode |
| [images/](images/) | Images the top-level README uses |

`figma/` also holds the exported Figma frames (`os-v2/`, `personal/`, `phone-app/` and others) and the reference
screenshots the designs drew on (`refs/`).

## Audits

Point-in-time reviews. Each finding names whether it was fixed; check the code before relying on one.

| Note | What |
|---|---|
| [ux/audit.md](ux/audit.md) | A first-time user's walk through every screen, Oct 24. It became the fix list for the launch; before and after screenshots are in `ux/launch/` |
| [ux/parity.md](ux/parity.md) | GurtOS Personal beside stock Ubuntu 24.04 Desktop for everyday use, Oct 24 |
| [qa/report.md](qa/report.md) | The QA walk from a fresh install through every app, Oct 23 and 24 |

## Hackathon records

| Note | What |
|---|---|
| [devpost.md](devpost.md) | The Devpost submission text |
| [story.md](story.md) | How each hackathon track was told on the showcase and Devpost |
| [tracks.md](tracks.md) | The sponsor prize tracks entered and what each asked for |
| [features.md](features.md) | The weekend's feature ledger: who built what and how far it got |
| [pitch/](pitch/) | The table demo script and talking points for judging |
| [videos.md](videos.md), [video/](video/README.md) | The video plans, scripts and the HyperFrames project; the published links are in `video/README.md` |
| [figma.md](figma.md), [figma-products.md](figma-products.md) | The Figma handoff to the portal work and the plan for each Figma product |
| [stagelog.md](stagelog.md) | The Figma stage log kept for the Figma track |

Most apps in `tracks/` came from the same weekend, built for sponsor prizes. They stay in the repository and are off
until an owner turns them on.
