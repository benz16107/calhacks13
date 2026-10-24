// Decrypts and checks each push before iOS shows it (Shared/PushContent.swift).
import UserNotifications
import WidgetKit

final class NotificationService: UNNotificationServiceExtension {
  override func didReceive(_ request: UNNotificationRequest, withContentHandler done: @escaping (UNNotificationContent) -> Void) {
    let c = PushContent.make(request.content)
    WidgetCenter.shared.reloadAllTimelines()
    done(c)
  }
}
