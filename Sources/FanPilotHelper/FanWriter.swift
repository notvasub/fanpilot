import FanCore
import Foundation
import SMCKit
import os

/// Serializes all SMC fan writes and remembers which fans this helper switched to manual,
/// so they can be handed back to the system when the app goes away.
final class FanWriter: @unchecked Sendable {
    private let fans: FanSMC
    private let queue = DispatchQueue(label: "com.vasu.fanpilot.helper.writer")
    private var manualFans = Set<Int>()
    private let log = Logger(subsystem: FanPilotIDs.helperLabel, category: "writer")

    init(fans: FanSMC) {
        self.fans = fans
        log.info("fans=\(fans.fanCount) modeStyle=\(fans.modeStyle.rawValue) Ftst=\(fans.hasForceTest)")
    }

    var hasManualFans: Bool {
        queue.sync { !manualFans.isEmpty }
    }

    func setManual(_ fan: Int, rpm: Double) -> String? {
        queue.sync {
            guard fan >= 0, fan < fans.fanCount else { return "Fan \(fan) does not exist" }
            guard rpm.isFinite else { return "Invalid RPM" }
            guard let reading = fans.reading(fan) else { return "Cannot read fan \(fan)" }
            let clamped = min(max(rpm, reading.minRPM), reading.maxRPM)
            do {
                if !reading.isManual || !manualFans.contains(fan) {
                    // Same order as Macs Fan Control: mode key first, then the Ftst unlock where it exists.
                    try fans.setMode(fan, manual: true)
                    try fans.setForceTest(true)
                    if !fans.isManual(fan) {
                        try fans.setMode(fan, manual: true)
                    }
                }
                try fans.setTarget(fan, rpm: clamped)
                manualFans.insert(fan)
                log.debug("fan \(fan) manual \(clamped, format: .fixed(precision: 0)) rpm")
                return nil
            } catch {
                log.error("fan \(fan) manual failed: \(String(describing: error))")
                return String(describing: error)
            }
        }
    }

    func setAutomatic(_ fan: Int) -> String? {
        queue.sync {
            guard fan >= 0, fan < fans.fanCount else { return "Fan \(fan) does not exist" }
            do {
                try fans.setMode(fan, manual: false)
                manualFans.remove(fan)
                if manualFans.isEmpty {
                    try fans.setForceTest(false)
                }
                log.debug("fan \(fan) automatic")
                return nil
            } catch {
                log.error("fan \(fan) automatic failed: \(String(describing: error))")
                return String(describing: error)
            }
        }
    }

    /// Hands every fan back to the system. Used on app request, when the last client disconnects, and on SIGTERM.
    func resetAll() -> String? {
        queue.sync {
            var firstError: String?
            for fan in 0..<fans.fanCount {
                do {
                    try fans.setMode(fan, manual: false)
                } catch {
                    firstError = firstError ?? String(describing: error)
                }
            }
            do {
                try fans.setForceTest(false)
            } catch {
                firstError = firstError ?? String(describing: error)
            }
            manualFans.removeAll()
            log.info("all fans reset to automatic\(firstError.map { " (error: \($0))" } ?? "")")
            return firstError
        }
    }
}
