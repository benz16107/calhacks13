// Approve and Deny, the same on the iPhone and the Mac: anything that spends money asks for Face ID or Touch ID
// first, and says which check it used, so the box can log it. Shopper purchases need the box's own passkey
// ceremony, so they open the box's approve page instead.
import GurtKit
import LocalAuthentication
import SwiftUI

@MainActor
enum Check {
  /** Money moves, so this device checks it is you first. */
  static func needed(_ a: Approval) -> Bool { a.amountCents > 0 }

  /** Shopper's Face ID is a passkey on the box's own address: the box refuses a plain approve at payment. */
  static func passkey(_ a: Approval, model: BoxModel) -> Bool { model.task(a.task)?.source?.hasPrefix("shopper:") == true }

  /** Face ID or Touch ID, with the device passcode as the fallback. Throws when it was cancelled or failed. */
  static func run(_ reason: String) async throws -> AnswerAuth {
    let c = LAContext()
    var err: NSError?
    if c.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &err) {
      do {
        try await c.evaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, localizedReason: reason)
        return c.biometryType == .touchID ? .touchID : .faceID
      } catch let e as LAError where e.code == .userFallback || e.code == .biometryLockout {}
    }
    try await LAContext().evaluatePolicy(.deviceOwnerAuthentication, localizedReason: reason)
    return .passcode
  }

  static func reason(_ a: Approval) -> String {
    "Approve \(Money.dollars(a.amountCents))\(a.payee.map { " to \($0)" } ?? "")"
  }
}

/** One request's Approve and Deny, with the state of an answer in flight and its outcome. */
@MainActor @Observable
final class Answering {
  var busy: String?
  var message: String?
  var passkeyURL: URL?

  func answer(_ a: Approval, approved: Bool, model: BoxModel) async {
    guard busy == nil else { return }
    if approved, Check.passkey(a, model: model), let m = model.current {
      passkeyURL = URL(string: "\(m.url)/t/shopper/approve?approval=\(a.id.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? a.id)&access_token=\(m.token)")
      return
    }
    busy = a.id
    defer { busy = nil }
    do {
      let auth: AnswerAuth = approved && Check.needed(a) ? try await Check.run(Check.reason(a)) : .none
      let out = try await model.answer(a, approved: approved, auth: auth)
      if out.state != (approved ? "approved" : "denied") { message = "Already \(out.state)\(out.by.map { " on \($0)" } ?? "")." }
    } catch let e as LAError where e.code == .userCancel || e.code == .appCancel || e.code == .systemCancel {
      // Cancelled: nothing was sent.
    } catch let e as BoxError {
      message = e.unpaired ? "This device is not paired with \(model.current?.name ?? "the computer") any more." : e.status == 0 ? "\(e.message) Your answer did not go through." : "Not answered: \(e.message)"
    } catch {
      message = model.live == .offline ? "\(model.current?.name ?? "The computer") is out of reach. Your answer did not go through." : "Not answered: \(error.localizedDescription)"
    }
  }
}

/** Deny and Approve, side by side, Approve the prominent one (Figma 3b). */
struct AnswerButtons: View {
  var approval: Approval
  var model: BoxModel
  var answering: Answering
  var large = false
  @Environment(\.dynamicTypeSize) var typeSize

  var body: some View {
    let a = approval
    let done = model.answered[a.id]
    // At the largest text sizes two buttons side by side clip their words, so they stack.
    let layout = typeSize.isAccessibilitySize ? AnyLayout(VStackLayout(spacing: 10)) : AnyLayout(HStackLayout(spacing: 10))
    layout {
      if let done {
        Label(done ? "Approved" : "Denied", systemImage: done ? "checkmark.circle.fill" : "xmark.circle.fill")
          .font(.g(.subheadline, .semibold))
          .foregroundStyle(done ? Color.gSuccess : Color.gDestructiveFg)
          .frame(maxWidth: .infinity, minHeight: 44)
      } else {
        Button { Task { await answering.answer(a, approved: false, model: model) } } label: {
          Text("Deny").frame(maxWidth: .infinity, minHeight: large ? 34 : 22)
        }
        .buttonStyle(large ? AnyPrimitiveButtonStyle(.glass) : AnyPrimitiveButtonStyle(.bordered))
        .accessibilityHint("Denies this request")
        Button { Task { await answering.answer(a, approved: true, model: model) } } label: {
          Label(approveTitle, systemImage: Check.needed(a) ? "faceid" : "checkmark")
            .labelStyle(.titleOnly)
            .frame(maxWidth: .infinity, minHeight: large ? 34 : 22)
        }
        .buttonStyle(large ? AnyPrimitiveButtonStyle(.glassProminent) : AnyPrimitiveButtonStyle(.borderedProminent))
        .accessibilityHint(Check.needed(a) ? "Asks for Face ID, then approves" : "Approves this request")
      }
    }
    .controlSize(large ? .large : .regular)
    .font(.g(.subheadline, .semibold))
    .disabled(answering.busy == a.id || model.live == .offline || !model.mayAnswer)
    .buttonBorderShape(.capsule)
  }

  var approveTitle: String {
    if Check.passkey(approval, model: model) { return "Approve with Face ID" }
    return approval.amountCents > 0 ? "Approve \(Money.dollars(approval.amountCents))" : "Approve"
  }
}

/** Glass buttons where they float over content (the request page), plain bordered ones inside a list row. */
struct AnyPrimitiveButtonStyle: PrimitiveButtonStyle {
  let make: (Configuration) -> AnyView
  init<S: PrimitiveButtonStyle>(_ s: S) { make = { AnyView(Button($0).buttonStyle(s)) } }
  func makeBody(configuration: Configuration) -> some View { make(configuration) }
}
