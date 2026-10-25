// GurtOS for Mac: a menu bar extra with what runs and what needs you, Approve with Touch ID, a global shortcut to
// ask the machine for a new task, pairing and a Machines switcher. The HIG asks for a menu, not a popover, and for
// people to decide whether the extra is in the menu bar (Settings).
import Carbon.HIToolbox
import CoreImage
import GurtKit
import SwiftUI
import UserNotifications

extension Notification.Name { static let askBox = Notification.Name("gurtos.ask") }

@main
struct GurtOSMacApp: App {
  @NSApplicationDelegateAdaptor(MacDelegate.self) var delegate
  @AppStorage("showInMenuBar") var shown = true

  var body: some Scene {
    MenuBarExtra(isInserted: $shown) {
      MenuContent().environment(delegate.model)
    } label: {
      MenuLabel().environment(delegate.model)
    }
    .menuBarExtraStyle(.menu)

    Window("Ask", id: "ask") { AskView().environment(delegate.model) }
      .windowResizability(.contentSize)
      .defaultPosition(.center)
    Window("Add a computer", id: "pair") { MacPairView().environment(delegate.model) }
      .windowResizability(.contentSize)
    Settings { MacSettings().environment(delegate.model) }
  }
}

@MainActor
final class MacDelegate: NSObject, NSApplicationDelegate, UNUserNotificationCenterDelegate {
  let model = BoxModel(kind: "mac")
  var hotKey: EventHotKeyRef?

  func applicationDidFinishLaunching(_ n: Notification) {
    let c = UNUserNotificationCenter.current()
    c.delegate = self
    c.setNotificationCategories(MacNotes.categories)
    Task { _ = try? await c.requestAuthorization(options: [.alert, .sound, .badge]) }
    model.onEvent = { e in MacNotes.post(e, model: self.model) }
    #if DEBUG
    // Screenshots: --pair <link> pairs first; --render-shots <dir> draws the windows and the menu, then quits.
    let args = CommandLine.arguments
    if let i = args.firstIndex(of: "--pair"), i + 1 < args.count, let l = PairingLink.parse(args[i + 1]) {
      let old = model.machines.first { URL(string: $0.url)?.host == l.box.host }
      if old == nil || args.contains("--repair") {
        Task { if let old { await model.forget(old) }; try? await model.pair(l, name: "Mac"); RenderShots.runIfAsked(model) }
      } else { model.select(old!); RenderShots.runIfAsked(model) }
    } else { RenderShots.runIfAsked(model) }
    #endif
    model.start()
    registerHotKey()
  }

  /** ⌥⌘G anywhere: Ask your computer for a new task. Carbon's hot keys need no Accessibility permission. */
  func registerHotKey() {
    var spec = EventTypeSpec(eventClass: OSType(kEventClassKeyboard), eventKind: UInt32(kEventHotKeyPressed))
    InstallEventHandler(GetApplicationEventTarget(), { _, _, _ in
      DispatchQueue.main.async { NotificationCenter.default.post(name: .askBox, object: nil) }
      return noErr
    }, 1, &spec, nil, nil)
    RegisterEventHotKey(UInt32(kVK_ANSI_G), UInt32(optionKey | cmdKey), EventHotKeyID(signature: OSType(0x47555254), id: 1), GetApplicationEventTarget(), 0, &hotKey)
  }

  /** Opening the app again (it has no Dock icon) shows Settings, so it is never lost if the menu bar hides it. */
  func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows: Bool) -> Bool {
    NSApp.sendAction(Selector(("showSettingsWindow:")), to: nil, from: nil)
    return true
  }

  func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification) async -> UNNotificationPresentationOptions { [.banner, .sound] }

  func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse) async {
    guard let id = response.notification.request.content.userInfo["approval"] as? String, let a = model.approval(id) else { return }
    if response.actionIdentifier == "deny" { _ = try? await model.answer(a, approved: false, auth: .none) }
    else if response.actionIdentifier == "approve" { await MacAnswer.run(a, approved: true, model: model) }
  }
}

/** Notifications for new requests, made on the Mac from the live log: the machine never sends them anywhere. */
enum MacNotes {
  static let categories: Set<UNNotificationCategory> = [
    UNNotificationCategory(identifier: "request", actions: [
      UNNotificationAction(identifier: "approve", title: "Approve…", options: [.foreground]),
      UNNotificationAction(identifier: "deny", title: "Deny", options: [.destructive]),
    ], intentIdentifiers: []),
  ]

  @MainActor static func post(_ e: LogEvent, model: BoxModel) {
    guard e.type == "approval.asked", let a = e.approval, let m = model.current else { return }
    if m.isBusiness, !(a.route?.people.contains { $0.name == m.person } ?? false) { return } // only what waits for this person
    let c = UNMutableNotificationContent()
    c.title = m.name
    c.subtitle = model.task(a.task)?.title ?? ""
    c.body = a.purpose ?? a.question
    c.categoryIdentifier = "request"
    c.userInfo = ["approval": a.id]
    c.interruptionLevel = .timeSensitive
    c.sound = .default
    UNUserNotificationCenter.current().add(UNNotificationRequest(identifier: a.id, content: c, trigger: nil))
  }
}

