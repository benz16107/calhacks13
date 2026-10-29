// Where the apps look for the GurtOS relay and the hosted web app. A self-hoster sets GURTOS_RELAY and GURTOS_APP_HOST
// in native/apple/project.yml (the build writes them into each app's Info.plist and into the app's associated
// domain), and every address below follows. Without them the apps use ours. docs/self-host.md has the rest.
import Foundation

public enum GurtConfig {
  /** The relay's address: a box's name lives under its host, and pushes and Quick Start go through it. */
  public static let relay: URL = value("GurtOSRelay").flatMap { URL(string: $0) } ?? URL(string: "https://box.gurtos.com")!
  /** The hosted web app's host, whose links open the apps (pairing and Quick Start QR codes). */
  public static let appHost: String = value("GurtOSAppHost") ?? "app.gurtos.com"

  public static var relayHost: String { relay.host ?? "box.gurtos.com" }
  /** A box's name on the relay: "rosa.box.gurtos.com". */
  public static func isRelayName(_ host: String) -> Bool { host.hasSuffix(".\(relayHost)") }

  /** An Info.plist value, unless the build left its `$(...)` placeholder in. */
  static func value(_ key: String) -> String? {
    guard let v = Bundle.main.object(forInfoDictionaryKey: key) as? String, !v.isEmpty, !v.hasPrefix("$(") else { return nil }
    return v
  }
}
