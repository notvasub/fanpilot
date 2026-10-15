import Foundation

public struct FanRange: Equatable, Sendable {
    public let minRPM: Double
    public let maxRPM: Double

    public init(minRPM: Double, maxRPM: Double) {
        self.minRPM = minRPM
        self.maxRPM = max(maxRPM, minRPM)
    }

    public func rpm(percent: Double) -> Double {
        minRPM + (maxRPM - minRPM) * ControlLogic.clampPercent(percent) / 100
    }

    public func percent(rpm: Double) -> Double {
        guard maxRPM > minRPM else { return 0 }
        return ControlLogic.clampPercent((rpm - minRPM) / (maxRPM - minRPM) * 100)
    }
}

public enum FanCommand: Equatable, Sendable {
    case automatic
    case manual(rpm: Double)
}

/// Limits how fast a temperature curve may change the fan target between control ticks, so the
/// fan spins up quickly when things heat up but winds down gently. Macs Fan Control does the same
/// kind of stepped ramp ("HALF/DOUBLE INCREASE", "Ignoring temperature change") in SensorBasedControl_Simple.
public struct CurveTuning: Equatable, Sendable {
    public var upStepRPM: Double
    public var downStepRPM: Double
    public var deadbandRPM: Double

    public init(upStepRPM: Double = 800, downStepRPM: Double = 200, deadbandRPM: Double = 100) {
        self.upStepRPM = upStepRPM
        self.downStepRPM = downStepRPM
        self.deadbandRPM = deadbandRPM
    }
}

public enum ControlLogic {
    public static func clampPercent(_ percent: Double) -> Double {
        guard percent.isFinite else { return 0 }
        return min(max(percent, 0), 100)
    }

    /// 0 at or below `from`, 1 at or above `to`, linear in between.
    public static func curveFraction(temperature: Double, from: Double, to: Double) -> Double {
        guard to > from else { return temperature >= to ? 1 : 0 }
        return min(max((temperature - from) / (to - from), 0), 1)
    }

    public static func smooth(previous: Double?, desired: Double, tuning: CurveTuning) -> Double {
        guard let previous else { return desired }
        if desired > previous {
            return min(desired, previous + tuning.upStepRPM)
        }
        if previous - desired < tuning.deadbandRPM {
            return previous
        }
        return max(desired, previous - tuning.downStepRPM)
    }

    /// The mode a fan should follow for the current control state.
    public static func mode(for control: ActiveControl, fan: Int, profiles: [FanProfile]) -> FanMode {
        switch control {
        case .manual(let percent):
            return .fixed(percent: percent)
        case .profile(let id):
            return profiles.first { $0.id == id }?.mode(forFan: fan) ?? .automatic
        }
    }

    /// Resolves a mode into a concrete SMC command. Curves fall back to automatic when no temperature is available.
    public static func command(
        for mode: FanMode, range: FanRange, temperature: CPUTemperature?, previousTarget: Double?,
        tuning: CurveTuning = CurveTuning()
    ) -> FanCommand {
        switch mode {
        case .automatic:
            return .automatic
        case .fixed(let percent):
            return .manual(rpm: range.rpm(percent: percent).rounded())
        case .curve(let source, let from, let to):
            guard let temperature else { return .automatic }
            let fraction = curveFraction(temperature: temperature.value(for: source), from: from, to: to)
            let desired = range.rpm(percent: fraction * 100)
            let smoothed = smooth(previous: previousTarget, desired: desired, tuning: tuning)
            return .manual(rpm: min(max(smoothed, range.minRPM), range.maxRPM).rounded())
        }
    }

    /// Where a fan currently sits in its range, used as the starting point for hotkey nudges.
    public static func effectivePercent(range: FanRange, actualRPM: Double, targetRPM: Double, isManual: Bool) -> Double {
        range.percent(rpm: isManual ? targetRPM : actualRPM)
    }

    /// Steps to the next multiple of `step` in the given direction, so repeated presses land on
    /// predictable values (10%, 20%, …) and each press moves by at most one step.
    public static func nudged(fromPercent current: Double, step: Double, direction: Int) -> ActiveControl {
        guard step > 0, direction != 0 else { return .manual(percent: clampPercent(current)) }
        let position = clampPercent(current) / step
        let epsilon = 1e-6
        let next = direction > 0 ? (position + epsilon).rounded(.down) + 1 : (position - epsilon).rounded(.up) - 1
        return .manual(percent: clampPercent(next * step))
    }

    /// The profile after the active one, wrapping around. Manual control moves to the first profile.
    public static func nextProfile(after control: ActiveControl, in profiles: [FanProfile]) -> ActiveControl {
        guard !profiles.isEmpty else { return .automatic }
        guard case .profile(let id) = control, let index = profiles.firstIndex(where: { $0.id == id }) else {
            return .profile(profiles[0].id)
        }
        return .profile(profiles[(index + 1) % profiles.count].id)
    }
}
