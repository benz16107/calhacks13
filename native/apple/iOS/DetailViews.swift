// A request (Figma 3b) and a task (os-v2 phone 5): what it is, the agent's steps, and what you can do about it.
import GurtKit
import SwiftUI

struct ApprovalView: View {
  @Environment(AppState.self) var app
  var id: String
  @State var answering = Answering()
  @State var detail: TaskDetail?
  @State var detailFailed = false

  var approval: Approval? { app.model.approval(id) ?? detail?.approvals.first { $0.id == id } }

  var body: some View {
    Group {
      if let a = approval {
        List {
          Section {
            VStack(alignment: .leading, spacing: 8) {
              MachineChip()
              Text(app.model.task(a.task)?.title ?? detail?.task.title ?? "A request").font(.g(.title2, .bold))
              if a.amountCents > 0 {
                Text(Money.dollars(a.amountCents)).font(.g(.largeTitle, .bold)).monospacedDigit()
                  .accessibilityLabel("Amount \(Money.dollars(a.amountCents))")
              }
              if a.isFraud { AmountBadge(text: "Fraud referral", fraud: true) }
              Text(a.question).font(.g(.body))
              if let payee = a.payee { LabeledContent("To", value: payee).font(.g(.subheadline)) }
              if let who = app.model.askedBy(a) { Label("Requested by \(who)", systemImage: "person.fill").font(.g(.subheadline)).foregroundStyle(Color.gSecondary) }
            }
            .padding(.vertical, 4)
            .listRowBackground(Color.clear)
          }
          if let r = a.route {
            Section { Label(r.why, systemImage: "arrow.triangle.branch").font(.g(.subheadline)) }
          }
          if !a.isPending {
            Section { Text("\(Words.answer(a.state))\(a.by.map { " on \($0)" } ?? "")").font(.g(.headline)) }
          }
          Section("The agent's checks") {
            let steps = (detail?.events ?? []).filter { $0.type == "task.step" }
            if steps.isEmpty { Empty(text: detail == nil ? (detailFailed ? "Couldn't load the steps." : "Loading…") : "No steps before it asked.") }
            ForEach(steps) { e in Label(e.text ?? "", systemImage: "checkmark").font(.g(.subheadline)) }
          }
        }
        .gurtList()
        .defaultScrollAnchor(ProcessInfo.processInfo.environment["GURTOS_SCROLL"] == "bottom" ? .bottom : .top) // debug screenshots
        .scrollEdgeEffectStyle(.hard, for: .bottom)
        .safeAreaBar(edge: .bottom) {
          if a.isPending && app.model.mayAnswer {
            AnswerButtons(approval: a, model: app.model, answering: answering, large: true)
              .padding(.horizontal, 20).padding(.bottom, 8)
          }
        }
      } else if !app.model.loaded && app.model.live != .offline && !detailFailed {
        ProgressView("Loading…")
      } else if !app.model.loaded {
        ContentUnavailableView("Can't reach \(app.model.current?.name ?? "the computer")", systemImage: "wifi.exclamationmark", description: Text("The request shows here once it is back."))
      } else {
        ContentUnavailableView("This request was answered", systemImage: "checkmark.circle", description: Text("It is no longer waiting."))
      }
    }
    .navigationTitle("Request")
    .navigationBarTitleDisplayMode(.inline)
    .answerAlerts(answering)
    .task(id: app.model.events.last?.seq) {
      let task = approval?.task ?? String(id.split(separator: ".").first ?? "")
      do { detail = try await app.model.client?.task(task); detailFailed = false } catch { detailFailed = detail == nil }
    }
  }
}

/** "Fogline Supply · signed in as Rosa Delgado": which machine, and who you are on it. */
struct MachineChip: View {
  @Environment(AppState.self) var app
  var body: some View {
    let m = app.model.current
    HStack(spacing: 6) {
      MachineTile(machine: m, size: 18)
      Text([m?.name, m?.person.map { "signed in as \($0)" }].compactMap { $0 }.joined(separator: " · "))
        .font(.g(.caption, .semibold)).lineLimit(1)
    }
    .padding(.horizontal, 8).padding(.vertical, 5)
    .background(Color.gCard, in: Capsule())
    .overlay(Capsule().strokeBorder(.separator))
  }
}

