#!/bin/sh
# Turn an Ubuntu 24.04 machine you already own into a GurtOS box. Nothing else on the machine is touched.
#   curl -fsSL https://gurtos.com/install | sudo sh
# It installs git, rsync and curl, clones this repository to /opt/gurtos, and runs core/install.sh from it: Node,
# the Droid CLI, SpacetimeDB, the box service (systemd unit box.service) and the portal on 127.0.0.1:7700.
# Environment: GURTOS_REPO and GURTOS_REF pick another clone or branch. ANTHROPIC_API_KEY or FACTORY_API_KEY, if
# set, goes into the vault (/etc/box/vault.env, root only) so the first task can run. GURTOS_FORCE=1 skips the
# Ubuntu and size checks.
set -eu

say() { printf 'gurtos: %s\n' "$*"; }
die() { printf 'gurtos: %s\n' "$*" >&2; exit 1; }

[ "$(id -u)" = 0 ] || die "run as root: curl -fsSL https://gurtos.com/install | sudo sh"
start=$(date +%s)

if [ -z "${GURTOS_FORCE:-}" ]; then
  . /etc/os-release
  [ "${ID:-}" = ubuntu ] && [ "${VERSION_ID:-}" = 24.04 ] || die "this needs Ubuntu 24.04 (this is ${PRETTY_NAME:-unknown}). GURTOS_FORCE=1 skips the check."
  case $(uname -m) in x86_64 | aarch64) ;; *) die "this needs an x86_64 or aarch64 machine (this is $(uname -m))" ;; esac
  [ -d /run/systemd/system ] || die "this needs systemd as the init system (a container or WSL without systemd will not work)"
  mem=$(awk '/^MemTotal/ { print int($2 / 1024) }' /proc/meminfo)
  disk=$(df -Pm / | awk 'NR == 2 { print $4 }')
  [ "$mem" -ge 900 ] || die "only ${mem} MB of memory. The box installs and idles on 512 MB, but a task was killed for lack of memory there; 1 GB ran one task at a time (tracks/anthropic/README.md). GURTOS_FORCE=1 installs anyway."
  [ "$disk" -ge 4000 ] || die "only ${disk} MB free on /; the install needs about 4 GB"
fi

say "installing git, rsync and curl"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq git rsync curl ca-certificates xz-utils acl >/dev/null

repo=${GURTOS_REPO:-https://github.com/benz16107/calhacks13}
ref=${GURTOS_REF:-main}
if [ -d /opt/gurtos/.git ]; then
  say "updating /opt/gurtos to $ref"
  git -C /opt/gurtos fetch -q --depth 1 origin "$ref"
  git -C /opt/gurtos checkout -q --force FETCH_HEAD
else
  say "cloning $repo ($ref) to /opt/gurtos"
  git clone -q --depth 1 --branch "$ref" "$repo" /opt/gurtos
fi

say "running core/install.sh (Node, Droid, SpacetimeDB and the box service; a few minutes)"
/opt/gurtos/core/install.sh

vault=/etc/box/vault.env
for key in ANTHROPIC_API_KEY FACTORY_API_KEY; do
  value=$(printenv "$key" || true)
  if [ -n "$value" ] && ! grep -q "^$key=" "$vault"; then
    printf '%s=%s\n' "$key" "$value" >>"$vault"
    say "put $key in the vault ($vault, root only)"
  fi
done
chmod 600 "$vault"

say "done in $(($(date +%s) - start)) s. The box is running as box.service."
say "Open its screen on this machine at http://127.0.0.1:7700/, or from your own computer with:"
say "  ssh -L 7700:127.0.0.1:7700 <this-machine>   then   http://127.0.0.1:7700/"
grep -qE '^(ANTHROPIC|FACTORY)_API_KEY=' "$vault" || say "It has no model key yet: add one in Settings, or  echo 'ANTHROPIC_API_KEY=sk-ant-...' | sudo tee -a $vault"
