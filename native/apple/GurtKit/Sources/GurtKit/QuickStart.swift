// Quick Start (core/quickstart.ts): set up a new computer from one this phone owns. The new computer's QR names a
// rendezvous id, its one-time X25519 key and a secret, after `#`. The phone asks the source computer to send, the
// owner approves with Face ID, and the new computer seals an owner pairing code back to the phone's one-time key.
import CryptoKit
import Foundation

public struct QuickStart: Equatable, Sendable {
  public var rv: String
  public var pk: String
  public var s: String
  public var name: String

  /** https://app.gurtos.com/quickstart#rv=…&pk=…&s=…&n=…, checked as core's parseSend checks it. */
  public static func parse(_ text: String) -> QuickStart? {
    guard let u = URLComponents(string: text.trimmingCharacters(in: .whitespacesAndNewlines)), u.scheme == "https", u.host == "app.gurtos.com",
          u.path == "/quickstart", let f = URLComponents(string: "?" + (u.percentEncodedFragment ?? ""))
    else { return nil }
    let item = { (k: String) in f.queryItems?.first { $0.name == k }?.value }
    let ok = { (v: String?, min: Int, max: Int) in v?.range(of: "^[A-Za-z0-9_-]{\(min),\(max)}$", options: .regularExpression) != nil }
    guard ok(item("rv"), 22, 64), ok(item("pk"), 43, 43), ok(item("s"), 22, 43) else { return nil }
    let n = item("n")?.trimmingCharacters(in: .whitespaces)
    return QuickStart(rv: item("rv")!, pk: item("pk")!, s: item("s")!, name: String((n?.isEmpty == false ? n! : "the new computer").prefix(40)))
  }

  /** What the new computer seals to the phone: X25519 with its one-time key, HKDF-SHA256 (salt s), AES-256-GCM. */
  public struct Sealed: Codable, Sendable {
    public var v: Int
    public var eph: String
    public var iv: String
    public var ct: String
  }

  /** Open the owner pairing code. Throws if anything was changed, or the address isn't a GurtOS computer. */
  public func open(_ b: Sealed, with key: Curve25519.KeyAgreement.PrivateKey) throws -> PairingLink {
    guard b.v == 1, let eph = Base64URL.decode(b.eph), let iv = Base64URL.decode(b.iv), let ct = Base64URL.decode(b.ct), ct.count > 16, let salt = Base64URL.decode(s)
    else { throw BoxError(status: 0, message: "That isn't a Quick Start reply.") }
    let shared = try key.sharedSecretFromKeyAgreement(with: Curve25519.KeyAgreement.PublicKey(rawRepresentation: eph))
    let aes = shared.hkdfDerivedSymmetricKey(using: SHA256.self, salt: salt, sharedInfo: Data("gurtos quickstart v1".utf8), outputByteCount: 32)
    let plain = try AES.GCM.open(AES.GCM.SealedBox(nonce: AES.GCM.Nonce(data: iv), ciphertext: ct.dropLast(16), tag: ct.suffix(16)), using: aes)
    let o = (try? JSONSerialization.jsonObject(with: plain)) as? [String: Any]
    guard let host = (o?["host"] as? String).flatMap(Rendezvous.checkedHost), let code = o?["code"] as? String, PairingLink.isCode(code)
    else { throw BoxError(status: 0, message: "The new computer's reply has no GurtOS address in it.") }
    return PairingLink(box: host, code: code)
  }

  /** Wait (up to 10 minutes) for the new computer's sealed reply in the relay's rendezvous slot, and open it. */
  public func waitForOwnerCode(_ key: Curve25519.KeyAgreement.PrivateKey, relay: URL = URL(string: "https://box.gurtos.com")!, session: URLSession = .shared) async throws -> PairingLink {
    let url = URL(string: relay.appending(path: "v1/rv/\(rv)/owner").absoluteString + "?wait=25")!
    let end = Date().addingTimeInterval(600)
    while Date() < end {
      try Task.checkCancellation()
      let (d, r) = try await session.data(for: URLRequest(url: url, timeoutInterval: 35))
      if (r as? HTTPURLResponse)?.statusCode == 200, let b = try? JSONDecoder().decode(Sealed.self, from: d) { return try open(b, with: key) }
      try await Task.sleep(nanoseconds: 500_000_000)
    }
    throw BoxError(status: 0, message: "\(name) didn't answer. Check that it is still on its Quick Start screen.")
  }
}

/** The source computer's answer to `POST /api/quickstart/send`: what the owner is asked to approve. */
public struct QuickOffer: Codable, Sendable {
  public struct Key: Codable, Hashable, Sendable {
    public var name: String
    public var chosen: Bool
  }
  public var id: String
  public var question: String
  public var phrase: String
  public var keys: [Key]
}

extension BoxClient {
  /** Owner only: ask this computer to send its setup to the new one. */
  public func quickstartSend(_ q: QuickStart, phonePk: String) async throws -> QuickOffer {
    try await call("POST", "/quickstart/send", body: ["rv": q.rv, "pk": q.pk, "s": q.s, "n": q.name, "phonePk": phonePk])
  }

  /** The owner's answer, with the keys they left ticked. A 409 means the new computer stopped. */
  public func quickstartAnswer(_ id: String, approve: Bool, keys: [String]) async throws {
    _ = try await call("POST", "/quickstart/send/\(id)", body: ["approve": approve, "keys": keys], as: Ignored.self)
  }
}