/** Approve with Touch ID when money moves; Shopper's passkey opens the machine's own approve page. */
enum MacAnswer {
  @MainActor static func run(_ a: Approval, approved: Bool, model: BoxModel) async {
    let answering = Answering()
    await answering.answer(a, approved: approved, model: model)
    if let url = answering.passkeyURL { NSWorkspace.shared.open(url) }
    if let m = answering.message {
      let alert = NSAlert()
      alert.messageText = m
      NSApp.activate()
      alert.runModal()
    }
  }
}

struct MenuLabel: View {
  @Environment(BoxModel.self) var model
  @Environment(\.openWindow) var openWindow

  var body: some View {
    let n = model.waiting.count
    Label(n > 0 ? "\(n)" : "GurtOS", systemImage: model.live == .offline ? "exclamationmark.triangle" : n > 0 ? "hand.raised.fill" : "list.bullet.rectangle")
      .labelStyle(n > 0 ? AnyLabelStyle(.titleAndIcon) : AnyLabelStyle(.iconOnly))
      .accessibilityLabel(n > 0 ? "GurtOS, \(n) need you" : "GurtOS")
      .onReceive(NotificationCenter.default.publisher(for: .askBox)) { _ in
        openWindow(id: model.current == nil ? "pair" : "ask")
        NSApp.activate()
      }
  }
}

struct AnyLabelStyle: LabelStyle {
  let make: (Configuration) -> AnyView
  init<S: LabelStyle>(_ s: S) { make = { AnyView(Label($0).labelStyle(s)) } }
  func makeBody(configuration: Configuration) -> some View { make(configuration) }
}

struct MenuContent: View {
  @Environment(BoxModel.self) var model
  @Environment(\.openWindow) var openWindow

  var body: some View {
    if let m = model.current {
      Text(status(m))
      Divider()
      if model.waiting.isEmpty {
        Text("Nothing needs you")
      } else {
        Section(m.isBusiness ? "Waiting for me" : "Needs you") {
          ForEach(model.waiting) { a in
            Menu(title(a)) {
              Text(a.purpose ?? a.question)
              Divider()
              if model.mayAnswer {
                Button(a.amountCents > 0 ? "Approve \(Money.dollars(a.amountCents)) with Touch ID" : "Approve") { Task { await MacAnswer.run(a, approved: true, model: model) } }
                Button("Deny") { Task { await MacAnswer.run(a, approved: false, model: model) } }
              }
            }
          }
        }
      }
      let running = model.tasks.filter(\.isRunning)
      if !running.isEmpty {
        Section("Running") { ForEach(running.prefix(6)) { t in Text("\(t.title)\(t.step.map { " · \($0)" } ?? "")") } }
      }
      Divider()
      Button("Ask \(m.name)…") { openWindow(id: "ask"); NSApp.activate() }
        .keyboardShortcut("g", modifiers: [.option, .command])
      Menu("Computers") {
        ForEach(model.machines) { x in
          Toggle(x.name, isOn: Binding(get: { x.id == model.current?.id }, set: { if $0 { model.select(x) } }))
        }
        Divider()
        Button("Add a computer…") { openWindow(id: "pair"); NSApp.activate() }
      }
      if model.mayPause {
        Button(model.paused.paused ? "Resume all agents" : "Pause all agents") { Task { try? await model.setPaused(!model.paused.paused) } }
      }
    } else {
      Text("No computer paired")
      Button("Add a computer…") { openWindow(id: "pair"); NSApp.activate() }
    }
    Divider()
    SettingsLink { Text("Settings…") }.keyboardShortcut(",")
    Button("Quit GurtOS") { NSApp.terminate(nil) }.keyboardShortcut("q")
  }

  func status(_ m: Machine) -> String {
    let running = model.tasks.filter(\.isRunning).count
    return [m.name, model.live == .offline ? "Out of reach" : model.paused.paused ? "Paused" : "\(running) running"].joined(separator: " · ")
  }

  func title(_ a: Approval) -> String {
    let t = model.task(a.task)?.title ?? "A request"
    return a.amountCents > 0 ? "\(t) · \(Money.dollars(a.amountCents))" : t
  }
}

/** Ask your computer: a new task in plain words, from anywhere with ⌥⌘G. */
struct AskView: View {
  @Environment(BoxModel.self) var model
  @Environment(\.dismissWindow) var dismissWindow
  @State var text = ""
  @State var error: String?
  @State var busy = false
  @FocusState var focused: Bool

  var body: some View {
    VStack(alignment: .leading, spacing: 12) {
      Text("Ask \(model.current?.name ?? "your computer")").font(.title2.weight(.semibold))
      TextField("What should it do?", text: $text, axis: .vertical)
        .lineLimit(3...8)
        .textFieldStyle(.roundedBorder)
        .focused($focused)
        .onSubmit(send)
      if let error { Text(error).foregroundStyle(Color.gDestructiveFg).font(.callout) }
      HStack {
        Text("It asks you before it spends or changes anything.").font(.callout).foregroundStyle(.secondary)
        Spacer()
        Button("Cancel") { dismissWindow(id: "ask") }.keyboardShortcut(.cancelAction)
        Button("Start task", action: send).keyboardShortcut(.defaultAction).disabled(text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || busy)
      }
    }
    .padding(20)
    .frame(width: 460)
    .onAppear { focused = true }
  }

