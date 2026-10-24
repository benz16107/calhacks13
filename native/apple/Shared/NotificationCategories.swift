// The buttons on a GurtOS notification. Approve right from the notification only when nothing is spent, no
// Business rule routed it and no passkey is needed; anything else opens the request, where Face ID runs.
// Apple Watch shows the same buttons, and its double tap runs the first one that isn't destructive.
import GurtKit
import UserNotifications

enum NotificationCategories {
  static let approve = "approve"
  static let deny = "deny"
  /** Opens the request in the app, where Approve asks for Face ID. */
  static let review = "review"

  static let request = "request"
  static let requestCheck = "request-check"
  static let requestDenyOnly = "request-deny-only"

  static var all: Set<UNNotificationCategory> {
    let deny = UNNotificationAction(identifier: deny, title: "Deny", options: [.destructive, .authenticationRequired], icon: .init(systemImageName: "xmark"))
    return [
      UNNotificationCategory(identifier: request, actions: [
        UNNotificationAction(identifier: approve, title: "Approve", options: [.authenticationRequired], icon: .init(systemImageName: "checkmark")), deny,
      ], intentIdentifiers: [], hiddenPreviewsBodyPlaceholder: "A request needs you", options: []),
      UNNotificationCategory(identifier: requestCheck, actions: [
        UNNotificationAction(identifier: review, title: "Approve with Face ID", options: [.foreground], icon: .init(systemImageName: "faceid")), deny,
      ], intentIdentifiers: [], hiddenPreviewsBodyPlaceholder: "A request needs you", options: []),
      UNNotificationCategory(identifier: requestDenyOnly, actions: [deny], intentIdentifiers: [], hiddenPreviewsBodyPlaceholder: "A request needs you", options: []),
    ]
  }

  /** Which buttons a push gets, from its checked fields and what this phone knows about the machine. */
  static func `for`(fields: [String: Any], machine: Machine) -> String {
    if (fields["source"] as? String)?.hasPrefix("shopper:") == true { return requestDenyOnly }
    if (fields["costCents"] as? Int ?? 0) > 0 || machine.isBusiness { return requestCheck }
    return request
  }
}
