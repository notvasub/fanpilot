import Carbon.HIToolbox
import Foundation

/// System-wide hot keys through Carbon's RegisterEventHotKey. Unlike a CGEventTap this needs no
/// Accessibility or Input Monitoring permission, and the registered key is consumed so it does not
/// also reach the frontmost app.
///
/// On a MacBook whose top row sends media keys (the default), the F4/F5 key codes are only produced
/// while fn is held, so `fn+F4` / `fn+F5` trigger these while the bare keys keep Spotlight/Dictation.
@MainActor
final class HotKeyCenter {
    static let shared = HotKeyCenter()

    private var actions: [UInt32: () -> Void] = [:]
    private var references: [EventHotKeyRef] = []
    private var handler: EventHandlerRef?
    private var nextID: UInt32 = 1
    private let signature: OSType = 0x464E_504C // 'FNPL'

    private init() {}

    /// Registers `keyCode` (a `kVK_*` virtual key code) with Carbon modifier flags (`shiftKey`, `optionKey`, …).
    @discardableResult
    func register(keyCode: Int, modifiers: Int = 0, action: @escaping () -> Void) -> Bool {
        installHandlerIfNeeded()
        let id = nextID
        nextID += 1
        var reference: EventHotKeyRef?
        let status = RegisterEventHotKey(
            UInt32(keyCode), UInt32(modifiers), EventHotKeyID(signature: signature, id: id),
            GetApplicationEventTarget(), 0, &reference)
        guard status == noErr, let reference else { return false }
        references.append(reference)
        actions[id] = action
        return true
    }

    func unregisterAll() {
        references.forEach { UnregisterEventHotKey($0) }
        references.removeAll()
        actions.removeAll()
    }

    fileprivate func fire(_ id: UInt32) {
        actions[id]?()
    }

    private func installHandlerIfNeeded() {
        guard handler == nil else { return }
        var eventType = EventTypeSpec(eventClass: OSType(kEventClassKeyboard), eventKind: UInt32(kEventHotKeyPressed))
        InstallEventHandler(GetApplicationEventTarget(), hotKeyEventHandler, 1, &eventType, nil, &handler)
    }
}

private func hotKeyEventHandler(_: EventHandlerCallRef?, event: EventRef?, _: UnsafeMutableRawPointer?) -> OSStatus {
    guard let event else { return OSStatus(eventNotHandledErr) }
    var hotKeyID = EventHotKeyID()
    let status = GetEventParameter(
        event, EventParamName(kEventParamDirectObject), EventParamType(typeEventHotKeyID), nil,
        MemoryLayout<EventHotKeyID>.size, nil, &hotKeyID)
    guard status == noErr else { return status }
    let id = hotKeyID.id
    MainActor.assumeIsolated {
        HotKeyCenter.shared.fire(id)
    }
    return noErr
}
