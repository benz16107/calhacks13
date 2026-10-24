// The box's shapes, as core/contract.ts and core/README.md define them. Every field the apps don't need is left
// out, and every field a box may leave out is optional, so a newer box still decodes.
import Foundation

public struct BoxTask: Codable, Identifiable, Hashable, Sendable {
  public var id: String
  public var title: String
  public var state: String
  public var source: String?
  public var workspace: String?
  public var costCents: Int?
  public var budgetCents: Int?
  public var step: String?
  public var summary: String?
  public var error: String?
  /** Personal: where a real-folder task's changes stand: pending, kept, conflict or undone. */
  public var review: String?
  public var requestedBy: String?
  public var createdAt: String?
  public var updatedAt: String?

  public var isRunning: Bool { state == "running" || state == "queued" }
  public var isWaiting: Bool { state == "waiting" }
  public var isFinished: Bool { ["done", "failed", "undone", "blocked"].contains(state) }
  public var canUndo: Bool { state != "undone" && state != "queued" }
}

public struct ApprovalRoute: Codable, Hashable, Sendable {
  public var rule: String
  public var to: String
  public var amountCents: Int
  public var people: [PersonRef]
  public var why: String
}

public struct PersonRef: Codable, Hashable, Sendable {
  public var id: String
  public var name: String
}

public struct Approval: Codable, Identifiable, Hashable, Sendable {
  public var id: String
  public var task: String
  public var question: String
  public var costCents: Int
  public var payee: String?
  public var purpose: String?
  public var state: String
  public var by: String?
  public var via: String?
  public var askedBy: String?
  public var route: ApprovalRoute?

  public var isPending: Bool { state == "pending" }
  /** A Business fraud referral, by its rule. The box decides for itself; this only picks the words and buttons. */
  public var isFraud: Bool { route.map { $0.rule.range(of: "fraud", options: .caseInsensitive) != nil } ?? false }
  /** The money it is about: the spend, or the amount the Business rules checked (portal answer.tsx amountOf). */
  public var amountCents: Int { costCents > 0 ? costCents : (route != nil && !isFraud ? route!.amountCents : 0) }
}

/** `GET /api/system`. */
public struct SystemInfo: Codable, Hashable, Sendable {
  public var edition: String
  public var editionName: String?
  public var boxId: String
  public var boxName: String
  public var company: String?
  public var version: String?
}

/** `GET /api/pause`. */
public struct PauseState: Codable, Hashable, Sendable {
  public var paused: Bool
  public var by: String?
  public var at: String?
}

/** `GET /api/me` on a Business box: who this phone is, and what waits for them. */
public struct Me: Codable, Hashable, Sendable {
  public struct Person: Codable, Hashable, Sendable {
    public var id: String
    public var name: String
    public var title: String?
    public var role: String
    public var limitCents: Int?
  }
  public var person: Person?
  public var company: String?
  /** Everyone on the box, so a screen can name who asked. */
  public var directory: [Person]?
  public var waiting: [Approval]?
  public var requests: [Approval]?
}

/** One action log event (`LogEvent`). Only the fields the apps show. */
public struct LogEvent: Codable, Identifiable, Hashable, Sendable {
  public var seq: Int
  public var at: String
  public var type: String
  public var task: String?
  public var text: String?
  public var state: String?
  public var error: String?
  public var summary: String?
  public var approved: Bool?
  public var by: String?
  public var via: String?
  public var host: String?
  public var tool: String?
  public var ok: Bool?
  public var cents: Int?
  public var what: String?
  public var track: String?
  public var result: String?
  public var approval: Approval?
  public var spec: Spec?
  public var id: Int { seq }

  public struct Spec: Codable, Hashable, Sendable { public var title: String? }
}

/** `GET /api/tasks/<id>`. */
public struct TaskDetail: Codable, Sendable {
  public var task: BoxTask
  public var approvals: [Approval]
  public var events: [LogEvent]
}

/** `POST /api/pair`. */
public struct PairResult: Codable, Sendable {
  public struct Device: Codable, Sendable {
    public var id: String
    public var name: String
    public var person: String?
  }
  public struct Box: Codable, Sendable {
    public var id: String
    public var name: String
  }
  public var token: String
  public var device: Device?
  public var box: Box
  public var edition: String?
}

public enum Money {
  /** "$40", "$12.50": whole dollars without cents, as the portal writes them. */
  public static func dollars(_ cents: Int) -> String {
    let f = NumberFormatter()
    f.numberStyle = .currency
    f.currencyCode = "USD"
    f.locale = Locale(identifier: "en_US")
    f.maximumFractionDigits = cents % 100 == 0 ? 0 : 2
    f.minimumFractionDigits = cents % 100 == 0 ? 0 : 2
    return f.string(from: NSNumber(value: Double(cents) / 100)) ?? "$\(cents / 100)"
  }
}
