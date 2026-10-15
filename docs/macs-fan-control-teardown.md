# Macs Fan Control 1.5.21: teardown

Target: `/Applications/Macs Fan Control.app` (CrystalIDEA, build 82, Developer ID team `ACC5R6RH47`), universal x86_64 + arm64.
Analyzed on: Mac17,9 (Apple M5 Pro), macOS 26.6.2, 2026-10-14.
Method: static only. REA Mach-O/signature inspection, `strings`, `nm`, `otool` disassembly, plus a small XOR decoder for obfuscated strings. No decompiler was available (Ghidra/Hopper/IDA not configured), so control-flow claims come from reading arm64 disassembly and are marked as inferred where relevant.

REA evidence IDs: helper Mach-O `ev_8dddc7de…8724`, helper imports `ev_5015e0bd…a442`, helper signature `ev_ff64940b…3d21`.

---

## 1. Architecture at a glance

```
┌──────────────────────────── Macs Fan Control.app (user, unprivileged) ─────────────────────────────┐
│ Qt 5 C++ GUI (QtWidgets, QtMacExtras), menu-bar app (LSUIElement=1)                                │
│                                                                                                    │
│  QFanControl ── updateThread (1500 ms) ──► reads sensors + fan RPM                                 │
│       │       └ controlFanSpeedThread (1500 ms) ──► SensorBasedControl_Simple::update ──► setFanRPM │
│       │                                                                                            │
│  SMC::Service ──► SMC::PlatformMac                                                                 │
│                      ├─ readKey()  ──► IOKit "AppleSMC" user client directly (no root needed)       │
│                      └─ writeKey() ──► SmcWriteHelper ──XPC──┐                                      │
│  TemperatureSensorIOKit ──► IOHIDEventSystemClient (Apple Silicon die temps)                       │
│  TempSensorDiskMac ──► SMART / NVMe identify     GPU::ProviderMac ──► AGXAccelerator / Metal        │
└────────────────────────────────────────────────────────┼───────────────────────────────────────────┘
                                                         │ mach service com.crystalidea.macsfancontrol.smcwrite
┌────────────────────────────────────────────────────────▼───────────────────────────────────────────┐
│ /Library/PrivilegedHelperTools/com.crystalidea.macsfancontrol.smcwrite  (root LaunchDaemon, 190 KB) │
│ Plain C/C++/ObjC. Commands: open / close / write. Verifies caller's code signature, then           │
│ IOServiceOpen("AppleSMC") + IOConnectCallStructMethod(SMCKeyData_t, 80 bytes)                      │
└────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

The split matters: **reading the SMC works from any user process; writing needs root.** MFC keeps all logic in the GUI and puts the smallest possible root surface into a separate helper.

## 2. Main app: how it is built

| Aspect | Observed | Evidence |
|---|---|---|
| UI toolkit | Qt 5 (QtCore/Gui/Widgets/Network/DBus/PrintSupport/MacExtras frameworks bundled; `libqcocoa`, `libqmacstyle` plugins) | `Contents/Frameworks`, `PlugIns` |
| Language | C++ with Objective-C++ glue (`*.mm` source names in log strings: `SMC/Platform_mac.mm`, `Sensors/TempSensorIOKit.mm`, `mac/smcWriteInstaller.mm`) | strings |
| Libraries | spdlog + fmt (logging), tinyxml2 (sensor DBs), QuaZip/zlib (tech-info zip) | RTTI names |
| App type | Menu-bar agent (`LSUIElement=1`), optional dock icon | Info.plist, prefs `DockIcon` |
| Symbols | Not stripped: 4,384 local symbols with full C++ names | `nm` |
| String protection | SMC key names are XOR-obfuscated in thread-local storage and decoded lazily at startup (see §4). Everything else is plain text. | disassembly at `0x100050100–0x1000507b0`, `0x1001e51f8–0x1001e57d0` |

Key classes (from symbols): `QFanControl`, `SMC::Service`, `SMC::PlatformMac`, `SmcWriteHelper`, `smcWriteInstaller`, `FanProfile`, `FanProfilePredefined`, `QFanProfileList`, `FanControlMode`, `SensorBasedControl_Simple`, `TemperatureSensorProvider`, `TemperatureSensorSMC`, `TemperatureSensorIOKit`, `TempSensorDiskMac`, `TemperatureSensorGPU`, `TemperatureSensorAverage/Greatest/Virtual`.

Bundled data resources (Qt resources, gzipped XML): `:/Resources/xml/fanInfo.xml.gz` (per-model fan names), `:/Resources/xml/smcSensorsArm.xml.gz` (Apple Silicon SMC sensor key → name map), `:/Resources/xml/IOKitSensors.xml.gz`, `:/Resources/xml/idSwapRules.xml.gz`.

## 3. Privileged helper `smcwrite`

**Install.** `Info.plist` → `SMPrivilegedExecutables` = `com.crystalidea.macsfancontrol.smcwrite`. App calls `SMJobBless` (with `AuthorizationCreate`/`AuthorizationCopyRights` for `system.privilege.admin`). launchd copies the helper to `/Library/PrivilegedHelperTools/` and writes `/Library/LaunchDaemons/com.crystalidea.macsfancontrol.smcwrite.plist` (`MachServices`, `RunAtLoad`). Observed on this machine: daemon running, pid 559. The app also checks `launchctl print-disabled system` and re-enables the service if someone disabled it ("smcwrite seems to be disabled by someone, trying to fix that").

**Signing.** Helper is hardened-runtime, Developer ID, entitlement `com.apple.security.cs.disable-library-validation`. Embedded `SMAuthorizedClients` = `identifier com.crystalidea.macsfancontrol and certificate leaf[subject.OU] = ACC5R6RH47`.

**Imports (complete list, 76).** Only IOKit SMC calls (`IOServiceMatching`, `IOServiceOpen`, `IOConnectCallStructMethod`, `IOServiceClose`), XPC server calls, `Security` code-check calls (`SecCodeCopyGuestWithAttributes`, `SecRequirementCreateWithString`, `SecCodeCheckValidityWithErrors`, `SecCodeCopySigningInformation`), `proc_pidinfo`, and libc. No network, no file writes.

**XPC protocol** (mach service `com.crystalidea.macsfancontrol.smcwrite`, xpc dictionaries, string values):

| Request `command` | Other fields | Helper behavior |
|---|---|---|
| `open` | none | Validates caller (below), `SMCOpen()` on `AppleSMC`, remembers the caller pid. One client at a time; reopen from a new pid only allowed if the old pid is dead (`proc_pidinfo`). |
| `write` | `key` (4 chars), `value` (hex string, 2 chars per byte, built with `%02x`) | Copies key (5 bytes), parses hex pairs with `strtol(…,16)`, `SMCWriteKey`. Replies with `type` + `code`. **No allow-list of keys.** Any key the SMC accepts can be written. |
| `close` | none | `SMCClose()`, only from the pid that opened. |

**Caller validation** (`shouldAcceptNewConnection`): gets the audit token from the connection, `SecCodeCopyGuestWithAttributes`, checks requirement `anchor apple generic and certificate leaf[subject.OU] = "ACC5R6RH47"`, and rejects callers whose code-signing flags lack `CS_KILL|CS_RUNTIME` (so an unhardened/injected process cannot drive it).

**SMC call.** `SMCCall` = `IOConnectCallStructMethod(conn, selector, &in, 80, &out, &80)`. That 80-byte struct is the classic `SMCKeyData_t` from Apple's `smc.c` lineage (key, vers, pLimitData, keyInfo{dataSize, dataType, attributes}, result, status, data8, data32, bytes[32]). Function names `SMCOpen/SMCClose/SMCReadKey/SMCWriteKey/SMCKernCodeToString`, plus a `keyInfoCache` map, match that open-source lineage.

## 4. SMC keys and how fans are actually controlled

The fan key names never appear as plain strings. Each one is a 5- or 6-byte thread-local buffer filled at startup with ciphertext and XOR-decoded in place. Decoded with `deobf.py` (scratchpad):

| Global | Decoded | Meaning |
|---|---|---|
| `0x1002d5358` | `#KEY` | total SMC key count (used to enumerate all keys) |
| `0x1002d5360` | `FNum` | number of fans |
| `0x1002d5368` | `FS! ` | Intel-era "force" bitmask: bit *n* = fan *n* manual |
| `0x1002d5370` | `F{}ID` | fan *n* identification/name |
| `0x1002d5378` | `F{}Mn` | fan *n* minimum RPM |
| `0x1002d5380` | `F{}Mx` | fan *n* maximum RPM |
| `0x1002d5388` | `F{}Ac` | fan *n* actual RPM |
| `0x1002d5390` | `F{}Tg` | fan *n* target RPM |
| `0x1002d5398` | `F{}Sf` | fan *n* safe RPM |
| `0x1002d53a0` | `F{}Md` | fan *n* mode, older layout (0 = auto, 1 = manual) |
| `0x1002d53a8` | `F{}md` | fan *n* mode, lowercase layout used on newer Apple Silicon |
| `0x1002d53b0` | `Ftst` | "fan test" unlock flag (Apple Silicon) |
| `0x1002d53b8` | `LKSB` | keyboard backlight (unrelated to fans) |
| `0x1002d53c0` | `sp78` | SMC type: signed fixed-point 7.8 (Intel temps) |
| `0x1002d53c8` | `flt ` | SMC type: 32-bit little-endian float (Apple Silicon temps and RPMs) |

