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

/**
 * A pairing link from a computer whose remote access is off (core: the QR code when it has no address of its own):
 * https://app.gurtos.com/pair?rv=<id>&lan=<ip:port>&n=<name>#CODE. The relay's rendezvous asks the computer to come
 * online for this pairing, then gives its address; `lan` is its address on the home network.
 */
public struct Rendezvous: Equatable, Sendable {
  public var id: String
  public var code: String
  public var name: String?
  public var lan: String?

  public static func parse(_ text: String) -> Rendezvous? {
    guard let u = URLComponents(string: text.trimmingCharacters(in: .whitespacesAndNewlines)), u.scheme == "https", u.host == "app.gurtos.com",
          let id = u.queryItems?.first(where: { $0.name == "rv" })?.value, id.range(of: "^[A-Za-z0-9_-]{4,64}$", options: .regularExpression) != nil,
          let code = u.fragment, PairingLink.isCode(code)
    else { return nil }
    let lan = u.queryItems?.first { $0.name == "lan" }?.value.flatMap { $0.range(of: "^[A-Za-z0-9.:\\[\\]-]{3,64}$", options: .regularExpression) != nil ? $0 : nil }
    let name = u.queryItems?.first { $0.name == "n" }?.value.map { String($0.prefix(40)) }
    return Rendezvous(id: id, code: code, name: name, lan: lan)
  }

  /** The same computer on the home network, if the link named one: plain HTTP to its own port. */
  public var lanLink: PairingLink? { lan.flatMap { URL(string: "http://\($0)") }.map { PairingLink(box: $0, code: code) } }

  /** The relay's answer must be a box name under its domain, nothing else: it decides where the code is sent. */
  public static func checkedHost(_ host: String) -> URL? {
    guard host.range(of: "^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]\\.box\\.gurtos\\.com$", options: .regularExpression) != nil else { return nil }
    return URL(string: "https://\(host)")
  }

  /**
   * Pair over the internet: ask the computer (PUT /v1/rv/<id>/ask), then wait for its address or its error, polling
   * each with ?wait=25 until one answers 200. Gives up after about 3 minutes.
   */
  public func resolve(relay: URL = URL(string: "https://box.gurtos.com")!, session: URLSession = .shared) async throws -> PairingLink {
    let base = relay.appending(path: "v1/rv/\(id)")
    var ask = URLRequest(url: base.appending(path: "ask"), timeoutInterval: 20)
    ask.httpMethod = "PUT"
    ask.setValue("application/json", forHTTPHeaderField: "content-type")
    ask.httpBody = Data("{}".utf8)
    let (askBody, askRes) = try await session.data(for: ask)
    guard (askRes as? HTTPURLResponse).map({ (200..<300).contains($0.statusCode) }) == true else { throw Rendezvous.failure(askBody, "The relay didn't take the request. Try again.") }
    // Each poll waits up to 25 s on the relay; the first of host or error to answer 200 decides.
    func poll(_ what: String) async throws -> [String: Any] {
      while true {
        try Task.checkCancellation()
        let (d, r) = try await session.data(for: URLRequest(url: URL(string: base.appending(path: what).absoluteString + "?wait=25")!, timeoutInterval: 35))
        if (r as? HTTPURLResponse)?.statusCode == 200, let o = (try? JSONSerialization.jsonObject(with: d)) as? [String: Any] { return o }
        try await Task.sleep(nanoseconds: 500_000_000)
      }
    }
    return try await withThrowingTaskGroup(of: PairingLink?.self) { g in
      g.addTask {
        let o = try await poll("host")
        guard let h = o["host"] as? String, let box = Rendezvous.checkedHost(h) else { throw BoxError(status: 0, message: "The relay gave an address that isn't a GurtOS computer.") }
        return PairingLink(box: box, code: self.code)
      }
      g.addTask { throw BoxError(status: 0, message: (try await poll("error"))["error"] as? String ?? "The computer refused the request.") }
      g.addTask {
        try await Task.sleep(nanoseconds: 180_000_000_000)
        throw BoxError(status: 0, message: "\(self.name ?? "The computer") didn't answer. Check that it is on and online, or pair on the same Wi-Fi.")
      }
      defer { g.cancelAll() }
      guard let first = try await g.next(), let link = first else { throw BoxError(status: 0, message: "No answer.") }
      return link
    }
  }

  static func failure(_ body: Data, _ fallback: String) -> BoxError {
    BoxError(status: 0, message: ((try? JSONSerialization.jsonObject(with: body)) as? [String: Any])?["error"] as? String ?? fallback)
  }
}
