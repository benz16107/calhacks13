// The words the apps use for states and log events. Plain words, the same ones the web app uses.
import Foundation

public enum Words {
  public static func state(_ s: String) -> String {
    switch s {
    case "running": "Running"
    case "queued": "Queued"
    case "waiting": "Waiting for an OK"
    case "done": "Done"
    case "failed": "Failed"
    case "undone": "Undone"
    case "blocked": "Blocked"
    default: s.capitalized
    }
  }

  public static func answer(_ state: String) -> String { state == "approved" ? "Approved" : state == "denied" ? "Denied" : "Waiting" }

  /** One line for a log event, or nil for events people don't need to read. */
  public static func event(_ e: LogEvent, title: (String) -> String?) -> String? {
    let t = e.task.flatMap(title) ?? e.spec?.title ?? "A task"
    switch e.type {
    case "task.created": return "Started \(e.spec?.title ?? t)"
    case "task.state":
      switch e.state {
      case "done": return "\(t) finished"
      case "failed": return "\(t) failed\(e.error.map { ": \($0)" } ?? "")"
      case "undone": return "\(t) was undone"
      case "blocked": return "\(t) was stopped"
      default: return nil
      }
    case "task.step": return e.text.map { "\(t): \($0)" }
    case "approval.asked": return e.approval.map { "\(t) asked: \($0.question)" }
    case "approval.answered": return "\(e.approved == true ? "Approved" : "Denied") by \(e.by ?? "someone")"
    case "net.blocked": return "Blocked \(t) from reaching \(e.host ?? "a host")"
    case "cost": return e.cents.map { "Spent \(Money.dollars($0))\(e.what.map { " on \($0)" } ?? "")" }
    case "keep":
      switch e.result {
      case "kept": return "Kept the changes from \(t)"
      case "conflict": return "\(t) changed files you also edited. Nothing was applied."
      case "reverted": return "Put back the files from \(t)"
      default: return nil
      }
    default: return nil
    }
  }

  public static func isAlarm(_ e: LogEvent) -> Bool { e.type == "net.blocked" || (e.type == "task.state" && e.state == "failed") }

  /** "2 min ago" style, from the box's ISO time. */
  public static func ago(_ iso: String?) -> String {
    guard let iso, let d = ISO8601DateFormatter.box.date(from: iso) else { return "" }
    return RelativeDateTimeFormatter().localizedString(for: d, relativeTo: .now)
  }
}

extension ISO8601DateFormatter {
  nonisolated(unsafe) static let box: ISO8601DateFormatter = {
    let f = ISO8601DateFormatter()
    f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    return f
  }()
}
