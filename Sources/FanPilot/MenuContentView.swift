import FanCore
import SMCKit
import SwiftUI

struct MenuContentView: View {
    let model: AppModel
    @Environment(\.openWindow) private var openWindow
    @State private var savingName = ""
    @State private var isSaving = false

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            header
            if let message = model.statusMessage {
                statusBanner(message)
            }
            fansSection
            Divider()
            profilesSection
            Divider()
            manualSection
            Divider()
            shortcutsHint
            footer
        }
        .padding(14)
        .frame(width: 320)
    }

    private var header: some View {
        HStack {
            Text("FanPilot").font(.headline)
            Spacer()
            if let cpu = model.cpu {
                Label(String(format: "%.0f °C avg · %.0f °C max", cpu.average, cpu.maximum), systemImage: "cpu")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .monospacedDigit()
            }
        }
    }

    private func statusBanner(_ message: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(message).font(.callout).fixedSize(horizontal: false, vertical: true)
            HStack {
                if model.conflictingAppRunning {
                    Button("Quit Macs Fan Control") { model.quitMacsFanControl() }
                }
                switch model.helper.state {
                case .notInstalled:
                    Button("Install Helper…") { model.helper.install() }
                case .needsApproval:
                    Button("Open Login Items") { model.helper.openLoginItemsSettings() }
                default:
                    EmptyView()
                }
            }
            .controlSize(.small)
        }
        .padding(8)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.orange.opacity(0.15), in: RoundedRectangle(cornerRadius: 8))
    }

    private var fansSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            ForEach(model.readings, id: \.index) { fan in
                FanRow(fan: fan, name: model.readings.count == 2 ? (fan.index == 0 ? "Left fan" : "Right fan") : "Fan \(fan.index + 1)")
            }
            if model.readings.isEmpty {
                Text("No fans found").foregroundStyle(.secondary)
            }
        }
    }

    private var profilesSection: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("Profiles").font(.subheadline).foregroundStyle(.secondary)
            ForEach(model.store.allProfiles) { profile in
                Button {
                    model.select(profile)
                } label: {
                    HStack {
                        Image(systemName: model.store.active == .profile(profile.id) ? "checkmark.circle.fill" : "circle")
                            .foregroundStyle(model.store.active == .profile(profile.id) ? Color.accentColor : .secondary)
                        Text(profile.name)
                        Spacer()
                        Text(profile.mode(forFan: 0).summary)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
            }
        }
    }

    private var manualSection: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text("Manual speed").font(.subheadline).foregroundStyle(.secondary)
                Spacer()
                if case .manual(let percent) = model.store.active {
                    Text("\(Int(percent.rounded()))%").monospacedDigit().font(.subheadline)
                }
            }
            HStack {
                Button { model.nudge(-1) } label: { Image(systemName: "minus") }
                Slider(
                    value: Binding(
                        get: { model.currentPercent },
                        set: { model.setManualPercent($0) }),
                    in: 0...100)
                Button { model.nudge(+1) } label: { Image(systemName: "plus") }
            }
            if case .manual = model.store.active {
                if isSaving {
                    HStack {
                        TextField("Profile name", text: $savingName)
                            .textFieldStyle(.roundedBorder)
                            .onSubmit(save)
                        Button("Save", action: save)
                    }
                } else {
                    Button("Save as Profile…") {
                        savingName = model.store.activeName
                        isSaving = true
                    }
                    .controlSize(.small)
                }
            }
        }
    }

    private var shortcutsHint: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text("fn F4 / fn F5 — slower / faster by \(Int(model.store.stepPercent))%")
            Text("fn ⇧F4 — automatic   ·   fn ⇧F5 — next profile")
        }
        .font(.caption)
        .foregroundStyle(.secondary)
    }

    private var helperStatusText: String {
        switch model.helper.state {
        case .notInstalled: return "Helper: not installed"
        case .needsApproval: return "Helper: waiting for approval"
        case .ready: return "Helper: running"
        case .unavailable: return "Helper: unavailable"
        }
    }

    private var footer: some View {
        HStack {
            Menu {
                if model.helper.state == .notInstalled {
                    Button("Install Helper…") { model.helper.install() }
                } else {
                    Button("Uninstall Helper") { model.helper.uninstall() }
                }
                Toggle("Launch at Login", isOn: Binding(get: { model.launchAtLogin }, set: { model.setLaunchAtLogin($0) }))
                Picker("Hotkey Step", selection: Binding(get: { model.store.stepPercent }, set: { model.store.stepPercent = $0 })) {
                    ForEach([5.0, 10.0, 15.0, 20.0, 25.0], id: \.self) { Text("\(Int($0))%").tag($0) }
                }
            } label: {
                Text(helperStatusText)
            }
            .menuStyle(.borderlessButton)
            .fixedSize()
            Spacer()
            Button("Profiles…") {
                openWindow(id: ProfilesWindow.id)
                NSApp.activate(ignoringOtherApps: true)
            }
            Spacer()
            Button("Quit") {
                model.prepareForQuit()
                NSApp.terminate(nil)
            }
        }
        .controlSize(.small)
    }

    private func save() {
        model.store.saveManualAsProfile(named: savingName)
        isSaving = false
    }
}

private struct FanRow: View {
    let fan: FanReading
    let name: String

    var body: some View {
        VStack(alignment: .leading, spacing: 3) {
            HStack {
                Text(name)
                Text(fan.isManual ? "Manual" : "Auto")
                    .font(.caption2.weight(.semibold))
                    .padding(.horizontal, 5)
                    .padding(.vertical, 1)
                    .background((fan.isManual ? Color.accentColor : Color.secondary).opacity(0.2), in: Capsule())
                Spacer()
                Text(AppModel.rpmText(fan.actualRPM)).monospacedDigit()
            }
            ProgressView(value: FanRange(minRPM: fan.minRPM, maxRPM: fan.maxRPM).percent(rpm: fan.actualRPM), total: 100)
                .progressViewStyle(.linear)
            Text("\(Int(fan.minRPM))–\(Int(fan.maxRPM)) RPM · target \(Int(fan.targetRPM.rounded()))")
                .font(.caption2)
                .foregroundStyle(.secondary)
                .monospacedDigit()
        }
    }
}
