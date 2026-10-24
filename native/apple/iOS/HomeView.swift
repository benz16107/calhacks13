// Home, one per edition (docs/figma/phone-app 2a, 2b, 2c): what needs you first, then what runs, then the kill
// switch. The machine's name is the title; its menu switches machines the way other apps switch accounts.
import GurtKit
import SwiftUI

struct HomeView: View {
  @Environment(AppState.self) var app
  var model: BoxModel { app.model }

  var body: some View {
    @Bindable var app = app
    NavigationStack(path: $app.homePath) {
      List {
        if model.live == .offline { OfflineRow(name: model.current?.name ?? "The computer") }
        if !app.notificationsAsked { NotificationsCard() }
        if model.current?.isBusiness == true { business } else { owner }
      }
      .gurtList()
      .machineTitle()
      .refreshable { await model.refresh() }
      .navigationDestination(for: Route.self) { $0.view }
    }
  }

  // MARK: Server and Personal

  @ViewBuilder var owner: some View {
    Section {
      if model.waiting.isEmpty { Empty(text: "Nothing needs you right now.") }
      ForEach(model.waiting) { RequestRow(approval: $0) }
    } header: { Text("Needs you") }

    if model.current?.isPersonal == true, !model.toReview.isEmpty {
      Section {
        ForEach(model.toReview) { ReviewRow(task: $0) }
      } header: { Text("Ready for you") } footer: { Text("Your folder stays as it was until you choose Keep.") }
    }

    Section {
      let running = model.tasks.filter(\.isRunning)
      if running.isEmpty { Empty(text: "No task is running.") }
      ForEach(running) { t in NavigationLink(value: Route.task(t.id)) { TaskRow(task: t) } }
    } header: { Text("Running") }

    if model.mayPause { KillSwitch() }
  }

  // MARK: Business

  @ViewBuilder var business: some View {
    Section {
      if model.waiting.isEmpty { Empty(text: model.mayAnswer ? "Nothing waits for you." : "Your role doesn't answer requests.") }
      ForEach(model.waiting) { RequestRow(approval: $0) }
    } header: { Text("Waiting for me") } footer: {
      if let p = model.me?.person, model.mayAnswer {
        Text("You approve as \(p.title ?? p.role)\(p.limitCents.map { ", up to \(Money.dollars($0))" } ?? ""). Everything else goes to the person the rules name.")
      }
    }
    if !model.myRequests.isEmpty {
      Section("My requests") {
        ForEach(model.myRequests) { a in NavigationLink(value: Route.approval(a.id)) { RequestSummary(approval: a) } }
      }
    }
    Section("Running") {
      let running = model.tasks.filter(\.isRunning)
      if running.isEmpty { Empty(text: "No task is running.") }
      ForEach(running) { t in NavigationLink(value: Route.task(t.id)) { TaskRow(task: t) } }
    }
    if model.mayPause { KillSwitch() }
  }
}

/** Where a row leads. */
enum Route: Hashable {
  case approval(String), task(String)

  @MainActor @ViewBuilder var view: some View {
    switch self {
    case .approval(let id): ApprovalView(id: id)
    case .task(let id): TaskView(id: id)
    }
  }
}

/** A request with its Approve and Deny right in the row (QA: one tap, not three). */
struct RequestRow: View {
  @Environment(AppState.self) var app
  var approval: Approval
  @State var answering = Answering()

  var body: some View {
    let a = approval
    VStack(alignment: .leading, spacing: 10) {
      NavigationLink(value: Route.approval(a.id)) { RequestSummary(approval: a) }
      AnswerButtons(approval: a, model: app.model, answering: answering)
    }
    .padding(.vertical, 4)
    .answerAlerts(answering)
  }
}

struct RequestSummary: View {
  @Environment(AppState.self) var app
  var approval: Approval

  var body: some View {
    let a = approval
    let task = app.model.task(a.task)
    HStack(alignment: .top, spacing: 12) {
      Image(systemName: a.isFraud ? "exclamationmark.shield" : (a.amountCents > 0 ? "creditcard" : "hand.raised"))
        .font(.body.weight(.semibold)).foregroundStyle(Color.gAccent).frame(width: 28, height: 28)
        .background(Color.gAccent.opacity(0.12), in: RoundedRectangle(cornerRadius: 8, style: .continuous))
        .accessibilityHidden(true)
      VStack(alignment: .leading, spacing: 3) {
        HStack(alignment: .firstTextBaseline) {
          Text(task?.title ?? "A task needs your OK").font(.g(.headline)).lineLimit(2)
          Spacer(minLength: 6)
          if a.isFraud { AmountBadge(text: "Fraud referral", fraud: true) } else if a.amountCents > 0 { AmountBadge(text: Money.dollars(a.amountCents)) }
        }
        Text(a.purpose ?? a.question).font(.g(.subheadline)).foregroundStyle(Color.gSecondary).lineLimit(3)
        if let who = app.model.askedBy(a) { Text("Requested by \(who)").font(.g(.footnote)).foregroundStyle(Color.gSecondary) }
        if a.state != "pending" { Text("\(Words.answer(a.state))\(a.by.map { " by \($0)" } ?? "")").font(.g(.footnote, .semibold)).foregroundStyle(Color.gSecondary) }
      }
    }
    .accessibilityElement(children: .combine)
  }
}

