import AppKit
import Carbon.HIToolbox
import FanCore
import Foundation
import Observation
import ServiceManagement
import SMCKit

/// Owns the control loop: reads fans and temperatures every tick, resolves the active profile into
/// per-fan commands, and sends only the changes to the root helper.
@MainActor
@Observable
final class AppModel {
    let store = ProfileStore()
    let helper = HelperClient()

    private(set) var readings: [FanReading] = []
    private(set) var cpu: CPUTemperature?
    private(set) var conflictingAppRunning = false
    private(set) var smcAvailable: Bool
    private(set) var lastWriteError: String?
    private(set) var launchAtLogin = SMAppService.mainApp.status == .enabled

    @ObservationIgnored private let fans: FanSMC?
    @ObservationIgnored private let hud = HUDController()
    @ObservationIgnored private var timer: Timer?
    @ObservationIgnored private var lastSent: [Int: FanCommand] = [:]
    @ObservationIgnored private var needsResync = true
    @ObservationIgnored private var sleeping = false
    @ObservationIgnored private var observers: [NSObjectProtocol] = []

    static let tickInterval: TimeInterval = 2

    init() {
        fans = try? FanSMC(smc: SMCConnection())
        smcAvailable = fans != nil
        start()
    }

    // MARK: - Lifecycle

    private func start() {
        tick()
        timer = Timer.scheduledTimer(withTimeInterval: Self.tickInterval, repeats: true) { [weak self] _ in
            MainActor.assumeIsolated { self?.tick() }
        }
        registerHotKeys()
        observeSleepAndWake()
    }

    /// Hands the fans back to the system before the app exits.
    func prepareForQuit() {
        if lastSent.values.contains(where: { $0 != .automatic }) || readings.contains(where: \.isManual) {
            helper.resetAllSynchronously()
        }
    }

    private func observeSleepAndWake() {
        let center = NSWorkspace.shared.notificationCenter
        observers.append(center.addObserver(forName: NSWorkspace.willSleepNotification, object: nil, queue: .main) {
            [weak self] _ in
            MainActor.assumeIsolated {
                guard let self else { return }
                self.sleeping = true
                if self.lastSent.values.contains(where: { $0 != .automatic }) {
                    self.helper.resetAllSynchronously()
                }
                self.lastSent.removeAll()
            }
        })
        observers.append(center.addObserver(forName: NSWorkspace.didWakeNotification, object: nil, queue: .main) {
            [weak self] _ in
            MainActor.assumeIsolated {
                guard let self else { return }
                // Give the SMC a moment after wake before taking control again.
                DispatchQueue.main.asyncAfter(deadline: .now() + 3) {
                    self.sleeping = false
                    self.needsResync = true
                    self.tick()
                }
            }
        })
    }

    // MARK: - Control loop

    func tick() {
        guard let fans else { return }
        readings = fans.readings()
        cpu = TemperatureReader.cpuSummary()
        conflictingAppRunning = NSWorkspace.shared.runningApplications.contains {
            $0.bundleIdentifier == FanPilotIDs.macsFanControlBundleID
        }
        helper.refresh()

        guard !sleeping, !conflictingAppRunning, helper.isReady else {
            if !helper.isReady { lastSent.removeAll() }
            needsResync = true
            return
        }

        for reading in readings {
            let range = FanRange(minRPM: reading.minRPM, maxRPM: reading.maxRPM)
            let mode = ControlLogic.mode(for: store.active, fan: reading.index, profiles: store.allProfiles)
            var previousTarget: Double?
            if case .manual(let rpm) = lastSent[reading.index] { previousTarget = rpm }
            let command = ControlLogic.command(
                for: mode, range: range, temperature: cpu, previousTarget: previousTarget)
            send(command, to: reading)
        }
        needsResync = false
    }

    private func send(_ command: FanCommand, to reading: FanReading) {
        let fan = reading.index
        switch command {
        case .manual(let rpm):
            let drifted = !reading.isManual || abs(reading.targetRPM - rpm) > 25
            guard needsResync || lastSent[fan] != command || drifted else { return }
            lastSent[fan] = command
            helper.setManual(fan: fan, rpm: rpm) { [weak self] error in
                self?.recordWrite(error, fan: fan)
            }
        case .automatic:
            // Only hand a fan back if it is manual and we have not already asked (avoids fighting other tools).
            guard reading.isManual, needsResync || lastSent[fan] != .automatic else { return }
            lastSent[fan] = .automatic
            helper.setAutomatic(fan: fan) { [weak self] error in
                self?.recordWrite(error, fan: fan)
            }
        }
    }

