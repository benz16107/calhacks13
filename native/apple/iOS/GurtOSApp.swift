// GurtOS for iPhone: the companion for every machine you pair. Same box API and pairing as the web app, native
// push through the relay (end to end encrypted), Face ID for anything that spends money.
import GurtKit
import SwiftUI
import UserNotifications
import WidgetKit

@main
struct GurtOSApp: App {
  @UIApplicationDelegateAdaptor(AppDelegate.self) var delegate
  @Environment(\.scenePhase) var phase

  var body: some Scene {
    WindowGroup {
      RootView()
        .environment(delegate.app)
        .tint(Color.gAccent)
        .onOpenURL { delegate.app.open(url: $0) }
    }
    .onChange(of: phase) { _, p in
      if p == .active { delegate.app.model.start() } else if p == .background { delegate.app.model.stop() }
    }
  }
}

enum AppTab: Hashable { case home, tasks, activity, settings }

@MainActor @Observable
final class AppState {
  let model = BoxModel(kind: "iphone")
  var tab: AppTab = .home
  var homePath = NavigationPath()
  var showMachines = false
  var showPair = false
  var notificationsAsked = UserDefaults.standard.bool(forKey: "gurtos.notify-asked")
  var notificationsOn = false
  /** The APNs token, once iOS gave one. Each machine gets it as a push subscription. */
  var deviceToken: Data?
  let keychain = Keychain()

  init() {
    model.onChange = { [weak self] m in
      m.glance.save()
      WidgetCenter.shared.reloadAllTimelines()
      self?.watch.send(machines: m.machines)
    }
    #if DEBUG
    // Simulator screenshots and UI checks: SIMCTL_CHILD_GURTOS_PAIR=<pairing link>, SIMCTL_CHILD_GURTOS_OPEN=gurtos://...
    let env = ProcessInfo.processInfo.environment
    if let l = env["GURTOS_PAIR"].flatMap(PairingLink.parse) {
      let old = model.machines.first(where: { URL(string: $0.url)?.host == l.box.host })
      if let old, env["GURTOS_REPAIR"] == nil { model.select(old) } else {
        Task { if let old { await model.forget(old) }; try? await model.pair(l, name: env["GURTOS_NAME"] ?? "iPhone") }
      }
    }
    if let u = env["GURTOS_OPEN"].flatMap(URL.init(string:)) { Task { try? await Task.sleep(nanoseconds: 2_500_000_000); open(url: u) } }
    if env["GURTOS_TAB"] == "settings" { tab = .settings } else if env["GURTOS_TAB"] == "tasks" { tab = .tasks } else if env["GURTOS_TAB"] == "activity" { tab = .activity }
    if env["GURTOS_NOTIFY_ASKED"] != nil { notificationsAsked = true }
    if env["GURTOS_ASK"] != nil { Task { await askForNotifications() } }
    // An APNs payload file, shown the way the service extension would show it, in 3 s.
    if let path = env["GURTOS_LOCALPUSH"], let d = FileManager.default.contents(atPath: path),
       let info = (try? JSONSerialization.jsonObject(with: d)) as? [String: Any] {
      let raw = UNMutableNotificationContent()
      raw.userInfo = info
      let c = PushContent.make(raw)
      c.sound = .default
      Task { try? await UNUserNotificationCenter.current().add(UNNotificationRequest(identifier: UUID().uuidString, content: c, trigger: UNTimeIntervalNotificationTrigger(timeInterval: 3, repeats: false))) }
    }
    #endif
  }

  @ObservationIgnored lazy var watch = WatchLink(app: self)

  /** The approval or task a notification, widget or link points at, on the machine it names. */
  func open(url: URL) {
    if let link = PairingLink.parse(url.absoluteString) { pending = link; pendingRendezvous = nil; showPair = true; return }
    if let r = Rendezvous.parse(url.absoluteString) { pending = nil; pendingRendezvous = r; showPair = true; return }
    if let q = QuickStart.parse(url.absoluteString) { quickStart = q; return }
    // An app.gurtos.com link this app can't read: the web app, in Safari, rather than nothing.
    if url.host == GurtConfig.appHost { safari = url; return }
    guard url.scheme == "gurtos", let parts = URLComponents(url: url, resolvingAgainstBaseURL: false) else { return }
    let machine = parts.queryItems?.first { $0.name == "machine" }?.value
    if let machine, let m = model.machines.first(where: { $0.id == machine || $0.boxId == machine }) { model.select(m) }
    let id = String(url.path.dropFirst()) // the whole path: an id may hold a "/"
    tab = .home
    homePath = NavigationPath()
    switch url.host {
    case "approval": homePath.append(Route.approval(id))
    case "task": homePath.append(Route.task(id))
    default: break
    }
  }

  /** A link scanned with the Camera app, waiting for the person to confirm. */
  var pending: PairingLink?
  var pendingRendezvous: Rendezvous?
  /** A new computer's Quick Start code, waiting for the owner. */
  var quickStart: QuickStart?
  /** A link opened in Safari inside the app. */
  var safari: URL?

  // MARK: Notifications

