// Screenshots of real states for the track pages, driven like a person would: scroll a request, approve it with
// Face ID (the host enrolls and matches the simulator's face), then show the task and Activity. Inputs come from
// TEST_RUNNER_* variables; PNGs go to SHOTS. Run by scripts/device-shots.sh.
import XCTest

final class DeviceShots: XCTestCase {
  let env = ProcessInfo.processInfo.environment
  var shots: String { env["SHOTS"] ?? "/tmp/gshots" }
  let spring = XCUIApplication(bundleIdentifier: "com.apple.springboard")

  func shot(_ name: String) {
    try? XCUIScreen.main.screenshot().pngRepresentation.write(to: URL(fileURLWithPath: "\(shots)/\(name).png"))
  }

  func signal(_ name: String) { FileManager.default.createFile(atPath: "\(shots)/\(name)", contents: Data()) }

  func wait(for name: String, _ seconds: Double = 60) -> Bool {
    let end = Date().addingTimeInterval(seconds)
    while Date() < end {
      if FileManager.default.fileExists(atPath: "\(shots)/\(name)") { return true }
      Thread.sleep(forTimeInterval: 0.5)
    }
    return false
  }

  func launch(_ extra: [String: String]) -> XCUIApplication {
    let app = XCUIApplication()
    app.launchEnvironment = ["GURTOS_NOTIFY_ASKED": "1"].merging(extra) { $1 }
    app.launch()
    return app
  }

  /** A request scrolled to its checks: TEST_RUNNER_OPEN (a gurtos:// link), TEST_RUNNER_NAME. */
  func testScrolledRequest() throws {
    let app = launch(["GURTOS_OPEN": env["OPEN"] ?? ""])
    XCTAssert(app.buttons["Deny"].waitForExistence(timeout: 20))
    Thread.sleep(forTimeInterval: 1)
    // Drag from the middle of the page, above the floating Deny and Approve, toward the top.
    let from = app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.62)), to = app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.18))
    from.press(forDuration: 0.05, thenDragTo: to)
    Thread.sleep(forTimeInterval: 1.5)
    shot(env["NAME"] ?? "scrolled")
  }

  /** Approve with Face ID: the sheet, the match, then the task and Activity with how it was answered. */
  func testApproveWithFaceID() throws {
    let app = launch(["GURTOS_OPEN": env["OPEN"] ?? ""])
    let approve = app.buttons.matching(NSPredicate(format: "label BEGINSWITH 'Approve'")).firstMatch
    XCTAssert(approve.waitForExistence(timeout: 20))
    Thread.sleep(forTimeInterval: 1)
    approve.tap()
    // The first time, iOS asks whether GurtOS may use Face ID.
    let ok = spring.alerts.buttons["OK"]
    if ok.waitForExistence(timeout: 4) { ok.tap() }
    Thread.sleep(forTimeInterval: 1.5)
    shot("\(env["NAME"] ?? "faceid")-sheet")
    signal("faceid-up")
    XCTAssert(wait(for: "matched"), "the host did not match the face")
    Thread.sleep(forTimeInterval: 4)
    app.terminate()
    let task = launch(["GURTOS_OPEN": "gurtos://task/\(env["TASK"] ?? "")"])
    XCTAssert(task.staticTexts["Steps"].waitForExistence(timeout: 20))
    Thread.sleep(forTimeInterval: 2)
    shot("\(env["NAME"] ?? "faceid")-task")
    task.terminate()
    let activity = launch(["GURTOS_TAB": "activity"])
    Thread.sleep(forTimeInterval: 5)
    _ = activity
    shot("\(env["NAME"] ?? "faceid")-activity")
  }
}
