import AppKit
import SwiftUI

/// Brief on-screen confirmation for hotkey actions, in the style of the system volume HUD.
@MainActor
final class HUDController {
    private var panel: NSPanel?
    private var hosting: NSHostingView<HUDView>?
    private var hideWork: DispatchWorkItem?

    func show(title: String, detail: String, fraction: Double?) {
        let view = HUDView(title: title, detail: detail, fraction: fraction)
        let panel = self.panel ?? makePanel(with: view)
        hosting?.rootView = view

        if let screen = NSScreen.main {
            let size = panel.frame.size
            let origin = NSPoint(x: screen.frame.midX - size.width / 2, y: screen.frame.minY + screen.frame.height * 0.18)
            panel.setFrameOrigin(origin)
        }
        panel.alphaValue = 1
        panel.orderFrontRegardless()

        hideWork?.cancel()
        let work = DispatchWorkItem { [weak panel] in
            NSAnimationContext.runAnimationGroup { context in
                context.duration = 0.35
                panel?.animator().alphaValue = 0
            } completionHandler: {
                panel?.orderOut(nil)
            }
        }
        hideWork = work
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.4, execute: work)
    }

    private func makePanel(with view: HUDView) -> NSPanel {
        let panel = NSPanel(
            contentRect: NSRect(x: 0, y: 0, width: 240, height: 120),
            styleMask: [.borderless, .nonactivatingPanel], backing: .buffered, defer: false)
        panel.isOpaque = false
        panel.backgroundColor = .clear
        panel.hasShadow = false
        panel.level = .statusBar
        panel.ignoresMouseEvents = true
        panel.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary, .stationary]
        let hosting = NSHostingView(rootView: view)
        hosting.frame = panel.contentRect(forFrameRect: panel.frame)
        hosting.autoresizingMask = [.width, .height]
        panel.contentView = hosting
        self.panel = panel
        self.hosting = hosting
        return panel
    }
}

struct HUDView: View {
    let title: String
    let detail: String
    let fraction: Double?

    var body: some View {
        VStack(spacing: 8) {
            Image(systemName: "fan.fill")
                .font(.system(size: 30, weight: .medium))
            Text(title)
                .font(.headline)
            if let fraction {
                ProgressView(value: min(max(fraction, 0), 1))
                    .progressViewStyle(.linear)
                    .frame(width: 160)
            }
            Text(detail)
                .font(.caption)
                .foregroundStyle(.secondary)
                .monospacedDigit()
        }
        .padding(16)
        .frame(width: 240, height: 120)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
    }
}
