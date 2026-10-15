import Foundation

public enum FanPilotIDs {
    public static let appBundleID = "com.vasu.fanpilot"
    public static let helperLabel = "com.vasu.fanpilot.helper"
    public static let helperMachService = helperLabel
    public static let helperPlistName = "\(helperLabel).plist"
    public static let helperVersion = "1.0.0"
    public static let macsFanControlBundleID = "com.crystalidea.macsfancontrol"
}

/// XPC interface of the root helper. Deliberately fan-level only: unlike the Macs Fan Control helper,
/// which accepts arbitrary `key`/`value` writes, this one can only touch fan mode and target keys,
/// and it clamps every target to the fan's own min/max as read from the SMC.
/// Replies carry nil on success or a human-readable error.
@objc public protocol FanHelperProtocol {
    func helperVersion(withReply reply: @escaping (String) -> Void)
    func setFan(_ fan: Int, manualRPM rpm: Double, withReply reply: @escaping (String?) -> Void)
    func setFanAutomatic(_ fan: Int, withReply reply: @escaping (String?) -> Void)
    func resetAllFans(withReply reply: @escaping (String?) -> Void)
}