struct TaskView: View {
  @Environment(AppState.self) var app
  var id: String
  @State var detail: TaskDetail?
  @State var detailFailed = false
  @State var confirmUndo = false
  @State var error: String?

  var body: some View {
    let t = app.model.task(id) ?? detail?.task
    List {
      if let t {
        Section {
          VStack(alignment: .leading, spacing: 6) {
            Text(t.title).font(.g(.title2, .bold))
            HStack(spacing: 8) {
              Text(Words.state(t.state)).font(.g(.subheadline, .semibold)).foregroundStyle(t.state == "failed" ? Color.gDestructiveFg : t.isWaiting ? Color.gAttentionFg : Color.gSecondary)
              if let c = t.costCents, c > 0 { Text("· \(Money.dollars(c)) spent").font(.g(.subheadline)).foregroundStyle(Color.gSecondary) }
            }
            if let s = t.summary { Text(s).font(.g(.body)) }
            if let e = t.error { Text(e).font(.g(.subheadline)).foregroundStyle(Color.gDestructiveFg) }
          }
          .listRowBackground(Color.clear)
        }
        let blocked = (detail?.events ?? []).filter { $0.type == "net.blocked" }
        if !blocked.isEmpty {
          Section {
            Label("It tried to reach \(Set(blocked.compactMap(\.host)).sorted().joined(separator: ", ")). GurtOS blocked it, and the task never held a key.", systemImage: "exclamationmark.octagon.fill")
              .font(.g(.subheadline, .semibold)).foregroundStyle(Color.gDestructiveFg)
          }
        }
        ForEach((detail?.approvals ?? []).filter(\.isPending)) { a in
          Section("Needs you") { RequestRow(approval: a) }
        }
        Section("Steps") {
          let steps = (detail?.events ?? []).filter { ["task.step", "net.blocked", "approval.answered"].contains($0.type) }
          if steps.isEmpty { Empty(text: detail == nil ? (detailFailed ? "Couldn't load the steps." : "Loading…") : "No steps yet.") }
          ForEach(steps) { e in
            HStack(alignment: .top) {
              Image(systemName: Words.isAlarm(e) ? "xmark.octagon.fill" : "circle.fill").font(.system(size: Words.isAlarm(e) ? 14 : 6))
                .foregroundStyle(Words.isAlarm(e) ? Color.gDestructiveFg : Color.gAccent).frame(width: 16).padding(.top, 5)
              Text(e.type == "task.step" ? e.text ?? "" : Words.event(e) { _ in t.title } ?? "").font(.g(.subheadline))
            }
            .accessibilityElement(children: .combine)
          }
        }
        if t.review == "pending" || t.canUndo {
          Section {
            if t.review == "pending" {
              Button("Keep changes") { act { try await app.model.keep(t) } }.font(.g(.headline))
            }
            if t.canUndo {
              Button("Undo this task", role: .destructive) { confirmUndo = true }.font(.g(.headline))
            }
          } footer: { Text("Undo removes this task's changes. Every other task keeps its own.") }
        }
      }
    }
    .gurtList()
    .navigationTitle("Task")
    .navigationBarTitleDisplayMode(.inline)
    .task(id: app.model.events.last?.seq) {
      do { detail = try await app.model.client?.task(id); detailFailed = false } catch { detailFailed = detail == nil }
    }
    .overlay {
      if t == nil {
        if detailFailed || app.model.live == .offline { ContentUnavailableView("Couldn't load this task", systemImage: "wifi.exclamationmark", description: Text("\(app.model.current?.name ?? "The computer") didn't answer.")) } else { ProgressView("Loading…") }
      }
    }
    .confirmationDialog("Undo \(t?.title ?? "this task")?", isPresented: $confirmUndo, titleVisibility: .visible) {
      Button("Undo", role: .destructive) { if let t { act { try await app.model.undo(t) } } }
    } message: { Text("Its files are removed. Every other task keeps its own.") }
    .alert("Not done", isPresented: .constant(error != nil)) { Button("OK") { error = nil } } message: { Text(error ?? "") }
  }

  func act(_ f: @escaping () async throws -> Void) {
    Task {
      do { try await f(); detail = try? await app.model.client?.task(id) } catch { self.error = error.localizedDescription }
    }
  }
}
