#!/usr/bin/env bash
# The Personal edition's test machine: a Vultr VM with Ubuntu 24.04 and GNOME (see README.md). Run from linuxbox.
#   personal/vm.sh setup          once: a test owner (ana, with sudo) logged in by GDM, on Xorg so we can take screenshots
#   personal/vm.sh install        ship this checkout, then core/install.sh and personal/install.sh, and restart the layer
#   personal/vm.sh as <command>   run a command as ana inside her desktop session
#   personal/vm.sh shot <name>    screenshot of her screen into personal/screenshots/<name>.png
set -euo pipefail
cd "$(dirname "$0")/.."
vm=${PERSONAL_VM:-personalbox}
owner=ana
session="export DISPLAY=:0 XDG_RUNTIME_DIR=/run/user/\$(id -u $owner) DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/\$(id -u $owner)/bus XAUTHORITY=/run/user/\$(id -u $owner)/gdm/Xauthority"

case ${1:-} in
  setup)
    ssh "$vm" bash -s <<EOF
set -e
id $owner >/dev/null 2>&1 || { useradd -m -s /bin/bash -c 'Ana Test' -G sudo $owner; openssl rand -hex 12 > /root/$owner-password; echo "$owner:\$(cat /root/$owner-password)" | chpasswd; }
cat > /etc/gdm3/custom.conf <<'CONF'
# Test machine only: log the test owner in, on Xorg so screenshots and xdotool work.
[daemon]
AutomaticLoginEnable=true
AutomaticLogin=$owner
WaylandEnable=false
CONF
apt-get install -y -qq x11-utils >/dev/null
systemctl set-default graphical.target >/dev/null
systemctl restart gdm3
EOF
    ;;
  install)
    git ls-files -co --exclude-standard | while IFS= read -r f; do [[ -e $f ]] && printf '%s\n' "$f"; done |
      tar -czf - -T - | ssh "$vm" 'mkdir -p /opt/box-dev/personal && find /opt/box-dev/personal -mindepth 1 -maxdepth 1 ! -name node_modules -exec rm -rf {} + && tar -xzf - -C /opt/box-dev/personal'
    ssh "$vm" "cd /opt/box-dev/personal && core/install.sh && personal/install.sh $owner && { $session; sudo -u $owner -E HOME=/home/$owner systemctl --user daemon-reload; sudo -u $owner -E HOME=/home/$owner systemctl --user restart box-desktop.service || true; }"
    ;;
  as)
    shift
    ssh "$vm" "$session; cd /home/$owner; sudo -u $owner -E HOME=/home/$owner $(printf '%q ' "$@")"
    ;;
  shot)
    mkdir -p personal/screenshots
    ssh "$vm" "$session; sudo -u $owner -E HOME=/home/$owner import -window root png:-" > "personal/screenshots/$2.png"
    echo "personal/screenshots/$2.png"
    ;;
  *) sed -n 2,6p "$0"; exit 2 ;;
esac
