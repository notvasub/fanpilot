// swift-tools-version:6.0
import PackageDescription

let package = Package(
    name: "FanPilot",
    platforms: [.macOS(.v14)],
    products: [
        .executable(name: "FanPilot", targets: ["FanPilot"]),
        .executable(name: "FanPilotHelper", targets: ["FanPilotHelper"]),
        .executable(name: "fanctl", targets: ["fanctl"]),
    ],
    targets: [
        // Raw AppleSMC user-client access and the private IOHID temperature API.
        .target(
            name: "CSMC",
            linkerSettings: [.linkedFramework("IOKit"), .linkedFramework("CoreFoundation")]
        ),
        // Pure logic shared by app, helper and tests: models, profile codec, curve math, SMC value codec, XPC protocol.
        .target(name: "FanCore"),
        // Swift wrapper over CSMC: key reads/writes, fan-level operations, temperature sensors.
        .target(name: "SMCKit", dependencies: ["CSMC", "FanCore"]),
        // Root LaunchDaemon (registered with SMAppService). Only writes fan keys.
        .executableTarget(name: "FanPilotHelper", dependencies: ["SMCKit", "FanCore"]),
        // Menu-bar app.
        .executableTarget(
            name: "FanPilot",
            dependencies: ["SMCKit", "FanCore"],
            linkerSettings: [.linkedFramework("Carbon"), .linkedFramework("ServiceManagement")]
        ),
        // Read-only diagnostics CLI.
        .executableTarget(name: "fanctl", dependencies: ["SMCKit", "FanCore"]),
        .testTarget(name: "FanCoreTests", dependencies: ["FanCore"]),
    ],
    swiftLanguageModes: [.v5]
)
