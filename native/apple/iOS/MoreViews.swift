// Tasks, Activity, Settings and the Machines sheet.
import GurtKit
import SafariServices
import SwiftUI

struct TasksView: View {
  @Environment(AppState.self) var app
  @State var search = ""

  var body: some View {
    let m = app.model
    let match = { (t: BoxTask) in search.isEmpty || t.title.localizedCaseInsensitiveContains(search) }
    NavigationStack {
      List {
        Section("Running") {
          let r = m.running.filter(match)
          if r.isEmpty { Empty(text: "No task is running.") }
          ForEach(r) { t in NavigationLink(value: Route.task(t.id)) { TaskRow(task: t) } }
        }
        Section("Finished") {
          ForEach(m.recent.filter(match)) { t in
            NavigationLink(value: Route.task(t.id)) {
              VStack(alignment: .leading, spacing: 3) {
                Text(t.title).font(.g(.headline)).lineLimit(2)
                Text([Words.state(t.state), Words.ago(t.updatedAt)].filter { !$0.isEmpty }.joined(separator: " · "))
                  .font(.g(.subheadline)).foregroundStyle(t.state == "failed" ? Color.gDestructiveFg : Color.gSecondary)
              }
              .accessibilityElement(children: .combine)
            }
          }
        }
      }
      .gurtList()
      .machineTitle("Tasks")
      .searchable(text: $search, prompt: "Search tasks")
      .refreshable { await m.refresh() }
      .navigationDestination(for: Route.self) { $0.view }
    }
  }
}

struct ActivityView: View {
  @Environment(AppState.self) var app

  var body: some View {
    let m = app.model
    NavigationStack {
      List {
        let lines = m.events.reversed().compactMap { e in Words.event(e) { m.task($0)?.title }.map { (e, $0) } }
        if lines.isEmpty { Empty(text: "Nothing has happened yet.") }
        ForEach(lines.prefix(200), id: \.0.seq) { e, text in
          Group {
            if let t = e.task { NavigationLink(value: Route.task(t)) { line(e, text) } } else { line(e, text) }
          }
        }
      }
      .gurtList()
      .machineTitle("Activity")
      .refreshable { await m.refresh() }
      .navigationDestination(for: Route.self) { $0.view }
    }
  }

  func line(_ e: LogEvent, _ text: String) -> some View {
    HStack(alignment: .top, spacing: 10) {
      Image(systemName: Words.isAlarm(e) ? "xmark.octagon.fill" : e.type.hasPrefix("approval") ? "hand.raised.fill" : "circle.fill")
        .font(.system(size: Words.isAlarm(e) || e.type.hasPrefix("approval") ? 14 : 6))
        .foregroundStyle(Words.isAlarm(e) ? Color.gDestructiveFg : e.type.hasPrefix("approval") ? Color.gAttentionFg : Color.gAccent)
        .frame(width: 16).padding(.top, 4)
        .accessibilityHidden(true)
      VStack(alignment: .leading, spacing: 2) {
        Text(text).font(.g(.subheadline)).foregroundStyle(Words.isAlarm(e) ? Color.gDestructiveFg : .primary).lineLimit(4)
        Text(Words.ago(e.at)).font(.g(.caption)).foregroundStyle(Color.gSecondary)
      }
    }
    .accessibilityElement(children: .combine)
  }
}

struct SettingsView: View {
  @Environment(AppState.self) var app
  @State var confirmForget = false
  @State var testSent: String?

  var body: some View {
    let m = app.model
    NavigationStack {
      List {
        if let c = m.current {
          Section("This computer") {
            LabeledContent("Name", value: c.name)
            LabeledContent("Edition", value: c.editionName)
            if let p = c.person { LabeledContent("Signed in as", value: [p, c.personTitle].compactMap { $0 }.joined(separator: ", ")) }
            LabeledContent("Address", value: URL(string: c.url)?.host ?? c.url)
            LabeledContent("Status", value: m.live == .offline ? "Out of reach" : "Online")
          }
        }
        Section {
          ForEach(m.machines) { x in
            Button { m.select(x) } label: { MachineRow(machine: x, current: x.id == m.current?.id) }
              .tint(.primary)
          }
          Button("Add a computer", systemImage: "plus") { app.pending = nil; app.showPair = true }
        } header: { Text("Computers") } footer: {
          Text("Each computer has its own pairing. On GurtOS Business you are a person with a role; on the others, this phone answers for the owner.")
        }
        Section {
          if app.notificationsOn {
            Label("On", systemImage: "bell.badge.fill")
            Button("Send a test notification") {
              Task {
                do { try await m.client?.testPush(); testSent = "Sent. It should arrive in a few seconds." } catch { testSent = (error as? BoxError)?.status == 409 ? "Turn on remote access on the computer first: notifications go through the GurtOS relay." : error.localizedDescription }
              }
            }
          } else {
            Button("Turn on notifications") { Task { await app.askForNotifications() } }
          }
        } header: { Text("Notifications") } footer: {
          Text("The computer encrypts every notification for this phone before it leaves. The relay that delivers it can't read it.")
        }
        Section {
          Button("Forget this computer", role: .destructive) { confirmForget = true }
        } footer: {
          Text("This phone's pairing stops working on the computer. Pair again any time from its screen.")
        }
        Section("About") {
          LabeledContent("Version", value: Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "")
          Link("Privacy", destination: URL(string: "https://gurtos.com/privacy")!)
          Link("Terms", destination: URL(string: "https://gurtos.com/terms")!)
        }
      }
      .gurtList()
      .navigationTitle("Settings")
      .alert(testSent ?? "", isPresented: .constant(testSent != nil)) { Button("OK") { testSent = nil } }
      .confirmationDialog("Forget \(m.current?.name ?? "this computer")?", isPresented: $confirmForget, titleVisibility: .visible) {
        Button("Forget", role: .destructive) { if let c = m.current { Task { await m.forget(c) } } }
      }
    }
  }
}

