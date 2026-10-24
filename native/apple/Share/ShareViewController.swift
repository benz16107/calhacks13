// Send to GurtOS: the Mac's Share menu sends the chosen text or link to a new task on a paired computer, through its
// API with this Mac's token. Files wait for the box to take them (core: after Sunday, into the task's own layer).
import AppKit
import GurtKit
import SwiftUI
import UniformTypeIdentifiers

final class ShareViewController: NSViewController {
  override func loadView() {
    let items = (extensionContext?.inputItems as? [NSExtensionItem] ?? []).flatMap { $0.attachments ?? [] }
    view = NSHostingView(rootView: ShareForm(providers: items, done: { [weak self] in self?.extensionContext?.completeRequest(returningItems: nil) },
                                             cancel: { [weak self] in self?.extensionContext?.cancelRequest(withError: NSError(domain: NSCocoaErrorDomain, code: NSUserCancelledError)) }))
  }
}

struct ShareForm: View {
  var providers: [NSItemProvider]
  var done: () -> Void
  var cancel: () -> Void
  let machines = Machines().load()
  @State var machine = ""
  @State var ask = ""
  @State var shared = ""
  @State var error: String?
  @State var busy = false

  var body: some View {
    VStack(alignment: .leading, spacing: 12) {
      Text("Send to GurtOS").font(.headline)
      if machines.isEmpty { Text("Pair this Mac with a computer first: GurtOS in the menu bar, Add a computer.").foregroundStyle(.secondary) }
      else {
        Picker("Computer", selection: $machine) { ForEach(machines) { Text($0.name).tag($0.id) } }
        Text(shared.isEmpty ? "Reading what you shared…" : shared).font(.callout).foregroundStyle(.secondary).lineLimit(3)
        TextField("What should it do with it?", text: $ask, axis: .vertical).lineLimit(2...5)
      }
      if let error { Text(error).foregroundStyle(.red).font(.callout) }
      HStack {
        Spacer()
        Button("Cancel", action: cancel).keyboardShortcut(.cancelAction)
        Button("Send", action: send).keyboardShortcut(.defaultAction).disabled(machines.isEmpty || shared.isEmpty || ask.isEmpty || busy)
      }
    }
    .padding(16)
    .frame(width: 380)
    .task {
      machine = machines.first?.id ?? ""
      await load()
    }
  }

  /** Links and text only, at most 20,000 characters. */
  func load() async {
    var parts: [String] = []
    for p in providers {
      if let u = try? await p.loadItem(forTypeIdentifier: UTType.url.identifier) as? URL { parts.append(u.absoluteString) }
      else if let t = try? await p.loadItem(forTypeIdentifier: UTType.plainText.identifier) as? String { parts.append(t) }
    }
    shared = String(parts.joined(separator: "\n\n").prefix(20_000))
    if shared.isEmpty { error = "GurtOS takes text and links for now." }
  }

  func send() {
    guard let m = machines.first(where: { $0.id == machine }) else { return }
    busy = true
    Task {
      do {
        _ = try await BoxClient(machine: m).newTask(title: String(ask.prefix(80)), prompt: "\(ask)\n\nShared from my Mac:\n\(shared)")
        done()
      } catch {
        self.error = (error as? BoxError)?.message ?? error.localizedDescription
        busy = false
      }
    }
  }
}