`{}` is a fmt placeholder for the fan index (`F0Tg`, `F1Tg`, …). `SMC::rpmTypeToString(type, fan)` maps type 0→`Ac`, 1→`Mn`, 2→`Mx`, 3→`Tg`, 4→`Sf`.

**Setting a fan to manual** (`SMC::Service::setFansControlModes`, `0x10004b2a8`):
1. `m_smcFanModeKey == 1` (Intel): pack all fans into a 16-bit bitmask, write `FS! ` (2 bytes).
2. `m_smcFanModeKey == 2`: for each fan write 1 byte to `F{n}Md`, or to `F{n}md` when the platform flag selects the lowercase layout.
3. Then, if a platform flag at `[service+0x10]+0x6d` is set (Apple Silicon), write `Ftst` = 1 if **any** fan is manual, else `Ftst` = 0.

**Setting speed** (`SMC::Service::setFanRPM`, `0x10004a9c0`): writes `F{n}Tg`. The encoding comes from `detectSmcFanKeySize`, which reads the key's type/size via `getKeyInfo`: 2 bytes `fpe2` (Intel, RPM << 2) or 4 bytes `flt ` (Apple Silicon float). A "Dual fan" special case drives two synchronized fans as one.

**Returning to automatic** (`restoreDefaultControl`): mode back to 0 for every fan, then `Ftst` = 0, which hands control back to the SMC/thermal firmware.

