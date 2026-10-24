#!/bin/sh
# Apple Watch simulator screenshots: scripts/watch-shots.sh '<machines JSON>' <out dir> [name approval-id]...
set -eu
cd "$(dirname "$0")/.."
machines=$1; out=$2; shift 2
mkdir -p "$out"
dev=$(xcrun simctl list devices available | grep -m1 'Apple Watch' | grep -oE '[0-9A-F-]{36}' || true)
if [ -z "$dev" ]; then
  rt=$(xcrun simctl list runtimes | grep -m1 watchOS | grep -oE 'com.apple.CoreSimulator.SimRuntime.watchOS-[0-9-]+')
  type=$(xcrun simctl list devicetypes | grep -m1 'Apple Watch Series' | grep -oE 'com.apple.CoreSimulator.SimDeviceType[^)]+')
  dev=$(xcrun simctl create "GurtOS Watch" "$type" "$rt")
fi
xcrun simctl boot "$dev" 2>/dev/null || true
xcrun simctl bootstatus "$dev" >/dev/null
xcrun simctl install "$dev" build/dd/Build/Products/Debug-watchsimulator/GurtOSWatch.app
shot() {
  xcrun simctl terminate "$dev" com.benzhou.gurtos.watchkitapp 2>/dev/null || true
  [ "${2:-}" = gallery ] && export SIMCTL_CHILD_GURTOS_GALLERY=1 || unset SIMCTL_CHILD_GURTOS_GALLERY
  SIMCTL_CHILD_GURTOS_MACHINES=$machines SIMCTL_CHILD_GURTOS_OPEN=${2:-} xcrun simctl launch "$dev" com.benzhou.gurtos.watchkitapp >/dev/null
  sleep 7
  xcrun simctl io "$dev" screenshot "$out/watch-$1.png" >/dev/null 2>&1
  echo "$out/watch-$1.png"
}
shot list
while [ $# -ge 2 ]; do shot "$1" "$2"; shift 2; done
