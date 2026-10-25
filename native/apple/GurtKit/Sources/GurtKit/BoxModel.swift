// The state every GurtOS Apple app shows for the machine it is on: tasks, what waits, the kill switch, the log,
// and whether the box can be reached. It follows the box's log stream and refetches on each change, the way the
// web app does when SpacetimeDB is out of reach (portal/src/live.ts).
import Foundation
import Observation

@MainActor @Observable
public final class BoxModel {
  public enum Live: Equatable { case connecting, live, offline }

  public private(set) var machines: [Machine] = []
  public private(set) var current: Machine?
  public var tasks: [BoxTask] = []
  public var approvals: [Approval] = []
  public var me: Me?
  public var paused = PauseState(paused: false)
  public var events: [LogEvent] = []
  public var live: Live = .connecting
  /** Answers given here, shown for a moment before the request leaves the list. */
  public var answered: [String: Bool] = [:]

  let store: Machines
  let kind: String
  var follow: Task<Void, Never>?
  var refreshing: Task<Void, Never>?
  public var onChange: (@MainActor (BoxModel) -> Void)?
  /** Each live log event as it arrives (the Mac app turns a new request into a notification). */
  public var onEvent: (@MainActor (LogEvent) -> Void)?

  public init(store: Machines = Machines(), kind: String) {
    self.store = store
    self.kind = kind
    machines = store.load()
    let saved = UserDefaults.standard.string(forKey: "gurtos.machine")
    current = machines.first { $0.id == saved } ?? machines.first
  }

  public var client: BoxClient? { current.map { BoxClient(machine: $0) } }

  // MARK: What the screens show

  /** What waits for this device's person: on Business, Waiting for me; elsewhere every pending request. */
  public var waiting: [Approval] {
    current?.isBusiness == true ? (me?.waiting ?? []) : approvals.filter(\.isPending)
  }

  /** Business: what this person asked for that is still waiting on someone else. */
  public var myRequests: [Approval] { (me?.requests ?? []).filter(\.isPending) }
  public var running: [BoxTask] { tasks.filter { $0.isRunning || $0.isWaiting } }
  public var toReview: [BoxTask] { tasks.filter { $0.review == "pending" } }
  public var recent: [BoxTask] { tasks.filter(\.isFinished).sorted { ($0.updatedAt ?? "") > ($1.updatedAt ?? "") } }
  public func task(_ id: String) -> BoxTask? { tasks.first { $0.id == id } }
  public func approval(_ id: String) -> Approval? {
    approvals.first { $0.id == id } ?? me?.waiting?.first { $0.id == id } ?? me?.requests?.first { $0.id == id }
  }

  /** Business: the name of the person who asked, from the directory. */
  public func askedBy(_ a: Approval) -> String? {
    guard let id = a.askedBy ?? task(a.task)?.requestedBy else { return nil }
    return me?.directory?.first { $0.id == id }?.name
  }

  /** Spent today, counted from the log: model costs and paid tool calls. */
  public var spentToday: Double {
    let start = Calendar.current.startOfDay(for: .now)
    return events.reduce(0.0) { sum, e in
      guard (e.type == "cost" || e.type == "tool.result"), let c = e.cents, let d = ISO8601DateFormatter.box.date(from: e.at), d >= start else { return sum }
      return sum + c
    }
  }

  /** Owner or Business admin: the box refuses the kill switch for anyone else, so the button hides too. */
  public var mayPause: Bool {
    guard let m = current else { return false }
    if m.isBusiness { return ["owner", "admin"].contains(me?.person?.role ?? m.role ?? "") }
    return true
  }

  /** An auditor reads everything and answers nothing. */
  public var mayAnswer: Bool { me?.person?.role != "auditor" && me?.person?.role != "requester" }

  // MARK: Machines

  public func select(_ m: Machine) {
    guard m.id != current?.id else { return }
    current = m
    UserDefaults.standard.set(m.id, forKey: "gurtos.machine")
    tasks = []; approvals = []; me = nil; events = []; live = .connecting
    start()
  }

  public func add(_ m: Machine) {
    machines.removeAll { $0.id == m.id }
    machines.append(m)
    store.save(machines)
    current = nil
    select(m)
  }

  /** The Watch: its iPhone sends the list (with the Watch's own tokens); keep the one showing if it is still there. */
  public func replaceMachines(_ list: [Machine], current id: String?) {
    store.save(list)
    machines = list
    let next = list.first { $0.id == (current?.id ?? id) } ?? list.first { $0.id == id } ?? list.first
    if next?.id != current?.id || next?.token != current?.token {
      current = nil
      if let next { select(next) } else { stop(); tasks = []; approvals = [] }
    }
  }

