// Tokens and push keys live in the keychain, in one shared access group, so the app, its notification extension
// and its widgets read the same machines. A keychain group needs no registration with Apple (an app group does,
// and an App Store Connect API key can't register one). Nothing secret goes to UserDefaults.
import Foundation
import Security

public struct Keychain: Sendable {
  /** `$(AppIdentifierPrefix)com.benzhou.gurtos.shared` in every target's keychain-access-groups. */
  public static let group = "744282DWSN.com.benzhou.gurtos.shared"
  public var service = "com.benzhou.gurtos"
  public var accessGroup: String? = Keychain.group

  public init(accessGroup: String? = Keychain.group) { self.accessGroup = accessGroup }

  func query(_ account: String) -> [String: Any] {
    var q: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service, kSecAttrAccount as String: account,
                            kSecUseDataProtectionKeychain as String: true]
    if let accessGroup { q[kSecAttrAccessGroup as String] = accessGroup }
    return q
  }

  /** A build signed to run locally has no access group: the same keychain without it. */
  var plain: Keychain? { accessGroup == nil ? nil : Keychain(accessGroup: nil) }

  public func read(_ account: String) -> Data? {
    var q = query(account)
    q[kSecReturnData as String] = true
    var out: CFTypeRef?
    let s = SecItemCopyMatching(q as CFDictionary, &out)
    if s == errSecMissingEntitlement { return plain?.read(account) }
    return s == errSecSuccess ? out as? Data : nil
  }

  @discardableResult
  public func write(_ account: String, _ data: Data) -> Bool {
    let q = query(account)
    if SecItemCopyMatching(q as CFDictionary, nil) == errSecMissingEntitlement { return plain?.write(account, data) ?? false }
    // After first unlock, so a push that arrives while the phone is locked can still be decrypted.
    let attrs: [String: Any] = [kSecValueData as String: data, kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly]
    if SecItemUpdate(q as CFDictionary, attrs as CFDictionary) == errSecSuccess { return true }
    return SecItemAdd(q.merging(attrs) { $1 } as CFDictionary, nil) == errSecSuccess
  }

  public func delete(_ account: String) { SecItemDelete(query(account) as CFDictionary) }
}

/** The paired computers and which one is showing. */
public struct Machines: Sendable {
  public var keychain: Keychain
  public init(keychain: Keychain = Keychain()) { self.keychain = keychain }

  public func load() -> [Machine] {
    keychain.read("machines").flatMap { try? JSONDecoder().decode([Machine].self, from: $0) } ?? []
  }

  /** False when the keychain refused the write: the tokens would be lost at the next launch. */
  @discardableResult
  public func save(_ list: [Machine]) -> Bool {
    guard let d = try? JSONEncoder().encode(list) else { return false }
    return keychain.write("machines", d)
  }

  /** The computer a push names: by box id, and by address when two test boxes share an id. */
  public func find(boxId: String, url: String?) -> Machine? {
    let same = load().filter { $0.boxId == boxId }
    if same.count > 1, let url, let host = URL(string: url)?.host { return same.first { URL(string: $0.url)?.host == host } }
    return same.first
  }
}

/** What the widgets and the Watch show without asking the box: written by the app after every refresh. */
public struct Glance: Codable, Hashable, Sendable {
  public var machine: String
  public var waiting: Int
  public var running: Int
  public var paused: Bool
  /** The first few requests, for the Watch and the larger widgets. */
  public var requests: [Approval]
  public var at: Date

  public init(machine: String, waiting: Int, running: Int, paused: Bool, requests: [Approval], at: Date = .now) {
    self.machine = machine
    self.waiting = waiting
    self.running = running
    self.paused = paused
    self.requests = requests
    self.at = at
  }

  public static let empty = Glance(machine: "GurtOS", waiting: 0, running: 0, paused: false, requests: [], at: .distantPast)
  public static func load() -> Glance {
    Keychain().read("glance").flatMap { try? JSONDecoder().decode(Glance.self, from: $0) } ?? .empty
  }

  public func save() { if let d = try? JSONEncoder().encode(self) { Keychain().write("glance", d) } }
}
