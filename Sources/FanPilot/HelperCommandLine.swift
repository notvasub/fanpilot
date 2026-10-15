import FanCore
import Foundation
import ServiceManagement

/// Scriptable helper management, run before any UI or fan control starts:
///
///   FanPilot.app/Contents/MacOS/FanPilot --helper-status
///   FanPilot.app/Contents/MacOS/FanPilot --uninstall-helper
///
/// SMAppService must be called from inside the app bundle that owns the daemon, which is why these
/// live in the app binary rather than in fanctl.
enum HelperCommandLine {
    static func runIfRequested() {
        let arguments = CommandLine.arguments
        if arguments.contains("--helper-status") {
            print("helper: \(describe(SMAppService.daemon(plistName: FanPilotIDs.helperPlistName).status))")
            exit(0)
        }
        if arguments.contains("--install-helper") {
            let service = SMAppService.daemon(plistName: FanPilotIDs.helperPlistName)
            do {
                try service.register()
            } catch {
                print("register: \(error.localizedDescription)")
            }
            print("helper: \(describe(service.status))")
            if service.status == .requiresApproval {
                SMAppService.openSystemSettingsLoginItems()
            }
            exit(service.status == .enabled || service.status == .requiresApproval ? 0 : 1)
        }
        if arguments.contains("--uninstall-helper") {
            let service = SMAppService.daemon(plistName: FanPilotIDs.helperPlistName)
            let done = DispatchSemaphore(value: 0)
            var failure: Error?
            service.unregister { error in
                failure = error
                done.signal()
            }
            done.wait()
            if let failure {
                print("unregister failed: \(failure.localizedDescription)")
                exit(1)
            }
            print("helper unregistered; status now: \(describe(service.status))")
            exit(0)
        }
    }

    private static func describe(_ status: SMAppService.Status) -> String {
        switch status {
        case .notRegistered: return "not registered"
        case .enabled: return "enabled"
        case .requiresApproval: return "requires approval (System Settings → General → Login Items)"
        case .notFound: return "not found"
        @unknown default: return "unknown (\(status.rawValue))"
        }
    }
}