struct MachineRow: View {
  @Environment(AppState.self) var app
  var machine: Machine
  var current: Bool

  var body: some View {
    HStack(spacing: 12) {
      MachineTile(machine: machine, size: 36)
      VStack(alignment: .leading, spacing: 2) {
        Text(machine.name).font(.g(.headline))
        Text(machine.editionName).font(.g(.subheadline)).foregroundStyle(Color.gSecondary)
        if let p = machine.person { Text("Signed in as \(p)\(machine.personTitle.map { ", \($0)" } ?? "")").font(.g(.footnote)).foregroundStyle(Color.gSecondary) }
        if current {
          Text(app.model.live == .offline ? "Out of reach" : "\(app.model.waiting.count) waiting")
            .font(.g(.footnote, .semibold)).foregroundStyle(app.model.live == .offline ? Color.gDestructiveFg : Color.gSuccess)
        }
      }
      Spacer()
      if current { Image(systemName: "checkmark").foregroundStyle(Color.gAccent).accessibilityLabel("Showing") }
    }
    .accessibilityElement(children: .combine)
  }
}

/** The Machines sheet (Figma 1a), from the machine's name at the top of any screen. */
struct MachinesSheet: View {
  @Environment(AppState.self) var app
  @Environment(\.dismiss) var dismiss

  var body: some View {
    NavigationStack {
      List {
        Section {
          ForEach(app.model.machines) { x in
            Button { app.model.select(x); dismiss() } label: { MachineRow(machine: x, current: x.id == app.model.current?.id) }.tint(.primary)
          }
        }
        Section {
          Button { dismiss(); app.pending = nil; app.showPair = true } label: {
            Label { VStack(alignment: .leading) { Text("Add a computer"); Text("Scan the QR code on its screen").font(.g(.footnote)).foregroundStyle(Color.gSecondary) } } icon: { Image(systemName: "plus") }
          }
        }
      }
      .gurtList()
      .navigationTitle("Computers")
      .navigationBarTitleDisplayMode(.inline)
      .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Close", systemImage: "xmark") { dismiss() } } }
    }
    .presentationDetents([.medium, .large])
  }
}

extension View {
  /** The machine's name as the title, with its edition and state under it; its menu switches machines. */
  func machineTitle(_ section: String? = nil) -> some View { modifier(MachineTitle(section: section)) }
}

struct MachineTitle: ViewModifier {
  @Environment(AppState.self) var app
  /** Tasks, Activity: the section is the title and the machine's name leads the subtitle. */
  var section: String?

  func body(content: Content) -> some View {
    let m = app.model
    content
      .navigationTitle(section ?? m.current?.name ?? "GurtOS")
      .navigationSubtitle(section == nil ? subtitle : "\(m.current?.name ?? "") · \(subtitle)")
      .toolbarTitleMenu {
        ForEach(m.machines) { x in
          Button { m.select(x) } label: {
            if x.id == m.current?.id { Label(x.name, systemImage: "checkmark") } else { Text(x.name) }
          }
        }
        Divider()
        Button("Computers…", systemImage: "rectangle.stack") { app.showMachines = true }
        Button("Add a computer", systemImage: "plus") { app.pending = nil; app.showPair = true }
      }
      .toolbar {
        ToolbarItem(placement: .topBarTrailing) {
          Button { app.showMachines = true } label: { MachineTile(machine: m.current, size: 26) }
            .accessibilityLabel("Computers")
            .accessibilityHint("Switch to another paired computer")
        }
      }
  }

  var subtitle: String {
    let m = app.model
    var parts = [m.current?.isBusiness == true ? (m.current?.person.map { "Signed in as \($0)" } ?? "GurtOS Business") : m.current?.editionName ?? ""]
    parts.append(m.live == .offline ? "Out of reach" : m.paused.paused ? "Paused" : "Online")
    let running = m.tasks.filter(\.isRunning).count
    if running > 0 { parts.append("\(running) running") }
    if m.spentToday > 0 { parts.append("\(Money.dollars(m.spentToday)) today") }
    return parts.joined(separator: " · ")
  }
}

/** Get approvals on this phone (Figma 4d): asked after a tap, never on launch. */
struct NotificationsCard: View {
  @Environment(AppState.self) var app
  var body: some View {
    Section {
      VStack(alignment: .leading, spacing: 8) {
        Label("Get approvals on this phone", systemImage: "bell.badge").font(.g(.headline))
        Text("GurtOS sends a notification when something needs your OK, and names the computer it came from. Nothing else.")
          .font(.g(.subheadline)).foregroundStyle(Color.gSecondary)
        HStack {
          Button("Turn on notifications") { Task { await app.askForNotifications() } }.buttonStyle(.borderedProminent)
          Button("Not now") { UserDefaults.standard.set(true, forKey: "gurtos.notify-asked"); app.notificationsAsked = true }.buttonStyle(.borderless)
        }
        .buttonBorderShape(.capsule)
        .font(.g(.subheadline, .semibold))
      }
      .padding(.vertical, 4)
    }
  }
}

struct SafariView: UIViewControllerRepresentable {
  var url: URL
  func makeUIViewController(context: Context) -> SFSafariViewController { SFSafariViewController(url: url) }
  func updateUIViewController(_ c: SFSafariViewController, context: Context) {}
}