struct TaskRow: View {
  var task: BoxTask

  var body: some View {
    VStack(alignment: .leading, spacing: 5) {
      HStack {
        Text(task.title).font(.g(.headline)).lineLimit(2)
        Spacer()
        if task.isWaiting { Text("Waiting").font(.g(.caption, .semibold)).foregroundStyle(Color.gAttentionFg) }
      }
      if let s = task.step ?? task.summary { Text(s).font(.g(.subheadline)).foregroundStyle(Color.gSecondary).lineLimit(2) }
      if task.isRunning { ProgressView().progressViewStyle(.linear).tint(Color.gAccent).accessibilityLabel("Running") }
    }
    .padding(.vertical, 2)
    .accessibilityElement(children: .combine)
  }
}

/** Personal: a finished folder task, with Undo and Keep changes (Figma 2b). */
struct ReviewRow: View {
  @Environment(AppState.self) var app
  var task: BoxTask
  @State var error: String?

  var body: some View {
    VStack(alignment: .leading, spacing: 10) {
      NavigationLink(value: Route.task(task.id)) {
        VStack(alignment: .leading, spacing: 3) {
          Text(task.title).font(.g(.headline))
          if let s = task.summary { Text(s).font(.g(.subheadline)).foregroundStyle(Color.gSecondary) }
        }
      }
      HStack(spacing: 10) {
        Button("Undo") { act { try await app.model.undo(task) } }.buttonStyle(.bordered).frame(maxWidth: .infinity)
        Button("Keep changes") { act { try await app.model.keep(task) } }.buttonStyle(.borderedProminent).frame(maxWidth: .infinity)
      }
      .buttonBorderShape(.capsule)
      .font(.g(.subheadline, .semibold))
    }
    .alert("Not done", isPresented: .constant(error != nil)) { Button("OK") { error = nil } } message: { Text(error ?? "") }
  }

  func act(_ f: @escaping () async throws -> Void) {
    Task { do { try await f() } catch { self.error = error.localizedDescription } }
  }
}

/** Pause all agents: running tasks stop mid-step and new ones wait. Approvals can still be answered. */
struct KillSwitch: View {
  @Environment(AppState.self) var app
  @State var confirm = false
  @State var error: String?

  var body: some View {
    let paused = app.model.paused.paused
    Section {
      Button(role: paused ? nil : .destructive) {
        if paused { toggle(false) } else { confirm = true }
      } label: {
        Text(paused ? "Resume all agents" : "Pause all agents").font(.g(.headline)).frame(maxWidth: .infinity, minHeight: 34)
      }
      .buttonStyle(.borderedProminent)
      .tint(paused ? Color.gAccent : Color.gDestructive)
      .buttonBorderShape(.capsule)
      .listRowBackground(Color.clear)
      .listRowInsets(EdgeInsets())
    } header: { Text("Kill switch") } footer: {
      Text(paused ? "Every agent is paused\(app.model.paused.by.map { " by \($0)" } ?? ""). Nothing runs until you resume." : "Running tasks stop mid-step and new ones wait. What waits for your OK stays open.")
    }
    .confirmationDialog("Pause every agent on \(app.model.current?.name ?? "this computer")?", isPresented: $confirm, titleVisibility: .visible) {
      Button("Pause all agents", role: .destructive) { toggle(true) }
    }
    .alert("The kill switch didn't change", isPresented: .constant(error != nil)) { Button("OK") { error = nil } } message: { Text(error ?? "") }
    .sensoryFeedback(.warning, trigger: paused)
  }

  func toggle(_ on: Bool) { Task { do { try await app.model.setPaused(on) } catch { self.error = error.localizedDescription } } }
}

struct OfflineRow: View {
  var name: String
  var body: some View {
    Label("\(name) is out of reach. Answers wait until it is back.", systemImage: "wifi.exclamationmark")
      .font(.g(.subheadline, .semibold)).foregroundStyle(Color.gDestructiveFg)
      .listRowBackground(Color.gDestructive.opacity(0.12))
  }
}

struct Empty: View {
  var text: String
  var body: some View { Text(text).font(.g(.subheadline)).foregroundStyle(Color.gSecondary) }
}

extension View {
  /** GurtOS's warm backgrounds behind a native grouped list. */
  func gurtList() -> some View {
    listStyle(.insetGrouped)
      .scrollContentBackground(.hidden)
      .background(Color.gWindow)
      .font(.g(.body))
  }

  func answerAlerts(_ a: Answering) -> some View {
    modifier(AnswerAlerts(answering: a))
  }
}

struct AnswerAlerts: ViewModifier {
  @Bindable var answering: Answering
  @Environment(AppState.self) var app

  func body(content: Content) -> some View {
    content
      .alert(answering.message ?? "", isPresented: .constant(answering.message != nil)) { Button("OK") { answering.message = nil } }
      .sheet(item: $answering.passkeyURL) { url in
        SafariView(url: url).ignoresSafeArea().onDisappear { Task { await app.model.refresh() } }
      }
  }
}

extension URL: @retroactive Identifiable { public var id: String { absoluteString } }