  func send() {
    let prompt = text.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !prompt.isEmpty, let c = model.client else { return }
    busy = true
    Task {
      do {
        _ = try await c.newTask(title: String(prompt.split(separator: "\n").first ?? "").prefix(80).description, prompt: prompt)
        text = ""
        dismissWindow(id: "ask")
        await model.refresh()
      } catch { self.error = "Not started: \(error.localizedDescription)" }
      busy = false
    }
  }
}

/** Pair: paste the link from the QR code, drop a screenshot of the QR code, or type the address and code. */
struct MacPairView: View {
  @Environment(BoxModel.self) var model
  @Environment(\.dismissWindow) var dismissWindow
  @State var address = ""
  @State var code = ""
  @State var error: String?
  @State var busy = false
  @State var dropping = false

  var body: some View {
    VStack(alignment: .leading, spacing: 14) {
      Text("Pair with a computer").font(.title2.weight(.semibold))
      Text("On the computer's screen: Settings, Devices, Pair a phone. Drop a screenshot of its QR code here, paste its link, or type its address and code.")
        .foregroundStyle(.secondary).fixedSize(horizontal: false, vertical: true)
      RoundedRectangle(cornerRadius: 12).strokeBorder(dropping ? Color.gAccent : .secondary.opacity(0.4), style: StrokeStyle(lineWidth: 1.5, dash: [5]))
        .frame(height: 90)
        .overlay(Label("Drop a picture of the QR code", systemImage: "qrcode.viewfinder").foregroundStyle(.secondary))
        .onDrop(of: [.fileURL, .image], isTargeted: $dropping) { providers in read(providers); return true }
      Form {
        TextField("Address or link", text: $address, prompt: Text("rosa.box.gurtos.com"))
        TextField("Code", text: $code)
      }
      if let error { Text(error).foregroundStyle(Color.gDestructiveFg) }
      HStack {
        Spacer()
        Button("Cancel") { dismissWindow(id: "pair") }.keyboardShortcut(.cancelAction)
        Button("Pair") {
          if let r = Rendezvous.parse(address), PairingLink.parse(address) == nil { pairOver(r) } else { pair(PairingLink.parse(address) ?? PairingLink.typed(address: address, code: code)) }
        }
          .keyboardShortcut(.defaultAction).disabled(address.isEmpty || busy)
      }
    }
    .padding(20)
    .frame(width: 440)
  }

  func read(_ providers: [NSItemProvider]) {
    for p in providers {
      _ = p.loadObject(ofClass: NSImage.self) { obj, _ in
        guard let img = obj as? NSImage, let cg = img.cgImage(forProposedRect: nil, context: nil, hints: nil) else { return }
        let found = CIDetector(ofType: CIDetectorTypeQRCode, context: nil, options: nil)?.features(in: CIImage(cgImage: cg)).compactMap { ($0 as? CIQRCodeFeature)?.messageString }.first
        Task { @MainActor in
          if let found, let link = PairingLink.parse(found) { pair(link) } else if let found, let r = Rendezvous.parse(found) { pairOver(r) } else { error = "No GurtOS pairing QR code in that picture." }
        }
      }
    }
  }

  /** Remote access is off on that computer: the relay's rendezvous finds it first. */
  func pairOver(_ r: Rendezvous) {
    busy = true
    error = nil
    Task {
      do { let l = try await r.resolve(); busy = false; pair(l) } catch { self.error = (error as? BoxError)?.message ?? "Couldn't reach the GurtOS relay."; busy = false }
    }
  }

  func pair(_ link: PairingLink?) {
    guard let link else { error = "Check the address and the code."; return }
    busy = true
    Task {
      do {
        try await model.pair(link, name: Host.current().localizedName ?? "Mac")
        dismissWindow(id: "pair")
      } catch { self.error = (error as? BoxError)?.message ?? "Couldn't reach \(link.box.host ?? "the computer")." }
      busy = false
    }
  }
}

struct MacSettings: View {
  @Environment(BoxModel.self) var model
  @AppStorage("showInMenuBar") var shown = true

  var body: some View {
    Form {
      Toggle("Show GurtOS in the menu bar", isOn: $shown)
      LabeledContent("Ask your computer", value: "⌥⌘G")
      Section("Computers") {
        ForEach(model.machines) { m in
          HStack {
            VStack(alignment: .leading) { Text(m.name); Text(m.editionName).foregroundStyle(.secondary).font(.caption) }
            Spacer()
            Button("Forget", role: .destructive) { Task { await model.forget(m) } }
          }
        }
      }
    }
    .formStyle(.grouped)
    .frame(width: 420, height: 320)
  }
}
