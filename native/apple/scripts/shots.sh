#!/bin/sh
# Simulator screenshots of the iPhone app (Debug build, paired with a test box through GURTOS_PAIR).
#   scripts/shots.sh <pairing link> <out dir> [light|dark] [name gurtos://url-or-tab]...
# Each shot: launch with GURTOS_OPEN (a gurtos:// link) or GURTOS_TAB (settings, tasks, activity), wait, capture.
set -eu
cd "$(dirname "$0")/.."
link=$1; out=$2; look=$3; shift 3
mkdir -p "$out"
dev=$(xcrun simctl list devices available | grep -m1 'iPhone 18 Pro (' | grep -oE '[0-9A-F-]{36}')
xcrun simctl boot "$dev" 2>/dev/null || true
xcrun simctl bootstatus "$dev" >/dev/null
xcrun simctl ui "$dev" appearance "$look"
# The status bar the HIG screenshots use: 9:41, full bars and battery.
xcrun simctl status_bar "$dev" override --time 9:41 --batteryState charged --batteryLevel 100 --cellularBars 4 --wifiBars 3
app=$(find build/dd/Build/Products/Debug-iphonesimulator -maxdepth 1 -name GurtOS.app | head -1)
xcrun simctl install "$dev" "$app"
xcrun simctl privacy "$dev" grant notifications com.benzhou.gurtos 2>/dev/null || true
while [ $# -ge 2 ]; do
  name=$1; what=$2; shift 2
  xcrun simctl terminate "$dev" com.benzhou.gurtos 2>/dev/null || true
  case $what in
    gurtos://*) SIMCTL_CHILD_GURTOS_SCROLL=${SCROLL:-} SIMCTL_CHILD_GURTOS_PAIR=$link SIMCTL_CHILD_GURTOS_OPEN=$what SIMCTL_CHILD_GURTOS_NOTIFY_ASKED=1 xcrun simctl launch "$dev" com.benzhou.gurtos >/dev/null ;;
    pairstart) SIMCTL_CHILD_GURTOS_PAIRSTART=1 xcrun simctl launch "$dev" com.benzhou.gurtos >/dev/null ;;
    *) SIMCTL_CHILD_GURTOS_PAIR=$link SIMCTL_CHILD_GURTOS_TAB=$what SIMCTL_CHILD_GURTOS_NOTIFY_ASKED=1 xcrun simctl launch "$dev" com.benzhou.gurtos >/dev/null ;;
  esac
  sleep ${WAIT:-6}
  xcrun simctl io "$dev" screenshot "$out/$name-$look.png" >/dev/null
  echo "$out/$name-$look.png"
done