  func askForNotifications() async {
    UserDefaults.standard.set(true, forKey: "gurtos.notify-asked")
    notificationsAsked = true
    let ok = (try? await UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge, .timeSensitive])) ?? false
    notificationsOn = ok
    if ok { UIApplication.shared.registerForRemoteNotifications() }
  }

  func checkNotifications() async {
    let s = await UNUserNotificationCenter.current().notificationSettings()
    notificationsOn = s.authorizationStatus == .authorized
    if notificationsOn { UIApplication.shared.registerForRemoteNotifications() }
  }

  /** Give every paired machine this phone's push subscription, with a key made for that machine alone. */
  func subscribeAll() async {
    guard let token = deviceToken else { return }
    let keys = PushKeys.loadOrMake(keychain)
    #if DEBUG
    let sandbox = true
    #else
    let sandbox = false
    #endif
    let endpoint = apnsEndpoint(topic: Bundle.main.bundleIdentifier ?? "com.benzhou.gurtos", deviceToken: token, sandbox: sandbox)
    for var m in model.machines {
      let key = m.pushKey ?? Base64URL.encode(randomBytes(32))
      if m.pushKey == nil { m.pushKey = key; model.update(m) }
      // A computer that is off or out of reach is asked again at the next launch; nothing to say about it now.
      try? await BoxClient(machine: m).subscribe(endpoint: endpoint, p256dh: keys.p256dh, auth: keys.authString, key: key)
    }
  }
}

@MainActor
final class AppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {
  lazy var app = AppState()

  func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
    let c = UNUserNotificationCenter.current()
    c.delegate = self
    c.setNotificationCategories(NotificationCategories.all)
    Task { @MainActor in await app.checkNotifications() }
    return true
  }

  func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
    Task { @MainActor in
      app.deviceToken = deviceToken
      await app.subscribeAll()
    }
  }

  func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
    #if targetEnvironment(simulator) && DEBUG
    // A simulator signed to run locally gets no APNs token; a stand-in lets `simctl push` checks run end to end.
    Task { @MainActor in
      app.deviceToken = Data(repeating: 0, count: 32)
      await app.subscribeAll()
    }
    #endif
  }

  // In front, a request still shows as a banner: the list may be on another machine.
  func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification) async -> UNNotificationPresentationOptions {
    await app.model.refresh()
    return [.banner, .sound, .list]
  }

  func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse) async {
    let info = response.notification.request.content.userInfo["gurtos"] as? [String: Any] ?? [:]
    let boxId = info["machine"] as? String ?? ""
    let id = info["id"] as? String ?? ""
    switch response.actionIdentifier {
    case NotificationCategories.approve, NotificationCategories.deny:
      await answer(boxId: boxId, url: info["url"] as? String, id: id, approved: response.actionIdentifier == NotificationCategories.approve, info: info)
    default:
      let m = Machines().find(boxId: boxId, url: info["url"] as? String)
      await MainActor.run {
        // The request's id can hold any character an agent put in its key, so build the link from parts, never from text.
        var u = URLComponents()
        u.scheme = "gurtos"
        u.host = id.isEmpty ? "home" : "approval"
        if !id.isEmpty { u.path = "/" + id }
        if let m { u.queryItems = [URLQueryItem(name: "machine", value: m.id)] }
        if let link = u.url { app.open(url: link) }
      }
    }
  }

  /** Approve or Deny from the notification, on the machine that asked, then say what happened. */
  func answer(boxId: String, url: String?, id: String, approved: Bool, info: [String: Any]) async {
    // Only requests with no money, no Business route and no passkey get Approve here (NotificationCategories.for).
    guard let m = Machines().find(boxId: boxId, url: url) else { return await note("This phone is not paired with that computer any more.", info) }
    if approved, NotificationCategories.for(fields: info, machine: m) != NotificationCategories.request { return await note("Open GurtOS to approve this one with Face ID.", info) }
    do {
      let out = try await BoxClient(machine: m).answer(id, approved: approved, auth: .none)
      if out.state != (approved ? "approved" : "denied") { await note("Already \(out.state)\(out.by.map { " on \($0)" } ?? "")", info) }
    } catch let e as BoxError {
      await note(e.unpaired ? "This phone is not paired with \(m.name) any more. Your answer did not go through." : "Not answered: \(e.message)", info)
    } catch {
      await note("\(m.name) is out of reach. Your answer did not go through.", info)
    }
    await app.model.refresh()
  }

  func note(_ title: String, _ info: [String: Any]) async {
    let c = UNMutableNotificationContent()
    c.title = title
    c.body = [info["box"] as? String, info["title"] as? String].compactMap { $0 }.joined(separator: ": ")
    try? await UNUserNotificationCenter.current().add(UNNotificationRequest(identifier: (info["id"] as? String ?? UUID().uuidString) + ".answer", content: c, trigger: nil))
  }
}

struct RootView: View {
  @Environment(AppState.self) var app

  var body: some View {
    @Bindable var app = app
    Group {
      if app.model.machines.isEmpty || ProcessInfo.processInfo.environment["GURTOS_PAIRSTART"] != nil { // the flag: debug screenshots only
        PairStart()
      } else {
        TabView(selection: $app.tab) {
          Tab(app.model.current?.isBusiness == true ? "Waiting" : "Home", systemImage: app.model.current?.isBusiness == true ? "clock" : "house", value: AppTab.home) { HomeView() }
            .badge(app.model.waiting.count)
          Tab("Tasks", systemImage: "list.bullet.rectangle", value: AppTab.tasks) { TasksView() }
          Tab("Activity", systemImage: "waveform.path.ecg", value: AppTab.activity) { ActivityView() }
          Tab("Settings", systemImage: "gearshape", value: AppTab.settings) { SettingsView() }
        }
      }
    }
    .sheet(isPresented: $app.showMachines) { MachinesSheet() }
    .sheet(isPresented: $app.showPair) { PairSheet(link: app.pending, rendezvous: app.pendingRendezvous) }
    .sheet(item: $app.safari) { SafariView(url: $0).ignoresSafeArea() }
    .sheet(item: $app.quickStart) { QuickStartSheet(q: $0) }
    .task { app.model.start() }
  }
}
