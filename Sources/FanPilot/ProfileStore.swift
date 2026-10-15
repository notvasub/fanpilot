import FanCore
import Foundation
import Observation

/// Saved profiles, the active control and user preferences, persisted in UserDefaults as JSON.
@MainActor
@Observable
final class ProfileStore {
    private enum Key {
        static let customProfiles = "customProfiles"
        static let activeControl = "activeControl"
        static let stepPercent = "stepPercent"
    }

    private(set) var customProfiles: [FanProfile]
    var active: ActiveControl {
        didSet { save(active, forKey: Key.activeControl) }
    }
    var stepPercent: Double {
        didSet { defaults.set(stepPercent, forKey: Key.stepPercent) }
    }

    @ObservationIgnored private let defaults: UserDefaults

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        customProfiles = Self.load([FanProfile].self, from: defaults, key: Key.customProfiles) ?? []
        active = Self.load(ActiveControl.self, from: defaults, key: Key.activeControl) ?? .automatic
        let step = defaults.double(forKey: Key.stepPercent)
        stepPercent = step > 0 ? step : 10
        if case .profile(let id) = active, profile(id: id) == nil {
            active = .automatic
        }
    }

    var allProfiles: [FanProfile] {
        FanProfile.builtIns + customProfiles
    }

    func profile(id: UUID) -> FanProfile? {
        allProfiles.first { $0.id == id }
    }

    var activeName: String {
        switch active {
        case .manual(let percent):
            return "Manual \(Int(percent.rounded()))%"
        case .profile(let id):
            return profile(id: id)?.name ?? "Automatic"
        }
    }

    @discardableResult
    func addProfile(name: String, modes: [FanMode]) -> FanProfile {
        let profile = FanProfile(name: uniqueName(name), modes: modes)
        customProfiles.append(profile)
        saveProfiles()
        return profile
    }

    func update(_ profile: FanProfile) {
        guard !profile.isBuiltIn, let index = customProfiles.firstIndex(where: { $0.id == profile.id }) else { return }
        customProfiles[index] = profile
        saveProfiles()
    }

    func delete(_ profile: FanProfile) {
        customProfiles.removeAll { $0.id == profile.id }
        saveProfiles()
        if active == .profile(profile.id) {
            active = .automatic
        }
    }

    /// Saves the current manual speed as a named profile and makes it active.
    func saveManualAsProfile(named name: String) {
        guard case .manual(let percent) = active else { return }
        let profile = addProfile(name: name, modes: [.fixed(percent: percent)])
        active = .profile(profile.id)
    }

    private func uniqueName(_ base: String) -> String {
        let trimmed = base.trimmingCharacters(in: .whitespacesAndNewlines)
        let root = trimmed.isEmpty ? "Custom" : trimmed
        let names = Set(allProfiles.map(\.name))
        guard names.contains(root) else { return root }
        var index = 2
        while names.contains("\(root) \(index)") { index += 1 }
        return "\(root) \(index)"
    }

    private func saveProfiles() {
        save(customProfiles, forKey: Key.customProfiles)
    }

    private func save<T: Encodable>(_ value: T, forKey key: String) {
        if let data = try? JSONEncoder().encode(value) {
            defaults.set(data, forKey: key)
        }
    }

    private static func load<T: Decodable>(_ type: T.Type, from defaults: UserDefaults, key: String) -> T? {
        guard let data = defaults.data(forKey: key) else { return nil }
        return try? JSONDecoder().decode(type, from: data)
    }
}
