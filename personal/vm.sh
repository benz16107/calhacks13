#!/usr/bin/env bash
# The Personal edition's test machine: a Vultr VM with Ubuntu 24.04 and GNOME (see README.md). Run from the machine that reaches it over ssh.
#   personal/vm.sh setup          once: a test owner (ana, with sudo) logged in by GDM, on Xorg so we can take screenshots
#   personal/vm.sh install        ship this checkout, then core/install.sh and personal/install.sh, and restart the layer
#   personal/vm.sh layer          on an installed GurtOS Personal: replace /opt/box/personal and install it again
#   personal/vm.sh relogin        log the session's user out and back in (needs GDM automatic login for them)
#   personal/vm.sh as <command>   run a command as ana inside her desktop session
#   personal/vm.sh wl <args>      input on the machine's screen, any session (personal/wl.py): click X Y, type TEXT, key Return
#   personal/vm.sh shot <name>    screenshot of her screen into personal/screenshots/<name>.png
# PERSONAL_VM is its ssh host (required; kept out of the repo), PERSONAL_USER the session's user (default ana; during GNOME's
# first-boot setup it is gnome-initial-setup).
set -euo pipefail
cd "$(dirname "$0")/.."
vm=${PERSONAL_VM:?set PERSONAL_VM to the test machine ssh host}
owner=${PERSONAL_USER:-ana}
# The session's own environment, read from its gnome-shell, so it also works in GDM's first-boot setup session,
# which runs on a private D-Bus.
session="pid=\$(pgrep -u $owner -x gnome-shell | head -1); export \$(grep -zE '^(DBUS_SESSION_BUS_ADDRESS|WAYLAND_DISPLAY|DISPLAY|XDG_[A-Z_]+|XAUTHORITY|GNOME_[A-Z_]+|DESKTOP_SESSION|GDMSESSION)=' /proc/\$pid/environ | tr '\0' ' ')"

case ${1:-} in
  setup)
    ssh "$vm" bash -s <<EOF
set -e
id $owner >/dev/null 2>&1 || { useradd -m -s /bin/bash -c 'Ana Test' -G sudo $owner; openssl rand -hex 12 > /root/$owner-password; echo "$owner:\$(cat /root/$owner-password)" | chpasswd; }
cat > /etc/gdm3/custom.conf <<'CONF'
# Test machine only: log the test owner in, on Xorg so xdotool works too (personal/wl.py drives Wayland).
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
  layer)
    tar -czf - personal | ssh "$vm" "tar -xzf - -C /opt/box && pkill -u $owner -f '[b]ox-ui.py'; /opt/box/personal/install.sh $owner >/dev/null" # Shell changes take effect at the next login
    ;;
  relogin)
    # Log the owner out and back in (GDM automatic login), so a new Shell extension or session loads.
    ssh "$vm" "loginctl terminate-user $owner; sleep 2; systemctl restart gdm3"
    ;;
  as)
    shift
    ssh "$vm" "$session; cd /home/$owner; sudo -u $owner -E HOME=/home/$owner $(printf '%q ' "$@")"
    ;;
  wl)
    shift
    ssh "$vm" "/usr/bin/python3 - $(printf '%q ' "$@")" < personal/wl.py # as root: input goes through /dev/uinput
    ;;
  shot)
    mkdir -p personal/screenshots
    ssh "$vm" "$session; sudo -u $owner -E /usr/bin/python3 - shot /tmp/gurt-shot.png && cat /tmp/gurt-shot.png && rm -f /tmp/gurt-shot.png" < personal/wl.py > "personal/screenshots/$2.png"
    echo "personal/screenshots/$2.png"
    ;;
  *) sed -n 2,6p "$0"; exit 2 ;;
esac
