import Foundation

public enum TemperatureSource: String, Codable, CaseIterable, Sendable {
    case cpuAverage
    case cpuMax

    public var label: String {
        switch self {
        case .cpuAverage: return "CPU average"
        case .cpuMax: return "CPU hottest"
        }
    }
}

/// How one fan should be driven. Same three modes Macs Fan Control offers
/// (`0` automatic, `1,rpm` constant, `2,sensor,from,to` sensor-based), but constant speed is
/// stored as a percentage of the fan's [min, max] range so profiles work for fans with different limits.
public enum FanMode: Codable, Equatable, Hashable, Sendable {
    case automatic
    case fixed(percent: Double)
    case curve(source: TemperatureSource, fromCelsius: Double, toCelsius: Double)

    public var summary: String {
        switch self {
        case .automatic:
            return "Automatic"
        case .fixed(let percent):
            return "Fixed \(Int(percent.rounded()))%"
        case .curve(let source, let from, let to):
            return "\(source.label) \(Int(from))–\(Int(to)) °C"
        }
    }
}

public struct FanProfile: Codable, Identifiable, Equatable, Hashable, Sendable {
    public var id: UUID
    public var name: String
    /// One mode per fan. When there are more fans than modes, the last mode applies to the rest.
    public var modes: [FanMode]
    public var isBuiltIn: Bool

    public init(id: UUID = UUID(), name: String, modes: [FanMode], isBuiltIn: Bool = false) {
        self.id = id
        self.name = name
        self.modes = modes
        self.isBuiltIn = isBuiltIn
    }

    public func mode(forFan fan: Int) -> FanMode {
        guard !modes.isEmpty else { return .automatic }
        return modes[min(max(fan, 0), modes.count - 1)]
    }
}

extension FanProfile {
    public static let automaticID = UUID(uuidString: "00000000-0000-0000-0000-000000000001")!

    public static let builtIns: [FanProfile] = [
        FanProfile(id: automaticID, name: "Automatic", modes: [.automatic], isBuiltIn: true),
        FanProfile(
            id: UUID(uuidString: "00000000-0000-0000-0000-000000000002")!, name: "Quiet",
            modes: [.curve(source: .cpuAverage, fromCelsius: 60, toCelsius: 90)], isBuiltIn: true),
        FanProfile(
            id: UUID(uuidString: "00000000-0000-0000-0000-000000000003")!, name: "Balanced",
            modes: [.curve(source: .cpuAverage, fromCelsius: 50, toCelsius: 80)], isBuiltIn: true),
        FanProfile(
            id: UUID(uuidString: "00000000-0000-0000-0000-000000000004")!, name: "Performance",
            modes: [.curve(source: .cpuMax, fromCelsius: 45, toCelsius: 75)], isBuiltIn: true),
        FanProfile(
            id: UUID(uuidString: "00000000-0000-0000-0000-000000000005")!, name: "Full Speed",
            modes: [.fixed(percent: 100)], isBuiltIn: true),
    ]
}

/// What is currently driving the fans: a saved profile, or a manual speed set from the hotkeys/slider.
public enum ActiveControl: Codable, Equatable, Hashable, Sendable {
    case profile(UUID)
    case manual(percent: Double)

    public static let automatic = ActiveControl.profile(FanProfile.automaticID)
}

public struct CPUTemperature: Equatable, Sendable {
    public let average: Double
    public let maximum: Double
    public let count: Int

    public init(average: Double, maximum: Double, count: Int) {
        self.average = average
        self.maximum = maximum
        self.count = count
    }

    public func value(for source: TemperatureSource) -> Double {
        switch source {
        case .cpuAverage: return average
        case .cpuMax: return maximum
        }
    }
}
