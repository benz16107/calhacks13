import CryptoKit
import Foundation
import Testing
@testable import GurtKit

// RFC 8291 section 5's example keys (public test values printed in the RFC).
let uaPrivate = "q1dXpw3UpT5VOmu_cf_v6ih07Aems3njxI-JWgLcM94" // gitleaks:allow (RFC 8291 example key)
let rfcAuth = "BTBZMqHH6r4Tts7J_aSIgg" // gitleaks:allow
let rfcBody = "DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN"
// Made by core/push.ts (encrypt(message(fields, key))) for the same phone key, with non-ASCII and quotes in it.
let boxKey = "BwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwc"
let boxBody = "4zM3u2BIvqDjTGEbZGIu6gAAEABBBCPsCyzCALI9Hdb_NHdIGDVHEzLl7ACb8HobRTuk_WMtAJbEFmB0Z1pY57MYV7qKQJHIO4N3CAf1TAhsvKhohbLH9KXqUJXZ28uPeVqvePpUZwhEFE_CnmVXq8qLb1o6yVAFBTdof4dZbQGXo2SeTwt1stEynPUjl_bQM96jUCVdKyOzdoNPy0V47oZEisgary8qKIowGp8ECrWkL9Kok6bOdwZA06e6g9pGo3TEOpB9ld7P3ul1OZ_MEIwko6jiFKeEUv7hfV-l-qKwP2_eEskiAW5Lk6PJm6eYs0tlMDqbi91WqeG1AlPUy0CYWUeQVU9gzrxerX6Ef7k5MxqAwL9rzYQl1cyzGVN2hovkG19XkB3MucFt7eJviUHe637a0zzDcj84Mf2VEAsnPLPbYVsfqHvTZO0k2XsvEMGgaJfXnvYTMuaO8-HZcg0a8XdfKy1xo6_6eQsbHUlvGGINJ99TUISxqTdYDzpujexW"

func phoneKey() throws -> P256.KeyAgreement.PrivateKey { try P256.KeyAgreement.PrivateKey(rawRepresentation: Base64URL.decode(uaPrivate)!) }

@Test func decryptsTheRFCExample() throws {
  let out = try WebPush.decrypt(Base64URL.decode(rfcBody)!, privateKey: phoneKey(), auth: Base64URL.decode(rfcAuth)!)
  #expect(String(data: out, encoding: .utf8) == "When I grow up, I want to be a watermelon")
}

@Test func decryptsAndChecksABoxPush() throws {
  let plain = try WebPush.decrypt(Base64URL.decode(boxBody)!, privateKey: phoneKey(), auth: Base64URL.decode(rfcAuth)!)
  let fields = try #require(WebPush.verify(plain, key: Base64URL.decode(boxKey)!))
  #expect(fields["body"] as? String == "Café: buy it ✓")
  #expect(fields["costCents"] as? Int == 4000)
  #expect(fields["mac"] == nil)
}

@Test func refusesAPushSignedWithAnotherBoxKey() throws {
  let plain = try WebPush.decrypt(Base64URL.decode(boxBody)!, privateKey: phoneKey(), auth: Base64URL.decode(rfcAuth)!)
  #expect(WebPush.verify(plain, key: Data(repeating: 8, count: 32)) == nil)
  // A changed field fails too, even with the right key.
  let forged = String(data: plain, encoding: .utf8)!.replacingOccurrences(of: "4000", with: "4")
  #expect(WebPush.verify(Data(forged.utf8), key: Base64URL.decode(boxKey)!) == nil)
}

@Test func refusesAPushForAnotherPhone() {
  #expect(throws: (any Error).self) {
    try WebPush.decrypt(Base64URL.decode(boxBody)!, privateKey: P256.KeyAgreement.PrivateKey(), auth: Base64URL.decode(rfcAuth)!)
  }
}

@Test func readsEveryPairingLink() {
  #expect(PairingLink.parse("https://app.gurtos.com/pair?box=rosa.box.gurtos.com#ab12cd34") == PairingLink(box: URL(string: "https://rosa.box.gurtos.com")!, code: "ab12cd34"))
  #expect(PairingLink.parse("https://rosa.box.gurtos.com/pair#ab12cd34")?.box.absoluteString == "https://rosa.box.gurtos.com")
  #expect(PairingLink.parse("http://192.168.1.20:7700/pair#ab12cd34")?.box.absoluteString == "http://192.168.1.20:7700")
  #expect(PairingLink.parse("http://192.168.1.20:7700/#pair/ab12cd34")?.code == "ab12cd34")
  // No code, a bad code, another scheme, or a box that smuggles a path or a user: refused.
  #expect(PairingLink.parse("https://rosa.box.gurtos.com/pair") == nil)
  #expect(PairingLink.parse("https://rosa.box.gurtos.com/pair#a b") == nil)
  #expect(PairingLink.parse("ftp://rosa.box.gurtos.com/pair#ab12cd34") == nil)
  #expect(PairingLink.parse("https://app.gurtos.com/pair?box=evil.com/x#ab12cd34") == nil)
  #expect(PairingLink.parse("https://app.gurtos.com/pair?box=me@evil.com#ab12cd34") == nil)
}

