// GurtOS on Apple Watch: what waits for you, Approve and Deny, and the count on the watch face. Its iPhone gives it
// the machines, each with a token of the Watch's own; the box limits what that token may approve (core README,
// "The native apps"). Without a Watch token it shows what the iPhone last saw and can deny through the iPhone.
import GurtKit
import LocalAuthentication
import SwiftUI
import WatchConnectivity
import WidgetKit

@main
struct GurtOSWatchApp: App {
  @State var model = BoxModel(kind: "watch")
  @State var link = PhoneLink()
  @Environment(\.scenePhase) var phase

  var body: some Scene {
    WindowGroup {
      #if DEBUG
      if ProcessInfo.processInfo.environment["GURTOS_GALLERY"] != nil { ComplicationGallery() } else { root }
      #else
      root
      #endif
    }
    .onChange(of: phase) { _, p in if p == .active { model.start() } else if p == .background { model.stop() } }
  }

  var root: some View {
      WatchRoot()
        .environment(model)
        .environment(link)
        .tint(Color.gAccent)
        .task {
          #if DEBUG
          // Simulator checks without a paired iPhone: SIMCTL_CHILD_GURTOS_MACHINES=<JSON list of machines>.
          if let j = ProcessInfo.processInfo.environment["GURTOS_MACHINES"], let list = try? JSONDecoder().decode([Machine].self, from: Data(j.utf8)) {
            model.replaceMachines(list, current: nil)
          }
          #endif
          link.start(model)
          model.onChange = { m in m.glance.save(); WidgetCenter.shared.reloadAllTimelines() }
          model.start()
        }
  }
}

#if DEBUG
/** The watch-face complications as they draw, for screenshots: the simulator can't edit a watch face from a script. */
struct ComplicationGallery: View {
  let g = Glance(machine: "Home box", waiting: 2, running: 3, paused: false, requests: [])
  var body: some View {
    ScrollView {
      VStack(spacing: 10) {
        HStack(spacing: 10) {
          GlanceView(entry: GlanceEntry(date: .now, glance: g), family: .accessoryCircular).frame(width: 50, height: 50).background(Circle().fill(.white.opacity(0.12)))
          GlanceView(entry: GlanceEntry(date: .now, glance: g), family: .accessoryCorner).frame(width: 50, height: 50)
        }
        GlanceView(entry: GlanceEntry(date: .now, glance: g), family: .accessoryRectangular).frame(width: 170, height: 56).padding(6).background(RoundedRectangle(cornerRadius: 12).fill(.white.opacity(0.12)))
        GlanceView(entry: GlanceEntry(date: .now, glance: g), family: .accessoryInline)
      }
    }
  }
}
#endif

/** The iPhone's side of the conversation: the machines it sends, and Deny sent through it when the Watch has no token. */
@MainActor @Observable
final class PhoneLink: NSObject, WCSessionDelegate {
  weak var model: BoxModel?
  /** What the iPhone saw, for a machine that gave the Watch no token of its own. */
  var glance = Glance.load()

  func start(_ m: BoxModel) {
    model = m
    guard WCSession.isSupported() else { return }
    WCSession.default.delegate = self
    WCSession.default.activate()
  }

  nonisolated func session(_ session: WCSession, didReceiveApplicationContext context: [String: Any]) {
    let list = (context["machines"] as? Data).flatMap { try? JSONDecoder().decode([Machine].self, from: $0) }
    let current = context["current"] as? String
    let g = (context["glance"] as? Data).flatMap { try? JSONDecoder().decode(Glance.self, from: $0) }
    Task { @MainActor in
      if let list { model?.replaceMachines(list.filter { !$0.token.isEmpty }, current: current) }
      if let g { glance = g; if model?.current == nil { g.save(); WidgetCenter.shared.reloadAllTimelines() } }
    }
  }

  nonisolated func session(_ session: WCSession, activationDidCompleteWith state: WCSessionActivationState, error: Error?) {
    let c = session.receivedApplicationContext
    if !c.isEmpty { self.session(session, didReceiveApplicationContext: c) }
  }

  /** Deny through the iPhone. Approve never goes this way: it needs the Watch's own token, so the box can limit it. */
  func denyThroughPhone(_ a: Approval, machine: String) async -> String? {
    guard WCSession.default.isReachable else { return "Your iPhone isn't reachable." }
    return await withCheckedContinuation { c in
      WCSession.default.sendMessage(["deny": true, "approval": a.id, "machine": machine], replyHandler: { r in c.resume(returning: r["error"] as? String) }, errorHandler: { c.resume(returning: $0.localizedDescription) })
    }
  }
}

struct WatchRoot: View {
  @Environment(BoxModel.self) var model
  @Environment(PhoneLink.self) var link
  #if DEBUG
  @State var path: [String] = ProcessInfo.processInfo.environment["GURTOS_OPEN"].flatMap { $0.isEmpty ? nil : [$0] } ?? []
  #else
  @State var path: [String] = []
  #endif

