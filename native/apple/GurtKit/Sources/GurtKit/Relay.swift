// What the apps say when a connection fails, and the relay calls pairing and Quick Start make. Every failure turns
// into one plain sentence, so a screen never shows "The operation couldn't be completed (NSURLErrorDomain -1004)"
// and never waits on a relay or a computer that isn't answering.
import Foundation

enum Network {
  static let tls: Set<URLError.Code> = [.secureConnectionFailed, .serverCertificateUntrusted, .serverCertificateHasBadDate, .serverCertificateNotYetValid, .serverCertificateHasUnknownRoot, .clientCertificateRejected]
  static let lost: Set<URLError.Code> = [.cannotFindHost, .cannotConnectToHost, .dnsLookupFailed, .timedOut, .networkConnectionLost, .resourceUnavailable, .cannotLoadFromNetwork]
  static let offline: Set<URLError.Code> = [.notConnectedToInternet, .dataNotAllowed, .internationalRoamingOff, .callIsActive]

  /**
   * A failed connection to `host`, in words for people. Cancellation, decoding and our own errors pass through.
   * `home` is true for a computer's plain-HTTP address on the home network, where iOS may also have refused access.
   */
  static func explain(_ error: Error, host: String, home: Bool = false) -> Error {
    guard let e = error as? URLError else { return error }
    if offline.contains(e.code) { return BoxError(status: 0, message: "This device is offline. Connect to Wi-Fi or mobile data and try again.") }
    if tls.contains(e.code) { return BoxError(status: 0, message: "Couldn't make a secure connection to \(host).") }
    if e.code == .appTransportSecurityRequiresSecureConnection {
      return BoxError(status: 0, message: "\(host) has to be an https address, or the computer's IP address on your home network.")
    }
    if lost.contains(e.code) {
      let local = home ? " If GurtOS can't see devices on your network, allow Local Network for GurtOS in Settings." : ""
      return BoxError(status: 0, message: "Couldn't reach \(host). Check that it is on and that this device can reach it.\(local)")
    }
    return error
  }
}

/** The relay (relay/README.md): the meeting place for pairing and Quick Start. */
enum Relay {
  static let sameWiFi = "You can still pair on the same Wi-Fi as the computer."
  static let byHand = "Set the new computer up on its own screen instead."

  static func down(_ detail: String = "", advice: String = sameWiFi) -> BoxError {
    BoxError(status: 0, message: "Couldn't reach the GurtOS relay (\(GurtConfig.relayHost))\(detail). It may be offline. \(advice)")
  }

  static func object(_ d: Data) -> [String: Any] { ((try? JSONSerialization.jsonObject(with: d)) as? [String: Any]) ?? [:] }

  /** One relay request. A connection failure becomes "the relay is down", or "this device is offline". */
  static func send(_ request: URLRequest, _ session: URLSession, advice: String = sameWiFi) async throws -> (Data, URLResponse) {
    do { return try await session.data(for: request) } catch let e as URLError where e.code != .cancelled {
      throw Network.offline.contains(e.code) ? Network.explain(e, host: GurtConfig.relayHost) : down(advice: advice)
    }
  }

  /** The relay answered, but not with success: its own sentence, or "down" when it is the relay's or its server's fault. */
  static func refused(_ response: URLResponse, _ body: Data, _ fallback: String, advice: String = sameWiFi) -> BoxError {
    let status = (response as? HTTPURLResponse)?.statusCode ?? 0
    if status >= 500 { return down(" (error \(status))", advice: advice) }
    return BoxError(status: 0, message: ((try? JSONSerialization.jsonObject(with: body)) as? [String: Any])?["error"] as? String ?? fallback)
  }

  /**
   * Long-poll a rendezvous slot (`?wait=25`) until it holds something, and return what it holds. The relay answers
   * 404 while a slot is empty and 429 when asked too often, so those keep waiting. A relay that answers 5xx three
   * times in a row is down: stop.
   */
  static func poll(_ slot: URL, _ session: URLSession, wait: Int = 25, advice: String = sameWiFi) async throws -> Data {
    var parts = URLComponents(url: slot, resolvingAgainstBaseURL: false)
    parts?.queryItems = [URLQueryItem(name: "wait", value: String(wait))]
    guard let url = parts?.url else { throw down(advice: advice) }
    var failures = 0
    while true {
      try Task.checkCancellation()
      let (d, r) = try await send(URLRequest(url: url, timeoutInterval: TimeInterval(wait + 10)), session, advice: advice)
      let status = (r as? HTTPURLResponse)?.statusCode ?? 0
      if status == 200 { return d }
      failures = status >= 500 ? failures + 1 : 0
      if failures >= 3 { throw refused(r, d, "", advice: advice) }
      try await Task.sleep(nanoseconds: status == 429 ? 5_000_000_000 : 500_000_000)
    }
  }
}
