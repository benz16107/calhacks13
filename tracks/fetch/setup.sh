#!/usr/bin/env bash
# The Fetch.ai track's Python side: a venv with uAgents for agent.py, shared by every box on this machine.
# track.ts runs it before it first starts the agent. Safe to run again. Needs root.
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
venv=${FETCH_VENV:-/opt/box-fetch/venv}
stamp="$venv/.ok-$(sha256sum "$here/requirements.txt" | cut -c1-16)"
mkdir -p "$(dirname "$venv")"
exec 9>"$(dirname "$venv")/setup.lock"
flock 9
[[ -f $stamp ]] && exit 0
if ! python3 -m venv --clear "$venv" >/dev/null 2>&1; then
  # Ubuntu ships venv's pip in its own package.
  export DEBIAN_FRONTEND=noninteractive NEEDRESTART_SUSPEND=1
  apt-get install -y -q -o DPkg::Lock::Timeout=300 python3-venv >/dev/null ||
    { apt-get update -q >/dev/null && apt-get install -y -q -o DPkg::Lock::Timeout=300 python3-venv >/dev/null; }
  python3 -m venv --clear "$venv"
fi
"$venv/bin/pip" install -q --disable-pip-version-check -r "$here/requirements.txt"
touch "$stamp"
