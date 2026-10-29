// The computer's HTTP API (core/README.md), called with this device's token. Every call the apps make is here, and
// native/demo.ts checks the same calls against a real box.
import Foundation

public struct BoxError: LocalizedError, Sendable {
  public var status: Int
  public var message: String
  /** The computer wants the answer from another device (a Watch answer above its limit): 'iphone'. */
  public var needs: String?
  public var errorDescription: String? { message }
  public var unpaired: Bool { status == 401 }
}

/** How a device kind and its check are sent with an answer (core: `auth`). */
public enum AnswerAuth: String, Sendable {
  case faceID = "face-id", touchID = "touch-id", passcode, wrist, none
}

public struct BoxClient: Sendable {
  /** nil when a saved address doesn't parse: every call then fails with "Bad address" and the token goes nowhere. */
  public var base: URL?
  public var token: String?
  public var session: URLSession

  public init(machine: Machine, session: URLSession = .shared) {
    self.base = URL(string: machine.url)
    self.token = machine.token
    self.session = session
  }

  public init(base: URL, token: String? = nil, session: URLSession = .shared) {
    self.base = base
    self.token = token
    self.session = session
  }

  func request(_ method: String, _ path: String, body: [String: Any]? = nil, timeout: TimeInterval = 15) throws -> URLRequest {
    // Paths come from this file only, already escaped, some with a query.
    guard let base, let url = URL(string: base.absoluteString.trimmingCharacters(in: CharacterSet(charactersIn: "/")) + "/api" + path) else { throw BoxError(status: 0, message: "That computer's address isn't valid. Forget it and pair again.") }
    var r = URLRequest(url: url, timeoutInterval: timeout)
    r.httpMethod = method
    r.setValue("application/json", forHTTPHeaderField: "accept")
    if let token { r.setValue("Bearer \(token)", forHTTPHeaderField: "authorization") }
    if let body {
      r.setValue("application/json", forHTTPHeaderField: "content-type")
      r.httpBody = try JSONSerialization.data(withJSONObject: body)
    }
    return r
  }

  public func call<T: Decodable>(_ method: String, _ path: String, body: [String: Any]? = nil, as: T.Type = T.self) async throws -> T {
    let data: Data, response: URLResponse
    do { (data, response) = try await session.data(for: try request(method, path, body: body)) } catch {
      throw Network.explain(error, host: base?.host ?? "the computer", home: base?.scheme == "http")
    }
    let status = (response as? HTTPURLResponse)?.statusCode ?? 0
    guard (200..<300).contains(status) else {
      let o = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
      // A relay or proxy in front of a computer that is off answers 502 to 504 with a page, not a sentence.
      let fallback = status >= 500 ? "The computer isn't answering right now (error \(status)). Check that it is on, then try again." : "The computer answered \(status)."
      throw BoxError(status: status, message: o?["error"] as? String ?? fallback, needs: o?["needs"] as? String)
    }
    do { return try JSONDecoder().decode(T.self, from: data.isEmpty ? Data("null".utf8) : data) } catch is DecodingError {
      throw BoxError(status: status, message: "That address didn't answer like a GurtOS computer, or it runs a different version. Update GurtOS on both.")
    }
  }

  // MARK: Pairing

  /** Redeem a one-time code from the computer's screen for this device's own token. `kind`: iphone, mac or watch. */
  public static func pair(_ link: PairingLink, name: String, kind: String, session: URLSession = .shared) async throws -> Machine {
    let client = BoxClient(base: link.box, session: session)
    let r: PairResult = try await client.call("POST", "/pair", body: ["code": link.code, "name": name, "kind": kind])
    var m = Machine(url: link.box.absoluteString.trimmingCharacters(in: CharacterSet(charactersIn: "/")), token: r.token, boxId: r.box.id, name: r.box.name, edition: r.edition)
    m.deviceId = r.device?.id
    return m
  }

  /** Forget: this device's token and push subscription stop working on the computer. */
  public func unpair() async throws { _ = try await call("DELETE", "/pair/self", as: Ignored.self) }

  /** A token for this phone's Apple Watch (kind watch, limited by the box's Watch rules). */
  public func watchToken(name: String) async throws -> String {
    struct R: Decodable { var token: String }
    return try await call("POST", "/devices/self/watch", body: ["name": name], as: R.self).token
  }

  // MARK: Reading

