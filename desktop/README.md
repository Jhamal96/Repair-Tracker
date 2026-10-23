# AJD's Wireless Repairs — Desktop application

This is the Windows and macOS wrapper for https://repair.ajdapp.org/. It **does not create another database or bypass the administrator gate**. Its repair records, receipts, inventory, expenses and requests use the existing hosted website and current Supabase security policies.

## Downloads

- Windows 10/11 x64: `AJD-Wireless-Repairs-Windows-Setup.exe`
- macOS Apple Silicon / Intel: `AJD-Wireless-Repairs-macOS.dmg`
- Android: existing [AJD APK](https://github.com/Jhamal96/Repair-Tracker/releases/download/android-latest/AJD-Wireless-Repairs-Admin.apk)
- Download page: https://repair.ajdapp.org/download
- [Desktop GitHub Actions](https://github.com/Jhamal96/Repair-Tracker/actions/workflows/desktop.yml)
- [Desktop installers release](https://github.com/Jhamal96/Repair-Tracker/releases/tag/desktop-latest)

## Notes

- These are **unsigned test installers**. Code signing/notarization and an ongoing stable update plan are still required for wider distribution; do not disable system-wide device protections.
- This private GitHub repository requires authorized GitHub account access to download release assets.
- The app is a site shell. It requires connectivity to the hosted website. Local desktop Chromium session storage is separate from the web browser / Android APK, but cloud repair records remain shared through Supabase login.
- The existing website's print/receipt features operate through Chromium printing. External navigation opens the system browser; the embedded Electron renderer has Node.js access disabled, context isolation and sandbox enabled.
- Camera permission is limited to the trusted HTTPS repair origin, for QR/scan support if needed.
- The PWA install button is hidden inside the downloaded desktop app to avoid duplicate install prompts.

## Development

With Node 22 installed: `cd desktop && npm install && npm start`. Build on Windows using `npm run dist:win` or Mac using `npm run dist:mac`. GitHub Actions compiles both platforms and publishes test installers to the reusable `desktop-latest` pre-release tag.
