#!/bin/sh
# Drive DeviceShots (UITests/DeviceShots.swift) in the booted iPhone simulator. Build first with scripts/build.sh.
#   scripts/device-shots.sh <out dir> scrolled <name> <gurtos://approval/...>
#   scripts/device-shots.sh <out dir> tap <name> <gurtos://approval/...>
#   scripts/device-shots.sh <out dir> faceid <name> <gurtos://approval/...> <task id>
set -eu
cd "$(dirname "$0")/.."
out=$1; what=$2; name=$3; open=$4; task=${5:-}
mkdir -p "$out"; rm -f "$out/faceid-up" "$out/matched"
dev=$(xcrun simctl list devices booted | grep -m1 'iPhone' | grep -oE '[0-9A-F-]{36}')
KID=${ASC_KID:-PLMMVZAW9U}; KEY=$HOME/.appstoreconnect/private_keys/AuthKey_$KID.p8
run() {
  TEST_RUNNER_SHOTS=$out TEST_RUNNER_OPEN=$open TEST_RUNNER_NAME=$name TEST_RUNNER_TASK=$task \
    xcodebuild test -project GurtOS.xcodeproj -scheme GurtOS -destination "id=$dev" -only-testing:"GurtOSUITests/DeviceShots/$1" \
    -derivedDataPath build/dd -allowProvisioningUpdates -authenticationKeyPath "$KEY" -authenticationKeyID "$KID" \
    -authenticationKeyIssuerID f9583201-6a86-49b0-a866-c418cab9223b 2>&1 | grep -E "error:|passed|failed" | tail -3
}
case $what in
  scrolled) run testScrolledRequest ;;
  tap) run testTapApprove ;;
  faceid)
    # Enroll a face in the simulator, then match it when the test shows the sheet.
    xcrun simctl spawn "$dev" notifyutil -s com.apple.BiometricKit.enrollmentChanged 1
    xcrun simctl spawn "$dev" notifyutil -p com.apple.BiometricKit.enrollmentChanged
    ( for i in $(seq 120); do [ -f "$out/faceid-up" ] && break; sleep 1; done
      xcrun simctl spawn "$dev" notifyutil -p com.apple.BiometricKit_Sim.pearl.match; touch "$out/matched" ) &
    run testApproveWithFaceID
    wait ;;
esac
