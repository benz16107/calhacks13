// What a box's pairing QR code holds, and turning it into a machine this device can call.
import Foundation

/** One paired machine: its address, this device's token for it and what the app remembers about it. */
public struct Machine: Codable, Identifiable, Hashable, Sendable {
  /** The computer's origin, like https://rosa.box.gurtos.com (through the relay) or http://192.168.1.20:7700 (home network). */
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
   * Every form a computer shows (core/README.md, "Remote access"):
   * - http://192.168.1.20:7700/pair#CODE (`boxUrl`, its own page on the home network: the QR with remote access off)
   * - https://rosa.box.gurtos.com/pair#CODE (`boxUrl` with remote access on)
   * - https://app.gurtos.com/pair?box=rosa.box.gurtos.com#CODE (`url` with remote access on)
   * - http://192.168.1.20:7700/#pair/CODE (the older link)
   */
  public static func parse(_ text: String) -> PairingLink? {
    guard let u = URLComponents(string: text.trimmingCharacters(in: .whitespacesAndNewlines)),
          let scheme = u.scheme?.lowercased(), scheme == "https" || scheme == "http", let host = u.host, !host.isEmpty
    else { return nil }
    var fragment = u.fragment ?? ""
    if fragment.hasPrefix("pair/") { fragment.removeFirst(5) }
    guard isCode(fragment) else { return nil }
    if host == GurtConfig.appHost {
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

  /** Typed by hand: an address ("192.168.1.20", "rosa.box.gurtos.com") and the code, which may have been read off as "8120 D849". */
  public static func typed(address: String, code: String) -> PairingLink? {
    let a = address.trimmingCharacters(in: .whitespacesAndNewlines)
    let c = code.filter { !$0.isWhitespace }
    guard !a.isEmpty, isCode(c) else { return nil }
    // A computer's name on the relay is https; anything else is its own port on the home network.
    let withScheme = a.contains("://") ? a : (GurtConfig.isRelayName(a) ? "https://\(a)" : "http://\(a)")
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
 * A pairing link from a computer whose remote access is off, as the hosted app made it. Its details ride in the
 * fragment, so no server log sees them: https://app.gurtos.com/pair#code=CODE&rv=<id>&lan=<ip:port>&n=<name>. `rv` (only while the computer is in
 * setup) lets the relay's rendezvous ask the computer to come online; `lan` is its address on the home network.
 * A bare https://app.gurtos.com/pair#CODE (no box named) parses too, with neither.
 */
public struct Rendezvous: Equatable, Sendable {
  public var id: String?
  public var code: String
  public var name: String?
  public var lan: String?

  public init(id: String?, code: String, name: String? = nil, lan: String? = nil) {
    self.id = id
    self.code = code
    self.name = name
    self.lan = lan
  }

  public static func parse(_ text: String) -> Rendezvous? {
    guard let u = URLComponents(string: text.trimmingCharacters(in: .whitespacesAndNewlines)), u.scheme == "https", u.host == GurtConfig.appHost,
          !(u.queryItems ?? []).contains(where: { $0.name == "box" }), let fragment = u.fragment, !fragment.isEmpty
    else { return nil }
    if PairingLink.isCode(fragment) { return Rendezvous(id: nil, code: fragment) }
    // The fragment as search params. URLComponents(string:) returns nil on a bad link; setting percentEncodedQuery traps.
    guard let f = URLComponents(string: "?" + (u.percentEncodedFragment ?? "")) else { return nil }
    let item = { (k: String) in f.queryItems?.first { $0.name == k }?.value }
    guard let code = item("code"), PairingLink.isCode(code) else { return nil }
    let id = item("rv").flatMap { $0.range(of: "^[A-Za-z0-9_-]{4,64}$", options: .regularExpression) != nil ? $0 : nil }
    let lan = item("lan").flatMap { $0.range(of: "^[A-Za-z0-9.:\\[\\]-]{3,64}$", options: .regularExpression) != nil ? $0 : nil }
    return Rendezvous(id: id, code: code, name: item("n").map { String($0.prefix(40)) }, lan: lan)
  }

  /** The same computer on the home network, if the link named one: plain HTTP to its own port. */
  public var lanLink: PairingLink? { lan.flatMap { URL(string: "http://\($0)") }.map { PairingLink(box: $0, code: code) } }

  /** The relay's answer must be a computer's name under its domain, nothing else: it decides where the code is sent. */
  public static func checkedHost(_ host: String) -> URL? {
    let domain = NSRegularExpression.escapedPattern(for: GurtConfig.relayHost)
    guard host.range(of: "^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]\\.\(domain)$", options: .regularExpression) != nil else { return nil }
    return URL(string: "https://\(host)")
  }

  /**
   * Pair over the internet: ask the computer (PUT /v1/rv/<id>/ask), then wait for its address or its error, polling
   * each with ?wait=25 until one answers 200. Gives up after about 3 minutes, or at once when the relay is down.
   */
  public func resolve(relay: URL = GurtConfig.relay, session: URLSession = .shared) async throws -> PairingLink {
    guard let id else { throw BoxError(status: 0, message: "This code can't be paired over the internet.") }
    let base = relay.appending(path: "v1/rv/\(id)")
    var ask = URLRequest(url: base.appending(path: "ask"), timeoutInterval: 20)
    ask.httpMethod = "PUT"
    ask.setValue("application/json", forHTTPHeaderField: "content-type")
    ask.httpBody = Data("{}".utf8)
    let (askBody, askRes) = try await Relay.send(ask, session)
    guard (askRes as? HTTPURLResponse).map({ (200..<300).contains($0.statusCode) }) == true else {
      throw Relay.refused(askRes, askBody, "The relay didn't take the request. Try again.")
    }
    // Each poll waits up to 25 s on the relay; the first of host or error to answer 200 decides.
    let poll = { (what: String) in Relay.object(try await Relay.poll(base.appending(path: what), session)) }
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
}
