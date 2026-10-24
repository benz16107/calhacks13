// What a box's pairing QR code holds, and turning it into a machine this device can call.
import Foundation

/** One paired machine: its address, this device's token for it and what the app remembers about it. */
public struct Machine: Codable, Identifiable, Hashable, Sendable {
  /** The box's origin, like https://rosa.box.gurtos.com or http://192.168.1.20:7700. */
  public var url: String
  public var token: String
  public var boxId: String
  public var name: String
  /** server, personal or business, from the pairing answer and /api/system. */
  public var edition: String?
  /** Business: the person this device is, from /api/me. */
  public var person: String?
  public var personTitle: String?
  public var role: String?
  /** 32 random bytes (base64url) this device gave the box with its push subscription. It checks the box's pushes. */
  public var pushKey: String?
  public var deviceId: String?
  /** The Apple Watch's own token for this machine (kind watch), when the box gave one. */
  public var watchToken: String?

  /** Two test boxes can share an id, so the address is part of the identity. */
  public var id: String { "\(boxId)@\(url)" }
  public var isBusiness: Bool { edition == "business" }
  public var isPersonal: Bool { edition == "personal" }
  public var editionName: String {
    switch edition {
    case "business": "GurtOS Business"
    case "personal": "GurtOS Personal"
    default: "GurtOS Server"
    }
  }

  public init(url: String, token: String, boxId: String, name: String, edition: String? = nil) {
    self.url = url
    self.token = token
    self.boxId = boxId
    self.name = name
    self.edition = edition
  }
}

/** A pairing code and the box it belongs to. */
public struct PairingLink: Equatable, Sendable {
  public var box: URL
  public var code: String

  static let codeShape = try! NSRegularExpression(pattern: "^[A-Za-z0-9_-]{4,64}$")
  static func isCode(_ s: String) -> Bool {
    codeShape.firstMatch(in: s, range: NSRange(s.startIndex..., in: s)) != nil
  }

  /**
   * Every form a box shows (core/README.md, "Remote access"):
   * - https://app.gurtos.com/pair?box=rosa.box.gurtos.com#CODE (remote access on)
   * - https://rosa.box.gurtos.com/pair#CODE, http://192.168.1.20:7700/pair#CODE
   * - http://192.168.1.20:7700/#pair/CODE (the box screen's older link)
   */
  public static func parse(_ text: String) -> PairingLink? {
    guard let u = URLComponents(string: text.trimmingCharacters(in: .whitespacesAndNewlines)),
          let scheme = u.scheme?.lowercased(), scheme == "https" || scheme == "http", let host = u.host, !host.isEmpty
    else { return nil }
    var fragment = u.fragment ?? ""
    if fragment.hasPrefix("pair/") { fragment.removeFirst(5) }
    guard isCode(fragment) else { return nil }
    if host == "app.gurtos.com" {
      // The hosted app's link names the box. Only an https box, and only a host name (no path or user).
      guard let name = u.queryItems?.first(where: { $0.name == "box" })?.value,
            let box = URL(string: "https://\(name)"), box.host == name, box.path.isEmpty
      else { return nil }
      return PairingLink(box: box, code: fragment)
    }
    var origin = URLComponents()
    origin.scheme = scheme
    origin.host = host
    origin.port = u.port
    guard let box = origin.url else { return nil }
    return PairingLink(box: box, code: fragment)
  }

  /** Typed by hand: an address ("rosa.box.gurtos.com", "192.168.1.20:7700") and the code. */
  public static func typed(address: String, code: String) -> PairingLink? {
    let a = address.trimmingCharacters(in: .whitespacesAndNewlines)
    let c = code.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !a.isEmpty, isCode(c) else { return nil }
    // A box name on the relay is https; anything else is the box's own port on the home network.
    let withScheme = a.contains("://") ? a : (a.hasSuffix(".box.gurtos.com") ? "https://\(a)" : "http://\(a)")
    guard let u = URLComponents(string: withScheme), let host = u.host, !host.isEmpty else { return nil }
    var origin = URLComponents()
    origin.scheme = u.scheme
    origin.host = host
    origin.port = u.port ?? (u.scheme == "http" && !a.contains(":") ? 7700 : nil)
    guard let box = origin.url else { return nil }
    return PairingLink(box: box, code: c)
  }
}
