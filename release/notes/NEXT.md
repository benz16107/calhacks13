# Next release (not released yet)

Changes on `main` since v0.2.0-preview. The release thread turns this into `notes/<version>.md`.

## What changed

### Security

- The disk cap catches a task that fills its disk and ends between two checks. The box measured each running task
  every 2 seconds, so a task that wrote past its cap and stopped before the next check ended "done" with its files
  kept. Each task is now measured once more as it ends, and one over its cap is undone, with a note in the log.
