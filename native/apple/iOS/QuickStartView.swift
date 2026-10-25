// Quick Start on the iPhone: send a new computer the setup of one you own (core/quickstart.ts). You see exactly what
// leaves and approve it with Face ID; the new computer then seals its owner pairing code to this phone.
import CryptoKit
import GurtKit
import LocalAuthentication
import SwiftUI

extension QuickStart: @retroactive Identifiable { public var id: String { rv } }

struct QuickStartSheet: View {
  @Environment(AppState.self) var app
  @Environment(\.dismiss) var dismiss
  var q: QuickStart
  enum Stage { case pick, review, waiting }
  @State var stage = Stage.pick
  @State var source = ""
  @State var offer: QuickOffer?
  @State var chosen: Set<String> = []
  /** One-time: the new computer seals the pairing code to it, and it is never stored. */
  @State var key = Curve25519.KeyAgreement.PrivateKey()
  @State var busy = false
  @State var error: String?

  var from: Machine? { app.model.machines.first { $0.id == source } }

  var body: some View {
    NavigationStack {
      Form {
        Section {
          VStack(spacing: 8) {
            Image(systemName: "sparkles.rectangle.stack").font(.system(size: 28, weight: .semibold)).foregroundStyle(Color.gGlyph)
              .frame(width: 60, height: 60).background(Color.gTile, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
              .accessibilityHidden(true)
            Text("Set up \(q.name)").font(.g(.title2, .bold)).multilineTextAlignment(.center)
            Text("A computer you own sends its model keys, apps and spending rules. You approve exactly what leaves.")
              .font(.g(.subheadline)).foregroundStyle(Color.gSecondary).multilineTextAlignment(.center)
          }
          .frame(maxWidth: .infinity)
          .listRowBackground(Color.clear)
        }
        switch stage {
        case .pick: pick
        case .review: review
        case .waiting:
          Section {
            HStack(spacing: 12) { ProgressView(); Text("Sent. \(q.name) is setting itself up…").font(.g(.subheadline)) }
          } footer: { Text("This phone pairs with \(q.name) as its owner when it's ready.") }
        }
        if let error { Section { Text(error).foregroundStyle(Color.gDestructiveFg) } }
      }
      .font(.g(.body))
      .navigationTitle("Quick Start")
      .navigationBarTitleDisplayMode(.inline)
      .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } } }
      .onAppear { if source.isEmpty { source = app.model.current?.id ?? app.model.machines.first?.id ?? "" } }
    }
  }

  @ViewBuilder var pick: some View {
    if app.model.machines.isEmpty {
      Section { Text("Pair this phone with a GurtOS computer you own first. Its setup is what Quick Start sends.") }
    } else {
      Section("Send from") {
        Picker("Computer", selection: $source) { ForEach(app.model.machines) { Text($0.name).tag($0.id) } }
      }
      Section {
        Button { start() } label: { HStack { Spacer(); if busy { ProgressView() } else { Text("Continue").font(.g(.headline)) }; Spacer() } }
          .disabled(busy || from == nil)
      }
    }
  }

  @ViewBuilder var review: some View {
    if let offer {
      Section {
        Text(offer.question)
        VStack(alignment: .leading, spacing: 4) {
          Text("Check phrase").font(.g(.footnote, .semibold)).foregroundStyle(Color.gSecondary)
          Text(offer.phrase).font(.g(.title3, .bold).monospaced())
        }
      } footer: { Text("\(q.name) shows four words too. Approve only if they match.") }
      Section {
        Button { answer(true) } label: { HStack { Spacer(); if busy { ProgressView() } else { Label("Approve with Face ID", systemImage: "faceid").font(.g(.headline)) }; Spacer() } }
          .disabled(busy)
        Button("Don't send", role: .destructive) { answer(false) }.disabled(busy)
      }
      if !offer.keys.isEmpty {
        Section("Keys it sends (change before you approve)") {
          ForEach(offer.keys, id: \.name) { k in
            Toggle(Self.label(k.name), isOn: Binding(get: { chosen.contains(k.name) }, set: { on in
              if on { chosen.insert(k.name) } else { chosen.remove(k.name) }
              ask(keys: Array(chosen)) // the question names exactly these keys, so a change asks again
            }))
            .disabled(busy)
          }
        }
      }
    }
  }

  static func label(_ k: String) -> String { k == "ANTHROPIC_API_KEY" ? "Anthropic key" : k == "FACTORY_API_KEY" ? "Factory key" : k }

  func start() { ask(keys: nil) }

  /** A fresh question for these keys (nil: the computer's model keys). Only the latest one is ever answered. */
  func ask(keys: [String]?) {
    guard let m = from else { return }
    busy = true
    error = nil
    Task {
      do {
        let o = try await BoxClient(machine: m).quickstartSend(q, phonePk: Base64URL.encode(key.publicKey.rawRepresentation), keys: keys)
        offer = o
        chosen = Set(o.keys.filter(\.chosen).map(\.name))
        stage = .review
      } catch let e as BoxError where e.status == 403 {
        error = "This phone isn't paired with \(m.name) as its owner, so it can't send its setup."
      } catch { self.error = (error as? BoxError)?.message ?? "Couldn't reach \(m.name)." }
      busy = false
    }
  }

  func answer(_ approve: Bool) {
    guard let m = from, let offer else { return }
    busy = true
    error = nil
    Task {
      defer { busy = false }
      do {
        if approve { _ = try await Check.run("Send your setup to \(q.name)") }
        try await BoxClient(machine: m).quickstartAnswer(offer.id, approve: approve)
        guard approve else { return dismiss() }
        stage = .waiting
        let link = try await q.waitForOwnerCode(key)
        try await app.model.pair(link, name: UIDevice.current.name)
        await app.subscribeAll()
        dismiss()
      } catch let e as BoxError where e.status == 409 {
        error = "\(q.name) stopped Quick Start. Start it again on its screen."
      } catch let e as LAError where e.code == .userCancel || e.code == .appCancel || e.code == .systemCancel {
        // Cancelled Face ID: nothing was sent.
      } catch { self.error = (error as? BoxError)?.message ?? error.localizedDescription }
    }
  }
}
