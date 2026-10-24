// "2 need you · 3 running": the Lock Screen, Home Screen and Apple Watch Smart Stack widget. It reads what the app
// (or a decrypted push) last saw; it never calls the box itself. Tapping it opens what waits.
import GurtKit
import SwiftUI
import WidgetKit

struct GlanceEntry: TimelineEntry {
  var date: Date
  var glance: Glance
}

struct GlanceProvider: TimelineProvider {
  func placeholder(in context: Context) -> GlanceEntry { GlanceEntry(date: .now, glance: Glance(machine: "Home box", waiting: 2, running: 3, paused: false, requests: [])) }
  func getSnapshot(in context: Context, completion: @escaping (GlanceEntry) -> Void) { completion(context.isPreview ? placeholder(in: context) : GlanceEntry(date: .now, glance: Glance.load())) }
  func getTimeline(in context: Context, completion: @escaping (Timeline<GlanceEntry>) -> Void) {
    // The app and the push extension reload this when something changes; the hourly refresh only ages it.
    completion(Timeline(entries: [GlanceEntry(date: .now, glance: Glance.load())], policy: .after(.now.addingTimeInterval(3600))))
  }
}

struct GlanceView: View {
  @Environment(\.widgetFamily) var envFamily
  var entry: GlanceEntry
  /** Set only by the Watch app's debug gallery; widgets use the family WidgetKit gives them. */
  var family: WidgetFamily?
  var current: WidgetFamily { family ?? envFamily }
  var g: Glance { entry.glance }

  var needs: String { g.waiting == 1 ? "1 needs you" : "\(g.waiting) need you" }
  var running: String { g.paused ? "Paused" : "\(g.running) running" }

  var body: some View {
    switch current {
    case .accessoryCircular:
      ZStack {
        AccessoryWidgetBackground()
        VStack(spacing: 0) {
          Text("\(g.waiting)").font(.system(.title2, design: .rounded, weight: .bold)).widgetAccentable()
          Image(systemName: "hand.raised.fill").font(.caption2)
        }
      }
      .accessibilityLabel("\(needs), \(running)")
    #if os(watchOS)
    case .accessoryCorner:
      Text("\(g.waiting)").font(.system(.title3, design: .rounded, weight: .bold)).widgetAccentable()
        .widgetLabel { Text(g.waiting == 1 ? "needs you" : "need you") }
    #endif
    case .accessoryInline:
      Text("\(needs) · \(running)")
    case .accessoryRectangular:
      VStack(alignment: .leading, spacing: 1) {
        Text(g.machine).font(.headline).widgetAccentable().lineLimit(1)
        Text(needs).font(.body.weight(.semibold))
        Text(running).font(.caption).foregroundStyle(.secondary)
      }
      .frame(maxWidth: .infinity, alignment: .leading)
    default:
      VStack(alignment: .leading, spacing: 4) {
        Text(g.machine).font(.custom("Atkinson Hyperlegible Next", size: 13, relativeTo: .caption).weight(.semibold)).foregroundStyle(.secondary).lineLimit(1)
        Spacer(minLength: 0)
        Text("\(g.waiting)").font(.custom("Atkinson Hyperlegible Next", size: 44, relativeTo: .largeTitle).weight(.bold)).foregroundStyle(g.waiting > 0 ? Color.gAttentionFg : .primary).widgetAccentable()
        Text(g.waiting == 1 ? "needs you" : "need you").font(.custom("Atkinson Hyperlegible Next", size: 15, relativeTo: .subheadline).weight(.semibold))
        Text(running).font(.custom("Atkinson Hyperlegible Next", size: 13, relativeTo: .caption)).foregroundStyle(.secondary)
      }
      .frame(maxWidth: .infinity, alignment: .leading)
    }
  }
}

struct GlanceWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "gurtos.glance", provider: GlanceProvider()) { e in
      GlanceView(entry: e)
        .containerBackground(Color.gCard, for: .widget)
        .widgetURL(URL(string: "gurtos://home"))
    }
    .configurationDisplayName("Needs you")
    .description("What waits for your OK, and how many tasks are running.")
    #if os(watchOS)
    .supportedFamilies([.accessoryCircular, .accessoryRectangular, .accessoryInline, .accessoryCorner])
    #else
    .supportedFamilies([.systemSmall, .accessoryCircular, .accessoryRectangular, .accessoryInline])
    #endif
  }
}
