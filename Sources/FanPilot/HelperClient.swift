import FanCore
import Foundation
import Observation
import ServiceManagement

/// Registers the root helper with SMAppService and talks to it over XPC.
@MainActor
@Observable
final class HelperClient {
    enum State: Equatable {
        case notInstalled
        case needsApproval
        case ready
        case unavailable(String)
    }

    private(set) var state: State = .notInstalled
    private(set) var lastError: String?

    @ObservationIgnored private let service = SMAppService.daemon(plistName: FanPilotIDs.helperPlistName)
    @ObservationIgnored private var connection: NSXPCConnection?

    init() {
        refresh()
    }

    var isReady: Bool { state == .ready }

    func refresh() {
        switch service.status {
        case .notRegistered:
            state = .notInstalled
        case .requiresApproval:
            state = .needsApproval
        case .enabled:
            state = .ready
        case .notFound:
            // SMAppService reports .notFound for a daemon that has never been registered, not only for a
            // missing plist. register() surfaces the real problem if the bundle is broken.
            state = .notInstalled
        @unknown default:
            state = .unavailable("Unknown helper status")
        }
    }

    /// Registers the daemon. macOS then asks the user to allow it under System Settings → General → Login Items.
    func install() {
        do {
            try service.register()
            lastError = nil
        } catch {
            lastError = "Install failed: \(error.localizedDescription)"
        }
        refresh()
        if state == .needsApproval {
            SMAppService.openSystemSettingsLoginItems()
        }
    }

    func openLoginItemsSettings() {
        SMAppService.openSystemSettingsLoginItems()
    }

    func uninstall() {
        resetAllSynchronously()
        connection?.invalidate()
        connection = nil
        Task {
            do {
                try await service.unregister()
                lastError = nil
            } catch {
                lastError = "Uninstall failed: \(error.localizedDescription)"
            }
            refresh()
        }
    }

    // MARK: - Fan commands

    func setManual(fan: Int, rpm: Double, completion: @escaping @MainActor (String?) -> Void) {
        call(completion) { proxy, reply in proxy.setFan(fan, manualRPM: rpm, withReply: reply) }
    }

    func setAutomatic(fan: Int, completion: @escaping @MainActor (String?) -> Void) {
        call(completion) { proxy, reply in proxy.setFanAutomatic(fan, withReply: reply) }
    }

    func resetAll(completion: @escaping @MainActor (String?) -> Void = { _ in }) {
        call(completion) { proxy, reply in proxy.resetAllFans(withReply: reply) }
    }

    /// Blocks until the helper has handed the fans back (used while quitting).
    func resetAllSynchronously() {
        guard isReady else { return }
        let proxy = activeConnection().synchronousRemoteObjectProxyWithErrorHandler { _ in }
        (proxy as? FanHelperProtocol)?.resetAllFans { _ in }
    }

    private func call(
        _ completion: @escaping @MainActor (String?) -> Void,
        _ body: (FanHelperProtocol, @escaping (String?) -> Void) -> Void
    ) {
        guard isReady else {
            completion("Fan helper is not installed")
            return
        }
        let proxy = activeConnection().remoteObjectProxyWithErrorHandler { [weak self] error in
            Task { @MainActor in
                self?.connectionFailed(error)
                completion("Fan helper unavailable: \(error.localizedDescription)")
            }
        }
        guard let helper = proxy as? FanHelperProtocol else {
            completion("Fan helper interface mismatch")
            return
        }
        body(helper) { error in
            Task { @MainActor in completion(error) }
        }
    }

    private func activeConnection() -> NSXPCConnection {
        if let connection { return connection }
        let connection = NSXPCConnection(machServiceName: FanPilotIDs.helperMachService, options: .privileged)
        connection.remoteObjectInterface = NSXPCInterface(with: FanHelperProtocol.self)
        if let requirement = CodeSigning.sameTeamRequirement(identifier: FanPilotIDs.helperLabel) {
            connection.setCodeSigningRequirement(requirement)
        }
        connection.invalidationHandler = { [weak self] in
            Task { @MainActor in self?.connection = nil }
        }
        connection.resume()
        self.connection = connection
        return connection
    }

    private func connectionFailed(_ error: Error) {
        lastError = error.localizedDescription
        connection?.invalidate()
        connection = nil
        refresh()
    }
}
