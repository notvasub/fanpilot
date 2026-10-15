import CSMC
import FanCore
import Foundation

public struct TemperatureSensor: Equatable, Sendable {
    public let name: String
    public let celsius: Double
}

public enum TemperatureReader {
    /// All Apple Silicon HID temperature sensors with a plausible reading.
    public static func hidSensors() -> [TemperatureSensor] {
        var buffer = [CSMCTemperature](repeating: CSMCTemperature(), count: 128)
        let count = Int(csmc_hid_temperatures(&buffer, Int32(buffer.count)))
        return buffer.prefix(count).compactMap { entry in
            let name = withUnsafeBytes(of: entry.name) { raw in
                String(decoding: raw.prefix { $0 != 0 }, as: UTF8.self)
            }
            guard entry.celsius > 0, entry.celsius < 150 else { return nil }
            return TemperatureSensor(name: name, celsius: entry.celsius)
        }
    }

    /// CPU die temperature summary from the HID sensors named "PMU tdie*" (one per CPU die sensor).
    public static func cpuSummary(from sensors: [TemperatureSensor] = hidSensors()) -> CPUTemperature? {
        let cpu = sensors.filter { isCPUDieSensor($0.name) }.map(\.celsius)
        guard !cpu.isEmpty else { return nil }
        return CPUTemperature(average: cpu.reduce(0, +) / Double(cpu.count), maximum: cpu.max()!, count: cpu.count)
    }

    static func isCPUDieSensor(_ name: String) -> Bool {
        name.hasPrefix("PMU tdie")
    }
}