  var body: some View {
    NavigationStack(path: $path) {
      List {
        if let m = model.current {
          Section {
            if model.waiting.isEmpty { Text("Nothing needs you.").foregroundStyle(.secondary) }
            ForEach(model.waiting) { a in NavigationLink(value: a.id) { WatchRequestRow(approval: a) } }
          } header: { Text(m.name) }
          Section {
            Label("\(model.tasks.filter(\.isRunning).count) running", systemImage: "gearshape.2")
            if model.paused.paused { Label("All agents paused", systemImage: "pause.circle").foregroundStyle(Color.gDestructiveFg) }
            if model.live == .offline { Label("Out of reach", systemImage: "wifi.exclamationmark").foregroundStyle(Color.gDestructiveFg) }
          }
        } else if link.glance.at > .distantPast {
          // No Watch token from this machine yet: what the iPhone saw.
          Section {
            ForEach(link.glance.requests) { a in WatchRequestRow(approval: a) }
            if link.glance.requests.isEmpty { Text("Nothing needs you.").foregroundStyle(.secondary) }
          } header: { Text(link.glance.machine) } footer: { Text("Open GurtOS on your iPhone to answer.") }
        } else {
          Text("Add a computer in GurtOS on your iPhone. It shows up here.").foregroundStyle(.secondary)
        }
      }
      .navigationTitle("GurtOS")
      .navigationDestination(for: String.self) { WatchApprovalView(id: $0) }
    }
  }
}

struct WatchRequestRow: View {
  @Environment(BoxModel.self) var model
  var approval: Approval

  var body: some View {
    VStack(alignment: .leading, spacing: 2) {
      Text(model.task(approval.task)?.title ?? approval.purpose ?? "A request").font(.headline).lineLimit(2)
      if approval.amountCents > 0 { Text(Money.dollars(approval.amountCents)).font(.body.weight(.semibold)).foregroundStyle(Color.gAttention).monospacedDigit() }
      else if approval.isFraud { Text("Fraud referral").foregroundStyle(Color.gDestructiveFg) }
    }
    .accessibilityElement(children: .combine)
  }
}

/** One request. Double tap approves, but only when the Watch may (the box checks again). */
struct WatchApprovalView: View {
  @Environment(BoxModel.self) var model
  @Environment(PhoneLink.self) var link
  @Environment(\.dismiss) var dismiss
  var id: String
  @State var message: String?
  @State var busy = false

  /** What the box allows a Watch (watchRefusal in core/box.ts); its default limit is $25. */
  func watchMay(_ a: Approval) -> Bool {
    a.route == nil && !a.isFraud && model.current?.isBusiness != true && a.costCents <= 2500 && model.task(a.task)?.source?.hasPrefix("shopper:") != true
  }

  var body: some View {
    if let a = model.approval(id) {
      VStack(spacing: 8) {
        Text(model.task(a.task)?.title ?? "A request").font(.headline).multilineTextAlignment(.center).lineLimit(3)
        if a.amountCents > 0 { Text(Money.dollars(a.amountCents)).font(.title2.weight(.bold)).monospacedDigit() }
        if let message { Text(message).font(.footnote).foregroundStyle(.secondary).multilineTextAlignment(.center) }
        else if !watchMay(a) { Text("Approve this on your iPhone with Face ID.").font(.footnote).foregroundStyle(.secondary).multilineTextAlignment(.center).fixedSize(horizontal: false, vertical: true) }
        Spacer(minLength: 0)
        HStack {
          Button { answer(a, approved: false) } label: { Image(systemName: "xmark") }
            .tint(Color.gDestructive)
            .accessibilityLabel("Deny")
          if watchMay(a) {
            Button { answer(a, approved: true) } label: { Image(systemName: "checkmark") }
              .tint(Color.gSuccess)
              .accessibilityLabel(a.amountCents > 0 ? "Approve \(Money.dollars(a.amountCents))" : "Approve")
              .handGestureShortcut(.primaryAction)
          }
        }
        .buttonStyle(.borderedProminent)
        .disabled(busy || model.answered[a.id] != nil)
      }
      .padding(.horizontal, 4)
      .navigationTitle(model.current?.name ?? "")
    } else {
      Text(model.answered[id].map { $0 ? "Approved" : "Denied" } ?? "Answered").font(.headline)
    }
  }

  func answer(_ a: Approval, approved: Bool) {
    busy = true
    Task {
      defer { busy = false }
      do {
        if approved {
          // On the wrist and unlocked: watchOS's own check. The box refuses a Watch approve without it.
          try await LAContext().evaluatePolicy(.deviceOwnerAuthenticationWithWristDetection, localizedReason: "Approve")
        }
        let out = try await model.answer(a, approved: approved, auth: .wrist)
        message = out.state == (approved ? "approved" : "denied") ? (approved ? "Approved" : "Denied") : "Already \(out.state)\(out.by.map { " on \($0)" } ?? "")"
        WKHaptic.play(approved ? .success : .click)
        try? await Task.sleep(nanoseconds: 900_000_000)
        dismiss()
      } catch let e as BoxError where e.needs == "iphone" {
        message = e.message
        WKHaptic.play(.failure)
      } catch {
        if !approved, let m = model.current, let err = await link.denyThroughPhone(a, machine: m.id) { message = err } else if !approved { message = "Denied" } else { message = error.localizedDescription }
      }
    }
  }
}

enum WKHaptic {
  static func play(_ t: WKHapticType) { WKInterfaceDevice.current().play(t) }
}
