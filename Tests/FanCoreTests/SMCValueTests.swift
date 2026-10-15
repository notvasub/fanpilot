import XCTest

@testable import FanCore

final class SMCValueTests: XCTestCase {
    func testFourCCRoundTrip() {
        XCTAssertEqual(FourCC.code("F0Tg"), 0x4630_5467)
        XCTAssertEqual(FourCC.string(0x4630_5467), "F0Tg")
        XCTAssertEqual(FourCC.code("FS!"), FourCC.code("FS! "), "short names are space padded")
    }

    /// Bytes captured from this M5 Pro: F0Mn = 2317 RPM, F0Mx = 7826 RPM as little-endian floats.
    func testDecodesAppleSiliconFloatRPM() {
        XCTAssertEqual(SMCValue(type: "flt ", bytes: [0x00, 0xD0, 0x10, 0x45]).doubleValue, 2317)
        XCTAssertEqual(SMCValue(type: "flt ", bytes: [0x00, 0x90, 0xF4, 0x45]).doubleValue, 7826)
    }

    func testEncodesFloatRPM() {
        XCTAssertEqual(SMCValue.encode(2317, type: "flt ", size: 4), [0x00, 0xD0, 0x10, 0x45])
        XCTAssertNil(SMCValue.encode(2317, type: "flt ", size: 2))
    }

    func testIntelFixedPointRPM() {
        // fpe2: 14 integer bits, 2 fraction bits, big-endian. 2000 RPM -> 8000 -> 0x1F40.
        XCTAssertEqual(SMCValue.encode(2000, type: "fpe2", size: 2), [0x1F, 0x40])
        XCTAssertEqual(SMCValue(type: "fpe2", bytes: [0x1F, 0x40]).doubleValue, 2000)
    }

    func testUnsignedAndSignedIntegers() {
        XCTAssertEqual(SMCValue(type: "ui8 ", bytes: [0x02]).doubleValue, 2)
        XCTAssertEqual(SMCValue(type: "ui16", bytes: [0x96, 0x00]).doubleValue, 38400)
        XCTAssertEqual(SMCValue.encode(1, type: "ui8 ", size: 1), [0x01])
        XCTAssertEqual(SMCValue.encode(3, type: "ui16", size: 2), [0x00, 0x03])
        XCTAssertNil(SMCValue.encode(-1, type: "ui8 ", size: 1))
        XCTAssertEqual(SMCValue(type: "si8 ", bytes: [0xFF]).doubleValue, -1)
    }

    func testSignedFixedPointTemperature() {
        // sp78: 45.5 °C -> 45.5 * 256 = 11648 -> 0x2D80
        XCTAssertEqual(SMCValue(type: "sp78", bytes: [0x2D, 0x80]).doubleValue, 45.5)
        XCTAssertEqual(SMCValue(type: "sp78", bytes: [0xFF, 0x00]).doubleValue, -1)
        XCTAssertEqual(SMCValue.encode(-1, type: "sp78", size: 2), [0xFF, 0x00])
    }

    func testUnknownTypeHasNoNumericValue() {
        XCTAssertNil(SMCValue(type: "hex_", bytes: [0x00, 0x02]).doubleValue)
        XCTAssertNil(SMCValue.encode(1, type: "hex_", size: 2))
    }
}
