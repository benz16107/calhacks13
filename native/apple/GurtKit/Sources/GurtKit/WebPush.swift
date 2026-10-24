// Push on Apple devices, end to end encrypted. The box encrypts every push for this device with RFC 8291
// (aes128gcm, core/push.ts) and signs it with the key this device gave that box alone. The relay turns it into an
// APNs notification that carries only the ciphertext; the notification service extension decrypts it here.
import CryptoKit
import Foundation

public enum Base64URL {
  public static func encode(_ d: Data) -> String {
    d.base64EncodedString().replacingOccurrences(of: "+", with: "-").replacingOccurrences(of: "/", with: "_").replacingOccurrences(of: "=", with: "")
  }

  public static func decode(_ s: String) -> Data? {
    var b = s.replacingOccurrences(of: "-", with: "+").replacingOccurrences(of: "_", with: "/")
    while b.count % 4 != 0 { b += "=" }
    return Data(base64Encoded: b)
  }
}

public enum WebPushError: Error { case short, badKey, sealed }

public enum WebPush {
  /** RFC 8291 decryption of one aes128gcm record, with this device's private key and auth secret. */
  public static func decrypt(_ body: Data, privateKey: P256.KeyAgreement.PrivateKey, auth: Data) throws -> Data {
    let b = [UInt8](body)
    guard b.count > 21 else { throw WebPushError.short }
    let salt = Data(b[0..<16])
    let idlen = Int(b[20])
    guard b.count > 21 + idlen + 16 else { throw WebPushError.short }
    let asPublicRaw = Data(b[21..<(21 + idlen)])
    guard let asPublic = try? P256.KeyAgreement.PublicKey(x963Representation: asPublicRaw) else { throw WebPushError.badKey }
    let uaPublic = privateKey.publicKey.x963Representation
    let shared = try privateKey.sharedSecretFromKeyAgreement(with: asPublic).withUnsafeBytes { Data($0) }

    func hmac(_ key: Data, _ data: Data) -> Data { Data(HMAC<SHA256>.authenticationCode(for: data, using: SymmetricKey(data: key))) }
    let prkKey = hmac(auth, shared)
    let ikm = hmac(prkKey, Data("WebPush: info\0".utf8) + uaPublic + asPublicRaw + Data([1]))
    let prk = hmac(salt, ikm)
    let cek = hmac(prk, Data("Content-Encoding: aes128gcm\0\u{1}".utf8)).prefix(16)
    let nonce = hmac(prk, Data("Content-Encoding: nonce\0\u{1}".utf8)).prefix(12)

    let sealed = Data(b[(21 + idlen)...])
    guard let box = try? AES.GCM.SealedBox(nonce: AES.GCM.Nonce(data: nonce), ciphertext: sealed.dropLast(16), tag: sealed.suffix(16)),
          let plain = try? AES.GCM.open(box, using: SymmetricKey(data: cek))
    else { throw WebPushError.sealed }
    // The record ends with a delimiter (2 for the last record) and optional zero padding.
    guard let end = plain.lastIndex(where: { $0 != 0 }), plain[end] == 2 else { throw WebPushError.sealed }
    return plain[plain.startIndex..<end]
  }

  /**
   * The box's message is `JSON.stringify({...fields sorted by key, mac})` (core/push.ts message()), and the mac is
   * HMAC-SHA256 over the same JSON without it. So the signed bytes are the message with its last member, which is
   * always `"mac"`, cut off: no need to rebuild JavaScript's JSON byte for byte.
   * Returns the fields when the mac checks out with `key`, else nil.
   */
  public static func verify(_ message: Data, key: Data) -> [String: Any]? {
    guard let text = String(data: message, encoding: .utf8),
          let fields = (try? JSONSerialization.jsonObject(with: message)) as? [String: Any],
          let mac = fields["mac"] as? String, let macBytes = Base64URL.decode(mac)
    else { return nil }
    let tail = ",\"mac\":\"\(mac)\"}"
    guard text.hasSuffix(tail) else { return nil }
    let signed = Data((text.dropLast(tail.count) + "}").utf8)
    guard HMAC<SHA256>.isValidAuthenticationCode(macBytes, authenticating: signed, using: SymmetricKey(data: key)) else { return nil }
    var out = fields
    out.removeValue(forKey: "mac")
    return out
  }
}

/** This device's push keys: one P-256 key pair and auth secret for every box, kept in the shared keychain. */
public struct PushKeys: Sendable {
  public var privateKey: P256.KeyAgreement.PrivateKey
  public var auth: Data

  public var p256dh: String { Base64URL.encode(privateKey.publicKey.x963Representation) }
  public var authString: String { Base64URL.encode(auth) }

  public static func loadOrMake(_ store: Keychain) -> PushKeys {
    if let d = store.read("push-keys"), let o = try? JSONDecoder().decode([String: String].self, from: d),
       let k = o["key"].flatMap(Base64URL.decode), let a = o["auth"].flatMap(Base64URL.decode),
       let pk = try? P256.KeyAgreement.PrivateKey(rawRepresentation: k) {
      return PushKeys(privateKey: pk, auth: a)
    }
    let keys = PushKeys(privateKey: P256.KeyAgreement.PrivateKey(), auth: randomBytes(16))
    store.write("push-keys", try! JSONEncoder().encode(["key": Base64URL.encode(keys.privateKey.rawRepresentation), "auth": keys.authString]))
    return keys
  }
}

public func randomBytes(_ n: Int) -> Data {
  var g = SystemRandomNumberGenerator()
  return Data((0..<n).map { _ in UInt8.random(in: 0...255, using: &g) })
}

/** The APNs address the relay forwards to (relay/README.md, "The push gateway"). */
public func apnsEndpoint(topic: String, deviceToken: Data, sandbox: Bool) -> String {
  "https://box.gurtos.com/v1/apns/\(topic)/\(sandbox ? "sandbox" : "production")/\(deviceToken.map { String(format: "%02x", $0) }.joined())"
}
