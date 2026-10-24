// Send to GurtOS: the Mac's Share menu sends the chosen files to a new task on a paired machine, through its API
// with this Mac's token. The machine puts them in a workspace of their own and keeps its usual limits on the task.
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
  @State var files: [(name: String, data: Data)] = []
  @State var error: String?
  @State var busy = false

  var body: some View {
    VStack(alignment: .leading, spacing: 12) {
      Text("Send to GurtOS").font(.headline)
      if machines.isEmpty { Text("Pair this Mac with a computer first: GurtOS in the menu bar, Add a computer.").foregroundStyle(.secondary) }
      else {
        Picker("Computer", selection: $machine) { ForEach(machines) { Text($0.name).tag($0.id) } }
        Text(files.isEmpty ? "Reading the files…" : files.map(\.name).joined(separator: ", ")).font(.callout).foregroundStyle(.secondary).lineLimit(2)
        TextField("What should it do with \(files.count == 1 ? "it" : "them")?", text: $ask, axis: .vertical).lineLimit(2...5)
      }
      if let error { Text(error).foregroundStyle(.red).font(.callout) }
      HStack {
        Spacer()
        Button("Cancel", action: cancel).keyboardShortcut(.cancelAction)
        Button("Send", action: send).keyboardShortcut(.defaultAction).disabled(machines.isEmpty || files.isEmpty || ask.isEmpty || busy)
      }
    }
    .padding(16)
    .frame(width: 380)
    .task {
      machine = machines.first?.id ?? ""
      await load()
    }
  }

  func load() async {
    var out: [(String, Data)] = []
    var total = 0
    for p in providers.prefix(8) {
      let item = try? await p.loadItem(forTypeIdentifier: UTType.fileURL.identifier)
      guard let url = (item as? URL) ?? (item as? Data).flatMap({ URL(dataRepresentation: $0, relativeTo: nil) }), let d = try? Data(contentsOf: url) else { continue }
      total += d.count
      out.append((url.lastPathComponent, d))
    }
    if providers.count > 8 { error = "GurtOS takes up to 8 files at a time." }
    if total > 5 * 1024 * 1024 { error = "That's more than 5 MB. Send fewer or smaller files."; out = [] }
    files = out
  }

  func send() {
    guard let m = machines.first(where: { $0.id == machine }) else { return }
    busy = true
    Task {
      do {
        _ = try await BoxClient(machine: m).newTask(title: String(ask.prefix(80)), prompt: "\(ask)\n\nThe files are in this task's folder: \(files.map(\.name).joined(separator: ", ")).", files: files)
        done()
      } catch {
        self.error = (error as? BoxError)?.message ?? error.localizedDescription
        busy = false
      }
    }
  }
}
