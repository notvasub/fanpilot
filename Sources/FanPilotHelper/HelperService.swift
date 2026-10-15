import FanCore
import Foundation
import os

final class HelperService: NSObject, FanHelperProtocol {
    private let writer: FanWriter

    init(writer: FanWriter) {
        self.writer = writer
    }

    func helperVersion(withReply reply: @escaping (String) -> Void) {
        reply(FanPilotIDs.helperVersion)
    }

    func setFan(_ fan: Int, manualRPM rpm: Double, withReply reply: @escaping (String?) -> Void) {
        reply(writer.setManual(fan, rpm: rpm))
    }

    func setFanAutomatic(_ fan: Int, withReply reply: @escaping (String?) -> Void) {
        reply(writer.setAutomatic(fan))
    }

    func resetAllFans(withReply reply: @escaping (String?) -> Void) {
        reply(writer.resetAll())
    }
}

/// Accepts connections from FanPilot (the listener enforces the code-signing requirement) and acts as a
/// watchdog: when the last client disconnects, for example because the app crashed, fans go back to automatic.
final class ListenerDelegate: NSObject, NSXPCListenerDelegate {
    private let writer: FanWriter
    private let service: HelperService
    private let queue = DispatchQueue(label: "com.vasu.fanpilot.helper.connections")
    private var openConnections = 0
    private let log = Logger(subsystem: FanPilotIDs.helperLabel, category: "listener")

    init(writer: FanWriter) {
        self.writer = writer
        self.service = HelperService(writer: writer)
    }

    func listener(_ listener: NSXPCListener, shouldAcceptNewConnection connection: NSXPCConnection) -> Bool {
        connection.exportedInterface = NSXPCInterface(with: FanHelperProtocol.self)
        connection.exportedObject = service
        connection.invalidationHandler = { [weak self] in
            self?.connectionEnded()
        }
        queue.sync { openConnections += 1 }
        log.info("client connected pid=\(connection.processIdentifier)")
        connection.resume()
        return true
    }

    private func connectionEnded() {
        let remaining = queue.sync { () -> Int in
            openConnections = max(openConnections - 1, 0)
            return openConnections
        }
        log.info("client disconnected, \(remaining) remaining")
        if remaining == 0, writer.hasManualFans {
            _ = writer.resetAll()
        }
    }
}
