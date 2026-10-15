import FanCore
import Foundation

/// How this machine's SMC exposes the auto/manual switch for fans.
public enum FanModeKeyStyle: String, Sendable {
    /// `F{n}md` per fan (newer Apple Silicon).
    case perFanLowercase
    /// `F{n}Md` per fan.
    case perFanUppercase
    /// `FS! ` 16-bit bitmask, bit n = fan n manual (Intel).
    case bitmask
    case unsupported
}

public struct FanReading: Equatable, Sendable {
    public let index: Int
    public let minRPM: Double
    public let maxRPM: Double
    public let actualRPM: Double
    public let targetRPM: Double
    public let isManual: Bool

    public init(index: Int, minRPM: Double, maxRPM: Double, actualRPM: Double, targetRPM: Double, isManual: Bool) {
        self.index = index
        self.minRPM = minRPM
        self.maxRPM = maxRPM
        self.actualRPM = actualRPM
        self.targetRPM = targetRPM
        self.isManual = isManual
    }
}

/// Fan-level operations on top of raw SMC keys. Reads work for any user; the `set*` methods need root.
///
/// Key names and write order follow what Macs Fan Control 1.5.21 does (see docs/macs-fan-control-teardown.md):
/// switch the fan's mode key to 1, then set `Ftst` = 1 on machines that have it, then write `F{n}Tg`.
/// Returning to automatic writes mode 0 and, once no fan is manual, `Ftst` = 0.
public final class FanSMC: @unchecked Sendable {
    public let smc: SMCConnection
    public let fanCount: Int
    public let modeStyle: FanModeKeyStyle
    public let hasForceTest: Bool

    public init(smc: SMCConnection) {
        self.smc = smc
        fanCount = Int(smc.readDouble("FNum") ?? 0)
        if smc.info("F0md") != nil {
            modeStyle = .perFanLowercase
        } else if smc.info("F0Md") != nil {
            modeStyle = .perFanUppercase
        } else if smc.info("FS! ") != nil {
            modeStyle = .bitmask
        } else {
            modeStyle = .unsupported
        }
        hasForceTest = smc.info("Ftst") != nil
    }

    public static func key(_ fan: Int, _ suffix: String) -> String {
        "F\(fan)\(suffix)"
    }

    public func reading(_ fan: Int) -> FanReading? {
        guard fan >= 0, fan < fanCount,
              let minRPM = smc.readDouble(Self.key(fan, "Mn")),
              let maxRPM = smc.readDouble(Self.key(fan, "Mx")),
              let actual = smc.readDouble(Self.key(fan, "Ac"))
        else { return nil }
        let target = smc.readDouble(Self.key(fan, "Tg")) ?? actual
        return FanReading(index: fan, minRPM: minRPM, maxRPM: maxRPM, actualRPM: actual, targetRPM: target,
                          isManual: isManual(fan))
    }

    public func readings() -> [FanReading] {
        (0..<fanCount).compactMap(reading)
    }

    public func isManual(_ fan: Int) -> Bool {
        switch modeStyle {
        case .perFanLowercase: return (smc.readDouble(Self.key(fan, "md")) ?? 0) != 0
        case .perFanUppercase: return (smc.readDouble(Self.key(fan, "Md")) ?? 0) != 0
        case .bitmask: return (Int(smc.readDouble("FS! ") ?? 0) >> fan) & 1 == 1
        case .unsupported: return false
        }
    }

    // MARK: - Writes (root only)

    public func setMode(_ fan: Int, manual: Bool) throws {
        switch modeStyle {
        case .perFanLowercase:
            try smc.write(Self.key(fan, "md"), value: manual ? 1 : 0)
        case .perFanUppercase:
            try smc.write(Self.key(fan, "Md"), value: manual ? 1 : 0)
        case .bitmask:
            var mask = Int(smc.readDouble("FS! ") ?? 0)
            if manual { mask |= 1 << fan } else { mask &= ~(1 << fan) }
            try smc.write("FS! ", value: Double(mask))
        case .unsupported:
            throw SMCError(code: kIOReturnUnsupported, key: nil)
        }
    }

    public func setForceTest(_ on: Bool) throws {
        guard hasForceTest else { return }
        try smc.write("Ftst", value: on ? 1 : 0)
    }

    public func setTarget(_ fan: Int, rpm: Double) throws {
        try smc.write(Self.key(fan, "Tg"), value: rpm)
    }
}
