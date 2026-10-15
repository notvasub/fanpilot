#!/bin/bash
# Builds FanPilot.app (menu-bar app + embedded root helper), signs it, and optionally installs it.
#
#   scripts/build-app.sh            # build + sign into build/FanPilot.app
#   scripts/build-app.sh --install  # also copy to /Applications (SMAppService wants a stable location)
#
# Signing identity: $FANPILOT_SIGN_IDENTITY, else the first "Apple Development" identity, else ad-hoc.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP="$ROOT/build/FanPilot.app"
INSTALL=0
[[ "${1:-}" == "--install" ]] && INSTALL=1

cd "$ROOT"
swift build -c release --product FanPilot
swift build -c release --product FanPilotHelper
BIN="$(swift build -c release --show-bin-path)"

rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Library/LaunchDaemons" "$APP/Contents/Resources"
cp "$ROOT/Support/Info.plist" "$APP/Contents/Info.plist"
cp "$ROOT/Support/com.vasu.fanpilot.helper.plist" "$APP/Contents/Library/LaunchDaemons/"
cp "$BIN/FanPilot" "$APP/Contents/MacOS/FanPilot"
cp "$BIN/FanPilotHelper" "$APP/Contents/MacOS/FanPilotHelper"

IDENTITY="${FANPILOT_SIGN_IDENTITY:-}"
if [[ -z "$IDENTITY" ]]; then
  IDENTITY="$(security find-identity -v -p codesigning | awk -F'"' '/Apple Development|Developer ID Application/ {print $2; exit}')"
fi
if [[ -z "$IDENTITY" ]]; then
  echo "warning: no signing identity found, using ad-hoc signing (helper will only trust this exact build)" >&2
  IDENTITY="-"
fi
echo "Signing with: $IDENTITY"

# Inner code first, then the bundle. Hardened runtime on both; the helper's identifier is what the
# app's XPC code-signing requirement checks.
codesign --force --options runtime --timestamp=none --identifier com.vasu.fanpilot.helper \
  --sign "$IDENTITY" "$APP/Contents/MacOS/FanPilotHelper"
codesign --force --options runtime --timestamp=none --identifier com.vasu.fanpilot \
  --sign "$IDENTITY" "$APP"
codesign --verify --deep --strict "$APP"
echo "Built $APP"

if [[ $INSTALL -eq 1 ]]; then
  pkill -x FanPilot 2>/dev/null || true
  sleep 0.5
  rm -rf /Applications/FanPilot.app
  ditto "$APP" /Applications/FanPilot.app
  echo "Installed /Applications/FanPilot.app"
fi
