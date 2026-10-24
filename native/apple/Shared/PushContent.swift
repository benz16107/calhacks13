// Every GurtOS push arrives as ciphertext: the relay can't read it. This decrypts it with this phone's key
// (RFC 8291), checks the box's signature with the key this phone gave that box alone, and only then shows the
// machine's name and the question. Anything that fails the check says only that it was ignored.
// Used by the notification service extension, and by debug builds in the simulator, where `simctl push` skips
// service extensions.
import GurtKit
import UserNotifications

enum PushContent {
  static func make(_ original: UNNotificationContent) -> UNMutableNotificationContent {
    let c = (original.mutableCopy() as? UNMutableNotificationContent) ?? UNMutableNotificationContent()
    guard let fields = open(original.userInfo), let m = Machines().find(boxId: fields["machine"] as? String ?? "", url: fields["url"] as? String) else {
      c.title = "GurtOS"
      c.body = "A message that could not be checked was ignored."
      c.categoryIdentifier = ""
      return c
    }
    // The title names the machine and the body is the question (docs/figma/phone-app 3a). iOS shows the app's
    // name and icon, so the text doesn't repeat them.
    c.title = fields["box"] as? String ?? m.name
    c.subtitle = fields["body"] != nil ? fields["title"] as? String ?? "" : ""
    c.body = (fields["body"] as? String) ?? (fields["title"] as? String) ?? "A request needs you."
    c.threadIdentifier = m.id
    c.userInfo = ["gurtos": fields]
    if fields["type"] as? String == "approval" {
      c.categoryIdentifier = NotificationCategories.for(fields: fields, machine: m)
      // An agent is waiting on this answer, so it may break through a Focus.
      c.interruptionLevel = .timeSensitive
      var g = Glance.load()
      if !g.requests.contains(where: { $0.id == fields["id"] as? String }) { g.waiting += 1; g.at = .now; g.save() }
    } else {
      c.categoryIdentifier = ""
    }
    return c
  }

  /** The checked fields, or nil if the push isn't for this phone or wasn't signed by the machine it names. */
  static func open(_ info: [AnyHashable: Any]) -> [String: Any]? {
    guard let e = info["e"] as? String, let body = Base64URL.decode(e) else { return nil }
    let keys = PushKeys.loadOrMake(Keychain())
    guard let plain = try? WebPush.decrypt(body, privateKey: keys.privateKey, auth: keys.auth),
          let peek = (try? JSONSerialization.jsonObject(with: plain)) as? [String: Any],
          let m = Machines().find(boxId: peek["machine"] as? String ?? "", url: peek["url"] as? String),
          let key = m.pushKey.flatMap(Base64URL.decode)
    else { return nil }
    return WebPush.verify(plain, key: key)
  }
}