  public func system() async throws -> SystemInfo { try await call("GET", "/system") }
  public func tasks() async throws -> [BoxTask] { try await call("GET", "/tasks") }
  public func task(_ id: String) async throws -> TaskDetail { try await call("GET", "/tasks/\(id)") }
  public func pending() async throws -> [Approval] { try await call("GET", "/approvals?state=pending") }
  public func me() async throws -> Me { try await call("GET", "/me") }
  public func pause() async throws -> PauseState { try await call("GET", "/pause") }
  public func log(after: Int) async throws -> [LogEvent] { try await call("GET", "/log?after=\(after)") }
  public func health() async -> Bool {
    guard let r = try? request("GET", "/health", timeout: 4), let (_, res) = try? await session.data(for: r) else { return false }
    return (res as? HTTPURLResponse)?.statusCode == 200
  }

  // MARK: Acting

  /** Approve or deny. The first answer wins: the result says who answered if someone else did first. */
  public func answer(_ id: String, approved: Bool, auth: AnswerAuth) async throws -> Approval {
    try await call("POST", "/approvals/\(id.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? id)", body: ["approved": approved, "auth": auth.rawValue])
  }

  public func undo(_ task: String) async throws -> BoxTask { try await call("POST", "/tasks/\(task)/undo") }
  public func keep(_ task: String) async throws { _ = try await call("POST", "/tasks/\(task)/keep", as: Ignored.self) }
  /** The kill switch. Owner or Business admin; anyone else gets 403. */
  public func setPaused(_ on: Bool) async throws { _ = try await call("POST", on ? "/pause" : "/resume", as: Ignored.self) }

  /**
   * A new task, in plain words. `files` (the Mac's Share menu: 1 to 8, 5 MB in all) go to a new workspace of their
   * own that the computer names, so the task's copy holds only them.
   */
  public func newTask(title: String, prompt: String, files: [(name: String, data: Data)] = []) async throws -> BoxTask {
    var body: [String: Any] = ["title": title, "prompt": prompt]
    if !files.isEmpty { body["files"] = files.map { ["name": $0.name, "data": $0.data.base64EncodedString()] } }
    return try await call("POST", "/tasks", body: body)
  }

  // MARK: Push

  /** Give the computer this device's push subscription and the key it made for that computer. */
  public func subscribe(endpoint: String, p256dh: String, auth: String, key: String) async throws {
    _ = try await call("PUT", "/push", body: ["subscription": ["endpoint": endpoint, "keys": ["p256dh": p256dh, "auth": auth]], "key": key], as: Ignored.self)
  }

  public func unsubscribe() async throws { _ = try await call("DELETE", "/push", as: Ignored.self) }
  public func testPush() async throws { _ = try await call("POST", "/push/test", as: Ignored.self) }

  /** `GET /api/push`: whether this device is subscribed, and whether the computer can send pushes at all (remote access on). */
  public func pushStatus() async throws -> PushStatus { try await call("GET", "/push") }

  // MARK: Live

  /** The action log as it happens (Server-Sent Events), from `after`. Ends when the connection does. */
  public func stream(after: Int) -> AsyncThrowingStream<LogEvent, Error> {
    AsyncThrowingStream { c in
      let t = Task {
        do {
          var r = try request("GET", "/log/stream?after=\(after)", timeout: 3600)
          r.setValue("text/event-stream", forHTTPHeaderField: "accept")
          let (bytes, res) = try await session.bytes(for: r)
          guard (res as? HTTPURLResponse)?.statusCode == 200 else { throw BoxError(status: (res as? HTTPURLResponse)?.statusCode ?? 0, message: "The live feed did not open.") }
          for try await line in bytes.lines where line.hasPrefix("data:") {
            if let e = try? JSONDecoder().decode(LogEvent.self, from: Data(line.dropFirst(5).trimmingCharacters(in: .whitespaces).utf8)) { c.yield(e) }
          }
          c.finish()
        } catch { c.finish(throwing: error) }
      }
      c.onTermination = { _ in t.cancel() }
    }
  }
}

/** `GET /api/push`. */
public struct PushStatus: Decodable, Sendable {
  public var subscribed: Bool
  /** Remote access is on, so the computer can send pushes through the relay. */
  public var remote: Bool
}

/** For answers the app doesn't read. */
public struct Ignored: Decodable, Sendable {
  public init(from decoder: Decoder) throws {}
}