@Test func readsATypedAddress() {
  #expect(PairingLink.typed(address: "rosa.box.gurtos.com", code: "ab12cd34")?.box.absoluteString == "https://rosa.box.gurtos.com")
  #expect(PairingLink.typed(address: "192.168.1.20", code: "ab12cd34")?.box.absoluteString == "http://192.168.1.20:7700")
  #expect(PairingLink.typed(address: "192.168.1.20:7790", code: "ab12cd34")?.box.absoluteString == "http://192.168.1.20:7790")
  #expect(PairingLink.typed(address: "", code: "ab12cd34") == nil)
}

@Test func amountFollowsThePortal() {
  let route = ApprovalRoute(rule: "Over $10,000 goes to the Controller.", to: "the Controller", amountCents: 4_000_000, people: [], why: "")
  var a = Approval(id: "a", task: "t", question: "q", costCents: 0, state: "pending", route: route)
  #expect(a.amountCents == 4_000_000)
  a.route?.rule = "Fraud referrals go to the fraud reviewer."
  #expect(a.amountCents == 0 && a.isFraud)
  #expect(Money.dollars(4_000_000) == "$40,000" && Money.dollars(1250) == "$12.50")
}

@Test func apnsEndpointNamesTopicAndEnvironment() {
  #expect(apnsEndpoint(topic: "com.benzhou.gurtos", deviceToken: Data([0xab, 0x01]), sandbox: true) == "https://box.gurtos.com/v1/apns/com.benzhou.gurtos/sandbox/ab01")
}

