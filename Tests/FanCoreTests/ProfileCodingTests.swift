import XCTest

@testable import FanCore

final class ProfileCodingTests: XCTestCase {
    func testProfilesRoundTripThroughJSON() throws {
        let profiles = FanProfile.builtIns + [
            FanProfile(name: "Desk", modes: [.curve(source: .cpuMax, fromCelsius: 55, toCelsius: 85), .fixed(percent: 30)])
        ]
        let data = try JSONEncoder().encode(profiles)
        XCTAssertEqual(try JSONDecoder().decode([FanProfile].self, from: data), profiles)
    }

    func testActiveControlRoundTripsThroughJSON() throws {
        for control in [ActiveControl.automatic, .manual(percent: 42.5), .profile(UUID())] {
            let data = try JSONEncoder().encode(control)
            XCTAssertEqual(try JSONDecoder().decode(ActiveControl.self, from: data), control)
        }
    }

    func testBuiltInIDsAreUniqueAndStable() {
        XCTAssertEqual(Set(FanProfile.builtIns.map(\.id)).count, FanProfile.builtIns.count)
        XCTAssertEqual(FanProfile.builtIns.first?.id, FanProfile.automaticID)
        XCTAssertEqual(FanProfile.builtIns.first?.modes, [.automatic])
        XCTAssertTrue(FanProfile.builtIns.allSatisfy(\.isBuiltIn))
    }

    func testEmptyModesMeansAutomatic() {
        XCTAssertEqual(FanProfile(name: "Empty", modes: []).mode(forFan: 0), .automatic)
    }
}
