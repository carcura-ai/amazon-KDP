#!/usr/bin/env bash
# Läuft auf macOS (lokal oder GitHub Actions): erzeugt das Xcode-Projekt, Icons und Info.plist-Einträge.
set -euo pipefail
cd "$(dirname "$0")/.."
[ -d ios ] || npx cap add ios
npm run assets
npx cap sync ios
PLIST=ios/App/App/Info.plist
set_plist() { /usr/libexec/PlistBuddy -c "Set :$1 $2" "$PLIST" 2>/dev/null || /usr/libexec/PlistBuddy -c "Add :$1 $3 $2" "$PLIST"; }
set_plist CFBundleDisplayName "Carcura Manager" string
set_plist NSCameraUsageDescription "Fotos für Fahrzeugprotokolle und Belege aufnehmen." string
set_plist NSPhotoLibraryUsageDescription "Bilder aus der Fotomediathek an Protokolle und Belege anhängen." string
set_plist NSPhotoLibraryAddUsageDescription "Erzeugte PDFs und Bilder speichern." string
set_plist ITSAppUsesNonExemptEncryption false bool
set_plist UIViewControllerBasedStatusBarAppearance true bool
# Zugriff auf den Laptop im WLAN (http://192.168.x.x:4800) erlauben; alle anderen Verbindungen bleiben HTTPS.
/usr/libexec/PlistBuddy -c "Delete :NSAppTransportSecurity" "$PLIST" 2>/dev/null || true
/usr/libexec/PlistBuddy -c "Add :NSAppTransportSecurity dict" "$PLIST"
/usr/libexec/PlistBuddy -c "Add :NSAppTransportSecurity:NSAllowsLocalNetworking bool true" "$PLIST"
# Versionsnummer aus package.json, Build-Nummer fortlaufend (Zeitstempel)
VERSION=$(node -p "require('./package.json').version")
BUILD=${BUILD_NUMBER:-$(date +%Y%m%d%H%M)}
set_plist CFBundleShortVersionString "$VERSION" string
set_plist CFBundleVersion "$BUILD" string
echo "Xcode-Projekt vorbereitet: Version $VERSION, Build $BUILD"
