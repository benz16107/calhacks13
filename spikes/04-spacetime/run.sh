#!/usr/bin/env bash
# Spike 4: self-hosted SpacetimeDB on ARM, TypeScript module, Node client sees a row change live.
# Run as the normal VM user after: curl -sSf https://install.spacetimedb.com | sh -s -- --yes
set -euo pipefail
export PATH=$HOME/.local/bin:$PATH
S=$(cd "$(dirname "$0")" && pwd); P=$HOME/spike4
spacetime --version | head -1
ss -ltn | grep -q ':3000 ' || { (nohup spacetime start --non-interactive > ~/stdb-server.log 2>&1 &); sleep 3; }
[ -d "$P" ] || spacetime init --non-interactive --local -t nodejs-ts --project-path "$P" spike4
echo '{ "database": "spike4" }' > "$P/spacetime.local.json"   # init names it spike4-<random>; call/sql follow this file even with --no-config
cp "$S/module.ts" "$P/spacetimedb/src/index.ts"; cp "$S/watch.ts" "$P/src/main.ts"
cd "$P"; (cd spacetimedb && npm install --silent --no-audit --no-fund); npm install --silent --no-audit --no-fund
echo "== publish"; time spacetime publish --server local --module-path spacetimedb -y --delete-data spike4 2>&1 | tail -3
echo "== generate";  spacetime generate --lang typescript --out-dir src/module_bindings --module-path spacetimedb -y 2>&1 | tail -1
npx esbuild src/main.ts --bundle --platform=node --outfile=dist/main.js --format=esm --log-level=warning
echo "== watcher subscribes, then the CLI changes rows"
(SPACETIMEDB_DB_NAME=spike4 node dist/main.js > /tmp/watch.log 2>&1 &); sleep 2
echo "$(date +%T.%3N) call add_task";  spacetime call --server local spike4 add_task '"fix the failing test"'
echo "$(date +%T.%3N) call set_status"; spacetime call --server local spike4 set_status 1 '"running"'
spacetime call --server local spike4 set_status 1 '"waiting for your OK"'
sleep 1; echo "-- what the watcher saw:"; cat /tmp/watch.log
echo "== a second client times its own call until the update comes back"
SPACETIMEDB_DB_NAME=spike4 PING=1 node dist/main.js | tail -1
pkill -f "dist/main[.]js" || true
echo "== hard kill the server (kill -9), restart, is the row still there?"
pkill -9 -f spacetimedb-standalone; sleep 1
(nohup spacetime start --non-interactive > ~/stdb-server.log 2>&1 &); sleep 3
spacetime sql --server local spike4 "SELECT * FROM task"
