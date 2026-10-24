// Send to GurtOS: the Mac's Share menu sends the chosen files, text or link to a new task on a paired computer,
// through its API with this Mac's token. The box puts files in a new workspace of their own and keeps its usual
// limits on the task.
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
  @State var files: [(name: String, data: Data)] = []
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

  /** Files (up to 8, 5 MB in all, the box's limits), or text and links (at most 20,000 characters). */
  func load() async {
    var parts: [String] = []
    var total = 0
    for p in providers {
      if p.hasItemConformingToTypeIdentifier(UTType.fileURL.identifier) {
        let item = try? await p.loadItem(forTypeIdentifier: UTType.fileURL.identifier)
        guard let url = (item as? URL) ?? (item as? Data).flatMap({ URL(dataRepresentation: $0, relativeTo: nil) }), let d = try? Data(contentsOf: url) else { continue }
        total += d.count
        files.append((url.lastPathComponent, d))
      } else if let u = try? await p.loadItem(forTypeIdentifier: UTType.url.identifier) as? URL { parts.append(u.absoluteString) }
      else if let t = try? await p.loadItem(forTypeIdentifier: UTType.plainText.identifier) as? String { parts.append(t) }
    }
    if files.count > 8 { error = "GurtOS takes up to 8 files at a time."; files = [] }
    if total > 5 * 1024 * 1024 { error = "That's more than 5 MB. Send fewer or smaller files."; files = [] }
    let text = String(parts.joined(separator: "\n\n").prefix(20_000))
    shared = files.isEmpty ? text : files.map(\.name).joined(separator: ", ")
    if shared.isEmpty && error == nil { error = "Nothing to send." }
    if !text.isEmpty, !files.isEmpty { shared += "\n" + text }
  }

  func send() {
    guard let m = machines.first(where: { $0.id == machine }) else { return }
    busy = true
    Task {
      do {
        let prompt = files.isEmpty ? "\(ask)\n\nShared from my Mac:\n\(shared)" : "\(ask)\n\nThe files are in this task's folder: \(files.map(\.name).joined(separator: ", "))."
        _ = try await BoxClient(machine: m).newTask(title: String(ask.prefix(80)), prompt: prompt, files: files)
        done()
      } catch {
        self.error = (error as? BoxError)?.message ?? error.localizedDescription
        busy = false
      }
    }
  }
}
