import FanCore
import Foundation
import SMCKit

// Read-only diagnostics. Never writes to the SMC.

func describe(_ smc: SMCConnection, _ key: String) -> String {
    guard let info = smc.info(key) else { return "\(key): <missing>" }
    let value = (try? smc.read(key)).map { v in
        let hex = v.bytes.map { String(format: "%02x", $0) }.joined()
        return v.doubleValue.map { "\($0) [\(hex)]" } ?? "[\(hex)]"
    } ?? "<unreadable>"
    return "\(key): type='\(info.type)' size=\(info.size) value=\(value)"
}

let arguments = CommandLine.arguments.dropFirst()
let smc: SMCConnection
do {
    smc = try SMCConnection()
} catch {
    FileHandle.standardError.write("fanctl: \(error)\n".data(using: .utf8)!)
    exit(1)
}

switch arguments.first {
case "keys":
    let filter = arguments.dropFirst().first
    for key in smc.allKeys() where filter.map({ key.hasPrefix($0) }) ?? true {
        print(describe(smc, key))
    }
case "temps":
    for sensor in TemperatureReader.hidSensors().sorted(by: { $0.name < $1.name }) {
        print(String(format: "%-40@ %6.1f °C", sensor.name as NSString, sensor.celsius))
    }
case "read":
    for key in arguments.dropFirst() { print(describe(smc, key)) }
default:
    let fans = FanSMC(smc: smc)
    print("fans: \(fans.fanCount)  modeStyle: \(fans.modeStyle)  Ftst: \(fans.hasForceTest ? "present" : "absent")")
    for key in ["FNum", "Ftst", "FS! "] { print("  " + describe(smc, key)) }
    for fan in 0..<fans.fanCount {
        print("fan \(fan):")
        for suffix in ["ID", "Ac", "Mn", "Mx", "Tg", "Sf", "Md", "md", "St"] {
            print("  " + describe(smc, "F\(fan)\(suffix)"))
        }
    }
    if let cpu = TemperatureReader.cpuSummary() {
        print(String(format: "cpu: avg %.1f °C, max %.1f °C (%d sensors)", cpu.average, cpu.maximum, cpu.count))
    }
}