    private func recordWrite(_ error: String?, fan: Int) {
        lastWriteError = error
        if error != nil { lastSent[fan] = nil }
    }

    // MARK: - User actions

    func select(_ profile: FanProfile) {
        apply(.profile(profile.id))
        showHUD()
    }

    func setManualPercent(_ percent: Double) {
        apply(.manual(percent: ControlLogic.clampPercent(percent)))
    }

    /// Hotkey/button step: from wherever the fans are now, move one step faster (+1) or slower (-1).
    func nudge(_ direction: Int) {
        apply(ControlLogic.nudged(fromPercent: currentPercent, step: store.stepPercent, direction: direction))
        showHUD()
    }

    func resetToAutomatic() {
        apply(.automatic)
        showHUD()
    }

    func cycleProfile() {
        apply(ControlLogic.nextProfile(after: store.active, in: store.allProfiles))
        showHUD()
    }

    private func apply(_ control: ActiveControl) {
        store.active = control
        needsResync = true
        tick()
    }

    func setLaunchAtLogin(_ enabled: Bool) {
        do {
            if enabled { try SMAppService.mainApp.register() } else { try SMAppService.mainApp.unregister() }
        } catch {
            lastWriteError = "Launch at login: \(error.localizedDescription)"
        }
        launchAtLogin = SMAppService.mainApp.status == .enabled
    }

    func quitMacsFanControl() {
        NSWorkspace.shared.runningApplications
            .filter { $0.bundleIdentifier == FanPilotIDs.macsFanControlBundleID }
            .forEach { $0.terminate() }
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) { [weak self] in self?.tick() }
    }

    // MARK: - Derived state

    /// Speed of the first fan as a percentage of its range (target when manual, actual otherwise).
    var currentPercent: Double {
        if case .manual(let percent) = store.active { return percent }
        guard let fan = readings.first else { return 0 }
        return ControlLogic.effectivePercent(
            range: FanRange(minRPM: fan.minRPM, maxRPM: fan.maxRPM), actualRPM: fan.actualRPM,
            targetRPM: fan.targetRPM, isManual: fan.isManual)
    }

    var averageRPM: Double? {
        guard !readings.isEmpty else { return nil }
        return readings.map(\.actualRPM).reduce(0, +) / Double(readings.count)
    }

    var statusMessage: String? {
        if !smcAvailable { return "Cannot open the SMC on this Mac." }
        if conflictingAppRunning { return "Macs Fan Control is running. Quit it so the two apps don't fight over the fans." }
        switch helper.state {
        case .notInstalled: return "Install the fan helper to change fan speeds."
        case .needsApproval: return "Allow FanPilot under System Settings → General → Login Items."
        case .unavailable(let reason): return reason
        case .ready: return lastWriteError ?? helper.lastError
        }
    }

    // MARK: - Hotkeys & HUD

    private func registerHotKeys() {
        let center = HotKeyCenter.shared
        center.register(keyCode: kVK_F4) { [weak self] in self?.nudge(-1) }
        center.register(keyCode: kVK_F5) { [weak self] in self?.nudge(+1) }
        center.register(keyCode: kVK_F4, modifiers: shiftKey) { [weak self] in self?.resetToAutomatic() }
        center.register(keyCode: kVK_F5, modifiers: shiftKey) { [weak self] in self?.cycleProfile() }
    }

    private func showHUD() {
        let detail: String
        var fraction: Double?
        switch store.active {
        case .manual(let percent):
            fraction = percent / 100
            if let fan = readings.first {
                let rpm = FanRange(minRPM: fan.minRPM, maxRPM: fan.maxRPM).rpm(percent: percent)
                detail = "≈ \(Self.rpmText(rpm))"
            } else {
                detail = "\(Int(percent.rounded()))%"
            }
        case .profile(let id):
            detail = store.profile(id: id)?.mode(forFan: 0).summary ?? ""
        }
        let blocked = conflictingAppRunning || (!helper.isReady && store.active != .automatic)
        hud.show(title: store.activeName, detail: blocked ? "Not applied: see menu" : detail, fraction: fraction)
    }

    static func rpmText(_ rpm: Double) -> String {
        "\(Int(rpm.rounded()).formatted()) RPM"
    }
}
