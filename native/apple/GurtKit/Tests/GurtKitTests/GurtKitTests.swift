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
