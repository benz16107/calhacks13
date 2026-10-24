// GurtOS's identity on Apple platforms: the system's controls and Liquid Glass chrome, with GurtOS's colours
// (portal/src/kit/kit.css tokens) and its typeface, Atkinson Hyperlegible Next, which scales with Dynamic Type.
import GurtKit
import SwiftUI

extension Color {
  init(light: UInt32, dark: UInt32) {
    #if os(macOS)
    self.init(nsColor: NSColor(name: nil) { $0.bestMatch(from: [.darkAqua, .aqua]) == .darkAqua ? NSColor(hex: dark) : NSColor(hex: light) })
    #elseif os(watchOS)
    self.init(hex: dark)
    #else
    self.init(uiColor: UIColor { $0.userInterfaceStyle == .dark ? UIColor(hex: dark) : UIColor(hex: light) })
    #endif
  }

  init(hex: UInt32) {
    self.init(red: Double((hex >> 16) & 0xff) / 255, green: Double((hex >> 8) & 0xff) / 255, blue: Double(hex & 0xff) / 255)
  }

  static let gAccent = Color(light: 0x2f64a6, dark: 0x78a9e6)
  static let gAccentOn = Color(light: 0xffffff, dark: 0x0f1b2a)
  static let gWindow = Color(light: 0xf6f5f2, dark: 0x1e2228)
  static let gCard = Color(light: 0xfefdfb, dark: 0x2c3139)
  static let gSecondary = Color(light: 0x565c64, dark: 0xaeb4bc)
  static let gAttention = Color(light: 0xf2b544, dark: 0xf2b544)
  static let gAttentionOn = Color(light: 0x1a1206, dark: 0x1a1206)
  static let gAttentionFg = Color(light: 0x7e5200, dark: 0xf2c46a)
  static let gSuccess = Color(light: 0x2e6b3a, dark: 0x7cc48a)
  static let gDestructive = Color(light: 0xb3392b, dark: 0xe06a5b)
  static let gDestructiveFg = Color(light: 0xa3322a, dark: 0xf08a7d)
  static let gTile = Color(hex: 0x2f64a6)
  static let gGlyph = Color(hex: 0xf7f3ea)
}

#if os(macOS)
extension NSColor {
  convenience init(hex: UInt32) {
    self.init(srgbRed: CGFloat((hex >> 16) & 0xff) / 255, green: CGFloat((hex >> 8) & 0xff) / 255, blue: CGFloat(hex & 0xff) / 255, alpha: 1)
  }
}
#elseif os(iOS)
extension UIColor {
  convenience init(hex: UInt32) {
    self.init(red: CGFloat((hex >> 16) & 0xff) / 255, green: CGFloat((hex >> 8) & 0xff) / 255, blue: CGFloat(hex & 0xff) / 255, alpha: 1)
  }
}
#endif

extension Font {
  /** Atkinson Hyperlegible Next at a text style's size, scaling with Dynamic Type like the system font. */
  static func g(_ style: Font.TextStyle, _ weight: Font.Weight = .regular) -> Font {
    let size: CGFloat = switch style {
    case .largeTitle: 34
    case .title: 28
    case .title2: 22
    case .title3: 20
    case .headline: 17
    case .subheadline: 15
    case .callout: 16
    case .footnote: 13
    case .caption: 12
    case .caption2: 11
    default: 17
    }
    return .custom("Atkinson Hyperlegible Next", size: size, relativeTo: style).weight(style == .headline && weight == .regular ? .semibold : weight)
  }
}

/** The machine's tile: the edition's glyph, or the company's initials on Business. */
struct MachineTile: View {
  var machine: Machine?
  var size: CGFloat = 28

  var body: some View {
    RoundedRectangle(cornerRadius: size * 0.27, style: .continuous)
      .fill(Color.gTile)
      .frame(width: size, height: size)
      .overlay {
        if machine?.isBusiness == true {
          Text(initials).font(.system(size: size * 0.4, weight: .bold)).foregroundStyle(Color.gGlyph)
        } else {
          Image(systemName: machine?.isPersonal == true ? "laptopcomputer" : "server.rack")
            .font(.system(size: size * 0.48, weight: .semibold)).foregroundStyle(Color.gGlyph)
        }
      }
      .accessibilityHidden(true)
  }

  var initials: String {
    (machine?.name ?? "").split(separator: " ").prefix(2).compactMap(\.first).map(String.init).joined().uppercased()
  }
}

/** The amount on a request, in GurtOS's attention colour (Figma 2a). */
struct AmountBadge: View {
  var text: String
  var fraud = false

  var body: some View {
    Text(text)
      .font(.g(.caption, .bold))
      .monospacedDigit()
      .padding(.horizontal, 7).padding(.vertical, 3)
      .foregroundStyle(fraud ? Color.gDestructiveFg : Color.gAttentionOn)
      .background(fraud ? Color.gDestructive.opacity(0.14) : Color.gAttention, in: Capsule())
  }
}
