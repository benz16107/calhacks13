// Drives the notification flow in the simulator: allow notifications, receive an encrypted push (sent by
// scripts/push-shot.sh with the box's own encryption), and open its buttons. Saves screenshots to SHOTS (a host path).
import XCTest

final class NotificationTests: XCTestCase {
  let shots = ProcessInfo.processInfo.environment["SHOTS"] ?? "/tmp/gshots"
  let spring = XCUIApplication(bundleIdentifier: "com.apple.springboard")

  func shot(_ name: String) {
    try? XCUIScreen.main.screenshot().pngRepresentation.write(to: URL(fileURLWithPath: "\(shots)/\(name).png"))
  }

  func waitForFile(_ name: String, _ seconds: Double) -> Bool {
    let end = Date().addingTimeInterval(seconds)
    while Date() < end {
      if FileManager.default.fileExists(atPath: "\(shots)/\(name)") { return true }
      Thread.sleep(forTimeInterval: 0.5)
    }
    return false
  }

  func testNotificationWithButtons() throws {
    let app = XCUIApplication()
    app.launchEnvironment = ["GURTOS_ASK": "1", "GURTOS_PAIR": ProcessInfo.processInfo.environment["PAIR"] ?? ""]
    app.launch()
    let allow = spring.alerts.buttons["Allow"]
    if allow.waitForExistence(timeout: 15) {
      shot("permission")
      allow.tap()
    }
    XCTAssert(FileManager.default.createFile(atPath: "\(shots)/allowed", contents: Data()))
    // The host writes the encrypted push once the box has this phone's subscription.
    XCTAssert(waitForFile("push.apns", 120), "no push was made")
    app.terminate()
    app.launchEnvironment = ["GURTOS_LOCALPUSH": "\(shots)/push.apns"]
    app.launch()
    Thread.sleep(forTimeInterval: 1)
    XCUIDevice.shared.press(.home)
    let banner = spring.descendants(matching: .any).matching(NSPredicate(format: "label CONTAINS %@", ProcessInfo.processInfo.environment["BANNER"] ?? "Deploy the new build")).firstMatch
    XCTAssert(banner.waitForExistence(timeout: 30), "no notification arrived")
    Thread.sleep(forTimeInterval: 1)
    shot("notification")
    if !(ProcessInfo.processInfo.environment["NOACTIONS"] ?? "").isEmpty { return } // a notice with no buttons (a tripwire)
    banner.press(forDuration: 1.2)
    XCTAssert(spring.buttons["Approve"].waitForExistence(timeout: 10) || spring.buttons["Approve with Face ID"].waitForExistence(timeout: 2))
    Thread.sleep(forTimeInterval: 0.8)
    shot("notification-actions")
  }
}
