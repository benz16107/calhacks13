// Pairing (Figma 1b and 4e): scan the QR code on the computer's screen, or type its code, then confirm.
import GurtKit
import SwiftUI
import VisionKit

/** The first screen, before any machine is paired. */
struct PairStart: View {
  @Environment(AppState.self) var app

  var body: some View {
    VStack(spacing: 18) {
      Spacer()
      Image(systemName: "list.bullet")
        .font(.system(size: 40, weight: .bold)).foregroundStyle(Color.gGlyph)
        .frame(width: 84, height: 84)
        .background(Color.gTile, in: RoundedRectangle(cornerRadius: 22, style: .continuous))
        .accessibilityHidden(true)
      Text("Pair with your computer").font(.g(.title, .bold)).multilineTextAlignment(.center)
      Text("GurtOS shows what your agents are doing and asks you before they spend or change anything. Pair it with your GurtOS computer to start.")
        .font(.g(.body)).foregroundStyle(Color.gSecondary).multilineTextAlignment(.center)
      WhereIsTheCode()
      Spacer()
      Button { app.pending = nil; app.showPair = true } label: {
        Text("Scan the QR code").font(.g(.headline)).frame(maxWidth: .infinity, minHeight: 36)
      }
      .buttonStyle(.glassProminent)
      .controlSize(.large)
    }
    .padding(24)
    .background(Color.gWindow)
  }
}

struct WhereIsTheCode: View {
  var body: some View {
    VStack(alignment: .leading, spacing: 6) {
      Label("GurtOS Server: Settings, Devices, Pair a phone", systemImage: "server.rack")
      Label("GurtOS Personal: GurtOS Settings, Phone", systemImage: "laptopcomputer")
      Label("GurtOS Business: an admin makes a code for you", systemImage: "building.2")
    }
    .font(.g(.footnote)).foregroundStyle(Color.gSecondary)
    .frame(maxWidth: .infinity, alignment: .leading)
    .padding(14)
    .background(Color.gCard, in: RoundedRectangle(cornerRadius: 15, style: .continuous))
  }
}

/** Add a computer: the scanner, then the confirmation with this phone's name. */
struct PairSheet: View {
  @Environment(AppState.self) var app
  @Environment(\.dismiss) var dismiss
  @State var link: PairingLink?
  @State var typing = false
  @State var address = ""
  @State var code = ""
  @State var name = UIDevice.current.name
  @State var busy = false
  @State var error: String?

  init(link: PairingLink?) { _link = State(initialValue: link) }

  var body: some View {
    NavigationStack {
      Group {
        if let link { confirm(link) } else if typing { typed } else { scanner }
      }
      .navigationTitle(link == nil ? "Add a computer" : "Pair")
      .navigationBarTitleDisplayMode(.inline)
      .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } } }
    }
  }

  var scanner: some View {
    VStack(spacing: 0) {
      if DataScannerViewController.isSupported && DataScannerViewController.isAvailable {
        QRScanner { text in
          if let l = PairingLink.parse(text) { link = l } else { error = "That QR code isn't a GurtOS pairing code." }
        }
        .ignoresSafeArea(edges: .horizontal)
      } else {
        ContentUnavailableView("The camera isn't available", systemImage: "camera", description: Text("Type the code from the computer's screen instead."))
      }
      VStack(alignment: .leading, spacing: 10) {
        Text("Point the camera at the QR code on the computer's screen").font(.g(.headline))
        WhereIsTheCode()
        Button { typing = true } label: { Text("Type the code instead").frame(maxWidth: .infinity, minHeight: 30) }
          .buttonStyle(.bordered).buttonBorderShape(.capsule)
        if let error { Text(error).font(.g(.footnote)).foregroundStyle(Color.gDestructiveFg) }
      }
      .padding()
      .background(Color.gWindow)
    }
  }

  var typed: some View {
    Form {
      Section {
        TextField("rosa.box.gurtos.com or 192.168.1.20", text: $address)
          .textContentType(.URL).keyboardType(.URL).textInputAutocapitalization(.never).autocorrectionDisabled()
        TextField("Code", text: $code).textInputAutocapitalization(.never).autocorrectionDisabled().font(.g(.title3).monospaced())
      } header: { Text("The computer's address and code") } footer: { Text("Both are under the QR code on the computer's screen.") }
      Button("Next") {
        if let l = PairingLink.typed(address: address, code: code) { link = l } else { error = "Check the address and the code." }
      }
      .disabled(address.isEmpty || code.isEmpty)
      if let error { Text(error).foregroundStyle(Color.gDestructiveFg) }
    }
    .font(.g(.body))
  }

  func confirm(_ l: PairingLink) -> some View {
    Form {
      Section {
        VStack(spacing: 10) {
          Image(systemName: "server.rack").font(.system(size: 28, weight: .semibold)).foregroundStyle(Color.gGlyph)
            .frame(width: 60, height: 60).background(Color.gTile, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
          Text("Pair with \(l.box.host ?? "this computer")?").font(.g(.title2, .bold)).multilineTextAlignment(.center)
          Text("Check that this code is the one on the computer's screen.").font(.g(.subheadline)).foregroundStyle(Color.gSecondary).multilineTextAlignment(.center)
          Text(l.code.uppercased()).font(.g(.title, .bold).monospaced()).padding(.top, 4)
            .accessibilityLabel("Code \(l.code.map(String.init).joined(separator: " "))")
        }
        .frame(maxWidth: .infinity)
        .listRowBackground(Color.clear)
      }
      Section {
        TextField("Name this phone", text: $name)
      } header: { Text("Name this phone") } footer: {
        Text("A paired phone can approve, deny and undo. It never holds a key. Revoke it any time in the computer's Settings, Devices.")
      }
      Section {
        Button {
          busy = true
          Task {
            do {
              try await app.model.pair(l, name: name.isEmpty ? "iPhone" : name)
              await app.subscribeAll()
              dismiss()
            } catch {
              self.error = (error as? BoxError)?.message ?? "Couldn't reach \(l.box.host ?? "the computer"). Is it on, and on this network?"
            }
            busy = false
          }
        } label: {
          HStack { Spacer(); if busy { ProgressView() } else { Text("Pair").font(.g(.headline)) }; Spacer() }
        }
        .disabled(busy)
        if let error { Text(error).foregroundStyle(Color.gDestructiveFg) }
      }
    }
    .font(.g(.body))
  }
}

/** VisionKit's live scanner, for QR codes only. */
struct QRScanner: UIViewControllerRepresentable {
  var found: (String) -> Void

  func makeUIViewController(context: Context) -> DataScannerViewController {
    let v = DataScannerViewController(recognizedDataTypes: [.barcode(symbologies: [.qr])], qualityLevel: .balanced, isHighlightingEnabled: true)
    v.delegate = context.coordinator
    try? v.startScanning()
    return v
  }

  func updateUIViewController(_ v: DataScannerViewController, context: Context) {}
  func makeCoordinator() -> Coordinator { Coordinator(found: found) }

  final class Coordinator: NSObject, DataScannerViewControllerDelegate {
    var found: (String) -> Void
    var done = false
    init(found: @escaping (String) -> Void) { self.found = found }

    func dataScanner(_ s: DataScannerViewController, didAdd items: [RecognizedItem], allItems: [RecognizedItem]) {
      for case .barcode(let b) in items { if let v = b.payloadStringValue, !done { done = PairingLink.parse(v) != nil; found(v) } }
    }
  }
}
