import FanCore
import SwiftUI

/// Create, edit and delete custom profiles. Built-in profiles are read-only but can be duplicated.
struct ProfilesWindow: View {
    static let id = "profiles"

    let model: AppModel
    @State private var selection: UUID?

    private var store: ProfileStore { model.store }

    var body: some View {
        HSplitView {
            VStack(spacing: 0) {
                List(selection: $selection) {
                    Section("Built-in") {
                        ForEach(FanProfile.builtIns) { Text($0.name).tag($0.id) }
                    }
                    Section("Custom") {
                        ForEach(store.customProfiles) { Text($0.name).tag($0.id) }
                    }
                }
                HStack {
                    Button { addProfile() } label: { Image(systemName: "plus") }
                    Button { deleteSelected() } label: { Image(systemName: "minus") }
                        .disabled(selectedProfile?.isBuiltIn ?? true)
                    Spacer()
                }
                .buttonStyle(.borderless)
                .padding(6)
            }
            .frame(minWidth: 180, idealWidth: 200)

            Group {
                if let profile = selectedProfile {
                    ProfileEditor(
                        profile: profile, fanCount: max(model.readings.count, 1),
                        onChange: { store.update($0) },
                        onDuplicate: { duplicate(profile) },
                        onActivate: { model.select(profile) })
                        .id(profile.id)
                } else {
                    Text("Select a profile").foregroundStyle(.secondary)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                }
            }
            .frame(minWidth: 340, idealWidth: 380)
        }
        .frame(minHeight: 320)
        .onAppear {
            if selection == nil, case .profile(let id) = store.active { selection = id }
        }
    }

    private var selectedProfile: FanProfile? {
        selection.flatMap { store.profile(id: $0) }
    }

    private func addProfile() {
        let profile = store.addProfile(
            name: "Custom", modes: [.curve(source: .cpuAverage, fromCelsius: 50, toCelsius: 80)])
        selection = profile.id
    }

    private func duplicate(_ profile: FanProfile) {
        let copy = store.addProfile(name: profile.name, modes: profile.modes)
        selection = copy.id
    }

    private func deleteSelected() {
        guard let profile = selectedProfile, !profile.isBuiltIn else { return }
        store.delete(profile)
        selection = nil
    }
}

private struct ProfileEditor: View {
    @State var profile: FanProfile
    let fanCount: Int
    let onChange: (FanProfile) -> Void
    let onDuplicate: () -> Void
    let onActivate: () -> Void

    var body: some View {
        Form {
            TextField("Name", text: $profile.name)
                .disabled(profile.isBuiltIn)
            Toggle("Separate settings per fan", isOn: perFanBinding)
                .disabled(profile.isBuiltIn || fanCount < 2)
            ForEach(0..<(profile.modes.count > 1 ? fanCount : 1), id: \.self) { fan in
                Section(profile.modes.count > 1 ? "Fan \(fan + 1)" : "All fans") {
                    ModeEditor(mode: modeBinding(fan))
                }
                .disabled(profile.isBuiltIn)
            }
            HStack {
                Button("Use This Profile", action: onActivate)
                Button("Duplicate", action: onDuplicate)
                if profile.isBuiltIn {
                    Text("Built-in profiles are read-only.").font(.caption).foregroundStyle(.secondary)
                }
            }
        }
        .formStyle(.grouped)
        .onChange(of: profile) { _, updated in
            if !updated.isBuiltIn { onChange(updated) }
        }
    }

    private var perFanBinding: Binding<Bool> {
        Binding(
            get: { profile.modes.count > 1 },
            set: { separate in
                let first = profile.mode(forFan: 0)
                profile.modes = separate ? Array(repeating: first, count: fanCount) : [first]
            })
    }

    private func modeBinding(_ fan: Int) -> Binding<FanMode> {
        Binding(
            get: { profile.mode(forFan: fan) },
            set: { mode in
                if profile.modes.isEmpty { profile.modes = [mode] } else { profile.modes[min(fan, profile.modes.count - 1)] = mode }
            })
    }
}

private struct ModeEditor: View {
    @Binding var mode: FanMode

    private enum Kind: String, CaseIterable, Identifiable {
        case automatic = "Automatic"
        case fixed = "Fixed speed"
        case curve = "Follow temperature"
        var id: String { rawValue }
    }

    private var kind: Binding<Kind> {
        Binding(
            get: {
                switch mode {
                case .automatic: return .automatic
                case .fixed: return .fixed
                case .curve: return .curve
                }
            },
            set: { kind in
                switch kind {
                case .automatic: mode = .automatic
                case .fixed: mode = .fixed(percent: 50)
                case .curve: mode = .curve(source: .cpuAverage, fromCelsius: 50, toCelsius: 80)
                }
            })
    }

    var body: some View {
        Picker("Mode", selection: kind) {
            ForEach(Kind.allCases) { Text($0.rawValue).tag($0) }
        }
        switch mode {
        case .automatic:
            Text("The Mac's own thermal management controls this fan.")
                .font(.caption).foregroundStyle(.secondary)
        case .fixed(let percent):
            LabeledContent("Speed") {
                HStack {
                    Slider(value: Binding(get: { percent }, set: { mode = .fixed(percent: $0.rounded()) }), in: 0...100)
                    Text("\(Int(percent))%").monospacedDigit().frame(width: 40, alignment: .trailing)
                }
            }
        case .curve(let source, let from, let to):
            Picker("Sensor", selection: Binding(get: { source }, set: { mode = .curve(source: $0, fromCelsius: from, toCelsius: to) })) {
                ForEach(TemperatureSource.allCases, id: \.self) { Text($0.label).tag($0) }
            }
            Stepper(
                "Start ramping at \(Int(from)) °C",
                value: Binding(get: { from }, set: { mode = .curve(source: source, fromCelsius: min($0, to - 5), toCelsius: to) }),
                in: 30...95, step: 1)
            Stepper(
                "Full speed at \(Int(to)) °C",
                value: Binding(get: { to }, set: { mode = .curve(source: source, fromCelsius: from, toCelsius: max($0, from + 5)) }),
                in: 35...105, step: 1)
        }
    }
}
