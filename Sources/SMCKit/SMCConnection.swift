import CSMC
import FanCore
import Foundation
import IOKit

public struct SMCError: Error, CustomStringConvertible {
    public let code: kern_return_t
    public let key: String?

    public var isKeyNotFound: Bool {
        code == Int32(CSMC_ERR_SMC_RESULT_BASE | CSMC_RESULT_KEY_NOT_FOUND)
    }

    public var isNotPrivileged: Bool {
        code == kIOReturnNotPrivileged
    }

    public var description: String {
        let subject = key.map { "SMC key '\($0)'" } ?? "SMC"
        if code & Int32(CSMC_ERR_SMC_RESULT_BASE) != 0 {
            return "\(subject): SMC result 0x\(String(code & 0xff, radix: 16))"
        }
        if let text = mach_error_string(code) {
            return "\(subject): \(String(cString: text)) (0x\(String(UInt32(bitPattern: code), radix: 16)))"
        }
        return "\(subject): error \(code)"
    }
}

/// A connection to the AppleSMC user client. Reads work unprivileged; writes require root.
public final class SMCConnection: @unchecked Sendable {
    public struct KeyInfo: Equatable, Sendable {
        public let type: String
        public let size: Int
    }

    private let connection: io_connect_t
    private let lock = NSLock()
    private var infoCache: [UInt32: KeyInfo] = [:]

    public init() throws {
        var connection: io_connect_t = 0
        let kr = csmc_open(&connection)
        guard kr == KERN_SUCCESS else { throw SMCError(code: kr, key: nil) }
        self.connection = connection
    }

    deinit {
        csmc_close(connection)
    }

    /// Type and size of a key, or nil when the key does not exist on this machine.
    public func info(_ key: String) -> KeyInfo? {
        let code = FourCC.code(key)
        lock.lock()
        defer { lock.unlock() }
        if let cached = infoCache[code] { return cached }
        var raw = CSMCKeyInfo()
        guard csmc_key_info(connection, code, &raw) == KERN_SUCCESS else { return nil }
        let info = KeyInfo(type: FourCC.string(raw.dataType), size: Int(raw.dataSize))
        infoCache[code] = info
        return info
    }

    public func read(_ key: String) throws -> SMCValue {
        var info = CSMCKeyInfo()
        var bytes = [UInt8](repeating: 0, count: 32)
        let kr = lock.withLock { csmc_read(connection, FourCC.code(key), &info, &bytes) }
        guard kr == KERN_SUCCESS else { throw SMCError(code: kr, key: key) }
        return SMCValue(type: FourCC.string(info.dataType), bytes: Array(bytes.prefix(Int(info.dataSize))))
    }

    public func readDouble(_ key: String) -> Double? {
        try? read(key).doubleValue
    }

    public func write(_ key: String, bytes: [UInt8]) throws {
        let kr = lock.withLock { csmc_write(connection, FourCC.code(key), bytes, UInt32(bytes.count)) }
        guard kr == KERN_SUCCESS else { throw SMCError(code: kr, key: key) }
    }

    /// Encodes `value` using the key's own SMC type (e.g. `flt ` on Apple Silicon, `fpe2` on Intel) and writes it.
    public func write(_ key: String, value: Double) throws {
        guard let info = info(key) else {
            throw SMCError(code: Int32(CSMC_ERR_SMC_RESULT_BASE | CSMC_RESULT_KEY_NOT_FOUND), key: key)
        }
        guard let bytes = SMCValue.encode(value, type: info.type, size: info.size) else {
            throw SMCError(code: kIOReturnUnsupported, key: key)
        }
        try write(key, bytes: bytes)
    }

    /// Every key the SMC exposes, in index order.
    public func allKeys() -> [String] {
        guard let count = readDouble("#KEY") else { return [] }
        var keys: [String] = []
        keys.reserveCapacity(Int(count))
        for index in 0..<UInt32(count) {
            var code: UInt32 = 0
            let kr = lock.withLock { csmc_key_at_index(connection, index, &code) }
            if kr == KERN_SUCCESS { keys.append(FourCC.string(code)) }
        }
        return keys
    }
}
