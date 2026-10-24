// swift-tools-version: 6.2
// The code every GurtOS Apple app shares: the box's API, pairing, the machines list and push decryption.
import PackageDescription

let package = Package(
  name: "GurtKit",
  platforms: [.iOS(.v26), .watchOS(.v26), .macOS(.v26)],
  products: [.library(name: "GurtKit", targets: ["GurtKit"])],
  targets: [
    .target(name: "GurtKit", swiftSettings: [.swiftLanguageMode(.v5)]),
    .testTarget(name: "GurtKitTests", dependencies: ["GurtKit"], swiftSettings: [.swiftLanguageMode(.v5)]),
  ]
)