@Test func decodesFractionalCents() throws {
  // A Droid task's cost counts model spending in fractions of a cent; one such task must not drop the whole list.
  let tasks = try JSONDecoder().decode([BoxTask].self, from: Data(#"[{"id":"t1","title":"Fix add()","state":"waiting","costCents":2.02415},{"id":"t2","title":"x","state":"done","costCents":3}]"#.utf8))
  #expect(tasks.count == 2 && tasks[0].costCents == 2.02415)
  let a = try JSONDecoder().decode(Approval.self, from: Data(#"{"id":"a","task":"t1","question":"q","costCents":12.2,"state":"pending"}"#.utf8))
  #expect(a.costCents == 13)
  #expect(Money.dollars(2.6) == "$0.03")
}

@Test func readsARendezvousLink() {
  let r = Rendezvous.parse("https://app.gurtos.com/pair#code=ab12cd34&rv=Ab3_kq9Z&lan=192.168.1.20:7700&n=Home%20box")
  #expect(r == Rendezvous(id: "Ab3_kq9Z", code: "ab12cd34", name: "Home box", lan: "192.168.1.20:7700"))
  #expect(r?.lanLink?.box.absoluteString == "http://192.168.1.20:7700")
  // Out of setup: no rv, the home network only.
  #expect(Rendezvous.parse("https://app.gurtos.com/pair#code=ab12cd34&lan=192.168.1.20:7700&n=Home%20box") == Rendezvous(id: nil, code: "ab12cd34", name: "Home box", lan: "192.168.1.20:7700"))
  // A bare code with no box named.
  #expect(Rendezvous.parse("https://app.gurtos.com/pair#ab12cd34") == Rendezvous(id: nil, code: "ab12cd34"))
  // Remote access on keeps its own link, and these are not direct pairing links.
  #expect(Rendezvous.parse("https://app.gurtos.com/pair?box=rosa.box.gurtos.com#ab12cd34") == nil)
  #expect(PairingLink.parse("https://app.gurtos.com/pair?box=rosa.box.gurtos.com#ab12cd34") != nil)
  #expect(PairingLink.parse("https://app.gurtos.com/pair#code=ab12cd34&rv=Ab3_kq9Z") == nil)
  #expect(Rendezvous.parse("https://evil.example/pair#code=ab12cd34&rv=Ab3_kq9Z") == nil)
  #expect(Rendezvous.parse("https://app.gurtos.com/pair#code=ab12cd34&rv=a/b")?.id == nil, "a bad rv is dropped")
  #expect(Rendezvous.parse("https://app.gurtos.com/pair#code=ab12cd34&lan=x@evil.com/y")?.lan == nil, "a lan value that isn't host:port is dropped")
  #expect(Rendezvous.parse("https://app.gurtos.com/pair#rv=Ab3_kq9Z") == nil, "no code, nothing to pair")
  _ = Rendezvous.parse("https://app.gurtos.com/pair#code=ab12cd34&n=%E2%9C%93%20%25%20#x") // odd bytes in a scanned link must not crash
}

@Test func acceptsOnlyABoxNameFromTheRelay() {
  #expect(Rendezvous.checkedHost("rosa.box.gurtos.com")?.absoluteString == "https://rosa.box.gurtos.com")
  for bad in ["evil.com", "rosa.box.gurtos.com.evil.com", "x.rosa.box.gurtos.com", "rosa.box.gurtos.com/path", "a.box.gurtos.com", "-ab.box.gurtos.com", "ROSA.box.gurtos.com"] {
    #expect(Rendezvous.checkedHost(bad) == nil, "\(bad)")
  }
}

/** A stand-in relay: answers by path, so resolve() runs without the network. */
final class StubRelay: URLProtocol {
  nonisolated(unsafe) static var answer: (URLRequest) -> (Int, String) = { _ in (404, "") }
  override class func canInit(with request: URLRequest) -> Bool { true }
  override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }
  override func startLoading() {
    let (status, body) = StubRelay.answer(request)
    client?.urlProtocol(self, didReceive: HTTPURLResponse(url: request.url!, statusCode: status, httpVersion: nil, headerFields: nil)!, cacheStoragePolicy: .notAllowed)
    client?.urlProtocol(self, didLoad: Data(body.utf8))
    client?.urlProtocolDidFinishLoading(self)
  }
  override func stopLoading() {}
  static var session: URLSession { let c = URLSessionConfiguration.ephemeral; c.protocolClasses = [StubRelay.self]; return URLSession(configuration: c) }
}

@Test func rendezvousWaitsForTheAddressOrTheError() async throws {
  let r = Rendezvous(id: "Ab3_kq9Z", code: "ab12cd34", name: "Home box", lan: nil)
  nonisolated(unsafe) var hostPolls = 0
  StubRelay.answer = { req in
    let p = req.url!.path
    if p.hasSuffix("/ask") { return req.httpMethod == "PUT" ? (200, "{}") : (405, "") }
    if p.hasSuffix("/host") { hostPolls += 1; return hostPolls < 3 ? (204, "") : (200, #"{"host":"home-box.box.gurtos.com"}"#) }
    return (204, "")
  }
  let link = try await r.resolve(session: StubRelay.session)
  #expect(link == PairingLink(box: URL(string: "https://home-box.box.gurtos.com")!, code: "ab12cd34") && hostPolls == 3)

  StubRelay.answer = { req in req.url!.path.hasSuffix("/error") ? (200, #"{"error":"The owner said no."}"#) : req.url!.path.hasSuffix("/ask") ? (200, "{}") : (204, "") }
  await #expect(throws: BoxError.self) { try await r.resolve(session: StubRelay.session) }

  StubRelay.answer = { req in req.url!.path.hasSuffix("/host") ? (200, #"{"host":"evil.example"}"#) : req.url!.path.hasSuffix("/ask") ? (200, "{}") : (204, "") }
  await #expect(throws: BoxError.self, "an address outside box.gurtos.com is refused") { try await r.resolve(session: StubRelay.session) }
}

@Test func quickStartOpensWhatCoreSeals() throws {
  // Made by core/quickstart.ts seal() (commit 5319611) for this phone key and secret.
  let key = try Curve25519.KeyAgreement.PrivateKey(rawRepresentation: Base64URL.decode("kPE7JbXst_Hz9T7dTYl_ZryIF5GpTFZ4_-EoxN9timY")!) // gitleaks:allow (test key)
  #expect(Base64URL.encode(key.publicKey.rawRepresentation) == "7b0FcSLnTHu5y5mBujXm7KGFc_qg_gMh_G35BYrzIXo")
  let q = QuickStart(rv: String(repeating: "r", count: 22), pk: String(repeating: "p", count: 43), s: "BQUFBQUFBQUFBQUFBQUFBQ", name: "New box")
  let sealed = QuickStart.Sealed(v: 1, eph: "kN0aH8KYgNipakz4IrEyQD0eD0OJZ5iq1Hzh7-PYYjM", iv: "jIWwELKIqGy2rshD", ct: "RP2yuZrImZjrmrnnV6czrDcxa34acgMy_B-UAdea7ma1VBa8xivfLpBkLKnUrefoYcKHwRazzwwnroQ79Yor7xsDqQ")
  #expect(try q.open(sealed, with: key) == PairingLink(box: URL(string: "https://new-box.box.gurtos.com")!, code: "ab12cd34"))
  var other = q
  other.s = "BgYGBgYGBgYGBgYGBgYGBg"
  #expect(throws: (any Error).self, "a different QR secret can't open it") { try other.open(sealed, with: key) }
}

@Test func readsAQuickStartLink() {
  let rv = String(repeating: "a", count: 22), pk = String(repeating: "B", count: 43)
  let q = QuickStart.parse("https://app.gurtos.com/quickstart#rv=\(rv)&pk=\(pk)&s=\(String(repeating: "c", count: 22))&n=Home%20box")
  #expect(q?.name == "Home box" && q?.pk == pk)
  #expect(QuickStart.parse("https://app.gurtos.com/quickstart#rv=\(rv)&pk=short&s=\(String(repeating: "c", count: 22))") == nil)
  #expect(QuickStart.parse("https://evil.example/quickstart#rv=\(rv)&pk=\(pk)&s=\(String(repeating: "c", count: 22))") == nil)
  #expect(QuickStart.parse("https://app.gurtos.com/pair#rv=\(rv)&pk=\(pk)&s=\(String(repeating: "c", count: 22))") == nil)
}