**Reads** (`SMC::PlatformMac::readKey`): opened directly from the GUI process with `IOServiceOpen("AppleSMC")`. Root is not needed. Only writes go through the helper. `PlatformMac::writeKey` calls `connectToSMCWrite()` lazily, then `SmcWriteHelper::write(key, bytes, len)`.

## 5. Sensors

- **SMC temps**: enumerate all keys via `#KEY` + get-key-by-index, keep `T***` keys, decode `sp78` / `flt `, map names via `smcSensorsArm.xml.gz` (e.g. `TCDX`, `TCMb`, "Performance Core N", "Super Core N"). Composite sensors `TemperatureSensorAverage` / `TemperatureSensorGreatest` back the `cpu_core_average` key seen in the user's prefs.
- **Apple Silicon die temps**: `IOHIDEventSystemClientCreate` + `SetMatching(PrimaryUsagePage=0xff00, PrimaryUsage=5)` + `IOHIDServiceClientCopyEvent` + `IOHIDEventGetFloatValue` (the private HID temperature-event API).
- **Drives**: SMART / NVMe identify through IOKit (`IOBlockStorageDevice`, `NVMe SMART Capable`).
- **GPU**: `AGXAccelerator` IORegistry stats, eGPU watcher.

## 6. Control loop and profiles

- `QFanControl::updateThread` and `controlFanSpeedThread` each wake every **1500 ms** (`waitForMultipleEvents(…, 0x5dc)`), or earlier on an event such as a profile change or wake.
- Sleep/wake: subscribes to `NSWorkspaceWillSleep/DidWake/WillPowerOff`. Before sleep it applies min RPM or automatic (`getProfileToApplyForSleepMode`). After wake it waits, then "Restore previous profile". On MacBooks, `wakeSMCOnMacBookWorkaround` nudges the SMC first.
- **Fan mode string** (`FanControlMode::toString/fromString`):
  - `0` → automatic
  - `1,<rpm>` → constant RPM
  - `2,<sensorKey>,<tempFrom>,<tempTo>` → sensor-based: RPM ramps from fan min at `tempFrom` to fan max at `tempTo`.
- **Sensor-based algorithm** (`SensorBasedControl_Simple::update`, inferred from its log strings): it tracks a temperature "tendency" (increase/decrease/do-nothing) with hysteresis ("Ignoring temperature change"). It moves RPM toward the interpolated target in half/double steps ("HALF INCREASE", "DOUBLE INCREASE", "Adding extra … from current rpm") and clamps at min/max ("PEEK MAX/MIN RPM"). It does not jump straight to the target, so the fan noise changes smoothly.
- **Profile string**: `<name>|<fan0 mode>|<fan1 mode>|…`, base64-encoded in `~/Library/Preferences/com.crystalidea.macsfancontrol.plist` (`QSettings`). Example from this machine: `ActivePreset = "Unsaved:" + base64("UNSAVED|2,cpu_core_average,50,80|2,cpu_core_average,50,80")`. Custom profiles are kept in `CustomPresets`. Predefined profiles (`FanProfilePredefined`) include Automatic and others; custom ones are a Pro feature (`Presets/presetMenuProVersion`).