  public func update(_ m: Machine) {
    guard let i = machines.firstIndex(where: { $0.id == m.id }) else { return }
    machines[i] = m
    store.save(machines)
    if current?.id == m.id { current = m }
  }

  /** Pair with the machine a QR code or typed code names, as this kind of device (iphone, mac). */
  public func pair(_ link: PairingLink, name: String) async throws {
    add(try await BoxClient.pair(link, name: name, kind: kind))
  }

  /** Forget a machine here and on the box. The box may be out of reach; the token is dropped here anyway. */
  public func forget(_ m: Machine) async {
    try? await BoxClient(machine: m).unpair()
    machines.removeAll { $0.id == m.id }
    store.save(machines)
    if current?.id == m.id {
      current = nil
      follow?.cancel()
      if let next = machines.first { select(next) } else { tasks = []; approvals = []; me = nil; events = [] }
    }
  }

  // MARK: Live state

  public func start() {
    follow?.cancel()
    guard let m = current else { return }
    follow = Task { [weak self] in
      var backoff: UInt64 = 1
      while !Task.isCancelled {
        guard let self else { return }
        await self.refresh()
        let after = self.events.last?.seq ?? 0
        do {
          for try await e in BoxClient(machine: m).stream(after: after) {
            backoff = 1
            self.live = .live
            self.take(e)
          }
        } catch {}
        if Task.isCancelled { return }
        self.live = await BoxClient(machine: m).health() ? .connecting : .offline
        try? await Task.sleep(nanoseconds: min(backoff, 15) * 1_000_000_000)
        backoff *= 2
      }
    }
  }

  public func stop() { follow?.cancel(); follow = nil }

  func take(_ e: LogEvent) {
    if events.last.map({ e.seq > $0.seq }) ?? true {
      if !events.isEmpty { onEvent?(e) }
      events.append(e)
      if events.count > 500 { events.removeFirst(events.count - 500) }
    }
    // Every change is a log event: refetch the lists once things settle (at most every 300 ms).
    refreshing?.cancel()
    refreshing = Task { [weak self] in
      try? await Task.sleep(nanoseconds: 300_000_000)
      if !Task.isCancelled { await self?.refresh() }
    }
  }

  public func refresh() async {
    guard let c = client, var m = current else { return }
    do {
      async let t = c.tasks()
      async let a = c.pending()
      async let p = c.pause()
      tasks = try await t.sorted { ($0.updatedAt ?? "") > ($1.updatedAt ?? "") }
      approvals = try await a
      paused = (try? await p) ?? paused
      if events.isEmpty { events = Array(((try? await c.log(after: 0)) ?? []).suffix(300)) }
      if m.edition == nil || m.isBusiness, let s = try? await c.system() {
        if m.edition != s.edition || m.name != (s.company ?? s.boxName) { m.edition = s.edition; m.name = s.company ?? s.boxName; update(m) }
      }
      if m.isBusiness, let me = try? await c.me() {
        self.me = me
        if let p = me.person, m.person != p.name || m.role != p.role { m.person = p.name; m.personTitle = p.title; m.role = p.role; update(m) }
      }
      if live == .offline { live = .connecting }
      onChange?(self)
    } catch {
      if (error as? BoxError)?.unpaired == true { live = .offline }
      else { live = await c.health() ? live : .offline }
    }
  }

  // MARK: Acting

  /** Approve or deny. `auth` says how this device checked it was you (Face ID, Touch ID, the wrist). */
  public func answer(_ a: Approval, approved: Bool, auth: AnswerAuth) async throws -> Approval {
    guard let c = client else { throw BoxError(status: 0, message: "No machine is paired.") }
    let out = try await c.answer(a.id, approved: approved, auth: auth)
    answered[a.id] = approved
    Task { [weak self] in
      try? await Task.sleep(nanoseconds: 1_200_000_000)
      self?.answered[a.id] = nil
      await self?.refresh()
    }
    return out
  }

  public func undo(_ t: BoxTask) async throws { _ = try await client?.undo(t.id); await refresh() }
  public func keep(_ t: BoxTask) async throws { try await client?.keep(t.id); await refresh() }
  public func setPaused(_ on: Bool) async throws { try await client?.setPaused(on); await refresh() }

  public var glance: Glance {
    Glance(machine: current?.name ?? "GurtOS", waiting: waiting.count, running: tasks.filter(\.isRunning).count, paused: paused.paused, requests: Array(waiting.prefix(4)))
  }
}
