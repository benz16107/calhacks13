// The iPhone gives its Apple Watch the machines it is paired with, each with a token of the Watch's own (kind
// watch). The box limits what a Watch token may approve, so the Watch never carries the phone's token.
import GurtKit
import UIKit
import WatchConnectivity

@MainActor
final class WatchLink: NSObject, WCSessionDelegate {
  weak var app: AppState?

  init(app: AppState) {
    self.app = app
    super.init()
    if WCSession.isSupported() {
      WCSession.default.delegate = self
      WCSession.default.activate()
    }
  }

  /** Machines asked for a Watch token this run, so a box without the route isn't asked on every refresh. */
  var asked: Set<String> = []

  /** Ask each machine for a Watch token once, then hand the Watch its list and what waits now. */
  func send(machines: [Machine]) {
    guard WCSession.isSupported(), WCSession.default.activationState == .activated, WCSession.default.isWatchAppInstalled else { return }
    Task {
      var list: [Machine] = []
      for var m in machines {
        if m.watchToken == nil, !asked.contains(m.id) {
          asked.insert(m.id)
          if let t = try? await BoxClient(machine: m).watchToken(name: "\(UIDevice.current.name)'s Watch") {
            m.watchToken = t
            app?.model.update(m)
          }
        }
        // A box without Watch tokens: the Watch shows what waits and can deny through the phone, nothing more.
        var w = m
        w.token = m.watchToken ?? ""
        w.watchToken = nil
        w.pushKey = nil
        list.append(w)
      }
      guard let data = try? JSONEncoder().encode(list), let glance = try? JSONEncoder().encode(app?.model.glance) else { return }
      try? WCSession.default.updateApplicationContext(["machines": data, "current": app?.model.current?.id ?? "", "glance": glance, "at": Date().timeIntervalSince1970])
    }
  }

  /** A Deny from a Watch whose machine gave it no token of its own: the phone sends it. Never an Approve. */
  nonisolated func session(_ session: WCSession, didReceiveMessage message: [String: Any], replyHandler: @escaping ([String: Any]) -> Void) {
    guard message["deny"] as? Bool == true, let id = message["approval"] as? String, let machine = message["machine"] as? String else { return replyHandler(["error": "Only Deny goes through the phone."]) }
    Task { @MainActor in
      guard let m = app?.model.machines.first(where: { $0.id == machine }) else { return replyHandler(["error": "The phone isn't paired with that computer."]) }
      do {
        let out = try await BoxClient(machine: m).answer(id, approved: false, auth: .wrist)
        replyHandler(["state": out.state])
      } catch { replyHandler(["error": error.localizedDescription]) }
    }
  }

  nonisolated func session(_ session: WCSession, activationDidCompleteWith state: WCSessionActivationState, error: Error?) {
    Task { @MainActor in if let m = app?.model.machines { send(machines: m) } }
  }

  nonisolated func sessionDidBecomeInactive(_ session: WCSession) {}
  nonisolated func sessionDidDeactivate(_ session: WCSession) { WCSession.default.activate() }
  nonisolated func sessionWatchStateDidChange(_ session: WCSession) {
    Task { @MainActor in asked = []; if let m = app?.model.machines { send(machines: m) } }
  }
}
