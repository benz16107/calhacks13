#!/usr/bin/env bash
# The Personal edition's desktop layer: the box inside Ubuntu's GNOME desktop, for the person who owns the computer.
# Run it as root after core/install.sh (which puts the box in /opt/box). Safe to run again.
#   sudo core/install.sh && sudo personal/install.sh [owner]
# It only installs files and packages and never starts anything, so image/build can run it in a chroot.
# What it adds, for every account on the machine:
#   box-desktop (user service)  approvals as notifications with Approve and Deny, and the top-bar indicator
#   Box (app, first in the dock) the portal in its own window
#   Files: Ask an Agent…         right-click a folder; the agent works on a copy until you Keep or Undo
#   Welcome to Box               once per account, after GNOME's own first-login setup
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
[[ $(id -u) == 0 ]] || { echo 'personal/install.sh: run it as root' >&2; exit 1; }
[[ -d /opt/box/core ]] || { echo 'personal/install.sh: install the box first (core/install.sh)' >&2; exit 1; }

# The desktop itself, if this is a plain Ubuntu install, plus what the layer is built on: GTK 4, libadwaita,
# WebKitGTK for the Box window, AppIndicator for the top bar, and Python extensions for Files.
export DEBIAN_FRONTEND=noninteractive
pkgs=(python3-gi gir1.2-gtk-4.0 gir1.2-adw-1 gir1.2-webkit-6.0 gir1.2-gtk-3.0 gir1.2-ayatanaappindicator3-0.1
  gnome-shell-extension-appindicator python3-nautilus)
dpkg -s gnome-shell >/dev/null 2>&1 || pkgs+=(ubuntu-desktop-minimal)
missing=$(for p in "${pkgs[@]}"; do dpkg -s "$p" >/dev/null 2>&1 || echo "$p"; done)
if [[ -n $missing ]]; then
  apt-get update -qq
  # shellcheck disable=SC2086
  apt-get install -y -qq --no-install-recommends $missing >/dev/null
fi

# The layer's code lives with the box, in /opt/box/personal. A run from a newer checkout updates it.
[[ $here == /opt/box/personal ]] || rsync -a --delete --exclude node_modules "$here/" /opt/box/personal/

install -Dm644 "$here/files/dev.box.Box.desktop" /usr/share/applications/dev.box.Box.desktop
install -Dm644 "$here/icons/dev.box.Box.svg" /usr/share/icons/hicolor/scalable/apps/dev.box.Box.svg
install -Dm644 "$here/icons/dev.box.Box-symbolic.svg" /usr/share/icons/hicolor/symbolic/apps/dev.box.Box-symbolic.svg
gtk-update-icon-cache -q -t -f /usr/share/icons/hicolor 2>/dev/null || true
install -Dm644 "$here/files/apparmor-box-ui" /etc/apparmor.d/box-ui
apparmor_parser -r -W /etc/apparmor.d/box-ui 2>/dev/null || true # in a chroot it loads at the next boot instead
install -Dm644 "$here/files/box-nautilus.py" /usr/share/nautilus-python/extensions/box-nautilus.py
install -Dm644 "$here/files/box-welcome.desktop" /etc/xdg/autostart/box-welcome.desktop
install -Dm644 "$here/files/box-desktop.service" /etc/systemd/user/box-desktop.service
systemctl --global enable box-desktop.service >/dev/null 2>&1
install -Dm644 "$here/files/90_box-personal.gschema.override" /usr/share/glib-2.0/schemas/90_box-personal.gschema.override
glib-compile-schemas /usr/share/glib-2.0/schemas

# The owner: the person with sudo, whose folders agents work on. Given, or else the first human in the sudo group.
# On an image built before anyone has an account, run this again after the first login (or set BOX_OWNER by hand).
owner=${1:-}
[[ -z $owner ]] || id "$owner" >/dev/null || exit 1
[[ -n $owner ]] || owner=$(getent group sudo | cut -d: -f4 | tr , '\n' | while read -r u; do [[ -n $u && $(id -u "$u") -ge 1000 ]] && echo "$u" && break; done || true)
if [[ -n $owner ]]; then
  mkdir -p /etc/systemd/system/box.service.d
  cat > /etc/systemd/system/box.service.d/personal.conf <<EOF
[Service]
Environment=BOX_OWNER=$owner
EOF
  [[ -d /run/systemd/system ]] && systemctl daemon-reload && systemctl try-restart box.service # not in a chroot
fi
echo "personal: installed for ${owner:-no owner yet}. It starts at the next login (or: systemctl --user restart box-desktop)."
