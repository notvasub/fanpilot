import Foundation

/// Conversions between 4-character SMC key/type names and their big-endian UInt32 codes.
public enum FourCC {
    public static func code(_ string: String) -> UInt32 {
        var bytes = Array(string.utf8.prefix(4))
        while bytes.count < 4 { bytes.append(0x20) }
        return bytes.reduce(0) { $0 << 8 | UInt32($1) }
    }

    public static func string(_ code: UInt32) -> String {
        let bytes = [24, 16, 8, 0].map { UInt8(truncatingIfNeeded: code >> UInt32($0)) }
        return String(decoding: bytes, as: UTF8.self)
    }
}

/// A raw SMC value: the key's declared data type plus exactly `dataSize` bytes.
public struct SMCValue: Equatable, Sendable {
    public let type: String
    public let bytes: [UInt8]

    public init(type: String, bytes: [UInt8]) {
        self.type = type
        self.bytes = bytes
    }

    /// Numeric interpretation for the SMC types fan control and temperature reading need.
    public var doubleValue: Double? {
        switch type {
        case "flt ":
            guard bytes.count == 4 else { return nil }
            let bits = UInt32(bytes[0]) | UInt32(bytes[1]) << 8 | UInt32(bytes[2]) << 16 | UInt32(bytes[3]) << 24
            return Double(Float(bitPattern: bits))
        case "ui8 ", "ui16", "ui32", "ui64", "flag":
            return Double(bigEndianUnsigned)
        case "si8 ", "si16", "si32":
            return Double(bigEndianSigned)
        default:
            if let fraction = Self.fixedPointFractionBits(type) {
                let raw = type.hasPrefix("sp") ? Double(bigEndianSigned) : Double(bigEndianUnsigned)
                return raw / Double(1 << fraction)
            }
            return nil
        }
    }

    /// Encodes `value` for a key of the given type and size. Returns nil for unsupported types.
    public static func encode(_ value: Double, type: String, size: Int) -> [UInt8]? {
        switch type {
        case "flt ":
            guard size == 4 else { return nil }
            let bits = Float(value).bitPattern
            return [0, 8, 16, 24].map { UInt8(truncatingIfNeeded: bits >> UInt32($0)) }
        case "ui8 ", "ui16", "ui32", "flag":
            guard value >= 0 else { return nil }
            return bigEndian(UInt64(value.rounded()), size: size)
        default:
            guard let fraction = fixedPointFractionBits(type) else { return nil }
            let scaled = (value * Double(1 << fraction)).rounded()
            if type.hasPrefix("sp") {
                return bigEndian(UInt64(bitPattern: Int64(scaled)), size: size)
            }
            guard scaled >= 0 else { return nil }
            return bigEndian(UInt64(scaled), size: size)
        }
    }

    /// For fixed-point types such as `fpe2` or `sp78` the last hex digit is the number of fraction bits.
    static func fixedPointFractionBits(_ type: String) -> Int? {
        guard type.count == 4, type.hasPrefix("fp") || type.hasPrefix("sp") else { return nil }
        return Int(String(type.last!), radix: 16)
    }

    private var bigEndianUnsigned: UInt64 {
        bytes.prefix(8).reduce(0) { $0 << 8 | UInt64($1) }
    }

    private var bigEndianSigned: Int64 {
        let width = min(bytes.count, 8) * 8
        guard width > 0 else { return 0 }
        let raw = bigEndianUnsigned
        let shift = UInt64(64 - width)
        return Int64(bitPattern: raw << shift) >> Int64(shift)
    }

    private static func bigEndian(_ value: UInt64, size: Int) -> [UInt8] {
        (0..<size).map { UInt8(truncatingIfNeeded: value >> UInt64((size - 1 - $0) * 8)) }
    }
}
