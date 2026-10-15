import Foundation
import Security

/// Code-signing requirements used on both ends of the XPC connection, so the helper only serves
/// FanPilot and FanPilot only talks to its own helper.
public enum CodeSigning {
    /// Team identifier of the running process, or nil when it is ad-hoc signed.
    public static func currentTeamIdentifier() -> String? {
        var code: SecCode?
        guard SecCodeCopySelf([], &code) == errSecSuccess, let code else { return nil }
        var staticCode: SecStaticCode?
        guard SecCodeCopyStaticCode(code, [], &staticCode) == errSecSuccess, let staticCode else { return nil }
        var info: CFDictionary?
        guard SecCodeCopySigningInformation(staticCode, SecCSFlags(rawValue: kSecCSSigningInformation), &info)
            == errSecSuccess
        else { return nil }
        return (info as? [String: Any])?[kSecCodeInfoTeamIdentifier as String] as? String
    }

    /// Requirement for a peer signed by the same team with the given bundle identifier.
    public static func sameTeamRequirement(identifier: String) -> String? {
        guard let team = currentTeamIdentifier() else { return nil }
        return "anchor apple generic and identifier \"\(identifier)\" and certificate leaf[subject.OU] = \"\(team)\""
    }

    /// Designated requirement of the code at `url` (for ad-hoc development builds this pins the exact cdhash).
    public static func designatedRequirement(ofCodeAt url: URL) -> String? {
        var staticCode: SecStaticCode?
        guard SecStaticCodeCreateWithPath(url as CFURL, [], &staticCode) == errSecSuccess, let staticCode else {
            return nil
        }
        var requirement: SecRequirement?
        guard SecCodeCopyDesignatedRequirement(staticCode, [], &requirement) == errSecSuccess, let requirement else {
            return nil
        }
        var text: CFString?
        guard SecRequirementCopyString(requirement, [], &text) == errSecSuccess else { return nil }
        return text as String?
    }
}
