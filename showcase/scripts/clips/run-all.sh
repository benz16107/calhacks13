#!/usr/bin/env bash
# Record each clip on a freshly seeded clip box, so no banner or task from one clip shows in the next.
#   showcase/scripts/clips/run-all.sh [clip...]     default: every clip
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
export PLAYWRIGHT=${PLAYWRIGHT:-/tmp/showcase-rec/node_modules/playwright/index.mjs}
clips=("$@"); [[ ${#clips[@]} -gt 0 ]] || clips=(moment-1-undo moment-2-blocked moment-3-approval moment-4-power-cut shopper)
for c in "${clips[@]}"; do
  "$here/clip-box.sh" | tail -1
  sleep 4
  node "$here/record.mjs" "$c"
done
