#if DEBUG
// Screenshots without screen recording (an ssh session can't capture the screen): `GurtOS --render-shots`
// renders the Ask and Pair windows, and the menu drawn from the same model, to PNGs in the app's tmp folder.
import GurtKit
import SwiftUI

@MainActor
enum RenderShots {
  static func runIfAsked(_ model: BoxModel) {
    let args = CommandLine.arguments
    guard args.contains("--render-shots") else { return }
    // The app is sandboxed: the PNGs go to its container's tmp folder, which is printed.
    let dir = FileManager.default.temporaryDirectory.appending(path: "gurtos-shots")
    try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
    print(dir.path)
    Task {
      for _ in 0..<40 where model.tasks.isEmpty { try? await Task.sleep(nanoseconds: 250_000_000) }
      for dark in [false, true] {
        let look = dark ? "dark" : "light"
        save(MenuPicture().environment(model), "mac-menu-\(look)", dark: dark, dir: dir)
        save(AskView().environment(model).background(.background), "mac-ask-\(look)", dark: dark, dir: dir)
        save(MacPairView().environment(model).background(.background), "mac-pair-\(look)", dark: dark, dir: dir)
      }
      NSApp.terminate(nil)
    }
  }

  static func save<V: View>(_ v: V, _ name: String, dark: Bool, dir: URL) {
    let host = NSHostingView(rootView: v.environment(\.colorScheme, dark ? .dark : .light))
    host.appearance = NSAppearance(named: dark ? .darkAqua : .aqua)
    host.frame.size = host.fittingSize
    let w = NSWindow(contentRect: host.frame, styleMask: [.borderless], backing: .buffered, defer: false)
    w.contentView = host
    host.layoutSubtreeIfNeeded()
    guard let rep = host.bitmapImageRepForCachingDisplay(in: host.bounds) else { return }
    host.cacheDisplay(in: host.bounds, to: rep)
    try? rep.representation(using: .png, properties: [:])?.write(to: dir.appending(path: "\(name).png"))
  }
}

/** The menu bar extra's menu, drawn as macOS draws it, from the same model. */
struct MenuPicture: View {
  @Environment(BoxModel.self) var model

  var body: some View {
    let m = model.current
    VStack(alignment: .leading, spacing: 0) {
      HStack(spacing: 6) {
        Spacer()
        Label("\(model.waiting.count)", systemImage: "hand.raised.fill").font(.system(size: 13, weight: .medium))
          .padding(.horizontal, 8).padding(.vertical, 3).background(.quaternary, in: RoundedRectangle(cornerRadius: 5))
        Text("9:41").font(.system(size: 13, weight: .medium))
      }
      .padding(.horizontal, 10).frame(height: 26).background(.bar)
      VStack(alignment: .leading, spacing: 0) {
        row(status(m), dim: true)
        divider
        row(m?.isBusiness == true ? "Waiting for me" : "Needs you", dim: true, small: true)
        ForEach(model.waiting) { a in row(title(a), chevron: true) }
        let running = model.tasks.filter(\.isRunning)
        if !running.isEmpty {
          row("Running", dim: true, small: true)
          ForEach(running.prefix(4)) { t in row(t.title, dim: true) }
        }
        divider
        row("Ask \(m?.name ?? "")…", shortcut: "⌥⌘G")
        row("Computers", chevron: true)
        if model.mayPause { row(model.paused.paused ? "Resume all agents" : "Pause all agents") }
        divider
        row("Settings…", shortcut: "⌘,")
        row("Quit GurtOS", shortcut: "⌘Q")
      }
      .padding(5)
      .frame(width: 330)
      .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 10))
      .overlay(RoundedRectangle(cornerRadius: 10).strokeBorder(.separator))
      .padding(.leading, 60).padding(.trailing, 8).padding(.bottom, 12)
    }
    .frame(width: 420)
    .background(Color(nsColor: .windowBackgroundColor))
  }

  var divider: some View { Divider().padding(.vertical, 5).padding(.horizontal, 9) }

  func row(_ t: String, dim: Bool = false, small: Bool = false, chevron: Bool = false, shortcut: String? = nil) -> some View {
    HStack {
      Text(t).font(.system(size: small ? 11 : 13, weight: small ? .semibold : .regular)).foregroundStyle(dim ? .secondary : .primary).lineLimit(1)
      Spacer()
      if let shortcut { Text(shortcut).font(.system(size: 13)).foregroundStyle(.secondary) }
      if chevron { Image(systemName: "chevron.right").font(.system(size: 11, weight: .semibold)).foregroundStyle(.secondary) }
    }
    .padding(.horizontal, 9).frame(height: small ? 20 : 22)
  }

  func status(_ m: Machine?) -> String {
    [m?.name ?? "", model.paused.paused ? "Paused" : "\(model.tasks.filter(\.isRunning).count) running"].joined(separator: " · ")
  }

  func title(_ a: Approval) -> String {
    let t = model.task(a.task)?.title ?? "A request"
    return a.amountCents > 0 ? "\(t) · \(Money.dollars(a.amountCents))" : t
  }
}
#endif