## 7. What is *not* there

- **No global hotkeys.** No `RegisterEventHotKey`, `CGEventTap`, or `NSEvent addGlobalMonitor` imports, and no hotkey/shortcut strings. The only key binding is in-window `Ctrl+S` (save preset). F4/F5 control would be new functionality.
- No network use in the helper. The main app only uses the network for update checks and license verification.

## 8. Blueprint for a clone with F4/F5 + profiles

What carries over directly (observed behavior):
1. **Two processes.** An unprivileged menu-bar app does reads, logic, UI, and hotkeys. A tiny root daemon only executes `open/write/close` SMC calls over XPC.
2. **Keys** (this Mac is Apple Silicon): read `FNum`, `F{n}Mn`, `F{n}Mx`, `F{n}Ac` (`flt `). For manual control write `F{n}md` (or `F{n}Md`, whichever key exists) = 1, then `Ftst` = 1, then `F{n}Tg` (`flt `). To return to automatic: mode = 0, then `Ftst` = 0.
3. **Profiles**: the same mode grammar (`auto`, `constant rpm`, `sensor key from..to`), named presets, stored in `UserDefaults`/JSON.
4. **Safety**: restore automatic on quit, sleep, crash (daemon watchdog: if the client pid dies, reset fans), and clamp to `[Mn, Mx]`.

Design choices that differ from MFC (not derived from the binary):
- Swift + SwiftUI `MenuBarExtra` instead of Qt. Daemon registered with `SMAppService.daemon(plistName:)` (macOS 13+) instead of the deprecated `SMJobBless`.
- Daemon validates the client by code-signing requirement, like MFC. Unlike MFC, it also keeps a **key allow-list** (`F*md`, `F*Md`, `F*Tg`, `Ftst`, `FS! `).
- **Hotkeys**: on this Mac the top row sends media functions by default (`com.apple.keyboard.fnState` unset). F4 is Spotlight and F5 is Dictation, and those are not delivered as `kVK_F4`/`kVK_F5` keyDowns. Options:
  - (a) fn+F4 / fn+F5 or "Use F1, F2… as standard function keys": a plain `CGEventTap` for keycodes `0x76`/`0x60` works (needs Input Monitoring/Accessibility permission).
  - (b) Intercept the media versions (Spotlight/Dictation) directly: needs `hidutil` key remapping or a HID-level hook, which is more fragile.
- Hotkey semantics: each press steps every fan's target by ±N RPM (or ±10% of range) and switches to a "manual" overlay. A separate hotkey or menu item cycles profiles or resets to Automatic.

## 9. Open questions

| Question | Status |
|---|---|
| Exact SMC selector value and `SMCKeyData_t` layout | Partially answered: 80-byte struct observed. Selector passed as a parameter, value not read from disasm (public lineage uses 2). |
| Which predicate selects `F{n}md` vs `F{n}Md` | Partially answered: chosen by `m_smcFanModeKey` plus a platform flag. Likely "whichever key exists" via `getKeyInfo` (inferred, not traced). |
| Exact ramp constants in `SensorBasedControl_Simple` | Unresolved without a decompiler. |
| Whether writes need `Ftst` before or after mode on M5 | Answered for this Mac: the M5 Pro has **no `Ftst` key** (live read with `fanctl`). Only `F{n}md` is used. |

## 10. Live SMC readings on this Mac (read-only, `fanctl`)

- `FNum` = 2. Each fan has `F{n}Ac/Mn/Mx/Tg` as `flt ` (Mn 2317, Mx 7826) and `F{n}md` as `ui8 `. It does not have `F{n}Md`, `F{n}ID`, `F{n}Sf`, `Ftst` or `FS! `.
- `F{n}md` = 1 while Macs Fan Control held the fans in a sensor profile. Both fans read `md` = 0 and 0 RPM with target 0 once it was gone, so automatic mode lets the fans stop at idle.
- Other fan keys present: `F{n}CR`, `F{n}Dc`, `F{n}PC`, `F{n}PV`, `F{n}St` (= 5), `F{n}S0–S7`, `FEna`, `FPSt`, `FRev`, `FVer`. Their meanings were not investigated.
- The CPU die temperatures come from 42 IOHID services named `PMU tdie1…14` (3 readings each).
