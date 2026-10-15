import XCTest

@testable import FanCore

final class ControlLogicTests: XCTestCase {
    private let range = FanRange(minRPM: 2317, maxRPM: 7826)
    private let warm = CPUTemperature(average: 65, maximum: 80, count: 42)

    func testPercentToRPMAndBack() {
        XCTAssertEqual(range.rpm(percent: 0), 2317)
        XCTAssertEqual(range.rpm(percent: 100), 7826)
        XCTAssertEqual(range.rpm(percent: 150), 7826, "clamped")
        XCTAssertEqual(range.percent(rpm: range.rpm(percent: 40)), 40, accuracy: 1e-9)
        XCTAssertEqual(range.percent(rpm: 1000), 0)
    }

    func testCurveFraction() {
        XCTAssertEqual(ControlLogic.curveFraction(temperature: 40, from: 50, to: 80), 0)
        XCTAssertEqual(ControlLogic.curveFraction(temperature: 65, from: 50, to: 80), 0.5)
        XCTAssertEqual(ControlLogic.curveFraction(temperature: 95, from: 50, to: 80), 1)
        XCTAssertEqual(ControlLogic.curveFraction(temperature: 60, from: 60, to: 60), 1, "degenerate range")
    }

    func testSmoothingRampsUpFastAndDownSlowly() {
        let tuning = CurveTuning(upStepRPM: 800, downStepRPM: 200, deadbandRPM: 100)
        XCTAssertEqual(ControlLogic.smooth(previous: nil, desired: 5000, tuning: tuning), 5000)
        XCTAssertEqual(ControlLogic.smooth(previous: 3000, desired: 5000, tuning: tuning), 3800)
        XCTAssertEqual(ControlLogic.smooth(previous: 3000, desired: 3300, tuning: tuning), 3300)
        XCTAssertEqual(ControlLogic.smooth(previous: 3000, desired: 2950, tuning: tuning), 3000, "inside deadband")
        XCTAssertEqual(ControlLogic.smooth(previous: 3000, desired: 2000, tuning: tuning), 2800)
    }

    func testCommandForModes() {
        XCTAssertEqual(ControlLogic.command(for: .automatic, range: range, temperature: warm, previousTarget: nil), .automatic)
        XCTAssertEqual(ControlLogic.command(for: .fixed(percent: 100), range: range, temperature: nil, previousTarget: nil),
                       .manual(rpm: 7826))
        let curve = FanMode.curve(source: .cpuAverage, fromCelsius: 50, toCelsius: 80)
        // 65 °C average is halfway: 2317 + 5509 / 2 = 5071.5 -> rounded
        XCTAssertEqual(ControlLogic.command(for: curve, range: range, temperature: warm, previousTarget: nil),
                       .manual(rpm: 5072))
        let hottest = FanMode.curve(source: .cpuMax, fromCelsius: 50, toCelsius: 80)
        XCTAssertEqual(ControlLogic.command(for: hottest, range: range, temperature: warm, previousTarget: nil),
                       .manual(rpm: 7826))
    }

    func testCurveWithoutTemperatureFallsBackToAutomatic() {
        let curve = FanMode.curve(source: .cpuAverage, fromCelsius: 50, toCelsius: 80)
        XCTAssertEqual(ControlLogic.command(for: curve, range: range, temperature: nil, previousTarget: 3000), .automatic)
    }

    func testCurveIsSmoothedAgainstPreviousTarget() {
        let curve = FanMode.curve(source: .cpuMax, fromCelsius: 50, toCelsius: 80)
        XCTAssertEqual(ControlLogic.command(for: curve, range: range, temperature: warm, previousTarget: 3000),
                       .manual(rpm: 3800))
    }

    func testNudgeLandsOnStepMultiples() {
        XCTAssertEqual(ControlLogic.nudged(fromPercent: 0, step: 10, direction: +1), .manual(percent: 10))
        XCTAssertEqual(ControlLogic.nudged(fromPercent: 27, step: 10, direction: +1), .manual(percent: 30))
        XCTAssertEqual(ControlLogic.nudged(fromPercent: 27, step: 10, direction: -1), .manual(percent: 20))
        XCTAssertEqual(ControlLogic.nudged(fromPercent: 30, step: 10, direction: +1), .manual(percent: 40))
        XCTAssertEqual(ControlLogic.nudged(fromPercent: 30, step: 10, direction: -1), .manual(percent: 20))
        XCTAssertEqual(ControlLogic.nudged(fromPercent: 100, step: 10, direction: +1), .manual(percent: 100))
        XCTAssertEqual(ControlLogic.nudged(fromPercent: 0, step: 10, direction: -1), .manual(percent: 0))
        XCTAssertEqual(ControlLogic.nudged(fromPercent: 33.4, step: 15, direction: +1), .manual(percent: 45))
    }

    func testEffectivePercentUsesTargetOnlyWhenManual() {
        let target = range.rpm(percent: 50)
        XCTAssertEqual(ControlLogic.effectivePercent(range: range, actualRPM: 2317, targetRPM: target, isManual: true),
                       50, accuracy: 1e-9)
        XCTAssertEqual(ControlLogic.effectivePercent(range: range, actualRPM: 2317, targetRPM: target, isManual: false), 0)
    }

    func testModeResolution() {
        let custom = FanProfile(name: "Split", modes: [.fixed(percent: 20), .fixed(percent: 80)])
        let profiles = FanProfile.builtIns + [custom]
        XCTAssertEqual(ControlLogic.mode(for: .manual(percent: 35), fan: 1, profiles: profiles), .fixed(percent: 35))
        XCTAssertEqual(ControlLogic.mode(for: .profile(custom.id), fan: 0, profiles: profiles), .fixed(percent: 20))
        XCTAssertEqual(ControlLogic.mode(for: .profile(custom.id), fan: 1, profiles: profiles), .fixed(percent: 80))
        XCTAssertEqual(ControlLogic.mode(for: .profile(custom.id), fan: 5, profiles: profiles), .fixed(percent: 80),
                       "extra fans reuse the last mode")
        XCTAssertEqual(ControlLogic.mode(for: .profile(UUID()), fan: 0, profiles: profiles), .automatic,
                       "unknown profile is treated as automatic")
    }

    func testNextProfileWrapsAround() {
        let profiles = FanProfile.builtIns
        XCTAssertEqual(ControlLogic.nextProfile(after: .automatic, in: profiles), .profile(profiles[1].id))
        XCTAssertEqual(ControlLogic.nextProfile(after: .profile(profiles.last!.id), in: profiles), .profile(profiles[0].id))
        XCTAssertEqual(ControlLogic.nextProfile(after: .manual(percent: 50), in: profiles), .profile(profiles[0].id))
    }
}
