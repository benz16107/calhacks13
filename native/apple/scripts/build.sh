#!/bin/sh
# Build GurtOS for Apple devices on a Mac with Xcode 27 and XcodeGen.
#   scripts/build.sh                 the iPhone app for the simulator
#   scripts/build.sh test            GurtKit's tests
#   scripts/build.sh upload          archive and upload to TestFlight (App Store Connect API key in ~/.appstoreconnect/private_keys)
set -eu
cd "$(dirname "$0")/.."
export PATH=$HOME/.local/bin:/opt/homebrew/bin:$PATH
xcodegen generate --quiet
KID=${ASC_KID:-PLMMVZAW9U}; ISS=${ASC_ISS:-f9583201-6a86-49b0-a866-c418cab9223b}
KEY=$HOME/.appstoreconnect/private_keys/AuthKey_$KID.p8
# Over ssh the login keychain is locked, so codesign uses a keychain of its own (made once on the build Mac; its
# password and key stay in ~/.config/gurtos-signing, 0600, never in git).
KC=$HOME/Library/Keychains/gurtos-signing.keychain-db
[ -f "$KC" ] && security unlock-keychain -p "$(cat "$HOME/.config/gurtos-signing/pw")" "$KC"
AUTH="-allowProvisioningUpdates -authenticationKeyPath $KEY -authenticationKeyID $KID -authenticationKeyIssuerID $ISS"
case ${1:-sim} in
  test) cd GurtKit && swift test ;;
  # shellcheck disable=SC2086
  mac) xcodebuild -project GurtOS.xcodeproj -scheme GurtOSMac -configuration "${CONFIG:-Debug}" -destination "platform=macOS" -derivedDataPath build/dd build -quiet $AUTH ;;
  # shellcheck disable=SC2086
  watch) xcodebuild -project GurtOS.xcodeproj -scheme GurtOSWatch -destination "generic/platform=watchOS Simulator" -derivedDataPath build/dd build -quiet $AUTH ;;
  # shellcheck disable=SC2086
  sim) xcodebuild -project GurtOS.xcodeproj -scheme GurtOS -destination "generic/platform=iOS Simulator" -derivedDataPath build/dd build -quiet $AUTH ;;
  upload)
    rm -rf build/GurtOS.xcarchive
    # shellcheck disable=SC2086
    xcodebuild archive -project GurtOS.xcodeproj -scheme GurtOS -configuration Release -destination 'generic/platform=iOS' -archivePath build/GurtOS.xcarchive $AUTH -quiet
    # shellcheck disable=SC2086
    [ "${2:-}" = archive-only ] || xcodebuild -exportArchive -archivePath build/GurtOS.xcarchive -exportOptionsPlist scripts/ExportOptions.plist -exportPath build/export $AUTH
    ;;
  dmg)
    # The Mac app, signed with Developer ID, notarized and stapled, in a DMG: build/GurtOS.dmg
    uv run -q --with pyjwt --with cryptography scripts/devid.py
    rm -rf build/GurtOSMac.xcarchive build/mac
    # shellcheck disable=SC2086
    xcodebuild archive -project GurtOS.xcodeproj -scheme GurtOSMac -configuration Release -destination 'generic/platform=macOS' -archivePath build/GurtOSMac.xcarchive $AUTH -quiet
    # shellcheck disable=SC2086
    xcodebuild -exportArchive -archivePath build/GurtOSMac.xcarchive -exportOptionsPlist scripts/ExportDeveloperID.plist -exportPath build/mac $AUTH
    rm -f build/GurtOS.dmg
    hdiutil create -volname GurtOS -srcfolder build/mac/GurtOS.app -ov -format UDZO build/GurtOS.dmg
    xcrun notarytool submit build/GurtOS.dmg --key "$KEY" --key-id "$KID" --issuer "$ISS" --wait
    xcrun stapler staple build/GurtOS.dmg
    ;;
  *) echo "usage: $0 [sim|watch|mac|dmg|test|upload]" >&2; exit 2 ;;
esac
