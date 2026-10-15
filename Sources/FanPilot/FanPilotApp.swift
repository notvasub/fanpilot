import AppKit
import SwiftUI

@main
struct FanPilotApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate

    init() {
        HelperCommandLine.runIfRequested()
    }

    var body: some Scene {
        MenuBarExtra {
            MenuContentView(model: appDelegate.model)
        } label: {
            MenuBarLabel(model: appDelegate.model)
        }
        .menuBarExtraStyle(.window)

        Window("FanPilot Profiles", id: ProfilesWindow.id) {
            ProfilesWindow(model: appDelegate.model)
        }
        .windowResizability(.contentSize)
    }
}

@MainActor
final class AppDelegate: NSObject, NSApplicationDelegate {
    lazy var model = AppModel()

    func applicationWillTerminate(_ notification: Notification) {
        model.prepareForQuit()
    }
}

struct MenuBarLabel: View {
    let model: AppModel

    var body: some View {
        HStack(spacing: 3) {
            Image(systemName: model.store.active == .automatic ? "fan" : "fan.fill")
            if let rpm = model.averageRPM {
                Text("\(Int(rpm.rounded()))")
                    .monospacedDigit()
            }
        }
    }
}
