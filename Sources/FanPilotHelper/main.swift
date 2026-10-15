import FanCore
import Foundation
import SMCKit
import os

// Root LaunchDaemon registered by FanPilot through SMAppService. launchd starts it on demand when the
// app connects to the mach service declared in Contents/Library/LaunchDaemons/com.vasu.fanpilot.helper.plist.

let log = Logger(subsystem: FanPilotIDs.helperLabel, category: "main")

/// Only FanPilot may connect: same team and bundle identifier when signed with a real identity,
/// otherwise (ad-hoc development builds) exactly the app bundle this helper ships inside.
func clientRequirement() -> String? {
    if let requirement = CodeSigning.sameTeamRequirement(identifier: FanPilotIDs.appBundleID) {
        return requirement
    }
    let bundleURL = Bundle.main.bundleURL
    guard bundleURL.pathExtension == "app" else { return nil }
    return CodeSigning.designatedRequirement(ofCodeAt: bundleURL)
}

guard getuid() == 0 else {
    log.error("FanPilotHelper must run as root (it is started by launchd)")
    exit(1)
}

let fans: FanSMC
do {
    fans = FanSMC(smc: try SMCConnection())
} catch {
    log.fault("cannot open AppleSMC: \(String(describing: error))")
    exit(1)
}
guard fans.modeStyle != .unsupported, fans.fanCount > 0 else {
    log.fault("no controllable fans on this machine")
    exit(1)
}

guard let requirement = clientRequirement() else {
    log.fault("cannot determine client code-signing requirement; refusing to serve")
    exit(1)
}
log.info("client requirement: \(requirement, privacy: .public)")

let writer = FanWriter(fans: fans)
let delegate = ListenerDelegate(writer: writer)
let listener = NSXPCListener(machServiceName: FanPilotIDs.helperMachService)
listener.setConnectionCodeSigningRequirement(requirement)
listener.delegate = delegate
listener.resume()

// launchd sends SIGTERM on unregister/shutdown: hand the fans back first.
var signalSources: [DispatchSourceSignal] = []
for sig in [SIGTERM, SIGINT] {
    signal(sig, SIG_IGN)
    let source = DispatchSource.makeSignalSource(signal: sig, queue: .main)
    source.setEventHandler {
        _ = writer.resetAll()
        exit(0)
    }
    source.resume()
    signalSources.append(source)
}

log.info("FanPilotHelper \(FanPilotIDs.helperVersion, privacy: .public) ready")
dispatchMain()
